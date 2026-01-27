from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ..services.ai_generator import generate_question
from ..services.ai_sql_generator import generate_sql_question
from typing import Optional, List, Union
import logging

logger = logging.getLogger("backend")

router = APIRouter(prefix="/api/v1/dsa/admin", tags=["dsa"])


class GenerateQuestionRequest(BaseModel):
    difficulty: str = "medium"
    topic: Optional[str] = None
    concepts: Optional[Union[str, List[str]]] = None  # Can be string or list (e.g., "Two Pointers" or ["Two Pointers", "BFS"])


class GenerateSQLQuestionRequest(BaseModel):
    """Request model for SQL question generation"""
    difficulty: str = "medium"
    topic: Optional[str] = None  # e.g., "Joins", "Aggregation", "Window Functions"
    concepts: Optional[str] = None  # e.g., "LEFT JOIN, GROUP BY, HAVING"


@router.post("/generate-question")
async def generate_question_endpoint(
    request: GenerateQuestionRequest
):
    """
    Generate a complete coding question using AI (no auth required)
    
    Automatically generates:
    - Title and problem description
    - Example with input, output, and explanation
    - 3 public testcases with inputs and expected outputs
    - 3 hidden testcases with inputs and expected outputs
    - Constraints
    
    Provide topic and/or concepts to guide the generation.
    Secure mode is enabled (function-body only solutions).
    """
    try:
        # Validate difficulty
        if request.difficulty not in ["easy", "medium", "hard"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid difficulty: {request.difficulty}. Must be 'easy', 'medium', or 'hard'"
            )
        
        try:
            question_data = await generate_question(
                difficulty=request.difficulty,
                topic=request.topic,
                concepts=request.concepts
            )
        except ValueError as ve:
            # JSON parsing errors from AI generator
            error_msg = str(ve)
            logger.error(f"AI generation failed: {error_msg}")
            raise HTTPException(
                status_code=500,
                detail=f"AI generation failed: {error_msg}. The AI may have returned invalid JSON. Please try again."
            )
        except Exception as gen_err:
            # Other errors from AI generator (OpenAI API errors, etc.)
            error_msg = str(gen_err)
            logger.error(f"AI generation error: {error_msg}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"AI generation error: {error_msg}. Please check your OpenAI API key and try again."
            )
        
        # Mark as AI generated
        question_data["ai_generated"] = True
        
        # Transform AI response format to match frontend expectations
        # AI returns: problem_description, example (singular)
        # Frontend expects: description, examples (plural array)
        if "problem_description" in question_data:
            question_data["description"] = question_data.pop("problem_description")
        
        if "example" in question_data:
            # Convert singular example to plural examples array
            example = question_data.pop("example")
            question_data["examples"] = [example] if example else []
        
        return question_data
    except HTTPException:
        # Re-raise HTTPExceptions (they're already properly formatted)
        raise
    except Exception as e:
        # Catch any other unexpected errors
        logger.error(f"Unexpected error in generate_question_endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.post("/generate-sql-question")
async def generate_sql_question_endpoint(
    request: GenerateSQLQuestionRequest
):
    """
    Generate a complete SQL question using AI (no auth required)
    
    SQL questions are a separate question_type within DSA competency.
    They use result-set comparison instead of stdin/stdout testcases.
    
    Automatically generates:
    - Title and description
    - Table schemas with columns and data types
    - Sample data for each table
    - Query constraints and requirements
    - Starter query template
    
    Provide topic and/or concepts to guide the generation:
    - Topics: "Joins", "Aggregation", "Window Functions", "Subqueries"
    - Concepts: "LEFT JOIN", "GROUP BY", "HAVING", "ROW_NUMBER", "CTE"
    
    Returns question with:
    - competency: "DSA"
    - question_type: "SQL"
    - sql_category: select | join | aggregation | subquery | window
    """
    try:
        question_data = await generate_sql_question(
            difficulty=request.difficulty,
            topic=request.topic,
            concepts=request.concepts,
        )
        return question_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

