from pydantic import BaseModel, Field
from typing import Any, List, Optional


class TestCase(BaseModel):
    """Single test case for batch execution."""
    
    test_input: dict = Field(..., description="Test input as JSON object")
    expected_output: Any = Field(..., description="Expected output for comparison")


class BatchExecutionRequest(BaseModel):
    """Request model for batch code execution (multiple test cases)."""
    
    code: str = Field(..., description="User's Python function code (without if __name__ == '__main__')")
    function_name: str = Field(..., description="Name of the function to execute")
    param_names: List[str] = Field(..., description="Parameter names in order (e.g., ['nums', 'target'])")
    test_cases: List[TestCase] = Field(..., min_items=1, description="List of test cases to execute")
    time_limit_ms: Optional[int] = Field(3000, ge=100, le=30000, description="Time limit in milliseconds per test case")
    memory_limit_mb: Optional[int] = Field(256, ge=64, le=1024, description="Memory limit in megabytes")


class BatchTestResult(BaseModel):
    """Result for a single test case in batch execution."""
    
    test_case_index: int = Field(..., description="Index of the test case (0-based)")
    verdict: str = Field(..., description="Verdict for this test case")
    output: Optional[str] = Field(None, description="Program output")
    error: Optional[str] = Field(None, description="Error message if any")
    runtime_ms: Optional[int] = Field(None, description="Execution time in milliseconds")
    memory_kb: Optional[int] = Field(None, description="Peak memory usage in kilobytes")
    passed: bool = Field(..., description="Whether this test case passed")


class BatchExecutionResponse(BaseModel):
    """Response model for batch code execution."""
    
    status: str = Field(..., description="Request status: 'success' or 'error'")
    total_test_cases: int = Field(..., description="Total number of test cases")
    passed: int = Field(..., description="Number of test cases that passed")
    failed: int = Field(..., description="Number of test cases that failed")
    results: List[BatchTestResult] = Field(..., description="Results for each test case")
    timestamp: str = Field(..., description="ISO timestamp of execution")

