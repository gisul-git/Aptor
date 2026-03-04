"""
User management and progress tracking service.
"""

import structlog
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

from app.models.user import (
    UserProgress, UserPreferences, Solution, SkillArea, UserAnalytics
)
from app.models.question import QuestionTopic
from app.models.execution import ExecutionResult
from app.repositories.user_repository import UserRepository
from app.repositories.solution_repository import SolutionRepository
from app.core.config import settings

logger = structlog.get_logger()


class UserService:
    """Service for user management and progress tracking."""
    
    def __init__(self):
        self.logger = logger.bind(service="user_service")
        self.user_repo = UserRepository()
        self.solution_repo = SolutionRepository()
    
    async def get_user_progress(self, user_id: str) -> Optional[UserProgress]:
        """Get user progress and statistics."""
        self.logger.info("Getting user progress", user_id=user_id)
        
        progress = await self.user_repo.get_user_progress(user_id)
        if progress:
            # Update progress with latest calculations
            await self._update_progress_metrics(progress)
        
        return progress
    
    async def get_user_solutions(self, user_id: str) -> List[Solution]:
        """Get user's historical solutions."""
        self.logger.info("Getting user solutions", user_id=user_id)
        
        return await self.solution_repo.get_solutions_by_user(user_id)
    
    async def update_user_preferences(self, user_id: str, preferences: UserPreferences) -> UserProgress:
        """Update user preferences and return updated progress."""
        self.logger.info("Updating user preferences", user_id=user_id)
        
        # Get existing progress or create new one
        progress = await self.user_repo.get_user_progress(user_id)
        if not progress:
            progress = UserProgress(
                user_id=user_id,
                experience_level=preferences.experience_level,
                preferences=preferences
            )
            await self.user_repo.create_user_progress(progress)
        else:
            # Update preferences
            update_data = {
                "experience_level": preferences.experience_level,
                "preferences": preferences.model_dump()
            }
            progress = await self.user_repo.update_user_progress(user_id, update_data)
        
        return progress
    
    async def record_solution_attempt(
        self, 
        user_id: str, 
        question_id: str,
        topic: QuestionTopic,
        execution_result: ExecutionResult,
        completion_time: float,
        difficulty_level: int
    ) -> UserProgress:
        """
        Record a solution attempt and update user progress metrics.
        
        Args:
            user_id: User ID
            question_id: Question ID attempted
            topic: Question topic/skill area
            execution_result: Result of code execution
            completion_time: Time taken to complete in minutes
            difficulty_level: Difficulty level of the question (1-10)
            
        Returns:
            UserProgress: Updated user progress
        """
        self.logger.info(
            "Recording solution attempt",
            user_id=user_id,
            question_id=question_id,
            topic=topic,
            success=execution_result.validation_result.is_correct if execution_result.validation_result else False
        )
        
        success = execution_result.validation_result.is_correct if execution_result.validation_result else False
        
        # Calculate proficiency change based on performance
        proficiency_change = self._calculate_proficiency_change(
            success=success,
            completion_time=completion_time,
            difficulty_level=difficulty_level,
            execution_result=execution_result
        )
        
        # Update skill area
        await self.user_repo.update_skill_area(
            user_id=user_id,
            topic=topic,
            proficiency_change=proficiency_change,
            attempted=True,
            completed=success
        )
        
        # Update overall progress
        progress = await self.user_repo.add_completed_question(
            user_id=user_id,
            question_id=question_id,
            completion_time=completion_time,
            success=success
        )
        
        if progress:
            # Update weak areas and recommendations
            await self._update_recommendations(progress)
        
        return progress
    
    async def calculate_user_trends(self, user_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Calculate user performance trends over time.
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            Dict[str, Any]: Trend analysis data
        """
        self.logger.info("Calculating user trends", user_id=user_id, days=days)
        
        # Get solution history
        history = await self.solution_repo.get_user_solution_history(user_id, days)
        
        if not history:
            return {
                "success_rate_trend": 0.0,
                "completion_time_trend": 0.0,
                "activity_trend": 0.0,
                "improvement_rate": 0.0,
                "consistency_score": 0.0
            }
        
        # Calculate trends
        success_rates = [day["success_rate"] for day in history]
        completion_times = [day["avg_execution_time"] for day in history if day["avg_execution_time"] > 0]
        activity_counts = [day["solutions_count"] for day in history]
        
        trends = {
            "success_rate_trend": self._calculate_trend(success_rates),
            "completion_time_trend": self._calculate_trend(completion_times, inverse=True),  # Lower is better
            "activity_trend": self._calculate_trend(activity_counts),
            "improvement_rate": self._calculate_improvement_rate(success_rates),
            "consistency_score": self._calculate_consistency_score(activity_counts)
        }
        
        return trends
    
    async def identify_weak_areas(self, user_id: str) -> List[QuestionTopic]:
        """
        Identify user's weak areas based on skill performance.
        
        Args:
            user_id: User ID
            
        Returns:
            List[QuestionTopic]: List of topics needing improvement
        """
        self.logger.info("Identifying weak areas", user_id=user_id)
        
        progress = await self.user_repo.get_user_progress(user_id)
        if not progress or not progress.skill_areas:
            return []
        
        weak_areas = []
        overall_avg = progress.overall_proficiency
        
        for skill_area in progress.skill_areas:
            # Consider an area weak if:
            # 1. Proficiency is below 5.0 (absolute threshold)
            # 2. Proficiency is significantly below user's average
            # 3. Success rate is low despite attempts
            
            success_rate = (
                skill_area.questions_completed / skill_area.questions_attempted
                if skill_area.questions_attempted > 0 else 0.0
            )
            
            is_weak = (
                skill_area.proficiency_score < 5.0 or
                skill_area.proficiency_score < (overall_avg - 1.5) or
                (skill_area.questions_attempted >= 3 and success_rate < 0.5)
            )
            
            if is_weak:
                weak_areas.append(skill_area.topic)
        
        return weak_areas
    
    async def get_user_analytics(self, user_id: str) -> Optional[UserAnalytics]:
        """
        Get comprehensive user analytics and insights.
        
        Args:
            user_id: User ID
            
        Returns:
            Optional[UserAnalytics]: Detailed analytics if user exists
        """
        self.logger.info("Getting user analytics", user_id=user_id)
        
        progress = await self.user_repo.get_user_progress(user_id)
        if not progress:
            return None
        
        # Get solution history for detailed analysis
        solutions = await self.solution_repo.get_solutions_by_user(user_id, limit=100)
        
        # Calculate analytics
        analytics = await self._calculate_comprehensive_analytics(progress, solutions)
        
        return analytics
    
    async def get_personalized_recommendations(self, user_id: str) -> List[str]:
        """
        Generate personalized recommendations for the user.
        
        Args:
            user_id: User ID
            
        Returns:
            List[str]: List of personalized recommendations
        """
        self.logger.info("Getting personalized recommendations", user_id=user_id)
        
        from app.services.recommendation_engine import RecommendationEngine
        recommendation_engine = RecommendationEngine()
        
        # Get comprehensive insights and recommendations
        insights = await recommendation_engine.generate_performance_insights(user_id)
        
        recommendations = []
        
        # Extract recommendations from insights
        if "next_steps" in insights:
            recommendations.extend(insights["next_steps"])
        
        # Add improvement opportunities
        if "improvement_opportunities" in insights:
            for opportunity in insights["improvement_opportunities"][:3]:
                recommendations.append(opportunity["recommendation"])
        
        # Fallback to basic recommendations if no insights available
        if not recommendations:
            progress = await self.user_repo.get_user_progress(user_id)
            if not progress:
                recommendations = [
                    "Start with basic transformation and filtering problems",
                    "Learn fundamental PySpark DataFrame operations",
                    "Practice data manipulation techniques"
                ]
            else:
                # Analyze weak areas
                weak_areas = await self.identify_weak_areas(user_id)
                if weak_areas:
                    for topic in weak_areas[:3]:  # Top 3 weak areas
                        recommendations.append(
                            f"Focus on {topic.value} problems to improve your proficiency in this area"
                        )
                
                # Analyze activity patterns
                if progress.total_questions_attempted < 10:
                    recommendations.append("Try solving more problems to build a stronger foundation")
                
                # Analyze success rate
                if progress.success_rate < 0.6:
                    recommendations.append("Consider reviewing fundamental concepts before attempting harder problems")
                elif progress.success_rate > 0.8:
                    recommendations.append("You're doing great! Try challenging yourself with harder problems")
                
                # Analyze completion time
                if progress.average_completion_time > 30:
                    recommendations.append("Focus on optimizing your solutions for better performance")
                
                # Experience level recommendations
                if progress.experience_level < 3:
                    recommendations.append("Start with basic transformation and filtering problems")
                elif progress.experience_level >= 5:
                    recommendations.append("Explore advanced topics like window functions and performance optimization")
        
        return recommendations[:5]  # Return top 5 recommendations
    
    def _calculate_proficiency_change(
        self, 
        success: bool, 
        completion_time: float,
        difficulty_level: int,
        execution_result: ExecutionResult
    ) -> float:
        """Calculate proficiency change based on performance."""
        base_change = 0.0
        
        if success:
            # Positive change for success, scaled by difficulty
            base_change = 0.5 + (difficulty_level * 0.1)
            
            # Bonus for fast completion (under 15 minutes)
            if completion_time < 15:
                base_change += 0.2
            
            # Bonus for efficient code (if memory usage is low)
            if execution_result.memory_usage < 50.0:  # Less than 50MB is efficient
                base_change += 0.1
        else:
            # Negative change for failure, but less severe for harder problems
            base_change = -0.3 + (difficulty_level * 0.05)
            
            # Less penalty if execution was successful but validation failed
            if execution_result.status.value == "completed":
                base_change += 0.1
        
        return base_change
    
    def _calculate_trend(self, values: List[float], inverse: bool = False) -> float:
        """Calculate trend direction (-1 to 1) for a series of values."""
        if len(values) < 2:
            return 0.0
        
        # Simple linear trend calculation
        n = len(values)
        x_values = list(range(n))
        
        # Calculate correlation coefficient
        if statistics.variance(values) == 0:
            return 0.0
        
        try:
            correlation = statistics.correlation(x_values, values)
            return -correlation if inverse else correlation
        except statistics.StatisticsError:
            return 0.0
    
    def _calculate_improvement_rate(self, success_rates: List[float]) -> float:
        """Calculate rate of improvement over time."""
        if len(success_rates) < 3:
            return 0.0
        
        # Compare recent performance to earlier performance
        recent_avg = statistics.mean(success_rates[-7:])  # Last week
        earlier_avg = statistics.mean(success_rates[:7])   # First week
        
        return recent_avg - earlier_avg
    
    def _calculate_consistency_score(self, activity_counts: List[int]) -> float:
        """Calculate consistency score based on activity regularity."""
        if not activity_counts:
            return 0.0
        
        # Calculate coefficient of variation (lower is more consistent)
        if statistics.mean(activity_counts) == 0:
            return 0.0
        
        try:
            cv = statistics.stdev(activity_counts) / statistics.mean(activity_counts)
            # Convert to 0-1 score where 1 is most consistent
            return max(0.0, 1.0 - cv)
        except statistics.StatisticsError:
            return 0.0
    
    async def _update_progress_metrics(self, progress: UserProgress) -> None:
        """Update calculated metrics in user progress."""
        # Update weak areas
        weak_areas = await self.identify_weak_areas(progress.user_id)
        progress.weak_areas = weak_areas
        
        # Update recommendations
        recommendations = await self.get_personalized_recommendations(progress.user_id)
        progress.recommended_topics = [
            topic for topic in QuestionTopic 
            if any(topic.value.lower() in rec.lower() for rec in recommendations)
        ]
    
    async def _update_recommendations(self, progress: UserProgress) -> None:
        """Update user recommendations based on current progress."""
        update_data = {
            "weak_areas": [area.value for area in await self.identify_weak_areas(progress.user_id)],
            "recommended_topics": [
                topic.value for topic in progress.recommended_topics
            ]
        }
        
        await self.user_repo.update_user_progress(progress.user_id, update_data)
    
    async def _calculate_comprehensive_analytics(
        self, 
        progress: UserProgress, 
        solutions: List[Solution]
    ) -> UserAnalytics:
        """Calculate comprehensive analytics from progress and solutions."""
        # Daily activity calculation
        daily_activity = defaultdict(int)
        for solution in solutions:
            date_key = solution.submitted_at.strftime("%Y-%m-%d")
            daily_activity[date_key] += 1
        
        # Weekly progress calculation
        weekly_progress = {}
        now = datetime.utcnow()
        for i in range(4):  # Last 4 weeks
            week_start = now - timedelta(weeks=i+1)
            week_end = now - timedelta(weeks=i)
            week_solutions = [
                s for s in solutions 
                if week_start <= s.submitted_at <= week_end
            ]
            
            if week_solutions:
                success_count = sum(
                    1 for s in week_solutions 
                    if s.execution_result and s.execution_result.validation_result and s.execution_result.validation_result.is_correct
                )
                weekly_progress[f"week_{i+1}"] = success_count / len(week_solutions)
            else:
                weekly_progress[f"week_{i+1}"] = 0.0
        
        # Topic performance
        topic_performance = {}
        for skill_area in progress.skill_areas:
            topic_performance[skill_area.topic.value] = {
                "proficiency_score": skill_area.proficiency_score,
                "questions_attempted": skill_area.questions_attempted,
                "questions_completed": skill_area.questions_completed,
                "success_rate": (
                    skill_area.questions_completed / skill_area.questions_attempted
                    if skill_area.questions_attempted > 0 else 0.0
                )
            }
        
        # Calculate improvement rate
        trends = await self.calculate_user_trends(progress.user_id)
        improvement_rate = trends.get("improvement_rate", 0.0)
        
        # Identify strengths and improvement areas
        strengths = []
        improvement_areas = []
        
        for skill_area in progress.skill_areas:
            if skill_area.proficiency_score >= 7.0:
                strengths.append(skill_area.topic.value)
            elif skill_area.proficiency_score <= 4.0:
                improvement_areas.append(skill_area.topic.value)
        
        # Get personalized recommendations
        recommendations = await self.get_personalized_recommendations(progress.user_id)
        
        return UserAnalytics(
            user_id=progress.user_id,
            daily_activity=dict(daily_activity),
            weekly_progress=weekly_progress,
            monthly_trends={},  # Would be calculated with more historical data
            difficulty_progression=[],  # Would be calculated from solution difficulty over time
            topic_performance=topic_performance,
            improvement_rate=improvement_rate,
            percentile_ranking=0.0,  # Would be calculated against all users
            peer_comparison={},  # Would be calculated against similar users
            strengths=strengths,
            improvement_areas=improvement_areas,
            personalized_recommendations=recommendations
        )
    async def get_difficulty_progression(self, user_id: str) -> Dict[str, Any]:
        """
        Get difficulty progression recommendations for the user.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict[str, Any]: Difficulty progression recommendations
        """
        self.logger.info("Getting difficulty progression", user_id=user_id)
        
        from app.services.recommendation_engine import RecommendationEngine
        recommendation_engine = RecommendationEngine()
        
        return await recommendation_engine.generate_difficulty_progression(user_id)
    
    async def get_question_recommendations(self, user_id: str, count: int = 5) -> List[Dict[str, Any]]:
        """
        Get personalized question recommendations for the user.
        
        Args:
            user_id: User ID
            count: Number of questions to recommend
            
        Returns:
            List[Dict[str, Any]]: Recommended questions with reasoning
        """
        self.logger.info("Getting question recommendations", user_id=user_id, count=count)
        
        from app.services.recommendation_engine import RecommendationEngine
        recommendation_engine = RecommendationEngine()
        
        return await recommendation_engine.recommend_questions(user_id, count)
    
    async def get_performance_insights(self, user_id: str) -> Dict[str, Any]:
        """
        Get comprehensive performance insights for the user.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict[str, Any]: Performance insights and analytics
        """
        self.logger.info("Getting performance insights", user_id=user_id)
        
        from app.services.recommendation_engine import RecommendationEngine
        recommendation_engine = RecommendationEngine()
        
        return await recommendation_engine.generate_performance_insights(user_id)
    
    async def get_learning_path(self, user_id: str, target_level: Optional[int] = None) -> Dict[str, Any]:
        """
        Get structured learning path for the user.
        
        Args:
            user_id: User ID
            target_level: Target experience level (optional)
            
        Returns:
            Dict[str, Any]: Structured learning path
        """
        self.logger.info("Getting learning path", user_id=user_id, target_level=target_level)
        
        from app.services.recommendation_engine import RecommendationEngine
        recommendation_engine = RecommendationEngine()
        
        return await recommendation_engine.get_learning_path(user_id, target_level)
    
    async def get_user_solutions(
        self, 
        user_id: str, 
        skip: int = 0, 
        limit: int = 10,
        question_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> tuple[List[Solution], int]:
        """Get user's historical solutions with pagination and filtering."""
        self.logger.info("Getting user solutions with filters", user_id=user_id, skip=skip, limit=limit)
        
        try:
            # Get solutions from repository with filters
            solutions = await self.solution_repo.get_solutions_by_user(
                user_id=user_id,
                skip=skip,
                limit=limit,
                question_id=question_id,
                status=status
            )
            
            # Get total count for pagination
            total_count = await self.solution_repo.count_solutions_by_user(
                user_id=user_id,
                question_id=question_id,
                status=status
            )
            
            return solutions, total_count
            
        except Exception as e:
            self.logger.error("Failed to get user solutions", error=str(e), user_id=user_id)
            return [], 0
    
    async def set_learning_goals(self, user_id: str, goals: Dict[str, Any]) -> bool:
        """Set learning goals for the user."""
        try:
            self.logger.info("Setting learning goals", user_id=user_id)
            
            # Update user preferences with goals
            update_data = {
                "learning_goals": goals,
                "goals_set_at": datetime.utcnow().isoformat()
            }
            
            success = await self.user_repo.update_user_progress(user_id, update_data)
            
            if success:
                self.logger.info("Learning goals set successfully", user_id=user_id)
            else:
                self.logger.warning("Failed to set learning goals", user_id=user_id)
            
            return success
            
        except Exception as e:
            self.logger.error("Error setting learning goals", error=str(e), user_id=user_id)
            return False
    
    async def export_user_data(
        self, 
        user_id: str, 
        format: str = "json",
        include_solutions: bool = False
    ) -> Dict[str, Any]:
        """Export user data for backup or analysis."""
        try:
            self.logger.info("Exporting user data", user_id=user_id, format=format)
            
            # Get user progress
            progress = await self.get_user_progress(user_id)
            if not progress:
                raise ValueError("User not found")
            
            export_data = {
                "user_id": user_id,
                "exported_at": datetime.utcnow().isoformat(),
                "format": format,
                "progress": progress.model_dump()
            }
            
            # Include solutions if requested
            if include_solutions:
                solutions, _ = await self.get_user_solutions(user_id, limit=1000)
                export_data["solutions"] = [solution.model_dump() for solution in solutions]
            
            # Get analytics
            analytics = await self.get_user_analytics(user_id)
            if analytics:
                export_data["analytics"] = analytics.model_dump()
            
            return export_data
            
        except Exception as e:
            self.logger.error("Failed to export user data", error=str(e), user_id=user_id)
            raise
    
    async def delete_user_data(self, user_id: str) -> bool:
        """Delete all user data (GDPR compliance)."""
        try:
            self.logger.info("Deleting user data", user_id=user_id)
            
            # Delete user progress
            progress_deleted = await self.user_repo.delete_user_progress(user_id)
            
            # Delete user solutions
            solutions_deleted = await self.solution_repo.delete_solutions_by_user(user_id)
            
            # Clear user caches
            from app.core.redis_client import get_redis
            redis_client = await get_redis()
            
            # Delete user-related cache keys
            cache_keys = [
                f"user_progress:{user_id}",
                f"user_analytics:{user_id}",
                f"user_recommendations:{user_id}",
                f"user_recent_questions:{user_id}",
                f"user_jobs:{user_id}"
            ]
            
            for key in cache_keys:
                await redis_client.delete(key)
            
            success = progress_deleted and solutions_deleted
            
            if success:
                self.logger.info("User data deleted successfully", user_id=user_id)
            else:
                self.logger.warning("Partial user data deletion", user_id=user_id)
            
            return success
            
        except Exception as e:
            self.logger.error("Failed to delete user data", error=str(e), user_id=user_id)
            return False