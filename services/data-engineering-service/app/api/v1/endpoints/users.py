"""
User management and progress tracking endpoints.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Dict, Any, Optional
import structlog
from datetime import datetime, timedelta

from app.models.user import UserProgress, UserPreferences, Solution, UserAnalytics, SkillAssessment
from app.services.integration_service import get_integration_service, IntegrationService
from app.core.auth import get_current_user_required, get_current_user
from app.core.config import settings

logger = structlog.get_logger()
router = APIRouter()


@router.get("/{user_id}/progress")
async def get_user_progress(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_required),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> UserProgress:
    """Get user progress and statistics."""
    try:
        # Check if user can access this data
        if current_user.get("user_id") != user_id and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Use integration service to get comprehensive user progress
        progress = await integration_service.user_repo.get_user_progress(user_id)
        
        if not progress:
            raise HTTPException(status_code=404, detail="User not found")
        
        logger.info("User progress retrieved", user_id=user_id)
        return progress
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get user progress", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve user progress")


@router.get("/{user_id}/dashboard")
async def get_user_dashboard(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_required),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Dict[str, Any]:
    """Get comprehensive dashboard data for the user."""
    try:
        # Check if user can access this data
        if current_user.get("user_id") != user_id and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Use integration service for complete dashboard data
        dashboard_data = await integration_service.get_user_dashboard_data(user_id)
        
        logger.info("User dashboard data retrieved", user_id=user_id)
        return dashboard_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get user dashboard", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve user dashboard")


@router.get("/{user_id}/solutions")
async def get_user_solutions(
    user_id: str,
    skip: int = Query(0, ge=0, description="Number of solutions to skip"),
    limit: int = Query(10, ge=1, le=100, description="Number of solutions to return"),
    question_id: Optional[str] = Query(None, description="Filter by question ID"),
    status: Optional[str] = Query(None, description="Filter by solution status"),
    current_user: Dict[str, Any] = Depends(get_current_user_required),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Dict[str, Any]:
    """Get user's historical solutions and reviews."""
    try:
        # Check if user can access this data
        if current_user.get("user_id") != user_id and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Use integration service to get solutions with caching
        solutions = await integration_service.solution_repo.get_user_solutions(
            user_id=user_id,
            limit=limit,
            offset=skip
        )
        
        # Get total count for pagination
        total_count = len(solutions)  # This would be optimized in production
        
        logger.info(
            "User solutions retrieved",
            user_id=user_id,
            count=len(solutions),
            total=total_count
        )
        
        return {
            "solutions": [s.dict() for s in solutions],
            "total": total_count,
            "skip": skip,
            "limit": limit,
            "has_more": skip + len(solutions) < total_count
        }
        
    except Exception as e:
        logger.error("Failed to get user solutions", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve user solutions")


@router.post("/{user_id}/preferences")
async def update_user_preferences(
    user_id: str,
    preferences: UserPreferences,
    current_user: Dict[str, Any] = Depends(get_current_user_required),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> UserProgress:
    """Update user preferences and profile."""
    try:
        # Check if user can modify this data
        if current_user.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get current progress
        progress = await integration_service.user_repo.get_user_progress(user_id)
        if not progress:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update preferences
        progress.preferences = preferences.dict()
        progress.last_activity = datetime.utcnow()
        
        # Save updated progress
        updated_progress = await integration_service.user_repo.update_user_progress(progress)
        
        # Invalidate cached recommendations
        await integration_service.cache_manager.delete(f"recommendations:{user_id}")
        await integration_service.cache_manager.delete(f"dashboard:{user_id}")
        
        logger.info("User preferences updated", user_id=user_id)
        return updated_progress
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update user preferences", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to update user preferences")


@router.get("/{user_id}/learning-path")
async def get_learning_path(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_required)
) -> Dict[str, Any]:
    """Get personalized learning path for the user."""
    try:
        # Check if user can access this data
        if current_user.get("user_id") != user_id and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        recommendation_service = RecommendationEngine()
        learning_path = await recommendation_service.get_learning_path(user_id)
        
        logger.info("Learning path generated", user_id=user_id)
        return learning_path
        
    except Exception as e:
        logger.error("Failed to get learning path", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve learning path")


@router.get("/{user_id}/achievements")
async def get_user_achievements(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_required)
) -> Dict[str, Any]:
    """Get user achievements and badges."""
    try:
        # Check if user can access this data
        if current_user.get("user_id") != user_id and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        analytics_service = ProgressAnalyticsService()
        achievements = await analytics_service.get_user_achievements(user_id)
        
        logger.info("User achievements retrieved", user_id=user_id)
        return achievements
        
    except Exception as e:
        logger.error("Failed to get user achievements", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve achievements")


@router.get("/{user_id}/performance-trends")
async def get_performance_trends(
    user_id: str,
    days: int = Query(30, ge=7, le=365, description="Number of days to analyze"),
    granularity: str = Query("daily", regex="^(daily|weekly|monthly)$", description="Data granularity"),
    current_user: Dict[str, Any] = Depends(get_current_user_required)
) -> Dict[str, Any]:
    """Get user performance trends over time."""
    try:
        # Check if user can access this data
        if current_user.get("user_id") != user_id and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        analytics_service = ProgressAnalyticsService()
        trends = await analytics_service.get_performance_trends(
            user_id=user_id,
            days=days,
            granularity=granularity
        )
        
        logger.info("Performance trends retrieved", user_id=user_id, days=days, granularity=granularity)
        return trends
        
    except Exception as e:
        logger.error("Failed to get performance trends", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve performance trends")


@router.post("/{user_id}/goals")
async def set_learning_goals(
    user_id: str,
    goals: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user_required)
) -> Dict[str, str]:
    """Set learning goals for the user."""
    try:
        # Check if user can modify this data
        if current_user.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        user_service = UserService()
        success = await user_service.set_learning_goals(user_id, goals)
        
        if success:
            logger.info("Learning goals set", user_id=user_id)
            return {"message": "Learning goals updated successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to set learning goals")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to set learning goals", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to set learning goals")


@router.get("/{user_id}/study-plan")
async def get_study_plan(
    user_id: str,
    weeks: int = Query(4, ge=1, le=12, description="Number of weeks for the study plan"),
    current_user: Dict[str, Any] = Depends(get_current_user_required)
) -> Dict[str, Any]:
    """Get a personalized study plan for the user."""
    try:
        # Check if user can access this data
        if current_user.get("user_id") != user_id and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        recommendation_service = RecommendationEngine()
        learning_path = await recommendation_service.get_learning_path(user_id)
        
        # Generate weekly breakdown for study plan
        weekly_breakdown = await recommendation_service._generate_weekly_study_plan(weeks)
        
        study_plan = {
            **learning_path,
            "weeks": weeks,
            "weekly_breakdown": weekly_breakdown
        }
        
        logger.info("Study plan generated", user_id=user_id, weeks=weeks)
        return study_plan
        
    except Exception as e:
        logger.error("Failed to get study plan", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve study plan")


@router.get("/{user_id}/export")
async def export_user_data(
    user_id: str,
    format: str = Query("json", regex="^(json|csv)$", description="Export format"),
    include_solutions: bool = Query(False, description="Include solution code in export"),
    current_user: Dict[str, Any] = Depends(get_current_user_required)
) -> Dict[str, Any]:
    """Export user data for backup or analysis."""
    try:
        # Check if user can access this data
        if current_user.get("user_id") != user_id and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        user_service = UserService()
        export_data = await user_service.export_user_data(
            user_id=user_id,
            format=format,
            include_solutions=include_solutions
        )
        
        logger.info("User data exported", user_id=user_id, format=format)
        return export_data
        
    except Exception as e:
        logger.error("Failed to export user data", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to export user data")


@router.delete("/{user_id}")
async def delete_user_data(
    user_id: str,
    confirm: bool = Query(False, description="Confirmation flag for data deletion"),
    current_user: Dict[str, Any] = Depends(get_current_user_required)
) -> Dict[str, str]:
    """Delete user data (GDPR compliance)."""
    try:
        # Check if user can delete this data
        if current_user.get("user_id") != user_id and current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")
        
        if not confirm:
            raise HTTPException(
                status_code=400, 
                detail="Data deletion requires confirmation. Set confirm=true to proceed."
            )
        
        user_service = UserService()
        success = await user_service.delete_user_data(user_id)
        
        if success:
            logger.info("User data deleted", user_id=user_id)
            return {"message": "User data deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete user data")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete user data", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to delete user data")


# Public endpoints (no authentication required)

@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = Query(10, ge=1, le=100, description="Number of users to return"),
    timeframe: str = Query("all", regex="^(daily|weekly|monthly|all)$", description="Leaderboard timeframe"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get public leaderboard (anonymized)."""
    try:
        analytics_service = ProgressAnalyticsService()
        leaderboard = await analytics_service.get_leaderboard(
            limit=limit,
            timeframe=timeframe,
            anonymize=True  # Always anonymize public leaderboard
        )
        
        logger.info("Leaderboard retrieved", limit=limit, timeframe=timeframe)
        return leaderboard
        
    except Exception as e:
        logger.error("Failed to get leaderboard", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve leaderboard")


@router.get("/stats")
async def get_platform_stats() -> Dict[str, Any]:
    """Get public platform statistics."""
    try:
        analytics_service = ProgressAnalyticsService()
        stats = await analytics_service.get_platform_stats()
        
        logger.info("Platform stats retrieved")
        return stats
        
    except Exception as e:
        logger.error("Failed to get platform stats", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve platform statistics")