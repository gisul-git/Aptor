"""
Integration tests for API endpoints.

These tests verify end-to-end API workflows including authentication,
error handling, and data flow between endpoints.
"""

import pytest
import json
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime, timedelta
from httpx import AsyncClient
from fastapi import status

from app.models.user import UserProgress, UserPreferences, SkillArea
from app.models.question import Question, QuestionTopic, DifficultyLevel
from app.models.execution import ExecutionResult, ExecutionStatus, ValidationResult
from app.core.config import settings


class TestQuestionEndpointsIntegration:
    """Integration tests for question management endpoints."""
    
    @pytest.mark.asyncio
    async def test_question_generation_workflow(self, client: AsyncClient):
        """Test complete question generation workflow."""
        # Mock authentication
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            # Mock question generation service
            with patch('app.services.question_generator.QuestionGenerator') as mock_generator_class:
                mock_generator = AsyncMock()
                mock_generator_class.return_value = mock_generator
                
                # Mock generated question
                mock_question = Question(
                    id="test-question-1",
                    title="Test Data Transformation",
                    description="Transform the given dataset",
                    difficulty=DifficultyLevel.INTERMEDIATE,
                    topic=QuestionTopic.TRANSFORMATIONS,
                    starter_code="# Your code here",
                    solution_code="df.select('*')",
                    test_cases=[],
                    expected_output="test output",
                    hints=["Use select()"],
                    time_limit=30,
                    memory_limit=512
                )
                
                mock_generator.generate_question.return_value = mock_question
                
                # Test question generation
                response = await client.post(
                    "/api/v1/questions/generate",
                    json={
                        "user_id": "test-user",
                        "difficulty": "intermediate",
                        "topic": "transformations"
                    }
                )
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["title"] == "Test Data Transformation"
                assert data["difficulty"] == "intermediate"
                assert data["topic"] == "transformations"
    
    @pytest.mark.asyncio
    async def test_question_retrieval_with_caching(self, client: AsyncClient):
        """Test question retrieval with caching behavior."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            with patch('app.services.question_generator.QuestionGenerator') as mock_generator_class:
                mock_generator = AsyncMock()
                mock_generator_class.return_value = mock_generator
                
                # Mock cached question
                mock_question = {
                    "id": "cached-question-1",
                    "title": "Cached Question",
                    "difficulty": "beginner",
                    "topic": "aggregations"
                }
                
                mock_generator.get_question.return_value = mock_question
                
                # Test question retrieval
                response = await client.get("/api/v1/questions/cached-question-1")
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["id"] == "cached-question-1"
                assert data["title"] == "Cached Question"
    
    @pytest.mark.asyncio
    async def test_question_generation_error_handling(self, client: AsyncClient):
        """Test error handling in question generation."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            with patch('app.services.question_generator.QuestionGenerator') as mock_generator_class:
                mock_generator = AsyncMock()
                mock_generator_class.return_value = mock_generator
                
                # Mock service error
                mock_generator.generate_question.side_effect = Exception("AI service unavailable")
                
                # Test error response
                response = await client.post(
                    "/api/v1/questions/generate",
                    json={
                        "user_id": "test-user",
                        "difficulty": "intermediate",
                        "topic": "transformations"
                    }
                )
                
                assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
                data = response.json()
                assert "Failed to generate question" in data["detail"]


class TestExecutionEndpointsIntegration:
    """Integration tests for code execution endpoints."""
    
    @pytest.mark.asyncio
    async def test_code_execution_workflow(self, client: AsyncClient):
        """Test complete code execution workflow."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            with patch('app.services.execution_engine.ExecutionEngine') as mock_engine_class:
                mock_engine = AsyncMock()
                mock_engine_class.return_value = mock_engine
                
                # Mock execution result
                mock_result = ExecutionResult(
                    job_id="test-job-1",
                    user_id="test-user",
                    question_id="test-question-1",
                    status=ExecutionStatus.COMPLETED,
                    execution_time=15.5,
                    memory_usage=128.0,
                    output="Test output",
                    validation_result=ValidationResult(
                        is_correct=True,
                        score=100.0,
                        feedback="Perfect solution!"
                    )
                )
                
                mock_engine.execute_code.return_value = mock_result
                
                # Test code execution
                response = await client.post(
                    "/api/v1/execution/execute",
                    json={
                        "user_id": "test-user",
                        "question_id": "test-question-1",
                        "code": "df.select('*')",
                        "mode": "test"
                    }
                )
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["job_id"] == "test-job-1"
                assert data["status"] == "completed"
                assert data["validation_result"]["is_correct"] is True
    
    @pytest.mark.asyncio
    async def test_job_status_tracking(self, client: AsyncClient):
        """Test job status tracking functionality."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            with patch('app.services.execution_engine.ExecutionEngine') as mock_engine_class:
                mock_engine = AsyncMock()
                mock_engine_class.return_value = mock_engine
                
                # Mock job status
                mock_status = {
                    "job_id": "test-job-1",
                    "status": "running",
                    "progress": 50,
                    "estimated_completion": "2024-01-01T12:30:00Z"
                }
                
                mock_engine.get_job_status.return_value = mock_status
                
                # Test job status retrieval
                response = await client.get("/api/v1/execution/jobs/test-job-1/status")
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["job_id"] == "test-job-1"
                assert data["status"] == "running"
                assert data["progress"] == 50
    
    @pytest.mark.asyncio
    async def test_execution_mode_differentiation(self, client: AsyncClient):
        """Test different execution modes (test vs submit)."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            with patch('app.services.execution_engine.ExecutionEngine') as mock_engine_class:
                mock_engine = AsyncMock()
                mock_engine_class.return_value = mock_engine
                
                # Mock different results for different modes
                def mock_execute(user_id, question_id, code, mode):
                    if mode == "test":
                        return ExecutionResult(
                            job_id="test-job",
                            user_id=user_id,
                            question_id=question_id,
                            status=ExecutionStatus.COMPLETED,
                            execution_time=10.0,
                            memory_usage=64.0,
                            output="Quick test result"
                        )
                    else:  # submit mode
                        return ExecutionResult(
                            job_id="submit-job",
                            user_id=user_id,
                            question_id=question_id,
                            status=ExecutionStatus.COMPLETED,
                            execution_time=25.0,
                            memory_usage=128.0,
                            output="Full validation result",
                            validation_result=ValidationResult(
                                is_correct=True,
                                score=95.0,
                                feedback="Excellent solution with minor optimizations possible"
                            )
                        )
                
                mock_engine.execute_code.side_effect = mock_execute
                
                # Test test mode
                test_response = await client.post(
                    "/api/v1/execution/execute",
                    json={
                        "user_id": "test-user",
                        "question_id": "test-question-1",
                        "code": "df.select('*')",
                        "mode": "test"
                    }
                )
                
                assert test_response.status_code == status.HTTP_200_OK
                test_data = test_response.json()
                assert test_data["job_id"] == "test-job"
                assert test_data["execution_time"] == 10.0
                
                # Test submit mode
                submit_response = await client.post(
                    "/api/v1/execution/execute",
                    json={
                        "user_id": "test-user",
                        "question_id": "test-question-1",
                        "code": "df.select('*')",
                        "mode": "submit"
                    }
                )
                
                assert submit_response.status_code == status.HTTP_200_OK
                submit_data = submit_response.json()
                assert submit_data["job_id"] == "submit-job"
                assert submit_data["validation_result"] is not None
                assert submit_data["validation_result"]["score"] == 95.0


class TestUserEndpointsIntegration:
    """Integration tests for user progress and analytics endpoints."""
    
    @pytest.mark.asyncio
    async def test_user_progress_workflow(self, client: AsyncClient):
        """Test complete user progress tracking workflow."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            with patch('app.services.user_service.UserService') as mock_service_class:
                mock_service = AsyncMock()
                mock_service_class.return_value = mock_service
                
                # Mock user progress
                mock_progress = UserProgress(
                    user_id="test-user",
                    experience_level=5,
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
                
                # Test progress retrieval
                response = await client.get("/api/v1/users/test-user/progress")
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["user_id"] == "test-user"
                assert data["success_rate"] == 0.8
                assert data["overall_proficiency"] == 6.5
                assert len(data["skill_areas"]) == 1
    
    @pytest.mark.asyncio
    async def test_user_analytics_integration(self, client: AsyncClient):
        """Test user analytics endpoint integration."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            with patch('app.services.progress_analytics.ProgressAnalyticsService') as mock_service_class:
                mock_service = AsyncMock()
                mock_service_class.return_value = mock_service
                
                # Mock analytics data
                mock_analytics = {
                    "user_id": "test-user",
                    "daily_activity": {"2024-01-01": 3, "2024-01-02": 2},
                    "weekly_progress": {"week_1": 0.8, "week_2": 0.85},
                    "topic_performance": {
                        "transformations": {
                            "proficiency_score": 7.0,
                            "success_rate": 0.8
                        }
                    },
                    "strengths": ["transformations"],
                    "improvement_areas": ["window_functions"],
                    "personalized_recommendations": [
                        "Focus on window functions to improve analytical skills"
                    ]
                }
                
                mock_service.get_user_analytics.return_value = mock_analytics
                
                # Test analytics retrieval
                response = await client.get("/api/v1/users/test-user/analytics?days=30")
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["user_id"] == "test-user"
                assert "daily_activity" in data
                assert "topic_performance" in data
                assert len(data["personalized_recommendations"]) > 0
    
    @pytest.mark.asyncio
    async def test_user_recommendations_workflow(self, client: AsyncClient):
        """Test user recommendations generation workflow."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            with patch('app.services.recommendation_engine.RecommendationEngine') as mock_engine_class:
                mock_engine = AsyncMock()
                mock_engine_class.return_value = mock_engine
                
                # Mock recommendations
                mock_recommendations = [
                    {
                        "topic": "window_functions",
                        "difficulty": "intermediate",
                        "reason": "skill_building",
                        "explanation": "Build upon your analytical skills",
                        "priority": 8,
                        "estimated_time": 25
                    },
                    {
                        "topic": "joins",
                        "difficulty": "advanced",
                        "reason": "skill_advancement",
                        "explanation": "Challenge yourself with complex joins",
                        "priority": 6,
                        "estimated_time": 35
                    }
                ]
                
                mock_engine.recommend_questions.return_value = mock_recommendations
                
                # Test recommendations retrieval
                response = await client.get("/api/v1/users/test-user/recommendations?limit=5")
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert len(data["recommendations"]) == 2
                assert data["recommendations"][0]["topic"] == "window_functions"
                assert data["recommendations"][0]["priority"] == 8
    
    @pytest.mark.asyncio
    async def test_user_preferences_update(self, client: AsyncClient):
        """Test user preferences update workflow."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            with patch('app.services.user_service.UserService') as mock_service_class:
                mock_service = AsyncMock()
                mock_service_class.return_value = mock_service
                
                # Mock updated progress
                mock_updated_progress = UserProgress(
                    user_id="test-user",
                    experience_level=6,  # Updated
                    preferences=UserPreferences(
                        experience_level=6,
                        preferred_topics=[QuestionTopic.TRANSFORMATIONS, QuestionTopic.JOINS],
                        difficulty_preference="intermediate",
                        session_length=30
                    )
                )
                
                mock_service.update_user_preferences.return_value = mock_updated_progress
                
                # Test preferences update
                response = await client.post(
                    "/api/v1/users/test-user/preferences",
                    json={
                        "experience_level": 6,
                        "preferred_topics": ["transformations", "joins"],
                        "difficulty_preference": "intermediate",
                        "session_length": 30
                    }
                )
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert data["experience_level"] == 6
                assert data["preferences"]["difficulty_preference"] == "intermediate"


class TestAuthenticationIntegration:
    """Integration tests for authentication and authorization."""
    
    @pytest.mark.asyncio
    async def test_unauthorized_access(self, client: AsyncClient):
        """Test unauthorized access to protected endpoints."""
        # Test without authentication
        response = await client.get("/api/v1/users/test-user/progress")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        response = await client.post("/api/v1/questions/generate", json={})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        response = await client.post("/api/v1/execution/execute", json={})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.asyncio
    async def test_forbidden_access(self, client: AsyncClient):
        """Test forbidden access to other users' data."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "user-1", "role": "user"}
            
            # Try to access another user's data
            response = await client.get("/api/v1/users/user-2/progress")
            assert response.status_code == status.HTTP_403_FORBIDDEN
    
    @pytest.mark.asyncio
    async def test_admin_access(self, client: AsyncClient):
        """Test admin access to any user's data."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "admin-user", "role": "admin"}
            
            with patch('app.services.user_service.UserService') as mock_service_class:
                mock_service = AsyncMock()
                mock_service_class.return_value = mock_service
                mock_service.get_user_progress.return_value = UserProgress(user_id="any-user")
                
                # Admin should be able to access any user's data
                response = await client.get("/api/v1/users/any-user/progress")
                assert response.status_code == status.HTTP_200_OK


class TestErrorHandlingIntegration:
    """Integration tests for error handling across endpoints."""
    
    @pytest.mark.asyncio
    async def test_service_unavailable_handling(self, client: AsyncClient):
        """Test handling of service unavailability."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            # Mock service failure
            with patch('app.services.user_service.UserService') as mock_service_class:
                mock_service = AsyncMock()
                mock_service_class.return_value = mock_service
                mock_service.get_user_progress.side_effect = Exception("Database connection failed")
                
                response = await client.get("/api/v1/users/test-user/progress")
                assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
                
                data = response.json()
                assert "Failed to retrieve user progress" in data["detail"]
    
    @pytest.mark.asyncio
    async def test_validation_error_handling(self, client: AsyncClient):
        """Test handling of validation errors."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            # Test invalid request data
            response = await client.post(
                "/api/v1/questions/generate",
                json={
                    "user_id": "test-user",
                    "difficulty": "invalid_difficulty",  # Invalid value
                    "topic": "transformations"
                }
            )
            
            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_not_found_handling(self, client: AsyncClient):
        """Test handling of not found resources."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            with patch('app.services.user_service.UserService') as mock_service_class:
                mock_service = AsyncMock()
                mock_service_class.return_value = mock_service
                mock_service.get_user_progress.return_value = None
                
                response = await client.get("/api/v1/users/nonexistent-user/progress")
                assert response.status_code == status.HTTP_404_NOT_FOUND


class TestPublicEndpointsIntegration:
    """Integration tests for public endpoints."""
    
    @pytest.mark.asyncio
    async def test_leaderboard_public_access(self, client: AsyncClient):
        """Test public leaderboard access."""
        with patch('app.services.progress_analytics.ProgressAnalyticsService') as mock_service_class:
            mock_service = AsyncMock()
            mock_service_class.return_value = mock_service
            
            # Mock leaderboard data
            mock_leaderboard = {
                "leaderboard": [
                    {
                        "rank": 1,
                        "user_id": "user_1",
                        "display_name": "Anonymous User 1",
                        "success_rate": 0.95,
                        "overall_proficiency": 8.5,
                        "questions_completed": 150
                    },
                    {
                        "rank": 2,
                        "user_id": "user_2",
                        "display_name": "Anonymous User 2",
                        "success_rate": 0.90,
                        "overall_proficiency": 8.0,
                        "questions_completed": 120
                    }
                ],
                "timeframe": "all",
                "total_users": 2
            }
            
            mock_service.get_leaderboard.return_value = mock_leaderboard
            
            # Test public leaderboard access (no auth required)
            response = await client.get("/api/v1/users/leaderboard?limit=10")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data["leaderboard"]) == 2
            assert data["leaderboard"][0]["rank"] == 1
            assert "Anonymous User" in data["leaderboard"][0]["display_name"]
    
    @pytest.mark.asyncio
    async def test_platform_stats_public_access(self, client: AsyncClient):
        """Test public platform statistics access."""
        with patch('app.services.progress_analytics.ProgressAnalyticsService') as mock_service_class:
            mock_service = AsyncMock()
            mock_service_class.return_value = mock_service
            
            # Mock platform stats
            mock_stats = {
                "total_users": 1250,
                "active_users_30d": 450,
                "total_solutions_submitted": 15000,
                "platform_average_success_rate": 0.75,
                "platform_average_proficiency": 6.2
            }
            
            mock_service.get_platform_stats.return_value = mock_stats
            
            # Test public stats access (no auth required)
            response = await client.get("/api/v1/users/stats")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["total_users"] == 1250
            assert data["active_users_30d"] == 450
            assert data["platform_average_success_rate"] == 0.75


class TestEndToEndWorkflows:
    """End-to-end integration tests for complete user workflows."""
    
    @pytest.mark.asyncio
    async def test_complete_learning_session_workflow(self, client: AsyncClient):
        """Test complete learning session from question generation to progress update."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            # Mock all required services
            with patch('app.services.question_generator.QuestionGenerator') as mock_q_gen, \
                 patch('app.services.execution_engine.ExecutionEngine') as mock_exec_engine, \
                 patch('app.services.user_service.UserService') as mock_user_service:
                
                # Setup mocks
                mock_q_gen_instance = AsyncMock()
                mock_q_gen.return_value = mock_q_gen_instance
                
                mock_exec_instance = AsyncMock()
                mock_exec_engine.return_value = mock_exec_instance
                
                mock_user_instance = AsyncMock()
                mock_user_service.return_value = mock_user_instance
                
                # Step 1: Generate question
                mock_question = Question(
                    id="workflow-question-1",
                    title="Data Transformation Challenge",
                    description="Transform customer data",
                    difficulty=DifficultyLevel.INTERMEDIATE,
                    topic=QuestionTopic.TRANSFORMATIONS,
                    starter_code="# Transform the data",
                    solution_code="df.select('*')",
                    test_cases=[],
                    expected_output="transformed data",
                    hints=["Use select and filter"],
                    time_limit=30,
                    memory_limit=512
                )
                
                mock_q_gen_instance.generate_question.return_value = mock_question
                
                question_response = await client.post(
                    "/api/v1/questions/generate",
                    json={
                        "user_id": "test-user",
                        "difficulty": "intermediate",
                        "topic": "transformations"
                    }
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
                    execution_time=12.0,
                    memory_usage=96.0,
                    output="Test execution successful"
                )
                
                mock_exec_instance.execute_code.return_value = mock_test_result
                
                test_response = await client.post(
                    "/api/v1/execution/execute",
                    json={
                        "user_id": "test-user",
                        "question_id": question_id,
                        "code": "df.select('customer_id', 'name').filter(df.active == True)",
                        "mode": "test"
                    }
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
                    execution_time=18.5,
                    memory_usage=128.0,
                    output="Final solution output",
                    validation_result=ValidationResult(
                        is_correct=True,
                        score=92.0,
                        feedback="Excellent solution! Well optimized."
                    )
                )
                
                mock_exec_instance.execute_code.return_value = mock_submit_result
                
                submit_response = await client.post(
                    "/api/v1/execution/execute",
                    json={
                        "user_id": "test-user",
                        "question_id": question_id,
                        "code": "df.select('customer_id', 'name').filter(df.active == True)",
                        "mode": "submit"
                    }
                )
                
                assert submit_response.status_code == status.HTTP_200_OK
                submit_data = submit_response.json()
                assert submit_data["validation_result"]["is_correct"] is True
                assert submit_data["validation_result"]["score"] == 92.0
                
                # Step 4: Check updated progress
                mock_updated_progress = UserProgress(
                    user_id="test-user",
                    experience_level=5,
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
                
                mock_user_instance.get_user_progress.return_value = mock_updated_progress
                
                progress_response = await client.get("/api/v1/users/test-user/progress")
                
                assert progress_response.status_code == status.HTTP_200_OK
                progress_data = progress_response.json()
                assert progress_data["total_questions_completed"] == 21
                assert progress_data["success_rate"] == 0.81
                assert progress_data["overall_proficiency"] == 6.7
                
                # Verify the complete workflow executed correctly
                mock_q_gen_instance.generate_question.assert_called_once()
                assert mock_exec_instance.execute_code.call_count == 2  # Test + Submit
                mock_user_instance.get_user_progress.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_error_recovery_workflow(self, client: AsyncClient):
        """Test error recovery in multi-step workflows."""
        with patch('app.core.auth.get_current_user_required') as mock_auth:
            mock_auth.return_value = {"user_id": "test-user", "role": "user"}
            
            # Test scenario where question generation succeeds but execution fails
            with patch('app.services.question_generator.QuestionGenerator') as mock_q_gen, \
                 patch('app.services.execution_engine.ExecutionEngine') as mock_exec_engine:
                
                mock_q_gen_instance = AsyncMock()
                mock_q_gen.return_value = mock_q_gen_instance
                
                mock_exec_instance = AsyncMock()
                mock_exec_engine.return_value = mock_exec_instance
                
                # Question generation succeeds
                mock_question = Question(
                    id="error-test-question",
                    title="Error Test Question",
                    difficulty=DifficultyLevel.BEGINNER,
                    topic=QuestionTopic.TRANSFORMATIONS
                )
                
                mock_q_gen_instance.generate_question.return_value = mock_question
                
                question_response = await client.post(
                    "/api/v1/questions/generate",
                    json={
                        "user_id": "test-user",
                        "difficulty": "beginner",
                        "topic": "transformations"
                    }
                )
                
                assert question_response.status_code == status.HTTP_200_OK
                
                # Execution fails
                mock_exec_instance.execute_code.side_effect = Exception("Container startup failed")
                
                execution_response = await client.post(
                    "/api/v1/execution/execute",
                    json={
                        "user_id": "test-user",
                        "question_id": "error-test-question",
                        "code": "df.select('*')",
                        "mode": "test"
                    }
                )
                
                # Should handle execution error gracefully
                assert execution_response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
                error_data = execution_response.json()
                assert "Failed to execute code" in error_data["detail"]
                
                # User should still be able to access other endpoints
                with patch('app.services.user_service.UserService') as mock_user_service:
                    mock_user_instance = AsyncMock()
                    mock_user_service.return_value = mock_user_instance
                    mock_user_instance.get_user_progress.return_value = UserProgress(user_id="test-user")
                    
                    progress_response = await client.get("/api/v1/users/test-user/progress")
                    assert progress_response.status_code == status.HTTP_200_OK