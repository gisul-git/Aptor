"""
Code execution endpoints using the enterprise execution engine.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Optional, Dict, Any
import structlog

from app.core.auth import get_current_user_optional
from app.services.execution_client import execution_client
from app.models.execution import ExecutionResult, ExecutionStatus
from app.core.redis_client import get_redis

logger = structlog.get_logger()
router = APIRouter()


@router.post("/execute")
async def execute_code(
    request: Dict[str, Any],
    current_user: Optional[Dict] = Depends(get_current_user_optional)
):
    """
    Execute Python/PySpark code using the enterprise execution engine.
    
    Request body:
    {
        "code": "print('Hello World')",
        "timeout": 30,
        "memory_limit": "512m",
        "cpu_limit": 1.0,
        "packages": ["pandas", "numpy"]
    }
    """
    try:
        code = request.get("code")
        if not code:
            raise HTTPException(status_code=400, detail="Code is required")
        
        timeout = request.get("timeout", 30)
        memory_limit = request.get("memory_limit", "512m")
        cpu_limit = request.get("cpu_limit", 1.0)
        packages = request.get("packages", ["pandas", "numpy", "pyspark"])
        
        # Execute code using enterprise engine
        async with execution_client as client:
            job_id = await client.execute_code(
                code=code,
                timeout=timeout,
                memory_limit=memory_limit,
                cpu_limit=cpu_limit,
                packages=packages
            )
        
        # Store user association if authenticated
        if current_user:
            redis = get_redis()
            await redis.hset(f"job:{job_id}", "user_id", current_user.get("user_id", ""))
        
        return {
            "success": True,
            "message": "Code execution started",
            "data": {
                "job_id": job_id,
                "status": "queued"
            }
        }
        
    except Exception as e:
        logger.error("Code execution failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{job_id}")
async def get_execution_status(
    job_id: str,
    current_user: Optional[Dict] = Depends(get_current_user_optional)
):
    """Get execution status and results."""
    try:
        async with execution_client as client:
            result = await client.get_status(job_id)
        
        return {
            "success": True,
            "message": "Status retrieved",
            "data": {
                "job_id": job_id,
                "status": result.status.value,
                "output": result.output,
                "error": result.error,
                "execution_time": result.execution_time,
                "memory_usage": result.memory_usage,
                "created_at": result.created_at.isoformat(),
                "completed_at": result.completed_at.isoformat() if result.completed_at else None
            }
        }
        
    except Exception as e:
        logger.error("Failed to get execution status", job_id=job_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel/{job_id}")
async def cancel_execution(
    job_id: str,
    current_user: Optional[Dict] = Depends(get_current_user_optional)
):
    """Cancel a running execution."""
    try:
        async with execution_client as client:
            success = await client.cancel_execution(job_id)
        
        if success:
            return {
                "success": True,
                "message": "Execution cancelled",
                "data": {"job_id": job_id}
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to cancel execution")
            
    except Exception as e:
        logger.error("Failed to cancel execution", job_id=job_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def execution_engine_health():
    """Check execution engine health."""
    try:
        async with execution_client as client:
            health_data = await client.health_check()
        
        return {
            "success": True,
            "message": "Execution engine health check",
            "data": health_data
        }
        
    except Exception as e:
        logger.error("Execution engine health check failed", error=str(e))
        return {
            "success": False,
            "message": "Execution engine unavailable",
            "error": str(e)
        }


@router.post("/test")
async def test_execution():
    """Test endpoint for quick execution engine verification."""
    test_code = """
import pandas as pd
import numpy as np

# Create sample data
data = {'name': ['Alice', 'Bob', 'Charlie'], 'age': [25, 30, 35]}
df = pd.DataFrame(data)

print("DataFrame created:")
print(df)
print(f"Shape: {df.shape}")
print(f"Memory usage: {df.memory_usage().sum()} bytes")
"""
    
    try:
        async with execution_client as client:
            job_id = await client.execute_code(
                code=test_code,
                timeout=10,
                memory_limit="256m",
                packages=["pandas", "numpy"]
            )
            
            # Wait for completion
            result = await client.wait_for_completion(job_id, poll_interval=0.5, max_wait_time=15)
        
        return {
            "success": True,
            "message": "Test execution completed",
            "data": {
                "job_id": job_id,
                "status": result.status.value,
                "output": result.output,
                "execution_time": result.execution_time,
                "memory_usage": result.memory_usage
            }
        }
        
    except Exception as e:
        logger.error("Test execution failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))