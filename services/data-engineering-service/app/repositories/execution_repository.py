"""
Execution repository for managing execution result data operations.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import structlog
import numpy as np

from app.repositories.base import BaseRepository, RepositoryError
from app.models.execution import ExecutionResult, ExecutionStatus, ExecutionMode

logger = structlog.get_logger()


def convert_numpy_types(obj):
    """Convert numpy types to Python native types for MongoDB."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    return obj


class ExecutionRepository(BaseRepository[ExecutionResult]):
    """Repository for execution result data operations."""
    
    def __init__(self):
        super().__init__("execution_results")
    
    async def create_execution_result(self, execution_result: ExecutionResult) -> str:
        """
        Create a new execution result.
        
        Args:
            execution_result: ExecutionResult model to create
            
        Returns:
            str: The created execution result ID
        """
        result_data = execution_result.model_dump(exclude_none=True)  # Exclude None values
        
        # Convert numpy types to Python native types
        result_data = convert_numpy_types(result_data)
        
        # Use the job_id as the document ID for easy lookup
        result_data["_id"] = execution_result.job_id
        
        return await self.create(result_data)
    
    async def get_execution_result_by_job_id(self, job_id: str) -> Optional[ExecutionResult]:
        """
        Get an execution result by job ID.
        
        Args:
            job_id: Job ID to retrieve result for
            
        Returns:
            Optional[ExecutionResult]: Execution result if found, None otherwise
        """
        document = await self.get_by_id(job_id)
        if document:
            # Remove _id since job_id is used as the identifier
            if '_id' in document:
                document.pop('_id')
            return ExecutionResult(**document)
        return None
    
    async def update_execution_result(
        self, 
        job_id: str, 
        update_data: Dict[str, Any]
    ) -> Optional[ExecutionResult]:
        """
        Update an execution result.
        
        Args:
            job_id: Job ID to update
            update_data: Data to update
            
        Returns:
            Optional[ExecutionResult]: Updated execution result if found, None otherwise
        """
        document = await self.update_by_id(job_id, update_data)
        if document:
            if '_id' in document:
                document.pop('_id')
            return ExecutionResult(**document)
        return None
    
    async def update_execution_status(
        self, 
        job_id: str, 
        status: ExecutionStatus,
        error_message: Optional[str] = None
    ) -> Optional[ExecutionResult]:
        """
        Update execution status.
        
        Args:
            job_id: Job ID to update
            status: New execution status
            error_message: Optional error message for failed executions
            
        Returns:
            Optional[ExecutionResult]: Updated execution result if found, None otherwise
        """
        update_data = {"status": status.value}
        
        if status == ExecutionStatus.COMPLETED:
            update_data["completed_at"] = datetime.utcnow()
        elif status == ExecutionStatus.FAILED and error_message:
            update_data["error_message"] = error_message
            update_data["completed_at"] = datetime.utcnow()
        elif status == ExecutionStatus.TIMEOUT:
            update_data["error_message"] = "Execution timed out"
            update_data["completed_at"] = datetime.utcnow()
        
        return await self.update_execution_result(job_id, update_data)
    
    async def get_executions_by_status(
        self, 
        status: ExecutionStatus,
        limit: Optional[int] = None
    ) -> List[ExecutionResult]:
        """
        Get execution results by status.
        
        Args:
            status: Execution status to filter by
            limit: Maximum number of results to return
            
        Returns:
            List[ExecutionResult]: List of execution results with the specified status
        """
        query = {"status": status.value}
        documents = await self.find_many(
            query,
            limit=limit,
            sort=[("created_at", -1)]
        )
        
        results = []
        for doc in documents:
            if '_id' in doc:
                doc.pop('_id')
            results.append(ExecutionResult(**doc))
        
        return results
    
    async def get_pending_executions(self, limit: Optional[int] = None) -> List[ExecutionResult]:
        """
        Get pending execution results (for queue processing).
        
        Args:
            limit: Maximum number of results to return
            
        Returns:
            List[ExecutionResult]: List of pending execution results
        """
        return await self.get_executions_by_status(ExecutionStatus.PENDING, limit)
    
    async def get_running_executions(self, limit: Optional[int] = None) -> List[ExecutionResult]:
        """
        Get currently running execution results.
        
        Args:
            limit: Maximum number of results to return
            
        Returns:
            List[ExecutionResult]: List of running execution results
        """
        return await self.get_executions_by_status(ExecutionStatus.RUNNING, limit)
    
    async def get_executions_by_mode(
        self, 
        mode: ExecutionMode,
        limit: Optional[int] = None
    ) -> List[ExecutionResult]:
        """
        Get execution results by execution mode.
        
        Args:
            mode: Execution mode to filter by
            limit: Maximum number of results to return
            
        Returns:
            List[ExecutionResult]: List of execution results with the specified mode
        """
        query = {"mode": mode.value}
        documents = await self.find_many(
            query,
            limit=limit,
            sort=[("created_at", -1)]
        )
        
        results = []
        for doc in documents:
            if '_id' in doc:
                doc.pop('_id')
            results.append(ExecutionResult(**doc))
        
        return results
    
    async def get_recent_executions(
        self, 
        hours: int = 24,
        limit: Optional[int] = None
    ) -> List[ExecutionResult]:
        """
        Get recent execution results within the specified time window.
        
        Args:
            hours: Number of hours to look back
            limit: Maximum number of results to return
            
        Returns:
            List[ExecutionResult]: List of recent execution results
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        query = {"created_at": {"$gte": cutoff_time}}
        
        documents = await self.find_many(
            query,
            limit=limit,
            sort=[("created_at", -1)]
        )
        
        results = []
        for doc in documents:
            if '_id' in doc:
                doc.pop('_id')
            results.append(ExecutionResult(**doc))
        
        return results
    
    async def get_execution_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about execution results.
        
        Returns:
            Dict[str, Any]: Statistics including counts by status, mode, and performance metrics
        """
        try:
            collection = await self._get_collection()
            
            # Aggregation pipeline for statistics
            pipeline = [
                {
                    "$group": {
                        "_id": None,
                        "total_executions": {"$sum": 1},
                        "by_status": {
                            "$push": "$status"
                        },
                        "by_mode": {
                            "$push": "$mode"
                        },
                        "avg_execution_time": {
                            "$avg": "$execution_time"
                        },
                        "avg_memory_usage": {
                            "$avg": "$memory_usage"
                        },
                        "successful_executions": {
                            "$sum": {
                                "$cond": [
                                    {"$eq": ["$status", "completed"]},
                                    1,
                                    0
                                ]
                            }
                        },
                        "failed_executions": {
                            "$sum": {
                                "$cond": [
                                    {"$eq": ["$status", "failed"]},
                                    1,
                                    0
                                ]
                            }
                        },
                        "timeout_executions": {
                            "$sum": {
                                "$cond": [
                                    {"$eq": ["$status", "timeout"]},
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]
            
            cursor = collection.aggregate(pipeline)
            results = await cursor.to_list(length=1)
            
            if not results:
                return {
                    "total_executions": 0,
                    "by_status": {},
                    "by_mode": {},
                    "success_rate": 0.0,
                    "failure_rate": 0.0,
                    "timeout_rate": 0.0,
                    "avg_execution_time": 0.0,
                    "avg_memory_usage": 0.0
                }
            
            result = results[0]
            
            # Count by status and mode
            status_counts = {}
            for status in result.get("by_status", []):
                if status:
                    status_counts[status] = status_counts.get(status, 0) + 1
            
            mode_counts = {}
            for mode in result.get("by_mode", []):
                if mode:
                    mode_counts[mode] = mode_counts.get(mode, 0) + 1
            
            total = result.get("total_executions", 0)
            successful = result.get("successful_executions", 0)
            failed = result.get("failed_executions", 0)
            timeout = result.get("timeout_executions", 0)
            
            return {
                "total_executions": total,
                "by_status": status_counts,
                "by_mode": mode_counts,
                "success_rate": successful / total if total > 0 else 0.0,
                "failure_rate": failed / total if total > 0 else 0.0,
                "timeout_rate": timeout / total if total > 0 else 0.0,
                "avg_execution_time": result.get("avg_execution_time", 0.0) or 0.0,
                "avg_memory_usage": result.get("avg_memory_usage", 0.0) or 0.0
            }
            
        except Exception as e:
            logger.error("Error getting execution statistics", error=str(e))
            raise RepositoryError(f"Failed to get execution statistics: {str(e)}")
    
    async def cleanup_old_executions(self, days: int = 7) -> int:
        """
        Clean up old execution results to manage storage.
        
        Args:
            days: Number of days to keep execution results
            
        Returns:
            int: Number of execution results deleted
        """
        try:
            collection = await self._get_collection()
            
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Only delete completed, failed, or timeout executions (not pending/running)
            query = {
                "created_at": {"$lt": cutoff_date},
                "status": {"$in": ["completed", "failed", "timeout"]}
            }
            
            result = await collection.delete_many(query)
            
            logger.info(
                "Old execution results cleaned up",
                deleted_count=result.deleted_count,
                cutoff_date=cutoff_date
            )
            
            return result.deleted_count
            
        except Exception as e:
            logger.error(
                "Error cleaning up old executions",
                days=days,
                error=str(e)
            )
            raise RepositoryError(f"Failed to cleanup old executions: {str(e)}")
    
    async def get_execution_queue_status(self) -> Dict[str, Any]:
        """
        Get current execution queue status.
        
        Returns:
            Dict[str, Any]: Queue status including pending and running counts
        """
        try:
            collection = await self._get_collection()
            
            # Aggregation pipeline for queue status
            pipeline = [
                {
                    "$group": {
                        "_id": "$status",
                        "count": {"$sum": 1}
                    }
                }
            ]
            
            cursor = collection.aggregate(pipeline)
            results = await cursor.to_list(length=10)
            
            status_counts = {}
            for result in results:
                status = result["_id"]
                count = result["count"]
                if status:
                    status_counts[status] = count
            
            return {
                "pending": status_counts.get("pending", 0),
                "running": status_counts.get("running", 0),
                "completed": status_counts.get("completed", 0),
                "failed": status_counts.get("failed", 0),
                "timeout": status_counts.get("timeout", 0),
                "total_in_queue": status_counts.get("pending", 0) + status_counts.get("running", 0)
            }
            
        except Exception as e:
            logger.error("Error getting execution queue status", error=str(e))
            raise RepositoryError(f"Failed to get execution queue status: {str(e)}")
    
    async def delete_execution_result(self, job_id: str) -> bool:
        """
        Delete an execution result.
        
        Args:
            job_id: Job ID to delete
            
        Returns:
            bool: True if deleted, False if not found
        """
        return await self.delete_by_id(job_id)