from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import base64
import bcrypt
import hashlib
import hmac
import json
import os
from fastapi import HTTPException, status
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding

from .config import get_settings


class TokenError(HTTPException):
    def __init__(self, detail: str = "Invalid authentication credentials") -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def _get_secret_and_algorithm() -> tuple[str, str, str | None, str | None]:
    """Get JWT secret and algorithm. Returns (secret, algorithm, private_key, public_key)."""
    settings = get_settings()
    private_key = None
    public_key = None
    
    if settings.jwt_algorithm == "RS256":
        if settings.jwt_rsa_private_key_path and settings.jwt_rsa_public_key_path:
            try:
                with open(settings.jwt_rsa_private_key_path, "rb") as f:
                    private_key = serialization.load_pem_private_key(f.read(), password=None)
                with open(settings.jwt_rsa_public_key_path, "rb") as f:
                    public_key = serialization.load_pem_public_key(f.read())
            except Exception as e:
                raise TokenError(f"Failed to load RSA keys: {e}")
        else:
            raise TokenError("RS256 requires RSA key paths to be set in environment variables")
    
    return settings.jwt_secret, settings.jwt_algorithm, private_key, public_key


def _urlsafe_b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _urlsafe_b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(f"{data}{padding}")


def _hmac_sha256(secret: str, message: str) -> bytes:
    return hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()


def _encode_jwt(payload: Dict[str, Any], secret: str, algorithm: str, private_key=None) -> str:
    if algorithm == "HS256":
        header = {"alg": "HS256", "typ": "JWT"}
        segments = [
            _urlsafe_b64encode(json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")),
            _urlsafe_b64encode(json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")),
        ]
        signing_input = ".".join(segments)
        signature = _urlsafe_b64encode(_hmac_sha256(secret, signing_input))
        segments.append(signature)
        return ".".join(segments)
    elif algorithm == "RS256":
        if not private_key:
            raise TokenError("RS256 requires private key")
        header = {"alg": "RS256", "typ": "JWT"}
        segments = [
            _urlsafe_b64encode(json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")),
            _urlsafe_b64encode(json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")),
        ]
        signing_input = ".".join(segments)
        signature_bytes = private_key.sign(
            signing_input.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        signature = _urlsafe_b64encode(signature_bytes)
        segments.append(signature)
        return ".".join(segments)
    else:
        raise TokenError(f"Unsupported JWT algorithm: {algorithm}")


def _decode_jwt(token: str, secret: str, algorithm: str, public_key=None) -> Dict[str, Any]:
    try:
        header_segment, payload_segment, signature_segment = token.split(".")
    except ValueError as exc:  # pragma: no cover - runtime guard
        raise TokenError("Token structure invalid") from exc

    signing_input = f"{header_segment}.{payload_segment}"
    
    if algorithm == "HS256":
        expected_signature = _urlsafe_b64encode(_hmac_sha256(secret, signing_input))
        if not hmac.compare_digest(expected_signature, signature_segment):
            raise TokenError("Token signature invalid")
    elif algorithm == "RS256":
        if not public_key:
            raise TokenError("RS256 requires public key")
        try:
            signature_bytes = _urlsafe_b64decode(signature_segment)
            public_key.verify(
                signature_bytes,
                signing_input.encode("utf-8"),
                padding.PKCS1v15(),
                hashes.SHA256()
            )
        except Exception:
            raise TokenError("Token signature invalid")
    else:
        raise TokenError(f"Unsupported JWT algorithm: {algorithm}")

    try:
        payload_data = json.loads(_urlsafe_b64decode(payload_segment))
    except json.JSONDecodeError as exc:  # pragma: no cover - runtime guard
        raise TokenError("Token payload invalid") from exc

    now = datetime.now(timezone.utc).timestamp()
    exp = payload_data.get("exp")
    if exp is not None and now > float(exp):
        raise TokenError("Token expired")

    return payload_data


def create_access_token(subject: str, role: str) -> str:
    """Create a short-lived access token (1-2 hours)."""
    settings = get_settings()
    secret, algorithm, private_key, _ = _get_secret_and_algorithm()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.jwt_exp_minutes)

    payload: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return _encode_jwt(payload, secret, algorithm, private_key)


def create_refresh_token(subject: str, role: str) -> str:
    """Create a long-lived refresh token (30 days)."""
    settings = get_settings()
    secret, algorithm, private_key, _ = _get_secret_and_algorithm()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.jwt_refresh_exp_days)

    payload: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return _encode_jwt(payload, secret, algorithm, private_key)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token."""
    secret, algorithm, _, public_key = _get_secret_and_algorithm()
    return _decode_jwt(token, secret, algorithm, public_key)


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS attacks by escaping HTML characters."""
    if not text:
        return text
    import html
    return html.escape(str(text).strip())


def sanitize_text_field(text: str, max_length: int | None = None) -> str:
    """Sanitize and optionally truncate text field."""
    if not text:
        return ""
    sanitized = sanitize_input(text)
    if max_length and len(sanitized) > max_length:
        return sanitized[:max_length]
    return sanitized


def generate_csrf_token() -> str:
    """Generate a random CSRF token."""
    return base64.urlsafe_b64encode(os.urandom(32)).decode("utf-8").rstrip("=")


def verify_csrf_token(token: str, stored_token: str) -> bool:
    """Verify CSRF token using constant-time comparison."""
    if not token or not stored_token:
        return False
    return hmac.compare_digest(token, stored_token)
