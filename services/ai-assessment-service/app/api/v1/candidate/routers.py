"""
Candidate API endpoints for assessment taking.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from ....db.mongo import get_db
from ....utils.mongo import serialize_document, to_object_id
from ....utils.responses import success_response
from ....utils.face_image_storage import prepare_image_for_storage, validate_face_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/candidate", tags=["candidate"])


class EmployeeTestSummary(BaseModel):
    """Summary of tests/assessments assigned to an employee (by email)."""
    assessmentId: str
    title: str
    type: str  # assessment | custom_mcq | dsa | aiml
    status: Optional[str] = None
    inviteSentAt: Optional[str] = None


@router.get("/employee-tests")
async def get_employee_tests(
    email: str = Query(..., description="Employee email used for invitations"),
    organizationId: Optional[str] = Query(None, description="Organization ID for filtering"),
    aaptorId: Optional[str] = Query(None, description="Aaptor ID for verification"),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Return list of tests/assessments this email has been invited to, filtered by organization.

    SECURITY: 
    - If organizationId is provided, only returns tests from that organization
    - Verifies employee is in candidates list
    - Ensures organization isolation

    Looks at:
    - AI assessments (assessments collection)
    - Custom MCQ assessments (custom_mcq_assessments, if present)
    - Unified tests collection (tests) for DSA/AIML that use candidates array.
    """
    from bson import ObjectId
    
    email_lower = email.strip().lower()
    if not email_lower:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required")

    results: list[dict[str, Any]] = []

    async def _collect_from_candidates_collection(collection_name: str, test_type: str, org_id: Optional[str] = None) -> None:
        # Build query with email filter
        query = {"candidates.email": email_lower}
        
        # SECURITY: Add organization filter if provided
        if org_id:
            try:
                query["organization"] = ObjectId(org_id)
            except Exception:
                # Invalid ObjectId format, skip organization filter but log warning
                logger.warning(f"Invalid organizationId format: {org_id}")
        
        cursor = db[collection_name].find(query).limit(200)
        docs = await cursor.to_list(length=200)
        
        for doc in docs:
            candidates = doc.get("candidates", []) or []
            invited = next(
                (c for c in candidates if (c.get("email", "").strip().lower() == email_lower)),
                None,
            )
            
            # SECURITY: Skip if employee is not in candidates list
            if not invited:
                continue
            
            # SECURITY: Double-check organization match if provided
            if org_id:
                doc_org = doc.get("organization")
                if doc_org:
                    doc_org_str = str(doc_org) if isinstance(doc_org, ObjectId) else str(doc_org)
                    if doc_org_str != org_id:
                        continue  # Skip if organization doesn't match
            
            invite_sent_at = invited.get("inviteSentAt") if invited else None
            status_val = doc.get("status")
            if not status_val:
                if doc.get("is_published"):
                    status_val = "active"
                else:
                    status_val = "draft"

            results.append(
                {
                    "assessmentId": str(doc.get("_id")),
                    "title": doc.get("title") or doc.get("name") or "Untitled",
                    "type": test_type,
                    "status": status_val,
                    "inviteSentAt": invite_sent_at,
                    "organizationId": str(doc.get("organization", "")) if doc.get("organization") else None,
                }
            )

    # 1) AI Assessments
    await _collect_from_candidates_collection("assessments", "assessment", organizationId)

    # 2) Custom MCQ assessments (if present)
    if hasattr(db, "custom_mcq_assessments"):
        try:
            await _collect_from_candidates_collection("custom_mcq_assessments", "custom_mcq", organizationId)
        except Exception:
            # Collection may not exist in some deployments; ignore
            pass

    # 3) Unified tests collection (DSA / AIML) that use candidates array
    try:
        from bson import ObjectId
        
        query = {"candidates.email": email_lower}
        if organizationId:
            try:
                query["organization"] = ObjectId(organizationId)
            except Exception:
                logger.warning(f"Invalid organizationId format for tests collection: {organizationId}")
        
        cursor = db.tests.find(query).limit(200)
        tests = await cursor.to_list(length=200)
        
        for test in tests:
            candidates = test.get("candidates", []) or []
            invited = next(
                (c for c in candidates if (c.get("email", "").strip().lower() == email_lower)),
                None,
            )
            
            # SECURITY: Skip if employee is not in candidates list
            if not invited:
                continue
            
            # SECURITY: Double-check organization match if provided
            if organizationId:
                test_org = test.get("organization")
                if test_org:
                    test_org_str = str(test_org) if isinstance(test_org, ObjectId) else str(test_org)
                    if test_org_str != organizationId:
                        continue  # Skip if organization doesn't match
            
            invite_sent_at = invited.get("inviteSentAt") if invited else None
            test_type = test.get("test_type") or "dsa"
            status_val = test.get("status") or ("active" if test.get("is_published") else "draft")

            results.append(
                {
                    "assessmentId": str(test.get("_id")),
                    "title": test.get("title") or test.get("name") or "Untitled",
                    "type": test_type,
                    "status": status_val,
                    "inviteSentAt": invite_sent_at,
                    "organizationId": str(test.get("organization", "")) if test.get("organization") else None,
                }
            )
    except Exception as e:
        # If tests collection not present or query fails, log and continue
        logger.warning(f"Error querying tests collection: {str(e)}")
        pass

    return success_response(
        "Employee tests fetched successfully",
        {"tests": results},
    )


class VerifyCandidateRequest(BaseModel):
    """Request to verify candidate access."""
    assessmentId: str
    token: str
    email: str
    name: str


class MarkPrecheckCompleteRequest(BaseModel):
    """Request to mark precheck as complete."""
    assessmentId: str
    token: str
    email: str
    name: str
    precheckResults: Optional[Dict[str, Any]] = None


class SubmitAnswersRequest(BaseModel):
    """Request to submit final answers."""
    assessmentId: str
    token: str
    email: str
    name: str
    answers: list[Dict[str, Any]] = Field(default_factory=list)
    skippedQuestions: list[int] = Field(default_factory=list)
    attemptId: Optional[str] = None
    timerRemaining: Optional[int] = None
    submissionMetadata: Optional[Dict[str, Any]] = None


@router.post("/verify-candidate")
async def verify_candidate(
    request: VerifyCandidateRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Verify candidate access to an assessment.
    
    Checks if the candidate is allowed to access the assessment based on:
    - Assessment access mode (public/private)
    - Candidate list (for private mode)
    - Token validation
    """
    try:
        assessment_id = to_object_id(request.assessmentId)
        assessment = await db.assessments.find_one({"_id": assessment_id})
        
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        # Check access mode early to handle public links correctly
        access_mode = assessment.get("accessMode", "private")
        
        # Check if candidate has already submitted or is currently taking the assessment
        # This prevents retaking and concurrent sessions (BEFORE checking time validation)
        candidate_key = f"{request.email.lower()}_{request.name.strip().lower()}"
        candidate_responses = assessment.get("candidateResponses", {})
        existing_response = candidate_responses.get(candidate_key)
        
        if existing_response:
            response_status = existing_response.get("status")
            completed_at = existing_response.get("completedAt")
            submitted_at = existing_response.get("answers", {}).get("submittedAt")
            started_at = existing_response.get("startedAt")
            
            # Check if they've completed the assessment
            has_completed = (
                response_status == "completed" or
                completed_at is not None or
                submitted_at is not None
            )
            
            # Check if they're currently taking it (started but not submitted)
            is_in_progress = (
                started_at is not None and
                not has_completed
            )
            
            if has_completed:
                logger.warning(f"Blocking access for {candidate_key} - already submitted (status: {response_status}, completedAt: {completed_at}, submittedAt: {submitted_at})")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You have already submitted this assessment. You cannot take the test again."
                )
            elif is_in_progress:
                logger.warning(f"Blocking access for {candidate_key} - currently taking assessment (startedAt: {started_at}, completedAt: {completed_at})")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You are already taking this assessment in another tab or browser. Please complete it there first."
                )
        
        # Check if assessment is paused
        assessment_status = assessment.get("status")
        if assessment_status == "paused":
            # For public mode, allow access even if paused (anyone with link can access)
            if access_mode == "public":
                # Public mode: allow access regardless of pause status
                pass
            else:
                # For private mode, check if candidate has already started (has startedAt)
                candidates = assessment.get("candidates", [])
                candidate_entry = None
                for candidate in candidates:
                    if (candidate.get("email", "").lower() == request.email.lower() and
                        candidate.get("name", "").strip().lower() == request.name.strip().lower()):
                        candidate_entry = candidate
                        break
                
                # If candidate has started before pause, allow them to continue
                if candidate_entry and candidate_entry.get("startedAt"):
                    # Allow continuation
                    pass
                else:
                    # New entry attempt - block with user-friendly message
                    raise HTTPException(
                        status_code=status.HTTP_423_LOCKED,
                        detail="This assessment is currently paused. Please try again later."
                    )
        
        # Check assessment start time validation (no access time window)
        from datetime import datetime
        schedule = assessment.get("schedule") or {}
        # Check examMode in both assessment root and schedule - be explicit
        exam_mode = assessment.get("examMode")
        if exam_mode is None and isinstance(schedule, dict):
            exam_mode = schedule.get("examMode")
        if exam_mode is None:
            exam_mode = "strict"  # Default to strict if not set
        # Ensure it's a string (handle case where it might be stored differently)
        exam_mode = str(exam_mode).lower() if exam_mode else "strict"
        
        start_time_str = schedule.get("startTime") if isinstance(schedule, dict) else None
        # Also check assessment root for startTime (some assessments might store it there)
        if not start_time_str:
            start_time_str = assessment.get("startTime")
        
        end_time_str = schedule.get("endTime") if isinstance(schedule, dict) else None
        if not end_time_str:
            end_time_str = assessment.get("endTime")
        
        # Use IST (Indian Standard Time) for AI assessments
        IST = ZoneInfo("Asia/Kolkata")
        now = datetime.now(IST).replace(tzinfo=None)  # Make naive for comparison
        
        # Log initial state for debugging
        logger.info(f"[Verify Candidate] ========== ACCESS VALIDATION START ==========")
        logger.info(f"[Verify Candidate] Assessment ID: {assessment_id}")
        logger.info(f"[Verify Candidate] Exam Mode: {exam_mode}")
        logger.info(f"[Verify Candidate] Start Time String: {start_time_str}")
        logger.info(f"[Verify Candidate] End Time String: {end_time_str}")
        logger.info(f"[Verify Candidate] Current Time (IST): {now}")
        logger.info(f"[Verify Candidate] ===============================================")
        
        # Validate access time based on exam mode
        if exam_mode == "strict":
            logger.info(f"[Verify Candidate] STRICT MODE - Validating start time and end time...")
            if not start_time_str:
                logger.warning(f"[Verify Candidate] Strict mode but no startTime found. Assessment: {assessment_id}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assessment schedule is not properly configured. Please contact the administrator."
                )
            else:
                try:
                    # Parse start time - handle various formats
                    # Times are stored in UTC, convert to IST for comparison
                    start_time_str_clean = start_time_str.replace('Z', '+00:00') if 'Z' in start_time_str else start_time_str
                    if '+' not in start_time_str_clean and '-' not in start_time_str_clean[10:]:
                        # No timezone info, assume UTC
                        start_time_str_clean = start_time_str_clean + '+00:00'
                    
                    # Parse as UTC time
                    start_time_utc = datetime.fromisoformat(start_time_str_clean)
                    if start_time_utc.tzinfo is None:
                        start_time_utc = start_time_utc.replace(tzinfo=timezone.utc)
                    
                    # Convert UTC to IST for comparison
                    IST = ZoneInfo("Asia/Kolkata")
                    start_time = start_time_utc.astimezone(IST).replace(tzinfo=None)
                    
                    # Get duration to calculate end time
                    duration_minutes = schedule.get("duration") if isinstance(schedule, dict) else None
                    if not duration_minutes:
                        duration_minutes = assessment.get("duration")
                    
                    # Calculate end time: start_time + duration
                    end_time = None
                    if duration_minutes:
                        try:
                            duration_int = int(duration_minutes)
                            if duration_int > 0:
                                end_time = start_time + timedelta(minutes=duration_int)
                                logger.info(f"[Verify Candidate] Calculated end time: {end_time} (start: {start_time}, duration: {duration_int} minutes)")
                        except (ValueError, TypeError) as e:
                            logger.warning(f"[Verify Candidate] Failed to parse duration: {duration_minutes}, error: {e}")
                    
                    # If end_time_str is provided, use it (takes precedence over calculated)
                    if end_time_str:
                        try:
                            end_time_str_clean = end_time_str.replace('Z', '+00:00') if 'Z' in end_time_str else end_time_str
                            if '+' not in end_time_str_clean and '-' not in end_time_str_clean[10:]:
                                end_time_str_clean = end_time_str_clean + '+00:00'
                            
                            end_time_utc = datetime.fromisoformat(end_time_str_clean)
                            if end_time_utc.tzinfo is None:
                                end_time_utc = end_time_utc.replace(tzinfo=timezone.utc)
                            
                            end_time = end_time_utc.astimezone(IST).replace(tzinfo=None)
                            logger.info(f"[Verify Candidate] Using provided end time: {end_time}")
                        except (ValueError, AttributeError, TypeError) as e:
                            logger.warning(f"[Verify Candidate] Failed to parse end_time_str: {end_time_str}, error: {e}")
                    
                    logger.info(f"[Verify Candidate] Time check - Now (IST): {now}, Start Time (IST): {start_time}, End Time (IST): {end_time}")
                    
                    # Block access if current time is before start time
                    if now < start_time:
                        start_time_formatted = start_time.strftime('%Y-%m-%d %H:%M:%S IST')
                        error_message = f"The assessment has not started yet. The assessment will begin at {start_time_formatted}."
                        logger.warning(f"[Verify Candidate] Access DENIED - before start time. Now: {now}, Start: {start_time_formatted}")
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=error_message
                        )
                    # Block access if current time is after end time
                    elif end_time and now > end_time:
                        end_time_formatted = end_time.strftime('%Y-%m-%d %H:%M:%S IST')
                        error_message = f"The assessment has ended. The assessment was available until {end_time_formatted}. You cannot take this assessment."
                        logger.warning(f"[Verify Candidate] Access DENIED - after end time. Now: {now}, End: {end_time_formatted}")
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=error_message
                        )
                    else:
                        logger.info(f"[Verify Candidate] Access ALLOWED - within time window. Now: {now}, Start: {start_time}, End: {end_time}")
                except HTTPException as http_exc:
                    # Re-raise HTTP exceptions (access denied) - this is critical
                    raise http_exc
                except (ValueError, AttributeError, TypeError) as e:
                    logger.error(f"[Verify Candidate] CRITICAL: Failed to parse start time for access validation: {e}, start_time_str: {start_time_str}, assessment_id: {assessment_id}")
                    # For strict mode, if we can't parse the time, BLOCK access (be strict)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Assessment schedule configuration error. Please contact the administrator. (Error: {str(e)})"
                    )
        elif exam_mode == "flexible":
            # For flexible mode, check if we're within the window (startTime to endTime)
            end_time_str = schedule.get("endTime") if isinstance(schedule, dict) else None
            # Also check assessment root for endTime
            if not end_time_str:
                end_time_str = assessment.get("endTime")
            
            if start_time_str and end_time_str:
                try:
                    # Parse start and end times - convert from UTC to IST
                    IST = ZoneInfo("Asia/Kolkata")
                    
                    start_time_str_clean = start_time_str.replace('Z', '+00:00') if 'Z' in start_time_str else start_time_str
                    end_time_str_clean = end_time_str.replace('Z', '+00:00') if 'Z' in end_time_str else end_time_str
                    
                    if '+' not in start_time_str_clean and '-' not in start_time_str_clean[10:]:
                        start_time_str_clean = start_time_str_clean + '+00:00'
                    if '+' not in end_time_str_clean and '-' not in end_time_str_clean[10:]:
                        end_time_str_clean = end_time_str_clean + '+00:00'
                    
                    # Parse as UTC times
                    start_time_utc = datetime.fromisoformat(start_time_str_clean)
                    end_time_utc = datetime.fromisoformat(end_time_str_clean)
                    if start_time_utc.tzinfo is None:
                        start_time_utc = start_time_utc.replace(tzinfo=timezone.utc)
                    if end_time_utc.tzinfo is None:
                        end_time_utc = end_time_utc.replace(tzinfo=timezone.utc)
                    
                    # Convert to IST for comparison
                    start_time = start_time_utc.astimezone(IST).replace(tzinfo=None)
                    end_time = end_time_utc.astimezone(IST).replace(tzinfo=None)
                    
                    logger.info(f"[Verify Candidate] FLEXIBLE MODE - Time check - Now (IST): {now}, Start (IST): {start_time}, End (IST): {end_time}")
                    
                    if now < start_time:
                        # Before window opens
                        start_time_formatted = start_time.strftime('%Y-%m-%d %H:%M:%S IST')
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"The assessment window has not opened yet. The assessment will be available from {start_time_formatted}."
                        )
                    elif now > end_time:
                        # After window closes
                        end_time_formatted = end_time.strftime('%Y-%m-%d %H:%M:%S IST')
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"The assessment window has closed. The assessment was available until {end_time_formatted}."
                        )
                    else:
                        logger.info(f"[Verify Candidate] Access ALLOWED - within flexible window")
                except HTTPException as http_exc:
                    raise http_exc
                except (ValueError, AttributeError, TypeError) as e:
                    logger.error(f"[Verify Candidate] Failed to parse times for flexible mode: {e}")
                    # Allow access if parsing fails (graceful degradation)
        
        # IMPORTANT: If we reach here, access time validation has passed (or was not required)
        # Access mode was already checked earlier, but verify again for public mode
        # For public mode, anyone with the link can access
        if access_mode == "public":
            return success_response({
                "verified": True,
                "accessMode": "public",
                "message": "Access granted"
            })
        
        # For private mode, check candidate list
        candidates = assessment.get("candidates", [])
        candidate_found = False
        
        for candidate in candidates:
            if (candidate.get("email", "").lower() == request.email.lower() and
                candidate.get("name", "").strip().lower() == request.name.strip().lower()):
                candidate_found = True
                break
        
        if not candidate_found:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to access this assessment"
            )
        
        return success_response({
            "verified": True,
            "accessMode": "private",
            "message": "Access granted"
        })
        
    except HTTPException as http_exc:
        # Re-raise HTTPExceptions as-is (they have proper status codes)
        raise http_exc
    except Exception as e:
        logger.exception(f"Error verifying candidate: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify candidate: {str(e)}"
        )


@router.post("/mark-precheck-complete")
async def mark_precheck_complete(
    request: MarkPrecheckCompleteRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Mark precheck as complete for a candidate.
    """
    try:
        assessment_id = to_object_id(request.assessmentId)
        assessment = await db.assessments.find_one({"_id": assessment_id})
        
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        # Store precheck completion in candidate responses
        candidate_key = f"{request.email.lower()}_{request.name.strip().lower()}"
        
        if "candidateResponses" not in assessment:
            assessment["candidateResponses"] = {}
        
        if candidate_key not in assessment["candidateResponses"]:
            assessment["candidateResponses"][candidate_key] = {}
        
        assessment["candidateResponses"][candidate_key]["precheckCompleted"] = True
        assessment["candidateResponses"][candidate_key]["precheckCompletedAt"] = datetime.now(timezone.utc)
        if request.precheckResults:
            assessment["candidateResponses"][candidate_key]["precheckResults"] = request.precheckResults
        
        await db.assessments.update_one(
            {"_id": assessment_id},
            {"$set": {"candidateResponses": assessment["candidateResponses"]}}
        )
        
        return success_response({
            "message": "Precheck marked as complete"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error marking precheck complete: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark precheck complete: {str(e)}"
        )


@router.get("/get-assessment-full")
async def get_assessment_full(
    assessmentId: str = Query(..., description="Assessment ID"),
    token: str = Query(..., description="Access token"),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get full assessment details including topics_v2, timer settings, and proctoring config.
    Checks all assessment collections (assessments, custom_mcq_assessments, dsa_tests, aiml_tests).
    """
    try:
        assessment_id = to_object_id(assessmentId)
        assessment = None
        collection_name = None
        
        # 1. AI Assessments (assessments collection)
        assessment = await db.assessments.find_one({"_id": assessment_id})
        if assessment:
            collection_name = "assessments"
        
        # 2. Custom MCQ assessments
        if not assessment:
            assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_id})
            if assessment:
                collection_name = "custom_mcq_assessments"
        
        # 3. DSA tests (in same database, tests collection)
        if not assessment:
            assessment = await db.tests.find_one({"_id": assessment_id, "test_type": {"$in": ["dsa", None]}})
            if assessment:
                collection_name = "tests (dsa)"
        
        # 4. AIML tests
        if not assessment:
            assessment = await db.tests.find_one({"_id": assessment_id, "test_type": "aiml"})
            if assessment:
                collection_name = "tests (aiml)"

        if not assessment:
            logger.warning(f"Assessment not found in any collection: {assessmentId}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        logger.info(f"Found assessment {assessmentId} in collection: {collection_name}")
        
        # Serialize and return assessment
        try:
            assessment_serialized = serialize_document(assessment)
        except Exception as serialize_error:
            logger.error(f"Error serializing assessment {assessmentId}: {serialize_error}")
            logger.error(f"Assessment keys: {list(assessment.keys()) if assessment else 'None'}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to serialize assessment: {str(serialize_error)}"
            )
        
        # Return the assessment directly in data (not nested in assessment key)
        return success_response("Assessment fetched successfully", assessment_serialized)
        
    except HTTPException:
        raise
    except ValueError as ve:
        # Invalid ObjectId format
        logger.error(f"Invalid assessment ID format: {assessmentId}, error: {ve}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid assessment ID format: {str(ve)}"
        )
    except Exception as e:
        logger.exception(f"Error getting assessment full: {e}")
        logger.error(f"Assessment ID: {assessmentId}, Error type: {type(e).__name__}, Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get assessment: {str(e)}"
        )


@router.get("/get-assessment-questions")
async def get_assessment_questions(
    assessmentId: str = Query(..., description="Assessment ID"),
    token: str = Query(..., description="Access token"),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get all questions for an assessment.
    """
    try:
        assessment_id = to_object_id(assessmentId)
        assessment = await db.assessments.find_one({"_id": assessment_id})
        
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        # Extract questions from topics_v2
        questions = []
        topics_v2 = assessment.get("topics_v2", [])
        
        for topic in topics_v2:
            question_rows = topic.get("questionRows", [])
            for row in question_rows:
                row_questions = row.get("questions", [])
                for q in row_questions:
                    question_obj = {
                        **q,
                        "topicId": topic.get("id"),
                        "topicLabel": topic.get("label"),
                        "rowId": row.get("rowId"),
                        "questionType": row.get("questionType"),
                        "difficulty": row.get("difficulty"),
                    }
                    questions.append(question_obj)
        
        # Fallback to old topics structure if topics_v2 is empty
        if not questions:
            old_topics = assessment.get("topics", [])
            for topic in old_topics:
                topic_questions = topic.get("questions", [])
                for q in topic_questions:
                    questions.append(q)
        
        return success_response({
            "questions": questions,
            "totalQuestions": len(questions)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting assessment questions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get questions: {str(e)}"
        )


@router.get("/get-assessment-schedule")
async def get_assessment_schedule(
    assessmentId: str = Query(..., description="Assessment ID"),
    token: str = Query(..., description="Access token"),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get assessment schedule and candidate requirements.
    """
    try:
        assessment_id = to_object_id(assessmentId)
        assessment = await db.assessments.find_one({"_id": assessment_id})
        
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        schedule = assessment.get("schedule", {})
        candidate_requirements = schedule.get("candidateRequirements", {})
        
        return success_response({
            "schedule": schedule,
            "candidateRequirements": candidate_requirements
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting assessment schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schedule: {str(e)}"
        )


@router.post("/submit-answers")
async def submit_answers(
    request: SubmitAnswersRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Submit final answers for an assessment.
    """
    logger.info("=" * 80)
    logger.info("SUBMIT_ANSWERS: Starting submission process")
    logger.info(f"Assessment ID: {request.assessmentId}")
    logger.info(f"Candidate Email: {request.email}")
    logger.info(f"Candidate Name: {request.name}")
    logger.info(f"Total Answers: {len(request.answers)}")
    logger.info(f"Attempt ID: {getattr(request, 'attemptId', 'N/A')}")
    
    try:
        assessment_id = to_object_id(request.assessmentId)
        assessment = await db.assessments.find_one({"_id": assessment_id})
        
        if not assessment:
            logger.error(f"Assessment not found: {request.assessmentId}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        logger.info(f"Assessment found: {assessment.get('title', 'N/A')}")
        
        # Store candidate responses
        candidate_key = f"{request.email.lower()}_{request.name.strip().lower()}"
        logger.info(f"Candidate Key: '{candidate_key}'")
        
        if "candidateResponses" not in assessment:
            assessment["candidateResponses"] = {}
        
        if candidate_key not in assessment["candidateResponses"]:
            assessment["candidateResponses"][candidate_key] = {
                "logs": [],
                "answers": {},
                "email": request.email,
                "name": request.name,
            }
        else:
            # Update email and name if not already set
            if "email" not in assessment["candidateResponses"][candidate_key]:
                assessment["candidateResponses"][candidate_key]["email"] = request.email
            if "name" not in assessment["candidateResponses"][candidate_key]:
                assessment["candidateResponses"][candidate_key]["name"] = request.name
        
        # Store answers
        assessment["candidateResponses"][candidate_key]["answers"] = {
            "submitted": request.answers,
            "skipped": request.skippedQuestions,
            "submittedAt": datetime.now(timezone.utc).isoformat(),
            "timerRemaining": request.timerRemaining,
            "metadata": request.submissionMetadata or {},
        }
        
        # Mark as completed
        assessment["candidateResponses"][candidate_key]["status"] = "completed"
        assessment["candidateResponses"][candidate_key]["completedAt"] = datetime.now(timezone.utc)
        
        # Log submission event
        if "logs" not in assessment["candidateResponses"][candidate_key]:
            assessment["candidateResponses"][candidate_key]["logs"] = []
        
        assessment["candidateResponses"][candidate_key]["logs"].append({
            "eventType": "ASSESSMENT_SUBMITTED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "attemptId": request.attemptId,
                "answersCount": len(request.answers),
                "skippedCount": len(request.skippedQuestions),
                "timerRemaining": request.timerRemaining,
            }
        })
        
        # Save initial submission
        await db.assessments.update_one(
            {"_id": assessment_id},
            {"$set": {"candidateResponses": assessment["candidateResponses"]}}
        )
        
        # Trigger AI evaluation in background (non-blocking)
        logger.info("=" * 80)
        logger.info("AI EVALUATION: Starting evaluation process")
        evaluations = {}  # Initialize outside try block for return statement
        evaluation_errors = []  # Initialize outside try block
        section_summaries = []  # Initialize outside try block
        
        try:
            logger.info("Importing evaluation functions...")
            # Import evaluation functions
            from ..assessments.services.unified_ai_evaluation import (
                evaluate_question_by_type,
                aggregate_section_evaluation,
                generate_overall_assessment_summary
            )
            logger.info("Evaluation functions imported successfully")
            
            # Get all questions from assessment and build ordered list
            questions_map = {}
            questions_ordered = []  # Flat ordered list for index mapping
            topics_v2 = assessment.get("topics_v2", [])
            
            def extract_question_id(q: Dict[str, Any], topic_id: str, row_id: str, q_index: int) -> str:
                """Extract or generate question ID from question object."""
                # Try _id first (could be ObjectId or string)
                q_id = q.get("_id")
                if q_id:
                    # Handle ObjectId from bson
                    if hasattr(q_id, '__str__'):
                        q_id = str(q_id)
                    else:
                        q_id = str(q_id)
                    # Skip if it's "None" string
                    if q_id and q_id.lower() != "none":
                        return q_id
                
                # Try id field
                q_id = q.get("id")
                if q_id:
                    q_id = str(q_id)
                    if q_id and q_id.lower() != "none":
                        return q_id
                
                # Generate stable ID based on position
                # Format: topicId-rowId-questionIndex
                return f"{topic_id}-{row_id}-{q_index}"
            
            question_index_global = 0
            for topic in topics_v2:
                topic_id = str(topic.get("id", ""))
                question_rows = topic.get("questionRows", [])
                for row in question_rows:
                    row_id = str(row.get("rowId", ""))
                    row_questions = row.get("questions", [])
                    for q_idx, q in enumerate(row_questions):
                        q_id = extract_question_id(q, topic_id, row_id, q_idx)
                        question_obj = {
                            **q,
                            "topicId": topic_id,
                            "topicLabel": topic.get("label"),
                            "rowId": row_id,
                            "questionType": row.get("questionType"),
                            "difficulty": row.get("difficulty"),
                            # Preserve marks if they exist in the question or row
                            "marks": q.get("marks") or row.get("marks") or q.get("maxMarks") or row.get("maxMarks"),
                        }
                        questions_map[q_id] = question_obj
                        questions_ordered.append((q_id, question_obj, question_index_global))
                        question_index_global += 1
            
            # Fallback to old topics structure
            if not questions_map:
                old_topics = assessment.get("topics", [])
                for topic_idx, topic in enumerate(old_topics):
                    topic_questions = topic.get("questions", [])
                    for q_idx, q in enumerate(topic_questions):
                        q_id = extract_question_id(q, str(topic_idx), "row0", q_idx)
                        questions_map[q_id] = q
                        questions_ordered.append((q_id, q, question_index_global))
                        question_index_global += 1
            
            logger.info("=" * 80)
            logger.info(f"QUESTIONS MAP: Built questions map")
            logger.info(f"  Total questions in map: {len(questions_map)}")
            logger.info(f"  Total questions ordered: {len(questions_ordered)}")
            if len(questions_map) == 0:
                logger.error("=" * 80)
                logger.error("ERROR: No questions found in assessment! Cannot perform evaluation.")
                logger.error(f"  Topics_v2 structure: {topics_v2}")
                raise ValueError("No questions found in assessment structure")
            
            # Log sample question IDs for debugging
            sample_qids = [qid for qid, _, _ in questions_ordered[:5]]
            logger.info(f"  Sample question IDs (first 5): {sample_qids}")
            logger.info(f"  Full question order (first 10):")
            for idx, (qid, q_obj, global_idx) in enumerate(questions_ordered[:10]):
                logger.info(f"    [{global_idx}] ID={qid}, Type={q_obj.get('questionType', 'N/A')}, Section={q_obj.get('topicLabel', 'N/A')}")
            
            # Also try to extract question IDs from answersSnapshot if available
            candidate_response_data = assessment["candidateResponses"].get(candidate_key, {})
            answers_snapshot = candidate_response_data.get("answers", {}).get("metadata", {}).get("answersSnapshot", {})
            
            logger.info("=" * 80)
            logger.info(f"PROCESSING ANSWERS: Starting to process {len(request.answers)} submitted answers")
            logger.info(f"  Answer structure sample (first answer):")
            if request.answers:
                first_answer = request.answers[0]
                logger.info(f"    Keys: {list(first_answer.keys())}")
                logger.info(f"    questionIndex: {first_answer.get('questionIndex')}")
                logger.info(f"    questionId: {first_answer.get('questionId', 'NOT PROVIDED')}")
                logger.info(f"    answer length: {len(str(first_answer.get('answer', '')))}")
            
            # Evaluate each submitted answer (evaluations and evaluation_errors already initialized)
            
            for answer_idx, answer_data in enumerate(request.answers):
                logger.info("-" * 80)
                logger.info(f"PROCESSING ANSWER {answer_idx + 1}/{len(request.answers)}")
                logger.info(f"  Answer data keys: {list(answer_data.keys())}")
                logger.info(f"  questionIndex: {answer_data.get('questionIndex')}")
                logger.info(f"  questionId: {answer_data.get('questionId', 'NOT PROVIDED')}")
                # Try to get questionId from answer_data first
                question_id = str(answer_data.get("questionId", "")) if answer_data.get("questionId") else ""
                
                # If not found, try to map from questionIndex
                if not question_id or question_id.lower() == "none":
                    question_index = answer_data.get("questionIndex")
                    if question_index is not None and isinstance(question_index, int):
                        # Find question by matching global index
                        for q_id, q_obj, global_idx in questions_ordered:
                            if global_idx == question_index:
                                question_id = q_id
                                logger.info(f"Mapped questionIndex {question_index} to questionId {question_id}")
                                break
                    
                    # If still not found, try to find from answersSnapshot keys by matching answer text
                    if not question_id or question_id.lower() == "none":
                        answer_text = answer_data.get("answer", "") or answer_data.get("textAnswer", "")
                        if answer_text and answers_snapshot:
                            # Find the key that matches this answer
                            for snapshot_key, snapshot_answer in answers_snapshot.items():
                                if snapshot_answer and answer_text:
                                    # Compare answer content
                                    if isinstance(snapshot_answer, str) and isinstance(answer_text, str):
                                        if snapshot_answer.strip() == answer_text.strip():
                                            # Try to extract question ID from the snapshot key
                                            # The key format appears to be: topicId-rowId-questionIndex-counter
                                            parts = snapshot_key.split("-")
                                            if len(parts) >= 3:
                                                topic_id_part = parts[0]
                                                row_id_part = parts[1]
                                                q_idx_part = parts[2]
                                                # Find question matching this topic, row, and index
                                                for q_id, q_obj, global_idx in questions_ordered:
                                                    if (str(q_obj.get("topicId", "")) == topic_id_part and 
                                                        str(q_obj.get("rowId", "")) == row_id_part):
                                                        question_id = q_id
                                                        logger.info(f"Matched question from snapshot key {snapshot_key}: {question_id}")
                                                        break
                                                if question_id:
                                                    break
                                    elif isinstance(snapshot_answer, dict) and isinstance(answer_text, dict):
                                        # For complex answers, try to match by structure
                                        if snapshot_answer == answer_text:
                                            # Extract from key
                                            parts = snapshot_key.split("-")
                                            if len(parts) >= 3:
                                                topic_id_part = parts[0]
                                                row_id_part = parts[1]
                                                for q_id, q_obj, global_idx in questions_ordered:
                                                    if (str(q_obj.get("topicId", "")) == topic_id_part and 
                                                        str(q_obj.get("rowId", "")) == row_id_part):
                                                        question_id = q_id
                                                        logger.info(f"Matched question from snapshot key (dict): {question_id}")
                                                        break
                                                if question_id:
                                                    break
                
                if not question_id or question_id.lower() == "none" or question_id not in questions_map:
                    logger.error("=" * 80)
                    logger.error(f"QUESTION NOT FOUND - Answer {answer_idx + 1}")
                    logger.error(f"  questionId: {question_id}")
                    logger.error(f"  questionIndex: {answer_data.get('questionIndex')}")
                    logger.error(f"  totalQuestions in map: {len(questions_map)}")
                    logger.error(f"  totalQuestions ordered: {len(questions_ordered)}")
                    logger.error(f"  answerKeys: {list(answer_data.keys())}")
                    logger.error(f"  answerLength: {len(str(answer_data.get('answer', '')))}")
                    logger.error(f"  Available question IDs (first 10): {[qid for qid, _, _ in questions_ordered[:10]]}")
                    logger.error(f"  Question ID in map? {question_id in questions_map if question_id else 'N/A'}")
                    evaluation_errors.append({
                        "answer_index": answer_idx,
                        "question_id": question_id,
                        "question_index": answer_data.get('questionIndex'),
                        "error": "Question not found in questions_map"
                    })
                    continue
                
                question = questions_map[question_id]
                question_type = question.get("questionType") or question.get("question_type", "").upper()
                
                logger.info("=" * 80)
                logger.info(f"[MARKS_EXTRACTION] Extracting max_marks for question {question_id}")
                logger.info(f"[MARKS_EXTRACTION] Question type: {question_type}")
                logger.info(f"[MARKS_EXTRACTION] Question keys: {list(question.keys())}")
                logger.info(f"[MARKS_EXTRACTION] question.get('marks'): {question.get('marks')}")
                logger.info(f"[MARKS_EXTRACTION] question.get('maxMarks'): {question.get('maxMarks')}")
                
                # Extract max_marks from multiple possible locations
                # Priority: question.marks > question.maxMarks > scoringRules[questionType] > row.marks > default 1
                max_marks = 1.0
                marks_source = "default"
                
                if question.get("marks"):
                    max_marks = float(question.get("marks"))
                    marks_source = "question.marks"
                    logger.info(f"[MARKS_EXTRACTION] Found marks in question.marks: {max_marks}")
                elif question.get("maxMarks"):
                    max_marks = float(question.get("maxMarks"))
                    marks_source = "question.maxMarks"
                    logger.info(f"[MARKS_EXTRACTION] Found marks in question.maxMarks: {max_marks}")
                else:
                    # Try to get from scoringRules (stored at assessment level)
                    scoring_rules = assessment.get("scoringRules", {})
                    logger.info(f"[MARKS_EXTRACTION] Checking scoringRules: {scoring_rules}")
                    
                    if scoring_rules and isinstance(scoring_rules, dict):
                        # Normalize question type to match scoringRules keys
                        qtype_normalized = question_type
                        if question_type == "PSEUDOCODE" or question_type == "PSEUDO CODE":
                            qtype_normalized = "PseudoCode"
                        elif question_type not in ["MCQ", "Subjective", "Coding", "SQL", "AIML"]:
                            qtype_normalized = question_type.capitalize()
                        
                        logger.info(f"[MARKS_EXTRACTION] Normalized question type: {qtype_normalized}")
                        logger.info(f"[MARKS_EXTRACTION] scoringRules keys: {list(scoring_rules.keys())}")
                        
                        if qtype_normalized in scoring_rules:
                            max_marks = float(scoring_rules[qtype_normalized])
                            marks_source = f"scoringRules[{qtype_normalized}]"
                            logger.info(f"[MARKS_EXTRACTION] Found marks in scoringRules[{qtype_normalized}]: {max_marks}")
                        # Try alternate formats
                        elif question_type in scoring_rules:
                            max_marks = float(scoring_rules[question_type])
                            marks_source = f"scoringRules[{question_type}]"
                            logger.info(f"[MARKS_EXTRACTION] Found marks in scoringRules[{question_type}]: {max_marks}")
                        else:
                            logger.warning(f"[MARKS_EXTRACTION] No marks found in scoringRules for type: {question_type} or {qtype_normalized}")
                    else:
                        logger.warning(f"[MARKS_EXTRACTION] scoringRules is empty or not a dict: {type(scoring_rules)}")
                
                # Ensure max_marks is valid
                try:
                    max_marks = float(max_marks)
                    if max_marks <= 0:
                        logger.warning(f"[MARKS_EXTRACTION] max_marks was <= 0, resetting to 1.0")
                        max_marks = 1.0
                except (ValueError, TypeError) as e:
                    logger.error(f"[MARKS_EXTRACTION] Error converting max_marks to float: {e}, using default 1.0")
                    max_marks = 1.0
                
                logger.info(f"[MARKS_EXTRACTION] Final max_marks: {max_marks} (source: {marks_source})")
                logger.info("=" * 80)
                
                section = question.get("topicLabel") or question.get("section", "")
                
                logger.info(f"  ✓ Question found in map")
                logger.info(f"  Question ID: {question_id}")
                logger.info(f"  Question Type: {question_type}")
                logger.info(f"  Section: {section}")
                logger.info(f"  Max Marks: {max_marks}")
                logger.info(f"  Starting evaluation...")
                
                try:
                    # Prepare evaluation parameters based on question type
                    eval_kwargs = {}
                    
                    if question_type == "MCQ":
                        # For MCQ, check correctness first
                        selected_answers_raw = answer_data.get("selectedAnswers", [])
                        
                        # Get correct answer from multiple possible fields
                        correct_ans_raw = (
                            question.get("correctAn") or 
                            question.get("correctAnswer") or 
                            question.get("correct_answer") or 
                            ""
                        )
                        
                        logger.info(f"[MCQ_EVAL] Question ID: {question_id}")
                        logger.info(f"[MCQ_EVAL] Raw selected_answers: {selected_answers_raw}")
                        logger.info(f"[MCQ_EVAL] Raw correct_ans_raw: {correct_ans_raw}")
                        logger.info(f"[MCQ_EVAL] Available question fields: {list(question.keys())}")
                        
                        # Get options to help map between formats
                        options = question.get("options", [])
                        logger.info(f"[MCQ_EVAL] Options: {options}")
                        
                        # Normalize selected answers (handle array or single value)
                        if not isinstance(selected_answers_raw, list):
                            selected_answers_raw = [selected_answers_raw] if selected_answers_raw else []
                        
                        # Normalize selected answers to strings and trim
                        selected_answers = [str(ans).strip() for ans in selected_answers_raw if ans is not None and str(ans).strip()]
                        
                        # Parse correct answer(s) - can be comma-separated string or array
                        if isinstance(correct_ans_raw, list):
                            correct_answers_raw = correct_ans_raw
                        elif isinstance(correct_ans_raw, str):
                            correct_answers_raw = [a.strip() for a in correct_ans_raw.split(",") if a.strip()]
                        else:
                            correct_answers_raw = []
                        
                        # Build mapping between labels (A, B, C, D), indices (0, 1, 2, 3), and option text
                        label_to_text = {}
                        index_to_text = {}
                        index_to_label = {}
                        text_to_label = {}
                        
                        if options:
                            for idx, opt in enumerate(options):
                                if isinstance(opt, dict):
                                    # Custom MCQ format: {label: "A", text: "Option text"}
                                    label = str(opt.get("label", "")).strip().upper()
                                    text = str(opt.get("text", "")).strip()
                                    if label:
                                        label_to_text[label] = text.upper()
                                        text_to_label[text.upper()] = label
                                    if text:
                                        index_to_text[idx] = text.upper()
                                    if label:
                                        index_to_label[idx] = label
                                elif isinstance(opt, str):
                                    # AI-generated format: ["Option 1", "Option 2", ...]
                                    text = opt.strip()
                                    label = chr(65 + idx) if idx < 26 else str(idx + 1)  # A, B, C, D, ...
                                    label_to_text[label] = text.upper()
                                    text_to_label[text.upper()] = label
                                    index_to_text[idx] = text.upper()
                                    index_to_label[idx] = label
                        
                        logger.info(f"[MCQ_EVAL] label_to_text mapping: {label_to_text}")
                        logger.info(f"[MCQ_EVAL] text_to_label mapping: {text_to_label}")
                        
                        # Normalize selected answers - try multiple formats
                        selected_answers_normalized = []
                        for ans in selected_answers:
                            ans_upper = ans.upper()
                            # Check if it's already a label
                            if ans_upper in label_to_text:
                                selected_answers_normalized.append(ans_upper)
                            # Check if it's an index (convert to int and check)
                            elif ans.isdigit() and int(ans) in index_to_label:
                                selected_answers_normalized.append(index_to_label[int(ans)])
                            # Check if it's option text (try to find label)
                            elif ans_upper in text_to_label:
                                selected_answers_normalized.append(text_to_label[ans_upper])
                            # Otherwise, keep as-is (might match correct answer directly)
                            else:
                                selected_answers_normalized.append(ans_upper)
                        
                        # Normalize correct answers - try multiple formats
                        correct_answers_normalized = []
                        for ans in correct_answers_raw:
                            ans_str = str(ans).strip()
                            ans_upper = ans_str.upper()
                            # Check if it's already a label
                            if ans_upper in label_to_text:
                                correct_answers_normalized.append(ans_upper)
                            # Check if it's an index
                            elif ans_str.isdigit() and int(ans_str) in index_to_label:
                                correct_answers_normalized.append(index_to_label[int(ans_str)])
                            # Check if it's option text
                            elif ans_upper in text_to_label:
                                correct_answers_normalized.append(text_to_label[ans_upper])
                            # Otherwise, keep as-is (might be direct text match)
                            else:
                                correct_answers_normalized.append(ans_upper)
                        
                        logger.info(f"[MCQ_EVAL] Normalized selected_answers: {selected_answers_normalized}")
                        logger.info(f"[MCQ_EVAL] Normalized correct_answers: {correct_answers_normalized}")
                        
                        # Get answer type (single, multiple_all, multiple_any)
                        answer_type = question.get("answerType") or question.get("answer_type") or "single"
                        logger.info(f"[MCQ_EVAL] Answer type: {answer_type}")
                        
                        # Check if correct (handle single/multiple choice)
                        is_correct = False
                        if answer_type == "single":
                            # For single choice, must have exactly one answer that matches
                            if len(selected_answers_normalized) == 1 and len(correct_answers_normalized) > 0:
                                is_correct = selected_answers_normalized[0] in correct_answers_normalized
                                logger.info(f"[MCQ_EVAL] Single choice: selected={selected_answers_normalized[0]}, correct={correct_answers_normalized}, match={is_correct}")
                            else:
                                logger.warning(f"[MCQ_EVAL] Single choice: invalid selection count - selected={len(selected_answers_normalized)}, correct={len(correct_answers_normalized)}")
                        elif answer_type == "multiple_all":
                            # For multiple_all, must match all correct answers exactly
                            is_correct = (len(selected_answers_normalized) == len(correct_answers_normalized) and 
                                        set(selected_answers_normalized) == set(correct_answers_normalized))
                            logger.info(f"[MCQ_EVAL] Multiple all: selected_set={set(selected_answers_normalized)}, correct_set={set(correct_answers_normalized)}, match={is_correct}")
                        else:  # multiple_any
                            # For multiple_any, at least one answer must match
                            intersection = set(selected_answers_normalized).intersection(set(correct_answers_normalized))
                            is_correct = len(intersection) > 0
                            logger.info(f"[MCQ_EVAL] Multiple any: intersection={intersection}, match={is_correct}")
                        
                        score = max_marks if is_correct else 0.0
                        logger.info(f"[MCQ_EVAL] Final result: is_correct={is_correct}, score={score}/{max_marks}")
                        
                        eval_kwargs["is_correct"] = is_correct
                        eval_kwargs["score"] = score
                    
                    elif question_type == "CODING":
                        # For coding, get test results if available
                        test_results = answer_data.get("testResults")
                        if test_results:
                            eval_kwargs["test_results"] = test_results
                            eval_kwargs["passed_count"] = sum(1 for t in test_results if t.get("passed", False))
                            eval_kwargs["total_count"] = len(test_results)
                    
                    elif question_type == "SQL":
                        # For SQL, get test result if available
                        test_result = answer_data.get("testResult")
                        if test_result:
                            eval_kwargs["test_result"] = test_result
                    
                    elif question_type == "AIML":
                        # For AIML, get code outputs if available
                        code_outputs = answer_data.get("outputs") or answer_data.get("codeOutputs")
                        if code_outputs:
                            eval_kwargs["code_outputs"] = code_outputs
                    
                    # Prepare candidate answer format - extract based on question type
                    candidate_answer = {}
                    
                    if question_type == "MCQ":
                        candidate_answer["selectedAnswers"] = answer_data.get("selectedAnswers", [])
                        candidate_answer["textAnswer"] = answer_data.get("textAnswer") or answer_data.get("answer", "")
                    elif question_type in ["SUBJECTIVE", "PSEUDOCODE", "PSEUDO CODE"]:
                        candidate_answer["textAnswer"] = answer_data.get("textAnswer") or answer_data.get("answer", "")
                        candidate_answer["answer"] = answer_data.get("textAnswer") or answer_data.get("answer", "")
                    elif question_type == "CODING":
                        candidate_answer["source_code"] = answer_data.get("source_code") or answer_data.get("code") or answer_data.get("answer", "")
                        candidate_answer["code"] = candidate_answer["source_code"]
                        candidate_answer["answer"] = candidate_answer["source_code"]
                    elif question_type == "SQL":
                        candidate_answer["sql_query"] = answer_data.get("sql_query") or answer_data.get("query") or answer_data.get("answer", "")
                        candidate_answer["query"] = candidate_answer["sql_query"]
                        candidate_answer["answer"] = candidate_answer["sql_query"]
                    elif question_type == "AIML":
                        candidate_answer["source_code"] = answer_data.get("source_code") or answer_data.get("code") or answer_data.get("answer", "")
                        candidate_answer["code"] = candidate_answer["source_code"]
                        candidate_answer["answer"] = candidate_answer["source_code"]
                    else:
                        # Fallback for unknown types
                        candidate_answer["answer"] = answer_data.get("answer", "")
                    
                    # Also include common fields for compatibility
                    if "answer" not in candidate_answer:
                        candidate_answer["answer"] = answer_data.get("answer", "")
                    
                    # Evaluate the answer
                    evaluation = await evaluate_question_by_type(
                        question_id=question_id,
                        question_type=question_type,
                        question_data=question,
                        candidate_answer=candidate_answer,
                        max_marks=max_marks,
                        section=section,
                        **eval_kwargs
                    )
                    
                    evaluations[question_id] = evaluation
                    logger.info("=" * 80)
                    logger.info(f"[EVALUATION_RESULT] Evaluation completed successfully for question {question_id}")
                    logger.info(f"[EVALUATION_RESULT] Question type: {question_type}")
                    logger.info(f"[EVALUATION_RESULT] Evaluation keys: {list(evaluation.keys())}")
                    eval_score = evaluation.get('score', 0)
                    eval_max_marks = evaluation.get('max_marks', max_marks)
                    eval_percentage = evaluation.get('percentage', 0)
                    logger.info(f"[EVALUATION_RESULT] Score: {eval_score}")
                    logger.info(f"[EVALUATION_RESULT] Max marks (from eval): {eval_max_marks}")
                    logger.info(f"[EVALUATION_RESULT] Max marks (passed to eval): {max_marks}")
                    logger.info(f"[EVALUATION_RESULT] Percentage: {eval_percentage}%")
                    logger.info(f"[EVALUATION_RESULT] Score display: {eval_score}/{eval_max_marks}")
                    logger.info(f"[EVALUATION_RESULT] Has feedback: {bool(evaluation.get('feedback'))}")
                    logger.info(f"[EVALUATION_RESULT] Has criteria_scores: {bool(evaluation.get('criteria_scores'))}")
                    logger.info("=" * 80)
                    
                except Exception as eval_error:
                    logger.error("=" * 80)
                    logger.error(f"ERROR evaluating question {question_id}:")
                    logger.error(f"  Question Type: {question_type}")
                    logger.error(f"  Error Type: {type(eval_error).__name__}")
                    logger.error(f"  Error Message: {str(eval_error)}")
                    logger.exception("Full traceback:")
                    evaluation_errors.append({
                        "question_id": question_id,
                        "error": str(eval_error)
                    })
                    
                    # Create error evaluation instead of skipping
                    from ..assessments.services.unified_ai_evaluation import _create_error_evaluation
                    error_evaluation = _create_error_evaluation(
                        question_id=question_id,
                        question_type=question_type,
                        max_marks=max_marks,
                        section=section,
                        error_message=str(eval_error)
                    )
                    evaluations[question_id] = error_evaluation
                    logger.info(f"  ✓ Error evaluation created (score: 0/{max_marks})")
                    # Continue with other evaluations
            
            # Store evaluations
            logger.info("=" * 80)
            logger.info(f"STORING EVALUATIONS: Storing {len(evaluations)} evaluations")
            logger.info(f"  Evaluation errors: {len(evaluation_errors)}")
            logger.info(f"  Evaluations keys: {list(evaluations.keys())}")
            
            if "evaluations" not in assessment["candidateResponses"][candidate_key]:
                assessment["candidateResponses"][candidate_key]["evaluations"] = {}
            assessment["candidateResponses"][candidate_key]["evaluations"].update(evaluations)
            
            if evaluation_errors:
                logger.warning(f"  Storing {len(evaluation_errors)} evaluation errors")
                if "evaluationErrors" not in assessment["candidateResponses"][candidate_key]:
                    assessment["candidateResponses"][candidate_key]["evaluationErrors"] = []
                assessment["candidateResponses"][candidate_key]["evaluationErrors"].extend(evaluation_errors)
            
            # Generate section summaries
            section_evaluations = {}
            for question_id, evaluation in evaluations.items():
                section_name = evaluation.get("section", "General")
                if section_name not in section_evaluations:
                    section_evaluations[section_name] = []
                section_evaluations[section_name].append(evaluation)
            
            # Build section summaries (section_summaries already initialized outside)
            section_summaries.clear()  # Clear and rebuild
            for section_name, section_evals in section_evaluations.items():
                try:
                    section_summary = await aggregate_section_evaluation(section_name, section_evals)
                    section_summaries.append(section_summary)
                except Exception as e:
                    logger.exception(f"Error aggregating section {section_name}: {e}")
            
            # Generate overall summary
            try:
                overall_summary = await generate_overall_assessment_summary(
                    section_summaries=section_summaries,
                    question_evaluations=list(evaluations.values()),
                    job_role=assessment.get("jobRole")
                )
                assessment["candidateResponses"][candidate_key]["overallSummary"] = overall_summary
            except Exception as e:
                logger.exception(f"Error generating overall summary: {e}")
            
            # Store section summaries
            assessment["candidateResponses"][candidate_key]["sectionSummaries"] = section_summaries
            
            # Update database with evaluations
            await db.assessments.update_one(
                {"_id": assessment_id},
                {"$set": {"candidateResponses": assessment["candidateResponses"]}}
            )
            
            logger.info("=" * 80)
            logger.info(f"AI EVALUATION COMPLETED")
            logger.info(f"  Candidate: {candidate_key}")
            logger.info(f"  Total Evaluations: {len(evaluations)}")
            logger.info(f"  Section Summaries: {len(section_summaries)}")
            logger.info(f"  Evaluation Errors: {len(evaluation_errors)}")
            logger.info("=" * 80)
            
        except Exception as eval_error:
            # Log error but don't fail submission
            logger.error("=" * 80)
            logger.error("CRITICAL ERROR during AI evaluation (non-blocking):")
            logger.error(f"  Error Type: {type(eval_error).__name__}")
            logger.error(f"  Error Message: {str(eval_error)}")
            logger.exception("Full traceback:")
            logger.error("=" * 80)
            # Store error flag
            if "evaluationStatus" not in assessment["candidateResponses"][candidate_key]:
                assessment["candidateResponses"][candidate_key]["evaluationStatus"] = "error"
                assessment["candidateResponses"][candidate_key]["evaluationError"] = str(eval_error)
        
        logger.info("=" * 80)
        logger.info("SUBMIT_ANSWERS: Submission completed successfully")
        logger.info(f"  Evaluation Status: {'completed' if evaluations else 'pending'}")
        logger.info(f"  Total Evaluations: {len(evaluations)}")
        logger.info("=" * 80)
        
        return success_response(
            "Answers submitted successfully",
            {
                "submittedAt": datetime.now(timezone.utc).isoformat(),
                "evaluationStatus": "completed" if evaluations else "pending",
                "evaluationsCount": len(evaluations),
                "evaluationErrorsCount": len(evaluation_errors)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error submitting answers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit answers: {str(e)}"
        )


class SaveCandidateInfoRequest(BaseModel):
    """Request to save candidate information."""
    assessmentId: str
    token: str
    email: str
    name: str
    phone: Optional[str] = None
    hasResume: bool = False
    resume: Optional[str] = None  # Base64 data URL of resume file
    linkedIn: Optional[str] = None
    github: Optional[str] = None
    customFields: Optional[Dict[str, Any]] = None


class SaveReferenceFaceRequest(BaseModel):
    """Request to save reference face image."""
    assessmentId: str
    candidateEmail: str
    referenceImage: str  # Base64 encoded image


@router.post("/save-candidate-info")
async def save_candidate_info(
    request: SaveCandidateInfoRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Save candidate information (email, name, phone, resume status).
    This is called from the candidate requirements page.
    """
    try:
        assessment_id = to_object_id(request.assessmentId)
        assessment = await db.assessments.find_one({"_id": assessment_id})
        
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        # Store candidate info in candidateResponses
        candidate_key = f"{request.email.lower()}_{request.name.strip().lower()}"
        
        if "candidateResponses" not in assessment:
            assessment["candidateResponses"] = {}
        
        if candidate_key not in assessment["candidateResponses"]:
            assessment["candidateResponses"][candidate_key] = {
                "logs": [],
                "answers": {},
            }
        
        # Store candidate info
        candidate_info = {
            "email": request.email.lower().strip(),
            "name": request.name.strip(),
            "phone": request.phone.strip() if request.phone else None,
            "hasResume": request.hasResume,
            "savedAt": datetime.now(timezone.utc).isoformat(),
        }
        
        # Store resume file if provided
        if request.resume:
            candidate_info["resume"] = request.resume
        
        # Add LinkedIn, GitHub, and custom fields if provided
        if request.linkedIn:
            candidate_info["linkedIn"] = request.linkedIn.strip()
        if request.github:
            candidate_info["github"] = request.github.strip()
        if request.customFields:
            candidate_info["customFields"] = request.customFields
        
        assessment["candidateResponses"][candidate_key]["candidateInfo"] = candidate_info
        
        # Log the event
        if "logs" not in assessment["candidateResponses"][candidate_key]:
            assessment["candidateResponses"][candidate_key]["logs"] = []
        
        assessment["candidateResponses"][candidate_key]["logs"].append({
            "eventType": "CANDIDATE_INFO_SAVED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "email": request.email,
                "name": request.name,
                "hasPhone": bool(request.phone),
                "hasResume": request.hasResume,
            }
        })
        
        await db.assessments.update_one(
            {"_id": assessment_id},
            {"$set": {"candidateResponses": assessment["candidateResponses"]}}
        )
        
        return success_response({
            "message": "Candidate information saved successfully"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error saving candidate info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save candidate info: {str(e)}"
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
        assessment = None
        db_to_update = None
        collection_name = None
        
        # Try to find assessment in different collections (all in same database)
        # 1. Regular assessments (AI flow)
        assessment = await db.assessments.find_one({"_id": assessment_id})
        if assessment:
            db_to_update = db
            collection_name = "assessments"
        
        # 2. Custom MCQ assessments
        if not assessment:
            assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_id})
            if assessment:
                db_to_update = db
                collection_name = "custom_mcq_assessments"
        
        # 3. DSA tests (in same database, tests collection)
        # Check for DSA tests: test_type is "dsa" OR None OR doesn't exist
        if not assessment:
            assessment = await db.tests.find_one({
                "_id": assessment_id,
                "$or": [
                    {"test_type": "dsa"},
                    {"test_type": None},
                    {"test_type": {"$exists": False}}
                ]
            })
            if assessment:
                db_to_update = db
                collection_name = "tests"
        
        # 4. AIML tests (in same database, tests collection with test_type: "aiml")
        if not assessment:
            assessment = await db.tests.find_one({"_id": assessment_id, "test_type": "aiml"})
            if assessment:
                db_to_update = db
                collection_name = "tests"
        
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        # Store reference image in candidateResponses
        candidate_key = f"{request.candidateEmail.lower()}_"
        
        # Find the candidate key (email might be in different format)
        candidate_responses = assessment.get("candidateResponses", {})
        candidate_key_found = None
        
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
        
        # Update the correct collection in the correct database
        collection = getattr(db_to_update, collection_name)
        await collection.update_one(
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
        assessment_id = to_object_id(assessmentId)
        assessment = None
        
        # Try to find assessment in different collections (all in same database)
        # 1. Regular assessments (AI flow)
        assessment = await db.assessments.find_one({"_id": assessment_id})
        
        # 2. Custom MCQ assessments
        if not assessment:
            assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_id})
        
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
            # Fallback: if not found, try without test_type filter (for backward compatibility)
            if not assessment:
                temp_assessment = await db.tests.find_one({"_id": assessment_id})
                if temp_assessment and temp_assessment.get("test_type") != "aiml":
                    assessment = temp_assessment
        
        # 4. AIML tests (in same database, tests collection with test_type: "aiml")
        if not assessment:
            assessment = await db.tests.find_one({"_id": assessment_id, "test_type": "aiml"})
        
        if not assessment:
            return success_response("No reference photo found", {"referenceImage": None})
        
        # Get candidateResponses
        candidate_responses = assessment.get("candidateResponses", {})
        email_lower = candidateEmail.lower().strip()
        candidate_key_found = None
        
        # Find the candidate key (email might be in different format)
        if candidate_responses:
            for key in candidate_responses.keys():
                if email_lower in key.lower():
                    candidate_key_found = key
                    break
        
        # If candidate not found in this test OR candidateResponses is empty, search across all tests
        if not candidate_key_found:
            # Candidate not found in this specific test - search across all tests
            logger.info(f"[Candidate API] Candidate {candidateEmail} not found in test {assessmentId}, searching across all DSA/AIML tests...")
            
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
        candidate_data = candidate_responses.get(candidate_key_found, {})
        candidate_verification = candidate_data.get("candidateVerification", {})
        reference_image = candidate_verification.get("referenceImage")
        
        if not reference_image or not isinstance(reference_image, str) or len(reference_image) < 50:
            return success_response("No reference photo found", {"referenceImage": None})
        
        # Ensure it has data URI prefix
        if not reference_image.startswith("data:image"):
            reference_image = f"data:image/jpeg;base64,{reference_image}"
        
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