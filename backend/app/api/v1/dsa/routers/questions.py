from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from bson import ObjectId
import logging
import json
from ..database import get_dsa_database as get_database
from ..models.question import Question, QuestionCreate, QuestionUpdate
from ..services.expected_output import compute_expected_outputs_for_testcases
from .....core.dependencies import get_current_user, require_editor

logger = logging.getLogger("backend")
router = APIRouter(prefix="/api/v1/dsa/questions", tags=["dsa"])

# =====================================================================================
# DSA Coding Validation Helpers (do NOT apply to SQL questions)
# =====================================================================================

def _normalize_str(v: Optional[str]) -> str:
    return (v or "").strip()

def _is_sql_question(payload: Dict[str, Any]) -> bool:
    # Explicit SQL
    if str(payload.get("question_type") or "").upper() == "SQL":
        return True
    # Inferred SQL (same logic as get_question)
    has_schemas = payload.get("schemas") and len(payload.get("schemas", {})) > 0
    has_sql_category = payload.get("sql_category") is not None
    has_starter_query = payload.get("starter_query") is not None
    has_evaluation = payload.get("evaluation") and payload.get("evaluation", {}).get("engine")
    return bool(has_schemas or has_sql_category or has_starter_query or has_evaluation)

def _get_return_type(payload: Dict[str, Any]) -> Optional[str]:
    fs = payload.get("function_signature") or {}
    rt = fs.get("return_type")
    return _normalize_str(rt) or None

def _validate_expected_output_for_return_type(return_type: Optional[str], expected_output: str) -> None:
    """
    Strict validation for machine-readable expected_output stored on testcases.
    - int/long: single integer
    - boolean: true/false
    - int[]/long[]: space-separated integers (no brackets)
    - string/string[]: allow any (string[] expects space-separated tokens; keep permissive)
    """
    import re

    rt = (return_type or "").strip()
    out = expected_output.strip()

    if out == "":
        raise ValueError("expected_output cannot be empty")

    if rt in ("int", "long"):
        if not re.fullmatch(r"-?\d+", out):
            raise ValueError(f"expected_output must be a single integer for return_type={rt}")
        return

    if rt == "boolean":
        if out.lower() not in ("true", "false"):
            raise ValueError("expected_output must be 'true' or 'false' for return_type=boolean")
        return

    if rt in ("int[]", "long[]"):
        if "[" in out or "]" in out or "," in out:
            raise ValueError(f"expected_output for return_type={rt} must be space-separated values (no brackets/commas)")
        parts = [p for p in out.split() if p != ""]
        if not parts:
            raise ValueError(f"expected_output must contain at least one value for return_type={rt}")
        for p in parts:
            if not re.fullmatch(r"-?\d+", p):
                raise ValueError(f"expected_output contains non-integer value '{p}' for return_type={rt}")
        return

    # For other return types, keep permissive (string, string[], double, etc.)
    return

def _validate_example_output_for_return_type(return_type: Optional[str], example_output: str) -> None:
    """
    Looser validation for human-readable examples.
    Accepts bracketed arrays for int[] (e.g., [0,1]) in addition to space-separated.
    """
    import re

    rt = (return_type or "").strip()
    out = (example_output or "").strip()
    if out == "":
        raise ValueError("example output cannot be empty")

    if rt in ("int", "long"):
        if not re.fullmatch(r"-?\d+", out):
            raise ValueError(f"example output must be a single integer for return_type={rt}")
        return

    if rt == "boolean":
        if out.lower() not in ("true", "false"):
            raise ValueError("example output must be 'true' or 'false' for return_type=boolean")
        return

    if rt in ("int[]", "long[]"):
        # Allow either "[0,1]" or "0 1"
        if re.fullmatch(r"\[\s*-?\d+(\s*,\s*-?\d+)*\s*\]", out):
            return
        # else validate as space-separated ints
        if "[" in out or "]" in out:
            raise ValueError(f"example output for return_type={rt} must be like '[0, 1]' or '0 1'")
        parts = [p for p in out.split() if p != ""]
        if not parts:
            raise ValueError(f"example output must contain at least one value for return_type={rt}")
        for p in parts:
            if not re.fullmatch(r"-?\d+", p):
                raise ValueError(f"example output contains non-integer value '{p}' for return_type={rt}")
        return

    return

def _convert_json_array_to_stdin(input_str: str) -> str:
    """
    Convert JSON array format to raw stdin format.
    Examples:
    - "[1,2,3]" -> "1 2 3\n"
    - "[1, 2, 3]" -> "1 2 3\n"
    - "[[1,2],[3,4]]" -> "1 2\n3 4\n" (matrix format)
    """
    if not input_str:
        return input_str
    
    stripped = input_str.strip()
    has_trailing_newline = input_str.endswith('\n')
    
    # Check if it's a JSON array
    if stripped.startswith('[') and stripped.endswith(']'):
        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, list):
                # Handle nested arrays (matrices)
                if parsed and isinstance(parsed[0], list):
                    lines = []
                    for row in parsed:
                        if isinstance(row, list):
                            lines.append(' '.join(str(x) for x in row))
                        else:
                            lines.append(str(row))
                    result = '\n'.join(lines)
                    return result + '\n' if has_trailing_newline or not result.endswith('\n') else result
                else:
                    # Simple array: convert to space-separated
                    result = ' '.join(str(x) for x in parsed)
                    return result + '\n' if has_trailing_newline or not result.endswith('\n') else result
        except (json.JSONDecodeError, ValueError):
            pass
    
    if has_trailing_newline and not input_str.endswith('\n'):
        return input_str + '\n'
    return input_str


def _normalize_testcase_inputs(payload: Dict[str, Any]) -> None:
    """
    Normalize all testcase inputs to ensure they're in raw stdin format.
    Converts JSON arrays to space-separated or multi-line format.
    """
    for tc_type in ["public_testcases", "hidden_testcases"]:
        testcases = payload.get(tc_type, [])
        if isinstance(testcases, list):
            for tc in testcases:
                if isinstance(tc, dict) and "input" in tc:
                    original_input = tc["input"]
                    normalized_input = _convert_json_array_to_stdin(str(original_input))
                    if normalized_input != original_input:
                        logger.warning(f"Converted JSON array to stdin format in {tc_type}: {original_input[:50]}... -> {normalized_input[:50]}...")
                        tc["input"] = normalized_input


def _validate_stdin_only_input(stdin: str) -> None:
    """
    Enforce 'machine-readable stdin' constraints for DSA testcases:
    - No variable names (reject '=')
    - No JSON-style arrays (reject '[' or ']')
    This is intentionally minimal and conservative.
    """
    s = stdin or ""
    if "=" in s:
        raise ValueError("testcase input must be raw stdin only (no variable assignments like 'nums = ...')")
    if "[" in s or "]" in s:
        raise ValueError("testcase input must be raw stdin only (no JSON-style arrays like [1,2,3])")

def _validate_dsa_coding_payload(payload: Dict[str, Any]) -> None:
    """
    Validate DSA coding question payload:
    - Examples are human-readable; output should match return_type (loosely).
    - Testcases are stdin-only; outputs:
      - Manual: expected_output required + strict type match vs return_type.
      - AI-generated: expected_output may be omitted for all testcases; must be consistently omitted (not mixed).
    """
    if _is_sql_question(payload):
        return  # do not touch SQL

    return_type = _get_return_type(payload)

    # Validate examples output shape if return_type is known
    examples = payload.get("examples") or []
    for idx, ex in enumerate(examples):
        try:
            _validate_example_output_for_return_type(return_type, (ex or {}).get("output", ""))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid example output at examples[{idx}]: {str(e)}")

    # Validate testcases
    def classify_testcases(testcases: List[Dict[str, Any]]) -> Tuple[bool, bool]:
        # returns (has_any_expected, has_any_missing)
        has_any_expected = False
        has_any_missing = False
        for tc in testcases:
            eo = _normalize_str((tc or {}).get("expected_output"))
            if eo == "":
                has_any_missing = True
            else:
                has_any_expected = True
        return has_any_expected, has_any_missing

    public_tcs = payload.get("public_testcases") or []
    hidden_tcs = payload.get("hidden_testcases") or []
    all_tcs = [("public_testcases", public_tcs), ("hidden_testcases", hidden_tcs)]

    # Determine manual vs AI by presence of expected_output across all testcases (no mixing allowed)
    has_expected_any = False
    missing_expected_any = False
    for _, tcs in all_tcs:
        a, b = classify_testcases(tcs)
        has_expected_any = has_expected_any or a
        missing_expected_any = missing_expected_any or b

    if has_expected_any and missing_expected_any:
        raise HTTPException(
            status_code=400,
            detail="Invalid testcase data: expected_output must be provided for ALL manual testcases or omitted for ALL AI-generated testcases (do not mix).",
        )

    is_ai_generated = (not has_expected_any) and missing_expected_any

    for tc_group_name, tcs in all_tcs:
        for idx, tc in enumerate(tcs):
            tc_input = (tc or {}).get("input", "")
            try:
                _validate_stdin_only_input(tc_input)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid testcase input at {tc_group_name}[{idx}]: {str(e)}")

            if is_ai_generated:
                # expected_output intentionally omitted; nothing else to validate
                continue

            eo = _normalize_str((tc or {}).get("expected_output"))
            if eo == "":
                raise HTTPException(status_code=400, detail=f"Missing expected_output at {tc_group_name}[{idx}] for manual question")
            try:
                _validate_expected_output_for_return_type(return_type, eo)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid expected_output at {tc_group_name}[{idx}]: {str(e)}")

@router.get("/", response_model=List[dict])
async def get_questions(
    skip: int = 0, 
    limit: int = 1000,  # Increased limit to show all questions
    published_only: Optional[bool] = Query(None, description="Filter by published status. If None, returns all questions for the user"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get questions list for the current user (requires authentication)
    Only returns questions created by the current user
    - published_only=True: Only return published questions
    - published_only=False: Only return unpublished questions
    - published_only=None: Return all questions created by the user (both published and unpublished)
    """
    db = get_database()
    # Filter questions by the current user - STRICT: only return questions with created_by matching current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"[get_questions] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()  # Ensure no whitespace
    
    logger.info(f"[get_questions] Fetching questions for user_id: '{user_id}' (type: {type(user_id).__name__})")
    logger.info(f"[get_questions] Current user data: id={current_user.get('id')}, _id={current_user.get('_id')}, email={current_user.get('email')}")
    
    # ABSOLUTE SECURITY: Use explicit $and with $exists to ensure field exists
    # This is the STRICTEST possible query - will NEVER match documents without created_by
    # CRITICAL: Normalize user_id to string for comparison (handles ObjectId vs string)
    user_id_normalized = str(user_id).strip()
    
    # Build strict query - exact string match (we store created_by as string)
    base_conditions = [
        {"created_by": {"$exists": True}},
        {"created_by": {"$ne": None}},
        {"created_by": {"$ne": ""}},
        {"created_by": user_id_normalized}  # Exact string match
    ]
    
    # CRITICAL: Filter to only get DSA questions (exclude AIML questions)
    # This handles both legacy questions (no module_type) and new questions (module_type: "dsa")
    base_conditions.append({
        "$or": [
            {"module_type": {"$exists": False}},  # Legacy DSA questions without module_type
            {"module_type": None},                 # Questions with null module_type
            {"module_type": "dsa"}                 # Explicitly marked DSA questions
        ]
    })
    
    # Filter by published status if specified
    # If published_only is None, don't add the filter - return all questions for the user (both published and unpublished)
    if published_only is not None:
        base_conditions.append({"is_published": published_only})
    
    query = {"$and": base_conditions}
    
    logger.info(f"[get_questions] STRICT MongoDB query: {query}")
    logger.info(f"[get_questions] Query will ONLY match questions where created_by exists, is not null, is not empty, and equals '{user_id_normalized}'")
    logger.info(f"[get_questions] User ID type: {type(user_id).__name__}, normalized: '{user_id_normalized}'")
    
    logger.info(f"[get_questions] MongoDB query: {query}")
    
    # Sort by created_at descending to show newest first
    questions_cursor = db.questions.find(query)
    questions = await questions_cursor.sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    logger.info(f"[get_questions] Found {len(questions)} questions in database for user_id: {user_id}")
    
    # CRITICAL SECURITY CHECK: Additional client-side filter as defense in depth
    # This is a FINAL safety net - filter out ANY question that doesn't match exactly
    questions_before_filter = len(questions)
    filtered_questions = []
    for q in questions:
        q_created_by = q.get("created_by")
        q_id = str(q.get("_id", ""))
        q_title = q.get("title", "Unknown")
        
        # ABSOLUTE STRICT CHECK: Reject if created_by is missing, null, empty, or doesn't match
        if q_created_by is None:
            logger.error(f"[get_questions] SECURITY VIOLATION: Question {q_id} ({q_title}) has NULL created_by - REJECTING")
            continue
        
        if q_created_by == "":
            logger.error(f"[get_questions] SECURITY VIOLATION: Question {q_id} ({q_title}) has EMPTY created_by - REJECTING")
            continue
        
        # Normalize both sides to string for comparison (handles ObjectId vs string mismatch)
        q_created_by_str = str(q_created_by).strip()
        # Use the already normalized user_id from above
        if q_created_by_str != user_id_normalized:
            logger.error(f"[get_questions] SECURITY VIOLATION: Question {q_id} ({q_title}) created_by='{q_created_by_str}' != user_id='{user_id_normalized}' - REJECTING")
            continue
        
        # CRITICAL: Reject AIML questions - they should be isolated
        q_module_type = q.get("module_type")
        if q_module_type == "aiml":
            logger.warning(f"[get_questions] Filtering out AIML question {q_id} ({q_title}) from DSA results")
            continue
        
        # Only add if it passes all checks
        filtered_questions.append(q)
    
    questions = filtered_questions
    
    if questions_before_filter != len(questions):
        logger.error(f"[get_questions] SECURITY: Filtered out {questions_before_filter - len(questions)} questions that didn't match user_id - this should not happen if query is correct")
    
    # Final verification log
    logger.info(f"[get_questions] Returning {len(questions)} questions for user_id: {user_id}")
    
    result = []
    for q in questions:
        question_dict = {
            "id": str(q["_id"]),
            "title": q.get("title", ""),
            "description": q.get("description", ""),
            "difficulty": q.get("difficulty", ""),
            "languages": q.get("languages", []),
            "starter_code": q.get("starter_code", {}),
            "public_testcases": q.get("public_testcases", []),
            "hidden_testcases": q.get("hidden_testcases", []),
            "is_published": q.get("is_published", False),
        }
        if "function_signature" in q and q.get("function_signature"):
            question_dict["function_signature"] = q["function_signature"]
        # Include question_type to identify SQL vs coding questions
        if q.get("question_type"):
            question_dict["question_type"] = q.get("question_type")
        if q.get("sql_category"):
            question_dict["sql_category"] = q.get("sql_category")
        if "created_at" in q:
            question_dict["created_at"] = q["created_at"].isoformat() if isinstance(q.get("created_at"), datetime) else q.get("created_at")
        if "updated_at" in q:
            question_dict["updated_at"] = q["updated_at"].isoformat() if isinstance(q.get("updated_at"), datetime) else q.get("updated_at")
        result.append(question_dict)
    return result

@router.get("/{question_id}", response_model=dict)
async def get_question(
    question_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get a specific question (requires authentication and ownership)
    """
    db = get_database()
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"[get_question] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()
    
    logger.info(f"[get_question] Fetching question {question_id} for user_id: '{user_id}'")
    
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # CRITICAL SECURITY CHECK: Verify ownership
    question_created_by = question.get("created_by")
    if not question_created_by:
        logger.warning(f"[get_question] SECURITY: Question {question_id} has no created_by field")
        raise HTTPException(status_code=403, detail="You don't have permission to access this question")
    
    if str(question_created_by).strip() != user_id.strip():
        logger.error(f"[get_question] SECURITY ISSUE: User {user_id} attempted to access question {question_id} created by {question_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to access this question")
    
    logger.info(f"[get_question] Question {question_id} access granted to user {user_id}")
    
    # Convert ObjectId and datetime fields to JSON-serializable formats
    question_dict = {
        "id": str(question["_id"]),
        "title": question.get("title", ""),
        "description": question.get("description", ""),
        "difficulty": question.get("difficulty", ""),
        "languages": question.get("languages", []),
        "starter_code": question.get("starter_code", {}),
        "public_testcases": question.get("public_testcases", []),
        "hidden_testcases": question.get("hidden_testcases", []),
        "is_published": question.get("is_published", False),
    }
    
    # Add function_signature if it exists
    if "function_signature" in question and question.get("function_signature"):
        question_dict["function_signature"] = question["function_signature"]
    
    # Detect question type - explicit or inferred from SQL-specific fields
    question_type = question.get("question_type")
    
    # Infer SQL type if not explicitly set but has SQL-specific fields
    if not question_type:
        has_schemas = question.get("schemas") and len(question.get("schemas", {})) > 0
        has_sql_category = question.get("sql_category") is not None
        has_starter_query = question.get("starter_query") is not None
        has_evaluation = question.get("evaluation") and question.get("evaluation", {}).get("engine")
        
        if has_schemas or has_sql_category or has_starter_query or has_evaluation:
            question_type = "SQL"
            logger.info(f"[get_question] Inferred question_type=SQL for question {question_id}")
    
    # Add question_type to response
    if question_type:
        question_dict["question_type"] = question_type
    
    # Add SQL-specific fields
    if question.get("sql_category"):
        question_dict["sql_category"] = question.get("sql_category")
    if question.get("schemas"):
        question_dict["schemas"] = question.get("schemas")
    if question.get("sample_data"):
        question_dict["sample_data"] = question.get("sample_data")
    if question.get("starter_query"):
        question_dict["starter_query"] = question.get("starter_query")
    if question.get("hints"):
        question_dict["hints"] = question.get("hints")
    if question.get("evaluation"):
        question_dict["evaluation"] = question.get("evaluation")
    if question.get("constraints"):
        question_dict["constraints"] = question.get("constraints")
    if question.get("examples"):
        question_dict["examples"] = question.get("examples")

    # For DSA coding questions, compute expected_output for AI-generated (stdin-only) testcases.
    # This is done server-side using a trusted reference solution and is NOT persisted.
    try:
        if not _is_sql_question(question):
            public_tc = question.get("public_testcases", []) or []
            hidden_tc = question.get("hidden_testcases", []) or []
            
            # Helper to check if expected_output is missing or placeholder
            def is_missing_or_placeholder(tc):
                eo = _normalize_str((tc or {}).get("expected_output"))
                if not eo:
                    return True
                # Check for placeholder patterns
                eo_lower = eo.lower()
                return any(pattern in eo_lower for pattern in ["e.g.", "example", "placeholder", "expected:"])
            
            # Detect if any testcases need expected outputs computed
            all_tc = public_tc + hidden_tc
            needs_computation = any(is_missing_or_placeholder(tc) for tc in all_tc)
            
            if needs_computation:
                # Compute expected outputs for testcases that need them
                question_dict["ai_generated"] = True
                
                # Filter and compute only for testcases that need it
                public_to_compute = [tc for tc in public_tc if is_missing_or_placeholder(tc)]
                hidden_to_compute = [tc for tc in hidden_tc if is_missing_or_placeholder(tc)]
                
                logger.info(f"Found {len(public_to_compute)} public and {len(hidden_to_compute)} hidden testcases with placeholders")
                
                if public_to_compute:
                    computed_public = await compute_expected_outputs_for_testcases(question, public_to_compute)
                    # Create a map of input -> computed testcase
                    computed_map = {tc.get("input", ""): tc for tc in computed_public}
                    # Update testcases with computed outputs
                    updated_public = []
                    for tc in public_tc:
                        if is_missing_or_placeholder(tc) and tc.get("input") in computed_map:
                            updated_public.append(computed_map[tc.get("input")])
                        else:
                            updated_public.append(tc)
                    question_dict["public_testcases"] = updated_public
                else:
                    question_dict["public_testcases"] = public_tc
                
                if hidden_to_compute:
                    computed_hidden = await compute_expected_outputs_for_testcases(question, hidden_to_compute)
                    # Create a map of input -> computed testcase
                    computed_map = {tc.get("input", ""): tc for tc in computed_hidden}
                    # Update testcases with computed outputs
                    updated_hidden = []
                    for tc in hidden_tc:
                        if is_missing_or_placeholder(tc) and tc.get("input") in computed_map:
                            updated_hidden.append(computed_map[tc.get("input")])
                        else:
                            updated_hidden.append(tc)
                    question_dict["hidden_testcases"] = updated_hidden
                else:
                    question_dict["hidden_testcases"] = hidden_tc
    except Exception as e:
        # Fail fast for admin UI: expected output computation must succeed if needed.
        raise HTTPException(status_code=500, detail=f"Failed to compute expected outputs: {str(e)}")
    
    # Add optional fields if they exist
    if "created_at" in question:
        question_dict["created_at"] = question["created_at"].isoformat() if isinstance(question.get("created_at"), datetime) else question.get("created_at")
    if "updated_at" in question:
        question_dict["updated_at"] = question["updated_at"].isoformat() if isinstance(question.get("updated_at"), datetime) else question.get("updated_at")
    
    return question_dict

@router.post("/", response_model=dict)
async def create_question(
    question: QuestionCreate,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Create a new question (requires authentication)
    """
    db = get_database()
    question_dict = question.model_dump()

    # Normalize testcase inputs (convert JSON arrays to raw stdin) BEFORE validation
    _normalize_testcase_inputs(question_dict)

    # Validate DSA coding payload (skip SQL)
    _validate_dsa_coding_payload(question_dict)

    # Store the actual user ID who created the question
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        logger.error(f"[create_question] Invalid user ID in current_user: {list(current_user.keys())}")
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()  # Ensure no whitespace
    question_dict["created_by"] = user_id
    question_dict["module_type"] = "dsa"  # Mark as DSA question to isolate from AIML
    
    logger.info(f"[create_question] Creating DSA question with created_by={user_id}, title={question_dict.get('title')}")
    
    result = await db.questions.insert_one(question_dict)
    
    # Verify the question was created with correct created_by
    created_question_check = await db.questions.find_one({"_id": result.inserted_id})
    if created_question_check:
        actual_created_by = created_question_check.get("created_by")
        if actual_created_by != user_id:
            logger.error(f"[create_question] SECURITY ISSUE: Question created with created_by={actual_created_by} but expected {user_id}")
        else:
            logger.info(f"[create_question] Question created successfully with created_by={actual_created_by}")
    
    # Fetch the created question to return it
    created_question = await db.questions.find_one({"_id": result.inserted_id})
    if created_question:
        question_dict = {
            "id": str(created_question["_id"]),
            "title": created_question.get("title", ""),
            "description": created_question.get("description", ""),
            "difficulty": created_question.get("difficulty", ""),
            "languages": created_question.get("languages", []),
            "starter_code": created_question.get("starter_code", {}),
            "public_testcases": created_question.get("public_testcases", []),
            "hidden_testcases": created_question.get("hidden_testcases", []),
            "is_published": created_question.get("is_published", False),
        }
        if "function_signature" in created_question and created_question.get("function_signature"):
            question_dict["function_signature"] = created_question["function_signature"]
        if "created_at" in created_question:
            question_dict["created_at"] = created_question["created_at"].isoformat() if isinstance(created_question.get("created_at"), datetime) else created_question.get("created_at")
        if "updated_at" in created_question:
            question_dict["updated_at"] = created_question["updated_at"].isoformat() if isinstance(created_question.get("updated_at"), datetime) else created_question.get("updated_at")
        return question_dict
    
    # Fallback if fetch fails
    question_dict["id"] = str(result.inserted_id)
    if "created_at" in question_dict and isinstance(question_dict.get("created_at"), datetime):
        question_dict["created_at"] = question_dict["created_at"].isoformat()
    return question_dict

@router.put("/{question_id}", response_model=dict)
async def update_question(
    question_id: str, 
    question_update: QuestionUpdate,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Update a question (requires authentication and ownership)
    """
    db = get_database()
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    # Check if question exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    existing_question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not existing_question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Verify ownership
    existing_created_by = existing_question.get("created_by")
    if not existing_created_by or str(existing_created_by).strip() != user_id.strip():
        logger.error(f"[update_question] SECURITY ISSUE: User {user_id} attempted to update question {question_id} created by {existing_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to update this question")
    
    update_data = {k: v for k, v in question_update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Validate DSA coding payload using the merged view (skip SQL)
    merged_payload = {**existing_question, **update_data}
    _validate_dsa_coding_payload(merged_payload)
    
    # Auto-compute missing expected outputs for testcases if reference_solution exists
    # This helps fix questions that were created before the validation pipeline or manually
    if not _is_sql_question(merged_payload):
        reference_solution = merged_payload.get("reference_solution")
        if reference_solution:
            # Get testcases from update_data if provided, otherwise from merged_payload
            hidden_testcases = update_data.get("hidden_testcases") or merged_payload.get("hidden_testcases", [])
            public_testcases = update_data.get("public_testcases") or merged_payload.get("public_testcases", [])
            
            # Check for missing expected outputs (empty or placeholder like "e.g., 0 1")
            def is_missing_output(tc):
                eo = (tc.get("expected_output") or "").strip()
                if not eo:
                    return True
                # Check for placeholder patterns
                eo_lower = eo.lower()
                return any(pattern in eo_lower for pattern in ["e.g.", "example", "placeholder", "expected:"])
            
            hidden_missing = [tc for tc in hidden_testcases if is_missing_output(tc)]
            public_missing = [tc for tc in public_testcases if is_missing_output(tc)]
            
            if hidden_missing or public_missing:
                try:
                    logger.info(f"[update_question] Computing missing expected outputs: {len(hidden_missing)} hidden, {len(public_missing)} public")
                    
                    if hidden_missing:
                        computed_hidden = await compute_expected_outputs_for_testcases(merged_payload, hidden_missing)
                        # Create a map of input -> computed testcase
                        computed_map = {tc.get("input", ""): tc for tc in computed_hidden}
                        # Update missing testcases with computed outputs
                        updated_hidden = []
                        for tc in hidden_testcases:
                            if is_missing_output(tc) and tc.get("input") in computed_map:
                                updated_hidden.append(computed_map[tc.get("input")])
                            else:
                                updated_hidden.append(tc)
                        update_data["hidden_testcases"] = updated_hidden
                        logger.info(f"[update_question] Computed {len(computed_hidden)} hidden testcase expected outputs")
                    
                    if public_missing:
                        computed_public = await compute_expected_outputs_for_testcases(merged_payload, public_missing)
                        # Create a map of input -> computed testcase
                        computed_map = {tc.get("input", ""): tc for tc in computed_public}
                        # Update missing testcases with computed outputs
                        updated_public = []
                        for tc in public_testcases:
                            if is_missing_output(tc) and tc.get("input") in computed_map:
                                updated_public.append(computed_map[tc.get("input")])
                            else:
                                updated_public.append(tc)
                        update_data["public_testcases"] = updated_public
                        logger.info(f"[update_question] Computed {len(computed_public)} public testcase expected outputs")
                except Exception as e:
                    # Log but don't fail the update - expected outputs computation is best-effort
                    logger.warning(f"[update_question] Failed to compute expected outputs: {e}. Question update will proceed without computed outputs.")
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.questions.update_one(
        {"_id": ObjectId(question_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    question_dict = {
        "id": str(question["_id"]),
        "title": question.get("title", ""),
        "description": question.get("description", ""),
        "difficulty": question.get("difficulty", ""),
        "languages": question.get("languages", []),
        "starter_code": question.get("starter_code", {}),
        "public_testcases": question.get("public_testcases", []),
        "hidden_testcases": question.get("hidden_testcases", []),
        "is_published": question.get("is_published", False),
    }
    if "function_signature" in question and question.get("function_signature"):
        question_dict["function_signature"] = question["function_signature"]
    if "created_at" in question:
        question_dict["created_at"] = question["created_at"].isoformat() if isinstance(question.get("created_at"), datetime) else question.get("created_at")
    if "updated_at" in question:
        question_dict["updated_at"] = question["updated_at"].isoformat() if isinstance(question.get("updated_at"), datetime) else question.get("updated_at")
    return question_dict

@router.patch("/{question_id}/publish", response_model=dict)
async def toggle_publish_question(
    question_id: str, 
    is_published: bool = Query(..., description="Set publish status"),
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Toggle publish status of a question (requires authentication and ownership)
    """
    db = get_database()
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    # Check if question exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    existing_question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not existing_question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Verify ownership
    existing_created_by = existing_question.get("created_by")
    if not existing_created_by or str(existing_created_by).strip() != user_id.strip():
        logger.error(f"[toggle_publish_question] SECURITY ISSUE: User {user_id} attempted to publish/unpublish question {question_id} created by {existing_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to publish/unpublish this question")
    
    result = await db.questions.update_one(
        {"_id": ObjectId(question_id)},
        {"$set": {"is_published": is_published, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    question_dict = {
        "id": str(question["_id"]),
        "title": question.get("title", ""),
        "description": question.get("description", ""),
        "difficulty": question.get("difficulty", ""),
        "languages": question.get("languages", []),
        "starter_code": question.get("starter_code", {}),
        "public_testcases": question.get("public_testcases", []),
        "hidden_testcases": question.get("hidden_testcases", []),
        "is_published": question.get("is_published", False),
    }
    if "function_signature" in question and question.get("function_signature"):
        question_dict["function_signature"] = question["function_signature"]
    if "created_at" in question:
        question_dict["created_at"] = question["created_at"].isoformat() if isinstance(question.get("created_at"), datetime) else question.get("created_at")
    if "updated_at" in question:
        question_dict["updated_at"] = question["updated_at"].isoformat() if isinstance(question.get("updated_at"), datetime) else question.get("updated_at")
    return question_dict

@router.delete("/{question_id}")
async def delete_question(
    question_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Delete a question (requires authentication and ownership)
    """
    db = get_database()
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    
    # Check if question exists and belongs to the current user
    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id)
    existing_question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not existing_question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Verify ownership
    existing_created_by = existing_question.get("created_by")
    if not existing_created_by or str(existing_created_by).strip() != user_id.strip():
        logger.error(f"[delete_question] SECURITY ISSUE: User {user_id} attempted to delete question {question_id} created by {existing_created_by}")
        raise HTTPException(status_code=403, detail="You don't have permission to delete this question")
    
    result = await db.questions.delete_one({"_id": ObjectId(question_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    return {"message": "Question deleted successfully"}


@router.post("/{question_id}/clone", response_model=dict)
async def clone_question(
    question_id: str,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """
    Clone (duplicate) a DSA question for the same owner.
    Creates a new question document with a new _id and timestamps, and sets is_published=False.
    """
    db = get_database()
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")

    user_id = current_user.get("id") or current_user.get("_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user_id = str(user_id).strip()

    original = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not original:
        raise HTTPException(status_code=404, detail="Question not found")

    if str(original.get("created_by", "")).strip() != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to clone this question")

    # Build clone doc (strip identity/timestamps)
    clone_doc = {k: v for k, v in original.items() if k not in ("_id", "id", "created_at", "updated_at")}
    clone_doc["title"] = f"{original.get('title', 'Untitled')} (Copy)"
    clone_doc["is_published"] = False
    clone_doc["created_at"] = datetime.utcnow()
    clone_doc["updated_at"] = datetime.utcnow()
    # Keep module isolation
    clone_doc["module_type"] = original.get("module_type") or "dsa"
    clone_doc["created_by"] = user_id

    # Validate the cloned payload for DSA coding questions (skip SQL)
    _validate_dsa_coding_payload(clone_doc)

    result = await db.questions.insert_one(clone_doc)
    created = await db.questions.find_one({"_id": result.inserted_id})
    return {
        "id": str(created["_id"]),
        "title": created.get("title", ""),
        "description": created.get("description", ""),
        "difficulty": created.get("difficulty", ""),
        "languages": created.get("languages", []),
        "starter_code": created.get("starter_code", {}),
        "public_testcases": created.get("public_testcases", []),
        "hidden_testcases": created.get("hidden_testcases", []),
        "is_published": created.get("is_published", False),
        "created_at": created.get("created_at").isoformat() if created.get("created_at") else None,
        "updated_at": created.get("updated_at").isoformat() if created.get("updated_at") else None,
    }

