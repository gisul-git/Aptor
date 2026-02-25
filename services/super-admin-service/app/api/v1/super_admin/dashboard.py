"""Dashboard endpoints for Super Admin."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....db.mongo import get_db
from ....utils.responses import success_response
from .dependencies import require_super_admin

router = APIRouter(tags=["super-admin-dashboard"])


@router.get("/me")
async def get_super_admin_profile(
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get current super admin profile."""
    return success_response(
        "Super admin profile fetched successfully",
        {
            "id": current_user.get("id"),
            "name": current_user.get("name"),
            "email": current_user.get("email"),
            "role": current_user.get("role"),
        },
    )


@router.get("/overview")
async def get_overview(
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get dashboard overview statistics."""
    from ....db.mongo import get_client
    
    client = get_client()
    
    # Users are in auth_db
    total_super_admins = await db.users.count_documents({"role": "super_admin"})
    total_org_admins = await db.users.count_documents({"role": "org_admin"})
    total_users = await db.users.count_documents({})
    
    # Assessments are in ai_assessment_db
    ai_assessment_db = client["ai_assessment_db"]
    total_ai_assessments = await ai_assessment_db.assessments.count_documents({})
    
    # Custom MCQ assessments are in custom_mcq_db
    custom_mcq_db = client["custom_mcq_db"]
    total_custom_mcq = await custom_mcq_db.custom_mcq_assessments.count_documents({})
    
    # DSA/AIML tests are in dsa_db
    dsa_db = client["dsa_db"]
    total_dsa_tests = await dsa_db.tests.count_documents({
        "$or": [
            {"test_type": {"$exists": False}},
            {"test_type": None},
            {"test_type": "dsa"}
        ]
    })
    total_aiml_tests = await dsa_db.tests.count_documents({"test_type": "aiml"})
    
    # Total assessments across all services
    total_assessments = total_ai_assessments + total_custom_mcq + total_dsa_tests + total_aiml_tests

    return success_response(
        "Overview fetched successfully",
        {
            "totalSuperAdmins": total_super_admins,
            "totalOrgAdmins": total_org_admins,
            "totalAssessments": total_assessments,
            "totalUsers": total_users,
            "breakdown": {
                "aiAssessments": total_ai_assessments,
                "customMcq": total_custom_mcq,
                "dsaTests": total_dsa_tests,
                "aimlTests": total_aiml_tests,
            },
        },
    )

