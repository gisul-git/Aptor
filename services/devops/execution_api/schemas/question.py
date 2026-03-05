from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from schemas.mongo import PyObjectId


class TestCase(BaseModel):
    input: str
    expected_output: str
    is_hidden: bool = False


class DevOpsQuestionBase(BaseModel):
    title: str
    description: str
    difficulty: str = "medium"
    kind: str = "command"
    points: int = 10
    topic: Optional[str] = None
    tags: List[str] = []
    years_of_experience: Optional[int] = None
    instructions: List[str] = []
    constraints: List[str] = []
    hints: List[str] = []
    languages: List[str] = ["bash"]
    starter_code: Dict[str, str] = {}
    public_testcases: List[TestCase] = []
    hidden_testcases: List[TestCase] = []
    ai_generated: bool = False
    is_published: bool = False


class DevOpsQuestionCreate(DevOpsQuestionBase):
    pass


class DevOpsQuestionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[str] = None
    kind: Optional[str] = None
    points: Optional[int] = None
    topic: Optional[str] = None
    tags: Optional[List[str]] = None
    years_of_experience: Optional[int] = None
    instructions: Optional[List[str]] = None
    constraints: Optional[List[str]] = None
    hints: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    starter_code: Optional[Dict[str, str]] = None
    public_testcases: Optional[List[TestCase]] = None
    hidden_testcases: Optional[List[TestCase]] = None
    ai_generated: Optional[bool] = None
    is_published: Optional[bool] = None


class DevOpsQuestion(DevOpsQuestionBase):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {PyObjectId: str},
    }
