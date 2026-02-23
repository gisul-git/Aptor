"""
Candidate API endpoints for custom MCQ assessments.
"""
from __future__ import annotations

import logging
import base64
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from ....db.mongo import get_db
from ....utils.mongo import to_object_id
from ....utils.responses import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/custom-mcq/candidate", tags=["candidate"])


class SaveReferenceFaceRequest(BaseModel):
    """Request to save reference face image."""
    assessmentId: str
    candidateEmail: str
    referenceImage: str  # Base64 encoded image


def validate_face_image(image_data: str) -> tuple[bool, str]:
    """Validate face image data."""
    if not image_data or not isinstance(image_data, str):
        return False, "Image data is required"
    
    # Check if it's a data URI
    if image_data.startswith("data:image"):
        # Extract base64 part
        base64_match = re.search(r'base64,(.+)', image_data)
        if not base64_match:
            return False, "Invalid data URI format"
        image_data = base64_match.group(1)
    
    # Validate base64
    try:
        decoded = base64.b64decode(image_data, validate=True)
        if len(decoded) < 1000:  # Too small
            return False, "Image data too small"
        if len(decoded) > 5 * 1024 * 1024:  # Too large (5MB)
            return False, "Image data too large (max 5MB)"
    except Exception as e:
        return False, f"Invalid base64 data: {str(e)}"
    
    return True, ""


def prepare_image_for_storage(image_data: str) -> str:
    """Prepare image for storage by extracting base64 part."""
    if image_data.startswith("data:image"):
        # Extract base64 part
        base64_match = re.search(r'base64,(.+)', image_data)
        if base64_match:
            return base64_match.group(1)
    return image_data



@router.get("/get-reference-photo")
async def get_reference_photo(
    assessmentId: str = Query(..., description="Assessment ID"),
    candidateEmail: str = Query(..., description="Candidate email"),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get reference photo for a candidate.
    Lightweight endpoint that only returns the reference photo, not the entire assessment.
    Checks all assessment collections (assessments, custom_mcq_assessments, dsa_tests, aiml_tests).
    """
    try:
        logger.info(f"[Candidate API] 🔍 Getting reference photo - assessmentId: {assessmentId}, candidateEmail: {candidateEmail}")
        assessment_id = to_object_id(assessmentId)
        assessment = None
        collection_found = None
        
        # Try to find assessment in different collections (all in same database)
        # 1. Regular assessments (AI flow)
        assessment = await db.assessments.find_one({"_id": assessment_id})
        if assessment:
            collection_found = "assessments"
            logger.info(f"[Candidate API] ✅ Assessment found in 'assessments' collection")
        
        # 2. Custom MCQ assessments
        if not assessment:
            assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_id})
            if assessment:
                collection_found = "custom_mcq_assessments"
                logger.info(f"[Candidate API] ✅ Assessment found in 'custom_mcq_assessments' collection")
        
        # 3. DSA tests (in same database, tests collection)
        # Check for DSA tests: test_type is "dsa" OR None OR doesn't exist
        if not assessment:
            # First try with explicit test_type filter
            assessment = await db.tests.find_one({
                "_id": assessment_id,
                "$or": [
                    {"test_type": "dsa"},
                    {"test_type": None},
                    {"test_type": {"$exists": False}}
                ]
            })
            if assessment:
                collection_found = "tests (dsa)"
                logger.info(f"[Candidate API] ✅ Assessment found in 'tests' collection (DSA)")
            # Fallback: if not found, try without test_type filter (for backward compatibility)
            if not assessment:
                temp_assessment = await db.tests.find_one({"_id": assessment_id})
                if temp_assessment and temp_assessment.get("test_type") != "aiml":
                    assessment = temp_assessment
                    collection_found = "tests (legacy)"
                    logger.info(f"[Candidate API] ✅ Assessment found in 'tests' collection (legacy)")
        
        # 4. AIML tests (in same database, tests collection with test_type: "aiml")
        if not assessment:
            assessment = await db.tests.find_one({"_id": assessment_id, "test_type": "aiml"})
            if assessment:
                collection_found = "tests (aiml)"
                logger.info(f"[Candidate API] ✅ Assessment found in 'tests' collection (AIML)")
        
        if not assessment:
            logger.warning(f"[Candidate API] ❌ Assessment {assessmentId} not found in any collection")
            return success_response("No reference photo found", {"referenceImage": None})
        
        logger.info(f"[Candidate API] 📋 Assessment found in collection: {collection_found}")
        
        # Get candidateResponses
        candidate_responses = assessment.get("candidateResponses", {})
        email_lower = candidateEmail.lower().strip()
        candidate_key_found = None
        
        logger.info(f"[Candidate API] 🔍 Searching for candidate email: {email_lower}")
        logger.info(f"[Candidate API] 📊 candidateResponses keys count: {len(candidate_responses)}")
        if candidate_responses:
            logger.info(f"[Candidate API] 📋 candidateResponses keys: {list(candidate_responses.keys())[:10]}")  # Log first 10 keys
        
        # Find the candidate key (email might be in different format)
        if candidate_responses:
            for key in candidate_responses.keys():
                if email_lower in key.lower():
                    candidate_key_found = key
                    logger.info(f"[Candidate API] ✅ Found candidate key: {key} (matched email: {email_lower})")
                    break
        
        # If candidate not found in this test OR candidateResponses is empty, search across all tests
        if not candidate_key_found:
            # Candidate not found in this specific test - search across all tests
            logger.info(f"[Candidate API] ⚠️ Candidate {candidateEmail} not found in test {assessmentId}, searching across all DSA/AIML tests...")
            
            # Search all DSA and AIML tests
            all_tests = []
            
            # Get DSA tests (search all, filter in Python for better coverage)
            dsa_cursor = db.tests.find({
                "$or": [
                    {"test_type": "dsa"},
                    {"test_type": None},
                    {"test_type": {"$exists": False}}
                ]
            }).limit(200)  # Get more tests to search through
            dsa_tests = await dsa_cursor.to_list(length=200)
            # Filter to only tests with candidateResponses
            dsa_tests = [t for t in dsa_tests if t.get("candidateResponses")]
            logger.info(f"[Candidate API] Found {len(dsa_tests)} DSA tests with candidateResponses")
            all_tests.extend(dsa_tests)
            
            # Get AIML tests
            aiml_cursor = db.tests.find({
                "test_type": "aiml"
            }).limit(200)  # Get more tests to search through
            aiml_tests = await aiml_cursor.to_list(length=200)
            # Filter to only tests with candidateResponses
            aiml_tests = [t for t in aiml_tests if t.get("candidateResponses")]
            logger.info(f"[Candidate API] Found {len(aiml_tests)} AIML tests with candidateResponses")
            all_tests.extend(aiml_tests)
            
            logger.info(f"[Candidate API] Searching across {len(all_tests)} total tests for candidate {candidateEmail}")
            
            # Search across all tests
            for test in all_tests:
                # Skip the test we already checked
                if test["_id"] == assessment_id:
                    continue
                    
                test_responses = test.get("candidateResponses", {})
                if not test_responses:
                    continue
                
                # Find candidate by email
                test_candidate_key = None
                for key in test_responses.keys():
                    if email_lower in key.lower():
                        test_candidate_key = key
                        break
                
                if test_candidate_key:
                    test_candidate_data = test_responses.get(test_candidate_key, {})
                    test_candidate_verification = test_candidate_data.get("candidateVerification", {})
                    test_reference_image = test_candidate_verification.get("referenceImage")
                    
                    if test_reference_image and isinstance(test_reference_image, str) and len(test_reference_image) >= 50:
                        # Found it in a different test - return it
                        logger.info(f"[Candidate API] ✅ Reference photo found for {candidateEmail} in test {test['_id']} (requested test: {assessmentId})")
                        if not test_reference_image.startswith("data:image"):
                            test_reference_image = f"data:image/jpeg;base64,{test_reference_image}"
                        return success_response("Reference photo found", {"referenceImage": test_reference_image})
            
            # Not found in any test
            logger.warning(f"[Candidate API] ❌ Reference photo not found for {candidateEmail} in any of {len(all_tests)} tests searched")
            return success_response("No reference photo found", {"referenceImage": None})
        
        # Get reference image
        logger.info(f"[Candidate API] 🔍 Checking candidate data for key: {candidate_key_found}")
        candidate_data = candidate_responses.get(candidate_key_found, {})
        logger.info(f"[Candidate API] 📊 candidate_data keys: {list(candidate_data.keys())}")
        
        candidate_verification = candidate_data.get("candidateVerification", {})
        logger.info(f"[Candidate API] 📊 candidateVerification keys: {list(candidate_verification.keys())}")
        logger.info(f"[Candidate API] 📊 candidateVerification has referenceImage: {'referenceImage' in candidate_verification}")
        
        reference_image = candidate_verification.get("referenceImage")
        logger.info(f"[Candidate API] 📊 reference_image type: {type(reference_image)}, length: {len(reference_image) if isinstance(reference_image, str) else 'N/A'}")
        
        if not reference_image or not isinstance(reference_image, str) or len(reference_image) < 50:
            logger.warning(f"[Candidate API] ❌ Reference image not found or invalid - exists: {reference_image is not None}, is_string: {isinstance(reference_image, str)}, length: {len(reference_image) if isinstance(reference_image, str) else 'N/A'}")
            return success_response("No reference photo found", {"referenceImage": None})
        
        # Ensure it has data URI prefix
        if not reference_image.startswith("data:image"):
            reference_image = f"data:image/jpeg;base64,{reference_image}"
        
        logger.info(f"[Candidate API] ✅ Reference photo found and returned successfully")
        return success_response("Reference photo fetched successfully", {
            "referenceImage": reference_image
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting reference photo: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get reference photo: {str(e)}"
        )


@router.post("/save-reference-face")
async def save_reference_face(
    request: SaveReferenceFaceRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Save reference face image from identity verification.
    Stores the image in candidateVerification.referenceImage field.
    """
    try:
        assessment_id = to_object_id(request.assessmentId)
        assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_id})
        
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        # Store reference image in candidateResponses
        candidate_responses = assessment.get("candidateResponses", {})
        candidate_key_found = None
        
        # Find the candidate key (email might be in different format)
        for key in candidate_responses.keys():
            if request.candidateEmail.lower() in key.lower():
                candidate_key_found = key
                break
        
        if not candidate_key_found:
            # Create new candidate entry
            candidate_key_found = f"{request.candidateEmail.lower()}_unknown"
        
        if "candidateResponses" not in assessment:
            assessment["candidateResponses"] = {}
        
        if candidate_key_found not in assessment["candidateResponses"]:
            assessment["candidateResponses"][candidate_key_found] = {}
        
        # Validate and prepare image for storage
        is_valid, error_msg = validate_face_image(request.referenceImage)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid face image: {error_msg}"
            )
        
        # Prepare image (compress and sanitize)
        processed_image = prepare_image_for_storage(request.referenceImage)
        if not processed_image:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process image for storage"
            )
        
        # Store reference image in candidateVerification
        if "candidateVerification" not in assessment["candidateResponses"][candidate_key_found]:
            assessment["candidateResponses"][candidate_key_found]["candidateVerification"] = {}
        
        assessment["candidateResponses"][candidate_key_found]["candidateVerification"]["referenceImage"] = processed_image
        assessment["candidateResponses"][candidate_key_found]["candidateVerification"]["referenceImageSavedAt"] = datetime.now(timezone.utc).isoformat()
        
        # Log the event
        if "logs" not in assessment["candidateResponses"][candidate_key_found]:
            assessment["candidateResponses"][candidate_key_found]["logs"] = []
        
        assessment["candidateResponses"][candidate_key_found]["logs"].append({
            "eventType": "REFERENCE_PHOTO_CAPTURED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "email": request.candidateEmail,
            }
        })
        
        # Update the assessment
        await db.custom_mcq_assessments.update_one(
            {"_id": assessment_id},
            {"$set": {"candidateResponses": assessment["candidateResponses"]}}
        )
        
        logger.info(f"[Candidate API] Reference face saved for {request.candidateEmail} in assessment {request.assessmentId}")
        
        return success_response({
            "message": "Reference face image saved successfully"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error saving reference face: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save reference face: {str(e)}"
        )


@router.get("/employee-tests")
async def get_employee_tests(
    email: str = Query(..., description="Employee email used for Custom MCQ invitations"),
    organizationId: str = Query(None, description="Organization ID for filtering"),
    aaptorId: str = Query(None, description="Aaptor ID for verification"),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Return list of Custom MCQ assessments this email has been invited to, filtered by organization.

    SECURITY:
    - If organizationId is provided, only returns assessments from that organization
    - Verifies employee is in candidates list
    - Ensures organization isolation
    """
    from bson import ObjectId
    
    email_lower = email.strip().lower()
    if not email_lower:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required")

    # Build query
    query = {"candidates.email": email_lower}
    
    # SECURITY: Add organization filter if provided
    if organizationId:
        try:
            query["organization"] = ObjectId(organizationId)
        except Exception:
            logger.warning(f"Invalid organizationId format: {organizationId}")

    # Query custom_mcq_assessments collection
    cursor = db.custom_mcq_assessments.find(query).limit(200)
    assessments = await cursor.to_list(length=200)

    results = []
    for assessment in assessments:
        candidates = assessment.get("candidates", []) or []
        invited = next(
            (c for c in candidates if (c.get("email", "").strip().lower() == email_lower)),
            None,
        )
        
        # SECURITY: Skip if employee is not in candidates list
        if not invited:
            continue
        
        # SECURITY: Double-check organization match if provided
        if organizationId:
            assessment_org = assessment.get("organization")
            if assessment_org:
                assessment_org_str = str(assessment_org) if isinstance(assessment_org, ObjectId) else str(assessment_org)
                if assessment_org_str != organizationId:
                    continue  # Skip if organization doesn't match
        
        invite_sent_at = invited.get("inviteSentAt") if invited else None
        status_val = assessment.get("status", "draft")

        results.append({
            "assessmentId": str(assessment.get("_id")),
            "title": assessment.get("title") or "Untitled Custom MCQ",
            "type": "custom_mcq",
            "status": status_val,
            "inviteSentAt": invite_sent_at,
            "organizationId": str(assessment.get("organization", "")) if assessment.get("organization") else None,
        })

    return success_response(
        "Custom MCQ tests fetched successfully",
        {"tests": results},
    )