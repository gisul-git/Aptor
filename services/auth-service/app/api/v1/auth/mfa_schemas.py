"""MFA (Multi-Factor Authentication) schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field


class MFASetupRequest(BaseModel):
    """Request to initiate MFA setup."""
    pass


class MFASetupResponse(BaseModel):
    """Response containing QR code and secret for MFA setup."""
    qr_code: str = Field(..., description="Base64 encoded QR code image")
    secret: str = Field(..., description="TOTP secret key for manual entry")
    backup_codes: list[str] | None = Field(None, description="Backup codes (only after verification)")


class MFAVerifySetupRequest(BaseModel):
    """Request to verify MFA setup with TOTP code."""
    code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP code")
    secret: str = Field(..., description="TOTP secret from setup")


class MFAVerifyTOTPRequest(BaseModel):
    """Request to verify TOTP code during login."""
    email: str = Field(..., description="User email")
    code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP code")
    temp_token: str = Field(..., description="Temporary token from initial login")


class MFASendEmailOTPRequest(BaseModel):
    """Request to send email OTP."""
    email: str = Field(..., description="User email")
    temp_token: str = Field(..., description="Temporary token from initial login")


class MFAVerifyEmailOTPRequest(BaseModel):
    """Request to verify email OTP."""
    email: str = Field(..., description="User email")
    code: str = Field(..., min_length=6, max_length=6, description="6-digit email OTP code")
    temp_token: str = Field(..., description="Temporary token from initial login")


class MFAVerifyBackupCodeRequest(BaseModel):
    """Request to verify backup code."""
    email: str = Field(..., description="User email")
    code: str = Field(..., min_length=8, max_length=12, description="Backup code")
    temp_token: str = Field(..., description="Temporary token from initial login")


class MFAStatusResponse(BaseModel):
    """Response containing MFA status."""
    enabled: bool = Field(..., description="Whether MFA is enabled")
    setup_date: str | None = Field(None, description="Date MFA was set up")
    last_used: str | None = Field(None, description="Last time MFA was used")
    backup_codes_remaining: int = Field(0, description="Number of unused backup codes")


class MFARegenerateBackupCodesRequest(BaseModel):
    """Request to regenerate backup codes."""
    password: str = Field(..., description="User password for verification")


class MFAResetAuthenticatorRequest(BaseModel):
    """Request to reset/change authenticator app."""
    password: str = Field(..., description="User password for verification")


class MFADisableRequest(BaseModel):
    """Request from super admin to disable MFA for a user."""
    user_id: str = Field(..., description="User ID to disable MFA for")
    reason: str = Field(..., description="Reason for disabling MFA")


class MFACompleteSetupRequest(BaseModel):
    """Request to complete MFA setup."""
    email: str = Field(..., description="User email")
    encrypted_secret: str = Field(..., description="Encrypted TOTP secret")
    hashed_backup_codes: list[dict] = Field(..., description="Hashed backup codes")

