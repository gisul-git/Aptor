"""Schemas for Super Admin API."""
from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, EmailStr, Field


class SuperAdminLoginRequest(BaseModel):
    """Request schema for super admin login."""
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=255)


class SuperAdminMFARequest(BaseModel):
    """Request schema for MFA verification."""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP code")


class SuperAdminResponse(BaseModel):
    """Response schema for super admin user."""
    id: str
    name: str
    email: str
    role: str
    createdAt: datetime | None = None


class SuperAdminLogResponse(BaseModel):
    """Response schema for super admin login/logout logs."""
    id: str
    superAdminId: str
    name: str
    email: str
    loginTime: datetime | None = None
    logoutTime: datetime | None = None


class AssessmentInfo(BaseModel):
    """Assessment information."""
    id: str
    title: str
    status: str
    createdAt: datetime | None = None


class OrgAdminLogsResponse(BaseModel):
    """Response schema for org admin logs."""
    id: str
    name: str
    email: str
    assessmentCount: int
    assessments: List[AssessmentInfo]


class SuperAdminOverviewResponse(BaseModel):
    """Response schema for super admin dashboard overview."""
    totalSuperAdmins: int
    totalOrgAdmins: int
    totalAssessments: int
    totalUsers: int

