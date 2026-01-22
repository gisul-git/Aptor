"""
Scoring Validator Module
Validates completeness, applies score caps, calculates penalties, and ensures score accuracy.
"""
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


def validate_answer_completeness(
    answer: str,
    question_analysis: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Validate if answer covers all required parts of the question.
    
    Args:
        answer: Candidate's answer text
        question_analysis: Result from question_analyzer.analyze_question()
    
    Returns:
        Dictionary with completeness check results:
        - all_parts_covered: bool
        - parts_coverage: List[Dict] with coverage status for each part
        - missing_parts: List[str]
        - covered_parts: List[str]
    """
    if not question_analysis.get("is_multi_part", False):
        # Single part question - assume covered if answer exists
        return {
            "all_parts_covered": True,
            "parts_coverage": [],
            "missing_parts": [],
            "covered_parts": ["main"],
            "coverage_score": 1.0
        }
    
    parts = question_analysis.get("parts", [])
    answer_lower = answer.lower()
    
    parts_coverage = []
    covered_parts = []
    missing_parts = []
    
    for part in parts:
        part_text = part.get("text", "").lower()
        part_keywords = [kw.lower() for kw in part.get("keywords", [])]
        
        # Check if part is covered
        is_covered = False
        
        # Method 1: Check if any keywords from part appear in answer
        if part_keywords:
            keyword_matches = sum(1 for kw in part_keywords if kw in answer_lower)
            # If at least 30% of keywords match, consider covered
            if keyword_matches / len(part_keywords) >= 0.3:
                is_covered = True
        
        # Method 2: Check if part text (simplified) appears in answer
        if not is_covered:
            # Extract main terms from part text
            part_terms = [w for w in part_text.split() if len(w) > 3]
            if part_terms:
                # Check if significant portion of terms appear
                term_matches = sum(1 for term in part_terms[:5] if term in answer_lower)
                if term_matches >= 2:  # At least 2 significant terms
                    is_covered = True
        
        parts_coverage.append({
            "part_id": part.get("id"),
            "part_text": part.get("text"),
            "is_covered": is_covered
        })
        
        if is_covered:
            covered_parts.append(part.get("text"))
        else:
            missing_parts.append(part.get("text"))
    
    all_parts_covered = len(missing_parts) == 0
    coverage_score = len(covered_parts) / len(parts) if parts else 0.0
    
    return {
        "all_parts_covered": all_parts_covered,
        "parts_coverage": parts_coverage,
        "missing_parts": missing_parts,
        "covered_parts": covered_parts,
        "coverage_score": coverage_score
    }


def get_completeness_multiplier(parts_covered: int, total_parts: int) -> float:
    """
    Calculate completeness multiplier based on parts covered.
    
    Args:
        parts_covered: Number of parts covered in answer
        total_parts: Total number of required parts
    
    Returns:
        Multiplier (0.0 to 1.0)
    """
    if total_parts <= 1:
        return 1.0
    
    if parts_covered >= total_parts:
        return 1.0
    
    # Calculate multiplier based on coverage
    multiplier = parts_covered / total_parts
    
    return multiplier


def calculate_completeness_cap(
    max_marks: float,
    parts_covered: int,
    total_parts: int
) -> float:
    """
    Calculate maximum possible score based on completeness.
    
    Args:
        max_marks: Maximum marks for the question
        parts_covered: Number of parts covered
        total_parts: Total number of required parts
    
    Returns:
        Maximum possible score (capped based on completeness)
    """
    if total_parts <= 1:
        return max_marks
    
    if parts_covered >= total_parts:
        return max_marks
    
    # Calculate cap percentage
    if total_parts == 2:
        # 2-part question: missing 1 part = max 50%
        cap_percentage = 0.5 if parts_covered == 1 else 0.0
    elif total_parts == 3:
        # 3-part question: missing 1 part = max 66%, missing 2 = max 33%
        if parts_covered == 2:
            cap_percentage = 0.67
        elif parts_covered == 1:
            cap_percentage = 0.33
        else:
            cap_percentage = 0.0
    else:
        # General formula for N parts
        cap_percentage = parts_covered / total_parts
    
    return max_marks * cap_percentage


def apply_completeness_cap(
    score: float,
    max_marks: float,
    completeness_result: Dict[str, Any],
    question_analysis: Dict[str, Any]
) -> Tuple[float, float, Dict[str, Any]]:
    """
    Apply completeness cap to score and return capped score with metadata.
    
    Args:
        score: Original score from AI
        max_marks: Maximum marks for the question
        completeness_result: Result from validate_answer_completeness()
        question_analysis: Result from question_analyzer.analyze_question()
    
    Returns:
        Tuple of (capped_score, max_possible_score, cap_info)
    """
    if not question_analysis.get("is_multi_part", False):
        return score, max_marks, {"capped": False, "reason": "Single part question"}
    
    total_parts = question_analysis.get("part_count", 1)
    parts_covered = len(completeness_result.get("covered_parts", []))
    
    # Calculate maximum possible score based on completeness
    max_possible_score = calculate_completeness_cap(max_marks, parts_covered, total_parts)
    
    # Apply cap
    if score > max_possible_score:
        capped_score = max_possible_score
        cap_info = {
            "capped": True,
            "reason": f"Answer only covers {parts_covered}/{total_parts} parts",
            "original_score": score,
            "max_possible_score": max_possible_score,
            "parts_covered": parts_covered,
            "total_parts": total_parts
        }
    else:
        capped_score = score
        cap_info = {
            "capped": False,
            "reason": "Score within allowed range",
            "parts_covered": parts_covered,
            "total_parts": total_parts
        }
    
    return capped_score, max_possible_score, cap_info


def calculate_penalties(
    answer: str,
    question_analysis: Dict[str, Any],
    ai_evaluation: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Calculate penalties for errors, missing points, irrelevant content.
    
    Args:
        answer: Candidate's answer
        question_analysis: Question analysis result
        ai_evaluation: AI evaluation result (may contain error detection)
    
    Returns:
        Dictionary with penalty details
    """
    penalties = {
        "factual_errors": 0,
        "missing_key_points": 0,
        "irrelevant_content": 0,
        "structure_issues": 0,
        "total_penalty": 0.0
    }
    
    # Penalties are typically already factored into AI's score
    # This function can be used for additional post-processing if needed
    
    return penalties


def normalize_score(score: float, max_marks: float) -> float:
    """
    Normalize score to ensure it's within valid range [0, max_marks].
    
    Args:
        score: Score to normalize
        max_marks: Maximum marks
    
    Returns:
        Normalized score (0 to max_marks)
    """
    # Ensure score is within bounds
    normalized = max(0.0, min(score, max_marks))
    
    # Round to 2 decimal places
    return round(normalized, 2)


def validate_evaluation_result(
    evaluation_result: Dict[str, Any],
    answer: str,
    question_analysis: Dict[str, Any],
    max_marks: float
) -> Tuple[Dict[str, Any], List[str]]:
    """
    Validate AI evaluation result and fix any issues.
    
    Args:
        evaluation_result: AI evaluation result
        answer: Candidate's answer
        question_analysis: Question analysis result
        max_marks: Maximum marks
    
    Returns:
        Tuple of (validated_result, warnings)
    """
    warnings = []
    
    # Get score
    score = evaluation_result.get("score", 0.0)
    
    # Normalize score
    score = normalize_score(score, max_marks)
    evaluation_result["score"] = score
    
    # Check completeness if multi-part
    if question_analysis.get("is_multi_part", False):
        completeness_check = validate_answer_completeness(answer, question_analysis)
        
        # Verify AI's completeness check matches our validation
        ai_completeness = evaluation_result.get("completeness_check", {})
        ai_all_covered = ai_completeness.get("all_parts_covered", True)
        
        if ai_all_covered != completeness_check["all_parts_covered"]:
            warnings.append("AI completeness check mismatch - auto-correcting")
            # Use our validation result
            evaluation_result["completeness_check"] = completeness_check
            
            # Re-apply cap if needed
            capped_score, max_possible, cap_info = apply_completeness_cap(
                score, max_marks, completeness_check, question_analysis
            )
            if cap_info["capped"]:
                evaluation_result["score"] = capped_score
                warnings.append(f"Score capped to {capped_score} due to incomplete answer")
    
    # Ensure percentage is correct
    percentage = (score / max_marks * 100) if max_marks > 0 else 0.0
    evaluation_result["percentage"] = round(percentage, 2)
    
    # Validate score makes sense given answer length
    word_count = len(answer.split())
    if word_count < 20 and score > max_marks * 0.5:
        warnings.append(f"High score ({score}) for short answer ({word_count} words)")
    
    return evaluation_result, warnings


def calculate_confidence_score(
    evaluation_result: Dict[str, Any],
    answer_preprocessing: Dict[str, Any],
    completeness_result: Dict[str, Any]
) -> float:
    """
    Calculate confidence score for the evaluation.
    
    Args:
        evaluation_result: AI evaluation result
        answer_preprocessing: Preprocessing result
        completeness_result: Completeness validation result
    
    Returns:
        Confidence score (0.0 to 1.0)
    """
    confidence = 0.8  # Base confidence
    
    # Reduce confidence if answer is short
    if answer_preprocessing.get("word_count", 0) < 50:
        confidence -= 0.1
    
    # Reduce confidence if structure is poor
    if answer_preprocessing.get("structure_quality") == "poor":
        confidence -= 0.1
    
    # Reduce confidence if completeness is unclear
    if completeness_result.get("coverage_score", 1.0) < 0.5:
        confidence -= 0.1
    
    # Increase confidence if answer is well-structured
    if answer_preprocessing.get("structure_quality") == "good":
        confidence += 0.05
    
    # Ensure confidence is in valid range
    confidence = max(0.3, min(1.0, confidence))
    
    return round(confidence, 2)


