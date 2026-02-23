"""Dependencies for Custom MCQ Service."""
from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from bson import ObjectId
from fastapi import Depends, HTTPException, Header, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db.mongo import get_db
from ..utils.mongo import serialize_document


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


async def _fetch_user(db: AsyncIOMotorDatabase, user_id: str) -> Dict[str, Any]:
    """Fetch user from database by ID."""
    try:
        oid = ObjectId(user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier"
        ) from exc

    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    serialized = serialize_document(user)
    if not serialized:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return serialized


async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Get current user from database using gateway-injected user ID."""
    return await _fetch_user(db, user_id)


async def get_current_user_context(
    user_id: str = Depends(get_current_user_id),
    org_id: Optional[str] = Depends(get_current_user_org),
    role: Optional[str] = Depends(get_current_user_role),
) -> Dict[str, Any]:
    """Get current user context from gateway headers."""
    return {
        "id": user_id,
        "org_id": org_id,
        "role": role,
    }


def require_roles(*roles: str) -> Callable[[Dict[str, Any]], Dict[str, Any]]:
    """Require user to have one of the specified roles."""
    async def dependency(
        user_context: Dict[str, Any] = Depends(get_current_user_context)
    ) -> Dict[str, Any]:
        user_role = user_context.get("role")
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}",
            )
        return user_context
    return dependency


require_super_admin = require_roles("super_admin")
require_org_admin = require_roles("super_admin", "org_admin")
require_editor = require_roles("super_admin", "org_admin", "editor")
require_viewer = require_roles("super_admin", "org_admin", "editor", "viewer")

