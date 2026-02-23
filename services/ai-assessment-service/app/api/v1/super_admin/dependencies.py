"""Dependencies for Super Admin API."""
from __future__ import annotations

from typing import Any, Dict

from fastapi import Depends, HTTPException, status

from ....core.dependencies import get_current_user


async def require_super_admin(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Dependency to require super_admin role."""
    if current_user.get("role") != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Super admin role required.",
        )
    return current_user

