"""
Question data models and schemas.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime
from enum import Enum


class DifficultyLevel(int, Enum):
    """Question difficulty levels based on experience."""
    BEGINNER = 1      # 0-2 years
    INTERMEDIATE = 2  # 3-7 years
    ADVANCED = 3      # 8+ years


# Alias for backward compatibility and API consistency
QuestionDifficulty = DifficultyLevel


class QuestionTopic(str, Enum):
    """Available question topics."""
    TRANSFORMATIONS = "transformations"
    AGGREGATIONS = "aggregations"
    JOINS = "joins"
    WINDOW_FUNCTIONS = "window_functions"
    PERFORMANCE_OPTIMIZATION = "performance_optimization"
    DATA_QUALITY = "data_quality"
    STREAMING = "streaming"


class TestCase(BaseModel):
    """Individual test case for question validation."""
    input_data: Dict[str, Any] = Field(..., description="Input data for the test case")
    expected_output: Dict[str, Any] = Field(..., description="Expected output data")
    description: str = Field(..., description="Description of what this test case validates")


class Question(BaseModel):
    """PySpark question model."""
    id: str = Field(..., description="Unique question identifier")
    title: str = Field(..., description="Question title")
    description: str = Field(..., description="Detailed problem description")
    difficulty_level: DifficultyLevel = Field(..., description="Question difficulty level")
    topic: QuestionTopic = Field(..., description="Primary topic category")
    
    # Data specifications
    input_schema: Dict[str, str] = Field(..., description="Input DataFrame schema")
    sample_input: Dict[str, Any] = Field(..., description="Sample input data for display")
    expected_output: Dict[str, Any] = Field(..., description="Expected output format")
    
    # Validation
    test_cases: List[TestCase] = Field(..., description="Test cases for validation")
    
    # Publishing
    is_published: bool = Field(default=False, description="Whether question is published")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None, description="Last update timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class QuestionGenerationRequest(BaseModel):
    """Request model for question generation."""
    experience_level: int = Field(..., ge=0, le=20, description="Years of experience")
    topic: Optional[QuestionTopic] = Field(None, description="Specific topic to focus on")
    additional_requirements: Optional[str] = Field(None, description="Additional requirements")


class QuestionResponse(BaseModel):
    """Response model for question endpoints."""
    question: Question
    generation_metadata: Dict[str, Any] = Field(default_factory=dict)