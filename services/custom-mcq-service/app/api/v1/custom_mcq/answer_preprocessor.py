"""
Answer Preprocessor Module
Pre-processes candidate answers before evaluation: length validation, structure analysis, off-topic detection.
"""
import re
import logging
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# Minimum word count for valid answers (very short = likely incomplete)
MIN_VALID_WORDS = 20

# Word count thresholds
SHORT_THRESHOLD = 50  # Less than this is considered short
LONG_THRESHOLD = 1000  # More than this is considered long


def preprocess_answer(answer: str, question_text: Optional[str] = None) -> Dict[str, Any]:
    """
    Preprocess answer to validate, analyze structure, and detect issues.
    
    Args:
        answer: Candidate's answer text
        question_text: Optional question text for relevance checking
    
    Returns:
        Dictionary with preprocessing results:
        - is_valid: bool (if False, should skip AI evaluation)
        - is_empty: bool
        - word_count: int
        - length_category: str (empty, very_short, short, appropriate, long)
        - has_structure: bool
        - structure_quality: str (poor, fair, good)
        - estimated_readability: str
        - should_evaluate: bool (whether to proceed with AI evaluation)
        - warnings: List[str]
    """
    if not answer:
        return {
            "is_valid": False,
            "is_empty": True,
            "word_count": 0,
            "length_category": "empty",
            "has_structure": False,
            "structure_quality": "poor",
            "estimated_readability": "poor",
            "should_evaluate": False,
            "warnings": ["Answer is empty"]
        }
    
    answer = answer.strip()
    
    if not answer:
        return {
            "is_valid": False,
            "is_empty": True,
            "word_count": 0,
            "length_category": "empty",
            "has_structure": False,
            "structure_quality": "poor",
            "estimated_readability": "poor",
            "should_evaluate": False,
            "warnings": ["Answer contains only whitespace"]
        }
    
    # Count words
    words = answer.split()
    word_count = len(words)
    
    # Determine length category
    if word_count == 0:
        length_category = "empty"
        should_evaluate = False
    elif word_count < MIN_VALID_WORDS:
        length_category = "very_short"
        should_evaluate = False  # Too short, likely not a real answer
    elif word_count < SHORT_THRESHOLD:
        length_category = "short"
        should_evaluate = True  # Short but might be valid
    elif word_count > LONG_THRESHOLD:
        length_category = "long"
        should_evaluate = True  # Long, might be rambling but evaluate
    else:
        length_category = "appropriate"
        should_evaluate = True
    
    # Analyze structure
    structure_analysis = _analyze_structure(answer)
    
    # Check for off-topic (if question provided)
    warnings = []
    if question_text:
        relevance_check = _check_relevance(answer, question_text)
        if not relevance_check["is_relevant"]:
            warnings.append("Answer may be off-topic")
            # Still evaluate, but flag it
    
    # Check for suspicious patterns
    suspicious_patterns = _check_suspicious_patterns(answer)
    if suspicious_patterns["is_suspicious"]:
        warnings.extend(suspicious_patterns["warnings"])
    
    return {
        "is_valid": word_count >= MIN_VALID_WORDS,
        "is_empty": False,
        "word_count": word_count,
        "length_category": length_category,
        "has_structure": structure_analysis["has_structure"],
        "structure_quality": structure_analysis["quality"],
        "estimated_readability": structure_analysis["readability"],
        "should_evaluate": should_evaluate,
        "warnings": warnings,
        "relevance_score": relevance_check.get("relevance_score", 1.0) if question_text else 1.0
    }


def _analyze_structure(answer: str) -> Dict[str, Any]:
    """Analyze answer structure and organization."""
    
    # Check for paragraphs
    paragraphs = [p.strip() for p in answer.split('\n\n') if p.strip()]
    has_paragraphs = len(paragraphs) > 1
    
    # Check for list/bullet points
    has_bullets = bool(re.search(r'^[\-\*\+•]\s', answer, re.MULTILINE))
    has_numbered = bool(re.search(r'^\d+[\.\)]\s', answer, re.MULTILINE))
    
    # Check for sentences (basic sentence detection)
    sentences = re.split(r'[.!?]+', answer)
    sentences = [s.strip() for s in sentences if s.strip()]
    sentence_count = len(sentences)
    
    # Check average sentence length
    if sentence_count > 0:
        avg_sentence_length = sum(len(s.split()) for s in sentences) / sentence_count
    else:
        avg_sentence_length = 0
    
    # Determine structure quality
    has_structure = has_paragraphs or has_bullets or has_numbered or sentence_count > 3
    
    if not has_structure:
        quality = "poor"
        readability = "poor"
    elif has_paragraphs and sentence_count > 5:
        quality = "good"
        readability = "good"
    elif sentence_count > 3:
        quality = "fair"
        readability = "fair"
    else:
        quality = "poor"
        readability = "poor"
    
    # Check for very long sentences (run-on sentences)
    if avg_sentence_length > 25:
        readability = "poor"
        quality = "fair" if quality == "good" else quality
    
    return {
        "has_structure": has_structure,
        "quality": quality,
        "readability": readability,
        "paragraph_count": len(paragraphs),
        "sentence_count": sentence_count,
        "has_bullets": has_bullets,
        "has_numbered": has_numbered,
        "avg_sentence_length": round(avg_sentence_length, 1)
    }


def _check_relevance(answer: str, question: str) -> Dict[str, Any]:
    """
    Check if answer is relevant to the question.
    Basic keyword overlap check.
    """
    
    # Extract keywords from question (excluding stop words)
    stop_words = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "as", "is", "are", "was", "were", "be",
        "been", "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "can", "this", "that",
        "what", "which", "who", "whom", "where", "when", "why", "how",
        "explain", "describe", "discuss", "define", "list", "name"
    }
    
    question_words = set(w.lower() for w in re.findall(r'\b[a-zA-Z]{3,}\b', question.lower()) if w.lower() not in stop_words)
    answer_words = set(w.lower() for w in re.findall(r'\b[a-zA-Z]{3,}\b', answer.lower()) if w.lower() not in stop_words)
    
    if not question_words:
        return {"is_relevant": True, "relevance_score": 1.0}
    
    # Calculate overlap
    overlap = question_words.intersection(answer_words)
    overlap_ratio = len(overlap) / len(question_words) if question_words else 0
    
    # If less than 20% overlap, might be off-topic
    is_relevant = overlap_ratio >= 0.2
    
    return {
        "is_relevant": is_relevant,
        "relevance_score": overlap_ratio,
        "overlapping_keywords": list(overlap)
    }


def _check_suspicious_patterns(answer: str) -> Dict[str, Any]:
    """
    Check for suspicious patterns that might indicate issues.
    """
    warnings = []
    is_suspicious = False
    
    # Check for excessive repetition
    words = answer.lower().split()
    if len(words) > 10:
        word_freq = {}
        for word in words:
            if len(word) > 3:  # Ignore short words
                word_freq[word] = word_freq.get(word, 0) + 1
        
        # Check if any word appears more than 30% of the time
        for word, count in word_freq.items():
            if count / len(words) > 0.3:
                warnings.append("Excessive word repetition detected")
                is_suspicious = True
                break
    
    # Check for all caps (shouting)
    if answer.isupper() and len(answer.split()) > 5:
        warnings.append("Answer is in all caps")
    
    # Check for very short sentences only
    sentences = re.split(r'[.!?]+', answer)
    sentences = [s.strip() for s in sentences if s.strip()]
    if len(sentences) > 0:
        short_sentences = sum(1 for s in sentences if len(s.split()) <= 3)
        if short_sentences / len(sentences) > 0.7:
            warnings.append("Answer contains mostly very short sentences")
    
    return {
        "is_suspicious": is_suspicious,
        "warnings": warnings
    }


def should_skip_evaluation(preprocessing_result: Dict[str, Any]) -> bool:
    """
    Determine if answer should skip AI evaluation based on preprocessing.
    
    Returns:
        True if should skip (too short, empty, etc.)
    """
    if not preprocessing_result.get("is_valid", False):
        return True
    
    if preprocessing_result.get("is_empty", False):
        return True
    
    if preprocessing_result.get("length_category") == "very_short":
        return True
    
    return False


def get_empty_answer_evaluation(max_marks: float) -> Dict[str, Any]:
    """
    Return evaluation result for empty/very short answers.
    
    Args:
        max_marks: Maximum marks for the question
    
    Returns:
        Evaluation result dictionary
    """
    return {
        "score": 0.0,
        "max_marks": max_marks,
        "percentage": 0.0,
        "feedback": "No substantial answer provided. Please provide a detailed response to the question.",
        "reasoning": "Answer is empty or too short to evaluate.",
        "criteria_scores": {
            "accuracy": {"score": 0, "weight": 0, "feedback": "No answer provided"},
            "completeness": {"score": 0, "weight": 0, "feedback": "No answer provided"},
            "clarity": {"score": 0, "weight": 0, "feedback": "No answer provided"},
            "depth": {"score": 0, "weight": 0, "feedback": "No answer provided"},
            "relevance": {"score": 0, "weight": 0, "feedback": "No answer provided"}
        },
        "completeness_check": {
            "all_parts_covered": False,
            "missing_parts": []
        },
        "flags": {
            "confidence_level": 1.0,
            "requires_human_review": False,
            "incomplete_answer": True,
            "empty_answer": True
        }
    }


