from datetime import datetime
from typing import List, Dict, Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..database import get_dsa_database as get_database
from ..models.submission import SubmissionCreate, Submission
from ..models.question import FunctionSignature, FunctionParameter
from ..utils.evaluator import evaluate_submission
from ..services.dsa_execution_service import (
    is_dsa_language,
    run_all_test_cases_dsa,
)
from ..routers.assessment import prepare_code_for_execution

router = APIRouter(prefix="/api/v1/dsa", tags=["dsa"])


class EvaluationRequest(BaseModel):
    problem_id: str
    source_code: str
    language: str  # e.g. "python", "java", "cpp"

@router.post("/", response_model=dict)
async def submit_code(submission: SubmissionCreate, user_id: str = Query(..., description="User ID from link token")):
    """
    Submit code for evaluation (user_id provided via query parameter)
    """
    db = get_database()
    
    # Get question
    if not ObjectId.is_valid(submission.question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    question = await db.questions.find_one({"_id": ObjectId(submission.question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Only the 10 DSA languages are supported
    if not is_dsa_language(submission.language):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {submission.language}. Use one of: python, c, cpp, java, go, rust, javascript, typescript, kotlin, csharp.",
        )
    
    # Prepare code for execution (returns raw for DSA execution API)
    prepared_code, prep_error, _ = await prepare_code_for_execution(
        source_code=submission.code,
        language=submission.language,
        question=question
    )
    
    if prep_error:
        raise HTTPException(status_code=400, detail=prep_error)
    
    # Build test cases array
    all_testcases = question["public_testcases"] + question["hidden_testcases"]
    test_cases = []
    for i, tc in enumerate(all_testcases):
        test_cases.append({
            "id": f"tc_{i}",
            "stdin": tc.get("input", ""),
            "expected_output": tc.get("expected_output", ""),
            "is_hidden": i >= len(question.get("public_testcases", [])),
            "points": 1,
        })
    
    if not test_cases:
        raise HTTPException(status_code=400, detail="Question has no test cases")
    
    # Get function name for DSA execution API
    func_sig_data = question.get("function_signature")
    function_name = (func_sig_data.get("name") or "").strip() if func_sig_data else ""
    if not function_name:
        raise HTTPException(status_code=400, detail="Question must have function_signature.name for DSA execution")

    # Run all test cases via DSA execution API (10 DSA languages only; SQL uses submit-sql)
    try:
        results = await run_all_test_cases_dsa(
            source_code=prepared_code,
            test_cases=test_cases,
            function_name=function_name,
            language=submission.language,
        )
        
        # Transform results to match expected format
        test_results = []
        passed = results.get("passed", 0)
        total = results.get("total", len(test_cases))
        all_results = results.get("results", [])
        
        # Determine overall status
        if results.get("compilation_error"):
            status = "compilation_error"
        elif passed == total:
            status = "accepted"
        elif passed > 0:
            status = "partially_accepted"
        else:
            status = "wrong_answer"
        
        # Format test results
        for i, result in enumerate(all_results):
            tc = all_testcases[i] if i < len(all_testcases) else {}
            test_result = {
                "input": tc.get("input", ""),
                "expected_output": tc.get("expected_output", ""),
                "actual_output": result.get("stdout", "").strip(),
                "passed": result.get("passed", False),
                "status": result.get("status", "runtime_error").lower().replace(" ", "_"),
                "status_description": result.get("status", ""),
                "stdout": result.get("stdout", ""),
                "stderr": result.get("stderr", ""),
                "compile_output": result.get("compile_output", ""),
                "time": result.get("time", 0),
                "memory": result.get("memory", 0),
                "status_id": result.get("status_id", 0),
            }
            test_results.append(test_result)
            
    except Exception as e:
        # Fallback to error response
        test_results = [{
            "input": tc.get("input", ""),
            "expected_output": tc.get("expected_output", ""),
            "actual_output": "",
            "passed": False,
            "status": "runtime_error",
            "status_description": str(e),
            "stdout": "",
            "stderr": str(e),
            "compile_output": "",
            "error": str(e),
        } for tc in all_testcases]
        passed = 0
        total = len(all_testcases)
        status = "runtime_error"
    
    # Create submission record
    submission_dict = {
        "user_id": user_id,
        "question_id": submission.question_id,
        "language": submission.language,
        "code": submission.code,
        "status": status,
        "test_results": test_results,
        "passed_testcases": passed,
        "total_testcases": total,
        "created_at": datetime.utcnow(),
    }
    
    result = await db.submissions.insert_one(submission_dict)
    
    # Return properly serialized response
    return {
        "id": str(result.inserted_id),
        "user_id": submission_dict["user_id"],
        "question_id": submission_dict["question_id"],
        "language": submission_dict["language"],
        "code": submission_dict["code"],
        "status": submission_dict["status"],
        "test_results": submission_dict["test_results"],
        "passed_testcases": submission_dict["passed_testcases"],
        "total_testcases": submission_dict["total_testcases"],
        "created_at": submission_dict["created_at"].isoformat() if isinstance(submission_dict.get("created_at"), datetime) else submission_dict.get("created_at"),
    }

@router.get("/", response_model=List[dict])
async def get_submissions(
    question_id: str = Query(None, description="Filter by question ID"),
    user_id: str = Query(None, description="Filter by user ID")
):
    """
    Get submissions (no auth required, filter by user_id if provided)
    """
    db = get_database()
    query = {}
    
    if user_id:
        query["user_id"] = user_id
    
    if question_id:
        if not ObjectId.is_valid(question_id):
            raise HTTPException(status_code=400, detail="Invalid question ID")
        query["question_id"] = question_id
    
    submissions = await db.submissions.find(query).sort("created_at", -1).limit(50).to_list(length=50)
    result = []
    for s in submissions:
        submission_dict = {
            "id": str(s["_id"]),
            "user_id": s.get("user_id", ""),
            "question_id": s.get("question_id", ""),
            "language": s.get("language", ""),
            "code": s.get("code", ""),
            "status": s.get("status", ""),
            "test_results": s.get("test_results", []),
            "passed_testcases": s.get("passed_testcases", 0),
            "total_testcases": s.get("total_testcases", 0),
        }
        if "created_at" in s:
            submission_dict["created_at"] = s["created_at"].isoformat() if isinstance(s.get("created_at"), datetime) else s.get("created_at")
        result.append(submission_dict)
    return result

@router.get("/{submission_id}", response_model=dict)
async def get_submission(submission_id: str):
    db = get_database()
    if not ObjectId.is_valid(submission_id):
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = await db.submissions.find_one({"_id": ObjectId(submission_id)})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Return properly serialized response
    submission_dict = {
        "id": str(submission["_id"]),
        "user_id": submission.get("user_id", ""),
        "question_id": submission.get("question_id", ""),
        "language": submission.get("language", ""),
        "code": submission.get("code", ""),
        "status": submission.get("status", ""),
        "test_results": submission.get("test_results", []),
        "passed_testcases": submission.get("passed_testcases", 0),
        "total_testcases": submission.get("total_testcases", 0),
    }
    if "created_at" in submission:
        submission_dict["created_at"] = submission["created_at"].isoformat() if isinstance(submission.get("created_at"), datetime) else submission.get("created_at")
    
    return submission_dict


@router.post("/evaluate", response_model=dict)
async def evaluate_code(payload: EvaluationRequest):
    """
    Evaluate code against all testcases without storing a submission.
    """
    db = get_database()

    if not ObjectId.is_valid(payload.problem_id):
        raise HTTPException(status_code=400, detail="Invalid problem ID")

    question = await db.questions.find_one({"_id": ObjectId(payload.problem_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    testcases: List[Dict[str, Any]] = []

    for tc in question.get("public_testcases", []):
        testcases.append(
            {
                "input": tc.get("input", ""),
                "expected": tc.get("expected_output", ""),
                "hidden": False,
                "weight": tc.get("weight", 1) or 1,
            }
        )

    for tc in question.get("hidden_testcases", []):
        testcases.append(
            {
                "input": tc.get("input", ""),
                "expected": tc.get("expected_output", ""),
                "hidden": True,
                "weight": tc.get("weight", 1) or 1,
            }
        )

    if not testcases:
        raise HTTPException(status_code=400, detail="No testcases configured for this problem")

    function_name = ""
    func_sig = question.get("function_signature")
    if func_sig and isinstance(func_sig, dict):
        function_name = (func_sig.get("name") or "").strip()

    try:
        evaluation = await evaluate_submission(
            source_code=payload.source_code,
            language=payload.language,
            testcases=testcases,
            function_name=function_name or None,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return evaluation

