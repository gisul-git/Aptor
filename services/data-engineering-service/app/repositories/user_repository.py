"""
User repository for managing user data operations.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import structlog

from app.repositories.base import BaseRepository, RepositoryError
from app.models.user import UserProgress, Solution, SolutionStatus, SkillArea, UserAnalytics
from app.models.question import QuestionTopic

logger = structlog.get_logger()


class UserRepository(BaseRepository[UserProgress]):
    """Repository for user data operations."""
    
    def __init__(self):
        super().__init__("users")
    
    async def create_user_progress(self, user_progress: UserProgress) -> str:
        """
        Create a new user progress record.
        
        Args:
            user_progress: UserProgress model to create
            
        Returns:
            str: The created user progress ID
        """
        progress_data = user_progress.model_dump()
        return await self.create(progress_data)
    
    async def get_user_progress(self, user_id: str) -> Optional[UserProgress]:
        """
        Get user progress by user ID.
        
        Args:
            user_id: User ID to retrieve progress for
            
        Returns:
            Optional[UserProgress]: User progress if found, None otherwise
        """
        document = await self.get_by_field("user_id", user_id)
        if document:
            if '_id' in document:
                document.pop('_id')  # Remove MongoDB _id field
            return UserProgress(**document)
        return None
    
    async def update_user_progress(
        self, 
        user_id: str, 
        update_data: Dict[str, Any]
    ) -> Optional[UserProgress]:
        """
        Update user progress.
        
        Args:
            user_id: User ID to update
            update_data: Data to update
            
        Returns:
            Optional[UserProgress]: Updated user progress if found, None otherwise
        """
        # Find the document by user_id first
        existing = await self.get_by_field("user_id", user_id)
        if not existing:
            return None
        
        document_id = str(existing['_id'])
        document = await self.update_by_id(document_id, update_data)
        
        if document:
            if '_id' in document:
                document.pop('_id')
            return UserProgress(**document)
        return None
    
    async def add_completed_question(
        self, 
        user_id: str, 
        question_id: str,
        completion_time: float,
        success: bool
    ) -> Optional[UserProgress]:
        """
        Add a completed question to user progress.
        
        Args:
            user_id: User ID
            question_id: Question ID that was completed
            completion_time: Time taken to complete in minutes
            success: Whether the question was completed successfully
            
        Returns:
            Optional[UserProgress]: Updated user progress
        """
        try:
            # Get current progress
            progress = await self.get_user_progress(user_id)
            if not progress:
                return None
            
            # Update completion statistics
            update_data = {
                "$addToSet": {"completed_questions": question_id},
                "$inc": {"total_questions_attempted": 1},
                "$set": {"last_activity": datetime.utcnow()}
            }
            
            if success:
                update_data["$inc"]["total_questions_completed"] = 1
                
                # Recalculate success rate
                new_completed = progress.total_questions_completed + 1
                new_attempted = progress.total_questions_attempted + 1
                new_success_rate = new_completed / new_attempted if new_attempted > 0 else 0.0
                update_data["$set"]["success_rate"] = new_success_rate
                
                # Update average completion time
                current_avg = progress.average_completion_time
                current_count = progress.total_questions_completed
                new_avg = ((current_avg * current_count) + completion_time) / new_completed
                update_data["$set"]["average_completion_time"] = new_avg
            
            return await self.update_user_progress(user_id, update_data)
            
        except Exception as e:
            logger.error(
                "Error adding completed question",
                user_id=user_id,
                question_id=question_id,
                error=str(e)
            )
            raise RepositoryError(f"Failed to add completed question: {str(e)}")
    
    async def update_skill_area(
        self, 
        user_id: str, 
        topic: QuestionTopic,
        proficiency_change: float,
        attempted: bool = True,
        completed: bool = False
    ) -> Optional[UserProgress]:
        """
        Update user skill area proficiency.
        
        Args:
            user_id: User ID
            topic: Question topic/skill area
            proficiency_change: Change in proficiency score
            attempted: Whether a question was attempted
            completed: Whether a question was completed successfully
            
        Returns:
            Optional[UserProgress]: Updated user progress
        """
        try:
            progress = await self.get_user_progress(user_id)
            if not progress:
                return None
            
            # Find or create skill area
            skill_areas = progress.skill_areas.copy()
            skill_area = None
            skill_index = -1
            
            for i, area in enumerate(skill_areas):
                if area.topic == topic:
                    skill_area = area
                    skill_index = i
                    break
            
            if skill_area is None:
                # Create new skill area
                skill_area = SkillArea(
                    topic=topic,
                    proficiency_score=max(0.0, min(10.0, 5.0 + proficiency_change)),
                    questions_attempted=1 if attempted else 0,
                    questions_completed=1 if completed else 0,
                    last_activity=datetime.utcnow()
                )
                skill_areas.append(skill_area)
            else:
                # Update existing skill area
                new_score = skill_area.proficiency_score + proficiency_change
                skill_area.proficiency_score = max(0.0, min(10.0, new_score))
                
                if attempted:
                    skill_area.questions_attempted += 1
                if completed:
                    skill_area.questions_completed += 1
                    
                skill_area.last_activity = datetime.utcnow()
                skill_areas[skill_index] = skill_area
            
            # Calculate overall proficiency
            if skill_areas:
                overall_proficiency = sum(area.proficiency_score for area in skill_areas) / len(skill_areas)
            else:
                overall_proficiency = 0.0
            
            # Update the progress
            update_data = {
                "skill_areas": [area.model_dump() for area in skill_areas],
                "overall_proficiency": overall_proficiency
            }
            
            return await self.update_user_progress(user_id, update_data)
            
        except Exception as e:
            logger.error(
                "Error updating skill area",
                user_id=user_id,
                topic=topic,
                error=str(e)
            )
            raise RepositoryError(f"Failed to update skill area: {str(e)}")
    
    async def get_users_by_experience_level(
        self, 
        min_level: int, 
        max_level: int,
        limit: Optional[int] = None
    ) -> List[UserProgress]:
        """
        Get users by experience level range.
        
        Args:
            min_level: Minimum experience level
            max_level: Maximum experience level
            limit: Maximum number of users to return
            
        Returns:
            List[UserProgress]: List of matching user progress records
        """
        query = {
            "experience_level": {
                "$gte": min_level,
                "$lte": max_level
            }
        }
        
        documents = await self.find_many(
            query,
            limit=limit,
            sort=[("last_activity", -1)]
        )
        
        users = []
        for doc in documents:
            if '_id' in doc:
                doc.pop('_id')
            users.append(UserProgress(**doc))
        
        return users
    
    async def get_active_users(self, days: int = 7) -> List[UserProgress]:
        """
        Get users who have been active within the specified number of days.
        
        Args:
            days: Number of days to look back for activity
            
        Returns:
            List[UserProgress]: List of active users
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        query = {"last_activity": {"$gte": cutoff_date}}
        
        documents = await self.find_many(
            query,
            sort=[("last_activity", -1)]
        )
        
        users = []
        for doc in documents:
            if '_id' in doc:
                doc.pop('_id')
            users.append(UserProgress(**doc))
        
        return users
    
    async def get_user_leaderboard(
        self, 
        metric: str = "success_rate",
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get user leaderboard based on a specific metric.
        
        Args:
            metric: Metric to rank by (success_rate, total_questions_completed, overall_proficiency)
            limit: Number of top users to return
            
        Returns:
            List[Dict[str, Any]]: Leaderboard data
        """
        try:
            collection = await self._get_collection()
            
            # Aggregation pipeline for leaderboard
            pipeline = [
                {"$match": {metric: {"$gt": 0}}},  # Only users with activity
                {"$sort": {metric: -1}},
                {"$limit": limit},
                {
                    "$project": {
                        "user_id": 1,
                        "experience_level": 1,
                        "success_rate": 1,
                        "total_questions_completed": 1,
                        "overall_proficiency": 1,
                        "last_activity": 1,
                        "rank_metric": f"${metric}"
                    }
                }
            ]
            
            cursor = collection.aggregate(pipeline)
            results = await cursor.to_list(length=limit)
            
            # Add rank numbers
            for i, result in enumerate(results):
                result['rank'] = i + 1
                if '_id' in result:
                    result.pop('_id')
            
            return results
            
        except Exception as e:
            logger.error(
                "Error getting user leaderboard",
                metric=metric,
                error=str(e)
            )
            raise RepositoryError(f"Failed to get user leaderboard: {str(e)}")
    
    async def get_user_analytics(self, user_id: str) -> Optional[UserAnalytics]:
        """
        Get detailed analytics for a user.
        
        Args:
            user_id: User ID to get analytics for
            
        Returns:
            Optional[UserAnalytics]: User analytics if found, None otherwise
        """
        try:
            # This would typically involve complex aggregations
            # For now, return basic analytics based on user progress
            progress = await self.get_user_progress(user_id)
            if not progress:
                return None
            
            # Calculate basic analytics
            analytics = UserAnalytics(
                user_id=user_id,
                daily_activity={},  # Would be calculated from activity logs
                weekly_progress={},  # Would be calculated from historical data
                monthly_trends={},   # Would be calculated from historical data
                difficulty_progression=[],  # Would be calculated from solution history
                topic_performance={},  # Based on skill areas
                improvement_rate=0.0,  # Would be calculated from historical performance
                percentile_ranking=0.0,  # Would be calculated against all users
                peer_comparison={},  # Would be calculated against similar users
                strengths=[],  # Based on high-performing skill areas
                improvement_areas=[],  # Based on low-performing skill areas
                personalized_recommendations=[]  # Based on performance analysis
            )
            
            # Populate topic performance from skill areas
            for skill_area in progress.skill_areas:
                analytics.topic_performance[skill_area.topic.value] = {
                    "proficiency_score": skill_area.proficiency_score,
                    "questions_attempted": skill_area.questions_attempted,
                    "questions_completed": skill_area.questions_completed,
                    "success_rate": (
                        skill_area.questions_completed / skill_area.questions_attempted
                        if skill_area.questions_attempted > 0 else 0.0
                    )
                }
            
            # Identify strengths and improvement areas
            for skill_area in progress.skill_areas:
                if skill_area.proficiency_score >= 7.0:
                    analytics.strengths.append(skill_area.topic.value)
                elif skill_area.proficiency_score <= 4.0:
                    analytics.improvement_areas.append(skill_area.topic.value)
            
            return analytics
            
        except Exception as e:
            logger.error(
                "Error getting user analytics",
                user_id=user_id,
                error=str(e)
            )
            raise RepositoryError(f"Failed to get user analytics: {str(e)}")
    
    async def delete_user_progress(self, user_id: str) -> bool:
        """
        Delete user progress record.
        
        Args:
            user_id: User ID to delete progress for
            
        Returns:
            bool: True if deleted, False if not found
        """
        # Find the document by user_id first
        existing = await self.get_by_field("user_id", user_id)
        if not existing:
            return False
        
        document_id = str(existing['_id'])
        return await self.delete_by_id(document_id)
    
    async def count_total_users(self) -> int:
        """
        Count total number of users in the system.
        
        Returns:
            int: Total user count
        """
        try:
            collection = await self._get_collection()
            return await collection.count_documents({})
        except Exception as e:
            logger.error("Error counting total users", error=str(e))
            raise RepositoryError(f"Failed to count total users: {str(e)}")
    
    async def count_active_users(self, days: int = 30) -> int:
        """
        Count users who have been active within the specified number of days.
        
        Args:
            days: Number of days to look back for activity
            
        Returns:
            int: Count of active users
        """
        try:
            from datetime import datetime, timedelta
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            collection = await self._get_collection()
            return await collection.count_documents({
                "last_activity_date": {"$gte": cutoff_date}
            })
        except Exception as e:
            logger.error("Error counting active users", error=str(e))
            raise RepositoryError(f"Failed to count active users: {str(e)}")
    
    async def get_average_success_rate(self) -> float:
        """
        Get platform-wide average success rate.
        
        Returns:
            float: Average success rate across all users
        """
        try:
            collection = await self._get_collection()
            pipeline = [
                {"$group": {
                    "_id": None,
                    "avg_success_rate": {"$avg": "$success_rate"}
                }}
            ]
            
            result = await collection.aggregate(pipeline).to_list(1)
            if result:
                return result[0]["avg_success_rate"] or 0.0
            return 0.0
            
        except Exception as e:
            logger.error("Error getting average success rate", error=str(e))
            raise RepositoryError(f"Failed to get average success rate: {str(e)}")
    
    async def get_average_proficiency(self) -> float:
        """
        Get platform-wide average proficiency score.
        
        Returns:
            float: Average proficiency score across all users
        """
        try:
            collection = await self._get_collection()
            pipeline = [
                {"$group": {
                    "_id": None,
                    "avg_proficiency": {"$avg": "$overall_proficiency"}
                }}
            ]
            
            result = await collection.aggregate(pipeline).to_list(1)
            if result:
                return result[0]["avg_proficiency"] or 0.0
            return 0.0
            
        except Exception as e:
            logger.error("Error getting average proficiency", error=str(e))
            raise RepositoryError(f"Failed to get average proficiency: {str(e)}")
    
    async def get_top_users_by_proficiency(self, limit: int = 10) -> List[UserProgress]:
        """
        Get top users by overall proficiency score.
        
        Args:
            limit: Maximum number of users to return
            
        Returns:
            List[UserProgress]: Top users by proficiency
        """
        try:
            collection = await self._get_collection()
            cursor = collection.find({}).sort("overall_proficiency", -1).limit(limit)
            
            users = []
            async for doc in cursor:
                user_data = self._document_to_model(doc)
                users.append(user_data)
            
            return users
            
        except Exception as e:
            logger.error("Error getting top users by proficiency", error=str(e))
            raise RepositoryError(f"Failed to get top users by proficiency: {str(e)}")