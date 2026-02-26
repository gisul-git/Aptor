from fastapi import APIRouter, HTTPException, Query, Body, Depends, status, UploadFile, File, BackgroundTasks
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime, timedelta, timezone
import logging
import secrets
import urllib.parse
import re
import csv
import io
import asyncio
import time
import uuid
from pymongo.errors import NetworkTimeout, ServerSelectionTimeoutError, OperationFailure
from ..database import get_aiml_database as get_database
from ..models.test import TestCreate, Test, AddCandidateRequest
from app.core.dependencies import get_current_user, require_editor
from app.utils.email import get_email_service
from app.config.settings import get_settings
from ..utils.dataset_manager import get_dataset_manager
from app.utils.responses import success_response
from app.utils.face_image_storage import prepare_image_for_storage, validate_face_image
from app.utils.cache import (
    get_cached_candidate_analytics,
    set_cached_candidate_analytics,
    get_cached_bulk_analytics,
    set_cached_bulk_analytics,
    invalidate_test_analytics_cache,
    invalidate_user_tests_cache
)
from pydantic import BaseModel
from ..config import API_GATEWAY_URL

logger = logging.getLogger("backend")
router = APIRouter(tags=["aiml"])

@router.post("/", response_model=dict)
async def create_test(
    test: TestCreate,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Create a new AIML test (requires authentication)
    Validates that all question_ids belong to the current user
    """
    db = get_database()
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"[create_test] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    
    logger.info(f"[create_test] Creating AIML test with user_id: '{user_id}'")
    
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
            
            # Verify ownership
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

    if exam_mode not in ("strict", "flexible"):
        raise HTTPException(status_code=400, detail="Invalid examMode. Must be 'strict' or 'flexible'.")
    
    # For strict mode, calculate endTime from startTime + duration (matching Custom MCQ)
    calculated_end_time = None
    if exam_mode == "strict" and start_dt and duration_minutes:
        calculated_end_time = start_dt + timedelta(minutes=int(duration_minutes))
    
    # Use calculated endTime for strict mode, provided endTime for flexible mode (matching Custom MCQ)
    final_end_time = calculated_end_time if exam_mode == "strict" else end_dt
    
    if not start_dt:
        raise HTTPException(status_code=400, detail="Start time is required.")
    if exam_mode == "strict":
        if not duration_minutes or int(duration_minutes) <= 0:
            raise HTTPException(status_code=400, detail="Duration is required for strict exam mode.")
        if not final_end_time:
            raise HTTPException(status_code=400, detail="Failed to calculate end time for strict mode.")
    elif exam_mode == "flexible":
        if not final_end_time:
            raise HTTPException(status_code=400, detail="End time is required for flexible exam mode.")
        if not duration_minutes or int(duration_minutes) <= 0:
            raise HTTPException(status_code=400, detail="Duration is required for flexible exam mode.")
        if start_dt >= final_end_time:
            raise HTTPException(status_code=400, detail="End time must be after start time.")

    # Extract candidateRequirements from schedule if provided
    candidate_requirements = {}
    if schedule_obj and hasattr(schedule_obj, "candidateRequirements"):
        candidate_requirements = schedule_obj.candidateRequirements or {}
    elif schedule_obj and isinstance(schedule_obj, dict):
        candidate_requirements = schedule_obj.get("candidateRequirements", {})
    
    # Extract proctoringSettings from test payload (frontend sends it at top level)
    # First get the model dump to access all fields
    test_dict = test.model_dump()
    proctoring_settings = None
    if "proctoringSettings" in test_dict and test_dict["proctoringSettings"]:
        proctoring_settings = test_dict["proctoringSettings"]
        # If it's a Pydantic model, convert to dict
        if hasattr(proctoring_settings, "model_dump"):
            proctoring_settings = proctoring_settings.model_dump()
        elif not isinstance(proctoring_settings, dict):
            # If it's not a dict, try to convert it
            try:
                proctoring_settings = dict(proctoring_settings) if proctoring_settings else None
            except:
                proctoring_settings = None
    
    schedule_payload = {
        "startTime": start_dt,
        "endTime": final_end_time,  # Always store endTime (calculated for strict, provided for flexible)
        "duration": int(duration_minutes) if duration_minutes else None,
        "candidateRequirements": candidate_requirements,  # Store candidate requirements
        "proctoringSettings": proctoring_settings,  # Store proctoring settings in schedule
    }

    # test_dict already defined above
    test_dict["examMode"] = exam_mode
    test_dict["schedule"] = schedule_payload
    # Also store proctoringSettings at top level for backward compatibility
    if proctoring_settings:
        test_dict["proctoringSettings"] = proctoring_settings
    # Ensure legacy fields are set (backward compatible)
    test_dict["start_time"] = start_dt
    test_dict["end_time"] = final_end_time  # Use calculated/provided endTime

    # -------------------------------
    # Timer configuration (mirrors DSA)
    # -------------------------------
    timer_mode = test_dict.get("timer_mode", "GLOBAL")
    if timer_mode not in ("GLOBAL", "PER_QUESTION"):
        raise HTTPException(status_code=400, detail="Invalid timer_mode. Must be 'GLOBAL' or 'PER_QUESTION'.")

    if timer_mode == "PER_QUESTION":
        qt = test_dict.get("question_timings") or []
        if not qt:
            raise HTTPException(status_code=400, detail="question_timings is required for PER_QUESTION timer_mode.")
        total = 0
        for item in qt:
            mins = int(item.get("duration_minutes", 0) or 0)
            if mins < 1:
                raise HTTPException(status_code=400, detail="All question timings must be at least 1 minute.")
            total += mins
        test_dict["duration_minutes"] = total
    else:
        # GLOBAL timer - use duration_minutes directly (already validated above)
        test_dict["duration_minutes"] = int(duration_minutes) if duration_minutes else 60
    test_dict["created_by"] = user_id
    test_dict["is_active"] = True
    test_dict["is_published"] = False
    test_dict["invited_users"] = []
    test_dict["created_at"] = datetime.utcnow()
    test_dict["test_type"] = "aiml"  # Mark as AIML test
    
    result = await db.tests.insert_one(test_dict)
    
    # Fetch the created test
    created_test = await db.tests.find_one({"_id": result.inserted_id})
    if created_test:
        test_dict = {
            "id": str(created_test["_id"]),
            "title": created_test.get("title", ""),
            "description": created_test.get("description", ""),
            "duration_minutes": created_test.get("duration_minutes", 0),
            "start_time": created_test.get("start_time").isoformat() if created_test.get("start_time") else None,
            "end_time": created_test.get("end_time").isoformat() if created_test.get("end_time") else None,
            "timer_mode": created_test.get("timer_mode", "GLOBAL"),
            "question_timings": created_test.get("question_timings"),
            "examMode": created_test.get("examMode", "strict"),
            "schedule": created_test.get("schedule"),
            "proctoringSettings": created_test.get("proctoringSettings"),  # Include proctoring settings
            "is_active": created_test.get("is_active", False),
            "is_published": created_test.get("is_published", False),
            "question_ids": [str(qid) for qid in created_test.get("question_ids", [])],
        }
        
        # Invalidate cache for this user
        await invalidate_user_tests_cache(user_id)
        
        return test_dict
    
    test_dict["id"] = str(result.inserted_id)
    
    # Invalidate cache for this user
    await invalidate_user_tests_cache(user_id)
    
    return test_dict

@router.get("/dashboard", response_model=Dict[str, Any])
async def get_tests_dashboard(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Lightweight dashboard endpoint for AIML test lists.
    Optimized with MongoDB field projection, Redis caching, and pagination.
    """
    from app.utils.cache import get_cached_dashboard, set_cached_dashboard
    import asyncio
    
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        db = get_database()
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid user ID")
        user_id = str(user_id).strip()
        
        # Try cache first
        cached_data = await get_cached_dashboard(user_id, page, limit)
        if cached_data:
            return cached_data
        
        # Build query with field projection
        query = {"created_by": user_id, "test_type": "aiml"}
        skip = (page - 1) * limit
        
        # Use aggregation pipeline for optimized query
        pipeline = [
            {"$match": query},
            {
                "$project": {
                    "_id": 1,
                    "title": 1,
                    "is_published": 1,
                    "is_active": 1,
                    "created_at": 1,
                    "updated_at": 1,
                    "start_time": 1,
                    "end_time": 1,
                    "duration_minutes": 1,
                    "pausedAt": 1,
                    "schedule.startTime": 1,
                    "schedule.endTime": 1,
                    "schedule.duration": 1,
                }
            },
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        # Get total count and tests in parallel
        count_task = db.tests.count_documents(query)
        tests_task = db.tests.aggregate(pipeline).to_list(length=limit)
        
        total_count, tests = await asyncio.gather(count_task, tests_task)
        
        # Format results
        def safe_isoformat(dt):
            if not dt:
                return None
            if isinstance(dt, datetime):
                return dt.isoformat()
            return str(dt) if dt else None
        
        result = []
        for test in tests:
            schedule = test.get("schedule", {})
            has_schedule = bool(test.get("start_time") and test.get("end_time"))
            
            result.append({
                "id": str(test["_id"]),
                "title": test.get("title", ""),
                "status": "active" if test.get("is_published") else "draft",
                "is_published": test.get("is_published", False),
                "is_active": test.get("is_active", False),
                "hasSchedule": has_schedule,
                "scheduleStatus": {
                    "startTime": safe_isoformat(schedule.get("startTime") or test.get("start_time")),
                    "endTime": safe_isoformat(schedule.get("endTime") or test.get("end_time")),
                    "duration": schedule.get("duration") or test.get("duration_minutes", 0),
                    "isActive": test.get("is_active", False)
                } if has_schedule else None,
                "created_at": safe_isoformat(test.get("created_at")),
                "updated_at": safe_isoformat(test.get("updated_at")),
                "pausedAt": safe_isoformat(test.get("pausedAt")) if test.get("pausedAt") else None,
            })
        
        # Build response with pagination
        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 0
        response_data = {
            "tests": result,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            }
        }
        
        # Cache the result
        await set_cached_dashboard(user_id, response_data, page, limit)
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[get_tests_dashboard] Unexpected error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch dashboard tests: {str(e)}"
        )

@router.get("/", response_model=List[dict])
async def get_tests(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=100, description="Items per page"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all tests for the current user.
    Optimized with Redis caching, MongoDB field projection, and pagination.
    """
    from app.utils.cache import get_cached_tests, set_cached_tests
    
    db = get_database()
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    
    # Try cache first
    cached_tests = await get_cached_tests(user_id, page, limit)
    if cached_tests is not None:
        return cached_tests
    
    try:
        # Build query with field projection and pagination
        query = {"created_by": user_id, "test_type": "aiml"}
        skip = (page - 1) * limit
        
        # Use aggregation pipeline for optimized query
        pipeline = [
            {"$match": query},
            {
                "$project": {
                    "_id": 1,
                    "title": 1,
                    "description": 1,
                    "duration_minutes": 1,
                    "start_time": 1,
                    "end_time": 1,
                    "timer_mode": 1,
                    "question_timings": 1,
                    "examMode": 1,
                    "schedule": 1,
                    "proctoringSettings": 1,
                    "is_active": 1,
                    "is_published": 1,
                    "question_ids": 1,
                    "test_token": 1,
                    "created_by": 1,
                    "test_type": 1,
                    "created_at": 1,
                    "updated_at": 1,
                    "pausedAt": 1,
                }
            },
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        tests = await db.tests.aggregate(pipeline).to_list(length=limit)
    except (NetworkTimeout, ServerSelectionTimeoutError) as e:
        logger.error(f"MongoDB timeout error for user {user_id}: {e}", exc_info=True)
        # Return empty list on timeout to prevent 500 error
        # Frontend will handle empty list gracefully
        return []
    except OperationFailure as e:
        logger.error(f"MongoDB operation failure for user {user_id}: {e}", exc_info=True)
        # Return empty list on operation failure
        return []
    except Exception as e:
        logger.error(f"Unexpected error fetching tests from MongoDB for user {user_id}: {e}", exc_info=True)
        # For other errors, return empty list to prevent 500 error
        # This ensures the dashboard can still load even if there's a DB issue
        return []
    
    result = []
    for test in tests:
        try:
            # Safely serialize datetime fields
            def safe_isoformat(dt):
                if dt is None:
                    return None
                if isinstance(dt, datetime):
                    return dt.isoformat()
                if isinstance(dt, str):
                    return dt
                return None
            
            test_dict = {
                "id": str(test["_id"]),
                "title": test.get("title", ""),
                "description": test.get("description", ""),
                "duration_minutes": test.get("duration_minutes", 0),
                "start_time": safe_isoformat(test.get("start_time")),
                "end_time": safe_isoformat(test.get("end_time")),
                "timer_mode": test.get("timer_mode", "GLOBAL"),
                "question_timings": test.get("question_timings"),
                "examMode": test.get("examMode", "strict"),
                "schedule": test.get("schedule"),
                "proctoringSettings": test.get("proctoringSettings"),  # Include proctoring settings
                "is_active": test.get("is_active", False),
                "is_published": test.get("is_published", False),
                "question_ids": [str(qid) for qid in test.get("question_ids", [])],
                "test_token": test.get("test_token"),
                "created_by": test.get("created_by"),
                "test_type": test.get("test_type", "aiml"),
                "created_at": safe_isoformat(test.get("created_at")),
                "updated_at": safe_isoformat(test.get("updated_at")),
            }
            # Add pausedAt if it exists
            if "pausedAt" in test and test.get("pausedAt"):
                test_dict["pausedAt"] = safe_isoformat(test.get("pausedAt"))
            result.append(test_dict)
        except Exception as e:
            logger.error(f"Error serializing test {test.get('_id')}: {e}", exc_info=True)
            # Continue with other tests even if one fails
            continue
    
    # Cache the result
    await set_cached_tests(user_id, result, page, limit)
    
    return result

@router.patch("/{test_id}/publish", response_model=dict)
async def publish_test(
    test_id: str,
    is_published: bool = Query(..., description="Set publish status"),
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Publish/unpublish a test
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if str(test.get("created_by")) != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to publish this test")
    
    update_data = {"is_published": is_published}
    
    # If publishing and no token exists, generate a shared test token
    if is_published:
        if not test.get("test_token"):
            update_data["test_token"] = secrets.token_urlsafe(32)
    
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": update_data}
    )
    
    # Invalidate analytics cache for this test
    await invalidate_test_analytics_cache(test_id)
    # Invalidate user tests cache
    await invalidate_user_tests_cache(user_id)
    
    updated_test = await db.tests.find_one({"_id": ObjectId(test_id)})
    return {
        "id": str(updated_test["_id"]),
        "is_published": updated_test.get("is_published", False),
        "test_token": updated_test.get("test_token"),
    }


@router.patch("/{test_id}", response_model=dict)
async def update_test(
    test_id: str,
    update_data: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Update a test (requires authentication and ownership)
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if str(test.get("created_by")) != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to update this test")
    
    # Prepare update fields (allow schedule, exam mode, timer mode, proctoring settings, etc.)
    update_fields = {}
    
    # Basic fields
    allowed_basic_fields = ["invitationTemplate", "title", "description", "duration_minutes", "question_ids", 
                           "examMode", "timer_mode", "question_timings"]
    for field in allowed_basic_fields:
        if field in update_data:
            update_fields[field] = update_data[field]
    
    # Handle proctoringSettings separately - save at both top level and in schedule
    if "proctoringSettings" in update_data:
        proctoring_settings = update_data.get("proctoringSettings")
        # Convert Pydantic model to dict if needed
        if hasattr(proctoring_settings, "model_dump"):
            proctoring_settings = proctoring_settings.model_dump()
        elif not isinstance(proctoring_settings, dict):
            try:
                proctoring_settings = dict(proctoring_settings) if proctoring_settings else None
            except:
                proctoring_settings = None
        update_fields["proctoringSettings"] = proctoring_settings
    
    # Handle schedule updates (matching Custom MCQ structure)
    if "schedule" in update_data or "startTime" in update_data or "start_time" in update_data:
        # Extract schedule data from request
        schedule_data = update_data.get("schedule") or {}
        start_time_raw = schedule_data.get("startTime") if isinstance(schedule_data, dict) else None
        end_time_raw = schedule_data.get("endTime") if isinstance(schedule_data, dict) else None
        duration_raw = schedule_data.get("duration") if isinstance(schedule_data, dict) else None
        
        # Also check root level fields (for backward compatibility)
        if not start_time_raw:
            start_time_raw = update_data.get("startTime") or update_data.get("start_time")
        if not end_time_raw:
            end_time_raw = update_data.get("endTime") or update_data.get("end_time")
        if not duration_raw:
            duration_raw = update_data.get("duration") or update_data.get("duration_minutes")
        
        # Get exam mode (use existing if not provided)
        exam_mode = update_data.get("examMode") or test.get("examMode", "strict")
        
        # Parse datetime strings
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
                        logger.warning(f"Could not parse datetime: {val}")
                        return None
            return None
        
        start_dt = _parse_datetime(start_time_raw)
        end_dt = _parse_datetime(end_time_raw)
        duration_minutes = int(duration_raw) if duration_raw else None
        
        # For strict mode, calculate endTime from startTime + duration (matching Custom MCQ)
        calculated_end_time = None
        if exam_mode == "strict" and start_dt and duration_minutes:
            calculated_end_time = start_dt + timedelta(minutes=duration_minutes)
        
        # Use calculated endTime for strict mode, provided endTime for flexible mode
        final_end_time = calculated_end_time if exam_mode == "strict" else end_dt
        
        # Validate
        if not start_dt:
            raise HTTPException(status_code=400, detail="Start time is required.")
        if exam_mode == "strict":
            if not duration_minutes or duration_minutes <= 0:
                raise HTTPException(status_code=400, detail="Duration is required for strict exam mode.")
            if not final_end_time:
                raise HTTPException(status_code=400, detail="Failed to calculate end time for strict mode.")
        elif exam_mode == "flexible":
            if not final_end_time:
                raise HTTPException(status_code=400, detail="End time is required for flexible exam mode.")
            if not duration_minutes or duration_minutes <= 0:
                raise HTTPException(status_code=400, detail="Duration is required for flexible exam mode.")
            if start_dt >= final_end_time:
                raise HTTPException(status_code=400, detail="End time must be after start time.")
        
        # Extract candidateRequirements from schedule if provided, otherwise preserve existing
        existing_schedule = test.get("schedule") or {}
        candidate_requirements = {}
        if isinstance(schedule_data, dict) and "candidateRequirements" in schedule_data:
            candidate_requirements = schedule_data.get("candidateRequirements", {})
        elif isinstance(existing_schedule, dict) and "candidateRequirements" in existing_schedule:
            # Preserve existing candidateRequirements if not provided in update
            candidate_requirements = existing_schedule.get("candidateRequirements", {})
        
        # Extract proctoringSettings from update_data (can be at top level or in schedule)
        # Priority: update_data.proctoringSettings > schedule.proctoringSettings > existing schedule.proctoringSettings
        proctoring_settings = None
        if "proctoringSettings" in update_fields:
            # If proctoringSettings was set at top level, use that
            proctoring_settings = update_fields.get("proctoringSettings")
        elif "proctoringSettings" in update_data:
            proctoring_settings = update_data.get("proctoringSettings")
        elif isinstance(schedule_data, dict) and "proctoringSettings" in schedule_data:
            proctoring_settings = schedule_data.get("proctoringSettings")
        elif isinstance(existing_schedule, dict) and "proctoringSettings" in existing_schedule:
            # Preserve existing proctoringSettings if not provided in update
            proctoring_settings = existing_schedule.get("proctoringSettings")
        
        # Convert Pydantic model to dict if needed
        if proctoring_settings and hasattr(proctoring_settings, "model_dump"):
            proctoring_settings = proctoring_settings.model_dump()
        elif proctoring_settings and not isinstance(proctoring_settings, dict):
            try:
                proctoring_settings = dict(proctoring_settings) if proctoring_settings else None
            except:
                proctoring_settings = None
        
        # Build schedule payload
        schedule_payload = {
            "startTime": start_dt,
            "endTime": final_end_time,  # Always store endTime (calculated for strict, provided for flexible)
            "duration": duration_minutes,
            "candidateRequirements": candidate_requirements,  # Store candidate requirements
            "proctoringSettings": proctoring_settings,  # Store proctoring settings in schedule
        }
        
        # Merge with existing schedule to preserve other fields
        if isinstance(existing_schedule, dict):
            schedule_payload = {**existing_schedule, **schedule_payload}
        
        update_fields["schedule"] = schedule_payload
        update_fields["start_time"] = start_dt  # Legacy field
        update_fields["end_time"] = final_end_time  # Legacy field
        update_fields["examMode"] = exam_mode
    
    # Validate and normalize question_ids (must belong to current user and be AIML questions)
    if "question_ids" in update_fields:
        question_ids = update_fields["question_ids"]
        if not isinstance(question_ids, list):
            raise HTTPException(status_code=400, detail="question_ids must be a list")
        
        normalized_ids = []
        for qid in question_ids:
            if not isinstance(qid, str) or not ObjectId.is_valid(qid):
                raise HTTPException(status_code=400, detail=f"Invalid question ID: {qid}")
            normalized_ids.append(ObjectId(qid))
        
        # Ensure questions belong to this user and are AIML module
        user_id_str = str(user_id).strip()
        for q_obj in normalized_ids:
            question = await db.questions.find_one({"_id": q_obj, "created_by": user_id_str, "module_type": "aiml"})
            if not question:
                raise HTTPException(status_code=403, detail=f"Question {str(q_obj)} not found or not owned by user")
        
        update_fields["question_ids"] = normalized_ids
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_fields["updated_at"] = datetime.utcnow()
    
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": update_fields}
    )
    
    updated_test = await db.tests.find_one({"_id": ObjectId(test_id)})
    
    # Also ensure proctoringSettings is stored at top level if it's in schedule
    proctoring_settings = updated_test.get("proctoringSettings")
    if not proctoring_settings and isinstance(updated_test.get("schedule"), dict):
        proctoring_settings = updated_test.get("schedule", {}).get("proctoringSettings")
    
    # Invalidate cache for this user
    await invalidate_user_tests_cache(user_id)
    # Invalidate analytics cache for this test
    await invalidate_test_analytics_cache(test_id)
    
    return {
        "id": str(updated_test["_id"]),
        "title": updated_test.get("title"),
        "description": updated_test.get("description"),
        "duration_minutes": updated_test.get("duration_minutes"),
        "schedule": updated_test.get("schedule"),  # Include schedule with proctoringSettings
        "proctoringSettings": proctoring_settings,  # Include proctoring settings at top level
        "is_published": updated_test.get("is_published", False),
        "test_token": updated_test.get("test_token"),
        "invitationTemplate": updated_test.get("invitationTemplate"),
        "question_ids": [str(qid) for qid in updated_test.get("question_ids", [])],
    }


@router.get("/get-reference-photo")
async def get_reference_photo(
    assessmentId: str = Query(..., description="Assessment ID (test ID)"),
    candidateEmail: str = Query(..., description="Candidate email"),
) -> Dict[str, Any]:
    """
    Get reference photo for a candidate in an AIML test.
    Retrieves the reference image from test.candidateResponses[email].candidateVerification.referenceImage.
    """
    try:
        db = get_database()
        
        if not ObjectId.is_valid(assessmentId):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid test ID"
            )
        
        assessment_id = ObjectId(assessmentId)
        
        # Find the AIML test
        test = await db.tests.find_one({"_id": assessment_id, "test_type": "aiml"})
        
        if not test:
            logger.warning(f"[AIML][get_reference_photo] Test not found: {assessmentId}")
            return success_response("No reference photo found", {"referenceImage": None})
        
        # Get candidateResponses
        candidate_responses = test.get("candidateResponses", {})
        if not candidate_responses:
            logger.info(f"[AIML][get_reference_photo] No candidateResponses found for test {assessmentId}")
            return success_response("No reference photo found", {"referenceImage": None})
        
        # Find the candidate key (email might be in different format)
        email_lower = candidateEmail.lower().strip()
        candidate_key_found = None
        
        for key in candidate_responses.keys():
            if email_lower in key.lower():
                candidate_key_found = key
                break
        
        if not candidate_key_found:
            logger.info(f"[AIML][get_reference_photo] Candidate {candidateEmail} not found in test {assessmentId}")
            return success_response("No reference photo found", {"referenceImage": None})
        
        # Get candidate data
        candidate_data = candidate_responses.get(candidate_key_found, {})
        candidate_verification = candidate_data.get("candidateVerification", {})
        reference_image = candidate_verification.get("referenceImage")
        
        if not reference_image or not isinstance(reference_image, str) or len(reference_image) < 50:
            logger.info(f"[AIML][get_reference_photo] Reference image not found or invalid for {candidateEmail} in test {assessmentId}")
            return success_response("No reference photo found", {"referenceImage": None})
        
        # Ensure it has data URI prefix
        if not reference_image.startswith("data:image"):
            reference_image = f"data:image/jpeg;base64,{reference_image}"
        
        logger.info(f"[AIML][get_reference_photo] Reference photo found for {candidateEmail} in test {assessmentId}")
        return success_response("Reference photo fetched successfully", {
            "referenceImage": reference_image
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[AIML][get_reference_photo] Error getting reference photo: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get reference photo: {str(e)}"
        )


class SaveReferenceFaceRequest(BaseModel):
    """Request to save reference face image."""
    assessmentId: str
    candidateEmail: str
    referenceImage: str  # Base64 encoded image


@router.post("/save-reference-face")
async def save_reference_face(
    request: SaveReferenceFaceRequest,
) -> Dict[str, Any]:
    """
    Save reference face image from identity verification for AIML tests.
    Stores the image in test.candidateResponses[email].candidateVerification.referenceImage field.
    """
    try:
        db = get_database()
        
        if not ObjectId.is_valid(request.assessmentId):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid test ID"
            )
        
        assessment_id = ObjectId(request.assessmentId)
        
        # Find the AIML test
        test = await db.tests.find_one({"_id": assessment_id, "test_type": "aiml"})
        
        if not test:
            logger.error(f"[AIML][save_reference_face] Test not found: {request.assessmentId}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AIML test not found"
            )
        
        # Initialize candidateResponses if it doesn't exist
        if "candidateResponses" not in test:
            test["candidateResponses"] = {}
        
        # Find or create candidate entry by email
        candidate_email_lower = request.candidateEmail.lower().strip()
        candidate_key_found = None
        
        # Try to find existing candidate key
        for key in test["candidateResponses"].keys():
            if candidate_email_lower in key.lower():
                candidate_key_found = key
                break
        
        # If not found, create new entry
        if not candidate_key_found:
            candidate_key_found = f"{candidate_email_lower}_unknown"
        
        # Initialize candidate entry if it doesn't exist
        if candidate_key_found not in test["candidateResponses"]:
            test["candidateResponses"][candidate_key_found] = {}
        
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
        if "candidateVerification" not in test["candidateResponses"][candidate_key_found]:
            test["candidateResponses"][candidate_key_found]["candidateVerification"] = {}
        
        test["candidateResponses"][candidate_key_found]["candidateVerification"]["referenceImage"] = processed_image
        test["candidateResponses"][candidate_key_found]["candidateVerification"]["referenceImageSavedAt"] = datetime.utcnow().isoformat()
        
        # Log the event
        if "logs" not in test["candidateResponses"][candidate_key_found]:
            test["candidateResponses"][candidate_key_found]["logs"] = []
        
        test["candidateResponses"][candidate_key_found]["logs"].append({
            "eventType": "REFERENCE_PHOTO_CAPTURED",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "email": request.candidateEmail,
            }
        })
        
        # Update the test document
        await db.tests.update_one(
            {"_id": assessment_id},
            {"$set": {"candidateResponses": test["candidateResponses"]}}
        )
        
        logger.info(f"[AIML][save_reference_face] Reference face saved for {request.candidateEmail} in test {request.assessmentId}")
        
        return success_response({
            "message": "Reference face image saved successfully"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[AIML][save_reference_face] Error saving reference face: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save reference face: {str(e)}"
        )


@router.get("/{test_id}", response_model=dict)
async def get_test(
    test_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Get a specific test by ID (requires authentication and ownership)
    Optimized with Redis caching.
    """
    from app.utils.cache import get_cached_test, set_cached_test
    
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    
    # Try cache first
    cached_test = await get_cached_test(test_id, user_id)
    if cached_test:
        return cached_test
    
    db = get_database()
    
    # Use field projection to only fetch needed fields (exclude large fields)
    projection = {
        "_id": 1,
        "title": 1,
        "description": 1,
        "duration_minutes": 1,
        "start_time": 1,
        "end_time": 1,
        "timer_mode": 1,
        "question_timings": 1,
        "examMode": 1,
        "schedule": 1,
        "proctoringSettings": 1,
        "is_active": 1,
        "is_published": 1,
        "question_ids": 1,
        "test_token": 1,
        "invitationTemplate": 1,
        "created_by": 1
        # Excluded: candidateResponses, large nested objects that aren't needed for edit page
    }
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)}, projection)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Verify ownership
    if str(test.get("created_by")) != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to access this test")
    
    # Helper function to safely serialize datetime
    def safe_isoformat(dt):
        if not dt:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        return str(dt) if dt else None
    
    # Helper function to serialize schedule
    def serialize_schedule(schedule):
        if not schedule:
            return None
        if not isinstance(schedule, dict):
            return schedule
        serialized = {}
        for key, value in schedule.items():
            if isinstance(value, datetime):
                serialized[key] = value.isoformat()
            elif isinstance(value, ObjectId):
                serialized[key] = str(value)
            elif isinstance(value, dict):
                serialized[key] = serialize_schedule(value)
            else:
                serialized[key] = value
        return serialized
    
    result = {
        "id": str(test["_id"]),
        "title": test.get("title", ""),
        "description": test.get("description", ""),
        "duration_minutes": test.get("duration_minutes", 0),
        "start_time": safe_isoformat(test.get("start_time")),
        "end_time": safe_isoformat(test.get("end_time")),
        "timer_mode": test.get("timer_mode", "GLOBAL"),
        "question_timings": test.get("question_timings"),
        "examMode": test.get("examMode", "strict"),
        "schedule": serialize_schedule(test.get("schedule")),
        "proctoringSettings": test.get("proctoringSettings"),
        "is_active": test.get("is_active", False),
        "is_published": test.get("is_published", False),
        "question_ids": [str(qid) for qid in test.get("question_ids", [])],
        "test_token": test.get("test_token"),
        "invitationTemplate": test.get("invitationTemplate"),
    }
    
    # Cache the result
    await set_cached_test(test_id, user_id, result)
    
    return result


@router.get("/{test_id}/verify-link")
async def verify_test_link(test_id: str, token: Optional[str] = Query(None)):
    """
    Verify test link - token is now optional
    Returns test info if test exists and is published
    Token validation removed - anyone can access with just email/name verification
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Token validation removed - allow access without token
    # Token is optional for backward compatibility but not required
    
    if not test.get("is_published", False):
        raise HTTPException(status_code=403, detail="Test is not published")
    
    # Return schedule with candidateRequirements for candidate requirements page
    schedule = test.get("schedule") or {}
    
    return {
        "test_id": test_id,
        "test_title": test.get("title", ""),
        "test_description": test.get("description", ""),
        "duration_minutes": test.get("duration_minutes", 0),
        "schedule": schedule,  # Include schedule with candidateRequirements
        "valid": True
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
    NEW: Also checks if candidate already submitted or is currently taking the test
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    # Find candidate by email (assuming test_candidates collection similar to DSA)
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
    candidate_email = email.strip().lower()
    
    # NEW: Check if candidate already submitted (prevents retaking)
    existing_completed = await db.test_submissions.find_one({
        "test_id": test_id,
        "candidate_email": candidate_email,
        "is_completed": True
    })
    if existing_completed:
        raise HTTPException(
            status_code=400,
            detail="You have already submitted this test. You cannot take the test again."
        )
    
    # NEW: Check if candidate is currently taking the test (prevents concurrent sessions)
    existing_in_progress = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id,
        "is_completed": False,
        "started_at": {"$exists": True}
    })
    if existing_in_progress:
        raise HTTPException(
            status_code=400,
            detail="You are already taking this test in another tab or browser. Please complete it there first."
        )
    
    # NEW: Check access time windows based on exam mode
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
    
    start_time_dt = _parse_datetime(start_time_raw)
    end_time_dt = _parse_datetime(end_time_raw)
    
    now = datetime.utcnow()
    
    # Check start time and return info (don't block if test hasn't started, let frontend show popup)
    test_has_started = False
    test_has_ended = False
    
    if exam_mode == "strict" and start_time_dt:
        # Strict mode: Check access time before start (matching Custom MCQ - only checks start time at entry)
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


@router.post("/{test_id}/start")
async def start_test(test_id: str, user_id: str = Query(..., description="User ID from link token")):
    """
    Start a test (user_id provided via query parameter)
    Uses atomic operation to prevent race conditions and validates access time windows
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

    if not test.get("is_active", True):
        raise HTTPException(status_code=400, detail="Test is not active")

    # NEW: Validate access time windows based on exam mode (matching Custom MCQ structure)
    exam_mode = test.get("examMode", "strict")
    schedule = test.get("schedule") or {}
    start_time_raw = schedule.get("startTime") if isinstance(schedule, dict) else None
    end_time_raw = schedule.get("endTime") if isinstance(schedule, dict) else None
    duration_minutes = schedule.get("duration") if isinstance(schedule, dict) else test.get("duration_minutes")
    access_time_before_start = test.get("accessTimeBeforeStart", 15)
    
    # Parse datetime strings (handle both string and datetime objects)
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
                    logger.warning(f"Could not parse datetime: {val}")
                    return None
        return None
    
    start_time = _parse_datetime(start_time_raw)
    end_time = _parse_datetime(end_time_raw)
    
    now = datetime.utcnow()
    
    # Helper function to convert UTC datetime to IST (UTC+5:30) for display
    def utc_to_ist_str(utc_dt):
        """Convert UTC datetime to IST string for error messages"""
        if not utc_dt:
            return ""
        # IST is UTC+5:30
        ist_offset = timedelta(hours=5, minutes=30)
        ist_dt = utc_dt + ist_offset
        return ist_dt.strftime('%Y-%m-%d %H:%M:%S IST')
    
    # Check if test was created recently (within last 2 hours) - allow starting even if window appears closed
    # This handles cases where test was just created but timezone conversion made it appear in the past
    test_created_at = test.get("created_at")
    is_recently_created = False
    if test_created_at:
        if isinstance(test_created_at, datetime):
            created_at_utc = test_created_at.replace(tzinfo=None) if test_created_at.tzinfo else test_created_at
        else:
            created_at_utc = _parse_datetime(test_created_at)
        if created_at_utc:
            time_since_creation = (now - created_at_utc).total_seconds()
            # Allow if created within last 2 hours (7200 seconds)
            is_recently_created = time_since_creation < 7200 and time_since_creation >= 0
    
    if exam_mode == "strict":
        if not start_time or not duration_minutes:
            raise HTTPException(status_code=400, detail="Assessment schedule is not properly configured")
        
        # Use endTime from schedule if available, otherwise calculate (matching Custom MCQ)
        # Priority: use endTime from schedule if it exists, otherwise calculate from startTime + duration
        if not end_time:
            # Fallback: calculate from startTime + duration
            end_time = start_time + timedelta(minutes=int(duration_minutes))
        
        access_start_time = start_time - timedelta(minutes=access_time_before_start)
        
        # Log for debugging
        logger.info(f"[start_test] Strict mode - test_id={test_id}, user_id={user_id}, now={now}, start_time={start_time}, end_time={end_time}, access_start_time={access_start_time}, duration_minutes={duration_minutes}, is_recently_created={is_recently_created}")
        
        if now < access_start_time:
            access_start_time_ist = utc_to_ist_str(access_start_time)
            raise HTTPException(
                status_code=403,
                detail=f"You cannot access this assessment yet. Access will be available {access_time_before_start} minutes before the start time. Access opens at {access_start_time_ist}."
            )
        elif now < start_time:
            # Can access for pre-checks but cannot start yet
            start_time_ist = utc_to_ist_str(start_time)
            raise HTTPException(
                status_code=403,
                detail=f"Assessment has not started yet. The assessment will start at {start_time_ist}. Please wait for the scheduled start time."
            )
        elif now >= end_time:
            # Exam has ended - but allow if candidate already started (they might be resuming) OR if test was recently created
            # Check if candidate has an existing submission
            existing_submission = await db.test_submissions.find_one({
                "test_id": test_id,
                "user_id": user_id
            })
            
            # Allow starting if test was recently created (handles timezone conversion issues)
            if is_recently_created and (not existing_submission or not existing_submission.get("started_at")):
                logger.info(f"[start_test] Allowing start for recently created test - test_id={test_id}, user_id={user_id}, created_at={test_created_at}")
                # Continue to allow starting
            elif not existing_submission or not existing_submission.get("started_at"):
                # No existing submission or not started - assessment window has ended
                end_time_ist = utc_to_ist_str(end_time)
                logger.warning(f"[start_test] Assessment ended - test_id={test_id}, user_id={user_id}, now={now}, end_time={end_time}")
                raise HTTPException(
                    status_code=403,
                    detail=f"The assessment has ended. The assessment window closed at {end_time_ist}. You cannot start a new attempt."
                )
            # If candidate already started, allow them to continue (they're resuming)
            logger.info(f"[start_test] Candidate resuming - test_id={test_id}, user_id={user_id}, started_at={existing_submission.get('started_at') if existing_submission else None}")
    
    elif exam_mode == "flexible":
        if not start_time or not end_time or not duration_minutes:
            raise HTTPException(status_code=400, detail="Assessment schedule is not properly configured")
        
        if now < start_time:
            start_time_ist = utc_to_ist_str(start_time)
            raise HTTPException(
                status_code=403,
                detail=f"You cannot access this assessment yet. The assessment window will be available from {start_time_ist}."
            )
        elif now > end_time:
            # Allow starting if test was recently created (handles timezone conversion issues)
            if is_recently_created:
                logger.info(f"[start_test] Allowing start for recently created flexible test - test_id={test_id}, user_id={user_id}, created_at={test_created_at}")
                # Continue to allow starting
            else:
                end_time_ist = utc_to_ist_str(end_time)
                raise HTTPException(
                    status_code=403,
                    detail=f"The assessment window has ended. The assessment was available until {end_time_ist}. You cannot take this assessment."
                )

    # Resolve candidate email (email is unique identity)
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    candidate_email = (user_doc or {}).get("email")
    if not candidate_email:
        raise HTTPException(status_code=400, detail="Candidate email not found")
    candidate_email = str(candidate_email).strip().lower()

    # Enforce one attempt per email per test
    existing_completed_by_email = await db.test_submissions.find_one({
        "test_id": test_id,
        "candidate_email": candidate_email,
        "is_completed": True
    })
    if existing_completed_by_email:
        raise HTTPException(status_code=400, detail="Test already completed for this email. A candidate can attempt the test only once.")
    
    # NEW: Use atomic operation to check and set started_at (prevents concurrent sessions)
    # Check if user already started
    existing = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if existing:
        # If already started, return existing submission
        started_at_existing = existing.get("started_at")
        if started_at_existing:
            return {
                "test_submission_id": str(existing["_id"]),
                "started_at": started_at_existing.isoformat() if isinstance(started_at_existing, datetime) else str(started_at_existing),
                "is_completed": existing.get("is_completed", False)
            }
        # If submission exists but no started_at, set it atomically
        result = await db.test_submissions.update_one(
            {
                "_id": existing["_id"],
                "started_at": {"$exists": False}
            },
            {
                "$set": {
                    "started_at": datetime.utcnow(),
                    "candidate_email": candidate_email
                }
            }
        )
        if result.modified_count > 0:
            # New candidate started - invalidate analytics cache
            await invalidate_test_analytics_cache(test_id)
        if result.modified_count == 0:
            # Another process already set started_at (race condition prevented)
            updated = await db.test_submissions.find_one({"_id": existing["_id"]})
            if updated and updated.get("started_at"):
                return {
                    "test_submission_id": str(existing["_id"]),
                    "started_at": updated["started_at"].isoformat() if isinstance(updated["started_at"], datetime) else str(updated["started_at"]),
                    "is_completed": updated.get("is_completed", False)
                }

    # If paused, allow ONLY candidates who were added before the pause time.
    paused_at = test.get("pausedAt")
    if paused_at:
        candidate_doc = await db.test_candidates.find_one({
            "test_id": test_id,
            "email": {"$regex": f"^{re.escape(candidate_email)}$", "$options": "i"}
        })
        if not candidate_doc:
            raise HTTPException(status_code=403, detail="Test is currently paused")
        created_at = candidate_doc.get("created_at")
        if isinstance(paused_at, datetime) and isinstance(created_at, datetime) and created_at > paused_at:
            raise HTTPException(status_code=403, detail="Test is currently paused")
    
    # NEW: Create test submission atomically (only if no existing submission)
    # This prevents race conditions where multiple tabs try to start simultaneously
    test_submission = {
        "test_id": test_id,
        "user_id": user_id,
        "candidate_email": candidate_email,
        "submissions": [],
        "score": 0,
        "started_at": datetime.utcnow(),
        "is_completed": False,
    }
    
    # Create test submission (only reached if no existing submission found above)
    result = await db.test_submissions.insert_one(test_submission)
    
    # New candidate started - invalidate analytics cache to show fresh data
    await invalidate_test_analytics_cache(test_id)
    
    # Materialize datasets for all questions in this test
    try:
        dataset_manager = get_dataset_manager()
        materialized = await dataset_manager.materialize_test_datasets_async(db, test_id)
        if materialized:
            logger.info(f"✅ Materialized {len(materialized)} dataset(s) for test {test_id}")
        else:
            logger.info("No datasets to materialize for this test")
    except Exception as e:
        logger.error(f"⚠️  Failed to materialize datasets: {str(e)}")
        # Don't fail the test start if dataset materialization fails
        # The test can still proceed, just without dataset files
    
    return {
        "test_submission_id": str(result.inserted_id),
        "started_at": test_submission["started_at"].isoformat(),
        "is_completed": False
    }


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
    
    # Verify user is authorized for this test.
    # Allow access if they are a registered candidate (before starting) OR already have a submission.
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
        # Include timer mode and question timings if set
        "timer_mode": test.get("timer_mode", "GLOBAL"),
        "question_timings": test.get("question_timings", []),
        # Include proctoring settings for candidate runtime toggle (backward compatible)
        "proctoringSettings": test.get("proctoringSettings"),
    }
    
    logger.info(f"[get_test_public] Returning test {test_id} for user {user_id}, duration_minutes={test_dict['duration_minutes']}")
    
    return test_dict


@router.get("/{test_id}/full", response_model=dict)
async def get_test_full_for_candidate(
    test_id: str,
):
    """
    AIML-specific equivalent of get-assessment-full for candidate pipeline.
    Returns full test metadata (schedule, candidateRequirements, proctoringSettings, etc.)
    without requiring the generic AI assessment service.
    Public endpoint (no auth required) - candidates access via token in URL.
    """
    db = get_database()
    logger.info(f"[get_test_full_for_candidate] Request for test_id={test_id}")
    
    if not ObjectId.is_valid(test_id):
        logger.warning(f"[get_test_full_for_candidate] Invalid test_id format: {test_id}")
        raise HTTPException(status_code=400, detail="Invalid test ID")

    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        logger.warning(f"[get_test_full_for_candidate] Test not found: {test_id}")
        raise HTTPException(status_code=404, detail="Test not found")

    # Ensure this is an AIML test (or defaulted as such)
    test_type = test.get("test_type", "aiml")
    if test_type != "aiml":
        logger.warning(f"[get_test_full_for_candidate] Test {test_id} is not AIML type (type={test_type})")
        raise HTTPException(status_code=404, detail="Test not found")
    
    logger.info(f"[get_test_full_for_candidate] Found AIML test {test_id}, title={test.get('title', 'N/A')}")

    # Helper function to safely serialize data for logging (convert datetime to string)
    def safe_serialize_for_log(obj):
        """Convert datetime objects to strings for JSON serialization in logs"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {k: safe_serialize_for_log(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [safe_serialize_for_log(item) for item in obj]
        elif isinstance(obj, ObjectId):
            return str(obj)
        return obj

    # Log proctoringSettings from database
    db_proctoring_top = test.get("proctoringSettings")
    db_schedule = test.get("schedule") or {}
    db_proctoring_schedule = db_schedule.get("proctoringSettings") if isinstance(db_schedule, dict) else None
    
    # Safely serialize for logging
    safe_proctoring_top = safe_serialize_for_log(db_proctoring_top) if db_proctoring_top else None
    safe_proctoring_schedule = safe_serialize_for_log(db_proctoring_schedule) if db_proctoring_schedule else None
    
    # Log proctoringSettings safely (avoid datetime serialization issues)
    logger.info(f"[get_test_full_for_candidate] 🔍 ProctoringSettings from DB - has_top_level: {bool(db_proctoring_top)}, has_schedule: {isinstance(db_schedule, dict)}, has_schedule_proctoring: {bool(db_proctoring_schedule)}")
    if db_proctoring_top:
        logger.info(f"[get_test_full_for_candidate] 🔍 Top-level proctoringSettings: {safe_proctoring_top}")
    if db_proctoring_schedule:
        logger.info(f"[get_test_full_for_candidate] 🔍 Schedule proctoringSettings: {safe_proctoring_schedule}")
    if isinstance(db_schedule, dict):
        logger.info(f"[get_test_full_for_candidate] 🔍 Schedule keys: {list(db_schedule.keys())}")

    # Serialize schedule - convert datetime objects to ISO format strings for JSON serialization
    raw_schedule = test.get("schedule") or {}
    serialized_schedule = {}
    if isinstance(raw_schedule, dict):
        for key, value in raw_schedule.items():
            if isinstance(value, datetime):
                serialized_schedule[key] = value.isoformat()
            elif isinstance(value, ObjectId):
                serialized_schedule[key] = str(value)
            else:
                serialized_schedule[key] = value
    else:
        serialized_schedule = raw_schedule

    # Extract proctoringSettings from schedule or top level
    proctoring_settings = test.get("proctoringSettings") or (raw_schedule.get("proctoringSettings") if isinstance(raw_schedule, dict) else None)

    # Shape mirrors the admin list/get response and includes schedule.candidateRequirements
    test_dict = {
        "id": str(test["_id"]),
        "title": test.get("title", ""),
        "description": test.get("description", ""),
        "duration_minutes": test.get("duration_minutes", 0),
        "start_time": test.get("start_time").isoformat() if test.get("start_time") else None,
        "end_time": test.get("end_time").isoformat() if test.get("end_time") else None,
        "timer_mode": test.get("timer_mode", "GLOBAL"),
        "question_timings": test.get("question_timings"),
        "examMode": test.get("examMode", "strict"),
        "schedule": serialized_schedule,  # Use serialized schedule with ISO format datetimes
        "is_active": test.get("is_active", False),
        "is_published": test.get("is_published", False),
        "question_ids": [str(qid) if isinstance(qid, ObjectId) else str(qid) for qid in test.get("question_ids", [])],
        "test_token": test.get("test_token"),
        "created_by": str(test.get("created_by")) if test.get("created_by") is not None else None,
        "test_type": test_type,
        "created_at": test.get("created_at").isoformat() if test.get("created_at") else None,
        # Include proctoring settings so precheck/candidate-requirements can read them if needed
        # Ensure proctoringSettings is available at both top level and in schedule
        "proctoringSettings": proctoring_settings,
    }
    
    # Also ensure schedule has proctoringSettings if it exists at top level
    if isinstance(test_dict.get("schedule"), dict) and test_dict.get("proctoringSettings") and "proctoringSettings" not in test_dict["schedule"]:
        test_dict["schedule"]["proctoringSettings"] = test_dict["proctoringSettings"]

    # Log final test_dict proctoringSettings before returning
    # Safely serialize for logging
    safe_test_proctoring_top = safe_serialize_for_log(test_dict.get("proctoringSettings")) if test_dict.get("proctoringSettings") else None
    safe_test_schedule_proctoring = None
    if isinstance(test_dict.get("schedule"), dict):
        schedule_proctoring = test_dict.get("schedule", {}).get("proctoringSettings")
        safe_test_schedule_proctoring = safe_serialize_for_log(schedule_proctoring) if schedule_proctoring else None
    
    # Log final proctoringSettings safely (avoid datetime serialization issues)
    logger.info(f"[get_test_full_for_candidate] ✅ Final test_dict proctoringSettings - has_top_level: {bool(test_dict.get('proctoringSettings'))}, has_schedule: {isinstance(test_dict.get('schedule'), dict)}, has_schedule_proctoring: {bool(test_dict.get('schedule', {}).get('proctoringSettings') if isinstance(test_dict.get('schedule'), dict) else False)}")
    if test_dict.get("proctoringSettings"):
        logger.info(f"[get_test_full_for_candidate] ✅ Top-level proctoringSettings: {safe_test_proctoring_top}")
    if safe_test_schedule_proctoring:
        logger.info(f"[get_test_full_for_candidate] ✅ Schedule proctoringSettings: {safe_test_schedule_proctoring}")

    # Return in the same envelope shape as /api/v1/candidate/get-assessment-full
    response = success_response("Assessment fetched successfully", test_dict)
    logger.info(f"[get_test_full_for_candidate] 📤 Returning response with data keys: {list(test_dict.keys())}")
    return response

@router.get("/{test_id}/candidate")
async def get_test_for_candidate(
    test_id: str,
    user_id: str = Query(..., description="User ID from link token")
):
    """
    Get test data for candidate (questions without answers)
    Returns started_at and time_remaining if test has been started
    Includes accessControl object with server-calculated timer and access status
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if not test.get("is_published", False):
        raise HTTPException(status_code=403, detail="Test is not published")
    
    # Check if test has been started
    test_submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    started_at = None
    time_remaining_seconds = None
    is_completed = False
    
    if test_submission:
        started_at = test_submission.get("started_at")
        is_completed = test_submission.get("is_completed", False)
        
        # Calculate remaining time for candidate timer based on actual start time
        started_datetime = None
        if started_at and not is_completed:
            if isinstance(started_at, datetime):
                started_datetime = started_at
            elif isinstance(started_at, str):
                try:
                    if started_at.endswith('Z'):
                        started_datetime = datetime.fromisoformat(started_at.replace('Z', '+00:00')).replace(tzinfo=None)
                    else:
                        started_datetime = datetime.fromisoformat(started_at).replace(tzinfo=None)
                except Exception:
                    try:
                        from dateutil import parser  # type: ignore
                        started_datetime = parser.parse(started_at)
                        if started_datetime.tzinfo:
                            started_datetime = started_datetime.replace(tzinfo=None)
                    except Exception:
                        started_datetime = None

        if started_datetime and not is_completed:
            duration_seconds = int(test.get("duration_minutes", 0) or 0) * 60
            elapsed_seconds = (datetime.utcnow() - started_datetime).total_seconds()
            time_remaining_seconds = max(0, int(duration_seconds - elapsed_seconds))
    
    # NEW: Access control based on exam mode (strict/flexible)
    exam_mode = test.get("examMode", "strict")
    schedule = test.get("schedule") or {}
    start_time_raw = schedule.get("startTime") if isinstance(schedule, dict) else None
    end_time_raw = schedule.get("endTime") if isinstance(schedule, dict) else None
    duration_minutes = schedule.get("duration") if isinstance(schedule, dict) else test.get("duration_minutes")
    access_time_before_start = test.get("accessTimeBeforeStart", 15)  # Default 15 minutes
    
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
                    logger.warning(f"Could not parse datetime: {val}")
                    return None
        return None
    
    start_time = _parse_datetime(start_time_raw)
    end_time = _parse_datetime(end_time_raw)
    
    now = datetime.utcnow()
    
    # Check if test was created recently (within last 2 hours) - allow access even if window appears closed
    # This handles cases where test was just created but timezone conversion made it appear in the past
    test_created_at = test.get("created_at")
    is_recently_created = False
    if test_created_at:
        if isinstance(test_created_at, datetime):
            created_at_utc = test_created_at.replace(tzinfo=None) if test_created_at.tzinfo else test_created_at
        else:
            created_at_utc = _parse_datetime(test_created_at)
        if created_at_utc:
            time_since_creation = (now - created_at_utc).total_seconds()
            # Allow if created within last 2 hours (7200 seconds)
            is_recently_created = time_since_creation < 7200 and time_since_creation >= 0
            logger.info(f"[get_test_for_candidate] Test creation check - test_id={test_id}, created_at={created_at_utc}, time_since_creation={time_since_creation}, is_recently_created={is_recently_created}")
    
    can_access = False
    can_start = False
    waiting_for_start = False
    exam_started = False
    time_remaining = None
    error_message = None
    
    if exam_mode == "strict":
        if not start_time or not duration_minutes:
            error_message = "Assessment schedule is not properly configured"
            can_access = False
        else:
            # Use endTime from schedule (always stored for strict mode, matching Custom MCQ)
            if not end_time:
                # Fallback: calculate from startTime + duration (shouldn't happen if schedule is properly set)
                end_time = start_time + timedelta(minutes=int(duration_minutes))
            access_start_time = start_time - timedelta(minutes=access_time_before_start)
            
            if now < access_start_time:
                # Too early - cannot access yet
                access_start_time_formatted = access_start_time.strftime('%Y-%m-%d %H:%M:%S UTC')
                error_message = f"You cannot access this assessment yet. Access will be available {access_time_before_start} minutes before the start time. Access opens at {access_start_time_formatted}."
                can_access = False
            elif access_start_time <= now < start_time:
                # Within access window but before start time - can access for pre-checks
                can_access = True
                can_start = False
                waiting_for_start = True
            elif start_time <= now < end_time:
                # Exam is running
                can_access = True
                can_start = True
                exam_started = True
                # Use server-calculated time if test already started, otherwise use window-based time
                if time_remaining_seconds is not None:
                    time_remaining = time_remaining_seconds
                else:
                    time_remaining = max(0, int((end_time - now).total_seconds()))
            else:
                # Exam has ended - but allow if test was recently created (handles timezone conversion issues)
                if is_recently_created:
                    logger.info(f"[get_test_for_candidate] Allowing access for recently created test - test_id={test_id}, created_at={test_created_at}")
                    # Allow access and start for recently created tests
                    can_access = True
                    can_start = True
                    exam_started = True
                    # Use full duration for timer
                    time_remaining = int(duration_minutes) * 60 if duration_minutes else None
                else:
                    # Exam has ended
                    error_message = "The assessment has ended. You cannot take this assessment."
                    can_access = False
    
    elif exam_mode == "flexible":
        if not start_time or not end_time or not duration_minutes:
            error_message = "Assessment schedule is not properly configured"
            can_access = False
        else:
            
            if now < start_time:
                # Before scheduled start time - cannot access yet
                start_time_formatted = start_time.strftime('%Y-%m-%d %H:%M:%S UTC')
                error_message = f"You cannot access this assessment yet. The assessment window will be available from {start_time_formatted}."
                can_access = False
            elif now > end_time:
                # After scheduled end time - window has closed
                # But allow if test was recently created (handles timezone conversion issues)
                if is_recently_created:
                    logger.info(f"[get_test_for_candidate] Allowing access for recently created flexible test - test_id={test_id}, created_at={test_created_at}")
                    # Allow access and start for recently created tests
                    can_access = True
                    can_start = True
                    exam_started = True
                    # Use full duration for timer
                    time_remaining = int(duration_minutes) * 60 if duration_minutes else None
                else:
                    end_time_formatted = end_time.strftime('%Y-%m-%d %H:%M:%S UTC')
                    error_message = f"The assessment window has ended. The assessment was available until {end_time_formatted}. You cannot take this assessment."
                    can_access = False
            else:
                # Within window - auto-start assessment immediately after pre-checks
                can_access = True
                can_start = True
                exam_started = True  # Auto-start for flexible mode (no manual start button)
                # Use server-calculated time if test already started, otherwise use full duration
                if time_remaining_seconds is not None:
                    time_remaining = time_remaining_seconds
                else:
                    time_remaining = int(duration_minutes) * 60 if duration_minutes else None  # Timer starts with full duration
    
    # Get questions (without hidden testcases for candidate view)
    question_ids = test.get("question_ids", [])
    questions = []
    
    # Get dataset manager to get real filesystem paths
    dataset_manager = get_dataset_manager()
    
    for qid in question_ids:
        if ObjectId.is_valid(qid):
            question = await db.questions.find_one({"_id": ObjectId(qid)})
            if question:
                # Remove hidden testcases for candidate
                question_dict = {
                    "id": str(question["_id"]),
                    "title": question.get("title", ""),
                    "description": question.get("description", ""),
                    "examples": question.get("examples", []),
                    "constraints": question.get("constraints", []),
                    "difficulty": question.get("difficulty", ""),
                    "languages": question.get("languages", []),
                    "public_testcases": question.get("public_testcases", []),
                    "starter_code": question.get("starter_code", {}),
                    "library": question.get("library", ""),
                    # Include dataset information for candidate
                    "requires_dataset": question.get("requires_dataset", False),
                    "dataset": question.get("dataset"),
                    # Include tasks for new format questions
                    "tasks": question.get("tasks", []),
                }
                
                # Provide dataset URL (API-based) instead of local filesystem path
                question_dict["dataset_path"] = None
                question_dict["dataset_url"] = None
                if question.get("dataset"):
                    dataset_format = question.get("dataset", {}).get("format", "csv")
                    # Use download endpoint for all formats (returns raw file content)
                    # Use full API Gateway URL instead of relative path for Azure deployment
                    base_url = API_GATEWAY_URL.rstrip('/')
                    question_dict["dataset_url"] = f"{base_url}/api/v1/aiml/questions/{question_dict['id']}/dataset-download?format={dataset_format}&test_id={test_id}&user_id={user_id}"
                elif question.get("dataset_path"):
                    # Backward compatibility: expose stored path as URL
                    question_dict["dataset_url"] = question.get("dataset_path")
                
                if "function_signature" in question:
                    question_dict["function_signature"] = question["function_signature"]
                questions.append(question_dict)
    
    result = {
        "test_id": test_id,
        "title": test.get("title", ""),
        "description": test.get("description", ""),
        "duration_minutes": test.get("duration_minutes", 0),
        "questions": questions,
        # Include proctoring settings for candidate runtime toggle (backward compatible)
        "proctoringSettings": test.get("proctoringSettings"),
        # Timer configuration
        "timer_mode": test.get("timer_mode", "GLOBAL"),
        "question_timings": test.get("question_timings", []),
        # NEW: Access control information
        "accessControl": {
            "canAccess": can_access,
            "canStart": can_start,
            "waitingForStart": waiting_for_start,
            "examStarted": exam_started,
            "timeRemaining": time_remaining,
            "errorMessage": error_message,
        },
    }
    
    # Add timing information if test has been started (backward compatibility)
    if started_at:
        result["started_at"] = started_at.isoformat() if isinstance(started_at, datetime) else str(started_at)
        result["is_completed"] = is_completed
        if time_remaining_seconds is not None:
            result["time_remaining_seconds"] = time_remaining_seconds
    
    return result


@router.post("/{test_id}/submit-answer")
async def submit_answer(
    test_id: str,
    user_id: str = Body(..., description="User ID from link token"),
    question_id: str = Body(..., description="Question ID"),
    source_code: str = Body(..., description="Source code"),
    outputs: List[str] = Body(default=[], description="Outputs from code execution")
):
    """
    Submit an answer for a question in a test (auto-save functionality)
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    # Verify test exists and is published
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if not test.get("is_published", False):
        raise HTTPException(status_code=403, detail="Test is not published")
    
    # Verify question belongs to test
    question_ids = test.get("question_ids", [])
    if question_id not in [str(qid) for qid in question_ids]:
        raise HTTPException(status_code=400, detail="Question does not belong to this test")
    
    # Find or create test submission
    test_submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if not test_submission:
        # Create new submission if it doesn't exist
        test_submission = {
            "test_id": test_id,
            "user_id": user_id,
            "submissions": [],
            "score": 0,
            "started_at": datetime.utcnow(),
            "is_completed": False,
        }
        result = await db.test_submissions.insert_one(test_submission)
        test_submission["_id"] = result.inserted_id
        # New candidate started answering - invalidate analytics cache
        await invalidate_test_analytics_cache(test_id)
    
    # Update or add submission for this question
    submissions = test_submission.get("submissions", [])
    existing_submission_idx = None
    for idx, sub in enumerate(submissions):
        if sub.get("question_id") == question_id:
            existing_submission_idx = idx
            break
    
    submission_data = {
        "question_id": question_id,
        "source_code": source_code,
        "outputs": outputs,
        "submitted_at": datetime.utcnow(),
        "status": "saved"  # saved, submitted, completed
    }
    
    if existing_submission_idx is not None:
        # Update existing submission
        submissions[existing_submission_idx] = submission_data
    else:
        # Add new submission
        submissions.append(submission_data)
    
    # Update test submission
    await db.test_submissions.update_one(
        {"_id": test_submission["_id"]},
        {
            "$set": {
                "submissions": submissions,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": "Answer saved successfully",
        "question_id": question_id,
        "submitted_at": submission_data["submitted_at"].isoformat()
    }


async def process_ai_evaluation_background(
    test_id: str,
    user_id: str,
    test_submission_id: str,
    existing_submissions: Dict[str, Dict[str, Any]],
    questions: Dict[str, Dict[str, Any]]
):
    """
    Background task to evaluate all submissions with AI and update the test submission.
    This runs asynchronously after the test submission is marked as completed.
    """
    from ..services.ai_feedback import evaluate_aiml_submission
    import asyncio
    
    db = get_database()
    try:
        logger.info(f"Starting background AI evaluation for test {test_id}, user {user_id}")
        
        evaluations = []
        total_score = 0
        max_possible_score = len(questions) * 100 if questions else 100
        
        for question_id, question in questions.items():
            submission = existing_submissions.get(question_id, {})
            
            # Run AI evaluation (use thread pool to avoid blocking)
            try:
                # Use a helper function to properly capture variables for the executor
                def _evaluate_submission(sub, q):
                    return evaluate_aiml_submission(sub, q)
                
                loop = asyncio.get_event_loop()
                evaluation = await loop.run_in_executor(
                    None,  # Use default ThreadPoolExecutor
                    _evaluate_submission,
                    submission,
                    question
                )
            except Exception as e:
                logger.error(f"AI evaluation failed for question {question_id}: {e}")
                evaluation = {
                    "overall_score": 0,
                    "feedback_summary": "Evaluation failed. Please contact support.",
                    "one_liner": "Evaluation error",
                    "ai_generated": False,
                    "error": str(e)
                }
            
            question_score = evaluation.get("overall_score", 0)
            total_score += question_score
            
            # Store evaluation with submission
            # Ensure question_id is string for consistent lookup
            question_id_str = str(question_id)
            submission_data = {
                "question_id": question_id_str,  # Store as string for consistent lookup
                "source_code": submission.get("source_code", ""),
                "outputs": submission.get("outputs", []),
                "submitted_at": submission.get("submitted_at", datetime.utcnow()),
                "status": "evaluated",  # Explicitly set status to "evaluated"
                "ai_feedback": evaluation,
                "score": question_score
            }
            
            evaluations.append({
                "question_id": question_id_str,
                "question_title": question.get("title", "Unknown"),
                "score": question_score,
                "feedback": evaluation
            })
            
            # Update in existing_submissions (use string key)
            existing_submissions[question_id_str] = submission_data
        
        # Calculate final score out of 100
        final_score = round((total_score / max_possible_score) * 100) if max_possible_score > 0 else 0
        
        # Update test submission with evaluations
        await db.test_submissions.update_one(
            {"_id": ObjectId(test_submission_id)},
            {"$set": {
                "submissions": list(existing_submissions.values()),
                "score": final_score,
                "evaluations": evaluations,
                "ai_feedback_status": "completed"
            }}
        )
        
        # Invalidate analytics cache after AI evaluation completes
        await invalidate_test_analytics_cache(test_id)
        
        logger.info(f"Background AI evaluation completed for test {test_id}, user {user_id}. Score: {final_score}/100")
    except Exception as e:
        logger.error(f"Error in background AI evaluation for test {test_id}, user {user_id}: {e}", exc_info=True)
        # Update status to indicate error
        try:
            await db.test_submissions.update_one(
                {"_id": ObjectId(test_submission_id)},
                {"$set": {"ai_feedback_status": "error", "ai_feedback_error": str(e)}}
            )
        except Exception as update_error:
            logger.error(f"Failed to update error status: {update_error}")


@router.post("/{test_id}/submit")
async def submit_test(
    test_id: str,
    user_id: str = Body(..., description="User ID from link token"),
    answers: List[Dict[str, Any]] = Body(default=[], description="Final answers with question_id and source_code"),
    candidateRequirements: Optional[Dict[str, Any]] = Body(default=None, description="Candidate requirements details (phone, linkedIn, github, custom fields, etc.)"),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Final test submission - marks test as completed immediately and evaluates code with AI in background.
    
    This endpoint:
    1. Collects all submitted answers
    2. Marks the test as completed immediately (fast response)
    3. Schedules AI evaluation in background task
    4. Returns immediately with submission confirmation
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Verify test exists
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Find test submission
    test_submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if not test_submission:
        # Create new submission if it doesn't exist
        test_submission = {
            "test_id": test_id,
            "user_id": user_id,
            "submissions": [],
            "score": 0,
            "started_at": datetime.utcnow(),
            "is_completed": False,
        }
        result = await db.test_submissions.insert_one(test_submission)
        test_submission["_id"] = result.inserted_id
    
    # Enforce one attempt per email per test (email is unique)
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
            raise HTTPException(status_code=400, detail="Test already submitted for this email. A candidate can attempt the test only once.")

    # Check if already completed for this user_id
    if test_submission.get("is_completed"):
        raise HTTPException(status_code=400, detail="Test already submitted. A candidate can attempt the test only once.")
    
    # NEW: Validate timer server-side before accepting submission
    started_at = test_submission.get("started_at")
    if started_at:
        started_datetime = None
        if isinstance(started_at, datetime):
            started_datetime = started_at
        elif isinstance(started_at, str):
            try:
                if started_at.endswith('Z'):
                    started_datetime = datetime.fromisoformat(started_at.replace('Z', '+00:00')).replace(tzinfo=None)
                else:
                    started_datetime = datetime.fromisoformat(started_at).replace(tzinfo=None)
            except Exception:
                try:
                    from dateutil import parser  # type: ignore
                    started_datetime = parser.parse(started_at)
                    if started_datetime.tzinfo:
                        started_datetime = started_datetime.replace(tzinfo=None)
                except Exception:
                    started_datetime = None
        
        if started_datetime:
            duration_minutes = test.get("duration_minutes", 0)
            duration_seconds = int(duration_minutes) * 60 if duration_minutes else 0
            elapsed_seconds = (datetime.utcnow() - started_datetime).total_seconds()
            time_remaining_seconds = duration_seconds - elapsed_seconds
            
            # Allow a small grace period (10 seconds) for auto-submit when timer expires
            # This accounts for network latency and processing time between frontend timer expiration and backend validation
            GRACE_PERIOD_SECONDS = 10
            
            # Reject submission only if time has expired beyond the grace period
            if time_remaining_seconds < -GRACE_PERIOD_SECONDS:
                raise HTTPException(
                    status_code=400,
                    detail="Time has expired. You cannot submit the test after the time limit."
                )
            # If within grace period (0 to -10 seconds), allow submission (auto-submit scenario)
            elif time_remaining_seconds < 0:
                logger.info(f"[submit_test] Allowing submission within grace period: time_remaining={time_remaining_seconds}s (test_id={test_id}, user_id={user_id})")
    
    # Get existing submissions from database
    existing_submissions = {sub.get("question_id"): sub for sub in test_submission.get("submissions", [])}
    
    # Update with any new answers from this final submission
    for answer in answers:
        question_id = answer.get("question_id")
        if question_id:
            if question_id in existing_submissions:
                # Update existing submission with new code if provided
                if answer.get("source_code"):
                    existing_submissions[question_id]["source_code"] = answer["source_code"]
            else:
                # Add new submission
                # Ensure question_id is string for consistent lookup
                question_id_str = str(question_id)
                existing_submissions[question_id_str] = {
                    "question_id": question_id_str,  # Store as string
                    "source_code": answer.get("source_code", ""),
                    "outputs": answer.get("outputs", []),
                    "submitted_at": datetime.utcnow(),
                    "status": "submitted"
                }
    
    # Get all questions for this test
    question_ids = test.get("question_ids", [])
    questions = {}
    for qid in question_ids:
        if ObjectId.is_valid(str(qid)):
            q = await db.questions.find_one({"_id": ObjectId(str(qid))})
            if q:
                questions[str(qid)] = q
    
    # Mark test as completed immediately (fast response)
    # AI evaluation will happen in background
    update_data = {
        "submissions": list(existing_submissions.values()),
        "score": 0,  # Will be updated by background task
        "is_completed": True,
        "submitted_at": datetime.utcnow(),
        "ai_feedback_status": "evaluating"  # Status will be updated to "completed" by background task
    }
    
    # Store candidate requirements if provided
    if candidateRequirements:
        update_data["candidateRequirements"] = candidateRequirements
    
    await db.test_submissions.update_one(
        {"_id": test_submission["_id"]},
        {"$set": update_data}
    )
    
    # Invalidate analytics cache for this test (submission completed)
    await invalidate_test_analytics_cache(test_id)
    
    # Schedule AI evaluation in background
    background_tasks.add_task(
        process_ai_evaluation_background,
        test_id=test_id,
        user_id=user_id,
        test_submission_id=str(test_submission["_id"]),
        existing_submissions=existing_submissions,
        questions=questions
    )
    
    logger.info(f"AIML test {test_id} submitted by user {user_id}. AI evaluation scheduled in background.")
    
    return {
        "message": "Test submitted successfully. AI evaluation is in progress.",
        "test_id": test_id,
        "user_id": user_id,
        "total_questions": len(questions),
        "is_completed": True,
        "ai_feedback_status": "evaluating",
        "submitted_at": datetime.utcnow().isoformat()
    }


@router.post("/{test_id}/pause")
async def pause_test(
    test_id: str,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Pause an AIML test.
    Keeps the test published (is_published stays as-is) but records pausedAt.
    Candidates can still be added; new test starts should be blocked while paused.
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    
    # Use field projection to only fetch necessary fields (faster query)
    test = await db.tests.find_one(
        {"_id": ObjectId(test_id)},
        {"created_by": 1, "is_published": 1, "pausedAt": 1}
    )
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if str(test.get("created_by")) != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to pause this test")
    
    if test.get("pausedAt"):
        return {
            "message": "Test is already paused",
            "test_id": test_id,
            "is_published": test.get("is_published", False),
            "pausedAt": test.get("pausedAt").isoformat() if isinstance(test.get("pausedAt"), datetime) else test.get("pausedAt")
        }

    current_status = test.get("is_published", False)
    
    now = datetime.utcnow()
    
    # Update test to paused state (do NOT unpublish)
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {
            "$set": {
                "pausedAt": now,
                "statusBeforePause": "published" if current_status else "draft"
            }
        }
    )
    
    # Invalidate caches in background (non-blocking for faster response)
    background_tasks.add_task(invalidate_test_analytics_cache, test_id)
    background_tasks.add_task(invalidate_user_tests_cache, user_id)
    
    logger.info(f"Test {test_id} paused by user {user_id} at {now}")
    
    return {
        "message": "Test paused successfully",
        "test_id": test_id,
        "is_published": test.get("is_published", False),
        "pausedAt": now.isoformat()
    }


@router.post("/{test_id}/resume")
async def resume_test(
    test_id: str,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Resume a paused AIML test.
    Clears pausedAt and records resumeAt timestamp.
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    
    # Use field projection to only fetch necessary fields (faster query)
    test = await db.tests.find_one(
        {"_id": ObjectId(test_id)},
        {"created_by": 1, "is_published": 1, "pausedAt": 1, "statusBeforePause": 1}
    )
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if str(test.get("created_by")) != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to resume this test")
    
    if not test.get("pausedAt"):
        return {
            "message": "Test is already active",
            "test_id": test_id,
            "is_published": test.get("is_published", False)
        }
    
    now = datetime.utcnow()
    previous_status = test.get("statusBeforePause", "published")
    
    # Update test to resumed state (do NOT force publish on)
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {
            "$set": {
                "resumeAt": now,
                "pausedAt": None,
                "statusBeforePause": None
            }
        }
    )
    
    # Invalidate caches in background (non-blocking for faster response)
    background_tasks.add_task(invalidate_test_analytics_cache, test_id)
    background_tasks.add_task(invalidate_user_tests_cache, user_id)
    
    logger.info(f"Test {test_id} resumed by user {user_id} at {now}")
    
    return {
        "message": "Test resumed successfully",
        "test_id": test_id,
        "is_published": test.get("is_published", False),
        "resumeAt": now.isoformat()
    }


@router.post("/{test_id}/clone")
async def clone_test(
    test_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Clone an AIML test for the current editor (creates a new test document with a new ID).
    Payload:
      - newTitle: str (required)
      - keepSchedule: bool (optional, default False)
      - keepCandidates: bool (optional, default False)
    """
    logger.info(f"🧠 [AIML Clone] Clone request received - test_id: {test_id}, user_id: {current_user.get('id')}, payload: {payload}")
    
    db = get_database()
    if not ObjectId.is_valid(test_id):
        logger.error(f"❌ [AIML Clone] Invalid test ID: {test_id}")
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"❌ [AIML Clone] Invalid user ID from current_user: {current_user}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    
    logger.info(f"🔍 [AIML Clone] Looking up test {test_id} for user {user_id}")
    original = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not original:
        logger.error(f"❌ [AIML Clone] Test not found: {test_id}")
        raise HTTPException(status_code=404, detail="Test not found")

    # Ensure AIML test
    if original.get("test_type") != "aiml":
        raise HTTPException(status_code=400, detail="Not an AIML test")
    
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
    cloned["test_type"] = "aiml"

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

    logger.info(f"💾 [AIML Clone] Inserting cloned test into database...")
    res = await db.tests.insert_one(cloned)
    created = await db.tests.find_one({"_id": res.inserted_id})
    if not created:
        logger.error(f"❌ [AIML Clone] Failed to retrieve cloned test after insertion - inserted_id: {res.inserted_id}")
        raise HTTPException(status_code=500, detail="Failed to clone test")

    logger.info(f"✅ [AIML Clone] Test cloned successfully - new_test_id: {res.inserted_id}, new_title: {new_title}")

    # Invalidate cache for this user so the new test appears in the list
    logger.info(f"🔄 [AIML Clone] Invalidating cache for user: {user_id}")
    await invalidate_user_tests_cache(user_id)

    # Helper function to safely convert datetime to ISO format
    def safe_isoformat(dt):
        if not dt:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        return str(dt) if dt else None
    
    # Helper function to serialize schedule (convert datetime objects to ISO format)
    def serialize_schedule(schedule):
        if not schedule:
            return None
        if not isinstance(schedule, dict):
            return schedule
        serialized = {}
        for key, value in schedule.items():
            if isinstance(value, datetime):
                serialized[key] = value.isoformat()
            elif isinstance(value, ObjectId):
                serialized[key] = str(value)
            elif isinstance(value, dict):
                # Recursively serialize nested dictionaries
                serialized[key] = serialize_schedule(value)
            else:
                serialized[key] = value
        return serialized

    return {
        "message": "Test cloned successfully",
        "data": {
            "id": str(created["_id"]),
            "title": created.get("title", ""),
            "description": created.get("description", ""),
            "duration_minutes": created.get("duration_minutes", 0),
            "start_time": safe_isoformat(created.get("start_time")),
            "end_time": safe_isoformat(created.get("end_time")),
            "examMode": created.get("examMode", "strict"),
            "schedule": serialize_schedule(created.get("schedule")),
            "is_active": created.get("is_active", False),
            "is_published": created.get("is_published", False),
            "invited_users": created.get("invited_users", []),
            "test_token": created.get("test_token"),
            "pausedAt": safe_isoformat(created.get("pausedAt")),
        }
    }


@router.delete("/{test_id}")
async def delete_test(
    test_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Delete a test with cascade delete (requires authentication and ownership).
    
    This will delete:
    - The test document
    - All test_candidates records (including proctor reference images)
    - All test_submissions records
    - All related analytics data
    
    Optimized with parallel operations and efficient cache invalidation.
    """
    import asyncio
    import time
    
    start_time = time.time()
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
    
    # Get test title for logging
    test_title = existing_test.get("title", "Unknown")
    logger.info(f"[delete_test] Starting cascade delete for test {test_id} ({test_title}) by user {user_id}")
    
    # CASCADE DELETE: Delete all related data in parallel where possible
    deletion_stats = {
        "test_candidates": 0,
        "test_submissions": 0
    }
    
    try:
        # Delete related data in parallel for better performance
        candidates_task = db.test_candidates.delete_many({"test_id": test_id})
        submissions_task = db.test_submissions.delete_many({"test_id": test_id})
        
        # Execute deletions in parallel
        candidates_result, submissions_result = await asyncio.gather(
            candidates_task,
            submissions_task
        )
        
        deletion_stats["test_candidates"] = candidates_result.deleted_count
        deletion_stats["test_submissions"] = submissions_result.deleted_count
        
        logger.info(f"[delete_test] Deleted {deletion_stats['test_candidates']} candidate record(s) and {deletion_stats['test_submissions']} submission record(s)")
        
        # Finally, delete the test document itself
        result = await db.tests.delete_one({"_id": ObjectId(test_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Test not found")
        
        logger.info(f"[delete_test] Deleted test document {test_id}")
        
        # Invalidate caches in parallel for better performance
        await asyncio.gather(
            invalidate_user_tests_cache(user_id),
            invalidate_test_analytics_cache(test_id),
            return_exceptions=True  # Don't fail if cache invalidation fails
        )
        
        elapsed = time.time() - start_time
        logger.info(f"[delete_test] Cascade delete completed in {elapsed:.2f}s for test {test_id}")
        
        return {
            "message": "Test deleted successfully",
            "deleted": {
                "test": 1,
                "candidates": deletion_stats["test_candidates"],
                "submissions": deletion_stats["test_submissions"]
            }
        }
        
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[delete_test] Error during cascade delete after {elapsed:.2f}s: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete test: {str(e)}"
        )


@router.post("/{test_id}/add-candidate")
async def add_candidate(
    test_id: str,
    candidate: AddCandidateRequest,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Add a candidate to an AIML test (creates user account).
    IMPORTANT: Does NOT send invitation email. Emails are sent only from explicit "Send Email" actions.
    """
    db = get_database()

    # Debug logging to trace candidate-add issues
    try:
        logger.info(
            "[AIML][add_candidate] Incoming request - test_id=%s, name=%s, email=%s, db=%s.test_candidates",
            test_id,
            getattr(candidate, "name", None),
            getattr(candidate, "email", None),
            getattr(getattr(db, "name", None), "__str__", lambda: db.name)() if hasattr(db, "name") else "unknown",
        )
    except Exception as log_exc:
        logger.error("[AIML][add_candidate] Failed to log incoming request details: %s", log_exc)
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if not test.get("is_published", False):
        raise HTTPException(status_code=400, detail="Test must be published before adding candidates")
    
    # Check if candidate already exists for this test
    existing_candidate = await db.test_candidates.find_one({
        "test_id": test_id,
        "email": candidate.email
    })
    logger.info(
        "[AIML][add_candidate] Existing candidate lookup - test_id=%s, email=%s, found=%s",
        test_id,
        candidate.email,
        bool(existing_candidate),
    )
    if existing_candidate:
        logger.warning(
            "[AIML][add_candidate] Rejecting add-candidate: candidate already exists for test. test_id=%s, email=%s, candidate_id=%s",
            test_id,
            candidate.email,
            str(existing_candidate.get("user_id")) if isinstance(existing_candidate, dict) else "unknown",
        )
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
    
    # Store candidate record
    candidate_record = {
        "test_id": test_id,
        "user_id": user_id,
        "name": candidate.name,
        "email": candidate.email,
        "status": "pending",  # pending -> invited -> started -> completed
        "invited": False,
        "invited_at": None,
        "created_at": datetime.utcnow(),
    }
    await db.test_candidates.insert_one(candidate_record)
    
    # Add email to invited_users if not already there
    current_invited = set(test.get("invited_users", []))
    current_invited.add(candidate.email)
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": {"invited_users": list(current_invited)}}
    )
    
    # Get the shared test link
    test_token = test.get("test_token")
    if not test_token:
        # Generate token if not exists (shouldn't happen if test is published)
        test_token = secrets.token_urlsafe(32)
        await db.tests.update_one(
            {"_id": ObjectId(test_id)},
            {"$set": {"test_token": test_token}}
        )
    
    # Build full test URL
    settings = get_settings()
    cors_origins = settings.cors_origins.split(",")[0].strip() if settings.cors_origins else "http://localhost:3000"
    test_link = f"{cors_origins}/aiml/test/{test_id}?token={test_token}"
    
    return {
        "candidate_id": user_id,
        "test_link": test_link,
        "name": candidate.name,
        "email": candidate.email,
    }


@router.post("/{test_id}/bulk-add-candidates")
async def bulk_add_candidates(
    test_id: str,
    file: UploadFile = File(...)
):
    """
    Bulk add candidates from CSV file
    CSV format: name,email (header row required)
    IMPORTANT: Does NOT send invitation emails.
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if not test.get("is_published", False):
        raise HTTPException(status_code=400, detail="Test must be published before adding candidates")
    
    contents = await file.read()
    try:
        csv_text = contents.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding. Please use UTF-8 encoded CSV.")
    
    csv_reader = csv.DictReader(io.StringIO(csv_text))
    
    if not csv_reader.fieldnames or 'name' not in csv_reader.fieldnames or 'email' not in csv_reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV must have 'name' and 'email' columns")
    
    results = {
        "success": [],
        "failed": [],
        "duplicates": []
    }
    
    current_invited = set([str(e).strip().lower() for e in test.get("invited_users", [])])
    
    for row in csv_reader:
        name = (row.get('name', '') or '').strip()
        email = (row.get('email', '') or '').strip().lower()
        
        if not name or not email:
            results["failed"].append({
                "name": name or "N/A",
                "email": email or "N/A",
                "reason": "Name or email is empty"
            })
            continue
        
        existing_candidate = await db.test_candidates.find_one({"test_id": test_id, "email": email})
        if existing_candidate:
            results["duplicates"].append({"name": name, "email": email})
            continue
        
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            user_id = str(existing_user["_id"])
        else:
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
        
        candidate_record = {
            "test_id": test_id,
            "user_id": user_id,
            "name": name,
            "email": email,
            "status": "pending",
            "invited": False,
            "invited_at": None,
            "created_at": datetime.utcnow(),
        }
        await db.test_candidates.insert_one(candidate_record)
        
        current_invited.add(email)
        results["success"].append({"name": name, "email": email})
    
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": {"invited_users": list(current_invited)}}
    )
    
    return {
        "success_count": len(results["success"]),
        "failed_count": len(results["failed"]),
        "duplicate_count": len(results["duplicates"]),
        "success": results["success"],
        "failed": results["failed"],
        "duplicates": results["duplicates"],
    }


@router.post("/{test_id}/send-invitation")
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
    
    if str(test.get("created_by")) != user_id:
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
    
    # Ensure shared token exists
    test_token = test.get("test_token")
    if not test_token:
        test_token = secrets.token_urlsafe(32)
        await db.tests.update_one({"_id": ObjectId(test_id)}, {"$set": {"test_token": test_token}})
    
    settings = get_settings()
    cors_origins = settings.cors_origins.split(",")[0].strip() if settings.cors_origins else "http://localhost:3000"
    test_link = f"{cors_origins}/aiml/test/{test_id}?token={test_token}"
    
    stored_template = test.get("invitationTemplate", {})
    default_template = {
        "logoUrl": "",
        "companyName": "",
        "message": "You have been invited to take an AIML competency assessment. Please click the link below to start.",
        "footer": "",
        "sentBy": "AAPtor"
    }
    template_to_use = stored_template if stored_template else default_template
    
    # Get test details for email
    test_title = test.get("title", "AIML Assessment")
    test_description = test.get("description", "")
    duration_minutes = test.get("duration_minutes")
    schedule = test.get("schedule", {})
    end_time = test.get("end_time") or (schedule.get("endTime") if schedule else None)
    
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
    sent_by = template_to_use.get("sentBy", "AAPtor")
    
    # Format duration
    duration_text = ""
    if duration_minutes:
        hours = duration_minutes // 60
        minutes = duration_minutes % 60
        if hours > 0:
            duration_text = f"{hours} hour{'s' if hours > 1 else ''}"
            if minutes > 0:
                duration_text += f" {minutes} minute{'s' if minutes > 1 else ''}"
        else:
            duration_text = f"{minutes} minute{'s' if minutes > 1 else ''}"
    
    # Format deadline
    deadline_text = ""
    if end_time:
        try:
            if isinstance(end_time, str):
                # Handle ISO format strings
                if end_time.endswith('Z'):
                    end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                else:
                    end_dt = datetime.fromisoformat(end_time)
            elif isinstance(end_time, datetime):
                end_dt = end_time
            else:
                end_dt = None
            
            if end_dt:
                # Convert to UTC if timezone-aware, otherwise assume UTC
                if end_dt.tzinfo is None:
                    end_dt = end_dt.replace(tzinfo=timezone.utc)
                else:
                    end_dt = end_dt.astimezone(timezone.utc)
                deadline_text = end_dt.strftime("%B %d, %Y at %I:%M %p UTC")
        except Exception as e:
            logger.warning(f"Failed to format deadline: {e}")
            deadline_text = ""
    
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
            .content {{ background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #10b981; }}
            .button {{ display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
            .footer {{ text-align: center; color: #64748b; font-size: 0.875rem; margin-top: 30px; }}
            .candidate-info {{ background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #10b981; }}
            .assessment-title {{ font-size: 1.5rem; font-weight: bold; color: #10b981; margin: 15px 0; text-align: center; }}
            .assessment-details {{ background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #10b981; }}
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
                <div class="assessment-title">{test_title}</div>
                {f'<div class="assessment-details"><p><strong>Description:</strong> {test_description}</p></div>' if test_description else ''}
                {f'<div class="assessment-details"><p><strong>Duration:</strong> {duration_text}</p></div>' if duration_text else ''}
                {f'<div class="assessment-details"><p><strong>Deadline:</strong> {deadline_text}</p></div>' if deadline_text else ''}
                <p>{email_body}</p>
                <div class="candidate-info">
                    <p><strong>Your Details:</strong></p>
                    <p><strong>Name:</strong> {candidate_name}</p>
                    <p><strong>Email:</strong> {candidate_email}</p>
                </div>
                <div style="text-align: center;">
                    <a href="{exam_url_with_params}" class="button">Start AIML Assessment</a>
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
    
    subject = f"AIML Assessment Invitation - {test_title}"
    await email_service.send_email(candidate_email, subject, html_content)
    
    await db.test_candidates.update_one(
        {"test_id": test_id, "email": candidate_email},
        {"$set": {"status": "invited", "invited": True, "invited_at": datetime.utcnow()}}
    )
    
    return {"message": "Invitation sent", "email": candidate_email}


@router.get("/{test_id}/candidates")
async def get_test_candidates(
    test_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all candidates for an AIML test (requires authentication and ownership)
    Only test creators can view candidates
    """
    db = get_database()
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"[get_test_candidates] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    # Verify test ownership
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if str(test.get("created_by")) != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to view candidates for this test")
    
    # Get all candidates for this test
    candidates = await db.test_candidates.find({"test_id": test_id}).to_list(length=1000)
    
    # Get submission status for each candidate
    result = []
    for candidate in candidates:
        user_id_cand = candidate.get("user_id")
        
        # Check if candidate has submitted (completed)
        completed_submission = await db.test_submissions.find_one({
            "test_id": test_id,
            "user_id": user_id_cand,
            "is_completed": True
        })
        
        # Check if candidate has started but not completed
        started_submission = None
        if not completed_submission:
            started_submission = await db.test_submissions.find_one({
                "test_id": test_id,
                "user_id": user_id_cand,
                "started_at": {"$exists": True}
            })
        
        # Determine status based on submission state
        # Priority: completed > started > invited > pending
        candidate_status = candidate.get("status", "pending")
        
        if completed_submission:
            candidate_status = "completed"
        elif started_submission:
            candidate_status = "started"
        elif candidate.get("invited") or candidate.get("invited_at"):
            candidate_status = "invited"
        else:
            candidate_status = "pending"
        
        # Use completed submission if exists, otherwise use started submission
        submission = completed_submission or started_submission
        has_submitted = completed_submission is not None
        submission_score = submission.get("score", 0) if submission else 0
        submitted_at = submission.get("submitted_at") if submission else None
        started_at = submission.get("started_at") if submission else None
        
        result.append({
            "user_id": user_id_cand,
            "name": candidate.get("name"),
            "email": candidate.get("email"),
            "status": candidate_status,  # Use calculated status
            "invited": candidate.get("invited", False),
            "invited_at": candidate.get("invited_at").isoformat() if candidate.get("invited_at") else None,
            "created_at": candidate.get("created_at").isoformat() if candidate.get("created_at") else None,
            "has_submitted": has_submitted,
            "submission_score": submission_score,
            "submitted_at": submitted_at.isoformat() if submitted_at else None,
            "started_at": started_at.isoformat() if started_at else None,  # Include started_at for frontend
        })
    
    return result


@router.post("/{test_id}/send-invitations-to-all")
async def send_invitations_to_all(
    test_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Send invitation emails to all candidates for an AIML test
    """
    db = get_database()
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    
    # Check if test exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if str(test.get("created_by")) != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to send invitations for this test")
    
    if not test.get("is_published", False):
        raise HTTPException(status_code=400, detail="Test must be published before sending invitations")
    
    # Get all candidates for this test
    candidates = await db.test_candidates.find({"test_id": test_id}).to_list(length=1000)
    
    if not candidates:
        return {
            "message": "No candidates to send invitations to",
            "success_count": 0,
            "failed_count": 0,
            "failed_emails": []
        }
    
    # Get the shared test link
    test_token = test.get("test_token")
    if not test_token:
        # Generate token if not exists
        test_token = secrets.token_urlsafe(32)
        await db.tests.update_one(
            {"_id": ObjectId(test_id)},
            {"$set": {"test_token": test_token}}
        )
    
    # Build full test URL
    settings = get_settings()
    cors_origins = settings.cors_origins.split(",")[0].strip() if settings.cors_origins else "http://localhost:3000"
    test_link = f"{cors_origins}/aiml/test/{test_id}?token={test_token}"
    
    # Get email template
    stored_template = test.get("invitationTemplate", {})
    default_template = {
        "logoUrl": "",
        "companyName": "",
        "message": "You have been invited to take an AIML competency assessment. Please click the link below to start.",
        "footer": "",
        "sentBy": "AAPtor"
    }
    template_to_use = stored_template if stored_template else default_template
    
    # Get test details for email
    test_title = test.get("title", "AIML Assessment")
    test_description = test.get("description", "")
    duration_minutes = test.get("duration_minutes")
    schedule = test.get("schedule", {})
    end_time = test.get("end_time") or (schedule.get("endTime") if schedule else None)
    
    success_count = 0
    failed_count = 0
    failed_emails = []
    
    # Send emails to all candidates
    for candidate in candidates:
        try:
            if not settings.sendgrid_api_key or not settings.sendgrid_from_email:
                logger.warning("SendGrid is not configured. Skipping email send.")
                failed_count += 1
                failed_emails.append(candidate.get("email"))
                continue
            
            email_service = get_email_service()
            
            # Build exam URL with candidate params
            encoded_email = urllib.parse.quote(candidate.get("email"))
            encoded_name = urllib.parse.quote(candidate.get("name"))
            exam_url_with_params = f"{test_link}&email={encoded_email}&name={encoded_name}"
            
            # Replace placeholders
            message = template_to_use.get("message", default_template["message"])
            email_body = message
            email_body = email_body.replace("{{candidate_name}}", candidate.get("name"))
            email_body = email_body.replace("{{candidate_email}}", candidate.get("email"))
            email_body = email_body.replace("{{exam_url}}", exam_url_with_params)
            email_body = email_body.replace("{{company_name}}", template_to_use.get("companyName", ""))
            
            # Build HTML email
            logo_url = template_to_use.get("logoUrl", "")
            company_name = template_to_use.get("companyName", "")
            footer = template_to_use.get("footer", "")
            sent_by = template_to_use.get("sentBy", "AAPtor")
            
            # Format duration
            duration_text = ""
            if duration_minutes:
                hours = duration_minutes // 60
                minutes = duration_minutes % 60
                if hours > 0:
                    duration_text = f"{hours} hour{'s' if hours > 1 else ''}"
                    if minutes > 0:
                        duration_text += f" {minutes} minute{'s' if minutes > 1 else ''}"
                else:
                    duration_text = f"{minutes} minute{'s' if minutes > 1 else ''}"
            
            # Format deadline
            deadline_text = ""
            if end_time:
                try:
                    if isinstance(end_time, str):
                        # Handle ISO format strings
                        if end_time.endswith('Z'):
                            end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                        else:
                            end_dt = datetime.fromisoformat(end_time)
                    elif isinstance(end_time, datetime):
                        end_dt = end_time
                    else:
                        end_dt = None
                    
                    if end_dt:
                        # Convert to UTC if timezone-aware, otherwise assume UTC
                        if end_dt.tzinfo is None:
                            end_dt = end_dt.replace(tzinfo=timezone.utc)
                        else:
                            end_dt = end_dt.astimezone(timezone.utc)
                        deadline_text = end_dt.strftime("%B %d, %Y at %I:%M %p UTC")
                except Exception as e:
                    logger.warning(f"Failed to format deadline: {e}")
                    deadline_text = ""
            
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
                    .content {{ background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #10b981; }}
                    .button {{ display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                    .footer {{ text-align: center; color: #64748b; font-size: 0.875rem; margin-top: 30px; }}
                    .candidate-info {{ background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #10b981; }}
                    .assessment-title {{ font-size: 1.5rem; font-weight: bold; color: #10b981; margin: 15px 0; text-align: center; }}
                    .assessment-details {{ background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #10b981; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        {f'<img src="{logo_url}" alt="Logo" class="logo" />' if logo_url else ''}
                        {f'<h1>{company_name}</h1>' if company_name else ''}
                    </div>
                    <div class="content">
                        <p>Dear {candidate.get("name")},</p>
                        <div class="assessment-title">{test_title}</div>
                        {f'<div class="assessment-details"><p><strong>Description:</strong> {test_description}</p></div>' if test_description else ''}
                        {f'<div class="assessment-details"><p><strong>Duration:</strong> {duration_text}</p></div>' if duration_text else ''}
                        {f'<div class="assessment-details"><p><strong>Deadline:</strong> {deadline_text}</p></div>' if deadline_text else ''}
                        <p>{email_body}</p>
                        <div class="candidate-info">
                            <p><strong>Your Details:</strong></p>
                            <p><strong>Name:</strong> {candidate.get("name")}</p>
                            <p><strong>Email:</strong> {candidate.get("email")}</p>
                        </div>
                        <div style="text-align: center;">
                            <a href="{exam_url_with_params}" class="button">Start AIML Assessment</a>
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
            
            subject = f"AIML Assessment Invitation - {test_title}"
            
            await email_service.send_email(candidate.get("email"), subject, html_content)
            
            # Update candidate status to "invited"
            await db.test_candidates.update_one(
                {"test_id": test_id, "email": candidate.get("email")},
                {"$set": {
                    "status": "invited",
                    "invited": True,
                    "invited_at": datetime.utcnow()
                }}
            )
            
            success_count += 1
            logger.info(f"Invitation email sent successfully to {candidate.get('email')}")
        except Exception as e:
            failed_count += 1
            failed_emails.append(candidate.get("email"))
            logger.error(f"Failed to send invitation email to {candidate.get('email')}: {str(e)}")
    
    return {
        "message": f"Invitations sent. Success: {success_count}, Failed: {failed_count}",
        "success_count": success_count,
        "failed_count": failed_count,
        "failed_emails": failed_emails
    }


@router.get("/{test_id}/candidates/{user_id}/analytics")
async def get_candidate_analytics(
    test_id: str,
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get detailed analytics for a specific candidate (requires authentication and ownership).
    Optimized with batch question fetching, caching, and parallel processing.
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    try:
        db = get_database()
        admin_user_id = current_user.get("id") or current_user.get("_id")
        if not admin_user_id:
            raise HTTPException(status_code=400, detail="Invalid user ID")
        admin_user_id = str(admin_user_id).strip()
        
        # Input validation
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=400, detail="Invalid user ID")
        
        # Check cache first
        cached = await get_cached_candidate_analytics(test_id, user_id)
        if cached:
            logger.info(f"[{request_id}] Cache HIT for candidate analytics: test={test_id}, candidate={user_id}")
            return cached
        
        # Parallel fetch: test, candidate, and submission
        test_task = db.tests.find_one({"_id": ObjectId(test_id)}, {"created_by": 1, "question_ids": 1})
        candidate_task = db.test_candidates.find_one({
            "test_id": test_id,
            "user_id": user_id
        }, {"name": 1, "email": 1, "candidateInfo": 1})
        submission_task = db.test_submissions.find_one({
            "test_id": test_id,
            "user_id": user_id
        })
        
        test, candidate, submission = await asyncio.gather(
            test_task, candidate_task, submission_task,
            return_exceptions=True
        )
        
        # Handle exceptions from parallel fetch
        if isinstance(test, Exception):
            logger.error(f"[{request_id}] Error fetching test: {test}")
            raise HTTPException(status_code=500, detail="Failed to fetch test data")
        if isinstance(candidate, Exception):
            logger.error(f"[{request_id}] Error fetching candidate: {candidate}")
            raise HTTPException(status_code=500, detail="Failed to fetch candidate data")
        if isinstance(submission, Exception):
            logger.error(f"[{request_id}] Error fetching submission: {submission}")
            raise HTTPException(status_code=500, detail="Failed to fetch submission data")
        
        # Verify test ownership
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        if str(test.get("created_by")) != admin_user_id:
            raise HTTPException(status_code=403, detail="You don't have permission to view analytics for this test")
        
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Get candidateInfo from candidate record (even if no submission)
        candidate_info = candidate.get("candidateInfo", {})
        
        if not submission:
            result = {
                "candidate": {
                    "name": candidate.get("name"),
                    "email": candidate.get("email")
                },
                "candidateInfo": candidate_info if candidate_info else None,
                "submission": None,
                "question_analytics": [],
                "activity_logs": []
            }
            # Cache even empty results
            await set_cached_candidate_analytics(test_id, user_id, result)
            return result
        
        # Get question IDs from test
        question_ids = test.get("question_ids", [])
        if not question_ids:
            result = {
                "candidate": {
                    "name": candidate.get("name"),
                    "email": candidate.get("email")
                },
                "candidateInfo": candidate_info if candidate_info else None,
                "submission": {
                    "score": submission.get("score", 0),
                    "started_at": submission.get("started_at").isoformat() if submission.get("started_at") else None,
                    "submitted_at": submission.get("submitted_at").isoformat() if submission.get("submitted_at") else None,
                    "is_completed": submission.get("is_completed", False),
                    "ai_feedback_status": submission.get("ai_feedback_status", "pending"),
                    "evaluations": submission.get("evaluations", [])
                },
                "question_analytics": [],
                "activity_logs": []
            }
            await set_cached_candidate_analytics(test_id, user_id, result)
            return result
        
        # OPTIMIZATION: Batch fetch all questions in a single query (fixes N+1 problem)
        valid_question_ids = [ObjectId(qid) for qid in question_ids if ObjectId.is_valid(qid)]
        if not valid_question_ids:
            logger.warning(f"[{request_id}] No valid question IDs found")
            question_analytics = []
        else:
            # Single query with field projection
            questions_cursor = db.questions.find(
                {"_id": {"$in": valid_question_ids}},
                {"_id": 1, "title": 1, "description": 1, "tasks": 1, "difficulty": 1}
            )
            questions_list = await questions_cursor.to_list(length=len(valid_question_ids))
            
            # Convert to dict for O(1) lookup
            questions_dict = {str(q["_id"]): q for q in questions_list}
            
            # Get submissions for each question
            question_analytics = []
            submissions_list = submission.get("submissions", [])
            # Create submission lookup dict for O(1) access
            submissions_dict = {str(sub.get("question_id")): sub for sub in submissions_list if sub.get("question_id")}
            
            for qid in question_ids:
                if not ObjectId.is_valid(qid):
                    continue
                
                qid_str = str(qid)  # Convert to string for dictionary lookup
                question = questions_dict.get(qid_str)
                if not question:
                    logger.warning(f"[{request_id}] Question {qid_str} not found in batch fetch")
                    continue
                
                # O(1) lookup instead of O(n) loop - use string key
                question_submission = submissions_dict.get(qid_str)
                
                # Debug logging
                if not question_submission:
                    logger.warning(f"[{request_id}] No submission found for question {qid_str}. Available keys: {list(submissions_dict.keys())}")
                
                # Get AI feedback from submission if available
                ai_feedback = question_submission.get("ai_feedback") if question_submission else None
                question_score = question_submission.get("score", 0) if question_submission else 0
                
                question_analytics.append({
                    "question_id": qid_str,
                    "question_title": question.get("title", ""),
                    "description": question.get("description", ""),
                    "tasks": question.get("tasks", []),
                    "difficulty": question.get("difficulty", "medium"),
                    "language": "python3",
                    "status": question_submission.get("status", "submitted") if question_submission else "not_submitted",
                    "code": question_submission.get("source_code", "") if question_submission else "",
                    "outputs": question_submission.get("outputs", []) if question_submission else [],
                    "submitted_at": question_submission.get("submitted_at").isoformat() if question_submission and question_submission.get("submitted_at") else None,
                    "created_at": question_submission.get("submitted_at").isoformat() if question_submission and question_submission.get("submitted_at") else None,
                    # AI Feedback fields
                    "score": question_score,
                    "ai_feedback": ai_feedback,
                })
        
        result = {
            "candidate": {
                "name": candidate.get("name"),
                "email": candidate.get("email")
            },
            "candidateInfo": candidate_info if candidate_info else None,
            "submission": {
                "score": submission.get("score", 0),
                "started_at": submission.get("started_at").isoformat() if submission.get("started_at") else None,
                "submitted_at": submission.get("submitted_at").isoformat() if submission.get("submitted_at") else None,
                "is_completed": submission.get("is_completed", False),
                "ai_feedback_status": submission.get("ai_feedback_status", "pending"),
                "evaluations": submission.get("evaluations", [])
            },
            "question_analytics": question_analytics,
            "activity_logs": []  # AIML doesn't have proctoring logs yet
        }
        
        # Cache the result
        await set_cached_candidate_analytics(test_id, user_id, result)
        
        # Log performance
        elapsed = time.time() - start_time
        logger.info(f"[{request_id}] Candidate analytics fetched in {elapsed:.2f}s: test={test_id}, candidate={user_id}, questions={len(question_analytics)}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[{request_id}] Error fetching candidate analytics after {elapsed:.2f}s: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch candidate analytics: {str(e)}")


@router.get("/{test_id}/analytics")
async def get_test_analytics_bulk(
    test_id: str,
    page: int = Query(1, ge=1, le=100, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get bulk analytics for all candidates in a test (requires authentication and ownership).
    Production-ready endpoint with:
    - Batch question fetching (fixes N+1 problem)
    - Redis caching with graceful degradation
    - Parallel processing
    - Field projection
    - Pagination
    - Comprehensive error handling
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    try:
        db = get_database()
        admin_user_id = current_user.get("id") or current_user.get("_id")
        if not admin_user_id:
            raise HTTPException(status_code=400, detail="Invalid user ID")
        admin_user_id = str(admin_user_id).strip()
        
        # Input validation
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")
        
        # Check cache first
        cached = await get_cached_bulk_analytics(test_id, page, limit)
        if cached:
            logger.info(f"[{request_id}] Cache HIT for bulk analytics: test={test_id}, page={page}")
            return cached
        
        # Verify test ownership with timeout protection
        try:
            test = await asyncio.wait_for(
                db.tests.find_one(
                    {"_id": ObjectId(test_id)},
                    {"created_by": 1, "question_ids": 1, "title": 1}
                ),
                timeout=2.0
            )
        except asyncio.TimeoutError:
            logger.error(f"[{request_id}] Timeout fetching test {test_id}")
            raise HTTPException(status_code=504, detail="Request timeout")
        
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        if str(test.get("created_by")) != admin_user_id:
            raise HTTPException(status_code=403, detail="You don't have permission to view analytics for this test")
        
        # Get question IDs and batch fetch questions
        question_ids = test.get("question_ids", [])
        questions_dict = {}
        
        if question_ids:
            valid_question_ids = [ObjectId(qid) for qid in question_ids if ObjectId.is_valid(qid)]
            if valid_question_ids:
                try:
                    questions_cursor = db.questions.find(
                        {"_id": {"$in": valid_question_ids}},
                        {"_id": 1, "title": 1, "description": 1, "tasks": 1, "difficulty": 1}
                    )
                    questions_list = await questions_cursor.to_list(length=len(valid_question_ids))
                    questions_dict = {str(q["_id"]): q for q in questions_list}
                except Exception as e:
                    logger.warning(f"[{request_id}] Error fetching questions: {e}")
        
        # Calculate pagination
        skip = (page - 1) * limit
        
        # Fetch candidates with pagination
        candidates_cursor = db.test_candidates.find(
            {"test_id": test_id},
            {"user_id": 1, "name": 1, "email": 1, "candidateInfo": 1, "status": 1}
        ).sort("created_at", -1).skip(skip).limit(limit)
        
        candidates = await candidates_cursor.to_list(length=limit)
        
        # Get total count
        total_count = await db.test_candidates.count_documents({"test_id": test_id})
        
        # Get all user_ids for batch fetching submissions
        user_ids = [c.get("user_id") for c in candidates if c.get("user_id")]
        
        # Batch fetch all submissions for these candidates
        submissions_dict = {}
        if user_ids:
            try:
                submissions_cursor = db.test_submissions.find(
                    {"test_id": test_id, "user_id": {"$in": user_ids}},
                    {"user_id": 1, "score": 1, "started_at": 1, "submitted_at": 1, 
                     "is_completed": 1, "ai_feedback_status": 1, "evaluations": 1, "submissions": 1}
                )
                submissions_list = await submissions_cursor.to_list(length=len(user_ids))
                submissions_dict = {str(sub.get("user_id")): sub for sub in submissions_list}
            except Exception as e:
                logger.warning(f"[{request_id}] Error fetching submissions: {e}")
        
        # Build analytics for each candidate
        candidates_analytics = []
        for candidate in candidates:
            user_id = candidate.get("user_id")
            if not user_id:
                continue
            
            user_id_str = str(user_id)
            submission = submissions_dict.get(user_id_str)
            
            # Build question analytics if submission exists
            question_analytics = []
            if submission and question_ids:
                submissions_list = submission.get("submissions", [])
                submissions_lookup = {str(sub.get("question_id")): sub for sub in submissions_list if sub.get("question_id")}
                
                for qid in question_ids:
                    if not ObjectId.is_valid(qid):
                        continue
                    
                    question = questions_dict.get(qid)
                    if not question:
                        continue
                    
                    question_submission = submissions_lookup.get(qid)
                    ai_feedback = question_submission.get("ai_feedback") if question_submission else None
                    question_score = question_submission.get("score", 0) if question_submission else 0
                    
                    question_analytics.append({
                        "question_id": str(qid),
                        "question_title": question.get("title", ""),
                        "description": question.get("description", ""),
                        "tasks": question.get("tasks", []),
                        "difficulty": question.get("difficulty", "medium"),
                        "score": question_score,
                        "ai_feedback": ai_feedback,
                        "status": question_submission.get("status", "submitted") if question_submission else "not_submitted",
                    })
            
            candidate_data = {
                "user_id": user_id_str,
                "candidate": {
                    "name": candidate.get("name"),
                    "email": candidate.get("email")
                },
                "candidateInfo": candidate.get("candidateInfo") if candidate.get("candidateInfo") else None,
                "submission": {
                    "score": submission.get("score", 0) if submission else 0,
                    "started_at": submission.get("started_at").isoformat() if submission and submission.get("started_at") else None,
                    "submitted_at": submission.get("submitted_at").isoformat() if submission and submission.get("submitted_at") else None,
                    "is_completed": submission.get("is_completed", False) if submission else False,
                    "ai_feedback_status": submission.get("ai_feedback_status", "pending") if submission else "pending",
                    "evaluations": submission.get("evaluations", []) if submission else []
                } if submission else None,
                "question_analytics": question_analytics,
                "activity_logs": []  # AIML doesn't have proctoring logs yet
            }
            
            candidates_analytics.append(candidate_data)
        
        # Build response with pagination
        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 0
        result = {
            "test_id": test_id,
            "test_title": test.get("title", ""),
            "candidates": candidates_analytics,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1
            }
        }
        
        # Cache the result
        await set_cached_bulk_analytics(test_id, result, page, limit)
        
        # Log performance
        elapsed = time.time() - start_time
        logger.info(f"[{request_id}] Bulk analytics fetched in {elapsed:.2f}s: test={test_id}, candidates={len(candidates_analytics)}, page={page}")
        
        return result
        
    except HTTPException:
        raise
    except asyncio.TimeoutError:
        elapsed = time.time() - start_time
        logger.error(f"[{request_id}] Timeout after {elapsed:.2f}s")
        raise HTTPException(status_code=504, detail="Request timeout")
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[{request_id}] Error fetching bulk analytics after {elapsed:.2f}s: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch bulk analytics: {str(e)}")


@router.post("/{test_id}/candidates/{user_id}/send-feedback")
async def send_candidate_feedback(
    test_id: str,
    user_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Send AI feedback email to a candidate (only available after test end time).
    Includes detailed feedback, scores, and improvement suggestions for AIML tests.
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
    
    # Get question IDs from test
    question_ids = test.get("question_ids", [])
    
    # Get submissions for each question
    question_analytics = []
    submissions_list = submission.get("submissions", [])
    
    for qid in question_ids:
        question = await db.questions.find_one({"_id": ObjectId(qid)})
        if not question:
            continue
        
        # Find submission for this question
        question_submission = None
        for sub in submissions_list:
            if sub.get("question_id") == str(qid):
                question_submission = sub
                break
        
        # Get AI feedback from submission if available
        ai_feedback = question_submission.get("ai_feedback") if question_submission else None
        question_score = question_submission.get("score", 0) if question_submission else 0
        
        question_analytics.append({
            "question_id": str(qid),
            "question_title": question.get("title", "Unknown"),
            "description": question.get("description", ""),
            "tasks": question.get("tasks", []),
            "difficulty": question.get("difficulty", "medium"),
            "language": question_submission.get("source_code", "")[:50] if question_submission else "N/A",
            "code": question_submission.get("source_code", "") if question_submission else "",
            "outputs": question_submission.get("outputs", []) if question_submission else [],
            "submitted_at": question_submission.get("submitted_at").isoformat() if question_submission and question_submission.get("submitted_at") else None,
            "score": question_score,
            "ai_feedback": ai_feedback,
        })
    
    # Check email service configuration
    settings = get_settings()
    if not settings.sendgrid_api_key or not settings.sendgrid_from_email:
        raise HTTPException(status_code=500, detail="Email service is not configured")
    
    email_service = get_email_service()
    
    # Build HTML email with feedback
    test_title = test.get("title", "AIML Test")
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
                <div style="font-weight: 600; color: #475569; margin-bottom: 0.5rem;">Question Details</div>
                <div style="color: #64748b; font-size: 0.875rem;">
                    Difficulty: {qa.get('difficulty', 'N/A')}<br>
                    Language: {qa.get('language', 'N/A')}
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
            
            # Library Usage
            library_usage = ai_feedback.get("library_usage", {})
            if library_usage:
                feedback_html += f"""
                <div style="margin-bottom: 1rem; padding: 0.75rem; background-color: #f1f5f9; border-radius: 6px;">
                    <div style="font-weight: 600; color: #334155; margin-bottom: 0.5rem;">Library Usage ({library_usage.get('score', 0)}/100)</div>
                    <div style="color: #475569; font-size: 0.875rem; line-height: 1.6;">
                        {library_usage.get('comments', '')}
                    </div>
                </div>
                """
            
            # Output Quality
            output_quality = ai_feedback.get("output_quality", {})
            if output_quality:
                feedback_html += f"""
                <div style="margin-bottom: 1rem; padding: 0.75rem; background-color: #f1f5f9; border-radius: 6px;">
                    <div style="font-weight: 600; color: #334155; margin-bottom: 0.5rem;">Output Quality ({output_quality.get('score', 0)}/100)</div>
                    <div style="color: #475569; font-size: 0.875rem; line-height: 1.6;">
                        {output_quality.get('comments', '')}
                    </div>
                </div>
                """
            
            # Task Completion
            task_completion = ai_feedback.get("task_completion", {})
            if task_completion:
                completed = task_completion.get("completed", 0)
                total = task_completion.get("total", 0)
                details = task_completion.get("details", [])
                feedback_html += f"""
                <div style="margin-bottom: 1rem; padding: 0.75rem; background-color: #f1f5f9; border-radius: 6px;">
                    <div style="font-weight: 600; color: #334155; margin-bottom: 0.5rem;">Task Completion ({completed}/{total})</div>
                    {f'<ul style="margin: 0; padding-left: 1.25rem; color: #475569; font-size: 0.875rem;"><li>' + '</li><li>'.join(details) + '</li></ul>' if details else ''}
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
    await email_service.send_email(candidate_email, subject, html_content)
    
    return {"message": "Feedback email sent successfully", "email": candidate_email}


@router.delete("/{test_id}/candidates/{user_id}")
async def remove_candidate(
    test_id: str,
    user_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Remove a candidate from an AIML test (requires authentication and ownership)
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
    
    if str(test.get("created_by")) != admin_user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to remove candidates from this test")
    
    # Get candidate info
    candidate = await db.test_candidates.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Remove candidate record
    await db.test_candidates.delete_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    # Remove from invited_users list
    current_invited = set(test.get("invited_users", []))
    current_invited.discard(candidate.get("email"))
    await db.tests.update_one(
        {"_id": ObjectId(test_id)},
        {"$set": {"invited_users": list(current_invited)}}
    )
    
    return {"message": "Candidate removed successfully"}


@router.get("/employee-tests", response_model=Dict[str, Any])
async def get_employee_tests(
    email: str = Query(..., description="Employee email used for AIML invitations"),
    organizationId: Optional[str] = Query(None, description="Organization ID for filtering"),
    aaptorId: Optional[str] = Query(None, description="Aaptor ID for verification"),
):
    """
    Return list of AIML tests this email has been invited to, filtered by organization.

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
            "message": "No AIML tests found for this employee",
            "data": {"tests": []},
        }

    # Get unique test IDs
    test_ids = {c.get("test_id") for c in candidates if c.get("test_id")}
    
    # Build query for tests
    tests_query = {"_id": {"$in": [ObjectId(tid) for tid in test_ids if ObjectId.is_valid(tid)]}}
    
    # Filter by test_type = "aiml"
    tests_query["test_type"] = "aiml"
    
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
            "title": test.get("title") or "Untitled AIML Test",
            "type": "aiml",
            "status": status_val,
            "inviteSentAt": invited_at.isoformat() if invited_at and isinstance(invited_at, datetime) else (invited_at if invited_at else None),
            "organizationId": str(test.get("organization", "")) if test.get("organization") else None,
        })

    return {
        "message": "AIML tests fetched successfully",
        "data": {"tests": results},
    }


@router.get("/{test_id}/get-assessment-full")
async def get_assessment_full(
    test_id: str,
    token: str = Query(..., description="Access token"),
) -> Dict[str, Any]:
    """
    Get full AIML test details including proctoring settings.
    Compatible with the get-assessment-full endpoint used by the frontend.
    """
    try:
        db = get_database()
        
        if not ObjectId.is_valid(test_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid test ID"
            )
        
        test = await db.tests.find_one({"_id": ObjectId(test_id), "test_type": "aiml"})
        
        if not test:
            logger.warning(f"[AIML][get_assessment_full] Test not found: {test_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="AIML test not found"
            )
        
        # Serialize the test document
        from app.utils.mongo import serialize_document
        test_serialized = serialize_document(test)
        
        # Ensure proctoringSettings is at the top level for frontend compatibility
        # Frontend looks for schedule.proctoringSettings or proctoringSettings
        if "proctoringSettings" not in test_serialized and "schedule" in test_serialized:
            # If proctoringSettings is in schedule, also add it at top level
            schedule = test_serialized.get("schedule", {})
            if isinstance(schedule, dict) and "proctoringSettings" in schedule:
                test_serialized["proctoringSettings"] = schedule["proctoringSettings"]
        
        logger.info(f"[AIML][get_assessment_full] Test {test_id} fetched successfully")
        
        return success_response("AIML test fetched successfully", test_serialized)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[AIML][get_assessment_full] Error getting test: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get test: {str(e)}"
        )
