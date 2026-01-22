"""
Legacy Compatibility Module

This module provides compatibility functions for legacy endpoints.
These functions are re-exported from the old services.py file to maintain
backward compatibility while migrating to the new services package.

TODO: These functions should eventually be fully migrated to the new architecture.
"""
from __future__ import annotations

import importlib.util
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Import from legacy services.py file
_services_file = Path(__file__).parent.parent / "services.py"
if _services_file.exists():
    spec = importlib.util.spec_from_file_location(
        "app.api.v1.assessments.services_legacy",
        _services_file,
        submodule_search_locations=[str(_services_file.parent)]
    )
    legacy_services = importlib.util.module_from_spec(spec)
    legacy_services.__package__ = "app.api.v1.assessments"
    legacy_services.__name__ = "app.api.v1.assessments.services_legacy"
    spec.loader.exec_module(legacy_services)
    
    # Re-export legacy functions
    determine_topic_coding_support = legacy_services.determine_topic_coding_support
    generate_questions_for_topic_safe = legacy_services.generate_questions_for_topic_safe
    generate_topics_from_input = legacy_services.generate_topics_from_input
    generate_topics_from_skill = legacy_services.generate_topics_from_skill
    generate_topics_from_selected_skills = legacy_services.generate_topics_from_selected_skills
    generate_topic_cards_from_job_designation = legacy_services.generate_topic_cards_from_job_designation
    get_question_type_for_topic = legacy_services.get_question_type_for_topic
    get_relevant_question_types = legacy_services.get_relevant_question_types
    get_relevant_question_types_from_domain = legacy_services.get_relevant_question_types_from_domain
    infer_language_from_skill = legacy_services.infer_language_from_skill
    suggest_time_and_score = legacy_services.suggest_time_and_score
else:
    raise ImportError(f"Could not find services.py at {_services_file}")

__all__ = [
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
