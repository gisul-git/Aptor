from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=255)
    role: str = Field(..., pattern=r"^(org_admin|editor|viewer)$")
    organizationId: Optional[str] = Field(default=None)


class UserStatusUpdateRequest(BaseModel):
    role: Optional[str] = Field(default=None)


class UserProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=30)









