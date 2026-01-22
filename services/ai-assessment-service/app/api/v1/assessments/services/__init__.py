"""
Assessment Services Package

This package contains all AI-powered topic and question generation services.
The services are organized into specialized modules for maintainability.

Module Structure:
- prompt_templates: Constants and keyword lists
- ai_utils: Core utilities (OpenAI client, JSON parsing, URL processing)
- judge0_utils: Judge0 compatibility checks and utilities
- ai_quality: Question quality validation
- ai_topic_helpers: Helper functions for topic generation
- ai_coding_generator: Coding question generation
- ai_sql_generator: SQL question generation
- ai_aiml_generator: AIML question generation
- ai_question_generator: MCQ/Subjective/PseudoCode question generation
- ai_topic_generator: Topic generation functions
- ai_validation: Topic validation and suggestions

Example usage:
    ```python
    from app.api.v1.assessments.services import generate_topics_v2, generate_questions_for_row_v2
    
    topics = await generate_topics_v2(...)
    questions = await generate_questions_for_row_v2(...)
    ```
"""
from __future__ import annotations

# Topic generation
from .ai_topic_generator import (
    generate_topics_v2,
    generate_topics_unified,
    generate_topics_from_requirements_v2,
    improve_topic,
)

# Question generation
from .ai_question_generator import (
    generate_questions_for_row_v2,
    generate_questions_for_topic_v2,
    regenerate_question,
)

# Validation
from .ai_validation import (
    validate_topic_category,
    ai_topic_suggestion,
    _is_technical_topic_ai,
)

# Utilities
from .ai_utils import (
    _get_openai_client,
    _v2_is_aiml_execution_topic,
    _v2_is_sql_execution_topic,
    _v2_contains_any,
    _get_experience_level_corporate,
    _get_experience_level_student,
)

# Judge0 utilities
from .judge0_utils import (
    is_judge0_supported,
    contains_unsupported_framework,
    filter_topics_with_coding_unsupported,
)

# Constants
from .prompt_templates import V2_WEB_KEYWORDS

# Legacy compatibility functions (for backward compatibility with old endpoints)
from .legacy_compat import (
    determine_topic_coding_support,
    generate_questions_for_topic_safe,
    generate_topics_from_input,
    generate_topics_from_skill,
    generate_topics_from_selected_skills,
    generate_topic_cards_from_job_designation,
    get_question_type_for_topic,
    get_relevant_question_types,
    get_relevant_question_types_from_domain,
    infer_language_from_skill,
    suggest_time_and_score,
)

__all__ = [
    # Topic generation
    'generate_topics_v2',
    'generate_topics_unified',
    'generate_topics_from_requirements_v2',
    'improve_topic',
    # Question generation
    'generate_questions_for_row_v2',
    'generate_questions_for_topic_v2',
    'regenerate_question',
    # Validation
    'validate_topic_category',
    'ai_topic_suggestion',
    '_is_technical_topic_ai',
    # Utilities
    '_get_openai_client',
    '_v2_is_aiml_execution_topic',
    '_v2_is_sql_execution_topic',
    '_v2_contains_any',
    '_get_experience_level_corporate',
    '_get_experience_level_student',
    # Judge0 utilities
    'is_judge0_supported',
    'contains_unsupported_framework',
    'filter_topics_with_coding_unsupported',
    # Constants
    'V2_WEB_KEYWORDS',
    # Legacy compatibility (for backward compatibility)
    'determine_topic_coding_support',
    'generate_questions_for_topic_safe',
    'generate_topics_from_input',
    'generate_topics_from_skill',
    'generate_topics_from_selected_skills',
    'generate_topic_cards_from_job_designation',
    'get_question_type_for_topic',
    'get_relevant_question_types',
    'get_relevant_question_types_from_domain',
    'infer_language_from_skill',
    'suggest_time_and_score',
]


