"""
Infrastructure integration tests.
"""

import pytest
from app.models.question import Question, DifficultyLevel, QuestionTopic, TestCase
from app.models.execution import ExecutionRequest, ExecutionMode
from app.services.question_generator import QuestionGeneratorService
from app.services.execution_engine import ExecutionEngineService


@pytest.mark.unit
def test_question_model_creation():
    """Test that Question model can be created with valid data."""
    question = Question(
        id="test-123",
        title="Test Question",
        description="A test question for validation",
        difficulty_level=DifficultyLevel.BEGINNER,
        topic=QuestionTopic.TRANSFORMATIONS,
        input_schema={"id": "int", "name": "string"},
        sample_input={"data": [{"id": 1, "name": "test"}]},
        expected_output={"data": [{"id": 1, "name": "test", "processed": True}]},
        test_cases=[
            TestCase(
                input_data={"data": [{"id": 1, "name": "test"}]},
                expected_output={"data": [{"id": 1, "name": "test", "processed": True}]},
                description="Basic test case"
            )
        ]
    )
    
    assert question.id == "test-123"
    assert question.title == "Test Question"
    assert question.difficulty_level == DifficultyLevel.BEGINNER
    assert question.topic == QuestionTopic.TRANSFORMATIONS
    assert len(question.test_cases) == 1


@pytest.mark.unit
def test_execution_request_model():
    """Test that ExecutionRequest model can be created with valid data."""
    request = ExecutionRequest(
        code="df.withColumn('processed', lit(True))",
        question_id="test-question-123",
        mode=ExecutionMode.TEST,
        user_id="test-user-456"
    )
    
    assert request.code == "df.withColumn('processed', lit(True))"
    assert request.question_id == "test-question-123"
    assert request.mode == ExecutionMode.TEST
    assert request.user_id == "test-user-456"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_question_generator_service():
    """Test that QuestionGeneratorService can generate questions."""
    service = QuestionGeneratorService()
    
    # Test beginner level question generation
    question = await service.generate_question(user_id="test_user", experience_level=1)
    assert question is not None
    assert question.difficulty_level == DifficultyLevel.BEGINNER
    assert question.topic == QuestionTopic.TRANSFORMATIONS
    
    # Test intermediate level question generation
    question = await service.generate_question(user_id="test_user", experience_level=5)
    assert question is not None
    assert question.difficulty_level == DifficultyLevel.INTERMEDIATE
    
    # Test advanced level question generation
    question = await service.generate_question(user_id="test_user", experience_level=10)
    assert question is not None
    assert question.difficulty_level == DifficultyLevel.ADVANCED


@pytest.mark.unit
@pytest.mark.asyncio
async def test_execution_engine_service():
    """Test that ExecutionEngineService can execute code."""
    service = ExecutionEngineService()
    
    # Test code execution
    result = await service.execute_code(
        code="df.withColumn('processed', lit(True))",
        question_id="test-question-123",
        mode="test"
    )
    
    assert result is not None
    assert result.job_id is not None
    assert result.mode == ExecutionMode.TEST
    assert result.execution_time > 0
    assert result.memory_usage > 0