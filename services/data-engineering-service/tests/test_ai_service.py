"""
Unit tests for AI service wrapper.
Tests specific prompt templates, response parsing, error handling, and fallback mechanisms.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
import time
import httpx

from app.services.ai_service import (
    AIService,
    AIServiceError,
    RateLimitError,
    APIError,
    ExperienceLevel,
    RateLimitInfo
)
from app.core.config import settings


class TestPromptTemplates:
    """Test cases for prompt template generation and validation."""
    
    @pytest.fixture
    def ai_service(self):
        """Create AIService instance for testing."""
        return AIService()
    
    def test_question_prompt_contains_required_elements(self, ai_service):
        """Test that question prompts contain all required elements."""
        for level in ExperienceLevel:
            prompt = ai_service._get_question_prompt(level)
            
            # Check for required sections
            assert "You are an expert data engineer" in prompt
            assert "Requirements:" in prompt
            assert "Output Format (JSON):" in prompt
            assert "input_schema" in prompt
            assert "sample_input" in prompt
            assert "expected_output" in prompt
            assert "test_cases" in prompt
    
    def test_question_prompt_experience_level_specificity(self, ai_service):
        """Test that prompts are specific to experience levels."""
        beginner_prompt = ai_service._get_question_prompt(ExperienceLevel.BEGINNER)
        intermediate_prompt = ai_service._get_question_prompt(ExperienceLevel.INTERMEDIATE)
        advanced_prompt = ai_service._get_question_prompt(ExperienceLevel.ADVANCED)
        
        # Beginner-specific content
        assert "basic DataFrame operations" in beginner_prompt
        assert "< 1000 rows" in beginner_prompt
        assert "select, filter, withColumn, groupBy" in beginner_prompt
        
        # Intermediate-specific content
        assert "multiple DataFrame operations" in intermediate_prompt
        assert "joins, window functions" in intermediate_prompt
        assert "1000-10000 rows" in intermediate_prompt
        
        # Advanced-specific content
        assert "performance optimization" in advanced_prompt
        assert "partitioning, caching, broadcast joins" in advanced_prompt
        assert "larger data volumes" in advanced_prompt
        
        # Ensure prompts are different
        assert beginner_prompt != intermediate_prompt
        assert intermediate_prompt != advanced_prompt
        assert beginner_prompt != advanced_prompt
    
    def test_question_prompt_topic_integration(self, ai_service):
        """Test that topic-specific prompts are properly integrated."""
        topics = ["joins", "window_functions", "aggregations", "data_quality"]
        
        for topic in topics:
            prompt = ai_service._get_question_prompt(ExperienceLevel.INTERMEDIATE, topic)
            
            assert f"Specific Topic Focus: {topic}" in prompt
            assert f"tests {topic} concepts" in prompt
            
            # Ensure topic prompt is different from generic prompt
            generic_prompt = ai_service._get_question_prompt(ExperienceLevel.INTERMEDIATE)
            assert prompt != generic_prompt
    
    def test_code_review_prompt_structure(self, ai_service):
        """Test code review prompt structure and content."""
        code = """
from pyspark.sql import SparkSession
spark = SparkSession.builder.appName("test").getOrCreate()
df = spark.read.csv("data.csv", header=True)
result = df.select("*").show()
"""
        question_title = "Data Processing Challenge"
        execution_result = {
            "status": "success",
            "execution_time": 2.5,
            "memory_usage": 512,
            "output_rows": 100
        }
        
        prompt = ai_service._get_code_review_prompt(code, question_title, execution_result)
        
        # Check structure
        assert question_title in prompt
        assert code in prompt
        assert json.dumps(execution_result, indent=2) in prompt
        
        # Check review categories
        assert "Correctness" in prompt
        assert "Performance" in prompt
        assert "Best Practices" in prompt
        assert "Code Quality" in prompt
        
        # Check output format requirements
        assert "overall_score" in prompt
        assert "correctness_feedback" in prompt
        assert "performance_feedback" in prompt
        assert "improvement_suggestions" in prompt
        assert "code_examples" in prompt
        assert "alternative_approaches" in prompt
    
    def test_code_review_prompt_with_error_result(self, ai_service):
        """Test code review prompt with execution errors."""
        code = "df.select('nonexistent_column')"
        question_title = "Test Question"
        execution_result = {
            "status": "error",
            "error_message": "Column 'nonexistent_column' does not exist",
            "execution_time": 0.1
        }
        
        prompt = ai_service._get_code_review_prompt(code, question_title, execution_result)
        
        assert "Column 'nonexistent_column' does not exist" in prompt
        assert "status\": \"error" in prompt


class TestResponseParsing:
    """Test cases for AI response parsing and validation."""
    
    @pytest.fixture
    def ai_service(self):
        """Create AIService instance for testing."""
        return AIService()
    
    @pytest.mark.asyncio
    async def test_parse_json_response_clean(self, ai_service):
        """Test parsing clean JSON response."""
        mock_response = {
            "title": "Test Question",
            "description": "A test question",
            "input_schema": {"id": "int", "name": "string"},
            "sample_input": {"data": [{"id": 1, "name": "test"}]},
            "expected_output": {"data": [{"result": "processed"}]}
        }
        
        with patch.object(ai_service, '_check_rate_limit'), \
             patch.object(ai_service, '_make_api_call', return_value=json.dumps(mock_response)):
            
            result = await ai_service.generate_question("user123", 5)
            assert result == mock_response
    
    @pytest.mark.asyncio
    async def test_parse_json_response_with_markdown(self, ai_service):
        """Test parsing JSON response wrapped in markdown."""
        mock_response = {"title": "Test", "description": "Test description"}
        markdown_variations = [
            f"```json\n{json.dumps(mock_response)}\n```",
            f"```\n{json.dumps(mock_response)}\n```",
            f"Here's the response:\n```json\n{json.dumps(mock_response)}\n```\nEnd of response.",
        ]
        
        for markdown_response in markdown_variations:
            with patch.object(ai_service, '_check_rate_limit'), \
                 patch.object(ai_service, '_make_api_call', return_value=markdown_response):
                
                result = await ai_service.generate_question("user123", 5)
                assert result == mock_response
    
    @pytest.mark.asyncio
    async def test_parse_invalid_json_response(self, ai_service):
        """Test handling of invalid JSON responses."""
        invalid_responses = [
            "This is not JSON at all",
            '{"incomplete": json',
            '{"valid_json": true} but with extra text',
            "",
            "undefined"
        ]
        
        for invalid_response in invalid_responses:
            with patch.object(ai_service, '_check_rate_limit'), \
                 patch.object(ai_service, '_make_api_call', return_value=invalid_response):
                
                with pytest.raises(APIError) as exc_info:
                    await ai_service.generate_question("user123", 5)
                assert "Invalid JSON response" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_parse_code_review_response_variations(self, ai_service):
        """Test parsing various code review response formats."""
        base_review = {
            "overall_score": 7.5,
            "correctness_feedback": "Good approach",
            "performance_feedback": "Could be optimized",
            "best_practices_feedback": "Follows standards",
            "improvement_suggestions": ["Use caching", "Add error handling"],
            "code_examples": [{"description": "Better approach", "code": "optimized_code"}],
            "alternative_approaches": ["Method 1", "Method 2"]
        }
        
        # Test different response formats
        formats = [
            json.dumps(base_review),
            f"```json\n{json.dumps(base_review)}\n```",
            f"Here's my review:\n```json\n{json.dumps(base_review)}\n```"
        ]
        
        for response_format in formats:
            with patch.object(ai_service, '_check_rate_limit'), \
                 patch.object(ai_service, '_make_api_call', return_value=response_format):
                
                result = await ai_service.review_code(
                    "user123", "test_code", "Test Question", {"status": "success"}
                )
                assert result == base_review


class TestErrorHandlingAndFallbacks:
    """Test cases for error handling and fallback mechanisms."""
    
    @pytest.fixture
    def ai_service(self):
        """Create AIService instance for testing."""
        return AIService()
    
    @pytest.fixture
    def mock_groq_client(self):
        """Mock GROQ client."""
        return AsyncMock()
    
    @pytest.mark.asyncio
    async def test_api_call_retry_on_rate_limit(self, ai_service, mock_groq_client):
        """Test API call retry logic on rate limit errors."""
        ai_service.client = mock_groq_client
        
        # Mock rate limit error on first call, success on second
        rate_limit_error = httpx.HTTPStatusError(
            "Rate limited", 
            request=MagicMock(), 
            response=MagicMock(status_code=429)
        )
        
        mock_groq_client.chat.completions.create.side_effect = [
            rate_limit_error,
            MagicMock(choices=[MagicMock(message=MagicMock(content='{"success": true}'))])
        ]
        
        with patch('asyncio.sleep') as mock_sleep:
            result = await ai_service._make_api_call("test prompt")
            
            assert result == '{"success": true}'
            assert mock_groq_client.chat.completions.create.call_count == 2
            mock_sleep.assert_called_once_with(1)  # First retry delay
    
    @pytest.mark.asyncio
    async def test_api_call_exponential_backoff(self, ai_service, mock_groq_client):
        """Test exponential backoff on multiple rate limit errors."""
        ai_service.client = mock_groq_client
        
        rate_limit_error = httpx.HTTPStatusError(
            "Rate limited", 
            request=MagicMock(), 
            response=MagicMock(status_code=429)
        )
        
        # Fail twice, succeed on third attempt
        mock_groq_client.chat.completions.create.side_effect = [
            rate_limit_error,
            rate_limit_error,
            MagicMock(choices=[MagicMock(message=MagicMock(content='{"success": true}'))])
        ]
        
        with patch('asyncio.sleep') as mock_sleep:
            result = await ai_service._make_api_call("test prompt")
            
            assert result == '{"success": true}'
            assert mock_groq_client.chat.completions.create.call_count == 3
            
            # Check exponential backoff: 1s, 2s
            expected_calls = [call(1), call(2)]
            mock_sleep.assert_has_calls(expected_calls)
    
    @pytest.mark.asyncio
    async def test_api_call_max_retries_exceeded(self, ai_service, mock_groq_client):
        """Test API call failure after max retries."""
        ai_service.client = mock_groq_client
        
        rate_limit_error = httpx.HTTPStatusError(
            "Rate limited", 
            request=MagicMock(), 
            response=MagicMock(status_code=429)
        )
        
        mock_groq_client.chat.completions.create.side_effect = rate_limit_error
        
        with patch('asyncio.sleep'):
            with pytest.raises(APIError) as exc_info:
                await ai_service._make_api_call("test prompt", max_retries=2)
            
            assert "failed after 2 attempts" in str(exc_info.value)
            assert mock_groq_client.chat.completions.create.call_count == 2
    
    @pytest.mark.asyncio
    async def test_api_call_http_error_non_rate_limit(self, ai_service, mock_groq_client):
        """Test API call handling of non-rate-limit HTTP errors."""
        ai_service.client = mock_groq_client
        
        http_error = httpx.HTTPStatusError(
            "Server error", 
            request=MagicMock(), 
            response=MagicMock(status_code=500)
        )
        
        mock_groq_client.chat.completions.create.side_effect = http_error
        
        with pytest.raises(APIError) as exc_info:
            await ai_service._make_api_call("test prompt")
        
        assert "HTTP error: 500" in str(exc_info.value)
        assert mock_groq_client.chat.completions.create.call_count == 1  # No retry
    
    @pytest.mark.asyncio
    async def test_api_call_generic_exception_retry(self, ai_service, mock_groq_client):
        """Test API call retry on generic exceptions."""
        ai_service.client = mock_groq_client
        
        # Generic exception on first call, success on second
        mock_groq_client.chat.completions.create.side_effect = [
            Exception("Network error"),
            MagicMock(choices=[MagicMock(message=MagicMock(content='{"success": true}'))])
        ]
        
        with patch('asyncio.sleep') as mock_sleep:
            result = await ai_service._make_api_call("test prompt")
            
            assert result == '{"success": true}'
            assert mock_groq_client.chat.completions.create.call_count == 2
            mock_sleep.assert_called_once_with(1)
    
    @pytest.mark.asyncio
    async def test_generate_question_rate_limit_propagation(self, ai_service):
        """Test that rate limit errors are properly propagated."""
        with patch.object(ai_service, '_check_rate_limit', side_effect=RateLimitError("Rate limited")):
            with pytest.raises(RateLimitError):
                await ai_service.generate_question("user123", 5)
    
    @pytest.mark.asyncio
    async def test_generate_question_api_error_propagation(self, ai_service):
        """Test that API errors are properly propagated."""
        with patch.object(ai_service, '_check_rate_limit'), \
             patch.object(ai_service, '_make_api_call', side_effect=APIError("API failed")):
            
            with pytest.raises(APIError):
                await ai_service.generate_question("user123", 5)
    
    @pytest.mark.asyncio
    async def test_review_code_error_handling(self, ai_service):
        """Test error handling in code review generation."""
        with patch.object(ai_service, '_check_rate_limit'), \
             patch.object(ai_service, '_make_api_call', side_effect=APIError("Review failed")):
            
            with pytest.raises(APIError):
                await ai_service.review_code("user123", "code", "question", {})


class TestValidationLogic:
    """Test cases for input validation and response validation."""
    
    @pytest.fixture
    def ai_service(self):
        """Create AIService instance for testing."""
        return AIService()
    
    def test_experience_level_boundary_values(self, ai_service):
        """Test experience level mapping at boundary values."""
        # Test exact boundaries
        assert ai_service._get_experience_level(0) == ExperienceLevel.BEGINNER
        assert ai_service._get_experience_level(2) == ExperienceLevel.BEGINNER
        assert ai_service._get_experience_level(3) == ExperienceLevel.INTERMEDIATE
        assert ai_service._get_experience_level(7) == ExperienceLevel.INTERMEDIATE
        assert ai_service._get_experience_level(8) == ExperienceLevel.ADVANCED
        
        # Test edge cases
        assert ai_service._get_experience_level(-1) == ExperienceLevel.BEGINNER  # Negative years
        assert ai_service._get_experience_level(100) == ExperienceLevel.ADVANCED  # Very high years
    
    @pytest.mark.asyncio
    async def test_rate_limit_validation_edge_cases(self, ai_service):
        """Test rate limit validation with edge cases."""
        mock_redis = AsyncMock()
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            # Test with zero requests per hour (should always fail)
            mock_redis.get.return_value = None
            
            with pytest.raises(RateLimitError):
                await ai_service._check_rate_limit("user123", requests_per_hour=0)
            
            # Test with very high limit
            mock_redis.get.return_value = None
            await ai_service._check_rate_limit("user123", requests_per_hour=10000)  # Should pass
    
    @pytest.mark.asyncio
    async def test_rate_limit_data_corruption_handling(self, ai_service):
        """Test handling of corrupted rate limit data."""
        mock_redis = AsyncMock()
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            # Test with invalid JSON
            mock_redis.get.return_value = "invalid json"
            
            # Should handle gracefully and reset
            await ai_service._check_rate_limit("user123")
            
            # Should have stored new valid data
            mock_redis.setex.assert_called_once()
            call_args = mock_redis.setex.call_args
            stored_data = json.loads(call_args[0][2])
            assert stored_data["requests_made"] == 1
    
    def test_prompt_parameter_validation(self, ai_service):
        """Test prompt generation with various parameter combinations."""
        # Test with None topic
        prompt = ai_service._get_question_prompt(ExperienceLevel.BEGINNER, None)
        assert "Specific Topic Focus" not in prompt
        
        # Test with empty topic
        prompt = ai_service._get_question_prompt(ExperienceLevel.BEGINNER, "")
        assert "Specific Topic Focus" not in prompt
        
        # Test with whitespace topic
        prompt = ai_service._get_question_prompt(ExperienceLevel.BEGINNER, "   ")
        assert "Specific Topic Focus" not in prompt
        
        # Test with valid topic
        prompt = ai_service._get_question_prompt(ExperienceLevel.BEGINNER, "joins")
        assert "Specific Topic Focus: joins" in prompt


class TestCachingMechanisms:
    """Test cases for Redis caching behavior."""
    
    @pytest.fixture
    def ai_service(self):
        """Create AIService instance for testing."""
        return AIService()
    
    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client."""
        return AsyncMock()
    
    @pytest.mark.asyncio
    async def test_redis_connection_caching(self, ai_service, mock_redis):
        """Test that Redis client is cached after first connection."""
        with patch('app.services.ai_service.get_redis', return_value=mock_redis):
            # First call should create connection
            client1 = await ai_service._get_redis_client()
            assert client1 == mock_redis
            assert ai_service.redis_client == mock_redis
            
            # Second call should use cached connection
            client2 = await ai_service._get_redis_client()
            assert client2 == mock_redis
            assert client1 is client2
    
    @pytest.mark.asyncio
    async def test_rate_limit_data_persistence(self, ai_service, mock_redis):
        """Test that rate limit data is properly persisted."""
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            mock_redis.get.return_value = None
            
            await ai_service._check_rate_limit("user123")
            
            # Verify data was stored with correct TTL
            mock_redis.setex.assert_called_once()
            call_args = mock_redis.setex.call_args
            
            assert call_args[0][0] == "rate_limit:ai:user123"  # Key
            assert call_args[0][1] == 3600  # TTL (1 hour)
            
            # Verify stored data structure
            stored_data = json.loads(call_args[0][2])
            assert "requests_made" in stored_data
            assert "window_start" in stored_data
            assert stored_data["requests_made"] == 1
    
    @pytest.mark.asyncio
    async def test_rate_limit_status_retrieval(self, ai_service, mock_redis):
        """Test rate limit status retrieval from cache."""
        current_time = time.time()
        cached_data = {
            "requests_made": 15,
            "window_start": current_time
        }
        
        mock_redis.get.return_value = json.dumps(cached_data)
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            status = await ai_service.get_rate_limit_status("user123")
            
            assert isinstance(status, RateLimitInfo)
            assert status.requests_made == 15
            assert status.window_start == current_time
            assert status.requests_per_hour == settings.AI_REQUESTS_PER_HOUR
            
            mock_redis.get.assert_called_once_with("rate_limit:ai:user123")


class TestIntegrationScenarios:
    """Test cases for complete workflow integration."""
    
    @pytest.fixture
    def ai_service(self):
        """Create AIService instance for testing."""
        return AIService()
    
    @pytest.mark.asyncio
    async def test_complete_question_generation_workflow(self, ai_service):
        """Test complete question generation workflow."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None  # No existing rate limit data
        
        mock_question = {
            "title": "Data Transformation Challenge",
            "description": "Transform customer data using PySpark",
            "input_schema": {"customer_id": "int", "name": "string", "age": "int"},
            "sample_input": {"data": [{"customer_id": 1, "name": "John", "age": 25}]},
            "expected_output": {"data": [{"customer_id": 1, "processed_name": "JOHN", "age_group": "young"}]},
            "test_cases": [
                {
                    "description": "Basic transformation test",
                    "input_data": {"data": [{"customer_id": 1, "name": "John", "age": 25}]},
                    "expected_output": {"data": [{"customer_id": 1, "processed_name": "JOHN", "age_group": "young"}]}
                }
            ]
        }
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis), \
             patch.object(ai_service, '_make_api_call', return_value=json.dumps(mock_question)):
            
            result = await ai_service.generate_question("user123", 5, "transformations")
            
            # Verify complete workflow
            assert result == mock_question
            
            # Verify rate limiting was checked
            mock_redis.get.assert_called_once_with("rate_limit:ai:user123")
            mock_redis.setex.assert_called_once()
            
            # Verify rate limit data was updated
            call_args = mock_redis.setex.call_args
            stored_data = json.loads(call_args[0][2])
            assert stored_data["requests_made"] == 1
    
    @pytest.mark.asyncio
    async def test_complete_code_review_workflow(self, ai_service):
        """Test complete code review workflow."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = json.dumps({"requests_made": 5, "window_start": time.time()})
        
        mock_review = {
            "overall_score": 8.0,
            "correctness_feedback": "Solution is correct and handles the requirements well",
            "performance_feedback": "Good use of DataFrame operations, consider caching for repeated operations",
            "best_practices_feedback": "Code follows PySpark best practices",
            "improvement_suggestions": [
                "Add error handling for missing columns",
                "Consider using broadcast joins for small lookup tables"
            ],
            "code_examples": [
                {
                    "description": "Adding error handling",
                    "code": "if 'required_column' in df.columns:\n    result = df.select('required_column')\nelse:\n    raise ValueError('Required column missing')"
                }
            ],
            "alternative_approaches": [
                "Use SQL expressions for complex transformations",
                "Consider using window functions for ranking operations"
            ]
        }
        
        user_code = """
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, upper, when

spark = SparkSession.builder.appName("test").getOrCreate()
df = spark.read.csv("customers.csv", header=True, inferSchema=True)

result = df.select(
    col("customer_id"),
    upper(col("name")).alias("processed_name"),
    when(col("age") < 30, "young")
    .when(col("age") < 60, "middle")
    .otherwise("senior").alias("age_group")
)

result.show()
"""
        
        execution_result = {
            "status": "success",
            "execution_time": 1.2,
            "memory_usage": 256,
            "output_rows": 1000
        }
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis), \
             patch.object(ai_service, '_make_api_call', return_value=json.dumps(mock_review)):
            
            result = await ai_service.review_code(
                "user123", user_code, "Data Transformation Challenge", execution_result
            )
            
            # Verify complete workflow
            assert result == mock_review
            
            # Verify rate limiting was checked and updated
            mock_redis.get.assert_called_once_with("rate_limit:ai:user123")
            mock_redis.setex.assert_called_once()
            
            # Verify rate limit was incremented
            call_args = mock_redis.setex.call_args
            stored_data = json.loads(call_args[0][2])
            assert stored_data["requests_made"] == 6  # Incremented from 5
    
    @pytest.mark.asyncio
    async def test_concurrent_requests_rate_limiting(self, ai_service):
        """Test rate limiting behavior with concurrent requests."""
        mock_redis = AsyncMock()
        
        # Simulate concurrent requests hitting rate limit
        initial_data = {"requests_made": settings.AI_REQUESTS_PER_HOUR - 1, "window_start": time.time()}
        mock_redis.get.return_value = json.dumps(initial_data)
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis), \
             patch.object(ai_service, '_make_api_call', return_value='{"test": "response"}'):
            
            # First request should succeed (reaches limit)
            await ai_service.generate_question("user123", 5)
            
            # Update mock to simulate limit reached
            limit_reached_data = {"requests_made": settings.AI_REQUESTS_PER_HOUR, "window_start": time.time()}
            mock_redis.get.return_value = json.dumps(limit_reached_data)
            
            # Second request should fail
            with pytest.raises(RateLimitError):
                await ai_service.generate_question("user123", 5)


class TestAIServiceEdgeCases:
    """Test cases for edge cases and additional validation scenarios."""
    
    @pytest.fixture
    def ai_service(self):
        """Create AIService instance for testing."""
        return AIService()
    
    @pytest.fixture
    def mock_groq_client(self):
        """Mock GROQ client."""
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"test": "response"}'
        mock_client.chat.completions.create.return_value = mock_response
        return mock_client
    
    def test_prompt_template_consistency_across_levels(self, ai_service):
        """Test that all experience level prompts have consistent structure."""
        levels = [ExperienceLevel.BEGINNER, ExperienceLevel.INTERMEDIATE, ExperienceLevel.ADVANCED]
        required_sections = [
            "You are an expert data engineer",
            "Requirements:",
            "Output Format (JSON):",
            "title",
            "description", 
            "input_schema",
            "sample_input",
            "expected_output"
        ]
        
        for level in levels:
            prompt = ai_service._get_question_prompt(level)
            for section in required_sections:
                assert section in prompt, f"Missing '{section}' in {level.value} prompt"
    
    def test_code_review_prompt_handles_special_characters(self, ai_service):
        """Test code review prompt with special characters in code."""
        special_code = '''
        df.filter(col("name").contains("O'Reilly & Co."))
        df.select(col("price").cast("decimal(10,2)"))
        df.withColumn("escaped", lit("Quote: \\"Hello\\""))
        '''
        
        prompt = ai_service._get_code_review_prompt(
            special_code, 
            "Special Characters Test", 
            {"status": "success"}
        )
        
        assert "O'Reilly & Co." in prompt
        assert "decimal(10,2)" in prompt
        assert '\\"Hello\\"' in prompt
    
    @pytest.mark.asyncio
    async def test_rate_limiting_with_custom_limits(self, ai_service):
        """Test rate limiting with custom per-hour limits."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            # Test with very low limit
            await ai_service._check_rate_limit("user123", requests_per_hour=1)
            
            # Should increment to 1
            call_args = mock_redis.setex.call_args
            stored_data = json.loads(call_args[0][2])
            assert stored_data["requests_made"] == 1
            
            # Second call should fail
            mock_redis.get.return_value = json.dumps(stored_data)
            with pytest.raises(RateLimitError):
                await ai_service._check_rate_limit("user123", requests_per_hour=1)
    
    @pytest.mark.asyncio
    async def test_json_parsing_with_nested_objects(self, ai_service):
        """Test JSON parsing with complex nested structures."""
        complex_response = {
            "title": "Complex Data Processing",
            "description": "Process nested JSON data",
            "input_schema": {
                "user": "struct<id:int,profile:struct<name:string,age:int>>",
                "events": "array<struct<type:string,timestamp:long>>"
            },
            "sample_input": {
                "data": [
                    {
                        "user": {"id": 1, "profile": {"name": "John", "age": 30}},
                        "events": [
                            {"type": "login", "timestamp": 1640995200},
                            {"type": "purchase", "timestamp": 1640995800}
                        ]
                    }
                ]
            },
            "expected_output": {
                "data": [
                    {"user_id": 1, "event_count": 2, "latest_event": "purchase"}
                ]
            },
            "test_cases": [
                {
                    "description": "Nested data processing",
                    "input_data": {"data": [{"user": {"id": 1}, "events": []}]},
                    "expected_output": {"data": [{"user_id": 1, "event_count": 0}]}
                }
            ]
        }
        
        with patch.object(ai_service, '_check_rate_limit'), \
             patch.object(ai_service, '_make_api_call', return_value=json.dumps(complex_response)):
            
            result = await ai_service.generate_question("user123", 5)
            assert result == complex_response
            assert "struct<id:int,profile:struct<name:string,age:int>>" in result["input_schema"]["user"]
    
    @pytest.mark.asyncio
    async def test_api_call_with_unicode_content(self, ai_service, mock_groq_client):
        """Test API calls with Unicode characters."""
        ai_service.client = mock_groq_client
        
        unicode_response = {
            "title": "Unicode Test: 数据处理",
            "description": "Process data with émojis 🚀 and special chars: ñáéíóú",
            "sample_data": "Café, naïve, résumé"
        }
        
        mock_groq_client.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps(unicode_response, ensure_ascii=False)))]
        )
        
        result = await ai_service._make_api_call("test prompt")
        parsed_result = json.loads(result)
        
        assert "数据处理" in parsed_result["title"]
        assert "🚀" in parsed_result["description"]
        assert "résumé" in parsed_result["sample_data"]
    
    @pytest.mark.asyncio
    async def test_concurrent_rate_limit_edge_case(self, ai_service):
        """Test edge case where multiple requests hit rate limit simultaneously."""
        mock_redis = AsyncMock()
        
        # Simulate race condition where multiple requests read same data
        initial_data = {"requests_made": settings.AI_REQUESTS_PER_HOUR - 1, "window_start": time.time()}
        mock_redis.get.return_value = json.dumps(initial_data)
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            # First request should succeed
            await ai_service._check_rate_limit("user123")
            
            # Verify it was incremented
            call_args = mock_redis.setex.call_args
            stored_data = json.loads(call_args[0][2])
            assert stored_data["requests_made"] == settings.AI_REQUESTS_PER_HOUR
    
    def test_experience_level_mapping_comprehensive(self, ai_service):
        """Test experience level mapping with comprehensive range of values."""
        test_cases = [
            (-5, ExperienceLevel.BEGINNER),  # Negative (invalid but handled)
            (0, ExperienceLevel.BEGINNER),
            (1, ExperienceLevel.BEGINNER),
            (2, ExperienceLevel.BEGINNER),
            (2.5, ExperienceLevel.INTERMEDIATE),  # Float values - 2.5 > 2, so intermediate
            (3, ExperienceLevel.INTERMEDIATE),
            (5, ExperienceLevel.INTERMEDIATE),
            (7, ExperienceLevel.INTERMEDIATE),
            (7.9, ExperienceLevel.ADVANCED),  # 7.9 > 7, so advanced
            (8, ExperienceLevel.ADVANCED),
            (15, ExperienceLevel.ADVANCED),
            (50, ExperienceLevel.ADVANCED),  # Very high experience
        ]
        
        for years, expected_level in test_cases:
            actual_level = ai_service._get_experience_level(years)
            assert actual_level == expected_level, f"Failed for {years} years: expected {expected_level}, got {actual_level}"
    
    @pytest.mark.asyncio
    async def test_error_propagation_chain(self, ai_service):
        """Test that errors propagate correctly through the call chain."""
        # Test rate limit error propagation
        with patch.object(ai_service, '_check_rate_limit', side_effect=RateLimitError("Rate limited")):
            with pytest.raises(RateLimitError, match="Rate limited"):
                await ai_service.generate_question("user123", 5)
        
        # Test API error propagation
        with patch.object(ai_service, '_check_rate_limit'), \
             patch.object(ai_service, '_make_api_call', side_effect=APIError("API failed")):
            with pytest.raises(APIError, match="API failed"):
                await ai_service.generate_question("user123", 5)
        
        # Test JSON parsing error propagation
        with patch.object(ai_service, '_check_rate_limit'), \
             patch.object(ai_service, '_make_api_call', return_value="invalid json"):
            with pytest.raises(APIError, match="Invalid JSON response"):
                await ai_service.generate_question("user123", 5)


class TestAIService:
    """Test cases for AIService class."""
    
    @pytest.fixture
    def ai_service(self):
        """Create AIService instance for testing."""
        return AIService()
    
    @pytest.fixture
    def mock_groq_client(self):
        """Mock GROQ client."""
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"test": "response"}'
        mock_client.chat.completions.create.return_value = mock_response
        return mock_client
    
    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None
        mock_redis.setex.return_value = True
        return mock_redis
    
    def test_get_experience_level(self, ai_service):
        """Test experience level mapping."""
        assert ai_service._get_experience_level(1) == ExperienceLevel.BEGINNER
        assert ai_service._get_experience_level(2) == ExperienceLevel.BEGINNER
        assert ai_service._get_experience_level(3) == ExperienceLevel.INTERMEDIATE
        assert ai_service._get_experience_level(7) == ExperienceLevel.INTERMEDIATE
        assert ai_service._get_experience_level(8) == ExperienceLevel.ADVANCED
        assert ai_service._get_experience_level(15) == ExperienceLevel.ADVANCED
    
    def test_get_question_prompt_beginner(self, ai_service):
        """Test question prompt generation for beginner level."""
        prompt = ai_service._get_question_prompt(ExperienceLevel.BEGINNER)
        
        assert "BEGINNER (0-2 years)" in prompt
        assert "basic DataFrame operations" in prompt
        assert "select, filter, withColumn, groupBy" in prompt
        assert "Output Format (JSON)" in prompt
    
    def test_get_question_prompt_intermediate(self, ai_service):
        """Test question prompt generation for intermediate level."""
        prompt = ai_service._get_question_prompt(ExperienceLevel.INTERMEDIATE)
        
        assert "INTERMEDIATE (3-7 years)" in prompt
        assert "multiple DataFrame operations" in prompt
        assert "joins, window functions" in prompt
    
    def test_get_question_prompt_advanced(self, ai_service):
        """Test question prompt generation for advanced level."""
        prompt = ai_service._get_question_prompt(ExperienceLevel.ADVANCED)
        
        assert "ADVANCED (8+ years)" in prompt
        assert "performance optimization" in prompt
        assert "partitioning, caching, broadcast joins" in prompt
    
    def test_get_question_prompt_with_topic(self, ai_service):
        """Test question prompt generation with specific topic."""
        topic = "window_functions"
        prompt = ai_service._get_question_prompt(ExperienceLevel.INTERMEDIATE, topic)
        
        assert f"Specific Topic Focus: {topic}" in prompt
        assert f"tests {topic} concepts" in prompt
    
    def test_get_code_review_prompt(self, ai_service):
        """Test code review prompt generation."""
        code = "df.select('*').show()"
        question_title = "Test Question"
        execution_result = {"status": "success", "output": "data"}
        
        prompt = ai_service._get_code_review_prompt(code, question_title, execution_result)
        
        assert question_title in prompt
        assert code in prompt
        assert "Correctness" in prompt
        assert "Performance" in prompt
        assert "Best Practices" in prompt
        assert "overall_score" in prompt
    
    @pytest.mark.asyncio
    async def test_check_rate_limit_no_previous_requests(self, ai_service, mock_redis):
        """Test rate limit check with no previous requests."""
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            mock_redis.get.return_value = None
            
            # Should not raise exception
            await ai_service._check_rate_limit("user123")
            
            # Should increment counter
            mock_redis.setex.assert_called_once()
            call_args = mock_redis.setex.call_args
            assert call_args[0][0] == "rate_limit:ai:user123"
            assert call_args[0][1] == 3600  # TTL
            
            # Check stored data
            stored_data = json.loads(call_args[0][2])
            assert stored_data["requests_made"] == 1
    
    @pytest.mark.asyncio
    async def test_check_rate_limit_within_limit(self, ai_service, mock_redis):
        """Test rate limit check within allowed limit."""
        current_time = time.time()
        existing_data = {
            "requests_made": 5,
            "window_start": current_time
        }
        mock_redis.get.return_value = json.dumps(existing_data)
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            # Should not raise exception
            await ai_service._check_rate_limit("user123")
            
            # Should increment counter
            mock_redis.setex.assert_called_once()
            call_args = mock_redis.setex.call_args
            stored_data = json.loads(call_args[0][2])
            assert stored_data["requests_made"] == 6
    
    @pytest.mark.asyncio
    async def test_check_rate_limit_exceeded(self, ai_service, mock_redis):
        """Test rate limit check when limit is exceeded."""
        current_time = time.time()
        existing_data = {
            "requests_made": settings.AI_REQUESTS_PER_HOUR,
            "window_start": current_time
        }
        mock_redis.get.return_value = json.dumps(existing_data)
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            with pytest.raises(RateLimitError) as exc_info:
                await ai_service._check_rate_limit("user123")
            
            assert "Rate limit" in str(exc_info.value)
            assert str(settings.AI_REQUESTS_PER_HOUR) in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_check_rate_limit_window_reset(self, ai_service, mock_redis):
        """Test rate limit check when time window has reset."""
        old_time = time.time() - 7200  # 2 hours ago
        existing_data = {
            "requests_made": settings.AI_REQUESTS_PER_HOUR,
            "window_start": old_time
        }
        mock_redis.get.return_value = json.dumps(existing_data)
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            # Should not raise exception (window reset)
            await ai_service._check_rate_limit("user123")
            
            # Should reset counter
            mock_redis.setex.assert_called_once()
            call_args = mock_redis.setex.call_args
            stored_data = json.loads(call_args[0][2])
            assert stored_data["requests_made"] == 1
    
    @pytest.mark.asyncio
    async def test_make_api_call_success(self, ai_service, mock_groq_client):
        """Test successful API call."""
        ai_service.client = mock_groq_client
        
        result = await ai_service._make_api_call("test prompt")
        
        assert result == '{"test": "response"}'
        mock_groq_client.chat.completions.create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_make_api_call_no_client(self, ai_service):
        """Test API call without configured client."""
        ai_service.client = None
        
        with pytest.raises(APIError) as exc_info:
            await ai_service._make_api_call("test prompt")
        
        assert "not configured" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_make_api_call_empty_response(self, ai_service, mock_groq_client):
        """Test API call with empty response."""
        ai_service.client = mock_groq_client
        mock_groq_client.chat.completions.create.return_value.choices = []
        
        with pytest.raises(APIError) as exc_info:
            await ai_service._make_api_call("test prompt")
        
        assert "Empty response" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_generate_question_success(self, ai_service, mock_redis):
        """Test successful question generation."""
        mock_response = {
            "title": "Test Question",
            "description": "Test description",
            "input_schema": {"id": "int"},
            "sample_input": {"data": [{"id": 1}]},
            "expected_output": {"data": [{"result": 2}]},
            "test_cases": []
        }
        
        with patch.object(ai_service, '_check_rate_limit') as mock_rate_limit, \
             patch.object(ai_service, '_make_api_call', return_value=json.dumps(mock_response)) as mock_api:
            
            result = await ai_service.generate_question("user123", 5, "transformations")
            
            assert result == mock_response
            mock_rate_limit.assert_called_once_with("user123")
            mock_api.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_generate_question_invalid_json(self, ai_service):
        """Test question generation with invalid JSON response."""
        with patch.object(ai_service, '_check_rate_limit'), \
             patch.object(ai_service, '_make_api_call', return_value="invalid json"):
            
            with pytest.raises(APIError) as exc_info:
                await ai_service.generate_question("user123", 5)
            
            assert "Invalid JSON response" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_generate_question_markdown_formatted_response(self, ai_service):
        """Test question generation with markdown-formatted JSON response."""
        mock_response = {
            "title": "Test Question",
            "description": "Test description",
            "input_schema": {"id": "int"},
            "sample_input": {"data": [{"id": 1}]},
            "expected_output": {"data": [{"result": 2}]}
        }
        markdown_response = f"```json\n{json.dumps(mock_response)}\n```"
        
        with patch.object(ai_service, '_check_rate_limit'), \
             patch.object(ai_service, '_make_api_call', return_value=markdown_response):
            
            result = await ai_service.generate_question("user123", 5)
            
            assert result == mock_response
    
    @pytest.mark.asyncio
    async def test_review_code_success(self, ai_service):
        """Test successful code review generation."""
        mock_response = {
            "overall_score": 8.5,
            "correctness_feedback": "Good solution",
            "performance_feedback": "Could be optimized",
            "best_practices_feedback": "Follows best practices",
            "improvement_suggestions": ["Use caching"],
            "code_examples": [],
            "alternative_approaches": []
        }
        
        with patch.object(ai_service, '_check_rate_limit'), \
             patch.object(ai_service, '_make_api_call', return_value=json.dumps(mock_response)):
            
            result = await ai_service.review_code(
                "user123",
                "df.select('*')",
                "Test Question",
                {"status": "success"}
            )
            
            assert result == mock_response
    
    @pytest.mark.asyncio
    async def test_get_rate_limit_status_no_data(self, ai_service, mock_redis):
        """Test getting rate limit status with no existing data."""
        mock_redis.get.return_value = None
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            result = await ai_service.get_rate_limit_status("user123")
            
            assert isinstance(result, RateLimitInfo)
            assert result.requests_made == 0
            assert result.requests_per_hour == settings.AI_REQUESTS_PER_HOUR
    
    @pytest.mark.asyncio
    async def test_get_rate_limit_status_with_data(self, ai_service, mock_redis):
        """Test getting rate limit status with existing data."""
        current_time = time.time()
        existing_data = {
            "requests_made": 10,
            "window_start": current_time
        }
        mock_redis.get.return_value = json.dumps(existing_data)
        
        with patch.object(ai_service, '_get_redis_client', return_value=mock_redis):
            result = await ai_service.get_rate_limit_status("user123")
            
            assert isinstance(result, RateLimitInfo)
            assert result.requests_made == 10
            assert result.window_start == current_time
            assert result.requests_per_hour == settings.AI_REQUESTS_PER_HOUR


class TestAIServiceIntegration:
    """Integration tests for AI service (require actual API key)."""
    
    @pytest.mark.skip(reason="Integration test requires valid GROQ API key")
    @pytest.mark.asyncio
    async def test_real_question_generation(self):
        """Test actual question generation with real API (if key is available)."""
        ai_service = AIService()
        
        # Mock Redis to avoid initialization issues in tests
        with patch('app.services.ai_service.get_redis') as mock_get_redis:
            mock_redis = AsyncMock()
            mock_get_redis.return_value = mock_redis
            mock_redis.get.return_value = None  # No rate limit data
            mock_redis.setex.return_value = True  # Rate limit set successfully
            
            try:
                result = await ai_service.generate_question("test_user", 3, "transformations")
                
                # Verify response structure
                assert "title" in result
                assert "description" in result
                assert "input_schema" in result
                assert "sample_input" in result
                assert "expected_output" in result
                
            except RateLimitError:
                pytest.skip("Rate limit reached during testing")
            except APIError as e:
                pytest.fail(f"API error during integration test: {e}")