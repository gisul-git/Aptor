"""FastAPI application for Python code execution."""
import json
import ast
import re
import logging
from datetime import datetime
from typing import Tuple, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

from app.models.request import ExecutionRequest
from app.models.response import ExecutionResponse, Verdict
from app.models.batch_request import BatchExecutionRequest, BatchExecutionResponse, BatchTestResult
from app.services.code_wrapper import CodeWrapper
from app.services.code_validator import CodeValidator
from app.services.python_executor import PythonExecutor

app = FastAPI(
    title="Python Code Execution Engine",
    description="Execute Python code in isolated Docker containers",
    version="1.0.0"
)

# Root endpoint for health check and API discoverability
@app.get("/")
async def root():
    return {"message": "Python Code Execution Engine is running.", "docs": "/docs", "openapi": "/openapi.json"}

executor = PythonExecutor()


class SmartVerdictDeterminer:
    """
    Smart verdict determination that distinguishes warnings from real errors
    """
    
    # Patterns for harmless warnings (not errors)
    HARMLESS_PATTERNS = [
        r"WARNING:",
        r"DeprecationWarning",
        r"FutureWarning",
        r"UserWarning",
        r"ResourceWarning",
        r"PendingDeprecationWarning",
        r"ImportWarning",
        r"UnicodeWarning",
        r"BytesWarning",
        r"RuntimeWarning(?!.*Error)",  # RuntimeWarning but not RuntimeError
    ]
    
    # Patterns for real errors
    ERROR_PATTERNS = [
        r"Traceback \(most recent call last\)",
        r"Error:",
        r"Exception:",
        r"\w+Error:",  # Any error ending with "Error:"
        r"FAILED",
        r"AssertionError",
        r"SyntaxError",
        r"IndentationError",
        r"NameError",
        r"TypeError",
        r"ValueError",
        r"AttributeError",
        r"KeyError",
        r"IndexError",
        r"ZeroDivisionError",
        r"MemoryError",
        r"RecursionError",
    ]
    
    @classmethod
    def determine_verdict(
        cls,
        executor_verdict: Verdict,
        actual_output: Optional[str],
        expected_output: any,
        stderr: Optional[str],
        exit_code: Optional[int]
    ) -> Tuple[Verdict, str]:
        """
        Determine final verdict with smart error detection
        
        Args:
            executor_verdict: Initial verdict from executor
            actual_output: Actual output string
            expected_output: Expected output (any type)
            stderr: Error output (may contain warnings or errors)
            exit_code: Process exit code
            
        Returns:
            (final_verdict, reason)
        """
        
        # Step 1: Parse and compare outputs
        try:
            parsed_actual = cls._parse_output(actual_output)
            outputs_match = _compare_outputs(parsed_actual, expected_output)
        except Exception as e:
            logger.error(f"Error parsing/comparing outputs: {e}", exc_info=True)
            outputs_match = False
        
        # Step 2: Analyze stderr for real errors vs warnings
        has_real_error = cls._has_real_error(stderr)
        has_warnings_only = cls._has_warnings_only(stderr)
        
        # Step 3: Determine verdict with priority logic
        
        # Priority 1: Output is correct - ACCEPT IT!
        if outputs_match:
            if exit_code == 0 and not has_real_error:
                return Verdict.ACCEPTED, "Output matches, clean execution"
            elif has_warnings_only:
                return Verdict.ACCEPTED, "Output matches (ignoring warnings)"
            elif has_real_error and exit_code != 0:
                # Weird case: correct output but real error in stderr
                # Still accept since output is correct
                return Verdict.ACCEPTED, "Output matches (execution had errors but result is correct)"
            else:
                # Non-zero exit but correct output
                return Verdict.ACCEPTED, "Output matches"
        
        # Priority 2: Check executor verdict for specific errors
        # Only check verdicts that exist in your Verdict enum
        if hasattr(Verdict, 'TIME_LIMIT_EXCEEDED') and executor_verdict == Verdict.TIME_LIMIT_EXCEEDED:
            return Verdict.TIME_LIMIT_EXCEEDED, "Execution time exceeded limit"
        
        if hasattr(Verdict, 'MEMORY_LIMIT_EXCEEDED') and executor_verdict == Verdict.MEMORY_LIMIT_EXCEEDED:
            return Verdict.MEMORY_LIMIT_EXCEEDED, "Memory usage exceeded limit"
        
        if hasattr(Verdict, 'COMPILATION_ERROR') and executor_verdict == Verdict.COMPILATION_ERROR:
            return Verdict.COMPILATION_ERROR, "Code has syntax errors"
        
        # Priority 3: Real runtime error detected
        if has_real_error:
            error_msg = cls._extract_error_message(stderr)
            return Verdict.RUNTIME_ERROR, f"Runtime error: {error_msg}"
        
        # Priority 4: Non-zero exit code
        if exit_code is not None and exit_code != 0:
            if stderr and stderr.strip():
                return Verdict.RUNTIME_ERROR, f"Non-zero exit code ({exit_code}): {stderr[:200]}"
            else:
                return Verdict.RUNTIME_ERROR, f"Non-zero exit code: {exit_code}"
        
        # Priority 5: Output doesn't match (but no errors)
        if not outputs_match:
            return Verdict.WRONG_ANSWER, f"Output doesn't match expected"
        
        # Fallback
        return Verdict.RUNTIME_ERROR, "Unknown error occurred"
    
    @classmethod
    def _parse_output(cls, output: Optional[str]) -> any:
        """Parse output string to Python object"""
        if output is None or not output.strip():
            return None
        
        output = output.strip()
        
        # Try JSON first
        try:
            return json.loads(output)
        except:
            pass
        
        # Try Python literal
        try:
            return ast.literal_eval(output)
        except:
            pass
        
        # Return as string
        return output
    
    @classmethod
    def _has_real_error(cls, stderr: Optional[str]) -> bool:
        """Check if stderr contains real error (not just warnings)"""
        if not stderr or not stderr.strip():
            return False
        
        for pattern in cls.ERROR_PATTERNS:
            if re.search(pattern, stderr, re.IGNORECASE):
                return True
        
        return False
    
    @classmethod
    def _has_warnings_only(cls, stderr: Optional[str]) -> bool:
        """Check if stderr contains only warnings (no errors)"""
        if not stderr or not stderr.strip():
            return False
        
        lines = stderr.strip().split('\n')
        
        # Check if all non-empty lines are warnings
        for line in lines:
            if not line.strip():
                continue
            
            # Check if line matches any harmless pattern
            is_harmless = False
            for pattern in cls.HARMLESS_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    is_harmless = True
                    break
            
            # If we found a line that's not harmless, return False
            if not is_harmless:
                # But make sure it's not just empty or whitespace
                if line.strip():
                    return False
        
        # All lines were harmless warnings
        return True
    
    @classmethod
    def _extract_error_message(cls, stderr: str) -> str:
        """Extract concise error message from stderr"""
        if not stderr:
            return "Unknown error"
        
        # Find first line with error pattern
        for line in stderr.split('\n'):
            for pattern in cls.ERROR_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    return line.strip()[:200]
        
        # Fallback: first non-empty line
        for line in stderr.split('\n'):
            if line.strip():
                return line.strip()[:200]
        
        return stderr[:200]


@app.post("/execute", response_model=ExecutionResponse)
async def execute_code(request: ExecutionRequest) -> ExecutionResponse:
    """
    Execute Python code and return verdict.
    
    Args:
        request: Execution request with code, test input, etc.
        
    Returns:
        Execution response with verdict and metrics
    """
    try:
        # Validate code security
        is_valid, error_msg = CodeValidator.validate(request.code)
        if not is_valid:
            return ExecutionResponse(
                status="error",
                verdict=Verdict.SECURITY_VIOLATION,
                output=None,
                error=error_msg,
                runtime_ms=None,
                memory_kb=None,
                exit_code=None,
                timestamp=datetime.utcnow().isoformat() + "Z"
            )
        
        # Wrap user code with I/O handling
        wrapped_code = CodeWrapper.wrap_code(
            user_code=request.code,
            function_name=request.function_name,
            param_names=request.param_names,
            test_input=request.test_input
        )
        
        # Execute in Docker (use defaults if not provided)
        time_limit = request.time_limit_ms if request.time_limit_ms is not None else 3000
        memory_limit = request.memory_limit_mb if request.memory_limit_mb is not None else 256
        
        executor_verdict, output, error, runtime_ms, memory_kb, exit_code = executor.execute(
            code=wrapped_code,
            test_input=request.test_input,
            time_limit_ms=time_limit,
            memory_limit_mb=memory_limit
        )
        
        # Use smart verdict determination
        final_verdict, reason = SmartVerdictDeterminer.determine_verdict(
            executor_verdict=executor_verdict,
            actual_output=output,
            expected_output=request.expected_output,
            stderr=error,
            exit_code=exit_code
        )
        
        logger.info(
            f"Execution complete: executor_verdict={executor_verdict.value}, "
            f"final_verdict={final_verdict.value}, reason={reason}, "
            f"exit_code={exit_code}, has_error={bool(error)}"
        )
        
        return ExecutionResponse(
            status="success",
            verdict=final_verdict,
            output=output,
            error=error if final_verdict != Verdict.ACCEPTED else None,
            runtime_ms=runtime_ms,
            memory_kb=memory_kb,
            exit_code=exit_code,
            timestamp=datetime.utcnow().isoformat() + "Z"
        )
        
    except Exception as e:
        logger.error(f"Unexpected error in execute_code: {e}", exc_info=True)
        return ExecutionResponse(
            status="error",
            verdict=Verdict.RUNTIME_ERROR,
            output=None,
            error=str(e),
            runtime_ms=None,
            memory_kb=None,
            exit_code=None,
            timestamp=datetime.utcnow().isoformat() + "Z"
        )


@app.post("/execute/batch", response_model=BatchExecutionResponse)
async def execute_batch(request: BatchExecutionRequest) -> BatchExecutionResponse:
    """
    Execute Python code against multiple test cases (batch execution).
    
    Args:
        request: Batch execution request with code and multiple test cases
        
    Returns:
        Batch execution response with results for each test case
    """
    try:
        # Validate code security
        is_valid, error_msg = CodeValidator.validate(request.code)
        if not is_valid:
            # Return failed results for all test cases
            results = [
                BatchTestResult(
                    test_case_index=i,
                    verdict=Verdict.SECURITY_VIOLATION.value,
                    output=None,
                    error=error_msg,
                    runtime_ms=None,
                    memory_kb=None,
                    passed=False
                )
                for i in range(len(request.test_cases))
            ]
            return BatchExecutionResponse(
                status="error",
                total_test_cases=len(request.test_cases),
                passed=0,
                failed=len(request.test_cases),
                results=results,
                timestamp=datetime.utcnow().isoformat() + "Z"
            )
        
        # Execute each test case
        results = []
        passed_count = 0
        
        for idx, test_case in enumerate(request.test_cases):
            try:
                # Wrap user code with I/O handling for this test case
                wrapped_code = CodeWrapper.wrap_code(
                    user_code=request.code,
                    function_name=request.function_name,
                    param_names=request.param_names,
                    test_input=test_case.test_input
                )
                
                # Execute in Docker
                time_limit = request.time_limit_ms if request.time_limit_ms is not None else 3000
                memory_limit = request.memory_limit_mb if request.memory_limit_mb is not None else 256
                
                executor_verdict, output, error, runtime_ms, memory_kb, exit_code = executor.execute(
                    code=wrapped_code,
                    test_input=test_case.test_input,
                    time_limit_ms=time_limit,
                    memory_limit_mb=memory_limit
                )
                
                logger.info(
                    f"Test case {idx}: executor_verdict={executor_verdict.value}, "
                    f"exit_code={exit_code}, output={output}, error={error}"
                )
                
                # Check if expected output is provided
                expected = test_case.expected_output
                has_expected = (
                    expected is not None
                    and expected != ""
                    and str(expected).strip() != ""
                    and str(expected).strip().lower() not in ["null", "none", "(not available)", "not available"]
                )
                
                if has_expected:
                    # Parse expected output if it's a string
                    if isinstance(expected, str):
                        try:
                            expected_parsed = json.loads(expected)
                        except:
                            try:
                                expected_parsed = ast.literal_eval(expected)
                            except:
                                expected_parsed = expected.strip()
                    else:
                        expected_parsed = expected
                    
                    # Use smart verdict determination
                    final_verdict, reason = SmartVerdictDeterminer.determine_verdict(
                        executor_verdict=executor_verdict,
                        actual_output=output,
                        expected_output=expected_parsed,
                        stderr=error,
                        exit_code=exit_code
                    )
                    
                    passed = (final_verdict == Verdict.ACCEPTED)
                    if passed:
                        passed_count += 1
                    
                    logger.info(
                        f"Test case {idx}: final_verdict={final_verdict.value}, "
                        f"passed={passed}, reason={reason}"
                    )
                else:
                    # No expected output - just check if execution succeeded
                    final_verdict = executor_verdict
                    passed = (final_verdict == Verdict.ACCEPTED and output is not None)
                    if passed:
                        passed_count += 1
                    
                    logger.info(
                        f"Test case {idx}: No expected output, verdict={final_verdict.value}, passed={passed}"
                    )
                
                results.append(BatchTestResult(
                    test_case_index=idx,
                    verdict=final_verdict.value,
                    output=output,
                    error=error if final_verdict != Verdict.ACCEPTED else None,
                    runtime_ms=runtime_ms,
                    memory_kb=memory_kb,
                    passed=passed
                ))
            
            except Exception as test_error:
                logger.error(f"Error executing test case {idx}: {test_error}", exc_info=True)
                # Add error result for this test case
                results.append(BatchTestResult(
                    test_case_index=idx,
                    verdict=Verdict.RUNTIME_ERROR.value,
                    output=None,
                    error=str(test_error),
                    runtime_ms=None,
                    memory_kb=None,
                    passed=False
                ))
        
        return BatchExecutionResponse(
            status="success",
            total_test_cases=len(request.test_cases),
            passed=passed_count,
            failed=len(request.test_cases) - passed_count,
            results=results,
            timestamp=datetime.utcnow().isoformat() + "Z"
        )
        
    except Exception as e:
        logger.error(f"Unexpected error in execute_batch: {e}", exc_info=True)
        # Return error results for all test cases
        results = [
            BatchTestResult(
                test_case_index=i,
                verdict=Verdict.RUNTIME_ERROR.value,
                output=None,
                error=str(e),
                runtime_ms=None,
                memory_kb=None,
                passed=False
            )
            for i in range(len(request.test_cases))
        ]
        return BatchExecutionResponse(
            status="error",
            total_test_cases=len(request.test_cases),
            passed=0,
            failed=len(request.test_cases),
            results=results,
            timestamp=datetime.utcnow().isoformat() + "Z"
        )


def _compare_outputs(actual: any, expected: any) -> bool:
    """
    Compare actual and expected outputs.
    Handles primitives, lists, dicts, nested structures, and edge cases.
    """
    # Handle None/null
    if actual is None and expected is None:
        return True
    if actual is None or expected is None:
        return False
    
    # Handle lists/arrays
    if isinstance(actual, list) and isinstance(expected, list):
        if len(actual) != len(expected):
            return False
        return all(_compare_outputs(a, e) for a, e in zip(actual, expected))
    
    # Handle tuples
    if isinstance(actual, tuple) and isinstance(expected, tuple):
        if len(actual) != len(expected):
            return False
        return all(_compare_outputs(a, e) for a, e in zip(actual, expected))
    
    # Handle sets (order doesn't matter)
    if isinstance(actual, set) and isinstance(expected, set):
        if len(actual) != len(expected):
            return False
        # Convert to sorted lists for comparison
        try:
            actual_sorted = sorted(actual)
            expected_sorted = sorted(expected)
            return all(_compare_outputs(a, e) for a, e in zip(actual_sorted, expected_sorted))
        except TypeError:
            # If elements are not sortable, use set comparison
            return actual == expected
    
    # Handle dictionaries/objects
    if isinstance(actual, dict) and isinstance(expected, dict):
        if set(actual.keys()) != set(expected.keys()):
            return False
        return all(_compare_outputs(actual[k], expected[k]) for k in actual.keys())
    
    # Handle primitives (with type conversion for numbers)
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        # Use epsilon comparison for floats
        if isinstance(actual, float) or isinstance(expected, float):
            return abs(actual - expected) < 1e-9
        return actual == expected
    
    # Handle booleans
    if isinstance(actual, bool) and isinstance(expected, bool):
        return actual == expected
    
    # Handle strings
    if isinstance(actual, str) and isinstance(expected, str):
        return actual == expected
    
    # Handle bytes
    if isinstance(actual, bytes) and isinstance(expected, bytes):
        return actual == expected
    
    # Type mismatch
    if type(actual) != type(expected):
        # Try to convert (e.g., int to float)
        try:
            if isinstance(expected, float) and isinstance(actual, (int, float)):
                return abs(float(actual) - expected) < 1e-9
            if isinstance(actual, float) and isinstance(expected, (int, float)):
                return abs(actual - float(expected)) < 1e-9
        except:
            pass
        return False
    
    # Fallback to direct comparison
    return actual == expected


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)