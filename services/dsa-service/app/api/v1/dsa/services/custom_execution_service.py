"""
Custom Execution Engine Service

Handles batch code execution for Python using custom execution engine.
Python engine URL is configured via CUSTOM_PYTHON_ENGINE_URL in .env file.

The custom engine expects:
- Raw function code (no wrapping, no main method)
- Function metadata (name, parameters)
- Test cases in JSON format
"""

import json
import logging
from typing import Dict, Any, List
import httpx
from ..models.question import FunctionSignature
from ..config import CUSTOM_PYTHON_ENGINE_URL

logger = logging.getLogger("dsa-service")

# Verdict mapping: Custom engine → Internal status IDs
VERDICT_TO_STATUS_ID = {
    "ACCEPTED": 3,
    "WRONG_ANSWER": 4,
    "COMPILATION_ERROR": 6,
    "RUNTIME_ERROR": 11,
    "TIME_LIMIT_EXCEEDED": 5,
    "MEMORY_LIMIT_EXCEEDED": 12,
    "SECURITY_VIOLATION": 13,
}

# Reverse mapping for status descriptions
STATUS_ID_TO_DESCRIPTION = {
    3: "Accepted",
    4: "Wrong Answer",
    5: "Time Limit Exceeded",
    6: "Compilation Error",
    11: "Runtime Error",
    12: "Memory Limit Exceeded",
    13: "Security Violation",
}


class CustomExecutionError(Exception):
    """Raised when custom execution engine fails"""
    pass


def get_engine_url() -> str:
    """Get the Python execution engine URL from configuration"""
    return CUSTOM_PYTHON_ENGINE_URL


async def check_custom_engine_health() -> bool:
    """Check if Python execution engine is accessible"""
    try:
        url = get_engine_url()
        health_url = f"{url}/health" if url else None
        if not health_url:
            return False
        
        timeout_config = httpx.Timeout(connect=5.0, read=10.0)
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            response = await client.get(health_url)
            return response.status_code == 200
    except Exception as e:
        logger.warning(f"Python engine health check failed: {e}")
        return False


def transform_test_cases(test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Transform DSA test cases to custom API format.
    
    Input format (DSA):
    - test_cases[i].get("input") or test_cases[i].get("stdin") - can be string (JSON) or dict
    - test_cases[i].get("expected_output") - can be string or any JSON value
    
    Output format (Custom API):
    - test_cases[i]["test_input"] - JSON object
    - test_cases[i]["expected_output"] - string
    """
    transformed = []
    
    for tc in test_cases:
        # Handle input - can be string (JSON) or already a dict
        # Check both "input" and "stdin" fields
        test_input = tc.get("input") or tc.get("stdin", "")
        
        if isinstance(test_input, str):
            if not test_input.strip():
                # Empty string - use empty dict
                test_input = {}
            else:
                # Try to parse as JSON
                try:
                    test_input = json.loads(test_input)
                except json.JSONDecodeError:
                    # If not JSON, wrap it in a simple structure
                    # This handles legacy string inputs
                    test_input = {"input": test_input}
        elif test_input is None:
            test_input = {}
        
        # Handle expected_output - API expects string format
        # Convert any type (int, list, dict, bool, etc.) to string representation
        expected_output = tc.get("expected_output")
        if expected_output is None:
            expected_output = ""
        elif isinstance(expected_output, str):
            # Already a string, use as-is
            expected_output = expected_output
        else:
            # Convert non-string types (int, list, dict, bool, etc.) to JSON string
            expected_output = json.dumps(expected_output)
        
        transformed.append({
            "test_input": test_input,
            "expected_output": expected_output  # Always a string per API spec
        })
    
    return transformed


def transform_response(
    custom_response: Dict[str, Any],
    test_cases: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Transform custom API response to internal format.
    
    Custom API response:
    {
        "status": "success",
        "total_test_cases": 2,
        "passed": 2,
        "failed": 0,
        "results": [
            {
                "test_case_index": 0,
                "verdict": "ACCEPTED",
                "output": "[0,1]",
                "error": null,
                "runtime_ms": 245,
                "memory_kb": 14320,
                "passed": true
            }
        ]
    }
    
    Internal format:
    {
        "passed": 2,
        "total": 2,
        "score": 2,
        "max_score": 2,
        "compilation_error": False,
        "results": [
            {
                "test_case_id": "tc_0",
                "is_hidden": False,
                "passed": True,
                "status": "Accepted",
                "status_id": 3,
                "time": 0.245,  # Convert ms to seconds
                "memory": 14320,  # Keep in KB or convert to bytes
                "stdout": "[0,1]",
                "stderr": "",
                "compile_output": ""
            }
        ]
    }
    """
    if custom_response.get("status") == "error":
        # Handle error response
        return {
            "passed": 0,
            "total": len(test_cases),
            "score": 0,
            "max_score": len(test_cases),
            "compilation_error": True,
            "results": []
        }
    
    results = custom_response.get("results", [])
    total_passed = custom_response.get("passed", 0)
    total_test_cases = custom_response.get("total_test_cases", len(test_cases))
    
    transformed_results = []
    compilation_error = False
    
    for i, result in enumerate(results):
        verdict = result.get("verdict", "RUNTIME_ERROR")
        status_id = VERDICT_TO_STATUS_ID.get(verdict, 11)
        status_desc = STATUS_ID_TO_DESCRIPTION.get(status_id, "Runtime Error")
        
        # Check for compilation error
        if status_id == 6:
            compilation_error = True
        
        # Get test case metadata
        tc = test_cases[i] if i < len(test_cases) else {}
        
        # Transform result
        transformed_result = {
            "test_case_id": tc.get("id", f"tc_{i}"),
            "is_hidden": tc.get("is_hidden", False),
            "passed": result.get("passed", False),
            "status": status_desc,
            "status_id": status_id,
            "time": result.get("runtime_ms") / 1000.0 if result.get("runtime_ms") else None,  # Convert ms to seconds
            "memory": result.get("memory_kb", 0) * 1024 if result.get("memory_kb") else None,  # Convert KB to bytes
        }
        
        # Add output fields
        output = result.get("output")
        error = result.get("error")
        
        # Only include details for visible test cases
        if not tc.get("is_hidden", False):
            # Preserve expected_output from original test case
            expected_output = tc.get("expected_output")
            
            if expected_output is None:
                expected_output = ""
            elif not isinstance(expected_output, str):
                # Convert to JSON string if it's an object (list, dict, etc.)
                expected_output = json.dumps(expected_output)
            
            transformed_result.update({
                "stdin": json.dumps(tc.get("input") or tc.get("stdin", "")) if isinstance(tc.get("input") or tc.get("stdin", ""), dict) else str(tc.get("input") or tc.get("stdin", "")),
                "expected_output": expected_output,
                "stdout": output if output else "",
                "stderr": error if error else "",
                "compile_output": error if status_id == 6 and error else "",
            })
        else:
            # Hidden test cases - minimal info
            transformed_result.update({
                "stdout": "",
                "stderr": "",
                "compile_output": "",
            })
        
        transformed_results.append(transformed_result)
    
    # Calculate score (assuming 1 point per test case)
    max_score = len(test_cases)
    score = total_passed
    
    return {
        "passed": total_passed,
        "total": total_test_cases,
        "score": score,
        "max_score": max_score,
        "compilation_error": compilation_error,
        "results": transformed_results,
    }


async def execute_batch_python(
    code: str,
    function_name: str,
    param_names: List[str],
    test_cases: List[Dict[str, Any]],
    time_limit_ms: int = 3000,
    memory_limit_mb: int = 256
) -> Dict[str, Any]:
    """Execute Python code using custom Python execution engine
    
    API format:
    {
        "code": "string",
        "function_name": "string",
        "param_names": ["string"],
        "test_cases": [{"test_input": {}, "expected_output": "string"}],
        "time_limit_ms": 3000,
        "memory_limit_mb": 256
    }
    """
    url = f"{get_engine_url()}/execute/batch"
    
    # Transform test cases
    transformed_test_cases = transform_test_cases(test_cases)
    
    # Python engine API only requires: code, function_name, param_names, test_cases, time_limit_ms, memory_limit_mb
    payload = {
        "code": code,
        "function_name": function_name,
        "param_names": param_names,
        "test_cases": transformed_test_cases,
        "time_limit_ms": time_limit_ms,
        "memory_limit_mb": memory_limit_mb,
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        timeout_config = httpx.Timeout(
            connect=15.0,
            read=time_limit_ms / 1000.0 + 10.0,  # Add buffer
            write=15.0,
            pool=15.0
        )
        
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            if response.status_code != 200:
                error_text = response.text[:500] if response.text else "No error message"
                logger.error(f"Python engine returned non-200 status {response.status_code}: {error_text}")
                raise CustomExecutionError(
                    f"Python engine error (status {response.status_code}): {error_text}"
                )
            
            result = response.json()
            
            # Log errors in individual test case results
            for i, res in enumerate(result.get("results", [])):
                if res.get("error"):
                    logger.warning(f"Test case {i} error: {res.get('error')}")
            
            # Transform response to internal format
            return transform_response(result, test_cases)
            
    except httpx.ConnectError as e:
        logger.error(f"Python engine connection failed: {e}")
        raise CustomExecutionError(
            f"Unable to connect to Python execution engine at {url}. "
            f"Please ensure the engine is running. Error: {str(e)}"
        )
    except httpx.TimeoutException as e:
        logger.error(f"Python engine timeout: {e}")
        raise CustomExecutionError(f"Python engine request timed out: {e}")
    except httpx.HTTPError as e:
        logger.error(f"Python engine HTTP error: {e}")
        raise CustomExecutionError(f"Python engine HTTP error: {e}")
    except Exception as e:
        logger.error(f"Python engine error: {e}")
        raise CustomExecutionError(f"Python engine error: {str(e)}")


async def execute_batch(
    code: str,
    language: str,
    function_signature: FunctionSignature,
    test_cases: List[Dict[str, Any]],
    time_limit_ms: int = 3000,
    memory_limit_mb: int = 256
) -> Dict[str, Any]:
    """
    Main entry point for batch execution.
    Routes to Python execution engine.
    
    Args:
        code: Raw function code (no wrapping, no main method)
        language: Language name ("python")
        function_signature: Function signature with name and parameters
        test_cases: List of test cases with input and expected_output
        time_limit_ms: Time limit in milliseconds
        memory_limit_mb: Memory limit in megabytes
    
    Returns:
        Internal result dictionary
    """
    language_lower = language.lower()
    
    if language_lower != "python":
        raise ValueError(f"Unsupported language for custom engine: {language}. Only Python is supported.")
    
    # Extract function metadata
    function_name = function_signature.name
    param_names = [p.name for p in function_signature.parameters]
    
    # Execute using Python engine
    return await execute_batch_python(
        code=code,
        function_name=function_name,
        param_names=param_names,
        test_cases=test_cases,
        time_limit_ms=time_limit_ms,
        memory_limit_mb=memory_limit_mb
    )
