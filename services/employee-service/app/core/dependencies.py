"""Dependencies for Employee Service."""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Header, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db.mongo import get_db


async def get_current_user_id(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> str:
    """Get current user ID from gateway-injected header."""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not found in request headers"
        )
    return x_user_id


async def get_current_user_org(
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
) -> Optional[str]:
    """Get current user organization ID from gateway-injected header."""
    return x_org_id


async def get_current_user_role(
    x_role: Optional[str] = Header(None, alias="X-Role"),
) -> Optional[str]:
    """Get current user role from gateway-injected header."""
    return x_role


async def require_org_admin(
    user_id: str = Depends(get_current_user_id),
    org_id: str = Depends(get_current_user_org),
    role: str = Depends(get_current_user_role),
) -> dict:
    """Require organization admin role."""
    if role != "org_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization admin access required"
        )
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization ID is required"
        )
    return {"user_id": user_id, "org_id": org_id, "role": role}

