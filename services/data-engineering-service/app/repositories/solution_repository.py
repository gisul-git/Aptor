"""
Solution repository for managing solution data operations.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import structlog

from app.repositories.base import BaseRepository, RepositoryError
from app.models.user import Solution, SolutionStatus
from app.models.execution import ExecutionResult, CodeReview

logger = structlog.get_logger()


class SolutionRepository(BaseRepository[Solution]):
    """Repository for solution data operations."""
    
    def __init__(self):
        super().__init__("solutions")
    
    async def create_solution(self, solution: Solution) -> str:
        """
        Create a new solution.
        
        Args:
            solution: Solution model to create
            
        Returns:
            str: The created solution ID
        """
        solution_data = solution.model_dump()
        # Use the solution's ID if provided, otherwise let MongoDB generate one
        if solution.id:
            solution_data["_id"] = solution.id
        
        return await self.create(solution_data)
    
    async def get_solution_by_id(self, solution_id: str) -> Optional[Solution]:
        """
        Get a solution by its ID.
        
        Args:
            solution_id: Solution ID to retrieve
            
        Returns:
            Optional[Solution]: Solution if found, None otherwise
        """
        document = await self.get_by_id(solution_id)
        if document:
            # Map _id to id for the model
            if '_id' in document:
                document['id'] = document.pop('_id')
            return Solution(**document)
        return None
    
    async def get_solutions_by_user(
        self, 
        user_id: str,
        limit: Optional[int] = None,
        skip: Optional[int] = None
    ) -> List[Solution]:
        """
        Get solutions by user ID.
        
        Args:
            user_id: User ID to get solutions for
            limit: Maximum number of solutions to return
            skip: Number of solutions to skip
            
        Returns:
            List[Solution]: List of user solutions
        """
        query = {"user_id": user_id}
        documents = await self.find_many(
            query,
            limit=limit,
            skip=skip,
            sort=[("submitted_at", -1)]  # Most recent first
        )
        
        solutions = []
        for doc in documents:
            if '_id' in doc:
                doc['id'] = doc.pop('_id')
            solutions.append(Solution(**doc))
        
        return solutions
    
    async def get_solutions_by_question(
        self, 
        question_id: str,
        limit: Optional[int] = None
    ) -> List[Solution]:
        """
        Get solutions for a specific question.
        
        Args:
            question_id: Question ID to get solutions for
            limit: Maximum number of solutions to return
            
        Returns:
            List[Solution]: List of solutions for the question
        """
        query = {"question_id": question_id}
        documents = await self.find_many(
            query,
            limit=limit,
            sort=[("submitted_at", -1)]
        )
        
        solutions = []
        for doc in documents:
            if '_id' in doc:
                doc['id'] = doc.pop('_id')
            solutions.append(Solution(**doc))
        
        return solutions
    
    async def get_user_solution_for_question(
        self, 
        user_id: str, 
        question_id: str
    ) -> Optional[Solution]:
        """
        Get a user's solution for a specific question.
        
        Args:
            user_id: User ID
            question_id: Question ID
            
        Returns:
            Optional[Solution]: User's solution if found, None otherwise
        """
        query = {"user_id": user_id, "question_id": question_id}
        documents = await self.find_many(
            query,
            limit=1,
            sort=[("submitted_at", -1)]  # Most recent if multiple
        )
        
        if documents:
            doc = documents[0]
            if '_id' in doc:
                doc['id'] = doc.pop('_id')
            return Solution(**doc)
        
        return None
    
    async def update_solution(
        self, 
        solution_id: str, 
        update_data: Dict[str, Any]
    ) -> Optional[Solution]:
        """
        Update a solution.
        
        Args:
            solution_id: Solution ID to update
            update_data: Data to update
            
        Returns:
            Optional[Solution]: Updated solution if found, None otherwise
        """
        document = await self.update_by_id(solution_id, update_data)
        if document:
            if '_id' in document:
                document['id'] = document.pop('_id')
            return Solution(**document)
        return None
    
    async def update_solution_execution_result(
        self, 
        solution_id: str, 
        execution_result: ExecutionResult
    ) -> Optional[Solution]:
        """
        Update solution with execution result.
        
        Args:
            solution_id: Solution ID to update
            execution_result: Execution result to add
            
        Returns:
            Optional[Solution]: Updated solution if found, None otherwise
        """
        update_data = {
            "execution_result": execution_result.model_dump(),
            "status": SolutionStatus.SUBMITTED if execution_result.validation_result and execution_result.validation_result.is_correct else SolutionStatus.DRAFT
        }
        
        return await self.update_solution(solution_id, update_data)
    
    async def update_solution_ai_review(
        self, 
        solution_id: str, 
        ai_review: CodeReview
    ) -> Optional[Solution]:
        """
        Update solution with AI review.
        
        Args:
            solution_id: Solution ID to update
            ai_review: AI review to add
            
        Returns:
            Optional[Solution]: Updated solution if found, None otherwise
        """
        update_data = {
            "ai_review": ai_review.model_dump(),
            "reviewed_at": datetime.utcnow(),
            "status": SolutionStatus.REVIEWED
        }
        
        return await self.update_solution(solution_id, update_data)
    
    async def get_solutions_by_status(
        self, 
        status: SolutionStatus,
        limit: Optional[int] = None
    ) -> List[Solution]:
        """
        Get solutions by status.
        
        Args:
            status: Solution status to filter by
            limit: Maximum number of solutions to return
            
        Returns:
            List[Solution]: List of solutions with the specified status
        """
        query = {"status": status.value}
        documents = await self.find_many(
            query,
            limit=limit,
            sort=[("submitted_at", -1)]
        )
        
        solutions = []
        for doc in documents:
            if '_id' in doc:
                doc['id'] = doc.pop('_id')
            solutions.append(Solution(**doc))
        
        return solutions
    
    async def get_solutions_needing_review(
        self, 
        limit: Optional[int] = None
    ) -> List[Solution]:
        """
        Get solutions that need AI review (submitted but not reviewed).
        
        Args:
            limit: Maximum number of solutions to return
            
        Returns:
            List[Solution]: List of solutions needing review
        """
        query = {
            "status": SolutionStatus.SUBMITTED.value,
            "ai_review": {"$exists": False}
        }
        
        documents = await self.find_many(
            query,
            limit=limit,
            sort=[("submitted_at", 1)]  # Oldest first for fair processing
        )
        
        solutions = []
        for doc in documents:
            if '_id' in doc:
                doc['id'] = doc.pop('_id')
            solutions.append(Solution(**doc))
        
        return solutions
    
    async def get_solution_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about solutions in the database.
        
        Returns:
            Dict[str, Any]: Statistics including counts by status and performance metrics
        """
        try:
            collection = await self._get_collection()
            
            # Aggregation pipeline for statistics
            pipeline = [
                {
                    "$group": {
                        "_id": None,
                        "total_solutions": {"$sum": 1},
                        "by_status": {
                            "$push": "$status"
                        },
                        "avg_execution_time": {
                            "$avg": "$execution_result.execution_time"
                        },
                        "successful_solutions": {
                            "$sum": {
                                "$cond": [
                                    {"$eq": ["$execution_result.validation_result.is_correct", True]},
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
                    "total_solutions": 0,
                    "by_status": {},
                    "success_rate": 0.0,
                    "avg_execution_time": 0.0
                }
            
            result = results[0]
            
            # Count by status
            status_counts = {}
            for status in result.get("by_status", []):
                if status:
                    status_counts[status] = status_counts.get(status, 0) + 1
            
            total = result.get("total_solutions", 0)
            successful = result.get("successful_solutions", 0)
            success_rate = successful / total if total > 0 else 0.0
            
            return {
                "total_solutions": total,
                "by_status": status_counts,
                "success_rate": success_rate,
                "successful_solutions": successful,
                "avg_execution_time": result.get("avg_execution_time", 0.0) or 0.0
            }
            
        except Exception as e:
            logger.error("Error getting solution statistics", error=str(e))
            raise RepositoryError(f"Failed to get solution statistics: {str(e)}")
    
    async def get_user_solution_history(
        self, 
        user_id: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get user's solution history for the specified number of days.
        
        Args:
            user_id: User ID to get history for
            days: Number of days to look back
            
        Returns:
            List[Dict[str, Any]]: Solution history with daily aggregations
        """
        try:
            collection = await self._get_collection()
            
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Aggregation pipeline for daily solution history
            pipeline = [
                {
                    "$match": {
                        "user_id": user_id,
                        "submitted_at": {"$gte": cutoff_date}
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "$dateToString": {
                                "format": "%Y-%m-%d",
                                "date": "$submitted_at"
                            }
                        },
                        "solutions_count": {"$sum": 1},
                        "successful_count": {
                            "$sum": {
                                "$cond": [
                                    {"$eq": ["$execution_result.validation_result.is_correct", True]},
                                    1,
                                    0
                                ]
                            }
                        },
                        "avg_execution_time": {
                            "$avg": "$execution_result.execution_time"
                        }
                    }
                },
                {"$sort": {"_id": 1}}
            ]
            
            cursor = collection.aggregate(pipeline)
            results = await cursor.to_list(length=days)
            
            # Format results
            history = []
            for result in results:
                date = result["_id"]
                solutions_count = result["solutions_count"]
                successful_count = result["successful_count"]
                success_rate = successful_count / solutions_count if solutions_count > 0 else 0.0
                
                history.append({
                    "date": date,
                    "solutions_count": solutions_count,
                    "successful_count": successful_count,
                    "success_rate": success_rate,
                    "avg_execution_time": result.get("avg_execution_time", 0.0) or 0.0
                })
            
            return history
            
        except Exception as e:
            logger.error(
                "Error getting user solution history",
                user_id=user_id,
                error=str(e)
            )
            raise RepositoryError(f"Failed to get user solution history: {str(e)}")
    
    async def delete_solution(self, solution_id: str) -> bool:
        """
        Delete a solution.
        
        Args:
            solution_id: Solution ID to delete
            
        Returns:
            bool: True if deleted, False if not found
        """
        return await self.delete_by_id(solution_id)
    
    async def delete_user_solutions(self, user_id: str) -> int:
        """
        Delete all solutions for a user.
        
        Args:
            user_id: User ID to delete solutions for
            
        Returns:
            int: Number of solutions deleted
        """
        try:
            collection = await self._get_collection()
            result = await collection.delete_many({"user_id": user_id})
            
            logger.info(
                "User solutions deleted",
                user_id=user_id,
                deleted_count=result.deleted_count
            )
            
            return result.deleted_count
            
        except Exception as e:
            logger.error(
                "Error deleting user solutions",
                user_id=user_id,
                error=str(e)
            )
            raise RepositoryError(f"Failed to delete user solutions: {str(e)}")
    
    async def count_total_solutions(self) -> int:
        """
        Count total number of solutions in the system.
        
        Returns:
            int: Total solution count
        """
        try:
            collection = await self._get_collection()
            return await collection.count_documents({})
        except Exception as e:
            logger.error("Error counting total solutions", error=str(e))
            raise RepositoryError(f"Failed to count total solutions: {str(e)}")
    
    async def count_solutions_by_user(
        self, 
        user_id: str,
        question_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> int:
        """
        Count solutions for a user with optional filters.
        
        Args:
            user_id: User ID
            question_id: Optional question ID filter
            status: Optional status filter
            
        Returns:
            int: Count of matching solutions
        """
        try:
            query = {"user_id": user_id}
            
            if question_id:
                query["question_id"] = question_id
            
            if status:
                query["execution_result.status"] = status
            
            collection = await self._get_collection()
            return await collection.count_documents(query)
            
        except Exception as e:
            logger.error("Error counting solutions by user", error=str(e))
            raise RepositoryError(f"Failed to count solutions by user: {str(e)}")
    
    async def delete_solutions_by_user(self, user_id: str) -> bool:
        """
        Delete all solutions for a user (GDPR compliance).
        
        Args:
            user_id: User ID
            
        Returns:
            bool: True if successful
        """
        try:
            deleted_count = await self.delete_user_solutions(user_id)
            return deleted_count > 0
        except Exception as e:
            logger.error("Error deleting solutions by user", error=str(e))
            return False