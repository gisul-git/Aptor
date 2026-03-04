"""
Unit tests for question generator service.
"""

import json
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime

from app.services.question_generator import (
    QuestionGeneratorService,
    QuestionGenerationError
)
from app.services.ai_service import RateLimitError, AIServiceError
from app.models.question import Question, DifficultyLevel, QuestionTopic, TestCase
from app.core.config import settings


class TestQuestionGeneratorService:
    """Test cases for QuestionGeneratorService class."""
    
    @pytest.fixture
    def question_service(self):
        """Create QuestionGeneratorService instance for testing."""
        return QuestionGeneratorService()
    
    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client."""
        mock_redis = AsyncMock()
        mock_redis.get.return_value = None
        mock_redis.setex.return_value = True
        return mock_redis
    
    @pytest.fixture
    def sample_ai_response(self):
        """Sample AI response data."""
        return {
            "title": "DataFrame Filtering Challenge",
            "description": "Filter a DataFrame based on multiple conditions and calculate aggregations.",
            "input_schema": {
                "id": "int",
                "name": "string",
                "age": "int",
                "salary": "double"
            },
            "sample_input": {
                "data": [
                    {"id": 1, "name": "Alice", "age": 25, "salary": 50000.0},
                    {"id": 2, "name": "Bob", "age": 30, "salary": 60000.0},
                    {"id": 3, "name": "Charlie", "age": 35, "salary": 70000.0}
                ]
            },
            "expected_output": {
                "data": [
                    {"name": "Bob", "age": 30, "salary": 60000.0},
                    {"name": "Charlie", "age": 35, "salary": 70000.0}
                ]
            },
            "test_cases": [
                {
                    "description": "Filter employees over 25",
                    "input_data": {
                        "data": [
                            {"id": 1, "name": "Alice", "age": 25, "salary": 50000.0},
                            {"id": 2, "name": "Bob", "age": 30, "salary": 60000.0}
                        ]
                    },
                    "expected_output": {
                        "data": [
                            {"name": "Bob", "age": 30, "salary": 60000.0}
                        ]
                    }
                }
            ]
        }
    
    def test_map_topic_to_enum(self, question_service):
        """Test topic string to enum mapping."""
        assert question_service._map_topic_to_enum("transformations") == QuestionTopic.TRANSFORMATIONS
        assert question_service._map_topic_to_enum("aggregations") == QuestionTopic.AGGREGATIONS
        assert question_service._map_topic_to_enum("joins") == QuestionTopic.JOINS
        assert question_service._map_topic_to_enum("window_functions") == QuestionTopic.WINDOW_FUNCTIONS
        assert question_service._map_topic_to_enum("performance") == QuestionTopic.PERFORMANCE_OPTIMIZATION
        assert question_service._map_topic_to_enum("performance_optimization") == QuestionTopic.PERFORMANCE_OPTIMIZATION
        assert question_service._map_topic_to_enum("data_quality") == QuestionTopic.DATA_QUALITY
        assert question_service._map_topic_to_enum("streaming") == QuestionTopic.STREAMING
        
        # Test unknown topic defaults to transformations
        assert question_service._map_topic_to_enum("unknown") == QuestionTopic.TRANSFORMATIONS
        assert question_service._map_topic_to_enum(None) == QuestionTopic.TRANSFORMATIONS
    
    def test_determine_difficulty_level(self, question_service):
        """Test difficulty level determination based on experience."""
        assert question_service._determine_difficulty_level(1) == DifficultyLevel.BEGINNER
        assert question_service._determine_difficulty_level(2) == DifficultyLevel.BEGINNER
        assert question_service._determine_difficulty_level(3) == DifficultyLevel.INTERMEDIATE
        assert question_service._determine_difficulty_level(7) == DifficultyLevel.INTERMEDIATE
        assert question_service._determine_difficulty_level(8) == DifficultyLevel.ADVANCED
        assert question_service._determine_difficulty_level(15) == DifficultyLevel.ADVANCED
    
    def test_validate_ai_response_valid(self, question_service, sample_ai_response):
        """Test validation of valid AI response."""
        # Should not raise exception
        question_service._validate_ai_response(sample_ai_response)
    
    def test_validate_ai_response_missing_required_field(self, question_service):
        """Test validation with missing required field."""
        invalid_response = {
            "title": "Test",
            "description": "Test description"
            # Missing required fields
        }
        
        with pytest.raises(QuestionGenerationError) as exc_info:
            question_service._validate_ai_response(invalid_response)
        
        assert "missing required field" in str(exc_info.value)
    
    def test_validate_ai_response_invalid_sample_input(self, question_service):
        """Test validation with invalid sample input structure."""
        invalid_response = {
            "title": "Test",
            "description": "Test description",
            "input_schema": {"id": "int"},
            "sample_input": {"invalid": "structure"},  # Missing 'data' field
            "expected_output": {"data": []}
        }
        
        with pytest.raises(QuestionGenerationError) as exc_info:
            question_service._validate_ai_response(invalid_response)
        
        assert "sample_input must contain 'data' field" in str(exc_info.value)
    
    def test_validate_ai_response_invalid_expected_output(self, question_service):
        """Test validation with invalid expected output structure."""
        invalid_response = {
            "title": "Test",
            "description": "Test description",
            "input_schema": {"id": "int"},
            "sample_input": {"data": []},
            "expected_output": {"invalid": "structure"}  # Missing 'data' field
        }
        
        with pytest.raises(QuestionGenerationError) as exc_info:
            question_service._validate_ai_response(invalid_response)
        
        assert "expected_output must contain 'data' field" in str(exc_info.value)
    
    def test_validate_ai_response_invalid_test_case(self, question_service):
        """Test validation with invalid test case structure."""
        invalid_response = {
            "title": "Test",
            "description": "Test description",
            "input_schema": {"id": "int"},
            "sample_input": {"data": []},
            "expected_output": {"data": []},
            "test_cases": [
                {
                    "description": "Test case",
                    "input_data": {"data": []}
                    # Missing expected_output
                }
            ]
        }
        
        with pytest.raises(QuestionGenerationError) as exc_info:
            question_service._validate_ai_response(invalid_response)
        
        assert "Test case 0 missing required fields" in str(exc_info.value)
    
    def test_convert_ai_data_to_question(self, question_service, sample_ai_response):
        """Test conversion of AI response to Question model."""
        question = question_service._convert_ai_data_to_question(
            sample_ai_response, 5, "transformations"
        )
        
        assert isinstance(question, Question)
        assert question.title == sample_ai_response["title"]
        assert question.description == sample_ai_response["description"]
        assert question.difficulty_level == DifficultyLevel.INTERMEDIATE
        assert question.topic == QuestionTopic.TRANSFORMATIONS
        assert question.input_schema == sample_ai_response["input_schema"]
        assert question.sample_input == sample_ai_response["sample_input"]
        assert question.expected_output == sample_ai_response["expected_output"]
        assert len(question.test_cases) == 1
        assert isinstance(question.test_cases[0], TestCase)
        assert question.metadata["experience_years"] == 5
        assert question.metadata["requested_topic"] == "transformations"
        assert question.metadata["ai_generated"] is True
    
    def test_convert_ai_data_to_question_no_test_cases(self, question_service):
        """Test conversion when AI response has no test cases."""
        ai_data = {
            "title": "Test Question",
            "description": "Test description",
            "input_schema": {"id": "int"},
            "sample_input": {"data": [{"id": 1}]},
            "expected_output": {"data": [{"result": 2}]}
        }
        
        question = question_service._convert_ai_data_to_question(ai_data, 3, None)
        
        # Should create default test case from sample data
        assert len(question.test_cases) == 1
        assert question.test_cases[0].input_data == ai_data["sample_input"]
        assert question.test_cases[0].expected_output == ai_data["expected_output"]
        assert question.test_cases[0].description == "Basic test case"
    
    @pytest.mark.asyncio
    async def test_cache_question(self, question_service, mock_redis, sample_ai_response):
        """Test question caching functionality."""
        question = question_service._convert_ai_data_to_question(
            sample_ai_response, 5, "transformations"
        )
        
        # Mock CacheManager instead of direct Redis calls
        with patch('app.services.question_generator.CacheManager') as mock_cache_manager:
            mock_cache_instance = AsyncMock()
            mock_cache_manager.return_value = mock_cache_instance
            mock_cache_instance.set_cache.return_value = True
            mock_cache_instance.get_cache.return_value = []
            
            await question_service._cache_question(question)
            
            # Verify cache operations were called
            assert mock_cache_instance.set_cache.call_count >= 1
            
            # Check that the main cache call includes enhanced metadata
            main_cache_call = mock_cache_instance.set_cache.call_args_list[0]
            cache_key = main_cache_call[0][0]
            cached_data = main_cache_call[0][1]
            
            assert cache_key == f"question:{question.id}"
            assert "cache_version" in cached_data
            assert "quality_validated" in cached_data
            assert "cached_at" in cached_data
    
    @pytest.mark.asyncio
    async def test_generate_question_success(self, question_service, sample_ai_response, mock_redis):
        """Test successful question generation."""
        with patch('app.services.question_generator.ai_service') as mock_ai_service:
            
            # Make the mock return a coroutine
            async def mock_generate_question(*args, **kwargs):
                return sample_ai_response
            
            mock_ai_service.generate_question = mock_generate_question
            
            # Mock cache operations
            with patch('app.services.question_generator.CacheManager') as mock_cache_manager:
                mock_cache_instance = AsyncMock()
                mock_cache_manager.return_value = mock_cache_instance
                mock_cache_instance.get_cache.return_value = None  # No cached question
                mock_cache_instance.set_cache.return_value = True
                
                # Mock no cached question available
                with patch.object(question_service, '_try_get_cached_question', return_value=None):
                    result = await question_service.generate_question("user123", 5, "transformations")
                    
                    assert isinstance(result, Question)
                    assert result.title == sample_ai_response["title"]
                    assert result.difficulty_level == DifficultyLevel.INTERMEDIATE
                    assert result.topic == QuestionTopic.TRANSFORMATIONS
                    
                    # Verify caching was attempted
                    assert mock_cache_instance.set_cache.call_count >= 1
    
    @pytest.mark.asyncio
    async def test_generate_question_rate_limit_error(self, question_service):
        """Test question generation with rate limit error."""
        with patch('app.services.question_generator.ai_service') as mock_ai_service:
            mock_ai_service.generate_question.side_effect = RateLimitError("Rate limit exceeded")
            
            with pytest.raises(RateLimitError):
                await question_service.generate_question("user123", 5)
    
    @pytest.mark.asyncio
    async def test_generate_question_ai_service_error(self, question_service):
        """Test question generation with AI service error uses fallback."""
        with patch('app.services.question_generator.ai_service') as mock_ai_service:
            mock_ai_service.generate_question.side_effect = AIServiceError("API error")
            
            # Mock cache operations
            with patch('app.services.question_generator.CacheManager') as mock_cache_manager:
                mock_cache_instance = AsyncMock()
                mock_cache_manager.return_value = mock_cache_instance
                mock_cache_instance.get_cache.return_value = None
                mock_cache_instance.set_cache.return_value = True
                
                with patch.object(question_service, '_try_get_cached_question', return_value=None):
                    result = await question_service.generate_question("user123", 5)
                    
                    # Should get a fallback question instead of raising exception
                    assert isinstance(result, Question)
                    assert result.metadata.get("fallback_used") is True
                    assert "API error" in result.metadata.get("fallback_reason", "")
    
    @pytest.mark.asyncio
    async def test_generate_question_validation_error(self, question_service):
        """Test question generation with validation error uses fallback."""
        invalid_response = {"title": "Test"}  # Missing required fields
        
        with patch('app.services.question_generator.ai_service') as mock_ai_service:
            # Make the mock return a coroutine
            async def mock_generate_question(*args, **kwargs):
                return invalid_response
            
            mock_ai_service.generate_question = mock_generate_question
            
            # Mock cache operations
            with patch('app.services.question_generator.CacheManager') as mock_cache_manager:
                mock_cache_instance = AsyncMock()
                mock_cache_manager.return_value = mock_cache_instance
                mock_cache_instance.get_cache.return_value = None
                mock_cache_instance.set_cache.return_value = True
                
                with patch.object(question_service, '_try_get_cached_question', return_value=None):
                    result = await question_service.generate_question("user123", 5)
                    
                    # Should get a fallback question instead of raising exception
                    assert isinstance(result, Question)
                    assert result.metadata.get("fallback_used") is True
                    assert "AI response missing required field" in result.metadata.get("fallback_reason", "")
    
    @pytest.mark.asyncio
    async def test_generate_question_unexpected_error(self, question_service):
        """Test question generation with unexpected error uses fallback."""
        with patch('app.services.question_generator.ai_service') as mock_ai_service:
            mock_ai_service.generate_question.side_effect = ValueError("Unexpected error")
            
            # Mock cache operations
            with patch('app.services.question_generator.CacheManager') as mock_cache_manager:
                mock_cache_instance = AsyncMock()
                mock_cache_manager.return_value = mock_cache_instance
                mock_cache_instance.get_cache.return_value = None
                mock_cache_instance.set_cache.return_value = True
                
                with patch.object(question_service, '_try_get_cached_question', return_value=None):
                    result = await question_service.generate_question("user123", 5)
                    
                    # Should get a fallback question instead of raising exception
                    assert isinstance(result, Question)
                    assert result.metadata.get("fallback_used") is True
                    assert "Unexpected error" in result.metadata.get("fallback_reason", "")
    
    @pytest.mark.asyncio
    async def test_get_question_from_cache(self, question_service, mock_redis, sample_ai_response):
        """Test retrieving question from cache."""
        # Create a question and convert to cache format
        question = question_service._convert_ai_data_to_question(
            sample_ai_response, 5, "transformations"
        )
        
        question_dict = {
            "id": question.id,
            "title": question.title,
            "description": question.description,
            "difficulty_level": question.difficulty_level.value,
            "topic": question.topic.value,
            "input_schema": question.input_schema,
            "sample_input": question.sample_input,
            "expected_output": question.expected_output,
            "test_cases": [
                {
                    "input_data": tc.input_data,
                    "expected_output": tc.expected_output,
                    "description": tc.description
                }
                for tc in question.test_cases
            ],
            "created_at": question.created_at.isoformat(),
            "metadata": question.metadata
        }
        
        # Mock CacheManager instead of direct Redis calls
        with patch('app.services.question_generator.CacheManager') as mock_cache_manager:
            mock_cache_instance = AsyncMock()
            mock_cache_manager.return_value = mock_cache_instance
            mock_cache_instance.get_cache.return_value = question_dict
            
            result = await question_service.get_question(question.id)
            
            assert result is not None
            assert isinstance(result, Question)
            assert result.id == question.id
            assert result.title == question.title
    
    @pytest.mark.asyncio
    async def test_get_question_not_found(self, question_service, mock_redis):
        """Test retrieving non-existent question."""
        mock_redis.get.return_value = None
        
        with patch.object(question_service, '_get_redis_client', return_value=mock_redis):
            result = await question_service.get_question("nonexistent")
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_get_question_cache_error(self, question_service, mock_redis):
        """Test retrieving question with cache error."""
        mock_redis.get.side_effect = Exception("Redis error")
        
        with patch.object(question_service, '_get_redis_client', return_value=mock_redis):
            result = await question_service.get_question("test_id")
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_get_rate_limit_status_success(self, question_service):
        """Test getting rate limit status successfully."""
        from app.services.ai_service import RateLimitInfo
        
        mock_rate_info = RateLimitInfo(
            requests_made=10,
            window_start=1000.0,
            requests_per_hour=100
        )
        
        with patch('app.services.question_generator.ai_service') as mock_ai_service:
            # Make the mock return a coroutine
            async def mock_get_rate_limit_status(*args, **kwargs):
                return mock_rate_info
            
            mock_ai_service.get_rate_limit_status = mock_get_rate_limit_status
            
            result = await question_service.get_rate_limit_status("user123")
            
            assert result["requests_made"] == 10
            assert result["requests_remaining"] == 90
            assert result["requests_per_hour"] == 100
            assert result["window_start"] == 1000.0
            assert result["reset_time"] == 4600.0  # 1000 + 3600
    
    @pytest.mark.asyncio
    async def test_enhanced_question_validation(self, question_service):
        """Test enhanced question quality validation."""
        # Test question with good quality
        good_question = {
            "title": "PySpark DataFrame Aggregation Challenge",
            "description": "Calculate average salary by department using PySpark DataFrame operations. Filter employees with salary > 50000 and group by department to compute mean salary.",
            "input_schema": {
                "employee_id": "int",
                "name": "string",
                "department": "string",
                "salary": "double",
                "hire_date": "date"
            },
            "sample_input": {
                "data": [
                    {"employee_id": 1, "name": "Alice", "department": "Engineering", "salary": 75000.0, "hire_date": "2020-01-15"},
                    {"employee_id": 2, "name": "Bob", "department": "Marketing", "salary": 45000.0, "hire_date": "2019-03-20"},
                    {"employee_id": 3, "name": "Charlie", "department": "Engineering", "salary": 80000.0, "hire_date": "2021-06-10"},
                    {"employee_id": 4, "name": "Diana", "department": "Sales", "salary": 55000.0, "hire_date": "2020-11-05"}
                ]
            },
            "expected_output": {
                "data": [
                    {"department": "Engineering", "avg_salary": 77500.0},
                    {"department": "Sales", "avg_salary": 55000.0}
                ]
            },
            "test_cases": [
                {
                    "description": "Filter and aggregate test case",
                    "input_data": {
                        "data": [
                            {"employee_id": 1, "name": "Alice", "department": "Engineering", "salary": 75000.0, "hire_date": "2020-01-15"},
                            {"employee_id": 2, "name": "Bob", "department": "Marketing", "salary": 45000.0, "hire_date": "2019-03-20"}
                        ]
                    },
                    "expected_output": {
                        "data": [
                            {"department": "Engineering", "avg_salary": 75000.0}
                        ]
                    }
                }
            ]
        }
        
        issues = question_service._validate_question_quality(good_question)
        assert len(issues) <= 2, f"Good question should have few issues, got: {issues}"
        
        # Test question with poor quality
        poor_question = {
            "title": "Test",  # Too short and generic
            "description": "Do something",  # Too short, no PySpark terms
            "input_schema": {
                "id": "invalid_type"  # Invalid data type
            },
            "sample_input": {
                "data": [
                    {"id": 1}  # Only one row, no variety
                ]
            },
            "expected_output": {
                "data": []  # Empty output
            },
            "test_cases": []  # No test cases
        }
        
        issues = question_service._validate_question_quality(poor_question)
        assert len(issues) > 5, f"Poor question should have many issues, got: {issues}"
    
    @pytest.mark.asyncio
    async def test_enhanced_caching_with_metadata(self, question_service, mock_redis, sample_ai_response):
        """Test enhanced caching with metadata and error handling."""
        question = question_service._convert_ai_data_to_question(
            sample_ai_response, 5, "transformations"
        )
        
        with patch.object(question_service, '_get_redis_client', return_value=mock_redis):
            # Mock CacheManager
            with patch('app.services.question_generator.CacheManager') as mock_cache_manager:
                mock_cache_instance = AsyncMock()
                mock_cache_manager.return_value = mock_cache_instance
                mock_cache_instance.set_cache.return_value = True
                mock_cache_instance.get_cache.return_value = []
                
                await question_service._cache_question(question)
                
                # Verify main cache call
                assert mock_cache_instance.set_cache.call_count >= 1
                
                # Check that cached data includes enhanced metadata
                main_cache_call = mock_cache_instance.set_cache.call_args_list[0]
                cached_data = main_cache_call[0][1]  # Second argument is the data
                
                assert "cache_version" in cached_data
                assert "quality_validated" in cached_data
                assert "cached_at" in cached_data
    
    @pytest.mark.asyncio
    async def test_fallback_question_enhancement(self, question_service):
        """Test enhanced fallback question selection and enhancement."""
        # Test fallback for beginner
        fallback = question_service._get_fallback_question(1, "transformations")
        
        assert "title" in fallback
        assert "description" in fallback
        assert len(fallback["description"]) >= 50
        assert "test_cases" in fallback
        assert len(fallback["test_cases"]) >= 1
        assert "metadata" in fallback
        assert fallback["metadata"]["fallback_used"] is True
        assert "quality_score" in fallback["metadata"]
        
        # Test fallback for advanced with unavailable topic
        fallback_advanced = question_service._get_fallback_question(10, "nonexistent_topic")
        
        assert "title" in fallback_advanced
        assert "metadata" in fallback_advanced
        assert fallback_advanced["metadata"]["fallback_used"] is True
    
    @pytest.mark.asyncio
    async def test_emergency_fallback_question(self, question_service):
        """Test emergency fallback question creation."""
        emergency = question_service._create_emergency_fallback_question(5)
        
        assert emergency["title"] == "DataFrame Basic Operations"
        assert len(emergency["description"]) >= 50
        assert "input_schema" in emergency
        assert len(emergency["input_schema"]) >= 3
        assert "sample_input" in emergency
        assert len(emergency["sample_input"]["data"]) >= 3
        assert "expected_output" in emergency
        assert "test_cases" in emergency
        assert len(emergency["test_cases"]) >= 1
        assert emergency["metadata"]["emergency_fallback"] is True
    
    @pytest.mark.asyncio
    async def test_cached_question_retrieval(self, question_service, mock_redis):
        """Test trying to get cached questions that match criteria."""
        with patch.object(question_service, '_get_redis_client', return_value=mock_redis):
            with patch('app.services.question_generator.CacheManager') as mock_cache_manager:
                mock_cache_instance = AsyncMock()
                mock_cache_manager.return_value = mock_cache_instance
                
                # Mock cached questions by level
                mock_cache_instance.get_cache.return_value = [
                    {
                        "id": "cached_question_1",
                        "topic": "transformations",
                        "difficulty": 2,
                        "title": "Cached Question",
                        "quality_score": 8.0
                    }
                ]
                
                # Mock successful question retrieval and validation
                with patch.object(question_service, 'get_question') as mock_get_question, \
                     patch.object(question_service, 'validate_cached_question', return_value=True):
                    
                    mock_question = Question(
                        id="cached_question_1",
                        title="Cached Question",
                        description="A cached question for testing",
                        difficulty_level=DifficultyLevel.INTERMEDIATE,
                        topic=QuestionTopic.TRANSFORMATIONS,
                        input_schema={"id": "int"},
                        sample_input={"data": [{"id": 1}]},
                        expected_output={"data": [{"result": 2}]},
                        test_cases=[],
                        created_at=datetime.utcnow(),
                        metadata={}
                    )
                    mock_get_question.return_value = mock_question
                    
                    result = await question_service._try_get_cached_question("user123", 5, "transformations")
                    
                    assert result is not None
                    assert result.id == "cached_question_1"
    
    @pytest.mark.asyncio
    async def test_cache_statistics(self, question_service, mock_redis):
        """Test cache statistics collection."""
        # Mock Redis info and keys
        mock_redis.info.return_value = {
            "used_memory_human": "10MB",
            "used_memory_peak_human": "15MB"
        }
        mock_redis.keys.side_effect = [
            ["question:1", "question:2"],  # question keys
            ["questions_by_topic:transformations:1"],  # topic keys
            ["user_recent_questions:user1"]  # user keys
        ]
        
        with patch.object(question_service, '_get_redis_client', return_value=mock_redis):
            with patch.object(question_service, '_calculate_cache_hit_ratio', return_value=0.75):
                stats = await question_service.get_cache_statistics()
                
                assert stats["redis_connected"] is True
                assert stats["cached_questions"] == 2
                assert stats["topic_caches"] == 1
                assert stats["user_caches"] == 1
                assert stats["memory_used"] == "10MB"
                assert stats["cache_hit_ratio"] == 0.75
    
    @pytest.mark.asyncio
    async def test_cache_clearing(self, question_service, mock_redis):
        """Test cache clearing functionality."""
        mock_redis.keys.side_effect = [
            ["question:1", "question:2"],  # question keys
        ]
        mock_redis.delete.return_value = 2
        
        with patch.object(question_service, '_get_redis_client', return_value=mock_redis):
            result = await question_service.clear_cache("questions")
            
            assert result["success"] is True
            assert result["cleared_count"] == 2
            assert result["cache_type"] == "questions"
    
    @pytest.mark.asyncio
    async def test_generate_question_with_enhanced_validation(self, question_service, sample_ai_response, mock_redis):
        """Test question generation with enhanced validation and caching."""
        with patch('app.services.question_generator.ai_service') as mock_ai_service, \
             patch.object(question_service, '_get_redis_client', return_value=mock_redis):
            
            # Mock successful AI generation
            async def mock_generate_question(*args, **kwargs):
                return sample_ai_response
            
            mock_ai_service.generate_question = mock_generate_question
            
            # Mock cache operations
            with patch('app.services.question_generator.CacheManager') as mock_cache_manager:
                mock_cache_instance = AsyncMock()
                mock_cache_manager.return_value = mock_cache_instance
                mock_cache_instance.get_cache.return_value = None  # No cached question
                mock_cache_instance.set_cache.return_value = True
                
                # Mock no cached question available
                with patch.object(question_service, '_try_get_cached_question', return_value=None):
                    result = await question_service.generate_question("user123", 5, "transformations")
                    
                    assert isinstance(result, Question)
                    assert result.title == sample_ai_response["title"]
                    assert result.difficulty_level == DifficultyLevel.INTERMEDIATE
                    assert result.topic == QuestionTopic.TRANSFORMATIONS
                    
                    # Verify enhanced caching was attempted
                    assert mock_cache_instance.set_cache.call_count >= 1
    
    @pytest.mark.asyncio
    async def test_generate_question_with_fallback_on_quality_issues(self, question_service, mock_redis):
        """Test question generation falls back when AI generates poor quality questions."""
        poor_ai_response = {
            "title": "Test",  # Poor quality
            "description": "Do something",  # Poor quality
            "input_schema": {"id": "int"},
            "sample_input": {"data": [{"id": 1}]},
            "expected_output": {"data": [{"result": 2}]}
        }
        
        with patch('app.services.question_generator.ai_service') as mock_ai_service, \
             patch.object(question_service, '_get_redis_client', return_value=mock_redis):
            
            async def mock_generate_question(*args, **kwargs):
                return poor_ai_response
            
            mock_ai_service.generate_question = mock_generate_question
            
            # Mock cache operations
            with patch('app.services.question_generator.CacheManager') as mock_cache_manager:
                mock_cache_instance = AsyncMock()
                mock_cache_manager.return_value = mock_cache_instance
                mock_cache_instance.get_cache.return_value = None
                mock_cache_instance.set_cache.return_value = True
                
                with patch.object(question_service, '_try_get_cached_question', return_value=None):
                    result = await question_service.generate_question("user123", 1, "transformations")
                    
                    # Should get a fallback question instead of the poor AI response
                    assert isinstance(result, Question)
                    assert result.metadata.get("fallback_used") is True
                    assert "Quality issues" in result.metadata.get("fallback_reason", "")
    
    @pytest.mark.asyncio
    async def test_cache_warming(self, question_service):
        """Test cache warming functionality."""
        with patch.object(question_service, '_try_get_cached_question', return_value=None), \
             patch.object(question_service, 'generate_question') as mock_generate:
            
            # Mock successful question generation
            mock_question = Question(
                id="warmed_question",
                title="Warmed Question",
                description="A question generated during cache warming",
                difficulty_level=DifficultyLevel.BEGINNER,
                topic=QuestionTopic.TRANSFORMATIONS,
                input_schema={"id": "int"},
                sample_input={"data": [{"id": 1}]},
                expected_output={"data": [{"result": 2}]},
                test_cases=[],
                created_at=datetime.utcnow(),
                metadata={}
            )
            mock_generate.return_value = mock_question
            
            result = await question_service.warm_cache("user123", [1], ["transformations"])
            
            assert result["success"] is True
            assert result["generated_count"] == 1
            assert result["failed_count"] == 0
            mock_generate.assert_called_once_with("user123", 1, "transformations")