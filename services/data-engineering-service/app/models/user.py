"""
User data models and schemas.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime
from enum import Enum

from app.models.execution import ExecutionResult, CodeReview
from app.models.question import QuestionTopic


class SolutionStatus(str, Enum):
    """Solution submission status."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"


class UserPreferences(BaseModel):
    """User preferences and settings."""
    experience_level: int = Field(..., ge=0, le=20, description="Years of experience")
    preferred_topics: List[QuestionTopic] = Field(default_factory=list)
    difficulty_preference: Optional[str] = Field(None, description="Preferred difficulty level")
    notification_settings: Dict[str, bool] = Field(default_factory=dict)


class Solution(BaseModel):
    """User solution to a question."""
    id: str = Field(..., description="Unique solution identifier")
    user_id: str = Field(..., description="User who submitted the solution")
    question_id: str = Field(..., description="Question being solved")
    
    # Solution content
    code: str = Field(..., description="User's PySpark code")
    execution_result: Optional[ExecutionResult] = Field(None, description="Execution results")
    ai_review: Optional[CodeReview] = Field(None, description="AI code review")
    
    # Status and timing
    status: SolutionStatus = Field(..., description="Solution status")
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = Field(None, description="AI review completion time")
    
    # Performance metrics
    performance_metrics: Dict[str, float] = Field(default_factory=dict)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class SkillArea(BaseModel):
    """User skill assessment in specific areas."""
    topic: QuestionTopic = Field(..., description="Skill topic")
    proficiency_score: float = Field(..., ge=0.0, le=10.0, description="Proficiency score")
    questions_attempted: int = Field(0, description="Number of questions attempted")
    questions_completed: int = Field(0, description="Number of questions completed successfully")
    last_activity: Optional[datetime] = Field(None, description="Last activity in this area")


class UserProgress(BaseModel):
    """User progress and statistics."""
    user_id: str = Field(..., description="Unique user identifier")
    
    # Basic info
    experience_level: int = Field(..., ge=0, le=20, description="Years of experience")
    preferences: UserPreferences = Field(..., description="User preferences")
    
    # Progress metrics
    completed_questions: List[str] = Field(default_factory=list, description="Completed question IDs")
    success_rate: float = Field(0.0, ge=0.0, le=1.0, description="Overall success rate")
    average_completion_time: float = Field(0.0, description="Average completion time in minutes")
    
    # Skill assessment
    skill_areas: List[SkillArea] = Field(default_factory=list, description="Skill area assessments")
    overall_proficiency: float = Field(0.0, ge=0.0, le=10.0, description="Overall proficiency score")
    
    # Activity tracking
    total_questions_attempted: int = Field(0, description="Total questions attempted")
    total_questions_completed: int = Field(0, description="Total questions completed")
    streak_days: int = Field(0, description="Current daily streak")
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    
    # Recommendations
    recommended_topics: List[QuestionTopic] = Field(default_factory=list)
    weak_areas: List[QuestionTopic] = Field(default_factory=list)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class UserAnalytics(BaseModel):
    """Detailed user analytics and insights."""
    user_id: str = Field(..., description="User identifier")
    
    # Time-based metrics
    daily_activity: Dict[str, int] = Field(default_factory=dict, description="Daily activity counts")
    weekly_progress: Dict[str, float] = Field(default_factory=dict, description="Weekly progress metrics")
    monthly_trends: Dict[str, Any] = Field(default_factory=dict, description="Monthly trend analysis")
    
    # Performance analysis
    difficulty_progression: List[Dict[str, Any]] = Field(default_factory=list)
    topic_performance: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    improvement_rate: float = Field(0.0, description="Rate of improvement over time")
    
    # Comparative metrics
    percentile_ranking: float = Field(0.0, ge=0.0, le=100.0, description="Percentile ranking among users")
    peer_comparison: Dict[str, Any] = Field(default_factory=dict)
    
    # Insights
    strengths: List[str] = Field(default_factory=list)
    improvement_areas: List[str] = Field(default_factory=list)
    personalized_recommendations: List[str] = Field(default_factory=list)


class SkillAssessment(BaseModel):
    """Comprehensive skill assessment for a user."""
    user_id: str = Field(..., description="User identifier")
    
    # Overall assessment
    overall_level: str = Field(..., description="Overall skill level (Beginner/Intermediate/Advanced)")
    overall_score: float = Field(..., ge=0.0, le=10.0, description="Overall skill score")
    
    # Detailed skill breakdown
    skill_areas: List[SkillArea] = Field(..., description="Detailed skill area assessments")
    
    # Competency mapping
    core_competencies: Dict[str, float] = Field(default_factory=dict, description="Core competency scores")
    advanced_skills: Dict[str, float] = Field(default_factory=dict, description="Advanced skill scores")
    
    # Learning recommendations
    next_steps: List[str] = Field(default_factory=list, description="Recommended next learning steps")
    focus_areas: List[str] = Field(default_factory=list, description="Areas requiring focused attention")
    
    # Assessment metadata
    assessed_at: datetime = Field(default_factory=datetime.utcnow)
    confidence_level: float = Field(..., ge=0.0, le=1.0, description="Confidence in assessment accuracy")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }