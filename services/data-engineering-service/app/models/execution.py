"""
Code execution data models and schemas.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime
from enum import Enum


class ExecutionMode(str, Enum):
    """Code execution modes."""
    TEST = "test"      # Quick validation only
    SUBMIT = "submit"  # Full validation with AI review


class ExecutionStatus(str, Enum):
    """Execution job status."""
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class ValidationError(BaseModel):
    """Individual validation error details."""
    error_type: str = Field(..., description="Type of validation error")
    message: str = Field(..., description="Error message")
    details: Dict[str, Any] = Field(default_factory=dict, description="Additional error details")


class ValidationResult(BaseModel):
    """Result of output validation."""
    is_correct: bool = Field(..., description="Whether the output is correct")
    schema_match: bool = Field(..., description="Whether the schema matches")
    row_count_match: bool = Field(..., description="Whether row counts match")
    data_match: bool = Field(..., description="Whether data values match")
    
    error_details: List[ValidationError] = Field(default_factory=list)
    similarity_score: float = Field(0.0, ge=0.0, le=1.0, description="Output similarity score")
    
    # Detailed feedback
    missing_columns: List[str] = Field(default_factory=list)
    extra_columns: List[str] = Field(default_factory=list)
    type_mismatches: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    sample_differences: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Enhanced error reporting
    detailed_error_summary: Optional[str] = Field(None, description="Comprehensive error summary with debugging info")
    formatted_errors: List[str] = Field(default_factory=list, description="User-friendly formatted error messages")


class CodeReview(BaseModel):
    """AI-powered code review results."""
    overall_score: float = Field(..., ge=0.0, le=10.0, description="Overall code quality score")
    
    # Feedback categories
    correctness_feedback: str = Field(..., description="Feedback on correctness")
    performance_feedback: str = Field(..., description="Feedback on performance")
    best_practices_feedback: str = Field(..., description="Feedback on best practices")
    
    # Suggestions and examples
    improvement_suggestions: List[str] = Field(default_factory=list, description="Specific improvement suggestions")
    code_examples: List[Dict[str, str]] = Field(default_factory=list, description="Code examples with improvements")
    alternative_approaches: List[Dict[str, str]] = Field(default_factory=list, description="Alternative solution approaches")
    
    # Strengths and areas for improvement
    strengths: List[str] = Field(default_factory=list, description="Code strengths identified")
    areas_for_improvement: List[str] = Field(default_factory=list, description="Areas needing improvement")
    
    # Analysis metadata
    analysis_time: float = Field(..., description="Time taken for analysis in seconds")
    model_used: str = Field(..., description="AI model used for review")
    reviewed_at: Optional[datetime] = Field(default=None, description="Timestamp when review was completed")


class ExecutionResult(BaseModel):
    """Complete execution result."""
    job_id: str = Field(..., description="Unique job identifier")
    user_id: Optional[str] = Field(None, description="User who submitted the execution")
    question_id: Optional[str] = Field(None, description="Question being solved")
    code: Optional[str] = Field(None, description="Code that was executed")
    status: ExecutionStatus = Field(..., description="Execution status")
    mode: ExecutionMode = Field(..., description="Execution mode used")
    
    # Output data
    output: Optional[Dict[str, Any]] = Field(None, description="Execution output data")
    error_message: Optional[str] = Field(None, description="Error message if execution failed")
    
    # Performance metrics
    execution_time: float = Field(..., description="Execution time in seconds")
    memory_usage: float = Field(..., description="Peak memory usage in MB")
    
    # Validation results
    validation_result: Optional[ValidationResult] = Field(None, description="Validation results")
    
    # AI review (only for submit mode)
    ai_review: Optional[CodeReview] = Field(None, description="AI code review")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    queued_at: Optional[datetime] = Field(None, description="Queue timestamp")
    started_at: Optional[datetime] = Field(None, description="Execution start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ExecutionRequest(BaseModel):
    """Request model for code execution."""
    code: str = Field(..., description="PySpark code to execute")
    question_id: str = Field(..., description="Question ID for validation")
    mode: ExecutionMode = Field(ExecutionMode.TEST, description="Execution mode")
    user_id: Optional[str] = Field(None, description="User ID for tracking")


class ExecutionStatusResponse(BaseModel):
    """Response model for execution status queries."""
    job_id: str
    status: ExecutionStatus
    progress: Optional[float] = Field(None, ge=0.0, le=1.0, description="Execution progress")
    estimated_completion: Optional[datetime] = Field(None, description="Estimated completion time")
    queue_position: Optional[int] = Field(None, description="Position in execution queue")