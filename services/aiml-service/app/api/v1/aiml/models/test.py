from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime

class ProctoringSettings(BaseModel):
    aiProctoringEnabled: Optional[bool] = None
    faceMismatchEnabled: Optional[bool] = None
    liveProctoringEnabled: Optional[bool] = None
TimerMode = Literal["GLOBAL", "PER_QUESTION"]
ExamMode = Literal["strict", "flexible"]


class QuestionTiming(BaseModel):
    question_id: str
    duration_minutes: int


class Schedule(BaseModel):
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    duration: Optional[int] = None  # minutes (required for flexible)
    candidateRequirements: Optional[Dict[str, Any]] = None  # Candidate requirements (phone, resume, LinkedIn, GitHub)


class TestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    question_ids: List[str]
    # Legacy fields (backward compatible)
    duration_minutes: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    proctoringSettings: Optional[ProctoringSettings] = None

    # Timer configuration (mirrors DSA)
    timer_mode: TimerMode = "GLOBAL"
    question_timings: Optional[List[QuestionTiming]] = None

    # Exam window configuration (mirrors Custom MCQ)
    examMode: ExamMode = "strict"
    schedule: Optional[Schedule] = None
    # Frontend-compatible root fields (optional)
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    duration: Optional[int] = None

    model_config = {"extra": "ignore"}

class Test(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    question_ids: List[str]
    duration_minutes: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    timer_mode: TimerMode = "GLOBAL"
    question_timings: Optional[List[QuestionTiming]] = None
    examMode: ExamMode = "strict"
    schedule: Optional[Schedule] = None
    is_active: bool = True
    is_published: bool = False
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    proctoringSettings: Optional[ProctoringSettings] = None

class AddCandidateRequest(BaseModel):
    test_id: Optional[str] = None  # Optional since it's in the path
    name: str
    email: str

