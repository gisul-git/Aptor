"""
Design Service API Endpoints
Complete API for AI Design Question Generator + Penpot Integration
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import datetime

from app.models.design import (
    DesignQuestionModel,
    PenpotSessionModel,
    DesignSubmissionModel,
    DesignRole,
    DifficultyLevel,
    TaskType
)
from app.services.ai_question_generator import ai_question_generator
from app.services.penpot_rpc import penpot_rpc_service as penpot_service
# Evaluation engine temporarily disabled
# from app.services.evaluation_engine import evaluation_engine
from app.repositories.design_repository import design_repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/design", tags=["Design Assessment"])


# Request/Response Models
class GenerateQuestionRequest(BaseModel):
    role: DesignRole
    difficulty: DifficultyLevel
    task_type: TaskType
    topic: Optional[str] = None
    created_by: str = "system"


class CreateSessionRequest(BaseModel):
    user_id: str
    assessment_id: str
    question_id: str


class SubmitDesignRequest(BaseModel):
    session_id: str
    user_id: str
    question_id: str
    file_id: Optional[str] = None
    time_taken: Optional[int] = None
    events: Optional[List[Dict[str, Any]]] = []


class ScreenshotRequest(BaseModel):
    session_id: str
    timestamp: str
    image_data: str


class EventRequest(BaseModel):
    session_id: str
    type: str
    timestamp: str
    x: Optional[int] = None
    y: Optional[int] = None
    target: Optional[str] = None
    idle_seconds: Optional[int] = None


class EvaluationResponse(BaseModel):
    submission_id: str
    rule_based_score: float
    ai_based_score: float
    final_score: float
    feedback: Dict[str, Any]


# AI Question Generation Endpoints
@router.post("/questions/generate", response_model=DesignQuestionModel)
async def generate_question(request: GenerateQuestionRequest):
    """Generate AI-powered design question"""
    try:
        # Initialize repository if needed
        try:
            if design_repository.db is None:
                await design_repository.initialize()
        except Exception as e:
            logger.warning(f"Database not available: {e}")
        
        # Generate question using AI
        question = await ai_question_generator.generate_question(
            role=request.role,
            difficulty=request.difficulty,
            task_type=request.task_type,
            topic=request.topic,
            created_by=request.created_by
        )
        
        # Try to save to database
        try:
            if design_repository.db is not None:
                question_id = await design_repository.create_question(question)
                question.id = question_id
                logger.info(f"Generated and saved question: {question_id}")
            else:
                logger.warning("Database not available, returning question without saving")
        except Exception as e:
            logger.warning(f"Could not save question to database: {e}")
        
        return question
        
    except Exception as e:
        logger.error(f"Question generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/questions", response_model=List[DesignQuestionModel])
async def get_questions(
    role: Optional[DesignRole] = None,
    difficulty: Optional[DifficultyLevel] = None,
    task_type: Optional[TaskType] = None,
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0)
):
    """Get design questions with filters"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        questions = await design_repository.get_questions(
            role=role,
            difficulty=difficulty,
            task_type=task_type,
            limit=limit,
            skip=skip
        )
        
        return questions
        
    except Exception as e:
        logger.error(f"Failed to get questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/questions/{question_id}", response_model=DesignQuestionModel)
async def get_question(question_id: str):
    """Get specific design question"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        question = await design_repository.get_question(question_id)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        return question
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get question {question_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Penpot Workspace Management
@router.post("/workspace/create", response_model=Dict[str, Any])
async def create_workspace(request: CreateSessionRequest):
    """Create Penpot workspace for candidate"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        # Get question details
        question = await design_repository.get_question(request.question_id)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Create Penpot workspace
        session = await penpot_service.create_candidate_workspace(
            user_id=request.user_id,
            assessment_id=request.assessment_id,
            question_id=request.question_id,
            question_title=question.title
        )
        
        # Save session to database
        session_id = await design_repository.create_session(session)
        session.id = session_id
        
        return {
            "session_id": session_id,
            "workspace_url": session.workspace_url,
            "session_token": session.session_token,
            "file_id": session.file_id,
            "project_id": session.project_id,
            "question": question.model_dump(),
            "time_limit_minutes": question.time_limit_minutes
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create workspace: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workspace/{session_id}/status")
async def get_workspace_status(session_id: str):
    """Get workspace status and activity"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        session = await design_repository.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get workspace status from Penpot
        status = await penpot_service.get_workspace_status(session.session_token)
        
        return {
            "session_id": session_id,
            "user_id": session.user_id,
            "started_at": session.started_at,
            "ended_at": session.ended_at,
            "workspace_status": status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get workspace status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workspace/{session_id}/end")
async def end_workspace_session(session_id: str):
    """End workspace session"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        # End session in database
        success = await design_repository.end_session(session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"message": "Session ended successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to end session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Design Submission and Evaluation
@router.post("/submit", response_model=Dict[str, Any])
async def submit_design(
    request: SubmitDesignRequest,
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Submit design for evaluation"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        # Validate session
        session = await design_repository.get_session(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Export design data from Penpot
        design_data = await penpot_service.export_design_data(
            file_id=session.file_id
        )
        
        # Create submission record
        submission = DesignSubmissionModel(
            session_id=request.session_id,
            user_id=request.user_id,
            question_id=request.question_id,
            screenshot_url=f"penpot://{session.file_id}",  # Reference to Penpot file
            design_file_url=f"penpot://{session.file_id}"
        )
        
        submission_id = await design_repository.create_submission(submission)
        
        # Save events if provided
        if request.events and len(request.events) > 0:
            try:
                db = design_repository.db
                events_docs = []
                for event in request.events:
                    events_docs.append({
                        "session_id": request.session_id,
                        "type": event.get("type"),
                        "timestamp": event.get("timestamp"),
                        "x": event.get("x"),
                        "y": event.get("y"),
                        "target": event.get("target"),
                        "idle_seconds": event.get("idle_seconds"),
                        "created_at": datetime.utcnow()
                    })
                
                if events_docs:
                    await db.events.insert_many(events_docs)
                    logger.info(f"🎯 Saved {len(events_docs)} events for session {request.session_id}")
            except Exception as e:
                logger.warning(f"Could not save events: {e}")
        
        # End the session
        await design_repository.end_session(request.session_id)
        
        # Start background evaluation
        background_tasks.add_task(
            evaluate_submission_background,
            submission_id,
            design_data,
            request.question_id
        )
        
        return {
            "submission_id": submission_id,
            "message": "Design submitted successfully",
            "evaluation_status": "processing",
            "file_id": session.file_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit design: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


from app.core.evaluation_engine import DesignEvaluationEngine

# Initialize evaluation engine
evaluation_engine = DesignEvaluationEngine()


async def evaluate_submission_background(
    submission_id: str,
    design_data: Dict[str, Any],
    question_id: str
):
    """Background task for design evaluation"""
    try:
        # Get question data for evaluation context
        question = await design_repository.get_question(question_id)
        question_data = question.model_dump() if question else {}
        
        # Extract metrics from design data
        metrics = design_data.get("metrics", {})
        
        # Get submission to find session_id
        submission = await design_repository.get_submission(submission_id)
        session_id = submission.session_id if submission else None
        
        # Get latest screenshot for AI evaluation
        screenshot_base64 = None
        events_data = None
        if session_id:
            try:
                db = design_repository.db
                
                # Get latest screenshot
                latest_screenshot = await db.screenshots.find_one(
                    {"session_id": session_id},
                    sort=[("created_at", -1)]
                )
                if latest_screenshot:
                    screenshot_base64 = latest_screenshot.get("image_data")
                    logger.info("📸 Found screenshot for AI evaluation")
                
                # Get all events for interaction analysis
                events_cursor = db.events.find({"session_id": session_id})
                events_list = await events_cursor.to_list(length=None)
                
                if events_list:
                    # Calculate event statistics
                    total_clicks = sum(1 for e in events_list if e.get("type") == "click")
                    total_undo = sum(1 for e in events_list if e.get("type") == "undo")
                    total_redo = sum(1 for e in events_list if e.get("type") == "redo")
                    total_idle = sum(e.get("idle_seconds", 0) for e in events_list if e.get("type") == "idle")
                    
                    events_data = {
                        "total_events": len(events_list),
                        "total_clicks": total_clicks,
                        "total_undo": total_undo,
                        "total_redo": total_redo,
                        "total_idle_seconds": total_idle,
                        "events": events_list
                    }
                    logger.info(f"🎯 Found {len(events_list)} events for evaluation")
                    
            except Exception as e:
                logger.warning(f"Could not fetch screenshot/events: {e}")
        
        # Run comprehensive evaluation using the evaluation engine
        evaluation_result = await evaluation_engine.evaluate(
            design_data=design_data,
            question_data=question_data,
            events_data=events_data,  # Pass events for interaction quality
            screenshot_base64=screenshot_base64  # Pass screenshot for AI
        )
        
        rule_score = evaluation_result["rule_based_score"]
        ai_score = evaluation_result["ai_based_score"]
        final_score = evaluation_result["final_score"]
        feedback = evaluation_result["feedback"]
        
        # Update submission with scores
        await design_repository.update_submission_scores(
            submission_id=submission_id,
            rule_based_score=rule_score,
            ai_based_score=ai_score,
            final_score=final_score,
            feedback=feedback
        )
        
        logger.info(f"✅ Completed evaluation for submission {submission_id}: {final_score}/100")
        
    except Exception as e:
        logger.error(f"Background evaluation failed: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")


@router.post("/screenshot")
async def save_screenshot(request: ScreenshotRequest):
    """Save screenshot for evaluation (not proctoring)"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        # Calculate file size
        if request.image_data.startswith('data:image'):
            base64_data = request.image_data.split(',')[1]
            file_size = len(base64_data) * 3 / 4
        else:
            file_size = len(request.image_data) * 3 / 4
        
        # Save screenshot
        screenshot_doc = {
            "session_id": request.session_id,
            "timestamp": request.timestamp,
            "image_data": request.image_data,
            "file_size": int(file_size),
            "created_at": datetime.utcnow()
        }
        
        result = await db.screenshots.insert_one(screenshot_doc)
        
        logger.info(f"📸 Screenshot saved for evaluation: {result.inserted_id}")
        
        return {
            "id": str(result.inserted_id),
            "message": "Screenshot saved for evaluation"
        }
        
    except Exception as e:
        logger.error(f"Failed to save screenshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/event")
async def save_event(request: EventRequest):
    """Save user interaction event for evaluation"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        # Save event
        event_doc = {
            "session_id": request.session_id,
            "type": request.type,
            "timestamp": request.timestamp,
            "x": request.x,
            "y": request.y,
            "target": request.target,
            "idle_seconds": request.idle_seconds,
            "created_at": datetime.utcnow()
        }
        
        result = await db.events.insert_one(event_doc)
        
        logger.info(f"🎯 Event saved: {request.type} for session {request.session_id}")
        
        return {
            "id": str(result.inserted_id),
            "message": "Event saved"
        }
        
    except Exception as e:
        logger.error(f"Failed to save event: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/list")
async def list_sessions():
    """Get list of all sessions with screenshot and event counts"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        # Get unique session IDs from screenshots
        screenshot_sessions = await db.screenshots.aggregate([
            {"$group": {"_id": "$session_id", "count": {"$sum": 1}}}
        ]).to_list(length=None)
        
        # Get unique session IDs from events
        event_sessions = await db.events.aggregate([
            {"$group": {"_id": "$session_id", "count": {"$sum": 1}}}
        ]).to_list(length=None)
        
        # Combine sessions
        sessions_dict = {}
        for s in screenshot_sessions:
            sessions_dict[s["_id"]] = {
                "session_id": s["_id"],
                "screenshot_count": s["count"],
                "event_count": 0
            }
        
        for e in event_sessions:
            if e["_id"] in sessions_dict:
                sessions_dict[e["_id"]]["event_count"] = e["count"]
            else:
                sessions_dict[e["_id"]] = {
                    "session_id": e["_id"],
                    "screenshot_count": 0,
                    "event_count": e["count"]
                }
        
        sessions = list(sessions_dict.values())
        
        logger.info(f"📋 Found {len(sessions)} sessions")
        
        return {"sessions": sessions}
        
    except Exception as e:
        logger.error(f"Failed to list sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/screenshots")
async def get_session_screenshots(session_id: str):
    """Get all screenshots for a session"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        screenshots = await db.screenshots.find(
            {"session_id": session_id}
        ).sort("created_at", 1).to_list(length=None)
        
        # Convert ObjectId to string
        for screenshot in screenshots:
            screenshot["_id"] = str(screenshot["_id"])
        
        logger.info(f"📸 Retrieved {len(screenshots)} screenshots for session {session_id}")
        
        return {"screenshots": screenshots}
        
    except Exception as e:
        logger.error(f"Failed to get screenshots: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/events")
async def get_session_events(session_id: str):
    """Get all events for a session"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        db = design_repository.db
        
        events = await db.events.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).to_list(length=None)
        
        # Convert ObjectId to string
        for event in events:
            event["_id"] = str(event["_id"])
        
        # Calculate statistics
        total_clicks = sum(1 for e in events if e.get("type") == "click")
        total_undo = sum(1 for e in events if e.get("type") == "undo")
        total_redo = sum(1 for e in events if e.get("type") == "redo")
        total_idle_seconds = sum(e.get("idle_seconds", 0) for e in events if e.get("type") == "idle")
        
        stats = {
            "total_events": len(events),
            "total_clicks": total_clicks,
            "total_undo": total_undo,
            "total_redo": total_redo,
            "total_idle_seconds": total_idle_seconds
        }
        
        logger.info(f"🎯 Retrieved {len(events)} events for session {session_id}")
        
        return {
            "events": events,
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Failed to get events: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submissions/{submission_id}/evaluation", response_model=EvaluationResponse)
async def get_evaluation_results(submission_id: str):
    """Get evaluation results for submission"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        submission = await design_repository.get_submission(submission_id)
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        return EvaluationResponse(
            submission_id=submission_id,
            rule_based_score=submission.rule_based_score,
            ai_based_score=submission.ai_based_score,
            final_score=submission.final_score,
            feedback=submission.feedback
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get evaluation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submissions/user/{user_id}", response_model=List[DesignSubmissionModel])
async def get_user_submissions(user_id: str):
    """Get user's design submissions"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        submissions = await design_repository.get_user_submissions(user_id)
        return submissions
        
    except Exception as e:
        logger.error(f"Failed to get user submissions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Analytics Endpoints
@router.get("/analytics/question/{question_id}")
async def get_question_analytics(question_id: str):
    """Get analytics for a specific question"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        stats = await design_repository.get_question_stats(question_id)
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get question analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/user/{user_id}")
async def get_user_performance(user_id: str):
    """Get user performance analytics"""
    try:
        if design_repository.db is None:
            await design_repository.initialize()
        
        performance = await design_repository.get_user_performance(user_id)
        return performance
        
    except Exception as e:
        logger.error(f"Failed to get user performance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Health and Status
@router.get("/health")
async def health_check():
    """Service health check"""
    try:
        # Check database connection
        if design_repository.db is None:
            await design_repository.initialize()
        
        # Check AI service
        ai_status = "healthy" if ai_question_generator.provider else "unavailable"
        
        # Check Penpot service
        penpot_status = "healthy"  # Would check actual Penpot connectivity
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow(),
            "services": {
                "database": "healthy",
                "ai_service": ai_status,
                "penpot_service": penpot_status
            }
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "error": str(e)}
        )
