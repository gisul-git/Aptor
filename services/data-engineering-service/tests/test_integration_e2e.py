"""
End-to-end integration tests for the complete Data Engineer Assessment Platform.
Tests complete user workflows from question generation to submission and review.
"""

import pytest
import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List

from app.models.question import Question
from app.models.execution import ExecutionResult, ExecutionMode, ExecutionStatus
from app.models.user import UserProgress
from app.services.integration_service import IntegrationService
from app.core.service_factory import ServiceFactory
from app.core.monitoring import get_monitoring_system, MetricType, AlertLevel
from app.core.error_handler import get_error_handler, ErrorCategory, ErrorSeverity


class TestEndToEndWorkflows:
    """Test complete user workflows end-to-end."""
    
    @pytest.fixture
    async def integration_service(self):
        """Get integration service for testing."""
        factory = ServiceFactory()
        await factory.initialize()
        return factory.get_service('integration')
    
    @pytest.fixture
    def sample_pyspark_code(self):
        """Sample PySpark code for testing."""
        return """
from pyspark.sql import SparkSession
from pyspark.sql.functions import *

def solve(df):
    # Simple transformation for testing
    result = df.select("*").limit(10)
    return result
"""
    
    @pytest.fixture
    def invalid_pyspark_code(self):
        """Invalid PySpark code for error testing."""
        return """
from pyspark.sql import SparkSession

def solve(df):
    # This will cause a syntax error
    result = df.select("invalid_column_that_does_not_exist")
    return result
"""
    
    async def test_complete_practice_workflow(self, integration_service: IntegrationService, sample_pyspark_code: str):
        """Test complete practice workflow: question generation -> code execution -> validation."""
        user_id = f"test_user_{uuid.uuid4()}"
        
        # Step 1: Generate personalized question
        question = await integration_service.generate_personalized_question(
            user_id=user_id,
            experience_level=3,
            topic="transformations"
        )
        
        assert question is not None
        assert question.id is not None
        assert question.title is not None
        assert question.description is not None
        assert question.sample_input is not None
        assert question.expected_output is not None
        
        # Step 2: Execute code in test mode
        test_result = await integration_service.execute_solution(
            user_id=user_id,
            question_id=question.id,
            code=sample_pyspark_code,
            mode=ExecutionMode.TEST
        )
        
        assert test_result is not None
        assert test_result.job_id is not None
        assert test_result.user_id == user_id
        assert test_result.question_id == question.id
        assert test_result.mode == ExecutionMode.TEST
        
        # Wait for execution to complete (with timeout)
        max_wait = 60  # 60 seconds
        wait_time = 0
        while test_result.status in [ExecutionStatus.PENDING, ExecutionStatus.RUNNING] and wait_time < max_wait:
            await asyncio.sleep(2)
            wait_time += 2
            test_result = await integration_service.get_execution_status(test_result.job_id)
        
        assert test_result.status in [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED]
        
        # Step 3: Submit solution for full review
        submit_result = await integration_service.execute_solution(
            user_id=user_id,
            question_id=question.id,
            code=sample_pyspark_code,
            mode=ExecutionMode.SUBMIT
        )
        
        assert submit_result is not None
        assert submit_result.mode == ExecutionMode.SUBMIT
        
        # Wait for submission to complete
        wait_time = 0
        while submit_result.status in [ExecutionStatus.PENDING, ExecutionStatus.RUNNING] and wait_time < max_wait:
            await asyncio.sleep(2)
            wait_time += 2
            submit_result = await integration_service.get_execution_status(submit_result.job_id)
        
        assert submit_result.status in [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED]
        
        # Step 4: Verify user progress was updated
        user_progress = await integration_service.user_repo.get_user_progress(user_id)
        assert user_progress is not None
        
        # Step 5: Get dashboard data
        dashboard_data = await integration_service.get_user_dashboard_data(user_id)
        assert dashboard_data is not None
        assert "user_progress" in dashboard_data
        assert "recommendations" in dashboard_data
    
    async def test_error_handling_workflow(self, integration_service: IntegrationService, invalid_pyspark_code: str):
        """Test error handling throughout the workflow."""
        user_id = f"test_user_{uuid.uuid4()}"
        
        # Generate question
        question = await integration_service.generate_personalized_question(
            user_id=user_id,
            experience_level=2
        )
        
        # Execute invalid code
        result = await integration_service.execute_solution(
            user_id=user_id,
            question_id=question.id,
            code=invalid_pyspark_code,
            mode=ExecutionMode.TEST
        )
        
        # Wait for execution to complete
        max_wait = 60
        wait_time = 0
        while result.status in [ExecutionStatus.PENDING, ExecutionStatus.RUNNING] and wait_time < max_wait:
            await asyncio.sleep(2)
            wait_time += 2
            result = await integration_service.get_execution_status(result.job_id)
        
        # Should fail gracefully
        assert result.status == ExecutionStatus.FAILED
        assert result.error_message is not None
        
        # Verify error was logged and tracked
        error_handler = get_error_handler()
        error_metrics = await error_handler.get_error_metrics()
        assert error_metrics is not None
    
    async def test_concurrent_user_workflow(self, integration_service: IntegrationService, sample_pyspark_code: str):
        """Test system behavior with multiple concurrent users."""
        num_users = 5
        user_ids = [f"test_user_{uuid.uuid4()}" for _ in range(num_users)]
        
        # Create concurrent tasks for multiple users
        async def user_workflow(user_id: str):
            # Generate question
            question = await integration_service.generate_personalized_question(
                user_id=user_id,
                experience_level=2
            )
            
            # Execute code
            result = await integration_service.execute_solution(
                user_id=user_id,
                question_id=question.id,
                code=sample_pyspark_code,
                mode=ExecutionMode.TEST
            )
            
            return result
        
        # Run concurrent workflows
        tasks = [user_workflow(user_id) for user_id in user_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Verify all workflows completed
        successful_results = [r for r in results if isinstance(r, ExecutionResult)]
        assert len(successful_results) == num_users
        
        # Verify no resource conflicts
        job_ids = [r.job_id for r in successful_results]
        assert len(set(job_ids)) == num_users  # All unique job IDs
    
    async def test_system_health_monitoring(self, integration_service: IntegrationService):
        """Test system health monitoring and alerting."""
        # Get system health
        health_status = await integration_service.get_system_health()
        
        assert health_status is not None
        assert "status" in health_status
        assert "components" in health_status
        assert "timestamp" in health_status
        
        # Verify key components are monitored
        components = health_status["components"]
        expected_components = [
            "execution_engine",
            "ai_services", 
            "cache",
            "auto_scaler",
            "cost_optimizer"
        ]
        
        for component in expected_components:
            assert component in components
    
    async def test_monitoring_metrics_collection(self):
        """Test monitoring system metrics collection."""
        monitoring = get_monitoring_system()
        
        # Record test metrics
        await monitoring.record_metric("test.counter", 1.0, MetricType.COUNTER)
        await monitoring.record_metric("test.gauge", 50.0, MetricType.GAUGE)
        
        # Retrieve metrics
        counter_metric = await monitoring.get_metric("test.counter")
        gauge_metric = await monitoring.get_metric("test.gauge")
        
        assert counter_metric is not None
        assert counter_metric.value == 1.0
        assert counter_metric.metric_type == MetricType.COUNTER
        
        assert gauge_metric is not None
        assert gauge_metric.value == 50.0
        assert gauge_metric.metric_type == MetricType.GAUGE
    
    async def test_alert_system(self):
        """Test alert creation and management."""
        monitoring = get_monitoring_system()
        
        # Create test alert
        alert = await monitoring.create_alert(
            level=AlertLevel.WARNING,
            title="Test Alert",
            message="This is a test alert for integration testing",
            source="integration_test"
        )
        
        assert alert is not None
        assert alert.id is not None
        assert alert.level == AlertLevel.WARNING
        assert alert.title == "Test Alert"
        
        # Retrieve alerts
        alerts = await monitoring.get_alerts(level=AlertLevel.WARNING, limit=10)
        assert len(alerts) > 0
        
        # Find our test alert
        test_alert = next((a for a in alerts if a.id == alert.id), None)
        assert test_alert is not None
        assert test_alert.source == "integration_test"
    
    async def test_caching_integration(self, integration_service: IntegrationService):
        """Test caching integration across the system."""
        user_id = f"test_user_{uuid.uuid4()}"
        
        # Generate question (should be cached)
        question1 = await integration_service.generate_personalized_question(
            user_id=user_id,
            experience_level=3,
            topic="joins"
        )
        
        # Generate same question again (should use cache)
        question2 = await integration_service.generate_personalized_question(
            user_id=user_id,
            experience_level=3,
            topic="joins"
        )
        
        # Questions should be identical (from cache)
        assert question1.id == question2.id
        assert question1.title == question2.title
    
    async def test_cost_optimization_integration(self, integration_service: IntegrationService):
        """Test cost optimization features."""
        user_id = f"test_user_{uuid.uuid4()}"
        
        # Generate multiple questions to trigger cost tracking
        for i in range(3):
            await integration_service.generate_personalized_question(
                user_id=user_id,
                experience_level=2
            )
        
        # Trigger cost optimization
        await integration_service.cost_optimizer.cleanup_idle_resources()
        
        # Verify cost tracking is working
        cost_status = await integration_service.cost_optimizer.get_status()
        assert cost_status is not None
    
    async def test_auto_scaling_integration(self, integration_service: IntegrationService):
        """Test auto-scaling integration."""
        # Check auto-scaler status
        scaler_status = await integration_service.auto_scaler.get_status()
        assert scaler_status is not None
        
        # Ensure capacity
        await integration_service.auto_scaler.ensure_capacity()
        
        # Verify scaling operations
        assert True  # Basic verification that scaling doesn't crash
    
    async def test_data_persistence_integration(self, integration_service: IntegrationService, sample_pyspark_code: str):
        """Test data persistence across the workflow."""
        user_id = f"test_user_{uuid.uuid4()}"
        
        # Generate and store question
        question = await integration_service.generate_personalized_question(
            user_id=user_id,
            experience_level=4
        )
        
        # Verify question was stored
        stored_question = await integration_service.question_repo.get_question(question.id)
        assert stored_question is not None
        assert stored_question.id == question.id
        
        # Execute and submit solution
        result = await integration_service.execute_solution(
            user_id=user_id,
            question_id=question.id,
            code=sample_pyspark_code,
            mode=ExecutionMode.SUBMIT
        )
        
        # Wait for completion
        max_wait = 60
        wait_time = 0
        while result.status in [ExecutionStatus.PENDING, ExecutionStatus.RUNNING] and wait_time < max_wait:
            await asyncio.sleep(2)
            wait_time += 2
            result = await integration_service.get_execution_status(result.job_id)
        
        # Verify execution was stored
        stored_execution = await integration_service.execution_repo.get_execution(result.job_id)
        assert stored_execution is not None
        assert stored_execution.job_id == result.job_id
        
        # Verify user progress was updated and stored
        user_progress = await integration_service.user_repo.get_user_progress(user_id)
        assert user_progress is not None
        assert user_progress.user_id == user_id


class TestLoadAndStress:
    """Test system behavior under load and stress conditions."""
    
    @pytest.fixture
    async def integration_service(self):
        """Get integration service for testing."""
        factory = ServiceFactory()
        await factory.initialize()
        return factory.get_service('integration')
    
    @pytest.mark.slow
    async def test_high_load_question_generation(self, integration_service: IntegrationService):
        """Test system under high load for question generation."""
        num_requests = 20
        user_id = f"load_test_user_{uuid.uuid4()}"
        
        async def generate_question():
            return await integration_service.generate_personalized_question(
                user_id=user_id,
                experience_level=3
            )
        
        # Generate many questions concurrently
        tasks = [generate_question() for _ in range(num_requests)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count successful generations
        successful = [r for r in results if isinstance(r, Question)]
        failed = [r for r in results if isinstance(r, Exception)]
        
        # Should handle most requests successfully
        success_rate = len(successful) / num_requests
        assert success_rate >= 0.8  # At least 80% success rate
        
        # Log any failures for analysis
        if failed:
            print(f"Failed requests: {len(failed)}")
            for failure in failed[:3]:  # Show first 3 failures
                print(f"Failure: {failure}")
    
    @pytest.mark.slow
    async def test_concurrent_execution_load(self, integration_service: IntegrationService):
        """Test system under concurrent execution load."""
        num_executions = 10
        
        # Simple test code
        test_code = """
def solve(df):
    return df.limit(5)
"""
        
        # Generate a question first
        question = await integration_service.generate_personalized_question(
            user_id="load_test_user",
            experience_level=2
        )
        
        async def execute_code():
            user_id = f"exec_user_{uuid.uuid4()}"
            return await integration_service.execute_solution(
                user_id=user_id,
                question_id=question.id,
                code=test_code,
                mode=ExecutionMode.TEST
            )
        
        # Execute many requests concurrently
        tasks = [execute_code() for _ in range(num_executions)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count successful executions
        successful = [r for r in results if isinstance(r, ExecutionResult)]
        failed = [r for r in results if isinstance(r, Exception)]
        
        # Should handle most requests successfully
        success_rate = len(successful) / num_executions
        assert success_rate >= 0.7  # At least 70% success rate under load
        
        if failed:
            print(f"Failed executions: {len(failed)}")
    
    async def test_memory_usage_monitoring(self, integration_service: IntegrationService):
        """Test memory usage doesn't grow excessively during operations."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss
        
        # Perform multiple operations
        user_id = f"memory_test_user_{uuid.uuid4()}"
        
        for i in range(10):
            question = await integration_service.generate_personalized_question(
                user_id=user_id,
                experience_level=2
            )
            
            # Get dashboard data
            await integration_service.get_user_dashboard_data(user_id)
        
        final_memory = process.memory_info().rss
        memory_growth = final_memory - initial_memory
        
        # Memory growth should be reasonable (less than 100MB)
        assert memory_growth < 100 * 1024 * 1024  # 100MB
    
    async def test_error_recovery_under_load(self, integration_service: IntegrationService):
        """Test error recovery mechanisms under load."""
        error_handler = get_error_handler()
        
        # Simulate multiple errors
        for i in range(5):
            try:
                raise ValueError(f"Test error {i}")
            except Exception as e:
                await error_handler.handle_error(
                    exception=e,
                    category=ErrorCategory.SYSTEM,
                    severity=ErrorSeverity.MEDIUM,
                    context={"test": True, "iteration": i}
                )
        
        # Verify error metrics
        error_metrics = await error_handler.get_error_metrics()
        assert error_metrics is not None
        
        # System should still be functional
        health_status = await integration_service.get_system_health()
        assert health_status["status"] in ["healthy", "degraded"]  # Not completely failed


class TestDataConsistency:
    """Test data consistency across the system."""
    
    @pytest.fixture
    async def integration_service(self):
        """Get integration service for testing."""
        factory = ServiceFactory()
        await factory.initialize()
        return factory.get_service('integration')
    
    async def test_user_progress_consistency(self, integration_service: IntegrationService):
        """Test user progress data consistency."""
        user_id = f"consistency_test_user_{uuid.uuid4()}"
        
        # Generate question and submit solution
        question = await integration_service.generate_personalized_question(
            user_id=user_id,
            experience_level=3
        )
        
        test_code = """
def solve(df):
    return df.select("*").limit(10)
"""
        
        result = await integration_service.execute_solution(
            user_id=user_id,
            question_id=question.id,
            code=test_code,
            mode=ExecutionMode.SUBMIT
        )
        
        # Wait for completion
        max_wait = 60
        wait_time = 0
        while result.status in [ExecutionStatus.PENDING, ExecutionStatus.RUNNING] and wait_time < max_wait:
            await asyncio.sleep(2)
            wait_time += 2
            result = await integration_service.get_execution_status(result.job_id)
        
        # Get user progress from different sources
        progress_direct = await integration_service.user_repo.get_user_progress(user_id)
        dashboard_data = await integration_service.get_user_dashboard_data(user_id)
        progress_dashboard = dashboard_data.get("user_progress")
        
        # Progress should be consistent
        if progress_direct and progress_dashboard:
            assert progress_direct.user_id == progress_dashboard["user_id"]
            assert progress_direct.experience_level == progress_dashboard["experience_level"]
    
    async def test_cache_consistency(self, integration_service: IntegrationService):
        """Test cache consistency with database."""
        user_id = f"cache_test_user_{uuid.uuid4()}"
        
        # Generate question (creates cache entry)
        question = await integration_service.generate_personalized_question(
            user_id=user_id,
            experience_level=2,
            topic="aggregations"
        )
        
        # Get question from database directly
        db_question = await integration_service.question_repo.get_question(question.id)
        
        # Should be consistent
        assert question.id == db_question.id
        assert question.title == db_question.title
        assert question.description == db_question.description


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])