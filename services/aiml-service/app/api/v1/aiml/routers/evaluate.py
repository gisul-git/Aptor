"""
Evaluation router for AIML - AI-powered code evaluation and feedback.
"""
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel

from ..services.ai_feedback import generate_aiml_feedback

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/aiml", tags=["aiml"])


class EvaluateSubmissionRequest(BaseModel):
    """Request model for AIML submission evaluation"""
    source_code: str
    outputs: List[str]
    question_title: str
    question_description: str
    tasks: List[str]
    constraints: List[str]
    difficulty: str = "medium"
    skill: Optional[str] = None
    dataset_info: Optional[Dict[str, Any]] = None
    test_cases: Optional[List[Dict[str, Any]]] = None


@router.post("/evaluate")
async def evaluate_submission(
    request: EvaluateSubmissionRequest = Body(...)
):
    """
    Evaluate an AIML code submission and generate AI-powered feedback.
    
    This endpoint is used by the AI Assessment Service to evaluate AIML submissions.
    It provides comprehensive feedback including:
    - Overall score (0-100)
    - Code quality assessment
    - Correctness evaluation
    - Task completion status
    - Detailed feedback and suggestions
    
    Args:
        request: Evaluation request with submission data and question details
    
    Returns:
        Evaluation result with score, feedback, and detailed analysis
    """
    try:
        logger.info(f"Evaluating AIML submission for question: {request.question_title}")
        
        # Call the feedback generation function
        evaluation_result = generate_aiml_feedback(
            source_code=request.source_code,
            outputs=request.outputs,
            question_title=request.question_title,
            question_description=request.question_description,
            tasks=request.tasks,
            constraints=request.constraints,
            difficulty=request.difficulty,
            skill=request.skill,
            dataset_info=request.dataset_info,
            test_cases=request.test_cases,
        )
        
        logger.info(f"Evaluation completed. Score: {evaluation_result.get('overall_score', 0)}")
        return evaluation_result
        
    except Exception as e:
        logger.error(f"Error evaluating AIML submission: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to evaluate submission: {str(e)}"
        )

