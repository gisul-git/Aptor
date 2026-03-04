"""
Integration tests for repository classes.
These tests verify the repository functionality without complex mocking.
"""

import pytest
from datetime import datetime
from unittest.mock import patch, AsyncMock

from app.repositories.factory import (
    get_question_repository,
    get_user_repository,
    get_solution_repository,
    get_execution_repository,
    RepositoryFactory
)
from app.models.question import Question, DifficultyLevel, QuestionTopic, TestCase
from app.models.user import UserProgress, UserPreferences, Solution, SolutionStatus
from app.models.execution import ExecutionResult, ExecutionStatus, ExecutionMode


class TestRepositoryFactory:
    """Test repository factory functionality."""
    
    def test_factory_returns_singleton_instances(self):
        """Test that factory returns singleton instances."""
        # Clear any existing instances
        RepositoryFactory.clear_instances()
        
        # Get instances
        question_repo1 = get_question_repository()
        question_repo2 = get_question_repository()
        
        user_repo1 = get_user_repository()
        user_repo2 = get_user_repository()
        
        # Verify singletons
        assert question_repo1 is question_repo2
        assert user_repo1 is user_repo2
        
        # Verify different types are different instances
        assert question_repo1 is not user_repo1
    
    def test_factory_clear_instances(self):
        """Test clearing factory instances."""
        # Get instance
        repo1 = get_question_repository()
        
        # Clear instances
        RepositoryFactory.clear_instances()
        
        # Get new instance
        repo2 = get_question_repository()
        
        # Should be different instances
        assert repo1 is not repo2


class TestRepositoryInitialization:
    """Test repository initialization and basic functionality."""
    
    def test_question_repository_initialization(self):
        """Test question repository initializes correctly."""
        repo = get_question_repository()
        assert repo.collection_name == "questions"
        assert repo._collection is None  # Not connected yet
    
    def test_user_repository_initialization(self):
        """Test user repository initializes correctly."""
        repo = get_user_repository()
        assert repo.collection_name == "users"
        assert repo._collection is None  # Not connected yet
    
    def test_solution_repository_initialization(self):
        """Test solution repository initializes correctly."""
        repo = get_solution_repository()
        assert repo.collection_name == "solutions"
        assert repo._collection is None  # Not connected yet
    
    def test_execution_repository_initialization(self):
        """Test execution repository initializes correctly."""
        repo = get_execution_repository()
        assert repo.collection_name == "execution_results"
        assert repo._collection is None  # Not connected yet


class TestRepositoryDataModels:
    """Test repository data model handling."""
    
    def test_question_model_creation(self):
        """Test creating question model for repository."""
        question = Question(
            id="test_question_1",
            title="Test Question",
            description="A test question for unit testing",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"col1": "string", "col2": "integer"},
            sample_input={"data": [{"col1": "test", "col2": 1}]},
            expected_output={"data": [{"result": "processed"}]},
            test_cases=[
                TestCase(
                    input_data={"col1": "test", "col2": 1},
                    expected_output={"result": "processed"},
                    description="Basic test case"
                )
            ]
        )
        
        # Verify model can be serialized for database storage
        data = question.model_dump()
        assert data["id"] == "test_question_1"
        assert data["title"] == "Test Question"
        assert data["difficulty_level"] == 1
        assert data["topic"] == "transformations"
        assert len(data["test_cases"]) == 1
    
    def test_user_progress_model_creation(self):
        """Test creating user progress model for repository."""
        user_progress = UserProgress(
            user_id="test_user_1",
            experience_level=3,
            preferences=UserPreferences(experience_level=3),
            completed_questions=["q1", "q2"],
            success_rate=0.8,
            average_completion_time=15.5,
            total_questions_attempted=10,
            total_questions_completed=8
        )
        
        # Verify model can be serialized for database storage
        data = user_progress.model_dump()
        assert data["user_id"] == "test_user_1"
        assert data["experience_level"] == 3
        assert data["success_rate"] == 0.8
        assert len(data["completed_questions"]) == 2
    
    def test_solution_model_creation(self):
        """Test creating solution model for repository."""
        solution = Solution(
            id="test_solution_1",
            user_id="test_user_1",
            question_id="test_question_1",
            code="df.select('*').show()",
            status=SolutionStatus.DRAFT,
            submitted_at=datetime.utcnow()
        )
        
        # Verify model can be serialized for database storage
        data = solution.model_dump()
        assert data["id"] == "test_solution_1"
        assert data["user_id"] == "test_user_1"
        assert data["question_id"] == "test_question_1"
        assert data["status"] == "draft"
    
    def test_execution_result_model_creation(self):
        """Test creating execution result model for repository."""
        execution_result = ExecutionResult(
            job_id="test_job_1",
            status=ExecutionStatus.PENDING,
            mode=ExecutionMode.TEST,
            execution_time=0.0,
            memory_usage=0.0,
            created_at=datetime.utcnow()
        )
        
        # Verify model can be serialized for database storage
        data = execution_result.model_dump()
        assert data["job_id"] == "test_job_1"
        assert data["status"] == "pending"
        assert data["mode"] == "test"
        assert data["execution_time"] == 0.0


class TestRepositoryErrorHandling:
    """Test repository error handling."""
    
    @pytest.mark.asyncio
    async def test_database_connection_error_handling(self):
        """Test that repositories handle database connection errors properly."""
        repo = get_question_repository()
        
        # Mock database connection failure
        with patch.object(repo, '_get_collection') as mock_get_collection:
            from app.repositories.base import DatabaseConnectionError, RepositoryError
            mock_get_collection.side_effect = DatabaseConnectionError("Connection failed")
            
            # Verify error is raised (wrapped as RepositoryError)
            with pytest.raises(RepositoryError):
                await repo.get_question_by_id("test_id")
    
    def test_repository_collection_names(self):
        """Test that repositories have correct collection names."""
        question_repo = get_question_repository()
        user_repo = get_user_repository()
        solution_repo = get_solution_repository()
        execution_repo = get_execution_repository()
        
        assert question_repo.collection_name == "questions"
        assert user_repo.collection_name == "users"
        assert solution_repo.collection_name == "solutions"
        assert execution_repo.collection_name == "execution_results"


if __name__ == "__main__":
    pytest.main([__file__])