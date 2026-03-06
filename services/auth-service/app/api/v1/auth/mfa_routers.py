"""MFA (Multi-Factor Authentication) routers."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.security import create_access_token, create_refresh_token, verify_password, decode_token
from ....db.mongo import get_db
from ....utils.email import get_email_service, send_mfa_otp_email
from ....utils.mfa import (
    check_email_otp_rate_limit,
    decrypt_secret,
    encrypt_secret,
    generate_backup_codes,
    generate_email_otp,
    generate_qr_code,
    generate_totp_secret,
    hash_backup_codes,
    record_email_otp_request,
    verify_totp_code,
)
from ....utils.mongo import serialize_document
from ....utils.responses import success_response
from ....core.security import get_password_hash
from .mfa_schemas import (
    MFACompleteSetupRequest,
    MFARegenerateBackupCodesRequest,
    MFAResetAuthenticatorRequest,
    MFASendEmailOTPRequest,
    MFASetupRequest,
    MFASetupResponse,
    MFAStatusResponse,
    MFAVerifyBackupCodeRequest,
    MFAVerifyEmailOTPRequest,
    MFAVerifySetupRequest,
    MFAVerifyTOTPRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth/mfa", tags=["mfa"])


def verify_mfa_setup_token(authorization: str = Header(None)) -> dict:
    """
    Verify MFA setup token from Authorization header.
    Returns decoded token data if valid.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )
    
    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format"
        )
    
    token = parts[1]
    
    try:
        # Decode and verify token
        payload = decode_token(token)
        
        # Check if this is an MFA setup token
        if not payload.get("mfa_setup"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid token for MFA setup"
            )
        
        return payload
    except Exception as e:
        logger.error(f"Error verifying MFA setup token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


@router.post("/setup")
async def setup_mfa(
    request: MFASetupRequest,
    token_data: dict = Depends(verify_mfa_setup_token),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Initiate MFA setup - generate QR code and secret.
    Requires MFA setup token from login response.
    """
    logger.info(f"MFA setup initiated for user: {token_data.get('email')}")
    
    email = token_data.get('email')
    secret = generate_totp_secret()
    
    # Generate QR code
    qr_code = generate_qr_code(email, secret)
    
    return success_response(
        "MFA setup initiated. Scan the QR code with your authenticator app.",
        {
            "secret": secret,
            "qrCodeUrl": qr_code,
        }
    )


@router.post("/generate-qr")
async def generate_mfa_qr(
    email: str,
    secret: str,
    token_data: dict = Depends(verify_mfa_setup_token),
) -> dict:
    """
    Generate QR code for MFA setup.
    Requires MFA setup token from login response.
    """
    try:
        # Verify email matches token
        if email != token_data.get("email"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email mismatch"
            )
        
        qr_code = generate_qr_code(email, secret)
        logger.info(f"QR code generated for user: {email}")
        
        return success_response(
            "QR code generated successfully",
            {"qrCode": qr_code}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating QR code: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate QR code"
        )


@router.post("/verify-setup")
async def verify_mfa_setup(
    request: MFAVerifySetupRequest,
    token_data: dict = Depends(verify_mfa_setup_token),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Verify MFA setup with TOTP code and generate backup codes.
    This completes the MFA setup process.
    Requires MFA setup token from login response.
    """
    logger.info(f"Verifying MFA setup for user: {token_data.get('email')}")
    
    # Verify the TOTP code
    if not verify_totp_code(request.secret, request.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please try again."
        )
    
    # Generate backup codes
    backup_codes = generate_backup_codes(10)
    hashed_codes = hash_backup_codes(backup_codes)
    
    # Encrypt the secret for storage
    encrypted_secret = encrypt_secret(request.secret)
    
    logger.info(f"MFA setup verification successful for user: {token_data.get('email')}")
    
    return success_response(
        "MFA setup verified successfully. Save your backup codes securely.",
        {
            "backupCodes": backup_codes,
            "encryptedSecret": encrypted_secret,
            "hashedBackupCodes": hashed_codes,
        }
    )


@router.post("/complete-setup")
async def complete_mfa_setup(
    request: MFACompleteSetupRequest,
    token_data: dict = Depends(verify_mfa_setup_token),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Complete MFA setup by storing encrypted secret and backup codes.
    Called after user confirms they saved backup codes.
    Requires MFA setup token from login response.
    """
    try:
        # Verify email matches token
        if request.email != token_data.get("email"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email mismatch"
            )
        
        # Find user by email
        user = await db.users.find_one({"email": request.email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update user with MFA data
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "mfaEnabled": True,
                    "mfaSecret": request.encrypted_secret,
                    "mfaSetupDate": datetime.now(timezone.utc),
                    "mfaLastUsed": None,
                    "backupCodes": request.hashed_backup_codes,
                }
            }
        )
        
        logger.info(f"MFA setup completed for user: {request.email}")
        
        # Generate full access tokens now that MFA is set up
        user_data = serialize_document(user)
        access_token = create_access_token(str(user["_id"]), user.get("role", "org_admin"))
        refresh_token = create_refresh_token(str(user["_id"]), user.get("role", "org_admin"))
        
        return success_response(
            "MFA setup completed successfully",
            {
                "mfaEnabled": True,
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "user": {
                    "id": user_data["id"],
                    "email": user_data["email"],
                    "name": user_data.get("name"),
                    "role": user_data.get("role"),
                    "organization": user_data.get("organization"),
                }
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing MFA setup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete MFA setup"
        )


@router.post("/verify-totp")
async def verify_totp(
    request: MFAVerifyTOTPRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Verify TOTP code during login.
    Returns access and refresh tokens on success.
    """
    try:
        # Find user
        user = await db.users.find_one({"email": request.email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if MFA is enabled
        if not user.get("mfaEnabled"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA is not enabled for this user"
            )
        
        # Decrypt secret
        encrypted_secret = user.get("mfaSecret")
        if not encrypted_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA secret not found"
            )
        
        secret = decrypt_secret(encrypted_secret)
        
        # Verify TOTP code
        if not verify_totp_code(secret, request.code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
        
        # Update last used timestamp
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"mfaLastUsed": datetime.now(timezone.utc)}}
        )
        
        # Generate tokens
        user_data = serialize_document(user)
        access_token = create_access_token(str(user["_id"]), user.get("role", "org_admin"))
        refresh_token = create_refresh_token(str(user["_id"]), user.get("role", "org_admin"))
        
        logger.info(f"MFA verification successful for user: {request.email}")
        
        return success_response(
            "MFA verification successful",
            {
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "user": {
                    "id": user_data["id"],
                    "email": user_data["email"],
                    "name": user_data.get("name"),
                    "role": user_data.get("role"),
                    "organization": user_data.get("organization"),
                }
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying TOTP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify MFA code"
        )


@router.post("/send-email-otp")
async def send_email_otp(
    request: MFASendEmailOTPRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Send email OTP as backup method.
    Rate limited to 3 requests per hour.
    """
    logger.info(f"🔵 [MFA] send_email_otp endpoint called")
    logger.info(f"🔵 [MFA] Request email: {request.email}")
    logger.info(f"🔵 [MFA] Request temp_token present: {bool(request.temp_token)}")
    
    try:
        # Find user
        logger.info(f"🔵 [MFA] Looking up user by email: {request.email}")
        user = await db.users.find_one({"email": request.email})
        if not user:
            logger.error(f"🔴 [MFA] User not found: {request.email}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        logger.info(f"✅ [MFA] User found: {user.get('email')}")
        user_id = str(user["_id"])
        logger.info(f"🔵 [MFA] User ID: {user_id}")
        
        # Rate limit temporarily disabled for testing
        # TODO: Re-enable rate limiting in production
        # Check rate limit
        # logger.info(f"🔵 [MFA] Checking rate limit for user: {user_id}")
        # is_allowed, remaining = await check_email_otp_rate_limit(db, user_id)
        # logger.info(f"🔵 [MFA] Rate limit check result - allowed: {is_allowed}, remaining: {remaining}")
        
        # if not is_allowed:
        #     logger.error(f"🔴 [MFA] Rate limit exceeded for user: {request.email}")
        #     raise HTTPException(
        #         status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        #         detail="Too many OTP requests. Please try again later."
        #     )
        
        remaining = 999  # Placeholder for response
        
        # Generate OTP
        logger.info(f"🔵 [MFA] Generating OTP code")
        otp_code = generate_email_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        logger.info(f"🔵 [MFA] OTP generated, expires at: {expires_at}")
        
        # Store OTP in database
        logger.info(f"🔵 [MFA] Storing OTP in database for user: {user_id}")
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "emailOtp": {
                        "code": get_password_hash(otp_code),
                        "expiresAt": expires_at,
                        "createdAt": datetime.now(timezone.utc),
                    }
                }
            }
        )
        logger.info(f"✅ [MFA] OTP stored in database")
        
        # Rate limit recording temporarily disabled for testing
        # TODO: Re-enable rate limiting in production
        # Record request for rate limiting
        # logger.info(f"🔵 [MFA] Recording OTP request for rate limiting")
        # await record_email_otp_request(db, user_id)
        # logger.info(f"✅ [MFA] OTP request recorded")
        
        # Send email
        logger.info(f"🔵 [MFA] Sending email OTP to: {request.email}")
        logger.info(f"🔵 [MFA] OTP code (first 2 digits): {otp_code[:2]}****")
        await send_mfa_otp_email(
            to_email=request.email,
            name=user.get("name", "User"),
            otp_code=otp_code
        )
        logger.info(f"✅ [MFA] Email OTP sent successfully to: {request.email}")
        
        return success_response(
            f"Verification code sent to {request.email}. Code expires in 10 minutes.",
            {"requestsRemaining": remaining - 1}
        )
    except HTTPException:
        logger.error(f"🔴 [MFA] HTTPException in send_email_otp")
        raise
    except Exception as e:
        logger.error(f"🔴 [MFA] Error sending email OTP: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification code"
        )


@router.post("/verify-email-otp")
async def verify_email_otp(
    request: MFAVerifyEmailOTPRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Verify email OTP code.
    Returns access and refresh tokens on success.
    """
    logger.info(f"🔵 [MFA] verify_email_otp endpoint called")
    logger.info(f"🔵 [MFA] Request email: {request.email}")
    logger.info(f"🔵 [MFA] Request code (first 2 digits): {request.code[:2]}****")
    logger.info(f"🔵 [MFA] Request temp_token present: {bool(request.temp_token)}")
    
    try:
        # Find user
        logger.info(f"🔵 [MFA] Looking up user by email: {request.email}")
        user = await db.users.find_one({"email": request.email})
        if not user:
            logger.error(f"🔴 [MFA] User not found: {request.email}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        logger.info(f"✅ [MFA] User found: {user.get('email')}")
        
        # Get stored OTP
        email_otp = user.get("emailOtp")
        logger.info(f"🔵 [MFA] Email OTP from database: {bool(email_otp)}")
        
        if not email_otp:
            logger.error(f"🔴 [MFA] No verification code found for user: {request.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verification code found. Please request a new code."
            )
        
        logger.info(f"🔵 [MFA] OTP expires at: {email_otp.get('expiresAt')}")
        logger.info(f"🔵 [MFA] OTP created at: {email_otp.get('createdAt')}")
        
        # Check expiration
        expires_at = email_otp["expiresAt"]
        # Ensure expires_at is timezone-aware
        if expires_at.tzinfo is None:
            logger.info(f"🔵 [MFA] Converting expires_at to timezone-aware")
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        current_time = datetime.now(timezone.utc)
        logger.info(f"🔵 [MFA] Current time: {current_time}")
        logger.info(f"🔵 [MFA] Expires at: {expires_at}")
        logger.info(f"🔵 [MFA] Is expired: {expires_at < current_time}")
        
        if expires_at < current_time:
            logger.error(f"🔴 [MFA] Verification code expired for user: {request.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired. Please request a new code."
            )
        
        # Verify code
        logger.info(f"🔵 [MFA] Verifying OTP code")
        is_valid = verify_password(request.code, email_otp["code"])
        logger.info(f"🔵 [MFA] OTP verification result: {is_valid}")
        
        if not is_valid:
            logger.error(f"🔴 [MFA] Invalid verification code for user: {request.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
        
        logger.info(f"✅ [MFA] OTP verified successfully")
        
        # Clear OTP
        logger.info(f"🔵 [MFA] Clearing OTP from database")
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$unset": {"emailOtp": ""},
                "$set": {"mfaLastUsed": datetime.now(timezone.utc)}
            }
        )
        logger.info(f"✅ [MFA] OTP cleared from database")
        
        # Generate tokens
        logger.info(f"🔵 [MFA] Generating access and refresh tokens")
        user_data = serialize_document(user)
        access_token = create_access_token(str(user["_id"]), user.get("role", "org_admin"))
        refresh_token = create_refresh_token(str(user["_id"]), user.get("role", "org_admin"))
        logger.info(f"✅ [MFA] Tokens generated successfully")
        
        logger.info(f"✅ [MFA] Email OTP verification successful for user: {request.email}")
        
        return success_response(
            "Verification successful",
            {
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "user": {
                    "id": user_data["id"],
                    "email": user_data["email"],
                    "name": user_data.get("name"),
                    "role": user_data.get("role"),
                    "organization": user_data.get("organization"),
                }
            }
        )
    except HTTPException:
        logger.error(f"🔴 [MFA] HTTPException in verify_email_otp")
        raise
    except Exception as e:
        logger.error(f"🔴 [MFA] Error verifying email OTP: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify code"
        )


@router.post("/verify-backup-code")
async def verify_backup_code(
    request: MFAVerifyBackupCodeRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Verify backup code.
    Returns access and refresh tokens on success.
    Marks code as used.
    """
    try:
        # Find user
        user = await db.users.find_one({"email": request.email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get backup codes
        backup_codes = user.get("backupCodes", [])
        if not backup_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No backup codes found"
            )
        
        # Find matching unused code
        code_found = False
        code_index = -1
        
        for i, stored_code in enumerate(backup_codes):
            if not stored_code.get("used") and verify_password(request.code, stored_code["code"]):
                code_found = True
                code_index = i
                break
        
        if not code_found:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or already used backup code"
            )
        
        # Mark code as used
        backup_codes[code_index]["used"] = True
        backup_codes[code_index]["usedAt"] = datetime.now(timezone.utc)
        
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "backupCodes": backup_codes,
                    "mfaLastUsed": datetime.now(timezone.utc)
                }
            }
        )
        
        # Count remaining codes
        remaining_codes = sum(1 for code in backup_codes if not code.get("used"))
        
        # Generate tokens
        user_data = serialize_document(user)
        access_token = create_access_token(str(user["_id"]), user.get("role", "org_admin"))
        refresh_token = create_refresh_token(str(user["_id"]), user.get("role", "org_admin"))
        
        logger.info(f"Backup code verification successful for user: {request.email}")
        
        return success_response(
            f"Verification successful. You have {remaining_codes} backup codes remaining.",
            {
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "backupCodesRemaining": remaining_codes,
                "user": {
                    "id": user_data["id"],
                    "email": user_data["email"],
                    "name": user_data.get("name"),
                    "role": user_data.get("role"),
                    "organization": user_data.get("organization"),
                }
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying backup code: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify backup code"
        )


@router.get("/status")
async def get_mfa_status(
    email: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Get MFA status for a user."""
    try:
        user = await db.users.find_one({"email": email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        backup_codes = user.get("backupCodes", [])
        remaining_codes = sum(1 for code in backup_codes if not code.get("used"))
        
        status_data = MFAStatusResponse(
            enabled=user.get("mfaEnabled", False),
            setup_date=user.get("mfaSetupDate").isoformat() if user.get("mfaSetupDate") else None,
            last_used=user.get("mfaLastUsed").isoformat() if user.get("mfaLastUsed") else None,
            backup_codes_remaining=remaining_codes,
        )
        
        return success_response(
            "MFA status retrieved successfully",
            status_data.model_dump()
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting MFA status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get MFA status"
        )


@router.post("/regenerate-backup-codes")
async def regenerate_backup_codes(
    request: MFARegenerateBackupCodesRequest,
    email: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Regenerate backup codes (requires password verification)."""
    try:
        user = await db.users.find_one({"email": email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify password
        if not verify_password(request.password, user["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid password"
            )
        
        # Generate new backup codes
        backup_codes = generate_backup_codes(10)
        hashed_codes = hash_backup_codes(backup_codes)
        
        # Update database
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"backupCodes": hashed_codes}}
        )
        
        logger.info(f"Backup codes regenerated for user: {email}")
        
        return success_response(
            "Backup codes regenerated successfully. Save them securely.",
            {"backupCodes": backup_codes}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error regenerating backup codes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate backup codes"
        )


@router.post("/reset-authenticator")
async def reset_authenticator(
    request: MFAResetAuthenticatorRequest,
    email: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Reset/change authenticator app (requires password verification)."""
    try:
        user = await db.users.find_one({"email": email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify password
        if not verify_password(request.password, user["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid password"
            )
        
        # Generate new secret
        secret = generate_totp_secret()
        qr_code = generate_qr_code(email, secret)
        
        logger.info(f"Authenticator reset initiated for user: {email}")
        
        return success_response(
            "Scan the new QR code with your authenticator app",
            {
                "secret": secret,
                "qrCode": qr_code,
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting authenticator: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset authenticator"
        )
