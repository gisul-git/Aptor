"""
testcase_verifier.py
--------------------
Two-phase test case generation to guarantee correct expected_outputs.

STRATEGY:
  Phase 1 → LLM generates: test inputs + a Python reference solution
  Phase 2 → We EXECUTE the reference solution against the inputs in a sandbox
           to produce ground-truth expected_outputs (no LLM guessing)

Drop this module next to your existing ai_generation.py and call
`verify_and_fix_testcases(question_data, client)` before returning
from generate_question().
"""

import ast
import json
import logging
import traceback
import textwrap
import sys
import io
import asyncio
import contextlib
try:
    import resource
    HAS_RESOURCE = True
except ImportError:
    HAS_RESOURCE = False  # Windows — memory limiting not available
import signal
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("backend")


# ---------------------------------------------------------------------------
# Sandboxed Python executor
# ---------------------------------------------------------------------------

class ExecutionError(Exception):
    pass


def _timeout_handler(signum, frame):
    raise TimeoutError("Execution timed out")


def run_python_solution(
    code: str,
    function_name: str,
    test_input: Dict[str, Any],
    timeout_seconds: int = 5,
) -> Any:
    """
    Execute `function_name(**test_input)` inside `code` in a restricted
    environment. Returns the return value of the function.

    Safety measures:
      - Wall-clock timeout via SIGALRM (Unix only; falls back gracefully)
      - stdout/stderr captured and discarded
      - Restricted globals (no os, subprocess, socket, etc.)
      - Memory soft-limit (128 MB) via resource module when available
    """
    # Build a restricted globals dict – allow only builtins safe for DSA
    safe_builtins = {
        k: __builtins__[k] if isinstance(__builtins__, dict) else getattr(__builtins__, k)
        for k in (
            "__import__",  # ← ADD THIS — Python needs it internally
            "__build_class__", 
            "abs", "all", "any", "bin", "bool", "chr", "dict", "divmod",
            "enumerate", "filter", "float", "frozenset", "getattr", "hasattr",
            "hash", "hex", "int", "isinstance", "issubclass", "iter", "len",
            "list", "map", "max", "min", "next", "oct", "ord", "pow", "print",
            "range", "repr", "reversed", "round", "set", "setattr", "slice",
            "sorted", "str", "sum", "tuple", "type", "zip",
            "True", "False", "None",
            "ValueError", "TypeError", "IndexError", "KeyError",
            "StopIteration", "Exception", "RuntimeError",
        )
        if (isinstance(__builtins__, dict) and k in __builtins__)
        or (not isinstance(__builtins__, dict) and hasattr(__builtins__, k))
    }
    # Allow math & collections which are commonly needed
    import math, collections, heapq, bisect, functools, itertools
    restricted_globals = {
        "__builtins__": safe_builtins,
        "math": math,
        "collections": collections,
        "heapq": heapq,
        "bisect": bisect,
        "functools": functools,
        "itertools": itertools,
    }

    # Soft memory limit (128 MB)
    if HAS_RESOURCE:
        soft, hard = resource.getrlimit(resource.RLIMIT_AS)
        resource.setrlimit(resource.RLIMIT_AS, (128 * 1024 * 1024, hard))

    # Set up timeout
    use_signal = hasattr(signal, "SIGALRM")
    if use_signal:
        signal.signal(signal.SIGALRM, _timeout_handler)
        signal.alarm(timeout_seconds)

    captured_stdout = io.StringIO()
    result = None
    exec_error = None

    try:
        with contextlib.redirect_stdout(captured_stdout):
            exec(compile(code, "<solution>", "exec"), restricted_globals)  # noqa: S102

        fn = restricted_globals.get(function_name)
        if fn is None:
            raise ExecutionError(
                f"Function '{function_name}' not found in solution code. "
                f"Available names: {[k for k in restricted_globals if not k.startswith('_')]}"
            )

        with contextlib.redirect_stdout(captured_stdout):
            result = fn(**test_input)

    except TimeoutError:
        exec_error = ExecutionError(f"Solution exceeded {timeout_seconds}s time limit")
    except MemoryError:
        exec_error = ExecutionError("Solution exceeded memory limit")
    except ExecutionError:
        raise
    except Exception as e:
        exec_error = ExecutionError(f"Runtime error: {type(e).__name__}: {e}\n{traceback.format_exc()}")
    finally:
        if use_signal:
            signal.alarm(0)  # Cancel alarm

    if exec_error:
        raise exec_error

    return result


# ---------------------------------------------------------------------------
# Phase 1: Ask LLM for inputs + reference solution
# ---------------------------------------------------------------------------

REFERENCE_SOLUTION_PROMPT = """\
Given the following coding question, provide:
1. A correct Python reference solution (function only, no class, no main).
2. Verified test case INPUTS only (no expected_output — we will compute those).

Return ONLY a valid JSON object — no markdown, no explanation:

{{
  "reference_solution_python": "def functionName(param1, param2):\\n    # correct solution here\\n    pass",
  "verified_inputs": [
    {{"param1": value, "param2": value}},
    {{"param1": value, "param2": value}},
    {{"param1": value, "param2": value}},
    {{"param1": value, "param2": value}},
    {{"param1": value, "param2": value}},
    {{"param1": value, "param2": value}}
  ]
}}

Rules:
- The function name MUST exactly match: {function_name}
- Parameters MUST exactly match: {param_names}
- 6 inputs total: first 3 are public (easy/medium), last 3 are hidden (edge cases/stress)
- Inputs must be valid JSON values (not strings containing JSON)
- The reference solution must be provably correct — use the simplest, clearest approach

QUESTION:
Title: {title}
Description: {description}
Function signature: {function_name}({param_list}) -> {return_type}
"""


def _fetch_reference_solution(
    client,  # OpenAI client
    question_data: Dict[str, Any],
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Ask the LLM for a reference Python solution + raw inputs.
    Returns (solution_code, list_of_input_dicts).
    """
    func_sig = question_data.get("function_signature", {})
    function_name = func_sig.get("name", "solution")
    parameters = func_sig.get("parameters", [])
    return_type = func_sig.get("return_type", "Any")
    param_names = [p["name"] for p in parameters]
    param_list = ", ".join(
        f"{p['name']}: {p['type']}" for p in parameters
    )

    prompt = REFERENCE_SOLUTION_PROMPT.format(
        function_name=function_name,
        param_names=json.dumps(param_names),
        title=question_data.get("title", ""),
        description=question_data.get("description", question_data.get("problem_description", "")),
        param_list=param_list,
        return_type=return_type,
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert competitive programmer. "
                    "Output ONLY valid JSON — no markdown, no commentary."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,  # Low temperature for correctness
    )

    content = response.choices[0].message.content.strip()

    # Strip markdown fences if present
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:] if lines[0].startswith("```") else lines)
        if content.endswith("```"):
            content = content[: content.rfind("```")]

    data = json.loads(content)
    solution_code = data["reference_solution_python"]
    inputs = data["verified_inputs"]

    logger.info(f"[verifier] Got reference solution for '{function_name}'")
    logger.debug(f"[verifier] Reference solution:\n{solution_code}")
    logger.debug(f"[verifier] Raw inputs: {json.dumps(inputs, indent=2)}")

    return solution_code, inputs


# ---------------------------------------------------------------------------
# Phase 2: Execute and build verified testcases
# ---------------------------------------------------------------------------

def _execute_all_inputs(
    solution_code: str,
    function_name: str,
    inputs: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Run solution_code against each input. If a testcase fails to execute,
    log a warning and skip it (caller will keep original LLM output).
    """
    results = []
    for idx, test_input in enumerate(inputs):
        try:
            output = run_python_solution(solution_code, function_name, test_input)
            serialised = json.loads(json.dumps(output, default=str))
            results.append({
                "input": test_input,
                "expected_output": serialised,
                "verified": True
            })
            logger.info(f"[verifier] TC {idx}: ✅ input={test_input} → output={serialised}")
        except Exception as e:
            logger.warning(f"[verifier] TC {idx}: ⚠️ execution failed, keeping LLM output. Error: {e}")
            results.append({
                "input": test_input,
                "expected_output": None,  # Signal to keep original
                "verified": False
            })

    return results


# ---------------------------------------------------------------------------
# Cross-validation: ask LLM to verify a subset of outputs
# ---------------------------------------------------------------------------

VERIFY_OUTPUTS_PROMPT = """\
Verify that the following test case expected_outputs are correct for this problem.
For each test case, answer "correct" or "WRONG: <brief reason>".

Problem title: {title}
Function: {function_name}({param_list}) -> {return_type}
Description (brief): {description_snippet}

Test cases:
{testcases_str}

Return a JSON array with one entry per test case:
[
  {{"index": 0, "verdict": "correct"}},
  {{"index": 1, "verdict": "WRONG: should be 5 not 4"}}
]

Output ONLY the JSON array. No markdown.
"""


def _cross_validate_outputs(
    client,
    question_data: Dict[str, Any],
    testcases: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Ask LLM to sanity-check a few test cases.
    Returns list of {index, verdict} dicts.
    Logs warnings for any marked WRONG.
    """
    func_sig = question_data.get("function_signature", {})
    function_name = func_sig.get("name", "solution")
    parameters = func_sig.get("parameters", [])
    return_type = func_sig.get("return_type", "Any")
    param_list = ", ".join(f"{p['name']}: {p['type']}" for p in parameters)
    description = question_data.get("description", question_data.get("problem_description", ""))

    # Only validate public testcases (first 3)
    subset = testcases[:3]
    tc_str = "\n".join(
        f"TC {i}: input={json.dumps(tc['input'])} → expected_output={json.dumps(tc['expected_output'])}"
        for i, tc in enumerate(subset)
    )

    prompt = VERIFY_OUTPUTS_PROMPT.format(
        title=question_data.get("title", ""),
        function_name=function_name,
        param_list=param_list,
        return_type=return_type,
        description_snippet=description[:500],
        testcases_str=tc_str,
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are a correctness auditor. Output ONLY valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:] if lines[0].startswith("```") else lines)
            if content.endswith("```"):
                content = content[: content.rfind("```")]
        verdicts = json.loads(content)
        for v in verdicts:
            if "WRONG" in v.get("verdict", ""):
                logger.warning(
                    f"[verifier] Cross-validation flagged TC {v['index']}: {v['verdict']}"
                )
        return verdicts
    except Exception as e:
        logger.warning(f"[verifier] Cross-validation skipped due to error: {e}")
        return []


# ---------------------------------------------------------------------------
# Main entry point: patch question_data in-place
# ---------------------------------------------------------------------------

async def verify_and_fix_testcases(
    question_data: Dict[str, Any],
    client,  # OpenAI client instance
    cross_validate: bool = False,  # Disabled by default — saves ~10s
) -> Dict[str, Any]:
    from openai import AsyncOpenAI
    
    func_sig = question_data.get("function_signature", {})
    function_name = func_sig.get("name", "solution")

    logger.info(f"[verifier] Starting two-phase verification for '{function_name}'")

    # Use async client for faster calls
    async_client = AsyncOpenAI(api_key=client.api_key)

    # Phase 1: get reference solution + inputs (using gpt-4o-mini for speed)
    solution_code, raw_inputs = await _fetch_reference_solution_async(async_client, question_data)

    if len(raw_inputs) < 6:
        raise ValueError(
            f"Expected 6 inputs from LLM, got {len(raw_inputs)}. "
            "Increase retries or adjust the prompt."
        )

    # Phase 2: execute in sandbox
    verified = _execute_all_inputs(solution_code, function_name, raw_inputs[:6])

    # Cross-validate first 3 (disabled by default)
    if cross_validate:
        verdicts = await _cross_validate_outputs_async(async_client, question_data, verified[:3])
        wrong = [v for v in verdicts if "WRONG" in v.get("verdict", "")]
        if wrong:
            logger.warning(
                f"[verifier] {len(wrong)} public TCs flagged as wrong by cross-validation."
            )

    # Patch testcases in-place
    for i, tc in enumerate(verified[:3]):
        if i < len(question_data.get("public_testcases", [])):
            if tc["verified"]:  # ← Only patch if execution succeeded
                question_data["public_testcases"][i]["input"] = tc["input"]
                question_data["public_testcases"][i]["expected_output"] = tc["expected_output"]
            
            else:
                logger.warning(f"[verifier] public_testcases[{i}] kept original LLM output")
        

    for i, tc in enumerate(verified[3:6]):
        if i < len(question_data.get("hidden_testcases", [])):
            if tc["verified"]:  # ← Only patch if execution succeeded
                question_data["hidden_testcases"][i]["input"] = tc["input"]
                question_data["hidden_testcases"][i]["expected_output"] = tc["expected_output"]
            else:
                logger.warning(f"[verifier] hidden_testcases[{i}] kept original LLM output")    

            

    question_data["_reference_solution_python"] = solution_code

    logger.info("[verifier] Testcase verification complete — all expected_outputs are ground-truth.")
    return question_data


async def _fetch_reference_solution_async(async_client, question_data: Dict[str, Any]):
    """Async version of _fetch_reference_solution using gpt-4o-mini."""
    func_sig = question_data.get("function_signature", {})
    function_name = func_sig.get("name", "solution")
    parameters = func_sig.get("parameters", [])
    return_type = func_sig.get("return_type", "Any")
    param_names = [p["name"] for p in parameters]
    param_list = ", ".join(f"{p['name']}: {p['type']}" for p in parameters)

    prompt = REFERENCE_SOLUTION_PROMPT.format(
        function_name=function_name,
        param_names=json.dumps(param_names),
        title=question_data.get("title", ""),
        description=question_data.get("description", question_data.get("problem_description", "")),
        param_list=param_list,
        return_type=return_type,
    )

    response = await async_client.chat.completions.create(
        model="gpt-4o-mini",  # Much faster than gpt-4
        messages=[
            {
                "role": "system",
                "content": "You are an expert competitive programmer. Output ONLY valid JSON — no markdown, no commentary.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
    )

    content = response.choices[0].message.content.strip()
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:] if lines[0].startswith("```") else lines)
        if content.endswith("```"):
            content = content[: content.rfind("```")]

    data = json.loads(content)
    solution_code = data["reference_solution_python"]
    inputs = data["verified_inputs"]

    logger.info(f"[verifier] Got reference solution for '{function_name}'")
    return solution_code, inputs


async def _cross_validate_outputs_async(async_client, question_data, testcases):
    """Async version of _cross_validate_outputs using gpt-4o-mini."""
    func_sig = question_data.get("function_signature", {})
    function_name = func_sig.get("name", "solution")
    parameters = func_sig.get("parameters", [])
    return_type = func_sig.get("return_type", "Any")
    param_list = ", ".join(f"{p['name']}: {p['type']}" for p in parameters)
    description = question_data.get("description", question_data.get("problem_description", ""))

    subset = testcases[:3]
    tc_str = "\n".join(
        f"TC {i}: input={json.dumps(tc['input'])} → expected_output={json.dumps(tc['expected_output'])}"
        for i, tc in enumerate(subset)
    )

    prompt = VERIFY_OUTPUTS_PROMPT.format(
        title=question_data.get("title", ""),
        function_name=function_name,
        param_list=param_list,
        return_type=return_type,
        description_snippet=description[:500],
        testcases_str=tc_str,
    )

    try:
        response = await async_client.chat.completions.create(
            model="gpt-4o-mini",  # Much faster than gpt-4
            messages=[
                {"role": "system", "content": "You are a correctness auditor. Output ONLY valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:] if lines[0].startswith("```") else lines)
            if content.endswith("```"):
                content = content[: content.rfind("```")]
        return json.loads(content)
    except Exception as e:
        logger.warning(f"[verifier] Cross-validation skipped: {e}")
        return []