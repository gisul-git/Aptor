from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal, Any
from datetime import datetime
from bson import ObjectId
from .question import PyObjectId


# Timer mode types
TimerMode = Literal["GLOBAL", "PER_QUESTION"]

# Exam window mode (mirrors Custom MCQ)
ExamMode = Literal["strict", "flexible"]


class Schedule(BaseModel):
    """Exam window schedule configuration (mirrors Custom MCQ structure)."""
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    duration: Optional[int] = None  # minutes, required for flexible mode
    candidateRequirements: Optional[Dict[str, Any]] = None  # Candidate requirements (phone, resume, LinkedIn, GitHub)


class QuestionTiming(BaseModel):
    """Timing configuration for a single question in PER_QUESTION mode"""
    question_id: str
    duration_minutes: int  # Time allocated for this specific question


class ProctoringSettings(BaseModel):
    aiProctoringEnabled: Optional[bool] = None
    faceMismatchEnabled: Optional[bool] = None
    liveProctoringEnabled: Optional[bool] = None


class Test(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    title: str
    description: str
    question_ids: List[str]
    duration_minutes: int  # Used for GLOBAL mode, or total duration in PER_QUESTION mode
    start_time: datetime
    end_time: datetime
    created_by: str  # Admin user ID
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True
    is_published: bool = False  # Whether test is published and available to invited users
    invited_users: List[str] = []  # List of user emails who are invited to take the test
    test_token: Optional[str] = None  # Single shared token for all candidates in this test
    
    # Timer configuration (new fields - backward compatible)
    timer_mode: TimerMode = "GLOBAL"  # GLOBAL = single timer, PER_QUESTION = individual timers
    question_timings: Optional[List[QuestionTiming]] = None  # Only used when timer_mode = PER_QUESTION

    # Proctoring (optional, backward compatible)
    proctoringSettings: Optional[ProctoringSettings] = None
    # Exam window configuration (mirrors Custom MCQ; backward compatible)
    examMode: ExamMode = "strict"
    schedule: Optional[Schedule] = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }


class TestCreate(BaseModel):
    title: str
    description: str
    question_ids: List[str]
    # Legacy fields (kept for backward compatibility). For new clients use examMode + schedule.
    duration_minutes: Optional[int] = None  # Required for GLOBAL mode; may be derived from schedule
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    invited_users: List[str] = []  # List of user emails to invite
    
    # Timer configuration (new fields - backward compatible with defaults)
    timer_mode: TimerMode = "GLOBAL"
    question_timings: Optional[List[QuestionTiming]] = None  # Only used when timer_mode = PER_QUESTION

    # Proctoring (optional, backward compatible)
    proctoringSettings: Optional[ProctoringSettings] = None
    
    # Exam window configuration (mirrors Custom MCQ; backward compatible)
    examMode: Optional[ExamMode] = "strict"
    schedule: Optional[Schedule] = None
    # Top-level fields for backward compatibility
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    duration: Optional[int] = None

class TestInviteRequest(BaseModel):
    test_id: str
    user_emails: List[str]  # List of emails to invite

class AddCandidateRequest(BaseModel):
    test_id: Optional[str] = None  # Optional since it's in the path
    name: str
    email: str

class CandidateLinkResponse(BaseModel):
    candidate_id: str
    test_link: str
    name: str
    email: str

class TestSubmission(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    test_id: str
    user_id: str
    submissions: List[str]  # List of submission IDs
    score: int
    started_at: datetime
    submitted_at: Optional[datetime] = None
    is_completed: bool = False

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

