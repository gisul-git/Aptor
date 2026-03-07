"""
Expected output for DSA test cases.
Compute-by-execution is not supported (no Judge0). Set expected_output on test cases manually.
"""
import logging
from typing import Any, Dict, List

logger = logging.getLogger("backend")


async def compute_expected_outputs_for_testcases(
    question: Dict[str, Any],
    testcases: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Return test cases as-is. Expected output must be set on each test case manually.
    (Compute-by-execution is not supported.)
    """
    logger.warning(
        "[expected_output] compute_expected_outputs_for_testcases: "
        "expected_output is not computed by execution; ensure each test case has expected_output set."
    )
    return list(testcases or [])


async def compute_expected_outputs_from_code(
    source_code: str,
    language: str,
    testcases: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Return test cases as-is. Expected output must be set manually.
    (Compute-by-execution is not supported.)
    """
    logger.warning(
        "[expected_output] compute_expected_outputs_from_code: "
        "expected_output is not computed by execution; set expected_output on test cases."
    )
    return list(testcases or [])
