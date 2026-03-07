"""MFA (Multi-Factor Authentication) utilities."""
from __future__ import annotations

import base64
import io
import logging
import secrets
from datetime import datetime, timedelta, timezone

import pyotp
import qrcode
from cryptography.fernet import Fernet
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..core.config import get_settings
from ..core.security import get_password_hash

logger = logging.getLogger(__name__)


def get_encryption_key() -> bytes:
    """Get encryption key for MFA secrets."""
    settings = get_settings()
    # Use JWT secret as base for encryption key (in production, use separate key)
    key = base64.urlsafe_b64encode(settings.jwt_secret.encode()[:32].ljust(32, b'0'))
    return key


def encrypt_secret(secret: str) -> str:
    """Encrypt MFA secret for storage."""
    try:
        fernet = Fernet(get_encryption_key())
        encrypted = fernet.encrypt(secret.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    except Exception as e:
        logger.error(f"Error encrypting secret: {e}")
        raise


def decrypt_secret(encrypted_secret: str) -> str:
    """Decrypt MFA secret from storage."""
    try:
        fernet = Fernet(get_encryption_key())
        decrypted = fernet.decrypt(base64.urlsafe_b64decode(encrypted_secret))
        return decrypted.decode()
    except Exception as e:
        logger.error(f"Error decrypting secret: {e}")
        raise


def generate_totp_secret() -> str:
    """Generate a random TOTP secret."""
    return pyotp.random_base32()


def generate_qr_code(email: str, secret: str, issuer: str = "Aaptor") -> str:
    """Generate QR code for TOTP setup.
    
    Args:
        email: User's email address
        secret: TOTP secret
        issuer: Application name
        
    Returns:
        Base64 encoded PNG image of QR code
    """
    try:
        # Create TOTP URI
        totp = pyotp.TOTP(secret)
        uri = totp.provisioning_uri(name=email, issuer_name=issuer)
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(uri)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_base64}"
    except Exception as e:
        logger.error(f"Error generating QR code: {e}")
        raise


def verify_totp_code(secret: str, code: str, window: int = 1) -> bool:
    """Verify TOTP code.
    
    Args:
        secret: TOTP secret
        code: 6-digit code to verify
        window: Number of time windows to check (default 1 = 30 seconds before/after)
        
    Returns:
        True if code is valid, False otherwise
    """
    try:
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=window)
    except Exception as e:
        logger.error(f"Error verifying TOTP code: {e}")
        return False


def generate_backup_codes(count: int = 10) -> list[str]:
    """Generate backup codes.
    
    Args:
        count: Number of backup codes to generate
        
    Returns:
        List of backup codes (format: XXXX-XXXX)
    """
    codes = []
    for _ in range(count):
        # Generate 8-character alphanumeric code
        code = ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(8))
        # Format as XXXX-XXXX
        formatted_code = f"{code[:4]}-{code[4:]}"
        codes.append(formatted_code)
    return codes


def hash_backup_codes(codes: list[str]) -> list[dict]:
    """Hash backup codes for storage.
    
    Args:
        codes: List of plain text backup codes
        
    Returns:
        List of dicts with hashed codes and metadata
    """
    hashed_codes = []
    for code in codes:
        hashed_codes.append({
            "code": get_password_hash(code),
            "used": False,
            "usedAt": None,
        })
    return hashed_codes


def generate_email_otp() -> str:
    """Generate 6-digit email OTP code."""
    return ''.join(secrets.choice('0123456789') for _ in range(6))


async def check_email_otp_rate_limit(
    db: AsyncIOMotorDatabase,
    user_id: str,
    max_requests: int = 3,
    window_hours: int = 1
) -> tuple[bool, int]:
    """Check if user has exceeded email OTP rate limit.
    
    Args:
        db: Database connection
        user_id: User ID
        max_requests: Maximum requests allowed in window
        window_hours: Time window in hours
        
    Returns:
        Tuple of (is_allowed, requests_remaining)
    """
    try:
        from bson import ObjectId
        
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return False, 0
        
        # Get recent requests
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=window_hours)
        recent_requests = user.get("emailOtpRequests", [])
        
        # Filter requests within window
        valid_requests = []
        for req in recent_requests:
            timestamp = req.get("timestamp")
            if timestamp:
                # Ensure timestamp is timezone-aware
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                if timestamp > cutoff_time:
                    valid_requests.append(req)
        
        requests_count = len(valid_requests)
        requests_remaining = max(0, max_requests - requests_count)
        
        return requests_count < max_requests, requests_remaining
    except Exception as e:
        logger.error(f"Error checking email OTP rate limit: {e}")
        return False, 0


async def record_email_otp_request(db: AsyncIOMotorDatabase, user_id: str) -> None:
    """Record an email OTP request for rate limiting.
    
    Args:
        db: Database connection
        user_id: User ID
    """
    try:
        from bson import ObjectId
        
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$push": {
                    "emailOtpRequests": {
                        "timestamp": datetime.now(timezone.utc)
                    }
                }
            }
        )
        
        # Clean up old requests (older than 24 hours)
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$pull": {
                    "emailOtpRequests": {
                        "timestamp": {"$lt": cutoff_time}
                    }
                }
            }
        )
    except Exception as e:
        logger.error(f"Error recording email OTP request: {e}")
