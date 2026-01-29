from pydantic import BaseModel, Field
from typing import Any, List, Optional


class ExecutionRequest(BaseModel):
    """Request model for code execution."""
    
    code: str = Field(..., description="User's Python function code (without if __name__ == '__main__')")
    function_name: str = Field(..., description="Name of the function to execute")
    param_names: List[str] = Field(..., description="Parameter names in order (e.g., ['nums', 'target'])")
    test_input: dict = Field(..., description="Test input as JSON object")
    expected_output: Any = Field(..., description="Expected output for comparison")
    time_limit_ms: Optional[int] = Field(3000, ge=100, le=30000, description="Time limit in milliseconds")
    memory_limit_mb: Optional[int] = Field(256, ge=64, le=1024, description="Memory limit in megabytes")

