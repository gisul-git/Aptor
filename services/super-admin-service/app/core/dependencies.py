"""Dependencies for Super Admin Service."""
from __future__ import annotations

from typing import Any, Dict, Optional

from bson import ObjectId
from fastapi import Depends, HTTPException, Header, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db.mongo import get_db
from ..utils.mongo import serialize_document
from ..core.security import decode_token, TokenError


async def get_current_user_id(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None),
) -> str:
    """Get current user ID from gateway-injected header or JWT token."""
    # Try gateway header first
    if x_user_id:
        return x_user_id
    
    # Fallback to JWT token
    if authorization:
        try:
            token = authorization.replace("Bearer ", "")
            payload = decode_token(token)
            user_id = payload.get("sub")
            if user_id:
                return user_id
        except TokenError:
            pass
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="User ID not found in request headers or token"
    )


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
    """Get current user from database using gateway-injected user ID or JWT token."""
    return await _fetch_user(db, user_id)

