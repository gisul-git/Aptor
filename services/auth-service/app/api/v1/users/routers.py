"""Users endpoints for Auth Service."""
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, Header, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....db.mongo import get_db
from ....utils.mongo import serialize_document, to_object_id
from ....utils.responses import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me")
async def get_current_user(
    x_user_id: str = Header(..., alias="X-User-Id", description="User ID from API Gateway"),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get current user profile.
    Requires authentication via API Gateway (which injects X-User-Id header).
    """
    try:
        # Use user ID from API Gateway (already verified)
        user_id = x_user_id
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not provided"
            )
        
        # Get user from database
        user_oid = to_object_id(user_id)
        user = await db.users.find_one({"_id": user_oid})
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Serialize user document
        user_data = serialize_document(user)
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to serialize user data"
            )
        
        # Return user profile (exclude sensitive fields)
        profile = {
            "id": str(user_data.get("_id", "")),
            "email": user_data.get("email", ""),
            "name": user_data.get("name", ""),
            "role": user_data.get("role", ""),
            "orgId": user_data.get("orgId", ""),
            "isEmailVerified": user_data.get("isEmailVerified", False),
            "createdAt": user_data.get("createdAt"),
            "updatedAt": user_data.get("updatedAt"),
        }
        
        return success_response("User profile fetched successfully", profile)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user profile: {str(e)}"
        )

