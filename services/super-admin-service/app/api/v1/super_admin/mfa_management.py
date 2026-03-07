"""MFA management endpoints for Super Admin."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....db.mongo import get_db, get_client
from ....utils.responses import success_response
from .dependencies import require_super_admin

router = APIRouter(tags=["super-admin-mfa"])
logger = logging.getLogger(__name__)


@router.post("/mfa/disable/{user_id}")
async def disable_user_mfa(
    user_id: str,
    reason: str,
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Disable MFA for a user (emergency account recovery).
    
    This endpoint allows super admins to disable MFA for users who:
    - Lost their phone/authenticator app
    - Lost their backup codes
    - Cannot access their email
    
    Args:
        user_id: The ID of the user to disable MFA for
        reason: Reason for disabling MFA (for audit trail)
        current_user: The authenticated super admin
        db: Database connection
    
    Returns:
        Success response with disabled user details
    """
    if not reason or len(reason.strip()) < 10:
        raise HTTPException(
            status_code=400,
            detail="Reason must be at least 10 characters long"
        )
    
    try:
        user_oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    # Find the user
    user = await db.users.find_one({"_id": user_oid})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_email = user.get("email")
    user_name = user.get("name")
    user_role = user.get("role")
    mfa_enabled = user.get("mfaEnabled", False)
    
    if not mfa_enabled:
        raise HTTPException(
            status_code=400,
            detail="MFA is not enabled for this user"
        )
    
    logger.info(
        f"Super admin {current_user.get('email')} disabling MFA for user: {user_email} (ID: {user_id}). Reason: {reason}"
    )
    
    # Disable MFA and clear related data
    await db.users.update_one(
        {"_id": user_oid},
        {
            "$set": {
                "mfaEnabled": False,
                "mfaDisabledAt": datetime.now(timezone.utc),
                "mfaDisabledBy": current_user.get("email"),
                "mfaDisabledReason": reason.strip(),
            },
            "$unset": {
                "mfaSecret": "",
                "backupCodes": "",
                "emailOtp": "",
                "emailOtpRequests": "",
            }
        }
    )
    
    # Log the action in audit trail
    client = get_client()
    audit_db = client["audit_db"]
    await audit_db.mfa_actions.insert_one({
        "action": "mfa_disabled_by_admin",
        "superAdminEmail": current_user.get("email"),
        "superAdminId": current_user.get("id"),
        "targetUserId": user_id,
        "targetUserEmail": user_email,
        "targetUserName": user_name,
        "targetUserRole": user_role,
        "reason": reason.strip(),
        "timestamp": datetime.now(timezone.utc),
    })
    
    logger.info(f"Successfully disabled MFA for user: {user_email}")
    
    return success_response(
        f"MFA disabled successfully for user '{user_name}'",
        {
            "userId": user_id,
            "userEmail": user_email,
            "userName": user_name,
            "disabledBy": current_user.get("email"),
            "disabledAt": datetime.now(timezone.utc).isoformat(),
            "reason": reason.strip(),
        }
    )


@router.get("/mfa/audit-log")
async def get_mfa_audit_log(
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get MFA audit log (all MFA disable actions by super admins).
    
    Returns:
        List of MFA disable actions with details
    """
    try:
        client = get_client()
        audit_db = client["audit_db"]
        
        # Get all MFA disable actions, sorted by most recent first
        cursor = audit_db.mfa_actions.find(
            {"action": "mfa_disabled_by_admin"}
        ).sort("timestamp", -1).limit(100)
        
        actions = []
        async for doc in cursor:
            actions.append({
                "id": str(doc["_id"]),
                "superAdminEmail": doc.get("superAdminEmail"),
                "targetUserEmail": doc.get("targetUserEmail"),
                "targetUserName": doc.get("targetUserName"),
                "targetUserRole": doc.get("targetUserRole"),
                "reason": doc.get("reason"),
                "timestamp": doc.get("timestamp").isoformat() if doc.get("timestamp") else None,
            })
        
        return success_response(
            f"Found {len(actions)} MFA disable action(s)",
            {
                "total": len(actions),
                "actions": actions,
            }
        )
    except Exception as e:
        logger.error(f"Error fetching MFA audit log: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch MFA audit log"
        )
