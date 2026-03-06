"""
Test model for Data Engineering assessments.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class ExamMode(str, Enum):
    """Exam window mode."""
    STRICT = "strict"  # Fixed time window
    FLEXIBLE = "flexible"  # Flexible time window


class TimerMode(str, Enum):
    """Timer mode for questions."""
    GLOBAL = "GLOBAL"  # Single timer for all questions
    PER_QUESTION = "PER_QUESTION"  # Individual timer per question


class QuestionTiming(BaseModel):
    """Timing configuration for individual questions."""
    question_id: str
    duration_minutes: int = Field(ge=1)


class CandidateRequirements(BaseModel):
    """Requirements for candidate information."""
    requirePhone: bool = False
    requireResume: bool = False
    requireLinkedIn: bool = False
    requireGithub: bool = False


class ProctoringSettings(BaseModel):
    """Proctoring configuration."""
    aiProctoringEnabled: bool = False
    faceMismatchEnabled: bool = False
    liveProctoringEnabled: bool = False


class TestSchedule(BaseModel):
    """Test scheduling configuration."""
    startTime: datetime
    endTime: Optional[datetime] = None
    duration: Optional[int] = None  # Duration in minutes for flexible mode
    candidateRequirements: Optional[CandidateRequirements] = None


class Test(BaseModel):
    """Data Engineering Test model."""
    id: str
    title: str
    description: str
    question_ids: List[str] = []
    duration_minutes: int = Field(ge=1)
    start_time: datetime
    end_time: Optional[datetime] = None
    is_active: bool = True
    is_published: bool = False
    invited_users: List[str] = []
    test_token: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Advanced features
    examMode: ExamMode = ExamMode.STRICT
    timer_mode: TimerMode = TimerMode.GLOBAL
    question_timings: Optional[List[QuestionTiming]] = None
    schedule: Optional[TestSchedule] = None
    proctoringSettings: Optional[ProctoringSettings] = None
    pausedAt: Optional[datetime] = None
    
    # Metadata
    metadata: Dict[str, Any] = {}

    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class TestCreate(BaseModel):
    """Schema for creating a new test."""
    title: str
    description: str
    question_ids: List[str]
    duration_minutes: int = Field(ge=1)
    start_time: datetime
    end_time: Optional[datetime] = None
    examMode: ExamMode = ExamMode.STRICT
    timer_mode: TimerMode = TimerMode.GLOBAL
    question_timings: Optional[List[QuestionTiming]] = None
    schedule: Optional[TestSchedule] = None
    proctoringSettings: Optional[ProctoringSettings] = None


class TestUpdate(BaseModel):
    """Schema for updating a test."""
    title: Optional[str] = None
    description: Optional[str] = None
    question_ids: Optional[List[str]] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_active: Optional[bool] = None
    examMode: Optional[ExamMode] = None
    timer_mode: Optional[TimerMode] = None
    question_timings: Optional[List[QuestionTiming]] = None
    schedule: Optional[TestSchedule] = None
    proctoringSettings: Optional[ProctoringSettings] = None
