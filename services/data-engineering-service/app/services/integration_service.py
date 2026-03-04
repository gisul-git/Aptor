"""
Integration service that orchestrates the complete data flow from question generation to result display.
This service wires together all components: AI services, execution engine, validation, and data persistence.
"""

import asyncio
import structlog
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import uuid

from app.models.question import Question, QuestionDifficulty
from app.models.execution import ExecutionResult, ExecutionStatus, ExecutionMode
from app.models.user import UserProgress, Solution
from app.services.question_generator import QuestionGeneratorService
from app.services.execution_engine import ExecutionEngine
from app.services.validation_engine import ValidationEngine
from app.services.code_reviewer import CodeReviewer
from app.services.progress_analytics import ProgressAnalyticsService
from app.services.recommendation_engine import RecommendationEngine
from app.services.cache_manager import IntelligentCacheManager
from app.services.auto_scaler import AutoScaler
from app.services.cost_optimizer import CostOptimizationService
from app.repositories.question_repository import QuestionRepository
from app.repositories.solution_repository import SolutionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.execution_repository import ExecutionRepository
from app.core.redis_client import get_redis

logger = structlog.get_logger()


class IntegrationService:
    """
    Central service that orchestrates the complete platform workflow.
    Manages the integration between all system components.
    """
    
    def __init__(
        self,
        question_generator: Optional[QuestionGeneratorService],
        execution_engine: Optional[ExecutionEngine],
        validation_engine: Optional[ValidationEngine],
        code_reviewer: Optional[CodeReviewer],
        progress_analytics: Optional[ProgressAnalyticsService],
        recommendation_engine: Optional[RecommendationEngine],
        cache_manager: Optional[IntelligentCacheManager],
        auto_scaler: Optional[AutoScaler],
        cost_optimizer: Optional[CostOptimizationService],
        question_repo: Optional[QuestionRepository],
        solution_repo: Optional[SolutionRepository],
        user_repo: Optional[UserRepository],
        execution_repo: Optional[ExecutionRepository]
    ):
        self.question_generator = question_generator
        self.execution_engine = execution_engine
        self.validation_engine = validation_engine
        self.code_reviewer = code_reviewer
        self.progress_analytics = progress_analytics
        self.recommendation_engine = recommendation_engine
        self.cache_manager = cache_manager
        self.auto_scaler = auto_scaler
        self.cost_optimizer = cost_optimizer
        
        self.question_repo = question_repo
        self.solution_repo = solution_repo
        self.user_repo = user_repo
        self.execution_repo = execution_repo
        
        self._redis = None
    
    async def _get_redis(self):
        """Get Redis client instance."""
        if not self._redis:
            self._redis = await get_redis()
        return self._redis
    
    async def generate_personalized_question(
        self, 
        user_id: str, 
        experience_level: int,
        topic: Optional[str] = None
    ) -> Question:
        """
        Generate a personalized question based on user progress and preferences.
        Integrates AI generation with user analytics and caching.
        """
        logger.info(
            "Generating personalized question",
            user_id=user_id,
            experience_level=experience_level,
            topic=topic
        )
        
        try:
            # Check if required services are available
            if not self.question_generator:
                raise RuntimeError("Question generator service not available")
            if not self.question_repo:
                raise RuntimeError("Question repository not available")
            
            # Get user progress for personalization (optional)
            user_progress = None
            if self.user_repo:
                try:
                    user_progress = await self.user_repo.get_user_progress(user_id)
                except Exception as e:
                    logger.warning("Failed to get user progress", error=str(e))
            
            # Get recommendations for topic selection (optional)
            if not topic and user_progress and self.recommendation_engine:
                try:
                    recommendations = await self.recommendation_engine.get_recommendations(user_progress)
                    # Use the highest priority skill focus recommendation
                    skill_recommendations = [r for r in recommendations if r.get('type') == 'skill_focus']
                    if skill_recommendations:
                        topic = skill_recommendations[0].get('skill_area', '').lower().replace(' ', '_')
                except Exception as e:
                    logger.warning("Failed to get recommendations", error=str(e))
            
            # DISABLED: Check cache first to ensure unique questions every time
            # cached_question = None
            # if self.cache_manager:
            #     try:
            #         cache_key = f"question:{user_id}:{experience_level}:{topic or 'any'}"
            #         cached_question = await self.cache_manager.get(cache_key)
            #         if cached_question:
            #             logger.info("Returning cached question", cache_key=cache_key)
            #             return Question.parse_obj(cached_question)
            #     except Exception as e:
            #         logger.warning("Failed to check cache", error=str(e))
            
            # Generate new question
            question = await self.question_generator.generate_question(
                user_id=user_id,
                experience_level=experience_level,
                topic=topic
            )
            
            # Store in database
            await self.question_repo.create_question(question)
            
            # DISABLED: Cache the question to ensure unique questions every time
            # if self.cache_manager:
            #     try:
            #         cache_key = f"question:{user_id}:{experience_level}:{topic or 'any'}"
            #         await self.cache_manager.set(
            #             cache_key, 
            #             question.dict(), 
            #             ttl=timedelta(hours=1)
            #         )
            #     except Exception as e:
            #         logger.warning("Failed to cache question", error=str(e))
            
            # Update cost tracking (optional)
            if self.cost_optimizer:
                try:
                    pass  # await self.cost_optimizer.track_ai_usage("question_generation", user_id)
                except Exception as e:
                    logger.warning("Failed to track AI usage", error=str(e))
            
            logger.info("Generated personalized question", question_id=question.id)
            return question
            
        except Exception as e:
            logger.error("Failed to generate personalized question", error=str(e), exc_info=True)
            raise
    
    async def execute_solution(
        self,
        user_id: str,
        question_id: str,
        code: str,
        mode: ExecutionMode,
        async_execution: bool = False
    ) -> ExecutionResult:
        """
        Execute user solution with complete workflow integration.
        Handles execution, validation, AI review, and progress tracking.
        
        Args:
            user_id: User identifier
            question_id: Question identifier
            code: User's code to execute
            mode: Execution mode (TEST or SUBMIT)
            async_execution: If True, execute in background and return immediately with PENDING status.
                           If False, wait for execution to complete before returning.
        """
        execution_id = str(uuid.uuid4())
        
        logger.info(
            "Starting solution execution",
            execution_id=execution_id,
            user_id=user_id,
            question_id=question_id,
            mode=mode.value,
            async_execution=async_execution
        )
        
        try:
            # Check if required services are available
            if not self.question_repo:
                raise RuntimeError("Question repository not available")
            if not self.execution_repo:
                raise RuntimeError("Execution repository not available")
            if not self.execution_engine:
                raise RuntimeError("Execution engine not available")
            
            # Get question details
            question = await self.question_repo.get_question_by_id(question_id)
            if not question:
                raise ValueError(f"Question {question_id} not found")
            
            # Check resource availability and scale if needed (optional)
            if self.auto_scaler:
                try:
                    if hasattr(self.auto_scaler, 'ensure_capacity'):
                        await self.auto_scaler.ensure_capacity()
                    else:
                        logger.debug("AutoScaler does not have ensure_capacity method")
                except Exception as e:
                    logger.warning("Failed to ensure capacity", error=str(e))
            
            # Create execution record
            execution_result = ExecutionResult(
                job_id=execution_id,
                user_id=user_id,
                question_id=question_id,
                code=code,
                mode=mode,
                status=ExecutionStatus.PENDING,
                execution_time=0.0,  # Will be updated after execution
                memory_usage=0.0,    # Will be updated after execution
                created_at=datetime.utcnow()
            )
            
            await self.execution_repo.create_execution_result(execution_result)
            
            if async_execution:
                # Execute in background for async processing
                asyncio.create_task(self._process_execution(execution_result, question))
                return execution_result
            else:
                # Execute synchronously and wait for completion
                await self._process_execution(execution_result, question)
                # Reload the updated execution result from database
                updated_result = await self.execution_repo.get_execution_result_by_job_id(execution_id)
                return updated_result if updated_result else execution_result
            
        except Exception as e:
            logger.error("Failed to start solution execution", error=str(e), exc_info=True)
            raise
    
    async def _process_execution(self, execution_result: ExecutionResult, question: Question):
        """
        Process the complete execution workflow in background.
        """
        try:
            # Update status to running
            execution_result.status = ExecutionStatus.RUNNING
            execution_result.started_at = datetime.utcnow()
            await self.execution_repo.update_execution_result(
                execution_result.job_id,
                {
                    "status": execution_result.status.value,
                    "started_at": execution_result.started_at
                }
            )
            
            # Execute code
            logger.info("Executing code", job_id=execution_result.job_id)
            exec_output = await self.execution_engine.execute_code(
                code=execution_result.code,
                question_id=execution_result.question_id,
                mode=execution_result.mode.value,
                user_id=execution_result.user_id
            )
            
            # Merge the execution engine result with our execution result
            execution_result.output = exec_output.output
            execution_result.error_message = exec_output.error_message
            execution_result.execution_time = exec_output.execution_time
            execution_result.memory_usage = exec_output.memory_usage
            execution_result.status = exec_output.status
            if exec_output.completed_at:
                execution_result.completed_at = exec_output.completed_at
            
            # Validate output (only if execution was successful)
            validation_result = None
            if execution_result.status == ExecutionStatus.COMPLETED and self.validation_engine:
                try:
                    logger.info("Validating output", job_id=execution_result.job_id)
                    validation_result = await self.validation_engine.validate_output(
                        actual_output=execution_result.output,
                        expected_output=question.expected_output,
                        question=question
                    )
                    execution_result.validation_result = validation_result
                except Exception as e:
                    logger.warning("Validation failed", error=str(e), job_id=execution_result.job_id)
            
            # Update execution result fields that weren't set by the execution engine
            # (The execution engine result might not have all the fields we need)
            
            # AI code review for submit mode
            # Provide AI review regardless of correctness - users need feedback on incorrect solutions too
            if (execution_result.mode == ExecutionMode.SUBMIT and 
                validation_result and 
                self.code_reviewer):
                logger.info("Starting AI code review", 
                           job_id=execution_result.job_id,
                           is_correct=validation_result.is_correct)
                try:
                    code_review = await self.code_reviewer.review_solution(
                        user_id=execution_result.user_id,
                        code=execution_result.code,
                        question_title=question.title,
                        question_description=question.description,
                        execution_result=execution_result,
                        question_difficulty=question.difficulty_level.name if hasattr(question, 'difficulty_level') else None,
                        question_topic=question.topic.value if hasattr(question, 'topic') else None
                    )
                    execution_result.ai_review = code_review
                    logger.info("AI code review completed", 
                               job_id=execution_result.job_id,
                               overall_score=code_review.overall_score)
                    
                    # Track AI usage for cost optimization
                    if self.cost_optimizer:
                        try:
                            pass  # await self.cost_optimizer.track_ai_usage("code_review", execution_result.user_id)
                        except Exception as e:
                            logger.warning("Failed to track AI usage", error=str(e))
                    
                except Exception as e:
                    logger.error("AI code review failed", error=str(e), job_id=execution_result.job_id)
                    # Continue without review rather than failing the entire execution
            
            # Determine final status (if not already set by execution engine)
            if execution_result.status == ExecutionStatus.RUNNING:
                if execution_result.error_message:
                    execution_result.status = ExecutionStatus.FAILED
                elif validation_result and validation_result.is_correct:
                    execution_result.status = ExecutionStatus.COMPLETED
                else:
                    execution_result.status = ExecutionStatus.COMPLETED  # Completed but incorrect
            
            if not execution_result.completed_at:
                execution_result.completed_at = datetime.utcnow()
            
            # Update execution record
            await self.execution_repo.update_execution_result(
                execution_result.job_id,
                {
                    "status": execution_result.status.value,
                    "output": execution_result.output,
                    "error_message": execution_result.error_message,
                    "execution_time": execution_result.execution_time,
                    "memory_usage": execution_result.memory_usage,
                    "validation_result": execution_result.validation_result.model_dump() if execution_result.validation_result else None,
                    "ai_review": execution_result.ai_review.model_dump() if execution_result.ai_review else None,
                    "completed_at": execution_result.completed_at
                }
            )
            
            # Create solution record for submit mode
            if execution_result.mode == ExecutionMode.SUBMIT and self.solution_repo:
                try:
                    solution = Solution(
                        id=str(uuid.uuid4()),
                        user_id=execution_result.user_id,
                        question_id=execution_result.question_id,
                        code=execution_result.code,
                        execution_result=execution_result,
                        ai_review=execution_result.ai_review,
                        submitted_at=datetime.utcnow(),
                        is_correct=validation_result.is_correct if validation_result and hasattr(validation_result, 'is_correct') else False
                    )
                    
                    await self.solution_repo.create_solution(solution)
                    
                    # Update user progress
                    if self.user_repo and self.progress_analytics:
                        try:
                            await self._update_user_progress(
                                execution_result.user_id,
                                question,
                                execution_result,
                                validation_result.is_correct if validation_result and hasattr(validation_result, 'is_correct') else False
                            )
                        except Exception as e:
                            logger.warning("Failed to update user progress", error=str(e))
                except Exception as e:
                    logger.warning("Failed to create solution record", error=str(e))
            
            # Optimize resources (optional)
            if self.cost_optimizer:
                try:
                    if hasattr(self.cost_optimizer, 'cleanup_idle_resources'):
                        await self.cost_optimizer.cleanup_idle_resources()
                    else:
                        logger.debug("CostOptimizationService does not have cleanup_idle_resources method")
                except Exception as e:
                    logger.warning("Failed to cleanup idle resources", error=str(e))
            
            logger.info(
                "Execution completed successfully",
                job_id=execution_result.job_id,
                status=execution_result.status.value,
                is_correct=validation_result.is_correct if validation_result and hasattr(validation_result, 'is_correct') else False
            )
            
        except Exception as e:
            logger.error("Execution processing failed", error=str(e), job_id=execution_result.job_id, exc_info=True)
            
            # Update execution with error
            execution_result.status = ExecutionStatus.FAILED
            execution_result.error_message = str(e)
            execution_result.completed_at = datetime.utcnow()
            await self.execution_repo.update_execution_result(
                execution_result.job_id,
                {
                    "status": execution_result.status.value,
                    "error_message": execution_result.error_message,
                    "completed_at": execution_result.completed_at
                }
            )
    
    async def _update_user_progress(
        self,
        user_id: str,
        question: Question,
        execution_result: ExecutionResult,
        is_correct: bool
    ):
        """Update user progress based on solution submission."""
        try:
            # Get current progress
            user_progress = await self.user_repo.get_user_progress(user_id)
            if not user_progress:
                # Create new progress record
                user_progress = UserProgress(
                    user_id=user_id,
                    experience_level=1,
                    completed_questions=[],
                    success_rate=0.0,
                    average_completion_time=0.0,
                    skill_areas={},
                    last_activity=datetime.utcnow(),
                    preferences={}
                )
            
            # Update progress using analytics service
            updated_progress = await self.progress_analytics.update_progress(
                user_progress=user_progress,
                question=question,
                execution_time=execution_result.execution_time,
                is_correct=is_correct
            )
            
            # Save updated progress
            await self.user_repo.update_user_progress(updated_progress)
            
            # Invalidate cached recommendations
            cache_key = f"recommendations:{user_id}"
            await self.cache_manager.delete(cache_key)
            
            logger.info("Updated user progress", user_id=user_id, is_correct=is_correct)
            
        except Exception as e:
            logger.error("Failed to update user progress", error=str(e), user_id=user_id, exc_info=True)
    
    async def get_execution_status(self, job_id: str) -> Optional[ExecutionResult]:
        """Get current execution status."""
        try:
            return await self.execution_repo.get_execution_result_by_job_id(job_id)
        except Exception as e:
            logger.error("Failed to get execution status", error=str(e), job_id=job_id)
            return None
    
    async def get_user_dashboard_data(self, user_id: str) -> Dict[str, Any]:
        """
        Get comprehensive dashboard data for a user.
        Integrates progress, recommendations, and analytics.
        """
        try:
            # Check cache first
            cache_key = f"dashboard:{user_id}"
            cached_data = await self.cache_manager.get(cache_key)
            if cached_data:
                return cached_data
            
            # Get user progress
            user_progress = await self.user_repo.get_user_progress(user_id)
            if not user_progress:
                return {"error": "User progress not found"}
            
            # Get recommendations
            recommendations = await self.recommendation_engine.get_recommendations(user_progress)
            
            # Get recent solutions
            recent_solutions = await self.solution_repo.get_user_solutions(
                user_id=user_id,
                limit=10
            )
            
            # Get analytics data
            analytics_data = await self.progress_analytics.get_analytics_data(user_progress)
            
            dashboard_data = {
                "user_progress": user_progress.dict(),
                "recommendations": recommendations,
                "recent_solutions": [s.dict() for s in recent_solutions],
                "analytics": analytics_data,
                "last_updated": datetime.utcnow().isoformat()
            }
            
            # Cache for 30 minutes
            await self.cache_manager.set(
                cache_key,
                dashboard_data,
                ttl=timedelta(minutes=30)
            )
            
            return dashboard_data
            
        except Exception as e:
            logger.error("Failed to get dashboard data", error=str(e), user_id=user_id, exc_info=True)
            raise
    
    async def get_system_health(self) -> Dict[str, Any]:
        """
        Get comprehensive system health status.
        Integrates health checks from all components.
        """
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "components": {}
        }
        
        try:
            # Check execution engine
            exec_health = await self.execution_engine.health_check()
            health_status["components"]["execution_engine"] = exec_health
            
            # Check AI services
            ai_health = await self.question_generator.health_check()
            health_status["components"]["ai_services"] = ai_health
            
            # Check cache
            cache_health = await self.cache_manager.health_check()
            health_status["components"]["cache"] = cache_health
            
            # Check auto-scaler
            scaler_health = await self.auto_scaler.get_status()
            health_status["components"]["auto_scaler"] = scaler_health
            
            # Check cost optimizer
            cost_health = await self.cost_optimizer.get_status()
            health_status["components"]["cost_optimizer"] = cost_health
            
            # Determine overall status
            component_statuses = [comp.get("status", "unknown") for comp in health_status["components"].values()]
            if any(status == "unhealthy" for status in component_statuses):
                health_status["status"] = "unhealthy"
            elif any(status == "degraded" for status in component_statuses):
                health_status["status"] = "degraded"
            
            return health_status
            
        except Exception as e:
            logger.error("Health check failed", error=str(e), exc_info=True)
            health_status["status"] = "unhealthy"
            health_status["error"] = str(e)
            return health_status
    
    async def cleanup_resources(self):
        """Cleanup resources and optimize costs."""
        try:
            await self.cost_optimizer.cleanup_idle_resources()
            await self.auto_scaler.scale_down_if_needed()
            logger.info("Resource cleanup completed")
        except Exception as e:
            logger.error("Resource cleanup failed", error=str(e), exc_info=True)


# Singleton instance for dependency injection
_integration_service: Optional[IntegrationService] = None


async def get_integration_service() -> IntegrationService:
    """Get the integration service singleton."""
    global _integration_service
    if not _integration_service:
        # This would be properly initialized with dependency injection in production
        raise RuntimeError("Integration service not initialized")
    return _integration_service


def set_integration_service(service: IntegrationService):
    """Set the integration service singleton."""
    global _integration_service
    _integration_service = service