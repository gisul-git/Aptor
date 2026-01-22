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

from ..config import JUDGE0_URL, JUDGE0_POLL_INTERVAL, JUDGE0_MAX_POLLS, JUDGE0_TIMEOUT

logger = logging.getLogger(__name__)

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


async def run_all_test_cases(
    source_code: str,
    language_id: int,
    test_cases: List[Dict[str, Any]],
    cpu_time_limit: float = 2.0,
    memory_limit: int = 128000,
    stop_on_compilation_error: bool = True,
) -> Dict[str, Any]:
    """
    Run all test cases for a question sequentially.
    Returns aggregated results with score calculation.
    
    This function is LANGUAGE-AGNOSTIC.
    
    test_cases should have: stdin, expected_output, is_hidden, points, id (optional)
    """
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
        
        # Run the test case using submit_to_judge0
        try:
            result = await submit_to_judge0(
                source_code=source_code,
                language_id=language_id,
                stdin=stdin,
                timeout=JUDGE0_TIMEOUT,
            )
            
            status = result.get("status", {})
            status_id = status.get("id", 0)
            status_desc = status.get("description", JUDGE0_STATUS.get(status_id, "Unknown"))
            
            # Determine if test passed
            passed = status_id == 3  # Accepted
            
            # Check for compilation error
            if status_id == 6:
                compilation_error = True
            
            # Calculate score
            if passed:
                total_score += points
                passed_count += 1
            
            # Build result entry
            result_entry = {
                "test_case_id": tc_id,
                "is_hidden": is_hidden,
                "passed": passed,
                "status": status_desc,
                "status_id": status_id,
                "time": result.get("time"),
                "memory": result.get("memory"),
            }
            
            # Only include details for visible test cases
            if not is_hidden:
                result_entry.update({
                    "stdin": stdin,
                    "expected_output": expected_output,
                    "stdout": result.get("stdout") or "",
                    "stderr": result.get("stderr") or "",
                    "compile_output": result.get("compile_output") or "",
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
                
        except Exception as e:
            logger.error(f"Test case execution error: {e}")
            results.append({
                "test_case_id": tc_id,
                "is_hidden": is_hidden,
                "passed": False,
                "status": "Execution Error",
                "status_id": 13,
                "time": None,
                "memory": None,
                "stdout": "",
                "stderr": str(e),
                "compile_output": "",
            })
            max_score += points
    
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

