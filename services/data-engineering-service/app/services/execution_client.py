"""
Client for communicating with the enterprise execution engine.
"""

import asyncio
import httpx
import structlog
from typing import Optional, Dict, Any
from datetime import datetime

from app.core.config import settings
from app.models.execution import ExecutionResult, ExecutionStatus

logger = structlog.get_logger()


class ExecutionEngineClient:
    """Client for the enterprise execution engine."""
    
    def __init__(self, base_url: str = None):
        self.base_url = base_url or settings.EXECUTION_ENGINE_URL
        self.client: Optional[httpx.AsyncClient] = None
        self.timeout = httpx.Timeout(30.0, connect=5.0)
    
    async def __aenter__(self):
        """Async context manager entry."""
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={"Content-Type": "application/json"}
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.client:
            await self.client.aclose()
    
    async def execute_code(
        self,
        code: str,
        timeout: int = 30,
        memory_limit: str = "512m",
        cpu_limit: float = 1.0,
        packages: list = None
    ) -> str:
        """
        Execute code and return job ID.
        
        Args:
            code: Python code to execute
            timeout: Execution timeout in seconds
            memory_limit: Memory limit (e.g., "512m", "1g")
            cpu_limit: CPU limit (e.g., 1.0 = 1 CPU core)
            packages: Additional packages to install
        
        Returns:
            job_id: Unique job identifier
        """
        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        request_data = {
            "code": code,
            "timeout": timeout,
            "memory_limit": memory_limit,
            "cpu_limit": cpu_limit,
            "packages": packages or ["pandas", "numpy", "pyspark"]
        }
        
        try:
            response = await self.client.post("/api/v1/execute", json=request_data)
            response.raise_for_status()
            
            result = response.json()
            job_id = result["data"]["job_id"]
            
            logger.info("Code execution started", job_id=job_id)
            return job_id
            
        except httpx.HTTPError as e:
            logger.error("Failed to execute code", error=str(e))
            raise
    
    async def get_status(self, job_id: str) -> ExecutionResult:
        """
        Get execution status and results.
        
        Args:
            job_id: Job identifier
            
        Returns:
            ExecutionResult with status and output
        """
        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        try:
            response = await self.client.get(f"/api/v1/status/{job_id}")
            response.raise_for_status()
            
            result = response.json()
            data = result["data"]
            
            return ExecutionResult(
                job_id=job_id,
                status=ExecutionStatus(data["status"]),
                output=data.get("output"),
                error=data.get("error"),
                execution_time=data.get("execution_time", 0.0),
                memory_usage=data.get("memory_usage", 0.0),
                created_at=datetime.fromisoformat(data["created_at"]),
                completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None
            )
            
        except httpx.HTTPError as e:
            logger.error("Failed to get execution status", job_id=job_id, error=str(e))
            raise
    
    async def wait_for_completion(
        self,
        job_id: str,
        poll_interval: float = 1.0,
        max_wait_time: int = 300
    ) -> ExecutionResult:
        """
        Wait for execution to complete.
        
        Args:
            job_id: Job identifier
            poll_interval: Polling interval in seconds
            max_wait_time: Maximum wait time in seconds
            
        Returns:
            ExecutionResult when completed
        """
        start_time = datetime.utcnow()
        
        while True:
            result = await self.get_status(job_id)
            
            if result.status in [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED, ExecutionStatus.TIMEOUT]:
                return result
            
            # Check timeout
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            if elapsed > max_wait_time:
                logger.warning("Execution wait timeout", job_id=job_id, elapsed=elapsed)
                break
            
            await asyncio.sleep(poll_interval)
        
        # Return last known status
        return result
    
    async def cancel_execution(self, job_id: str) -> bool:
        """
        Cancel a running execution.
        
        Args:
            job_id: Job identifier
            
        Returns:
            True if cancelled successfully
        """
        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        try:
            response = await self.client.post(f"/api/v1/cancel/{job_id}")
            response.raise_for_status()
            
            result = response.json()
            return result.get("success", False)
            
        except httpx.HTTPError as e:
            logger.error("Failed to cancel execution", job_id=job_id, error=str(e))
            return False
    
    async def health_check(self) -> Dict[str, Any]:
        """Check execution engine health."""
        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")
        
        try:
            response = await self.client.get("/api/v1/health")
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error("Health check failed", error=str(e))
            raise


# Global client instance
execution_client = ExecutionEngineClient()