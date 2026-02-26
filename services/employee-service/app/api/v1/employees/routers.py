"""Employee API routers."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.dependencies import require_org_admin
from ....db.mongo import get_db
from .schemas import (
    AddEmployeeRequest,
    UpdateEmployeeRequest,
    EmployeeResponse,
    EmployeeListResponse,
    VerifyTempPasswordRequest,
    SetPasswordRequest,
    EmployeeLoginRequest,
    EmployeeLoginResponse,
)
from .services import EmployeeService

router = APIRouter(prefix="/api/v1/employees", tags=["employees"])


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_employee(
    request: AddEmployeeRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin_context: dict = Depends(require_org_admin),
):
    """Add a new employee."""
    service = EmployeeService(db)
    employee = await service.add_employee(
        organization_id=admin_context["org_id"],
        name=request.name,
        email=request.email,
        admin_id=admin_context["user_id"],
    )
    return {
        "success": True,
        "data": employee,
    }


@router.get("", response_model=EmployeeListResponse)
async def get_employees(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin_context: dict = Depends(require_org_admin),
):
    """Get employees by organization."""
    service = EmployeeService(db)
    result = await service.get_employees_by_org(
        organization_id=admin_context["org_id"],
        page=page,
        limit=limit,
        search=search,
        status_filter=status_filter,
    )
    return result


@router.put("/{aaptor_id}", response_model=dict)
async def update_employee(
    aaptor_id: str,
    request: UpdateEmployeeRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin_context: dict = Depends(require_org_admin),
):
    """Update employee."""
    service = EmployeeService(db)
    
    # Verify employee belongs to the organization by trying to find them
    employee_result = await service.find_employee_organization(aaptor_id)
    if not employee_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    org_id, employee = employee_result
    if org_id != admin_context["org_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee does not belong to your organization"
        )
    
    employee = await service.update_employee(
        aaptor_id=aaptor_id,
        name=request.name,
        email=request.email,
        status_filter=request.status,
    )
    return {
        "success": True,
        "data": employee,
    }


@router.delete("/{aaptor_id}", response_model=dict)
async def delete_employee(
    aaptor_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin_context: dict = Depends(require_org_admin),
):
    """Delete employee."""
    service = EmployeeService(db)
    
    # Verify employee belongs to the organization
    employee_result = await service.find_employee_organization(aaptor_id)
    if not employee_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    org_id, _ = employee_result
    if org_id != admin_context["org_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee does not belong to your organization"
        )
    
    await service.delete_employee(aaptor_id)
    return {"success": True}


@router.post("/{aaptor_id}/resend", response_model=dict)
async def resend_welcome_email(
    aaptor_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin_context: dict = Depends(require_org_admin),
):
    """Resend welcome email to employee."""
    service = EmployeeService(db)
    
    # Verify employee belongs to the organization
    employee_result = await service.find_employee_organization(aaptor_id)
    if not employee_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    org_id, _ = employee_result
    if org_id != admin_context["org_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee does not belong to your organization"
        )
    
    await service.resend_welcome_email(aaptor_id)
    return {"success": True, "message": "Email resent successfully"}


# Public endpoints (no authentication required)

@router.get("/{aaptor_id}/password-status", response_model=dict)
async def get_password_status(
    aaptor_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Check whether an employee has already set their password (public endpoint)."""
    service = EmployeeService(db)
    status_data = await service.get_password_status(aaptor_id)
    return {
        "success": True,
        "data": status_data,
    }


@router.post("/verify-temp-password", response_model=dict)
async def verify_temp_password(
    request: VerifyTempPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Verify temporary password (public endpoint)."""
    service = EmployeeService(db)
    is_valid = await service.verify_temp_password(request.aaptorId, request.tempPassword)
    return {
        "success": True,
        "valid": is_valid,
    }


@router.post("/set-password", response_model=dict)
async def set_password(
    request: SetPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Set new password (public endpoint)."""
    service = EmployeeService(db)
    
    # Verify temporary password first
    is_valid = await service.verify_temp_password(request.aaptorId, request.tempPassword)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid temporary password"
        )
    
    # Update password
    await service.update_password(request.aaptorId, request.newPassword)
    return {
        "success": True,
        "message": "Password set successfully",
    }


@router.post("/login", response_model=EmployeeLoginResponse)
async def employee_login(
    request: EmployeeLoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Employee login (public endpoint)."""
    service = EmployeeService(db)
    result = await service.login(
        aaptor_id=request.aaptorId,
        email=request.email,
        password=request.password,
    )
    return result


@router.get("/organizations/{org_id}", response_model=dict)
async def get_organization(
    org_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin_context: dict = Depends(require_org_admin),
):
    """Get organization details by orgId."""
    service = EmployeeService(db)
    
    # Verify the org_id matches the admin's organization
    if org_id != admin_context["org_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own organization"
        )
    
    organization = await service.get_organization_by_id(org_id)
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    return {
        "success": True,
        "data": organization,
    }
