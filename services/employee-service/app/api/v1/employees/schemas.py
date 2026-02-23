"""Pydantic schemas for employee API."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
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


class AddEmployeeRequest(BaseModel):
    """Request schema for adding a new employee."""
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr


class UpdateEmployeeRequest(BaseModel):
    """Request schema for updating an employee."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    status: Optional[str] = Field(None, pattern="^(pending|active|inactive)$")


class EmployeeResponse(BaseModel):
    """Response schema for employee data."""
    id: str
    aaptorId: str
    organizationId: str
    name: str
    email: str
    status: str
    isPasswordSet: bool
    lastLogin: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True


class EmployeeListResponse(BaseModel):
    """Response schema for employee list with pagination."""
    employees: list[EmployeeResponse]
    pagination: dict


class VerifyTempPasswordRequest(BaseModel):
    """Request schema for verifying temporary password."""
    aaptorId: str
    tempPassword: str


class SetPasswordRequest(BaseModel):
    """Request schema for setting new password."""
    aaptorId: str
    tempPassword: str
    newPassword: str = Field(..., min_length=8, max_length=255)
    
    @field_validator("newPassword")
    @classmethod
    def validate_password(cls, v: str) -> str:
        _validate_password_strength(v)
        return v


class EmployeeLoginRequest(BaseModel):
    """Request schema for employee login."""
    aaptorId: str
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=255)


class EmployeeLoginResponse(BaseModel):
    """Response schema for employee login."""
    employee: EmployeeResponse
    token: str

