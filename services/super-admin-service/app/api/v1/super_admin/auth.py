"""Authentication endpoints for Super Admins."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

import pyotp
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.security import create_access_token, create_refresh_token, verify_password
from ....db.mongo import get_db
from ....utils.mongo import serialize_document
from ....utils.responses import success_response
from .schemas import SuperAdminLoginRequest, SuperAdminMFARequest

logger = logging.getLogger(__name__)

router = APIRouter(tags=["super-admin-auth"])


def _normalize_email(email: str) -> str:
    """Normalize email address."""
    return email.strip().lower()


async def _find_user_by_email(db: AsyncIOMotorDatabase, email: str) -> dict | None:
    """Find user by email."""
    normalized = _normalize_email(email)
    pattern = re.compile(f"^{re.escape(normalized)}$", re.IGNORECASE)

    matches: list[dict] = []
    async for doc in db.users.find({"email": pattern}):
        matches.append(doc)

    if not matches:
        return None

    preferred = next((doc for doc in matches if doc.get("email") == normalized), None)
    super_admin_match = next((doc for doc in matches if doc.get("role") == "super_admin"), None)
    if super_admin_match:
        preferred = super_admin_match
    if not preferred:
        preferred = matches[0]

    if preferred.get("email") != normalized:
        await db.users.update_one({"_id": preferred["_id"]}, {"$set": {"email": normalized}})
        preferred["email"] = normalized

    return preferred


@router.post("/login")
async def super_admin_login(
    payload: SuperAdminLoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Super admin login endpoint.
    Returns require_mfa flag if credentials are valid and user is super_admin.
    """
    email = _normalize_email(payload.email)
    user = await _find_user_by_email(db, email)

    # Generic error message to prevent user enumeration
    generic_error = "Invalid email or password"

    if not user:
        logger.info("Super admin login attempt for non-existent user: %s", email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic_error)

    # Check if user is super_admin
    if user.get("role") != "super_admin":
        logger.info("Login attempt for non-super-admin user: %s", email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic_error)

    # Check if password is set
    if not user.get("password"):
        logger.info("Super admin login attempt - password not set: %s", email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic_error)

    # Verify password
    if not verify_password(payload.password, user["password"]):
        logger.info("Invalid password attempt for super admin: %s", email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic_error)

    # Check if TOTP secret exists
    if not user.get("totp_secret"):
        logger.warning("Super admin %s does not have TOTP secret configured", email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP not configured. Please contact administrator.",
        )

    # Check email verification
    if not user.get("emailVerified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email before signing in.",
        )

    # Return require_mfa flag
    return success_response(
        "MFA required",
        {
            "require_mfa": True,
            "email": email,
        },
    )


@router.post("/verify-mfa")
async def verify_mfa(
    payload: SuperAdminMFARequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Verify MFA TOTP code and generate JWT tokens.
    """
    email = _normalize_email(payload.email)
    user = await _find_user_by_email(db, email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    # Get TOTP secret
    totp_secret = user.get("totp_secret")
    if not totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP not configured",
        )

    # Verify TOTP code
    try:
        totp = pyotp.TOTP(totp_secret)
        is_valid = totp.verify(payload.code, valid_window=1)  # Allow 1 time step window
    except Exception as exc:
        logger.error("TOTP verification error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TOTP verification failed",
        ) from exc

    if not is_valid:
        logger.warning("Invalid TOTP code for super admin: %s", email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid TOTP code",
        )

    # Generate JWT tokens
    access_token = create_access_token(str(user["_id"]), "super_admin")
    refresh_token = create_refresh_token(str(user["_id"]), "super_admin")

    # Log login
    await _log_super_admin_login(db, user)

    user_data = serialize_document(user)
    return success_response(
        "MFA verified successfully",
        {
            "token": access_token,
            "refreshToken": refresh_token,
            "user": {
                "id": user_data["id"],
                "name": user_data.get("name"),
                "email": user_data.get("email"),
                "role": user_data.get("role"),
            },
        },
    )


async def _log_super_admin_login(db: AsyncIOMotorDatabase, user: dict) -> None:
    """Log super admin login."""
    try:
        log_entry = {
            "superAdminId": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "loginTime": datetime.now(timezone.utc),
            "logoutTime": None,
        }
        await db.superadmin_logs.insert_one(log_entry)
        logger.info("Logged super admin login: %s", user.get("email"))
    except Exception as exc:
        logger.error("Failed to log super admin login: %s", exc)
        # Don't fail the login if logging fails

