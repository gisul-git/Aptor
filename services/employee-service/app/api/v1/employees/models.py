"""Employee and Organization MongoDB models."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from bson import ObjectId
from pymongo import IndexModel


class EmployeeModel:
    """Employee model for MongoDB."""
    
    @staticmethod
    def get_collection(db):
        """Get the employees collection with indexes."""
        collection = db.employees
        
        # Create indexes if they don't exist
        indexes = [
            IndexModel([("aaptorId", 1)], unique=True),
            IndexModel([("email", 1)], unique=True),
            IndexModel([("organizationId", 1), ("createdAt", -1)]),
            IndexModel([("email", 1), ("aaptorId", 1)]),
        ]
        collection.create_indexes(indexes)
        
        return collection
    
    @staticmethod
    def create_employee(data: dict) -> dict:
        """Create a new employee document."""
        now = datetime.utcnow()
        return {
            "aaptorId": data["aaptorId"],
            "organizationId": data["organizationId"],
            "name": data["name"],
            "email": data["email"].lower().strip(),
            "tempPassword": data.get("tempPassword"),
            "tempPasswordExpiry": data.get("tempPasswordExpiry"),
            "passwordHash": data.get("passwordHash"),
            "status": data.get("status", "pending"),
            "isPasswordSet": data.get("isPasswordSet", False),
            "lastLogin": data.get("lastLogin"),
            "createdBy": data.get("createdBy"),
            "resetPasswordToken": data.get("resetPasswordToken"),
            "resetPasswordExpiry": data.get("resetPasswordExpiry"),
            "createdAt": now,
            "updatedAt": now,
        }
    
    @staticmethod
    def to_dict(doc: dict) -> dict:
        """Convert MongoDB document to dict, converting ObjectId to string."""
        if doc is None:
            return None
        
        result = dict(doc)
        if "_id" in result:
            result["id"] = str(result["_id"])
            del result["_id"]
        
        # Convert ObjectId fields
        if "createdBy" in result and isinstance(result["createdBy"], ObjectId):
            result["createdBy"] = str(result["createdBy"])
        
        return result


class OrganizationModel:
    """Organization model for MongoDB."""
    
    @staticmethod
    def get_collection(db):
        """Get the organizations collection with indexes."""
        collection = db.organizations
        
        # Create indexes if they don't exist
        indexes = [
            IndexModel([("orgId", 1)], unique=True),
        ]
        collection.create_indexes(indexes)
        
        return collection
    
    @staticmethod
    def create_organization(data: dict) -> dict:
        """Create a new organization document."""
        now = datetime.utcnow()
        return {
            "orgId": data["orgId"],
            "name": data["name"],
            "employeeCounter": data.get("employeeCounter", 0),
            "createdAt": now,
            "updatedAt": now,
        }
    
    @staticmethod
    def to_dict(doc: dict) -> dict:
        """Convert MongoDB document to dict."""
        if doc is None:
            return None
        
        result = dict(doc)
        if "_id" in result:
            result["id"] = str(result["_id"])
            del result["_id"]
        
        return result

