from fastapi import APIRouter, HTTPException, Query, Body, UploadFile, File, Depends, status, BackgroundTasks
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime, timedelta
import re
import secrets
import csv
import io
import logging
import urllib.parse
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pydantic import BaseModel
from ..database import get_dsa_database as get_database
from ..models.test import TestCreate, Test, TestSubmission, TestInviteRequest, AddCandidateRequest, CandidateLinkResponse
from ..services.ai_feedback import generate_code_feedback, is_starter_code_only
from ..utils.judge0 import run_all_test_cases, LANGUAGE_IDS
from ..routers.assessment import (
    prepare_code_for_execution,
    format_public_result,
    format_hidden_result_for_admin,
)
from app.core.dependencies import get_current_user, require_editor
from app.utils.email import get_email_service
from app.config.settings import get_settings
from app.utils.face_image_storage import validate_face_image, prepare_image_for_storage

logger = logging.getLogger("backend")

router = APIRouter(tags=["dsa"])

# Debug: Log when router is initialized
logger.info("[DSA Tests Router] Router initialized")

def normalize_proctoring_settings(proctoring_settings: Optional[Dict[str, Any]]) -> Dict[str, bool]:
    """
    Normalize proctoringSettings to ensure boolean values are always explicit.
    Returns a dict with aiProctoringEnabled, faceMismatchEnabled, and liveProctoringEnabled as explicit booleans.
    """
    if not proctoring_settings:
        return {
            "aiProctoringEnabled": False,
            "faceMismatchEnabled": False,
            "liveProctoringEnabled": False,
        }
    
    return {
        "aiProctoringEnabled": bool(proctoring_settings.get("aiProctoringEnabled", False)),
        "faceMismatchEnabled": bool(proctoring_settings.get("faceMismatchEnabled", False)),
        "liveProctoringEnabled": bool(proctoring_settings.get("liveProctoringEnabled", False)),
    }


class SaveReferenceFaceRequest(BaseModel):
    """Request model for saving reference face image."""
    assessmentId: str
    candidateEmail: str
    referenceImage: str  # Base64 encoded image


class EmployeeTestSummary(BaseModel):
    """Summary of DSA tests assigned to an employee (by email)."""
    test_id: str
    title: str
    status: Optional[str] = None
    invited_at: Optional[datetime] = None


@router.get("/employee-tests", response_model=Dict[str, Any])
async def get_employee_tests(
    email: str = Query(..., description="Employee email used for DSA invitations"),
    organizationId: Optional[str] = Query(None, description="Organization ID for filtering"),
    aaptorId: Optional[str] = Query(None, description="Aaptor ID for verification"),
):
    """
    Return list of DSA tests this email has been invited to, filtered by organization.

    SECURITY:
    - If organizationId is provided, only returns tests from that organization
    - Verifies employee is in test_candidates collection
    - Ensures organization isolation

    Uses the test_candidates collection (primary source of invitations).
    """
    email_lower = email.strip().lower()
    if not email_lower:
        raise HTTPException(status_code=400, detail="Email is required")

    db = get_database()

    # Find candidate records for this email
    candidates_cursor = db.test_candidates.find({"email": email_lower}).limit(200)
    candidates = await candidates_cursor.to_list(length=200)

    if not candidates:
        return {
            "message": "No DSA tests found for this employee",
            "data": {"tests": []},
        }

    # Get unique test IDs
    test_ids = {c.get("test_id") for c in candidates if c.get("test_id")}
    
    # Build query for tests
    tests_query = {"_id": {"$in": [ObjectId(tid) for tid in test_ids if ObjectId.is_valid(tid)]}}
    
    # SECURITY: Add organization filter if provided
    if organizationId:
        try:
            tests_query["organization"] = ObjectId(organizationId)
        except Exception:
            logger.warning(f"Invalid organizationId format: {organizationId}")
            # Continue without org filter but log warning
    
    tests_cursor = db.tests.find(tests_query)
    tests = await tests_cursor.to_list(length=200)

    tests_by_id: Dict[str, Dict[str, Any]] = {str(t["_id"]): t for t in tests}

    results: List[Dict[str, Any]] = []
    for candidate in candidates:
        tid = candidate.get("test_id")
        if not tid or tid not in tests_by_id:
            continue
        test = tests_by_id[tid]
        
        # SECURITY: Double-check organization match if provided
        if organizationId:
            test_org = test.get("organization")
            if test_org:
                test_org_str = str(test_org) if isinstance(test_org, ObjectId) else str(test_org)
                if test_org_str != organizationId:
                    continue  # Skip if organization doesn't match
        
        # Only include published tests
        if not test.get("is_published", False):
            continue

        status_val = candidate.get("status") or ("invited" if candidate.get("invited") else "pending")
        invited_at = candidate.get("invited_at")

        results.append({
            "assessmentId": tid,
            "title": test.get("title") or "Untitled DSA Test",
            "type": "dsa",
            "status": status_val,
            "inviteSentAt": invited_at.isoformat() if invited_at and isinstance(invited_at, datetime) else (invited_at if invited_at else None),
            "organizationId": str(test.get("organization", "")) if test.get("organization") else None,
        })

    return {
        "message": "DSA tests fetched successfully",
        "data": {"tests": results},
    }

@router.get("/debug/routes", response_model=dict)
async def debug_routes():
    """Debug endpoint to list all registered routes."""
    routes = []
    for route in router.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods) if route.methods else [],
                "name": getattr(route, 'name', 'N/A')
            })
    return {"routes": routes, "total": len(routes)}

@router.get("/debug/user-info", response_model=dict)
async def debug_user_info(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Debug endpoint to verify authentication and user ID extraction
    """
    db = get_database()
    user_id = current_user.get("id") or current_user.get("_id")
    user_id_str = str(user_id).strip() if user_id else None
    
    # Check how many tests exist for this user
    user_tests_count = 0
    all_tests_count = 0
    tests_without_created_by = 0
    
    if user_id_str:
        # Count tests for this user
        user_tests_count = await db.tests.count_documents({"created_by": user_id_str})
        
        # Count all tests
        all_tests_count = await db.tests.count_documents({})
        
        # Count tests without created_by
        tests_without_created_by = await db.tests.count_documents({"created_by": {"$exists": False}})
        
        # Get a sample of all tests to see created_by values
        sample_tests = await db.tests.find({}).limit(5).to_list(length=5)
        sample_created_by_values = [{"id": str(t.get("_id")), "created_by": t.get("created_by"), "title": t.get("title", "Unknown")} for t in sample_tests]
    
    return {
        "user_id": user_id_str,
        "user_id_type": type(user_id).__name__ if user_id else None,
        "current_user_keys": list(current_user.keys()),
        "current_user_id": current_user.get("id"),
        "current_user__id": current_user.get("_id"),
        "current_user_email": current_user.get("email"),
        "database_stats": {
            "user_tests_count": user_tests_count,
            "all_tests_count": all_tests_count,
            "tests_without_created_by": tests_without_created_by,
            "sample_tests": sample_created_by_values if user_id_str else []
        },
        "message": "Authentication working correctly"
    }

@router.post("/", response_model=dict)
async def create_test(
    test: TestCreate,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Create a new test (requires authentication)
    Validates that all question_ids belong to the current user
    """
    db = get_database()
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"[create_test] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()  # Ensure no whitespace and consistent format
    
    logger.info(f"[create_test] User ID extracted: '{user_id}' (type: {type(user_id).__name__})")
    
    # Validate that all questions belong to the current user
    if test.question_ids:
        question_ids = [ObjectId(qid) if ObjectId.is_valid(qid) else None for qid in test.question_ids]
        question_ids = [qid for qid in question_ids if qid is not None]
        
        if question_ids:
            questions = await db.questions.find({"_id": {"$in": question_ids}}).to_list(length=len(question_ids))
            # Check if all questions exist and belong to the user
            found_question_ids = {str(q["_id"]) for q in questions}
            requested_question_ids = {str(qid) for qid in question_ids}
            
            if found_question_ids != requested_question_ids:
                raise HTTPException(status_code=400, detail="Some questions not found")
            
            # Verify ownership - normalize both sides for comparison
            for question in questions:
                q_created_by = question.get("created_by")
                if not q_created_by or str(q_created_by).strip() != user_id.strip():
                    raise HTTPException(status_code=403, detail=f"Question {question.get('title', 'Unknown')} does not belong to you")
    
    # -------------------------------
    # Exam window configuration (mirrors Custom MCQ)
    # -------------------------------
    def _coalesce(*vals):
        for v in vals:
            if v is not None:
                return v
        return None

    exam_mode = getattr(test, "examMode", None) or "strict"
    # Support both nested schedule and top-level startTime/endTime/duration
    schedule_obj = getattr(test, "schedule", None)
    start_dt = _coalesce(
        getattr(schedule_obj, "startTime", None) if schedule_obj else None,
        getattr(test, "startTime", None),
        getattr(test, "start_time", None),
    )
    end_dt = _coalesce(
        getattr(schedule_obj, "endTime", None) if schedule_obj else None,
        getattr(test, "endTime", None),
        getattr(test, "end_time", None),
    )
    duration_minutes = _coalesce(
        getattr(schedule_obj, "duration", None) if schedule_obj else None,
        getattr(test, "duration", None),
        getattr(test, "duration_minutes", None),
    )

    # Validate exam window rules
    if exam_mode not in ("strict", "flexible"):
        raise HTTPException(status_code=400, detail="Invalid examMode. Must be 'strict' or 'flexible'.")
    
    if not start_dt:
        raise HTTPException(status_code=400, detail="Start time is required.")
    
    # For Fixed Window (strict): end_time is optional, will be auto-calculated
    # For Flexible Window: end_time is required
    if exam_mode == "flexible":
        if not end_dt:
            raise HTTPException(status_code=400, detail="End time is required for flexible exam mode.")
        if start_dt >= end_dt:
            raise HTTPException(status_code=400, detail="End time must be after start time.")
        if not duration_minutes or int(duration_minutes) <= 0:
            raise HTTPException(status_code=400, detail="Duration is required for flexible exam mode.")

    # Extract candidateRequirements from schedule if provided
    candidate_requirements = {}
    if schedule_obj:
        if hasattr(schedule_obj, "candidateRequirements") and schedule_obj.candidateRequirements is not None:
            # Pydantic model with candidateRequirements field
            candidate_requirements = schedule_obj.candidateRequirements if isinstance(schedule_obj.candidateRequirements, dict) else {}
        elif isinstance(schedule_obj, dict):
            # Plain dict
            candidate_requirements = schedule_obj.get("candidateRequirements", {}) or {}
    
    # Extract proctoringSettings from schedule or top-level test object
    proctoring_settings = None
    if schedule_obj:
        if hasattr(schedule_obj, "proctoringSettings") and schedule_obj.proctoringSettings is not None:
            proctoring_settings = schedule_obj.proctoringSettings
        elif isinstance(schedule_obj, dict):
            proctoring_settings = schedule_obj.get("proctoringSettings")
    
    # If not in schedule, check top-level test object
    if not proctoring_settings:
        if hasattr(test, "proctoringSettings") and test.proctoringSettings is not None:
            proctoring_settings = test.proctoringSettings
        elif isinstance(test, dict):
            proctoring_settings = test.get("proctoringSettings")
    
    # Convert Pydantic model to dict if needed
    if proctoring_settings and hasattr(proctoring_settings, "model_dump"):
        proctoring_settings = proctoring_settings.model_dump()
    elif proctoring_settings and not isinstance(proctoring_settings, dict):
        try:
            proctoring_settings = dict(proctoring_settings) if proctoring_settings else None
        except:
            proctoring_settings = None
    
    logger.info(f"[create_test] Extracted candidateRequirements: {candidate_requirements}")
    logger.info(f"[create_test] Extracted proctoringSettings: {proctoring_settings}")
    logger.info(f"[create_test] Schedule object type: {type(schedule_obj)}")
    if schedule_obj:
        logger.info(f"[create_test] Schedule object has candidateRequirements attr: {hasattr(schedule_obj, 'candidateRequirements')}")
        if hasattr(schedule_obj, "candidateRequirements"):
            logger.info(f"[create_test] Schedule object candidateRequirements value: {schedule_obj.candidateRequirements}")
    
    # Build schedule payload (will be updated below for strict mode after calculating total_duration)
    schedule_payload = {
        "startTime": start_dt,
        "endTime": end_dt if exam_mode == "flexible" else None,  # Will be calculated for strict mode
        "duration": int(duration_minutes) if (exam_mode == "flexible" and duration_minutes is not None) else None,
        "candidateRequirements": candidate_requirements,  # Store candidate requirements
        "proctoringSettings": proctoring_settings,  # Store proctoring settings in schedule
    }
    
    logger.info(f"[create_test] Schedule payload with candidateRequirements: {schedule_payload}")

    test_dict = test.model_dump()
    test_dict["examMode"] = exam_mode
    # schedule_payload will be updated below for strict mode after calculating total_duration
    test_dict["schedule"] = schedule_payload
    # Ensure legacy fields are set (backward compatible)
    test_dict["start_time"] = start_dt
    # end_time will be set below for strict mode, or use provided end_dt for flexible
    if exam_mode == "flexible":
        test_dict["end_time"] = end_dt
    
    # -------------------------------
    # Timer configuration for DSA (GLOBAL / PER_QUESTION)
    # -------------------------------
    timer_mode = test_dict.get("timer_mode", "GLOBAL")
    if timer_mode not in ("GLOBAL", "PER_QUESTION"):
        raise HTTPException(status_code=400, detail="Invalid timer_mode. Must be 'GLOBAL' or 'PER_QUESTION'.")

    # Calculate total duration based on timer mode
    if timer_mode == "PER_QUESTION":
        qt = test_dict.get("question_timings") or []
        if not qt:
            raise HTTPException(status_code=400, detail="question_timings is required for PER_QUESTION timer_mode.")
        total_duration_minutes = sum(int(item.get("duration_minutes", 0) or 0) for item in qt)
        if total_duration_minutes < 1:
            raise HTTPException(status_code=400, detail="Total question timings must be at least 1 minute.")
        test_dict["duration_minutes"] = total_duration_minutes
        if exam_mode == "flexible":
            test_dict["schedule"]["duration"] = total_duration_minutes
    else:
        # GLOBAL timer
        if not duration_minutes or int(duration_minutes) <= 0:
            raise HTTPException(status_code=400, detail="Duration (minutes) is required when using a single timer for the entire test.")
        total_duration_minutes = int(duration_minutes)
        test_dict["duration_minutes"] = total_duration_minutes

    # -------------------------------
    # For FLEXIBLE WINDOW: Validate that window duration >= test duration
    # -------------------------------
    if exam_mode == "flexible":
        # Calculate window duration in minutes
        window_duration_minutes = int((end_dt - start_dt).total_seconds() / 60)
        if window_duration_minutes < total_duration_minutes:
            raise HTTPException(
                status_code=400, 
                detail=f"Flexible window duration ({window_duration_minutes} minutes) must be at least as long as the test duration ({total_duration_minutes} minutes)."
            )

    # -------------------------------
    # For FIXED WINDOW (strict): Auto-calculate end_time from start_time + total_duration
    # -------------------------------
    if exam_mode == "strict":
        # Auto-calculate end_time: start_time + total_duration_minutes
        from datetime import timedelta
        end_dt = start_dt + timedelta(minutes=total_duration_minutes)
        # Update schedule payload with calculated end_time
        schedule_payload["endTime"] = end_dt
        test_dict["schedule"] = schedule_payload
        test_dict["end_time"] = end_dt
    # Store the actual user ID who created the test - CRITICAL: Must be string, no whitespace
    # user_id is already normalized above
    test_dict["created_by"] = user_id

    # ------------------------------------------------------------------
    # ORGANIZATION: ensure every test is linked to the creator's org
    # ------------------------------------------------------------------
    # The employee dashboard and /employee-tests endpoint filter by
    # test.organization == employee.organizationId (via ObjectId).
    # To make tests visible to employees, we must ALWAYS persist the
    # creator's organization on the test document.
    from bson import ObjectId as _BsonObjectId  # local alias to avoid confusion

    org_id = None
    # 1) Try to read organization from the authenticated user payload (preferred path)
    logger.info(
        f"[create_test] Resolving organization for user_id={user_id}. "
        f"current_user keys={list(current_user.keys())}"
    )
    raw_org = (
        current_user.get("organizationId")
        or current_user.get("organization_id")
        or current_user.get("orgId")
        or current_user.get("org_id")  # some services may use org_id
        or current_user.get("organization")
    )
    logger.info(f"[create_test] raw_org from current_user={raw_org!r}")
    if raw_org:
        try:
            # If already an ObjectId-like value, this will normalize it; otherwise from string
            org_id = _BsonObjectId(str(raw_org))
            logger.info(f"[create_test] Using organization from current_user: {org_id}")
        except Exception:
            logger.warning(f"[create_test] Could not convert organization value '{raw_org}' to ObjectId")

    # 2) Fallback: look up creator in users collection to get organization
    if org_id is None:
        try:
            user_doc = await db.users.find_one({"_id": ObjectId(user_id)})  # type: ignore[arg-type]
            logger.info(
                f"[create_test] user_doc lookup for user_id={user_id}: "
                f"found={bool(user_doc)} "
                f"keys={list(user_doc.keys()) if user_doc else None}"
            )
            if user_doc:
                raw_org = (
                    user_doc.get("organization")
                    or user_doc.get("organizationId")
                    or user_doc.get("organization_id")
                    or user_doc.get("orgId")
                    or user_doc.get("org_id")  # support org_id on user documents as well
                )
                if raw_org:
                    try:
                        org_id = _BsonObjectId(str(raw_org))
                        logger.info(
                            f"[create_test] Using organization from user document for user_id={user_id}: {org_id}"
                        )
                    except Exception:
                        logger.warning(
                            f"[create_test] Could not convert organization value from user document '{raw_org}' to ObjectId"
                        )
            else:
                logger.warning(f"[create_test] No user document found for user_id={user_id} when resolving organization")
        except Exception as org_lookup_error:
            logger.error(
                f"[create_test] Error looking up organization for user_id={user_id} in users collection: {org_lookup_error}"
            )

    if org_id is not None:
        test_dict["organization"] = org_id
    else:
        # Log but do not block test creation; tests without organization
        # will not appear in employee dashboards filtered by org.
        logger.warning(
            f"[create_test] No organizationId resolved for user_id={user_id}. "
            f"DSA tests will not be visible via /employee-tests until organization is set."
        )
    test_dict["is_active"] = True
    test_dict["is_published"] = False  # Tests start as unpublished
    test_dict["invited_users"] = []  # Will be populated via add candidate
    test_dict["created_at"] = datetime.utcnow()  # Set creation timestamp
    test_dict["test_type"] = "dsa"  # Mark as DSA test to isolate from AIML tests
    
    # Normalize proctoringSettings BEFORE saving to ensure all three fields are always explicit
    # Use extracted proctoring_settings if available (which may include faceMismatchEnabled from frontend)
    # Otherwise use what's in test_dict from model_dump()
    if proctoring_settings is not None:
        # Normalize the extracted proctoring_settings (preserves faceMismatchEnabled if present)
        test_dict["proctoringSettings"] = normalize_proctoring_settings(proctoring_settings)
    elif "proctoringSettings" in test_dict:
        # If not extracted but exists in test_dict, normalize it
        test_dict["proctoringSettings"] = normalize_proctoring_settings(test_dict.get("proctoringSettings"))
    else:
        # If not provided, set defaults
        test_dict["proctoringSettings"] = normalize_proctoring_settings(None)
    
    # Also ensure proctoringSettings is in the schedule object (for frontend compatibility)
    if isinstance(test_dict.get("schedule"), dict):
        test_dict["schedule"]["proctoringSettings"] = test_dict["proctoringSettings"]
    elif test_dict.get("schedule") is None:
        # If schedule doesn't exist, create it with proctoringSettings
        test_dict["schedule"] = schedule_payload.copy()
        test_dict["schedule"]["proctoringSettings"] = test_dict["proctoringSettings"]
    
    # Debug: Log proctoringSettings being saved
    logger.info(f"[create_test] ProctoringSettings being saved (top-level): {test_dict.get('proctoringSettings')}")
    logger.info(f"[create_test] ProctoringSettings in schedule: {test_dict.get('schedule', {}).get('proctoringSettings')}")
    
    logger.info(f"[create_test] Creating test with created_by='{user_id}' (type: {type(user_id).__name__}), title={test_dict.get('title')}")
    logger.info(f"[create_test] Current user data: id={current_user.get('id')}, _id={current_user.get('_id')}, email={current_user.get('email')}")
    
    result = await db.tests.insert_one(test_dict)
    
    # Verify the test was created with correct created_by
    created_test_check = await db.tests.find_one({"_id": result.inserted_id})
    if created_test_check:
        actual_created_by = created_test_check.get("created_by")
        if actual_created_by != user_id:
            logger.error(f"[create_test] SECURITY ISSUE: Test created with created_by='{actual_created_by}' but expected '{user_id}'")
            logger.error(f"[create_test] Test ID: {result.inserted_id}, Title: {test_dict.get('title')}")
        else:
            logger.info(f"[create_test] Test created successfully with created_by='{actual_created_by}'")
    
    # Fetch the created test
    created_test = await db.tests.find_one({"_id": result.inserted_id})
    if created_test:
        # Debug: Log proctoringSettings from database
        logger.info(f"[create_test] ProctoringSettings from database: {created_test.get('proctoringSettings')}")
        
        # Convert ObjectId to string and ensure all fields are JSON serializable
        test_dict = {
            "id": str(created_test["_id"]),
            "title": created_test.get("title", ""),
            "description": created_test.get("description", ""),
            "duration_minutes": created_test.get("duration_minutes", 0),
            "start_time": created_test.get("start_time").isoformat() if created_test.get("start_time") else None,
            "end_time": created_test.get("end_time").isoformat() if created_test.get("end_time") else None,
            "examMode": created_test.get("examMode", "strict"),
            "schedule": created_test.get("schedule"),
            "is_active": created_test.get("is_active", False),
            "is_published": created_test.get("is_published", False),
            "invited_users": created_test.get("invited_users", []),
            "question_ids": [str(qid) if isinstance(qid, ObjectId) else qid for qid in created_test.get("question_ids", [])],
            "test_token": created_test.get("test_token"),
            # Normalize to ensure boolean values are explicit
            "proctoringSettings": normalize_proctoring_settings(created_test.get("proctoringSettings")),
        }
        logger.info(f"[create_test] ProctoringSettings in response: {test_dict.get('proctoringSettings')}")
        # Add created_at if it exists
        if "created_at" in created_test and created_test.get("created_at"):
            test_dict["created_at"] = created_test.get("created_at").isoformat() if isinstance(created_test.get("created_at"), datetime) else created_test.get("created_at")
        # Add updated_at if it exists
        if "updated_at" in created_test and created_test.get("updated_at"):
            test_dict["updated_at"] = created_test.get("updated_at").isoformat() if isinstance(created_test.get("updated_at"), datetime) else created_test.get("updated_at")
        return test_dict
    
    # Fallback if fetch fails
    test_dict["_id"] = str(result.inserted_id)
    test_dict["id"] = str(result.inserted_id)
    test_dict["start_time"] = test_dict["start_time"].isoformat() if isinstance(test_dict.get("start_time"), datetime) else test_dict.get("start_time")
    test_dict["end_time"] = test_dict["end_time"].isoformat() if isinstance(test_dict.get("end_time"), datetime) else test_dict.get("end_time")
    return test_dict

# Handle both with and without trailing slash to avoid 307 redirects
@router.get("", response_model=List[dict], include_in_schema=False)
async def get_tests_no_slash(
    active_only: bool = False,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Redirect handler for GET /api/dsa/tests (without trailing slash)"""
    return await get_tests(active_only, current_user)

def _convert_question_timings_to_limits(question_timings: List[Dict]) -> Dict[str, int]:
    """Convert question_timings array to question_time_limits dict for backward compatibility"""
    if not question_timings:
        return {}
    limits = {}
    for timing in question_timings:
        qid = timing.get("question_id")
        duration = timing.get("duration_minutes", 0)
        if qid:
            limits[str(qid)] = int(duration)
    return limits

@router.get("/", response_model=List[dict])
async def get_tests(
    active_only: bool = False,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get tests for the current user (requires authentication)
    Only returns tests created by the current user
    
    SECURITY: This endpoint MUST only return tests where created_by matches the authenticated user's ID
    """
    try:
        # CRITICAL SECURITY CHECK: Verify authentication
        if not current_user:
            logger.error("[get_tests] CRITICAL: current_user is None or empty - authentication failed")
            raise HTTPException(status_code=401, detail="Authentication required")
        
        db = get_database()
        
        # Check if user is super_admin - if so, get all super_admin user IDs
        if current_user.get("role") == "super_admin":
            try:
                # Import main database to query users collection
                # Note: tests.py is in dsa/routers/, so we need 5 dots to reach app/
                from ....db.mongo import get_database as get_main_database
                
                # Get main database connection
                main_db = get_main_database()
                
                # Get current user ID for logging purposes
                user_id = current_user.get("id") or current_user.get("_id")
                user_id = str(user_id).strip() if user_id else "super_admin"
                user_id_normalized = user_id  # Define for logging consistency
                
                # Query users collection to get all super_admin user IDs
                super_admin_cursor = main_db.users.find(
                    {"role": "super_admin"},
                    {"_id": 1}
                )
                super_admin_ids = [str(doc["_id"]) async for doc in super_admin_cursor]
            except Exception as e:
                logger.error(f"[get_tests] Failed to get main database for super_admin query: {e}")
                # Fall back to regular user query if main database is unavailable
                logger.warning("[get_tests] Falling back to regular user query for super_admin")
                # Set role to None to use regular path below
                current_user_role_backup = current_user.get("role")
                current_user["role"] = None  # Temporarily remove super_admin role to use regular path
                super_admin_ids = None  # Set to None to trigger else path
                # Define user_id_normalized for fallback case
                user_id = current_user.get("id") or current_user.get("_id")
                user_id = str(user_id).strip() if user_id else "super_admin"
                user_id_normalized = user_id
            
            if super_admin_ids:
                # Filter tests where created_by is in the list of super_admin IDs (as strings)
                user_id_normalized_list = [str(sid).strip() for sid in super_admin_ids]
                base_conditions = [
                    {"created_by": {"$exists": True}},
                    {"created_by": {"$ne": None}},
                    {"created_by": {"$ne": ""}},
                    {"created_by": {"$in": user_id_normalized_list}},  # Match any super_admin ID
                    # CRITICAL: Filter to only get DSA tests (exclude AIML tests)
                    {"$or": [
                        {"test_type": {"$exists": False}},
                        {"test_type": None},
                        {"test_type": "dsa"}
                    ]}
                ]
            else:
                # No super_admins found - return empty result
                base_conditions = [
                    {"created_by": {"$exists": True}},
                    {"created_by": {"$ne": None}},
                    {"created_by": {"$ne": ""}},
                    {"created_by": {"$in": []}}  # Empty list - no matches
                ]
            
            # Add test_type filter for super_admin path
            base_conditions.append({
                "$or": [
                    {"test_type": {"$exists": False}},  # Legacy DSA tests without test_type
                    {"test_type": None},                 # Tests with null test_type
                    {"test_type": "dsa"}                 # Explicitly marked DSA tests
                ]
            })
            
            if active_only:
                base_conditions.append({"is_active": True})
                base_conditions.append({"start_time": {"$lte": datetime.utcnow()}})
                base_conditions.append({"end_time": {"$gte": datetime.utcnow()}})
            
            query = {"$and": base_conditions}
            
            print(f"[get_tests] STRICT MongoDB query (super_admin): {query}")
            logger.info(f"[get_tests] STRICT MongoDB query (super_admin): {query}")
            
            # Execute query for super_admin
            tests = await db.tests.find(query).sort("created_at", -1).to_list(length=100)
            
            # Use user_id_normalized for logging (already defined above)
            logger.info(f"[get_tests] MongoDB returned {len(tests)} tests for super_admin user_id: '{user_id_normalized}'")
            
            # Skip the security filtering for super_admin (they can see all super_admin tests)
            # But still filter out AIML tests
            filtered_tests = []
            for test in tests:
                test_type = test.get("test_type")
                if test_type == "aiml":
                    logger.warning(f"[get_tests] Filtering out AIML test {str(test.get('_id'))} from super_admin results")
                    continue
                filtered_tests.append(test)
            tests = filtered_tests
            
            # Log results for super_admin
            logger.info(f"[get_tests] Final check: Returning {len(tests)} tests for super_admin user_id: '{user_id_normalized}'")
            
            # Log every test being returned for super_admin
            print(f"[get_tests] SECURITY VERIFICATION: Tests being returned for super_admin:")
            logger.info(f"[get_tests] SECURITY VERIFICATION: Tests being returned for super_admin:")
            for idx, test in enumerate(tests):
                test_info = f"[get_tests]   Test {idx+1}: ID={str(test.get('_id'))}, created_by='{test.get('created_by')}', title='{test.get('title', 'Unknown')}'"
                print(test_info)
                logger.info(test_info)
        else:
            # Filter tests by the current user - STRICT: only return tests with created_by matching current user
            user_id = current_user.get("id") or current_user.get("_id")
            if not user_id:
                logger.error(f"[get_tests] CRITICAL: Invalid user ID in current_user. Keys: {list(current_user.keys())}")
                logger.error(f"[get_tests] CRITICAL: current_user content: {current_user}")
                raise HTTPException(status_code=400, detail="Invalid user ID - authentication failed")
            user_id = str(user_id).strip()  # Ensure no whitespace
            
            # CRITICAL: Log the user_id being used for filtering
            # Using print() as well to ensure visibility in console
            print(f"[get_tests] SECURITY: Filtering tests for authenticated user_id: '{user_id}'")
            logger.info(f"[get_tests] SECURITY: Filtering tests for authenticated user_id: '{user_id}'")
            
            print(f"[get_tests] Fetching tests for user_id: '{user_id}' (type: {type(user_id).__name__})")
            logger.info(f"[get_tests] Fetching tests for user_id: '{user_id}' (type: {type(user_id).__name__})")
            print(f"[get_tests] Current user data: id={current_user.get('id')}, _id={current_user.get('_id')}, email={current_user.get('email')}")
            logger.info(f"[get_tests] Current user data: id={current_user.get('id')}, _id={current_user.get('_id')}, email={current_user.get('email')}")
            
            # ABSOLUTE SECURITY: Use explicit $and with $exists to ensure field exists
            # This is the STRICTEST possible query - will NEVER match documents without created_by
            # CRITICAL: Normalize user_id to string for comparison (handles ObjectId vs string)
            user_id_normalized = str(user_id).strip()
            
            # Build strict query - exact string match (we store created_by as string)
            base_conditions = [
                {"created_by": {"$exists": True}},
                {"created_by": {"$ne": None}},
                {"created_by": {"$ne": ""}},
                {"created_by": user_id_normalized}  # Exact string match
            ]
            
            base_conditions.append({
                "$or": [
                    {"test_type": {"$exists": False}},  # Legacy DSA tests without test_type
                    {"test_type": None},                 # Tests with null test_type
                    {"test_type": "dsa"}                 # Explicitly marked DSA tests
                ]
            })
            
            if active_only:
                base_conditions.append({"is_active": True})
                base_conditions.append({"start_time": {"$lte": datetime.utcnow()}})
                base_conditions.append({"end_time": {"$gte": datetime.utcnow()}})
            
            query = {"$and": base_conditions}
            
            print(f"[get_tests] STRICT MongoDB query: {query}")
            logger.info(f"[get_tests] STRICT MongoDB query: {query}")
            print(f"[get_tests] Query will ONLY match tests where created_by exists, is not null, is not empty, and equals '{user_id_normalized}'")
            logger.info(f"[get_tests] Query will ONLY match tests where created_by exists, is not null, is not empty, and equals '{user_id_normalized}'")
            print(f"[get_tests] User ID type: {type(user_id).__name__}, normalized: '{user_id_normalized}'")
            logger.info(f"[get_tests] User ID type: {type(user_id).__name__}, normalized: '{user_id_normalized}'")
            
            # DEBUG: Check what tests exist in database (for debugging)
            all_tests_sample = await db.tests.find({}).limit(5).to_list(length=5)
            logger.info(f"[get_tests] DEBUG: Sample of ALL tests in DB (first 5):")
            for t in all_tests_sample:
                logger.info(f"[get_tests] DEBUG: Test ID={str(t.get('_id'))}, created_by={t.get('created_by')}, title={t.get('title', 'Unknown')}")
            
            # Execute query with explicit security - CRITICAL: This query MUST filter by created_by
            logger.info(f"[get_tests] EXECUTING MongoDB query: {query}")
            logger.info(f"[get_tests] Query conditions: created_by must exist, not be None, not be empty, and equal '{user_id_normalized}'")
            
            # CRITICAL: Execute query - this MUST filter by created_by
            tests = await db.tests.find(query).sort("created_at", -1).to_list(length=100)
            
            print(f"[get_tests] MongoDB returned {len(tests)} tests for user_id: '{user_id_normalized}'")
            logger.info(f"[get_tests] MongoDB returned {len(tests)} tests for user_id: '{user_id_normalized}'")
            print(f"[get_tests] Query executed successfully. Filtering by created_by='{user_id_normalized}'")
            logger.info(f"[get_tests] Query executed successfully. Filtering by created_by='{user_id_normalized}'")
            
            # VERIFY: Log each test's created_by to ensure they all match
            for idx, test in enumerate(tests):
                test_created_by = test.get("created_by")
                logger.info(f"[get_tests] Test {idx+1}: ID={str(test.get('_id'))}, created_by='{test_created_by}', matches_user={str(test_created_by).strip() == user_id_normalized}")
            
            # CRITICAL SECURITY CHECK: Additional client-side filter as defense in depth
            # This is a FINAL safety net - filter out ANY test that doesn't match exactly
            tests_before_filter = len(tests)
            filtered_tests = []
            for test in tests:
                test_created_by = test.get("created_by")
                test_id = str(test.get("_id", ""))
                test_title = test.get("title", "Unknown")
                
                # ABSOLUTE STRICT CHECK: Reject if created_by is missing, null, empty, or doesn't match
                if test_created_by is None:
                    logger.error(f"[get_tests] SECURITY VIOLATION: Test {test_id} ({test_title}) has NULL created_by - REJECTING")
                    continue
                
                if test_created_by == "":
                    logger.error(f"[get_tests] SECURITY VIOLATION: Test {test_id} ({test_title}) has EMPTY created_by - REJECTING")
                    continue
                
                # Normalize both sides to string for comparison (handles ObjectId vs string mismatch)
                test_created_by_str = str(test_created_by).strip()
                # Use the already normalized user_id from above
                if test_created_by_str != user_id_normalized:
                    logger.error(f"[get_tests] SECURITY VIOLATION: Test {test_id} ({test_title}) created_by='{test_created_by_str}' != user_id='{user_id_normalized}' - REJECTING")
                    continue
                
                # CRITICAL: Reject AIML tests - they should be isolated
                test_type = test.get("test_type")
                if test_type == "aiml":
                    logger.warning(f"[get_tests] Filtering out AIML test {test_id} ({test_title}) from DSA results")
                    continue
                
                # Only add if it passes all checks
                filtered_tests.append(test)
            
            tests = filtered_tests
            
            if tests_before_filter != len(tests):
                logger.error(f"[get_tests] SECURITY: Filtered out {tests_before_filter - len(tests)} tests that didn't match user_id - this should not happen if query is correct")
            
            # Final verification log - CRITICAL: Verify ALL tests belong to this user
            logger.info(f"[get_tests] Final check: Returning {len(tests)} tests for user_id: '{user_id_normalized}'")
            
            # ABSOLUTE FINAL CHECK: Verify every single test belongs to this user (defense in depth)
            # Create a new list with only tests that match (safe iteration)
            final_tests = []
            security_violations = 0
            for test in tests:
                test_created_by_raw = test.get("created_by")
                test_created_by = str(test_created_by_raw).strip() if test_created_by_raw is not None else ""
                test_id = str(test.get("_id", ""))
                test_title = test.get("title", "Unknown")
                
                if test_created_by != user_id_normalized:
                    security_violations += 1
                    logger.error(f"[get_tests] CRITICAL SECURITY ERROR: Test {test_id} ({test_title}) has created_by='{test_created_by}' but user_id='{user_id_normalized}' - REJECTING")
                    logger.error(f"[get_tests] SECURITY: This should NEVER happen if query is correct. Test will be removed from response.")
                    continue
                final_tests.append(test)
            
            tests = final_tests
            
            if security_violations > 0:
                logger.error(f"[get_tests] CRITICAL: Removed {security_violations} tests that didn't belong to user '{user_id_normalized}' - SECURITY BREACH PREVENTED")
                logger.error(f"[get_tests] This indicates the MongoDB query may have failed. Original query was: {query}")
            
            print(f"[get_tests] After final security check: Returning {len(tests)} tests for user_id: '{user_id_normalized}'")
            logger.info(f"[get_tests] After final security check: Returning {len(tests)} tests for user_id: '{user_id_normalized}'")
            
            # ABSOLUTE FINAL VERIFICATION: Log every test being returned
            print(f"[get_tests] SECURITY VERIFICATION: Tests being returned:")
            logger.info(f"[get_tests] SECURITY VERIFICATION: Tests being returned:")
            for idx, test in enumerate(tests):
                test_info = f"[get_tests]   Test {idx+1}: ID={str(test.get('_id'))}, created_by='{test.get('created_by')}', title='{test.get('title', 'Unknown')}'"
                print(test_info)
                logger.info(test_info)
        
        # Build result list (shared code for both super_admin and regular users)
        # Both paths above set the `tests` variable, so we can build the result here
        result = []
        for test in tests:
            # Convert ObjectId to string and ensure all fields are JSON serializable
            # Helper function to format datetime to ISO string with Z suffix (UTC indicator)
            def format_datetime_iso(dt_val):
                """Format datetime to ISO string with Z suffix if it's a datetime object"""
                if not dt_val:
                    return None
                if isinstance(dt_val, datetime):
                    iso_str = dt_val.isoformat()
                    # Add Z if not already present (indicates UTC)
                    # Check if it already has timezone info
                    if not iso_str.endswith('Z') and '+' not in iso_str[-6:] and (len(iso_str) < 10 or iso_str[10] != '+'):
                        return iso_str + 'Z'
                    return iso_str
                return str(dt_val) if dt_val else None
            
            # Format schedule datetimes if schedule exists, but preserve all other fields
            schedule_data = test.get("schedule")
            formatted_schedule = None
            if schedule_data:
                formatted_schedule = {}
                # Format datetime fields
                if "startTime" in schedule_data and schedule_data["startTime"]:
                    formatted_schedule["startTime"] = format_datetime_iso(schedule_data["startTime"])
                if "endTime" in schedule_data and schedule_data["endTime"]:
                    formatted_schedule["endTime"] = format_datetime_iso(schedule_data["endTime"])
                if "duration" in schedule_data:
                    formatted_schedule["duration"] = schedule_data["duration"]
                # Preserve other schedule fields (candidateRequirements, proctoringSettings, etc.)
                if "candidateRequirements" in schedule_data:
                    formatted_schedule["candidateRequirements"] = schedule_data["candidateRequirements"]
                if "proctoringSettings" in schedule_data:
                    formatted_schedule["proctoringSettings"] = normalize_proctoring_settings(schedule_data["proctoringSettings"])
            
            # Ensure proctoringSettings is in schedule if it exists at top level
            proctoring_settings = normalize_proctoring_settings(test.get("proctoringSettings"))
            if formatted_schedule and "proctoringSettings" not in formatted_schedule:
                formatted_schedule["proctoringSettings"] = proctoring_settings
            elif not formatted_schedule and schedule_data:
                # If we're using schedule_data directly, ensure proctoringSettings is there
                if isinstance(schedule_data, dict) and "proctoringSettings" not in schedule_data:
                    schedule_data = schedule_data.copy()
                    schedule_data["proctoringSettings"] = proctoring_settings
            
            test_dict = {
                "id": str(test["_id"]),
                "title": test.get("title", ""),
                "description": test.get("description", ""),
                "duration_minutes": test.get("duration_minutes", 0),
                "start_time": format_datetime_iso(test.get("start_time")),
                "end_time": format_datetime_iso(test.get("end_time")),
                "is_active": test.get("is_active", False),
                "is_published": test.get("is_published", False),
                "invited_users": test.get("invited_users", []),
                "question_ids": [str(qid) if isinstance(qid, ObjectId) else qid for qid in test.get("question_ids", [])],
                "test_token": test.get("test_token"),
                "created_by": str(test.get("created_by", "")),  # CRITICAL: Include for client-side verification
                "examMode": test.get("examMode", "strict"),  # Include examMode for frontend display logic
                "schedule": formatted_schedule if formatted_schedule else (schedule_data if schedule_data else {}),  # Include formatted schedule with all fields
                # Normalize to ensure boolean values are explicit
                "proctoringSettings": proctoring_settings,
            }
            if test.get("pausedAt"):
                paused_val = test.get("pausedAt")
                test_dict["pausedAt"] = paused_val.isoformat() if isinstance(paused_val, datetime) else paused_val
            # Add created_at if it exists
            if "created_at" in test and test.get("created_at"):
                test_dict["created_at"] = test.get("created_at").isoformat() if isinstance(test.get("created_at"), datetime) else test.get("created_at")
            # Add updated_at if it exists (though it might not be in the model)
            if "updated_at" in test and test.get("updated_at"):
                test_dict["updated_at"] = test.get("updated_at").isoformat() if isinstance(test.get("updated_at"), datetime) else test.get("updated_at")
            result.append(test_dict)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[get_tests] Unexpected error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch tests: {str(e)}"
        )

@router.get("/get-reference-photo")
async def get_reference_photo(
    assessmentId: str = Query(..., description="Assessment ID (test ID)"),
    candidateEmail: str = Query(..., description="Candidate email"),
) -> Dict[str, Any]:
    """
    Get reference photo for a candidate in a DSA test.
    Retrieves the reference image from test_candidates collection.
    """
    try:
        db = get_database()
        
        if not ObjectId.is_valid(assessmentId):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid test ID"
            )
        
        assessment_id = ObjectId(assessmentId)
        
        # Find the DSA test
        test = await db.tests.find_one({"_id": assessment_id, "test_type": "dsa"})
        
        if not test:
            logger.warning(f"[DSA][get_reference_photo] Test not found: {assessmentId}")
            return {
                "success": True,
                "message": "No reference photo found",
                "data": {"referenceImage": None}
            }
        
        # Find candidate in test_candidates collection
        candidate_email_lower = candidateEmail.lower().strip()
        candidate = await db.test_candidates.find_one({
            "test_id": assessmentId,
            "email": candidate_email_lower
        })
        
        if not candidate:
            logger.info(f"[DSA][get_reference_photo] Candidate {candidateEmail} not found in test {assessmentId}")
            return {
                "success": True,
                "message": "No reference photo found",
                "data": {"referenceImage": None}
            }
        
        # Get candidateVerification from candidateInfo
        candidate_info = candidate.get("candidateInfo", {})
        candidate_verification = candidate_info.get("candidateVerification", {})
        reference_image = candidate_verification.get("referenceImage")
        
        if not reference_image or not isinstance(reference_image, str) or len(reference_image) < 50:
            logger.info(f"[DSA][get_reference_photo] Reference image not found or invalid for {candidateEmail} in test {assessmentId}")
            return {
                "success": True,
                "message": "No reference photo found",
                "data": {"referenceImage": None}
            }
        
        # Ensure it has data URI prefix
        if not reference_image.startswith("data:image"):
            reference_image = f"data:image/jpeg;base64,{reference_image}"
        
        logger.info(f"[DSA][get_reference_photo] Reference photo found for {candidateEmail} in test {assessmentId}")
        return {
            "success": True,
            "message": "Reference photo fetched successfully",
            "data": {
                "referenceImage": reference_image
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[DSA][get_reference_photo] Error getting reference photo: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get reference photo: {str(e)}"
        )


@router.post("/save-reference-face")
async def save_reference_face(
    request: SaveReferenceFaceRequest,
) -> Dict[str, Any]:
    """
    Save reference face image from identity verification for DSA tests.
    Stores the image in test_candidates[email].candidateInfo.candidateVerification.referenceImage field.
    """
    try:
        db = get_database()
        
        if not ObjectId.is_valid(request.assessmentId):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid test ID"
            )
        
        assessment_id = ObjectId(request.assessmentId)
        
        # Find the DSA test
        test = await db.tests.find_one({"_id": assessment_id, "test_type": "dsa"})
        
        if not test:
            logger.error(f"[DSA][save_reference_face] Test not found: {request.assessmentId}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="DSA test not found"
            )
        
        # Find candidate in test_candidates collection
        candidate_email_lower = request.candidateEmail.lower().strip()
        candidate = await db.test_candidates.find_one({
            "test_id": request.assessmentId,
            "email": candidate_email_lower
        })
        
        if not candidate:
            logger.error(f"[DSA][save_reference_face] Candidate not found: {request.candidateEmail} in test {request.assessmentId}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate not found for this test"
            )
        
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
        
        # Get existing candidateInfo or create new
        candidate_info = candidate.get("candidateInfo", {})
        
        # Initialize candidateVerification if it doesn't exist
        if "candidateVerification" not in candidate_info:
            candidate_info["candidateVerification"] = {}
        
        # Store reference image
        candidate_info["candidateVerification"]["referenceImage"] = processed_image
        candidate_info["candidateVerification"]["referenceImageSavedAt"] = datetime.utcnow().isoformat()
        
        # Update candidate record
        update_result = await db.test_candidates.update_one(
            {"test_id": request.assessmentId, "email": candidate_email_lower},
            {"$set": {"candidateInfo": candidate_info}}
        )
        
        if update_result.matched_count == 0:
            logger.error(f"[DSA][save_reference_face] Failed to update candidate record")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save reference face"
            )
        
        logger.info(f"[DSA][save_reference_face] Reference face saved for {request.candidateEmail} in test {request.assessmentId}")
        
        return {
            "success": True,
            "message": "Reference face image saved successfully",
            "data": {}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[DSA][save_reference_face] Error saving reference face: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save reference face: {str(e)}"
        )


@router.get("/{test_id}/public")
async def get_test_public(
    test_id: str,
    user_id: str = Query(..., description="User ID from link token")
):
    """
    Get test details for candidates (public endpoint).
    Returns test info including duration for timer display.
    Verifies user has access via test submission.
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test_submission = await db.test_submissions.find_one({"test_id": test_id, "user_id": user_id})
    if not test_submission:
        # Fall back to candidate list check (covers "added candidate but not started yet")
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
        candidate_email = (user_doc or {}).get("email")
        candidate_email = str(candidate_email).strip().lower() if candidate_email else ""
        if not candidate_email:
            raise HTTPException(status_code=403, detail="User not authorized for this test")
        candidate = await db.test_candidates.find_one({"test_id": test_id, "email": candidate_email})
        if not candidate:
            raise HTTPException(status_code=403, detail="User not authorized for this test")
    
    # Get test data
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Return test data for candidates (limited fields)
    test_dict = {
        "id": str(test["_id"]),
        "title": test.get("title", ""),
        "description": test.get("description", ""),
        "duration_minutes": test.get("duration_minutes", 0),
        "question_ids": [str(qid) if isinstance(qid, ObjectId) else qid for qid in test.get("question_ids", [])],
        "timer_mode": test.get("timer_mode", "GLOBAL"),
        "question_timings": test.get("question_timings", []),
        "proctoringSettings": normalize_proctoring_settings(test.get("proctoringSettings")),
    }
    
    logger.info(f"[get_test_public] Returning test {test_id} for user {user_id}, duration_minutes={test_dict['duration_minutes']}, proctoringSettings={test_dict.get('proctoringSettings')}")
    
    return test_dict


@router.get("/{test_id}", response_model=dict)
async def get_test(
    test_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get test details (requires authentication and ownership)
    Only returns tests created by the current user
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    # Get current user ID
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"[get_test] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    
    logger.info(f"[get_test] Fetching test {test_id} for user_id: '{user_id}'")
    
    # Find test and verify ownership
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # CRITICAL SECURITY CHECK: Verify ownership
    test_created_by = test.get("created_by")
    if not test_created_by:
        logger.warning(f"[get_test] SECURITY: Test {test_id} has no created_by field")
        raise HTTPException(status_code=403, detail="You don't have permission to view this test")
    
    if str(test_created_by).strip() != user_id.strip():
        logger.error(f"[get_test] SECURITY ISSUE: User {user_id} attempted to access test {test_id} created by {test_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to view this test")
    
    logger.info(f"[get_test] Test {test_id} access granted to user {user_id}")
    
    # Convert ObjectId to string and ensure all fields are JSON serializable
    # Ensure ISO format includes timezone (Z for UTC) so frontend can properly parse as UTC
    start_time_val = test.get("start_time")
    end_time_val = test.get("end_time")
    
    def format_datetime_iso(dt_val):
        """Format datetime to ISO string with Z suffix if it's a datetime object"""
        if not dt_val:
            return None
        if isinstance(dt_val, datetime):
            iso_str = dt_val.isoformat()
            # Add Z if not already present (indicates UTC)
            if not iso_str.endswith('Z') and '+' not in iso_str and '-' not in iso_str[-6:]:
                return iso_str + 'Z'
            return iso_str
        return str(dt_val) if dt_val else None
    
    test_dict = {
        "id": str(test["_id"]),
        "title": test.get("title", ""),
        "description": test.get("description", ""),
        "duration_minutes": test.get("duration_minutes", 0),
        "start_time": format_datetime_iso(start_time_val),
        "end_time": format_datetime_iso(end_time_val),
        "examMode": test.get("examMode", "strict"),
        "schedule": test.get("schedule"),
        "is_active": test.get("is_active", False),
        "is_published": test.get("is_published", False),
        "invited_users": test.get("invited_users", []),
        "question_ids": [str(qid) if isinstance(qid, ObjectId) else qid for qid in test.get("question_ids", [])],
        "timer_mode": test.get("timer_mode", "GLOBAL"),
        "question_timings": test.get("question_timings", []),
        # Legacy field for backward compatibility (convert question_timings to old format)
        "question_time_limits": _convert_question_timings_to_limits(test.get("question_timings", [])) if test.get("question_timings") else test.get("question_time_limits"),
        "test_token": test.get("test_token"),
        # Normalize to ensure boolean values are explicit
        "proctoringSettings": normalize_proctoring_settings(test.get("proctoringSettings")),
    }
    
    # Ensure proctoringSettings is also in the schedule object (for frontend compatibility)
    if isinstance(test_dict.get("schedule"), dict):
        if "proctoringSettings" not in test_dict["schedule"]:
            test_dict["schedule"]["proctoringSettings"] = test_dict["proctoringSettings"]
    elif not test_dict.get("schedule"):
        # If schedule doesn't exist, create it with proctoringSettings
        test_dict["schedule"] = {"proctoringSettings": test_dict["proctoringSettings"]}
    
    # Debug: Log proctoringSettings being returned
    logger.info(f"[get_test] ProctoringSettings for test {test_id}: {test_dict.get('proctoringSettings')}")
    logger.info(f"[get_test] ProctoringSettings in schedule: {test_dict.get('schedule', {}).get('proctoringSettings')}")
    
    # Include invitationTemplate if it exists
    if "invitationTemplate" in test:
        test_dict["invitationTemplate"] = test.get("invitationTemplate")
    return test_dict

@router.patch("/{test_id}", response_model=dict)
async def patch_test(
    test_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Partially update a test (PATCH) - allows updating specific fields like invitationTemplate
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    # Check if test exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    existing_test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not existing_test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Verify ownership
    existing_created_by = existing_test.get("created_by")
    if not existing_created_by:
        logger.error(f"[patch_test] SECURITY: Test {test_id} has no created_by field")
        raise HTTPException(status_code=403, detail="You don't have permission to update this test")
    if str(existing_created_by).strip() != user_id.strip():
        logger.error(f"[patch_test] SECURITY ISSUE: User {user_id} attempted to update test {test_id} created by {existing_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to update this test")
    
    # Build update data - only include fields that are provided
    update_data: Dict[str, Any] = {"updated_at": datetime.utcnow()}
    
    # Allow updating invitationTemplate
    if "invitationTemplate" in payload:
        update_data["invitationTemplate"] = payload["invitationTemplate"]
    
    # Allow updating proctoringSettings
    if "proctoringSettings" in payload:
        proctoring_settings = payload["proctoringSettings"]
        # Normalize to ensure boolean values are explicit
        normalized_proctoring = normalize_proctoring_settings(proctoring_settings)
        update_data["proctoringSettings"] = normalized_proctoring
        logger.info(f"[patch_test] Updating proctoringSettings for test {test_id}: {normalized_proctoring}")
        
        # Also update proctoringSettings in schedule object
        existing_schedule = existing_test.get("schedule") or {}
        if isinstance(existing_schedule, dict):
            existing_schedule["proctoringSettings"] = normalized_proctoring
            update_data["schedule"] = existing_schedule
        else:
            # If schedule doesn't exist, create it with proctoringSettings
            update_data["schedule"] = {"proctoringSettings": normalized_proctoring}
    
    # Update the test
    result = await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Fetch the updated test
    updated_test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if updated_test:
        test_dict = {
            "id": str(updated_test["_id"]),
            "title": updated_test.get("title", ""),
            "description": updated_test.get("description", ""),
            "duration_minutes": updated_test.get("duration_minutes", 0),
            "start_time": updated_test.get("start_time").isoformat() if updated_test.get("start_time") else None,
            "end_time": updated_test.get("end_time").isoformat() if updated_test.get("end_time") else None,
            "is_active": updated_test.get("is_active", False),
            "is_published": updated_test.get("is_published", False),
            "invited_users": updated_test.get("invited_users", []),
            "question_ids": [str(qid) if isinstance(qid, ObjectId) else qid for qid in updated_test.get("question_ids", [])],
            "test_token": updated_test.get("test_token"),
            "schedule": updated_test.get("schedule"),  # Include schedule
            # Normalize to ensure boolean values are explicit
            "proctoringSettings": normalize_proctoring_settings(updated_test.get("proctoringSettings")),
        }
        
        # Ensure proctoringSettings is also in the schedule object (for frontend compatibility)
        if isinstance(test_dict.get("schedule"), dict):
            if "proctoringSettings" not in test_dict["schedule"]:
                test_dict["schedule"]["proctoringSettings"] = test_dict["proctoringSettings"]
        elif not test_dict.get("schedule"):
            # If schedule doesn't exist, create it with proctoringSettings
            test_dict["schedule"] = {"proctoringSettings": test_dict["proctoringSettings"]}
        
        # Include invitationTemplate if it exists
        if "invitationTemplate" in updated_test:
            test_dict["invitationTemplate"] = updated_test.get("invitationTemplate")
        return test_dict
    
    raise HTTPException(status_code=500, detail="Failed to update test")

@router.put("/{test_id}", response_model=dict)
async def update_test(
    test_id: str,
    test: TestCreate,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Update an existing test (requires authentication and ownership)
    Validates that all question_ids belong to the current user
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    try:
        # Log the received test data for debugging
        logger.info(f"[update_test] Received test data: examMode={getattr(test, 'examMode', None)}, timer_mode={getattr(test, 'timer_mode', None)}")
    except Exception as e:
        logger.warning(f"[update_test] Could not log test data: {e}")
    
    # Check if test exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    existing_test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not existing_test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Verify ownership - normalize both sides for comparison
    existing_created_by = existing_test.get("created_by")
    if not existing_created_by:
        logger.error(f"[update_test] SECURITY: Test {test_id} has no created_by field")
        raise HTTPException(status_code=403, detail="You don't have permission to update this test")
    if str(existing_created_by).strip() != user_id.strip():
        logger.error(f"[update_test] SECURITY ISSUE: User {user_id} attempted to update test {test_id} created by {existing_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to update this test")
    
    # Validate that all questions belong to the current user
    if test.question_ids:
        question_ids = [ObjectId(qid) if ObjectId.is_valid(qid) else None for qid in test.question_ids]
        question_ids = [qid for qid in question_ids if qid is not None]
        
        if question_ids:
            questions = await db.questions.find({"_id": {"$in": question_ids}}).to_list(length=len(question_ids))
            # Check if all questions exist and belong to the user
            found_question_ids = {str(q["_id"]) for q in questions}
            requested_question_ids = {str(qid) for qid in question_ids}
            
            if found_question_ids != requested_question_ids:
                raise HTTPException(status_code=400, detail="Some questions not found")
            
            # Verify ownership - normalize both sides for comparison
            for question in questions:
                q_created_by = question.get("created_by")
                if not q_created_by or str(q_created_by).strip() != user_id.strip():
                    raise HTTPException(status_code=403, detail=f"Question {question.get('title', 'Unknown')} does not belong to you")
    
    # -------------------------------
    # Exam window configuration (mirrors Custom MCQ)
    # -------------------------------
    def _coalesce(*vals):
        for v in vals:
            if v is not None:
                return v
        return None

    exam_mode = getattr(test, "examMode", None) or existing_test.get("examMode") or "strict"
    schedule_obj = getattr(test, "schedule", None)
    
    # Helper to parse datetime from various formats
    def _parse_datetime(val):
        if val is None:
            return None
        if isinstance(val, datetime):
            return val
        if isinstance(val, str):
            try:
                # Try parsing ISO format
                return datetime.fromisoformat(val.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                try:
                    # Try parsing with dateutil if available
                    from dateutil import parser
                    return parser.parse(val)
                except (ImportError, ValueError):
                    logger.warning(f"Could not parse datetime: {val}")
                    return None
        return None
    
    # Prioritize new values from the request over existing values
    # First, try to get new values from the request
    new_start_dt = _coalesce(
        _parse_datetime(getattr(schedule_obj, "startTime", None) if schedule_obj else None),
        _parse_datetime(getattr(test, "startTime", None)),
        _parse_datetime(getattr(test, "start_time", None)),
    )
    # Use new value if provided, otherwise fall back to existing
    start_dt = new_start_dt if new_start_dt is not None else _coalesce(
        _parse_datetime(existing_test.get("start_time")),
        _parse_datetime((existing_test.get("schedule") or {}).get("startTime")),
    )
    
    new_end_dt = _coalesce(
        _parse_datetime(getattr(schedule_obj, "endTime", None) if schedule_obj else None),
        _parse_datetime(getattr(test, "endTime", None)),
        _parse_datetime(getattr(test, "end_time", None)),
    )
    # Use new value if provided, otherwise fall back to existing
    end_dt = new_end_dt if new_end_dt is not None else _coalesce(
        _parse_datetime(existing_test.get("end_time")),
        _parse_datetime((existing_test.get("schedule") or {}).get("endTime")),
    )
    
    logger.info(f"[update_test] start_dt: {start_dt} (new: {new_start_dt}, existing: {existing_test.get('start_time')})")
    duration_minutes = _coalesce(
        getattr(schedule_obj, "duration", None) if schedule_obj else None,
        getattr(test, "duration", None),
        getattr(test, "duration_minutes", None),
        (existing_test.get("schedule") or {}).get("duration"),
        existing_test.get("duration_minutes"),
    )

    if exam_mode not in ("strict", "flexible"):
        raise HTTPException(status_code=400, detail="Invalid examMode. Must be 'strict' or 'flexible'.")
    
    # For Fixed Window (strict), end_time is auto-calculated, so it's optional in the request
    # For Flexible Window, end_time is required
    if exam_mode == "flexible":
        if not end_dt:
            raise HTTPException(status_code=400, detail="End time is required for flexible exam mode.")
        if not start_dt:
            raise HTTPException(status_code=400, detail="Start time is required.")
        if start_dt >= end_dt:
            raise HTTPException(status_code=400, detail="End time must be after start time.")
        if not duration_minutes or int(duration_minutes) <= 0:
            raise HTTPException(status_code=400, detail="Duration is required for flexible exam mode.")
    else:
        # Fixed Window (strict) - start_time is required, end_time will be auto-calculated
        if not start_dt:
            raise HTTPException(status_code=400, detail="Start time is required.")
        if not duration_minutes or int(duration_minutes) <= 0:
            raise HTTPException(status_code=400, detail="Duration is required for fixed window mode.")
        # Auto-calculate end_time for Fixed Window: end_time = start_time + duration_minutes
        from datetime import timedelta
        end_dt = start_dt + timedelta(minutes=int(duration_minutes))

    # Preserve existing candidateRequirements from the test's schedule
    existing_schedule = existing_test.get("schedule") or {}
    existing_candidate_requirements = existing_schedule.get("candidateRequirements", {})
    
    # Extract candidateRequirements from new schedule if provided
    schedule_obj = getattr(test, "schedule", None)
    new_candidate_requirements = {}
    if schedule_obj and hasattr(schedule_obj, "candidateRequirements"):
        new_candidate_requirements = schedule_obj.candidateRequirements or {}
    elif schedule_obj and isinstance(schedule_obj, dict):
        new_candidate_requirements = schedule_obj.get("candidateRequirements", {})
    
    # Use new candidateRequirements if provided, otherwise preserve existing
    final_candidate_requirements = new_candidate_requirements if new_candidate_requirements else existing_candidate_requirements
    
    schedule_payload = {
        "startTime": start_dt,
        "endTime": end_dt,
        "duration": int(duration_minutes) if (exam_mode == "flexible" and duration_minutes is not None) else None,
        "candidateRequirements": final_candidate_requirements,  # Preserve or update candidate requirements
    }

    # Prepare update data
    test_dict = test.model_dump(exclude_unset=True)  # Only include fields that were explicitly set
    test_dict["examMode"] = exam_mode
    test_dict["schedule"] = schedule_payload
    # Always use the parsed start_dt and end_dt (which prioritize new values from request)
    # These MUST be set to ensure the update happens
    test_dict["start_time"] = start_dt
    test_dict["end_time"] = end_dt
    test_dict["updated_at"] = datetime.utcnow()  # Update timestamp
    
    # Handle timer mode and duration
    if test.timer_mode == "PER_QUESTION":
        if test.question_timings:
            total_duration = sum(qt.duration_minutes for qt in test.question_timings)
            test_dict["duration_minutes"] = total_duration
            test_dict["question_timings"] = [{"question_id": qt.question_id, "duration_minutes": qt.duration_minutes} for qt in test.question_timings]
        else:
            # Keep existing if not provided
            test_dict["duration_minutes"] = existing_test.get("duration_minutes", 60)
            test_dict["question_timings"] = existing_test.get("question_timings")
    else:
        # GLOBAL mode - use provided duration
        test_dict["duration_minutes"] = int(duration_minutes)
        test_dict["question_timings"] = None

    # -------------------------------
    # For FLEXIBLE WINDOW: Validate that window duration >= test duration
    # -------------------------------
    if exam_mode == "flexible":
        # Calculate window duration in minutes
        window_duration_minutes = int((end_dt - start_dt).total_seconds() / 60)
        test_duration_minutes = test_dict["duration_minutes"]
        if window_duration_minutes < test_duration_minutes:
            raise HTTPException(
                status_code=400, 
                detail=f"Flexible window duration ({window_duration_minutes} minutes) must be at least as long as the test duration ({test_duration_minutes} minutes)."
            )
    
    # Preserve existing fields that shouldn't be updated
    test_dict["is_active"] = existing_test.get("is_active", True)
    test_dict["is_published"] = existing_test.get("is_published", False)
    test_dict["invited_users"] = existing_test.get("invited_users", [])
    
    # Update the test
    result = await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": test_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Fetch the updated test
    updated_test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if updated_test:
        # Convert ObjectId to string and ensure all fields are JSON serializable
        test_dict = {
            "id": str(updated_test["_id"]),
            "title": updated_test.get("title", ""),
            "description": updated_test.get("description", ""),
            "duration_minutes": updated_test.get("duration_minutes", 0),
            "start_time": updated_test.get("start_time").isoformat() if updated_test.get("start_time") else None,
            "end_time": updated_test.get("end_time").isoformat() if updated_test.get("end_time") else None,
            "examMode": updated_test.get("examMode", "strict"),
            "schedule": updated_test.get("schedule"),
            "is_active": updated_test.get("is_active", False),
            "is_published": updated_test.get("is_published", False),
            "invited_users": updated_test.get("invited_users", []),
            "question_ids": [str(qid) if isinstance(qid, ObjectId) else qid for qid in updated_test.get("question_ids", [])],
            "test_token": updated_test.get("test_token"),
        }
        # Include invitationTemplate if it exists
        if "invitationTemplate" in updated_test:
            test_dict["invitationTemplate"] = updated_test.get("invitationTemplate")
        return test_dict
    
    raise HTTPException(status_code=500, detail="Failed to update test")

@router.post("/{test_id}/start")
async def start_test(test_id: str, user_id: str = Query(..., description="User ID from link token")):
    """
    Start a test (user_id provided via query parameter)
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if not test.get("is_published", False):
        raise HTTPException(status_code=403, detail="Test is not published")
    
    # For Fixed Window (strict) in DSA: Check pre-check window (15 min before) and start time
    exam_mode = test.get("examMode", "strict")
    schedule = test.get("schedule") or {}
    start_time = schedule.get("startTime") or test.get("start_time") or test.get("startTime")
    end_time = schedule.get("endTime") or test.get("end_time") or test.get("endTime")

    if exam_mode == "strict" and start_time:
        now = datetime.utcnow()
        from datetime import timedelta
        
        # Get total test duration (already calculated and stored in duration_minutes)
        timer_mode = test.get("timer_mode", "GLOBAL")
        total_duration_minutes = int(test.get("duration_minutes", 0) or 0)
        
        if total_duration_minutes <= 0:
            raise HTTPException(status_code=400, detail="Test duration is not configured properly.")

        # Pre-check window: 15 minutes before start time
        pre_check_start = start_time - timedelta(minutes=15)
        
        # Check if too early (before pre-check window)
        if now < pre_check_start:
            raise HTTPException(
                status_code=403,
                detail=f"Test not available yet. You can enter 15 minutes before the start time ({start_time.strftime('%Y-%m-%d %H:%M')})."
            )
        
        # Check if in pre-check window (can enter but cannot start test yet)
        if pre_check_start <= now < start_time:
            # Return pre-check mode - candidate can do pre-checks but cannot start test
            return {
                "precheck_mode": True,
                "start_time": start_time.isoformat() if isinstance(start_time, datetime) else start_time,
                "message": f"Test will start at {start_time.strftime('%Y-%m-%d %H:%M')}. Please complete pre-checks and wait.",
                "can_start": False
            }
        
        # After start time: allow actual test start
        # Test will auto-end after total_duration_minutes from when they start
    
    # Only check if test is active flag is set
    if not test.get("is_active", True):
        raise HTTPException(status_code=400, detail="Test is not active")

    # Resolve candidate email from user_id (email is the unique real-world identifier)
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    candidate_email = (user_doc or {}).get("email")
    if not candidate_email:
        raise HTTPException(status_code=400, detail="Candidate email not found")
    candidate_email = str(candidate_email).strip().lower()

    # Enforce single attempt per candidate email for this test (name can be same)
    existing_completed_by_email = await db.test_submissions.find_one({
        "test_id": test_id,
        "candidate_email": candidate_email,
        "is_completed": True
    })
    if existing_completed_by_email:
        raise HTTPException(status_code=400, detail="Test already completed for this email. A candidate can attempt the test only once.")
    
    # Check if user already started
    existing = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if existing:
        # Enforce single attempt per candidate: if completed, do not allow restart.
        if existing.get("is_completed", False):
            raise HTTPException(status_code=400, detail="Test already completed. A candidate can attempt the test only once.")
        return {
            "test_submission_id": str(existing["_id"]),
            "started_at": existing["started_at"].isoformat() if isinstance(existing.get("started_at"), datetime) else existing.get("started_at"),
            "is_completed": existing.get("is_completed", False)
        }

    # If paused, allow ONLY candidates who were added before the pause time.
    paused_at = test.get("pausedAt")
    if paused_at:
        # Resolve candidate email from user_id and check candidate record timestamp
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        candidate_email = str((user_doc or {}).get("email") or "").strip().lower()
        if not candidate_email:
            raise HTTPException(status_code=403, detail="Test is currently paused")

        # Case-insensitive match (older records may store mixed-case emails)
        candidate_doc = await db.test_candidates.find_one({
            "test_id": test_id,
            "email": {"$regex": f"^{re.escape(candidate_email)}$", "$options": "i"}
        })
        if not candidate_doc:
            raise HTTPException(status_code=403, detail="Test is currently paused")

        created_at = candidate_doc.get("created_at")
        # If we can compare timestamps, block only if candidate was added after pause.
        if isinstance(paused_at, datetime) and isinstance(created_at, datetime):
            if created_at > paused_at:
                raise HTTPException(status_code=403, detail="Test is currently paused")
    
    # Create test submission
    test_submission = {
        "test_id": test_id,
        "user_id": user_id,
        "candidate_email": candidate_email,
        "submissions": [],
        "score": 0,
        "started_at": datetime.utcnow(),
        "is_completed": False,
    }
    
    result = await db.test_submissions.insert_one(test_submission)
    return {
        "test_submission_id": str(result.inserted_id),
        "started_at": test_submission["started_at"].isoformat(),
        "is_completed": False
    }

@router.get("/{test_id}/submission")
async def get_test_submission(test_id: str, user_id: str = Query(..., description="User ID from link token")):
    """
    Get test submission for user
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test_submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if not test_submission:
        raise HTTPException(status_code=404, detail="Test submission not found")
    
    # Convert ObjectId and datetime fields to JSON-serializable formats
    # Convert any ObjectId values in submissions array to strings
    submissions_list = test_submission.get("submissions", [])
    serialized_submissions = []
    for item in submissions_list:
        if isinstance(item, ObjectId):
            serialized_submissions.append(str(item))
        else:
            serialized_submissions.append(item)
    
    submission_dict = {
        "id": str(test_submission["_id"]),
        "test_id": str(test_submission.get("test_id", "")) if isinstance(test_submission.get("test_id"), ObjectId) else test_submission.get("test_id", ""),
        "user_id": str(test_submission.get("user_id", "")) if isinstance(test_submission.get("user_id"), ObjectId) else test_submission.get("user_id", ""),
        "submissions": serialized_submissions,
        "score": test_submission.get("score", 0),
        "started_at": test_submission.get("started_at").isoformat() if isinstance(test_submission.get("started_at"), datetime) else test_submission.get("started_at"),
        "is_completed": test_submission.get("is_completed", False),
    }
    
    # Handle submitted_at if it exists
    if "submitted_at" in test_submission:
        submitted_at_val = test_submission.get("submitted_at")
        if isinstance(submitted_at_val, datetime):
            submission_dict["submitted_at"] = submitted_at_val.isoformat()
        else:
            submission_dict["submitted_at"] = submitted_at_val
    
    return submission_dict


@router.get("/{test_id}/question/{question_id}")
async def get_test_question(
    test_id: str, 
    question_id: str,
    user_id: str = Query(..., description="User ID from link token")
):
    """
    Get a specific question for a test (public endpoint for candidates).
    Returns question data including SQL-specific fields.
    Verifies that the question belongs to the test and user has access.
    """
    db = get_database()
    
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    # Verify the test exists and contains this question
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if question_id not in test.get("question_ids", []):
        raise HTTPException(status_code=403, detail="Question not part of this test")
    
    # Verify user is authorized for this test.
    # Allow access if they are a registered candidate (before starting) OR already have a submission.
    test_submission = await db.test_submissions.find_one({"test_id": test_id, "user_id": user_id})
    if not test_submission:
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
        candidate_email = (user_doc or {}).get("email")
        candidate_email = str(candidate_email).strip().lower() if candidate_email else ""
        if not candidate_email:
            raise HTTPException(status_code=403, detail="User not authorized for this test")
        candidate = await db.test_candidates.find_one({"test_id": test_id, "email": candidate_email})
        if not candidate:
            raise HTTPException(status_code=403, detail="User not authorized for this test")
    
    # Check if test submission is completed (only if a submission exists)
    if test_submission is not None and test_submission.get("is_completed", False):
        raise HTTPException(status_code=403, detail="Test already submitted")
    
    # Get the question
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Build response with all necessary fields
    question_dict: Dict[str, Any] = {
        "id": str(question["_id"]),
        "title": question.get("title", ""),
        "description": question.get("description", ""),
        "difficulty": question.get("difficulty", ""),
        "languages": question.get("languages", []),
        "starter_code": question.get("starter_code", {}),
        # Only return public testcases for candidates
        "public_testcases": question.get("public_testcases", []),
        # We intentionally do not expose hidden_testcases to candidates
    }
    
    # Add function_signature if it exists
    if question.get("function_signature"):
        question_dict["function_signature"] = question["function_signature"]
    
    # Detect question type - explicit or inferred from SQL-specific fields
    question_type = question.get("question_type")
    
    # Infer SQL type if not explicitly set but has SQL-specific fields
    if not question_type:
        has_schemas = question.get("schemas") and len(question.get("schemas", {})) > 0
        has_sql_category = question.get("sql_category") is not None
        has_starter_query = question.get("starter_query") is not None
        has_evaluation = question.get("evaluation") and question.get("evaluation", {}).get("engine")
        
        if has_schemas or has_sql_category or has_starter_query or has_evaluation:
            question_type = "SQL"
            logger.info(f"[get_test_question] Inferred question_type=SQL for question {question_id}")
    
    # Add question_type to response
    if question_type:
        question_dict["question_type"] = question_type
    
    # Add SQL-specific fields
    if question.get("sql_category"):
        question_dict["sql_category"] = question["sql_category"]
    if question.get("schemas"):
        question_dict["schemas"] = question["schemas"]
    if question.get("sample_data"):
        question_dict["sample_data"] = question["sample_data"]
    if question.get("starter_query"):
        question_dict["starter_query"] = question["starter_query"]
    if question.get("hints"):
        question_dict["hints"] = question["hints"]
    if question.get("evaluation"):
        question_dict["evaluation"] = question["evaluation"]
    if question.get("constraints"):
        question_dict["constraints"] = question["constraints"]
    if question.get("examples"):
        question_dict["examples"] = question["examples"]
    # Optional SQL expected output snapshot (safe to show to candidates)
    if question.get("sql_expected_output") is not None:
        question_dict["sql_expected_output"] = question.get("sql_expected_output")
    
    logger.info(f"[get_test_question] Returning question {question_id} for test {test_id}, user {user_id}")
    
    # Wrap in ApiResponse-like shape so frontend can consistently use .data
    return {"data": question_dict}


@router.patch("/{test_id}/submission")
async def update_test_submission(
    test_id: str,
    user_id: str = Query(..., description="User ID from link token"),
    is_completed: bool = Query(False, description="Mark as completed"),
    submitted_at: str = Query(None, description="Submission timestamp")
):
    """
    Update test submission (mark as completed)
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    update_data: dict = {"is_completed": is_completed}
    if submitted_at:
        try:
            # Handle ISO format with or without timezone
            if submitted_at.endswith('Z'):
                submitted_at = submitted_at[:-1] + '+00:00'
            update_data["submitted_at"] = datetime.fromisoformat(submitted_at)
        except:
            update_data["submitted_at"] = datetime.utcnow()
    elif is_completed:
        update_data["submitted_at"] = datetime.utcnow()
    
    result = await db.test_submissions.update_one(
        {"test_id": test_id, "user_id": user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Test submission not found")
    
    test_submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    test_submission["id"] = str(test_submission["_id"])
    return test_submission


class QuestionSubmission(BaseModel):
    question_id: str
    code: str
    language: str
    # SQL-specific: Execution engine results (only for SQL questions)
    execution_engine_passed: Optional[bool] = None
    execution_engine_output: Optional[str] = None
    execution_engine_expected_output: Optional[str] = None
    execution_engine_time: Optional[float] = None
    execution_engine_memory: Optional[float] = None

class FinalTestSubmissionRequest(BaseModel):
    question_submissions: List[QuestionSubmission]
    activity_logs: Optional[List[Dict[str, Any]]] = []


async def process_ai_feedback_background(
    submission_id: str,
    test_id: str,
    user_id: str,
    question_id: str,
    source_code: str,
    language: str,
    question_title: str,
    question_description: str,
    all_test_results: List[Dict],
    total_passed: int,
    total_tests: int,
    public_passed: int,
    public_total: int,
    hidden_passed: int,
    hidden_total: int,
    starter_code: Optional[str]
):
    """Background task to generate AI feedback and update submission"""
    db = get_database()
    try:
        logger.info(f"Starting background AI feedback generation for submission {submission_id}")
        
        # Check if this is a SQL question - use SQL-specific evaluation
        is_sql = language.lower() == "sql"
        
        if is_sql:
            # Use SQL-specific evaluation from unified_ai_evaluation
            from ...assessments.services.unified_ai_evaluation import evaluate_sql_answer
            
            # Get question details for SQL evaluation
            question = await db.questions.find_one({"_id": ObjectId(question_id)})
            if not question:
                logger.error(f"Question {question_id} not found for SQL evaluation")
                return
            
            # Extract expected output and user output from test results
            expected_output = ""
            user_output = ""
            test_passed = total_passed > 0
            
            if all_test_results and len(all_test_results) > 0:
                test_result = all_test_results[0]
                expected_output = test_result.get("expected_output", "") or ""
                user_output = test_result.get("user_output", "") or test_result.get("actual_output", "") or ""
                test_passed = test_result.get("passed", False)
            
            # Get reference query and schemas
            reference_query = question.get("reference_query")
            schemas = question.get("schemas", {})
            evaluation = question.get("evaluation", {})
            order_sensitive = evaluation.get("order_sensitive", False)
            difficulty = question.get("difficulty", "Medium")
            max_marks = question.get("marks", 100)
            
            # Prepare test result for SQL evaluation
            test_result_data = {
                "passed": test_passed,
                "user_output": user_output,
                "expected_output": expected_output,
                "error": None,
            }
            
            # Use SQL-specific evaluation
            ai_evaluation = await evaluate_sql_answer(
                question_id=question_id,
                question_description=question_description,
                user_query=source_code,
                reference_query=reference_query,
                max_marks=max_marks,
                section=None,
                schemas=schemas,
                test_result=test_result_data,
                order_sensitive=order_sensitive,
                difficulty=difficulty,
                use_cache=True
            )
            
            # Transform unified evaluation format to SQL-specific ai_feedback format
            # SQL-specific: No time/space complexity, focus on query optimization
            efficiency_feedback = ai_evaluation.get("criteria_scores", {}).get("efficiency", {}).get("feedback", "")
            code_quality_feedback = ai_evaluation.get("criteria_scores", {}).get("code_quality", {}).get("feedback", "")
            if not code_quality_feedback:
                # Fallback to best_practices if code_quality not available
                code_quality_feedback = ai_evaluation.get("criteria_scores", {}).get("best_practices", {}).get("feedback", "")
            
            # Transform areas_of_improvement from complex structure to simple array
            areas_for_improvement = []
            for area in ai_evaluation.get("areas_of_improvement", []):
                skill = area.get("skill", "")
                gap = area.get("gap_analysis", "")
                if skill and gap:
                    areas_for_improvement.append(f"{skill}: {gap}")
                elif skill:
                    areas_for_improvement.append(skill)
                elif gap:
                    areas_for_improvement.append(gap)
            
            ai_feedback = {
                "overall_score": int(ai_evaluation.get("score", 0)),
                "feedback_summary": ai_evaluation.get("feedback", {}).get("summary", ""),
                "one_liner": ai_evaluation.get("feedback", {}).get("summary", "")[:100] if ai_evaluation.get("feedback", {}).get("summary") else "",
                "code_quality": {
                    "score": int(ai_evaluation.get("criteria_scores", {}).get("code_quality", {}).get("score", 0) or ai_evaluation.get("criteria_scores", {}).get("best_practices", {}).get("score", 0)),
                    "comments": code_quality_feedback
                },
                "efficiency": {
                    "time_complexity": "N/A",  # Not applicable to SQL queries
                    "space_complexity": "N/A",  # Not applicable to SQL queries
                    "comments": efficiency_feedback  # SQL-specific: query optimization, index usage, JOIN efficiency
                },
                "correctness": {
                    "score": int(ai_evaluation.get("criteria_scores", {}).get("accuracy", {}).get("score", 0)),
                    "comments": ai_evaluation.get("criteria_scores", {}).get("accuracy", {}).get("feedback", "")
                },
                "suggestions": ai_evaluation.get("feedback", {}).get("suggestions", []),
                "strengths": ai_evaluation.get("feedback", {}).get("strengths", []),
                "areas_for_improvement": areas_for_improvement,
            }
        else:
            # Use regular code feedback for non-SQL questions
            loop = asyncio.get_event_loop()
            ai_feedback = await loop.run_in_executor(
                None,  # Use default ThreadPoolExecutor
                lambda: generate_code_feedback(
                    source_code=source_code,
                    language=language,
                    question_title=question_title,
                    question_description=question_description,
                    test_results=all_test_results,
                    total_passed=total_passed,
                    total_tests=total_tests,
                    time_spent_seconds=None,
                    public_passed=public_passed,
                    public_total=public_total,
                    hidden_passed=hidden_passed,
                    hidden_total=hidden_total,
                    starter_code=starter_code,
                )
            )
        
        # Update submission with AI feedback
        await db.submissions.update_one(
            {"_id": ObjectId(submission_id)},
            {"$set": {"ai_feedback": ai_feedback}}
        )
        
        # Update score if AI feedback has overall_score
        score = 0
        if ai_feedback and isinstance(ai_feedback, dict):
            score = ai_feedback.get("overall_score", 0)
            await db.submissions.update_one(
                {"_id": ObjectId(submission_id)},
                {"$set": {"score": score}}
            )
        
        # Recalculate overall score for test submission (out of 100) after this question's feedback is ready
        test_submission = await db.test_submissions.find_one({
            "test_id": test_id,
            "user_id": user_id
        })
        if test_submission:
            # Get all submissions for this test
            all_submissions = await db.submissions.find({
                "user_id": user_id,
                "test_id": test_id,
                "is_final_submission": True
            }).to_list(length=100)
            
            # Get scores for all questions (use 0 if feedback not ready yet)
            question_count = max(len(test_submission.get("submissions") or []), 1)
            scored = []
            for sub in all_submissions:
                if sub.get("ai_feedback") is not None or sub.get("status") == "no_code_written":
                    scored.append(sub.get("score", 0))
                else:
                    # If feedback not ready, use 0 as placeholder
                    scored.append(0)
            
            # Ensure we have scores for all questions
            while len(scored) < question_count:
                scored.append(0)
            
            # Calculate total score: sum all question scores (each question is out of 100)
            # Then normalize to 100 total by dividing by question count
            # Example: 2 questions, each 100 = 200 total, normalized = 100
            # Example: 2 questions, one 80 one 60 = 140 total, normalized = 70
            total_sum = sum(scored)
            new_total_score = int(round(total_sum / question_count))
            
            # Ensure score is between 0 and 100
            new_total_score = max(0, min(100, new_total_score))
            
            await db.test_submissions.update_one(
                {"test_id": test_id, "user_id": user_id},
                {"$set": {"score": new_total_score}}
            )
            logger.info(f"Updated test submission total score to {new_total_score} (sum={total_sum}, questions={question_count})")
        
        logger.info(f"Completed AI feedback generation for submission {submission_id}")
    except Exception as e:
        logger.error(f"Error in background AI feedback generation for submission {submission_id}: {e}")
        # Update submission with error
        await db.submissions.update_one(
            {"_id": ObjectId(submission_id)},
            {"$set": {"ai_feedback": {"error": str(e)}}}
        )


async def process_question_evaluation_background(
    submission_id: str,
    test_id: str,
    user_id: str,
    question_id: str,
    source_code: str,
    language: str,
    question: Dict[str, Any]
):
    """Background task to evaluate test cases and generate AI feedback"""
    db = get_database()
    try:
        logger.info(f"Starting background evaluation for submission {submission_id}")
        
        # Detect question type - handle None case
        question_type_raw = question.get("question_type") or ""
        question_type = question_type_raw.upper() if isinstance(question_type_raw, str) else ""
        is_sql_question = question_type == "SQL"
        
        if is_sql_question:
            from ..routers.assessment import (
                build_sql_script,
                execute_sql_with_judge0,
                compare_sql_results
            )
            
            # Get schemas and sample data
            schemas = question.get("schemas", {})
            sample_data = question.get("sample_data", {})
            reference_query = question.get("reference_query")
            evaluation = question.get("evaluation", {})
            order_sensitive = evaluation.get("order_sensitive", False)
            
            if not schemas:
                await db.submissions.update_one(
                    {"_id": ObjectId(submission_id)},
                    {"$set": {
                        "status": "error",
                        "test_results": [],
                        "passed_testcases": 0,
                        "total_testcases": 0,
                        "ai_feedback": {"error": "Question has no table schemas defined"},
                        "score": 0
                    }}
                )
                return
            
            # Execute user's SQL query
            user_sql_script = build_sql_script(
                schemas=schemas,
                sample_data=sample_data,
                user_query=source_code
            )
            
            user_result = await execute_sql_with_judge0(user_sql_script)
            
            if not user_result["success"]:
                status = "syntax_error" if user_result.get("status_id") == 6 else "error"
                message = user_result.get("stderr") or user_result.get("compile_output") or "SQL execution failed"
                
                # SQL-specific error test result (no input field, no public/hidden)
                all_test_results = [{
                    "test_number": 1,
                    "expected_output": "",
                    "user_output": "",
                    "status": status,
                    "status_id": user_result.get("status_id", 0),
                    "passed": False,
                    "error": message,  # SQL-specific: use 'error' instead of 'stderr'
                    "time": user_result.get("time"),
                    "memory": user_result.get("memory"),
                }]
                
                # SQL-specific: Update without public/hidden fields
                await db.submissions.update_one(
                    {"_id": ObjectId(submission_id)},
                    {"$set": {
                        "status": status,
                        "test_results": all_test_results,
                        "passed_testcases": 0,
                        "total_testcases": 1,
                        "execution_time": user_result.get("time"),
                        "memory_used": user_result.get("memory"),
                    }}
                )
                
                # Schedule AI feedback in background (non-blocking)
                asyncio.create_task(process_ai_feedback_background(
                    submission_id=submission_id,
                    test_id=test_id,
                    user_id=user_id,
                    question_id=question_id,
                    source_code=source_code,
                    language="sql",
                    question_title=question.get("title", ""),
                    question_description=question.get("description", ""),
                    all_test_results=all_test_results,
                    total_passed=0,
                    total_tests=1,
                    public_passed=0,
                    public_total=0,
                    hidden_passed=0,
                    hidden_total=1,
                    starter_code=question.get("starter_query")
                ))
                return
            
            user_output = user_result.get("stdout", "").strip()
            
            # Execute reference query and compare
            passed = False
            expected_output = None
            if reference_query:
                ref_sql_script = build_sql_script(
                    schemas=schemas,
                    sample_data=sample_data,
                    user_query=reference_query
                )
                
                ref_result = await execute_sql_with_judge0(ref_sql_script)
                
                if not ref_result["success"]:
                    status = "error"
                    message = "Reference query execution failed"
                else:
                    expected_output = ref_result.get("stdout", "").strip()
                    passed = compare_sql_results(user_output, expected_output, order_sensitive)
                    status = "accepted" if passed else "wrong_answer"
                    message = "Query produces correct results!" if passed else "Query output does not match expected results"
            else:
                passed = user_result["success"]
                status = "accepted" if passed else "error"
                message = "Query executed successfully" if passed else "Query execution failed"
            
            # Format SQL test results (cleaner structure - no input, no public/hidden)
            all_test_results = [{
                "test_number": 1,
                "expected_output": expected_output or "",  # CRITICAL: Save expected output
                "user_output": user_output,
                "status": status,
                "status_id": user_result.get("status_id", 3 if passed else 0),
                "passed": passed,
                "time": user_result.get("time"),
                "memory": user_result.get("memory"),
            }]
            
            # SQL-specific: Update without public/hidden fields
            await db.submissions.update_one(
                {"_id": ObjectId(submission_id)},
                {"$set": {
                    "status": status,
                    "test_results": all_test_results,
                    "passed_testcases": 1 if passed else 0,
                    "total_testcases": 1,
                    "execution_time": user_result.get("time"),
                    "memory_used": user_result.get("memory"),
                }}
            )
            
            # Schedule AI feedback in background (non-blocking)
            asyncio.create_task(process_ai_feedback_background(
                submission_id=submission_id,
                test_id=test_id,
                user_id=user_id,
                question_id=question_id,
                source_code=source_code,
                language="sql",
                question_title=question.get("title", ""),
                question_description=question.get("description", ""),
                all_test_results=all_test_results,
                total_passed=1 if passed else 0,
                total_tests=1,
                public_passed=1 if passed else 0,
                public_total=1 if passed else 0,
                hidden_passed=1 if passed else 0,
                hidden_total=1,
                starter_code=question.get("starter_query")
            ))
            return
        
        # Handle DSA coding questions
        language_id = LANGUAGE_IDS.get(language.lower(), None)
        if not language_id:
            await db.submissions.update_one(
                {"_id": ObjectId(submission_id)},
                {"$set": {
                    "status": "error",
                    "test_results": [],
                    "passed_testcases": 0,
                    "total_testcases": 0,
                    "ai_feedback": {"error": f"Unknown language: {language}"},
                    "score": 0
                }}
            )
            return
        
        # Prepare code for execution
        prepared_code, prep_error, code_warnings = await prepare_code_for_execution(
            source_code=source_code,
            language_id=language_id,
            question=question
        )
        
        if prep_error:
            await db.submissions.update_one(
                {"_id": ObjectId(submission_id)},
                {"$set": {
                    "status": "compilation_error",
                    "test_results": [],
                    "passed_testcases": 0,
                    "total_testcases": 0,
                    "ai_feedback": {"error": prep_error},
                    "score": 0
                }}
            )
            return
        
        # Build test cases array
        public_test_cases = []
        hidden_test_cases = []
        all_test_cases = []
        
        for i, tc in enumerate(question.get("public_testcases", [])):
            tc_data = {
                "id": f"public_{i}",
                "stdin": tc.get("input", ""),
                "expected_output": tc.get("expected_output", ""),
                "is_hidden": False,
                "points": tc.get("points", 1),
            }
            public_test_cases.append(tc_data)
            all_test_cases.append(tc_data)
        
        for i, tc in enumerate(question.get("hidden_testcases", [])):
            tc_data = {
                "id": f"hidden_{i}",
                "stdin": tc.get("input", ""),
                "expected_output": tc.get("expected_output", ""),
                "is_hidden": True,
                "points": tc.get("points", 1),
            }
            hidden_test_cases.append(tc_data)
            all_test_cases.append(tc_data)
        
        if not all_test_cases:
            await db.submissions.update_one(
                {"_id": ObjectId(submission_id)},
                {"$set": {
                    "status": "error",
                    "test_results": [],
                    "passed_testcases": 0,
                    "total_testcases": 0,
                    "ai_feedback": {"error": "No test cases for question"},
                    "score": 0
                }}
            )
            return
        
        # Run test cases
        cpu_time_limit = 2.0
        memory_limit = 128000
        
        # Get function signature for custom engine
        function_signature = None
        func_sig_data = question.get("function_signature")
        if func_sig_data:
            from ..models.question import FunctionSignature, FunctionParameter
            function_signature = FunctionSignature(
                name=func_sig_data.get("name"),
                parameters=[
                    FunctionParameter(name=p.get("name"), type=p.get("type"))
                    for p in func_sig_data.get("parameters", [])
                ],
                return_type=func_sig_data.get("return_type")
            )
        
        results = await run_all_test_cases(
            source_code=prepared_code,
            language_id=language_id,
            test_cases=all_test_cases,
            cpu_time_limit=cpu_time_limit,
            memory_limit=memory_limit,
            stop_on_compilation_error=True,
            function_signature=function_signature,
        )
        
        # Process results
        all_results = results.get("results", [])
        public_count = len(public_test_cases)
        
        public_results = []
        for i in range(public_count):
            if i < len(all_results):
                public_results.append(format_public_result(all_results[i], i + 1))
        
        full_hidden_results = []
        hidden_passed = 0
        for i in range(public_count, len(all_results)):
            hidden_index = i - public_count
            result = all_results[i]
            tc = hidden_test_cases[hidden_index]
            full_hidden_results.append(format_hidden_result_for_admin(
                result, hidden_index + 1, tc["stdin"], tc["expected_output"]
            ))
            if result.get("passed", False):
                hidden_passed += 1
        
        public_passed = sum(1 for r in public_results if r.get("passed", False))
        public_total = len(public_test_cases)
        hidden_total = len(hidden_test_cases)
        total_passed = public_passed + hidden_passed
        total_tests = public_total + hidden_total
        
        # Determine status
        if results.get("compilation_error"):
            status = "compilation_error"
        elif total_passed == total_tests:
            status = "accepted"
        elif total_passed > 0:
            status = "partially_accepted"
        else:
            status = "wrong_answer"
        
        all_test_results = public_results + full_hidden_results
        
        # Get starter code
        starter_code = None
        starter_code_dict = question.get("starter_code", {})
        if isinstance(starter_code_dict, dict):
            starter_code = starter_code_dict.get(language) or starter_code_dict.get(language.lower())
        
        # Check if starter code only
        # Pass test case info to avoid false positives when tests pass
        is_starter_only = False
        if starter_code:
            is_starter_only = is_starter_code_only(source_code, starter_code, language, total_passed, total_tests)
            if is_starter_only:
                # CRITICAL: Only mark as starter code if tests actually failed
                # If any tests passed, this cannot be starter code
                if total_passed is not None and total_tests is not None and total_tests > 0 and total_passed > 0:
                    logger.warning(f"[Background Evaluation] Tests passed ({total_passed}/{total_tests}) but is_starter_code_only returned True - overriding to False")
                    is_starter_only = False
                else:
                    logger.info(f"[Background Evaluation] Detected starter code only for submission {submission_id} (passed={total_passed}/{total_tests})")
                    status = "no_code_written"
        
        # Update submission with test results
        # SQL questions: Cleaner structure without public/hidden fields
        # DSA questions: Full structure with public/hidden fields
        if is_sql_question:
            # SQL-specific: Only include necessary fields (no public/hidden distinction)
            update_data = {
                "status": status,
                "test_results": all_test_results,
                "passed_testcases": total_passed,
                "total_testcases": total_tests,
                # Calculate execution_time and memory_used from test results
                "execution_time": sum(float(r.get("time", 0) or 0) for r in all_test_results) if all_test_results else None,
                "memory_used": max((float(r.get("memory", 0) or 0) for r in all_test_results), default=None) if all_test_results else None,
            }
        else:
            # DSA questions: Include all fields (public/hidden distinction)
            update_data = {
                "status": status,
                "test_results": all_test_results,
                "public_results": public_results,
                "hidden_results_full": full_hidden_results,
                "passed_testcases": total_passed,
                "total_testcases": total_tests,
                "public_passed": public_passed,
                "public_total": public_total,
                "hidden_passed": hidden_passed,
                "hidden_total": hidden_total,
            }
        
        if is_starter_only:
            update_data["score"] = 0
            update_data["ai_feedback"] = {
                "overall_score": 0,
                "feedback_summary": "No code was written. You submitted only the starter code template. Please implement the solution to receive a score.",
                "one_liner": "No code written | Starter code only",
                "evaluation_note": "Starter code only - no implementation provided"
            }
        
        # CRITICAL: Never overwrite the code field - it contains the user's actual submission
        # Only update status, test results, and feedback - preserve the original code
        await db.submissions.update_one(
            {"_id": ObjectId(submission_id)},
            {"$set": update_data}
        )
        
        # Log what was updated for debugging
        logger.info(f"[Background Evaluation] Updated submission {submission_id}: status={status}, passed={total_passed}/{total_tests}, is_starter_only={is_starter_only}")
        
        # Schedule AI feedback if not starter code only (non-blocking)
        if not is_starter_only:
            asyncio.create_task(process_ai_feedback_background(
                submission_id=submission_id,
                test_id=test_id,
                user_id=user_id,
                question_id=question_id,
                source_code=source_code,
                language=language,
                question_title=question.get("title", ""),
                question_description=question.get("description", ""),
                all_test_results=all_test_results,
                total_passed=total_passed,
                total_tests=total_tests,
                public_passed=public_passed,
                public_total=public_total,
                hidden_passed=hidden_passed,
                hidden_total=hidden_total,
                starter_code=starter_code
            ))
        
        logger.info(f"Completed evaluation for submission {submission_id}")
    except Exception as e:
        logger.error(f"Error in background evaluation for submission {submission_id}: {e}")
        await db.submissions.update_one(
            {"_id": ObjectId(submission_id)},
            {"$set": {
                "status": "error",
                "ai_feedback": {"error": str(e)},
                "score": 0
            }}
        )


async def process_activity_logs_background(
    test_id: str,
    user_id: str,
    activity_logs: List[Dict[str, Any]]
):
    """Background task to process and save activity logs"""
    db = get_database()
    try:
        logger.info(f"Processing activity logs in background for test {test_id}, user {user_id}")
        
        # Update test submission with activity logs
        await db.test_submissions.update_one(
            {"test_id": test_id, "user_id": user_id},
            {"$set": {"activity_logs": activity_logs}}
        )
        
        logger.info(f"Activity logs saved for test {test_id}, user {user_id}")
    except Exception as e:
        logger.error(f"Error processing activity logs: {e}")


@router.post("/{test_id}/final-submit")
async def final_submit_test(
    test_id: str,
    user_id: str = Query(..., description="User ID from link token"),
    request: FinalTestSubmissionRequest = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Final test submission - collects all code, generates AI feedback, and saves logs.
    Returns quickly (within 5 seconds) while processing AI feedback and logs in background.
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    # Get test details
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Get or create test submission
    test_submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if not test_submission:
        raise HTTPException(status_code=404, detail="Test submission not found. Please start the test first.")

    # Enforce single attempt per candidate: final submit only once.
    if test_submission.get("is_completed", False):
        raise HTTPException(status_code=400, detail="Test already submitted. A candidate can submit the test only once.")

    # Enforce single attempt per candidate email for this test (backward compatible: older submissions may not have candidate_email)
    candidate_email = (test_submission.get("candidate_email") or "").strip().lower()
    if not candidate_email:
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        candidate_email = str((user_doc or {}).get("email") or "").strip().lower()
    if candidate_email:
        existing_completed_by_email = await db.test_submissions.find_one({
            "test_id": test_id,
            "candidate_email": candidate_email,
            "is_completed": True
        })
        if existing_completed_by_email:
            raise HTTPException(status_code=400, detail="Test already submitted for this email. A candidate can submit the test only once.")
    
    # Process each question submission
    # Use asyncio.gather to run test cases in parallel for faster execution
    final_submissions = []
    total_score = 0
    
    # Process questions - save immediately, evaluate in background
    async def save_question_submission(q_sub):
        """Save question submission immediately, evaluation happens in background"""
        question_id = q_sub.question_id
        if not ObjectId.is_valid(question_id):
            return None
        
        # Get question details
        question = await db.questions.find_one({"_id": ObjectId(question_id)})
        if not question:
            return None
        
        # Detect question type - handle None case
        question_type_raw = question.get("question_type") or ""
        question_type = question_type_raw.upper() if isinstance(question_type_raw, str) else ""
        is_sql_question = question_type == "SQL"
        
        # Log the code being saved for debugging
        code_length = len(q_sub.code) if q_sub.code else 0
        logger.info(f"[final-submit] Saving code for question {question_id}: length={code_length}, language={q_sub.language}")
        
        # Create submission record immediately with "processing" status
        # Test case execution and AI feedback will happen in background
        if is_sql_question:
            # Check if execution engine results are provided (from frontend)
            if (q_sub.execution_engine_passed is not None and 
                q_sub.execution_engine_output is not None and
                q_sub.execution_engine_expected_output is not None):
                # Use execution engine results directly - no need to re-execute
                logger.info(f"[final-submit] SQL question {question_id}: Using execution engine results (passed={q_sub.execution_engine_passed})")
                
                # Format test result with execution engine data
                sql_test_result = {
                    "test_number": 1,
                    "expected_output": q_sub.execution_engine_expected_output,
                    "user_output": q_sub.execution_engine_output,
                    "status": "accepted" if q_sub.execution_engine_passed else "wrong_answer",
                    "status_id": 3 if q_sub.execution_engine_passed else 4,
                    "passed": q_sub.execution_engine_passed,
                    "time": q_sub.execution_engine_time,
                    "memory": q_sub.execution_engine_memory,
                }
                
                # SQL-specific: Cleaner structure without public/hidden fields
                submission_data = {
                    "user_id": user_id,
                    "question_id": question_id,
                    "test_id": test_id,
                    "language": "sql",
                    "code": q_sub.code,  # User written query
                    "status": "accepted" if q_sub.execution_engine_passed else "wrong_answer",
                    "test_results": [sql_test_result],
                    "passed_testcases": 1 if q_sub.execution_engine_passed else 0,
                    "total_testcases": 1,
                    "execution_time": q_sub.execution_engine_time,
                    "memory_used": q_sub.execution_engine_memory,
                    "ai_feedback": None,  # Will be generated in background
                    "score": 0,  # Will be updated after AI feedback
                    "created_at": datetime.utcnow(),
                    "is_final_submission": True,
                }
                
                # Save submission immediately
                submission_result = await db.submissions.insert_one(submission_data)
                submission_id = str(submission_result.inserted_id)
                
                # Schedule AI feedback generation in background with execution engine results
                asyncio.create_task(process_ai_feedback_background(
                    submission_id=submission_id,
                    test_id=test_id,
                    user_id=user_id,
                    question_id=question_id,
                    source_code=q_sub.code,  # User written query
                    language="sql",
                    question_title=question.get("title", ""),
                    question_description=question.get("description", ""),
                    all_test_results=[sql_test_result],
                    total_passed=1 if q_sub.execution_engine_passed else 0,
                    total_tests=1,
                    public_passed=1 if q_sub.execution_engine_passed else 0,
                    public_total=1,
                    hidden_passed=0,
                    hidden_total=0,
                    starter_code=question.get("starter_query")
                ))
                
                logger.info(f"Saved SQL submission {submission_id} with execution engine results, scheduled AI feedback in background")
                return submission_id
            else:
                # No execution engine results - use old flow (shouldn't happen in final-submit, but keep for compatibility)
                logger.warning(f"[final-submit] SQL question {question_id}: No execution engine results provided, using background evaluation")
                submission_data = {
                    "user_id": user_id,
                    "question_id": question_id,
                    "test_id": test_id,
                    "language": "sql",
                    "code": q_sub.code,  # CRITICAL: Save the actual code submitted by user
                    "status": "processing",  # Will be updated after test case execution
                    "test_results": [],
                    "passed_testcases": 0,
                    "total_testcases": 0,
                    "execution_time": None,
                    "memory_used": None,
                    "ai_feedback": None,  # Will be generated in background
                    "score": 0,  # Will be updated after AI feedback
                    "created_at": datetime.utcnow(),
                    "is_final_submission": True,
                }
        else:
            # DSA questions: Full structure with public/hidden fields
            submission_data = {
                "user_id": user_id,
                "question_id": question_id,
                "test_id": test_id,
                "language": q_sub.language,
                "code": q_sub.code,  # CRITICAL: Save the actual code submitted by user
                "status": "processing",  # Will be updated after test case execution
                "test_results": [],
                "public_results": [],
                "hidden_results_full": [],
                "passed_testcases": 0,
                "total_testcases": 0,
                "public_passed": 0,
                "public_total": 0,
                "hidden_passed": 0,
                "hidden_total": 0,
                "ai_feedback": None,  # Will be generated in background
                "score": 0,  # Will be updated after AI feedback
                "created_at": datetime.utcnow(),
                "is_final_submission": True,
            }
        
        # Save submission immediately
        submission_result = await db.submissions.insert_one(submission_data)
        submission_id = str(submission_result.inserted_id)
        
        # Schedule test case execution and AI feedback in background (non-blocking)
        asyncio.create_task(process_question_evaluation_background(
            submission_id=submission_id,
            test_id=test_id,
            user_id=user_id,
            question_id=question_id,
            source_code=q_sub.code,  # CRITICAL: Pass the actual code to background evaluation
            language=q_sub.language if not is_sql_question else "sql",
            question=question
        ))
        
        logger.info(f"Saved submission {submission_id} immediately with code (length={code_length}), scheduled evaluation in background")
        return submission_id
    
    # Removed old code - using save_question_submission + process_question_evaluation_background instead
        """Process a single question submission - OLD VERSION, kept for reference"""
        question_id = q_sub.question_id
        if not ObjectId.is_valid(question_id):
            return None
        
        # Get question details
        question = await db.questions.find_one({"_id": ObjectId(question_id)})
        if not question:
            return None
        
        # Detect question type - handle None case
        question_type_raw = question.get("question_type") or ""
        question_type = question_type_raw.upper() if isinstance(question_type_raw, str) else ""
        is_sql_question = question_type == "SQL"
        
        # Handle SQL questions differently
        if is_sql_question:
            from ..routers.assessment import (
                build_sql_script,
                execute_sql_with_judge0,
                compare_sql_results
            )
            
            # Get schemas and sample data
            schemas = question.get("schemas", {})
            sample_data = question.get("sample_data", {})
            reference_query = question.get("reference_query")
            evaluation = question.get("evaluation", {})
            order_sensitive = evaluation.get("order_sensitive", False)
            
            if not schemas:
                logger.warning(f"SQL question {question_id} has no table schemas defined")
                # SQL-specific error submission (no schemas)
                submission_data = {
                    "user_id": user_id,
                    "question_id": question_id,
                    "test_id": test_id,
                    "language": "sql",
                    "code": q_sub.code,
                    "status": "error",
                    "test_results": [{
                        "test_number": 1,
                        "expected_output": "",
                        "user_output": "",
                        "status": "error",
                        "status_id": 0,
                        "passed": False,
                        "error": "Question has no table schemas defined",
                    }],
                    "passed_testcases": 0,
                    "total_testcases": 1,
                    "execution_time": None,
                    "memory_used": None,
                    "ai_feedback": {"error": "Question has no table schemas defined"},
                    "score": 0,
                    "created_at": datetime.utcnow(),
                    "is_final_submission": True,
                }
                submission_result = await db.submissions.insert_one(submission_data)
                return str(submission_result.inserted_id)
            
            # Execute user's SQL query
            user_sql_script = build_sql_script(
                schemas=schemas,
                sample_data=sample_data,
                user_query=q_sub.code
            )
            
            logger.info(f"Executing user SQL script for question {question_id}...")
            user_result = await execute_sql_with_judge0(user_sql_script)
            
            # Check for execution errors
            if not user_result["success"]:
                status = "syntax_error" if user_result.get("status_id") == 6 else "error"
                message = user_result.get("stderr") or user_result.get("compile_output") or "SQL execution failed"
                
                # SQL-specific error submission structure
                submission_data = {
                    "user_id": user_id,
                    "question_id": question_id,
                    "test_id": test_id,
                    "language": "sql",
                    "code": q_sub.code,
                    "status": status,
                    "test_results": [{
                        "test_number": 1,
                        "expected_output": "",  # No expected output for errors
                        "user_output": "",
                        "status": status,
                        "status_id": user_result.get("status_id", 0),
                        "passed": False,
                        "error": message,  # SQL-specific: use 'error' instead of 'stderr'
                        "time": user_result.get("time"),
                        "memory": user_result.get("memory"),
                    }],
                    "passed_testcases": 0,
                    "total_testcases": 1,
                    "execution_time": user_result.get("time"),
                    "memory_used": user_result.get("memory"),
                    "ai_feedback": None,
                    "score": 0,
                    "created_at": datetime.utcnow(),
                    "is_final_submission": True,
                }
                submission_result = await db.submissions.insert_one(submission_data)
                submission_id = str(submission_result.inserted_id)
                
                # Schedule AI feedback for SQL error
                all_test_results = submission_data["test_results"]
                background_tasks.add_task(
                    process_ai_feedback_background,
                    submission_id=submission_id,
                    test_id=test_id,
                    user_id=user_id,
                    question_id=question_id,
                    source_code=q_sub.code,
                    language="sql",
                    question_title=question.get("title", ""),
                    question_description=question.get("description", ""),
                    all_test_results=all_test_results,
                    total_passed=0,
                    total_tests=1,
                    public_passed=0,
                    public_total=0,
                    hidden_passed=0,
                    hidden_total=1,
                    starter_code=question.get("starter_query")
                )
                return submission_id
            
            user_output = user_result.get("stdout", "").strip()
            
            # Execute reference query and compare
            passed = False
            expected_output = None
            if reference_query:
                ref_sql_script = build_sql_script(
                    schemas=schemas,
                    sample_data=sample_data,
                    user_query=reference_query
                )
                
                logger.info(f"Executing reference SQL script for question {question_id}...")
                ref_result = await execute_sql_with_judge0(ref_sql_script)
                
                if not ref_result["success"]:
                    logger.error(f"Reference query execution failed: {ref_result.get('stderr')}")
                    # Still proceed with user's result, but mark as error
                    status = "error"
                    message = "Reference query execution failed"
                else:
                    expected_output = ref_result.get("stdout", "").strip()
                    passed = compare_sql_results(user_output, expected_output, order_sensitive)
                    
                    # CRITICAL: Double-check the result with safety checks
                    if passed:
                        # Parse headers to verify they actually match
                        from ..routers.assessment import parse_sql_table_output
                        user_h, user_r = parse_sql_table_output(user_output)
                        exp_h, exp_r = parse_sql_table_output(expected_output)
                        
                        # If headers don't match, force False
                        if user_h != exp_h:
                            logger.error(
                                f"⚠️⚠️⚠️ CRITICAL: Comparison returned True but headers don't match in final-submit! "
                                f"User headers ({len(user_h)}): {user_h}\n"
                                f"Expected headers ({len(exp_h)}): {exp_h}\n"
                                f"FORCING passed=False"
                            )
                            passed = False
                        elif len(user_r) != len(exp_r):
                            logger.error(
                                f"⚠️ Comparison returned True but row counts don't match in final-submit! "
                                f"User: {len(user_r)} rows, Expected: {len(exp_r)} rows. "
                                f"Forcing passed=False"
                            )
                            passed = False
                    
                    status = "accepted" if passed else "wrong_answer"
                    message = "Query produces correct results!" if passed else "Query output does not match expected results"
            else:
                # No reference query - just check if query executed successfully
                passed = user_result["success"]
                status = "accepted" if passed else "error"
                message = "Query executed successfully" if passed else "Query execution failed"
            
            # Format test results for SQL (cleaner structure - no unnecessary fields)
            # SQL only has one test case, no input, no public/hidden distinction
            sql_test_result = {
                "test_number": 1,
                "expected_output": expected_output or "",  # CRITICAL: Save expected output
                "user_output": user_output,
                "status": status,
                "status_id": user_result.get("status_id", 3 if passed else 0),
                "passed": passed,
                "time": user_result.get("time"),
                "memory": user_result.get("memory"),
            }
            
            # Create SQL-specific submission record (cleaner structure - NO public/hidden fields)
            submission_data = {
                "user_id": user_id,
                "question_id": question_id,
                "test_id": test_id,
                "language": "sql",
                "code": q_sub.code,
                "status": status,
                # SQL-specific: single test result (no public/hidden distinction)
                "test_results": [sql_test_result],
                # SQL-specific: simple pass/fail counts (NO public/hidden fields)
                "passed_testcases": 1 if passed else 0,
                "total_testcases": 1,
                # Execution metrics
                "execution_time": user_result.get("time"),
                "memory_used": user_result.get("memory"),
                # AI feedback and score (will be generated in background)
                "ai_feedback": None,
                "score": 0,
                "created_at": datetime.utcnow(),
                "is_final_submission": True,
            }
            
            # Save submission immediately
            submission_result = await db.submissions.insert_one(submission_data)
            submission_id = str(submission_result.inserted_id)
            
            # Schedule AI feedback generation in background for SQL
            # Use sql_test_result as all_test_results (SQL only has one test case)
            background_tasks.add_task(
                process_ai_feedback_background,
                submission_id=submission_id,
                test_id=test_id,
                user_id=user_id,
                question_id=question_id,
                source_code=q_sub.code,
                language="sql",
                question_title=question.get("title", ""),
                question_description=question.get("description", ""),
                all_test_results=[sql_test_result],  # Use sql_test_result, not all_test_results
                total_passed=1 if passed else 0,
                total_tests=1,
                public_passed=0,  # SQL doesn't have public/hidden - set to 0
                public_total=0,   # SQL doesn't have public/hidden - set to 0
                hidden_passed=0,  # SQL doesn't have public/hidden - set to 0
                hidden_total=0,   # SQL doesn't have public/hidden - set to 0
                starter_code=question.get("starter_query")
            )
            logger.info(f"Saved SQL submission {submission_id} and scheduled AI feedback generation in background")
            return submission_id
        
        # Handle DSA coding questions (original logic)
        # Get language ID from language name
        language_id = LANGUAGE_IDS.get(q_sub.language.lower(), None)
        if not language_id:
            logger.warning(f"Unknown language: {q_sub.language}, skipping question {question_id}")
            return None
        
        # Prepare code for execution (validate + wrap if needed)
        prepared_code, prep_error, code_warnings = await prepare_code_for_execution(
            source_code=q_sub.code,
            language_id=language_id,
            question=question
        )
        
        if prep_error:
            logger.error(f"Code preparation error for question {question_id}: {prep_error}")
            # Still create submission but mark as error
            submission_data = {
                "user_id": user_id,
                "question_id": question_id,
                "test_id": test_id,
                "language": q_sub.language,
                "code": q_sub.code,
                "status": "compilation_error",
                "test_results": [],
                "passed_testcases": 0,
                "total_testcases": 0,
                "ai_feedback": {"error": prep_error},
                "score": 0,
                "created_at": datetime.utcnow(),
                "is_final_submission": True,
            }
            submission_result = await db.submissions.insert_one(submission_data)
            return str(submission_result.inserted_id)
        
        # Build test cases array - PUBLIC + HIDDEN
        public_test_cases = []
        hidden_test_cases = []
        all_test_cases = []
        
        # Add public test cases
        for i, tc in enumerate(question.get("public_testcases", [])):
            tc_data = {
                "id": f"public_{i}",
                "stdin": tc.get("input", ""),
                "expected_output": tc.get("expected_output", ""),
                "is_hidden": False,
                "points": tc.get("points", 1),
            }
            public_test_cases.append(tc_data)
            all_test_cases.append(tc_data)
        
        # Add hidden test cases
        for i, tc in enumerate(question.get("hidden_testcases", [])):
            tc_data = {
                "id": f"hidden_{i}",
                "stdin": tc.get("input", ""),
                "expected_output": tc.get("expected_output", ""),
                "is_hidden": True,
                "points": tc.get("points", 1),
            }
            hidden_test_cases.append(tc_data)
            all_test_cases.append(tc_data)
        
        if not all_test_cases:
            logger.warning(f"No test cases for question {question_id}")
            return None
        
        # Get execution constraints
        cpu_time_limit = 2.0
        memory_limit = 128000
        
        # Get function signature for custom engine
        function_signature = None
        func_sig_data = question.get("function_signature")
        if func_sig_data:
            from ..models.question import FunctionSignature, FunctionParameter
            function_signature = FunctionSignature(
                name=func_sig_data.get("name"),
                parameters=[
                    FunctionParameter(name=p.get("name"), type=p.get("type"))
                    for p in func_sig_data.get("parameters", [])
                ],
                return_type=func_sig_data.get("return_type")
            )
        
        # Run ALL test cases with prepared code
        results = await run_all_test_cases(
            source_code=prepared_code,
            language_id=language_id,
            test_cases=all_test_cases,
            cpu_time_limit=cpu_time_limit,
            memory_limit=memory_limit,
            stop_on_compilation_error=True,
            function_signature=function_signature,
        )
        
        # Process test case results
        all_results = results.get("results", [])
        public_count = len(public_test_cases)
        
        # Process public test case results
        public_results = []
        for i in range(public_count):
            if i < len(all_results):
                public_results.append(format_public_result(all_results[i], i + 1))
        
        # Process hidden test case results (full details for AI feedback)
        full_hidden_results = []
        hidden_passed = 0
        for i in range(public_count, len(all_results)):
            hidden_index = i - public_count
            result = all_results[i]
            tc = hidden_test_cases[hidden_index]
            full_hidden_results.append(format_hidden_result_for_admin(
                result, hidden_index + 1, tc["stdin"], tc["expected_output"]
            ))
            if result.get("passed", False):
                hidden_passed += 1
        
        # Calculate totals
        public_passed = sum(1 for r in public_results if r.get("passed", False))
        public_total = len(public_test_cases)
        hidden_total = len(hidden_test_cases)
        total_passed = public_passed + hidden_passed
        total_tests = public_total + hidden_total
        
        # Determine status
        if results.get("compilation_error"):
            status = "compilation_error"
        elif total_passed == total_tests:
            status = "accepted"
        elif total_passed > 0:
            status = "partially_accepted"
        else:
            status = "wrong_answer"
        
        all_test_results = public_results + full_hidden_results
        
        # Get starter code for the language
        starter_code = None
        starter_code_dict = question.get("starter_code", {})
        if isinstance(starter_code_dict, dict):
            starter_code = starter_code_dict.get(q_sub.language) or starter_code_dict.get(q_sub.language.lower())
        
        # Check if user submitted only starter code (no actual implementation)
        # If so, set score to 0 immediately without waiting for AI feedback
        # Pass test case info to avoid false positives when tests pass
        initial_score = 0
        is_starter_only = False
        if starter_code:
            is_starter_only = is_starter_code_only(q_sub.code, starter_code, q_sub.language, total_passed, total_tests)
            if is_starter_only:
                logger.info(f"User submitted only starter code for question {question_id} - setting score to 0")
                initial_score = 0
                status = "no_code_written"
        
        # Create submission record WITHOUT AI feedback (will be added in background)
        submission_data = {
            "user_id": user_id,
            "question_id": question_id,
            "test_id": test_id,
            "language": q_sub.language,
            "code": q_sub.code,
            "status": status,
            "test_results": all_test_results,
            "public_results": public_results,
            "hidden_results_full": full_hidden_results,
            "passed_testcases": total_passed,
            "total_testcases": total_tests,
            "public_passed": public_passed,
            "public_total": public_total,
            "hidden_passed": hidden_passed,
            "hidden_total": hidden_total,
            "ai_feedback": None,  # Will be generated in background
            "score": initial_score,  # Set to 0 if starter code only, otherwise will be updated in background
            "created_at": datetime.utcnow(),
            "is_final_submission": True,
        }
        
        # Save submission immediately
        submission_result = await db.submissions.insert_one(submission_data)
        submission_id = str(submission_result.inserted_id)
        
        # If starter code only, skip AI feedback generation (score is already 0)
        # Otherwise, schedule AI feedback generation in background
        if not is_starter_only:
            background_tasks.add_task(
                process_ai_feedback_background,
                submission_id=submission_id,
                test_id=test_id,
                user_id=user_id,
                question_id=question_id,
                source_code=q_sub.code,
                language=q_sub.language,
                question_title=question.get("title", ""),
                question_description=question.get("description", ""),
                all_test_results=all_test_results,
                total_passed=total_passed,
                total_tests=total_tests,
                public_passed=public_passed,
                public_total=public_total,
                hidden_passed=hidden_passed,
                hidden_total=hidden_total,
                starter_code=starter_code
            )
            logger.info(f"Saved submission {submission_id} and scheduled AI feedback generation in background")
        else:
            # For starter code only, create a simple feedback record immediately
            ai_feedback_starter = {
                "overall_score": 0,
                "feedback_summary": "No code was written. You submitted only the starter code template. Please implement the solution to receive a score.",
                "one_liner": "No code written | Starter code only",
                "evaluation_note": "Starter code only - no implementation provided"
            }
            await db.submissions.update_one(
                {"_id": ObjectId(submission_id)},
                {"$set": {"ai_feedback": ai_feedback_starter}}
            )
            logger.info(f"Saved submission {submission_id} with starter code only - score set to 0, no AI feedback needed")
        
        return submission_id
    
    # Save all submissions immediately (evaluation happens in background)
    # Log all question submissions for debugging
    for q_sub in request.question_submissions:
        code_preview = (q_sub.code[:100] + "...") if q_sub.code and len(q_sub.code) > 100 else (q_sub.code or "")
        logger.info(f"[final-submit] Processing question {q_sub.question_id}: code_length={len(q_sub.code) if q_sub.code else 0}, language={q_sub.language}, code_preview={code_preview}")
        # Warn if code is empty or very short (might be starter code)
        if not q_sub.code or len(q_sub.code.strip()) < 10:
            logger.warning(f"[final-submit] WARNING: Question {q_sub.question_id} has very short or empty code (length={len(q_sub.code) if q_sub.code else 0})")
    
    submission_tasks = [save_question_submission(q_sub) for q_sub in request.question_submissions]
    submission_ids = await asyncio.gather(*submission_tasks)
    final_submissions = [sid for sid in submission_ids if sid is not None]
    
    # Calculate initial overall score out of 100 (including starter code only submissions which have score 0).
    # Normalize across questions so multi-question tests still score out of 100.
    initial_total_score = 0
    if final_submissions:
        all_submissions = await db.submissions.find({
            "_id": {"$in": [ObjectId(sid) for sid in final_submissions]}
        }).to_list(length=100)
        
        question_count = max(len(request.question_submissions), 1)
        scored = []
        for sub in all_submissions:
            if sub.get("ai_feedback") is not None or sub.get("status") == "no_code_written":
                scored.append(sub.get("score", 0))
            else:
                # If feedback not ready, use 0 as placeholder
                scored.append(0)
        
        # Ensure we have scores for all questions
        while len(scored) < question_count:
            scored.append(0)
        
        # Calculate total score: sum all question scores, then normalize to 100
        total_sum = sum(scored)
        initial_total_score = int(round(total_sum / question_count))
        
        # Ensure score is between 0 and 100
        initial_total_score = max(0, min(100, initial_total_score))
    
    # Update test submission with final data (without activity logs - will be added in background)
    update_data = {
        "is_completed": True,
        "submitted_at": datetime.utcnow(),
        "submissions": final_submissions,
        "score": initial_total_score,  # Overall score out of 100
        "final_submission_data": {
            "question_submissions": [
                {
                    "question_id": q_sub.question_id,
                    "language": q_sub.language,
                    "code_length": len(q_sub.code),
                }
                for q_sub in request.question_submissions
            ],
            "submitted_at": datetime.utcnow().isoformat(),
        }
    }
    
    await db.test_submissions.update_one(
        {"test_id": test_id, "user_id": user_id},
        {"$set": update_data}
    )
    
    # Schedule activity logs processing in background
    if request.activity_logs:
        background_tasks.add_task(
            process_activity_logs_background,
            test_id=test_id,
            user_id=user_id,
            activity_logs=request.activity_logs
        )
    
    # Return submission summary immediately (AI feedback and logs processing in background)
    return {
        "message": "Test submitted successfully. AI feedback and logs are being processed in the background.",
        "test_id": test_id,
        "user_id": user_id,
        "submissions_count": len(final_submissions),
        "total_score": initial_total_score,  # out of 100
        "submitted_at": update_data["submitted_at"].isoformat(),
        "ai_feedback_status": "processing",  # Indicates AI feedback is being generated
    }


@router.post("/{test_id}/add-candidate")
async def add_candidate(
    test_id: str,
    candidate: AddCandidateRequest
):
    """
    Add a candidate to a test (creates user account)
    Uses a single shared test link for all candidates
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if not test.get("is_published", False):
        raise HTTPException(status_code=400, detail="Test must be published before adding candidates")
    
    # Normalize email for consistent lookups
    candidate.email = candidate.email.strip().lower()

    # Check if candidate already exists for this test
    existing_candidate = await db.test_candidates.find_one({
        "test_id": test_id,
        "email": candidate.email
    })
    if existing_candidate:
        raise HTTPException(status_code=400, detail="Candidate already added to this test")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": candidate.email})
    if existing_user:
        user_id = str(existing_user["_id"])
    else:
        # Create new user account
        user_dict = {
            "username": candidate.name.lower().replace(" ", "_"),
            "email": candidate.email,
            "hashed_password": "",  # No password - candidates use shared link
            "is_admin": False,
            "total_score": 0,
            "questions_solved": 0,
        }
        result = await db.users.insert_one(user_dict)
        user_id = str(result.inserted_id)
    
    # Store candidate record (no link_token needed - using shared test token)
    candidate_record = {
        "test_id": test_id,
        "user_id": user_id,
        "name": candidate.name,
        "email": candidate.email,
        # Optional Aaptor ID linkage for employee/candidate
        "aaptorId": getattr(candidate, "aaptorId", None),
        # Link candidate to same organization as the test (if present)
        "organization": test.get("organization"),
        "status": "pending",  # pending -> invited -> started -> completed
        "invited": False,
        "invited_at": None,
        "created_at": datetime.utcnow(),
    }
    await db.test_candidates.insert_one(candidate_record)
    
    # Add email to invited_users if not already there
    current_invited = set([str(e).strip().lower() for e in test.get("invited_users", [])])
    current_invited.add(candidate.email)
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": {"invited_users": list(current_invited)}}
    )
    
    # Ensure shared test token exists (one per test)
    test_token = test.get("test_token")
    if not test_token:
        test_token = secrets.token_urlsafe(32)
        await db.tests.update_one(
            {"_id": ObjectId(test_id)},
            {"$set": {"test_token": test_token}}
        )

    # Build full test URL using shared test token
    # Use cors_origins to get frontend URL, or default to localhost:3000
    settings = get_settings()
    cors_origins = settings.cors_origins.split(",")[0].strip() if settings.cors_origins else "http://localhost:3000"
    test_link = f"{cors_origins}/test/{test_id}?token={test_token}"
    
    # IMPORTANT: Do NOT send emails on add-candidate.
    # Invitations are sent only when explicitly triggered from Analytics/Test Management (Send Email buttons).

    return {
        "candidate_id": user_id,
        "test_link": test_link,
        "name": candidate.name,
        "email": candidate.email,
    }


@router.post("/{test_id}/send-invitation", response_model=dict)
async def send_invitation(
    test_id: str,
    email: str = Body(..., embed=True),
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Send invitation email to a single candidate (explicit action only).
    Uses test.invitationTemplate if configured, otherwise system default template.
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")

    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()

    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    test_created_by = test.get("created_by")
    if not test_created_by or str(test_created_by).strip() != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to send invitations for this test")

    if not test.get("is_published", False):
        raise HTTPException(status_code=400, detail="Test must be published before sending invitations")

    candidate_email = str(email or "").strip().lower()
    if not candidate_email:
        raise HTTPException(status_code=400, detail="Email is required")

    candidate = await db.test_candidates.find_one({"test_id": test_id, "email": candidate_email})
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found for this test")

    candidate_name = candidate.get("name") or "Candidate"

    settings = get_settings()
    cors_origins = settings.cors_origins.split(",")[0].strip() if settings.cors_origins else "http://localhost:3000"

    # Use shared test token for invitations (legacy, stateless links)
    test_token = test.get("test_token")
    if not test_token:
      test_token = secrets.token_urlsafe(32)
      await db.tests.update_one({"_id": ObjectId(test_id)}, {"$set": {"test_token": test_token}})

    test_link = f"{cors_origins}/test/{test_id}?token={test_token}"

    stored_template = test.get("invitationTemplate", {})
    default_template = {
        "logoUrl": "",
        "companyName": "",
        "message": "You have been invited to take a DSA test. Please click the link below to start.",
        "footer": "",
        "sentBy": "AI Assessment Platform"
    }
    template_to_use = stored_template if stored_template else default_template

    if not settings.sendgrid_api_key or not settings.sendgrid_from_email:
        raise HTTPException(status_code=500, detail="Email service is not configured")

    email_service = get_email_service()

    encoded_email = urllib.parse.quote(candidate_email)
    encoded_name = urllib.parse.quote(candidate_name)
    exam_url_with_params = f"{test_link}&email={encoded_email}&name={encoded_name}"

    message = template_to_use.get("message", default_template["message"])
    email_body = message
    email_body = email_body.replace("{{candidate_name}}", candidate_name)
    email_body = email_body.replace("{{candidate_email}}", candidate_email)
    email_body = email_body.replace("{{exam_url}}", exam_url_with_params)
    email_body = email_body.replace("{{company_name}}", template_to_use.get("companyName", ""))

    logo_url = template_to_use.get("logoUrl", "")
    company_name = template_to_use.get("companyName", "")
    footer = template_to_use.get("footer", "")
    sent_by = template_to_use.get("sentBy", "AI Assessment Platform")

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ max-width: 200px; margin-bottom: 20px; }}
            .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
            .button {{ display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
            .footer {{ text-align: center; color: #64748b; font-size: 0.875rem; margin-top: 30px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                {f'<img src="{logo_url}" alt="Logo" class="logo" />' if logo_url else ''}
                {f'<h1>{company_name}</h1>' if company_name else ''}
            </div>
            <div class="content">
                <p>Dear {candidate_name},</p>
                <p>{email_body}</p>
                <div style="text-align: center;">
                    <a href="{exam_url_with_params}" class="button">Start Test</a>
                </div>
            </div>
            {f'<div class="footer"><p>{footer}</p></div>' if footer else ''}
            <div class="footer">
                <p>Sent by {sent_by}</p>
            </div>
        </div>
    </body>
    </html>
    """

    subject = f"DSA Test Invitation - {company_name if company_name else 'AI Assessment Platform'}"
    await email_service.send_email(candidate_email, subject, html_content)

    await db.test_candidates.update_one(
        {"test_id": test_id, "email": candidate_email},
        {"$set": {"status": "invited", "invited": True, "invited_at": datetime.utcnow()}}
    )

    return {"message": "Invitation sent", "email": candidate_email}


@router.post("/{test_id}/send-invitations-to-all")
async def send_invitations_to_all(
    test_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Send invitation emails to all candidates for a test
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    # Check if test exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Verify ownership
    test_created_by = test.get("created_by")
    if not test_created_by or str(test_created_by).strip() != user_id.strip():
        raise HTTPException(status_code=403, detail="You don't have permission to access this test")
    
    if not test.get("is_published", False):
        raise HTTPException(status_code=400, detail="Test must be published before sending invitations")
    
    # Get all candidates for this test
    candidates = await db.test_candidates.find({"test_id": test_id}).to_list(length=1000)
    if not candidates:
        raise HTTPException(status_code=400, detail="No candidates found for this test")
    
    # Get test token
    test_token = test.get("test_token")
    if not test_token:
        test_token = secrets.token_urlsafe(32)
        await db.tests.update_one(
            {"_id": ObjectId(test_id)},
            {"$set": {"test_token": test_token}}
        )
    
    # Build test URL
    settings = get_settings()
    cors_origins = settings.cors_origins.split(",")[0].strip() if settings.cors_origins else "http://localhost:3000"
    base_test_link = f"{cors_origins}/test/{test_id}?token={test_token}"
    
    # Get email template
    stored_template = test.get("invitationTemplate", {})
    default_template = {
        "logoUrl": "",
        "companyName": "",
        "message": "You have been invited to take a DSA test. Please click the link below to start.",
        "footer": "",
        "sentBy": "AI Assessment Platform"
    }
    template_to_use = stored_template if stored_template else default_template
    
    # Send emails to all candidates
    results = {
        "success": [],
        "failed": []
    }
    
    if not settings.sendgrid_api_key or not settings.sendgrid_from_email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SendGrid is not configured"
        )
    
    try:
        email_service = get_email_service()
        
        for candidate in candidates:
            # Extract candidate info before try block so it's available for status update
            candidate_email = candidate.get("email")
            candidate_name = candidate.get("name", "Candidate")
            
            if not candidate_email:
                results["failed"].append({"email": "unknown", "reason": "Email not found"})
                # Still try to update status even if email is missing
                try:
                    await db.test_candidates.update_one(
                        {"test_id": test_id, "_id": candidate.get("_id")},
                        {"$set": {
                            "status": "invited",
                            "invited": True,
                            "invited_at": datetime.utcnow()
                        }}
                    )
                except Exception:
                    pass
                continue
            
            try:
                
                # Build exam URL with candidate params
                encoded_email = urllib.parse.quote(candidate_email)
                encoded_name = urllib.parse.quote(candidate_name)
                exam_url_with_params = f"{base_test_link}&email={encoded_email}&name={encoded_name}"
                
                # Replace placeholders
                message = template_to_use.get("message", default_template["message"])
                email_body = message
                email_body = email_body.replace("{{candidate_name}}", candidate_name)
                email_body = email_body.replace("{{candidate_email}}", candidate_email)
                email_body = email_body.replace("{{exam_url}}", exam_url_with_params)
                email_body = email_body.replace("{{company_name}}", template_to_use.get("companyName", ""))
                
                # Build HTML email
                logo_url = template_to_use.get("logoUrl", "")
                company_name = template_to_use.get("companyName", "")
                footer = template_to_use.get("footer", "")
                sent_by = template_to_use.get("sentBy", "AI Assessment Platform")
                
                html_content = f"""
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                        .header {{ text-align: center; margin-bottom: 30px; }}
                        .logo {{ max-width: 200px; margin-bottom: 20px; }}
                        .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
                        .button {{ display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                        .footer {{ text-align: center; color: #64748b; font-size: 0.875rem; margin-top: 30px; }}
                        .candidate-info {{ background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #3b82f6; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            {f'<img src="{logo_url}" alt="Logo" class="logo" />' if logo_url else ''}
                            {f'<h1>{company_name}</h1>' if company_name else ''}
                        </div>
                        <div class="content">
                            <p>Dear {candidate_name},</p>
                            <p>{email_body}</p>
                            <div class="candidate-info">
                                <p><strong>Your Details:</strong></p>
                                <p><strong>Name:</strong> {candidate_name}</p>
                                <p><strong>Email:</strong> {candidate_email}</p>
                            </div>
                            <div style="text-align: center;">
                                <a href="{exam_url_with_params}" class="button">Start Test</a>
                            </div>
                        </div>
                        {f'<div class="footer"><p>{footer}</p></div>' if footer else ''}
                        <div class="footer">
                            <p>Sent by {sent_by}</p>
                        </div>
                    </div>
                </body>
                </html>
                """
                
                subject = f"DSA Test Invitation - {company_name if company_name else 'AI Assessment Platform'}"
                
                await email_service.send_email(candidate_email, subject, html_content)
                results["success"].append({"email": candidate_email, "name": candidate_name})
                logger.info(f"Invitation email sent successfully to {candidate_email}")
            except Exception as e:
                logger.error(f"Failed to send invitation email to {candidate.get('email', 'unknown')}: {str(e)}")
                results["failed"].append({"email": candidate.get("email", "unknown"), "reason": str(e)})
            
            # Update candidate status to "invited" regardless of email success
            try:
                update_result = await db.test_candidates.update_one(
                    {"test_id": test_id, "email": candidate_email},
                    {"$set": {
                        "status": "invited",
                        "invited": True,
                        "invited_at": datetime.utcnow()
                    }}
                )
                if update_result.matched_count > 0:
                    logger.info(f"Updated candidate status to 'invited' for {candidate_email}")
                else:
                    logger.warning(f"Could not find candidate to update status for {candidate_email}")
            except Exception as update_error:
                logger.error(f"Failed to update candidate status for {candidate_email}: {str(update_error)}")
        
        return {
            "message": f"Invitation emails sent to {len(results['success'])} candidates",
            "success_count": len(results["success"]),
            "failed_count": len(results["failed"]),
            "success": results["success"],
            "failed": results["failed"]
        }
    except Exception as e:
        logger.error(f"Error sending invitations to all candidates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send invitations: {str(e)}")


@router.post("/{test_id}/bulk-add-candidates")
async def bulk_add_candidates(
    test_id: str,
    file: UploadFile = File(...)
):
    """
    Bulk add candidates from CSV file
    CSV format: name,email (header row required)
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if not test.get("is_published", False):
        raise HTTPException(status_code=400, detail="Test must be published before adding candidates")
    
    # Read CSV file
    contents = await file.read()
    try:
        csv_text = contents.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding. Please use UTF-8 encoded CSV.")
    
    csv_reader = csv.DictReader(io.StringIO(csv_text))
    
    # Validate CSV format
    if not csv_reader.fieldnames or 'name' not in csv_reader.fieldnames or 'email' not in csv_reader.fieldnames:
        raise HTTPException(
            status_code=400,
            detail="CSV must have 'name' and 'email' columns"
        )
    
    results = {
        "success": [],
        "failed": [],
        "duplicates": []
    }
    
    current_invited = set(test.get("invited_users", []))
    
    for row in csv_reader:
        name = row.get('name', '').strip()
        email = row.get('email', '').strip()
        
        if not name or not email:
            results["failed"].append({
                "name": name or "N/A",
                "email": email or "N/A",
                "reason": "Name or email is empty"
            })
            continue
        
        # Check if candidate already exists for this test
        existing_candidate = await db.test_candidates.find_one({
            "test_id": test_id,
            "email": email
        })
        
        if existing_candidate:
            results["duplicates"].append({
                "name": name,
                "email": email,
                "reason": "Already added to this test"
            })
            continue
        
        try:
            # Check if user already exists
            existing_user = await db.users.find_one({"email": email})
            if existing_user:
                user_id = str(existing_user["_id"])
            else:
                # Create new user account
                user_dict = {
                    "username": name.lower().replace(" ", "_"),
                    "email": email,
                    "hashed_password": "",
                    "is_admin": False,
                    "total_score": 0,
                    "questions_solved": 0,
                }
                result = await db.users.insert_one(user_dict)
                user_id = str(result.inserted_id)
            
            # Generate unique test link token
            link_token = secrets.token_urlsafe(32)
            
            # Store candidate record
            candidate_record = {
                "test_id": test_id,
                "user_id": user_id,
                "name": name,
                "email": email,
                "link_token": link_token,
                # Keep candidate organization in sync with the test's organization
                "organization": test.get("organization"),
                "status": "pending",  # pending -> invited -> started -> completed
                "invited": False,
                "invited_at": None,
                "created_at": datetime.utcnow(),
            }
            await db.test_candidates.insert_one(candidate_record)
            
            # Add email to invited_users
            current_invited.add(email)
            
            test_link = f"/test/{test_id}?token={link_token}"
            
            results["success"].append({
                "name": name,
                "email": email,
                "test_link": test_link,
                "candidate_id": user_id
            })
        except Exception as e:
            results["failed"].append({
                "name": name,
                "email": email,
                "reason": str(e)
            })
    
    # Update test with all invited users
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": {"invited_users": list(current_invited)}}
    )
    
    return {
        "message": f"Processed {len(results['success']) + len(results['failed']) + len(results['duplicates'])} candidates",
        "success_count": len(results["success"]),
        "failed_count": len(results["failed"]),
        "duplicate_count": len(results["duplicates"]),
        "results": results
    }


@router.get("/{test_id}/candidates/{user_id}/resume")
async def get_candidate_resume(
    test_id: str,
    user_id: str,
    email: str = Query(..., description="Candidate email"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get candidate resume file for viewing in analytics.
    Returns resume as base64 data URL if available.
    """
    logger.info(f"[get_candidate_resume] Request received: test_id={test_id}, user_id={user_id}, email={email}")
    db = get_database()
    
    # Get current user ID
    current_user_id = current_user.get("id") or current_user.get("_id")
    if not current_user_id:
        logger.error(f"[get_candidate_resume] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    current_user_id = str(current_user_id).strip()
    
    # Verify test exists and belongs to current user
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        logger.warning(f"[get_candidate_resume] Test not found: {test_id}")
        raise HTTPException(status_code=404, detail="Test not found")
    
    # CRITICAL SECURITY CHECK: Verify ownership
    test_created_by = test.get("created_by")
    if not test_created_by or str(test_created_by).strip() != current_user_id:
        logger.error(f"[get_candidate_resume] SECURITY ISSUE: User {current_user_id} attempted to access resume for test {test_id} created by {test_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to view resumes for this test")
    
    # Normalize email for query
    normalized_email = email.strip().lower()
    
    # Try to find candidate by user_id first (more reliable, matches analytics endpoint), then fallback to email
    candidate = None
    query_attempts = []
    
    # Attempt 1: Query by user_id (preferred, matches analytics endpoint)
    if ObjectId.is_valid(user_id):
        query_by_user_id = {
            "test_id": test_id,
            "user_id": user_id
        }
        query_attempts.append(f"user_id={user_id}")
        candidate = await db.test_candidates.find_one(query_by_user_id)
        if candidate:
            logger.info(f"[get_candidate_resume] Found candidate by user_id: {user_id}, email={candidate.get('email')}")
    
    # Attempt 2: Query by email (fallback)
    if not candidate:
        query_by_email = {
            "test_id": test_id,
            "email": normalized_email
        }
        query_attempts.append(f"email={normalized_email}")
        candidate = await db.test_candidates.find_one(query_by_email)
        if candidate:
            logger.info(f"[get_candidate_resume] Found candidate by email: {normalized_email}, user_id={candidate.get('user_id')}")
    
    # Attempt 3: Try both user_id and email together (most specific)
    if not candidate and ObjectId.is_valid(user_id):
        query_both = {
            "test_id": test_id,
            "user_id": user_id,
            "email": normalized_email
        }
        query_attempts.append(f"user_id={user_id} AND email={normalized_email}")
        candidate = await db.test_candidates.find_one(query_both)
        if candidate:
            logger.info(f"[get_candidate_resume] Found candidate by both user_id and email")
    
    # Log all candidates for this test for debugging
    if not candidate:
        all_candidates = await db.test_candidates.find({"test_id": test_id}).to_list(length=100)
        logger.warning(f"[get_candidate_resume] Candidate not found after trying: {', '.join(query_attempts)}")
        logger.warning(f"[get_candidate_resume] Total candidates for test {test_id}: {len(all_candidates)}")
        if all_candidates:
            logger.warning(f"[get_candidate_resume] Sample candidate emails: {[c.get('email') for c in all_candidates[:5]]}")
            logger.warning(f"[get_candidate_resume] Sample candidate user_ids: {[str(c.get('user_id')) for c in all_candidates[:5]]}")
        raise HTTPException(status_code=404, detail=f"Candidate not found for test_id={test_id}, user_id={user_id}, email={normalized_email}")
    
    # Verify email matches if both were provided
    candidate_email = candidate.get("email", "").strip().lower()
    if candidate_email != normalized_email:
        logger.warning(f"[get_candidate_resume] Email mismatch: candidate.email={candidate_email}, requested={normalized_email}")
        # Don't fail, but log the mismatch
    
    # Get candidateInfo
    candidate_info = candidate.get("candidateInfo", {})
    
    # Log candidateInfo structure for debugging
    logger.info(f"[get_candidate_resume] CandidateInfo keys: {list(candidate_info.keys()) if candidate_info else 'None'}")
    logger.info(f"[get_candidate_resume] hasResume={candidate_info.get('hasResume', False)}")
    logger.info(f"[get_candidate_resume] resume field exists={('resume' in candidate_info)}")
    
    # Check if resume exists
    if not candidate_info.get("hasResume", False):
        logger.warning(f"[get_candidate_resume] Resume not uploaded (hasResume=False): test_id={test_id}, email={candidate_email}, user_id={user_id}")
        raise HTTPException(status_code=404, detail="Resume not uploaded for this candidate")
    
    # Get resume from candidateInfo (stored as base64)
    resume_data = candidate_info.get("resume")
    if not resume_data:
        logger.warning(f"[get_candidate_resume] Resume file not found in candidateInfo: test_id={test_id}, email={candidate_email}, user_id={user_id}, candidateInfo keys: {list(candidate_info.keys())}")
        raise HTTPException(status_code=404, detail="Resume file not found in candidate record")
    
    # Validate resume data format
    if not isinstance(resume_data, str):
        logger.error(f"[get_candidate_resume] Resume data is not a string: type={type(resume_data)}")
        raise HTTPException(status_code=500, detail="Invalid resume data format")
    
    resume_size = len(resume_data)
    logger.info(f"[get_candidate_resume] Successfully retrieved resume: test_id={test_id}, email={candidate_email}, user_id={user_id}, size={resume_size} bytes")
    
    # Return resume as data URL
    resume_data_url = resume_data if resume_data.startswith("data:") else f"data:application/pdf;base64,{resume_data}"
    return {
        "resume": resume_data_url,
        "candidate_name": candidate.get("name", ""),
        "candidate_email": candidate_email
    }


@router.get("/{test_id}/candidates/{user_id}/analytics")
async def get_candidate_analytics(
    test_id: str,
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get detailed analytics for a candidate including AI feedback (requires authentication and ownership)
    Only test creators can view candidate analytics
    """
    db = get_database()
    # Get current user ID
    current_user_id = current_user.get("id") or current_user.get("_id")
    if not current_user_id:
        logger.error(f"[get_candidate_analytics] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    current_user_id = str(current_user_id).strip()
    
    # Verify test exists and belongs to current user
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # CRITICAL SECURITY CHECK: Verify ownership
    test_created_by = test.get("created_by")
    if not test_created_by or str(test_created_by).strip() != current_user_id:
        logger.error(f"[get_candidate_analytics] SECURITY ISSUE: User {current_user_id} attempted to access analytics for test {test_id} created by {test_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to view analytics for this test")
    if not ObjectId.is_valid(test_id) or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid test ID or user ID")
    
    # Get candidate info
    candidate = await db.test_candidates.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Get candidateInfo from candidate record (even if no submission)
    candidate_info = candidate.get("candidateInfo", {})
    
    # Get test submission
    submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if not submission:
        return {
            "candidate": {
                "name": candidate.get("name", ""),
                "email": candidate.get("email", ""),
            },
            "candidateInfo": candidate_info if candidate_info else None,  # Include candidate requirements data
            "submission": None,
            "question_analytics": []
        }
    
    # Get all submissions for this test
    submission_ids = submission.get("submissions", [])
    question_analytics = []
    
    for sub_id in submission_ids:
        if isinstance(sub_id, ObjectId):
            sub_id_str = str(sub_id)
        else:
            sub_id_str = sub_id
        
        try:
            sub = await db.submissions.find_one({"_id": ObjectId(sub_id_str)})
            if sub:
                # Get question details
                question = await db.questions.find_one({"_id": ObjectId(sub["question_id"])})
                
                question_analytics.append({
                    "question_id": sub["question_id"],
                    "question_title": question.get("title", "Unknown") if question else "Unknown",
                    "language": sub.get("language", ""),
                    "status": sub.get("status", ""),
                    "passed_testcases": sub.get("passed_testcases", 0),
                    "total_testcases": sub.get("total_testcases", 0),
                    "execution_time": sub.get("execution_time"),
                    "memory_used": sub.get("memory_used"),
                    "code": sub.get("code", ""),
                    "test_results": sub.get("test_results", []),
                    "ai_feedback": sub.get("ai_feedback"),
                    "created_at": sub.get("created_at").isoformat() if sub.get("created_at") else None,
                })
        except Exception:
            continue
    
    # Get activity logs
    activity_logs = submission.get("activity_logs", [])
    
    return {
        "candidate": {
            "name": candidate.get("name", ""),
            "email": candidate.get("email", ""),
        },
        "candidateInfo": candidate_info if candidate_info else None,  # Include candidate requirements data
        "submission": {
            "score": submission.get("score", 0),
            "started_at": submission.get("started_at").isoformat() if submission.get("started_at") else None,
            "submitted_at": submission.get("submitted_at").isoformat() if submission.get("submitted_at") else None,
            "is_completed": submission.get("is_completed", False),
        },
        "question_analytics": question_analytics,
        "activity_logs": activity_logs,
    }


@router.post("/{test_id}/candidates/{user_id}/send-feedback")
async def send_candidate_feedback(
    test_id: str,
    user_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Send AI feedback email to a candidate (only available after test end time).
    Includes detailed feedback, scores, test results, and improvement suggestions.
    """
    db = get_database()
    
    # Get current user ID
    current_user_id = current_user.get("id") or current_user.get("_id")
    if not current_user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    current_user_id = str(current_user_id).strip()
    
    # Verify test exists and belongs to current user
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # CRITICAL SECURITY CHECK: Verify ownership
    test_created_by = test.get("created_by")
    if not test_created_by or str(test_created_by).strip() != current_user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to send feedback for this test")
    
    # Check if test has ended
    schedule = test.get("schedule", {})
    end_time = schedule.get("endTime") if isinstance(schedule, dict) else None
    if not end_time and hasattr(test, "endTime"):
        end_time = test.get("endTime")
    if not end_time and hasattr(test, "end_time"):
        end_time = test.get("end_time")
    
    if end_time:
        if isinstance(end_time, str):
            from dateutil import parser
            end_time = parser.parse(end_time)
        if isinstance(end_time, datetime):
            if datetime.utcnow() < end_time.replace(tzinfo=None):
                raise HTTPException(status_code=400, detail="Cannot send feedback before test end time")
    
    # Get candidate
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    candidate = await db.test_candidates.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    candidate_name = candidate.get("name", "Candidate")
    candidate_email = candidate.get("email", "")
    
    if not candidate_email:
        raise HTTPException(status_code=400, detail="Candidate email not found")
    
    # Get candidate analytics (same logic as get_candidate_analytics)
    submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if not submission:
        raise HTTPException(status_code=400, detail="Candidate has not submitted the test yet")
    
    # Get all submissions for this test
    submission_ids = submission.get("submissions", [])
    question_analytics = []
    
    for sub_id in submission_ids:
        if isinstance(sub_id, ObjectId):
            sub_id_str = str(sub_id)
        else:
            sub_id_str = sub_id
        
        try:
            sub = await db.submissions.find_one({"_id": ObjectId(sub_id_str)})
            if sub:
                # Get question details
                question = await db.questions.find_one({"_id": ObjectId(sub["question_id"])})
                
                question_analytics.append({
                    "question_id": sub["question_id"],
                    "question_title": question.get("title", "Unknown") if question else "Unknown",
                    "language": sub.get("language", ""),
                    "status": sub.get("status", ""),
                    "passed_testcases": sub.get("passed_testcases", 0),
                    "total_testcases": sub.get("total_testcases", 0),
                    "execution_time": sub.get("execution_time"),
                    "memory_used": sub.get("memory_used"),
                    "code": sub.get("code", ""),
                    "test_results": sub.get("test_results", []),
                    "ai_feedback": sub.get("ai_feedback"),
                    "created_at": sub.get("created_at").isoformat() if sub.get("created_at") else None,
                })
        except Exception:
            continue
    
    # Check email service configuration
    settings = get_settings()
    if not settings.sendgrid_api_key or not settings.sendgrid_from_email:
        raise HTTPException(status_code=500, detail="Email service is not configured")
    
    email_service = get_email_service()
    
    # Build HTML email with feedback
    test_title = test.get("title", "DSA Test")
    company_name = test.get("invitationTemplate", {}).get("companyName", "") if isinstance(test.get("invitationTemplate"), dict) else ""
    logo_url = test.get("invitationTemplate", {}).get("logoUrl", "") if isinstance(test.get("invitationTemplate"), dict) else ""
    
    # Format feedback HTML
    feedback_html = ""
    total_score = submission.get("score", 0)
    
    for idx, qa in enumerate(question_analytics, 1):
        ai_feedback = qa.get("ai_feedback", {})
        if not ai_feedback:
            continue
        
        feedback_html += f"""
        <div style="margin-bottom: 2rem; padding: 1.5rem; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <h3 style="margin-top: 0; color: #1e293b; font-size: 1.25rem;">Question {idx}: {qa.get('question_title', 'Unknown')}</h3>
            <div style="margin-bottom: 1rem;">
                <span style="padding: 0.25rem 0.75rem; background-color: {'#d1fae5' if qa.get('status') == 'accepted' else '#fee2e2'}; color: {'#065f46' if qa.get('status') == 'accepted' else '#991b1b'}; border-radius: 9999px; font-size: 0.875rem; font-weight: 600;">
                    {qa.get('status', 'pending').upper()}
                </span>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <div style="font-weight: 600; color: #475569; margin-bottom: 0.5rem;">Test Case Results</div>
                <div style="color: #64748b; font-size: 0.875rem;">
                    Language: {qa.get('language', 'N/A')}
        """
        
        # Get test breakdown from AI feedback if available
        test_breakdown = ai_feedback.get("test_breakdown", {})
        if test_breakdown:
            public_passed = test_breakdown.get("public_passed", 0)
            public_total = test_breakdown.get("public_total", 0)
            hidden_passed = test_breakdown.get("hidden_passed", 0)
            hidden_total = test_breakdown.get("hidden_total", 0)
            total_passed = test_breakdown.get("total_passed", 0)
            total_tests = test_breakdown.get("total_tests", 0)
            
            feedback_html += f"""<br>
                    Public Test Cases: {public_passed} / {public_total}<br>
                    Hidden Test Cases: {hidden_passed} / {hidden_total}<br>
                    <strong>Total: {total_passed} / {total_tests}</strong>
                </div>
            </div>
        """
        else:
            # Fallback to basic test case info
            feedback_html += f"""<br>
                    Test Cases: {qa.get('passed_testcases', 0)} / {qa.get('total_testcases', 0)}
                </div>
            </div>
        """
        
        overall_score = ai_feedback.get("overall_score", 0)
        if overall_score is not None:
            feedback_html += f"""
            <div style="margin-bottom: 1rem; padding: 1rem; background-color: #ffffff; border-radius: 6px;">
                <div style="font-weight: 600; color: #1e293b; margin-bottom: 0.5rem;">AI Feedback</div>
                <div style="font-size: 1.125rem; font-weight: 700; color: #3b82f6; margin-bottom: 0.5rem;">
                    Score: {overall_score}/100
                </div>
            """
            
            if ai_feedback.get("feedback_summary"):
                feedback_html += f"""
                <div style="color: #475569; margin-bottom: 1rem; line-height: 1.6;">
                    {ai_feedback.get('feedback_summary')}
                </div>
                """
            
            # Code Quality
            code_quality = ai_feedback.get("code_quality", {})
            if code_quality:
                feedback_html += f"""
                <div style="margin-bottom: 1rem; padding: 0.75rem; background-color: #f1f5f9; border-radius: 6px;">
                    <div style="font-weight: 600; color: #334155; margin-bottom: 0.5rem;">Code Quality ({code_quality.get('score', 0)}/100)</div>
                    <div style="color: #475569; font-size: 0.875rem; line-height: 1.6;">
                        {code_quality.get('comments', '')}
                    </div>
                </div>
                """
            
            # Efficiency
            efficiency = ai_feedback.get("efficiency", {})
            if efficiency:
                feedback_html += f"""
                <div style="margin-bottom: 1rem; padding: 0.75rem; background-color: #f1f5f9; border-radius: 6px;">
                    <div style="font-weight: 600; color: #334155; margin-bottom: 0.5rem;">Efficiency Analysis</div>
                    <div style="color: #475569; font-size: 0.875rem; margin-bottom: 0.5rem;">
                        <strong>Time Complexity:</strong> {efficiency.get('time_complexity', 'N/A')}<br>
                        <strong>Space Complexity:</strong> {efficiency.get('space_complexity', 'N/A')}
                    </div>
                    {f'<div style="color: #475569; font-size: 0.875rem; line-height: 1.6;">{efficiency.get("comments", "")}</div>' if efficiency.get("comments") else ''}
                </div>
                """
            
            # Correctness
            correctness = ai_feedback.get("correctness", {})
            if correctness:
                feedback_html += f"""
                <div style="margin-bottom: 1rem; padding: 0.75rem; background-color: #f1f5f9; border-radius: 6px;">
                    <div style="font-weight: 600; color: #334155; margin-bottom: 0.5rem;">Correctness ({correctness.get('score', 0)}/100)</div>
                    <div style="color: #475569; font-size: 0.875rem; line-height: 1.6;">
                        {correctness.get('comments', '')}
                    </div>
                </div>
                """
            
            # Strengths
            strengths = ai_feedback.get("strengths", [])
            if strengths:
                feedback_html += f"""
                <div style="margin-bottom: 1rem; padding: 0.75rem; background-color: #d1fae5; border-radius: 6px; border-left: 3px solid #10b981;">
                    <div style="font-weight: 600; color: #065f46; margin-bottom: 0.5rem;">✓ Strengths</div>
                    <ul style="margin: 0; padding-left: 1.25rem; color: #047857; font-size: 0.875rem;">
                        {''.join([f'<li style="margin-bottom: 0.25rem;">{s}</li>' for s in strengths])}
                    </ul>
                </div>
                """
            
            # Areas for Improvement
            areas_for_improvement = ai_feedback.get("areas_for_improvement", [])
            if areas_for_improvement:
                feedback_html += f"""
                <div style="margin-bottom: 1rem; padding: 0.75rem; background-color: #fee2e2; border-radius: 6px; border-left: 3px solid #ef4444;">
                    <div style="font-weight: 600; color: #991b1b; margin-bottom: 0.5rem;">⚠ Areas for Improvement</div>
                    <ul style="margin: 0; padding-left: 1.25rem; color: #b91c1c; font-size: 0.875rem;">
                        {''.join([f'<li style="margin-bottom: 0.25rem;">{a}</li>' for a in areas_for_improvement])}
                    </ul>
                </div>
                """
            
            # Improvement Suggestions
            improvement_suggestions = ai_feedback.get("improvement_suggestions", [])
            if improvement_suggestions:
                feedback_html += f"""
                <div style="margin-bottom: 1rem; padding: 0.75rem; background-color: #dbeafe; border-radius: 6px; border-left: 3px solid #3b82f6;">
                    <div style="font-weight: 600; color: #1e40af; margin-bottom: 0.5rem;">💡 Improvement Suggestions</div>
                    <ul style="margin: 0; padding-left: 1.25rem; color: #1e3a8a; font-size: 0.875rem;">
                        {''.join([f'<li style="margin-bottom: 0.25rem;">{s}</li>' for s in improvement_suggestions])}
                    </ul>
                </div>
                """
            
            # Suggestions
            suggestions = ai_feedback.get("suggestions", [])
            if suggestions:
                feedback_html += f"""
                <div style="margin-bottom: 1rem; padding: 0.75rem; background-color: #e0e7ff; border-radius: 6px; border-left: 3px solid #6366f1;">
                    <div style="font-weight: 600; color: #312e81; margin-bottom: 0.5rem;">💡 Suggestions</div>
                    <ul style="margin: 0; padding-left: 1.25rem; color: #4338ca; font-size: 0.875rem;">
                        {''.join([f'<li style="margin-bottom: 0.25rem;">{s}</li>' for s in suggestions])}
                    </ul>
                </div>
                """
            
            feedback_html += "</div>"
        
        feedback_html += "</div>"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 800px; margin: 0 auto; padding: 20px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ max-width: 200px; margin-bottom: 20px; }}
            .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
            .footer {{ text-align: center; color: #64748b; font-size: 0.875rem; margin-top: 30px; }}
            .score-summary {{ background-color: #3b82f6; color: white; padding: 1.5rem; border-radius: 8px; text-align: center; margin-bottom: 2rem; }}
            .score-summary h2 {{ margin: 0; font-size: 2rem; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                {f'<img src="{logo_url}" alt="Logo" class="logo" />' if logo_url else ''}
                {f'<h1>{company_name}</h1>' if company_name else ''}
            </div>
            <div class="content">
                <p>Dear {candidate_name},</p>
                <p>Thank you for completing the <strong>{test_title}</strong>. Below is your detailed AI feedback and performance analysis.</p>
                
                <div class="score-summary">
                    <h2>Overall Score: {total_score}/100</h2>
                </div>
                
                {feedback_html if feedback_html else '<p>No feedback available at this time.</p>'}
                
                <p style="margin-top: 2rem;">We hope this feedback helps you understand your performance and areas for improvement.</p>
            </div>
            <div class="footer">
                <p>Sent by {test.get('invitationTemplate', {}).get('sentBy', 'AI Assessment Platform') if isinstance(test.get('invitationTemplate'), dict) else 'AI Assessment Platform'}</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    subject = f"Your Test Feedback - {test_title}"
    try:
        await email_service.send_email(candidate_email, subject, html_content)
    except RuntimeError as e:
        error_msg = str(e)
        # Check if it's a SendGrid authentication/authorization error
        if "403" in error_msg or "Forbidden" in error_msg:
            logger.error(f"SendGrid authentication error when sending feedback email: {error_msg}")
            raise HTTPException(
                status_code=502,
                detail="Email service authentication failed. Please check SendGrid API key configuration."
            )
        # Check for other SendGrid errors
        elif "HTTP error" in error_msg or "SendGrid" in error_msg:
            logger.error(f"SendGrid error when sending feedback email: {error_msg}")
            raise HTTPException(
                status_code=502,
                detail="Failed to send email via email service. Please try again later or contact support."
            )
        # Generic email error
        else:
            logger.error(f"Error sending feedback email: {error_msg}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to send feedback email: {error_msg}"
            )
    except Exception as e:
        logger.error(f"Unexpected error sending feedback email: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while sending the feedback email. Please try again later."
        )
    
    return {"message": "Feedback email sent successfully", "email": candidate_email}


@router.get("/{test_id}/candidates")
async def get_test_candidates(
    test_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all candidates for a test (requires authentication and ownership)
    Only test creators can view candidates
    """
    db = get_database()
    # Get current user ID
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"[get_test_candidates] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    
    # Verify test exists and belongs to current user
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # CRITICAL SECURITY CHECK: Verify ownership
    test_created_by = test.get("created_by")
    if not test_created_by or str(test_created_by).strip() != user_id:
        logger.error(f"[get_test_candidates] SECURITY ISSUE: User {user_id} attempted to access candidates for test {test_id} created by {test_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to view candidates for this test")
    
    candidates = await db.test_candidates.find({"test_id": test_id}).sort("created_at", -1).to_list(length=1000)
    
    result = []
    for candidate in candidates:
        # Get submission status
        submission = await db.test_submissions.find_one({
            "test_id": test_id,
            "user_id": candidate["user_id"]
        })
        
        # Determine status based on candidate record and submission
        # Priority: completed > started > invited (from DB) > pending
        candidate_status = candidate.get("status", "pending")
        if submission and submission.get("is_completed", False):
            candidate_status = "completed"
        elif submission:
            candidate_status = "started"
        elif candidate.get("status") == "invited" or candidate.get("invited", False) or candidate.get("invited_at"):
            candidate_status = "invited"
        else:
            candidate_status = "pending"
        
        result.append({
            "candidate_id": str(candidate["_id"]),
            "user_id": candidate["user_id"],
            "name": candidate.get("name", ""),
            "email": candidate.get("email", ""),
            "status": candidate_status,
            "invited": candidate.get("invited", False),
            "invited_at": candidate.get("invited_at").isoformat() if candidate.get("invited_at") else None,
            "created_at": candidate.get("created_at").isoformat() if candidate.get("created_at") else None,
            "has_submitted": submission is not None and submission.get("is_completed", False),
            "submission_score": submission.get("score", 0) if submission else 0,
            "submitted_at": submission.get("submitted_at").isoformat() if submission and submission.get("submitted_at") else None,
        })
    
    return result


@router.delete("/{test_id}/candidates/{user_id}")
async def remove_candidate(
    test_id: str,
    user_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Remove a candidate from a DSA test (requires authentication and ownership)
    """
    db = get_database()
    admin_user_id = current_user.get("id") or current_user.get("_id")
    if not admin_user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    admin_user_id = str(admin_user_id).strip()
    
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Verify test ownership
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # CRITICAL SECURITY CHECK: Verify ownership
    test_created_by = test.get("created_by")
    if not test_created_by or str(test_created_by).strip() != admin_user_id:
        logger.error(f"[remove_candidate] SECURITY ISSUE: User {admin_user_id} attempted to remove candidate from test {test_id} created by {test_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to remove candidates from this test")
    
    # Get candidate info
    candidate = await db.test_candidates.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    candidate_email = candidate.get("email", "")
    
    # Remove candidate record
    await db.test_candidates.delete_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    # Remove from invited_users list
    current_invited = set([str(e).strip().lower() for e in test.get("invited_users", [])])
    current_invited.discard(candidate_email.lower())
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": {"invited_users": list(current_invited)}}
    )
    
    return {"message": "Candidate removed successfully"}


@router.post("/{test_id}/bulk-add-candidates")
async def bulk_add_candidates(
    test_id: str,
    file: UploadFile = File(...)
):
    """
    Bulk add candidates from CSV file
    CSV format: name,email (header row required)
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if not test.get("is_published", False):
        raise HTTPException(status_code=400, detail="Test must be published before adding candidates")
    
    # Read CSV file
    contents = await file.read()
    try:
        csv_text = contents.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding. Please use UTF-8 encoded CSV.")
    
    csv_reader = csv.DictReader(io.StringIO(csv_text))
    
    # Validate CSV format
    if not csv_reader.fieldnames or 'name' not in csv_reader.fieldnames or 'email' not in csv_reader.fieldnames:
        raise HTTPException(
            status_code=400,
            detail="CSV must have 'name' and 'email' columns"
        )
    
    results = {
        "success": [],
        "failed": [],
        "duplicates": []
    }
    
    current_invited = set(test.get("invited_users", []))
    
    for row in csv_reader:
        name = row.get('name', '').strip()
        email = row.get('email', '').strip()
        
        if not name or not email:
            results["failed"].append({
                "name": name or "N/A",
                "email": email or "N/A",
                "reason": "Name or email is empty"
            })
            continue
        
        # Check if candidate already exists for this test
        existing_candidate = await db.test_candidates.find_one({
            "test_id": test_id,
            "email": email
        })
        
        if existing_candidate:
            results["duplicates"].append({
                "name": name,
                "email": email,
                "reason": "Already added to this test"
            })
            continue
        
        try:
            # Check if user already exists
            existing_user = await db.users.find_one({"email": email})
            if existing_user:
                user_id = str(existing_user["_id"])
            else:
                # Create new user account
                user_dict = {
                    "username": name.lower().replace(" ", "_"),
                    "email": email,
                    "hashed_password": "",
                    "is_admin": False,
                    "total_score": 0,
                    "questions_solved": 0,
                }
                result = await db.users.insert_one(user_dict)
                user_id = str(result.inserted_id)
            
            # Generate unique test link token
            link_token = secrets.token_urlsafe(32)
            
            # Store candidate record
            candidate_record = {
                "test_id": test_id,
                "user_id": user_id,
                "name": name,
                "email": email,
                "link_token": link_token,
                # Keep candidate organization in sync with the test's organization
                "organization": test.get("organization"),
                "status": "pending",  # pending -> invited -> started -> completed
                "invited": False,
                "invited_at": None,
                "created_at": datetime.utcnow(),
            }
            await db.test_candidates.insert_one(candidate_record)
            
            # Add email to invited_users
            current_invited.add(email)
            
            test_link = f"/test/{test_id}?token={link_token}"
            
            results["success"].append({
                "name": name,
                "email": email,
                "test_link": test_link,
                "candidate_id": user_id
            })
        except Exception as e:
            results["failed"].append({
                "name": name,
                "email": email,
                "reason": str(e)
            })
    
    # Update test with all invited users
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": {"invited_users": list(current_invited)}}
    )
    
    return {
        "message": f"Processed {len(results['success']) + len(results['failed']) + len(results['duplicates'])} candidates",
        "success_count": len(results["success"]),
        "failed_count": len(results["failed"]),
        "duplicate_count": len(results["duplicates"]),
        "results": results
    }


@router.get("/{test_id}/full", response_model=dict)
async def get_test_full_for_candidate(
    test_id: str,
    token: Optional[str] = Query(None, description="Test token for verification")
):
    """
    DSA-specific equivalent of get-assessment-full for candidate pipeline.
    Returns full test metadata (schedule, candidateRequirements, proctoringSettings, etc.)
    without requiring the generic AI assessment service.
    Public endpoint (no auth required) - candidates access via token in URL.
    """
    db = get_database()
    logger.info(f"[get_test_full_for_candidate] Request for test_id={test_id}, hasToken={bool(token)}")
    
    if not ObjectId.is_valid(test_id):
        logger.warning(f"[get_test_full_for_candidate] Invalid test_id format: {test_id}")
        raise HTTPException(status_code=400, detail="Invalid test ID")

    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        logger.warning(f"[get_test_full_for_candidate] Test not found: {test_id}")
        raise HTTPException(status_code=404, detail="Test not found")

   
    if token:
        test_token = test.get("test_token")
        if token != test_token:
            # Backward compatibility: some older invitations used per-candidate link_token
            candidate = await db.test_candidates.find_one(
                {"test_id": test_id, "link_token": token}
            )
            if not candidate:
                # Don't block access - token will be validated later in the flow
                # Just log a warning for debugging
                logger.info(f"[get_test_full_for_candidate] Token mismatch for test {test_id}, but allowing access for metadata fetch")
    
    # Ensure this is a DSA test (or defaulted as such)
    test_type = test.get("test_type", "dsa")
    if test_type and test_type not in ("dsa", None):
        logger.warning(f"[get_test_full_for_candidate] Test {test_id} is not DSA type (type={test_type})")
        raise HTTPException(status_code=404, detail="Test not found")
    
    logger.info(f"[get_test_full_for_candidate] Found DSA test {test_id}, title={test.get('title', 'N/A')}")

    # Format datetime helper
    def format_datetime_iso(dt_val):
        if not dt_val:
            return None
        if isinstance(dt_val, datetime):
            iso_str = dt_val.isoformat()
            if not iso_str.endswith('Z') and '+' not in iso_str[-6:]:
                return iso_str + 'Z'
            return iso_str
        return str(dt_val) if dt_val else None

    # Serialize schedule to handle datetime objects
    schedule = test.get("schedule") or {}
    serialized_schedule = {}
    if isinstance(schedule, dict):
        for key, value in schedule.items():
            if isinstance(value, datetime):
                serialized_schedule[key] = format_datetime_iso(value)
            elif isinstance(value, ObjectId):
                serialized_schedule[key] = str(value)
            elif isinstance(value, dict):
                # Recursively serialize nested dicts
                serialized_nested = {}
                for nested_key, nested_value in value.items():
                    if isinstance(nested_value, datetime):
                        serialized_nested[nested_key] = format_datetime_iso(nested_value)
                    elif isinstance(nested_value, ObjectId):
                        serialized_nested[nested_key] = str(nested_value)
                    else:
                        serialized_nested[nested_key] = nested_value
                serialized_schedule[key] = serialized_nested
            elif isinstance(value, list):
                # Serialize list items
                serialized_list = []
                for item in value:
                    if isinstance(item, datetime):
                        serialized_list.append(format_datetime_iso(item))
                    elif isinstance(item, ObjectId):
                        serialized_list.append(str(item))
                    else:
                        serialized_list.append(item)
                serialized_schedule[key] = serialized_list
            else:
                serialized_schedule[key] = value
    
    # Shape mirrors the admin list/get response and includes schedule.candidateRequirements
    test_dict = {
        "id": str(test["_id"]),
        "title": test.get("title", ""),
        "description": test.get("description", ""),
        "duration_minutes": test.get("duration_minutes", 0),
        "start_time": format_datetime_iso(test.get("start_time")),
        "end_time": format_datetime_iso(test.get("end_time")),
        "timer_mode": test.get("timer_mode", "GLOBAL"),
        "question_timings": test.get("question_timings"),
        "examMode": test.get("examMode", "strict"),
        "schedule": serialized_schedule,
        "is_active": test.get("is_active", False),
        "is_published": test.get("is_published", False),
        "question_ids": [str(qid) if isinstance(qid, ObjectId) else str(qid) for qid in test.get("question_ids", [])],
        "test_token": test.get("test_token"),
        "created_by": str(test.get("created_by")) if test.get("created_by") is not None else None,
        "test_type": test_type or "dsa",
        "created_at": format_datetime_iso(test.get("created_at")),
        # Include proctoring settings so precheck/candidate-requirements can read them if needed
        "proctoringSettings": normalize_proctoring_settings(test.get("proctoringSettings")),
    }
    
    # Ensure proctoringSettings is also in the schedule object (for frontend compatibility)
    # Frontend checks schedule.proctoringSettings first, then falls back to top-level
    if isinstance(test_dict.get("schedule"), dict):
        if "proctoringSettings" not in test_dict["schedule"]:
            test_dict["schedule"]["proctoringSettings"] = test_dict["proctoringSettings"]
    elif not test_dict.get("schedule"):
        # If schedule doesn't exist, create it with proctoringSettings
        test_dict["schedule"] = {"proctoringSettings": test_dict["proctoringSettings"]}

    # Return in the same envelope shape as /api/v1/candidate/get-assessment-full
    return {
        "success": True,
        "message": "Assessment fetched successfully",
        "data": test_dict
    }

@router.get("/{test_id}/verify-link")
async def verify_test_link(test_id: str, token: str):
    """
    Verify test link token (shared token for all candidates)
    Returns test info if token is valid
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")

    # Verify the shared test token or a legacy per-candidate link_token
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    test_token = test.get("test_token")

    if token != test_token:
        # Backward compatibility: some older invitations used per-candidate link_token
        candidate = await db.test_candidates.find_one(
            {"test_id": test_id, "link_token": token}
        )
        if not candidate:
            raise HTTPException(status_code=404, detail="Invalid test link")

    if not test.get("is_published", False):
        raise HTTPException(status_code=403, detail="Test is not published")
    # Return schedule with candidateRequirements for candidate requirements page
    schedule = test.get("schedule") or {}
    logger.info(f"[verify_test_link] Test schedule: {schedule}")
    logger.info(f"[verify_test_link] CandidateRequirements in schedule: {schedule.get('candidateRequirements', {})}")
    
    return {
        "test_id": test_id,
        "test_title": test.get("title", ""),
        "title": test.get("title", ""),  # Also return as 'title' for consistency
        "test_description": test.get("description", ""),
        "description": test.get("description", ""),  # Also return as 'description' for consistency
        "duration_minutes": test.get("duration_minutes", 60),
        "duration": test.get("duration_minutes", 60),  # Also return as 'duration' for consistency
        "schedule": schedule,  # Include schedule with candidateRequirements
        "valid": True,
    }


@router.post("/{test_id}/verify-candidate")
async def verify_candidate(
    test_id: str,
    email: str = Query(..., description="Candidate email"),
    name: str = Query(..., description="Candidate name")
):
    """
    Verify candidate email/name and return user_id
    Used with shared test link
    NEW: Also checks if test has started/ended and returns timing info
    """
    from datetime import datetime, timedelta
    
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    # Find candidate by email
    candidate = await db.test_candidates.find_one({
        "test_id": test_id,
        "email": email.strip().lower()
    })
    
    if not candidate:
        raise HTTPException(status_code=404, detail="Email not found in candidate list for this test")
    
    # Verify name matches (case-insensitive)
    if candidate.get("name", "").lower() != name.strip().lower():
        raise HTTPException(status_code=400, detail="Name does not match the email")
    
    user_id = candidate["user_id"]
    
    # Check access time windows based on exam mode
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    exam_mode = test.get("examMode", "strict")
    schedule = test.get("schedule") or {}
    start_time_raw = schedule.get("startTime") if isinstance(schedule, dict) else None
    end_time_raw = schedule.get("endTime") if isinstance(schedule, dict) else None
    duration_minutes = schedule.get("duration") if isinstance(schedule, dict) else test.get("duration_minutes")
    access_time_before_start = test.get("accessTimeBeforeStart", 15)
    
    # Parse datetime (handle both string and datetime objects)
    def _parse_datetime(val):
        if val is None:
            return None
        if isinstance(val, datetime):
            return val.replace(tzinfo=None) if val.tzinfo else val
        if isinstance(val, str):
            try:
                return datetime.fromisoformat(val.replace('Z', '+00:00')).replace(tzinfo=None)
            except (ValueError, AttributeError):
                try:
                    from dateutil import parser
                    parsed = parser.parse(val)
                    return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
                except (ImportError, ValueError):
                    return None
        return None
    
    start_time_dt = _parse_datetime(start_time_raw) if start_time_raw else _parse_datetime(test.get("start_time"))
    end_time_dt = _parse_datetime(end_time_raw) if end_time_raw else _parse_datetime(test.get("end_time"))
    
    now = datetime.utcnow()
    
    # Check start time and return info (don't block if test hasn't started, let frontend show popup)
    test_has_started = False
    test_has_ended = False
    
    if exam_mode == "strict" and start_time_dt:
        # Strict mode: Check access time before start
        access_start_time = start_time_dt - timedelta(minutes=access_time_before_start)
        
        if now < access_start_time:
            # Too early - cannot access yet
            access_start_time_formatted = access_start_time.strftime('%Y-%m-%d %H:%M:%S UTC')
            raise HTTPException(
                status_code=403,
                detail=f"You cannot access this assessment yet. Access will be available {access_time_before_start} minutes before the start time. Access opens at {access_start_time_formatted}."
            )
        
        # Calculate end time if not provided
        if not end_time_dt and duration_minutes:
            end_time_dt = start_time_dt + timedelta(minutes=int(duration_minutes))
        
        # Check if test has actually started (after access window opens)
        test_has_started = now >= start_time_dt
        
        # Check if test has ended
        if end_time_dt:
            test_has_ended = now >= end_time_dt
    
    elif exam_mode == "flexible":
        if not start_time_dt:
            raise HTTPException(status_code=400, detail="Assessment schedule is not properly configured")
        
        # For flexible mode, check if we're before start time (but don't block - let frontend show popup)
        if now < start_time_dt:
            test_has_started = False
            # Don't raise error - let frontend show popup
        else:
            test_has_started = True
        
        # Check if test has ended (window has closed - return info but don't block, let frontend show popup)
        if end_time_dt:
            test_has_ended = now > end_time_dt
    
    return {
        "user_id": user_id,
        "name": candidate["name"],
        "email": candidate["email"],
        "test_id": test_id,
        "test_has_started": test_has_started,
        "test_has_ended": test_has_ended,
        "start_time": start_time_dt.isoformat() if start_time_dt else None,
        "end_time": end_time_dt.isoformat() if end_time_dt else None,
        "exam_mode": exam_mode,
    }


class PublishTestRequest(BaseModel):
    is_published: bool

@router.patch("/{test_id}/publish")
async def publish_test(
    test_id: str,
    request: PublishTestRequest = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Publish or unpublish a test (requires authentication and ownership)
    When publishing, generates a single shared test token if not already exists
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    # Check if test exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Verify ownership
    test_created_by = test.get("created_by")
    if not test_created_by or str(test_created_by).strip() != user_id.strip():
        logger.error(f"[publish_test] SECURITY ISSUE: User {user_id} attempted to publish/unpublish test {test_id} created by {test_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to publish/unpublish this test")
    
    # Use boolean directly from request body
    is_published_bool = request.is_published
    
    update_data = {"is_published": is_published_bool}
    
    # If publishing and no token exists, generate a shared test token
    if is_published_bool:
        if not test.get("test_token"):
            update_data["test_token"] = secrets.token_urlsafe(32)
    
    result = await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Convert ObjectId to string and ensure all fields are JSON serializable
    test_dict = {
        "id": str(test["_id"]),
        "title": test.get("title", ""),
        "description": test.get("description", ""),
        "duration_minutes": test.get("duration_minutes", 0),
        "start_time": test.get("start_time").isoformat() if test.get("start_time") else None,
        "end_time": test.get("end_time").isoformat() if test.get("end_time") else None,
        "is_active": test.get("is_active", False),
        "is_published": test.get("is_published", False),
        "invited_users": test.get("invited_users", []),
        "question_ids": [str(qid) if isinstance(qid, ObjectId) else qid for qid in test.get("question_ids", [])],
        "question_time_limits": test.get("question_time_limits"),
        "test_token": test.get("test_token"),
    }
    return test_dict


@router.post("/{test_id}/save-candidate-info")
async def save_dsa_candidate_info(
    test_id: str,
    payload: Dict[str, Any]
):
    """
    Save candidate information for DSA tests (phone, LinkedIn, GitHub, resume status).
    This is called from the candidate requirements page.
    """
    from datetime import datetime, timezone
    
    db = get_database()
    
    try:
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")
        
        test = await db.tests.find_one({"_id": ObjectId(test_id)})
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        email = payload.get("email", "").strip().lower()
        name = payload.get("name", "").strip()
        phone = payload.get("phone", "").strip() if payload.get("phone") else None
        hasResume = payload.get("hasResume", False)
        resume = payload.get("resume") 
        linkedIn = payload.get("linkedIn", "").strip() if payload.get("linkedIn") else None
        github = payload.get("github", "").strip() if payload.get("github") else None
        customFields = payload.get("customFields", {}) if payload.get("customFields") else {}
        
        if not email or not name:
            raise HTTPException(status_code=400, detail="Email and name are required")
        
        # Find candidate by email (normalized)
        logger.info(f"[save_dsa_candidate_info] Looking for candidate: test_id={test_id}, email={email}")
        candidate = await db.test_candidates.find_one({
            "test_id": test_id,
            "email": email
        })
        
        if not candidate:
            # Try to find all candidates for this test to help debug
            all_candidates = await db.test_candidates.find({"test_id": test_id}).to_list(length=100)
            logger.warning(f"[save_dsa_candidate_info] Candidate not found: test_id={test_id}, email={email}")
            logger.warning(f"[save_dsa_candidate_info] Total candidates for test: {len(all_candidates)}")
            if all_candidates:
                logger.warning(f"[save_dsa_candidate_info] Sample candidate emails: {[c.get('email') for c in all_candidates[:5]]}")
            raise HTTPException(status_code=404, detail="Candidate not found for this test")
        
        logger.info(f"[save_dsa_candidate_info] Found candidate: user_id={candidate.get('user_id')}, email={candidate.get('email')}, name={candidate.get('name')}")
        
        # Get existing candidateInfo to preserve resume if it exists
        # Re-fetch candidate right before update to get latest data (handles race conditions)
        latest_candidate = await db.test_candidates.find_one({
            "test_id": test_id,
            "email": email
        })
        existing_candidate_info = latest_candidate.get("candidateInfo", {}) if latest_candidate else {}
        existing_resume = existing_candidate_info.get("resume")
        
        if existing_resume:
            logger.info(f"[save_dsa_candidate_info] Found existing resume in DB: size={len(existing_resume) if isinstance(existing_resume, str) else 0} bytes")
        else:
            logger.info(f"[save_dsa_candidate_info] No existing resume found in DB")
        
        # Store candidate info
        candidate_info = {
            "email": email,
            "name": name,
            "phone": phone,
            "hasResume": hasResume,
            "savedAt": datetime.now(timezone.utc).isoformat(),
        }
        
        # Store resume file if provided
        if resume:
            resume_size = len(resume) if isinstance(resume, str) else 0
            logger.info(f"[save_dsa_candidate_info] Storing resume: size={resume_size} bytes, hasResume={hasResume}")
            candidate_info["resume"] = resume
        elif hasResume:
            # If hasResume is True but no resume provided, preserve existing resume
            if existing_resume:
                logger.info(f"[save_dsa_candidate_info] Preserving existing resume (hasResume=True but no new resume provided)")
                candidate_info["resume"] = existing_resume
            else:
                # hasResume is True but no resume exists - this shouldn't happen, but log it
                logger.warning(f"[save_dsa_candidate_info] hasResume=True but no resume data provided and no existing resume found. This may indicate a race condition or failed upload.")
                # Don't set resume field - let hasResume be True but resume be missing (will be caught by validation)
        else:
            logger.info(f"[save_dsa_candidate_info] No resume data provided, hasResume={hasResume}, existing_resume={'exists' if existing_resume else 'none'}")
            # If hasResume is False, don't include resume field
        
        if linkedIn:
            candidate_info["linkedIn"] = linkedIn
        elif existing_candidate_info.get("linkedIn"):
            # Preserve existing LinkedIn if not provided
            candidate_info["linkedIn"] = existing_candidate_info.get("linkedIn")
        
        if github:
            candidate_info["github"] = github
        elif existing_candidate_info.get("github"):
            # Preserve existing GitHub if not provided
            candidate_info["github"] = existing_candidate_info.get("github")
        
        if customFields:
            # Merge with existing customFields
            existing_custom_fields = existing_candidate_info.get("customFields", {})
            if existing_custom_fields:
                candidate_info["customFields"] = {**existing_custom_fields, **customFields}
            else:
                candidate_info["customFields"] = customFields
        elif existing_candidate_info.get("customFields"):
            # Preserve existing customFields if not provided
            candidate_info["customFields"] = existing_candidate_info.get("customFields")
        
        # Update candidate record with candidateInfo
        update_result = await db.test_candidates.update_one(
            {"test_id": test_id, "email": email},
            {"$set": {"candidateInfo": candidate_info}}
        )
        
        logger.info(f"[save_dsa_candidate_info] Update result: matched={update_result.matched_count}, modified={update_result.modified_count}")
        
        # Verify the update was successful
        if update_result.matched_count == 0:
            logger.error(f"[save_dsa_candidate_info] Failed to update candidate record: test_id={test_id}, email={email}")
            raise HTTPException(status_code=500, detail="Failed to save candidate information")
        
        # Verify the resume was saved
        if resume:
            updated_candidate = await db.test_candidates.find_one({
                "test_id": test_id,
                "email": email
            })
            if updated_candidate:
                saved_candidate_info = updated_candidate.get("candidateInfo", {})
                saved_resume = saved_candidate_info.get("resume")
                if saved_resume:
                    logger.info(f"[save_dsa_candidate_info] Resume verified in DB: size={len(saved_resume) if isinstance(saved_resume, str) else 0} bytes")
                else:
                    logger.error(f"[save_dsa_candidate_info] Resume NOT found in DB after save!")
        
        return {
            "success": True,
            "message": "Candidate information saved successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error saving DSA candidate info: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save candidate info: {str(e)}"
        )


@router.post("/{test_id}/pause", response_model=dict)
async def pause_test(
    test_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Pause a DSA test.
    Keeps the test published (is_published stays True) but records pausedAt.
    Candidates can still be added; new test starts should be blocked while paused.
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")

    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()

    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if str(test.get("created_by", "")).strip() != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to pause this test")

    # If already paused, return idempotently
    if test.get("pausedAt"):
        return {"message": "Test is already paused", "test_id": test_id, "is_published": test.get("is_published", False), "pausedAt": test.get("pausedAt").isoformat() if test.get("pausedAt") else None}

    now = datetime.utcnow()
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": {"pausedAt": now, "statusBeforePause": "published" if test.get("is_published", False) else "draft"}}
    )

    return {"message": "Test paused successfully", "test_id": test_id, "is_published": test.get("is_published", False), "pausedAt": now.isoformat()}


@router.post("/{test_id}/resume", response_model=dict)
async def resume_test(
    test_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Resume a paused DSA test.
    Mirrors AIML: sets is_published back to True and records resumeAt timestamp.
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")

    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()

    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if str(test.get("created_by", "")).strip() != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to resume this test")

    # If not paused, return idempotently
    if not test.get("pausedAt"):
        return {"message": "Test is already active", "test_id": test_id, "is_published": test.get("is_published", False)}

    now = datetime.utcnow()
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": {"resumeAt": now, "pausedAt": None, "statusBeforePause": None}}
    )

    return {"message": "Test resumed successfully", "test_id": test_id, "is_published": test.get("is_published", False), "resumeAt": now.isoformat()}


@router.post("/{test_id}/clone", response_model=dict)
async def clone_test(
    test_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Clone a DSA test for the current editor (creates a new test document with a new ID).
    Payload:
      - newTitle: str (required)
      - keepSchedule: bool (optional, default False)
      - keepCandidates: bool (optional, default False)
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")

    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()

    original = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not original:
        raise HTTPException(status_code=404, detail="Test not found")

    # Ensure DSA test (legacy may not have test_type)
    if original.get("test_type") not in (None, "dsa"):
        raise HTTPException(status_code=400, detail="Not a DSA test")

    if str(original.get("created_by", "")).strip() != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to clone this test")

    new_title = (payload.get("newTitle") or "").strip()
    if len(new_title) < 3:
        raise HTTPException(status_code=400, detail="newTitle must be at least 3 characters")

    keep_schedule = bool(payload.get("keepSchedule", False))
    keep_candidates = bool(payload.get("keepCandidates", False))

    now = datetime.utcnow()
    duration_minutes = int(original.get("duration_minutes") or 60)

    cloned = {k: v for k, v in original.items() if k != "_id"}
    cloned["title"] = new_title
    cloned["created_by"] = user_id
    cloned["created_at"] = now
    cloned["updated_at"] = now
    cloned["is_published"] = False
    cloned["is_active"] = False
    cloned["pausedAt"] = None
    cloned["statusBeforePause"] = None
    cloned["resumeAt"] = None
    cloned["test_token"] = None
    cloned["test_type"] = "dsa"

    if not keep_candidates:
        cloned["invited_users"] = []

    if keep_schedule:
        if not cloned.get("start_time"):
            cloned["start_time"] = now
        if not cloned.get("end_time"):
            cloned["end_time"] = now + timedelta(minutes=duration_minutes)
    else:
        cloned["examMode"] = "strict"
        cloned["schedule"] = None
        cloned["start_time"] = now
        cloned["end_time"] = now + timedelta(minutes=duration_minutes)

    res = await db.tests.insert_one(cloned)
    created = await db.tests.find_one({"_id": res.inserted_id})
    if not created:
        raise HTTPException(status_code=500, detail="Failed to clone test")

    return {
        "message": "Test cloned successfully",
        "data": {
            "id": str(created["_id"]),
            "title": created.get("title", ""),
            "description": created.get("description", ""),
            "duration_minutes": created.get("duration_minutes", 0),
            "start_time": created.get("start_time").isoformat() if created.get("start_time") else None,
            "end_time": created.get("end_time").isoformat() if created.get("end_time") else None,
            "examMode": created.get("examMode", "strict"),
            "schedule": created.get("schedule"),
            "is_active": created.get("is_active", False),
            "is_published": created.get("is_published", False),
            "invited_users": created.get("invited_users", []),
            "question_ids": [str(qid) if isinstance(qid, ObjectId) else qid for qid in created.get("question_ids", [])],
            "question_time_limits": created.get("question_time_limits"),
            "test_token": created.get("test_token"),
            "pausedAt": created.get("pausedAt"),
        }
    }

@router.delete("/{test_id}")
async def delete_test(
    test_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Delete a test (requires authentication and ownership)
    Note: This will delete the test but not associated submissions or candidate records.
    Consider adding cascade delete if needed.
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    # Check if test exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    existing_test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not existing_test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Verify ownership
    existing_created_by = existing_test.get("created_by")
    if not existing_created_by or str(existing_created_by).strip() != user_id.strip():
        logger.error(f"[delete_test] SECURITY ISSUE: User {user_id} attempted to delete test {test_id} created by {existing_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to delete this test")
    
    result = await db.tests.delete_one({"_id": ObjectId(test_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    
    return {"message": "Test deleted successfully"}


