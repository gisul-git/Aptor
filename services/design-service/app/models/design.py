"""
Design Assessment Data Models
"""

from pydantic import BaseModel, Field
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
    """Experience levels"""
    FRESHER = "fresher"
    ONE_TO_THREE = "1-3 years"
    THREE_TO_FIVE = "3-5 years"
    SENIOR = "senior"


class TaskType(str, Enum):
    """Task types"""
    LANDING_PAGE = "landing_page"
    MOBILE_APP = "mobile_app"
    DASHBOARD = "dashboard"
    COMPONENT = "component"


class DesignQuestionModel(BaseModel):
    """Design question model"""
    id: Optional[str] = Field(default=None, alias="_id")
    role: DesignRole
    difficulty: DifficultyLevel
    experience_level: Optional[ExperienceLevel] = None
    task_type: TaskType
    title: str
    description: str
    task_requirements: Optional[str] = None  # New field for explicit task instructions
    constraints: List[str] = []
    deliverables: List[str] = []
    evaluation_criteria: List[str] = []
    time_limit_minutes: int = 60
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_published: bool = False
    updated_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "role": "ui_designer",
                "difficulty": "intermediate",
                "experience_level": "1-3 years",
                "task_type": "landing_page",
                "title": "E-commerce Landing Page",
                "description": "Design a modern landing page",
                "task_requirements": "Design the landing page including: 1. Hero section 2. Features section 3. Footer",
                "time_limit_minutes": 60
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
