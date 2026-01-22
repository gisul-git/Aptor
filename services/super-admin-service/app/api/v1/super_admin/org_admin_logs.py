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
    """Get org admin activity logs with assessment details from all services."""
    from ....db.mongo import get_client
    
    client = get_client()
    ai_assessment_db = client["ai_assessment_db"]
    custom_mcq_db = client["custom_mcq_db"]
    dsa_db = client["dsa_db"]
    
    # Get all org_admin users from auth_db
    cursor = db.users.find({"role": "org_admin"}, {"password": 0}).sort("createdAt", -1)
    org_admins = []

    async for doc in cursor:
        admin_data = serialize_document(doc)
        admin_id = admin_data.get("id")
        admin_id_oid = to_object_id(admin_id)

        # Build query for AI assessments - check both createdBy and organization
        ai_query_conditions = [{"createdBy": admin_id_oid}]

        # If admin has an organization, also search by organization
        admin_org = admin_data.get("organization")
        if admin_org:
            try:
                org_id = to_object_id(admin_org) if isinstance(admin_org, str) else admin_org
                ai_query_conditions.append({"organization": org_id})
            except (ValueError, TypeError):
                pass

        ai_query = {"$or": ai_query_conditions} if len(ai_query_conditions) > 1 else ai_query_conditions[0]

        # Query for Custom MCQ assessments
        custom_mcq_query = {"created_by": admin_id}

        # Query for DSA tests (created_by field, and test_type is "dsa" or None/doesn't exist)
        dsa_query = {
            "created_by": admin_id,
            "$or": [
                {"test_type": {"$exists": False}},
                {"test_type": None},
                {"test_type": "dsa"}
            ]
        }

        # Query for AIML tests (created_by field, and test_type is "aiml")
        aiml_query = {
            "created_by": admin_id,
            "test_type": "aiml"
        }

        # Count assessments from all services
        ai_count = await ai_assessment_db.assessments.count_documents(ai_query)
        custom_mcq_count = await custom_mcq_db.custom_mcq_assessments.count_documents(custom_mcq_query)
        dsa_count = await dsa_db.tests.count_documents(dsa_query)
        aiml_count = await dsa_db.tests.count_documents(aiml_query)
        
        total_assessment_count = ai_count + custom_mcq_count + dsa_count + aiml_count

        # Get assessment details from all services
        all_assessments = []

        # AI Assessments
        ai_cursor = ai_assessment_db.assessments.find(
            ai_query,
            {"title": 1, "status": 1, "createdAt": 1, "updatedAt": 1},
        ).sort("createdAt", -1)
        async for assess_doc in ai_cursor:
            assess_data = serialize_document(assess_doc)
            assess_data["type"] = "ai-assessment"
            all_assessments.append(assess_data)

        # Custom MCQ Assessments
        custom_mcq_cursor = custom_mcq_db.custom_mcq_assessments.find(
            custom_mcq_query,
            {"title": 1, "status": 1, "createdAt": 1, "updatedAt": 1},
        ).sort("createdAt", -1)
        async for assess_doc in custom_mcq_cursor:
            assess_data = serialize_document(assess_doc)
            assess_data["type"] = "custom-mcq"
            all_assessments.append(assess_data)

        # DSA Tests
        dsa_cursor = dsa_db.tests.find(
            dsa_query,
            {"title": 1, "is_active": 1, "created_at": 1},
        ).sort("created_at", -1)
        async for test_doc in dsa_cursor:
            test_data = serialize_document(test_doc)
            test_data["type"] = "dsa"
            test_data["status"] = "active" if test_doc.get("is_active") else "inactive"
            test_data["createdAt"] = test_data.pop("created_at", None)
            test_data["updatedAt"] = test_data.get("createdAt")
            all_assessments.append(test_data)

        # AIML Tests
        aiml_cursor = dsa_db.tests.find(
            aiml_query,
            {"title": 1, "is_active": 1, "created_at": 1},
        ).sort("created_at", -1)
        async for test_doc in aiml_cursor:
            test_data = serialize_document(test_doc)
            test_data["type"] = "aiml"
            test_data["status"] = "active" if test_doc.get("is_active") else "inactive"
            test_data["createdAt"] = test_data.pop("created_at", None)
            test_data["updatedAt"] = test_data.get("createdAt")
            all_assessments.append(test_data)

        # Sort all assessments by createdAt (most recent first)
        all_assessments.sort(key=lambda x: x.get("createdAt") or "", reverse=True)

        org_admins.append({
            "id": admin_data.get("id"),
            "name": admin_data.get("name"),
            "email": admin_data.get("email"),
            "assessmentCount": total_assessment_count,
            "breakdown": {
                "aiAssessments": ai_count,
                "customMcq": custom_mcq_count,
                "dsaTests": dsa_count,
                "aimlTests": aiml_count,
            },
            "assessments": all_assessments,
        })

    return success_response(
        f"Found {len(org_admins)} organization admin(s)",
        {
            "total": len(org_admins),
            "orgAdmins": org_admins,
        },
    )

