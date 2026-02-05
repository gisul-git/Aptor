"""
Custom MCQ Assessment API endpoints.
"""
from __future__ import annotations

import logging
import secrets
import copy
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo
import csv
import io

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status, UploadFile, File, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import ValidationError

from ....core.dependencies import require_editor, get_current_user
from ....db.mongo import get_db
from ....utils.mongo import serialize_document, to_object_id
from ....utils.responses import success_response, error_response
from ....utils.cache import (
    get_cached_tests,
    set_cached_tests,
    get_cached_dashboard,
    set_cached_dashboard,
    invalidate_user_tests_cache
)
import asyncio
from .schemas import (
    MCQQuestion,
    SubjectiveQuestion,
    ValidateCSVRequest,
    CreateCustomMCQAssessmentRequest,
    UpdateCustomMCQAssessmentRequest,
    VerifyCustomMCQCandidateRequest,
    SubmitCustomMCQRequest,
    SaveAnswerLogRequest,
)
from .ai_grading import grade_multiple_subjective_answers
from ..assessments.services.unified_ai_evaluation import (
    evaluate_pseudocode_answer,
    evaluate_subjective_answer_enhanced,
    aggregate_section_evaluation,
    generate_overall_assessment_summary
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/custom-mcq", tags=["custom-mcq"])


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _generate_assessment_token() -> str:
    """Generate a secure token for assessment access"""
    return secrets.token_urlsafe(32)


def _parse_csv_to_mcq_questions(csv_data: List[Dict[str, Any]]) -> List[MCQQuestion]:
    """Parse CSV data to MCQQuestion objects"""
    questions = []
    
    for idx, row in enumerate(csv_data):
        try:
            # Extract section and question
            section = str(row.get("section", "")).strip()
            question_text = str(row.get("question", "")).strip()
            
            if not question_text:
                continue
            
            # Extract options dynamically (optionA, optionB, optionC, ...)
            options = []
            option_labels = []
            option_idx = 0
            option_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            
            # Find all option columns
            for key, value in row.items():
                if key.lower().startswith("option") and value:
                    label = option_letters[option_idx] if option_idx < len(option_letters) else str(option_idx + 1)
                    options.append({
                        "label": label,
                        "text": str(value).strip()
                    })
                    option_labels.append(label)
                    option_idx += 1
            
            if not options:
                logger.warning(f"Row {idx + 1}: No options found, skipping")
                continue
            
            # Extract correct answer
            correct_an = str(row.get("correctAn", "")).strip().upper()
            if not correct_an:
                logger.warning(f"Row {idx + 1}: No correct answer specified, skipping")
                continue
            
            # Extract answer type
            answer_type = str(row.get("answerType", "single")).strip().lower()
            if answer_type not in ["single", "multiple_all", "multiple_any"]:
                answer_type = "single"
            
            # Extract marks
            try:
                marks = int(row.get("marks", 1))
                if marks < 1:
                    marks = 1
            except (ValueError, TypeError):
                marks = 1
            
            # Validate correct answer(s) exist in options
            correct_answers = [a.strip() for a in correct_an.split(",")]
            invalid_answers = [a for a in correct_answers if a not in option_labels]
            if invalid_answers:
                logger.warning(f"Row {idx + 1}: Invalid correct answers {invalid_answers}, skipping")
                continue
            
            question = MCQQuestion(
                questionType="mcq",
                section=section,
                question=question_text,
                options=[{"label": opt["label"], "text": opt["text"]} for opt in options],
                correctAn=correct_an,
                answerType=answer_type,
                marks=marks,
            )
            questions.append(question)
            
        except Exception as e:
            logger.error(f"Error parsing row {idx + 1}: {e}")
            continue
    
    return questions


def _parse_csv_to_subjective_questions(csv_data: List[Dict[str, Any]]) -> List[SubjectiveQuestion]:
    """Parse CSV data to SubjectiveQuestion objects (only question and marks columns)"""
    questions = []
    
    for idx, row in enumerate(csv_data):
        try:
            # Extract question (section column removed, use default)
            question_text = str(row.get("question", "")).strip()
            
            if not question_text:
                continue
            
            # Extract marks
            try:
                marks = int(row.get("marks", 1))
                if marks < 1:
                    marks = 1
            except (ValueError, TypeError):
                marks = 1
            
            # Use default section for subjective questions
            question = SubjectiveQuestion(
                questionType="subjective",
                section="subjective",  # Default section value
                question=question_text,
                marks=marks,
            )
            questions.append(question)
            
        except Exception as e:
            logger.error(f"Error parsing row {idx + 1}: {e}")
            continue
    
    return questions


@router.post("/validate-csv")
async def validate_csv(
    request: ValidateCSVRequest,
    questionType: str = Query("mcq", description="Question type: 'mcq' or 'subjective'"),
    current_user: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Validate CSV data and parse it into questions"""
    try:
        if questionType.lower() == "subjective":
            questions = _parse_csv_to_subjective_questions(request.csvData)
        else:
            questions = _parse_csv_to_mcq_questions(request.csvData)
        
        if not questions:
            return error_response("No valid questions found in CSV", status_code=400)
        
        # Return parsed questions for review
        questions_dict = [q.model_dump() for q in questions]
        
        return success_response(
            f"CSV validated successfully. Found {len(questions)} valid questions.",
            {"questions": questions_dict, "totalQuestions": len(questions)}
        )
        
    except Exception as e:
        logger.exception(f"Error validating CSV: {e}")
        return error_response(f"Failed to validate CSV: {str(e)}", status_code=500)


@router.post("/upload-csv", response_model=None)
async def upload_csv(
    file: UploadFile = File(...),
    questionType: str = Query("mcq", description="Question type: 'mcq' or 'subjective'"),
    current_user: Dict[str, Any] = Depends(require_editor),
) -> Dict[str, Any]:
    """Upload and parse CSV file"""
    try:
        if not file.filename.endswith('.csv'):
            return error_response("File must be a CSV file", status_code=400)
        
        contents = await file.read()
        text = contents.decode('utf-8')
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(text))
        csv_data = list(csv_reader)
        
        if not csv_data:
            return error_response("CSV file is empty", status_code=400)
        
        # Validate and parse questions based on type
        if questionType.lower() == "subjective":
            questions = _parse_csv_to_subjective_questions(csv_data)
        else:
            questions = _parse_csv_to_mcq_questions(csv_data)
        
        if not questions:
            return error_response("No valid questions found in CSV", status_code=400)
        
        questions_dict = [q.model_dump() for q in questions]
        
        return success_response(
            f"CSV uploaded successfully. Found {len(questions)} valid questions.",
            {"questions": questions_dict, "totalQuestions": len(questions)}
        )
        
    except Exception as e:
        logger.exception(f"Error uploading CSV: {e}")
        return error_response(f"Failed to upload CSV: {str(e)}", status_code=500)


@router.get("/sample-csv")
async def download_sample_csv(
    questionType: str = Query("mcq", description="Question type: 'mcq' or 'subjective'"),
    current_user: Dict[str, Any] = Depends(require_editor),
) -> Any:
    """Download sample CSV file"""
    from fastapi.responses import Response
    
    if questionType.lower() == "subjective":
        # Sample CSV content for subjective questions (only question and marks columns)
        sample_csv = """question,marks
What is Cloud Computing and why is it used in software applications?,5
Explain the concept of time complexity in algorithms with examples.,3
Describe the difference between SQL and NoSQL databases.,4
What are the key principles of object-oriented programming?,5
Explain how a binary search algorithm works.,4"""
        filename = "sample_subjective.csv"
    else:
        # Sample CSV content for MCQ questions
        sample_csv = """section,question,optionA,optionB,optionC,optionD,optionE,optionF,correctAn,answerType,marks
aptitude,What is 2+2?,2,3,4,5,,,C,single,1
logical_re,Select all prime numbers,2,4,5,6,7,8,"A,C,E",multiple_all,1
verbal,Choose synonym (any one) ,happy,joyful,angry,sad,,,"A,B",multiple_any,1
technical,What does CPU stand for?,Computer,processing,Central Processing Unit,Computer Central Unit,,,B,single,1
quantitative,What is the square of 3?,6,9,12,15,,,B,single,1"""
        filename = "sample_mcq.csv"
    
    return Response(
        content=sample_csv,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/create")
async def create_custom_mcq_assessment(
    request: CreateCustomMCQAssessmentRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
    http_request: Request = None,
) -> Dict[str, Any]:
    """Create a new custom MCQ assessment (supports draft and scheduled status)"""
    try:
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            return error_response("User ID not found", status_code=401)
        user_id = str(user_id)
        
        # Determine status (default to draft)
        status = request.status or "draft"
        # Convert "scheduled" to "active" for non-draft assessments (frontend expects "active")
        if status == "scheduled":
            status = "active"
        is_draft = status == "draft"
        
        # For active/scheduled assessments, validate all required fields
        if not is_draft:
            if not request.title or not request.title.strip():
                return error_response("Title is required for scheduled assessments", status_code=400)
            if not request.questions or len(request.questions) == 0:
                return error_response("At least one question is required for scheduled assessments", status_code=400)
            # Validate exam mode requirements - NEW IMPLEMENTATION
            if request.examMode == "strict":
                if not request.startTime:
                    return error_response("Start time is required for strict window mode", status_code=400)
                if not request.duration:
                    return error_response("Duration is required for strict window mode", status_code=400)
                # For strict mode, endTime is calculated from startTime + duration
            elif request.examMode == "flexible":
                if not request.startTime:
                    return error_response("Schedule start time is required for flexible window mode", status_code=400)
                if not request.endTime:
                    return error_response("Schedule end time is required for flexible window mode", status_code=400)
                if not request.duration:
                    return error_response("Duration is required for flexible window mode", status_code=400)
        
        # Generate assessment token (only for scheduled, or if not exists for draft)
        assessment_token = None
        assessment_url = None
        if not is_draft:
            assessment_token = _generate_assessment_token()
            # Generate assessment URL only for scheduled assessments
            # We'll generate it after insert for drafts
        
        # Prepare questions with IDs (handle both MCQ and Subjective)
        questions_with_ids = []
        if request.questions:
            for idx, q in enumerate(request.questions):
                # Handle dict or model instance
                if isinstance(q, dict):
                    q_dict = q
                else:
                    q_dict = q.model_dump() if hasattr(q, 'model_dump') else dict(q)
                
                # Ensure questionType is set
                question_type = q_dict.get("questionType", "mcq")
                if question_type not in ["mcq", "subjective"]:
                    # Try to infer from structure
                    if "options" in q_dict and "correctAn" in q_dict:
                        question_type = "mcq"
                    else:
                        question_type = "subjective"
                    q_dict["questionType"] = question_type
                
                q_dict["id"] = q_dict.get("id") or f"q_{idx + 1}"
                if "createdAt" not in q_dict or not q_dict.get("createdAt"):
                    q_dict["createdAt"] = _now_utc()
                q_dict["updatedAt"] = _now_utc()
                questions_with_ids.append(q_dict)
        
        # Sort questions: MCQ first, then Subjective
        def get_question_type_order(q):
            """Return 0 for MCQ, 1 for Subjective (for sorting)"""
            q_type = q.get("questionType", "mcq")
            if q_type not in ["mcq", "subjective"]:
                # Infer from structure
                if "options" in q and "correctAn" in q:
                    return 0  # MCQ
                else:
                    return 1  # Subjective
            return 0 if q_type == "mcq" else 1
        
        questions_with_ids.sort(key=get_question_type_order)
        
        # Prepare candidates
        candidates_list = []
        if request.candidates:
            candidates_list = [c.model_dump() for c in request.candidates]
        
        # Calculate total marks
        total_marks = sum(q["marks"] for q in questions_with_ids) if questions_with_ids else 0
        
        # Helper function to convert string or datetime to ISO string
        # Import datetime locally to avoid closure issues
        from datetime import datetime as dt_class, timedelta, timezone
        
        def to_iso_string(dt):
            if dt is None:
                return None
            if isinstance(dt, str):
                # If string already has timezone, return as is
                if 'Z' in dt or '+' in dt or dt.count('-') > 2:
                    return dt
                # If string has no timezone, assume UTC and append +00:00
                if 'T' in dt:
                    return dt + '+00:00'
                return dt
            if isinstance(dt, dt_class):
                # Ensure UTC timezone is included
                if dt.tzinfo is None:
                    # If no timezone, assume UTC and add timezone info
                    dt_utc = dt.replace(tzinfo=timezone.utc)
                    return dt_utc.isoformat()
                else:
                    # Convert to UTC if it has timezone
                    dt_utc = dt.astimezone(timezone.utc)
                    return dt_utc.isoformat()
            return str(dt)
        
        # Helper function to get datetime object from string or datetime
        def to_datetime(dt):
            if dt is None:
                return None
            if isinstance(dt, dt_class):
                return dt.replace(tzinfo=None) if dt.tzinfo else dt
            if isinstance(dt, str):
                try:
                    # Try parsing ISO format string (handles both with and without timezone)
                    if 'Z' in dt or '+' in dt or dt.count('-') > 2:
                        # Has timezone info
                        return dt_class.fromisoformat(dt.replace('Z', '+00:00')).replace(tzinfo=None)
                    else:
                        # No timezone, assume UTC
                        return dt_class.fromisoformat(dt)
                except (ValueError, AttributeError):
                    # If parsing fails, try to create datetime from common formats
                    try:
                        # Try common datetime formats
                        for fmt in ['%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M']:
                            try:
                                return dt_class.strptime(dt, fmt)
                            except ValueError:
                                continue
                        # If all formats fail, return None
                        return None
                    except:
                        return None
            return dt
        
        # For strict mode, calculate endTime from startTime + duration
        calculated_end_time = None
        if request.examMode == "strict" and request.startTime and request.duration:
            start_dt = to_datetime(request.startTime)
            if start_dt:
                calculated_end_time = start_dt + timedelta(minutes=request.duration)
        
        # Use calculated endTime for strict mode, provided endTime for flexible mode
        final_end_time = calculated_end_time if request.examMode == "strict" else request.endTime
        
        # Extract candidateRequirements from request body if available
        candidate_requirements = {}
        if http_request:
            try:
                body = await http_request.json()
                if isinstance(body, dict) and "schedule" in body:
                    schedule_data = body.get("schedule", {})
                    if isinstance(schedule_data, dict) and "candidateRequirements" in schedule_data:
                        candidate_requirements = schedule_data.get("candidateRequirements", {})
            except Exception:
                pass  # If parsing fails, use empty dict
        
        # Create assessment document
        assessment_doc = {
            "title": request.title or "",
            "description": request.description or "",
            "type": "custom_mcq",
            "status": status,
            "created_by": user_id,
            "created_at": _now_utc(),
            "updated_at": _now_utc(),
            "questions": questions_with_ids,
            "candidates": candidates_list,
            "accessMode": request.accessMode,
            "examMode": request.examMode,
            "schedule": {
                "startTime": to_iso_string(request.startTime),
                "endTime": to_iso_string(final_end_time),
                "duration": request.duration,  # In minutes
                "candidateRequirements": candidate_requirements,
            },
            "passPercentage": request.passPercentage,
            "submissions": {},  # Store candidate submissions
            "totalMarks": total_marks,
            "currentStation": request.currentStation or 1,  # Track current station
            "enablePerSectionTimers": request.enablePerSectionTimers if request.enablePerSectionTimers is not None else False,
            "sectionTimers": request.sectionTimers if request.sectionTimers else None,
            "proctoringSettings": request.proctoringSettings.model_dump() if getattr(request, "proctoringSettings", None) else None,
        "showResultToCandidate": request.showResultToCandidate if request.showResultToCandidate is not None else True,
        }
        
        # Only add token and URL for scheduled assessments
        if assessment_token:
            assessment_doc["assessmentToken"] = assessment_token
        
        # Insert into database
        result = await db.custom_mcq_assessments.insert_one(assessment_doc)
        assessment_id = str(result.inserted_id)
        
        # Generate assessment URL for scheduled assessments
        if assessment_token:
            assessment_url = f"/custom-mcq/entry/{assessment_id}?token={assessment_token}"
        
        # Invalidate cache for this user
        await invalidate_user_tests_cache(user_id)
        
        return success_response(
            "Custom MCQ assessment created successfully",
            {
                "assessmentId": assessment_id,
                "assessmentToken": assessment_token,
                "assessmentUrl": assessment_url,
                "totalQuestions": len(questions_with_ids),
                "totalMarks": total_marks,
                "status": status,
                "currentStation": assessment_doc["currentStation"],
            }
        )
        
    except Exception as e:
        logger.exception(f"Error creating custom MCQ assessment: {e}")
        return error_response(f"Failed to create assessment: {str(e)}", status_code=500)


@router.get("/dashboard")
async def get_assessments_dashboard(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Lightweight dashboard endpoint for Custom MCQ assessments.
    Optimized with MongoDB field projection, Redis caching, and pagination.
    """
    try:
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            return error_response("User ID not found", status_code=401)
        user_id = str(user_id)
        
        # Try cache first
        cached_data = await get_cached_dashboard(user_id, page, limit)
        if cached_data:
            return success_response("Custom MCQ assessments fetched successfully", cached_data)
        
        # Build query with field projection
        query = {"created_by": user_id}
        skip = (page - 1) * limit
        
        # Use aggregation pipeline for optimized query
        pipeline = [
            {"$match": query},
            {
                "$project": {
                    "_id": 1,
                    "title": 1,
                    "status": 1,
                    "created_at": 1,
                    "updated_at": 1,
                    "schedule.startTime": 1,
                    "schedule.endTime": 1,
                    "schedule.duration": 1,
                    "pausedAt": 1,
                }
            },
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        # Get total count and assessments in parallel
        count_task = db.custom_mcq_assessments.count_documents(query)
        assessments_task = db.custom_mcq_assessments.aggregate(pipeline).to_list(length=limit)
        
        total_count, assessments = await asyncio.gather(count_task, assessments_task)
        
        # Format results
        result = []
        for assessment in assessments:
            schedule = assessment.get("schedule", {})
            has_schedule = bool(schedule.get("startTime") and schedule.get("endTime"))
            
            status_val = assessment.get("status", "draft")
            if assessment.get("pausedAt"):
                status_val = "paused"
            
            result.append({
                "id": str(assessment["_id"]),
                "title": assessment.get("title", ""),
                "status": status_val,
                "hasSchedule": has_schedule,
                "scheduleStatus": {
                    "startTime": schedule.get("startTime"),
                    "endTime": schedule.get("endTime"),
                    "duration": schedule.get("duration"),
                    "isActive": status_val == "active",
                } if has_schedule else None,
                "createdAt": assessment.get("created_at"),
                "updatedAt": assessment.get("updated_at"),
                "pausedAt": assessment.get("pausedAt"),
            })
        
        # Build response with pagination
        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 0
        response_data = {
            "assessments": result,
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
        
        return success_response("Custom MCQ assessments fetched successfully", response_data)
        
    except Exception as e:
        logger.exception(f"Error in dashboard endpoint: {e}")
        return error_response(f"Failed to fetch assessments: {str(e)}", status_code=500)

@router.get("/list")
async def list_custom_mcq_assessments(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=100, description="Items per page"),
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    List all custom MCQ assessments for the current user.
    Optimized with Redis caching, MongoDB field projection, and pagination.
    """
    try:
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            logger.warning("[Custom MCQ List] User ID not found in current_user")
            return error_response("User ID not found", status_code=401)
        user_id = str(user_id)
        
        # Try cache first
        cached_assessments = await get_cached_tests(user_id, page, limit)
        if cached_assessments is not None:
            return success_response(
                "Custom MCQ assessments fetched successfully",
                {"assessments": cached_assessments, "total": len(cached_assessments)}
            )
        
        logger.info(f"[Custom MCQ List] Fetching assessments for user_id: {user_id}")
        
        # Build query with pagination
        query = {"created_by": user_id}
        skip = (page - 1) * limit
        
        # Use aggregation pipeline with field projection
        pipeline = [
            {"$match": query},
            {
                "$project": {
                    "_id": 1,
                    "title": 1,
                    "description": 1,
                    "status": 1,
                    "questions": 1,
                    "totalMarks": 1,
                    "submissions": 1,
                    "created_at": 1,
                    "updated_at": 1,
                    "currentStation": 1,
                    "schedule": 1,
                    "pausedAt": 1,
                }
            },
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        assessments_docs = await db.custom_mcq_assessments.aggregate(pipeline).to_list(length=limit)
        
        assessments = []
        for assessment in assessments_docs:
            assessment_count += 1
            assessment_serialized = serialize_document(assessment)
            if not assessment_serialized:
                logger.warning(f"[Custom MCQ List] Skipping assessment {assessment.get('_id')} - serialization failed")
                continue
            
            # Count submissions
            submissions = assessment_serialized.get("submissions", {})
            submissions_count = len(submissions) if submissions else 0
            
            assessment_data = {
                "id": assessment_serialized.get("id") or assessment_serialized.get("_id"),
                "title": assessment_serialized.get("title", ""),
                "description": assessment_serialized.get("description", ""),
                "status": assessment_serialized.get("status", "draft"),
                "totalQuestions": len(assessment_serialized.get("questions", [])),
                "totalMarks": assessment_serialized.get("totalMarks", 0),
                "submissionsCount": submissions_count,
                "createdAt": assessment_serialized.get("created_at"),
                "updatedAt": assessment_serialized.get("updated_at"),
                "currentStation": assessment_serialized.get("currentStation", 1),  # Include current station
                "schedule": assessment_serialized.get("schedule", {}),  # Include schedule for dashboard
                "pausedAt": assessment_serialized.get("pausedAt"),  # Include pausedAt for dashboard status determination
            }
            
            logger.info(f"[Custom MCQ List] Assessment {assessment_data['id']}: title='{assessment_data['title']}', status='{assessment_data['status']}', schedule={assessment_data['schedule']}, pausedAt={assessment_data['pausedAt']}")
            assessments.append(assessment_data)
        
        logger.info(f"[Custom MCQ List] Found {len(assessments)} assessments (processed {assessment_count} from DB)")
        response_data = {"assessments": assessments, "total": len(assessments)}
        logger.info(f"[Custom MCQ List] Returning response with {len(assessments)} assessments")
        
        return success_response(
            "Custom MCQ assessments fetched successfully",
            response_data
        )
        
    except Exception as e:
        logger.exception(f"Error listing custom MCQ assessments: {e}")
        return error_response(f"Failed to list assessments: {str(e)}", status_code=500)


@router.get("/{assessment_id}")
async def get_custom_mcq_assessment(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Get a specific custom MCQ assessment"""
    try:
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            return error_response("User ID not found", status_code=401)
        user_id = str(user_id)
        assessment_oid = to_object_id(assessment_id)
        
        assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_oid})
        
        if not assessment:
            return error_response("Assessment not found", status_code=404)
        
        # Check ownership
        if str(assessment["created_by"]) != user_id:
            return error_response("Access denied", status_code=403)
        
        assessment_serialized = serialize_document(assessment)
        
        # Get submissions summary
        submissions = assessment_serialized.get("submissions", {})
        submissions_list = []
        for key, submission_data in submissions.items():
            submissions_list.append({
                "candidateKey": key,
                "candidateInfo": submission_data.get("candidateInfo", {}),
                "score": submission_data.get("score", 0),
                "totalMarks": submission_data.get("totalMarks", 0),
                "percentage": submission_data.get("percentage", 0),
                "passed": submission_data.get("passed", False),
                "status": submission_data.get("status", "pending"),
                "gradingStatus": submission_data.get("gradingStatus", "completed"),
                "submittedAt": submission_data.get("submittedAt"),
                "startedAt": submission_data.get("startedAt"),
                "mcqScore": submission_data.get("mcqScore", 0),
                "mcqTotal": submission_data.get("mcqTotal", 0),
                "subjectiveScore": submission_data.get("subjectiveScore", 0),
                "subjectiveTotal": submission_data.get("subjectiveTotal", 0),
                "answerLogs": submission_data.get("answerLogs", {}),  # Include answer logs
                "submissions": submission_data.get("submissions", []),  # Include graded submissions with marks
                "candidateRequirements": submission_data.get("candidateRequirements", {}),  # Include candidate requirements
            })
        
        assessment_serialized["submissionsList"] = submissions_list
        assessment_serialized["submissionsCount"] = len(submissions_list)
        
        return success_response(
            "Assessment fetched successfully",
            assessment_serialized
        )
        
    except Exception as e:
        logger.exception(f"Error getting custom MCQ assessment: {e}")
        return error_response(f"Failed to get assessment: {str(e)}", status_code=500)


@router.put("/{assessment_id}")
async def update_custom_mcq_assessment(
    assessment_id: str,
    request: UpdateCustomMCQAssessmentRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
    http_request: Request = None,
) -> Dict[str, Any]:
    """Update a custom MCQ assessment"""
    try:
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            return error_response("User ID not found", status_code=401)
        user_id = str(user_id)
        assessment_oid = to_object_id(assessment_id)
        
        assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_oid})
        
        if not assessment:
            return error_response("Assessment not found", status_code=404)
        
        # Check ownership
        if str(assessment["created_by"]) != user_id:
            return error_response("Access denied", status_code=403)
        
        # Build update document
        update_doc = {"updated_at": _now_utc()}
        
        if request.title is not None:
            update_doc["title"] = request.title
        
        if request.description is not None:
            update_doc["description"] = request.description
        
        if request.questions is not None:
            questions_with_ids = []
            for idx, q in enumerate(request.questions):
                # Handle dict or model instance
                if isinstance(q, dict):
                    q_dict = q
                else:
                    q_dict = q.model_dump() if hasattr(q, 'model_dump') else dict(q)
                
                # Ensure questionType is set
                question_type = q_dict.get("questionType", "mcq")
                if question_type not in ["mcq", "subjective"]:
                    # Try to infer from structure
                    if "options" in q_dict and "correctAn" in q_dict:
                        question_type = "mcq"
                    else:
                        question_type = "subjective"
                    q_dict["questionType"] = question_type
                
                q_dict["id"] = q_dict.get("id") or f"q_{idx + 1}"
                q_dict["updatedAt"] = _now_utc()
                if "createdAt" not in q_dict:
                    q_dict["createdAt"] = _now_utc()
                questions_with_ids.append(q_dict)
            
            # Sort questions: MCQ first, then Subjective
            def get_question_type_order(q):
                """Return 0 for MCQ, 1 for Subjective (for sorting)"""
                q_type = q.get("questionType", "mcq")
                if q_type not in ["mcq", "subjective"]:
                    # Infer from structure
                    if "options" in q and "correctAn" in q:
                        return 0  # MCQ
                    else:
                        return 1  # Subjective
                return 0 if q_type == "mcq" else 1
            
            questions_with_ids.sort(key=get_question_type_order)
            update_doc["questions"] = questions_with_ids
            update_doc["totalMarks"] = sum(q["marks"] for q in questions_with_ids)
        
        if request.candidates is not None:
            try:
                update_doc["candidates"] = [c.model_dump() if hasattr(c, 'model_dump') else dict(c) if isinstance(c, dict) else c for c in request.candidates]
            except Exception as e:
                logger.warning(f"Error processing candidates: {e}")
                update_doc["candidates"] = [dict(c) if isinstance(c, dict) else c for c in request.candidates]
        
        if request.accessMode is not None:
            update_doc["accessMode"] = request.accessMode
        
        if request.examMode is not None:
            update_doc["examMode"] = request.examMode
        
        # Import datetime locally to avoid closure issues
        from datetime import datetime as dt_class, timedelta, timezone
        
        # Helper functions for datetime handling (same as in create endpoint)
        def to_iso_string(dt):
            if dt is None:
                return None
            if isinstance(dt, str):
                # If string already has timezone, return as is
                if 'Z' in dt or '+' in dt or dt.count('-') > 2:
                    return dt
                # If string has no timezone, assume UTC and append +00:00
                if 'T' in dt:
                    return dt + '+00:00'
                return dt
            if isinstance(dt, dt_class):
                # Ensure UTC timezone is included
                if dt.tzinfo is None:
                    # If no timezone, assume UTC and add timezone info
                    dt_utc = dt.replace(tzinfo=timezone.utc)
                    return dt_utc.isoformat()
                else:
                    # Convert to UTC if it has timezone
                    dt_utc = dt.astimezone(timezone.utc)
                    return dt_utc.isoformat()
            return str(dt)
        
        def to_datetime(dt):
            if dt is None:
                return None
            if isinstance(dt, dt_class):
                return dt.replace(tzinfo=None) if dt.tzinfo else dt
            if isinstance(dt, str):
                try:
                    if 'Z' in dt or '+' in dt or dt.count('-') > 2:
                        return dt_class.fromisoformat(dt.replace('Z', '+00:00')).replace(tzinfo=None)
                    else:
                        return dt_class.fromisoformat(dt)
                except (ValueError, AttributeError):
                    for fmt in ['%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M']:
                        try:
                            return dt_class.strptime(dt, fmt)
                        except ValueError:
                            continue
                    return None
            return dt
        
        # Handle schedule updates - merge with existing schedule
        schedule_updated = False
        existing_schedule = assessment.get("schedule") or {}
        schedule = dict(existing_schedule) if isinstance(existing_schedule, dict) else {}  # Copy existing schedule safely
        
        if request.startTime is not None:
            schedule["startTime"] = to_iso_string(request.startTime)
            schedule_updated = True
        if request.endTime is not None:
            schedule["endTime"] = to_iso_string(request.endTime)
            schedule_updated = True
        if request.duration is not None:
            schedule["duration"] = request.duration
            schedule_updated = True
        
        # Extract candidateRequirements from request body if available (for update endpoint)
        candidate_requirements = schedule.get("candidateRequirements", {})
        if http_request:
            try:
                body = await http_request.json()
                if isinstance(body, dict) and "schedule" in body:
                    schedule_data = body.get("schedule", {})
                    if isinstance(schedule_data, dict) and "candidateRequirements" in schedule_data:
                        candidate_requirements = schedule_data.get("candidateRequirements", {})
            except Exception:
                pass  # If parsing fails, preserve existing
        
        if schedule_updated:
            schedule["candidateRequirements"] = candidate_requirements
            update_doc["schedule"] = schedule
        elif candidate_requirements:  # If schedule not updated but candidateRequirements provided
            schedule["candidateRequirements"] = candidate_requirements
            update_doc["schedule"] = schedule
        
        if request.passPercentage is not None:
            update_doc["passPercentage"] = request.passPercentage
        
        # Update enablePerSectionTimers if provided
        if request.enablePerSectionTimers is not None:
            update_doc["enablePerSectionTimers"] = request.enablePerSectionTimers
        
        # Update sectionTimers if provided
        if request.sectionTimers is not None:
            update_doc["sectionTimers"] = request.sectionTimers
        
        # For strict mode, recalculate endTime if startTime or duration changed
        if update_doc.get("examMode") == "strict" or (request.examMode is None and assessment.get("examMode") == "strict"):
            current_schedule = update_doc.get("schedule") or (assessment.get("schedule") or {})
            if isinstance(current_schedule, dict) and current_schedule.get("startTime") and current_schedule.get("duration"):
                try:
                    start_time_dt = to_datetime(current_schedule["startTime"])
                    duration_val = current_schedule.get("duration")
                    if start_time_dt and duration_val:
                        # Ensure duration is a number
                        duration_int = int(duration_val) if duration_val else None
                        if duration_int:
                            calculated_end = start_time_dt + timedelta(minutes=duration_int)
                            current_schedule["endTime"] = to_iso_string(calculated_end)
                            update_doc["schedule"] = current_schedule
                except (ValueError, TypeError, AttributeError) as e:
                    logger.warning(f"Error calculating endTime for strict mode: {e}")
                    # Don't crash, just skip the calculation
        
        # Handle status update (draft -> scheduled/active)
        status_to_set = None
        if request.status is not None:
            # Convert "scheduled" to "active" for consistency (frontend expects "active")
            status_to_set = "active" if request.status == "scheduled" else request.status
            update_doc["status"] = status_to_set
            # If publishing (scheduled/active), validate and generate token if needed
            if status_to_set in ("scheduled", "active"):
                # Validate required fields for published assessments
                current_title = update_doc.get("title") or assessment.get("title", "")
                current_questions = update_doc.get("questions") or assessment.get("questions", [])
                
                if not current_title or not current_title.strip():
                    return error_response("Title is required for scheduled assessments", status_code=400)
                if not current_questions or len(current_questions) == 0:
                    return error_response("At least one question is required for scheduled assessments", status_code=400)
                
                # Validate exam mode requirements - NEW IMPLEMENTATION
                current_exam_mode = update_doc.get("examMode") or assessment.get("examMode", "strict")
                current_schedule = update_doc.get("schedule") or (assessment.get("schedule") or {})
                
                # Ensure current_schedule is a dict
                if not isinstance(current_schedule, dict):
                    current_schedule = {}
                
                if current_exam_mode == "strict":
                    if not current_schedule.get("startTime"):
                        return error_response("Start time is required for strict window mode", status_code=400)
                    if not current_schedule.get("duration"):
                        return error_response("Duration is required for strict window mode", status_code=400)
                    # For strict mode, calculate endTime if not present
                    if not current_schedule.get("endTime") and current_schedule.get("startTime") and current_schedule.get("duration"):
                        start_time_dt = to_datetime(current_schedule["startTime"])
                        if start_time_dt:
                            calculated_end = start_time_dt + timedelta(minutes=current_schedule["duration"])
                            current_schedule["endTime"] = to_iso_string(calculated_end)
                            update_doc["schedule"] = current_schedule
                elif current_exam_mode == "flexible":
                    if not current_schedule.get("startTime"):
                        return error_response("Schedule start time is required for flexible window mode", status_code=400)
                    if not current_schedule.get("endTime"):
                        return error_response("Schedule end time is required for flexible window mode", status_code=400)
                    if not current_schedule.get("duration"):
                        return error_response("Duration is required for flexible window mode", status_code=400)
                
                # Generate assessment token if not exists
                if not assessment.get("assessmentToken"):
                    assessment_token = _generate_assessment_token()
                    update_doc["assessmentToken"] = assessment_token
        
        # Update current station if provided
        if request.currentStation is not None:
            update_doc["currentStation"] = request.currentStation

        # Update proctoring settings if provided
        if getattr(request, "proctoringSettings", None) is not None:
            try:
                if request.proctoringSettings:
                    if hasattr(request.proctoringSettings, 'model_dump'):
                        update_doc["proctoringSettings"] = request.proctoringSettings.model_dump()
                    elif isinstance(request.proctoringSettings, dict):
                        update_doc["proctoringSettings"] = request.proctoringSettings
                    else:
                        update_doc["proctoringSettings"] = dict(request.proctoringSettings)
                else:
                    update_doc["proctoringSettings"] = None
            except Exception as e:
                logger.warning(f"Error processing proctoringSettings: {e}")
                update_doc["proctoringSettings"] = dict(request.proctoringSettings) if request.proctoringSettings else None
        
        # Update showResultToCandidate if provided
        if getattr(request, "showResultToCandidate", None) is not None:
            update_doc["showResultToCandidate"] = request.showResultToCandidate
        
        await db.custom_mcq_assessments.update_one(
            {"_id": assessment_oid},
            {"$set": update_doc}
        )
        
        # Get updated assessment to return token if it was generated
        updated_assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_oid})
        response_data = {"message": "Assessment updated successfully"}
        
        # If status changed to scheduled/active and token exists, include it
        if status_to_set and status_to_set in ("scheduled", "active") and updated_assessment and updated_assessment.get("assessmentToken"):
            assessment_id = str(updated_assessment["_id"])
            assessment_token = updated_assessment["assessmentToken"]
            response_data["assessmentToken"] = assessment_token
            response_data["assessmentUrl"] = f"/custom-mcq/entry/{assessment_id}?token={assessment_token}"
        
        # Invalidate cache for this user
        await invalidate_user_tests_cache(user_id)
        
        return success_response("Assessment updated successfully", response_data)
        
    except Exception as e:
        logger.exception(f"Error updating custom MCQ assessment: {e}")
        return error_response(f"Failed to update assessment: {str(e)}", status_code=500)


@router.delete("/{assessment_id}")
async def delete_custom_mcq_assessment(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Delete a custom MCQ assessment"""
    try:
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            return error_response("User ID not found", status_code=401)
        user_id = str(user_id)
        assessment_oid = to_object_id(assessment_id)
        
        assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_oid})
        
        if not assessment:
            return error_response("Assessment not found", status_code=404)
        
        # Check ownership
        if str(assessment["created_by"]) != user_id:
            return error_response("Access denied", status_code=403)
        
        await db.custom_mcq_assessments.delete_one({"_id": assessment_oid})
        
        # Invalidate cache for this user
        await invalidate_user_tests_cache(user_id)
        
        return success_response("Assessment deleted successfully")
        
    except Exception as e:
        logger.exception(f"Error deleting custom MCQ assessment: {e}")
        return error_response(f"Failed to delete assessment: {str(e)}", status_code=500)


@router.post("/{assessment_id}/clone")
async def clone_custom_mcq_assessment(
    assessment_id: str,
    request: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Clone a custom MCQ assessment with deep copy of questions and configuration.
    Does NOT copy schedule, candidates, or submissions by default.
    
    Request body:
    - newTitle: str (required, min 3 chars)
    - keepSchedule: bool (default False)
    - keepCandidates: bool (default False)
    """
    try:
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            return error_response("User ID not found", status_code=401)
        user_id = str(user_id)
        
        # Validate assessment ID
        assessment_oid = to_object_id(assessment_id)
        if not assessment_oid:
            return error_response("Invalid assessment ID", status_code=400)
        
        # Get request parameters
        new_title = request.get("newTitle", "").strip()
        keep_schedule = request.get("keepSchedule", False)
        keep_candidates = request.get("keepCandidates", False)
        
        # Validate newTitle
        if not new_title or len(new_title) < 3:
            return error_response(
                "New assessment name is required and must be at least 3 characters",
                status_code=400
            )
        
        # Fetch original assessment
        original_assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_oid})
        if not original_assessment:
            return error_response("Assessment not found", status_code=404)
        
        # Check ownership
        if str(original_assessment.get("created_by")) != user_id:
            return error_response("Access denied", status_code=403)
        
        now = _now_utc()
        
        # Deep copy the assessment document
        cloned_assessment = copy.deepcopy(original_assessment)
        
        # Remove MongoDB-specific fields
        cloned_assessment.pop("_id", None)
        cloned_assessment.pop("created_at", None)
        cloned_assessment.pop("updated_at", None)
        
        # Set new fields
        cloned_assessment["title"] = new_title
        cloned_assessment["status"] = "draft"
        cloned_assessment["clonedFrom"] = str(original_assessment.get("_id"))
        cloned_assessment["created_by"] = user_id
        cloned_assessment["created_at"] = now
        cloned_assessment["updated_at"] = now
        cloned_assessment["currentStation"] = 1  # Reset to first station
        
        # Reset assessment token and URL (will be generated when scheduled)
        cloned_assessment.pop("assessmentToken", None)
        cloned_assessment.pop("assessmentUrl", None)
        
        # Handle schedule based on keep_schedule flag
        if not keep_schedule:
            # Reset schedule to None or empty
            cloned_assessment["schedule"] = None
            cloned_assessment.pop("startTime", None)
            cloned_assessment.pop("endTime", None)
        else:
            # Keep schedule but ensure it's a valid structure
            if "schedule" in cloned_assessment and isinstance(cloned_assessment["schedule"], dict):
                # Keep schedule as-is
                pass
        
        # Handle candidates based on keep_candidates flag
        if not keep_candidates:
            cloned_assessment["candidates"] = []
        # else: keep candidates as-is
        
        # Always reset submissions (never copy submissions)
        cloned_assessment["submissions"] = {}
        
        # Regenerate question IDs
        if "questions" in cloned_assessment and isinstance(cloned_assessment["questions"], list):
            for question in cloned_assessment["questions"]:
                # Regenerate question ID
                if "_id" in question:
                    question["_id"] = str(uuid.uuid4())
                if "id" in question:
                    question["id"] = str(uuid.uuid4())
                # Generate new question ID if it doesn't exist
                if "_id" not in question and "id" not in question:
                    question["id"] = str(uuid.uuid4())
        
        # Reset pause/resume related fields
        cloned_assessment.pop("pausedAt", None)
        cloned_assessment.pop("resumeAt", None)
        cloned_assessment.pop("statusBeforePause", None)
        
        # Reset invitation-related fields
        cloned_assessment.pop("invitationsSent", None)
        cloned_assessment.pop("sentAt", None)
        
        # Insert the cloned assessment
        result = await db.custom_mcq_assessments.insert_one(cloned_assessment)
        new_assessment_id = str(result.inserted_id)
        
        # Fetch the newly created assessment
        new_assessment = await db.custom_mcq_assessments.find_one({"_id": result.inserted_id})
        
        # Convert datetime objects to ISO format strings for response
        created_at = new_assessment.get("created_at", now)
        updated_at = new_assessment.get("updated_at", now)
        
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        elif created_at is None:
            created_at = now.isoformat()
        
        if isinstance(updated_at, datetime):
            updated_at = updated_at.isoformat()
        elif updated_at is None:
            updated_at = now.isoformat()
        
        # Return response matching other services' format
        return success_response(
            "Assessment cloned successfully",
            {
                "assessmentId": new_assessment_id,
                "id": new_assessment_id,
                "title": new_assessment.get("title", new_title),
                "status": new_assessment.get("status", "draft"),
                "createdAt": created_at,
                "updatedAt": updated_at,
                "clonedFrom": str(new_assessment.get("clonedFrom")) if new_assessment.get("clonedFrom") else None,
            }
        )
        
    except Exception as e:
        logger.exception(f"Error cloning custom MCQ assessment: {e}")
        return error_response(f"Failed to clone assessment: {str(e)}", status_code=500)


@router.post("/verify-candidate")
async def verify_custom_mcq_candidate(
    request: VerifyCustomMCQCandidateRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Verify candidate access to custom MCQ assessment"""
    try:
        # Fetch assessment by ID
        assessment_id = request.assessmentId
        oid = to_object_id(assessment_id)
        assessment = await db.custom_mcq_assessments.find_one({"_id": oid})

        if not assessment:
            return error_response("Assessment not found", status_code=404)
        
        # Check token (basic validation)
        assessment_token = assessment.get("assessmentToken")
        if not assessment_token:
            logger.error(f"Assessment {assessment_id} has no assessmentToken configured")
            return error_response("Assessment token not configured", status_code=500)
        if assessment_token != request.token:
            logger.warning(f"Token mismatch for assessment {assessment_id}. Expected: {assessment_token[:10]}..., Got: {request.token[:10] if request.token else 'None'}...")
            return error_response("Invalid or expired assessment token. Please use the correct assessment link.", status_code=403)
        
        # Check if candidate already submitted (BEFORE checking access mode)
        # This prevents retaking the assessment in both public and private modes
        submissions = assessment.get("submissions", {})
        candidate_key = f"{request.email.lower().strip()}_{request.name.strip().lower()}"
        existing_submission = submissions.get(candidate_key)
        
        # Log for debugging
        logger.info(f"Verifying candidate - Key: {candidate_key}, Has submission: {existing_submission is not None}")
        if existing_submission:
            logger.info(f"Existing submission - Status: {existing_submission.get('status')}, SubmittedAt: {existing_submission.get('submittedAt')}")
        
        # Check if candidate has already submitted OR is currently taking the assessment
        # If ANY submission record exists for this candidate_key, block access (prevents retaking or concurrent sessions)
        if existing_submission:
            submission_status = existing_submission.get("status")
            submitted_at = existing_submission.get("submittedAt")
            started_at = existing_submission.get("startedAt")
            score = existing_submission.get("score")
            submissions_list = existing_submission.get("submissions")
            
            # Check if they've completed the assessment
            has_completed = (
                submission_status == "completed" or 
                submitted_at or 
                (score is not None and submitted_at)
            )
            
            # Check if they're currently taking it (started but not submitted)
            is_in_progress = (
                started_at and 
                not submitted_at and
                submission_status != "completed"
            )
            
            if has_completed:
                logger.warning(f"Blocking access for {candidate_key} - already submitted (status: {submission_status}, submittedAt: {submitted_at}, score: {score})")
                return error_response("You have already submitted this assessment. You cannot take the test again.", status_code=400)
            elif is_in_progress:
                logger.warning(f"Blocking access for {candidate_key} - currently taking assessment (startedAt: {started_at}, submittedAt: {submitted_at})")
                return error_response("You are already taking this assessment in another tab or browser. Please complete it there first.", status_code=400)
        
        # NEW: Check access time based on exam mode (BEFORE checking access mode)
        from datetime import datetime, timedelta
        
        # Use IST (Indian Standard Time) for custom MCQ assessments
        IST = ZoneInfo("Asia/Kolkata")
        now = datetime.now(IST).replace(tzinfo=None)  # Make naive for comparison
        
        exam_mode = assessment.get("examMode", "strict")
        schedule = assessment.get("schedule") or {}
        start_time_str = schedule.get("startTime") if isinstance(schedule, dict) else None
        end_time_str = schedule.get("endTime") if isinstance(schedule, dict) else None
        
        if exam_mode == "strict" and start_time_str:
            # Strict mode: Check if assessment has started and if it has ended
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
            start_time = start_time_utc.astimezone(IST).replace(tzinfo=None)
            
            if now < start_time:
                # Too early - cannot access yet
                start_time_formatted = start_time.strftime('%Y-%m-%d %H:%M:%S IST')
                return error_response(
                    f"You cannot access this assessment yet. The assessment will start at {start_time_formatted}.",
                    status_code=403
                )
            
            # Check if assessment time has ended (for strict mode)
            if end_time_str:
                end_time_str_clean = end_time_str.replace('Z', '+00:00') if 'Z' in end_time_str else end_time_str
                if '+' not in end_time_str_clean and '-' not in end_time_str_clean[10:]:
                    end_time_str_clean = end_time_str_clean + '+00:00'
                
                end_time_utc = datetime.fromisoformat(end_time_str_clean)
                if end_time_utc.tzinfo is None:
                    end_time_utc = end_time_utc.replace(tzinfo=timezone.utc)
                end_time = end_time_utc.astimezone(IST).replace(tzinfo=None)
                
                if now > end_time:
                    # After scheduled end time - window has closed
                    end_time_formatted = end_time.strftime('%Y-%m-%d %H:%M:%S IST')
                    return error_response(
                        f"The assessment time has ended. The assessment was available until {end_time_formatted}. You cannot take this assessment.",
                        status_code=403
                    )
        elif exam_mode == "flexible":
            # Flexible mode: Check schedule window (start time to end time)
            if not start_time_str:
                return error_response("Assessment schedule is not properly configured", status_code=400)
            
            # Times are stored in UTC, convert to IST for comparison
            start_time_str_clean = start_time_str.replace('Z', '+00:00') if 'Z' in start_time_str else start_time_str
            if '+' not in start_time_str_clean and '-' not in start_time_str_clean[10:]:
                start_time_str_clean = start_time_str_clean + '+00:00'
            
            start_time_utc = datetime.fromisoformat(start_time_str_clean)
            if start_time_utc.tzinfo is None:
                start_time_utc = start_time_utc.replace(tzinfo=timezone.utc)
            start_time = start_time_utc.astimezone(IST).replace(tzinfo=None)
            
            if now < start_time:
                # Before scheduled start time - cannot access yet
                start_time_formatted = start_time.strftime('%Y-%m-%d %H:%M:%S IST')
                return error_response(
                    f"You cannot access this assessment yet. The assessment window will be available from {start_time_formatted}.",
                    status_code=403
                )
            
            if end_time_str:
                end_time_str_clean = end_time_str.replace('Z', '+00:00') if 'Z' in end_time_str else end_time_str
                if '+' not in end_time_str_clean and '-' not in end_time_str_clean[10:]:
                    end_time_str_clean = end_time_str_clean + '+00:00'
                
                end_time_utc = datetime.fromisoformat(end_time_str_clean)
                if end_time_utc.tzinfo is None:
                    end_time_utc = end_time_utc.replace(tzinfo=timezone.utc)
                end_time = end_time_utc.astimezone(IST).replace(tzinfo=None)
                
                if now > end_time:
                    # After scheduled end time - window has closed
                    end_time_formatted = end_time.strftime('%Y-%m-%d %H:%M:%S IST')
                    return error_response(
                        f"The assessment window has ended. The assessment was available until {end_time_formatted}. You cannot take this assessment.",
                        status_code=403
                    )
        
        access_mode = assessment.get("accessMode", "private")
        
        # For public mode, anyone with the link can access (if not already submitted)
        if access_mode == "public":
            return success_response("Access granted", {
                "verified": True,
                "accessMode": "public",
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
            return error_response("You are not authorized to access this assessment", status_code=403)
        
        return success_response("Access granted", {
            "verified": True,
            "accessMode": "private",
        })
        
    except Exception as e:
        logger.exception(f"Error verifying candidate: {e}")
        return error_response(f"Failed to verify candidate: {str(e)}", status_code=500)


@router.get("/take/{assessment_id}")
async def get_custom_mcq_assessment_for_taking(
    assessment_id: str,
    token: str = Query(..., description="Access token"),
    email: str = Query(None, description="Candidate email"),
    name: str = Query(None, description="Candidate name"),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Get assessment details for taking (candidate view)"""
    try:
        # Fetch assessment
        oid = to_object_id(assessment_id)
        assessment = await db.custom_mcq_assessments.find_one({"_id": oid})

        if not assessment:
            return error_response("Assessment not found", status_code=404)

        # Validate token
        assessment_token = assessment.get("assessmentToken")
        if not assessment_token:
            logger.error(f"Assessment {assessment_id} has no assessmentToken configured")
            return error_response("Assessment token not configured", status_code=500)
        if assessment_token != token:
            logger.warning(
                f"Token mismatch for assessment {assessment_id}. "
                f"Expected: {assessment_token[:10]}..., "
                f"Got: {token[:10] if token else 'None'}..."
            )
            return error_response("Invalid or expired assessment token. Please use the correct assessment link.", status_code=403)

        # Optional: if email/name provided, ensure candidate is allowed (same as verify endpoint)
        if email and name:
            submissions = assessment.get("submissions", {})
            candidate_key = f"{email.lower().strip()}_{name.strip().lower()}"
            existing_submission = submissions.get(candidate_key)

            # Block if already completed or in progress
            if existing_submission:
                submission_status = existing_submission.get("status")
                submitted_at = existing_submission.get("submittedAt")
                started_at = existing_submission.get("startedAt")
                score = existing_submission.get("score")

                has_completed = (
                    submission_status == "completed"
                    or submitted_at
                    or (score is not None and submitted_at)
                )
                is_in_progress = (
                    started_at
                    and not submitted_at
                    and submission_status != "completed"
                )

                if has_completed:
                    return error_response(
                        "You have already submitted this assessment. You cannot take the test again.",
                        status_code=400,
                    )
                if is_in_progress:
                    return error_response(
                        "You are already taking this assessment in another tab or browser. Please complete it there first.",
                        status_code=400,
                    )

            access_mode = assessment.get("accessMode", "private")

            if access_mode == "private":
                candidates = assessment.get("candidates", [])
                candidate_found = any(
                    c.get("email", "").lower() == email.lower()
                    and c.get("name", "").strip().lower() == name.strip().lower()
                    for c in candidates
                )
                if not candidate_found:
                    return error_response(
                        "You are not authorized to access this assessment",
                        status_code=403,
                    )

        # NEW IMPLEMENTATION: Check access based on exam mode
        from datetime import datetime, timedelta
        
        # Use IST (Indian Standard Time) for custom MCQ assessments
        IST = ZoneInfo("Asia/Kolkata")
        now = datetime.now(IST).replace(tzinfo=None)  # Make naive for comparison
        
        exam_mode = assessment.get("examMode", "strict")
        schedule = assessment.get("schedule") or {}
        start_time_str = schedule.get("startTime") if isinstance(schedule, dict) else None
        end_time_str = schedule.get("endTime") if isinstance(schedule, dict) else None
        duration = schedule.get("duration") if isinstance(schedule, dict) else None
        
        can_access = False
        can_start = False
        waiting_for_start = False
        exam_started = False
        time_remaining = None
        error_message = None
        
        if exam_mode == "strict":
            if not start_time_str or duration is None:
                return error_response("Assessment schedule is not properly configured", status_code=400)
            
            # Ensure duration is a valid integer
            try:
                duration_int = int(duration) if duration else None
            except (ValueError, TypeError):
                return error_response("Invalid duration value", status_code=400)
            
            if duration_int is None or duration_int <= 0:
                return error_response("Duration must be a positive number", status_code=400)
            
            # Times are stored in UTC, convert to IST for comparison
            start_time_str_clean = start_time_str.replace('Z', '+00:00') if 'Z' in start_time_str else start_time_str
            if '+' not in start_time_str_clean and '-' not in start_time_str_clean[10:]:
                start_time_str_clean = start_time_str_clean + '+00:00'
            
            start_time_utc = datetime.fromisoformat(start_time_str_clean)
            if start_time_utc.tzinfo is None:
                start_time_utc = start_time_utc.replace(tzinfo=timezone.utc)
            
            # Convert UTC to IST for comparison
            start_time = start_time_utc.astimezone(IST).replace(tzinfo=None)
            end_time = start_time + timedelta(minutes=duration_int)
            
            if now < start_time:
                # Too early - cannot access yet - return error response immediately
                start_time_formatted = start_time.strftime('%Y-%m-%d %H:%M:%S IST')
                return error_response(
                    f"You cannot access this assessment yet. The assessment will start at {start_time_formatted}.",
                    status_code=403
                )
            elif start_time <= now < end_time:
                # Exam is running
                can_access = True
                can_start = True
                exam_started = True
                time_remaining = max(0, int((end_time - now).total_seconds()))
            else:
                # Exam has ended
                error_message = "The assessment has ended. You cannot take this assessment."
                can_access = False
        
        elif exam_mode == "flexible":
            if not start_time_str or not end_time_str or not duration:
                return error_response("Assessment schedule is not properly configured", status_code=400)
            
            # Times are stored in UTC, convert to IST for comparison
            start_time_str_clean = start_time_str.replace('Z', '+00:00') if 'Z' in start_time_str else start_time_str
            if '+' not in start_time_str_clean and '-' not in start_time_str_clean[10:]:
                start_time_str_clean = start_time_str_clean + '+00:00'
            
            start_time_utc = datetime.fromisoformat(start_time_str_clean)
            if start_time_utc.tzinfo is None:
                start_time_utc = start_time_utc.replace(tzinfo=timezone.utc)
            start_time = start_time_utc.astimezone(IST).replace(tzinfo=None)
            
            end_time_str_clean = end_time_str.replace('Z', '+00:00') if 'Z' in end_time_str else end_time_str
            if '+' not in end_time_str_clean and '-' not in end_time_str_clean[10:]:
                end_time_str_clean = end_time_str_clean + '+00:00'
            
            end_time_utc = datetime.fromisoformat(end_time_str_clean)
            if end_time_utc.tzinfo is None:
                end_time_utc = end_time_utc.replace(tzinfo=timezone.utc)
            end_time = end_time_utc.astimezone(IST).replace(tzinfo=None)
            
            if now < start_time:
                # Before scheduled start time - cannot access yet - return error response immediately
                start_time_formatted = start_time.strftime('%Y-%m-%d %H:%M:%S IST')
                return error_response(
                    f"You cannot access this assessment yet. The assessment window will be available from {start_time_formatted}.",
                    status_code=403
                )
            elif now > end_time:
                # After scheduled end time - window has closed - return error response immediately
                end_time_formatted = end_time.strftime('%Y-%m-%d %H:%M:%S IST')
                return error_response(
                    f"The assessment window has ended. The assessment was available until {end_time_formatted}. You cannot take this assessment.",
                    status_code=403
                )
            else:
                # Within window - auto-start assessment immediately after pre-checks
                can_access = True
                can_start = True
                exam_started = True  # Auto-start for flexible mode (no manual start button)
                time_remaining = duration * 60 if duration else None  # Timer starts with full duration
        
        # Normalize schedule structure before serialization
        # Ensure candidateRequirements is always a dict, never None
        if "schedule" in assessment:
            schedule_data = assessment.get("schedule") or {}
            if not isinstance(schedule_data, dict):
                schedule_data = {}
            # Ensure candidateRequirements exists and is a dict
            if "candidateRequirements" not in schedule_data or schedule_data.get("candidateRequirements") is None:
                schedule_data["candidateRequirements"] = {}
            assessment["schedule"] = schedule_data
        
        # Prepare candidate-facing assessment data
        assessment_serialized = serialize_document(assessment)
        if not assessment_serialized:
            return error_response("Failed to serialize assessment", status_code=500)

        # Remove internal fields not needed for candidate
        assessment_serialized.pop("submissions", None)
        assessment_serialized.pop("assessmentToken", None)
        
        # Ensure schedule.candidateRequirements is properly set after serialization too
        if "schedule" in assessment_serialized:
            schedule_serialized = assessment_serialized.get("schedule") or {}
            if not isinstance(schedule_serialized, dict):
                schedule_serialized = {}
            if "candidateRequirements" not in schedule_serialized or schedule_serialized.get("candidateRequirements") is None:
                schedule_serialized["candidateRequirements"] = {}
            assessment_serialized["schedule"] = schedule_serialized
        
        # Add access control information
        assessment_serialized["accessControl"] = {
            "canAccess": can_access,
            "canStart": can_start,
            "waitingForStart": waiting_for_start,
            "examStarted": exam_started,
            "timeRemaining": time_remaining,
            "errorMessage": error_message,
        }

        return success_response("Assessment fetched successfully", assessment_serialized)
    except Exception as exc:
        logger.exception(f"Error getting assessment for taking: {exc}")
        return error_response(f"Failed to get assessment: {str(exc)}", status_code=500)


@router.post("/submit")
async def submit_custom_mcq_assessment(
    request: SubmitCustomMCQRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Submit custom MCQ assessment answers"""
    try:
        # Fetch assessment
        oid = to_object_id(request.assessmentId)
        assessment = await db.custom_mcq_assessments.find_one({"_id": oid})

        if not assessment:
            return error_response("Assessment not found", status_code=404)

        # Validate token
        assessment_token = assessment.get("assessmentToken")
        if not assessment_token or assessment_token != request.token:
            return error_response("Invalid or expired assessment token", status_code=403)

        # Check if already submitted
        submissions = assessment.get("submissions", {})
        candidate_key = f"{request.email.lower().strip()}_{request.name.strip().lower()}"
        existing_submission = submissions.get(candidate_key)

        if existing_submission and existing_submission.get("submittedAt"):
            return error_response("You have already submitted this assessment", status_code=400)

        # Get questions
        questions = assessment.get("questions", [])
        questions_dict = {q.get("id"): q for q in questions}

        # Grade MCQ questions
        mcq_score = 0
        mcq_total = 0
        graded_submissions = []

        # Separate MCQ, subjective, and pseudocode submissions
        mcq_submissions = []
        subjective_submissions = []
        pseudocode_submissions = []

        for submission in request.submissions:
            question = questions_dict.get(submission.questionId)
            if not question:
                logger.warning(f"Question {submission.questionId} not found in assessment. Available question IDs: {list(questions_dict.keys())[:5]}")
                continue

            # Determine question type: prioritize explicit questionType, then check structure
            question_type_raw = question.get("questionType", "")
            question_type = str(question_type_raw).lower().strip() if question_type_raw else ""
            
            # Debug: Log question structure
            has_options = "options" in question
            has_correct_an = "correctAn" in question
            logger.debug(f"Question {submission.questionId}: questionType={question_type_raw}, has_options={has_options}, has_correctAn={has_correct_an}, question_keys={list(question.keys())}")
            
            # If questionType is explicitly set, use it
            if question_type in ["pseudocode", "pseudo code", "pseudocode"]:
                question_type = "pseudocode"
            elif question_type == "subjective":
                question_type = "subjective"
            elif question_type == "mcq":
                question_type = "mcq"
            # Otherwise, infer from structure
            elif has_options and has_correct_an:
                question_type = "mcq"
            else:
                # Default to subjective if no options/correctAn (subjective questions don't have these)
                question_type = "subjective"
            
            logger.info(f"Question {submission.questionId}: detected_type={question_type}, hasSelectedAnswers={bool(submission.selectedAnswers)}, hasTextAnswer={bool(submission.textAnswer)}, marks={question.get('marks', 'N/A')}")

            if question_type == "mcq" and submission.selectedAnswers:
                mcq_submissions.append({
                    "questionId": submission.questionId,
                    "question": question,
                    "selectedAnswers": submission.selectedAnswers,
                })
            elif question_type == "pseudocode":
                if submission.textAnswer:
                    question_marks = question.get("marks", 1)
                    if isinstance(question_marks, str):
                        try:
                            question_marks = int(question_marks)
                        except (ValueError, TypeError):
                            question_marks = 1
                    if question_marks < 1:
                        question_marks = 1
                    
                    logger.info(f"Adding pseudocode submission: questionId={submission.questionId}, marks={question_marks}, answer_length={len(submission.textAnswer)}")
                    pseudocode_submissions.append({
                        "questionId": submission.questionId,
                        "question": question,
                        "questionText": question.get("questionText") or question.get("question", ""),
                        "answer": submission.textAnswer,
                        "max_marks": question_marks,
                        "section": question.get("section", ""),
                        "sampleInput": question.get("sampleInput"),
                        "expectedOutput": question.get("expectedOutput"),
                        "rubric": question.get("rubric"),
                        "difficulty": question.get("difficulty", "Medium")
                    })
                else:
                    logger.warning(f"Question {submission.questionId} is pseudocode but has no textAnswer provided")
            elif question_type == "subjective":
                logger.info(f"[Subjective Evaluation] Detected subjective question: questionId={submission.questionId}, has_textAnswer={bool(submission.textAnswer)}")
                if submission.textAnswer:
                    # Get marks from question, default to 1 if not found
                    question_marks = question.get("marks", 1)
                    if isinstance(question_marks, str):
                        try:
                            question_marks = int(question_marks)
                            logger.info(f"[Subjective Evaluation] Converted question_marks from string to int: {question_marks}")
                        except (ValueError, TypeError):
                            logger.warning(f"[Subjective Evaluation] Failed to convert question_marks '{question_marks}', defaulting to 1")
                            question_marks = 1
                    if question_marks < 1:
                        logger.warning(f"[Subjective Evaluation] question_marks {question_marks} is less than 1, setting to 1")
                        question_marks = 1
                    
                    logger.info(f"[Subjective Evaluation] Adding subjective submission: questionId={submission.questionId}, marks={question_marks}, answer_length={len(submission.textAnswer)}, has_rubric={bool(question.get('rubric'))}, has_answer_key={bool(question.get('answerKey') or question.get('answer_key'))}")
                    subjective_submissions.append({
                        "questionId": submission.questionId,
                        "question": question.get("question", "") or question.get("questionText", ""),
                        "answer": submission.textAnswer,
                        "max_marks": question_marks,
                        "section": question.get("section", ""),
                        "rubric": question.get("rubric"),  # Include rubric if available
                        "answer_key": question.get("answerKey") or question.get("answer_key"),  # Include answer key if available
                        "difficulty": question.get("difficulty", "Medium"),  # Include difficulty if available
                    })
                    logger.info(f"[Subjective Evaluation] Successfully added subjective submission. Total subjective submissions: {len(subjective_submissions)}")
                else:
                    logger.warning(f"[Subjective Evaluation] Question {submission.questionId} is subjective but has no textAnswer provided")
            else:
                logger.warning(f"Question {submission.questionId}: type={question_type}, but missing required answer data (MCQ needs selectedAnswers, Subjective needs textAnswer)")

        # Grade MCQ questions
        for mcq_sub in mcq_submissions:
            question = mcq_sub["question"]
            selected = set(mcq_sub["selectedAnswers"])
            correct_ans = set([a.strip() for a in question.get("correctAn", "").split(",")])
            answer_type = question.get("answerType", "single")
            marks = question.get("marks", 1)
            mcq_total += marks

            is_correct = False
            if answer_type == "single":
                is_correct = selected == correct_ans
            elif answer_type == "multiple_all":
                is_correct = selected == correct_ans and len(selected) == len(correct_ans)
            elif answer_type == "multiple_any":
                is_correct = len(selected.intersection(correct_ans)) > 0

            if is_correct:
                mcq_score += marks

            graded_submissions.append({
                "questionId": mcq_sub["questionId"],
                "questionType": "mcq",
                "selectedAnswers": list(selected),
                "correctAnswer": question.get("correctAn", ""),
                "isCorrect": is_correct,
                "marksAwarded": marks if is_correct else 0,
                "maxMarks": marks,
            })

        # Grade subjective questions using AI
        subjective_score = 0
        subjective_total = 0
        grading_status = "completed"

        logger.info(f"[Subjective Evaluation] Starting grading process")
        logger.info(f"[Subjective Evaluation] Submission counts - MCQ: {len(mcq_submissions)}, Subjective: {len(subjective_submissions)}, Pseudocode: {len(pseudocode_submissions)}")
        
        if subjective_submissions:
            try:
                logger.info(f"[Subjective Evaluation] Found {len(subjective_submissions)} subjective questions to grade")
                logger.info(f"[Subjective Evaluation] Subjective submissions details:")
                for idx, sub in enumerate(subjective_submissions):
                    logger.info(f"[Subjective Evaluation]   [{idx+1}] questionId={sub.get('questionId')}, max_marks={sub.get('max_marks')}, answer_length={len(sub.get('answer', ''))}, has_rubric={bool(sub.get('rubric'))}, has_answer_key={bool(sub.get('answer_key'))}")
                
                grading_status = "grading"
                logger.info(f"[Subjective Evaluation] Calling grade_multiple_subjective_answers with {len(subjective_submissions)} submissions")
                ai_results = await grade_multiple_subjective_answers(subjective_submissions)
                logger.info(f"[Subjective Evaluation] AI grading function returned {len(ai_results)} results")
                
                if not ai_results:
                    logger.error(f"[Subjective Evaluation] CRITICAL: grade_multiple_subjective_answers returned empty list!")
                else:
                    logger.info(f"[Subjective Evaluation] AI results breakdown:")
                    for idx, result in enumerate(ai_results):
                        logger.info(f"[Subjective Evaluation]   [{idx+1}] questionId={result.get('questionId')}, score={result.get('score', 0)}, max_marks={result.get('max_marks', 'N/A')}, has_feedback={bool(result.get('feedback'))}")

                logger.info(f"[Subjective Evaluation] Processing {len(ai_results)} AI grading results...")
                for idx, result in enumerate(ai_results):
                    logger.info(f"[Subjective Evaluation] Processing result {idx+1}/{len(ai_results)}")
                    question_id = result.get("questionId")
                    if not question_id:
                        logger.error(f"[Subjective Evaluation] CRITICAL: AI result missing questionId. Result keys: {list(result.keys())}")
                        continue
                    
                    logger.info(f"[Subjective Evaluation] Processing questionId={question_id}")
                    score = float(result.get("score", 0))
                    logger.info(f"[Subjective Evaluation] Extracted score={score} for questionId={question_id}")
                    
                    # Get max_marks from the original submission
                    submission_item = next(
                        (s for s in subjective_submissions if s["questionId"] == question_id),
                        None
                    )
                    if not submission_item:
                        logger.error(f"[Subjective Evaluation] CRITICAL: Could not find submission for questionId={question_id}. Available IDs: {[s.get('questionId') for s in subjective_submissions]}")
                        continue
                    
                    logger.info(f"[Subjective Evaluation] Found submission item for questionId={question_id}")
                    max_marks = submission_item.get("max_marks", 1)
                    logger.info(f"[Subjective Evaluation] Original max_marks from submission: {max_marks} (type: {type(max_marks).__name__})")
                    
                    # Ensure max_marks is an integer
                    if isinstance(max_marks, str):
                        try:
                            max_marks = int(float(max_marks))
                            logger.info(f"[Subjective Evaluation] Converted max_marks from string to int: {max_marks}")
                        except (ValueError, TypeError):
                            logger.warning(f"[Subjective Evaluation] Failed to convert max_marks string '{max_marks}', defaulting to 1")
                            max_marks = 1
                    elif isinstance(max_marks, float):
                        max_marks = int(max_marks)
                        logger.info(f"[Subjective Evaluation] Converted max_marks from float to int: {max_marks}")
                    else:
                        max_marks = int(max_marks) if max_marks else 1
                        logger.info(f"[Subjective Evaluation] Using max_marks as int: {max_marks}")
                    
                    if max_marks < 1:
                        logger.warning(f"[Subjective Evaluation] max_marks {max_marks} is less than 1, setting to 1")
                        max_marks = 1
                    
                    subjective_total += max_marks
                    subjective_score += score
                    
                    logger.info(f"[Subjective Evaluation] Question {question_id}: scored {score}/{max_marks}. Running totals: score={subjective_score}, total={subjective_total}")

                    # Handle enhanced evaluation response structure
                    feedback_text = result.get("feedback", "")
                    if isinstance(feedback_text, dict):
                        feedback_text = feedback_text.get("summary", "")
                    
                    graded_submission = {
                        "questionId": question_id,
                        "questionType": "subjective",
                        "textAnswer": submission_item.get("answer", ""),
                        "marksAwarded": round(score, 2),
                        "maxMarks": max_marks,
                        "feedback": feedback_text,
                        "reasoning": result.get("reasoning", ""),
                    }
                    
                    # Add enhanced evaluation fields if available
                    if "criteria_scores" in result:
                        graded_submission["criteriaScores"] = result["criteria_scores"]
                    if "completeness_check" in result:
                        graded_submission["completenessCheck"] = result["completeness_check"]
                    if "detailed_feedback" in result:
                        graded_submission["detailedFeedback"] = result["detailed_feedback"]
                    if "flags" in result:
                        graded_submission["evaluationFlags"] = result["flags"]
                        # Log if human review is needed
                        if result["flags"].get("requires_human_review", False):
                            logger.warning(f"Question {question_id} flagged for human review")
                    
                    graded_submissions.append(graded_submission)
                    logger.info(f"[Subjective Evaluation] Added graded submission for questionId={question_id} to graded_submissions list")
                
                logger.info(f"[Subjective Evaluation] Completed processing all subjective results. Final totals: score={subjective_score}, total={subjective_total}, graded_count={len([s for s in graded_submissions if s.get('questionType') == 'subjective'])}")
                grading_status = "completed"
            except Exception as e:
                logger.exception(f"Error during AI grading: {e}")
                grading_status = "error"
                # Still save submissions but with 0 marks for subjective
                for sub in subjective_submissions:
                    max_marks = sub["max_marks"]
                    subjective_total += max_marks
                    graded_submissions.append({
                        "questionId": sub["questionId"],
                        "questionType": "subjective",
                        "textAnswer": sub["answer"],
                        "marksAwarded": 0,
                        "maxMarks": max_marks,
                        "feedback": "Error during AI grading. Please contact administrator.",
                        "reasoning": "",
                    })

        # Grade pseudocode questions using AI
        pseudocode_score = 0
        pseudocode_total = 0

        if pseudocode_submissions:
            try:
                logger.info(f"Starting AI grading for {len(pseudocode_submissions)} pseudocode questions")
                for sub in pseudocode_submissions:
                    try:
                        evaluation = await evaluate_pseudocode_answer(
                            question_id=sub["questionId"],
                            question_text=sub["questionText"],
                            candidate_answer=sub["answer"],
                            max_marks=sub["max_marks"],
                            section=sub.get("section"),
                            sample_input=sub.get("sampleInput"),
                            expected_output=sub.get("expectedOutput"),
                            rubric=sub.get("rubric"),
                            difficulty=sub.get("difficulty", "Medium")
                        )
                        
                        score = float(evaluation.get("score", 0))
                        max_marks = sub["max_marks"]
                        pseudocode_total += max_marks
                        pseudocode_score += score
                        
                        logger.info(f"Pseudocode question {sub['questionId']}: scored {score}/{max_marks}")
                        
                        graded_submissions.append({
                            "questionId": sub["questionId"],
                            "questionType": "pseudocode",
                            "textAnswer": sub["answer"],
                            "marksAwarded": round(score, 2),
                            "maxMarks": max_marks,
                            "feedback": evaluation.get("feedback", {}).get("summary", ""),
                            "detailed_feedback": evaluation.get("feedback", {}),
                            "reasoning": evaluation.get("answer_log", {}).get("partial_credit_reasoning", ""),
                            "ai_evaluation": evaluation
                        })
                    except Exception as e:
                        logger.exception(f"Error evaluating pseudocode question {sub['questionId']}: {e}")
                        max_marks = sub["max_marks"]
                        pseudocode_total += max_marks
                        graded_submissions.append({
                            "questionId": sub["questionId"],
                            "questionType": "pseudocode",
                            "textAnswer": sub["answer"],
                            "marksAwarded": 0,
                            "maxMarks": max_marks,
                            "feedback": f"Error during AI evaluation: {str(e)}",
                            "detailed_feedback": {},
                            "reasoning": "",
                            "ai_evaluation": None
                        })
            except Exception as e:
                logger.exception(f"Error during pseudocode AI grading: {e}")
                for sub in pseudocode_submissions:
                    max_marks = sub["max_marks"]
                    pseudocode_total += max_marks
                    graded_submissions.append({
                        "questionId": sub["questionId"],
                        "questionType": "pseudocode",
                        "textAnswer": sub["answer"],
                        "marksAwarded": 0,
                        "maxMarks": max_marks,
                        "feedback": "Error during AI grading. Please contact administrator.",
                        "detailed_feedback": {},
                        "reasoning": "",
                        "ai_evaluation": None
                    })

        # Calculate totals - also count unanswered questions in total marks
        # Get all questions to calculate proper totals
        all_mcq_questions = [q for q in questions if q.get("questionType", "").lower() == "mcq" or ("options" in q and "correctAn" in q)]
        all_subjective_questions = [q for q in questions if q.get("questionType", "").lower() == "subjective" and not ("options" in q and "correctAn" in q)]
        all_pseudocode_questions = [q for q in questions if q.get("questionType", "").lower() in ["pseudocode", "pseudo code"]]
        
        # Calculate actual totals including unanswered questions
        actual_mcq_total = sum(q.get("marks", 1) for q in all_mcq_questions)
        actual_subjective_total = sum(q.get("marks", 1) for q in all_subjective_questions)
        actual_pseudocode_total = sum(q.get("marks", 1) for q in all_pseudocode_questions)
        
        # Use actual totals if they differ from what we calculated
        if actual_mcq_total > mcq_total:
            logger.warning(f"MCQ total mismatch: calculated={mcq_total}, actual={actual_mcq_total}")
            mcq_total = actual_mcq_total
        if actual_subjective_total > subjective_total:
            logger.info(f"Subjective total includes unanswered questions: calculated={subjective_total}, actual={actual_subjective_total}")
            subjective_total = actual_subjective_total
        if actual_pseudocode_total > pseudocode_total:
            logger.info(f"Pseudocode total includes unanswered questions: calculated={pseudocode_total}, actual={actual_pseudocode_total}")
            pseudocode_total = actual_pseudocode_total
        
        # Calculate totals
        total_score = mcq_score + subjective_score + pseudocode_score
        total_marks = mcq_total + subjective_total + pseudocode_total
        percentage = (total_score / total_marks * 100) if total_marks > 0 else 0
        pass_percentage = assessment.get("passPercentage", 50)
        passed = percentage >= pass_percentage
        
        logger.info(f"Final scores: MCQ={mcq_score}/{mcq_total}, Subjective={subjective_score}/{subjective_total}, Pseudocode={pseudocode_score}/{pseudocode_total}, Total={total_score}/{total_marks}, Percentage={percentage:.2f}%")

        # Get existing submission data to preserve answerLogs
        existing_submission = submissions.get(candidate_key, {})
        existing_answer_logs = existing_submission.get("answerLogs", {})
        existing_candidate_info = existing_submission.get("candidateInfo", {})
        
        # Merge candidate requirements from request with existing candidateInfo (resume, phone, LinkedIn, GitHub)
        # This ensures resume and other info saved earlier are included in candidateRequirements
        candidate_requirements = request.candidateRequirements.copy() if request.candidateRequirements else {}
        
        # Merge resume from candidateInfo if it exists and wasn't already in candidateRequirements
        if existing_candidate_info.get("resume") and "resume" not in candidate_requirements:
            candidate_requirements["resume"] = existing_candidate_info.get("resume")
            candidate_requirements["hasResume"] = existing_candidate_info.get("hasResume", False)
        
        # Merge phone, LinkedIn, GitHub from candidateInfo if they exist and weren't already in candidateRequirements
        if existing_candidate_info.get("phone") and "phone" not in candidate_requirements:
            candidate_requirements["phone"] = existing_candidate_info.get("phone")
        if existing_candidate_info.get("linkedIn") and "linkedIn" not in candidate_requirements:
            candidate_requirements["linkedIn"] = existing_candidate_info.get("linkedIn")
        if existing_candidate_info.get("github") and "github" not in candidate_requirements:
            candidate_requirements["github"] = existing_candidate_info.get("github")
        
        # Log candidate requirements received
        logger.info(f"Received candidate requirements for {candidate_key}: {request.candidateRequirements}")
        logger.info(f"Merged candidate requirements (including resume) for {candidate_key}: {candidate_requirements}")
        
        # Prepare candidateInfo - preserve existing data (resume, phone, LinkedIn, GitHub) and update name/email
        candidate_info = existing_candidate_info.copy() if existing_candidate_info else {}
        candidate_info.update({
            "name": request.name,
            "email": request.email,
        })
        
        # Save submission
        submission_data = {
            "candidateInfo": candidate_info,  # Preserve existing candidateInfo including resume
            "submissions": graded_submissions,
            "score": total_score,
            "totalMarks": total_marks,
            "percentage": round(percentage, 2),
            "passed": passed,
            "status": "completed" if grading_status == "completed" else "grading",
            "gradingStatus": grading_status,
            "startedAt": request.startedAt.isoformat() if request.startedAt else _now_utc().isoformat(),
            "submittedAt": request.submittedAt.isoformat() if request.submittedAt else _now_utc().isoformat(),
            "mcqScore": mcq_score,
            "mcqTotal": mcq_total,
            "subjectiveScore": subjective_score,
            "subjectiveTotal": subjective_total,
            "answerLogs": existing_answer_logs,  # Preserve answer logs from previous saves
            "candidateRequirements": candidate_requirements,  # Store merged candidate requirements (including resume)
        }
        
        logger.info(f"Storing candidate requirements in submission: {submission_data.get('candidateRequirements')}")

        submissions[candidate_key] = submission_data

        await db.custom_mcq_assessments.update_one(
            {"_id": oid},
            {"$set": {"submissions": submissions, "updated_at": _now_utc()}}
        )

        return success_response(
            "Assessment submitted successfully",
            {
                "score": total_score,
                "totalMarks": total_marks,
                "percentage": round(percentage, 2),
                "passed": passed,
                "gradingStatus": grading_status,
                "mcqScore": mcq_score,
                "mcqTotal": mcq_total,
                "subjectiveScore": subjective_score,
                "subjectiveTotal": subjective_total,
                "showResultToCandidate": assessment.get("showResultToCandidate", True),
            }
        )

    except Exception as e:
        logger.exception(f"Error submitting assessment: {e}")
        return error_response(f"Failed to submit assessment: {str(e)}", status_code=500)


@router.post("/send-invitations")
async def send_custom_mcq_invitations(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Send email invitations to candidates for custom MCQ assessment"""
    try:
        from ....utils.email import get_email_service
        from ....config.settings import get_settings
        
        assessment_id = payload.get("assessmentId")
        if not assessment_id:
            return error_response("Assessment ID is required", status_code=400)
        
        # Get assessment and check access
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            return error_response("User ID not found", status_code=401)
        user_id = str(user_id)
        assessment_oid = to_object_id(assessment_id)
        
        assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_oid})
        if not assessment:
            return error_response("Assessment not found", status_code=404)
        
        # Check ownership
        if str(assessment["created_by"]) != user_id:
            return error_response("Access denied", status_code=403)
        
        candidates = payload.get("candidates", [])
        assessment_url = payload.get("assessmentUrl", "")
        template = payload.get("template", {})
        
        if not candidates or not assessment_url:
            return error_response("Candidates and assessment URL are required", status_code=400)
        
        # Get template values
        subject_template = template.get("subject", "")
        message_template = template.get("message", "You have been invited to take an assessment. Please click the link below to start.")
        footer = template.get("footer", "")
        sent_by = template.get("sentBy", "AI Assessment Platform")
        
        # Get email service and verify it's configured
        settings = get_settings()
        if not settings.sendgrid_api_key or not settings.sendgrid_from_email:
            return error_response(
                "SendGrid is not configured. Please set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL environment variables.",
                status_code=500
            )
        
        email_service = get_email_service()
        
        sent_count = 0
        failed_emails = []
        error_messages = []
        skipped_emails = []
        
        # Get existing candidates from assessment to check invite status
        existing_candidates = assessment.get("candidates", [])
        existing_candidates_dict = {
            c.get("email", "").strip().lower(): c 
            for c in existing_candidates 
            if c.get("email")
        }
        
        for candidate in candidates:
            email = candidate.get("email", "").strip().lower()
            name = candidate.get("name", "").strip()
            
            if not email or not name:
                failed_emails.append(email or "unknown")
                error_messages.append(f"Invalid candidate data: email={email}, name={name}")
                continue
            
            # Check if candidate has already been invited (unless forceResend is true)
            force_resend = payload.get("forceResend", False)
            existing_candidate = existing_candidates_dict.get(email)
            if existing_candidate and existing_candidate.get("invited") and not force_resend:
                skipped_emails.append(email)
                logger.info(f"Skipping invitation to {email} - already invited")
                continue
            
            # Use assessment URL without email and name parameters
            # Replace placeholders in message
            email_body = message_template
            email_body = email_body.replace("{{candidate_name}}", name)
            email_body = email_body.replace("{{candidate_email}}", email)
            email_body = email_body.replace("{{exam_url}}", assessment_url)
            email_body = email_body.replace("{{assessment_url}}", assessment_url)
            
            # Build HTML email
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ text-align: center; margin-bottom: 30px; }}
                    .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
                    .button {{ display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                    .footer {{ text-align: center; color: #64748b; font-size: 0.875rem; margin-top: 30px; }}
                    .candidate-info {{ background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #3b82f6; }}
                    .candidate-info p {{ margin: 5px 0; }}
                    .candidate-info strong {{ color: #1e293b; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Assessment Invitation</h1>
                    </div>
                    <div class="content">
                        <p>Dear {name},</p>
                        <p>{email_body}</p>
                        
                        <div class="candidate-info">
                            <p><strong>Your Details:</strong></p>
                            <p><strong>Name:</strong> {name}</p>
                            <p><strong>Email:</strong> {email}</p>
                            <p style="font-size: 0.875rem; color: #64748b; margin-top: 10px;">
                                These details will be auto-filled when you start the assessment.
                            </p>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="{assessment_url}" class="button">Start Assessment</a>
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
            
            subject = subject_template or f"Assessment Invitation - {assessment.get('title', 'AI Assessment Platform')}"
            
            try:
                logger.info(f"Attempting to send invitation email to {email}")
                await email_service.send_email(email, subject, html_content)
                logger.info(f"Email sent successfully to {email}")
                sent_count += 1
                
                # Update candidate invite status in assessment
                candidates_list = assessment.get("candidates", [])
                candidate_updated = False
                for idx, c in enumerate(candidates_list):
                    if c.get("email", "").lower() == email:
                        candidates_list[idx]["invited"] = True
                        candidates_list[idx]["inviteSentAt"] = _now_utc().isoformat()
                        candidate_updated = True
                        break
                
                # If candidate not in list, add them
                if not candidate_updated:
                    candidates_list.append({
                        "name": name,
                        "email": email,
                        "invited": True,
                        "inviteSentAt": _now_utc().isoformat()
                    })
                
                assessment["candidates"] = candidates_list
                await db.custom_mcq_assessments.update_one(
                    {"_id": assessment_oid},
                    {"$set": {"candidates": candidates_list, "updated_at": _now_utc()}}
                )
                
            except Exception as exc:
                error_msg = f"Failed to send invitation to {email}: {str(exc)}"
                logger.error(error_msg, exc_info=True)
                failed_emails.append(email)
                error_messages.append(error_msg)
        
        # Build response message
        message = f"Invitations sent to {sent_count} candidate(s)"
        if len(skipped_emails) > 0:
            message += f". {len(skipped_emails)} already invited (skipped): {', '.join(skipped_emails[:5])}"
        if len(failed_emails) > 0:
            message += f". {len(failed_emails)} failed: {', '.join(failed_emails[:5])}"
        
        return success_response(
            message,
            {
                "sentCount": sent_count,
                "failedCount": len(failed_emails),
                "skippedCount": len(skipped_emails),
                "failedEmails": failed_emails,
                "skippedEmails": skipped_emails,
                "errorMessages": error_messages,
            }
        )
        
    except Exception as e:
        logger.exception(f"Error sending invitations: {e}")
        return error_response(f"Failed to send invitations: {str(e)}", status_code=500)


@router.post("/save-answer-log")
async def save_answer_log(
    request: SaveAnswerLogRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """Save answer change log for subjective questions"""
    try:
        assessment_id = request.assessmentId
        oid = to_object_id(assessment_id)
        if not oid:
            return error_response("Invalid assessment ID", status_code=400)
        
        # Get assessment
        assessment = await db.custom_mcq_assessments.find_one({"_id": oid})
        if not assessment:
            return error_response("Assessment not found", status_code=404)
        
        # Verify token
        assessment_token = assessment.get("assessmentToken")
        if not assessment_token or assessment_token != request.token:
            return error_response("Invalid or expired assessment token", status_code=403)
        
        # Get candidate key
        candidate_key = f"{request.email.lower().strip()}_{request.name.strip().lower()}"
        
        # Get or create submission entry
        submissions = assessment.get("submissions", {})
        submission_data = submissions.get(candidate_key, {})
        
        # Initialize answerLogs if not exists
        if "answerLogs" not in submission_data:
            submission_data["answerLogs"] = {}
        
        answer_logs = submission_data["answerLogs"]
        
        # Initialize logs for this question if not exists
        if request.questionId not in answer_logs:
            answer_logs[request.questionId] = []
        
        question_logs = answer_logs[request.questionId]
        
        # Check if this answer is different from the last log entry
        should_save = True
        if question_logs:
            last_log = question_logs[-1]
            if last_log.get("answer", "").strip() == request.answer.strip():
                # Same answer, don't save duplicate
                should_save = False
        
        if should_save:
            # Add new log entry
            log_entry = {
                "answer": request.answer,
                "timestamp": request.timestamp.isoformat() if request.timestamp else _now_utc().isoformat(),
            }
            question_logs.append(log_entry)
            
            # Update submission data
            submission_data["answerLogs"] = answer_logs
            submissions[candidate_key] = submission_data
            
            # Save to database
            await db.custom_mcq_assessments.update_one(
                {"_id": oid},
                {"$set": {"submissions": submissions, "updated_at": _now_utc()}}
            )
            
            logger.info(f"Saved answer log for question {request.questionId}, candidate {candidate_key}")
            return success_response("Answer log saved successfully", {"saved": True})
        else:
            logger.debug(f"Skipping duplicate answer log for question {request.questionId}")
            return success_response("Answer unchanged, log not saved", {"saved": False})
        
    except Exception as e:
        logger.exception(f"Error saving answer log: {e}")
        return error_response(f"Failed to save answer log: {str(e)}", status_code=500)


@router.post("/{assessment_id}/pause")
async def pause_custom_mcq_assessment(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Pause an active custom MCQ assessment.
    Sets status to "paused" and records pausedAt timestamp.
    Does not affect candidates who have already started.
    """
    try:
        assessment_oid = to_object_id(assessment_id)
        if not assessment_oid:
            return error_response("Invalid assessment ID", status_code=400)
        
        # Get assessment
        assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_oid})
        if not assessment:
            return error_response("Assessment not found", status_code=404)
        
        # Check access
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            return error_response("User ID not found", status_code=401)
        user_id = str(user_id)
        
        if str(assessment.get("created_by")) != user_id:
            return error_response("Access denied", status_code=403)
        
        current_status = assessment.get("status")
        if current_status == "paused":
            # Idempotent: already paused
            return success_response(
                "Assessment is already paused",
                {"assessment": serialize_document(assessment)}
            )
        
        if current_status not in ["active", "scheduled"]:
            return error_response(
                f"Cannot pause assessment with status '{current_status}'. Only 'active' or 'scheduled' assessments can be paused.",
                status_code=400
            )
        
        now = _now_utc()
        
        # Store previous status for resume
        status_before_pause = current_status
        
        # Atomic update
        result = await db.custom_mcq_assessments.update_one(
            {"_id": assessment_oid},
            {
                "$set": {
                    "status": "paused",
                    "statusBeforePause": status_before_pause,
                    "pausedAt": now,
                    "updated_at": now,
                }
            }
        )
        
        if result.modified_count == 0:
            return error_response("Assessment not found or not modified", status_code=404)
        
        # Fetch updated assessment
        updated_assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_oid})
        
        return success_response(
            "Assessment paused successfully",
            {"assessment": serialize_document(updated_assessment)}
        )
        
    except Exception as exc:
        logger.error(f"Error pausing custom MCQ assessment: {exc}", exc_info=True)
        return error_response(f"Failed to pause assessment: {str(exc)}", status_code=500)


@router.post("/{assessment_id}/resume")
async def resume_custom_mcq_assessment(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Resume a paused custom MCQ assessment.
    Sets status back to previous status (usually "active") and records resumeAt timestamp.
    """
    try:
        assessment_oid = to_object_id(assessment_id)
        if not assessment_oid:
            return error_response("Invalid assessment ID", status_code=400)
        
        # Get assessment
        assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_oid})
        if not assessment:
            return error_response("Assessment not found", status_code=404)
        
        # Check access
        user_id = current_user.get("id") or current_user.get("_id")
        if not user_id:
            return error_response("User ID not found", status_code=401)
        user_id = str(user_id)
        
        if str(assessment.get("created_by")) != user_id:
            return error_response("Access denied", status_code=403)
        
        current_status = assessment.get("status")
        if current_status != "paused":
            if current_status == "active":
                # Idempotent: already active
                return success_response(
                    "Assessment is already active",
                    {"assessment": serialize_document(assessment)}
                )
            return error_response(
                f"Cannot resume assessment with status '{current_status}'. Only 'paused' assessments can be resumed.",
                status_code=400
            )
        
        now = _now_utc()
        previous_status = assessment.get("statusBeforePause", "active")  # Default to active if not set
        
        # Atomic update
        result = await db.custom_mcq_assessments.update_one(
            {"_id": assessment_oid},
            {
                "$set": {
                    "status": previous_status,
                    "resumeAt": now,
                    "updated_at": now,
                },
                "$unset": {
                    "pausedAt": "",
                    "statusBeforePause": "",
                }
            }
        )
        
        if result.modified_count == 0:
            return error_response("Assessment not found or not modified", status_code=404)
        
        # Fetch updated assessment
        updated_assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_oid})
        
        return success_response(
            "Assessment resumed successfully",
            {"assessment": serialize_document(updated_assessment)}
        )
        
    except Exception as exc:
        logger.error(f"Error resuming custom MCQ assessment: {exc}", exc_info=True)
        return error_response(f"Failed to resume assessment: {str(exc)}", status_code=500)


@router.post("/{assessment_id}/save-candidate-info")
async def save_custom_mcq_candidate_info(
    assessment_id: str,
    request: Dict[str, Any] = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    """
    Save candidate information for Custom MCQ assessments (phone, LinkedIn, GitHub, resume).
    This is called from the candidate requirements page.
    """
    try:
        from datetime import datetime, timezone
        
        assessment_oid = to_object_id(assessment_id)
        if not assessment_oid:
            return error_response("Invalid assessment ID", status_code=400)
        
        # Get assessment
        assessment = await db.custom_mcq_assessments.find_one({"_id": assessment_oid})
        if not assessment:
            return error_response("Assessment not found", status_code=404)
        
        email = request.get("email", "").strip().lower()
        name = request.get("name", "").strip()
        token = request.get("token", "").strip()
        phone = request.get("phone", "").strip() if request.get("phone") else None
        hasResume = request.get("hasResume", False)
        resume = request.get("resume")  # Base64 encoded resume
        linkedIn = request.get("linkedIn", "").strip() if request.get("linkedIn") else None
        github = request.get("github", "").strip() if request.get("github") else None
        
        if not email or not name:
            return error_response("Email and name are required", status_code=400)
        
        # Verify token
        assessment_token = assessment.get("assessmentToken")
        if not assessment_token or assessment_token != token:
            return error_response("Invalid assessment token", status_code=403)
        
        # Create candidate key (same format as used in submissions)
        candidate_key = f"{email}_{name.strip().lower()}"
        
        # Get existing submissions
        submissions = assessment.get("submissions", {})
        existing_submission = submissions.get(candidate_key, {})
        
        # Prepare candidate info to store in submission
        candidate_info = {
            "email": email,
            "name": name,
            "phone": phone,
            "hasResume": hasResume,
            "savedAt": datetime.now(timezone.utc).isoformat(),
        }
        
        # Store resume if provided
        if resume:
            candidate_info["resume"] = resume
        elif hasResume and existing_submission.get("candidateInfo", {}).get("resume"):
            # Preserve existing resume if hasResume is True but no new resume provided
            candidate_info["resume"] = existing_submission.get("candidateInfo", {}).get("resume")
        
        if linkedIn:
            candidate_info["linkedIn"] = linkedIn
        elif existing_submission.get("candidateInfo", {}).get("linkedIn"):
            candidate_info["linkedIn"] = existing_submission.get("candidateInfo", {}).get("linkedIn")
        
        if github:
            candidate_info["github"] = github
        elif existing_submission.get("candidateInfo", {}).get("github"):
            candidate_info["github"] = existing_submission.get("candidateInfo", {}).get("github")
        
        # Update or create submission entry with candidate info
        # This allows us to store candidate requirements before they submit the assessment
        now = _now_utc()
        
        # If this is a new submission entry, initialize it
        if candidate_key not in submissions:
            update_doc = {
                f"submissions.{candidate_key}": {
                    "candidateInfo": candidate_info,
                    "status": "in_progress",
                    "startedAt": None,
                    "submittedAt": None,
                    "score": None,
                    "submissions": [],
                },
                "updated_at": now,
            }
        else:
            # If submission already exists, only update the candidateInfo field
            update_doc = {
                f"submissions.{candidate_key}.candidateInfo": candidate_info,
                "updated_at": now,
            }
        
        result = await db.custom_mcq_assessments.update_one(
            {"_id": assessment_oid},
            {"$set": update_doc}
        )
        
        return success_response(
            "Candidate information saved successfully",
            {"candidateInfo": candidate_info}
        )
        
    except Exception as exc:
        logger.exception(f"Error saving custom MCQ candidate info: {exc}")
        return error_response(f"Failed to save candidate information: {str(exc)}", status_code=500)