"""
Module: question_types.py
Purpose: Type definitions and Pydantic models for questions

This module provides type definitions and Pydantic models for all question types.
It ensures type safety and validation across the assessment system.

Dependencies:
- External: typing (for type hints)
- External: pydantic (for models and validation)

Example usage:
    ```python
    from app.api.v1.assessments.models.question_types import (
        QuestionType,
        MCQQuestion,
        Difficulty
    )
    
    question_type: QuestionType = "MCQ"
    difficulty: Difficulty = "Medium"
    
    mcq = MCQQuestion(
        question="What is Python?",
        options=["Language", "Framework", "Library", "Tool"],
        correctAnswer="Language"
    )
    ```

Note: These models are used for type hints and validation.
Actual question dictionaries may have additional fieldss.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

try:
    from pydantic import BaseModel, Field, ConfigDict
except ImportError:
    # Pydantic not available - use basic type hints only
    BaseModel = object
    Field = None
    ConfigDict = None


# ============================================================================
# TYPE ALIASES
# ============================================================================

QuestionType = Literal["MCQ", "Subjective", "PseudoCode", "Coding", "SQL", "AIML"]
Difficulty = Literal["Easy", "Medium", "Hard"]
ExperienceMode = Literal["corporate", "college", "student"]


# ============================================================================
# BASE MODELS
# ============================================================================

class BaseQuestion(BaseModel):
    """Base model for all question types."""
    question: Optional[str] = None
    questionText: Optional[str] = None
    type: QuestionType
    difficulty: Difficulty


# ============================================================================
# MCQ MODELS
# ============================================================================

class MCQQuestion(BaseQuestion):
    """Model for Multiple Choice Questions."""
    question: str = Field(..., min_length=10, description="Question text")
    options: List[str] = Field(..., min_length=4, max_length=4, description="Exactly 4 options")
    correctAnswer: str = Field(..., description="Must match one of the options")
    type: QuestionType = "MCQ"
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "question": "What is the time complexity of binary search?",
                "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
                "correctAnswer": "O(log n)",
                "type": "MCQ",
                "difficulty": "Medium"
            }
        }
    ) if ConfigDict else None


# ============================================================================
# SUBJECTIVE MODELS
# ============================================================================

class SubjectiveQuestion(BaseQuestion):
    """Model for Subjective/descriptive questions."""
    question: str = Field(..., min_length=50, description="Scenario-based question (min 50 chars)")
    type: QuestionType = "Subjective"
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "question": "You are working on a production system that processes 1000 requests per second. During peak hours, you notice database connection pool exhaustion. Describe your approach to diagnose and resolve this issue.",
                "type": "Subjective",
                "difficulty": "Hard"
            }
        }
    ) if ConfigDict else None


# ============================================================================
# PSEUDOCODE MODELS
# ============================================================================

class PseudoCodeQuestion(BaseQuestion):
    """Model for PseudoCode questions."""
    questionText: str = Field(..., min_length=100, description="Algorithm/logic question")
    type: QuestionType = "PseudoCode"
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "questionText": "Design an algorithm to find the shortest path between two nodes in a weighted graph. Include sample input: graph = {A: {B: 4, C: 2}, B: {D: 5}, C: {D: 8}}, start = A, end = D. Expected output: A -> C -> D (cost: 10)",
                "type": "PseudoCode",
                "difficulty": "Medium"
            }
        }
    ) if ConfigDict else None


# ============================================================================
# CODING MODELS
# ============================================================================

class TestCase(BaseModel):
    """Test case for coding questions."""
    input: str = Field(..., description="Test input")
    output: str = Field(..., description="Expected output")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "input": "5\n1 2 3 4 5",
                "output": "15"
            }
        }
    ) if ConfigDict else None


class FunctionSignature(BaseModel):
    """Function signature for coding questions."""
    name: str = Field(..., description="Function name")
    parameters: List[Dict[str, str]] = Field(default_factory=list, description="Parameters with name and type")
    return_type: str = Field(..., description="Return type")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "calculate_sum",
                "parameters": [{"name": "arr", "type": "List[int]"}],
                "return_type": "int"
            }
        }
    ) if ConfigDict else None


class CodingQuestion(BaseQuestion):
    """Model for Coding Questions with Judge0 support."""
    questionText: str = Field(..., description="Problem description with examples and constraints")
    starterCode: str = Field(..., description="Starter code template")
    visibleTestCases: List[TestCase] = Field(..., min_length=1, description="Public test cases")
    hiddenTestCases: List[TestCase] = Field(..., min_length=1, description="Hidden test cases")
    constraints: str = Field(..., description="Constraints and requirements")
    functionSignature: FunctionSignature = Field(..., description="Function signature")
    difficulty: Difficulty = Field(..., description="Difficulty level")
    language: str = Field(..., description="Judge0 language ID")
    codingLanguage: str = Field(..., description="Language name (python, java, etc.)")
    explanation: Optional[str] = None
    type: QuestionType = "Coding"
    
    # Legacy format fields (for backward compatibility)
    title: Optional[str] = None
    problemStatement: Optional[str] = None
    inputFormat: Optional[str] = None
    outputFormat: Optional[str] = None
    sampleInput: Optional[str] = None
    sampleOutput: Optional[str] = None
    functionSignatureString: Optional[str] = None
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "questionText": "Given an array of integers, find the sum of all elements.",
                "starterCode": "def calculate_sum(arr):\n    # Your code here\n    pass",
                "visibleTestCases": [{"input": "[1, 2, 3]", "output": "6"}],
                "hiddenTestCases": [{"input": "[10, 20, 30]", "output": "60"}],
                "constraints": "1 <= arr.length <= 1000",
                "functionSignature": {
                    "name": "calculate_sum",
                    "parameters": [{"name": "arr", "type": "List[int]"}],
                    "return_type": "int"
                },
                "difficulty": "Easy",
                "language": "71",
                "codingLanguage": "python"
            }
        }
    ) if ConfigDict else None


# ============================================================================
# SQL MODELS
# ============================================================================

class SQLQuestion(BaseQuestion):
    """Model for SQL questions."""
    question: str = Field(..., min_length=50, description="SQL problem with schema")
    questionText: Optional[str] = None  # Alternative field name
    type: Literal["SQL"] = "SQL"
    difficulty: Difficulty
    
    # SQL-specific structured data
    sql_data: Optional[Dict[str, Any]] = None  # Full SQL structure (schemas, sample_data, etc.)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "question": "Write a SQL query to find all employees who have been with the company for more than 5 years.",
                "questionText": "Write a SQL query to find all employees who have been with the company for more than 5 years.\n\n**Database Schema:**\n`employees` table:\n - `id`: int\n - `name`: varchar\n - `hire_date`: date",
                "type": "SQL",
                "difficulty": "Medium",
                "sql_data": {
                    "schemas": {"employees": {"columns": {"id": "int", "name": "varchar", "hire_date": "date"}}},
                    "sample_data": {"employees": [{"id": 1, "name": "John", "hire_date": "2018-01-15"}]}
                }
            }
        }
    ) if ConfigDict else None


# ============================================================================
# AIML MODELS
# ============================================================================

class AIMLQuestion(BaseQuestion):
    """Model for AIML (AI/ML) questions."""
    question: str = Field(..., min_length=50, description="AIML problem with dataset")
    questionText: Optional[str] = None  # Alternative field name
    type: Literal["AIML"] = "AIML"
    difficulty: Difficulty
    
    # AIML-specific structured data
    aiml_data: Optional[Dict[str, Any]] = None  # Full AIML structure (dataset, tasks, etc.)
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "question": "Implement a decision tree classifier to predict employee retention based on the given dataset.",
                "questionText": "Implement a decision tree classifier to predict employee retention.\n\n**Dataset Schema:**\n| Column | Type |\n|--------|------|\n| `age` | `int` |\n| `experience` | `int` |\n| `left_company` | `int` |",
                "type": "AIML",
                "difficulty": "Medium",
                "aiml_data": {
                    "dataset": {
                        "schema": {"age": "int", "experience": "int", "left_company": "int"},
                        "sample_data": [{"age": 25, "experience": 2, "left_company": 0}]
                    },
                    "tasks": ["Load dataset", "Train model", "Evaluate accuracy"],
                    "constraints": ["Must use scikit-learn", "Must use Python"]
                }
            }
        }
    ) if ConfigDict else None

