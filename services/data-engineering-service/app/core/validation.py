"""
Data validation functions for ensuring data integrity across the platform.
"""

import re
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from pydantic import ValidationError as PydanticValidationError
import structlog

from app.models.question import Question, TestCase, DifficultyLevel, QuestionTopic
from app.models.execution import ExecutionResult, ValidationResult, ValidationError, ExecutionStatus
from app.models.user import UserProgress, Solution, SolutionStatus, SkillArea

logger = structlog.get_logger()


class DataValidationError(Exception):
    """Custom exception for data validation errors."""
    pass


def validate_question_data_integrity(question: Question) -> List[ValidationError]:
    """
    Validate question data integrity and consistency.
    
    Args:
        question: Question object to validate
        
    Returns:
        List of validation errors found
    """
    errors = []
    
    # Validate title and description
    if not question.title.strip():
        errors.append(ValidationError(
            error_type="empty_title",
            message="Question title cannot be empty"
        ))
    
    if len(question.title) > 200:
        errors.append(ValidationError(
            error_type="title_too_long",
            message="Question title must be 200 characters or less"
        ))
    
    if not question.description.strip():
        errors.append(ValidationError(
            error_type="empty_description",
            message="Question description cannot be empty"
        ))
    
    if len(question.description) < 50:
        errors.append(ValidationError(
            error_type="description_too_short",
            message="Question description must be at least 50 characters"
        ))
    
    # Validate difficulty level consistency
    if question.difficulty_level not in [1, 2, 3]:
        errors.append(ValidationError(
            error_type="invalid_difficulty",
            message="Difficulty level must be 1, 2, or 3"
        ))
    
    # Validate input schema
    if not question.input_schema:
        errors.append(ValidationError(
            error_type="empty_input_schema",
            message="Input schema cannot be empty"
        ))
    else:
        schema_errors = _validate_dataframe_schema(question.input_schema)
        errors.extend(schema_errors)
    
    # Validate sample input data consistency with schema
    if question.sample_input and question.input_schema:
        # sample_input should have a 'data' field with array of rows
        if isinstance(question.sample_input, dict) and 'data' in question.sample_input:
            sample_data_rows = question.sample_input['data']
            if isinstance(sample_data_rows, list) and len(sample_data_rows) > 0:
                # Validate first row against schema
                first_row = sample_data_rows[0]
                sample_errors = _validate_sample_data_consistency(
                    first_row, question.input_schema, "sample_input"
                )
                errors.extend(sample_errors)
        else:
            # Fallback for old format (direct columns)
            sample_errors = _validate_sample_data_consistency(
                question.sample_input, question.input_schema, "sample_input"
            )
            errors.extend(sample_errors)
    
    # Validate expected output data
    if not question.expected_output:
        errors.append(ValidationError(
            error_type="empty_expected_output",
            message="Expected output cannot be empty"
        ))
    
    # Validate test cases
    if not question.test_cases:
        errors.append(ValidationError(
            error_type="no_test_cases",
            message="Question must have at least one test case"
        ))
    else:
        for i, test_case in enumerate(question.test_cases):
            test_errors = _validate_test_case(test_case, question.input_schema, i)
            errors.extend(test_errors)
    
    # Validate metadata
    if question.metadata and not isinstance(question.metadata, dict):
        errors.append(ValidationError(
            error_type="invalid_metadata",
            message="Metadata must be a dictionary"
        ))
    
    return errors


def validate_solution_data_integrity(solution: Solution) -> List[ValidationError]:
    """
    Validate solution data integrity and consistency.
    
    Args:
        solution: Solution object to validate
        
    Returns:
        List of validation errors found
    """
    errors = []
    
    # Validate required fields
    if not solution.user_id.strip():
        errors.append(ValidationError(
            error_type="empty_user_id",
            message="User ID cannot be empty"
        ))
    
    if not solution.question_id.strip():
        errors.append(ValidationError(
            error_type="empty_question_id",
            message="Question ID cannot be empty"
        ))
    
    if not solution.code.strip():
        errors.append(ValidationError(
            error_type="empty_code",
            message="Solution code cannot be empty"
        ))
    
    # Validate code content
    code_errors = _validate_pyspark_code_structure(solution.code)
    errors.extend(code_errors)
    
    # Validate status consistency
    if solution.status == SolutionStatus.REVIEWED and not solution.ai_review:
        errors.append(ValidationError(
            error_type="missing_ai_review",
            message="Reviewed solutions must have AI review data"
        ))
    
    if solution.status == SolutionStatus.SUBMITTED and not solution.execution_result:
        errors.append(ValidationError(
            error_type="missing_execution_result",
            message="Submitted solutions must have execution results"
        ))
    
    # Validate timestamp consistency
    if solution.reviewed_at and solution.reviewed_at < solution.submitted_at:
        errors.append(ValidationError(
            error_type="invalid_review_timestamp",
            message="Review timestamp cannot be before submission timestamp"
        ))
    
    # Validate performance metrics
    if solution.performance_metrics:
        perf_errors = _validate_performance_metrics(solution.performance_metrics)
        errors.extend(perf_errors)
    
    return errors


def validate_user_progress_data_integrity(progress: UserProgress) -> List[ValidationError]:
    """
    Validate user progress data integrity and consistency.
    
    Args:
        progress: UserProgress object to validate
        
    Returns:
        List of validation errors found
    """
    errors = []
    
    # Validate user ID
    if not progress.user_id.strip():
        errors.append(ValidationError(
            error_type="empty_user_id",
            message="User ID cannot be empty"
        ))
    
    # Validate experience level
    if progress.experience_level < 0 or progress.experience_level > 20:
        errors.append(ValidationError(
            error_type="invalid_experience_level",
            message="Experience level must be between 0 and 20"
        ))
    
    # Validate success rate
    if progress.success_rate < 0.0 or progress.success_rate > 1.0:
        errors.append(ValidationError(
            error_type="invalid_success_rate",
            message="Success rate must be between 0.0 and 1.0"
        ))
    
    # Validate completion consistency
    if progress.total_questions_completed > progress.total_questions_attempted:
        errors.append(ValidationError(
            error_type="invalid_completion_count",
            message="Completed questions cannot exceed attempted questions"
        ))
    
    if len(progress.completed_questions) != progress.total_questions_completed:
        errors.append(ValidationError(
            error_type="inconsistent_completed_count",
            message="Completed questions list length must match total completed count"
        ))
    
    # Validate skill areas
    for skill in progress.skill_areas:
        skill_errors = _validate_skill_area(skill)
        errors.extend(skill_errors)
    
    # Validate overall proficiency
    if progress.overall_proficiency < 0.0 or progress.overall_proficiency > 10.0:
        errors.append(ValidationError(
            error_type="invalid_proficiency_score",
            message="Overall proficiency must be between 0.0 and 10.0"
        ))
    
    # Validate preferences
    if progress.preferences.experience_level != progress.experience_level:
        errors.append(ValidationError(
            error_type="inconsistent_experience_level",
            message="Experience level in preferences must match user progress"
        ))
    
    return errors


def validate_execution_result_data_integrity(result: ExecutionResult) -> List[ValidationError]:
    """
    Validate execution result data integrity and consistency.
    
    Args:
        result: ExecutionResult object to validate
        
    Returns:
        List of validation errors found
    """
    errors = []
    
    # Validate job ID
    if not result.job_id.strip():
        errors.append(ValidationError(
            error_type="empty_job_id",
            message="Job ID cannot be empty"
        ))
    
    # Validate status consistency
    if result.status == ExecutionStatus.COMPLETED and not result.completed_at:
        errors.append(ValidationError(
            error_type="missing_completion_timestamp",
            message="Completed executions must have completion timestamp"
        ))
    
    if result.status == ExecutionStatus.FAILED and not result.error_message:
        errors.append(ValidationError(
            error_type="missing_error_message",
            message="Failed executions must have error message"
        ))
    
    if result.status == ExecutionStatus.COMPLETED and result.error_message:
        errors.append(ValidationError(
            error_type="unexpected_error_message",
            message="Completed executions should not have error messages"
        ))
    
    # Validate timing consistency
    if result.completed_at and result.completed_at < result.created_at:
        errors.append(ValidationError(
            error_type="invalid_completion_timestamp",
            message="Completion timestamp cannot be before creation timestamp"
        ))
    
    # Validate performance metrics
    if result.execution_time < 0:
        errors.append(ValidationError(
            error_type="negative_execution_time",
            message="Execution time cannot be negative"
        ))
    
    if result.memory_usage < 0:
        errors.append(ValidationError(
            error_type="negative_memory_usage",
            message="Memory usage cannot be negative"
        ))
    
    # Validate validation result consistency
    if result.validation_result and result.status != ExecutionStatus.COMPLETED:
        errors.append(ValidationError(
            error_type="unexpected_validation_result",
            message="Only completed executions should have validation results"
        ))
    
    # Validate AI review consistency
    if result.ai_review and result.mode.value != "submit":
        errors.append(ValidationError(
            error_type="unexpected_ai_review",
            message="Only submit mode executions should have AI reviews"
        ))
    
    return errors


def _validate_dataframe_schema(schema: Dict[str, str]) -> List[ValidationError]:
    """Validate DataFrame schema format and types."""
    errors = []
    
    valid_types = {
        'string', 'int', 'integer', 'long', 'float', 'double', 
        'boolean', 'timestamp', 'date', 'binary'
    }
    
    for column, dtype in schema.items():
        if not isinstance(column, str) or not column.strip():
            errors.append(ValidationError(
                error_type="invalid_column_name",
                message=f"Column name must be a non-empty string: {column}"
            ))
        
        if not isinstance(dtype, str) or dtype.lower() not in valid_types:
            errors.append(ValidationError(
                error_type="invalid_data_type",
                message=f"Invalid data type '{dtype}' for column '{column}'"
            ))
    
    return errors


def _validate_sample_data_consistency(
    sample_data: Dict[str, Any], 
    schema: Dict[str, str], 
    data_type: str
) -> List[ValidationError]:
    """Validate sample data consistency with schema."""
    errors = []
    
    if not isinstance(sample_data, dict):
        errors.append(ValidationError(
            error_type="invalid_sample_data_format",
            message=f"{data_type} must be a dictionary"
        ))
        return errors
    
    # Check if all schema columns are present
    schema_columns = set(schema.keys())
    sample_columns = set(sample_data.keys())
    
    missing_columns = schema_columns - sample_columns
    if missing_columns:
        errors.append(ValidationError(
            error_type="missing_columns",
            message=f"Missing columns in {data_type}: {list(missing_columns)}"
        ))
    
    extra_columns = sample_columns - schema_columns
    if extra_columns:
        errors.append(ValidationError(
            error_type="extra_columns",
            message=f"Extra columns in {data_type}: {list(extra_columns)}"
        ))
    
    return errors


def _validate_test_case(
    test_case: TestCase, 
    input_schema: Dict[str, str], 
    case_index: int
) -> List[ValidationError]:
    """Validate individual test case."""
    errors = []
    
    if not test_case.description.strip():
        errors.append(ValidationError(
            error_type="empty_test_case_description",
            message=f"Test case {case_index} description cannot be empty"
        ))
    
    # Validate input data consistency
    # test_case.input_data should have a 'data' field with array of rows
    if isinstance(test_case.input_data, dict) and 'data' in test_case.input_data:
        test_data_rows = test_case.input_data['data']
        if isinstance(test_data_rows, list) and len(test_data_rows) > 0:
            # Validate first row against schema
            first_row = test_data_rows[0]
            input_errors = _validate_sample_data_consistency(
                first_row, input_schema, f"test_case_{case_index}_input"
            )
            errors.extend(input_errors)
    else:
        # Fallback for old format (direct columns)
        input_errors = _validate_sample_data_consistency(
            test_case.input_data, input_schema, f"test_case_{case_index}_input"
        )
        errors.extend(input_errors)
    
    # Validate expected output format
    if not test_case.expected_output:
        errors.append(ValidationError(
            error_type="empty_expected_output",
            message=f"Test case {case_index} expected output cannot be empty"
        ))
    
    return errors


def _validate_pyspark_code_structure(code: str) -> List[ValidationError]:
    """Validate basic PySpark code structure and patterns."""
    errors = []
    
    # Check for minimum code length
    if len(code.strip()) < 10:
        errors.append(ValidationError(
            error_type="code_too_short",
            message="Code must be at least 10 characters long"
        ))
    
    # Check for potentially dangerous patterns
    dangerous_patterns = [
        r'import\s+os',
        r'import\s+subprocess',
        r'import\s+sys',
        r'__import__',
        r'eval\s*\(',
        r'exec\s*\(',
        r'open\s*\(',
        r'file\s*\(',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, code, re.IGNORECASE):
            errors.append(ValidationError(
                error_type="dangerous_code_pattern",
                message=f"Code contains potentially dangerous pattern: {pattern}"
            ))
    
    # Check for basic PySpark imports (optional warning)
    pyspark_imports = [
        'pyspark', 'spark', 'SparkSession', 'SparkContext'
    ]
    
    has_pyspark = any(imp in code for imp in pyspark_imports)
    if not has_pyspark:
        errors.append(ValidationError(
            error_type="missing_pyspark_imports",
            message="Code should contain PySpark imports or references"
        ))
    
    return errors


def _validate_performance_metrics(metrics: Dict[str, float]) -> List[ValidationError]:
    """Validate performance metrics data."""
    errors = []
    
    required_metrics = ['execution_time', 'memory_usage']
    
    for metric in required_metrics:
        if metric not in metrics:
            errors.append(ValidationError(
                error_type="missing_performance_metric",
                message=f"Missing required performance metric: {metric}"
            ))
        elif metrics[metric] < 0:
            errors.append(ValidationError(
                error_type="negative_performance_metric",
                message=f"Performance metric {metric} cannot be negative"
            ))
    
    return errors


def _validate_skill_area(skill: SkillArea) -> List[ValidationError]:
    """Validate skill area data."""
    errors = []
    
    if skill.proficiency_score < 0.0 or skill.proficiency_score > 10.0:
        errors.append(ValidationError(
            error_type="invalid_proficiency_score",
            message=f"Proficiency score for {skill.topic} must be between 0.0 and 10.0"
        ))
    
    if skill.questions_completed > skill.questions_attempted:
        errors.append(ValidationError(
            error_type="invalid_question_counts",
            message=f"Completed questions cannot exceed attempted for {skill.topic}"
        ))
    
    if skill.questions_attempted < 0 or skill.questions_completed < 0:
        errors.append(ValidationError(
            error_type="negative_question_counts",
            message=f"Question counts cannot be negative for {skill.topic}"
        ))
    
    return errors


def validate_data_consistency_across_models(
    question: Optional[Question] = None,
    solution: Optional[Solution] = None,
    execution_result: Optional[ExecutionResult] = None,
    user_progress: Optional[UserProgress] = None
) -> List[ValidationError]:
    """
    Validate data consistency across related models.
    
    Args:
        question: Question object (optional)
        solution: Solution object (optional)
        execution_result: ExecutionResult object (optional)
        user_progress: UserProgress object (optional)
        
    Returns:
        List of cross-model validation errors
    """
    errors = []
    
    # Validate solution-question consistency
    if solution and question:
        if solution.question_id != question.id:
            errors.append(ValidationError(
                error_type="solution_question_mismatch",
                message="Solution question_id does not match question id"
            ))
    
    # Validate execution result-solution consistency
    if execution_result and solution:
        if (solution.execution_result and 
            solution.execution_result.job_id != execution_result.job_id):
            errors.append(ValidationError(
                error_type="execution_result_mismatch",
                message="Solution execution result does not match provided execution result"
            ))
    
    # Validate user progress-solution consistency
    if user_progress and solution:
        if solution.user_id != user_progress.user_id:
            errors.append(ValidationError(
                error_type="user_progress_solution_mismatch",
                message="Solution user_id does not match user progress user_id"
            ))
        
        if (solution.status == SolutionStatus.SUBMITTED and 
            solution.question_id not in user_progress.completed_questions):
            errors.append(ValidationError(
                error_type="missing_completed_question",
                message="Submitted solution question not in user's completed questions"
            ))
    
    return errors


def sanitize_user_input(input_data: str) -> str:
    """
    Sanitize user input to prevent injection attacks and ensure data safety.
    
    Args:
        input_data: Raw user input string
        
    Returns:
        Sanitized input string
    """
    if not isinstance(input_data, str):
        return str(input_data)
    
    # Remove null bytes and control characters
    sanitized = input_data.replace('\x00', '')
    
    # Normalize line endings - convert \r\n to \n, then \r to \n
    sanitized = sanitized.replace('\r\n', '\n').replace('\r', '\n')
    
    # Limit length to prevent DoS
    max_length = 50000  # 50KB limit for code submissions
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
        logger.warning("Input truncated due to length limit", 
                      original_length=len(input_data), 
                      truncated_length=len(sanitized))
    
    return sanitized.strip()


def validate_database_constraints(collection_name: str, document: Dict[str, Any]) -> List[ValidationError]:
    """
    Validate document against database constraints and schema requirements.
    
    Args:
        collection_name: Name of the MongoDB collection
        document: Document to validate
        
    Returns:
        List of constraint validation errors
    """
    errors = []
    
    # Collection-specific validations
    if collection_name == "questions":
        errors.extend(_validate_question_document_constraints(document))
    elif collection_name == "solutions":
        errors.extend(_validate_solution_document_constraints(document))
    elif collection_name == "users":
        errors.extend(_validate_user_document_constraints(document))
    elif collection_name == "execution_results":
        errors.extend(_validate_execution_result_document_constraints(document))
    
    return errors


def _validate_question_document_constraints(document: Dict[str, Any]) -> List[ValidationError]:
    """Validate question document constraints."""
    errors = []
    
    required_fields = ['id', 'title', 'description', 'difficulty_level', 'topic']
    for field in required_fields:
        if field not in document or not document[field]:
            errors.append(ValidationError(
                error_type="missing_required_field",
                message=f"Required field '{field}' is missing or empty"
            ))
    
    return errors


def _validate_solution_document_constraints(document: Dict[str, Any]) -> List[ValidationError]:
    """Validate solution document constraints."""
    errors = []
    
    required_fields = ['id', 'user_id', 'question_id', 'code', 'status']
    for field in required_fields:
        if field not in document or not document[field]:
            errors.append(ValidationError(
                error_type="missing_required_field",
                message=f"Required field '{field}' is missing or empty"
            ))
    
    return errors


def _validate_user_document_constraints(document: Dict[str, Any]) -> List[ValidationError]:
    """Validate user document constraints."""
    errors = []
    
    required_fields = ['user_id', 'experience_level']
    for field in required_fields:
        if field not in document:
            errors.append(ValidationError(
                error_type="missing_required_field",
                message=f"Required field '{field}' is missing"
            ))
    
    return errors


def _validate_execution_result_document_constraints(document: Dict[str, Any]) -> List[ValidationError]:
    """Validate execution result document constraints."""
    errors = []
    
    required_fields = ['job_id', 'status']
    for field in required_fields:
        if field not in document or not document[field]:
            errors.append(ValidationError(
                error_type="missing_required_field",
                message=f"Required field '{field}' is missing or empty"
            ))
    
    return errors