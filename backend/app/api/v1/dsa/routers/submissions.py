from datetime import datetime
from typing import List, Dict, Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..database import get_dsa_database as get_database
from ..models.submission import SubmissionCreate, Submission
from ..utils.evaluator import evaluate_submission
from ..utils.judge0 import get_language_id, submit_to_judge0

router = APIRouter(prefix="/api/v1/dsa", tags=["dsa"])


class EvaluationRequest(BaseModel):
    problem_id: str
    source_code: str
    language_id: int

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
    
    # Get language ID
    language_id = get_language_id(submission.language)
    if not language_id:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {submission.language}")
    
    # Run all testcases
    all_testcases = question["public_testcases"] + question["hidden_testcases"]
    test_results = []
    passed = 0
    total = len(all_testcases)
    status = "accepted"
    
    for testcase in all_testcases:
        try:
            # Execute code using Judge0
            judge0_result = await submit_to_judge0(
                source_code=submission.code,
                language_id=language_id,
                stdin=testcase["input"]
            )
            
            # Extract Judge0 response fields (already decoded by service)
            stdout = judge0_result.get("stdout", "") or ""
            stderr = judge0_result.get("stderr", "") or ""
            compile_output = judge0_result.get("compile_output", "") or ""
            status_info = judge0_result.get("status", {})
            status_id = status_info.get("id", 0)
            status_description = status_info.get("description", "")
            
            # Normalize outputs (strip whitespace)
            expected = testcase["expected_output"].strip()
            actual = stdout.strip()
            
            # Map Judge0 status to our status
            # Status IDs: 3=Accepted, 4=Wrong Answer, 5=Time Limit, 6=Compilation Error, etc.
            if status_id == 3:
                judge0_status = "accepted"
            elif status_id == 4:
                judge0_status = "wrong_answer"
            elif status_id == 5:
                judge0_status = "time_limit_exceeded"
            elif status_id == 6:
                judge0_status = "compilation_error"
            else:
                judge0_status = "runtime_error"
            
            # Check if output matches expected
            test_passed = actual == expected and status_id == 3
            
            test_result = {
                "input": testcase["input"],
                "expected_output": expected,
                "actual_output": actual,
                "passed": test_passed,
                "status": judge0_status,
                "status_description": status_description,
                "stdout": stdout,
                "stderr": stderr,
                "compile_output": compile_output,
                "time": judge0_result.get("time", 0),
                "memory": judge0_result.get("memory", 0),
                "judge0_status_id": status_id,
            }
            
            if test_passed:
                passed += 1
            else:
                if status == "accepted":
                    status = judge0_status
            
            if judge0_status != "accepted":
                status = judge0_status
            
            test_results.append(test_result)
            
        except Exception as e:
            test_results.append({
                "input": testcase["input"],
                "expected_output": testcase["expected_output"],
                "actual_output": "",
                "passed": False,
                "status": "runtime_error",
                "status_description": str(e),
                "stdout": "",
                "stderr": str(e),
                "compile_output": "",
                "error": str(e),
            })
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

    try:
        evaluation = await evaluate_submission(
            source_code=payload.source_code,
            language_id=payload.language_id,
            testcases=testcases,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return evaluation

