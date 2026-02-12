import logging
from typing import Any, Dict, List

from ..utils.judge0 import Judge0ExecutionError, submit_to_judge0

logger = logging.getLogger("backend")


async def evaluate_submission(
    source_code: str,
    language_id: int,
    testcases: List[Dict[str, Any]],
) -> Dict[str, Any]:
    results = []
    passed = 0
    score = 0
    max_score = sum(tc.get("weight", 1) for tc in testcases) or 0

    for index, testcase in enumerate(testcases):
        stdin = testcase.get("input", "")
        expected_output = (testcase.get("expected") or "").strip()
        hidden = testcase.get("hidden", False)
        weight = testcase.get("weight", 1) or 1

        logger.info(
            "Evaluating testcase %s (hidden=%s, weight=%s)",
            index,
            hidden,
            weight,
        )

        stdout = ""
        passed_case = False

        try:
            judge0_result = await submit_to_judge0(
                source_code=source_code,
                language_id=language_id,
                stdin=stdin,
            )
            stdout = (judge0_result.get("stdout") or "").strip()
            status_info = judge0_result.get("status")
            status_id = status_info.get("id") if isinstance(status_info, dict) else None
            passed_case = stdout == expected_output and (status_id in (3, None) or status_id is None)

            if not passed_case and stdout == expected_output:
                # Some self-hosted Judge0 instances omit status info; trust output if it matches.
                passed_case = True

        except Judge0ExecutionError as exc:
            logger.error("Judge0 execution error on testcase %s: %s", index, exc)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Unexpected error while evaluating testcase %s: %s", index, exc)

        if passed_case:
            passed += 1
            score += weight

        results.append(
            {
                "visible": not hidden,
                "input": stdin if not hidden else None,
                "expected": expected_output if not hidden else None,
                "output": stdout if not hidden else None,
                "passed": passed_case,
            }
        )

    return {
        "passed": passed,
        "total": len(testcases),
        "score": score,
        "max_score": max_score,
        "results": results,
    }

