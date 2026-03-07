"""
Test management endpoints for Data Engineering assessments.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, List, Dict, Any
import structlog
from datetime import datetime, timedelta
import secrets
from bson import ObjectId

from app.models.test import Test, TestCreate, TestUpdate
from app.core.auth import get_current_user
from app.core.database import get_database

logger = structlog.get_logger()
router = APIRouter()


@router.post("", response_model=dict)
async def create_test(
    test: TestCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> dict:
    """Create a new Data Engineering test."""
    try:
        db = await get_database()
        
        # DEBUGGING: Log everything
        print(f"[DEBUG] create_test called with current_user: {current_user}")
        logger.info(f"[create_test] DEBUGGING - current_user={current_user}")
        
        # Get user ID
        user_id = current_user.get("user_id") or current_user.get("id") or current_user.get("_id")
        
        print(f"[DEBUG] extracted user_id: {user_id}")
        logger.info(f"[create_test] current_user={current_user}, extracted user_id={user_id}")
        
        if not user_id or not str(user_id).strip():
            error_msg = f"DEBUGGING ERROR 2024: Invalid user ID. current_user={current_user}, keys={list(current_user.keys())}"
            print(f"[DEBUG] {error_msg}")
            logger.error(f"[create_test] {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        user_id = str(user_id).strip()
        
        logger.info(f"[create_test] Creating Data Engineering test with user_id: '{user_id}'")
        
        # Validate questions belong to user
        if test.question_ids:
            question_ids = [ObjectId(qid) if ObjectId.is_valid(qid) else None for qid in test.question_ids]
            question_ids = [qid for qid in question_ids if qid is not None]
            
            if question_ids:
                questions = await db.questions.find({"_id": {"$in": question_ids}}).to_list(length=len(question_ids))
                found_question_ids = {str(q["_id"]) for q in questions}
                requested_question_ids = {str(qid) for qid in question_ids}
                
                if found_question_ids != requested_question_ids:
                    raise HTTPException(status_code=400, detail="Some questions not found")
                
                # Verify ownership
                for question in questions:
                    q_created_by = question.get("created_by")
                    if not q_created_by or str(q_created_by).strip() != user_id.strip():
                        raise HTTPException(status_code=403, detail=f"Question does not belong to you")
        
        # Exam window configuration
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
        
        # For strict mode, calculate endTime from startTime + duration
        calculated_end_time = None
        if exam_mode == "strict" and start_dt and duration_minutes:
            calculated_end_time = start_dt + timedelta(minutes=int(duration_minutes))
        
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

        # Extract candidateRequirements from schedule
        candidate_requirements = {}
        if schedule_obj and hasattr(schedule_obj, "candidateRequirements"):
            cr = schedule_obj.candidateRequirements
            if cr:
                # Convert Pydantic model to dict if needed
                if hasattr(cr, "model_dump"):
                    candidate_requirements = cr.model_dump()
                elif hasattr(cr, "dict"):
                    candidate_requirements = cr.dict()
                elif isinstance(cr, dict):
                    candidate_requirements = cr
                else:
                    candidate_requirements = {}
        elif schedule_obj and isinstance(schedule_obj, dict):
            candidate_requirements = schedule_obj.get("candidateRequirements", {})
        
        # Extract proctoringSettings
        test_dict = test.model_dump()
        proctoring_settings = None
        if "proctoringSettings" in test_dict and test_dict["proctoringSettings"]:
            proctoring_settings = test_dict["proctoringSettings"]
            if hasattr(proctoring_settings, "model_dump"):
                proctoring_settings = proctoring_settings.model_dump()
            elif not isinstance(proctoring_settings, dict):
                try:
                    proctoring_settings = dict(proctoring_settings) if proctoring_settings else None
                except:
                    proctoring_settings = None
        
        schedule_payload = {
            "startTime": start_dt,
            "endTime": final_end_time,
            "duration": int(duration_minutes) if duration_minutes else None,
            "candidateRequirements": candidate_requirements,
            "proctoringSettings": proctoring_settings,
        }

        test_dict["examMode"] = exam_mode
        test_dict["schedule"] = schedule_payload
        if proctoring_settings:
            test_dict["proctoringSettings"] = proctoring_settings
        test_dict["start_time"] = start_dt
        test_dict["end_time"] = final_end_time

        # Timer configuration
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
            test_dict["duration_minutes"] = int(duration_minutes) if duration_minutes else 60
        
        test_dict["created_by"] = user_id
        test_dict["is_active"] = True
        test_dict["is_published"] = False
        test_dict["invited_users"] = []
        test_dict["created_at"] = datetime.utcnow()
        test_dict["test_type"] = "data_engineering"
        
        # Generate test token
        test_dict["test_token"] = secrets.token_urlsafe(32)
        
        result = await db.tests.insert_one(test_dict)
        
        # Fetch the created test
        created_test = await db.tests.find_one({"_id": result.inserted_id})
        if created_test:
            response_dict = {
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
                "proctoringSettings": created_test.get("proctoringSettings"),
                "is_active": created_test.get("is_active", False),
                "is_published": created_test.get("is_published", False),
                "question_ids": [str(qid) for qid in created_test.get("question_ids", [])],
                "test_token": created_test.get("test_token"),
            }
            
            logger.info("Test created", test_id=str(result.inserted_id), title=response_dict["title"])
            return response_dict
        
        test_dict["id"] = str(result.inserted_id)
        return test_dict
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create test", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create test: {str(e)}")


@router.get("", response_model=List[dict])
async def list_tests(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    is_published: Optional[bool] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> List[dict]:
    """List all tests with optional filtering."""
    try:
        db = await get_database()
        
        user_id = current_user.get("id") or current_user.get("_id") if current_user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(user_id).strip()
        
        query = {"created_by": user_id, "test_type": "data_engineering"}
        
        if is_published is not None:
            query["is_published"] = is_published
        
        tests = await db.tests.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        result = []
        for test in tests:
            result.append({
                "id": str(test["_id"]),
                "title": test.get("title", ""),
                "description": test.get("description", ""),
                "duration_minutes": test.get("duration_minutes", 0),
                "start_time": test.get("start_time").isoformat() if test.get("start_time") else None,
                "end_time": test.get("end_time").isoformat() if test.get("end_time") else None,
                "is_active": test.get("is_active", False),
                "is_published": test.get("is_published", False),
                "question_ids": [str(qid) for qid in test.get("question_ids", [])],
                "created_at": test.get("created_at").isoformat() if test.get("created_at") else None,
                "created_by": str(test.get("created_by", "")),  # CRITICAL: Include for client-side verification
            })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to list tests", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve tests")


@router.get("/{test_id}", response_model=dict)
async def get_test(
    test_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> dict:
    """Get a specific test by ID."""
    try:
        db = await get_database()
        
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")
        
        test = await db.tests.find_one({"_id": ObjectId(test_id)})
        
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        return {
            "id": str(test["_id"]),
            "title": test.get("title", ""),
            "description": test.get("description", ""),
            "duration_minutes": test.get("duration_minutes", 0),
            "start_time": test.get("start_time").isoformat() if test.get("start_time") else None,
            "end_time": test.get("end_time").isoformat() if test.get("end_time") else None,
            "timer_mode": test.get("timer_mode", "GLOBAL"),
            "question_timings": test.get("question_timings"),
            "examMode": test.get("examMode", "strict"),
            "schedule": test.get("schedule"),
            "proctoringSettings": test.get("proctoringSettings"),
            "is_active": test.get("is_active", False),
            "is_published": test.get("is_published", False),
            "question_ids": [str(qid) for qid in test.get("question_ids", [])],
            "test_token": test.get("test_token"),
            "created_at": test.get("created_at").isoformat() if test.get("created_at") else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get test", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve test")


@router.patch("/{test_id}", response_model=dict)
async def update_test(
    test_id: str,
    test_update: TestUpdate,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> dict:
    """Update a test."""
    try:
        db = await get_database()
        
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")
        
        test = await db.tests.find_one({"_id": ObjectId(test_id)})
        
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        update_data = test_update.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        await db.tests.update_one(
            {"_id": ObjectId(test_id)},
            {"$set": update_data}
        )
        
        updated_test = await db.tests.find_one({"_id": ObjectId(test_id)})
        
        logger.info("Test updated", test_id=test_id)
        
        return {
            "id": str(updated_test["_id"]),
            "title": updated_test.get("title", ""),
            "description": updated_test.get("description", ""),
            "duration_minutes": updated_test.get("duration_minutes", 0),
            "start_time": updated_test.get("start_time").isoformat() if updated_test.get("start_time") else None,
            "end_time": updated_test.get("end_time").isoformat() if updated_test.get("end_time") else None,
            "is_active": updated_test.get("is_active", False),
            "is_published": updated_test.get("is_published", False),
            "question_ids": [str(qid) for qid in updated_test.get("question_ids", [])],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update test", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update test")


@router.patch("/{test_id}/publish")
async def toggle_publish_test(
    test_id: str,
    is_published: bool = Query(..., description="Set publish status"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Toggle publish status of a test."""
    try:
        db = await get_database()
        
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")
        
        test = await db.tests.find_one({"_id": ObjectId(test_id)})
        
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        await db.tests.update_one(
            {"_id": ObjectId(test_id)},
            {"$set": {"is_published": is_published, "updated_at": datetime.utcnow()}}
        )
        
        updated_test = await db.tests.find_one({"_id": ObjectId(test_id)})
        
        logger.info(
            "Test publish status updated",
            test_id=test_id,
            is_published=is_published
        )
        
        return {
            "message": f"Test {'published' if is_published else 'unpublished'} successfully",
            "test": {
                "id": str(updated_test["_id"]),
                "title": updated_test.get("title", ""),
                "is_published": updated_test.get("is_published", False),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to toggle publish status", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update publish status")


@router.delete("/{test_id}")
async def delete_test(
    test_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, str]:
    """Delete a test."""
    try:
        db = await get_database()
        
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")
        
        result = await db.tests.delete_one({"_id": ObjectId(test_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Test not found")
        
        logger.info("Test deleted", test_id=test_id)
        
        return {"message": "Test deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete test", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete test")


# Candidate Management Endpoints

@router.post("/{test_id}/candidates")
async def add_candidate(
    test_id: str,
    candidate_data: Dict[str, Any],
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Add a candidate to a test."""
    try:
        db = await get_database()
        
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")
        
        test = await db.tests.find_one({"_id": ObjectId(test_id)})
        
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        if not test.get("is_published", False):
            raise HTTPException(status_code=400, detail="Test must be published before adding candidates")
        
        email = candidate_data.get("email", "").strip().lower()
        name = candidate_data.get("name", "")
        
        if not email or not name:
            raise HTTPException(status_code=400, detail="Name and email are required")
        
        # Check if candidate already exists for this test
        existing_candidate = await db.test_candidates.find_one({
            "test_id": test_id,
            "email": email
        })
        
        if existing_candidate:
            raise HTTPException(status_code=400, detail="Candidate already added to this test")
        
        # Check if user already exists
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            user_id = str(existing_user["_id"])
        else:
            # Create new user account
            # First, generate the ObjectId so we can use it as user_id
            new_user_id = ObjectId()
            user_dict = {
                "_id": new_user_id,
                "user_id": str(new_user_id),  # Add user_id field to avoid unique constraint violation
                "username": name.lower().replace(" ", "_"),
                "email": email,
                "hashed_password": "",  # No password - candidates use shared link
                "is_admin": False,
                "total_score": 0,
                "questions_solved": 0,
            }
            await db.users.insert_one(user_dict)
            user_id = str(new_user_id)
        
        # Store candidate record
        candidate_record = {
            "test_id": test_id,
            "user_id": user_id,
            "name": name,
            "email": email,
            "aaptorId": candidate_data.get("aaptorId"),
            "status": "pending",
            "invited": False,
            "invited_at": None,
            "created_at": datetime.utcnow(),
        }
        await db.test_candidates.insert_one(candidate_record)
        
        # Add email to invited_users
        current_invited = set(test.get("invited_users", []))
        current_invited.add(email)
        await db.tests.update_one(
            {"_id": ObjectId(test_id)},
            {"$set": {"invited_users": list(current_invited)}}
        )
        
        logger.info(
            "Candidate added to test",
            test_id=test_id,
            candidate_email=email
        )
        
        return {
            "candidate_id": user_id,
            "name": name,
            "email": email,
            "status": "pending"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to add candidate", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to add candidate: {str(e)}")


@router.get("/{test_id}/candidates")
async def list_candidates(
    test_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """List all candidates for a test."""
    try:
        db = await get_database()
        
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")
        
        test = await db.tests.find_one({"_id": ObjectId(test_id)})
        
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        candidates = await db.test_candidates.find({"test_id": test_id}).sort("created_at", -1).to_list(length=1000)
        
        result = []
        for candidate in candidates:
            result.append({
                "user_id": candidate.get("user_id"),
                "name": candidate.get("name", ""),
                "email": candidate.get("email", ""),
                "status": candidate.get("status", "pending"),
                "invited": candidate.get("invited", False),
                "invited_at": candidate.get("invited_at").isoformat() if candidate.get("invited_at") else None,
                "created_at": candidate.get("created_at").isoformat() if candidate.get("created_at") else None,
            })
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to list candidates", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve candidates")


@router.delete("/{test_id}/candidates/{user_id}")
async def remove_candidate(
    test_id: str,
    user_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, str]:
    """Remove a candidate from a test."""
    try:
        db = await get_database()
        
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")
        
        test = await db.tests.find_one({"_id": ObjectId(test_id)})
        
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        result = await db.test_candidates.delete_one({
            "test_id": test_id,
            "user_id": user_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        logger.info(
            "Candidate removed from test",
            test_id=test_id,
            user_id=user_id
        )
        
        return {"message": "Candidate removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to remove candidate", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to remove candidate")


@router.post("/{test_id}/candidates/bulk")
async def bulk_add_candidates(
    test_id: str,
    candidates_data: List[Dict[str, Any]],
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Bulk add candidates to a test."""
    try:
        db = await get_database()
        
        if not ObjectId.is_valid(test_id):
            raise HTTPException(status_code=400, detail="Invalid test ID")
        
        test = await db.tests.find_one({"_id": ObjectId(test_id)})
        
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        if not test.get("is_published", False):
            raise HTTPException(status_code=400, detail="Test must be published before adding candidates")
        
        added = []
        skipped = []
        
        for candidate_data in candidates_data:
            email = candidate_data.get("email", "").strip().lower()
            name = candidate_data.get("name", "")
            
            if not email or not name:
                skipped.append(email or "unknown")
                continue
            
            # Check if candidate already exists
            existing_candidate = await db.test_candidates.find_one({
                "test_id": test_id,
                "email": email
            })
            
            if existing_candidate:
                skipped.append(email)
                continue
            
            # Check if user already exists
            existing_user = await db.users.find_one({"email": email})
            if existing_user:
                user_id = str(existing_user["_id"])
            else:
                # Create new user account
                # First, generate the ObjectId so we can use it as user_id
                new_user_id = ObjectId()
                user_dict = {
                    "_id": new_user_id,
                    "user_id": str(new_user_id),  # Add user_id field to avoid unique constraint violation
                    "username": name.lower().replace(" ", "_"),
                    "email": email,
                    "hashed_password": "",
                    "is_admin": False,
                    "total_score": 0,
                    "questions_solved": 0,
                }
                await db.users.insert_one(user_dict)
                user_id = str(new_user_id)
            
            # Store candidate record
            candidate_record = {
                "test_id": test_id,
                "user_id": user_id,
                "name": name,
                "email": email,
                "aaptorId": candidate_data.get("aaptorId"),
                "status": "pending",
                "invited": False,
                "invited_at": None,
                "created_at": datetime.utcnow(),
            }
            await db.test_candidates.insert_one(candidate_record)
            added.append(email)
        
        # Update invited_users list
        if added:
            current_invited = set(test.get("invited_users", []))
            current_invited.update(added)
            await db.tests.update_one(
                {"_id": ObjectId(test_id)},
                {"$set": {"invited_users": list(current_invited)}}
            )
        
        logger.info(
            "Bulk candidates added",
            test_id=test_id,
            added_count=len(added),
            skipped_count=len(skipped)
        )
        
        return {
            "message": f"Added {len(added)} candidates, skipped {len(skipped)} duplicates",
            "added": added,
            "skipped": skipped
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to bulk add candidates", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to bulk add candidates: {str(e)}")
