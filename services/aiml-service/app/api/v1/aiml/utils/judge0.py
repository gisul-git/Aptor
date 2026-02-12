"""
Judge0 API Integration for AIML
Uses the same Judge0 service as DSA but configured for AIML
"""

import asyncio
import base64
import logging
from typing import Any, Dict, List, Optional
import httpx
from ..config import JUDGE0_URL, JUDGE0_POLL_INTERVAL, JUDGE0_MAX_POLLS, JUDGE0_TIMEOUT

logger = logging.getLogger("backend")

# Python 3 is the primary language for AIML
LANGUAGE_IDS = {
    "python3": 71,
    "python": 71,
    "python2": 70,
}

JUDGE0_STATUS = {
    1: "In Queue",
    2: "Processing",
    3: "Accepted",
    4: "Wrong Answer",
    5: "Time Limit Exceeded",
    6: "Compilation Error",
    7: "Runtime Error (SIGSEGV)",
    8: "Runtime Error (SIGXFSZ)",
    9: "Runtime Error (SIGFPE)",
    10: "Runtime Error (SIGABRT)",
    11: "Runtime Error (NZEC)",
    12: "Runtime Error (Other)",
    13: "Internal Error",
    14: "Exec Format Error",
}


class Judge0ExecutionError(Exception):
    """Raised when Judge0 cannot execute the submission."""


def get_language_id(language: str) -> Optional[int]:
    """Get Judge0 language ID from language name."""
    if language.lower() in LANGUAGE_IDS:
        return LANGUAGE_IDS[language.lower()]
    try:
        return int(language)
    except ValueError:
        return None


async def create_submission(
    source_code: str,
    language_id: int,
    stdin: str = "",
    expected_output: str = "",
    cpu_time_limit: float = 2.0,
    memory_limit: int = 128000,
    wall_time_limit: float = 5.0,
) -> str:
    """Create a Judge0 submission and return the token."""
    url = f"{JUDGE0_URL}/submissions"
    payload = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin,
        "expected_output": expected_output if expected_output else None,
        "cpu_time_limit": cpu_time_limit,
        "memory_limit": memory_limit,
        "wall_time_limit": wall_time_limit,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    
    logger.info(f"Creating Judge0 submission for AIML")
    
    try:
        timeout_config = httpx.Timeout(connect=15.0, read=30.0, write=15.0, pool=15.0)
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            response = await client.post(
                url,
                json=payload,
                params={"base64_encoded": "false", "wait": "false"}
            )
            
            if response.status_code not in [200, 201]:
                raise Judge0ExecutionError(f"Failed to create submission: {response.text}")
            
            result = response.json()
            token = result.get("token")
            
            if not token:
                raise Judge0ExecutionError("No token returned from Judge0")
            
            return token
            
    except httpx.HTTPError as e:
        raise Judge0ExecutionError(f"HTTP error creating submission: {e}")


async def get_submission_result(token: str) -> Dict[str, Any]:
    """Get the result of a Judge0 submission by token."""
    url = f"{JUDGE0_URL}/submissions/{token}"
    
    try:
        timeout_config = httpx.Timeout(connect=10.0, read=15.0, write=10.0, pool=10.0)
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            response = await client.get(
                url,
                params={"base64_encoded": "false"}
            )
            
            if response.status_code != 200:
                raise Judge0ExecutionError(f"Failed to get submission: {response.text}")
            
            result = response.json()
            
            # Decode base64 fields if present
            for field in ["stdout", "stderr", "compile_output", "message"]:
                if field in result and result[field]:
                    try:
                        if isinstance(result[field], str) and len(result[field]) > 0:
                            decoded = base64.b64decode(result[field]).decode("utf-8")
                            result[field] = decoded
                    except Exception:
                        pass
            
            return result
            
    except httpx.HTTPError as e:
        raise Judge0ExecutionError(f"HTTP error getting submission: {e}")


async def poll_submission(
    token: str,
    poll_interval: float = None,
    max_polls: int = None,
) -> Dict[str, Any]:
    """Poll Judge0 for submission result until it's complete."""
    if poll_interval is None:
        poll_interval = JUDGE0_POLL_INTERVAL
    if max_polls is None:
        max_polls = JUDGE0_MAX_POLLS
    
    for attempt in range(max_polls):
        result = await get_submission_result(token)
        
        status = result.get("status", {})
        status_id = status.get("id", 0)
        
        if status_id not in [1, 2]:
            return result
        
        await asyncio.sleep(poll_interval)
    
    logger.warning(f"Polling timed out after {max_polls} attempts")
    return {
        "status": {"id": 13, "description": "Polling Timeout"},
        "stdout": None,
        "stderr": "Execution timed out while waiting for results",
        "compile_output": None,
        "time": None,
        "memory": None,
    }


async def run_test_case(
    source_code: str,
    language_id: int,
    stdin: str,
    expected_output: str,
    cpu_time_limit: float = 2.0,
    memory_limit: int = 128000,
) -> Dict[str, Any]:
    """Run a single test case."""
    try:
        token = await create_submission(
            source_code=source_code,
            language_id=language_id,
            stdin=stdin,
            expected_output=expected_output,
            cpu_time_limit=cpu_time_limit,
            memory_limit=memory_limit,
        )
        
        result = await poll_submission(token)
        
        status = result.get("status", {})
        status_id = status.get("id", 0)
        status_desc = status.get("description", JUDGE0_STATUS.get(status_id, "Unknown"))
        
        passed = status_id == 3  # Accepted
        
        return {
            "token": token,
            "passed": passed,
            "status_id": status_id,
            "status": status_desc,
            "stdout": result.get("stdout") or "",
            "stderr": result.get("stderr") or "",
            "compile_output": result.get("compile_output") or "",
            "time": result.get("time"),
            "memory": result.get("memory"),
            "message": result.get("message"),
        }
        
    except Judge0ExecutionError as e:
        logger.error(f"Test case execution error: {e}")
        return {
            "token": None,
            "passed": False,
            "status_id": 13,
            "status": "Execution Error",
            "stdout": "",
            "stderr": str(e),
            "compile_output": "",
            "time": None,
            "memory": None,
            "message": str(e),
        }


async def run_all_test_cases(
    source_code: str,
    language_id: int,
    test_cases: List[Dict[str, Any]],
    cpu_time_limit: float = 2.0,
    memory_limit: int = 128000,
) -> Dict[str, Any]:
    """Run all test cases for a question sequentially."""
    results = []
    total_score = 0
    max_score = 0
    passed_count = 0
    
    for i, tc in enumerate(test_cases):
        tc_id = tc.get("id", f"tc_{i}")
        stdin = tc.get("input", tc.get("stdin", ""))
        expected_output = tc.get("expected_output", "")
        is_hidden = tc.get("is_hidden", False)
        points = tc.get("points", 1)
        
        max_score += points
        
        result = await run_test_case(
            source_code=source_code,
            language_id=language_id,
            stdin=stdin,
            expected_output=expected_output,
            cpu_time_limit=cpu_time_limit,
            memory_limit=memory_limit,
        )
        
        if result["passed"]:
            total_score += points
            passed_count += 1
        
        result_entry = {
            "test_case_id": tc_id,
            "is_hidden": is_hidden,
            "passed": result["passed"],
            "status": result["status"],
            "status_id": result["status_id"],
            "time": result["time"],
            "memory": result["memory"],
        }
        
        if not is_hidden:
            result_entry.update({
                "input": stdin,
                "expected_output": expected_output,
                "stdout": result["stdout"],
                "stderr": result["stderr"],
                "compile_output": result["compile_output"],
            })
        
        results.append(result_entry)
    
    return {
        "passed": passed_count,
        "total": len(test_cases),
        "score": total_score,
        "max_score": max_score,
        "results": results,
    }


async def submit_to_judge0(
    source_code: str,
    language_id: int,
    stdin: str = "",
    timeout: float = 60.0,
) -> Dict[str, Any]:
    """Submit code to Judge0 and wait for result (blocking)."""
    url = f"{JUDGE0_URL}/submissions?wait=true"
    payload = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin,
    }
    
    logger.info(f"Submitting to Judge0 for AIML")
    
    try:
        timeout_config = httpx.Timeout(
            connect=15.0,
            read=timeout,
            write=15.0,
            pool=15.0,
        )
        
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            response = await client.post(url, json=payload)
            
            if response.status_code != 201:
                raise Judge0ExecutionError(
                    f"Judge0 API error (status {response.status_code}): {response.text}"
                )
            
            result = response.json()
            
            # Decode base64 fields if present
            for field in ["stdout", "stderr", "compile_output", "message"]:
                if field in result and result[field]:
                    try:
                        decoded = base64.b64decode(result[field]).decode("utf-8")
                        result[field] = decoded
                    except Exception:
                        pass
            
            return result
            
    except httpx.TimeoutException:
        raise Judge0ExecutionError(f"Judge0 request timed out after {timeout}s")
    except httpx.HTTPError as e:
        raise Judge0ExecutionError(f"Judge0 request failed: {e}")

