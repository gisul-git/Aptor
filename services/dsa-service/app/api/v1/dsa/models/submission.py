from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId
from .question import PyObjectId

class Submission(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    question_id: str
    language: str
    code: str
    status: str  # "accepted", "wrong_answer", "runtime_error", "time_limit_exceeded", "compilation_error"
    test_results: list  # List of testcase results
    passed_testcases: int
    total_testcases: int
    execution_time: Optional[float] = None
    memory_used: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

class SubmissionCreate(BaseModel):
    question_id: str
    language: str
    code: str

class RunCodeRequest(BaseModel):
    code: str
    language: str
    test_input: str

class RunCodeRequestV2(BaseModel):
    source_code: str
    language_id: int
    input_data: str = ""


