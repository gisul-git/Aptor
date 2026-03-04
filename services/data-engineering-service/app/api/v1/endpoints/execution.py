"""
Code execution endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Dict, Any, Optional
import structlog
import uuid
from datetime import datetime

from app.models.execution import ExecutionRequest, ExecutionResult, ExecutionStatus, ExecutionMode
from app.services.integration_service import get_integration_service, IntegrationService
from app.core.auth import get_current_user, check_rate_limit
from app.core.config import settings

logger = structlog.get_logger()
router = APIRouter()


@router.post("/test")
async def test_code(
    request: ExecutionRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    _rate_limit: None = Depends(check_rate_limit("execution", settings.EXECUTION_REQUESTS_PER_HOUR)),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> ExecutionResult:
    """Execute code in test mode with basic validation."""
    try:
        user_id = current_user.get("user_id") if current_user else "anonymous"
        
        logger.info(
            "Starting code execution in test mode",
            user_id=user_id,
            question_id=request.question_id,
            code_length=len(request.code)
        )
        
        # Use integration service for complete workflow with synchronous execution
        result = await integration_service.execute_solution(
            user_id=user_id,
            question_id=request.question_id,
            code=request.code,
            mode=ExecutionMode.TEST,
            async_execution=False  # Wait for execution to complete
        )
        
        logger.info(
            "Code execution completed in test mode",
            job_id=result.job_id,
            user_id=user_id,
            status=result.status.value
        )
        
        return result
        
    except Exception as e:
        logger.error(
            "Failed to execute code in test mode",
            error=str(e),
            user_id=current_user.get("user_id") if current_user else "anonymous",
            question_id=request.question_id
        )
        raise HTTPException(status_code=500, detail="Code execution failed")


@router.post("/submit")
async def submit_code(
    request: ExecutionRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    _rate_limit: None = Depends(check_rate_limit("execution", settings.EXECUTION_REQUESTS_PER_HOUR)),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> ExecutionResult:
    """Execute code in submit mode with full validation and AI review."""
    try:
        user_id = current_user.get("user_id") if current_user else "anonymous"
        
        logger.info(
            "Starting code execution in submit mode",
            user_id=user_id,
            question_id=request.question_id,
            code_length=len(request.code)
        )
        
        # Use integration service for complete workflow
        result = await integration_service.execute_solution(
            user_id=user_id,
            question_id=request.question_id,
            code=request.code,
            mode=ExecutionMode.SUBMIT
        )
        
        logger.info(
            "Code execution completed in submit mode",
            job_id=result.job_id,
            user_id=user_id,
            status=result.status.value
        )
        
        return result
        
    except Exception as e:
        logger.error(
            "Failed to execute code in submit mode",
            error=str(e),
            user_id=current_user.get("user_id") if current_user else "anonymous",
            question_id=request.question_id
        )
        raise HTTPException(status_code=500, detail="Code execution failed")


@router.get("/status/{job_id}")
async def get_execution_status(
    job_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> ExecutionResult:
    """Get the status of a long-running execution job."""
    try:
        user_id = current_user.get("user_id") if current_user else "anonymous"
        
        # Use integration service to get execution status
        result = await integration_service.get_execution_status(job_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Check if user has access to this job (basic security check)
        if user_id != "admin" and user_id != result.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        logger.info(
            "Execution status retrieved",
            job_id=job_id,
            status=result.status.value,
            user_id=user_id
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get job status", job_id=job_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve job status")


@router.get("/jobs")
async def list_user_jobs(
    skip: int = 0,
    limit: int = 10,
    status: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)  # Require authentication
) -> Dict[str, Any]:
    """List execution jobs for the current user."""
    try:
        user_id = current_user.get("user_id")
        
        # Get user's jobs from cache
        redis_client = await get_redis()
        user_jobs_key = f"user_jobs:{user_id}"
        job_ids = await redis_client.lrange(user_jobs_key, 0, -1)
        
        jobs = []
        for job_id in job_ids:
            job_key = f"execution_job:{job_id}"
            job_data = await redis_client.hgetall(job_key)
            
            if job_data:
                job_status = job_data.get("status", "unknown")
                
                # Filter by status if specified
                if status and job_status != status:
                    continue
                
                jobs.append({
                    "job_id": job_id,
                    "status": job_status,
                    "mode": job_data.get("mode", "test"),
                    "created_at": job_data.get("created_at", ""),
                    "updated_at": job_data.get("updated_at", "")
                })
        
        # Sort by creation time (newest first)
        jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        # Apply pagination
        total_count = len(jobs)
        paginated_jobs = jobs[skip:skip + limit]
        
        return {
            "jobs": paginated_jobs,
            "total": total_count,
            "skip": skip,
            "limit": limit,
            "has_more": skip + len(paginated_jobs) < total_count
        }
        
    except Exception as e:
        logger.error("Failed to list user jobs", error=str(e), user_id=current_user.get("user_id"))
        raise HTTPException(status_code=500, detail="Failed to retrieve jobs")


@router.delete("/jobs/{job_id}")
async def cancel_job(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)  # Require authentication
) -> Dict[str, str]:
    """Cancel a running execution job."""
    try:
        user_id = current_user.get("user_id")
        
        # Get job status
        redis_client = await get_redis()
        job_key = f"execution_job:{job_id}"
        job_data = await redis_client.hgetall(job_key)
        
        if not job_data:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Check if user owns this job
        job_user_id = job_data.get("user_id", "")
        if user_id != job_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check if job can be cancelled
        current_status = job_data.get("status", "")
        if current_status in ["completed", "failed", "cancelled"]:
            return {"message": f"Job is already {current_status}"}
        
        # Cancel the job
        execution_service = ExecutionEngineService()
        success = await execution_service.cancel_job(job_id)
        
        if success:
            # Update job status
            await _store_job_status(job_id, ExecutionStatus.CANCELLED, user_id, job_data.get("mode", "test"))
            
            logger.info("Job cancelled successfully", job_id=job_id, user_id=user_id)
            return {"message": "Job cancelled successfully"}
        else:
            logger.warning("Failed to cancel job", job_id=job_id, user_id=user_id)
            raise HTTPException(status_code=500, detail="Failed to cancel job")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error cancelling job", job_id=job_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to cancel job")


@router.get("/metrics")
async def get_execution_metrics(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get execution metrics and statistics."""
    try:
        user_id = current_user.get("user_id") if current_user else None
        
        execution_service = ExecutionEngineService()
        metrics = await execution_service.get_execution_metrics(user_id)
        
        return metrics
        
    except Exception as e:
        logger.error("Failed to get execution metrics", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve execution metrics")


# Helper functions

async def _store_job_status(
    job_id: str, 
    status: ExecutionStatus, 
    user_id: str, 
    mode: str,
    result: Optional[ExecutionResult] = None
) -> None:
    """Store job status in Redis for tracking."""
    try:
        redis_client = await get_redis()
        
        # Store job metadata
        job_key = f"execution_job:{job_id}"
        job_data = {
            "job_id": job_id,
            "status": status.value,
            "user_id": user_id,
            "mode": mode,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Add creation time if this is the first status update
        existing_data = await redis_client.hgetall(job_key)
        if not existing_data:
            job_data["created_at"] = datetime.utcnow().isoformat()
        
        await redis_client.hset(job_key, mapping=job_data)
        await redis_client.expire(job_key, settings.CACHE_TTL_EXECUTION_RESULTS)
        
        # Store result if provided
        if result:
            result_key = f"execution_result:{job_id}"
            result_data = {
                "job_id": result.job_id,
                "status": result.status.value,
                "output": result.output,
                "error_message": result.error_message,
                "execution_time": result.execution_time,
                "memory_usage": result.memory_usage,
                "validation_result": result.validation_result.model_dump() if result.validation_result else None,
                "ai_review": result.ai_review.model_dump() if result.ai_review else None
            }
            
            import json
            await redis_client.setex(
                result_key,
                settings.CACHE_TTL_EXECUTION_RESULTS,
                json.dumps(result_data, default=str)
            )
        
        # Add job to user's job list
        user_jobs_key = f"user_jobs:{user_id}"
        await redis_client.lpush(user_jobs_key, job_id)
        await redis_client.ltrim(user_jobs_key, 0, 99)  # Keep last 100 jobs
        await redis_client.expire(user_jobs_key, settings.CACHE_TTL_EXECUTION_RESULTS)
        
    except Exception as e:
        logger.error("Failed to store job status", error=str(e), job_id=job_id)


async def _execute_code_background(
    job_id: str,
    code: str,
    question_id: str,
    mode: ExecutionMode,
    user_id: str
) -> None:
    """Execute code in background task."""
    try:
        # Update status to running
        await _store_job_status(job_id, ExecutionStatus.RUNNING, user_id, mode.value)
        
        # Execute code
        execution_service = ExecutionEngineService()
        result = await execution_service.execute_code(
            job_id=job_id,
            code=code,
            question_id=question_id,
            mode=mode,
            user_id=user_id
        )
        
        # Store final result
        await _store_job_status(job_id, result.status, user_id, mode.value, result)
        
        # Cleanup resources
        await _cleanup_execution_resources(job_id, user_id)
        
    except Exception as e:
        logger.error("Background execution failed", error=str(e), job_id=job_id)
        await _store_job_status(job_id, ExecutionStatus.FAILED, user_id, mode.value)


async def _cleanup_execution_resources(job_id: str, user_id: str) -> None:
    """Clean up execution resources after completion."""
    try:
        execution_service = ExecutionEngineService()
        await execution_service.cleanup_job_resources(job_id)
        
        logger.debug("Execution resources cleaned up", job_id=job_id, user_id=user_id)
        
    except Exception as e:
        logger.warning("Failed to cleanup execution resources", error=str(e), job_id=job_id)