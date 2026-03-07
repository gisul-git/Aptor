"""
Assessment router for running test cases against coding questions.
Supports visible/hidden test cases with proper separation:
- Users see full details for public test cases
- Users see only pass/fail for hidden test cases
- Admins can see full details for all test cases

Secure Mode:
- When enabled, user code is validated and wrapped
- Users can only write function body (no I/O code allowed)
- System handles all input parsing and output formatting

SQL Support:
- SQL questions use the SQL execution engine (SQL_ENGINE_URL)
- run-sql: Execute query and show results
- submit-sql: Compare results with reference query
"""
import logging
import re
import json
import httpx
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..database import get_dsa_database as get_database
from ..services.dsa_execution_service import (
    run_all_test_cases_dsa,
    is_dsa_language,
    get_supported_languages,
    execute_dsa_single,
)
from ..services.ai_feedback import generate_code_feedback
from ...assessments.services.unified_ai_evaluation import evaluate_sql_answer
from ..config import SQL_ENGINE_URL, get_dsa_settings, DSASettings
from ..services.sql_question_service import get_sql_question_service

# Stub functions for deprecated code_wrapper functionality
# TODO: Update to use universal_code_wrapper_v2.py for new JSON-based system
def validate_user_code(code: str, language: str) -> Tuple[bool, Optional[str]]:
    """Stub: Basic validation - always passes for now."""
    if not code or not code.strip():
        return False, "Code cannot be empty"
    return True, None

def detect_hardcoding(code: str, expected_outputs: List[str]) -> Tuple[bool, Optional[str]]:
    """Stub: Hardcoding detection - always returns False for now."""
    return False, None

def wrap_user_code(user_code: str, language: str, function_signature=None, wrapper_template=None) -> Tuple[str, Optional[str]]:
    """Stub: Code wrapping - returns code as-is for now."""
    return user_code, None

def validate_boilerplate_not_modified(user_code: str, language: str, original_function_name: Optional[str] = None) -> Tuple[bool, List[str]]:
    """Stub: Boilerplate validation - always passes for now."""
    return True, []

def generate_boilerplate(language: str, function_name: str, parameters: List[Dict[str, str]], return_type: str) -> str:
    """Stub: Boilerplate generation - returns empty string for now."""
    return ""

logger = logging.getLogger("backend")
router = APIRouter(prefix="/api/v1/dsa", tags=["dsa"])


# ============================================================================
# Request/Response Models
# ============================================================================

class TestCase(BaseModel):
    id: Optional[str] = None
    stdin: str
    expected_output: str
    is_hidden: bool = False
    points: int = 1
    description: Optional[str] = None


class QuestionConstraints(BaseModel):
    cpu_time_limit: float = 2.0
    memory_limit: int = 128000
    wall_time_limit: float = 5.0


class RunCodeRequest(BaseModel):
    """Request for running code (public test cases only)"""
    question_id: str
    source_code: str
    language: str  # e.g. "python", "java", "cpp"


class SubmitCodeRequest(BaseModel):
    """Request for submitting code (all test cases)"""
    question_id: str
    source_code: str
    language: str  # e.g. "python", "java", "cpp"
    # Time tracking fields
    started_at: Optional[str] = None  # ISO timestamp when user started the question
    submitted_at: Optional[str] = None  # ISO timestamp when user submitted
    time_spent_seconds: Optional[int] = None  # Total time spent in seconds


class RunSingleTestRequest(BaseModel):
    source_code: str
    language: str  # e.g. "python", "java", "cpp"
    stdin: str
    expected_output: str = ""
    function_name: str = ""
    cpu_time_limit: float = 2.0
    memory_limit: int = 128000


class PublicTestResult(BaseModel):
    """Full details for public test case - visible to users"""
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
    """Limited info for hidden test case - visible to users"""
    id: str
    test_number: int
    passed: bool
    status: str
    # NO input, expected_output, user_output, stderr, compile_output


class HiddenTestResultAdmin(BaseModel):
    """Full details for hidden test case - visible to ADMINS only"""
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


class HiddenSummary(BaseModel):
    """Summary of hidden test case results"""
    total: int
    passed: int


class RunCodeResponse(BaseModel):
    """Response for Run Code (public test cases only)"""
    question_id: str
    public_results: List[PublicTestResult]
    public_summary: Dict[str, int]
    status: str
    compilation_error: bool


class SubmitCodeResponse(BaseModel):
    """Response for Submit Code (public + hidden test cases)"""
    question_id: str
    public_results: List[PublicTestResult]
    hidden_results: List[HiddenTestResult]  # Limited info only
    hidden_summary: HiddenSummary
    total_passed: int
    total_tests: int
    score: int
    max_score: int
    status: str
    compilation_error: bool


# ============================================================================
# Helper Functions
# ============================================================================

async def prepare_code_for_execution(
    source_code: str,
    language: str,
    question: Dict[str, Any]
) -> Tuple[str, Optional[str], List[str]]:
    """
    Prepare user code for execution.
    For DSA languages: returns raw code (execution API). Otherwise wraps as before.
    language: name e.g. "python", "java", "cpp".
    Returns: (prepared_code, error_message, warnings_list)
    """
    warnings = []
    secure_mode = question.get("secure_mode", False)
    language = (language or "").strip()

    func_name = None
    func_sig = question.get("function_signature")
    if func_sig:
        func_name = func_sig.get("name")

    is_valid_boilerplate, boilerplate_warnings = validate_boilerplate_not_modified(
        source_code, language, func_name
    )
    if not is_valid_boilerplate:
        warnings.extend(boilerplate_warnings)

    if is_dsa_language(language):
        logger.info(f"DSA language {language} - returning raw code for execution API")
        return source_code, None, warnings

    # Other languages (e.g. legacy)
    if not secure_mode:
        # Legacy mode - still try auto-wrap for common languages
        # This ensures Java function-only code works even without secure_mode
        wrapped_code, _ = wrap_user_code(source_code, language)
        return wrapped_code, None, warnings
    
    # Secure mode enabled
    # Step 1: Validate code
    is_valid, error = validate_user_code(source_code, language)
    if not is_valid:
        return "", f"Code validation failed: {error}", warnings
    
    # Step 2: Check for potential hardcoding
    expected_outputs = []
    for tc in question.get("public_testcases", []):
        expected_outputs.append(tc.get("expected_output", ""))
    for tc in question.get("hidden_testcases", []):
        expected_outputs.append(tc.get("expected_output", ""))
    
    is_hardcoded, warning = detect_hardcoding(source_code, expected_outputs)
    if is_hardcoded:
        logger.warning(f"Potential hardcoding detected: {warning}")
        warnings.append("⚠️ Potential hardcoding detected. Hidden test cases will verify your solution.")
    
    # Step 3: Wrap the code
    # Priority: admin template > auto-wrapper > as-is
    wrapper_template = question.get("wrapper_template")
    
    wrapped_code, wrap_error = wrap_user_code(
        user_code=source_code,
        language=language,
        wrapper_template=wrapper_template,
    )
    
    if wrap_error:
        return "", f"Code preparation failed: {wrap_error}", warnings
    
    logger.info(f"Code prepared for {language} (secure_mode={secure_mode})")
    return wrapped_code, None, warnings


def format_public_result(result: Dict[str, Any], test_number: int) -> Dict[str, Any]:
    """Format a test case result for public display (full details)"""
    stdout_value = result.get("stdout", "")
    return {
        "id": result.get("test_case_id", f"public_{test_number}"),
        "test_number": test_number,
        "input": result.get("stdin", ""),
        "expected_output": result.get("expected_output", ""),
        "user_output": stdout_value,
        "stdout": stdout_value,  # Also include as stdout for frontend compatibility
        "status": result.get("status", "Unknown"),
        "status_id": result.get("status_id", 0),
        "time": float(result.get("time")) if result.get("time") else None,
        "memory": result.get("memory"),
        "passed": result.get("passed", False),
        "stderr": result.get("stderr", ""),
        "compile_output": result.get("compile_output", ""),
    }


def format_hidden_result_for_user(result: Dict[str, Any], test_number: int) -> Dict[str, Any]:
    """Format a hidden test case result for user display (limited info)"""
    return {
        "id": result.get("test_case_id", f"hidden_{test_number}"),
        "test_number": test_number,
        "passed": result.get("passed", False),
        "status": "Passed" if result.get("passed", False) else "Failed",
        # NO input, expected_output, user_output, stderr, compile_output
    }


def format_hidden_result_for_admin(result: Dict[str, Any], test_number: int, 
                                    stdin: str, expected_output: str) -> Dict[str, Any]:
    """Format a hidden test case result for admin display (full details)"""
    return {
        "id": result.get("test_case_id", f"hidden_{test_number}"),
        "test_number": test_number,
        "input": stdin,
        "expected_output": expected_output,
        "user_output": result.get("stdout", ""),
        "status": result.get("status", "Unknown"),
        "status_id": result.get("status_id", 0),
        "time": float(result.get("time")) if result.get("time") else None,
        "memory": result.get("memory"),
        "passed": result.get("passed", False),
        "stderr": result.get("stderr", ""),
        "compile_output": result.get("compile_output", ""),
    }


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/assessment/run-single")
async def run_single_test(request: RunSingleTestRequest):
    """
    Run a single test case without saving to database.
    Uses DSA execution API; function_name is required.
    """
    logger.info("Running single test case with language=%s", request.language)
    if not is_dsa_language(request.language):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language for DSA: {request.language}",
        )
    if not (request.function_name or "").strip():
        raise HTTPException(status_code=400, detail="function_name is required")
    result = await execute_dsa_single(
        source_code=request.source_code,
        language=request.language,
        function_name=request.function_name.strip(),
        input_data=request.stdin,
        expected_output=request.expected_output or None,
    )
    passed = (result.get("verdict") or "").strip().lower() == "accepted"
    return {
        "success": passed,
        "result": {
            "passed": passed,
            "status": result.get("verdict", ""),
            "stdout": result.get("stdout", ""),
            "stderr": result.get("stderr", ""),
            "compile_output": result.get("error_message", ""),
        },
    }


@router.post("/assessment/run")
async def run_code(request: RunCodeRequest):
    """
    RUN CODE - Execute only PUBLIC test cases.
    Returns full details for all public test cases.
    Used when user clicks "Run Code" button.
    
    If secure_mode is enabled:
    - Validates code for forbidden patterns
    - Wraps code with I/O handling
    """
    logger.info(f"Running code for question {request.question_id} (public tests only)")
    
    db = get_database()
    
    # Validate question ID
    if not ObjectId.is_valid(request.question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    question = await db.questions.find_one({"_id": ObjectId(request.question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Prepare code (validate + wrap if secure_mode)
    prepared_code, prep_error, code_warnings = await prepare_code_for_execution(
        source_code=request.source_code,
        language=request.language,
        question=question
    )
    
    if prep_error:
        raise HTTPException(status_code=400, detail=prep_error)
    
    if not is_dsa_language(request.language):
        raise HTTPException(status_code=400, detail=f"Unsupported language: {request.language}")
    
    # Build test cases array - PUBLIC ONLY
    test_cases = []
    for i, tc in enumerate(question.get("public_testcases", [])):
        # Preserve expected_output as-is (can be None, string, list, dict, etc.)
        # Don't default to empty string - preserve None to check if it exists
        expected_output = tc.get("expected_output") if "expected_output" in tc else None
        
        test_cases.append({
            "id": f"public_{i}",
            "stdin": tc.get("input", ""),
            "expected_output": expected_output,  # Preserve original value (None, string, list, dict, etc.)
            "is_hidden": False,
            "points": tc.get("points", 1),
        })
    
    if not test_cases:
        raise HTTPException(status_code=400, detail="Question has no public test cases")
    
    # Get execution constraints (default values)
    # Note: question.constraints is a list of constraint strings, not a dict
    cpu_time_limit = 2.0
    memory_limit = 128000
    
    # DSA execution requires function name from question
    func_sig_data = question.get("function_signature")
    function_name = (func_sig_data.get("name") or "").strip() if func_sig_data else ""
    if not function_name:
        raise HTTPException(
            status_code=400,
            detail="Question must have function_signature.name for DSA execution",
        )

    # Run public test cases via DSA execution API
    results = await run_all_test_cases_dsa(
        source_code=prepared_code,
        test_cases=test_cases,
        function_name=function_name,
        language=request.language,
    )

    # Format public results with full details
    public_results = []
    for i, result in enumerate(results.get("results", [])):
        public_results.append(format_public_result(result, i + 1))
    
    # Determine status
    if results.get("compilation_error"):
        status = "compilation_error"
    elif results.get("passed") == results.get("total"):
        status = "accepted"
    elif results.get("passed", 0) > 0:
        status = "partially_accepted"
    else:
        status = "wrong_answer"
    
    response = {
        "question_id": request.question_id,
        "public_results": public_results,
        "public_summary": {
            "total": results.get("total", 0),
            "passed": results.get("passed", 0),
        },
        "status": status,
        "compilation_error": results.get("compilation_error", False),
    }
    
    # Include warnings if user modified boilerplate incorrectly
    if code_warnings:
        response["warnings"] = code_warnings
    
    return response


@router.post("/assessment/submit")
async def submit_code(
    request: SubmitCodeRequest,
    user_id: str = Query(None, description="User ID for tracking submission"),
):
    """
    SUBMIT CODE - Execute ALL test cases (public + hidden).
    Returns:
    - Full details for public test cases
    - Only pass/fail for hidden test cases (NO input/output/stderr)
    Used when user clicks "Submit" button.
    
    If secure_mode is enabled:
    - Validates code for forbidden patterns
    - Wraps code with I/O handling
    """
    logger.info(f"Submitting code for question {request.question_id} (all tests)")
    
    db = get_database()
    
    # Validate question ID
    if not ObjectId.is_valid(request.question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    question = await db.questions.find_one({"_id": ObjectId(request.question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Prepare code (validate + wrap if secure_mode)
    prepared_code, prep_error, code_warnings = await prepare_code_for_execution(
        source_code=request.source_code,
        language=request.language,
        question=question
    )
    
    if prep_error:
        raise HTTPException(status_code=400, detail=prep_error)
    
    if not is_dsa_language(request.language):
        raise HTTPException(status_code=400, detail=f"Unsupported language: {request.language}")
    
    submit_warnings = code_warnings if code_warnings else []
    
    # Build test cases array - PUBLIC + HIDDEN
    public_test_cases = []
    hidden_test_cases = []
    all_test_cases = []
    
    # Add public test cases
    for i, tc in enumerate(question.get("public_testcases", [])):
        tc_data = {
            "id": f"public_{i}",
            "stdin": tc.get("input", ""),
            "expected_output": tc.get("expected_output", ""),
            "is_hidden": False,
            "points": tc.get("points", 1),
        }
        public_test_cases.append(tc_data)
        all_test_cases.append(tc_data)
    
    # Add hidden test cases
    for i, tc in enumerate(question.get("hidden_testcases", [])):
        tc_data = {
            "id": f"hidden_{i}",
            "stdin": tc.get("input", ""),
            "expected_output": tc.get("expected_output", ""),
            "is_hidden": True,
            "points": tc.get("points", 1),
        }
        hidden_test_cases.append(tc_data)
        all_test_cases.append(tc_data)
    
    if not all_test_cases:
        raise HTTPException(status_code=400, detail="Question has no test cases")
    
    func_sig_data = question.get("function_signature")
    function_name = (func_sig_data.get("name") or "").strip() if func_sig_data else ""
    if not function_name:
        raise HTTPException(
            status_code=400,
            detail="Question must have function_signature.name for DSA execution",
        )

    # Run ALL test cases via DSA execution API
    results = await run_all_test_cases_dsa(
        source_code=prepared_code,
        test_cases=all_test_cases,
        function_name=function_name,
        language=request.language,
    )

    # Separate results into public and hidden
    public_results = []
    hidden_results = []
    hidden_passed = 0
    hidden_total = len(hidden_test_cases)
    
    all_results = results.get("results", [])
    
    # Process public test case results (full details)
    public_count = len(public_test_cases)
    for i in range(public_count):
        if i < len(all_results):
            public_results.append(format_public_result(all_results[i], i + 1))
    
    # Process hidden test case results (limited info for users)
    for i in range(public_count, len(all_results)):
        hidden_index = i - public_count
        result = all_results[i]
        hidden_results.append(format_hidden_result_for_user(result, hidden_index + 1))
        if result.get("passed", False):
            hidden_passed += 1
    
    # Calculate totals
    public_passed = sum(1 for r in public_results if r.get("passed", False))
    total_passed = public_passed + hidden_passed
    total_tests = len(public_test_cases) + hidden_total
    
    # Determine overall status
    if results.get("compilation_error"):
        status = "compilation_error"
    elif total_passed == total_tests:
        status = "accepted"
    elif total_passed > 0:
        status = "partially_accepted"
    else:
        status = "wrong_answer"
    
    # Save submission if user_id provided
    submission_id = None
    ai_feedback = None
    
    if user_id:
        # Store full results internally (for admin access)
        full_hidden_results = []
        for i in range(public_count, len(all_results)):
            hidden_index = i - public_count
            result = all_results[i]
            tc = hidden_test_cases[hidden_index]
            full_hidden_results.append(format_hidden_result_for_admin(
                result, hidden_index + 1, tc["stdin"], tc["expected_output"]
            ))
        
        language_name = request.language or "unknown"
        starter_code = None
        starter_code_dict = question.get("starter_code", {})
        if isinstance(starter_code_dict, dict):
            starter_code = starter_code_dict.get(language_name) or starter_code_dict.get((language_name or "").lower())
        
        # Generate AI feedback (async in background ideally, but sync for now)
        try:
            all_test_results = public_results + full_hidden_results
            ai_feedback = generate_code_feedback(
                source_code=request.source_code,
                language=language_name,
                question_title=question.get("title", "Unknown"),
                question_description=question.get("description", ""),
                test_results=all_test_results,
                total_passed=total_passed,
                total_tests=total_tests,
                time_spent_seconds=request.time_spent_seconds,
                public_passed=public_passed,
                public_total=len(public_test_cases),
                hidden_passed=hidden_passed,
                hidden_total=hidden_total,
                starter_code=starter_code,
            )
            logger.info(f"Generated AI feedback for submission")
        except Exception as e:
            logger.error(f"Failed to generate AI feedback: {e}")
            ai_feedback = {"error": str(e)}
        
        # Calculate execution stats
        total_execution_time = sum(
            float(r.get("time", 0) or 0) for r in all_results
        )
        max_memory_used = max(
            (r.get("memory", 0) or 0) for r in all_results
        ) if all_results else 0
        
        submission_record = {
            "user_id": user_id,
            "question_id": request.question_id,
            "source_code": request.source_code,
            "language": request.language,
            "language_name": language_name,
            "public_results": public_results,
            "hidden_results_full": full_hidden_results,  # Full details for admin
            "hidden_results_user": hidden_results,       # Limited for user
            "hidden_summary": {"total": hidden_total, "passed": hidden_passed},
            "total_passed": total_passed,
            "total_tests": total_tests,
            "score": results.get("score", 0),
            "max_score": results.get("max_score", 0),
            "status": status,
            "compilation_error": results.get("compilation_error", False),
            # Time tracking
            "started_at": request.started_at,
            "submitted_at": request.submitted_at or datetime.utcnow().isoformat(),
            "time_spent_seconds": request.time_spent_seconds,
            # Execution stats
            "total_execution_time": total_execution_time,
            "max_memory_used": max_memory_used,
            # AI feedback
            "ai_feedback": ai_feedback,
            # Metadata
            "created_at": datetime.utcnow(),
        }
        insert_result = await db.assessment_submissions.insert_one(submission_record)
        submission_id = str(insert_result.inserted_id)
        logger.info(f"Saved submission {submission_id} for user {user_id}")
    
    # Return response with LIMITED hidden test case info
    response = {
        "submission_id": submission_id,
        "question_id": request.question_id,
        "public_results": public_results,
        "hidden_results": hidden_results,  # Only pass/fail, no details
        "hidden_summary": {
            "total": hidden_total,
            "passed": hidden_passed,
        },
        "total_passed": total_passed,
        "total_tests": total_tests,
        "score": results.get("score", 0),
        "max_score": results.get("max_score", 0),
        "status": status,
        "compilation_error": results.get("compilation_error", False),
    }
    
    # Include warnings if user modified boilerplate incorrectly
    if submit_warnings:
        response["warnings"] = submit_warnings
    
    return response


@router.get("/admin/submission/{submission_id}")
async def get_submission_admin(
    submission_id: str,
    admin_key: str = Query(..., description="Admin authentication key"),
):
    """
    ADMIN ONLY - Get full submission details including hidden test case data.
    Returns complete information for all test cases (public + hidden).
    """
    # Simple admin key check (in production, use proper authentication)
    # TODO: Replace with proper admin authentication
    if admin_key != "admin_secret_key":  # Replace with secure auth
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    db = get_database()
    
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = await db.assessment_submissions.find_one({"_id": ObjectId(submission_id)})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Return FULL details including hidden test case data
    return {
        "submission_id": str(submission["_id"]),
        "user_id": submission.get("user_id"),
        "question_id": submission.get("question_id"),
        "source_code": submission.get("source_code"),
        "language": submission.get("language"),
        "language_name": submission.get("language_name", "unknown"),
        "public_results": submission.get("public_results", []),
        "hidden_results": submission.get("hidden_results_full", []),  # FULL details for admin
        "hidden_summary": submission.get("hidden_summary", {}),
        "total_passed": submission.get("total_passed", 0),
        "total_tests": submission.get("total_tests", 0),
        "score": submission.get("score", 0),
        "max_score": submission.get("max_score", 0),
        # Time tracking
        "started_at": submission.get("started_at"),
        "submitted_at": submission.get("submitted_at"),
        "time_spent_seconds": submission.get("time_spent_seconds"),
        # Execution stats
        "total_execution_time": submission.get("total_execution_time"),
        "max_memory_used": submission.get("max_memory_used"),
        # AI feedback
        "ai_feedback": submission.get("ai_feedback"),
        "status": submission.get("status"),
        "compilation_error": submission.get("compilation_error", False),
        "created_at": submission.get("created_at").isoformat() if submission.get("created_at") else None,
    }


@router.get("/admin/submissions")
async def get_all_submissions_admin(
    admin_key: str = Query(..., description="Admin authentication key"),
    question_id: Optional[str] = Query(None, description="Filter by question"),
    user_id: Optional[str] = Query(None, description="Filter by user"),
    limit: int = Query(50, description="Max submissions to return"),
    skip: int = Query(0, description="Number of submissions to skip"),
):
    """
    ADMIN ONLY - Get all submissions with full hidden test case details.
    """
    if admin_key != "admin_secret_key":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    db = get_database()
    
    # Build query filter
    query = {}
    if question_id:
        query["question_id"] = question_id
    if user_id:
        query["user_id"] = user_id
    
    submissions = await db.assessment_submissions.find(query)\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(length=limit)
    
    results = []
    for s in submissions:
        results.append({
            "submission_id": str(s["_id"]),
            "user_id": s.get("user_id"),
            "question_id": s.get("question_id"),
            "language_name": s.get("language_name", "unknown"),
            "status": s.get("status"),
            "total_passed": s.get("total_passed", 0),
            "total_tests": s.get("total_tests", 0),
            "score": s.get("score", 0),
            "max_score": s.get("max_score", 0),
            "hidden_summary": s.get("hidden_summary", {}),
            # Time tracking
            "time_spent_seconds": s.get("time_spent_seconds"),
            "total_execution_time": s.get("total_execution_time"),
            # AI feedback summary
            "ai_score": s.get("ai_feedback", {}).get("overall_score") if s.get("ai_feedback") else None,
            "created_at": s.get("created_at").isoformat() if s.get("created_at") else None,
        })
    
    return {"submissions": results, "count": len(results)}


@router.post("/admin/regenerate-feedback/{submission_id}")
async def regenerate_ai_feedback(
    submission_id: str,
    admin_key: str = Query(..., description="Admin authentication key"),
):
    """
    ADMIN ONLY - Regenerate AI feedback for an existing submission.
    Useful for submissions that were created before AI feedback was enabled.
    """
    if admin_key != "admin_secret_key":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    db = get_database()
    
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = await db.assessment_submissions.find_one({"_id": ObjectId(submission_id)})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Get question for context
    question = None
    if submission.get("question_id"):
        if ObjectId.is_valid(submission["question_id"]):
            question = await db.questions.find_one({"_id": ObjectId(submission["question_id"])})
        if not question:
            question = await db.questions.find_one({"_id": submission["question_id"]})
    
    language_name = submission.get("language") or submission.get("language_name", "unknown")

    # Combine all test results
    all_results = submission.get("public_results", []) + submission.get("hidden_results_full", [])
    
    # Generate AI feedback
    try:
        # Extract public/hidden breakdown from submission
        public_results = submission.get("public_results", [])
        hidden_results_full = submission.get("hidden_results_full", [])
        public_passed = sum(1 for r in public_results if r.get("passed", False))
        public_total = len(public_results)
        hidden_passed = sum(1 for r in hidden_results_full if r.get("passed", False))
        hidden_total = len(hidden_results_full)
        
        ai_feedback = generate_code_feedback(
            source_code=submission.get("source_code", ""),
            language=language_name,
            question_title=question.get("title", "Unknown") if question else "Unknown",
            question_description=question.get("description", "") if question else "",
            test_results=all_results,
            total_passed=submission.get("total_passed", 0),
            total_tests=submission.get("total_tests", 0),
            time_spent_seconds=submission.get("time_spent_seconds"),
            public_passed=public_passed,
            public_total=public_total,
            hidden_passed=hidden_passed,
            hidden_total=hidden_total,
        )
        
        # Update the submission with AI feedback
        await db.assessment_submissions.update_one(
            {"_id": ObjectId(submission_id)},
            {"$set": {"ai_feedback": ai_feedback}}
        )
        
        logger.info(f"Regenerated AI feedback for submission {submission_id}")
        
        return {
            "success": True,
            "submission_id": submission_id,
            "ai_feedback": ai_feedback
        }
        
    except Exception as e:
        logger.error(f"Failed to regenerate AI feedback: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate feedback: {str(e)}")


@router.post("/admin/regenerate-all-feedback")
async def regenerate_all_feedback(
    admin_key: str = Query(..., description="Admin authentication key"),
    limit: int = Query(100, description="Max submissions to process"),
):
    """
    ADMIN ONLY - Regenerate AI feedback for all submissions without feedback.
    """
    if admin_key != "admin_secret_key":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    db = get_database()
    
    # Find submissions without AI feedback
    submissions = await db.assessment_submissions.find({
        "$or": [
            {"ai_feedback": None},
            {"ai_feedback": {"$exists": False}}
        ]
    }).limit(limit).to_list(length=limit)
    
    processed = 0
    errors = 0
    
    for submission in submissions:
        try:
            submission_id = str(submission["_id"])
            
            # Get question for context
            question = None
            if submission.get("question_id"):
                if ObjectId.is_valid(submission["question_id"]):
                    question = await db.questions.find_one({"_id": ObjectId(submission["question_id"])})
                if not question:
                    question = await db.questions.find_one({"_id": submission["question_id"]})
            
            language_name = submission.get("language") or submission.get("language_name", "unknown")

            # Combine all test results
            all_results = submission.get("public_results", []) + submission.get("hidden_results_full", [])
            
            # Generate AI feedback
            # Extract public/hidden breakdown from submission
            public_results = submission.get("public_results", [])
            hidden_results_full = submission.get("hidden_results_full", [])
            public_passed = sum(1 for r in public_results if r.get("passed", False))
            public_total = len(public_results)
            hidden_passed = sum(1 for r in hidden_results_full if r.get("passed", False))
            hidden_total = len(hidden_results_full)
            
            ai_feedback = generate_code_feedback(
                source_code=submission.get("source_code", ""),
                language=language_name,
                question_title=question.get("title", "Unknown") if question else "Unknown",
                question_description=question.get("description", "") if question else "",
                test_results=all_results,
                total_passed=submission.get("total_passed", 0),
                total_tests=submission.get("total_tests", 0),
                time_spent_seconds=submission.get("time_spent_seconds"),
                public_passed=public_passed,
                public_total=public_total,
                hidden_passed=hidden_passed,
                hidden_total=hidden_total,
            )
            
            # Update the submission
            await db.assessment_submissions.update_one(
                {"_id": submission["_id"]},
                {"$set": {"ai_feedback": ai_feedback}}
            )
            
            processed += 1
            
        except Exception as e:
            logger.error(f"Failed to process submission {submission.get('_id')}: {e}")
            errors += 1
    
    return {
        "success": True,
        "processed": processed,
        "errors": errors,
        "total_found": len(submissions)
    }


# Keep backward compatibility with old endpoint
@router.post("/run-tests")
async def run_question_tests(
    request: SubmitCodeRequest,
    user_id: str = Query(None, description="Optional user ID for tracking"),
):
    """
    Legacy endpoint - redirects to submit endpoint.
    Kept for backward compatibility.
    """
    return await submit_code(request, user_id)


@router.get("/submissions/{question_id}")
async def get_question_submissions(
    question_id: str,
    user_id: str = Query(..., description="User ID"),
    limit: int = Query(10, description="Max submissions to return"),
):
    """
    Get submission history for a question by a user.
    Returns user-safe version (no hidden test case details).
    """
    db = get_database()
    
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    submissions = await db.assessment_submissions.find({
        "question_id": question_id,
        "user_id": user_id,
    }).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    result = []
    for s in submissions:
        result.append({
            "id": str(s["_id"]),
            "question_id": s.get("question_id"),
            "public_results": s.get("public_results", []),
            "hidden_results": s.get("hidden_results_user", []),  # Limited info only
            "hidden_summary": s.get("hidden_summary", {}),
            "total_passed": s.get("total_passed", 0),
            "total_tests": s.get("total_tests", 0),
            "score": s.get("score", 0),
            "max_score": s.get("max_score", 0),
            "status": s.get("status", "unknown"),
            "created_at": s.get("created_at").isoformat() if s.get("created_at") else None,
        })
    
    return result


@router.get("/languages")
async def get_languages_list():
    """Get list of supported DSA languages (10 only)."""
    return {"languages": get_supported_languages()}


class ValidateCodeRequest(BaseModel):
    source_code: str
    language: str  # e.g. "python", "java", "cpp"
    question_id: Optional[str] = None


@router.post("/validate-code")
async def validate_code_endpoint(request: ValidateCodeRequest):
    """
    Validate user code without executing it.
    
    Checks for:
    - Forbidden patterns (main, print, input, Scanner, etc.)
    - Potential hardcoding
    
    Returns validation result with specific error messages.
    """
    if not is_dsa_language(request.language):
        raise HTTPException(status_code=400, detail=f"Unsupported language: {request.language}")
    language = request.language
    
    # Validate for forbidden patterns
    is_valid, error = validate_user_code(request.source_code, language)
    
    if not is_valid:
        return {
            "valid": False,
            "error": error,
            "error_type": "forbidden_pattern"
        }
    
    # Check for hardcoding if question_id provided
    if request.question_id:
        db = get_database()
        if ObjectId.is_valid(request.question_id):
            question = await db.questions.find_one({"_id": ObjectId(request.question_id)})
            if question:
                expected_outputs = []
                for tc in question.get("public_testcases", []):
                    expected_outputs.append(tc.get("expected_output", ""))
                for tc in question.get("hidden_testcases", []):
                    expected_outputs.append(tc.get("expected_output", ""))
                
                is_hardcoded, warning = detect_hardcoding(request.source_code, expected_outputs)
                if is_hardcoded:
                    return {
                        "valid": True,
                        "warning": warning,
                        "warning_type": "potential_hardcoding"
                    }
    
    return {
        "valid": True,
        "message": "Code validation passed"
    }


# ============================================================================
# SQL Execution Endpoints (SQL engine only)
# ============================================================================

class RunSQLRequest(BaseModel):
    """Request for running SQL query"""
    question_id: str
    sql_query: str


class SubmitSQLRequest(BaseModel):
    """Request for submitting SQL query"""
    question_id: str
    sql_query: str
    started_at: Optional[str] = None
    submitted_at: Optional[str] = None
    time_spent_seconds: Optional[int] = None
    # Execution engine results - if provided, backend will use these instead of re-executing
    execution_engine_passed: Optional[bool] = None
    execution_engine_output: Optional[str] = None
    execution_engine_time: Optional[float] = None
    execution_engine_memory: Optional[float] = None


def parse_sql_table_output(output: str) -> Tuple[List[str], List[List[str]]]:
    """
    Parse SQL table output into headers and data rows.
    Handles pipe-separated, tab-separated, or space-aligned formats.
    
    Returns: (headers, rows) where headers is list of column names, rows is list of row data
    """
    if not output or not output.strip():
        return [], []
    
    lines = [line.strip() for line in output.strip().split('\n') if line.strip()]
    if not lines:
        return [], []
    
    # Filter out separator lines (like "--- | ---" or "---")
    data_lines = [line for line in lines if not re.match(r'^[\s|\-:]+$', line)]
    if not data_lines:
        return [], []
    
    # Detect separator type from first line
    first_line = data_lines[0]
    has_pipes = '|' in first_line
    has_tabs = '\t' in first_line
    
    # Parse headers (first line) - be strict about parsing
    if has_pipes:
        # Pipe-separated: split by | and filter empty strings
        headers = [col.strip() for col in first_line.split('|') if col.strip()]
    elif has_tabs:
        # Tab-separated: split by tab
        headers = [col.strip() for col in first_line.split('\t') if col.strip()]
    else:
        # Space-aligned: split by 2+ spaces
        headers = [col.strip() for col in re.split(r'\s{2,}', first_line) if col.strip()]
    
    if not headers:
        return [], []
    
    # Parse data rows (remaining lines) - use same separator as headers
    rows = []
    for line in data_lines[1:]:
        if has_pipes:
            row = [col.strip() for col in line.split('|') if col.strip()]
        elif has_tabs:
            row = [col.strip() for col in line.split('\t') if col.strip()]
        else:
            row = [col.strip() for col in re.split(r'\s{2,}', line) if col.strip()]
        
        # Only add rows with same number of columns as headers
        # This ensures data integrity
        if len(row) == len(headers):
            rows.append(row)
        else:
            # Log mismatch for debugging
            logger.debug(f"Row column count mismatch: expected {len(headers)}, got {len(row)}. Row: {row}")
    
    return headers, rows


def compare_sql_results(user_output: str, expected_output: str, order_sensitive: bool = False) -> bool:
    """
    Compare SQL query results with STRICT matching.
    
    Test case only passes if outputs match EXACTLY (same columns, same data values).
    If order_sensitive is False, compares data rows as sets (order doesn't matter).
    If order_sensitive is True, compares data rows in order (exact match required).
    
    Returns False if outputs don't match exactly.
    """
    if not user_output or not expected_output:
        return user_output.strip() == expected_output.strip()
    
    # Parse both outputs into structured data
    user_headers, user_rows = parse_sql_table_output(user_output)
    expected_headers, expected_rows = parse_sql_table_output(expected_output)
    
    # Log parsing results for debugging
    logger.info(
        f"SQL comparison - Parsed results:\n"
        f"  User: {len(user_headers)} headers = {user_headers}, {len(user_rows)} rows\n"
        f"  Expected: {len(expected_headers)} headers = {expected_headers}, {len(expected_rows)} rows"
    )
    
    # CRITICAL: Compare headers first - must match exactly (column names and order)
    # If headers don't match, test case FAILS immediately
    if user_headers != expected_headers:
        missing_cols = set(expected_headers) - set(user_headers)
        extra_cols = set(user_headers) - set(expected_headers)
        logger.error(
            f"❌❌❌ Header mismatch detected - TEST CASE FAILED:\n"
            f"  User headers ({len(user_headers)}): {user_headers}\n"
            f"  Expected headers ({len(expected_headers)}): {expected_headers}\n"
            f"  Missing in user: {missing_cols}\n"
            f"  Extra in user: {extra_cols}\n"
            f"  Returning False - test case MUST FAIL"
        )
        # Force return False - headers don't match
        return False
    
    # Double-check header count as safety measure
    if len(user_headers) != len(expected_headers):
        logger.error(
            f"❌❌❌ Header count mismatch:\n"
            f"  User: {len(user_headers)} headers\n"
            f"  Expected: {len(expected_headers)} headers\n"
            f"  Returning False"
        )
        return False
    
    # If we get here, headers match - log for debugging
    logger.info(f"✅ Headers match: {user_headers}")
    
    # Compare number of rows
    if len(user_rows) != len(expected_rows):
        logger.warning(
            f"Row count mismatch: user has {len(user_rows)} rows, expected {len(expected_rows)} rows"
        )
        return False
    
    # Compare data rows
    if not order_sensitive:
        # Compare as sets (order doesn't matter, but data must match exactly)
        # Convert rows to tuples for set comparison
        user_row_set = {tuple(row) for row in user_rows}
        expected_row_set = {tuple(row) for row in expected_rows}
        
        if user_row_set != expected_row_set:
            logger.warning(
                f"Row data mismatch:\n"
                f"  User rows: {user_row_set}\n"
                f"  Expected rows: {expected_row_set}\n"
                f"  Missing rows: {expected_row_set - user_row_set}\n"
                f"  Extra rows: {user_row_set - expected_row_set}"
            )
            return False
    else:
        # Order-sensitive: rows must match in exact order
        for i, (user_row, expected_row) in enumerate(zip(user_rows, expected_rows)):
            if user_row != expected_row:
                logger.warning(
                    f"Row {i} mismatch:\n"
                    f"  User row: {user_row}\n"
                    f"  Expected row: {expected_row}"
                )
                return False
    
    logger.info("SQL output comparison passed: headers and all data rows match")
    return True


@router.post("/assessment/run-sql")
async def run_sql(request: RunSQLRequest):
    """
    RUN SQL - Execute SQL query against sample data using SQL Execution Engine.
    Returns the query results for preview.
    Used when user clicks "Run" button on SQL questions.
    """
    logger.info(f"Running SQL for question {request.question_id}")
    
    db = get_database()
    
    # Validate question ID
    if not ObjectId.is_valid(request.question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    question = await db.questions.find_one({"_id": ObjectId(request.question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Verify this is a SQL question
    question_type = question.get("question_type", "").upper()
    if question_type != "SQL":
        raise HTTPException(status_code=400, detail="This endpoint is for SQL questions only")
    
    # Get groupId from question (or ensure it exists)
    group_id = question.get("groupId")
    sql_service = get_sql_question_service()

    if not group_id:
        logger.info(f"Question {request.question_id} has no groupId, attempting to create seed")
        group_id = await sql_service.ensure_question_has_seed(question, db)
        if not group_id:
            raise HTTPException(
                status_code=503,
                detail="SQL engine unavailable. Ensure SQL_ENGINE_URL is set and question has schemas/sample_data.",
            )

    # Use SQL Execution Engine
    try:
        question_id_str = str(question.get("_id"))
        result = await sql_service.execute_query(
            question_id=question_id_str,
            sql_code=request.sql_query,
            group_id=group_id
        )
        
        # Format response to match expected format
        if result.get("success"):
            status = "executed"
            message = "Query executed successfully"
            output = result.get("output", [])
            # Convert output to string format if needed
            if isinstance(output, list):
                # Format as table if it's a list of dicts
                if output and isinstance(output[0], dict):
                    # Convert to string representation
                    import json
                    output = json.dumps(output, indent=2)
                else:
                    output = str(output)
            else:
                output = str(output)
        else:
            status = "error"
            message = result.get("error", "SQL execution failed")
            output = ""
        
        return {
            "question_id": request.question_id,
            "status": status,
            "message": message,
            "output": output,
            "error": result.get("error", ""),
            "outputs": result.get("outputs", []),
        }
        
    except Exception as e:
        logger.error(f"Error executing SQL via engine: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute SQL query: {str(e)}"
        )


@router.post("/assessment/submit-sql")
async def submit_sql(
    request: SubmitSQLRequest,
    user_id: str = Query(None, description="User ID for tracking submission"),
):
    """
    SUBMIT SQL - Execute SQL query and compare with expected result using SQL Execution Engine.
    Used when user clicks "Submit" button on SQL questions.
    
    The question should have a reference_query that produces the expected output.
    """
    logger.info(f"Submitting SQL for question {request.question_id}")
    
    db = get_database()
    
    # Validate question ID
    if not ObjectId.is_valid(request.question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    question = await db.questions.find_one({"_id": ObjectId(request.question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Verify this is a SQL question
    question_type = question.get("question_type", "").upper()
    if question_type != "SQL":
        raise HTTPException(status_code=400, detail="This endpoint is for SQL questions only")
    
    # Get reference query and other question data
    reference_query = question.get("reference_query")
    schemas = question.get("schemas", {})
    sample_data = question.get("sample_data", {})
    evaluation = question.get("evaluation", {})
    order_sensitive = evaluation.get("order_sensitive", False)
    
    if not reference_query:
        raise HTTPException(status_code=400, detail="Question has no reference_query defined")
    
    # Get groupId from question (or ensure it exists)
    group_id = question.get("groupId")
    sql_service = get_sql_question_service()
    question_id_str = str(question.get("_id"))
    
    # If no groupId, try to create one
    if not group_id:
        logger.info(f"Question {request.question_id} has no groupId, attempting to create seed")
        if not schemas:
            raise HTTPException(status_code=400, detail="Question has no table schemas defined")
        group_id = await sql_service.ensure_question_has_seed(question, db)
        
        if not group_id:
            logger.warning("Failed to create seed for SQL question")
            raise HTTPException(
                status_code=500,
                detail="Failed to create seed for question. Please ensure question has schemas and sample_data."
            )
    
    # Generate expected output from reference query
    try:
        expected_output = await sql_service.generate_expected_output(
            question_id=question_id_str,
            reference_query=reference_query,
            group_id=group_id
        )
    except Exception as e:
        logger.error(f"Failed to generate expected output: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate expected output from reference query: {str(e)}"
        )
    
    # Submit query via SQL engine
    try:
        result = await sql_service.submit_query(
            question_id=question_id_str,
            sql_code=request.sql_query,
            expected_output=expected_output,
            group_id=group_id
        )
        
        passed = result.get("passed", False)
        actual_output = result.get("actualOutput", [])
        error = result.get("error")
        reason = result.get("reason")
        
        # Convert actual_output to string for display
        if isinstance(actual_output, list):
            if actual_output and isinstance(actual_output[0], dict):
                actual_output_str = json.dumps(actual_output, indent=2)
            else:
                actual_output_str = str(actual_output)
        else:
            actual_output_str = str(actual_output) if actual_output else ""
        
        # Convert expected_output to string for display
        if isinstance(expected_output, list):
            if expected_output and isinstance(expected_output[0], dict):
                expected_output_str = json.dumps(expected_output, indent=2)
            else:
                expected_output_str = str(expected_output)
        else:
            expected_output_str = str(expected_output) if expected_output else ""
        
        # Handle SQL errors
        if error:
            status = "error"
            message = f"SQL execution error: {error}"
            passed = False
        elif passed:
            status = "accepted"
            message = "Query produces correct results!"
        else:
            status = "wrong_answer"
            message = reason or "Query output does not match expected results"
        
    except Exception as e:
        logger.error(f"Error submitting SQL via engine: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit SQL query: {str(e)}"
        )
    
    # AI Evaluation
    ai_evaluation = None
    ai_score = 100 if passed else 0
    ai_max_marks = question.get("marks", 100)
    
    try:
        # Prepare test result with expected output for AI evaluation
        test_result_data = {
            "passed": passed,
            "user_result": {"success": not bool(error), "stdout": actual_output_str},
            "reference_result": None,
            "error": error,
            "expected_output": expected_output_str if expected_output_str else None,
            "user_output": actual_output_str if actual_output_str else None,
        }
        
        ai_evaluation = await evaluate_sql_answer(
            question_id=request.question_id,
            question_description=question.get("questionText") or question.get("question", ""),
            user_query=request.sql_query,
            reference_query=reference_query,
            max_marks=ai_max_marks,
            section=None,
            schemas=schemas,
            test_result=test_result_data,
            order_sensitive=order_sensitive,
            difficulty=question.get("difficulty", "Medium")
        )
        
        # Use AI score instead of binary
        ai_score = ai_evaluation.get("score", ai_score)
        ai_max_marks = ai_evaluation.get("max_marks", ai_max_marks)
        
        logger.info(f"SQL AI evaluation completed: score={ai_score}/{ai_max_marks}, passed={passed}")
        
    except Exception as e:
        logger.exception(f"AI evaluation failed for SQL question {request.question_id}: {e}")
        # Fallback to binary scoring if AI evaluation fails
        ai_score = 100 if passed else 0
    
    # Create test case result structure for consistency with coding questions
    test_case_result = {
        "id": "sql_test_1",
        "test_number": 1,
        "input": "",  # SQL doesn't have input test cases
        "expected_output": expected_output_str if expected_output_str else "",
        "user_output": actual_output_str if actual_output_str else "",
        "status": status,
        "status_id": 3 if passed else (4 if not error else 6),  # 3 = accepted, 4 = wrong answer, 6 = error
        "time": None,  # Engine doesn't return time
        "memory": None,  # Engine doesn't return memory
        "passed": bool(passed),
    }
    
    public_summary_passed = 1 if passed else 0
    
    logger.info(
        f"SQL submission result for question {request.question_id}: "
        f"passed={passed}, status={status}, public_summary_passed={public_summary_passed}"
    )
    
    response = {
        "question_id": request.question_id,
        "status": status,
        "passed": bool(passed),
        "message": message,
        "user_output": actual_output_str if actual_output_str else "",
        "expected_output": expected_output_str if not passed and expected_output_str else None,
        "error": error if error else "",
        "score": ai_score,
        "max_score": ai_max_marks,
        "ai_evaluation": ai_evaluation,
        "test_case_result": test_case_result,
        "public_results": [test_case_result],
        "public_summary": {
            "total": 1,
            "passed": public_summary_passed
        },
    }
    
    # Save submission if user_id provided
    if user_id:
        # Save to sql_submissions for tracking
        submission_record = {
            "user_id": user_id,
            "question_id": request.question_id,
            "question_type": "SQL",
            "sql_query": request.sql_query,
            "user_output": user_output,
            "expected_output": expected_output,
            "passed": passed,
            "status": status,
            "score": ai_score,  # Use AI score
            "max_score": ai_max_marks,  # Use AI max marks
            "ai_evaluation": ai_evaluation,  # Store full AI evaluation
            "started_at": request.started_at,
            "submitted_at": request.submitted_at or datetime.utcnow().isoformat(),
            "time_spent_seconds": request.time_spent_seconds,
            "execution_time": user_result.get("time"),
            "memory_used": user_result.get("memory"),
            "created_at": datetime.utcnow(),
        }
        insert_result = await db.sql_submissions.insert_one(submission_record)
        response["submission_id"] = str(insert_result.inserted_id)
        
        # CRITICAL: Also save to submissions collection with test case counts (0/1 or 1/1)
        # This is what analytics uses to display test case counts
        # Use execution engine's passed status to determine test case count
        passed_testcases = 1 if passed else 0
        total_testcases = 1
        
        submission_data = {
            "user_id": user_id,
            "question_id": request.question_id,
            "test_id": None,  # Will be set during final-submit
            "language": "sql",
            "code": request.sql_query,
            "status": status,
            "test_results": [test_case_result],  # Single test case for SQL
            "passed_testcases": passed_testcases,  # 0 or 1 based on execution engine result
            "total_testcases": total_testcases,  # Always 1 for SQL
            "public_passed": passed_testcases,
            "public_total": total_testcases,
            "hidden_passed": 0,
            "hidden_total": 0,
            "execution_time": user_result.get("time"),
            "memory_used": user_result.get("memory"),
            "ai_feedback": ai_evaluation,
            "score": ai_score,
            "max_score": ai_max_marks,
            "created_at": datetime.utcnow(),
            "is_final_submission": False,  # This is a regular submission, not final
        }
        submission_insert = await db.submissions.insert_one(submission_data)
        response["submission_record_id"] = str(submission_insert.inserted_id)
        
        logger.info(
            f"Saved SQL submission for user {user_id}: "
            f"passed={passed}, test_cases={passed_testcases}/{total_testcases}"
        )
    
    return response


# ============================================================================
# SQL EXECUTION ENGINE PROXY ENDPOINTS
# These endpoints proxy requests to the SQL execution engine to avoid CORS issues
# ============================================================================

class SQLExecuteRequest(BaseModel):
    """Request for executing SQL via SQL execution engine"""
    questionId: str
    code: str
    schemas: Optional[Dict[str, Any]] = None
    sample_data: Optional[Dict[str, Any]] = None


class SQLSubmitRequest(BaseModel):
    """Request for submitting SQL via SQL execution engine"""
    questionId: str
    code: str
    expectedOutput: Optional[List[Dict[str, Any]]] = None
    schemas: Optional[Dict[str, Any]] = None
    sample_data: Optional[Dict[str, Any]] = None


@router.post("/assessment/sql-engine/execute")
async def proxy_sql_execute(request: SQLExecuteRequest):
    """
    Proxy endpoint for SQL execution engine /api/execute
    This avoids CORS issues by routing requests through the backend
    
    Now uses groupId from question instead of schemas/sample_data
    """
    logger.info(f"Proxying SQL execute request for question {request.questionId}")
    
    db = get_database()
    
    # Get question to retrieve groupId
    if not ObjectId.is_valid(request.questionId):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    question = await db.questions.find_one({"_id": ObjectId(request.questionId)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Get groupId from question (or ensure it exists)
    group_id = question.get("groupId")
    sql_service = get_sql_question_service()
    
    # If no groupId, try to create one
    if not group_id:
        logger.info(f"Question {request.questionId} has no groupId, attempting to create seed")
        group_id = await sql_service.ensure_question_has_seed(question, db)
        
        if not group_id:
            raise HTTPException(
                status_code=400,
                detail="Question has no groupId and seed creation failed. Please ensure question has schemas and sample_data."
            )
    
    # Use SQL engine client directly
    try:
        question_id_str = str(question.get("_id"))
        result = await sql_service.execute_query(
            question_id=question_id_str,
            sql_code=request.code,
            group_id=group_id
        )
        return result
    except Exception as e:
        logger.error(f"Error proxying SQL execute: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute SQL query: {str(e)}"
        )


@router.post("/assessment/sql-engine/submit")
async def proxy_sql_submit(request: SQLSubmitRequest):
    """
    Proxy endpoint for SQL execution engine /api/submit
    This avoids CORS issues by routing requests through the backend
    
    Now uses groupId from question instead of schemas/sample_data
    """
    logger.info(f"Proxying SQL submit request for question {request.questionId}")
    
    db = get_database()
    
    # Get question to retrieve groupId and reference_query
    if not ObjectId.is_valid(request.questionId):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    question = await db.questions.find_one({"_id": ObjectId(request.questionId)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Get groupId from question (or ensure it exists)
    group_id = question.get("groupId")
    sql_service = get_sql_question_service()
    question_id_str = str(question.get("_id"))
    
    # If no groupId, try to create one
    if not group_id:
        logger.info(f"Question {request.questionId} has no groupId, attempting to create seed")
        group_id = await sql_service.ensure_question_has_seed(question, db)
        
        if not group_id:
            raise HTTPException(
                status_code=400,
                detail="Question has no groupId and seed creation failed. Please ensure question has schemas and sample_data."
            )
    
    # Get expected output (from request or generate from reference_query)
    expected_output = request.expectedOutput
    if not expected_output:
        reference_query = question.get("reference_query")
        if reference_query:
            try:
                expected_output = await sql_service.generate_expected_output(
                    question_id=question_id_str,
                    reference_query=reference_query,
                    group_id=group_id
                )
            except Exception as e:
                logger.error(f"Failed to generate expected output: {e}", exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to generate expected output from reference query: {str(e)}"
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="Question has no reference_query and expectedOutput was not provided"
            )
    
    # Use SQL engine client directly
    try:
        result = await sql_service.submit_query(
            question_id=question_id_str,
            sql_code=request.code,
            expected_output=expected_output,
            group_id=group_id
        )
        return result
    except Exception as e:
        logger.error(f"Error proxying SQL submit: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit SQL query: {str(e)}"
        )


class SQLSchemaRequest(BaseModel):
    """Request model for SQL schema proxy endpoint"""
    questionId: str
    groupId: Optional[str] = None


@router.post("/assessment/sql-engine/schema")
async def proxy_sql_schema(request: SQLSchemaRequest):
    """
    Proxy endpoint for SQL execution engine /api/schema
    This avoids CORS issues by routing requests through the backend
    
    Returns the database schema (table structure with column types and all data)
    for the given questionId and optional groupId.
    """
    logger.info(f"Proxying SQL schema request for question {request.questionId}")
    
    db = get_database()
    
    # Get question to retrieve groupId if not provided
    if not ObjectId.is_valid(request.questionId):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    question = await db.questions.find_one({"_id": ObjectId(request.questionId)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Use groupId from request, or fall back to question's groupId
    group_id = request.groupId or question.get("groupId")
    sql_service = get_sql_question_service()
    question_id_str = str(question.get("_id"))
    
    # If no groupId, try to create one
    if not group_id:
        logger.info(f"Question {request.questionId} has no groupId, attempting to create seed")
        group_id = await sql_service.ensure_question_has_seed(question, db)
        
        if not group_id:
            raise HTTPException(
                status_code=400,
                detail="Question has no groupId and seed creation failed. Please ensure question has schemas and sample_data."
            )
    
    # Use SQL engine client directly
    try:
        result = await sql_service.get_schema_for_question(
            question_id=question_id_str,
            group_id=group_id
        )
        return result
    except Exception as e:
        logger.error(f"Error proxying SQL schema: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch SQL schema: {str(e)}"
        )
