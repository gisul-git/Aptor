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
- SQL questions use Judge0 SQLite (language_id 82)
- run-sql: Execute query and show results
- submit-sql: Compare results with reference query
"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..database import get_dsa_database as get_database
from ..utils.judge0 import run_all_test_cases, run_test_case, LANGUAGE_IDS
from ..services.ai_feedback import generate_code_feedback
from ...assessments.services.unified_ai_evaluation import evaluate_sql_answer

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
    language_id: int


class SubmitCodeRequest(BaseModel):
    """Request for submitting code (all test cases)"""
    question_id: str
    source_code: str
    language_id: int
    # Time tracking fields
    started_at: Optional[str] = None  # ISO timestamp when user started the question
    submitted_at: Optional[str] = None  # ISO timestamp when user submitted
    time_spent_seconds: Optional[int] = None  # Total time spent in seconds


class RunSingleTestRequest(BaseModel):
    source_code: str
    language_id: int
    stdin: str
    expected_output: str = ""
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

# Language name to ID mapping - use the same as app.utils.judge0
# This ensures consistency across the application
def get_language_name(language_id: int) -> Optional[str]:
    """Get language name from Judge0 language ID."""
    # Use LANGUAGE_IDS from app.utils.judge0 which has all 10 DSA languages
    for name, lid in LANGUAGE_IDS.items():
        if lid == language_id:
            return name
    return None


async def prepare_code_for_execution(
    source_code: str,
    language_id: int,
    question: Dict[str, Any]
) -> Tuple[str, Optional[str], List[str]]:
    """
    Prepare user code for execution.
    
    For Java/Python with custom engine: Returns raw code (no wrapping needed).
    For other languages with Judge0: Wraps code as before.
    
    Hybrid approach:
    1. If custom engine (Java/Python) → return raw code
    2. If secure_mode=False → pass code as-is (legacy mode)
    3. If secure_mode=True:
       a. Validate code for forbidden I/O patterns
       b. Check for hardcoding
       c. Use wrapper_template if defined by admin
       d. Otherwise, auto-wrap for known languages
    
    Returns:
        (prepared_code, error_message, warnings_list)
    """
    from ..config import USE_CUSTOM_ENGINE
    
    warnings = []
    secure_mode = question.get("secure_mode", False)
    
    language = get_language_name(language_id)
    if not language:
        language = str(language_id)
    
    # Get function name from question for validation
    func_name = None
    func_sig = question.get("function_signature")
    if func_sig:
        func_name = func_sig.get("name")
    
    # Check for forbidden boilerplate modifications (always check, even in non-secure mode)
    is_valid_boilerplate, boilerplate_warnings = validate_boilerplate_not_modified(
        source_code, language, func_name
    )
    if not is_valid_boilerplate:
        warnings.extend(boilerplate_warnings)
    
    # For custom engine (Java/Python), return raw code - no wrapping needed
    if USE_CUSTOM_ENGINE and language in ["java", "python"]:
        logger.info(f"Using custom engine for {language} - returning raw code (no wrapping)")
        return source_code, None, warnings
    
    # For Judge0 (other languages or when custom engine is disabled)
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
    Useful for quick testing during development.
    """
    logger.info(f"Running single test case with language_id={request.language_id}")
    
    result = await run_test_case(
        source_code=request.source_code,
        language_id=request.language_id,
        stdin=request.stdin,
        expected_output=request.expected_output,
        cpu_time_limit=request.cpu_time_limit,
        memory_limit=request.memory_limit,
    )
    
    return {
        "success": result["passed"],
        "result": result,
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
        language_id=request.language_id,
        question=question
    )
    
    if prep_error:
        raise HTTPException(status_code=400, detail=prep_error)
    
    # Build test cases array - PUBLIC ONLY
    test_cases = []
    for i, tc in enumerate(question.get("public_testcases", [])):
        test_cases.append({
            "id": f"public_{i}",
            "stdin": tc.get("input", ""),
            "expected_output": tc.get("expected_output", ""),
            "is_hidden": False,
            "points": tc.get("points", 1),
        })
    
    if not test_cases:
        raise HTTPException(status_code=400, detail="Question has no public test cases")
    
    # Get execution constraints (default values)
    # Note: question.constraints is a list of constraint strings, not a dict
    cpu_time_limit = 2.0
    memory_limit = 128000
    
    # Get function signature for custom engine
    function_signature = None
    func_sig_data = question.get("function_signature")
    if func_sig_data:
        from ..models.question import FunctionSignature, FunctionParameter
        function_signature = FunctionSignature(
            name=func_sig_data.get("name"),
            parameters=[
                FunctionParameter(name=p.get("name"), type=p.get("type"))
                for p in func_sig_data.get("parameters", [])
            ],
            return_type=func_sig_data.get("return_type")
        )
    
    # Run public test cases only with prepared code
    results = await run_all_test_cases(
        source_code=prepared_code,
        language_id=request.language_id,
        test_cases=test_cases,
        cpu_time_limit=cpu_time_limit,
        memory_limit=memory_limit,
        stop_on_compilation_error=True,
        function_signature=function_signature,
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
        language_id=request.language_id,
        question=question
    )
    
    if prep_error:
        raise HTTPException(status_code=400, detail=prep_error)
    
    # Store warnings to include in response
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
    
    # Get execution constraints (default values)
    # Note: question.constraints is a list of constraint strings, not a dict
    cpu_time_limit = 2.0
    memory_limit = 128000
    
    # Get function signature for custom engine
    function_signature = None
    func_sig_data = question.get("function_signature")
    if func_sig_data:
        from ..models.question import FunctionSignature, FunctionParameter
        function_signature = FunctionSignature(
            name=func_sig_data.get("name"),
            parameters=[
                FunctionParameter(name=p.get("name"), type=p.get("type"))
                for p in func_sig_data.get("parameters", [])
            ],
            return_type=func_sig_data.get("return_type")
        )
    
    # Run ALL test cases with prepared code
    results = await run_all_test_cases(
        source_code=prepared_code,
        language_id=request.language_id,
        test_cases=all_test_cases,
        cpu_time_limit=cpu_time_limit,
        memory_limit=memory_limit,
        stop_on_compilation_error=True,
        function_signature=function_signature,
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
        
        # Get language name from ID
        language_name = next(
            (name for name, lid in LANGUAGE_IDS.items() if lid == request.language_id),
            "unknown"
        )
        
        # Get starter code for the language
        starter_code = None
        starter_code_dict = question.get("starter_code", {})
        if isinstance(starter_code_dict, dict):
            starter_code = starter_code_dict.get(language_name) or starter_code_dict.get(language_name.lower())
        
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
            "language_id": request.language_id,
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
        "language_id": submission.get("language_id"),
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
    
    # Get language name
    language_name = submission.get("language_name", "unknown")
    if language_name == "unknown":
        lang_id = submission.get("language_id")
        language_name = next(
            (name for name, lid in LANGUAGE_IDS.items() if lid == lang_id),
            "unknown"
        )
    
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
            
            # Get language name
            language_name = submission.get("language_name", "unknown")
            if language_name == "unknown":
                lang_id = submission.get("language_id")
                language_name = next(
                    (name for name, lid in LANGUAGE_IDS.items() if lid == lang_id),
                    "unknown"
                )
            
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
async def get_supported_languages():
    """
    Get list of supported programming languages with their Judge0 IDs.
    """
    return {
        "languages": [
            {"id": lid, "name": name}
            for name, lid in LANGUAGE_IDS.items()
        ]
    }


class ValidateCodeRequest(BaseModel):
    source_code: str
    language_id: int
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
    language = get_language_name(request.language_id)
    if not language:
        raise HTTPException(status_code=400, detail=f"Unsupported language ID: {request.language_id}")
    
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
# SQL Execution Endpoints (Judge0 SQLite)
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


def build_sql_script(
    schemas: Dict[str, Any],
    sample_data: Dict[str, Any],
    user_query: str,
    reference_query: Optional[str] = None
) -> str:
    """
    Build a complete SQL script for Judge0 SQLite execution.
    
    The script:
    1. Creates all tables from schemas
    2. Inserts sample data
    3. Runs the user's query
    4. Optionally runs reference query for comparison
    """
    script_parts = []
    
    # 1. Create tables
    for table_name, table_def in schemas.items():
        columns = table_def.get("columns", {})
        if not columns:
            continue
        
        column_defs = []
        for col_name, col_type in columns.items():
            # Convert common data types to SQLite compatible types
            sqlite_type = col_type.upper()
            # SQLite type mappings
            if "VARCHAR" in sqlite_type or "CHAR" in sqlite_type:
                sqlite_type = "TEXT"
            elif "INT" in sqlite_type:
                sqlite_type = "INTEGER"
            elif "DECIMAL" in sqlite_type or "FLOAT" in sqlite_type or "DOUBLE" in sqlite_type:
                sqlite_type = "REAL"
            elif "BOOL" in sqlite_type:
                sqlite_type = "INTEGER"  # SQLite uses 0/1 for boolean
            elif "DATE" in sqlite_type or "TIME" in sqlite_type:
                sqlite_type = "TEXT"  # SQLite stores dates as text
            
            # Keep PRIMARY KEY if present
            if "PRIMARY KEY" in col_type.upper():
                sqlite_type = sqlite_type.replace("PRIMARY KEY", "").strip() + " PRIMARY KEY"
            
            column_defs.append(f"    {col_name} {sqlite_type}")
        
        create_stmt = f"CREATE TABLE {table_name} (\n{','.join(column_defs)}\n);"
        script_parts.append(create_stmt)
    
    # 2. Insert sample data
    for table_name, rows in sample_data.items():
        if not rows or table_name not in schemas:
            continue
        
        # Get column names from schema
        columns = list(schemas[table_name].get("columns", {}).keys())
        if not columns:
            continue
        
        for row in rows:
            if not isinstance(row, list):
                continue
            
            # Format values for SQL
            formatted_values = []
            for val in row:
                if val is None:
                    formatted_values.append("NULL")
                elif isinstance(val, str):
                    # Escape single quotes
                    escaped = val.replace("'", "''")
                    formatted_values.append(f"'{escaped}'")
                elif isinstance(val, bool):
                    formatted_values.append("1" if val else "0")
                else:
                    formatted_values.append(str(val))
            
            insert_stmt = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({', '.join(formatted_values)});"
            script_parts.append(insert_stmt)
    
    # 3. Add user query
    # Clean up the user query (remove trailing semicolons, add one at end)
    clean_query = user_query.strip()
    if clean_query.endswith(';'):
        clean_query = clean_query[:-1].strip()
    
    script_parts.append(f"\n-- User Query\n{clean_query};")
    
    return "\n".join(script_parts)


async def execute_sql_with_judge0(sql_script: str) -> Dict[str, Any]:
    """
    Execute SQL script using Judge0 SQLite (language_id 82).
    Returns the execution result.
    """
    from ..utils.judge0 import submit_to_judge0
    
    SQLITE_LANGUAGE_ID = 82
    
    try:
        result = await submit_to_judge0(
            source_code=sql_script,
            language_id=SQLITE_LANGUAGE_ID,
            stdin="",  # SQLite doesn't use stdin
            timeout=30.0,
        )
        
        status = result.get("status", {})
        status_id = status.get("id", 0)
        
        return {
            "success": status_id == 3,  # 3 = Accepted
            "status_id": status_id,
            "status": status.get("description", "Unknown"),
            "stdout": result.get("stdout", ""),
            "stderr": result.get("stderr", ""),
            "compile_output": result.get("compile_output", ""),
            "time": result.get("time"),
            "memory": result.get("memory"),
        }
        
    except Exception as e:
        logger.error(f"SQL execution error: {e}")
        return {
            "success": False,
            "status_id": 13,
            "status": "Execution Error",
            "stdout": "",
            "stderr": str(e),
            "compile_output": "",
            "time": None,
            "memory": None,
        }


def compare_sql_results(user_output: str, expected_output: str, order_sensitive: bool = False) -> bool:
    """
    Compare SQL query results.
    
    If order_sensitive is False, compares results as sets of rows.
    If order_sensitive is True, compares results as ordered lists.
    """
    if not user_output or not expected_output:
        return user_output.strip() == expected_output.strip()
    
    # Parse output into rows
    user_rows = [line.strip() for line in user_output.strip().split('\n') if line.strip()]
    expected_rows = [line.strip() for line in expected_output.strip().split('\n') if line.strip()]
    
    if order_sensitive:
        return user_rows == expected_rows
    else:
        # Compare as sets (order doesn't matter)
        return sorted(user_rows) == sorted(expected_rows)


@router.post("/assessment/run-sql")
async def run_sql(request: RunSQLRequest):
    """
    RUN SQL - Execute SQL query against sample data.
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
    
    # Get schemas and sample data
    schemas = question.get("schemas", {})
    sample_data = question.get("sample_data", {})
    
    if not schemas:
        raise HTTPException(status_code=400, detail="Question has no table schemas defined")
    
    # Build and execute SQL script
    sql_script = build_sql_script(
        schemas=schemas,
        sample_data=sample_data,
        user_query=request.sql_query
    )
    
    logger.info(f"Executing SQL script:\n{sql_script[:500]}...")
    
    result = await execute_sql_with_judge0(sql_script)
    
    # Format response
    if result["success"]:
        status = "executed"
        message = "Query executed successfully"
    elif result["status_id"] == 6:
        status = "syntax_error"
        message = "SQL syntax error"
    else:
        status = "error"
        message = result.get("stderr") or result.get("compile_output") or "Execution failed"
    
    return {
        "question_id": request.question_id,
        "status": status,
        "message": message,
        "output": result.get("stdout", ""),
        "error": result.get("stderr", "") or result.get("compile_output", ""),
        "time": result.get("time"),
        "memory": result.get("memory"),
        "sql_script_preview": sql_script[:1000] + "..." if len(sql_script) > 1000 else sql_script,
    }


@router.post("/assessment/submit-sql")
async def submit_sql(
    request: SubmitSQLRequest,
    user_id: str = Query(None, description="User ID for tracking submission"),
):
    """
    SUBMIT SQL - Execute SQL query and compare with expected result.
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
    
    # Get schemas and sample data
    schemas = question.get("schemas", {})
    sample_data = question.get("sample_data", {})
    reference_query = question.get("reference_query")
    evaluation = question.get("evaluation", {})
    order_sensitive = evaluation.get("order_sensitive", False)
    
    if not schemas:
        raise HTTPException(status_code=400, detail="Question has no table schemas defined")
    
    # Execute user's query
    user_sql_script = build_sql_script(
        schemas=schemas,
        sample_data=sample_data,
        user_query=request.sql_query
    )
    
    logger.info(f"Executing user SQL script...")
    user_result = await execute_sql_with_judge0(user_sql_script)
    
    # Check for execution errors
    if not user_result["success"] and user_result["status_id"] != 3:
        error_msg = user_result.get("stderr") or user_result.get("compile_output") or "Query execution failed"
        
        response = {
            "question_id": request.question_id,
            "status": "error",
            "passed": False,
            "message": f"Query execution failed: {error_msg}",
            "user_output": "",
            "error": error_msg,
            "time": user_result.get("time"),
            "memory": user_result.get("memory"),
        }
        
        # Save submission if user_id provided
        if user_id:
            submission_record = {
                "user_id": user_id,
                "question_id": request.question_id,
                "question_type": "SQL",
                "sql_query": request.sql_query,
                "user_output": "",
                "error": error_msg,
                "passed": False,
                "status": "error",
                "started_at": request.started_at,
                "submitted_at": request.submitted_at or datetime.utcnow().isoformat(),
                "time_spent_seconds": request.time_spent_seconds,
                "execution_time": user_result.get("time"),
                "memory_used": user_result.get("memory"),
                "created_at": datetime.utcnow(),
            }
            await db.sql_submissions.insert_one(submission_record)
        
        return response
    
    user_output = user_result.get("stdout", "").strip()
    
    # If there's a reference query, execute it and compare
    if reference_query:
        ref_sql_script = build_sql_script(
            schemas=schemas,
            sample_data=sample_data,
            user_query=reference_query
        )
        
        logger.info(f"Executing reference SQL script...")
        ref_result = await execute_sql_with_judge0(ref_sql_script)
        
        if not ref_result["success"]:
            # Reference query failed - this is a problem with the question setup
            logger.error(f"Reference query execution failed: {ref_result.get('stderr')}")
            raise HTTPException(
                status_code=500, 
                detail="Reference query execution failed. Please contact administrator."
            )
        
        expected_output = ref_result.get("stdout", "").strip()
        passed = compare_sql_results(user_output, expected_output, order_sensitive)
        
    else:
        # No reference query - just check if query executed successfully
        passed = user_result["success"]
        expected_output = None
    
    # AI Evaluation
    ai_evaluation = None
    ai_score = 100 if passed else 0
    ai_max_marks = question.get("marks", 100)
    
    try:
        ai_evaluation = await evaluate_sql_answer(
            question_id=request.question_id,
            question_description=question.get("questionText") or question.get("question", ""),
            user_query=request.sql_query,
            reference_query=reference_query,
            max_marks=ai_max_marks,
            section=None,
            schemas=schemas,
            test_result={
                "passed": passed,
                "user_result": user_result,
                "reference_result": ref_result if reference_query else None,
                "error": user_result.get("stderr") if not user_result.get("success") else None
            },
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
    
    # Determine status
    if passed:
        status = "accepted"
        message = "Query produces correct results!"
    else:
        status = "wrong_answer"
        message = "Query output does not match expected results"
    
    response = {
        "question_id": request.question_id,
        "status": status,
        "passed": passed,
        "message": message,
        "user_output": user_output,
        "expected_output": expected_output if not passed else None,  # Only show expected on failure
        "time": user_result.get("time"),
        "memory": user_result.get("memory"),
        "score": ai_score,  # Use AI score instead of binary
        "max_score": ai_max_marks,  # Use AI max marks
        "ai_evaluation": ai_evaluation,  # Include full AI evaluation
    }
    
    # Save submission if user_id provided
    if user_id:
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
        logger.info(f"Saved SQL submission for user {user_id}")
    
    return response
