from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator


import re


def _validate_password_strength(password: str) -> None:
    """Validate password strength: 8+ chars, uppercase, lowercase, number, special char."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise ValueError("Password must contain at least one special character")


def _validate_email_common_typos(email: str) -> None:
    """Block a small set of high-confidence email provider typos like gmail.co -> gmail.com.

    Note: syntactically `gmail.co` is a valid email domain; this is a product decision to prevent common mistakes.
    """
    normalized = (email or "").strip().lower()
    if "@" not in normalized:
        return
    _, domain = normalized.split("@", 1)

    typo_suggestions = {
        "gmail.co": "gmail.com",
        "gmai.com": "gmail.com",
        "gamil.com": "gmail.com",
        "gmial.com": "gmail.com",
        "gmail.con": "gmail.com",
        "yahoo.co": "yahoo.com",
        "outlook.co": "outlook.com",
        "hotmail.co": "hotmail.com",
    }

    suggestion = typo_suggestions.get(domain)
    if suggestion:
        raise ValueError(f"Email format is incorrect. Did you mean {suggestion}?")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=255)
    org_id: str | None = Field(default=None, description="Organization ID (required for org_admin)")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: EmailStr) -> EmailStr:
        _validate_email_common_typos(str(v))
        return v


class OrgSignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=255, description="Password must be at least 8 characters")
    organization: str | None = Field(default=None, max_length=255, description="Organization name")
    phone: str | None = Field(default=None, max_length=50, description="Optional phone number")
    country: str | None = Field(default=None, max_length=100, description="Optional country")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: EmailStr) -> EmailStr:
        _validate_email_common_typos(str(v))
        return v
    
    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength: 8+ chars, uppercase, lowercase, number, special char."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v


class SuperAdminSignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=255, description="Password must be at least 8 characters")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: EmailStr) -> EmailStr:
        _validate_email_common_typos(str(v))
        return v
    
    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength: 8+ chars, uppercase, lowercase, number, special char."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v


class GoogleSignupRequest(BaseModel):
    credential: str = Field(..., min_length=10)


class OAuthLoginRequest(BaseModel):
    email: EmailStr
    name: str | None = None
    provider: str = Field(..., min_length=2, max_length=50)
    role: str | None = Field(default=None, pattern=r"^(org_admin|editor|viewer|super_admin)$")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: EmailStr) -> EmailStr:
        _validate_email_common_typos(str(v))
        return v


class SendVerificationCodeRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: EmailStr) -> EmailStr:
        _validate_email_common_typos(str(v))
        return v


class VerifyEmailCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=10)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: EmailStr) -> EmailStr:
        _validate_email_common_typos(str(v))
        return v


class RefreshTokenRequest(BaseModel):
    refreshToken: str = Field(..., min_length=1, description="Refresh token to exchange for new access token")


class VerifyTokenRequest(BaseModel):
    token: str = Field(..., min_length=1, description="JWT token to verify")


