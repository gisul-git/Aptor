"""Organization Admin management endpoints for Super Admin."""
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....db.mongo import get_db, get_client
from ....utils.mongo import to_object_id
from ....utils.responses import success_response
from .dependencies import require_super_admin

router = APIRouter(tags=["super-admin-org-management"])
logger = logging.getLogger(__name__)


@router.delete("/org-admins/{org_admin_id}")
async def delete_org_admin(
    org_admin_id: str,
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Delete an organization admin account.
    
    This will:
    1. Delete the org admin user from auth_db.users
    2. Optionally delete their organization and all related data
    
    Args:
        org_admin_id: The ID of the org admin to delete
        current_user: The authenticated super admin
        db: Database connection
    
    Returns:
        Success response with deletion details
    """
    try:
        org_admin_oid = to_object_id(org_admin_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid org admin ID format")
    
    # Find the org admin user
    org_admin = await db.users.find_one({"_id": org_admin_oid, "role": "org_admin"})
    
    if not org_admin:
        raise HTTPException(status_code=404, detail="Organization admin not found")
    
    org_admin_email = org_admin.get("email")
    org_admin_name = org_admin.get("name")
    organization_id = org_admin.get("organization")
    
    logger.info(f"Deleting org admin: {org_admin_email} (ID: {org_admin_id})")
    
    # Delete the org admin user
    delete_result = await db.users.delete_one({"_id": org_admin_oid})
    
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Failed to delete org admin")
    
    logger.info(f"Successfully deleted org admin user: {org_admin_email}")
    
    # Optional: Delete organization and related data
    # For now, we'll just delete the user account
    # If you want to delete the entire organization, uncomment the code below:
    
    # if organization_id:
    #     try:
    #         org_oid = to_object_id(organization_id)
    #         
    #         # Delete organization
    #         await db.organizations.delete_one({"_id": org_oid})
    #         
    #         # Delete all employees in the organization
    #         client = get_client()
    #         employee_db = client["employee_db"]
    #         await employee_db.employees.delete_many({"organization": org_oid})
    #         
    #         # Delete all assessments created by this org admin
    #         ai_assessment_db = client["ai_assessment_db"]
    #         custom_mcq_db = client["custom_mcq_db"]
    #         dsa_db = client["dsa_db"]
    #         
    #         await ai_assessment_db.assessments.delete_many({"createdBy": org_admin_oid})
    #         await custom_mcq_db.custom_mcq_assessments.delete_many({"created_by": org_admin_id})
    #         await dsa_db.tests.delete_many({"created_by": org_admin_id})
    #         
    #         logger.info(f"Deleted organization and related data for org admin: {org_admin_email}")
    #     except Exception as e:
    #         logger.error(f"Error deleting organization data: {str(e)}")
    
    return success_response(
        f"Organization admin '{org_admin_name}' deleted successfully",
        {
            "deletedOrgAdmin": {
                "id": org_admin_id,
                "name": org_admin_name,
                "email": org_admin_email,
            }
        },
    )
