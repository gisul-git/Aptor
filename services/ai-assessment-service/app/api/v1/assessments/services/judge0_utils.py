"""
Module: judge0_utils.py
Purpose: Judge0 compatibility checks and utilities

This module handles all Judge0-related functionality:
- Checking if skills/frameworks are supported by Judge0
- Filtering unsupported frameworks
- Function signature validation
- Starter code templates
- Language ID mapping

Dependencies:
- External: re (for regex)
- Internal: prompt_templates (for JUDGE0_UNSUPPORTED_FRAMEWORKS)
- Internal: ai_utils (for logging)

Example usage:
    ```python
    from app.api.v1.assessments.services.judge0_utils import (
        is_judge0_supported,
        get_judge0_language_id,
        get_starter_code_template
    )
    
    if is_judge0_supported("python"):
        lang_id = get_judge0_language_id("python")
        template = get_starter_code_template("python")
    ```

Note: Judge0 only supports pure programming languages, not frameworks.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from .prompt_templates import JUDGE0_UNSUPPORTED_FRAMEWORKS

logger = logging.getLogger(__name__)


# ============================================================================
# JUDGE0 SUPPORT CHECKS
# ============================================================================

def is_judge0_supported(skill_name: str) -> bool:
    """
    Check if a skill/topic name is supported by Judge0.
    Judge0 only supports pure programming languages, not frameworks
    that require additional setup.
    
    Args:
        skill_name: Name of the skill/topic to check
        
    Returns:
        True if supported, False otherwise
    """
    # Moved from topic_service_v2.py:297-324
    if not skill_name:
        return True
    
    skill_lower = skill_name.lower().strip()
    
    # Check if the skill matches any unsupported framework
    # Check for exact match, prefix match, or if framework appears as a word in the string
    for framework in JUDGE0_UNSUPPORTED_FRAMEWORKS:
        framework_lower = framework.lower()
        # Exact match
        if skill_lower == framework_lower:
            return False
        # Starts with framework followed by space
        if skill_lower.startswith(framework_lower + " "):
            return False
        # Framework appears as a whole word in the string (using word boundaries)
        # Check if framework is surrounded by non-word characters or at start/end
        pattern = r'\b' + re.escape(framework_lower) + r'\b'
        if re.search(pattern, skill_lower):
            return False
    
    return True


def filter_judge0_unsupported_skills(skills: List[str]) -> List[str]:
    """
    Filter out skills that are not supported by Judge0.
    
    Args:
        skills: List of skill names
        
    Returns:
        Filtered list containing only Judge0-supported skills
    """
    # Moved from topic_service_v2.py:327-331
    return [skill for skill in skills if is_judge0_supported(skill)]


def contains_unsupported_framework(text: str, skills: Optional[List[str]] = None) -> tuple[bool, Optional[str]]:
    """
    Check if a text (topic label) contains any framework that's not supported by Judge0.
    Returns (is_framework, framework_name) tuple.
    
    Args:
        text: Topic label or text to check
        skills: Optional list of skills to also check
        
    Returns:
        Tuple of (is_framework, framework_name)
    """
    # Moved from topic_service_v2.py:334-362
    if not text:
        return (False, None)
    
    text_lower = text.lower()
    
    # First, check if the text itself contains any framework name
    for framework in JUDGE0_UNSUPPORTED_FRAMEWORKS:
        framework_lower = framework.lower()
        # Check if framework appears as a whole word in the text
        pattern = r'\b' + re.escape(framework_lower) + r'\b'
        if re.search(pattern, text_lower):
            return (True, framework)
    
    # Second, check if any skill from the provided list is a framework and appears in the text
    if skills:
        for skill in skills:
            if not is_judge0_supported(skill):
                skill_lower = skill.lower().strip()
                # Check if this framework skill appears in the topic label
                pattern = r'\b' + re.escape(skill_lower) + r'\b'
                if re.search(pattern, text_lower):
                    return (True, skill)
    
    return (False, None)


# ============================================================================
# TOPIC FILTERING
# ============================================================================

def filter_topics_with_coding_unsupported(topics: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Filter out topics that have coding questions but are not supported by Judge0.
    
    Args:
        topics: List of topic dictionaries
        
    Returns:
        Filtered list of topics (only those with coding questions that are Judge0-supported)
    """
    # Moved from topic_service_v2.py:468-493
    filtered_topics = []
    for topic in topics:
        # Check if topic has any coding question rows
        question_rows = topic.get("questionRows", [])
        has_coding_questions = any(
            row.get("questionType") == "Coding" for row in question_rows
        )
        
        # If topic has coding questions, check if it's supported by Judge0
        if has_coding_questions:
            topic_label = topic.get("label", "")
            if is_judge0_supported(topic_label):
                filtered_topics.append(topic)
            else:
                logger.warning(
                    f"Filtered out topic '{topic_label}' - has coding questions but not supported by Judge0"
                )
        else:
            # If no coding questions, keep the topic
            filtered_topics.append(topic)
    
    return filtered_topics


# ============================================================================
# FUNCTION SIGNATURE VALIDATION
# ============================================================================

def _validate_and_fix_function_signature(
    func_sig_raw: Any,
    topic: Optional[str] = None,
    title: Optional[str] = None,
    context: str = "validation"
) -> Optional[Dict[str, Any]]:
    """
    Validate and fix function signature structure.
    Ensures the function signature has required fields: name, parameters, return_type.
    
    Args:
        func_sig_raw: Raw function signature (dict, str, or None)
        topic: Topic name for inference
        title: Title for inference
        context: Context string for logging
    
    Returns:
        Validated and fixed function signature dict, or None if invalid
    """
    # Moved from topic_service_v2.py:365-465
    if func_sig_raw is None:
        return None
    
    # If it's a string, try to parse it or return None
    if isinstance(func_sig_raw, str):
        # If it's an empty string, return None
        if not func_sig_raw.strip():
            return None
        # Could try to parse string format like "functionName(param1: type1, param2: type2): returnType"
        # For now, return None and let the caller handle it
        logger.warning(f"[{context}] Function signature is a string, cannot validate structure: {func_sig_raw[:50]}")
        return None
    
    # Must be a dict
    if not isinstance(func_sig_raw, dict):
        logger.warning(f"[{context}] Function signature is not a dict, got {type(func_sig_raw)}")
        return None
    
    func_sig = func_sig_raw.copy()  # Work with a copy
    fixed = False
    
    # Ensure 'name' field exists
    if "name" not in func_sig or not func_sig.get("name"):
        # Try to infer from title or topic
        if title:
            inferred_name = title.lower().replace(" ", "_").replace("-", "_")
            # Remove special characters, keep only alphanumeric and underscore
            inferred_name = re.sub(r'[^a-z0-9_]', '', inferred_name)
            inferred_name = inferred_name[:20] or "solve"
        elif topic:
            inferred_name = topic.lower().replace(" ", "_").replace("-", "_")
            inferred_name = re.sub(r'[^a-z0-9_]', '', inferred_name)
            inferred_name = inferred_name[:20] or "solve"
        else:
            inferred_name = "solve"
        
        func_sig["name"] = inferred_name
        fixed = True
        logger.debug(f"[{context}] Function signature missing 'name', inferred: {inferred_name}")
    
    # Ensure 'parameters' field exists and is a list
    if "parameters" not in func_sig:
        func_sig["parameters"] = []
        fixed = True
        logger.debug(f"[{context}] Function signature missing 'parameters', using empty array")
    elif not isinstance(func_sig["parameters"], list):
        logger.warning(f"[{context}] Function signature.parameters is not an array, converting...")
        func_sig["parameters"] = []
        fixed = True
    
    # Validate parameters structure if present
    if func_sig["parameters"]:
        validated_params = []
        for param in func_sig["parameters"]:
            if isinstance(param, dict):
                # Ensure param has name and type
                if "name" not in param or not param.get("name"):
                    continue  # Skip invalid params
                if "type" not in param:
                    param["type"] = "any"  # Default type
                validated_params.append(param)
            elif isinstance(param, str):
                # Try to parse string format like "name: type" or just "name"
                parts = param.split(":", 1)
                param_name = parts[0].strip()
                param_type = parts[1].strip() if len(parts) > 1 else "any"
                validated_params.append({"name": param_name, "type": param_type})
        
        if len(validated_params) != len(func_sig["parameters"]):
            fixed = True
        func_sig["parameters"] = validated_params
    
    # Ensure 'return_type' field exists
    if "return_type" not in func_sig or not func_sig.get("return_type"):
        func_sig["return_type"] = "int"  # Default return type
        fixed = True
        logger.debug(f"[{context}] Function signature missing 'return_type', using default: 'int'")
    
    if fixed:
        logger.debug(f"[{context}] Fixed function signature: {func_sig}")
    
    return func_sig


# ============================================================================
# JUDGE0 LANGUAGE MAPPING
# ============================================================================

def _get_judge0_language_id(language: str) -> int:
    """
    Get Judge0 language ID for a given language.
    
    Args:
        language: Programming language name
        
    Returns:
        Judge0 language ID
    """
    # Moved from topic_service_v2.py:2260-2280
    language_id_map = {
        "python": 71,      # Python 3
        "java": 62,        # Java
        "cpp": 54,         # C++ (GCC)
        "c": 50,           # C (GCC)
        "javascript": 63,  # Node.js
        "typescript": 74,  # TypeScript
        "go": 60,          # Go
        "ruby": 72,        # Ruby
    }
    return language_id_map.get(language.lower(), 71)  # Default to Python


def _get_starter_code_template(language: str) -> str:
    """
    Get starter code template for a given language.
    
    Args:
        language: Programming language (python, java, cpp, c, javascript, typescript, go, ruby)
        
    Returns:
        Starter code template string
    """
    # Moved from topic_service_v2.py:2193-2257
    templates = {
        "python": """def solve():
    # Write your logic here
    pass""",
        "java": """public class Solution {
    public static void solve() {
        // Write your logic here
    }
    public static void main(String[] args) {
        // Do not modify this method
    }
}""",
        "cpp": """#include <bits/stdc++.h>
using namespace std;

void solve() {
    // Write your logic here
}

int main() {
    // Locked main function
    return 0;
}""",
        "c": """#include <stdio.h>

void solve() {
    // Write your logic here
}

int main() {
    // Do not modify main, input/output handled here
    return 0;
}""",
        "javascript": """function solve(input) {
    // Write your logic here
}""",
        "typescript": """function solve(input: string): string {
    // Write your logic here
}""",
        "go": """package main

import "fmt"

func solve() {
    // Write your logic here
}

func main() {
    // Do not modify this method
}""",
        "ruby": """def solve
    # Write your logic here
end""",
    }
    return templates.get(language.lower(), templates["python"])



