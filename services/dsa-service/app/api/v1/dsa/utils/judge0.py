"""
Judge0 API Integration - LANGUAGE AGNOSTIC

This module handles all interactions with the Judge0 code execution service.
It is completely LANGUAGE-AGNOSTIC and works with any language Judge0 supports.

No hardcoded language-specific code, templates, or transformations.
All code wrapping/transformation is handled through question configuration by admins.
"""

import asyncio
import base64
import logging
from typing import Any, Dict, List, Optional

import httpx

from ..config import JUDGE0_URL, JUDGE0_POLL_INTERVAL, JUDGE0_MAX_POLLS, JUDGE0_TIMEOUT, USE_CUSTOM_ENGINE
from ..models.question import FunctionSignature
from ..services.custom_execution_service import execute_batch, CustomExecutionError

logger = logging.getLogger("backend")

# Language IDs supported by Judge0
# Full list at: https://ce.judge0.com/languages
# Admins can use ANY language ID that Judge0 supports
# This is the comprehensive list of all Judge0-supported languages
LANGUAGE_IDS = {
    # Compiled Languages
    "c": 50,           # C (GCC 9.4.0)
    "cpp": 54,         # C++ (GCC 9.4.0)
    "cpp17": 52,       # C++ 17 (GCC 9.4.0)
    "java": 62,        # Java (OpenJDK 13.0.1)
    "csharp": 51,      # C# (Mono 6.6.0.161)
    "go": 60,          # Go (1.13.5)
    "rust": 73,        # Rust (1.40.0)
    "swift": 83,       # Swift (5.2.3)
    "kotlin": 78,      # Kotlin (1.3.70)
    "scala": 81,       # Scala (2.13)
    "pascal": 67,      # Pascal (FPC 3.0.4)
    "fortran": 59,     # Fortran (GFortran 9.2.0)
    "cobol": 77,       # COBOL (GnuCOBOL 2.2)
    "assembly": 45,    # Assembly (NASM 2.14.02)
    
    # Interpreted Languages
    "python": 71,      # Python 3 (3.8.1)
    "python2": 70,     # Python 2 (2.7.17)
    "javascript": 63,  # Node.js (12.14.0)
    "typescript": 74,  # TypeScript (3.7.4)
    "php": 68,         # PHP (7.4.1)
    "ruby": 72,        # Ruby (2.7.0)
    "perl": 85,        # Perl (5.28.1)
    "lua": 64,         # Lua (5.3.5)
    "r": 80,           # R (4.0.0)
    "bash": 46,        # Bash (5.0.0)
    "groovy": 88,      # Groovy (3.0.3)
    
    # Functional Languages
    "haskell": 61,     # Haskell (GHC 8.8.1)
    "ocaml": 65,       # OCaml (4.09.0)
    "fsharp": 87,      # F# (4.7)
    "clojure": 86,     # Clojure (1.10.1)
    "lisp": 55,        # Common Lisp (SBCL 2.0.0)
    "scheme": 55,      # Scheme (Gauche 0.9.9)
    "prolog": 69,      # Prolog (GNU Prolog 1.4.5)
    
    # Other Languages
    "erlang": 58,      # Erlang (OTP 22.2)
    "elixir": 57,      # Elixir (1.9.4)
    "sql": 82,         # SQL (SQLite 3.27.2)
    "vbnet": 84,       # VB.NET (vbnc 0.0.0.5943)
}

# Language display names mapping (for UI)
LANGUAGE_DISPLAY_NAMES = {
    "c": "C",
    "cpp": "C++",
    "cpp17": "C++ 17",
    "java": "Java",
    "csharp": "C#",
    "go": "Go",
    "rust": "Rust",
    "swift": "Swift",
    "kotlin": "Kotlin",
    "scala": "Scala",
    "pascal": "Pascal",
    "fortran": "Fortran",
    "cobol": "COBOL",
    "assembly": "Assembly (NASM)",
    "python": "Python 3",
    "python2": "Python 2",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "php": "PHP",
    "ruby": "Ruby",
    "perl": "Perl",
    "lua": "Lua",
    "r": "R",
    "bash": "Bash",
    "groovy": "Groovy",
    "haskell": "Haskell",
    "ocaml": "OCaml",
    "fsharp": "F#",
    "clojure": "Clojure",
    "lisp": "Common Lisp",
    "scheme": "Scheme",
    "prolog": "Prolog",
    "erlang": "Erlang",
    "elixir": "Elixir",
    "sql": "SQL (SQLite)",
    "vbnet": "VB.NET",
}

# Get all Judge0 language IDs as a list (for frontend)
def get_all_judge0_languages() -> List[Dict[str, Any]]:
    """Get all Judge0-supported languages with their IDs and display names."""
    return [
        {
            "id": str(lang_id),
            "name": lang_name,
            "display_name": LANGUAGE_DISPLAY_NAMES.get(lang_name, lang_name.title()),
        }
        for lang_name, lang_id in LANGUAGE_IDS.items()
    ]

# Judge0 Status Codes
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
    """
    Get Judge0 language ID from language name.
    Returns None if language not in predefined list.
    Note: Admins can also use numeric IDs directly for any Judge0 language.
    """
    # First try direct lookup
    if language.lower() in LANGUAGE_IDS:
        return LANGUAGE_IDS[language.lower()]
    
    # Try to parse as integer (admin may pass raw Judge0 ID)
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
    """
    Create a Judge0 submission and return the token.
    Does NOT wait for result - use poll_submission to get result.
    
    This function is LANGUAGE-AGNOSTIC - it passes code directly to Judge0.
    Any code transformation should be done before calling this function.
    """
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
    # Remove None values
    payload = {k: v for k, v in payload.items() if v is not None}
    
    logger.info(f"Creating Judge0 submission at {url}")
    logger.info(f"Payload: language_id={language_id}, stdin={stdin[:60]}...")

    try:
        timeout_config = httpx.Timeout(connect=15.0, read=30.0, write=15.0, pool=15.0)
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            response = await client.post(
                url,
                json=payload,
                params={"base64_encoded": "false", "wait": "false"}
            )
            
            logger.info(f"Create submission response: {response.status_code}")
            
            if response.status_code not in [200, 201]:
                raise Judge0ExecutionError(f"Failed to create submission: {response.text}")
            
            result = response.json()
            token = result.get("token")
            
            if not token:
                raise Judge0ExecutionError("No token returned from Judge0")
            
            logger.info(f"Got submission token: {token}")
            return token
            
    except httpx.HTTPError as e:
        raise Judge0ExecutionError(f"HTTP error creating submission: {e}")


async def get_submission_result(token: str) -> Dict[str, Any]:
    """
    Get the result of a Judge0 submission by token.
    """
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
            
            # Decode base64 fields if somehow still encoded
            for field in ["stdout", "stderr", "compile_output", "message"]:
                if field in result and result[field]:
                    try:
                        if isinstance(result[field], str) and len(result[field]) > 0:
                            decoded = base64.b64decode(result[field]).decode("utf-8")
                            result[field] = decoded
                    except Exception:
                        pass  # Keep original value
            
            return result
            
    except httpx.HTTPError as e:
        raise Judge0ExecutionError(f"HTTP error getting submission: {e}")


async def poll_submission(
    token: str,
    poll_interval: float = None,
    max_polls: int = None,
) -> Dict[str, Any]:
    """
    Poll Judge0 for submission result until it's complete.
    Returns the final result when status is not 1 (In Queue) or 2 (Processing).
    """
    if poll_interval is None:
        poll_interval = JUDGE0_POLL_INTERVAL
    if max_polls is None:
        max_polls = JUDGE0_MAX_POLLS
    
    for attempt in range(max_polls):
        result = await get_submission_result(token)
        
        status = result.get("status", {})
        status_id = status.get("id", 0)
        
        logger.info(f"Poll {attempt + 1}/{max_polls}: status={status_id} ({JUDGE0_STATUS.get(status_id, 'Unknown')})")
        
        # If status is not "In Queue" (1) or "Processing" (2), we're done
        if status_id not in [1, 2]:
            return result
        
        await asyncio.sleep(poll_interval)
    
    # Timeout - return last result with timeout indicator
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
    """
    Run a single test case: create submission, poll for result, return formatted result.
    
    This function is LANGUAGE-AGNOSTIC.
    """
    try:
        # Create submission
        token = await create_submission(
            source_code=source_code,
            language_id=language_id,
            stdin=stdin,
            expected_output=expected_output,
            cpu_time_limit=cpu_time_limit,
            memory_limit=memory_limit,
        )
        
        # Poll for result
        result = await poll_submission(token)
        
        status = result.get("status", {})
        status_id = status.get("id", 0)
        status_desc = status.get("description", JUDGE0_STATUS.get(status_id, "Unknown"))
        
        # Determine if test passed
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
    stop_on_compilation_error: bool = True,
    function_signature: Optional[FunctionSignature] = None,
) -> Dict[str, Any]:
    """
    Run all test cases for a question.
    Uses custom execution engine for Java/Python (batch execution).
    Falls back to Judge0 for other languages (sequential execution).
    
    This function is LANGUAGE-AGNOSTIC.
    
    test_cases should have: stdin, expected_output, is_hidden, points, id (optional)
    function_signature: Required for Java/Python to use custom engine
    """
    # Check if we should use custom engine for Java/Python
    language = get_language_name(language_id)
    
    if (USE_CUSTOM_ENGINE and 
        language in ["java", "python"] and 
        function_signature is not None):
        # Use custom execution engine (batch execution)
        try:
            logger.info(f"Using custom execution engine for {language}")
            time_limit_ms = int(cpu_time_limit * 1000)
            memory_limit_mb = memory_limit // 1024
            
            result = await execute_batch(
                code=source_code,  # Raw code, no wrapping needed
                language=language,
                function_signature=function_signature,
                test_cases=test_cases,
                time_limit_ms=time_limit_ms,
                memory_limit_mb=memory_limit_mb
            )
            
            # Result is already in Judge0-compatible format
            return result
            
        except CustomExecutionError as e:
            logger.error(f"Custom engine execution failed: {e}")
            # Fall through to Judge0 as fallback, or return error
            # For now, we'll return an error structure
            return {
                "passed": 0,
                "total": len(test_cases),
                "score": 0,
                "max_score": len(test_cases),
                "compilation_error": True,
                "results": [{
                    "test_case_id": tc.get("id", f"tc_{i}"),
                    "is_hidden": tc.get("is_hidden", False),
                    "passed": False,
                    "status": "Execution Error",
                    "status_id": 13,
                    "time": None,
                    "memory": None,
                    "stdout": "",
                    "stderr": str(e),
                    "compile_output": str(e),
                } for i, tc in enumerate(test_cases)]
            }
        except Exception as e:
            logger.error(f"Unexpected error in custom engine: {e}")
            # Fall through to Judge0
    
    # Fallback to Judge0 (sequential execution for other languages or if custom engine fails)
    logger.info(f"Using Judge0 for {language or language_id}")
    results = []
    total_score = 0
    max_score = 0
    passed_count = 0
    compilation_error = False
    
    for i, tc in enumerate(test_cases):
        tc_id = tc.get("id", f"tc_{i}")
        stdin = tc.get("stdin", "")
        expected_output = tc.get("expected_output", "")
        is_hidden = tc.get("is_hidden", False)
        points = tc.get("points", 1)
        
        max_score += points
        
        logger.info(f"Running test case {i + 1}/{len(test_cases)} (id={tc_id}, hidden={is_hidden})")
        logger.info(f"  stdin: {stdin[:100]}{'...' if len(stdin) > 100 else ''}")
        logger.info(f"  expected_output: {expected_output[:100]}{'...' if len(expected_output) > 100 else ''}")
        
        # Run the test case
        result = await run_test_case(
            source_code=source_code,
            language_id=language_id,
            stdin=stdin,
            expected_output=expected_output,
            cpu_time_limit=cpu_time_limit,
            memory_limit=memory_limit,
        )
        
        logger.info(f"  result: passed={result['passed']}, status={result['status']}")
        logger.info(f"  stdout: {result.get('stdout', '')[:100]}")
        
        # Check for compilation error
        if result["status_id"] == 6:
            compilation_error = True
        
        # Calculate score
        if result["passed"]:
            total_score += points
            passed_count += 1
        
        # Build result entry
        result_entry = {
            "test_case_id": tc_id,
            "is_hidden": is_hidden,
            "passed": result["passed"],
            "status": result["status"],
            "status_id": result["status_id"],
            "time": result["time"],
            "memory": result["memory"],
        }
        
        # Only include details for visible test cases
        if not is_hidden:
            result_entry.update({
                "stdin": stdin,
                "expected_output": expected_output,
                "stdout": result["stdout"],
                "stderr": result["stderr"],
                "compile_output": result["compile_output"],
            })
        
        results.append(result_entry)
        
        # Stop on compilation error if configured
        if compilation_error and stop_on_compilation_error:
            logger.info("Stopping test execution due to compilation error")
            for j in range(i + 1, len(test_cases)):
                remaining_tc = test_cases[j]
                max_score += remaining_tc.get("points", 1)
                results.append({
                    "test_case_id": remaining_tc.get("id", f"tc_{j}"),
                    "is_hidden": remaining_tc.get("is_hidden", False),
                    "passed": False,
                    "status": "Not Run (Compilation Error)",
                    "status_id": -1,
                    "time": None,
                    "memory": None,
                })
            break
    
    return {
        "passed": passed_count,
        "total": len(test_cases),
        "score": total_score,
        "max_score": max_score,
        "compilation_error": compilation_error,
        "results": results,
    }


async def submit_to_judge0(
    source_code: str,
    language_id: int,
    stdin: str = "",
    timeout: float = 60.0,
    max_retries: int = 2,
) -> Dict[str, Any]:
    """
    Submit code to Judge0 and wait for result (blocking).
    
    This function is LANGUAGE-AGNOSTIC.
    Any code transformation should be done before calling this function.
    """
    url = f"{JUDGE0_URL}/submissions?wait=true"
    payload = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin,
    }
    headers = {"Content-Type": "application/json"}

    logger.info(f"Judge0 URL: {url}")
    logger.info(f"Submitting: language_id={language_id}, stdin_len={len(stdin)}")

    last_error: Optional[str] = None

    for attempt in range(max_retries + 1):
        try:
            timeout_config = httpx.Timeout(
                connect=15.0,
                read=timeout,
                write=15.0,
                pool=15.0,
            )
            limits = httpx.Limits(
                max_keepalive_connections=5,
                max_connections=10,
                keepalive_expiry=30.0,
            )

            async with httpx.AsyncClient(timeout=timeout_config, limits=limits) as client:
                response = await client.post(url, json=payload, headers=headers)
                logger.info(f"Judge0 response status: {response.status_code}")

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
            last_error = f"Judge0 request timed out after {timeout}s (attempt {attempt + 1}/{max_retries + 1})."
            logger.error(last_error)
        except (httpx.HTTPError, Judge0ExecutionError) as exc:
            last_error = f"Judge0 request failed: {exc}"
            logger.error(last_error)
        except Exception as exc:
            last_error = f"Unexpected Judge0 error: {exc}"
            logger.exception(last_error)
            break

        if attempt < max_retries:
            await asyncio.sleep(2)

    raise Judge0ExecutionError(last_error or "Unable to contact Judge0")


async def get_judge0_languages() -> List[Dict[str, Any]]:
    """
    Get list of all languages supported by Judge0.
    Useful for admins to see available language options.
    """
    url = f"{JUDGE0_URL}/languages"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            if response.status_code == 200:
                return response.json()
            return []
    except Exception as e:
        logger.error(f"Failed to fetch Judge0 languages: {e}")
        return []
