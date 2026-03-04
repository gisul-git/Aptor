"""
Progress analytics service for advanced user analytics and insights.
"""

import structlog
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

from app.models.user import UserProgress, Solution, SkillArea, UserAnalytics
from app.models.question import QuestionTopic
from app.repositories.user_repository import UserRepository
from app.repositories.solution_repository import SolutionRepository

logger = structlog.get_logger()


class ProgressAnalyticsService:
    """Service for advanced progress analytics and insights."""
    
    def __init__(self):
        self.logger = logger.bind(service="progress_analytics")
        self.user_repo = UserRepository()
        self.solution_repo = SolutionRepository()
    
    async def calculate_difficulty_progression(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Calculate user's difficulty progression over time.
        
        Args:
            user_id: User ID
            
        Returns:
            List[Dict[str, Any]]: Difficulty progression data points
        """
        self.logger.info("Calculating difficulty progression", user_id=user_id)
        
        solutions = await self.solution_repo.get_solutions_by_user(user_id, limit=100)
        if not solutions:
            return []
        
        # Group solutions by week and calculate average difficulty
        weekly_difficulty = defaultdict(list)
        
        for solution in solutions:
            week_key = solution.submitted_at.strftime("%Y-W%U")
            # Extract difficulty from solution metadata or question
            difficulty = solution.performance_metrics.get("difficulty_level", 5)
            weekly_difficulty[week_key].append(difficulty)
        
        progression = []
        for week, difficulties in sorted(weekly_difficulty.items()):
            avg_difficulty = statistics.mean(difficulties)
            success_rate = self._calculate_weekly_success_rate(solutions, week)
            
            progression.append({
                "week": week,
                "average_difficulty": avg_difficulty,
                "success_rate": success_rate,
                "attempts": len(difficulties)
            })
        
        return progression
    
    async def calculate_learning_velocity(self, user_id: str) -> Dict[str, float]:
        """
        Calculate user's learning velocity across different metrics.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict[str, float]: Learning velocity metrics
        """
        self.logger.info("Calculating learning velocity", user_id=user_id)
        
        solutions = await self.solution_repo.get_solutions_by_user(user_id, limit=50)
        if len(solutions) < 5:
            return {"overall_velocity": 0.0, "skill_velocities": {}}
        
        # Calculate overall velocity (improvement in success rate over time)
        time_points = []
        success_points = []
        
        for i, solution in enumerate(reversed(solutions)):  # Chronological order
            time_points.append(i)
            is_success = (
                solution.execution_result and 
                solution.execution_result.validation_result and 
                solution.execution_result.validation_result.is_correct
            )
            success_points.append(1.0 if is_success else 0.0)
        
        # Calculate moving average success rate
        window_size = min(5, len(success_points) // 2)
        moving_averages = []
        
        for i in range(window_size, len(success_points)):
            window = success_points[i-window_size:i]
            moving_averages.append(statistics.mean(window))
        
        overall_velocity = 0.0
        if len(moving_averages) >= 2:
            overall_velocity = self._calculate_trend(moving_averages)
        
        # Calculate skill-specific velocities
        skill_velocities = await self._calculate_skill_velocities(user_id, solutions)
        
        return {
            "overall_velocity": overall_velocity,
            "skill_velocities": skill_velocities,
            "consistency_score": self._calculate_learning_consistency(success_points)
        }
    
    async def identify_learning_patterns(self, user_id: str) -> Dict[str, Any]:
        """
        Identify user's learning patterns and preferences.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict[str, Any]: Learning pattern analysis
        """
        self.logger.info("Identifying learning patterns", user_id=user_id)
        
        solutions = await self.solution_repo.get_solutions_by_user(user_id, limit=100)
        if not solutions:
            return {}
        
        patterns = {
            "peak_performance_hours": self._analyze_time_patterns(solutions),
            "preferred_difficulty": self._analyze_difficulty_preference(solutions),
            "topic_preferences": self._analyze_topic_preferences(solutions),
            "session_patterns": self._analyze_session_patterns(solutions),
            "error_patterns": self._analyze_error_patterns(solutions)
        }
        
        return patterns
    
    async def calculate_peer_comparison(
        self, 
        user_id: str, 
        comparison_group: str = "experience_level"
    ) -> Dict[str, Any]:
        """
        Calculate user performance compared to peers.
        
        Args:
            user_id: User ID
            comparison_group: Grouping criteria ("experience_level", "activity_level")
            
        Returns:
            Dict[str, Any]: Peer comparison data
        """
        self.logger.info("Calculating peer comparison", user_id=user_id, group=comparison_group)
        
        user_progress = await self.user_repo.get_user_progress(user_id)
        if not user_progress:
            return {}
        
        # Get peer group
        if comparison_group == "experience_level":
            peers = await self.user_repo.get_users_by_experience_level(
                max(0, user_progress.experience_level - 1),
                user_progress.experience_level + 1,
                limit=100
            )
        else:
            # Default to active users
            peers = await self.user_repo.get_active_users(days=30)
        
        if len(peers) < 2:
            return {"insufficient_data": True}
        
        # Calculate percentiles
        peer_metrics = {
            "success_rates": [p.success_rate for p in peers],
            "completion_times": [p.average_completion_time for p in peers if p.average_completion_time > 0],
            "proficiency_scores": [p.overall_proficiency for p in peers],
            "questions_completed": [p.total_questions_completed for p in peers]
        }
        
        user_percentiles = {}
        for metric, values in peer_metrics.items():
            if not values:
                continue
                
            user_value = getattr(user_progress, metric.rstrip('s'), 0)
            if metric == "completion_times":
                user_value = user_progress.average_completion_time
            elif metric == "proficiency_scores":
                user_value = user_progress.overall_proficiency
            
            percentile = self._calculate_percentile(user_value, values)
            user_percentiles[metric] = percentile
        
        return {
            "peer_group_size": len(peers),
            "percentiles": user_percentiles,
            "peer_averages": {
                metric: statistics.mean(values) if values else 0
                for metric, values in peer_metrics.items()
            }
        }
    
    async def generate_improvement_insights(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Generate actionable improvement insights for the user.
        
        Args:
            user_id: User ID
            
        Returns:
            List[Dict[str, Any]]: Improvement insights with priorities
        """
        self.logger.info("Generating improvement insights", user_id=user_id)
        
        user_progress = await self.user_repo.get_user_progress(user_id)
        if not user_progress:
            return []
        
        insights = []
        
        # Analyze skill gaps
        skill_insights = await self._analyze_skill_gaps(user_progress)
        insights.extend(skill_insights)
        
        # Analyze performance patterns
        pattern_insights = await self._analyze_performance_patterns(user_id)
        insights.extend(pattern_insights)
        
        # Analyze learning velocity
        velocity_insights = await self._analyze_velocity_insights(user_id)
        insights.extend(velocity_insights)
        
        # Sort by priority and return top insights
        insights.sort(key=lambda x: x.get("priority", 0), reverse=True)
        return insights[:10]
    
    async def get_user_analytics(self, user_id: str, days: int = 30) -> UserAnalytics:
        """
        Get comprehensive user analytics for the specified time period.
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            
        Returns:
            UserAnalytics: Comprehensive analytics data
        """
        self.logger.info("Getting user analytics", user_id=user_id, days=days)
        
        progress = await self.user_repo.get_user_progress(user_id)
        if not progress:
            raise ValueError("User not found")
        
        # Get solution history for the specified period
        solutions = await self.solution_repo.get_user_solution_history(user_id, days)
        
        # Calculate comprehensive analytics
        from app.services.user_service import UserService
        user_service = UserService()
        analytics = await user_service._calculate_comprehensive_analytics(progress, solutions)
        
        return analytics
    
    async def get_skill_assessment(self, user_id: str) -> Dict[str, Any]:
        """
        Get detailed skill assessment for the user.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict[str, Any]: Detailed skill assessment
        """
        self.logger.info("Getting skill assessment", user_id=user_id)
        
        progress = await self.user_repo.get_user_progress(user_id)
        if not progress:
            raise ValueError("User not found")
        
        # Calculate skill assessment
        skill_assessment = {
            "overall_proficiency": progress.overall_proficiency,
            "experience_level": progress.experience_level,
            "skill_areas": {},
            "strengths": [],
            "weaknesses": [],
            "recommendations": []
        }
        
        # Analyze each skill area
        for skill_area in progress.skill_areas:
            skill_assessment["skill_areas"][skill_area.topic.value] = {
                "proficiency_score": skill_area.proficiency_score,
                "questions_attempted": skill_area.questions_attempted,
                "questions_completed": skill_area.questions_completed,
                "success_rate": (
                    skill_area.questions_completed / skill_area.questions_attempted
                    if skill_area.questions_attempted > 0 else 0.0
                ),
                "mastery_level": self._assess_mastery_level(skill_area),
                "next_milestone": self._get_next_skill_milestone(skill_area)
            }
            
            # Categorize as strength or weakness
            if skill_area.proficiency_score >= 7.0:
                skill_assessment["strengths"].append(skill_area.topic.value)
            elif skill_area.proficiency_score <= 4.0:
                skill_assessment["weaknesses"].append(skill_area.topic.value)
        
        # Generate recommendations
        improvement_insights = await self.generate_improvement_insights(user_id)
        skill_assessment["recommendations"] = [
            insight["recommendation"] for insight in improvement_insights[:5]
        ]
        
        return skill_assessment
    
    async def get_user_achievements(self, user_id: str) -> Dict[str, Any]:
        """
        Get user achievements and badges.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict[str, Any]: User achievements
        """
        self.logger.info("Getting user achievements", user_id=user_id)
        
        progress = await self.user_repo.get_user_progress(user_id)
        if not progress:
            raise ValueError("User not found")
        
        achievements = {
            "badges": [],
            "milestones": [],
            "streaks": [],
            "performance_awards": []
        }
        
        # Success rate badges
        if progress.success_rate >= 0.95:
            achievements["badges"].append({
                "name": "Perfectionist",
                "description": "95%+ success rate",
                "icon": "🎯",
                "earned_at": progress.last_activity_date.isoformat() if progress.last_activity_date else None
            })
        elif progress.success_rate >= 0.85:
            achievements["badges"].append({
                "name": "High Achiever",
                "description": "85%+ success rate",
                "icon": "⭐",
                "earned_at": progress.last_activity_date.isoformat() if progress.last_activity_date else None
            })
        
        # Volume milestones
        if progress.total_questions_completed >= 100:
            achievements["milestones"].append({
                "name": "Century Club",
                "description": "Completed 100+ questions",
                "icon": "💯"
            })
        elif progress.total_questions_completed >= 50:
            achievements["milestones"].append({
                "name": "Half Century",
                "description": "Completed 50+ questions",
                "icon": "🏆"
            })
        elif progress.total_questions_completed >= 10:
            achievements["milestones"].append({
                "name": "Getting Started",
                "description": "Completed 10+ questions",
                "icon": "🚀"
            })
        
        # Streak achievements
        if progress.streak_days >= 30:
            achievements["streaks"].append({
                "name": "Monthly Streak",
                "description": f"{progress.streak_days}-day learning streak",
                "icon": "🔥"
            })
        elif progress.streak_days >= 7:
            achievements["streaks"].append({
                "name": "Weekly Streak",
                "description": f"{progress.streak_days}-day learning streak",
                "icon": "📅"
            })
        
        # Proficiency awards
        if progress.overall_proficiency >= 8.0:
            achievements["performance_awards"].append({
                "name": "Expert Level",
                "description": "8.0+ overall proficiency",
                "icon": "🎓"
            })
        elif progress.overall_proficiency >= 6.0:
            achievements["performance_awards"].append({
                "name": "Proficient",
                "description": "6.0+ overall proficiency",
                "icon": "📈"
            })
        
        return achievements
    
    async def get_performance_trends(
        self, 
        user_id: str, 
        days: int = 30, 
        granularity: str = "daily"
    ) -> Dict[str, Any]:
        """
        Get user performance trends over time.
        
        Args:
            user_id: User ID
            days: Number of days to analyze
            granularity: Data granularity (daily, weekly, monthly)
            
        Returns:
            Dict[str, Any]: Performance trends
        """
        self.logger.info("Getting performance trends", user_id=user_id, days=days, granularity=granularity)
        
        solutions = await self.solution_repo.get_user_solution_history(user_id, days)
        if not solutions:
            return {"insufficient_data": True}
        
        trends = {
            "success_rate_trend": [],
            "completion_time_trend": [],
            "activity_trend": [],
            "difficulty_progression": [],
            "topic_performance": {}
        }
        
        # Group data by granularity
        if granularity == "daily":
            grouped_data = self._group_by_day(solutions)
        elif granularity == "weekly":
            grouped_data = self._group_by_week(solutions)
        else:  # monthly
            grouped_data = self._group_by_month(solutions)
        
        # Calculate trends for each time period
        for period, period_solutions in grouped_data.items():
            if not period_solutions:
                continue
            
            # Success rate
            successes = sum(
                1 for s in period_solutions
                if (s.get("execution_result") and 
                    s["execution_result"].get("validation_result") and 
                    s["execution_result"]["validation_result"].get("is_correct"))
            )
            success_rate = successes / len(period_solutions)
            trends["success_rate_trend"].append({
                "period": period,
                "value": success_rate
            })
            
            # Completion time
            completion_times = [
                s.get("execution_result", {}).get("execution_time", 0) / 60.0  # Convert to minutes
                for s in period_solutions
                if s.get("execution_result", {}).get("execution_time", 0) > 0
            ]
            if completion_times:
                avg_time = statistics.mean(completion_times)
                trends["completion_time_trend"].append({
                    "period": period,
                    "value": avg_time
                })
            
            # Activity
            trends["activity_trend"].append({
                "period": period,
                "value": len(period_solutions)
            })
        
        return trends
    
    async def get_leaderboard(
        self, 
        limit: int = 10, 
        timeframe: str = "all",
        anonymize: bool = True
    ) -> Dict[str, Any]:
        """
        Get leaderboard data.
        
        Args:
            limit: Number of users to return
            timeframe: Timeframe for leaderboard (daily, weekly, monthly, all)
            anonymize: Whether to anonymize user data
            
        Returns:
            Dict[str, Any]: Leaderboard data
        """
        self.logger.info("Getting leaderboard", limit=limit, timeframe=timeframe)
        
        # Get top users based on timeframe
        if timeframe == "all":
            users = await self.user_repo.get_top_users_by_proficiency(limit)
        else:
            # For time-based leaderboards, we'd need to implement time-filtered queries
            users = await self.user_repo.get_top_users_by_proficiency(limit)
        
        leaderboard_data = []
        for i, user in enumerate(users):
            entry = {
                "rank": i + 1,
                "success_rate": user.success_rate,
                "overall_proficiency": user.overall_proficiency,
                "questions_completed": user.total_questions_completed,
                "streak_days": user.streak_days
            }
            
            if anonymize:
                entry["user_id"] = f"user_{i+1}"
                entry["display_name"] = f"Anonymous User {i+1}"
            else:
                entry["user_id"] = user.user_id
                entry["display_name"] = user.user_id  # Would be actual display name in real app
            
            leaderboard_data.append(entry)
        
        return {
            "leaderboard": leaderboard_data,
            "timeframe": timeframe,
            "generated_at": datetime.utcnow().isoformat(),
            "total_users": len(leaderboard_data)
        }
    
    async def get_platform_stats(self) -> Dict[str, Any]:
        """
        Get public platform statistics.
        
        Returns:
            Dict[str, Any]: Platform statistics
        """
        self.logger.info("Getting platform stats")
        
        try:
            # Get aggregate statistics
            total_users = await self.user_repo.count_total_users()
            active_users = await self.user_repo.count_active_users(days=30)
            total_solutions = await self.solution_repo.count_total_solutions()
            
            # Calculate average metrics
            avg_success_rate = await self.user_repo.get_average_success_rate()
            avg_proficiency = await self.user_repo.get_average_proficiency()
            
            return {
                "total_users": total_users,
                "active_users_30d": active_users,
                "total_solutions_submitted": total_solutions,
                "platform_average_success_rate": avg_success_rate,
                "platform_average_proficiency": avg_proficiency,
                "generated_at": datetime.utcnow().isoformat()
            }
        except Exception as e:
            self.logger.error("Failed to get platform stats", error=str(e))
            # Return default stats if database queries fail
            return {
                "total_users": 0,
                "active_users_30d": 0,
                "total_solutions_submitted": 0,
                "platform_average_success_rate": 0.0,
                "platform_average_proficiency": 0.0,
                "generated_at": datetime.utcnow().isoformat()
            }
    
    # Helper methods
    def _assess_mastery_level(self, skill_area: SkillArea) -> str:
        """Assess mastery level for a skill area."""
        if skill_area.proficiency_score >= 8.5:
            return "Expert"
        elif skill_area.proficiency_score >= 7.0:
            return "Advanced"
        elif skill_area.proficiency_score >= 5.5:
            return "Intermediate"
        elif skill_area.proficiency_score >= 3.0:
            return "Beginner"
        else:
            return "Novice"
    
    def _get_next_skill_milestone(self, skill_area: SkillArea) -> str:
        """Get next milestone for a skill area."""
        current_level = self._assess_mastery_level(skill_area)
        
        milestones = {
            "Novice": "Reach Beginner level (3.0+ proficiency)",
            "Beginner": "Reach Intermediate level (5.5+ proficiency)",
            "Intermediate": "Reach Advanced level (7.0+ proficiency)",
            "Advanced": "Reach Expert level (8.5+ proficiency)",
            "Expert": "Maintain expertise and help others"
        }
        
        return milestones.get(current_level, "Continue improving")
    
    def _group_by_day(self, solutions: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group solutions by day."""
        grouped = defaultdict(list)
        for solution in solutions:
            date_key = solution["date"]  # Assuming solutions have date field
            grouped[date_key].append(solution)
        return dict(grouped)
    
    def _group_by_week(self, solutions: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group solutions by week."""
        grouped = defaultdict(list)
        for solution in solutions:
            # Convert date to week key
            date = datetime.fromisoformat(solution["date"])
            week_key = date.strftime("%Y-W%U")
            grouped[week_key].append(solution)
        return dict(grouped)
    
    def _group_by_month(self, solutions: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group solutions by month."""
        grouped = defaultdict(list)
        for solution in solutions:
            # Convert date to month key
            date = datetime.fromisoformat(solution["date"])
            month_key = date.strftime("%Y-%m")
            grouped[month_key].append(solution)
        return dict(grouped)
    
    def _calculate_weekly_success_rate(self, solutions: List[Solution], week: str) -> float:
        """Calculate success rate for a specific week."""
        week_solutions = [
            s for s in solutions 
            if s.submitted_at.strftime("%Y-W%U") == week
        ]
        
        if not week_solutions:
            return 0.0
        
        successful = sum(
            1 for s in week_solutions
            if (s.execution_result and 
                s.execution_result.validation_result and 
                s.execution_result.validation_result.is_correct)
        )
        
        return successful / len(week_solutions)
    
    async def _calculate_skill_velocities(
        self, 
        user_id: str, 
        solutions: List[Solution]
    ) -> Dict[str, float]:
        """Calculate learning velocity for each skill area."""
        progress = await self.user_repo.get_user_progress(user_id)
        if not progress:
            return {}
        
        skill_velocities = {}
        
        # Group solutions by topic and calculate improvement over time
        topic_solutions = defaultdict(list)
        for solution in solutions:
            # Extract topic from solution metadata
            topic = solution.performance_metrics.get("topic", "unknown")
            topic_solutions[topic].append(solution)
        
        for topic, topic_sols in topic_solutions.items():
            if len(topic_sols) < 3:
                continue
            
            # Calculate success rate trend
            success_rates = []
            for sol in sorted(topic_sols, key=lambda x: x.submitted_at):
                is_success = (
                    sol.execution_result and 
                    sol.execution_result.validation_result and 
                    sol.execution_result.validation_result.is_correct
                )
                success_rates.append(1.0 if is_success else 0.0)
            
            velocity = self._calculate_trend(success_rates)
            skill_velocities[topic] = velocity
        
        return skill_velocities
    
    def _calculate_trend(self, values: List[float]) -> float:
        """Calculate trend direction (-1 to 1) for a series of values."""
        if len(values) < 2:
            return 0.0
        
        n = len(values)
        x_values = list(range(n))
        
        try:
            correlation = statistics.correlation(x_values, values)
            return correlation
        except (statistics.StatisticsError, ValueError):
            return 0.0
    
    def _calculate_learning_consistency(self, success_points: List[float]) -> float:
        """Calculate consistency of learning progress."""
        if len(success_points) < 5:
            return 0.0
        
        # Calculate moving average and measure variance
        window_size = min(5, len(success_points) // 2)
        moving_averages = []
        
        for i in range(window_size, len(success_points)):
            window = success_points[i-window_size:i]
            moving_averages.append(statistics.mean(window))
        
        if len(moving_averages) < 2:
            return 0.0
        
        try:
            # Lower variance indicates more consistent learning
            variance = statistics.variance(moving_averages)
            # Convert to 0-1 score where 1 is most consistent
            return max(0.0, 1.0 - variance)
        except statistics.StatisticsError:
            return 0.0
    
    def _analyze_time_patterns(self, solutions: List[Solution]) -> Dict[str, int]:
        """Analyze when user performs best."""
        hour_performance = defaultdict(list)
        
        for solution in solutions:
            hour = solution.submitted_at.hour
            is_success = (
                solution.execution_result and 
                solution.execution_result.validation_result and 
                solution.execution_result.validation_result.is_correct
            )
            hour_performance[hour].append(1.0 if is_success else 0.0)
        
        # Find hours with best performance
        hour_averages = {}
        for hour, performances in hour_performance.items():
            if len(performances) >= 2:  # Need at least 2 attempts
                hour_averages[hour] = statistics.mean(performances)
        
        if not hour_averages:
            return {}
        
        # Return top 3 performing hours
        sorted_hours = sorted(hour_averages.items(), key=lambda x: x[1], reverse=True)
        return {f"hour_{hour}": round(avg, 2) for hour, avg in sorted_hours[:3]}
    
    def _analyze_difficulty_preference(self, solutions: List[Solution]) -> Dict[str, Any]:
        """Analyze user's difficulty preferences."""
        difficulty_performance = defaultdict(list)
        
        for solution in solutions:
            difficulty = solution.performance_metrics.get("difficulty_level", 5)
            is_success = (
                solution.execution_result and 
                solution.execution_result.validation_result and 
                solution.execution_result.validation_result.is_correct
            )
            difficulty_performance[difficulty].append(1.0 if is_success else 0.0)
        
        # Calculate performance by difficulty
        difficulty_stats = {}
        for difficulty, performances in difficulty_performance.items():
            if len(performances) >= 2:
                difficulty_stats[difficulty] = {
                    "success_rate": statistics.mean(performances),
                    "attempts": len(performances)
                }
        
        return difficulty_stats
    
    def _analyze_topic_preferences(self, solutions: List[Solution]) -> Dict[str, Any]:
        """Analyze user's topic preferences and performance."""
        topic_stats = defaultdict(lambda: {"attempts": 0, "successes": 0})
        
        for solution in solutions:
            topic = solution.performance_metrics.get("topic", "unknown")
            topic_stats[topic]["attempts"] += 1
            
            is_success = (
                solution.execution_result and 
                solution.execution_result.validation_result and 
                solution.execution_result.validation_result.is_correct
            )
            if is_success:
                topic_stats[topic]["successes"] += 1
        
        # Calculate success rates and preferences
        preferences = {}
        for topic, stats in topic_stats.items():
            if stats["attempts"] >= 2:
                preferences[topic] = {
                    "success_rate": stats["successes"] / stats["attempts"],
                    "attempts": stats["attempts"],
                    "preference_score": stats["attempts"] * (stats["successes"] / stats["attempts"])
                }
        
        return preferences
    
    def _analyze_session_patterns(self, solutions: List[Solution]) -> Dict[str, Any]:
        """Analyze user's coding session patterns."""
        # Group solutions by day to identify session patterns
        daily_sessions = defaultdict(list)
        
        for solution in solutions:
            date_key = solution.submitted_at.strftime("%Y-%m-%d")
            daily_sessions[date_key].append(solution)
        
        session_lengths = []
        session_success_rates = []
        
        for date, day_solutions in daily_sessions.items():
            session_lengths.append(len(day_solutions))
            
            successes = sum(
                1 for s in day_solutions
                if (s.execution_result and 
                    s.execution_result.validation_result and 
                    s.execution_result.validation_result.is_correct)
            )
            session_success_rates.append(successes / len(day_solutions))
        
        if not session_lengths:
            return {}
        
        return {
            "average_session_length": statistics.mean(session_lengths),
            "optimal_session_length": self._find_optimal_session_length(
                session_lengths, session_success_rates
            ),
            "session_consistency": 1.0 - (statistics.stdev(session_lengths) / statistics.mean(session_lengths))
            if statistics.mean(session_lengths) > 0 else 0.0
        }
    
    def _analyze_error_patterns(self, solutions: List[Solution]) -> Dict[str, Any]:
        """Analyze common error patterns."""
        error_types = defaultdict(int)
        
        for solution in solutions:
            if (solution.execution_result and 
                solution.execution_result.error_message):
                # Categorize errors (simplified)
                error_msg = solution.execution_result.error_message.lower()
                if "syntax" in error_msg:
                    error_types["syntax_errors"] += 1
                elif "type" in error_msg:
                    error_types["type_errors"] += 1
                elif "name" in error_msg:
                    error_types["name_errors"] += 1
                elif "attribute" in error_msg:
                    error_types["attribute_errors"] += 1
                else:
                    error_types["other_errors"] += 1
        
        total_errors = sum(error_types.values())
        if total_errors == 0:
            return {}
        
        # Convert to percentages
        error_percentages = {
            error_type: (count / total_errors) * 100
            for error_type, count in error_types.items()
        }
        
        return error_percentages
    
    def _find_optimal_session_length(
        self, 
        session_lengths: List[int], 
        success_rates: List[float]
    ) -> int:
        """Find the session length that correlates with highest success rate."""
        if len(session_lengths) != len(success_rates) or len(session_lengths) < 3:
            return 0
        
        # Group by session length and calculate average success rate
        length_performance = defaultdict(list)
        for length, rate in zip(session_lengths, success_rates):
            length_performance[length].append(rate)
        
        # Find length with highest average success rate
        best_length = 0
        best_rate = 0.0
        
        for length, rates in length_performance.items():
            if len(rates) >= 2:  # Need multiple sessions of this length
                avg_rate = statistics.mean(rates)
                if avg_rate > best_rate:
                    best_rate = avg_rate
                    best_length = length
        
        return best_length
    
    def _calculate_percentile(self, value: float, values: List[float]) -> float:
        """Calculate percentile rank of value in the list of values."""
        if not values:
            return 0.0
        
        sorted_values = sorted(values)
        n = len(sorted_values)
        
        # Count values less than or equal to the target value
        count = sum(1 for v in sorted_values if v <= value)
        
        return (count / n) * 100
    
    async def _analyze_skill_gaps(self, progress: UserProgress) -> List[Dict[str, Any]]:
        """Analyze skill gaps and generate insights."""
        insights = []
        
        if not progress.skill_areas:
            insights.append({
                "type": "skill_gap",
                "priority": 8,
                "title": "Build foundational skills",
                "description": "Start with basic data transformation problems to build your skill profile",
                "action": "Attempt problems in different topic areas"
            })
            return insights
        
        # Find significant skill gaps
        avg_proficiency = progress.overall_proficiency
        for skill_area in progress.skill_areas:
            gap = avg_proficiency - skill_area.proficiency_score
            
            if gap > 2.0:  # Significant gap
                insights.append({
                    "type": "skill_gap",
                    "priority": min(10, int(gap * 2)),
                    "title": f"Improve {skill_area.topic.value} skills",
                    "description": f"Your {skill_area.topic.value} proficiency is below your average",
                    "action": f"Focus on {skill_area.topic.value} problems to close the gap"
                })
        
        return insights
    
    async def _analyze_performance_patterns(self, user_id: str) -> List[Dict[str, Any]]:
        """Analyze performance patterns and generate insights."""
        insights = []
        
        patterns = await self.identify_learning_patterns(user_id)
        
        # Analyze time patterns
        if "peak_performance_hours" in patterns:
            peak_hours = patterns["peak_performance_hours"]
            if peak_hours:
                best_hour = max(peak_hours.items(), key=lambda x: x[1])
                insights.append({
                    "type": "time_pattern",
                    "priority": 5,
                    "title": "Optimize your coding schedule",
                    "description": f"You perform best around hour {best_hour[0].split('_')[1]}",
                    "action": "Schedule your most challenging problems during peak hours"
                })
        
        # Analyze session patterns
        if "session_patterns" in patterns:
            session_info = patterns["session_patterns"]
            optimal_length = session_info.get("optimal_session_length", 0)
            
            if optimal_length > 0:
                insights.append({
                    "type": "session_pattern",
                    "priority": 4,
                    "title": "Optimize session length",
                    "description": f"Your optimal session length is {optimal_length} problems",
                    "action": f"Try to solve around {optimal_length} problems per session"
                })
        
        return insights
    
    async def _analyze_velocity_insights(self, user_id: str) -> List[Dict[str, Any]]:
        """Analyze learning velocity and generate insights."""
        insights = []
        
        velocity_data = await self.calculate_learning_velocity(user_id)
        overall_velocity = velocity_data.get("overall_velocity", 0.0)
        
        if overall_velocity < -0.1:  # Declining performance
            insights.append({
                "type": "velocity",
                "priority": 9,
                "title": "Address declining performance",
                "description": "Your success rate has been declining recently",
                "action": "Review fundamentals and consider easier problems to rebuild confidence"
            })
        elif overall_velocity > 0.2:  # Strong improvement
            insights.append({
                "type": "velocity",
                "priority": 6,
                "title": "Great progress!",
                "description": "You're showing strong improvement over time",
                "action": "Consider challenging yourself with harder problems"
            })
        
        return insights