from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from schemas.mongo import PyObjectId


TimerMode = Literal["GLOBAL", "PER_QUESTION"]
ExamMode = Literal["strict", "flexible"]


class ProctoringSettings(BaseModel):
    aiProctoringEnabled: Optional[bool] = None
    faceMismatchEnabled: Optional[bool] = None
    liveProctoringEnabled: Optional[bool] = None


class QuestionTiming(BaseModel):
    question_id: str
    duration_minutes: int


class Schedule(BaseModel):
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    duration: Optional[int] = None
    candidateRequirements: Optional[Dict[str, Any]] = None
    proctoringSettings: Optional[ProctoringSettings] = None


class DevOpsTestBase(BaseModel):
    title: str
    description: Optional[str] = None
    question_ids: List[str] = []
    duration_minutes: Optional[int] = 60
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    timer_mode: TimerMode = "GLOBAL"
    question_timings: Optional[List[QuestionTiming]] = None
    examMode: ExamMode = "strict"
    schedule: Optional[Schedule] = None
    proctoringSettings: Optional[ProctoringSettings] = None
    invited_users: List[str] = []


class DevOpsTestCreate(DevOpsTestBase):
    duration: Optional[int] = None
    questions: Optional[List[Dict[str, Any]]] = None


class DevOpsTestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    question_ids: Optional[List[str]] = None
    duration_minutes: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    timer_mode: Optional[TimerMode] = None
    question_timings: Optional[List[QuestionTiming]] = None
    examMode: Optional[ExamMode] = None
    schedule: Optional[Schedule] = None
    proctoringSettings: Optional[ProctoringSettings] = None
    invited_users: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_published: Optional[bool] = None


class DevOpsTest(DevOpsTestBase):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    is_active: bool = True
    is_published: bool = False
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    pausedAt: Optional[datetime] = None
    cloned_from: Optional[str] = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {PyObjectId: str},
    }
