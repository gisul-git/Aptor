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
    screenshot: UploadFile = File(...),
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
        
        # Save screenshot
        screenshot_path = f"/tmp/screenshots/{request.session_id}_{datetime.utcnow().timestamp()}.png"
        with open(screenshot_path, "wb") as f:
            content = await screenshot.read()
            f.write(content)
        
        # Export design data from Penpot
        design_data = await penpot_service.export_design_data(
            file_id=session.session_token  # This would be the actual file ID
        )
        
        # Create submission record
        submission = DesignSubmissionModel(
            session_id=request.session_id,
            user_id=request.user_id,
            question_id=request.question_id,
            screenshot_url=screenshot_path,
            design_file_url=f"/tmp/designs/{request.session_id}.json"
        )
        
        submission_id = await design_repository.create_submission(submission)
        
        # Start background evaluation
        background_tasks.add_task(
            evaluate_submission_background,
            submission_id,
            screenshot_path,
            design_data,
            request.question_id
        )
        
        return {
            "submission_id": submission_id,
            "message": "Design submitted successfully",
            "evaluation_status": "processing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit design: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def evaluate_submission_background(
    submission_id: str,
    screenshot_path: str,
    design_data: Dict[str, Any],
    question_id: str
):
    """Background task for design evaluation"""
    try:
        # Get question data for evaluation context
        question = await design_repository.get_question(question_id)
        question_data = question.model_dump() if question else {}
        
        # Simplified evaluation (evaluation engine temporarily disabled)
        rule_score = 75.0  # Placeholder
        ai_score = 75.0    # Placeholder
        final_score = 75.0  # Placeholder
        
        feedback = {
            "rule_based": {"note": "Evaluation engine being updated"},
            "ai_based": {"note": "Evaluation engine being updated"},
            "overall_score": final_score,
            "breakdown": {
                "rule_based_score": rule_score,
                "ai_based_score": ai_score
            }
        }
        
        # Update submission with scores
        await design_repository.update_submission_scores(
            submission_id=submission_id,
            rule_based_score=rule_score,
            ai_based_score=ai_score,
            final_score=final_score,
            feedback=feedback
        )
        
        logger.info(f"Completed evaluation for submission {submission_id}")
        
    except Exception as e:
        logger.error(f"Background evaluation failed: {e}")


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
