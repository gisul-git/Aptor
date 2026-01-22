"""
Assessment code execution router for running and submitting code.
This is separate from DSA assessment routes and handles general assessment questions.
"""
import logging
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ....db.mongo import get_database
from .utils.judge0 import run_all_test_cases, LANGUAGE_IDS, submit_to_judge0

logger = logging.getLogger("backend")
router = APIRouter(prefix="/api/v1/assessment", tags=["assessment"])


# ============================================================================
# Request/Response Models
# ============================================================================

class RunCodeRequest(BaseModel):
    """Request for running code (public test cases only)"""
    question_id: str
    source_code: str
    language_id: int
    assessment_id: Optional[str] = None  # Optional: helps narrow down search


class SubmitCodeRequest(BaseModel):
    """Request for submitting code (all test cases)"""
    question_id: str
    source_code: str
    language_id: int
    assessment_id: Optional[str] = None  # Optional: helps narrow down search


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
    """Limited details for hidden test case - only pass/fail"""
    id: str
    test_number: int
    passed: bool
    status: str


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/run")
async def run_code(request: RunCodeRequest):
    """
    RUN CODE - Execute only PUBLIC test cases.
    Returns full details for all public test cases.
    Used when user clicks "Run Code" button.
    """
    logger.info(f"Running code for assessment question {request.question_id} (public tests only)")
    logger.info(f"Request data: question_id={request.question_id}, language_id={request.language_id}, source_code_length={len(request.source_code)}")
    
    db = get_database()
    
    # Try to find question in assessments collection
    # Handle both ObjectId and string IDs
    question = None
    question_id = request.question_id
    
    # Try with ObjectId if valid
    if ObjectId.is_valid(question_id):
        question = await db.assessments.find_one(
            {"questions._id": ObjectId(question_id)},
            {"questions.$": 1}
        )
        
        # If not found in assessments, try topics_v2 collection
        if not question:
            question = await db.topics_v2.find_one(
                {"questions._id": ObjectId(question_id)},
                {"questions.$": 1}
            )
    
    # If not found with ObjectId, try searching by string ID or position
    if not question:
        logger.info(f"Searching for question by string ID: {question_id}")
        # If assessment_id is provided, search only in that assessment
        if request.assessment_id and ObjectId.is_valid(request.assessment_id):
            assessment = await db.assessments.find_one({"_id": ObjectId(request.assessment_id)})
            assessments = [assessment] if assessment else []
            logger.info(f"Searching in specific assessment: {request.assessment_id}")
        else:
            # Search in all assessments
            assessments = await db.assessments.find({}).to_list(length=None)
            logger.info(f"Searching through {len(assessments)} assessments")
        
        # Try to parse the generated ID format: topicId-rowId-questionIndex-counter
        # Example: "23563dea-0781-401f-9fac-cdcc266444d0-6bfc0428-d9e0-437f-9945-fe07004fd134-0-3"
        # Format: ${topicId}-${rowId}-${questionIndex}-${counter}
        id_parts = question_id.split("-")
        parsed_question_index = None
        
        # Try to extract questionIndex from the ID
        # The last part is usually the counter, second-to-last might be questionIndex
        if len(id_parts) >= 2:
            # Try the last few parts to find questionIndex
            for i in range(len(id_parts) - 1, max(0, len(id_parts) - 4), -1):
                try:
                    potential_index = int(id_parts[i])
                    # Question index is usually small (0-10), counter might be larger
                    if potential_index < 100:  # Reasonable upper bound for question index
                        parsed_question_index = potential_index
                        break
                except ValueError:
                    continue
        
        for assessment_idx, assessment in enumerate(assessments):
            if not assessment:
                continue
                
            assessment_id_str = str(assessment.get("_id", ""))
            
            topics_v2 = assessment.get("topics_v2", [])
            for topic_idx, topic in enumerate(topics_v2):
                topic_id = str(topic.get("id", "")) or str(topic.get("_id", ""))
                
                # Check if topic_id is in the question_id (since ID format is topicId-rowId-questionIndex-counter)
                if not topic_id or topic_id not in question_id:
                    continue
                
                question_rows = topic.get("questionRows", [])
                for row_idx, row in enumerate(question_rows):
                    row_id = str(row.get("rowId", "")) or str(row.get("id", ""))
                    
                    # Check if row_id is in the question_id
                    if not row_id or row_id not in question_id:
                        continue
                    
                    questions = row.get("questions", [])
                    for q_idx, q in enumerate(questions):
                        # Check multiple ID fields first
                        q_id = str(q.get("_id", ""))
                        q_id2 = str(q.get("id", ""))
                        
                        # Try exact match
                        if q_id == question_id or q_id2 == question_id:
                            logger.info(f"Found question by exact ID match in assessment {assessment_id_str[:8]}...")
                            question = q
                            break
                        
                        # Try to match by position if we parsed question_index and it matches
                        if parsed_question_index is not None and q_idx == parsed_question_index:
                            logger.info(f"Found question by position match: topic={topic_id[:8]}..., row={row_id[:8]}..., index={q_idx}")
                            question = q
                            break
                        
                        # Fallback: if we're at a position that matches any numeric part in the ID
                        # Check if any numeric part of question_id matches the question index
                        for part in id_parts:
                            try:
                                if int(part) == q_idx and q_idx < len(questions):
                                    logger.info(f"Found question by pattern match: index={q_idx}")
                                    question = q
                                    break
                            except ValueError:
                                continue
                        if question:
                            break
                    if question:
                        break
                if question:
                    break
            if question:
                break
            
            # Also check old topics structure
            if not question:
                topics = assessment.get("topics", [])
                for topic in topics:
                    questions = topic.get("questions", [])
                    for q in questions:
                        q_id = str(q.get("_id", ""))
                        q_id2 = str(q.get("id", ""))
                        if q_id == question_id or q_id2 == question_id:
                            logger.info(f"Found question in old topics structure")
                            question = q
                            break
                    if question:
                        break
                if question:
                    break
        
        if not question:
            logger.warning(f"Question not found after searching {len(assessments)} assessments. ID: {question_id}")
    
    # Extract the question from the result if it was found via ObjectId query
    if question and "questions" in question and len(question["questions"]) > 0:
        question = question["questions"][0]
    
    if not question:
        raise HTTPException(status_code=404, detail=f"Question not found with ID: {question_id}")
    
    # Build test cases array - PUBLIC ONLY
    test_cases = []
    public_testcases = question.get("public_testcases", []) or question.get("coding_data", {}).get("public_testcases", [])
    
    for i, tc in enumerate(public_testcases):
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
    cpu_time_limit = 2.0
    memory_limit = 128000
    
    # Run public test cases only
    try:
        result = await run_all_test_cases(
            source_code=request.source_code,
            language_id=request.language_id,
            test_cases=test_cases,
            cpu_time_limit=cpu_time_limit,
            memory_limit=memory_limit,
        )
    except Exception as e:
        logger.error(f"Error running test cases: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to execute code: {str(e)}")
    
    # Format results
    public_results = []
    for i, res in enumerate(result["results"]):
        tc = test_cases[i]
        passed = res.get("passed", False)
        
        # Handle status - it can be a string or a dict
        status_value = res.get("status", "Unknown")
        if isinstance(status_value, dict):
            status_description = status_value.get("description", "Unknown")
            status_id = status_value.get("id", res.get("status_id", 0))
        else:
            # status is already a string
            status_description = status_value
            status_id = res.get("status_id", 0)
        
        public_results.append({
            "id": tc["id"],
            "test_number": i + 1,
            "input": tc["stdin"],
            "expected_output": tc["expected_output"],
            "user_output": res.get("stdout", ""),
            "status": status_description,
            "status_id": status_id,
            "time": res.get("time"),
            "memory": res.get("memory"),
            "passed": passed,
            "stderr": res.get("stderr"),
            "compile_output": res.get("compile_output"),
        })
    
    # Calculate summary
    passed_count = sum(1 for r in public_results if r["passed"])
    total_count = len(public_results)
    
    response = {
        "question_id": request.question_id,
        "public_results": public_results,
        "public_summary": {
            "total": total_count,
            "passed": passed_count,
        },
        "status": "completed" if passed_count == total_count else "partial",
        "compilation_error": any(r.get("compile_output") for r in public_results),
    }
    
    return response


@router.post("/submit")
async def submit_code(request: SubmitCodeRequest):
    """
    SUBMIT CODE - Execute ALL test cases (public + hidden).
    Returns:
    - Full details for public test cases
    - Only pass/fail for hidden test cases (NO input/output/stderr)
    Used when user clicks "Submit" button.
    """
    logger.info(f"Submitting code for assessment question {request.question_id} (all tests)")
    
    db = get_database()
    
    # Try to find question in assessments collection
    # Handle both ObjectId and string IDs
    question = None
    question_id = request.question_id
    
    # Try with ObjectId if valid
    if ObjectId.is_valid(question_id):
        question = await db.assessments.find_one(
            {"questions._id": ObjectId(question_id)},
            {"questions.$": 1}
        )
        
        # If not found in assessments, try topics_v2 collection
        if not question:
            question = await db.topics_v2.find_one(
                {"questions._id": ObjectId(question_id)},
                {"questions.$": 1}
            )
    
    # If not found with ObjectId, try searching by string ID or position
    if not question:
        logger.info(f"Searching for question by string ID: {question_id}")
        # If assessment_id is provided, search only in that assessment
        if request.assessment_id and ObjectId.is_valid(request.assessment_id):
            assessment = await db.assessments.find_one({"_id": ObjectId(request.assessment_id)})
            assessments = [assessment] if assessment else []
            logger.info(f"Searching in specific assessment: {request.assessment_id}")
        else:
            # Search in all assessments
            assessments = await db.assessments.find({}).to_list(length=None)
            logger.info(f"Searching through {len(assessments)} assessments")
        
        # Try to parse the generated ID format: topicId-rowId-questionIndex-counter
        id_parts = question_id.split("-")
        parsed_question_index = None
        
        # Try to extract questionIndex from the ID
        if len(id_parts) >= 2:
            for i in range(len(id_parts) - 1, max(0, len(id_parts) - 4), -1):
                try:
                    potential_index = int(id_parts[i])
                    if potential_index < 100:  # Reasonable upper bound for question index
                        parsed_question_index = potential_index
                        break
                except ValueError:
                    continue
        
        for assessment_idx, assessment in enumerate(assessments):
            if not assessment:
                continue
                
            assessment_id_str = str(assessment.get("_id", ""))
            
            topics_v2 = assessment.get("topics_v2", [])
            for topic_idx, topic in enumerate(topics_v2):
                topic_id = str(topic.get("id", "")) or str(topic.get("_id", ""))
                
                # Check if topic_id is in the question_id
                if not topic_id or topic_id not in question_id:
                    continue
                
                question_rows = topic.get("questionRows", [])
                for row_idx, row in enumerate(question_rows):
                    row_id = str(row.get("rowId", "")) or str(row.get("id", ""))
                    
                    # Check if row_id is in the question_id
                    if not row_id or row_id not in question_id:
                        continue
                    
                    questions = row.get("questions", [])
                    for q_idx, q in enumerate(questions):
                        # Check multiple ID fields first
                        q_id = str(q.get("_id", ""))
                        q_id2 = str(q.get("id", ""))
                        
                        # Try exact match
                        if q_id == question_id or q_id2 == question_id:
                            logger.info(f"Found question by exact ID match in assessment {assessment_id_str[:8]}...")
                            question = q
                            break
                        
                        # Try to match by position if we parsed question_index and it matches
                        if parsed_question_index is not None and q_idx == parsed_question_index:
                            logger.info(f"Found question by position match: topic={topic_id[:8]}..., row={row_id[:8]}..., index={q_idx}")
                            question = q
                            break
                        
                        # Fallback: if we're at a position that matches any numeric part in the ID
                        for part in id_parts:
                            try:
                                if int(part) == q_idx and q_idx < len(questions):
                                    logger.info(f"Found question by pattern match: index={q_idx}")
                                    question = q
                                    break
                            except ValueError:
                                continue
                        if question:
                            break
                    if question:
                        break
                if question:
                    break
            if question:
                break
            
            # Also check old topics structure
            if not question:
                topics = assessment.get("topics", [])
                for topic in topics:
                    questions = topic.get("questions", [])
                    for q in questions:
                        q_id = str(q.get("_id", ""))
                        q_id2 = str(q.get("id", ""))
                        if q_id == question_id or q_id2 == question_id:
                            logger.info(f"Found question in old topics structure")
                            question = q
                            break
                    if question:
                        break
                if question:
                    break
        
        if not question:
            logger.warning(f"Question not found after searching {len(assessments)} assessments. ID: {question_id}")
    
    # Extract the question from the result if it was found via ObjectId query
    if question and "questions" in question and len(question["questions"]) > 0:
        question = question["questions"][0]
    
    if not question:
        raise HTTPException(status_code=404, detail=f"Question not found with ID: {question_id}")
    
    # Build test cases array - PUBLIC + HIDDEN
    public_test_cases = []
    hidden_test_cases = []
    all_test_cases = []
    
    # Add public test cases
    public_testcases = question.get("public_testcases", []) or question.get("coding_data", {}).get("public_testcases", [])
    for i, tc in enumerate(public_testcases):
        test_case = {
            "id": f"public_{i}",
            "stdin": tc.get("input", ""),
            "expected_output": tc.get("expected_output", ""),
            "is_hidden": False,
            "points": tc.get("points", 1),
        }
        public_test_cases.append(test_case)
        all_test_cases.append(test_case)
    
    # Add hidden test cases
    hidden_testcases = question.get("hidden_testcases", []) or question.get("coding_data", {}).get("hidden_testcases", [])
    for i, tc in enumerate(hidden_testcases):
        test_case = {
            "id": f"hidden_{i}",
            "stdin": tc.get("input", ""),
            "expected_output": tc.get("expected_output", ""),
            "is_hidden": True,
            "points": tc.get("points", 1),
        }
        hidden_test_cases.append(test_case)
        all_test_cases.append(test_case)
    
    if not all_test_cases:
        raise HTTPException(status_code=400, detail="Question has no test cases")
    
    # Get execution constraints (default values)
    cpu_time_limit = 2.0
    memory_limit = 128000
    
    # Run all test cases
    try:
        result = await run_all_test_cases(
            source_code=request.source_code,
            language_id=request.language_id,
            test_cases=all_test_cases,
            cpu_time_limit=cpu_time_limit,
            memory_limit=memory_limit,
        )
    except Exception as e:
        logger.error(f"Error running test cases: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to execute code: {str(e)}")
    
    # Format public results (full details)
    public_results = []
    public_index = 0
    for i, res in enumerate(result["results"]):
        tc = all_test_cases[i]
        if not tc["is_hidden"]:
            passed = res.get("passed", False)
            
            # Handle status - it's a string from run_all_test_cases, not a dict
            status_value = res.get("status", "Unknown")
            status_id = res.get("status_id", 0)
            
            public_results.append({
                "id": tc["id"],
                "test_number": public_index + 1,
                "input": tc["stdin"],
                "expected_output": tc["expected_output"],
                "user_output": res.get("stdout", ""),
                "status": status_value if isinstance(status_value, str) else str(status_value),
                "status_id": status_id,
                "time": res.get("time"),
                "memory": res.get("memory"),
                "passed": passed,
                "stderr": res.get("stderr"),
                "compile_output": res.get("compile_output"),
            })
            public_index += 1
    
    # Format hidden results (only pass/fail)
    hidden_results = []
    hidden_index = 0
    for i, res in enumerate(result["results"]):
        tc = all_test_cases[i]
        if tc["is_hidden"]:
            passed = res.get("passed", False)
            
            # Handle status - it's a string from run_all_test_cases, not a dict
            status_value = res.get("status", "Unknown")
            
            hidden_results.append({
                "id": tc["id"],
                "test_number": hidden_index + 1,
                "passed": passed,
                "status": status_value if isinstance(status_value, str) else str(status_value),
            })
            hidden_index += 1
    
    # Calculate summaries
    public_passed = sum(1 for r in public_results if r["passed"])
    hidden_passed = sum(1 for r in hidden_results if r["passed"])
    total_passed = public_passed + hidden_passed
    total_tests = len(all_test_cases)
    
    # Calculate score (simple: points for each passed test)
    score = total_passed
    max_score = total_tests
    
    response = {
        "question_id": request.question_id,
        "public_results": public_results,
        "hidden_results": hidden_results,
        "hidden_summary": {
            "total": len(hidden_test_cases),
            "passed": hidden_passed,
        },
        "total_passed": total_passed,
        "total_tests": total_tests,
        "score": score,
        "max_score": max_score,
        "status": "accepted" if total_passed == total_tests else "wrong_answer",
        "compilation_error": any(r.get("compile_output") for r in public_results),
    }
    
    return response


# ============================================================================
# SQL Execution Endpoints (Judge0 SQLite)
# ============================================================================

class RunSQLRequest(BaseModel):
    """Request for running SQL query"""
    question_id: str
    sql_query: str
    assessment_id: Optional[str] = None


def build_sql_script(
    schemas: Dict[str, Any],
    sample_data: Dict[str, Any],
    user_query: str,
) -> str:
    """
    Build a complete SQL script for Judge0 SQLite execution.
    
    The script:
    1. Creates all tables from schemas
    2. Inserts sample data
    3. Runs the user's query
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
    SQLITE_LANGUAGE_ID = 82
    
    try:
        result = await submit_to_judge0(
            source_code=sql_script,
            language_id=SQLITE_LANGUAGE_ID,
            stdin="",
            timeout=10.0
        )
        
        # Check if execution was successful
        status = result.get("status", {})
        status_id = status.get("id", 0) if isinstance(status, dict) else 0
        success = status_id == 3  # Accepted
        
        return {
            "success": success,
            "status_id": status_id,
            "stdout": result.get("stdout", ""),
            "stderr": result.get("stderr", ""),
            "compile_output": result.get("compile_output", ""),
            "time": result.get("time"),
            "memory": result.get("memory"),
        }
    except Exception as e:
        logger.error(f"Error executing SQL with Judge0: {str(e)}")
        return {
            "success": False,
            "status_id": 13,  # Internal Error
            "stderr": str(e),
            "stdout": "",
            "compile_output": "",
        }


@router.post("/run-sql")
async def run_sql(request: RunSQLRequest):
    """
    RUN SQL - Execute SQL query against sample data.
    Returns the query results for preview.
    Used when user clicks "Run" button on SQL questions.
    """
    logger.info(f"Running SQL for assessment question {request.question_id}")
    
    db = get_database()
    
    # Find question using the same logic as run_code endpoint
    question = None
    question_id = request.question_id
    
    # Try with ObjectId if valid
    if ObjectId.is_valid(question_id):
        question = await db.assessments.find_one(
            {"questions._id": ObjectId(question_id)},
            {"questions.$": 1}
        )
        
        # If not found in assessments, try topics_v2 collection
        if not question:
            question = await db.topics_v2.find_one(
                {"questions._id": ObjectId(question_id)},
                {"questions.$": 1}
            )
    
    # If not found with ObjectId, try searching by string ID or position
    if not question:
        logger.info(f"Searching for question by string ID: {question_id}")
        # If assessment_id is provided, search only in that assessment
        if request.assessment_id and ObjectId.is_valid(request.assessment_id):
            assessment = await db.assessments.find_one({"_id": ObjectId(request.assessment_id)})
            assessments = [assessment] if assessment else []
            logger.info(f"Searching in specific assessment: {request.assessment_id}")
        else:
            # Search in all assessments
            assessments = await db.assessments.find({}).to_list(length=None)
            logger.info(f"Searching through {len(assessments)} assessments")
        
        # Try to parse the generated ID format: topicId-rowId-questionIndex-counter
        # Example: "23563dea-0781-401f-9fac-cdcc266444d0-6bfc0428-d9e0-437f-9945-fe07004fd134-0-3"
        # Format: ${topicId}-${rowId}-${questionIndex}-${counter}
        id_parts = question_id.split("-")
        parsed_question_index = None
        
        # Try to extract questionIndex from the ID
        # The last part is usually the counter, second-to-last might be questionIndex
        if len(id_parts) >= 2:
            # Try the last few parts to find questionIndex
            for i in range(len(id_parts) - 1, max(0, len(id_parts) - 4), -1):
                try:
                    potential_index = int(id_parts[i])
                    # Question index is usually small (0-10), counter might be larger
                    if potential_index < 100:  # Reasonable upper bound for question index
                        parsed_question_index = potential_index
                        break
                except ValueError:
                    continue
        
        for assessment_idx, assessment in enumerate(assessments):
            if not assessment:
                continue
                
            assessment_id_str = str(assessment.get("_id", ""))
            
            topics_v2 = assessment.get("topics_v2", [])
            for topic_idx, topic in enumerate(topics_v2):
                topic_id = str(topic.get("id", "")) or str(topic.get("_id", ""))
                
                # Check if topic_id is in the question_id (since ID format is topicId-rowId-questionIndex-counter)
                if not topic_id or topic_id not in question_id:
                    continue
                
                question_rows = topic.get("questionRows", [])
                for row_idx, row in enumerate(question_rows):
                    row_id = str(row.get("rowId", "")) or str(row.get("id", ""))
                    
                    # Check if row_id is in the question_id
                    if not row_id or row_id not in question_id:
                        continue
                    
                    questions = row.get("questions", [])
                    for q_idx, q in enumerate(questions):
                        # Check multiple ID fields first
                        q_id = str(q.get("_id", ""))
                        q_id2 = str(q.get("id", ""))
                        
                        # Try exact match
                        if q_id == question_id or q_id2 == question_id:
                            logger.info(f"Found question by exact ID match in assessment {assessment_id_str[:8]}...")
                            question = q
                            break
                        
                        # Try to match by position if we parsed question_index and it matches
                        if parsed_question_index is not None and q_idx == parsed_question_index:
                            logger.info(f"Found question by position match: topic={topic_id[:8]}..., row={row_id[:8]}..., index={q_idx}")
                            question = q
                            break
                        
                        # Fallback: if we're at a position that matches any numeric part in the ID
                        # Check if any numeric part of question_id matches the question index
                        for part in id_parts:
                            try:
                                if int(part) == q_idx and q_idx < len(questions):
                                    logger.info(f"Found question by pattern match: index={q_idx}")
                                    question = q
                                    break
                            except ValueError:
                                continue
                        if question:
                            break
                    if question:
                        break
                if question:
                    break
            if question:
                break
            
            # Also check old topics structure
            if not question:
                topics = assessment.get("topics", [])
                for topic in topics:
                    questions = topic.get("questions", [])
                    for q in questions:
                        q_id = str(q.get("_id", ""))
                        q_id2 = str(q.get("id", ""))
                        if q_id == question_id or q_id2 == question_id:
                            logger.info(f"Found question in old topics structure")
                            question = q
                            break
                    if question:
                        break
                if question:
                    break
        
        if not question:
            logger.warning(f"Question not found after searching {len(assessments)} assessments. ID: {question_id}")
    
    # Extract the question from the result if it was found via ObjectId query
    if question and "questions" in question and len(question["questions"]) > 0:
        question = question["questions"][0]
    
    if not question:
        raise HTTPException(status_code=404, detail=f"Question not found with ID: {question_id}")
    
    # Verify this is a SQL question
    question_type = question.get("question_type", "").upper() or question.get("type", "").upper()
    if question_type != "SQL":
        raise HTTPException(status_code=400, detail="This endpoint is for SQL questions only")
    
    # Get schemas and sample data from sql_data or root level
    sql_data = question.get("sql_data", {})
    schemas = sql_data.get("schemas", {}) or question.get("schemas", {})
    sample_data = sql_data.get("sample_data", {}) or question.get("sample_data", {})
    
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

