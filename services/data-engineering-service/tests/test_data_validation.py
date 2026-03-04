"""
Unit tests for data validation functions.
"""

import pytest
from datetime import datetime, timedelta
from typing import Dict, Any

from app.core.validation import (
    validate_question_data_integrity,
    validate_solution_data_integrity,
    validate_user_progress_data_integrity,
    validate_execution_result_data_integrity,
    validate_data_consistency_across_models,
    sanitize_user_input,
    validate_database_constraints,
    DataValidationError
)
from app.core.data_integrity import DataIntegrityChecker, create_data_integrity_report
from app.models.question import Question, TestCase, DifficultyLevel, QuestionTopic
from app.models.execution import ExecutionResult, ExecutionStatus, ExecutionMode, ValidationResult
from app.models.user import UserProgress, Solution, SolutionStatus, SkillArea, UserPreferences


class TestQuestionValidation:
    """Test question data validation."""
    
    def test_valid_question_passes_validation(self):
        """Test that a valid question passes all validation checks."""
        question = Question(
            id="test-123",
            title="Test PySpark Transformation",
            description="Write a PySpark transformation to filter and select specific columns from a DataFrame. This is a comprehensive test of basic DataFrame operations.",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"name": "string", "age": "int", "salary": "double"},
            sample_input={"name": ["Alice", "Bob"], "age": [25, 30], "salary": [50000.0, 60000.0]},
            expected_output={"name": ["Alice"], "age": [25]},
            test_cases=[
                TestCase(
                    input_data={"name": ["Alice", "Bob"], "age": [25, 30], "salary": [50000.0, 60000.0]},
                    expected_output={"name": ["Alice"], "age": [25]},
                    description="Filter for age < 30 and select name, age columns"
                )
            ],
            metadata={"author": "test", "version": "1.0"}
        )
        
        errors = validate_question_data_integrity(question)
        assert len(errors) == 0
    
    def test_empty_title_fails_validation(self):
        """Test that empty title fails validation."""
        question = Question(
            id="test-123",
            title="",
            description="A valid description that is long enough to pass validation checks.",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"name": "string"},
            sample_input={"name": ["Alice"]},
            expected_output={"name": ["Alice"]},
            test_cases=[
                TestCase(
                    input_data={"name": ["Alice"]},
                    expected_output={"name": ["Alice"]},
                    description="Test case description"
                )
            ]
        )
        
        errors = validate_question_data_integrity(question)
        assert any(error.error_type == "empty_title" for error in errors)
    
    def test_short_description_fails_validation(self):
        """Test that short description fails validation."""
        question = Question(
            id="test-123",
            title="Valid Title",
            description="Short",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"name": "string"},
            sample_input={"name": ["Alice"]},
            expected_output={"name": ["Alice"]},
            test_cases=[
                TestCase(
                    input_data={"name": ["Alice"]},
                    expected_output={"name": ["Alice"]},
                    description="Test case description"
                )
            ]
        )
        
        errors = validate_question_data_integrity(question)
        assert any(error.error_type == "description_too_short" for error in errors)
    
    def test_invalid_schema_fails_validation(self):
        """Test that invalid schema fails validation."""
        question = Question(
            id="test-123",
            title="Valid Title",
            description="A valid description that is long enough to pass validation checks.",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"name": "invalid_type"},
            sample_input={"name": ["Alice"]},
            expected_output={"name": ["Alice"]},
            test_cases=[
                TestCase(
                    input_data={"name": ["Alice"]},
                    expected_output={"name": ["Alice"]},
                    description="Test case description"
                )
            ]
        )
        
        errors = validate_question_data_integrity(question)
        assert any(error.error_type == "invalid_data_type" for error in errors)
    
    def test_missing_test_cases_fails_validation(self):
        """Test that missing test cases fails validation."""
        question = Question(
            id="test-123",
            title="Valid Title",
            description="A valid description that is long enough to pass validation checks.",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"name": "string"},
            sample_input={"name": ["Alice"]},
            expected_output={"name": ["Alice"]},
            test_cases=[]
        )
        
        errors = validate_question_data_integrity(question)
        assert any(error.error_type == "no_test_cases" for error in errors)


class TestSolutionValidation:
    """Test solution data validation."""
    
    def test_valid_solution_passes_validation(self):
        """Test that a valid solution passes all validation checks."""
        solution = Solution(
            id="sol-123",
            user_id="user-456",
            question_id="q-789",
            code="from pyspark.sql import SparkSession\nspark = SparkSession.builder.getOrCreate()\ndf.filter(df.age < 30).select('name', 'age')",
            status=SolutionStatus.DRAFT,
            performance_metrics={"execution_time": 1.5, "memory_usage": 128.0}
        )
        
        errors = validate_solution_data_integrity(solution)
        assert len(errors) == 0
    
    def test_empty_code_fails_validation(self):
        """Test that empty code fails validation."""
        solution = Solution(
            id="sol-123",
            user_id="user-456",
            question_id="q-789",
            code="",
            status=SolutionStatus.DRAFT
        )
        
        errors = validate_solution_data_integrity(solution)
        assert any(error.error_type == "empty_code" for error in errors)
    
    def test_dangerous_code_patterns_fail_validation(self):
        """Test that dangerous code patterns fail validation."""
        solution = Solution(
            id="sol-123",
            user_id="user-456",
            question_id="q-789",
            code="import os\nos.system('rm -rf /')",
            status=SolutionStatus.DRAFT
        )
        
        errors = validate_solution_data_integrity(solution)
        assert any(error.error_type == "dangerous_code_pattern" for error in errors)
    
    def test_reviewed_without_ai_review_fails_validation(self):
        """Test that reviewed status without AI review fails validation."""
        solution = Solution(
            id="sol-123",
            user_id="user-456",
            question_id="q-789",
            code="valid pyspark code",
            status=SolutionStatus.REVIEWED,
            ai_review=None
        )
        
        errors = validate_solution_data_integrity(solution)
        assert any(error.error_type == "missing_ai_review" for error in errors)


class TestUserProgressValidation:
    """Test user progress data validation."""
    
    def test_valid_progress_passes_validation(self):
        """Test that valid progress passes all validation checks."""
        preferences = UserPreferences(
            experience_level=5,
            preferred_topics=[QuestionTopic.TRANSFORMATIONS]
        )
        
        skill_area = SkillArea(
            topic=QuestionTopic.TRANSFORMATIONS,
            proficiency_score=7.5,
            questions_attempted=10,
            questions_completed=8
        )
        
        progress = UserProgress(
            user_id="user-123",
            experience_level=5,
            preferences=preferences,
            completed_questions=["q1", "q2", "q3"],
            success_rate=0.75,
            total_questions_attempted=4,
            total_questions_completed=3,
            skill_areas=[skill_area],
            overall_proficiency=7.5
        )
        
        errors = validate_user_progress_data_integrity(progress)
        assert len(errors) == 0
    
    def test_invalid_success_rate_fails_validation(self):
        """Test that invalid success rate fails validation."""
        preferences = UserPreferences(experience_level=5)
        
        # Create progress with valid success rate first, then modify it
        progress = UserProgress(
            user_id="user-123",
            experience_level=5,
            preferences=preferences,
            success_rate=0.75,
            total_questions_attempted=4,
            total_questions_completed=3
        )
        
        # Manually set invalid success rate to bypass Pydantic validation
        progress.success_rate = 1.5  # Invalid: > 1.0
        
        errors = validate_user_progress_data_integrity(progress)
        assert any(error.error_type == "invalid_success_rate" for error in errors)
    
    def test_inconsistent_completion_count_fails_validation(self):
        """Test that inconsistent completion count fails validation."""
        preferences = UserPreferences(experience_level=5)
        
        progress = UserProgress(
            user_id="user-123",
            experience_level=5,
            preferences=preferences,
            completed_questions=["q1", "q2"],  # 2 questions
            total_questions_completed=3,  # But says 3 completed
            total_questions_attempted=4
        )
        
        errors = validate_user_progress_data_integrity(progress)
        assert any(error.error_type == "inconsistent_completed_count" for error in errors)


class TestExecutionResultValidation:
    """Test execution result data validation."""
    
    def test_valid_execution_result_passes_validation(self):
        """Test that valid execution result passes all validation checks."""
        result = ExecutionResult(
            job_id="job-123",
            status=ExecutionStatus.COMPLETED,
            mode=ExecutionMode.TEST,
            execution_time=1.5,
            memory_usage=128.0,
            created_at=datetime.utcnow() - timedelta(seconds=10),
            completed_at=datetime.utcnow()
        )
        
        errors = validate_execution_result_data_integrity(result)
        assert len(errors) == 0
    
    def test_completed_without_timestamp_fails_validation(self):
        """Test that completed status without timestamp fails validation."""
        result = ExecutionResult(
            job_id="job-123",
            status=ExecutionStatus.COMPLETED,
            mode=ExecutionMode.TEST,
            execution_time=1.5,
            memory_usage=128.0,
            completed_at=None  # Missing completion timestamp
        )
        
        errors = validate_execution_result_data_integrity(result)
        assert any(error.error_type == "missing_completion_timestamp" for error in errors)
    
    def test_failed_without_error_message_fails_validation(self):
        """Test that failed status without error message fails validation."""
        result = ExecutionResult(
            job_id="job-123",
            status=ExecutionStatus.FAILED,
            mode=ExecutionMode.TEST,
            execution_time=1.5,
            memory_usage=128.0,
            error_message=None  # Missing error message
        )
        
        errors = validate_execution_result_data_integrity(result)
        assert any(error.error_type == "missing_error_message" for error in errors)
    
    def test_negative_execution_time_fails_validation(self):
        """Test that negative execution time fails validation."""
        result = ExecutionResult(
            job_id="job-123",
            status=ExecutionStatus.COMPLETED,
            mode=ExecutionMode.TEST,
            execution_time=-1.0,  # Invalid negative time
            memory_usage=128.0
        )
        
        errors = validate_execution_result_data_integrity(result)
        assert any(error.error_type == "negative_execution_time" for error in errors)


class TestCrossModelValidation:
    """Test cross-model data consistency validation."""
    
    def test_consistent_models_pass_validation(self):
        """Test that consistent models pass cross-validation."""
        question = Question(
            id="q-123",
            title="Test Question",
            description="A valid description that is long enough to pass validation checks.",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"name": "string"},
            sample_input={"name": ["Alice"]},
            expected_output={"name": ["Alice"]},
            test_cases=[
                TestCase(
                    input_data={"name": ["Alice"]},
                    expected_output={"name": ["Alice"]},
                    description="Test case"
                )
            ]
        )
        
        execution_result = ExecutionResult(
            job_id="job-456",
            status=ExecutionStatus.COMPLETED,
            mode=ExecutionMode.TEST,
            execution_time=1.5,
            memory_usage=128.0
        )
        
        solution = Solution(
            id="sol-789",
            user_id="user-123",
            question_id="q-123",  # Matches question ID
            code="valid pyspark code",
            status=SolutionStatus.SUBMITTED,
            execution_result=execution_result
        )
        
        preferences = UserPreferences(experience_level=5)
        progress = UserProgress(
            user_id="user-123",  # Matches solution user ID
            experience_level=5,
            preferences=preferences,
            completed_questions=["q-123"],  # Includes the question
            total_questions_attempted=1,
            total_questions_completed=1
        )
        
        errors = validate_data_consistency_across_models(
            question=question,
            solution=solution,
            execution_result=execution_result,
            user_progress=progress
        )
        
        assert len(errors) == 0
    
    def test_mismatched_question_id_fails_validation(self):
        """Test that mismatched question ID fails validation."""
        question = Question(
            id="q-123",
            title="Test Question",
            description="A valid description that is long enough to pass validation checks.",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"name": "string"},
            sample_input={"name": ["Alice"]},
            expected_output={"name": ["Alice"]},
            test_cases=[
                TestCase(
                    input_data={"name": ["Alice"]},
                    expected_output={"name": ["Alice"]},
                    description="Test case"
                )
            ]
        )
        
        solution = Solution(
            id="sol-789",
            user_id="user-123",
            question_id="q-different",  # Different question ID
            code="valid pyspark code",
            status=SolutionStatus.DRAFT
        )
        
        errors = validate_data_consistency_across_models(question=question, solution=solution)
        assert any(error.error_type == "solution_question_mismatch" for error in errors)


class TestInputSanitization:
    """Test user input sanitization."""
    
    def test_normal_input_unchanged(self):
        """Test that normal input remains unchanged."""
        input_text = "def transform_data(df):\n    return df.filter(df.age > 18)"
        sanitized = sanitize_user_input(input_text)
        assert sanitized == input_text
    
    def test_null_bytes_removed(self):
        """Test that null bytes are removed."""
        input_text = "code with \x00 null byte"
        sanitized = sanitize_user_input(input_text)
        assert "\x00" not in sanitized
        assert sanitized == "code with  null byte"
    
    def test_carriage_returns_normalized(self):
        """Test that carriage returns are normalized to newlines."""
        input_text = "line1\r\nline2\rline3"
        sanitized = sanitize_user_input(input_text)
        assert "\r" not in sanitized
        assert sanitized == "line1\nline2\nline3"
    
    def test_long_input_truncated(self):
        """Test that overly long input is truncated."""
        long_input = "x" * 60000  # Exceeds 50KB limit
        sanitized = sanitize_user_input(long_input)
        assert len(sanitized) == 50000
    
    def test_non_string_converted(self):
        """Test that non-string input is converted to string."""
        input_data = 12345
        sanitized = sanitize_user_input(input_data)
        assert sanitized == "12345"


class TestDatabaseConstraints:
    """Test database constraint validation."""
    
    def test_valid_question_document_passes(self):
        """Test that valid question document passes constraint validation."""
        document = {
            "id": "q-123",
            "title": "Test Question",
            "description": "Valid description",
            "difficulty_level": 1,
            "topic": "transformations"
        }
        
        errors = validate_database_constraints("questions", document)
        assert len(errors) == 0
    
    def test_missing_required_field_fails(self):
        """Test that missing required field fails constraint validation."""
        document = {
            "id": "q-123",
            "title": "Test Question",
            # Missing description, difficulty_level, topic
        }
        
        errors = validate_database_constraints("questions", document)
        assert len(errors) > 0
        assert any(error.error_type == "missing_required_field" for error in errors)


class TestDataIntegrityChecker:
    """Test the DataIntegrityChecker class."""
    
    def test_question_integrity_check(self):
        """Test comprehensive question integrity check."""
        checker = DataIntegrityChecker()
        
        # Valid question
        question = Question(
            id="test-123",
            title="Valid PySpark Question",
            description="This is a comprehensive test question that covers PySpark DataFrame transformations and filtering operations. It requires students to understand basic DataFrame operations, column selection, and filtering conditions. The question tests fundamental skills needed for data engineering tasks.",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"name": "string", "age": "int"},
            sample_input={"name": ["Alice", "Bob"], "age": [25, 30]},
            expected_output={"name": ["Alice"], "age": [25]},
            test_cases=[
                TestCase(
                    input_data={"name": ["Alice", "Bob"], "age": [25, 30]},
                    expected_output={"name": ["Alice"], "age": [25]},
                    description="Filter for age < 30"
                ),
                TestCase(
                    input_data={"name": ["Charlie", "David"], "age": [20, 35]},
                    expected_output={"name": ["Charlie"], "age": [20]},
                    description="Another test case"
                )
            ]
        )
        
        is_valid, issues = checker.check_question_integrity(question)
        if not is_valid:
            print(f"Question integrity issues: {issues}")
        assert is_valid
        assert len(issues) == 0
    
    def test_solution_integrity_check(self):
        """Test comprehensive solution integrity check."""
        checker = DataIntegrityChecker()
        
        solution = Solution(
            id="sol-123",
            user_id="user-456",
            question_id="q-789",
            code="from pyspark.sql import SparkSession\nspark = SparkSession.builder.getOrCreate()\nresult = df.filter(df.age < 30).select('name', 'age')",
            status=SolutionStatus.DRAFT
        )
        
        is_valid, issues = checker.check_solution_integrity(solution)
        assert is_valid
        assert len(issues) == 0
    
    def test_data_fingerprint_generation(self):
        """Test data fingerprint generation and verification."""
        checker = DataIntegrityChecker()
        
        data = {"key": "value", "number": 42}
        fingerprint1 = checker.generate_data_fingerprint(data)
        fingerprint2 = checker.generate_data_fingerprint(data)
        
        # Same data should produce same fingerprint
        assert fingerprint1 == fingerprint2
        
        # Verification should pass
        assert checker.verify_data_fingerprint(data, fingerprint1)
        
        # Different data should produce different fingerprint
        different_data = {"key": "different", "number": 42}
        fingerprint3 = checker.generate_data_fingerprint(different_data)
        assert fingerprint1 != fingerprint3
    
    def test_integrity_report_generation(self):
        """Test comprehensive integrity report generation."""
        # Create test data
        question = Question(
            id="q-1",
            title="Test Question",
            description="A valid test question with sufficient description length for validation.",
            difficulty_level=DifficultyLevel.BEGINNER,
            topic=QuestionTopic.TRANSFORMATIONS,
            input_schema={"name": "string"},
            sample_input={"name": ["Alice"]},
            expected_output={"name": ["Alice"]},
            test_cases=[
                TestCase(
                    input_data={"name": ["Alice"]},
                    expected_output={"name": ["Alice"]},
                    description="Test case"
                )
            ]
        )
        
        solution = Solution(
            id="sol-1",
            user_id="user-1",
            question_id="q-1",
            code="from pyspark.sql import SparkSession\nvalid_code = True",
            status=SolutionStatus.DRAFT
        )
        
        preferences = UserPreferences(experience_level=3)
        progress = UserProgress(
            user_id="user-1",
            experience_level=3,
            preferences=preferences,
            total_questions_attempted=1,
            total_questions_completed=0
        )
        
        report = create_data_integrity_report([question], [solution], [progress])
        
        assert "timestamp" in report
        assert "summary" in report
        assert report["summary"]["total_questions"] == 1
        assert report["summary"]["total_solutions"] == 1
        assert report["summary"]["total_progress_records"] == 1
        assert "health_score" in report["summary"]
        assert 0 <= report["summary"]["health_score"] <= 100


if __name__ == "__main__":
    pytest.main([__file__])