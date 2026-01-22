"""
Question Analyzer Module
Analyzes questions to detect type, multi-part structure, required elements, and complexity.
"""
import re
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


def analyze_question(question_text: str) -> Dict[str, Any]:
    """
    Analyze a question to extract structure, type, required parts, and complexity.
    
    Args:
        question_text: The question text to analyze
    
    Returns:
        Dictionary with analysis results including:
        - is_multi_part: bool
        - parts: List of required parts
        - question_type: str (definition, explanation, comparison, etc.)
        - complexity: str (simple, medium, complex)
        - required_keywords: List of keywords to look for
        - part_count: int
    """
    if not question_text or not question_text.strip():
        return _default_analysis()
    
    question_text = question_text.strip()
    question_lower = question_text.lower()
    
    # Detect question type
    question_type = _detect_question_type(question_text, question_lower)
    
    # Detect multi-part questions
    is_multi_part, parts = _detect_multi_part(question_text, question_lower)
    
    # Extract required keywords/concepts
    required_keywords = _extract_keywords(question_text, parts)
    
    # Determine complexity
    complexity = _determine_complexity(question_text, is_multi_part, len(parts), question_type)
    
    return {
        "is_multi_part": is_multi_part,
        "parts": parts,
        "part_count": len(parts),
        "question_type": question_type,
        "complexity": complexity,
        "required_keywords": required_keywords,
        "original_question": question_text
    }


def _detect_question_type(question: str, question_lower: str) -> str:
    """Detect the type of question."""
    
    # Comparison questions
    if any(pattern in question_lower for pattern in [
        "difference between", "differences between", "compare", "comparison",
        "distinguish between", "contrast", "versus", "vs", "v/s"
    ]):
        return "comparison"
    
    # Definition questions
    if any(pattern in question_lower for pattern in [
        "what is", "what are", "define", "definition of", "meaning of"
    ]):
        return "definition"
    
    # Explanation questions
    if any(pattern in question_lower for pattern in [
        "explain", "explain how", "explain why", "describe how",
        "elaborate", "discuss", "how does", "how do"
    ]):
        return "explanation"
    
    # Application questions
    if any(pattern in question_lower for pattern in [
        "how would you", "how will you", "how to", "how can",
        "demonstrate", "show how", "illustrate"
    ]):
        return "application"
    
    # Analysis questions
    if any(pattern in question_lower for pattern in [
        "analyze", "analysis", "evaluate", "critique", "criticize",
        "assess", "examine"
    ]):
        return "analysis"
    
    # List/Enumeration questions
    if any(pattern in question_lower for pattern in [
        "list", "name", "enumerate", "identify", "mention"
    ]):
        return "enumeration"
    
    # Default
    return "general"


def _detect_multi_part(question: str, question_lower: str) -> Tuple[bool, List[Dict[str, Any]]]:
    """
    Detect if question has multiple parts and extract them.
    
    Returns:
        Tuple of (is_multi_part: bool, parts: List[Dict])
    """
    parts = []
    is_multi_part = False
    
    # Pattern 1: "X and Y" (most common)
    and_patterns = [
        r"(\w+(?:\s+\w+)*?)\s+and\s+(\w+(?:\s+\w+)*?)(?:\s|$|,|\.|\?)",
        r"both\s+(\w+(?:\s+\w+)*?)\s+and\s+(\w+(?:\s+\w+)*?)(?:\s|$|,|\.|\?)",
    ]
    
    for pattern in and_patterns:
        matches = re.finditer(pattern, question_lower, re.IGNORECASE)
        for match in matches:
            if match.lastindex and match.lastindex >= 2:
                part1 = match.group(1).strip()
                part2 = match.group(2).strip()
                
                # Filter out common words that aren't actual parts
                if len(part1.split()) >= 2 and len(part2.split()) >= 2:
                    # Extract the actual phrases from original question
                    original_match = re.search(
                        rf"({re.escape(match.group(1))})\s+and\s+({re.escape(match.group(2))})",
                        question,
                        re.IGNORECASE
                    )
                    if original_match:
                        parts = [
                            {"id": 1, "text": original_match.group(1).strip(), "required": True, "keywords": _extract_keywords_from_part(original_match.group(1))},
                            {"id": 2, "text": original_match.group(2).strip(), "required": True, "keywords": _extract_keywords_from_part(original_match.group(2))}
                        ]
                        is_multi_part = True
                        break
    
    # Pattern 2: "1. X 2. Y" (numbered list)
    if not is_multi_part:
        numbered_pattern = r"(\d+)[\.\)]\s*([^0-9]+?)(?=\d+[\.\)]|$)"
        numbered_matches = list(re.finditer(numbered_pattern, question))
        if len(numbered_matches) >= 2:
            parts = []
            for idx, match in enumerate(numbered_matches, 1):
                part_text = match.group(2).strip()
                if len(part_text) > 5:  # Valid part
                    parts.append({
                        "id": idx,
                        "text": part_text,
                        "required": True,
                        "keywords": _extract_keywords_from_part(part_text)
                    })
            if len(parts) >= 2:
                is_multi_part = True
    
    # Pattern 3: "X, Y, and Z" (list with and)
    if not is_multi_part:
        list_pattern = r"([^,]+(?:,\s*[^,]+)*?)\s+and\s+([^,\.\?]+)"
        list_match = re.search(list_pattern, question_lower)
        if list_match:
            # Split by commas before "and"
            before_and = list_match.group(1).strip()
            after_and = list_match.group(2).strip()
            
            # Count items
            items = [item.strip() for item in before_and.split(",")]
            items.append(after_and)
            
            if len(items) >= 2:
                parts = []
                for idx, item in enumerate(items, 1):
                    if len(item) > 5:  # Valid part
                        parts.append({
                            "id": idx,
                            "text": item,
                            "required": True,
                            "keywords": _extract_keywords_from_part(item)
                        })
                if len(parts) >= 2:
                    is_multi_part = True
    
    # Pattern 4: Questions with explicit multiple requirements
    if not is_multi_part:
        multi_requirement_patterns = [
            r"(?:first|second|third|1st|2nd|3rd).*?(?:then|and|also)",
            r"(?:also|additionally|furthermore).*?(?:explain|describe|discuss)"
        ]
        for pattern in multi_requirement_patterns:
            if re.search(pattern, question_lower):
                # Try to split by conjunctions
                splits = re.split(r"\s+(?:then|and|also|additionally|furthermore)\s+", question_lower)
                if len(splits) >= 2:
                    parts = []
                    for idx, split in enumerate(splits, 1):
                        # Extract the requirement part
                        requirement_match = re.search(r"(explain|describe|discuss|what|how|define|analyze).*", split)
                        if requirement_match:
                            part_text = requirement_match.group(0).strip()
                            if len(part_text) > 10:
                                parts.append({
                                    "id": idx,
                                    "text": part_text,
                                    "required": True,
                                    "keywords": _extract_keywords_from_part(part_text)
                                })
                    if len(parts) >= 2:
                        is_multi_part = True
                        break
    
    # If multi-part detected, return parts; otherwise return single part
    if is_multi_part and parts:
        return True, parts
    else:
        # Single part question
        return False, [{"id": 1, "text": question, "required": True, "keywords": _extract_keywords_from_part(question)}]


def _extract_keywords_from_part(part_text: str) -> List[str]:
    """Extract important keywords from a part of the question."""
    if not part_text:
        return []
    
    # Remove common stop words
    stop_words = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "as", "is", "are", "was", "were", "be",
        "been", "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "can", "this", "that",
        "these", "those", "what", "which", "who", "whom", "whose", "where",
        "when", "why", "how", "explain", "describe", "discuss", "define"
    }
    
    # Extract words (3+ characters, not stop words)
    words = re.findall(r'\b[a-zA-Z]{3,}\b', part_text.lower())
    keywords = [w for w in words if w not in stop_words]
    
    # Return top keywords (remove duplicates, limit to 10)
    unique_keywords = list(dict.fromkeys(keywords))[:10]
    
    return unique_keywords


def _extract_keywords(question: str, parts: List[Dict[str, Any]]) -> List[str]:
    """Extract all required keywords from question and parts."""
    all_keywords = []
    
    # Get keywords from each part
    for part in parts:
        part_keywords = part.get("keywords", [])
        all_keywords.extend(part_keywords)
    
    # Also extract from overall question
    question_keywords = _extract_keywords_from_part(question)
    all_keywords.extend(question_keywords)
    
    # Remove duplicates and return
    unique_keywords = list(dict.fromkeys(all_keywords))
    
    return unique_keywords[:15]  # Limit to top 15


def _determine_complexity(question: str, is_multi_part: bool, part_count: int, question_type: str) -> str:
    """Determine question complexity."""
    
    word_count = len(question.split())
    
    # Complex indicators
    complex_indicators = [
        "analyze", "evaluate", "critique", "assess", "examine",
        "compare and contrast", "advantages and disadvantages",
        "pros and cons", "strengths and weaknesses"
    ]
    
    if any(indicator in question.lower() for indicator in complex_indicators):
        return "complex"
    
    if is_multi_part and part_count >= 3:
        return "complex"
    
    if is_multi_part and part_count == 2:
        if question_type in ["comparison", "analysis"]:
            return "complex"
        return "medium"
    
    if question_type in ["analysis", "application"]:
        return "medium"
    
    if word_count > 30:
        return "medium"
    
    return "simple"


def _default_analysis() -> Dict[str, Any]:
    """Return default analysis for invalid questions."""
    return {
        "is_multi_part": False,
        "parts": [{"id": 1, "text": "", "required": True, "keywords": []}],
        "part_count": 1,
        "question_type": "general",
        "complexity": "simple",
        "required_keywords": [],
        "original_question": ""
    }


def get_criteria_weights(question_type: str, is_multi_part: bool) -> Dict[str, float]:
    """
    Get weight distribution for evaluation criteria based on question type.
    
    Returns:
        Dictionary with weights for: accuracy, completeness, clarity, depth, relevance
    """
    
    if is_multi_part:
        return {
            "completeness": 40.0,
            "accuracy": 30.0,
            "depth": 20.0,
            "clarity": 10.0,
            "relevance": 0.0  # Already checked in completeness
        }
    
    if question_type == "definition":
        return {
            "accuracy": 40.0,
            "completeness": 30.0,
            "clarity": 20.0,
            "depth": 10.0,
            "relevance": 0.0
        }
    
    if question_type == "explanation":
        return {
            "depth": 35.0,
            "accuracy": 30.0,
            "completeness": 25.0,
            "clarity": 10.0,
            "relevance": 0.0
        }
    
    if question_type == "comparison":
        return {
            "completeness": 40.0,
            "accuracy": 30.0,
            "depth": 20.0,
            "clarity": 10.0,
            "relevance": 0.0
        }
    
    if question_type in ["analysis", "application"]:
        return {
            "depth": 35.0,
            "accuracy": 30.0,
            "completeness": 25.0,
            "clarity": 10.0,
            "relevance": 0.0
        }
    
    # Default balanced weights
    return {
        "accuracy": 25.0,
        "completeness": 25.0,
        "clarity": 20.0,
        "depth": 20.0,
        "relevance": 10.0
    }


