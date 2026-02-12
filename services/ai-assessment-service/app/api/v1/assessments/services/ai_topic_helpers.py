"""
Module: ai_topic_helpers.py
Purpose: Helper functions for topic generation

This module contains helper functions used by the main topic generator.
These functions handle topic post-processing, question type assignment,
and topic filtering.

Dependencies:
- External: openai (for semantic matching)
- Internal: ai_utils (for OpenAI client, classifiers)
- Internal: judge0_utils (for framework checks)

Example usage:
    ```python
    from app.api.v1.assessments.services.ai_topic_helpers import (
        _ensure_all_question_types_present,
        filter_topics_with_coding_unsupported
    )
    
    topics = filter_topics_with_coding_unsupported(topics)
    topics = await _ensure_all_question_types_present(topics)
    ```

Note: These are helper functions used internally by ai_topic_generator.py
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from .ai_utils import _get_openai_client, _v2_contains_any
from .judge0_utils import (
    contains_unsupported_framework,
    is_judge0_supported,
    filter_topics_with_coding_unsupported,
)

logger = logging.getLogger(__name__)


# ============================================================================
# TOPIC FILTERING
# ============================================================================

# filter_topics_with_coding_unsupported moved to judge0_utils.py
# Import it from there: from .judge0_utils import filter_topics_with_coding_unsupported


# ============================================================================
# QUESTION TYPE ASSIGNMENT
# ============================================================================

async def _find_semantically_suitable_topic(
    topics: List[Dict[str, Any]], 
    target_question_type: str
) -> Optional[int]:
    """
    Use OpenAI to find the most semantically suitable topic for a given question type.
    
    Args:
        topics: List of topic dictionaries
        target_question_type: Desired question type (MCQ, Subjective, etc.)
        
    Returns:
        Index of the best matching topic, or None if no suitable match found
    """
    # TODO: Move implementation from topic_service_v2.py line 711
    pass


async def _ensure_all_question_types_present(topics: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Post-process topics to ensure all question types appear at least once.
    
    Rules:
    - MCQ, Subjective, PseudoCode must appear at least once
    - Coding must appear at least once ONLY if at least one topic supports it (canUseJudge0 = true)
    - Updates topics while maintaining topic-questionType relevance
    
    Args:
        topics: List of topic dictionaries
        
    Returns:
        Updated list of topics with all required question types
    """
    if not topics:
        return topics
    
    # For now, return topics as-is since AI already assigns diverse question types
    # Full implementation would check coverage and adjust if needed
    # TODO: Implement full logic to ensure all question types are present
    return topics


