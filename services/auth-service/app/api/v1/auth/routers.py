from __future__ import annotations

import logging
import random
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from ....core.config import get_settings
from ....core.security import create_access_token, create_refresh_token, get_password_hash, verify_password, sanitize_text_field
from ....db.mongo import get_db
from .schemas import (
    ForgotPasswordRequest,
    GoogleSignupRequest,
    LoginRequest,
    OAuthLoginRequest,
    OrgSignupRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    SendVerificationCodeRequest,
    SuperAdminSignupRequest,
    VerifyEmailCodeRequest,
    VerifyResetTokenRequest,
    VerifyTokenRequest,
)
from ....utils.email import get_email_service
from ....utils.mongo import serialize_document
from ....utils.responses import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Rate limiter instance (will be initialized in main.py)
limiter: Limiter | None = None

# Separate MongoDB client for organization management (shared with employee service)
_employee_db_client: AsyncIOMotorClient | None = None
_employee_db: AsyncIOMotorDatabase | None = None


async def get_employee_database() -> AsyncIOMotorDatabase:
    """Get connection to the organization database used for organization management."""
    global _employee_db_client, _employee_db
    settings = get_settings()
    
    if _employee_db_client is None:
        _employee_db_client = AsyncIOMotorClient(
            settings.mongo_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
        )
        # Use a dedicated database for organizations (must match employee-service Settings.organization_mongo_db)
        _employee_db = _employee_db_client["organization_db"]
        await _employee_db_client.admin.command("ping")
    
    return _employee_db


async def generate_organization_id(employee_db: AsyncIOMotorDatabase) -> str:
    """Generate a unique organization ID in format ORG001, ORG002, etc."""
    org_collection = employee_db.organizations
    
    # Find the highest existing org ID
    highest_org = await org_collection.find_one(
        sort=[("orgId", -1)],
        projection={"orgId": 1}
    )
    
    if highest_org and highest_org.get("orgId"):
        # Extract number from existing org ID (e.g., "ORG001" -> 1)
        existing_id = highest_org["orgId"]
        match = re.search(r'\d+', existing_id)
        if match:
            next_num = int(match.group()) + 1
        else:
            next_num = 1
    else:
        next_num = 1
    
    # Format as ORG + 3-digit number (e.g., ORG001, ORG002)
    org_id = f"ORG{str(next_num).zfill(3)}"
    
    # Ensure uniqueness (in case of race condition)
    existing = await org_collection.find_one({"orgId": org_id})
    if existing:
        # If exists, try next number
        next_num += 1
        org_id = f"ORG{str(next_num).zfill(3)}"
    
    return org_id


async def create_organization(employee_db: AsyncIOMotorDatabase, org_id: str, org_name: str) -> dict:
    """Create a new organization in the employee database."""
    org_collection = employee_db.organizations
    
    org_doc = {
        "orgId": org_id,
        "name": org_name,
        "employeeCounter": 0,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    
    result = await org_collection.insert_one(org_doc)
    logger.info("Created organization: %s (ID: %s)", org_name, org_id)
    
    return org_doc

# Test endpoint to verify routing works
@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify routing works."""
    logger.info("🟢 [Auth Service] Test endpoint called")
    return {"message": "Routing works!", "status": "ok"}

def set_limiter(limiter_instance: Limiter):
    """Set the rate limiter instance from main.py"""
    global limiter
    limiter = limiter_instance

def _apply_rate_limit(func):
    """Apply rate limiting decorator if limiter is available.
    For login endpoint: 5 requests/min/user (as per requirements)."""
    if limiter:
        # Login endpoint: 5 requests per minute per user
        return limiter.limit("5/minute")(func)
    return func


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _generate_verification_code() -> str:
    """Generate a 6-digit verification code."""
    return str(random.randint(100000, 999999))


async def _store_verification_code(
    db: AsyncIOMotorDatabase,
    email: str,
    code: str,
    expires_at: datetime,
    pending_signup_data: dict | None = None,
) -> None:
    """Store verification code in database. Optionally store pending signup data."""
    normalized = _normalize_email(email)
    update_data = {
        "code": code,
        "expiresAt": expires_at,
        "createdAt": datetime.now(timezone.utc),
        "attempts": 0,
    }
    
    # If pending signup data exists, store it (for new signups)
    if pending_signup_data:
        update_data["pendingSignup"] = pending_signup_data
    
    await db.email_verifications.update_one(
        {"email": normalized},
        {"$set": update_data},
        upsert=True,
    )


async def _send_verification_email(
    db: AsyncIOMotorDatabase,
    email: str,
    user_name: str | None = None,
    pending_signup_data: dict | None = None,
) -> None:
    """Send verification email to user. Optionally store pending signup data."""
    # Generate verification code
    code = _generate_verification_code()
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.email_verification_code_ttl_minutes)

    # Store code (and pending signup data if provided)
    await _store_verification_code(db, email, code, expires_at, pending_signup_data)

    # Send email
    email_service = get_email_service()
    subject = "Email Verification Code"
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">Email Verification</h2>
                <p>Hello {user_name or 'User'},</p>
                <p>Your email verification code is:</p>
                <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
                    <h1 style="color: #2563eb; margin: 0; font-size: 32px; letter-spacing: 5px;">{code}</h1>
                </div>
                <p>This code will expire in {settings.email_verification_code_ttl_minutes} minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #6b7280; font-size: 12px;">This is an automated message, please do not reply.</p>
            </div>
        </body>
    </html>
    """

    try:
        await email_service.send_email(email, subject, html_body)
        logger.info("Verification code sent to %s", email)
    except Exception as exc:
        logger.error("Failed to send verification email: %s", exc)
        raise


async def _send_verification_email_async(
    db: AsyncIOMotorDatabase,
    email: str,
    user_name: str | None,
    code: str,
    ttl_minutes: int,
    org_id: str | None = None,
) -> None:
    """Send verification email asynchronously (for background tasks)."""
    # Log org_id for debugging
    logger.info("Sending verification email to %s with org_id: %s", email, org_id)
    
    email_service = get_email_service()
    subject = "Email Verification Code" + (" - Your Organization ID" if org_id else "")
    
    # Build email body with org ID if provided
    org_id_section = ""
    if org_id:
        logger.info("Including Organization ID %s in email to %s", org_id, email)
        org_id_section = f"""
                <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">Your Organization ID:</p>
                    <div style="background-color: #ffffff; padding: 15px; text-align: center; border-radius: 5px; border: 2px solid #2563eb;">
                        <h2 style="color: #2563eb; margin: 0; font-size: 24px; letter-spacing: 2px; font-family: monospace;">{org_id}</h2>
                    </div>
                    <p style="margin: 10px 0 0 0; color: #1e40af; font-size: 14px;">Please save this Organization ID. You will need it to log in.</p>
                </div>
        """
    else:
        logger.warning("No org_id provided for verification email to %s", email)
    
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">Email Verification</h2>
                <p>Hello {user_name or 'User'},</p>
                {org_id_section}
                <p>Your email verification code is:</p>
                <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
                    <h1 style="color: #2563eb; margin: 0; font-size: 32px; letter-spacing: 5px;">{code}</h1>
                </div>
                <p>This code will expire in {ttl_minutes} minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #6b7280; font-size: 12px;">This is an automated message, please do not reply.</p>
            </div>
        </body>
    </html>
    """

    try:
        await email_service.send_email(email, subject, html_body)
        logger.info("Verification code sent to %s (org_id: %s)", email, org_id)
    except Exception as exc:
        logger.error("Failed to send verification email to %s (org_id: %s): %s", email, org_id, exc)
        raise


async def _verify_code(db: AsyncIOMotorDatabase, email: str, code: str) -> bool:
    """Verify the code and mark email as verified if valid."""
    normalized = _normalize_email(email)
    verification = await db.email_verifications.find_one({"email": normalized})

    if not verification:
        return False

    now = datetime.now(timezone.utc)
    expires_at = verification.get("expiresAt")
    
    # Ensure expires_at is timezone-aware for comparison
    if expires_at:
        # If expires_at is timezone-naive, assume it's UTC and make it aware
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        elif expires_at.tzinfo != timezone.utc:
            # Convert to UTC if it has a different timezone
            expires_at = expires_at.astimezone(timezone.utc)
        
        if expires_at < now:
            # Code has expired, delete it
            await db.email_verifications.delete_one({"email": normalized})
            logger.info("Expired verification code deleted during verification attempt: %s", normalized)
            return False

    stored_code = verification.get("code")
    if stored_code != code:
        # Increment attempts
        await db.email_verifications.update_one(
            {"email": normalized},
            {"$inc": {"attempts": 1}},
        )
        return False

    # Code is valid - check if this is a pending signup or existing user
    pending_signup = verification.get("pendingSignup")
    
    if pending_signup:
        # This is a new signup - create the user account now
        # Sanitize name from pending signup data
        sanitized_name = sanitize_text_field(pending_signup.get("name", "")) if pending_signup.get("name") else ""
        user_doc = {
            "name": sanitized_name,
            "email": normalized,
            "password": pending_signup.get("password"),
            "role": pending_signup.get("role"),
            "orgId": pending_signup.get("orgId"),  # Store organization ID
            "emailVerified": True,
            "emailVerifiedAt": now,
            "createdAt": now,
        }
        # Only include organization, phone and country if they have values (don't store null)
        organization = pending_signup.get("organization")
        if organization:
            user_doc["organization"] = organization

        phone = pending_signup.get("phone")
        if phone:
            user_doc["phone"] = phone
        
        country = pending_signup.get("country")
        if country:
            user_doc["country"] = country
        
        await db.users.insert_one(user_doc)
        logger.info("User account created after email verification: %s (Org ID: %s)", normalized, pending_signup.get("orgId"))
    else:
        # This is an existing user - just mark email as verified
        user = await _find_user_by_email(db, email)
        if user:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"emailVerified": True, "emailVerifiedAt": now}},
            )

    # Delete the verification code
    await db.email_verifications.delete_one({"email": normalized})
    return True


async def _check_and_cleanup_expired_verification(
    db: AsyncIOMotorDatabase,
    email: str,
) -> bool:
    """Check if verification code exists and is expired. Clean up if expired. Returns True if expired or doesn't exist."""
    normalized = _normalize_email(email)
    verification = await db.email_verifications.find_one({"email": normalized})
    
    if not verification:
        return True  # No verification exists, so it's "expired" (doesn't exist)
    
    now = datetime.now(timezone.utc)
    expires_at = verification.get("expiresAt")
    
    if expires_at:
        # Ensure expires_at is timezone-aware for comparison
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        elif expires_at.tzinfo != timezone.utc:
            expires_at = expires_at.astimezone(timezone.utc)
        
        if expires_at < now:
            # Code has expired, delete it
            await db.email_verifications.delete_one({"email": normalized})
            logger.info("Expired verification code cleaned up for %s", normalized)
            return True  # Expired
    
    return False  # Code exists and is still valid


async def _find_user_by_email(db: AsyncIOMotorDatabase, email: str) -> dict | None:
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


def _generate_reset_token() -> str:
    """Generate a cryptographically secure random token for password reset."""
    import secrets
    return secrets.token_urlsafe(32)


async def _store_reset_token(
    db: AsyncIOMotorDatabase,
    email: str,
    token: str,
    expires_at: datetime,
) -> None:
    """Store password reset token in database (hashed)."""
    normalized = _normalize_email(email)
    # Hash the token before storing
    hashed_token = get_password_hash(token)
    
    update_data = {
        "resetToken": hashed_token,
        "resetTokenExpiresAt": expires_at,
        "resetTokenCreatedAt": datetime.now(timezone.utc),
        "resetTokenUsed": False,
    }
    
    await db.password_resets.update_one(
        {"email": normalized},
        {"$set": update_data},
        upsert=True,
    )


async def _send_password_reset_email(
    db: AsyncIOMotorDatabase,
    email: str,
    user_name: str | None,
    token: str,
    ttl_minutes: int,
) -> None:
    """Send password reset email with reset link."""
    from urllib.parse import quote
    
    settings = get_settings()
    email_service = get_email_service()
    
    # Build reset URL - use frontend URL from settings
    frontend_url = settings.frontend_url
    logger.info("Using frontend URL for password reset: %s", frontend_url)
    # URL encode the token to handle special characters
    encoded_token = quote(token, safe='')
    reset_url = f"{frontend_url}/auth/reset-password?token={encoded_token}"
    
    subject = "Password Reset Request"
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">Password Reset Request</h2>
                <p>Hello {user_name or 'User'},</p>
                <p>We received a request to reset your password. Click the button below to reset your password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Reset Password
                    </a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #2563eb; font-size: 12px;">{reset_url}</p>
                <p>This link will expire in {ttl_minutes} minutes.</p>
                <p style="color: #dc2626; font-weight: bold;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #6b7280; font-size: 12px;">This is an automated message, please do not reply.</p>
            </div>
        </body>
    </html>
    """

    try:
        await email_service.send_email(email, subject, html_body)
        logger.info("Password reset email sent successfully to %s with reset URL: %s", email, reset_url)
    except Exception as exc:
        logger.error("Failed to send password reset email to %s: %s", email, exc, exc_info=True)
        # Re-raise to ensure the error is logged by the background task handler
        raise


async def _verify_reset_token(db: AsyncIOMotorDatabase, token: str) -> tuple[bool, str | None, dict | None]:
    """Verify password reset token. Returns (is_valid, email, reset_doc)."""
    # Iterate through all unused reset tokens to find matching one
    # Note: We hash tokens, so we need to verify each one
    async for reset in db.password_resets.find({"resetTokenUsed": False}):
        stored_hashed = reset.get("resetToken")
        if stored_hashed and verify_password(token, stored_hashed):
            # Check expiration
            expires_at = reset.get("resetTokenExpiresAt")
            if expires_at:
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                elif expires_at.tzinfo != timezone.utc:
                    expires_at = expires_at.astimezone(timezone.utc)
                
                if expires_at < datetime.now(timezone.utc):
                    # Token expired, mark as used
                    await db.password_resets.update_one(
                        {"_id": reset["_id"]},
                        {"$set": {"resetTokenUsed": True}}
                    )
                    return False, None, None
            
            # Token is valid
            email = reset.get("email")
            return True, email, reset
    
    return False, None, None


# SIGNUP ENDPOINTS DISABLED - Accounts are now created by super admin via demo request acceptance
# Users receive credentials via email after super admin accepts their demo request

# @router.post("/superadmin-signup")
# async def super_admin_signup(
#     payload: SuperAdminSignupRequest,
#     db: AsyncIOMotorDatabase = Depends(get_db),
# ):
#     """DISABLED: Super admin signup - accounts created manually"""
#     raise HTTPException(
#         status_code=status.HTTP_404_NOT_FOUND,
#         detail="Signup is disabled. Please contact support for account creation."
#     )


# @router.post("/org-signup")
# async def org_signup_google(
#     payload: GoogleSignupRequest,
#     db: AsyncIOMotorDatabase = Depends(get_db),
# ):
#     """DISABLED: Google OAuth signup - use schedule demo instead"""
#     raise HTTPException(
#         status_code=status.HTTP_404_NOT_FOUND,
#         detail="Signup is disabled. Please schedule a demo to get started."
#     )


async def _check_account_lockout(db: AsyncIOMotorDatabase, email: str) -> tuple[bool, str | None]:
    """Check if account is locked. Returns (is_locked, lockout_message)."""
    settings = get_settings()
    normalized = _normalize_email(email)
    user = await _find_user_by_email(db, normalized)
    
    if not user:
        return False, None
    
    failed_attempts = user.get("failedLoginAttempts", 0)
    lockout_until = user.get("lockoutUntil")
    
    if lockout_until:
        lockout_time = lockout_until
        if isinstance(lockout_time, str):
            try:
                lockout_time = datetime.fromisoformat(lockout_time.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                # Fallback: try parsing with datetime.strptime
                try:
                    lockout_time = datetime.strptime(lockout_time, "%Y-%m-%dT%H:%M:%S.%fZ")
                    lockout_time = lockout_time.replace(tzinfo=timezone.utc)
                except (ValueError, AttributeError):
                    logger.warning(f"Could not parse lockout_until: {lockout_until}")
                    return False, None
        if lockout_time.tzinfo is None:
            lockout_time = lockout_time.replace(tzinfo=timezone.utc)
        
        if datetime.now(timezone.utc) < lockout_time:
            remaining_minutes = int((lockout_time - datetime.now(timezone.utc)).total_seconds() / 60)
            return True, f"Account is temporarily locked due to too many failed login attempts. Please try again in {remaining_minutes} minutes."
        else:
            # Lockout expired, clear it
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$unset": {"lockoutUntil": "", "failedLoginAttempts": 0}}
            )
    
    if failed_attempts >= settings.max_failed_attempts:
        # Lock account
        lockout_until = datetime.now(timezone.utc) + timedelta(minutes=settings.lockout_duration_minutes)
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"lockoutUntil": lockout_until}}
        )
        return True, f"Account is temporarily locked due to too many failed login attempts. Please try again in {settings.lockout_duration_minutes} minutes."
    
    return False, None


async def _increment_failed_attempts(db: AsyncIOMotorDatabase, email: str) -> None:
    """Increment failed login attempts for a user."""
    normalized = _normalize_email(email)
    user = await _find_user_by_email(db, normalized)
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"failedLoginAttempts": 1}}
        )


async def _clear_failed_attempts(db: AsyncIOMotorDatabase, email: str) -> None:
    """Clear failed login attempts on successful login."""
    normalized = _normalize_email(email)
    user = await _find_user_by_email(db, normalized)
    if user:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$unset": {"failedLoginAttempts": "", "lockoutUntil": ""}}
        )


def _build_login_success_response(user: dict) -> JSONResponse:
    """Build login success response with access and refresh tokens."""
    from ....core.security import create_refresh_token
    
    access_token = create_access_token(str(user["_id"]), user.get("role", "pending"))
    refresh_token = create_refresh_token(str(user["_id"]), user.get("role", "pending"))
    user_data = serialize_document(user)
    return success_response(
        "Login successful",
        {
            "token": access_token,
            "refreshToken": refresh_token,
            "user": {
                "id": user_data["id"],
                "name": user_data.get("name"),
                "email": user_data.get("email"),
                "role": user_data.get("role"),
                "organization": user_data.get("organization"),
                "phone": user_data.get("phone"),
                "country": user_data.get("country"),
            },
        },
    )


@router.post("/send-verification-code")
async def send_verification_code(
    payload: SendVerificationCodeRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Send email verification code to user. Handles both existing users and pending signups."""
    email = _normalize_email(payload.email)
    user = await _find_user_by_email(db, email)
    
    # Check if this is an existing user or pending signup
    if user:
        # Existing user flow
        # Check if already verified
        if user.get("emailVerified"):
            return success_response("Email is already verified", {"verified": True})

        # Clean up any expired verification codes before sending new one
        await _check_and_cleanup_expired_verification(db, email)

        try:
            await _send_verification_email(db, email, user.get("name"))
        except Exception as exc:
            logger.error("Failed to send verification email: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send verification email",
            ) from exc
    else:
        # Check if there's a pending signup (email is already normalized above)
        normalized_email = _normalize_email(email)
        verification = await db.email_verifications.find_one({"email": normalized_email, "pendingSignup": {"$exists": True}})
        if not verification:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found. Please sign up first.")

        # Get pending signup data BEFORE checking expiration (in case it gets deleted)
        pending_signup_data = verification.get("pendingSignup")
        if not pending_signup_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No pending signup found")

        user_name = pending_signup_data.get("name") if pending_signup_data else None

        # Check if the pending signup code has expired or is missing (cleared by verify-email-code)
        now = datetime.now(timezone.utc)
        expires_at = verification.get("expiresAt")
        code = verification.get("code")
        
        # If code or expiresAt is missing, it means verify-email-code cleared it (expired code was entered)
        # In that case, we can just resend without deleting
        if not code or not expires_at:
            logger.info("Verification code missing (cleared), resending for pending signup: %s", normalized_email)
        elif expires_at:
            # Ensure expires_at is timezone-aware for comparison
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            elif expires_at.tzinfo != timezone.utc:
                expires_at = expires_at.astimezone(timezone.utc)
            
            if expires_at < now:
                # Code has expired, delete it but allow resending with same pending data
                await db.email_verifications.delete_one({"email": normalized_email})
                logger.info("Expired verification code deleted, resending for pending signup: %s", normalized_email)

        # Resend code for pending signup (preserve pending signup data)
        try:
            await _send_verification_email(db, email, user_name, pending_signup_data)
        except Exception as exc:
            logger.error("Failed to send verification email: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send verification email",
            ) from exc

    return success_response("Verification code sent successfully", {"email": email})


@_apply_rate_limit
@router.post("/verify-email-code")
async def verify_email_code(
    request: Request,
    payload: VerifyEmailCodeRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Verify email verification code. Creates account if this is a pending signup."""
    email = _normalize_email(payload.email)
    
    # Check if this is a pending signup or existing user
    verification = await db.email_verifications.find_one({"email": email})
    is_pending_signup = verification and verification.get("pendingSignup")
    
    # For existing users, check if they exist and are already verified
    if not is_pending_signup:
        user = await _find_user_by_email(db, email)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if user.get("emailVerified"):
            return success_response("Email is already verified", {"verified": True})

    # Check if verification exists and if it's expired
    if not verification:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code expired or not found. Please request a new code.")
    
    # Check expiration before verifying code
    now = datetime.now(timezone.utc)
    expires_at = verification.get("expiresAt")
    if expires_at:
        # Ensure expires_at is timezone-aware for comparison
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        elif expires_at.tzinfo != timezone.utc:
            expires_at = expires_at.astimezone(timezone.utc)
        
        if expires_at < now:
            # Code has expired
            # If this is a pending signup, preserve the pendingSignup data for resend functionality
            # Otherwise, delete the entire record
            if verification.get("pendingSignup"):
                # For pending signups, just clear the code/expiration but keep pendingSignup data
                # This allows resend to work properly
                await db.email_verifications.update_one(
                    {"email": email},
                    {"$unset": {"code": "", "expiresAt": "", "attempts": ""}}
                )
                logger.info("Expired verification code cleared (pending signup preserved) during verification attempt: %s", email)
            else:
                # For existing users, delete the entire record
                await db.email_verifications.delete_one({"email": email})
                logger.info("Expired verification code deleted during verification attempt: %s", email)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code has expired. Please request a new code.")
    
    # Check if code matches
    stored_code = verification.get("code")
    if stored_code != payload.code:
        # Increment attempts
        await db.email_verifications.update_one(
            {"email": email},
            {"$inc": {"attempts": 1}},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification code. Please check and try again.")

    # Code is valid - proceed with verification (this will create account if pending signup)
    # We've already checked expiration and code match above, so _verify_code should succeed
    is_valid = await _verify_code(db, email, payload.code)
    if not is_valid:
        # This should not happen since we already checked above, but just in case
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification code. Please check and try again.")

    # Check if account was just created
    user = await _find_user_by_email(db, email)
    if user and is_pending_signup:
        return success_response("Email verified and account created successfully", {"verified": True, "accountCreated": True})
    
    return success_response("Email verified successfully", {"verified": True, "accountCreated": False})


@_apply_rate_limit
@router.post("/login")
async def email_login(
    request: Request,
    payload: LoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """User login with rate limiting, account lockout, and generic error messages."""
    settings = get_settings()
    
    email = _normalize_email(payload.email)
    
    # Check account lockout
    is_locked, lockout_message = await _check_account_lockout(db, email)
    if is_locked:
        logger.warning("Locked account login attempt: %s", email)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=lockout_message)
    
    user = await _find_user_by_email(db, email)
    
    # Generic error message to prevent user enumeration
    generic_error = "Invalid email or password"
    
    if not user:
        logger.info("Login attempt for non-existent user: %s", payload.email)
        await _increment_failed_attempts(db, email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic_error)

    if not user.get("password"):
        logger.info("Login attempt - password not set: %s", payload.email)
        await _increment_failed_attempts(db, email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic_error)

    if not verify_password(payload.password, user["password"]):
        logger.info("Invalid password attempt for user: %s", payload.email)
        await _increment_failed_attempts(db, email)
        # Check if account should be locked after this attempt
        is_locked, lockout_message = await _check_account_lockout(db, email)
        if is_locked:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=lockout_message)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic_error)

    # Check email verification
    if not user.get("emailVerified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email before signing in.",
        )
    
    # For org_admin users, validate organization ID
    if user.get("role") == "org_admin":
        user_org_id = user.get("orgId")
        if not user_org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization ID not found for this account. Please contact support.",
            )
        if not payload.org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization ID is required for organization administrators.",
            )
        if payload.org_id != user_org_id:
            logger.warning("Invalid org ID attempt for user %s: provided=%s, expected=%s", email, payload.org_id, user_org_id)
            await _increment_failed_attempts(db, email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid organization ID.",
            )

    # Check if user is super_admin - require MFA
    if user.get("role") == "super_admin":
        # Check if TOTP secret exists
        if not user.get("totp_secret"):
            logger.warning("Super admin %s does not have TOTP secret configured", email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="TOTP not configured. Please contact administrator.",
            )
        # Clear failed attempts
        await _clear_failed_attempts(db, email)
        # Return require_mfa flag instead of logging in
        return success_response(
            "MFA required",
            {
                "require_mfa": True,
                "email": email,
            },
        )

    # Check if password reset is required (temporary password)
    if user.get("requirePasswordReset"):
        logger.info("User %s logged in with temporary password, requiring password reset", email)
        # Clear failed attempts
        await _clear_failed_attempts(db, email)
        # Generate a password reset token
        token = _generate_reset_token()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        await _store_reset_token(db, email, token, expires_at)
        
        return success_response(
            "Password reset required. Please use the provided token to reset your password.",
            {
                "requirePasswordReset": True,
                "resetToken": token,
                "email": email,
            },
        )
    
    # Check if org_admin needs to set up MFA (mandatory for org admins)
    logger.info(f"🔍 [MFA Check] User: {email}, Role: {user.get('role')}, MFA Enabled: {user.get('mfaEnabled')}")
    
    if user.get("role") == "org_admin" and not user.get("mfaEnabled"):
        logger.info(f"✅ [MFA Setup Required] User {email} (org_admin) needs to set up MFA")
        # Clear failed attempts
        await _clear_failed_attempts(db, email)
        
        # Generate temporary token for MFA setup (valid for 15 minutes)
        # We'll use a special approach: encode user_id and email in the token
        # and add a custom claim to identify this as MFA setup token
        import jwt
        
        settings = get_settings()
        expires_delta = timedelta(minutes=15)
        expire = datetime.now(timezone.utc) + expires_delta
        
        # Create custom token with mfa_setup flag
        to_encode = {
            "sub": str(user["_id"]),
            "email": email,
            "role": user.get("role"),
            "mfa_setup": True,  # Special flag for MFA setup
            "exp": expire,
            "iat": datetime.now(timezone.utc),
        }
        
        mfa_setup_token = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
        
        response_data = {
            "requireMFASetup": True,
            "email": email,
            "mfaSetupToken": mfa_setup_token,  # Temporary token for MFA setup
        }
        logger.info(f"📤 [Response] Returning requireMFASetup with temporary token")
        
        return success_response(
            "MFA setup required for organization administrators",
            response_data
        )
    
    # Check if MFA is enabled for org_admin users
    if user.get("role") == "org_admin" and user.get("mfaEnabled"):
        logger.info("User %s requires MFA verification", email)
        # Clear failed attempts
        await _clear_failed_attempts(db, email)
        # Generate temporary token for MFA verification
        import jwt
        
        settings = get_settings()
        expires_delta = timedelta(minutes=10)
        expire = datetime.now(timezone.utc) + expires_delta
        
        # Create custom token with temp flag
        to_encode = {
            "sub": str(user["_id"]),
            "role": user.get("role"),
            "temp": True,  # Temporary token for MFA verification
            "exp": expire,
            "iat": datetime.now(timezone.utc),
        }
        
        temp_token = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
        
        return success_response(
            "MFA verification required",
            {
                "requireMFA": True,
                "tempToken": temp_token,
                "email": email,
            },
        )

    # Clear failed attempts on successful login
    await _clear_failed_attempts(db, email)
    return _build_login_success_response(user)


# @router.post("/org-signup-email")
# async def org_signup_email(
#     background_tasks: BackgroundTasks,
#     payload: OrgSignupRequest,
#     db: AsyncIOMotorDatabase = Depends(get_db),
# ):
#     """DISABLED: Email signup - use schedule demo instead"""
#     raise HTTPException(
#         status_code=status.HTTP_404_NOT_FOUND,
#         detail="Signup is disabled. Please schedule a demo at aaptor.com to get started."
#     )


@router.post("/oauth-login")
async def oauth_login(
    payload: OAuthLoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """OAuth login with rate limiting."""
    logger.info("🟢 [Auth Service] /oauth-login endpoint HANDLER CALLED")
    logger.info(f"🟢 [Auth Service] Database dependency injected successfully")
    logger.info(f"🟢 [Auth Service] Request payload received: email={payload.email}, provider={payload.provider}, name={payload.name}")
    
    try:
        email = _normalize_email(payload.email)
        logger.info(f"🔵 [Auth Service] OAuth login attempt for email: {email}, provider: {payload.provider}")
        
        # Check MongoDB connection first
        try:
            await db.command("ping")
        except Exception as db_error:
            logger.error(f"MongoDB connection error during OAuth login: {db_error}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection error. Please try again."
            ) from db_error
        
        user = await _find_user_by_email(db, email)

        # Require pre-registration: Users must sign up first before using OAuth login
        if not user:
            logger.warning("OAuth login attempt for non-existent user: %s (provider: %s)", email, payload.provider)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account not found. Please sign up first before using OAuth login. If you have an account, please use email/password login or contact support."
            )
        
        # Check if user's email is verified (for security)
        if not user.get("emailVerified"):
            logger.warning("OAuth login attempt for unverified user: %s", email)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified. Please verify your email before signing in."
            )
        
        # User exists and is verified - proceed with login
        # Update user info if needed (name, provider, etc.)
        updates = {}
        if payload.name and not user.get("name"):
            # Sanitize name to prevent XSS
            updates["name"] = sanitize_text_field(payload.name)
        if payload.provider and payload.provider != user.get("provider"):
            updates["provider"] = payload.provider
        # Note: Don't allow role updates via OAuth login for security

        if updates:
            await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
            user = await db.users.find_one({"_id": user["_id"]})

        # MFA CHECKS - Same as email_login
        
        # Check if user is super_admin - require MFA
        if user.get("role") == "super_admin":
            # Check if TOTP secret exists
            if not user.get("totp_secret"):
                logger.warning("Super admin %s does not have TOTP secret configured", email)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="TOTP not configured. Please contact administrator.",
                )
            # Return require_mfa flag instead of logging in
            return success_response(
                "MFA required",
                {
                    "require_mfa": True,
                    "email": email,
                },
            )
        
        # Check if org_admin needs to set up MFA (mandatory for org admins)
        logger.info(f"🔍 [OAuth MFA Check] User: {email}, Role: {user.get('role')}, MFA Enabled: {user.get('mfaEnabled')}")
        
        if user.get("role") == "org_admin" and not user.get("mfaEnabled"):
            logger.info(f"✅ [OAuth MFA Setup Required] User {email} (org_admin) needs to set up MFA")
            
            # Generate temporary token for MFA setup (valid for 15 minutes)
            import jwt
            
            settings = get_settings()
            expires_delta = timedelta(minutes=15)
            expire = datetime.now(timezone.utc) + expires_delta
            
            # Create custom token with mfa_setup flag
            to_encode = {
                "sub": str(user["_id"]),
                "email": email,
                "role": user.get("role"),
                "mfa_setup": True,  # Special flag for MFA setup
                "exp": expire,
                "iat": datetime.now(timezone.utc),
            }
            
            mfa_setup_token = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
            
            response_data = {
                "requireMFASetup": True,
                "email": email,
                "mfaSetupToken": mfa_setup_token,  # Temporary token for MFA setup
            }
            logger.info(f"📤 [OAuth Response] Returning requireMFASetup with temporary token")
            
            return success_response(
                "MFA setup required for organization administrators",
                response_data
            )
        
        # Check if MFA is enabled for org_admin users
        if user.get("role") == "org_admin" and user.get("mfaEnabled"):
            logger.info("OAuth user %s requires MFA verification", email)
            # Generate temporary token for MFA verification
            import jwt
            
            settings = get_settings()
            expires_delta = timedelta(minutes=10)
            expire = datetime.now(timezone.utc) + expires_delta
            
            # Create custom token with temp flag
            to_encode = {
                "sub": str(user["_id"]),
                "role": user.get("role"),
                "temp": True,  # Temporary token for MFA verification
                "exp": expire,
                "iat": datetime.now(timezone.utc),
            }
            
            temp_token = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
            
            return success_response(
                "MFA verification required",
                {
                    "requireMFA": True,
                    "tempToken": temp_token,
                    "email": email,
                },
            )

        # No MFA required - proceed with normal login
        return _build_login_success_response(user)
    except Exception as exc:
        logger.error("OAuth login error: %s", exc, exc_info=True)
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OAuth login failed. Please try again."
        )


@router.post("/refresh-token")
async def refresh_token(
    payload: RefreshTokenRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Refresh access token using refresh token."""
    from ....core.security import decode_token, create_access_token, create_refresh_token
    
    refresh_token_str = payload.refreshToken
    
    try:
        decoded = decode_token(refresh_token_str)
        
        # Verify it's a refresh token
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token type")
        
        user_id = decoded.get("sub")
        role = decoded.get("role")
        
        if not user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")
        
        # Verify user still exists
        from ....utils.mongo import to_object_id
        try:
            user_oid = to_object_id(user_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")
        
        user = await db.users.find_one({"_id": user_oid})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        # Generate new token pair
        new_access_token = create_access_token(user_id, role)
        new_refresh_token = create_refresh_token(user_id, role)
        
        return success_response(
            "Token refreshed successfully",
            {
                "token": new_access_token,
                "refreshToken": new_refresh_token,
            }
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Token refresh error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        ) from exc

@router.post("/verify")
async def verify_token(
    payload: VerifyTokenRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Verify JWT token and return user info for API Gateway."""
    from ....core.security import decode_token
    from ....utils.mongo import to_object_id
    
    try:
        decoded = decode_token(payload.token)
        user_id = decoded.get("sub")
        role = decoded.get("role")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid token: missing user ID")
        
        # Get user from DB to get orgId
        user_oid = to_object_id(user_id)
        user = await db.users.find_one({"_id": user_oid})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return success_response("Token valid", {
            "userId": user_id,
            "orgId": user.get("orgId", ""),
            "role": role
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/forgot-password")
async def forgot_password(
    background_tasks: BackgroundTasks,
    payload: ForgotPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Request password reset. Sends reset email if user exists."""
    email = _normalize_email(payload.email)
    
    # Find user by email
    user = await _find_user_by_email(db, email)
    
    # Generic success message to prevent email enumeration
    generic_success = "If an account with that email exists, a password reset link has been sent."
    
    if not user:
        logger.info("Password reset requested for non-existent user: %s", email)
        # Return generic success to prevent user enumeration
        return success_response(generic_success, {})
    
    # Check if user has a password (OAuth-only users can't reset password)
    if not user.get("password"):
        logger.info("Password reset requested for user without password (OAuth-only): %s", email)
        # Still return generic success
        return success_response(generic_success, {})
    
    # For org_admin users, validate org_id if provided
    if user.get("role") == "org_admin":
        user_org_id = user.get("orgId")
        if payload.org_id and payload.org_id != user_org_id:
            logger.warning("Password reset requested with invalid org_id for user %s: provided=%s, expected=%s", 
                         email, payload.org_id, user_org_id)
            # Still return generic success
            return success_response(generic_success, {})
    
    # Generate reset token
    token = _generate_reset_token()
    settings = get_settings()
    # Token expires in 30 minutes
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    
    # Store reset token
    await _store_reset_token(db, email, token, expires_at)
    
    # Send reset email in background
    try:
        background_tasks.add_task(
            _send_password_reset_email,
            db,
            email,
            user.get("name"),
            token,
            30
        )
        logger.info("Password reset email queued for user: %s", email)
    except Exception as exc:
        logger.error("Failed to queue password reset email for %s: %s", email, exc)
        # Don't expose error to user
    
    return success_response(generic_success, {})


@router.get("/verify-reset-token")
async def verify_reset_token(
    token: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Verify if a password reset token is valid."""
    is_valid, email, reset_doc = await _verify_reset_token(db, token)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    return success_response("Token is valid", {"valid": True, "email": email})


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Reset password using reset token."""
    # Verify token
    is_valid, email, reset_doc = await _verify_reset_token(db, payload.token)
    
    if not is_valid or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Find user
    user = await _find_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password and clear requirePasswordReset flag
    hashed_password = get_password_hash(payload.newPassword)
    update_data = {"password": hashed_password}
    
    # If user had requirePasswordReset flag, remove it
    if user.get("requirePasswordReset"):
        update_data["requirePasswordReset"] = False
        logger.info("Cleared requirePasswordReset flag for user: %s", email)
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": update_data}
    )
    
    # Mark token as used
    await db.password_resets.update_one(
        {"_id": reset_doc["_id"]},
        {"$set": {"resetTokenUsed": True}}
    )
    
    logger.info("Password reset successful for user: %s", email)
    
    # Return user info for MFA setup redirect
    user_data = serialize_document(user)
    return success_response(
        "Password reset successful. You can now sign in with your new password.",
        {
            "email": email,
            "user": {
                "role": user_data.get("role"),
                "mfaEnabled": user_data.get("mfaEnabled", False),
            }
        }
    )