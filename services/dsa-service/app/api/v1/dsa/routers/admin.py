from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ..services.ai_generator import generate_question
from ..services.ai_sql_generator import generate_sql_question
from ..services.sql_seeded_dataset import fetch_seeded_sql_schema
from typing import Optional, List, Union
import logging

logger = logging.getLogger("backend")

router = APIRouter(prefix="/api/v1/dsa/admin", tags=["dsa"])

# Log router initialization
logger.info(f"[DSA Admin Router] Router initialized with prefix: {router.prefix}")


class GenerateQuestionRequest(BaseModel):
    difficulty: str = "medium"
    topic: Optional[str] = None
    concepts: Optional[Union[str, List[str]]] = None  # Can be string or list (e.g., "Two Pointers" or ["Two Pointers", "BFS"])
    languages: Optional[List[str]] = None  # Selected languages for starter code generation


class GenerateSQLQuestionRequest(BaseModel):
    """Request model for SQL question generation"""
    difficulty: str = "medium"
    topic: Optional[str] = None  # e.g., "Joins", "Aggregation", "Window Functions"
    concepts: Optional[str] = None  # e.g., "LEFT JOIN, GROUP BY, HAVING"


@router.get("/health")
async def admin_health_check():
    """Health check endpoint for admin router"""
    return {"status": "ok", "router": "admin"}

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
        logger.info(f"Received AI generation request: difficulty={request.difficulty}, topic={request.topic}, languages={request.languages}")
        
        # Validate difficulty
        if request.difficulty not in ["easy", "medium", "hard"]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid difficulty: {request.difficulty}. Must be 'easy', 'medium', or 'hard'"
            )
        
        # Validate languages if provided
        if request.languages is not None:
            if not isinstance(request.languages, list):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid languages: must be a list, got {type(request.languages)}"
                )
            if len(request.languages) == 0:
                raise HTTPException(
                    status_code=400,
                    detail="At least one language must be selected"
                )
        
        try:
            logger.info("Calling generate_question function...")
            question_data = await generate_question(
                difficulty=request.difficulty,
                topic=request.topic,
                concepts=request.concepts,
                languages=request.languages
            )
            logger.info("Successfully generated question")
        except ValueError as ve:
            # Check if it's an authentication/configuration error
            error_msg = str(ve)
            logger.error(f"AI generation failed: {error_msg}")
            
            # Authentication/configuration errors should be 400 (client error)
            if "API key" in error_msg or "OPENAI_API_KEY" in error_msg or "authentication" in error_msg.lower():
                raise HTTPException(
                    status_code=400,
                    detail=error_msg
                )
            
            # JSON parsing errors are still 500 (server/AI issue)
            raise HTTPException(
                status_code=500,
                detail=f"AI generation failed: {error_msg}. The AI may have returned invalid JSON. Please try again."
            )
        except Exception as gen_err:
            # Other errors from AI generator (OpenAI API errors, etc.)
            error_msg = str(gen_err)
            logger.error(f"AI generation error: {error_msg}", exc_info=True)
            
            # Check if it's an authentication error
            if "401" in error_msg or "invalid_api_key" in error_msg.lower() or "authentication" in error_msg.lower():
                raise HTTPException(
                    status_code=400,
                    detail="Invalid OpenAI API key. Please check your OPENAI_API_KEY in the .env file. Get a valid key from https://platform.openai.com/account/api-keys"
                )
            
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


@router.get("/seeded-schema")
async def get_seeded_schema():
    """
    Fetch the seeded database schema and sample data from the SQL execution engine.
    
    This endpoint returns the pre-seeded tables, their schemas (columns and types),
    and sample data rows. This is useful for creating SQL questions that use the
    existing seeded database instead of creating custom tables.
    
    Returns:
    {
        "schemas": {
            "table_name": {
                "columns": {
                    "column_name": "column_type"
                }
            }
        },
        "sample_data": {
            "table_name": [
                [value1, value2, ...],  // List of lists format
                ...
            ]
        }
    }
    """
    try:
        from ..config import SQL_ENGINE_URL, get_dsa_settings
        settings = get_dsa_settings()
        sql_engine_url = getattr(settings, "sql_engine_url", None) or SQL_ENGINE_URL
        logger.info(f"[Admin Router] Fetching seeded SQL schema from SQL execution engine")
        logger.info(f"[Admin Router] SQL Engine URL: {sql_engine_url}")
        logger.info(f"[Admin Router] Full endpoint URL: {sql_engine_url.rstrip('/')}/schema")
        
        schema_data = await fetch_seeded_sql_schema()
        
        logger.info(f"[Admin Router] Successfully fetched schema with {len(schema_data.get('schemas', {}))} tables")
        return schema_data
    except RuntimeError as e:
        # RuntimeError from fetch_seeded_sql_schema contains detailed error info
        error_msg = str(e)
        logger.error(f"[Admin Router] Runtime error fetching seeded schema: {error_msg}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )
    except Exception as e:
        logger.error(f"[Admin Router] Unexpected error fetching seeded schema: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch seeded schema: {str(e)}"
        )

