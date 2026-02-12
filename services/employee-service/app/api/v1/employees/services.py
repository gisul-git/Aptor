"""Employee service business logic."""
from __future__ import annotations
from datetime import datetime, timedelta
import secrets
import string
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import HTTPException, status
import bcrypt
import jwt

from ....core.config import get_settings
from .models import EmployeeModel, OrganizationModel
from ....utils.email import send_welcome_email


class EmployeeService:
    """Service for employee management operations."""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db  # employee_db (legacy)
        self.settings = get_settings()
        # Use org_admins_db for employees organized by organization
        self.org_admins_db = db.client[self.settings.org_admins_db]
        # Employees are stored in collections per organization (e.g., ORG001_employees)
        # We'll get the collection dynamically based on organizationId
        # Organizations live in a separate database (e.g., organization_db)
        org_db = db.client[self.settings.organization_mongo_db]
        self.org_collection = OrganizationModel.get_collection(org_db)
    
    def get_employee_collection(self, organization_id: str):
        """Get employee collection for a specific organization.
        
        Employees are stored in collections named: {orgId}_employees
        Example: ORG001_employees, ORG002_employees
        """
        collection_name = f"{organization_id}_employees"
        collection = self.org_admins_db[collection_name]
        # Create indexes for this collection
        from pymongo import IndexModel
        indexes = [
            IndexModel([("aaptorId", 1)], unique=True),
            IndexModel([("email", 1)], unique=True),
            IndexModel([("createdAt", -1)]),
            IndexModel([("email", 1), ("aaptorId", 1)]),
        ]
        collection.create_indexes(indexes)
        return collection
    
    async def find_employee_organization(self, aaptor_id: str) -> tuple[str, dict] | None:
        """Find which organization an employee belongs to by searching all org collections.
        
        Returns: (organization_id, employee_doc) or None if not found
        """
        # Get all collection names in org_admins_db
        collection_names = await self.org_admins_db.list_collection_names()
        
        # Search through all organization employee collections
        for collection_name in collection_names:
            if collection_name.endswith("_employees"):
                collection = self.org_admins_db[collection_name]
                employee = await collection.find_one({"aaptorId": aaptor_id})
                if employee:
                    # Extract org_id from collection name (e.g., "ORG001_employees" -> "ORG001")
                    org_id = collection_name.replace("_employees", "")
                    return (org_id, employee)
        
        return None
    
    async def generate_aaptor_id(self, organization_id: str) -> str:
        """Generate Aaptor ID: AAP + orgId + sequential number."""
        # Extract numeric part from orgId (e.g., "ORG001" -> "001")
        org_numeric = ''.join(filter(str.isdigit, organization_id))
        if not org_numeric:
            org_numeric = "001"  # Default if no numbers found
        
        # Use find_one_and_update for atomic increment
        result = await self.org_collection.find_one_and_update(
            {"orgId": organization_id},
            {"$inc": {"employeeCounter": 1}},
            upsert=True,
            return_document=True,
        )
        
        if result is None:
            # Create organization if it doesn't exist
            await self.org_collection.insert_one(
                OrganizationModel.create_organization({
                    "orgId": organization_id,
                    "name": f"Organization {organization_id}",
                    "employeeCounter": 1,
                })
            )
            counter = 1
        else:
            counter = result.get("employeeCounter", 1)
        
        # Format: AAP + orgNumeric + 4-digit counter
        sequential_number = str(counter).zfill(4)
        return f"AAP{org_numeric}{sequential_number}"
    
    def generate_random_password(self) -> str:
        """Generate random 12-character password."""
        length = 12
        uppercase = string.ascii_uppercase
        lowercase = string.ascii_lowercase
        numbers = string.digits
        symbols = "!@#$%^&"
        all_chars = uppercase + lowercase + numbers + symbols
        
        password = ""
        # Ensure at least one of each type
        password += secrets.choice(uppercase)
        password += secrets.choice(lowercase)
        password += secrets.choice(numbers)
        password += secrets.choice(symbols)
        
        # Fill the rest randomly
        for _ in range(length - len(password)):
            password += secrets.choice(all_chars)
        
        # Shuffle the password
        password_list = list(password)
        secrets.SystemRandom().shuffle(password_list)
        return ''.join(password_list)
    
    async def add_employee(
        self,
        organization_id: str,
        name: str,
        email: str,
        admin_id: str,
    ) -> dict:
        """Add a new employee."""
        # Get organization-specific employee collection
        employee_collection = self.get_employee_collection(organization_id)
        
        # Check if email already exists (check across all org collections for uniqueness)
        # For now, check only in this organization's collection
        existing = await employee_collection.find_one({"email": email.lower().strip()})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
        
        # Generate Aaptor ID
        aaptor_id = await self.generate_aaptor_id(organization_id)
        
        # Generate temporary password
        temp_password = self.generate_random_password()
        
        # Set expiry to 24 hours from now
        temp_password_expiry = datetime.utcnow() + timedelta(hours=24)
        
        # Create employee
        employee_data = EmployeeModel.create_employee({
            "aaptorId": aaptor_id,
            "organizationId": organization_id,
            "name": name,
            "email": email,
            "tempPassword": temp_password,
            "tempPasswordExpiry": temp_password_expiry,
            "status": "pending",
            "isPasswordSet": False,
            "createdBy": admin_id,
        })
        
        result = await employee_collection.insert_one(employee_data)
        employee_data["_id"] = result.inserted_id
        
        # Note: Email is NOT sent automatically when employee is created
        # Admin must click "Send Email" button to send the welcome email with Aaptor ID and password
        
        return EmployeeModel.to_dict(employee_data)
    
    async def verify_temp_password(self, aaptor_id: str, temp_password: str) -> bool:
        """Verify temporary password."""
        result = await self.find_employee_organization(aaptor_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        org_id, employee = result
        
        if employee.get("isPasswordSet"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password already set. Please use login page."
            )
        
        # Check if temp password expired
        expiry = employee.get("tempPasswordExpiry")
        if expiry and datetime.utcnow() > expiry:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Temporary password has expired. Please contact your administrator."
            )
        
        return employee.get("tempPassword") == temp_password
    
    async def update_password(self, aaptor_id: str, new_password: str) -> dict:
        """Update employee password."""
        result = await self.find_employee_organization(aaptor_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        org_id, employee = result
        employee_collection = self.get_employee_collection(org_id)
        
        # Hash the new password
        password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt(12)).decode('utf-8')
        
        # Update employee
        await employee_collection.update_one(
            {"aaptorId": aaptor_id},
            {
                "$set": {
                    "passwordHash": password_hash,
                    "isPasswordSet": True,
                    "status": "active",
                    "updatedAt": datetime.utcnow(),
                },
                "$unset": {
                    "tempPassword": "",
                    "tempPasswordExpiry": "",
                }
            }
        )
        
        return {"success": True}
    
    async def get_password_status(self, aaptor_id: str) -> dict:
        """Return whether the employee has already set a permanent password."""
        result = await self.find_employee_organization(aaptor_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        _, employee = result
        return {
            "aaptorId": aaptor_id,
            "isPasswordSet": bool(employee.get("isPasswordSet", False)),
        }
    
    async def get_employees_by_org(
        self,
        organization_id: str,
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> dict:
        """Get employees by organization with pagination."""
        employee_collection = self.get_employee_collection(organization_id)
        skip = (page - 1) * limit
        query: dict = {"organizationId": organization_id}
        
        # Search filter
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"aaptorId": {"$regex": search, "$options": "i"}},
            ]
        
        # Status filter
        if status_filter:
            query["status"] = status_filter
        
        # Get employees and total count
        cursor = employee_collection.find(query).sort("createdAt", -1).skip(skip).limit(limit)
        employees = await cursor.to_list(length=limit)
        total = await employee_collection.count_documents(query)
        
        # Remove sensitive fields
        for emp in employees:
            emp.pop("passwordHash", None)
            emp.pop("tempPassword", None)
            emp.pop("resetPasswordToken", None)
        
        return {
            "employees": [EmployeeModel.to_dict(emp) for emp in employees],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": (total + limit - 1) // limit,
            },
        }
    
    async def update_employee(
        self,
        aaptor_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> dict:
        """Update employee."""
        result = await self.find_employee_organization(aaptor_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        org_id, _ = result
        employee_collection = self.get_employee_collection(org_id)
        
        update_data = {"updatedAt": datetime.utcnow()}
        
        if name:
            update_data["name"] = name
        if email:
            # Check for duplicate email within the same organization
            existing = await employee_collection.find_one({
                "email": email.lower().strip(),
                "aaptorId": {"$ne": aaptor_id},
            })
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already exists"
                )
            update_data["email"] = email.lower().strip()
        if status_filter:
            update_data["status"] = status_filter
        
        result = await employee_collection.find_one_and_update(
            {"aaptorId": aaptor_id},
            {"$set": update_data},
            return_document=True,
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        # Remove sensitive fields
        result.pop("passwordHash", None)
        result.pop("tempPassword", None)
        result.pop("resetPasswordToken", None)
        
        return EmployeeModel.to_dict(result)
    
    async def delete_employee(self, aaptor_id: str) -> dict:
        """Delete employee."""
        result = await self.find_employee_organization(aaptor_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        org_id, _ = result
        employee_collection = self.get_employee_collection(org_id)
        
        result = await employee_collection.delete_one({"aaptorId": aaptor_id})
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        return {"success": True}
    
    async def resend_welcome_email(self, aaptor_id: str) -> dict:
        """Send welcome email with Aaptor ID and password."""
        result = await self.find_employee_organization(aaptor_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found"
            )
        
        org_id, employee = result
        employee_collection = self.get_employee_collection(org_id)
        
        # If password is already set, we still send email but with a message to use login
        # If password is not set, generate new temporary password
        if not employee.get("isPasswordSet"):
            # Generate new temporary password
            temp_password = self.generate_random_password()
            temp_password_expiry = datetime.utcnow() + timedelta(hours=24)
            
            # Update employee with new temp password
            await employee_collection.update_one(
                {"aaptorId": aaptor_id},
                {
                    "$set": {
                        "tempPassword": temp_password,
                        "tempPasswordExpiry": temp_password_expiry,
                        "updatedAt": datetime.utcnow(),
                    }
                }
            )
        else:
            # Password already set - use existing temp password if available, or generate new one for reference
            temp_password = employee.get("tempPassword") or self.generate_random_password()
        
        # Get organization name
        org = await self.org_collection.find_one({"orgId": employee["organizationId"]})
        org_name = org.get("name", "Your Organization") if org else "Your Organization"
        
        # Send email with Aaptor ID and password information
        setup_link = f"{self.settings.next_public_app_url}/auth/set-password?aaptorId={aaptor_id}"
        await send_welcome_email(
            email=employee["email"],
            name=employee["name"],
            aaptor_id=aaptor_id,
            temp_password=temp_password,
            organization_name=org_name,
            setup_link=setup_link,
        )
        
        return {"success": True}
    
    async def login(self, aaptor_id: str, email: str, password: str) -> dict:
        """Employee login."""
        result = await self.find_employee_organization(aaptor_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        org_id, employee = result
        employee_collection = self.get_employee_collection(org_id)
        
        # Verify email matches
        if employee.get("email", "").lower().strip() != email.lower().strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        if not employee.get("isPasswordSet"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please set your password first"
            )
        
        if employee.get("status") != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is not active"
            )
        
        # Verify password
        password_hash = employee.get("passwordHash")
        if not password_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        is_valid = bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Update last login
        await employee_collection.update_one(
            {"_id": employee["_id"]},
            {"$set": {"lastLogin": datetime.utcnow()}}
        )
        
        # Generate JWT token
        token = jwt.encode(
            {
                "employeeId": str(employee["_id"]),
                "aaptorId": employee["aaptorId"],
                "organizationId": employee["organizationId"],
                "email": employee.get("email", ""), 
                "type": "employee",
            },
            self.settings.jwt_secret,
            algorithm=self.settings.jwt_algorithm,
        )
        
        # Remove sensitive fields
        employee.pop("passwordHash", None)
        employee.pop("tempPassword", None)
        employee.pop("resetPasswordToken", None)
        
        return {
            "employee": EmployeeModel.to_dict(employee),
            "token": token,
        }

