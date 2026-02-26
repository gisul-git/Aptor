import logging
from typing import Any, Dict, List, Optional

from ..services.dsa_execution_service import (
    is_dsa_language,
    run_all_test_cases_dsa,
    DSAExecutionError,
)

logger = logging.getLogger("backend")


async def evaluate_submission(
    source_code: str,
    language: str,
    testcases: List[Dict[str, Any]],
    function_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Evaluate code against testcases. Uses DSA execution API for the 10 DSA languages
    when function_name is provided; otherwise returns an error for unsupported flow.
    """
    results = []
    passed = 0
    score = 0
    max_score = sum(tc.get("weight", 1) for tc in testcases) or 0

    if is_dsa_language(language) and function_name and (function_name or "").strip():
        # DSA path: single batch call to execution API
        try:
            dsa_test_cases = []
            for i, tc in enumerate(testcases):
                inp = tc.get("input", "")
                expected = tc.get("expected") or ""
                dsa_test_cases.append({
                    "id": f"tc_{i}",
                    "stdin": inp,
                    "input": inp,
                    "expected_output": expected,
                    "is_hidden": tc.get("hidden", False),
                    "points": tc.get("weight", 1),
                })
            batch = await run_all_test_cases_dsa(
                source_code=source_code,
                test_cases=dsa_test_cases,
                function_name=(function_name or "").strip(),
                language=language,
            )
            for i, tc in enumerate(testcases):
                hidden = tc.get("hidden", False)
                res = batch.get("results", [])
                r = res[i] if i < len(res) else {}
                passed_case = r.get("passed", False)
                stdout = (r.get("stdout") or "").strip()
                if passed_case:
                    passed += 1
                    score += tc.get("weight", 1) or 1
                results.append({
                    "visible": not hidden,
                    "input": tc.get("input", "") if not hidden else None,
                    "expected": (tc.get("expected") or "") if not hidden else None,
                    "output": stdout if not hidden else None,
                    "passed": passed_case,
                })
            return {
                "passed": passed,
                "total": len(testcases),
                "score": score,
                "max_score": max_score,
                "results": results,
            }
        except DSAExecutionError as exc:
            logger.error("DSA execution error during evaluate: %s", exc)
            for tc in testcases:
                results.append({
                    "visible": not tc.get("hidden", False),
                    "input": tc.get("input", "") if not tc.get("hidden", False) else None,
                    "expected": (tc.get("expected") or "") if not tc.get("hidden", False) else None,
                    "output": None,
                    "passed": False,
                })
            return {
                "passed": 0,
                "total": len(testcases),
                "score": 0,
                "max_score": max_score,
                "results": results,
            }
    if not is_dsa_language(language):
        raise ValueError(
            f"Unsupported language for evaluation: {language}. Only DSA languages are supported."
        )
    raise ValueError("function_name is required for DSA evaluation.")

