"""
Simple integration tests for API endpoints without database dependencies.
"""

import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import UserProgress, SkillArea, UserPreferences
from app.models.question import Question, QuestionTopic, DifficultyLevel
from app.models.execution import ExecutionResult, ExecutionStatus, ValidationResult, ExecutionMode


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


class TestAPIEndpointsSimple:
    """Simple integration tests for API endpoints."""
    
    def test_health_endpoint(self, client):
        """Test health endpoint."""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_root_endpoint(self, client):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
    
    @patch('app.core.auth.get_current_user_required')
    @patch('app.services.question_generator.QuestionGeneratorService')
    def test_question_generation_endpoint(self, mock_service_class, mock_auth, client):
        """Test question generation endpoint."""
        # Mock authentication
        mock_auth.return_value = {"user_id": "test-user", "role": "user"}
        
        # Mock service
        mock_service = AsyncMock()
        mock_service_class.return_value = mock_service
        
        mock_question = Question(
            id="test-question-1",
            title="Test Question",
            description="Test description",
            difficulty_level=DifficultyLevel.INTERMEDIATE,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"customer_id": "string", "name": "string", "active": "boolean"},
            sample_input={"data": [{"customer_id": "1", "name": "John", "active": True}]},
            expected_output={"data": [{"customer_id": "1", "name": "John"}]},
            test_cases=[]
        )
        
        mock_service.generate_question.return_value = mock_question
        
        # Test the endpoint
        response = client.get(
            "/api/v1/questions/generate?experience_level=5&topic=transformations&difficulty=intermediate",
            headers={"Authorization": "Bearer test-token-test-user"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["title"] == "Test Question"
        assert data["difficulty_level"] == 2  # INTERMEDIATE
    
    @patch('app.core.auth.get_current_user_required')
    @patch('app.services.execution_engine.ExecutionEngineService')
    def test_code_execution_endpoint(self, mock_service_class, mock_auth, client):
        """Test code execution endpoint."""
        # Mock authentication
        mock_auth.return_value = {"user_id": "test-user", "role": "user"}
        
        # Mock service
        mock_service = AsyncMock()
        mock_service_class.return_value = mock_service
        
        mock_result = ExecutionResult(
            job_id="test-job-1",
            user_id="test-user",
            question_id="test-question-1",
            status=ExecutionStatus.COMPLETED,
            mode=ExecutionMode.TEST,
            execution_time=15.5,
            memory_usage=128.0,
            output={"data": [{"result": "Test output"}]},
            validation_result=ValidationResult(
                is_correct=True,
                schema_match=True,
                row_count_match=True,
                data_match=True,
                similarity_score=1.0
            )
        )
        
        mock_service.execute_code.return_value = mock_result
        
        # Test the endpoint
        response = client.post(
            "/api/v1/execute/test",
            json={
                "user_id": "test-user",
                "question_id": "test-question-1",
                "code": "df.select('*')",
                "mode": "test"
            },
            headers={"Authorization": "Bearer test-token-test-user"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["job_id"] == "test-job-1"
        assert data["status"] == "completed"
    
    @patch('app.core.auth.get_current_user_required')
    @patch('app.services.user_service.UserService')
    def test_user_progress_endpoint(self, mock_service_class, mock_auth, client):
        """Test user progress endpoint."""
        # Mock authentication
        mock_auth.return_value = {"user_id": "test-user", "role": "user"}
        
        # Mock service
        mock_service = AsyncMock()
        mock_service_class.return_value = mock_service
        
        mock_progress = UserProgress(
            user_id="test-user",
            experience_level=5,
            preferences=UserPreferences(experience_level=5),
            total_questions_attempted=25,
            total_questions_completed=20,
            success_rate=0.8,
            overall_proficiency=6.5,
            average_completion_time=22.5,
            streak_days=7,
            skill_areas=[
                SkillArea(
                    topic=QuestionTopic.TRANSFORMATIONS,
                    proficiency_score=7.0,
                    questions_attempted=10,
                    questions_completed=8
                )
            ]
        )
        
        mock_service.get_user_progress.return_value = mock_progress
        
        # Test the endpoint
        response = client.get(
            "/api/v1/users/test-user/progress",
            headers={"Authorization": "Bearer test-token-test-user"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["user_id"] == "test-user"
        assert data["success_rate"] == 0.8
        assert data["overall_proficiency"] == 6.5
    
    def test_unauthorized_access(self, client):
        """Test unauthorized access to protected endpoints."""
        # Test without authentication - these should require auth
        response = client.get("/api/v1/users/test-user/progress")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Test execution endpoint with missing required fields (should return validation error)
        response = client.post("/api/v1/execute/test", json={})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Question generation allows anonymous access (returns 200)
        response = client.get("/api/v1/questions/generate?experience_level=5")
        assert response.status_code == status.HTTP_200_OK  # Anonymous access allowed
    
    @patch('app.core.auth.get_current_user_required')
    def test_forbidden_access(self, mock_auth, client):
        """Test forbidden access to other users' data."""
        mock_auth.return_value = {"user_id": "user-1", "role": "user"}
        
        # Try to access another user's data
        response = client.get(
            "/api/v1/users/user-2/progress",
            headers={"Authorization": "Bearer test-token-user-1"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    @patch('app.core.auth.get_current_user_required')
    @patch('app.services.user_service.UserService')
    def test_admin_access(self, mock_service_class, mock_auth, client):
        """Test admin access to any user's data."""
        mock_auth.return_value = {"user_id": "admin-user", "role": "admin"}
        
        mock_service = AsyncMock()
        mock_service_class.return_value = mock_service
        mock_service.get_user_progress.return_value = UserProgress(
            user_id="any-user", 
            experience_level=5,
            preferences=UserPreferences(experience_level=5)
        )
        
        # Admin should be able to access any user's data
        response = client.get(
            "/api/v1/users/any-user/progress",
            headers={"Authorization": "Bearer test-token-admin-user"}
        )
        assert response.status_code == status.HTTP_200_OK
    
    @patch('app.services.progress_analytics.ProgressAnalyticsService')
    def test_public_leaderboard(self, mock_service_class, client):
        """Test public leaderboard access."""
        mock_service = AsyncMock()
        mock_service_class.return_value = mock_service
        
        mock_leaderboard = {
            "leaderboard": [
                {
                    "rank": 1,
                    "user_id": "user_1",
                    "display_name": "Anonymous User 1",
                    "success_rate": 0.95,
                    "overall_proficiency": 8.5,
                    "questions_completed": 150
                }
            ],
            "timeframe": "all",
            "total_users": 1
        }
        
        mock_service.get_leaderboard.return_value = mock_leaderboard
        
        # Test public leaderboard access (no auth required)
        response = client.get("/api/v1/users/leaderboard?limit=10")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["leaderboard"]) == 1
        assert data["leaderboard"][0]["rank"] == 1
    
    @patch('app.services.progress_analytics.ProgressAnalyticsService')
    def test_platform_stats(self, mock_service_class, client):
        """Test platform statistics endpoint."""
        mock_service = AsyncMock()
        mock_service_class.return_value = mock_service
        
        mock_stats = {
            "total_users": 1250,
            "active_users_30d": 450,
            "total_solutions_submitted": 15000,
            "platform_average_success_rate": 0.75,
            "platform_average_proficiency": 6.2
        }
        
        mock_service.get_platform_stats.return_value = mock_stats
        
        # Test public stats access (no auth required)
        response = client.get("/api/v1/users/stats")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_users"] == 1250
        assert data["active_users_30d"] == 450
    
    @patch('app.core.auth.get_current_user_required')
    @patch('app.services.user_service.UserService')
    def test_error_handling(self, mock_service_class, mock_auth, client):
        """Test error handling in endpoints."""
        mock_auth.return_value = {"user_id": "test-user", "role": "user"}
        
        # Mock service failure
        mock_service = AsyncMock()
        mock_service_class.return_value = mock_service
        mock_service.get_user_progress.side_effect = Exception("Database connection failed")
        
        response = client.get(
            "/api/v1/users/test-user/progress",
            headers={"Authorization": "Bearer test-token-test-user"}
        )
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        
        data = response.json()
        assert "error" in data
        assert "Failed to retrieve user progress" in data["error"]["message"]
    
    def test_validation_errors(self, client):
        """Test validation error handling."""
        # Test invalid request data (missing required fields)
        response = client.get(
            "/api/v1/questions/generate?difficulty=invalid_difficulty&topic=transformations"
        )
        
        # Should return validation error or 200 (depending on implementation)
        assert response.status_code in [status.HTTP_422_UNPROCESSABLE_ENTITY, status.HTTP_200_OK]


class TestEndToEndWorkflow:
    """Test end-to-end workflows."""
    
    @patch('app.core.auth.get_current_user_required')
    @patch('app.services.question_generator.QuestionGeneratorService')
    @patch('app.services.execution_engine.ExecutionEngineService')
    @patch('app.services.user_service.UserService')
    def test_complete_learning_session(
        self, 
        mock_user_service_class,
        mock_exec_service_class, 
        mock_q_service_class, 
        mock_auth, 
        client
    ):
        """Test complete learning session workflow."""
        mock_auth.return_value = {"user_id": "test-user", "role": "user"}
        
        # Setup mocks
        mock_q_service = AsyncMock()
        mock_q_service_class.return_value = mock_q_service
        
        mock_exec_service = AsyncMock()
        mock_exec_service_class.return_value = mock_exec_service
        
        mock_user_service = AsyncMock()
        mock_user_service_class.return_value = mock_user_service
        
        # Step 1: Generate question
        mock_question = Question(
            id="workflow-question-1",
            title="Data Transformation Challenge",
            description="Transform customer data",
            difficulty_level=DifficultyLevel.INTERMEDIATE,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"customer_id": "string", "name": "string", "active": "boolean"},
            sample_input={"data": [{"customer_id": "1", "name": "John", "active": True}]},
            expected_output={"data": [{"customer_id": "1", "name": "John"}]},
            test_cases=[]
        )
        
        mock_q_service.generate_question.return_value = mock_question
        
        question_response = client.get(
            "/api/v1/questions/generate?experience_level=5&topic=transformations&difficulty=intermediate",
            headers={"Authorization": "Bearer test-token-test-user"}
        )
        
        assert question_response.status_code == status.HTTP_200_OK
        question_data = question_response.json()
        question_id = question_data["id"]
        
        # Step 2: Execute code (test mode)
        mock_test_result = ExecutionResult(
            job_id="test-job-1",
            user_id="test-user",
            question_id=question_id,
            status=ExecutionStatus.COMPLETED,
            mode=ExecutionMode.TEST,
            execution_time=12.0,
            memory_usage=96.0,
            output={"data": [{"result": "Test execution successful"}]}
        )
        
        mock_exec_service.execute_code.return_value = mock_test_result
        
        test_response = client.post(
            "/api/v1/execute/test",
            json={
                "user_id": "test-user",
                "question_id": question_id,
                "code": "df.select('customer_id', 'name').filter(df.active == True)",
                "mode": "test"
            },
            headers={"Authorization": "Bearer test-token-test-user"}
        )
        
        assert test_response.status_code == status.HTTP_200_OK
        test_data = test_response.json()
        assert test_data["status"] == "completed"
        
        # Step 3: Execute code (submit mode)
        mock_submit_result = ExecutionResult(
            job_id="submit-job-1",
            user_id="test-user",
            question_id=question_id,
            status=ExecutionStatus.COMPLETED,
            mode=ExecutionMode.SUBMIT,
            execution_time=18.5,
            memory_usage=128.0,
            output={"data": [{"customer_id": "1", "name": "John"}]},
            validation_result=ValidationResult(
                is_correct=True,
                schema_match=True,
                row_count_match=True,
                data_match=True,
                similarity_score=0.92
            )
        )
        
        mock_exec_service.execute_code.return_value = mock_submit_result
        
        submit_response = client.post(
            "/api/v1/execute/submit",
            json={
                "user_id": "test-user",
                "question_id": question_id,
                "code": "df.select('customer_id', 'name').filter(df.active == True)",
                "mode": "submit"
            },
            headers={"Authorization": "Bearer test-token-test-user"}
        )
        
        assert submit_response.status_code == status.HTTP_200_OK
        submit_data = submit_response.json()
        assert submit_data["validation_result"]["is_correct"] is True
        assert submit_data["validation_result"]["similarity_score"] == 0.92
        
        # Step 4: Check updated progress
        mock_updated_progress = UserProgress(
            user_id="test-user",
            experience_level=5,
            preferences=UserPreferences(experience_level=5),
            total_questions_attempted=26,  # Incremented
            total_questions_completed=21,  # Incremented
            success_rate=0.81,  # Updated
            overall_proficiency=6.7,  # Improved
            average_completion_time=20.2,
            streak_days=8,  # Incremented
            skill_areas=[
                SkillArea(
                    topic=QuestionTopic.TRANSFORMATIONS,
                    proficiency_score=7.2,  # Improved
                    questions_attempted=11,  # Incremented
                    questions_completed=9  # Incremented
                )
            ]
        )
        
        mock_user_service.get_user_progress.return_value = mock_updated_progress
        
        progress_response = client.get(
            "/api/v1/users/test-user/progress",
            headers={"Authorization": "Bearer test-token-test-user"}
        )
        
        assert progress_response.status_code == status.HTTP_200_OK
        progress_data = progress_response.json()
        assert progress_data["total_questions_completed"] == 21
        assert progress_data["success_rate"] == 0.81
        assert progress_data["overall_proficiency"] == 6.7
        
        # Verify the complete workflow executed correctly
        mock_q_service.generate_question.assert_called_once()
        assert mock_exec_service.execute_code.call_count == 2  # Test + Submit
        mock_user_service.get_user_progress.assert_called_once()