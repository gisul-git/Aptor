"""
Design Assessment Data Models
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class DesignRole(str, Enum):
    """Design roles"""
    UI_DESIGNER = "ui_designer"
    UX_DESIGNER = "ux_designer"
    PRODUCT_DESIGNER = "product_designer"
    VISUAL_DESIGNER = "visual_designer"
    INTERACTION_DESIGNER = "interaction_designer"


class DifficultyLevel(str, Enum):
    """Difficulty levels"""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class ExperienceLevel(str, Enum):
    """Experience levels mapped to years"""
    BEGINNER = "0-2 years"  # Beginner Designer
    JUNIOR = "3-5 years"     # Junior Designer
    MID_LEVEL = "6-8 years"  # Mid-Level Designer
    SENIOR = "9-12 years"    # Senior Designer
    LEAD = "13-15 years"     # Lead Designer


class TaskType(str, Enum):
    """Task types / Platform types"""
    LANDING_PAGE = "landing_page"
    MOBILE_APP = "mobile_app"
    DESKTOP_DASHBOARD = "desktop_dashboard"  # For complex tools like marketing automation
    WEB_APP = "web_app"
    COMPONENT = "component"


class DesignQuestionModel(BaseModel):
    """Design question model"""
    id: Optional[str] = Field(default=None, alias="_id")
    role: DesignRole
    difficulty: DifficultyLevel
    experience_level: Optional[ExperienceLevel] = None
    experience_years: Optional[int] = None  # Actual years (0-15) for scaling logic
    task_type: TaskType
    title: str
    description: str
    product_context: Optional[str] = None  # Business context and goals (for 5+ years)
    task_requirements: Optional[str] = None  # Explicit task instructions
    design_challenges: Optional[str] = None  # Real product problems to solve (for 5+ years)
    edge_cases: Optional[str] = None  # System states to handle (for 8+ years)
    cross_channel_requirements: Optional[str] = None  # Cross-platform complexity (for 8+ years)
    constraints: List[str] = []
    deliverables: List[str] = []
    design_decisions: Optional[str] = None  # Decision reasoning requirement (for 8+ years)
    evaluation_criteria: List[str] = []
    time_limit_minutes: int = 60
    recommended_time_minutes: Optional[str] = None  # e.g., "90-120 minutes"
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_published: bool = False
    updated_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        extra = "forbid"  # Explicitly forbid extra fields
        json_schema_extra = {
            "example": {
                "role": "product_designer",
                "difficulty": "advanced",
                "experience_level": "9-12 years",
                "experience_years": 10,
                "task_type": "desktop_dashboard",
                "title": "Marketing Automation Dashboard",
                "description": "Design a cross-channel marketing automation platform",
                "product_context": "The platform is used by digital marketing teams...",
                "design_challenges": "Marketing teams manage dozens of campaigns...",
                "edge_cases": "Handle campaigns with no engagement data...",
                "time_limit_minutes": 120,
                "recommended_time_minutes": "90-120 minutes"
            }
        }


class PenpotSessionModel(BaseModel):
    """Penpot session model"""
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    assessment_id: str
    question_id: str
    workspace_url: str
    session_token: str
    file_id: Optional[str] = None
    project_id: Optional[str] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True


class DesignSubmissionModel(BaseModel):
    """Design submission model"""
    id: Optional[str] = Field(default=None, alias="_id")
    session_id: str
    user_id: str
    question_id: str
    screenshot_url: str
    design_file_url: str
    test_id: Optional[str] = None
    rule_based_score: float = 0.0
    ai_based_score: float = 0.0
    final_score: float = 0.0
    feedback: Dict[str, Any] = {}
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
