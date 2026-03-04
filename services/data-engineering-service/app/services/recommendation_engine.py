"""
Recommendation engine for personalized learning paths and question suggestions.
"""

import structlog
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

from app.models.user import UserProgress, Solution, SkillArea
from app.models.question import QuestionTopic, DifficultyLevel
from app.repositories.user_repository import UserRepository
from app.repositories.solution_repository import SolutionRepository
from app.repositories.question_repository import QuestionRepository

logger = structlog.get_logger()


class RecommendationEngine:
    """Engine for generating personalized learning recommendations."""
    
    def __init__(self):
        self.logger = logger.bind(service="recommendation_engine")
        self.user_repo = UserRepository()
        self.solution_repo = SolutionRepository()
        self.question_repo = QuestionRepository()
    
    async def generate_difficulty_progression(self, user_id: str) -> Dict[str, Any]:
        """
        Generate difficulty progression recommendations based on user performance.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict[str, Any]: Difficulty progression recommendations
        """
        self.logger.info("Generating difficulty progression", user_id=user_id)
        
        progress = await self.user_repo.get_user_progress(user_id)
        if not progress:
            return self._get_beginner_progression()
        
        # Analyze current performance
        current_difficulty = self._determine_current_difficulty(progress)
        recommended_difficulty = self._calculate_next_difficulty(progress, current_difficulty)
        
        # Get topic-specific difficulty recommendations
        topic_recommendations = {}
        for skill_area in progress.skill_areas:
            topic_difficulty = self._get_topic_difficulty_recommendation(skill_area, progress.experience_level)
            topic_recommendations[skill_area.topic.value] = topic_difficulty
        
        return {
            "current_difficulty": current_difficulty.value,
            "recommended_difficulty": recommended_difficulty.value,
            "progression_readiness": self._assess_progression_readiness(progress),
            "topic_specific_difficulties": topic_recommendations,
            "progression_strategy": self._generate_progression_strategy(progress, current_difficulty, recommended_difficulty)
        }
    
    async def recommend_questions(self, user_id: str, count: int = 5) -> List[Dict[str, Any]]:
        """
        Recommend personalized questions for the user.
        
        Args:
            user_id: User ID
            count: Number of questions to recommend
            
        Returns:
            List[Dict[str, Any]]: Recommended questions with reasoning
        """
        self.logger.info("Recommending questions", user_id=user_id, count=count)
        
        progress = await self.user_repo.get_user_progress(user_id)
        if not progress:
            return await self._get_beginner_recommendations(count)
        
        recommendations = []
        
        # Get weak areas for focused practice
        weak_areas = await self._identify_weak_areas(progress)
        
        # Get areas for skill building
        growth_areas = await self._identify_growth_opportunities(progress)
        
        # Get areas for challenge
        challenge_areas = await self._identify_challenge_opportunities(progress)
        
        # Distribute recommendations across different strategies
        weak_count = min(len(weak_areas), max(1, count // 2))
        growth_count = min(len(growth_areas), max(1, (count - weak_count) // 2))
        challenge_count = count - weak_count - growth_count
        
        # Add weak area recommendations
        for i, topic in enumerate(weak_areas[:weak_count]):
            skill_area = next((sa for sa in progress.skill_areas if sa.topic == topic), None)
            difficulty = self._get_remedial_difficulty(skill_area, progress.experience_level)
            
            recommendations.append({
                "topic": topic.value,
                "difficulty": difficulty.value,
                "reason": "weakness_remediation",
                "explanation": f"Focus on {topic.value} to strengthen this weak area",
                "priority": 10 - i,  # Higher priority for first weak areas
                "estimated_time": self._estimate_completion_time(difficulty, topic, progress)
            })
        
        # Add growth area recommendations
        for i, topic in enumerate(growth_areas[:growth_count]):
            skill_area = next((sa for sa in progress.skill_areas if sa.topic == topic), None)
            difficulty = self._get_growth_difficulty(skill_area, progress.experience_level)
            
            recommendations.append({
                "topic": topic.value,
                "difficulty": difficulty.value,
                "reason": "skill_building",
                "explanation": f"Build upon your {topic.value} skills with progressive challenges",
                "priority": 7 - i,
                "estimated_time": self._estimate_completion_time(difficulty, topic, progress)
            })
        
        # Add challenge area recommendations
        for i, topic in enumerate(challenge_areas[:challenge_count]):
            skill_area = next((sa for sa in progress.skill_areas if sa.topic == topic), None)
            difficulty = self._get_challenge_difficulty(skill_area, progress.experience_level)
            
            recommendations.append({
                "topic": topic.value,
                "difficulty": difficulty.value,
                "reason": "skill_advancement",
                "explanation": f"Challenge yourself with advanced {topic.value} problems",
                "priority": 5 - i,
                "estimated_time": self._estimate_completion_time(difficulty, topic, progress)
            })
        
        # Sort by priority and return
        recommendations.sort(key=lambda x: x["priority"], reverse=True)
        return recommendations[:count]
    
    async def generate_performance_insights(self, user_id: str) -> Dict[str, Any]:
        """
        Generate performance-based insights and recommendations.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict[str, Any]: Performance insights and recommendations
        """
        self.logger.info("Generating performance insights", user_id=user_id)
        
        progress = await self.user_repo.get_user_progress(user_id)
        if not progress:
            return self._get_beginner_insights()
        
        solutions = await self.solution_repo.get_solutions_by_user(user_id, limit=50)
        
        insights = {
            "performance_summary": self._analyze_overall_performance(progress),
            "learning_patterns": await self._analyze_learning_patterns(solutions),
            "skill_development": self._analyze_skill_development(progress),
            "time_management": self._analyze_time_management(progress, solutions),
            "consistency_analysis": self._analyze_consistency(solutions),
            "improvement_opportunities": await self._identify_improvement_opportunities(progress, solutions),
            "achievement_highlights": self._identify_achievements(progress),
            "next_steps": await self._generate_next_steps(progress, solutions)
        }
        
        return insights
    
    async def get_learning_path(self, user_id: str, target_level: Optional[int] = None) -> Dict[str, Any]:
        """
        Generate a structured learning path for the user.
        
        Args:
            user_id: User ID
            target_level: Target experience level (optional)
            
        Returns:
            Dict[str, Any]: Structured learning path
        """
        self.logger.info("Generating learning path", user_id=user_id, target_level=target_level)
        
        progress = await self.user_repo.get_user_progress(user_id)
        if not progress:
            return self._get_beginner_learning_path()
        
        current_level = progress.experience_level
        target = target_level or min(20, current_level + 2)
        
        # Generate milestone-based learning path
        milestones = self._generate_learning_milestones(progress, target)
        
        # Create topic progression plan
        topic_progression = self._create_topic_progression_plan(progress, target)
        
        # Estimate timeline
        timeline = self._estimate_learning_timeline(progress, target)
        
        return {
            "current_level": current_level,
            "target_level": target,
            "milestones": milestones,
            "topic_progression": topic_progression,
            "estimated_timeline": timeline,
            "success_metrics": self._define_success_metrics(target),
            "recommended_schedule": self._generate_study_schedule(progress)
        }
    
    def _determine_current_difficulty(self, progress: UserProgress) -> DifficultyLevel:
        """Determine user's current difficulty level based on performance."""
        if progress.experience_level <= 2:
            return DifficultyLevel.BEGINNER
        elif progress.experience_level <= 7:
            return DifficultyLevel.INTERMEDIATE
        else:
            return DifficultyLevel.ADVANCED
    
    def _calculate_next_difficulty(self, progress: UserProgress, current: DifficultyLevel) -> DifficultyLevel:
        """Calculate recommended next difficulty level."""
        # If success rate is high and user is performing well, suggest progression
        if progress.success_rate >= 0.8 and progress.overall_proficiency >= 7.0:
            if current == DifficultyLevel.BEGINNER:
                return DifficultyLevel.INTERMEDIATE
            elif current == DifficultyLevel.INTERMEDIATE:
                return DifficultyLevel.ADVANCED
        
        # If struggling, suggest staying at current level or stepping down
        elif progress.success_rate < 0.6:
            if current == DifficultyLevel.ADVANCED:
                return DifficultyLevel.INTERMEDIATE
            elif current == DifficultyLevel.INTERMEDIATE:
                return DifficultyLevel.BEGINNER
        
        # Otherwise, stay at current level
        return current
    
    def _assess_progression_readiness(self, progress: UserProgress) -> Dict[str, Any]:
        """Assess if user is ready to progress to next difficulty level."""
        readiness_score = 0.0
        factors = {}
        
        # Success rate factor (40% weight)
        success_factor = min(1.0, progress.success_rate / 0.8)
        readiness_score += success_factor * 0.4
        factors["success_rate"] = {"score": success_factor, "weight": 0.4}
        
        # Proficiency factor (30% weight)
        proficiency_factor = min(1.0, progress.overall_proficiency / 8.0)
        readiness_score += proficiency_factor * 0.3
        factors["proficiency"] = {"score": proficiency_factor, "weight": 0.3}
        
        # Consistency factor (20% weight)
        consistency_factor = min(1.0, progress.streak_days / 7.0)  # 7-day streak is good
        readiness_score += consistency_factor * 0.2
        factors["consistency"] = {"score": consistency_factor, "weight": 0.2}
        
        # Experience factor (10% weight)
        experience_factor = min(1.0, progress.total_questions_completed / 20.0)  # 20 questions is good foundation
        readiness_score += experience_factor * 0.1
        factors["experience"] = {"score": experience_factor, "weight": 0.1}
        
        return {
            "readiness_score": readiness_score,
            "is_ready": readiness_score >= 0.7,
            "factors": factors,
            "recommendations": self._generate_readiness_recommendations(readiness_score, factors)
        }
    
    def _get_topic_difficulty_recommendation(self, skill_area: SkillArea, experience_level: int) -> str:
        """Get difficulty recommendation for a specific topic."""
        if skill_area.proficiency_score >= 8.0:
            return DifficultyLevel.ADVANCED.value
        elif skill_area.proficiency_score >= 6.0:
            return DifficultyLevel.INTERMEDIATE.value
        else:
            return DifficultyLevel.BEGINNER.value
    
    def _generate_progression_strategy(
        self, 
        progress: UserProgress, 
        current: DifficultyLevel, 
        recommended: DifficultyLevel
    ) -> List[str]:
        """Generate progression strategy recommendations."""
        strategies = []
        
        if recommended.value > current.value:
            strategies.append("Gradually increase problem difficulty")
            strategies.append("Focus on mastering current level concepts first")
            strategies.append("Practice mixed difficulty problems to build confidence")
        elif recommended.value < current.value:
            strategies.append("Consolidate fundamental concepts")
            strategies.append("Practice easier problems to build success momentum")
            strategies.append("Review basic principles before attempting harder problems")
        else:
            strategies.append("Continue practicing at current difficulty level")
            strategies.append("Focus on improving speed and accuracy")
            strategies.append("Explore different problem types within current difficulty")
        
        return strategies
    
    async def _identify_weak_areas(self, progress: UserProgress) -> List[QuestionTopic]:
        """Identify user's weak areas for targeted practice."""
        weak_areas = []
        overall_avg = progress.overall_proficiency
        
        for skill_area in progress.skill_areas:
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
    
    async def _identify_growth_opportunities(self, progress: UserProgress) -> List[QuestionTopic]:
        """Identify areas with growth potential."""
        growth_areas = []
        
        for skill_area in progress.skill_areas:
            # Areas with moderate proficiency that can be improved
            if 5.0 <= skill_area.proficiency_score < 7.5:
                growth_areas.append(skill_area.topic)
        
        # Add topics not yet attempted
        attempted_topics = {sa.topic for sa in progress.skill_areas}
        for topic in QuestionTopic:
            if topic not in attempted_topics:
                growth_areas.append(topic)
        
        return growth_areas
    
    async def _identify_challenge_opportunities(self, progress: UserProgress) -> List[QuestionTopic]:
        """Identify areas where user can be challenged."""
        challenge_areas = []
        
        for skill_area in progress.skill_areas:
            # Areas with high proficiency that can handle challenges
            if skill_area.proficiency_score >= 7.5:
                challenge_areas.append(skill_area.topic)
        
        return challenge_areas
    
    def _get_remedial_difficulty(self, skill_area: Optional[SkillArea], experience_level: int) -> DifficultyLevel:
        """Get difficulty level for remedial practice."""
        if not skill_area or skill_area.proficiency_score < 3.0:
            return DifficultyLevel.BEGINNER
        elif skill_area.proficiency_score < 5.0:
            return DifficultyLevel.BEGINNER if experience_level <= 3 else DifficultyLevel.INTERMEDIATE
        else:
            return DifficultyLevel.INTERMEDIATE
    
    def _get_growth_difficulty(self, skill_area: Optional[SkillArea], experience_level: int) -> DifficultyLevel:
        """Get difficulty level for skill building."""
        if not skill_area:
            # New topic - start based on experience
            if experience_level <= 2:
                return DifficultyLevel.BEGINNER
            elif experience_level <= 7:
                return DifficultyLevel.INTERMEDIATE
            else:
                return DifficultyLevel.ADVANCED
        
        # Existing topic - progress based on current proficiency
        if skill_area.proficiency_score < 6.0:
            return DifficultyLevel.INTERMEDIATE
        else:
            return DifficultyLevel.ADVANCED
    
    def _get_challenge_difficulty(self, skill_area: Optional[SkillArea], experience_level: int) -> DifficultyLevel:
        """Get difficulty level for challenging practice."""
        return DifficultyLevel.ADVANCED
    
    def _estimate_completion_time(self, difficulty: DifficultyLevel, topic: QuestionTopic, progress: UserProgress) -> int:
        """Estimate completion time in minutes."""
        base_times = {
            DifficultyLevel.BEGINNER: 15,
            DifficultyLevel.INTERMEDIATE: 25,
            DifficultyLevel.ADVANCED: 40
        }
        
        base_time = base_times[difficulty]
        
        # Adjust based on user's average completion time
        if progress.average_completion_time > 0:
            user_factor = progress.average_completion_time / 20.0  # 20 min baseline
            base_time = int(base_time * user_factor)
        
        return max(10, min(60, base_time))  # Clamp between 10-60 minutes
    
    def _analyze_overall_performance(self, progress: UserProgress) -> Dict[str, Any]:
        """Analyze overall performance metrics."""
        return {
            "success_rate": progress.success_rate,
            "proficiency_level": progress.overall_proficiency,
            "questions_completed": progress.total_questions_completed,
            "consistency": progress.streak_days,
            "performance_grade": self._calculate_performance_grade(progress)
        }
    
    async def _analyze_learning_patterns(self, solutions: List[Solution]) -> Dict[str, Any]:
        """Analyze learning patterns from solution history."""
        if not solutions:
            return {"insufficient_data": True}
        
        # Analyze time patterns
        hour_performance = defaultdict(list)
        for solution in solutions:
            hour = solution.submitted_at.hour
            is_success = (
                solution.execution_result and 
                solution.execution_result.validation_result and 
                solution.execution_result.validation_result.is_correct
            )
            hour_performance[hour].append(1.0 if is_success else 0.0)
        
        best_hours = []
        for hour, performances in hour_performance.items():
            if len(performances) >= 2:
                avg_performance = statistics.mean(performances)
                best_hours.append((hour, avg_performance))
        
        best_hours.sort(key=lambda x: x[1], reverse=True)
        
        return {
            "peak_performance_hours": [hour for hour, _ in best_hours[:3]],
            "session_patterns": self._analyze_session_patterns(solutions),
            "learning_velocity": self._calculate_learning_velocity(solutions)
        }
    
    def _analyze_skill_development(self, progress: UserProgress) -> Dict[str, Any]:
        """Analyze skill development across topics."""
        skill_analysis = {}
        
        for skill_area in progress.skill_areas:
            skill_analysis[skill_area.topic.value] = {
                "proficiency": skill_area.proficiency_score,
                "progress_rate": self._calculate_skill_progress_rate(skill_area),
                "mastery_level": self._assess_mastery_level(skill_area),
                "next_milestone": self._get_next_skill_milestone(skill_area)
            }
        
        return skill_analysis
    
    def _analyze_time_management(self, progress: UserProgress, solutions: List[Solution]) -> Dict[str, Any]:
        """Analyze time management patterns."""
        if not solutions:
            return {"insufficient_data": True}
        
        completion_times = []
        for solution in solutions:
            if solution.execution_result:
                completion_times.append(solution.execution_result.execution_time / 60.0)  # Convert to minutes
        
        if not completion_times:
            return {"insufficient_data": True}
        
        return {
            "average_time": statistics.mean(completion_times),
            "time_consistency": 1.0 - (statistics.stdev(completion_times) / statistics.mean(completion_times)) if statistics.mean(completion_times) > 0 else 0.0,
            "time_trend": self._calculate_time_trend(completion_times),
            "efficiency_score": self._calculate_efficiency_score(progress, completion_times)
        }
    
    def _analyze_consistency(self, solutions: List[Solution]) -> Dict[str, Any]:
        """Analyze learning consistency."""
        if len(solutions) < 5:
            return {"insufficient_data": True}
        
        # Group by day
        daily_activity = defaultdict(int)
        for solution in solutions:
            date_key = solution.submitted_at.strftime("%Y-%m-%d")
            daily_activity[date_key] += 1
        
        activity_counts = list(daily_activity.values())
        
        return {
            "consistency_score": self._calculate_consistency_score(activity_counts),
            "active_days": len(daily_activity),
            "average_daily_problems": statistics.mean(activity_counts) if activity_counts else 0,
            "regularity_pattern": self._assess_regularity_pattern(daily_activity)
        }
    
    async def _identify_improvement_opportunities(self, progress: UserProgress, solutions: List[Solution]) -> List[Dict[str, Any]]:
        """Identify specific improvement opportunities."""
        opportunities = []
        
        # Analyze error patterns
        if solutions:
            error_patterns = self._analyze_error_patterns(solutions)
            for error_type, frequency in error_patterns.items():
                if frequency > 0.2:  # More than 20% of errors
                    opportunities.append({
                        "type": "error_reduction",
                        "area": error_type,
                        "impact": "high",
                        "recommendation": f"Focus on reducing {error_type} errors through targeted practice"
                    })
        
        # Analyze skill gaps
        weak_areas = await self._identify_weak_areas(progress)
        for topic in weak_areas:
            opportunities.append({
                "type": "skill_development",
                "area": topic.value,
                "impact": "medium",
                "recommendation": f"Strengthen {topic.value} skills with focused practice"
            })
        
        # Analyze time management
        if progress.average_completion_time > 30:
            opportunities.append({
                "type": "efficiency",
                "area": "time_management",
                "impact": "medium",
                "recommendation": "Work on solving problems more efficiently"
            })
        
        return opportunities
    
    def _identify_achievements(self, progress: UserProgress) -> List[Dict[str, Any]]:
        """Identify user achievements and milestones."""
        achievements = []
        
        # Success rate achievements
        if progress.success_rate >= 0.9:
            achievements.append({"type": "excellence", "description": "Exceptional success rate (90%+)"})
        elif progress.success_rate >= 0.8:
            achievements.append({"type": "proficiency", "description": "High success rate (80%+)"})
        
        # Proficiency achievements
        if progress.overall_proficiency >= 8.0:
            achievements.append({"type": "mastery", "description": "High overall proficiency"})
        
        # Consistency achievements
        if progress.streak_days >= 7:
            achievements.append({"type": "consistency", "description": f"{progress.streak_days}-day learning streak"})
        
        # Volume achievements
        if progress.total_questions_completed >= 50:
            achievements.append({"type": "dedication", "description": f"Completed {progress.total_questions_completed} questions"})
        
        return achievements
    
    async def _generate_next_steps(self, progress: UserProgress, solutions: List[Solution]) -> List[str]:
        """Generate specific next steps for the user."""
        next_steps = []
        
        # Based on weak areas
        weak_areas = await self._identify_weak_areas(progress)
        if weak_areas:
            next_steps.append(f"Focus on strengthening {weak_areas[0].value} skills")
        
        # Based on progression readiness
        readiness = self._assess_progression_readiness(progress)
        if readiness["is_ready"]:
            next_steps.append("Consider advancing to more challenging problems")
        else:
            next_steps.append("Continue building proficiency at current level")
        
        # Based on consistency
        if progress.streak_days < 3:
            next_steps.append("Establish a regular practice schedule")
        
        # Based on performance
        if progress.success_rate < 0.7:
            next_steps.append("Review fundamental concepts before attempting new problems")
        
        return next_steps[:5]  # Limit to top 5 next steps
    
    def _get_beginner_progression(self) -> Dict[str, Any]:
        """Get progression recommendations for beginners."""
        return {
            "current_difficulty": DifficultyLevel.BEGINNER.value,
            "recommended_difficulty": DifficultyLevel.BEGINNER.value,
            "progression_readiness": {"readiness_score": 0.0, "is_ready": False},
            "topic_specific_difficulties": {topic.value: DifficultyLevel.BEGINNER.value for topic in QuestionTopic},
            "progression_strategy": [
                "Start with basic transformation problems",
                "Master fundamental PySpark concepts",
                "Build confidence with simple exercises"
            ]
        }
    
    async def _get_beginner_recommendations(self, count: int) -> List[Dict[str, Any]]:
        """Get question recommendations for beginners."""
        beginner_topics = [
            QuestionTopic.TRANSFORMATIONS,
            QuestionTopic.AGGREGATIONS,
            QuestionTopic.JOINS,
            QuestionTopic.DATA_QUALITY
        ]
        
        recommendations = []
        for i, topic in enumerate(beginner_topics[:count]):
            recommendations.append({
                "topic": topic.value,
                "difficulty": DifficultyLevel.BEGINNER.value,
                "reason": "beginner_foundation",
                "explanation": f"Build foundational skills in {topic.value}",
                "priority": 10 - i,
                "estimated_time": 15
            })
        
        return recommendations
    
    def _get_beginner_insights(self) -> Dict[str, Any]:
        """Get performance insights for beginners."""
        return {
            "performance_summary": {
                "success_rate": 0.0,
                "proficiency_level": 0.0,
                "questions_completed": 0,
                "consistency": 0,
                "performance_grade": "Getting Started"
            },
            "learning_patterns": {"insufficient_data": True},
            "skill_development": {},
            "time_management": {"insufficient_data": True},
            "consistency_analysis": {"insufficient_data": True},
            "improvement_opportunities": [
                {
                    "type": "foundation_building",
                    "area": "basic_concepts",
                    "impact": "high",
                    "recommendation": "Start with fundamental PySpark concepts"
                }
            ],
            "achievement_highlights": [],
            "next_steps": [
                "Complete your first PySpark problem",
                "Learn basic DataFrame operations",
                "Practice data transformations"
            ]
        }
    
    def _get_beginner_learning_path(self) -> Dict[str, Any]:
        """Get learning path for beginners."""
        return {
            "current_level": 0,
            "target_level": 2,
            "milestones": [
                {"level": 1, "description": "Complete 5 basic transformation problems"},
                {"level": 2, "description": "Master fundamental PySpark operations"}
            ],
            "topic_progression": {
                "week_1": [QuestionTopic.TRANSFORMATIONS.value],
                "week_2": [QuestionTopic.AGGREGATIONS.value],
                "week_3": [QuestionTopic.JOINS.value],
                "week_4": [QuestionTopic.DATA_QUALITY.value]
            },
            "estimated_timeline": "4 weeks",
            "success_metrics": ["70% success rate", "Complete 20 problems"],
            "recommended_schedule": "3-4 problems per week"
        }
    
    # Helper methods for calculations
    def _calculate_performance_grade(self, progress: UserProgress) -> str:
        """Calculate overall performance grade."""
        score = (progress.success_rate * 0.4 + 
                progress.overall_proficiency / 10.0 * 0.4 + 
                min(1.0, progress.total_questions_completed / 50.0) * 0.2)
        
        if score >= 0.9:
            return "Excellent"
        elif score >= 0.8:
            return "Very Good"
        elif score >= 0.7:
            return "Good"
        elif score >= 0.6:
            return "Satisfactory"
        else:
            return "Needs Improvement"
    
    def _calculate_skill_progress_rate(self, skill_area: SkillArea) -> float:
        """Calculate progress rate for a skill area."""
        if skill_area.questions_attempted == 0:
            return 0.0
        
        # Simple progress rate based on success ratio and proficiency
        success_rate = skill_area.questions_completed / skill_area.questions_attempted
        return (success_rate + skill_area.proficiency_score / 10.0) / 2.0
    
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
    
    def _calculate_time_trend(self, completion_times: List[float]) -> str:
        """Calculate time trend (improving, stable, declining)."""
        if len(completion_times) < 3:
            return "insufficient_data"
        
        # Compare recent vs earlier times
        recent_avg = statistics.mean(completion_times[-5:])
        earlier_avg = statistics.mean(completion_times[:5])
        
        if recent_avg < earlier_avg * 0.9:
            return "improving"
        elif recent_avg > earlier_avg * 1.1:
            return "declining"
        else:
            return "stable"
    
    def _calculate_efficiency_score(self, progress: UserProgress, completion_times: List[float]) -> float:
        """Calculate efficiency score based on time and success rate."""
        if not completion_times:
            return 0.0
        
        avg_time = statistics.mean(completion_times)
        # Efficiency = success rate / normalized time
        normalized_time = min(2.0, avg_time / 20.0)  # 20 min baseline
        
        return progress.success_rate / normalized_time if normalized_time > 0 else 0.0
    
    def _calculate_consistency_score(self, activity_counts: List[int]) -> float:
        """Calculate consistency score."""
        if not activity_counts:
            return 0.0
        
        mean_activity = statistics.mean(activity_counts)
        if mean_activity == 0:
            return 0.0
        
        try:
            cv = statistics.stdev(activity_counts) / mean_activity
            return max(0.0, 1.0 - cv)  # Lower coefficient of variation = higher consistency
        except statistics.StatisticsError:
            return 0.0
    
    def _assess_regularity_pattern(self, daily_activity: Dict[str, int]) -> str:
        """Assess regularity pattern of learning."""
        if len(daily_activity) < 7:
            return "insufficient_data"
        
        # Analyze gaps between active days
        dates = sorted(daily_activity.keys())
        gaps = []
        
        for i in range(1, len(dates)):
            prev_date = datetime.strptime(dates[i-1], "%Y-%m-%d")
            curr_date = datetime.strptime(dates[i], "%Y-%m-%d")
            gap = (curr_date - prev_date).days
            gaps.append(gap)
        
        if not gaps:
            return "single_session"
        
        avg_gap = statistics.mean(gaps)
        
        if avg_gap <= 1.5:
            return "daily"
        elif avg_gap <= 3:
            return "frequent"
        elif avg_gap <= 7:
            return "weekly"
        else:
            return "irregular"
    
    def _analyze_error_patterns(self, solutions: List[Solution]) -> Dict[str, float]:
        """Analyze common error patterns."""
        error_counts = defaultdict(int)
        total_errors = 0
        
        for solution in solutions:
            if (solution.execution_result and 
                solution.execution_result.error_message):
                total_errors += 1
                error_msg = solution.execution_result.error_message.lower()
                
                if "syntax" in error_msg:
                    error_counts["syntax_errors"] += 1
                elif "type" in error_msg:
                    error_counts["type_errors"] += 1
                elif "name" in error_msg:
                    error_counts["name_errors"] += 1
                elif "attribute" in error_msg:
                    error_counts["attribute_errors"] += 1
                else:
                    error_counts["other_errors"] += 1
        
        if total_errors == 0:
            return {}
        
        # Convert to percentages
        return {
            error_type: count / total_errors
            for error_type, count in error_counts.items()
        }
    
    def _analyze_session_patterns(self, solutions: List[Solution]) -> Dict[str, Any]:
        """Analyze session patterns."""
        daily_sessions = defaultdict(list)
        
        for solution in solutions:
            date_key = solution.submitted_at.strftime("%Y-%m-%d")
            daily_sessions[date_key].append(solution)
        
        session_lengths = [len(solutions) for solutions in daily_sessions.values()]
        
        if not session_lengths:
            return {"insufficient_data": True}
        
        return {
            "average_session_length": statistics.mean(session_lengths),
            "session_consistency": self._calculate_consistency_score(session_lengths),
            "preferred_session_length": statistics.mode(session_lengths) if len(set(session_lengths)) < len(session_lengths) else statistics.median(session_lengths)
        }
    
    def _calculate_learning_velocity(self, solutions: List[Solution]) -> Dict[str, float]:
        """Calculate learning velocity metrics."""
        if len(solutions) < 5:
            return {"insufficient_data": True}
        
        # Calculate success rate over time
        success_rates = []
        window_size = 5
        
        for i in range(window_size, len(solutions)):
            window = solutions[i-window_size:i]
            successes = sum(
                1 for s in window
                if (s.execution_result and 
                    s.execution_result.validation_result and 
                    s.execution_result.validation_result.is_correct)
            )
            success_rates.append(successes / window_size)
        
        if len(success_rates) < 2:
            return {"insufficient_data": True}
        
        # Calculate trend
        try:
            x_values = list(range(len(success_rates)))
            correlation = statistics.correlation(x_values, success_rates)
            return {"learning_velocity": correlation}
        except statistics.StatisticsError:
            return {"learning_velocity": 0.0}
    
    def _generate_readiness_recommendations(self, readiness_score: float, factors: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on readiness assessment."""
        recommendations = []
        
        if readiness_score >= 0.7:
            recommendations.append("You're ready to advance to the next difficulty level")
        else:
            # Identify weakest factors
            weak_factors = [
                name for name, data in factors.items()
                if data["score"] < 0.6
            ]
            
            for factor in weak_factors:
                if factor == "success_rate":
                    recommendations.append("Focus on improving your success rate before advancing")
                elif factor == "proficiency":
                    recommendations.append("Build stronger proficiency in current topics")
                elif factor == "consistency":
                    recommendations.append("Establish more consistent practice habits")
                elif factor == "experience":
                    recommendations.append("Complete more problems to build experience")
        
        return recommendations
    
    def _generate_learning_milestones(self, progress: UserProgress, target_level: int) -> List[Dict[str, Any]]:
        """Generate learning milestones."""
        milestones = []
        current_level = progress.experience_level
        
        for level in range(current_level + 1, target_level + 1):
            if level <= 2:
                milestones.append({
                    "level": level,
                    "description": f"Master basic PySpark operations (Level {level})",
                    "requirements": ["70% success rate", "Complete 10 beginner problems"]
                })
            elif level <= 7:
                milestones.append({
                    "level": level,
                    "description": f"Develop intermediate data engineering skills (Level {level})",
                    "requirements": ["75% success rate", "Complete 15 intermediate problems"]
                })
            else:
                milestones.append({
                    "level": level,
                    "description": f"Master advanced PySpark techniques (Level {level})",
                    "requirements": ["80% success rate", "Complete 10 advanced problems"]
                })
        
        return milestones
    
    def _create_topic_progression_plan(self, progress: UserProgress, target_level: int) -> Dict[str, List[str]]:
        """Create topic progression plan."""
        plan = {}
        
        if target_level <= 2:
            plan["foundation"] = [
                QuestionTopic.TRANSFORMATIONS.value,
                QuestionTopic.AGGREGATIONS.value
            ]
        elif target_level <= 7:
            plan["intermediate"] = [
                QuestionTopic.JOINS.value,
                QuestionTopic.WINDOW_FUNCTIONS.value,
                QuestionTopic.DATA_QUALITY.value
            ]
        else:
            plan["advanced"] = [
                QuestionTopic.PERFORMANCE_OPTIMIZATION.value,
                QuestionTopic.STREAMING.value
            ]
        
        return plan
    
    def _estimate_learning_timeline(self, progress: UserProgress, target_level: int) -> str:
        """Estimate learning timeline."""
        current_level = progress.experience_level
        level_diff = target_level - current_level
        
        # Estimate based on current progress rate
        if progress.total_questions_completed > 0:
            # Assume 1 level per 20 questions
            questions_needed = level_diff * 20
            current_rate = progress.total_questions_completed / max(1, progress.streak_days)
            weeks_needed = max(1, questions_needed / (current_rate * 7))
            return f"{int(weeks_needed)} weeks"
        else:
            # Default estimate
            return f"{level_diff * 4} weeks"
    
    def _define_success_metrics(self, target_level: int) -> List[str]:
        """Define success metrics for target level."""
        if target_level <= 2:
            return ["70% success rate", "Complete 20 problems", "Master 3 topics"]
        elif target_level <= 7:
            return ["75% success rate", "Complete 50 problems", "Master 5 topics"]
        else:
            return ["80% success rate", "Complete 100 problems", "Master all topics"]
    
    def _generate_study_schedule(self, progress: UserProgress) -> Dict[str, Any]:
        """Generate recommended study schedule."""
        # Base recommendation on current activity level
        if progress.total_questions_completed < 10:
            return {
                "frequency": "3-4 times per week",
                "session_length": "30-45 minutes",
                "problems_per_session": "2-3",
                "focus": "Building foundation"
            }
        elif progress.total_questions_completed < 50:
            return {
                "frequency": "4-5 times per week",
                "session_length": "45-60 minutes",
                "problems_per_session": "3-4",
                "focus": "Skill development"
            }
        else:
            return {
                "frequency": "5-6 times per week",
                "session_length": "60-90 minutes",
                "problems_per_session": "4-6",
                "focus": "Mastery and challenge"
            }
    
    async def _generate_weekly_study_plan(self, weeks: int) -> Dict[str, Any]:
        """Generate weekly breakdown for study plan."""
        weekly_plan = {}
        
        topics = list(QuestionTopic)
        topics_per_week = max(1, len(topics) // weeks)
        
        for week in range(1, weeks + 1):
            start_idx = (week - 1) * topics_per_week
            end_idx = min(start_idx + topics_per_week, len(topics))
            week_topics = topics[start_idx:end_idx]
            
            weekly_plan[f"week_{week}"] = {
                "topics": [topic.value for topic in week_topics],
                "recommended_problems": 5,
                "focus": "Build proficiency" if week <= weeks // 2 else "Apply knowledge"
            }
        
        return weekly_plan