"""Org Admin logs endpoints for Super Admin."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....db.mongo import get_db
from ....utils.mongo import serialize_document, to_object_id
from ....utils.responses import success_response
from .dependencies import require_super_admin

router = APIRouter(tags=["super-admin-org-logs"])


@router.get("/org-admin-logs")
async def get_org_admin_logs(
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get org admin activity logs with assessment details."""
    # Get all org_admin users
    cursor = db.users.find({"role": "org_admin"}, {"password": 0}).sort("createdAt", -1)
    org_admins = []

    async for doc in cursor:
        admin_data = serialize_document(doc)
        admin_id = admin_data.get("id")

        # Build query for assessments - check both createdBy and organization
        query_conditions = [{"createdBy": to_object_id(admin_id)}]

        # If admin has an organization, also search by organization
        admin_org = admin_data.get("organization")
        if admin_org:
            try:
                # Try to convert to ObjectId if it's a string
                org_id = to_object_id(admin_org) if isinstance(admin_org, str) else admin_org
                query_conditions.append({"organization": org_id})
            except (ValueError, TypeError):
                # If conversion fails, just use createdBy
                pass

        query = {"$or": query_conditions} if len(query_conditions) > 1 else query_conditions[0]

        # Count assessments
        assessment_count = await db.assessments.count_documents(query)

        # Get assessment details
        assessment_cursor = db.assessments.find(
            query,
            {"title": 1, "status": 1, "createdAt": 1, "updatedAt": 1},
        ).sort("createdAt", -1)

        assessments = [serialize_document(assess_doc) async for assess_doc in assessment_cursor]

        org_admins.append({
            "id": admin_data.get("id"),
            "name": admin_data.get("name"),
            "email": admin_data.get("email"),
            "assessmentCount": assessment_count,
            "assessments": assessments,
        })

    return success_response(
        f"Found {len(org_admins)} organization admin(s)",
        {
            "total": len(org_admins),
            "orgAdmins": org_admins,
        },
    )

