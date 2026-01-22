"""Login/logout logs endpoints for Super Admin."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....db.mongo import get_db
from ....utils.mongo import serialize_document
from ....utils.responses import success_response
from .dependencies import require_super_admin

router = APIRouter(tags=["super-admin-logs"])


@router.get("/logins")
async def get_super_admin_logs(
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get all super admin login/logout logs."""
    cursor = db.superadmin_logs.find({}).sort("loginTime", -1)
    logs = [serialize_document(doc) async for doc in cursor]

    return success_response(
        f"Found {len(logs)} log entries",
        {
            "total": len(logs),
            "logs": logs,
        },
    )

