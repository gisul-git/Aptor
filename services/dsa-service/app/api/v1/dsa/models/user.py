from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId
from .question import PyObjectId

class User(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    username: str
    email: str
    hashed_password: str
    is_admin: bool = False
    total_score: int = 0
    questions_solved: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class LeaderboardEntry(BaseModel):
    user_id: str
    username: str
    total_score: int
    questions_solved: int
    rank: Optional[int] = None


