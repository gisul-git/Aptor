import logging
import json
from typing import Any, Dict, List, Optional, Tuple

from ..utils.judge0 import submit_to_judge0, LANGUAGE_IDS

logger = logging.getLogger("backend")


def _normalize_output(stdout: Optional[str]) -> str:
    # Normalize newlines and trim trailing/leading whitespace
    s = (stdout or "").replace("\r\n", "\n").replace("\r", "\n")
    return s.strip()


def _pick_reference_code_and_language(question: Dict[str, Any]) -> Tuple[str, int]:
    """
    Pick a trusted reference solution for computing expected outputs.

    Supported storage (non-breaking; not exposed to frontend):
    - question["reference_solution"] as a string (assumed to match question["reference_language"] or first language)
    - question["reference_solutions"] as {lang: code}
    - question["reference_language"] as a language key in LANGUAGE_IDS
    """
    # Prefer explicit mapping
    ref_map = question.get("reference_solutions")
    if isinstance(ref_map, dict) and ref_map:
        # Prefer explicit reference_language if provided
        ref_lang = (question.get("reference_language") or "").lower().strip()
        if ref_lang and ref_lang in ref_map and ref_lang in LANGUAGE_IDS:
            return str(ref_map[ref_lang]), int(LANGUAGE_IDS[ref_lang])
        # Else pick first supported entry
        for lang, code in ref_map.items():
            lang_key = str(lang).lower().strip()
            if lang_key in LANGUAGE_IDS and code:
                return str(code), int(LANGUAGE_IDS[lang_key])

    # Fallback to single string
    ref_code = question.get("reference_solution")
    if isinstance(ref_code, str) and ref_code.strip():
        ref_lang = (question.get("reference_language") or "").lower().strip()
        if ref_lang and ref_lang in LANGUAGE_IDS:
            return ref_code, int(LANGUAGE_IDS[ref_lang])
        # Else pick first listed language from question
        langs = question.get("languages") or []
        for lang in langs:
            lang_key = str(lang).lower().strip()
            if lang_key in LANGUAGE_IDS:
                return ref_code, int(LANGUAGE_IDS[lang_key])

    raise ValueError(
        "Missing trusted reference solution. Provide 'reference_solution' (and optionally 'reference_language') "
        "or 'reference_solutions' in the question record to enable expected_output computation."
    )


def _is_placeholder_output(output: str) -> bool:
    """Check if expected_output is a placeholder."""
    if not output:
        return True
    
    output_lower = output.lower().strip()
    
    # Explicit placeholder patterns (including "e.g.," with comma)
    placeholder_patterns = [
        "e.g.",
        "e.g.,",
        "example",
        "placeholder",
        "expected output",
        "expected:",
    ]
    
    # Check for explicit placeholder patterns
    if any(pattern in output_lower for pattern in placeholder_patterns):
        logger.debug(f"Detected placeholder: '{output}' matches pattern")
        return True
    
    return False


async def compute_expected_outputs_for_testcases(
    question: Dict[str, Any],
    testcases: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Compute expected_output for any testcase missing it or with placeholder values.
    Executes a trusted reference solution via Judge0.
    This does NOT persist anything; it returns an augmented list.
    """
    ref_code, language_id = _pick_reference_code_and_language(question)
    augmented: List[Dict[str, Any]] = []

    for idx, tc in enumerate(testcases):
        tc_copy = dict(tc or {})
        eo = (tc_copy.get("expected_output") or "").strip()
        
        # Skip only if expected_output exists and is NOT a placeholder
        if eo and not _is_placeholder_output(eo):
            augmented.append(tc_copy)
            continue

        # Compute expected output if missing or placeholder
        raw_input = tc_copy.get("input")
        # Support both JSON-style inputs (dict) and legacy stdin strings
        if isinstance(raw_input, dict):
            stdin = json.dumps(raw_input)
        else:
            stdin = str(raw_input or "")
        logger.info("[expected_output] Computing expected_output for testcase %s (missing or placeholder)", idx)
        result = await submit_to_judge0(source_code=ref_code, language_id=language_id, stdin=stdin)
        stdout = _normalize_output(result.get("stdout"))
        if stdout == "" and (result.get("stderr") or result.get("compile_output")):
            raise RuntimeError("Reference solution execution failed while computing expected outputs")

        tc_copy["expected_output"] = stdout
        tc_copy["expected_output_computed"] = True
        augmented.append(tc_copy)

    return augmented


async def compute_expected_outputs_from_code(
    source_code: str,
    language_id: int,
    testcases: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Compute expected_output for any testcase missing it using the provided reference code.
    Useful for AI-generated questions where the generated starter_code is a complete reference solution.
    """
    augmented: List[Dict[str, Any]] = []

    for idx, tc in enumerate(testcases):
        tc_copy = dict(tc or {})
        eo = (tc_copy.get("expected_output") or "").strip()
        if eo:
            augmented.append(tc_copy)
            continue

        raw_input = tc_copy.get("input")
        if isinstance(raw_input, dict):
            stdin = json.dumps(raw_input)
        else:
            stdin = str(raw_input or "")
        logger.info("[expected_output] Computing expected_output for testcase %s (direct code)", idx)
        result = await submit_to_judge0(source_code=source_code, language_id=language_id, stdin=stdin)
        stdout = _normalize_output(result.get("stdout"))
        if stdout == "" and (result.get("stderr") or result.get("compile_output")):
            raise RuntimeError("Reference code execution failed while computing expected outputs")

        tc_copy["expected_output"] = stdout
        tc_copy["expected_output_computed"] = True
        augmented.append(tc_copy)

    return augmented

