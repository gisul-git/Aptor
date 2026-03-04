"""
Unit tests for the CodeReviewer service.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.services.code_reviewer import CodeReviewer, get_code_reviewer, CodeReviewError
from app.models.execution import ExecutionResult, ExecutionStatus, ExecutionMode, ValidationResult, CodeReview
from app.services.ai_service import RateLimitError, APIError


@pytest.fixture
def code_reviewer():
    """Create a CodeReviewer instance for testing."""
    return CodeReviewer()


@pytest.fixture
def sample_execution_result():
    """Create a sample execution result for testing."""
    validation_result = ValidationResult(
        is_correct=True,
        schema_match=True,
        row_count_match=True,
        data_match=True,
        similarity_score=0.95,
        error_details=[]
    )
    
    return ExecutionResult(
        job_id="test-job-123",
        status=ExecutionStatus.COMPLETED,
        mode=ExecutionMode.SUBMIT,
        execution_time=2.5,
        memory_usage=128.0,
        validation_result=validation_result,
        completed_at=datetime.utcnow()
    )


@pytest.fixture
def sample_code():
    """Sample PySpark code for testing."""
    return """
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum

spark = SparkSession.builder.getOrCreate()

# Read input data
df = spark.createDataFrame([
    {"name": "Alice", "age": 25, "salary": 50000},
    {"name": "Bob", "age": 30, "salary": 60000}
])

# Perform transformation
result = df.groupBy("age").agg(sum("salary").alias("total_salary"))
result.show()
"""


@pytest.fixture
def mock_ai_service():
    """Mock AI service for testing."""
    mock_service = AsyncMock()
    mock_service.review_code.return_value = {
        "overall_score": 8.5,
        "correctness_feedback": "The solution is correct and handles the requirements well.",
        "performance_feedback": "Good use of PySpark operations. Consider caching for repeated operations.",
        "best_practices_feedback": "Code follows PySpark best practices with proper imports and session management.",
        "improvement_suggestions": [
            "Add error handling for edge cases",
            "Consider using more descriptive variable names",
            "Add comments to explain complex operations"
        ],
        "code_examples": [
            {
                "description": "Adding error handling",
                "improved_code": "try:\n    result = df.groupBy('age').agg(sum('salary').alias('total_salary'))\nexcept Exception as e:\n    print(f'Error: {e}')",
                "explanation": "Adding try-catch blocks helps handle potential errors gracefully"
            }
        ],
        "alternative_approaches": [
            {
                "approach": "SQL-based approach",
                "description": "Using Spark SQL instead of DataFrame API",
                "code_example": "spark.sql('SELECT age, SUM(salary) as total_salary FROM table GROUP BY age')",
                "pros_cons": "SQL approach is more readable for complex queries but DataFrame API offers better type safety"
            }
        ],
        "strengths": [
            "Proper use of PySpark DataFrame API",
            "Correct aggregation logic"
        ],
        "areas_for_improvement": [
            "Error handling could be improved",
            "Variable naming could be more descriptive"
        ]
    }
    return mock_service


class TestCodeReviewer:
    """Test cases for CodeReviewer class."""
    
    @pytest.mark.asyncio
    async def test_review_solution_success(self, code_reviewer, sample_code, sample_execution_result, mock_ai_service):
        """Test successful code review generation."""
        # Replace the AI service instance in the code reviewer
        code_reviewer.ai_service = mock_ai_service
        
        with patch.object(code_reviewer, '_get_cached_review', return_value=None):
            with patch.object(code_reviewer, '_cache_review', return_value=None):
                
                review = await code_reviewer.review_solution(
                    user_id="test-user",
                    code=sample_code,
                    question_title="Test Question",
                    question_description="A test question for PySpark",
                    execution_result=sample_execution_result,
                    question_difficulty="intermediate",
                    question_topic="aggregations"
                )
                
                # Verify review structure
                assert isinstance(review, CodeReview)
                assert 0.0 <= review.overall_score <= 10.0
                assert review.correctness_feedback
                assert review.performance_feedback
                assert review.best_practices_feedback
                assert isinstance(review.improvement_suggestions, list)
                assert isinstance(review.code_examples, list)
                assert isinstance(review.alternative_approaches, list)
                assert isinstance(review.strengths, list)
                assert isinstance(review.areas_for_improvement, list)
                assert review.analysis_time >= 0
                assert review.model_used
                assert review.reviewed_at
    
    @pytest.mark.asyncio
    async def test_review_solution_with_cache_hit(self, code_reviewer, sample_code, sample_execution_result):
        """Test code review with cache hit."""
        cached_review = CodeReview(
            overall_score=9.0,
            correctness_feedback="Cached feedback",
            performance_feedback="Cached performance feedback",
            best_practices_feedback="Cached best practices feedback",
            improvement_suggestions=["Cached suggestion"],
            code_examples=[],
            alternative_approaches=[],
            strengths=["Cached strength"],
            areas_for_improvement=["Cached improvement"],
            analysis_time=1.0,
            model_used="cached-model",
            reviewed_at=datetime.utcnow()
        )
        
        with patch.object(code_reviewer, '_get_cached_review', return_value=cached_review):
            review = await code_reviewer.review_solution(
                user_id="test-user",
                code=sample_code,
                question_title="Test Question",
                question_description="A test question",
                execution_result=sample_execution_result
            )
            
            assert review.correctness_feedback == "Cached feedback"
            assert review.overall_score == 9.0
    
    @pytest.mark.asyncio
    async def test_review_solution_rate_limit_error(self, code_reviewer, sample_code, sample_execution_result, mock_ai_service):
        """Test code review with rate limit error."""
        mock_ai_service.review_code.side_effect = RateLimitError("Rate limit exceeded")
        code_reviewer.ai_service = mock_ai_service
        
        with patch.object(code_reviewer, '_get_cached_review', return_value=None):
            
            with pytest.raises(RateLimitError):
                await code_reviewer.review_solution(
                    user_id="test-user",
                    code=sample_code,
                    question_title="Test Question",
                    question_description="A test question",
                    execution_result=sample_execution_result
                )
    
    @pytest.mark.asyncio
    async def test_review_solution_api_error(self, code_reviewer, sample_code, sample_execution_result, mock_ai_service):
        """Test code review with API error."""
        mock_ai_service.review_code.side_effect = APIError("API call failed")
        code_reviewer.ai_service = mock_ai_service
        
        with patch.object(code_reviewer, '_get_cached_review', return_value=None):
            
            with pytest.raises(APIError):
                await code_reviewer.review_solution(
                    user_id="test-user",
                    code=sample_code,
                    question_title="Test Question",
                    question_description="A test question",
                    execution_result=sample_execution_result
                )
    
    @pytest.mark.asyncio
    async def test_review_solution_general_error(self, code_reviewer, sample_code, sample_execution_result, mock_ai_service):
        """Test code review with general error."""
        mock_ai_service.review_code.side_effect = Exception("Unexpected error")
        code_reviewer.ai_service = mock_ai_service
        
        with patch.object(code_reviewer, '_get_cached_review', return_value=None):
            
            with pytest.raises(CodeReviewError):
                await code_reviewer.review_solution(
                    user_id="test-user",
                    code=sample_code,
                    question_title="Test Question",
                    question_description="A test question",
                    execution_result=sample_execution_result
                )
    
    def test_analyze_code_patterns(self, code_reviewer, sample_code):
        """Test code pattern analysis."""
        patterns = code_reviewer._analyze_code_patterns(sample_code)
        
        assert isinstance(patterns, dict)
        assert patterns['has_imports'] is True
        assert patterns['uses_spark_session'] is True
        assert patterns['uses_dataframe_ops'] is True
        assert patterns['line_count'] > 0
        assert patterns['has_comments'] is True
    
    def test_analyze_code_patterns_with_performance_issues(self, code_reviewer):
        """Test code pattern analysis with performance issues."""
        code_with_issues = """
from pyspark.sql import SparkSession
spark = SparkSession.builder.getOrCreate()
df = spark.createDataFrame([{"a": 1}])
result = df.collect()  # Performance issue
result.show()
"""
        
        patterns = code_reviewer._analyze_code_patterns(code_with_issues)
        
        assert patterns['uses_collect'] is True
        assert patterns['uses_show'] is True
    
    def test_prepare_execution_context(self, code_reviewer, sample_execution_result):
        """Test execution context preparation."""
        context = code_reviewer._prepare_execution_context(
            sample_execution_result,
            "intermediate",
            "aggregations"
        )
        
        assert context['execution_successful'] is True
        assert context['validation_passed'] is True
        assert context['difficulty_level'] == "intermediate"
        assert context['topic_area'] == "aggregations"
        assert 'execution_time' in context
        assert 'memory_usage' in context
    
    def test_prepare_execution_context_with_failed_execution(self, code_reviewer):
        """Test execution context preparation with failed execution."""
        failed_result = ExecutionResult(
            job_id="failed-job",
            status=ExecutionStatus.FAILED,
            mode=ExecutionMode.SUBMIT,
            execution_time=0.0,
            memory_usage=0.0,
            error_message="Execution failed",
            completed_at=datetime.utcnow()
        )
        
        context = code_reviewer._prepare_execution_context(failed_result, None, None)
        
        assert context['execution_successful'] is False
        assert context['validation_passed'] is False
    
    def test_format_execution_context(self, code_reviewer):
        """Test execution context formatting."""
        context = {
            'execution_successful': True,
            'execution_time': 2.5,
            'memory_usage': 128.0,
            'validation_passed': True,
            'difficulty_level': 'intermediate',
            'topic_area': 'aggregations'
        }
        
        formatted = code_reviewer._format_execution_context(context)
        
        assert "Execution Status: Success" in formatted
        assert "Execution Time: 2.50 seconds" in formatted
        assert "Memory Usage: 128.00 MB" in formatted
        assert "Validation Passed: Yes" in formatted
        assert "Difficulty Level: intermediate" in formatted
        assert "Topic Area: aggregations" in formatted
    
    def test_format_code_patterns(self, code_reviewer):
        """Test code patterns formatting."""
        patterns = {
            'line_count': 10,
            'has_imports': True,
            'uses_spark_session': True,
            'uses_dataframe_ops': True,
            'uses_sql': False,
            'has_error_handling': False,
            'uses_caching': False,
            'has_comments': True,
            'uses_collect': True
        }
        
        formatted = code_reviewer._format_code_patterns(patterns)
        
        assert "Code Length: 10 lines" in formatted
        assert "Has Imports: Yes" in formatted
        assert "Uses Spark Session: Yes" in formatted
        assert "Uses DataFrame Operations: Yes" in formatted
        assert "Uses SQL: No" in formatted
        assert "WARNING: Uses .collect()" in formatted
    
    def test_process_ai_review(self, code_reviewer):
        """Test AI review data processing."""
        ai_data = {
            "overall_score": 8.5,
            "correctness_feedback": "Good solution",
            "performance_feedback": "Could be optimized",
            "best_practices_feedback": "Follows best practices",
            "improvement_suggestions": ["Add error handling", "Use better names"],
            "code_examples": [
                {
                    "description": "Error handling example",
                    "improved_code": "try: ...",
                    "explanation": "This adds error handling"
                }
            ],
            "alternative_approaches": [
                {
                    "approach": "SQL approach",
                    "description": "Use SQL instead",
                    "code_example": "SELECT ...",
                    "pros_cons": "More readable"
                }
            ],
            "strengths": ["Good logic"],
            "areas_for_improvement": ["Error handling"]
        }
        
        review = code_reviewer._process_ai_review(ai_data, 0.0)
        
        assert isinstance(review, CodeReview)
        assert review.overall_score == 8.5
        assert review.correctness_feedback == "Good solution"
        assert len(review.improvement_suggestions) == 2
        assert len(review.code_examples) == 1
        assert len(review.alternative_approaches) == 1
        assert len(review.strengths) == 1
        assert len(review.areas_for_improvement) == 1
    
    def test_process_ai_review_with_invalid_score(self, code_reviewer):
        """Test AI review processing with invalid score."""
        ai_data = {
            "overall_score": 15.0,  # Invalid score > 10
            "correctness_feedback": "Good solution",
            "performance_feedback": "Could be optimized",
            "best_practices_feedback": "Follows best practices"
        }
        
        review = code_reviewer._process_ai_review(ai_data, 0.0)
        
        # Score should be clamped to 10.0
        assert review.overall_score == 10.0
    
    def test_process_ai_review_with_missing_fields(self, code_reviewer):
        """Test AI review processing with missing fields."""
        ai_data = {
            "overall_score": 7.0
            # Missing other required fields
        }
        
        review = code_reviewer._process_ai_review(ai_data, 0.0)
        
        assert review.overall_score == 7.0
        assert review.correctness_feedback.startswith("No correctness feedback")
        assert review.performance_feedback.startswith("No performance feedback")
        assert review.best_practices_feedback.startswith("No best practices feedback")
        assert isinstance(review.improvement_suggestions, list)
        assert isinstance(review.code_examples, list)
        assert isinstance(review.alternative_approaches, list)
    
    def test_generate_cache_key(self, code_reviewer, sample_code, sample_execution_result):
        """Test cache key generation."""
        key1 = code_reviewer._generate_cache_key(sample_code, "Question 1", sample_execution_result)
        key2 = code_reviewer._generate_cache_key(sample_code, "Question 1", sample_execution_result)
        key3 = code_reviewer._generate_cache_key(sample_code, "Question 2", sample_execution_result)
        
        # Same inputs should generate same key
        assert key1 == key2
        
        # Different inputs should generate different keys
        assert key1 != key3
        
        # Key should have expected format
        assert key1.startswith("code_review:")
        assert len(key1.split(":")[1]) == 16  # 16-character hash
    
    @pytest.mark.asyncio
    async def test_get_review_statistics_no_data(self, code_reviewer):
        """Test getting review statistics with no data."""
        with patch('app.services.code_reviewer.get_redis') as mock_redis:
            mock_redis_client = AsyncMock()
            mock_redis_client.get.return_value = None
            mock_redis.return_value = mock_redis_client
            
            stats = await code_reviewer.get_review_statistics("test-user")
            
            assert stats["total_reviews"] == 0
            assert stats["average_score"] == 0.0
            assert stats["reviews_this_month"] == 0
            assert stats["improvement_trend"] == "no_data"
    
    @pytest.mark.asyncio
    async def test_get_review_statistics_with_data(self, code_reviewer):
        """Test getting review statistics with existing data."""
        import json
        
        stats_data = {
            "total_reviews": 5,
            "average_score": 7.5,
            "reviews_this_month": 2,
            "improvement_trend": "improving"
        }
        
        with patch('app.services.code_reviewer.get_redis') as mock_redis:
            mock_redis_client = AsyncMock()
            mock_redis_client.get.return_value = json.dumps(stats_data)
            mock_redis.return_value = mock_redis_client
            
            stats = await code_reviewer.get_review_statistics("test-user")
            
            assert stats["total_reviews"] == 5
            assert stats["average_score"] == 7.5
            assert stats["reviews_this_month"] == 2
            assert stats["improvement_trend"] == "improving"
    
    def test_get_code_reviewer_singleton(self):
        """Test that get_code_reviewer returns the same instance."""
        reviewer1 = get_code_reviewer()
        reviewer2 = get_code_reviewer()
        
        assert reviewer1 is reviewer2
        assert isinstance(reviewer1, CodeReviewer)


class TestCodeReviewerIntegration:
    """Integration tests for CodeReviewer with real components."""
    
    @pytest.mark.asyncio
    async def test_full_review_workflow(self, sample_code, sample_execution_result):
        """Test complete review workflow with mocked dependencies."""
        code_reviewer = CodeReviewer()
        
        # Create mock AI service
        mock_ai_service = AsyncMock()
        mock_ai_service.review_code.return_value = {
            "overall_score": 8.0,
            "correctness_feedback": "Solution is correct",
            "performance_feedback": "Good performance",
            "best_practices_feedback": "Follows best practices",
            "improvement_suggestions": ["Add comments"],
            "code_examples": [],
            "alternative_approaches": [],
            "strengths": ["Good logic"],
            "areas_for_improvement": ["Documentation"]
        }
        
        # Replace AI service in code reviewer
        code_reviewer.ai_service = mock_ai_service
        
        # Mock cache manager
        with patch('app.services.code_reviewer.CacheManager') as mock_cache:
            mock_cache.get_cache.return_value = None
            mock_cache.set_cache.return_value = None
            
            # Perform review
            review = await code_reviewer.review_solution(
                user_id="integration-test-user",
                code=sample_code,
                question_title="Integration Test Question",
                question_description="Testing the full workflow",
                execution_result=sample_execution_result,
                question_difficulty="intermediate",
                question_topic="transformations"
            )
            
            # Verify results
            assert isinstance(review, CodeReview)
            assert review.overall_score == 8.0
            assert review.correctness_feedback == "Solution is correct"
            assert review.performance_feedback == "Good performance"
            assert review.best_practices_feedback == "Follows best practices"
            assert "Add comments" in review.improvement_suggestions
            assert "Good logic" in review.strengths
            assert "Documentation" in review.areas_for_improvement
            assert review.analysis_time >= 0
            assert review.reviewed_at is not None
            
            # Verify AI service was called
            mock_ai_service.review_code.assert_called_once()
            call_args = mock_ai_service.review_code.call_args
            assert call_args[1]['user_id'] == "integration-test-user"
            assert call_args[1]['question_title'] == "Integration Test Question"
            
            # Verify caching was attempted
            mock_cache.get_cache.assert_called_once()
            mock_cache.set_cache.assert_called_once()