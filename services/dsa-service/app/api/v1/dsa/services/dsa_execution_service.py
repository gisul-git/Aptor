"""
DSA Execution Service – new execution API for the 10 DSA languages only.
Uses POST /execute with language, source_code, function_name, test_cases.
SQL uses the SQL execution engine (SQL_ENGINE_URL), not this API.
"""

import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from ..config import DSA_EXECUTION_API_URL

logger = logging.getLogger("dsa-service")

# Only these 10 DSA languages (canonical names for API)
DSA_LANGUAGES = frozenset({
    "python", "c", "cpp", "java", "go", "rust",
    "javascript", "typescript", "kotlin", "csharp",
})

# Aliases: frontend/short names -> canonical name for /execute
DSA_LANGUAGE_ALIASES = {
    "js": "javascript", "ts": "typescript", "c++": "cpp",
}

LANGUAGE_DISPLAY_NAMES = {
    "python": "Python", "c": "C", "cpp": "C++", "java": "Java",
    "go": "Go", "rust": "Rust", "javascript": "JavaScript",
    "typescript": "TypeScript", "kotlin": "Kotlin", "csharp": "C#",
}

# Verdict to internal status_id (for response shape)
VERDICT_TO_STATUS_ID = {
    "accepted": 3,
    "wrong_answer": 4,
    "runtime_error": 11,
    "compilation_error": 6,
    "timeout": 5,
}


class DSAExecutionError(Exception):
    """Raised when the DSA execution API fails."""
    pass


def _normalize_dsa_language(language: str) -> str:
    """Return canonical language name for the API (e.g. js -> javascript, c++ -> cpp)."""
    raw = (language or "").lower().strip()
    return DSA_LANGUAGE_ALIASES.get(raw, raw)


def is_dsa_language(language: str) -> bool:
    """Return True if language is one of the 10 DSA languages (not SQL)."""
    canonical = _normalize_dsa_language(language)
    return canonical in DSA_LANGUAGES


def get_supported_languages() -> List[Dict[str, Any]]:
    """List of supported DSA languages (10 only) for API/UI. Name only, no id."""
    return [
        {"name": name, "display_name": LANGUAGE_DISPLAY_NAMES.get(name, name)}
        for name in sorted(DSA_LANGUAGES)
    ]


def _build_execute_payload(
    source_code: str,
    language: str,
    function_name: str,
    test_cases: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Build request body for POST /execute.
    API shape: { language, source_code, function_name, test_cases }.
    Only "language" varies (python | c | cpp | java | go | rust | javascript | typescript | kotlin | csharp).
    test_cases[].input = object, test_cases[].expected_output = any (list/number/string).
    """
    api_test_cases = []
    for tc in test_cases:
        inp = tc.get("input") if "input" in tc else tc.get("stdin")
        if isinstance(inp, str):
            try:
                inp = json.loads(inp) if inp.strip() else {}
            except json.JSONDecodeError:
                inp = {"input": inp}
        if not isinstance(inp, dict):
            inp = {"input": inp}
        # Pass expected_output as-is (list, dict, number, string) per API
        expected = tc.get("expected_output")
        api_test_cases.append({
            "input": inp,
            "expected_output": expected,
        })
    # Only field that changes by user language
    canonical = _normalize_dsa_language(language)
    return {
        "language": canonical,
        "source_code": source_code,
        "function_name": function_name,
        "test_cases": api_test_cases,
    }


def _map_response_to_internal(
    response: Dict[str, Any],
    test_cases: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Map API response to internal run_all_test_cases format.
    Response: accepted | wrong_answer | runtime_error | compilation_error | timeout
    """
    verdict = (response.get("verdict") or "").strip().lower()
    status_id = VERDICT_TO_STATUS_ID.get(verdict, 11)
    n = len(test_cases)
    results: List[Dict[str, Any]] = []
    failed_index = response.get("failed_test_case_index", 0)
    error_message = response.get("error_message") or ""
    actual_output = response.get("actual_output")
    expected_output_resp = response.get("expected_output")
    
    # Handle actual_output - can be a list of outputs (one per test case) or a string
    actual_outputs = []
    if isinstance(actual_output, list):
        # Convert each output to string for display
        actual_outputs = [json.dumps(out) if not isinstance(out, str) else out for out in actual_output]
    elif actual_output is not None:
        # Single output or error message
        if not error_message:
            error_message = str(actual_output)

    if verdict == "accepted":
        passed_count = n
        for i, tc in enumerate(test_cases):
            # Get the actual output for this test case
            stdout_value = ""
            if i < len(actual_outputs):
                stdout_value = actual_outputs[i]
            
            r = {
                "test_case_id": tc.get("id", f"tc_{i}"),
                "is_hidden": tc.get("is_hidden", False),
                "passed": True,
                "status": "Accepted",
                "status_id": 3,
                "time": None,
                "memory": None,
                "stdout": stdout_value,
                "stderr": "",
                "compile_output": "",
            }
            if not r["is_hidden"]:
                r["stdin"] = tc.get("stdin", tc.get("input", ""))
                r["expected_output"] = tc.get("expected_output", "")
            results.append(r)
    elif verdict == "compilation_error":
        passed_count = 0
        for i, tc in enumerate(test_cases):
            r = {
                "test_case_id": tc.get("id", f"tc_{i}"),
                "is_hidden": tc.get("is_hidden", False),
                "passed": False,
                "status": "Compilation Error",
                "status_id": 6,
                "time": None,
                "memory": None,
                "stdout": "",
                "stderr": error_message,
                "compile_output": error_message,
            }
            if not tc.get("is_hidden", True):
                r["stdin"] = tc.get("stdin", tc.get("input", ""))
                r["expected_output"] = tc.get("expected_output", "")
            results.append(r)
    else:
        # wrong_answer | runtime_error | timeout
        passed_count = failed_index
        for i in range(n):
            tc = test_cases[i] if i < len(test_cases) else {}
            is_hidden = tc.get("is_hidden", False)
            if i < failed_index:
                r = {
                    "test_case_id": tc.get("id", f"tc_{i}"),
                    "is_hidden": is_hidden,
                    "passed": True,
                    "status": "Accepted",
                    "status_id": 3,
                    "time": None,
                    "memory": None,
                    "stdout": "",
                    "stderr": "",
                    "compile_output": "",
                }
                if not is_hidden:
                    r["stdin"] = tc.get("stdin", tc.get("input", ""))
                    r["expected_output"] = tc.get("expected_output", "")
                results.append(r)
            elif i == failed_index:
                # Get the actual output for the failed test case
                stdout_value = ""
                if i < len(actual_outputs):
                    stdout_value = actual_outputs[i]
                elif not isinstance(actual_output, list) and actual_output is not None:
                    stdout_value = str(actual_output)
                
                r = {
                    "test_case_id": tc.get("id", f"tc_{i}"),
                    "is_hidden": is_hidden,
                    "passed": False,
                    "status": "Wrong Answer" if verdict == "wrong_answer" else "Runtime Error" if verdict == "runtime_error" else "Time Limit Exceeded",
                    "status_id": status_id,
                    "time": None,
                    "memory": None,
                    "stdout": stdout_value,
                    "stderr": error_message if verdict == "runtime_error" else "",
                    "compile_output": "",
                }
                if not is_hidden:
                    r["stdin"] = tc.get("stdin", tc.get("input", ""))
                    r["expected_output"] = expected_output_resp if expected_output_resp is not None else tc.get("expected_output", "")
                results.append(r)
            else:
                r = {
                    "test_case_id": tc.get("id", f"tc_{i}"),
                    "is_hidden": is_hidden,
                    "passed": False,
                    "status": "Not Run",
                    "status_id": -1,
                    "time": None,
                    "memory": None,
                    "stdout": "",
                    "stderr": "",
                    "compile_output": "",
                }
                if not is_hidden:
                    r["stdin"] = tc.get("stdin", tc.get("input", ""))
                    r["expected_output"] = tc.get("expected_output", "")
                results.append(r)

    return {
        "passed": passed_count,
        "total": n,
        "score": passed_count,
        "max_score": n,
        "compilation_error": verdict == "compilation_error",
        "results": results,
    }


async def execute_dsa(
    source_code: str,
    language: str,
    function_name: str,
    test_cases: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Call the new DSA execution API (POST /execute) and return internal result format.
    Use only for the 10 DSA languages; do not use for SQL.
    """
    if not is_dsa_language(language):
        raise ValueError(f"Not a DSA language: {language}. Use only: {list(DSA_LANGUAGES)}")

    url = f"{DSA_EXECUTION_API_URL.rstrip('/')}/execute"
    payload = _build_execute_payload(source_code, language, function_name, test_cases)

    try:
        timeout = httpx.Timeout(connect=15.0, read=60.0, write=60.0, pool=15.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload)
    except httpx.HTTPError as e:
        logger.exception("DSA execution API request failed: %s", e)
        raise DSAExecutionError(f"DSA execution API error: {e}") from e

    if resp.status_code != 200:
        raise DSAExecutionError(
            f"DSA execution API returned {resp.status_code}: {resp.text[:500]}"
        )

    try:
        data = resp.json()
    except Exception as e:
        raise DSAExecutionError(f"Invalid JSON from DSA execution API: {e}") from e

    return _map_response_to_internal(data, test_cases)


async def execute_dsa_single(
    source_code: str,
    language: str,
    function_name: str,
    input_data: Any = None,
    expected_output: Any = None,
) -> Dict[str, Any]:
    """
    Run a single test case (e.g. for "Run" button). Returns raw-style result:
    { verdict, stdout?, stderr?, error_message?, failed_test_case_index? }
    """
    inp = input_data if input_data is not None else {}
    if isinstance(inp, str):
        try:
            inp = json.loads(inp) if inp.strip() else {}
        except json.JSONDecodeError:
            inp = {"input": inp}
    if not isinstance(inp, dict):
        inp = {"input": inp}
    test_cases = [{"input": inp, "expected_output": expected_output, "stdin": inp, "is_hidden": False, "id": "tc_0"}]
    payload = _build_execute_payload(source_code, language, function_name, test_cases)
    url = f"{DSA_EXECUTION_API_URL.rstrip('/')}/execute"
    try:
        timeout = httpx.Timeout(connect=15.0, read=60.0, write=60.0, pool=15.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload)
    except httpx.HTTPError as e:
        logger.exception("DSA execution API request failed: %s", e)
        raise DSAExecutionError(f"DSA execution API error: {e}") from e
    if resp.status_code != 200:
        raise DSAExecutionError(f"DSA execution API returned {resp.status_code}: {resp.text[:500]}")
    try:
        data = resp.json()
    except Exception as e:
        raise DSAExecutionError(f"Invalid JSON from DSA execution API: {e}") from e
    verdict = (data.get("verdict") or "").strip().lower()
    out = {"verdict": verdict}
    
    # Handle actual_output - can be a list or a single value
    actual_output = data.get("actual_output")
    stdout_value = ""
    
    if isinstance(actual_output, list):
        # If it's a list, get the first element (single test case)
        if actual_output:
            stdout_value = json.dumps(actual_output[0]) if not isinstance(actual_output[0], str) else actual_output[0]
    elif actual_output is not None:
        stdout_value = str(actual_output)
    
    if verdict == "accepted":
        out["stdout"] = stdout_value
        out["stderr"] = ""
    else:
        out["stdout"] = stdout_value
        out["stderr"] = data.get("error_message", "")
        out["error_message"] = data.get("error_message", "")
        if "failed_test_case_index" in data:
            out["failed_test_case_index"] = data["failed_test_case_index"]
    return out


async def run_all_test_cases_dsa(
    source_code: str,
    test_cases: List[Dict[str, Any]],
    function_name: str,
    language: str,
) -> Dict[str, Any]:
    """Run all test cases via the DSA execution API. language: name e.g. 'python'."""
    lang_name = _normalize_dsa_language(language)
    if not lang_name or lang_name not in DSA_LANGUAGES:
        raise ValueError(
            f"Unsupported DSA language: {language}. Supported: {sorted(DSA_LANGUAGES)}"
        )
    return await execute_dsa(
        source_code=source_code,
        language=lang_name,
        function_name=function_name,
        test_cases=test_cases,
    )
