"""
Question management endpoints.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, List, Dict, Any
import structlog
from datetime import datetime

from app.models.question import Question, QuestionDifficulty, QuestionTopic
from app.services.integration_service import get_integration_service, IntegrationService
from app.core.auth import get_current_user, check_rate_limit
from app.core.config import settings

logger = structlog.get_logger()
router = APIRouter()


@router.get("/test")
async def get_test_question(
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Question:
    """Get a simple test question, creating it if it doesn't exist."""
    try:
        # First try to get the existing test question
        if integration_service.question_repo:
            existing_question = await integration_service.question_repo.get_question_by_id("test-question-1")
            if existing_question:
                return existing_question
        
        # Create a proper test question
        from app.models.question import Question, DifficultyLevel, QuestionTopic, TestCase
        from datetime import datetime
        
        test_question = Question(
            id="test-question-1",
            title="Basic DataFrame Operations",
            description="Create a DataFrame and perform basic operations. This is a test question for validating the execution system.",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={
                "name": "string",
                "age": "int"
            },
            sample_input={
                "data": [
                    {"name": "Alice", "age": 25},
                    {"name": "Bob", "age": 30},
                    {"name": "Charlie", "age": 35}
                ]
            },
            expected_output={
                "data": [
                    {"name": "Alice", "age": 25},
                    {"name": "Bob", "age": 30},
                    {"name": "Charlie", "age": 35}
                ]
            },
            test_cases=[
                TestCase(
                    input_data={
                        "data": [
                            {"name": "Alice", "age": 25},
                            {"name": "Bob", "age": 30}
                        ]
                    },
                    expected_output={
                        "data": [
                            {"name": "Alice", "age": 25},
                            {"name": "Bob", "age": 30}
                        ]
                    },
                    description="Basic test case"
                )
            ],
            created_at=datetime.utcnow(),
            metadata={
                "test_question": True,
                "created_by": "system"
            }
        )
        
        # Store the test question in the database
        if integration_service.question_repo:
            await integration_service.question_repo.create_question(test_question)
            logger.info("Test question created and stored", question_id=test_question.id)
        
        return test_question
        
    except Exception as e:
        logger.error("Failed to get/create test question", error=str(e))
        # Return a fallback response
        return {
            "id": "test-question-1",
            "title": "Basic DataFrame Operations",
            "description": "Create a DataFrame and perform basic operations",
            "difficulty_level": "beginner",
            "topic": "dataframes",
            "question_text": "Create a PySpark DataFrame with columns 'name' and 'age', then show the first 5 rows.",
            "sample_code": "# Your code here\ndf = spark.createDataFrame([('Alice', 25), ('Bob', 30)], ['name', 'age'])\ndf.show(5)",
            "expected_output": "DataFrame with name and age columns showing first 5 rows",
            "test_cases": [
                {
                    "input": {"data": [("Alice", 25), ("Bob", 30)]},
                    "expected_output": {"count": 2}
                }
            ]
        }


@router.get("/generate")
async def generate_question(
    experience_level: int = Query(..., ge=0, le=20, description="Years of experience (0-20)"),
    topic: Optional[str] = Query(None, description="Specific topic to focus on"),
    difficulty: Optional[QuestionDifficulty] = Query(None, description="Question difficulty level"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    _rate_limit: None = Depends(check_rate_limit("ai_questions", settings.AI_REQUESTS_PER_HOUR)),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Question:
    """Generate a new PySpark question based on experience level and optional topic."""
    try:
        # Use user's experience level if authenticated
        if current_user and not experience_level:
            experience_level = current_user.get("experience_level", 0)
        
        # Use user's preferred topics if no topic specified
        if current_user and not topic:
            preferences = current_user.get("preferences", {})
            preferred_topics = preferences.get("preferred_topics", [])
            if preferred_topics:
                topic = preferred_topics[0]  # Use first preferred topic
        
        # Generate user ID for rate limiting (use actual user ID or IP-based ID)
        user_id = current_user.get("user_id") if current_user else "anonymous"
        
        # Use integration service for complete workflow
        question = await integration_service.generate_personalized_question(
            user_id=user_id,
            experience_level=experience_level,
            topic=topic
        )
        
        logger.info(
            "Question generated successfully",
            question_id=question.id,
            experience_level=experience_level,
            topic=topic,
            difficulty=difficulty,
            user_id=user_id
        )
        
        return question
        
    except Exception as e:
        logger.error(
            "Failed to generate question",
            error=str(e),
            experience_level=experience_level,
            topic=topic,
            user_id=current_user.get("user_id") if current_user else "anonymous"
        )
        raise HTTPException(status_code=500, detail="Failed to generate question")


@router.get("/{question_id}")
async def get_question(
    question_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Question:
    """Get a specific question by ID with caching."""
    try:
        # Use integration service for caching and retrieval
        question = await integration_service.question_repo.get_question_by_id(question_id)
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        logger.info(
            "Question retrieved",
            question_id=question_id,
            user_id=current_user.get("user_id") if current_user else None
        )
        
        return question
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get question", question_id=question_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve question")


@router.get("/")
async def list_questions(
    skip: int = Query(0, ge=0, description="Number of questions to skip"),
    limit: int = Query(10, ge=1, le=100, description="Number of questions to return"),
    topic: Optional[str] = Query(None, description="Filter by topic"),
    difficulty: Optional[QuestionDifficulty] = Query(None, description="Filter by difficulty"),
    experience_level: Optional[int] = Query(None, ge=0, le=20, description="Filter by experience level"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """List questions with filtering and pagination."""
    try:
        question_service = QuestionGeneratorService()
        
        # Build filter criteria
        filters = {}
        if topic:
            filters["topic"] = topic
        if difficulty:
            filters["difficulty"] = difficulty
        if experience_level is not None:
            filters["experience_level"] = experience_level
        
        questions, total_count = await question_service.list_questions(
            skip=skip,
            limit=limit,
            filters=filters
        )
        
        logger.info(
            "Questions listed",
            count=len(questions),
            total=total_count,
            filters=filters,
            user_id=current_user.get("user_id") if current_user else None
        )
        
        return {
            "questions": questions,
            "total": total_count,
            "skip": skip,
            "limit": limit,
            "has_more": skip + len(questions) < total_count
        }
        
    except Exception as e:
        logger.error("Failed to list questions", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve questions")


@router.get("/topics")
async def get_available_topics() -> List[str]:
    """Get list of available question topics."""
    try:
        # Try to get from cache first
        redis_client = await get_redis()
        cache_key = "question_topics"
        
        cached_topics = await redis_client.get(cache_key)
        if cached_topics:
            import json
            return json.loads(cached_topics)
        
        question_service = QuestionGeneratorService()
        topics = await question_service.get_available_topics()
        
        # Cache the topics for 1 hour
        import json
        await redis_client.setex(cache_key, 3600, json.dumps(topics))
        
        logger.info("Available topics retrieved", count=len(topics))
        return topics
        
    except Exception as e:
        logger.error("Failed to get available topics", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve topics")


@router.get("/stats")
async def get_question_stats(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get question statistics and analytics."""
    try:
        question_service = QuestionGeneratorService()
        stats = await question_service.get_question_stats()
        
        logger.info(
            "Question stats retrieved",
            user_id=current_user.get("user_id") if current_user else None
        )
        
        return stats
        
    except Exception as e:
        logger.error("Failed to get question stats", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve question statistics")


@router.post("/{question_id}/validate")
async def validate_question(
    question_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Validate a question's test cases and expected outputs."""
    try:
        question_service = QuestionGeneratorService()
        validation_result = await question_service.validate_question(question_id)
        
        logger.info(
            "Question validated",
            question_id=question_id,
            is_valid=validation_result.get("is_valid", False),
            user_id=current_user.get("user_id") if current_user else None
        )
        
        return validation_result
        
    except Exception as e:
        logger.error("Failed to validate question", question_id=question_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to validate question")


@router.delete("/{question_id}")
async def delete_question(
    question_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)  # Require authentication
) -> Dict[str, str]:
    """Delete a question (admin only)."""
    try:
        # Check if user has admin privileges (simplified check)
        if not current_user or current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        
        question_service = QuestionGeneratorService()
        success = await question_service.delete_question(question_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Remove from cache
        redis_client = await get_redis()
        await redis_client.delete(f"question:{question_id}")
        
        logger.info(
            "Question deleted",
            question_id=question_id,
            user_id=current_user.get("user_id")
        )
        
        return {"message": "Question deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete question", question_id=question_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete question")