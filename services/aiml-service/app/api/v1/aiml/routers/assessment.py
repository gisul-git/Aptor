"""
Assessment router for AIML - running test cases against coding questions.
Simplified version for Python-based AIML questions.
"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ..database import get_aiml_database as get_database
from ..utils.judge0 import run_all_test_cases, run_test_case, LANGUAGE_IDS

logger = logging.getLogger("backend")
router = APIRouter(prefix="/api/v1/aiml", tags=["aiml"])


class RunCodeRequest(BaseModel):
    """Request for running code (public test cases only)"""
    question_id: str
    source_code: str
    language_id: int = 71  # Python 3 default


class SubmitCodeRequest(BaseModel):
    """Request for submitting code (all test cases)"""
    question_id: str
    source_code: str
    language_id: int = 71  # Python 3 default
    started_at: Optional[str] = None
    submitted_at: Optional[str] = None
    time_spent_seconds: Optional[int] = None


class PublicTestResult(BaseModel):
    """Full details for public test case"""
    id: str
    test_number: int
    input: str
    expected_output: str
    user_output: str
    status: str
    status_id: int
    time: Optional[float] = None
    memory: Optional[int] = None
    passed: bool
    stderr: Optional[str] = None
    compile_output: Optional[str] = None


class HiddenTestResult(BaseModel):
    """Limited info for hidden test case"""
    id: str
    test_number: int
    passed: bool
    status: str


@router.post("/assessment/run")
async def run_code(request: RunCodeRequest):
    """
    Run code against public test cases only.
    Returns full details for all public test cases.
    """
    try:
        db = get_database()
        question_id = ObjectId(request.question_id)
        question = await db.questions.find_one({"_id": question_id})
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Get public test cases
        public_testcases = question.get("public_testcases", [])
        
        if not public_testcases:
            return {
                "question_id": request.question_id,
                "public_results": [],
                "public_summary": {"total": 0, "passed": 0},
                "status": "No public test cases available",
                "compilation_error": False,
            }
        
        # Prepare test cases for Judge0
        test_cases = []
        for i, tc in enumerate(public_testcases):
            test_cases.append({
                "id": str(tc.get("id", f"public_{i}")),
                "input": tc.get("input", ""),
                "expected_output": tc.get("expected_output", ""),
                "is_hidden": False,
                "points": 1,
            })
        
        # Run all test cases
        result = await run_all_test_cases(
            source_code=request.source_code,
            language_id=request.language_id,
            test_cases=test_cases,
        )
        
        # Format results
        public_results = []
        for i, res in enumerate(result["results"]):
            public_results.append({
                "id": res.get("test_case_id", f"public_{i}"),
                "test_number": i + 1,
                "input": res.get("input", ""),
                "expected_output": res.get("expected_output", ""),
                "user_output": res.get("stdout", ""),
                "status": res.get("status", "Unknown"),
                "status_id": res.get("status_id", 0),
                "time": res.get("time"),
                "memory": res.get("memory"),
                "passed": res.get("passed", False),
                "stderr": res.get("stderr", ""),
                "compile_output": res.get("compile_output", ""),
            })
        
        return {
            "question_id": request.question_id,
            "public_results": public_results,
            "public_summary": {
                "total": result["total"],
                "passed": result["passed"],
            },
            "status": "completed",
            "compilation_error": False,
        }
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error running code: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to run code: {str(exc)}")


@router.post("/assessment/submit")
async def submit_code(request: SubmitCodeRequest):
    """
    Submit code against all test cases (public + hidden).
    Returns full details for public, limited info for hidden.
    """
    try:
        db = get_database()
        question_id = ObjectId(request.question_id)
        question = await db.questions.find_one({"_id": question_id})
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Get all test cases
        public_testcases = question.get("public_testcases", [])
        hidden_testcases = question.get("hidden_testcases", [])
        
        # Prepare test cases for Judge0
        test_cases = []
        for i, tc in enumerate(public_testcases):
            test_cases.append({
                "id": str(tc.get("id", f"public_{i}")),
                "input": tc.get("input", ""),
                "expected_output": tc.get("expected_output", ""),
                "is_hidden": False,
                "points": 1,
            })
        
        for i, tc in enumerate(hidden_testcases):
            test_cases.append({
                "id": str(tc.get("id", f"hidden_{i}")),
                "input": tc.get("input", ""),
                "expected_output": tc.get("expected_output", ""),
                "is_hidden": True,
                "points": 1,
            })
        
        if not test_cases:
            return {
                "question_id": request.question_id,
                "public_results": [],
                "hidden_results": [],
                "hidden_summary": {"total": 0, "passed": 0},
                "total_passed": 0,
                "total_tests": 0,
                "score": 0,
                "max_score": 0,
                "status": "No test cases available",
                "compilation_error": False,
            }
        
        # Run all test cases
        result = await run_all_test_cases(
            source_code=request.source_code,
            language_id=request.language_id,
            test_cases=test_cases,
        )
        
        # Separate public and hidden results
        public_results = []
        hidden_results = []
        hidden_passed = 0
        hidden_total = 0
        
        public_count = 0
        for res in result["results"]:
            if not res.get("is_hidden", False):
                public_count += 1
                public_results.append({
                    "id": res.get("test_case_id", f"public_{public_count}"),
                    "test_number": public_count,
                    "input": res.get("input", ""),
                    "expected_output": res.get("expected_output", ""),
                    "user_output": res.get("stdout", ""),
                    "status": res.get("status", "Unknown"),
                    "status_id": res.get("status_id", 0),
                    "time": res.get("time"),
                    "memory": res.get("memory"),
                    "passed": res.get("passed", False),
                    "stderr": res.get("stderr", ""),
                    "compile_output": res.get("compile_output", ""),
                })
            else:
                hidden_total += 1
                if res.get("passed", False):
                    hidden_passed += 1
                hidden_results.append({
                    "id": res.get("test_case_id", f"hidden_{hidden_total}"),
                    "test_number": hidden_total,
                    "passed": res.get("passed", False),
                    "status": "Passed" if res.get("passed", False) else "Failed",
                })
        
        return {
            "question_id": request.question_id,
            "public_results": public_results,
            "hidden_results": hidden_results,
            "hidden_summary": {
                "total": hidden_total,
                "passed": hidden_passed,
            },
            "total_passed": result["passed"],
            "total_tests": result["total"],
            "score": result["score"],
            "max_score": result["max_score"],
            "status": "completed",
            "compilation_error": False,
        }
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error submitting code: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to submit code: {str(exc)}")

