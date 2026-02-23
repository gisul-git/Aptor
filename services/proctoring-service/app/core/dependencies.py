"""Dependencies for Proctoring Service."""
from typing import Any, Dict, Optional
from fastapi import Depends, HTTPException, Header, status


async def get_current_user_id(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> str:
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found")
    return x_user_id


async def get_current_user_context(
    user_id: str = Depends(get_current_user_id),
    org_id: Optional[str] = Header(None, alias="X-Org-Id"),
    role: Optional[str] = Header(None, alias="X-Role"),
) -> Dict[str, Any]:
    return {"id": user_id, "org_id": org_id, "role": role}

