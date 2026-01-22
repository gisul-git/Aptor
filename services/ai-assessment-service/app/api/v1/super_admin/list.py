"""List endpoints for Super Admin."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....db.mongo import get_db
from ....utils.mongo import serialize_document
from ....utils.responses import success_response
from .dependencies import require_super_admin

router = APIRouter(tags=["super-admin-list"])


@router.get("/list")
async def get_super_admin_list(
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get list of all super admin users."""
    cursor = db.users.find(
        {"role": "super_admin"},
        {"password": 0, "totp_secret": 0},
    ).sort("createdAt", -1)
    super_admins = [serialize_document(doc) async for doc in cursor]

    return success_response(
        f"Found {len(super_admins)} super admin(s)",
        {
            "total": len(super_admins),
            "superAdmins": super_admins,
        },
    )

