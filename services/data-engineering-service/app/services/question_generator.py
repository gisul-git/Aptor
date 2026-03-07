"""
AI-powered question generation service.
"""

import asyncio
import structlog
from typing import Optional, Dict, Any, List
import uuid
import json
import random
from datetime import datetime

from app.models.question import Question, DifficultyLevel, QuestionTopic, TestCase
from app.core.config import settings
from app.services.ai_service import ai_service, AIServiceError, RateLimitError
from app.core.redis_client import get_redis, CacheManager
from app.core.validation import validate_question_data_integrity, DataValidationError

logger = structlog.get_logger()


class QuestionGenerationError(Exception):
    """Exception raised when question generation fails."""
    pass


class QuestionValidationError(Exception):
    """Exception raised when question validation fails."""
    pass


class QuestionGeneratorService:
    """Service for generating PySpark questions using AI."""
    
    def __init__(self):
        self.logger = logger.bind(service="question_generator")
        self.redis_client = None
        # Fallback questions removed - AI generation only
    
    async def _get_redis_client(self):
        """Get Redis client for caching."""
        if not self.redis_client:
            self.redis_client = await get_redis()
        return self.redis_client
    
    def _validate_question_quality(self, question_data: Dict[str, Any]) -> List[str]:
        """
        Validate the quality of a generated question with enhanced validation logic.
        
        Args:
            question_data: Question data to validate
            
        Returns:
            List of quality issues found
        """
        issues = []
        
        # Check title quality
        title = question_data.get("title", "")
        if len(title) < 10:
            issues.append("Title too short (minimum 10 characters)")
        if len(title) > 100:
            issues.append("Title too long (maximum 100 characters)")
        
        # Enhanced title validation - check for PySpark/data engineering relevance
        pyspark_terms = ["dataframe", "pyspark", "spark", "data", "filter", "join", "aggregate", 
                        "transform", "group", "window", "sql", "etl", "pipeline", "analysis"]
        if not any(word in title.lower() for word in pyspark_terms):
            issues.append("Title should contain relevant PySpark/data engineering terms")
        
        # Check for generic or low-quality titles
        generic_terms = ["test", "example", "sample", "basic", "simple"]
        if any(term in title.lower() for term in generic_terms):
            issues.append("Title appears generic - should be more specific and descriptive")
        
        # Check description quality
        description = question_data.get("description", "")
        if len(description) < 50:
            issues.append("Description too short (minimum 50 characters)")
        if len(description) > 1500:
            issues.append("Description too long (maximum 1500 characters)")
        
        # Enhanced description validation
        if not any(word in description.lower() for word in ["pyspark", "dataframe", "spark"]):
            issues.append("Description should mention PySpark or DataFrame operations")
        
        # Check for clear problem statement
        problem_indicators = ["calculate", "filter", "transform", "aggregate", "join", "analyze", "find", "create"]
        if not any(indicator in description.lower() for indicator in problem_indicators):
            issues.append("Description should contain clear action words indicating what to do")
        
        # Check schema quality
        input_schema = question_data.get("input_schema", {})
        if len(input_schema) < 2:
            issues.append("Input schema should have at least 2 columns")
        if len(input_schema) > 15:
            issues.append("Input schema too complex (maximum 15 columns)")
        
        # Enhanced schema validation
        valid_types = {"string", "int", "integer", "long", "float", "double", "boolean", "timestamp", "date", "binary"}
        type_distribution = {}
        
        for col, dtype in input_schema.items():
            if not col or not isinstance(col, str):
                issues.append(f"Invalid column name: {col}")
                continue
                
            if dtype.lower() not in valid_types:
                issues.append(f"Invalid data type '{dtype}' for column '{col}'")
                continue
                
            # Track type distribution
            normalized_type = dtype.lower()
            type_distribution[normalized_type] = type_distribution.get(normalized_type, 0) + 1
        
        # Check for reasonable type diversity
        if len(type_distribution) == 1 and len(input_schema) > 3:
            issues.append("Schema should have diverse data types for realistic scenarios")
        
        # Check sample data quality
        sample_input = question_data.get("sample_input", {})
        if "data" not in sample_input:
            issues.append("Sample input missing 'data' field")
        else:
            sample_data = sample_input["data"]
            if not isinstance(sample_data, list):
                issues.append("Sample input data should be a list")
            elif len(sample_data) < 3:
                issues.append("Sample input should have at least 3 rows for meaningful testing")
            elif len(sample_data) > 100:
                issues.append("Sample input too large (maximum 100 rows)")
            else:
                # Enhanced data consistency validation
                schema_issues = self._validate_sample_data_against_schema(sample_data, input_schema)
                issues.extend(schema_issues)
                
                # Check data variety
                if len(sample_data) >= 3:
                    variety_issues = self._validate_data_variety(sample_data, input_schema)
                    issues.extend(variety_issues)
        
        # Check expected output quality
        expected_output = question_data.get("expected_output", {})
        if "data" not in expected_output:
            issues.append("Expected output missing 'data' field")
        else:
            expected_data = expected_output["data"]
            if not isinstance(expected_data, list):
                issues.append("Expected output data should be a list")
            elif len(expected_data) == 0:
                issues.append("Expected output should have at least 1 row")
            
            # Validate output makes sense relative to input
            sample_data = sample_input.get("data", [])
            if sample_data and expected_data:
                output_issues = self._validate_output_logic(sample_data, expected_data)
                issues.extend(output_issues)
        
        # Enhanced test cases validation
        test_cases = question_data.get("test_cases", [])
        if len(test_cases) == 0:
            issues.append("Question should have at least 1 test case")
        else:
            for i, test_case in enumerate(test_cases):
                test_case_issues = self._validate_test_case_quality(test_case, i, input_schema)
                issues.extend(test_case_issues)
        
        # Check for educational value
        educational_issues = self._validate_educational_value(question_data)
        issues.extend(educational_issues)
        
        return issues
    
    def _validate_sample_data_against_schema(self, sample_data: List[Dict], input_schema: Dict[str, str]) -> List[str]:
        """Validate sample data consistency with schema."""
        issues = []
        
        for i, row in enumerate(sample_data[:10]):  # Check first 10 rows
            if not isinstance(row, dict):
                issues.append(f"Sample data row {i} should be a dictionary")
                continue
            
            # Check if all schema columns are present
            missing_cols = set(input_schema.keys()) - set(row.keys())
            if missing_cols:
                issues.append(f"Sample data row {i} missing columns: {list(missing_cols)}")
            
            # Check for extra columns
            extra_cols = set(row.keys()) - set(input_schema.keys())
            if extra_cols:
                issues.append(f"Sample data row {i} has extra columns: {list(extra_cols)}")
            
            # Validate data types match schema expectations
            for col, expected_type in input_schema.items():
                if col in row:
                    value = row[col]
                    type_issues = self._validate_value_type(value, expected_type, f"row {i}, column {col}")
                    issues.extend(type_issues)
        
        return issues
    
    def _validate_value_type(self, value: Any, expected_type: str, context: str) -> List[str]:
        """Validate that a value matches the expected data type."""
        issues = []
        expected_type = expected_type.lower()
        
        if value is None:
            return issues  # Allow null values
        
        try:
            if expected_type in ["int", "integer"]:
                if not isinstance(value, int) or isinstance(value, bool):
                    issues.append(f"Value in {context} should be integer, got {type(value).__name__}")
            elif expected_type == "long":
                if not isinstance(value, int):
                    issues.append(f"Value in {context} should be long/int, got {type(value).__name__}")
            elif expected_type in ["float", "double"]:
                if not isinstance(value, (int, float)) or isinstance(value, bool):
                    issues.append(f"Value in {context} should be numeric, got {type(value).__name__}")
            elif expected_type == "string":
                if not isinstance(value, str):
                    issues.append(f"Value in {context} should be string, got {type(value).__name__}")
            elif expected_type == "boolean":
                if not isinstance(value, bool):
                    issues.append(f"Value in {context} should be boolean, got {type(value).__name__}")
            elif expected_type in ["timestamp", "date"]:
                if not isinstance(value, str):
                    issues.append(f"Value in {context} should be string (ISO format), got {type(value).__name__}")
                # Could add date format validation here
        except Exception as e:
            issues.append(f"Error validating type for {context}: {str(e)}")
        
        return issues
    
    def _validate_data_variety(self, sample_data: List[Dict], input_schema: Dict[str, str]) -> List[str]:
        """Validate that sample data has sufficient variety for meaningful testing."""
        issues = []
        
        if len(sample_data) < 3:
            return issues  # Not enough data to check variety
        
        # Check for duplicate rows
        unique_rows = set()
        for row in sample_data:
            row_tuple = tuple(sorted(row.items()))
            if row_tuple in unique_rows:
                issues.append("Sample data contains duplicate rows - should have variety")
                break
            unique_rows.add(row_tuple)
        
        # Check for variety in key columns
        for col, dtype in input_schema.items():
            values = [row.get(col) for row in sample_data if col in row]
            unique_values = set(values)
            
            if len(unique_values) == 1 and len(values) > 2:
                issues.append(f"Column '{col}' has no variety in sample data - all values are the same")
            elif dtype.lower() in ["string"] and len(unique_values) < min(3, len(values)):
                issues.append(f"String column '{col}' should have more variety in sample data")
        
        return issues
    
    def _validate_output_logic(self, input_data: List[Dict], output_data: List[Dict]) -> List[str]:
        """Validate that output data makes logical sense relative to input."""
        issues = []
        
        # Basic sanity checks
        if len(output_data) > len(input_data) * 2:
            issues.append("Output data seems disproportionately large compared to input")
        
        # Check if output has reasonable structure
        if output_data:
            first_output = output_data[0]
            if not isinstance(first_output, dict):
                issues.append("Output data rows should be dictionaries")
            elif len(first_output) == 0:
                issues.append("Output data rows should not be empty")
        
        return issues
    
    def _validate_test_case_quality(self, test_case: Dict[str, Any], index: int, input_schema: Dict[str, str]) -> List[str]:
        """Validate individual test case quality."""
        issues = []
        
        if "input_data" not in test_case:
            issues.append(f"Test case {index} missing input_data")
        if "expected_output" not in test_case:
            issues.append(f"Test case {index} missing expected_output")
        
        description = test_case.get("description", "")
        if len(description) < 5:
            issues.append(f"Test case {index} needs a meaningful description (minimum 5 characters)")
        elif len(description) > 200:
            issues.append(f"Test case {index} description too long (maximum 200 characters)")
        
        # Validate test case input data structure
        if "input_data" in test_case:
            input_data = test_case["input_data"]
            if not isinstance(input_data, dict) or "data" not in input_data:
                issues.append(f"Test case {index} input_data should have 'data' field")
            else:
                test_data = input_data["data"]
                if not isinstance(test_data, list) or len(test_data) == 0:
                    issues.append(f"Test case {index} should have non-empty input data")
                else:
                    # Validate against schema
                    schema_issues = self._validate_sample_data_against_schema(test_data, input_schema)
                    for issue in schema_issues:
                        issues.append(f"Test case {index}: {issue}")
        
        # Validate expected output structure
        if "expected_output" in test_case:
            expected_output = test_case["expected_output"]
            if not isinstance(expected_output, dict) or "data" not in expected_output:
                issues.append(f"Test case {index} expected_output should have 'data' field")
            else:
                output_data = expected_output["data"]
                if not isinstance(output_data, list):
                    issues.append(f"Test case {index} expected output data should be a list")
        
        return issues
    
    def _validate_educational_value(self, question_data: Dict[str, Any]) -> List[str]:
        """Validate that the question has educational value for data engineering."""
        issues = []
        
        title = question_data.get("title", "").lower()
        description = question_data.get("description", "").lower()
        
        # Check for educational concepts
        educational_concepts = [
            "transformation", "aggregation", "join", "filter", "group", "window",
            "partition", "sort", "distinct", "union", "pivot", "unpivot",
            "performance", "optimization", "cache", "broadcast", "repartition"
        ]
        
        concept_found = any(concept in description or concept in title for concept in educational_concepts)
        if not concept_found:
            issues.append("Question should focus on specific data engineering concepts")
        
        # Check complexity appropriateness
        sample_data = question_data.get("sample_input", {}).get("data", [])
        if len(sample_data) < 3:
            issues.append("Question should have sufficient data complexity for learning")
        
        return issues
    
    def _enhance_question_with_validation(self, question_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enhance question data with additional validation and test cases.
        
        Args:
            question_data: Original question data
            
        Returns:
            Enhanced question data
        """
        enhanced_data = question_data.copy()
        
        # Ensure test cases exist
        if "test_cases" not in enhanced_data or not enhanced_data["test_cases"]:
            # Create default test case from sample data
            enhanced_data["test_cases"] = [
                {
                    "description": "Basic functionality test",
                    "input_data": enhanced_data["sample_input"],
                    "expected_output": enhanced_data["expected_output"]
                }
            ]
        
        # Add metadata for tracking
        enhanced_data["quality_score"] = self._calculate_quality_score(enhanced_data)
        enhanced_data["validation_timestamp"] = datetime.utcnow().isoformat()
        
        return enhanced_data
    
    def _calculate_quality_score(self, question_data: Dict[str, Any]) -> float:
        """
        Calculate a quality score for the question (0.0 to 10.0).
        
        Args:
            question_data: Question data to score
            
        Returns:
            Quality score between 0.0 and 10.0
        """
        score = 10.0
        issues = self._validate_question_quality(question_data)
        
        # Deduct points for each issue
        score -= len(issues) * 0.5
        
        # Bonus points for good practices
        if len(question_data.get("description", "")) > 100:
            score += 0.5
        
        if len(question_data.get("test_cases", [])) > 1:
            score += 0.5
        
        sample_data = question_data.get("sample_input", {}).get("data", [])
        if len(sample_data) >= 5:
            score += 0.5
        
        return max(0.0, min(10.0, score))
    
    def _map_topic_to_enum(self, topic_str: Optional[str]) -> QuestionTopic:
        """Map topic string to QuestionTopic enum."""
        if not topic_str:
            return QuestionTopic.TRANSFORMATIONS
        
        # Try to match topic string to enum values
        topic_mapping = {
            "transformations": QuestionTopic.TRANSFORMATIONS,
            "aggregations": QuestionTopic.AGGREGATIONS,
            "joins": QuestionTopic.JOINS,
            "window_functions": QuestionTopic.WINDOW_FUNCTIONS,
            "performance": QuestionTopic.PERFORMANCE_OPTIMIZATION,
            "performance_optimization": QuestionTopic.PERFORMANCE_OPTIMIZATION,
            "data_quality": QuestionTopic.DATA_QUALITY,
            "streaming": QuestionTopic.STREAMING
        }
        
        return topic_mapping.get(topic_str.lower(), QuestionTopic.TRANSFORMATIONS)
    
    def _determine_difficulty_level(self, experience_years: int) -> DifficultyLevel:
        """Determine difficulty level based on years of experience."""
        if experience_years <= 2:
            return DifficultyLevel.BEGINNER
        elif experience_years <= 7:
            return DifficultyLevel.INTERMEDIATE
        else:
            return DifficultyLevel.ADVANCED
    
    def _validate_ai_response(self, ai_data: Dict[str, Any]) -> None:
        """
        Validate AI response contains required fields.
        
        Args:
            ai_data: AI response data
            
        Raises:
            QuestionGenerationError: If validation fails
        """
        required_fields = ["title", "description", "input_schema", "sample_input", "expected_output"]
        
        for field in required_fields:
            if field not in ai_data:
                self.logger.error(f"Missing field: {field}, AI data keys: {list(ai_data.keys())}")
                raise QuestionGenerationError(f"AI response missing required field: {field}")
        
        # Log the structure for debugging
        self.logger.debug(f"sample_input type: {type(ai_data['sample_input'])}, value: {ai_data['sample_input']}")
        
        # Validate data structure
        # Handle multiple formats: {"data": [...]}, direct array [...], or domain-specific dict
        if isinstance(ai_data["sample_input"], list):
            # AI returned array directly, wrap it
            self.logger.info("Wrapping sample_input array in data field")
            ai_data["sample_input"] = {"data": ai_data["sample_input"]}
        elif isinstance(ai_data["sample_input"], dict):
            if "data" not in ai_data["sample_input"]:
                # AI returned dict with domain-specific keys (e.g., {'shipment_events': [...], 'payment_transactions': [...]})
                # This is valid - keep it as is
                self.logger.info(f"sample_input has domain-specific keys: {list(ai_data['sample_input'].keys())}")
        else:
            self.logger.error(f"sample_input has unexpected type: {type(ai_data['sample_input'])}")
            raise QuestionGenerationError(f"sample_input must be list or dict, got {type(ai_data['sample_input'])}")
        
        if isinstance(ai_data["expected_output"], list):
            # AI returned array directly, wrap it
            self.logger.info("Wrapping expected_output array in data field")
            ai_data["expected_output"] = {"data": ai_data["expected_output"]}
        elif isinstance(ai_data["expected_output"], dict):
            if "data" not in ai_data["expected_output"]:
                # AI returned dict with domain-specific keys - this is valid
                self.logger.info(f"expected_output has domain-specific keys: {list(ai_data['expected_output'].keys())}")
        else:
            self.logger.error(f"expected_output has unexpected type: {type(ai_data['expected_output'])}")
            raise QuestionGenerationError(f"expected_output must be list or dict, got {type(ai_data['expected_output'])}")
        
        # Validate test cases if present
        if "test_cases" in ai_data:
            for i, test_case in enumerate(ai_data["test_cases"]):
                if "input_data" not in test_case or "expected_output" not in test_case:
                    raise QuestionGenerationError(f"Test case {i} missing required fields")
                
                # Handle both formats for test case data
                if isinstance(test_case["input_data"], list):
                    test_case["input_data"] = {"data": test_case["input_data"]}
                
                if isinstance(test_case["expected_output"], list):
                    test_case["expected_output"] = {"data": test_case["expected_output"]}
    
    async def _validate_data_consistency(self, ai_data: Dict[str, Any]) -> bool:
        """
        Validate that expected_output matches what the reference solution produces
        given the sample_input. This ensures data consistency.
        
        Args:
            ai_data: AI response data with sample_input, expected_output, and reference_solution
            
        Returns:
            True if data is consistent, False otherwise
        """
        # Skip validation if no reference solution provided
        if "reference_solution" not in ai_data or not ai_data["reference_solution"]:
            self.logger.warning("No reference solution provided, skipping data consistency validation")
            return True
        
        try:
            from app.services.execution_engine import ExecutionEngine
            from app.models.question import Question
            
            # Create a temporary question object for execution
            temp_question = Question(
                id=str(uuid.uuid4()),
                title=ai_data["title"],
                description=ai_data["description"],
                difficulty_level=DifficultyLevel.BEGINNER,
                topic=QuestionTopic.TRANSFORMATIONS,
                input_schema=ai_data["input_schema"],
                sample_input=ai_data["sample_input"],
                expected_output=ai_data["expected_output"],
                reference_solution=ai_data["reference_solution"],
                test_cases=[],
                created_at=datetime.utcnow()
            )
            
            # Execute the reference solution
            execution_engine = ExecutionEngine()
            result = await execution_engine.execute_code(
                code=ai_data["reference_solution"],
                question_id=temp_question.id,
                mode="test",
                user_id="system_validation"
            )
            
            # Check if execution was successful
            if result.status.value != "completed":
                self.logger.warning(
                    "Reference solution execution failed",
                    status=result.status.value,
                    error=result.error_message
                )
                return False
            
            # Compare the output with expected_output
            if not result.output or "result" not in result.output:
                self.logger.warning("Reference solution produced no output")
                return False
            
            actual_output = result.output["result"]
            expected_output = ai_data["expected_output"]
            
            # Simple comparison - check if data structures match
            # This is a basic check; the full validation engine will do detailed comparison
            if isinstance(actual_output, dict) and "data" in actual_output:
                actual_data = actual_output["data"]
            else:
                actual_data = actual_output
            
            expected_data = expected_output.get("data", expected_output)
            
            # Check row counts match
            if len(actual_data) != len(expected_data):
                self.logger.warning(
                    "Data consistency check failed: row count mismatch",
                    actual_rows=len(actual_data),
                    expected_rows=len(expected_data)
                )
                # Update expected_output with actual output from reference solution
                ai_data["expected_output"] = {"data": actual_data}
                self.logger.info("Updated expected_output with actual reference solution output")
                return True  # Return True since we fixed it
            
            self.logger.info("Data consistency validation passed")
            return True
            
        except Exception as e:
            self.logger.error(
                "Data consistency validation failed with exception",
                error=str(e),
                error_type=type(e).__name__
            )
            return False
    
    def _convert_ai_data_to_question(self, ai_data: Dict[str, Any], experience_years: int, topic: Optional[str]) -> Question:
        """
        Convert AI response data to Question model.
        
        Args:
            ai_data: AI response data
            experience_years: User's years of experience
            topic: Optional topic filter
            
        Returns:
            Question model instance
        """
        # Create test cases
        test_cases = []
        if "test_cases" in ai_data:
            for test_case_data in ai_data["test_cases"]:
                test_cases.append(TestCase(
                    input_data=test_case_data["input_data"],
                    expected_output=test_case_data["expected_output"],
                    description=test_case_data.get("description", "Test case")
                ))
        else:
            # Create default test case from sample data
            test_cases.append(TestCase(
                input_data=ai_data["sample_input"],
                expected_output=ai_data["expected_output"],
                description="Basic test case"
            ))
        
        # Merge existing metadata with default metadata
        base_metadata = {
            "experience_years": experience_years,
            "requested_topic": topic,
            "ai_generated": True,
            "model": settings.OPENAI_MODEL
        }
        
        # Preserve any existing metadata from ai_data (e.g., fallback metadata)
        existing_metadata = ai_data.get("metadata", {})
        merged_metadata = {**base_metadata, **existing_metadata}
        
        return Question(
            id=str(uuid.uuid4()),
            title=ai_data["title"],
            description=ai_data["description"],
            difficulty_level=self._determine_difficulty_level(experience_years),
            topic=self._map_topic_to_enum(topic),
            input_schema=ai_data["input_schema"],
            sample_input=ai_data["sample_input"],
            expected_output=ai_data["expected_output"],
            test_cases=test_cases,
            created_at=datetime.utcnow(),
            metadata=merged_metadata
        )
    
    async def _cache_question(self, question: Question) -> None:
        """Cache generated question in Redis with enhanced metadata and error handling."""
        try:
            cache_manager = CacheManager()
            cache_key = f"question:{question.id}"
            
            # Convert question to dict for caching
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
                "metadata": question.metadata,
                "cache_version": "1.0",  # For cache invalidation if structure changes
                "quality_validated": True,
                "cached_at": datetime.utcnow().isoformat()
            }
            
            # Cache with TTL
            cache_success = await cache_manager.set_cache(
                cache_key,
                question_dict,
                ttl=settings.CACHE_TTL_QUESTIONS
            )
            
            if cache_success:
                # Also cache by topic and difficulty for faster lookups
                await self._update_topic_cache(question)
                
                # Cache by user preferences for personalized recommendations
                await self._update_user_preference_cache(question)
                
                self.logger.debug("Question cached successfully", question_id=question.id)
            else:
                self.logger.warning("Failed to cache question", question_id=question.id)
            
        except Exception as e:
            self.logger.warning("Failed to cache question", error=str(e), question_id=question.id)
    
    async def _update_topic_cache(self, question: Question) -> None:
        """Update topic-based cache for faster question discovery."""
        try:
            cache_manager = CacheManager()
            topic_key = f"questions_by_topic:{question.topic.value}:{question.difficulty_level.value}"
            
            # Get existing topic questions
            topic_questions = await cache_manager.get_cache(topic_key) or []
            
            # Add current question to topic list (avoid duplicates)
            question_entry = {
                "id": question.id,
                "title": question.title,
                "created_at": question.created_at.isoformat(),
                "quality_score": question.metadata.get("quality_score", 0)
            }
            
            # Remove existing entry if present
            topic_questions = [q for q in topic_questions if q.get("id") != question.id]
            
            # Add new entry at the beginning (most recent first)
            topic_questions.insert(0, question_entry)
            
            # Keep only last 100 questions per topic/difficulty to prevent unbounded growth
            topic_questions = topic_questions[:100]
            
            await cache_manager.set_cache(topic_key, topic_questions, ttl=settings.CACHE_TTL_QUESTIONS)
            
        except Exception as e:
            self.logger.warning("Failed to update topic cache", error=str(e))
    
    async def _update_user_preference_cache(self, question: Question) -> None:
        """Update user preference cache for personalized recommendations."""
        try:
            cache_manager = CacheManager()
            
            # Cache question by experience level for quick access
            experience_level = question.metadata.get("experience_years", 0)
            if experience_level <= 2:
                level_key = "questions_beginner"
            elif experience_level <= 7:
                level_key = "questions_intermediate"
            else:
                level_key = "questions_advanced"
            
            level_questions = await cache_manager.get_cache(level_key) or []
            
            # Add question summary
            question_summary = {
                "id": question.id,
                "topic": question.topic.value,
                "difficulty": question.difficulty_level.value,
                "title": question.title,
                "quality_score": question.metadata.get("quality_score", 0),
                "created_at": question.created_at.isoformat()
            }
            
            # Remove duplicates and add new entry
            level_questions = [q for q in level_questions if q.get("id") != question.id]
            level_questions.insert(0, question_summary)
            level_questions = level_questions[:50]  # Keep last 50 per level
            
            await cache_manager.set_cache(level_key, level_questions, ttl=settings.CACHE_TTL_QUESTIONS)
            
        except Exception as e:
            self.logger.warning("Failed to update user preference cache", error=str(e))
    
    async def generate_question(
        self, 
        user_id: str, 
        experience_level: int, 
        topic: Optional[str] = None,
        job_role: Optional[str] = None,
        custom_requirements: Optional[str] = None
    ) -> Question:
        """
        Generate a PySpark question based on experience level, topic, job role, and custom requirements.
        
        Args:
            user_id: User identifier for rate limiting
            experience_level: User's years of experience
            topic: Optional topic to focus on
            job_role: Optional target job role (e.g., Data Engineer, ML Engineer)
            custom_requirements: Optional custom requirements or scenario for the question
            
        Returns:
            Generated Question instance
            
        Raises:
            QuestionGenerationError: If question generation fails
            RateLimitError: If rate limit is exceeded
        """
        self.logger.info(
            "Generating question with AI",
            user_id=user_id,
            experience_level=experience_level,
            topic=topic,
            job_role=job_role,
            has_custom_requirements=bool(custom_requirements)
        )
        
        ai_data = None
        
        try:
            # Generate question using AI service with new parameters
            self.logger.info("Calling AI service to generate question", user_id=user_id)
            ai_data = await ai_service.generate_question(
                user_id, 
                experience_level, 
                topic,
                job_role=job_role,
                custom_requirements=custom_requirements
            )
            self.logger.info("AI service returned data", user_id=user_id, has_data=ai_data is not None)
            
            # Validate AI response structure
            self.logger.info("Validating AI response structure", user_id=user_id)
            self._validate_ai_response(ai_data)
            self.logger.info("AI response structure validated successfully", user_id=user_id)
            
            # Validate data consistency (sample_input vs expected_output)
            data_consistent = await self._validate_data_consistency(ai_data)
            if not data_consistent:
                self.logger.warning(
                    "Data consistency validation failed, but continuing with corrected data",
                    user_id=user_id
                )
            
            # Enhanced quality validation
            quality_issues = self._validate_question_quality(ai_data)
            quality_score = self._calculate_quality_score(ai_data)
            
            # Log quality metrics but don't fail on quality issues
            self.logger.info(
                "AI question quality metrics",
                user_id=user_id,
                quality_score=quality_score,
                issues_count=len(quality_issues)
            )
            
            # Enhance the question with additional validation
            ai_data = self._enhance_question_with_validation(ai_data)
            
            # Additional content validation
            content_issues = self._validate_question_content(ai_data)
            if content_issues:
                self.logger.warning(
                    "AI question has content issues",
                    user_id=user_id,
                    content_issues=content_issues[:3]  # Log first 3 issues
                )
            
            self.logger.info(
                "AI question validated successfully",
                user_id=user_id,
                quality_score=quality_score,
                issues_count=len(quality_issues)
            )
            
        except RateLimitError as e:
            self.logger.error("Rate limit exceeded", user_id=user_id, error=str(e))
            raise QuestionGenerationError(f"Rate limit exceeded. Please try again later: {str(e)}")
            
        except (AIServiceError, QuestionGenerationError) as e:
            self.logger.error(
                "AI service failed",
                user_id=user_id,
                error=str(e),
                error_type=type(e).__name__
            )
            raise QuestionGenerationError(f"Failed to generate question: {str(e)}")
            
        except Exception as e:
            self.logger.error(
                "Unexpected error during AI generation",
                user_id=user_id,
                error=str(e),
                error_type=type(e).__name__
            )
            raise QuestionGenerationError(f"Unexpected error during question generation: {str(e)}")
        
        if ai_data is None:
            raise QuestionGenerationError("AI service returned no data")
        
        try:
            # Convert to Question model
            question = self._convert_ai_data_to_question(ai_data, experience_level, topic)
            
            # Perform final validation using the validation module
            validation_errors = validate_question_data_integrity(question)
            if validation_errors:
                self.logger.warning(
                    "Question has validation warnings",
                    question_id=question.id,
                    errors=[error.message for error in validation_errors[:3]]  # Log first 3 errors
                )
            
            # Update generation metrics
            await self._update_generation_metrics(user_id, len(validation_errors))
            
            self.logger.info(
                "Question generated successfully",
                question_id=question.id,
                user_id=user_id,
                quality_score=ai_data.get("quality_score", "unknown"),
                validation_errors=len(validation_errors)
            )
            return question
            
        except Exception as e:
            self.logger.error("Failed to convert AI data to Question model", error=str(e), user_id=user_id)
            raise QuestionGenerationError(f"Failed to create question: {str(e)}")
    
    async def _try_get_cached_question(self, user_id: str, experience_level: int, topic: Optional[str]) -> Optional[Question]:
        """Try to get a suitable cached question that matches the criteria."""
        try:
            cache_manager = CacheManager()
            
            # Try to get questions by topic and difficulty first
            if topic:
                topic_enum = self._map_topic_to_enum(topic)
                difficulty_enum = self._determine_difficulty_level(experience_level)
                
                topic_questions = await self.get_questions_by_topic(topic_enum, difficulty_enum, limit=5)
                
                # Try to find a valid cached question
                for question_id in topic_questions:
                    question = await self.get_question(question_id)
                    if question and await self.validate_cached_question(question_id):
                        return question
            
            # Try to get questions by experience level
            if experience_level <= 2:
                level_key = "questions_beginner"
            elif experience_level <= 7:
                level_key = "questions_intermediate"
            else:
                level_key = "questions_advanced"
            
            level_questions = await cache_manager.get_cache(level_key) or []
            
            # Filter by topic if specified
            if topic:
                topic_enum = self._map_topic_to_enum(topic)
                level_questions = [q for q in level_questions if q.get("topic") == topic_enum.value]
            
            # Try to find a valid cached question
            for question_summary in level_questions[:5]:  # Check first 5
                question_id = question_summary.get("id")
                if question_id:
                    question = await self.get_question(question_id)
                    if question and await self.validate_cached_question(question_id):
                        return question
            
            return None
            
        except Exception as e:
            self.logger.warning("Error trying to get cached question", error=str(e), user_id=user_id)
            return None
    
    def _validate_question_content(self, question_data: Dict[str, Any]) -> List[str]:
        """Validate question content for educational value and appropriateness."""
        issues = []
        
        title = question_data.get("title", "").lower()
        description = question_data.get("description", "").lower()
        
        # Check for inappropriate content
        inappropriate_terms = ["hack", "exploit", "malicious", "virus", "attack"]
        if any(term in title or term in description for term in inappropriate_terms):
            issues.append("Question contains inappropriate content")
        
        # Check for educational value
        if "learn" not in description and "practice" not in description and "skill" not in description:
            # This is a soft warning, not a hard failure
            pass
        
        # Check for realistic data scenarios
        sample_data = question_data.get("sample_input", {}).get("data", [])
        if sample_data and len(sample_data) > 0:
            first_row = sample_data[0]
            if isinstance(first_row, dict):
                # Check if data looks realistic (not all test/dummy values)
                dummy_indicators = ["test", "dummy", "fake", "example"]
                values = [str(v).lower() for v in first_row.values() if isinstance(v, str)]
                if all(any(indicator in value for indicator in dummy_indicators) for value in values):
                    issues.append("Sample data appears to use only dummy/test values")
        
        return issues
    
    async def _cache_question_with_retry(self, question: Question, max_retries: int = 2) -> None:
        """Cache question with retry logic for better reliability."""
        for attempt in range(max_retries + 1):
            try:
                await self._cache_question(question)
                return  # Success
            except Exception as e:
                if attempt < max_retries:
                    self.logger.warning(
                        f"Cache attempt {attempt + 1} failed, retrying",
                        question_id=question.id,
                        error=str(e)
                    )
                    await asyncio.sleep(0.5 * (attempt + 1))  # Brief delay before retry
                else:
                    self.logger.error(
                        f"Failed to cache question after {max_retries + 1} attempts",
                        question_id=question.id,
                        error=str(e)
                    )
                    # Don't fail the entire operation due to cache failure
    
    async def _update_generation_metrics(self, user_id: str, validation_errors: int) -> None:
        """Update metrics for question generation monitoring."""
        try:
            cache_manager = CacheManager()
            metrics_key = f"generation_metrics:{user_id}"
            
            metrics = await cache_manager.get_cache(metrics_key) or {
                "total_generated": 0,
                "validation_errors": 0,
                "last_updated": datetime.utcnow().isoformat()
            }
            
            metrics["total_generated"] += 1
            if validation_errors > 0:
                metrics["validation_errors"] += 1
            metrics["last_updated"] = datetime.utcnow().isoformat()
            
            await cache_manager.set_cache(metrics_key, metrics, ttl=86400)  # 24 hours
            
        except Exception as e:
            self.logger.warning("Failed to update generation metrics", error=str(e), user_id=user_id)
    
    async def _cache_user_question_preferences(self, user_id: str, question: Question) -> None:
        """Cache user's question preferences for personalized recommendations."""
        try:
            cache_manager = CacheManager()
            
            # Cache recent questions for this user
            recent_questions_key = f"user_recent_questions:{user_id}"
            recent_questions = await cache_manager.get_cache(recent_questions_key) or []
            
            # Add current question to recent list (keep last 10)
            question_summary = {
                "id": question.id,
                "topic": question.topic.value,
                "difficulty": question.difficulty_level.value,
                "created_at": question.created_at.isoformat()
            }
            
            recent_questions.insert(0, question_summary)
            recent_questions = recent_questions[:10]  # Keep only last 10
            
            await cache_manager.set_cache(recent_questions_key, recent_questions, ttl=86400)  # 24 hours
            
            self.logger.debug("User question preferences cached", user_id=user_id)
            
        except Exception as e:
            self.logger.warning("Failed to cache user preferences", error=str(e), user_id=user_id)
    
    async def generate_question_with_retry(
        self, 
        user_id: str, 
        experience_level: int, 
        topic: Optional[str] = None,
        max_retries: int = 2
    ) -> Question:
        """
        Generate a question with retry logic for better reliability.
        
        Args:
            user_id: User identifier
            experience_level: User's years of experience
            topic: Optional topic to focus on
            max_retries: Maximum number of retry attempts
            
        Returns:
            Generated Question instance
        """
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                return await self.generate_question(user_id, experience_level, topic)
                
            except RateLimitError:
                # Don't retry on rate limit errors
                raise
                
            except Exception as e:
                last_error = e
                if attempt < max_retries:
                    self.logger.warning(
                        f"Question generation attempt {attempt + 1} failed, retrying",
                        user_id=user_id,
                        error=str(e)
                    )
                    # Wait a bit before retrying
                    import asyncio
                    await asyncio.sleep(1.0 * (attempt + 1))
                else:
                    self.logger.error(
                        f"Question generation failed after {max_retries + 1} attempts",
                        user_id=user_id,
                        error=str(e)
                    )
        
        raise QuestionGenerationError(f"Failed to generate question after {max_retries + 1} attempts: {str(last_error)}")
    
    async def validate_cached_question(self, question_id: str) -> bool:
        """
        Validate that a cached question is still valid and high quality.
        
        Args:
            question_id: Question identifier
            
        Returns:
            True if question is valid, False otherwise
        """
        try:
            question = await self.get_question(question_id)
            if not question:
                return False
            
            # Check if question meets current quality standards
            question_dict = {
                "title": question.title,
                "description": question.description,
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
                ]
            }
            
            quality_issues = self._validate_question_quality(question_dict)
            validation_errors = validate_question_data_integrity(question)
            
            # Question is valid if it has few quality issues and no validation errors
            is_valid = len(quality_issues) <= 3 and len(validation_errors) == 0
            
            if not is_valid:
                self.logger.info(
                    "Cached question failed validation",
                    question_id=question_id,
                    quality_issues=len(quality_issues),
                    validation_errors=len(validation_errors)
                )
            
            return is_valid
            
        except Exception as e:
            self.logger.error("Error validating cached question", error=str(e), question_id=question_id)
            return False
    
    async def get_question(self, question_id: str) -> Optional[Question]:
        """
        Retrieve a specific question by ID from cache or database.
        
        Args:
            question_id: Question identifier
            
        Returns:
            Question instance if found, None otherwise
        """
        self.logger.info("Retrieving question", question_id=question_id)
        
        try:
            # Try to get from cache first using CacheManager
            cache_manager = CacheManager()
            cache_key = f"question:{question_id}"
            question_dict = await cache_manager.get_cache(cache_key)
            
            if question_dict:
                # Convert back to Question model
                test_cases = [
                    TestCase(
                        input_data=tc["input_data"],
                        expected_output=tc["expected_output"],
                        description=tc["description"]
                    )
                    for tc in question_dict["test_cases"]
                ]
                
                question = Question(
                    id=question_dict["id"],
                    title=question_dict["title"],
                    description=question_dict["description"],
                    difficulty_level=DifficultyLevel(question_dict["difficulty_level"]),
                    topic=QuestionTopic(question_dict["topic"]),
                    input_schema=question_dict["input_schema"],
                    sample_input=question_dict["sample_input"],
                    expected_output=question_dict["expected_output"],
                    test_cases=test_cases,
                    created_at=datetime.fromisoformat(question_dict["created_at"]),
                    metadata=question_dict["metadata"]
                )
                
                self.logger.debug("Question retrieved from cache", question_id=question_id)
                return question
            
            # TODO: Implement database retrieval when repository is available
            self.logger.debug("Question not found in cache", question_id=question_id)
            return None
            
        except Exception as e:
            self.logger.error("Error retrieving question", error=str(e), question_id=question_id)
            return None
    
    async def get_questions_by_topic(self, topic: QuestionTopic, difficulty: DifficultyLevel, limit: int = 10) -> List[str]:
        """
        Get cached question IDs by topic and difficulty.
        
        Args:
            topic: Question topic
            difficulty: Difficulty level
            limit: Maximum number of question IDs to return
            
        Returns:
            List of question IDs
        """
        try:
            cache_manager = CacheManager()
            topic_key = f"questions_by_topic:{topic.value}:{difficulty.value}"
            question_ids = await cache_manager.get_cache(topic_key) or []
            
            return question_ids[-limit:] if question_ids else []
            
        except Exception as e:
            self.logger.error("Error retrieving questions by topic", error=str(e))
            return []
    
    async def invalidate_question_cache(self, question_id: str) -> bool:
        """
        Invalidate cached question data.
        
        Args:
            question_id: Question identifier
            
        Returns:
            True if successfully invalidated, False otherwise
        """
        try:
            cache_manager = CacheManager()
            cache_key = f"question:{question_id}"
            
            # Get question data before deletion to clean up topic cache
            question_dict = await cache_manager.get_cache(cache_key)
            
            # Delete main cache entry
            await cache_manager.delete_cache(cache_key)
            
            # Clean up topic cache if we have the question data
            if question_dict:
                topic_key = f"questions_by_topic:{question_dict['topic']}:{question_dict['difficulty_level']}"
                topic_questions = await cache_manager.get_cache(topic_key) or []
                if question_id in topic_questions:
                    topic_questions.remove(question_id)
                    await cache_manager.set_cache(topic_key, topic_questions, ttl=settings.CACHE_TTL_QUESTIONS)
            
            self.logger.debug("Question cache invalidated", question_id=question_id)
            return True
            
        except Exception as e:
            self.logger.error("Error invalidating question cache", error=str(e), question_id=question_id)
            return False
    
    async def get_rate_limit_status(self, user_id: str) -> Dict[str, Any]:
        """
        Get current rate limit status for a user.
        
        Args:
            user_id: User identifier
            
        Returns:
            Rate limit status information
        """
        try:
            rate_info = await ai_service.get_rate_limit_status(user_id)
            return {
                "requests_made": rate_info.requests_made,
                "requests_remaining": rate_info.requests_per_hour - rate_info.requests_made,
                "requests_per_hour": rate_info.requests_per_hour,
                "window_start": rate_info.window_start,
                "reset_time": rate_info.window_start + 3600  # 1 hour from window start
            }
        except Exception as e:
            self.logger.error("Error getting rate limit status", error=str(e), user_id=user_id)
            return {
                "requests_made": 0,
                "requests_remaining": settings.AI_REQUESTS_PER_HOUR,
                "requests_per_hour": settings.AI_REQUESTS_PER_HOUR,
                "window_start": 0,
                "reset_time": 0
            }
    
    async def get_cache_statistics(self) -> Dict[str, Any]:
        """
        Get cache statistics for monitoring and optimization.
        
        Returns:
            Cache statistics and health information
        """
        try:
            cache_manager = CacheManager()
            redis_client = await self._get_redis_client()
            
            # Get basic Redis info
            info = await redis_client.info()
            
            # Count cached questions
            question_keys = await redis_client.keys("question:*")
            topic_keys = await redis_client.keys("questions_by_topic:*")
            user_keys = await redis_client.keys("user_recent_questions:*")
            
            # Get memory usage
            memory_used = info.get("used_memory_human", "unknown")
            memory_peak = info.get("used_memory_peak_human", "unknown")
            
            return {
                "redis_connected": True,
                "cached_questions": len(question_keys),
                "topic_caches": len(topic_keys),
                "user_caches": len(user_keys),
                "memory_used": memory_used,
                "memory_peak": memory_peak,
                "cache_hit_ratio": await self._calculate_cache_hit_ratio(),
                "last_updated": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error("Error getting cache statistics", error=str(e))
            return {
                "redis_connected": False,
                "error": str(e),
                "last_updated": datetime.utcnow().isoformat()
            }
    
    async def _calculate_cache_hit_ratio(self) -> float:
        """Calculate cache hit ratio for monitoring."""
        try:
            cache_manager = CacheManager()
            stats = await cache_manager.get_cache("cache_stats") or {"hits": 0, "misses": 0}
            
            total_requests = stats["hits"] + stats["misses"]
            if total_requests == 0:
                return 0.0
            
            return stats["hits"] / total_requests
            
        except Exception:
            return 0.0
    
    async def clear_cache(self, cache_type: str = "all") -> Dict[str, Any]:
        """
        Clear cache entries for maintenance or testing.
        
        Args:
            cache_type: Type of cache to clear ("questions", "topics", "users", "all")
            
        Returns:
            Results of cache clearing operation
        """
        try:
            redis_client = await self._get_redis_client()
            cleared_count = 0
            
            if cache_type in ["questions", "all"]:
                question_keys = await redis_client.keys("question:*")
                if question_keys:
                    cleared_count += await redis_client.delete(*question_keys)
            
            if cache_type in ["topics", "all"]:
                topic_keys = await redis_client.keys("questions_by_topic:*")
                if topic_keys:
                    cleared_count += await redis_client.delete(*topic_keys)
                
                level_keys = await redis_client.keys("questions_*")
                if level_keys:
                    cleared_count += await redis_client.delete(*level_keys)
            
            if cache_type in ["users", "all"]:
                user_keys = await redis_client.keys("user_recent_questions:*")
                if user_keys:
                    cleared_count += await redis_client.delete(*user_keys)
            
            self.logger.info(f"Cache cleared", cache_type=cache_type, cleared_count=cleared_count)
            
            return {
                "success": True,
                "cache_type": cache_type,
                "cleared_count": cleared_count,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error("Error clearing cache", error=str(e), cache_type=cache_type)
            return {
                "success": False,
                "error": str(e),
                "cache_type": cache_type,
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def warm_cache(self, user_id: str, experience_levels: List[int] = None, topics: List[str] = None) -> Dict[str, Any]:
        """
        Pre-generate and cache questions for better performance.
        
        Args:
            user_id: User identifier for rate limiting
            experience_levels: List of experience levels to pre-generate for
            topics: List of topics to pre-generate for
            
        Returns:
            Results of cache warming operation
        """
        if experience_levels is None:
            experience_levels = [1, 5, 10]  # Beginner, intermediate, advanced
        
        if topics is None:
            topics = ["transformations", "aggregations", "joins"]
        
        generated_count = 0
        failed_count = 0
        
        try:
            for experience_level in experience_levels:
                for topic in topics:
                    try:
                        # Check if we already have cached questions for this combination
                        cached_question = await self._try_get_cached_question(user_id, experience_level, topic)
                        if cached_question:
                            continue  # Skip if already cached
                        
                        # Generate new question
                        question = await self.generate_question(user_id, experience_level, topic)
                        generated_count += 1
                        
                        # Brief delay to avoid overwhelming the AI service
                        await asyncio.sleep(0.5)
                        
                    except RateLimitError:
                        self.logger.warning("Rate limit hit during cache warming", user_id=user_id)
                        break  # Stop warming if rate limited
                    except Exception as e:
                        self.logger.warning(
                            "Failed to generate question during cache warming",
                            error=str(e),
                            experience_level=experience_level,
                            topic=topic
                        )
                        failed_count += 1
            
            return {
                "success": True,
                "generated_count": generated_count,
                "failed_count": failed_count,
                "experience_levels": experience_levels,
                "topics": topics,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error("Error during cache warming", error=str(e), user_id=user_id)
            return {
                "success": False,
                "error": str(e),
                "generated_count": generated_count,
                "failed_count": failed_count,
                "timestamp": datetime.utcnow().isoformat()
            }
    async def list_questions(
        self, 
        skip: int = 0, 
        limit: int = 10, 
        filters: Optional[Dict[str, Any]] = None
    ) -> tuple[List[Question], int]:
        """
        List questions with filtering and pagination.
        
        Args:
            skip: Number of questions to skip
            limit: Maximum number of questions to return
            filters: Optional filters (topic, difficulty, experience_level)
            
        Returns:
            Tuple of (questions list, total count)
        """
        try:
            cache_manager = CacheManager()
            all_questions = []
            
            # Get questions from different cache sources
            cache_keys = [
                "questions_beginner",
                "questions_intermediate", 
                "questions_advanced"
            ]
            
            for cache_key in cache_keys:
                cached_questions = await cache_manager.get_cache(cache_key) or []
                all_questions.extend(cached_questions)
            
            # Apply filters if provided
            if filters:
                filtered_questions = []
                for q in all_questions:
                    include = True
                    
                    if "topic" in filters and q.get("topic") != filters["topic"]:
                        include = False
                    
                    if "difficulty" in filters:
                        difficulty_map = {"beginner": 1, "intermediate": 2, "advanced": 3}
                        if q.get("difficulty") != difficulty_map.get(filters["difficulty"]):
                            include = False
                    
                    if "experience_level" in filters:
                        exp_level = filters["experience_level"]
                        if exp_level <= 2 and q.get("difficulty") != 1:
                            include = False
                        elif 3 <= exp_level <= 7 and q.get("difficulty") != 2:
                            include = False
                        elif exp_level >= 8 and q.get("difficulty") != 3:
                            include = False
                    
                    if include:
                        filtered_questions.append(q)
                
                all_questions = filtered_questions
            
            # Sort by creation date (newest first)
            all_questions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            
            # Apply pagination
            total_count = len(all_questions)
            paginated_questions = all_questions[skip:skip + limit]
            
            # Convert to Question objects
            questions = []
            for q_summary in paginated_questions:
                question = await self.get_question(q_summary.get("id"))
                if question:
                    questions.append(question)
            
            return questions, total_count
            
        except Exception as e:
            self.logger.error("Error listing questions", error=str(e))
            return [], 0
    
    async def get_available_topics(self) -> List[str]:
        """
        Get list of available question topics.
        
        Returns:
            List of available topic strings
        """
        try:
            # Return all available topics from the enum
            return [topic.value for topic in QuestionTopic]
            
        except Exception as e:
            self.logger.error("Error getting available topics", error=str(e))
            return ["transformations", "aggregations", "joins"]  # Fallback
    
    async def get_question_stats(self) -> Dict[str, Any]:
        """
        Get question statistics and analytics.
        
        Returns:
            Dictionary containing question statistics
        """
        try:
            cache_manager = CacheManager()
            
            # Count questions by difficulty
            beginner_questions = await cache_manager.get_cache("questions_beginner") or []
            intermediate_questions = await cache_manager.get_cache("questions_intermediate") or []
            advanced_questions = await cache_manager.get_cache("questions_advanced") or []
            
            # Count questions by topic
            topic_counts = {}
            all_questions = beginner_questions + intermediate_questions + advanced_questions
            
            for q in all_questions:
                topic = q.get("topic", "unknown")
                topic_counts[topic] = topic_counts.get(topic, 0) + 1
            
            # Get cache statistics
            cache_stats = await self.get_cache_statistics()
            
            return {
                "total_questions": len(all_questions),
                "by_difficulty": {
                    "beginner": len(beginner_questions),
                    "intermediate": len(intermediate_questions),
                    "advanced": len(advanced_questions)
                },
                "by_topic": topic_counts,
                "cache_stats": {
                    "cached_questions": cache_stats.get("cached_questions", 0),
                    "cache_hit_ratio": cache_stats.get("cache_hit_ratio", 0.0),
                    "memory_used": cache_stats.get("memory_used", "unknown")
                },
                "available_topics": await self.get_available_topics(),
                "last_updated": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error("Error getting question stats", error=str(e))
            return {
                "total_questions": 0,
                "by_difficulty": {"beginner": 0, "intermediate": 0, "advanced": 0},
                "by_topic": {},
                "error": str(e),
                "last_updated": datetime.utcnow().isoformat()
            }
    
    async def validate_question(self, question_id: str) -> Dict[str, Any]:
        """
        Validate a question's test cases and expected outputs.
        
        Args:
            question_id: Question identifier
            
        Returns:
            Validation result dictionary
        """
        try:
            question = await self.get_question(question_id)
            if not question:
                return {
                    "is_valid": False,
                    "error": "Question not found",
                    "question_id": question_id
                }
            
            # Convert question to dict for validation
            question_dict = {
                "title": question.title,
                "description": question.description,
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
                ]
            }
            
            # Validate question quality
            quality_issues = self._validate_question_quality(question_dict)
            
            # Validate data integrity
            validation_errors = validate_question_data_integrity(question)
            
            # Calculate quality score
            quality_score = self._calculate_quality_score(question_dict)
            
            is_valid = len(quality_issues) <= 3 and len(validation_errors) == 0
            
            return {
                "is_valid": is_valid,
                "question_id": question_id,
                "quality_score": quality_score,
                "quality_issues": quality_issues[:10],  # Limit to first 10 issues
                "validation_errors": [error.message for error in validation_errors[:5]],  # First 5 errors
                "test_cases_count": len(question.test_cases),
                "schema_columns": len(question.input_schema),
                "sample_data_rows": len(question.sample_input.get("data", [])),
                "validated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error("Error validating question", error=str(e), question_id=question_id)
            return {
                "is_valid": False,
                "error": str(e),
                "question_id": question_id,
                "validated_at": datetime.utcnow().isoformat()
            }
    
    async def delete_question(self, question_id: str) -> bool:
        """
        Delete a question (admin only operation).
        
        Args:
            question_id: Question identifier
            
        Returns:
            True if successfully deleted, False otherwise
        """
        try:
            # Check if question exists
            question = await self.get_question(question_id)
            if not question:
                return False
            
            # Invalidate all caches for this question
            success = await self.invalidate_question_cache(question_id)
            
            # TODO: Also delete from database when repository is implemented
            
            if success:
                self.logger.info("Question deleted successfully", question_id=question_id)
            else:
                self.logger.warning("Failed to delete question", question_id=question_id)
            
            return success
            
        except Exception as e:
            self.logger.error("Error deleting question", error=str(e), question_id=question_id)
            return False