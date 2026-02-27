"""Demo requests endpoints for Super Admin."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from ....db.mongo import get_db, get_client
from ....utils.responses import success_response, error_response
from ....utils.mongo import serialize_document
from .dependencies import require_super_admin
from .email_service import send_acceptance_email

logger = logging.getLogger(__name__)

router = APIRouter(tags=["super-admin-demo-requests"])


@router.get("/demo-requests")
async def get_all_demo_requests(
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
    status: str | None = None,
    limit: int = 50,
    skip: int = 0,
):
    """Get all demo requests."""
    try:
        client = get_client()
        demo_db = client["demo_db"]
        demo_requests_collection = demo_db["demorequests"]
        
        # Build query
        query: dict[str, Any] = {}
        if status:
            query["status"] = status
        
        # Fetch requests
        cursor = demo_requests_collection.find(query).sort("createdAt", -1).skip(skip).limit(limit)
        requests = []
        async for doc in cursor:
            # Convert ObjectId to string
            doc["_id"] = str(doc["_id"])
            # Convert datetime objects to ISO format strings
            if "createdAt" in doc:
                doc["createdAt"] = doc["createdAt"].isoformat() if hasattr(doc["createdAt"], "isoformat") else str(doc["createdAt"])
            if "updatedAt" in doc:
                doc["updatedAt"] = doc["updatedAt"].isoformat() if hasattr(doc["updatedAt"], "isoformat") else str(doc["updatedAt"])
            requests.append(doc)
        
        # Get total count
        total = await demo_requests_collection.count_documents(query)
        
        return success_response(
            "Demo requests fetched successfully",
            {
                "requests": requests,
                "total": total,
                "limit": limit,
                "skip": skip,
            },
        )
    except Exception as e:
        logger.error(f"Error fetching demo requests: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch demo requests",
        ) from e


@router.post("/demo-requests/{request_id}/accept")
async def accept_demo_request(
    request_id: str,
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Accept a demo request and send email to requester."""
    try:
        client = get_client()
        demo_db = client["demo_db"]
        demo_requests_collection = demo_db["demorequests"]
        
        # Validate ObjectId
        try:
            object_id = ObjectId(request_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request ID format",
            )
        
        # Find the request
        request_doc = await demo_requests_collection.find_one({"_id": object_id})
        if not request_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Demo request not found",
            )
        
        # Check if already processed
        if request_doc.get("status") in ["completed", "cancelled"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Demo request is already {request_doc.get('status')}",
            )
        
        # Update status to 'completed'
        await demo_requests_collection.update_one(
            {"_id": object_id},
            {"$set": {"status": "completed"}},
        )
        
        # Send acceptance email
        try:
            email_sent = await send_acceptance_email(request_doc)
            if not email_sent:
                logger.warning(f"Failed to send acceptance email for request {request_id}")
        except Exception as e:
            logger.error(f"Error sending acceptance email: {e}")
            # Don't fail the request if email fails
        
        # Fetch updated request
        updated_request = await demo_requests_collection.find_one({"_id": object_id})
        updated_request["_id"] = str(updated_request["_id"])
        if "createdAt" in updated_request:
            updated_request["createdAt"] = updated_request["createdAt"].isoformat() if hasattr(updated_request["createdAt"], "isoformat") else str(updated_request["createdAt"])
        if "updatedAt" in updated_request:
            updated_request["updatedAt"] = updated_request["updatedAt"].isoformat() if hasattr(updated_request["updatedAt"], "isoformat") else str(updated_request["updatedAt"])
        
        return success_response(
            "Demo request accepted successfully",
            updated_request,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accepting demo request: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to accept demo request",
        ) from e


@router.post("/demo-requests/{request_id}/deny")
async def deny_demo_request(
    request_id: str,
    current_user: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Deny a demo request."""
    try:
        client = get_client()
        demo_db = client["demo_db"]
        demo_requests_collection = demo_db["demorequests"]
        
        # Validate ObjectId
        try:
            object_id = ObjectId(request_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request ID format",
            )
        
        # Find the request
        request_doc = await demo_requests_collection.find_one({"_id": object_id})
        if not request_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Demo request not found",
            )
        
        # Check if already processed
        if request_doc.get("status") in ["completed", "cancelled"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Demo request is already {request_doc.get('status')}",
            )
        
        # Update status to 'cancelled'
        await demo_requests_collection.update_one(
            {"_id": object_id},
            {"$set": {"status": "cancelled"}},
        )
        
        # Fetch updated request
        updated_request = await demo_requests_collection.find_one({"_id": object_id})
        updated_request["_id"] = str(updated_request["_id"])
        if "createdAt" in updated_request:
            updated_request["createdAt"] = updated_request["createdAt"].isoformat() if hasattr(updated_request["createdAt"], "isoformat") else str(updated_request["createdAt"])
        if "updatedAt" in updated_request:
            updated_request["updatedAt"] = updated_request["updatedAt"].isoformat() if hasattr(updated_request["updatedAt"], "isoformat") else str(updated_request["updatedAt"])
        
        return success_response(
            "Demo request denied successfully",
            updated_request,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error denying demo request: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deny demo request",
        ) from e

