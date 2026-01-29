from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime


class Verdict(str, Enum):
    """Execution verdict types."""
    ACCEPTED = "ACCEPTED"
    WRONG_ANSWER = "WRONG_ANSWER"
    SYNTAX_ERROR = "SYNTAX_ERROR"
    RUNTIME_ERROR = "RUNTIME_ERROR"
    TIME_LIMIT_EXCEEDED = "TIME_LIMIT_EXCEEDED"
    MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED"
    SECURITY_VIOLATION = "SECURITY_VIOLATION"


class ExecutionResponse(BaseModel):
    """Response model for code execution."""
    
    status: str = Field(..., description="Request status: 'success' or 'error'")
    verdict: Verdict = Field(..., description="Execution verdict")
    output: Optional[str] = Field(None, description="Program output (JSON string)")
    error: Optional[str] = Field(None, description="Error message if any")
    runtime_ms: Optional[int] = Field(None, description="Execution time in milliseconds")
    memory_kb: Optional[int] = Field(None, description="Peak memory usage in kilobytes")
    exit_code: Optional[int] = Field(None, description="Process exit code")
    timestamp: str = Field(..., description="ISO timestamp of execution")

