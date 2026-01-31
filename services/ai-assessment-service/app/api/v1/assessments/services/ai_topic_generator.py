"""
Module: ai_topic_generator.py
Purpose: Topic generation functions

This module generates assessment topics using OpenAI. It handles:
- Basic topic generation (generate_topics_v2)
- Unified topic generation from multiple skill sources (generate_topics_unified)
- Topic generation from CSV requirements (generate_topics_from_requirements_v2)
- Topic improvement (improve_topic)

Dependencies:
- External: openai (for topic generation)
- Internal: ai_utils (for OpenAI client, JSON parsing, classifiers)
- Internal: judge0_utils (for framework checks)
- Internal: ai_topic_helpers (for post-processing)
- Internal: prompt_templates (for constants)

Example usage:
    ```python
    from app.api.v1.assessments.services.ai_topic_generator import generate_topics_v2
    
    topics = await generate_topics_v2(
        assessment_title="Python Developer Assessment",
        job_designation="Python Developer",
        selected_skills=["Python", "Django", "PostgreSQL"],
        experience_min=2,
        experience_max=5,
        experience_mode="corporate"
    )
    ```

Note: This module uses helper functions from ai_topic_helpers.py for post-processing.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from .ai_utils import _get_experience_level_corporate, _get_experience_level_student
from .ai_utils import _get_openai_client, _parse_json_response, _v2_contains_any, _v2_is_aiml_execution_topic, _v2_is_sql_execution_topic
from .ai_topic_helpers import (
    _ensure_all_question_types_present,
    filter_topics_with_coding_unsupported,
)
from .judge0_utils import contains_unsupported_framework, is_judge0_supported
from .prompt_templates import V2_WEB_KEYWORDS, CODING_LANGUAGES, JUDGE0_SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)


# ============================================================================
# CONSTANTS FOR NON-TECH ROLE DETECTION
# ============================================================================

NON_TECH_ROLES = [
    # Management & Leadership (pure non-tech)
    "project manager", "product manager", "program manager", "manager",
    "scrum master", "agile coach", "delivery manager",
    
    # Business & Operations
    "business analyst", "business development", "operations", "consultant",
    "strategist", "account manager", "relationship manager",
    
    # Sales & Marketing
    "sales", "marketing", "growth", "seo", "content", "copywriter",
    "brand manager", "digital marketing", "social media",
    
    # HR & Admin
    "hr", "human resources", "recruiter", "talent acquisition",
    "admin", "administrator", "office manager", "employee relations",
    
    # Finance & Legal
    "accountant", "finance", "financial analyst", "auditor",
    "legal", "compliance",
]

# Exclude these tech-management hybrids (treat as tech)
TECH_MANAGEMENT_ROLES = [
    "technical project manager", "engineering manager", "tech lead",
    "technical program manager", "devops manager", "platform manager",
    "infrastructure manager", "security manager", "data manager"
]

NON_TECH_SKILLS = [
    "communication", "leadership", "teamwork", "collaboration",
    "problem solving", "critical thinking", "time management",
    "project management", "agile", "scrum", "business analysis",
    "strategic planning", "budgeting", "market research",
    "jira", "trello", "asana", "excel", "powerpoint",
    "seo", "content strategy", "social media", "sales strategy",
    "recruitment", "onboarding", "performance management"
]


# ============================================================================
# TOPIC GENERATION HELPERS
# ============================================================================

def _is_non_tech_role(job_designation: Optional[str], skills: List[Dict[str, Any]]) -> bool:
    """
    Detect if this is a pure non-technical role.
    
    Returns:
        True if pure non-tech (NO coding/SQL/AIML allowed)
        False if tech or mixed tech role (coding allowed)
    """
    if not job_designation and not skills:
        return False
    
    # Check if it's a tech-management hybrid (treat as tech)
    if job_designation:
        job_lower = job_designation.lower()
        for tech_mgmt_role in TECH_MANAGEMENT_ROLES:
            if tech_mgmt_role in job_lower:
                logger.info(f"✅ Tech-Management role: '{job_designation}' → TECH (coding allowed)")
                return False
    
    # Check if pure non-tech role
    if job_designation:
        job_lower = job_designation.lower()
        for non_tech_role in NON_TECH_ROLES:
            if non_tech_role in job_lower:
                logger.info(f"🔒 Pure non-tech role: '{job_designation}' → NO coding")
                return True
    
    # Check skills distribution
    if skills:
        skill_names = [s.get("skill_name", "").lower() for s in skills]
        non_tech_count = 0
        tech_count = 0
        
        for skill in skill_names:
            is_tech = (
                any(lang.lower() in skill for lang in CODING_LANGUAGES) or
                "sql" in skill or "database" in skill or
                "api" in skill or "framework" in skill or
                "machine learning" in skill or "ai" in skill or
                "programming" in skill or "development" in skill
            )
            
            is_non_tech = any(nt_skill in skill for nt_skill in NON_TECH_SKILLS)
            
            if is_tech:
                tech_count += 1
            if is_non_tech:
                non_tech_count += 1
        
        total_classified = tech_count + non_tech_count
        if total_classified > 0:
            non_tech_percentage = (non_tech_count / total_classified) * 100
            if non_tech_percentage > 70:
                logger.info(f"🔒 Non-tech role: {non_tech_percentage:.1f}% non-tech skills")
                return True
    
    logger.info(f"✅ Tech role detected (coding allowed)")
    return False


def _enforce_balanced_distribution(
    topics: List[Dict[str, Any]],
    is_non_tech: bool = False,
    has_coding_skills: bool = False,
    has_sql_skills: bool = False,
    has_aiml_skills: bool = False
) -> List[Dict[str, Any]]:
    """
    Enforce balanced distribution - PREVENTS MCQ DOMINANCE.
    
    CRITICAL RULES:
    1. Coding/SQL/AIML topics are PROTECTED (never converted)
    2. Convert excess MCQ to Subjective/PseudoCode
    3. Ensure minimum execution types if skills present
    
    Args:
        topics: List of topic dictionaries
        is_non_tech: Whether this is a non-tech role
        has_coding_skills: Whether programming skills are present
        has_sql_skills: Whether database skills are present
        has_aiml_skills: Whether ML skills are present
    
    Returns:
        List of topics with balanced distribution
    """
    if not topics:
        return topics
    
    # Count current distribution
    type_counts = {"MCQ": 0, "Subjective": 0, "PseudoCode": 0, "Coding": 0, "SQL": 0, "AIML": 0}
    
    for topic in topics:
        is_v2 = "questionRows" in topic and isinstance(topic.get("questionRows"), list) and len(topic["questionRows"]) > 0
        qt = topic["questionRows"][0].get("questionType", "MCQ") if is_v2 else topic.get("questionType", "MCQ")
        type_counts[qt] = type_counts.get(qt, 0) + 1
    
    total = len(topics)
    logger.info(f"📊 Current distribution: {type_counts} (total: {total})")
    
    # Define target distribution
    if is_non_tech:
        target = {"MCQ": 0.30, "Subjective": 0.45, "PseudoCode": 0.25, "Coding": 0.0, "SQL": 0.0, "AIML": 0.0}
    else:
        target = {"MCQ": 0.25, "Subjective": 0.30, "PseudoCode": 0.20, "Coding": 0.20, "SQL": 0.03, "AIML": 0.02}
    
    # Calculate target counts
    target_counts = {qt: max(1, int(total * pct)) if pct > 0 else 0 for qt, pct in target.items()}
    
    # ⭐ CRITICAL: Ensure minimums for execution types
    if has_coding_skills and not is_non_tech:
        target_counts["Coding"] = max(target_counts["Coding"], 2)  # Min 2 coding topics
    if has_sql_skills and not is_non_tech:
        target_counts["SQL"] = max(target_counts["SQL"], 1)  # Min 1 SQL topic
    if has_aiml_skills and not is_non_tech:
        target_counts["AIML"] = max(target_counts["AIML"], 1)  # Min 1 AIML topic
    
    logger.info(f"🎯 Target distribution: {target_counts}")
    
    # Calculate what needs adjustment
    needs_more = {}
    has_excess = {}
    
    for qt, target_count in target_counts.items():
        current = type_counts.get(qt, 0)
        diff = target_count - current
        
        if diff > 0:
            needs_more[qt] = diff
        elif diff < 0 and qt in ["MCQ", "Subjective", "PseudoCode"]:  # Only these can be reduced
            has_excess[qt] = abs(diff)
    
    if not needs_more and not has_excess:
        logger.info("✅ Distribution already balanced!")
        return topics
    
    logger.info(f"⚙️ Needs more: {needs_more}, Has excess: {has_excess}")
    
    # Convert excess topics to needed types
    converted = 0
    for from_type, excess_count in has_excess.items():
        if excess_count <= 0:
            continue
        
        for topic in topics:
            if not needs_more:  # All needs satisfied
                break
            
            is_v2 = "questionRows" in topic and isinstance(topic.get("questionRows"), list) and len(topic["questionRows"]) > 0
            qt = topic["questionRows"][0].get("questionType", "") if is_v2 else topic.get("questionType", "")
            
            if qt != from_type:
                continue
            
            # ⭐ NEVER convert Coding/SQL/AIML (protected types)
            if qt in ["Coding", "SQL", "AIML"]:
                continue
            
            # Find best target type based on topic content
            label = topic.get("label", "").lower()
            
            subjective_kw = ["explain", "describe", "discuss", "analyze", "compare", "scenario", "case study"]
            pseudocode_kw = ["algorithm", "logic", "flow", "steps", "procedure", "process"]
            
            has_subjective = any(kw in label for kw in subjective_kw)
            has_pseudocode = any(kw in label for kw in pseudocode_kw)
            
            # Determine target type
            target_type = None
            if "Subjective" in needs_more and has_subjective:
                target_type = "Subjective"
            elif "PseudoCode" in needs_more and has_pseudocode:
                target_type = "PseudoCode"
            elif "Subjective" in needs_more:
                target_type = "Subjective"
            elif "PseudoCode" in needs_more:
                target_type = "PseudoCode"
            elif "MCQ" in needs_more:
                target_type = "MCQ"
            
            if not target_type:
                continue
            
            # Convert topic
            logger.info(f"🔄 Balancing: '{topic['label']}': {qt} → {target_type}")
            
            if is_v2:
                topic["questionRows"][0]["questionType"] = target_type
            else:
                topic["questionType"] = target_type
            
            needs_more[target_type] -= 1
            if needs_more[target_type] <= 0:
                del needs_more[target_type]
            
            converted += 1
    
    if converted > 0:
        logger.info(f"✅ Balanced distribution: converted {converted} topics")
    
    return topics

def _validate_and_fix_question_types(
    topics: List[Dict[str, Any]], 
    skills: List[Dict[str, Any]],
    is_non_tech: bool = False,
    respect_user_choice: bool = False  # ⭐ NEW: If True, don't change already-set question types
) -> List[Dict[str, Any]]:
    """
    4-PHASE VALIDATION PIPELINE with execution-type priority.
    
    PHASE 1: CODING DETECTION (if programming language present, MIN 2 topics)
    PHASE 2: SQL DETECTION (if database skills present, MIN 1 topic)
    PHASE 3: AIML DETECTION (if Python + ML present, MIN 1 topic, STRICT Python-only)
    PHASE 4: ENFORCE MINIMUMS for execution types
    
    ⭐ CRITICAL: For non-tech roles, convert ALL Coding/SQL/AIML to Subjective
    
    Args:
        topics: List of topic dictionaries
        skills: List of skill dictionaries with skill_name
        is_non_tech: Whether this is a non-tech role
    
    Returns:
        List of topics with corrected question types
    """
    from .ai_utils import _v2_is_sql_topic
    
    # ⭐ NON-TECH ROLE: Block all technical execution types
    if is_non_tech:
        logger.info("🔒 NON-TECH ROLE: Blocking all Coding/SQL/AIML questions...")
        
        for topic in topics:
            is_v2 = "questionRows" in topic and isinstance(topic.get("questionRows"), list) and len(topic["questionRows"]) > 0
            
            # ⭐ Respect user edits even for non-tech roles (but still block execution types)
            if is_v2 and topic["questionRows"][0].get("userEdited", False):
                qt = topic["questionRows"][0].get("questionType", "")
                # Only override if it's an execution type
                if qt in ["Coding", "SQL", "AIML"]:
                    logger.warning(f"🔧 Non-tech (userEdited): '{topic['label']}': {qt} → Subjective")
                    topic["questionRows"][0]["questionType"] = "Subjective"
                    topic["questionRows"][0]["canUseJudge0"] = False
                else:
                    logger.info(f"✅ Respecting user choice in non-tech role: '{topic['label']}' = {qt}")
                continue
            
            qt = topic["questionRows"][0].get("questionType", "") if is_v2 else topic.get("questionType", "")
            
            if qt in ["Coding", "SQL", "AIML"]:
                logger.warning(f"🔧 Non-tech: '{topic['label']}': {qt} → Subjective")
                if is_v2:
                    topic["questionRows"][0]["questionType"] = "Subjective"
                    topic["questionRows"][0]["canUseJudge0"] = False
                else:
                    topic["questionType"] = "Subjective"
                    topic["canUseJudge0"] = False
        
        return topics
    
    # ⭐ TECH ROLE: Apply full 4-phase validation
    skill_names = [s.get("skill_name", "").lower() for s in skills]
    
    # Detect programming languages
    coding_skills = []
    for skill in skill_names:
        for lang in CODING_LANGUAGES:
            if lang.lower() == "c":
                if skill.strip() == "c" or skill.strip().startswith("c "):
                    is_framework, _ = contains_unsupported_framework(skill)
                    if not is_framework:
                        coding_skills.append(lang)
                        break
            else:
                if lang.lower() in skill or skill.strip() == lang.lower():
                    is_framework, _ = contains_unsupported_framework(skill)
                    if not is_framework:
                        coding_skills.append(lang)
                        break
    
    logger.info(f"🔍 PHASE 1: Detected {len(coding_skills)} programming languages: {coding_skills}")
    
    # ⭐ CRITICAL: Only STRONG implementation keywords should trigger conversion
    # Weak keywords like "implementing" in topic names (e.g., "Implementing Concurrency") 
    # should NOT automatically convert MCQ topics to Coding
    IMPLEMENTATION_KW = [
        "write code", "write a", "implement a", "create a", "build a", "develop a",
        "algorithm", "data structure", "function", "method", "class",
        "array", "list", "tree", "graph", "stack", "queue", "hash",
        "sorting", "searching", "recursion", "loop", "binary"
    ]
    
    # Weak keywords that appear in topic names but don't necessarily mean coding
    WEAK_IMPLEMENTATION_KW = [
        "implementing", "designing", "creating", "building", "developing"
    ]
    
    THEORY_KW = ["overview", "introduction", "history", "comparison", "vs", "versus", "advantages"]
    
    # PHASE 1: CODING DETECTION
    # ⭐ CRITICAL: Only convert to Coding if topic has implementation keywords
    # DO NOT convert MCQ/Subjective topics that are just about concepts/theory
    # DO NOT convert AIML topics (they will be handled in Phase 3)
    AIML_KW_PHASE1 = [
        "machine learning", "deep learning", "neural network", "model training",
        "tensorflow", "pytorch", "keras", "scikit", "pandas", "numpy",
        "computer vision", "nlp", "classification", "regression", "data science"
    ]
    
    for topic in topics:
        label = topic.get("label", "")
        label_lower = label.lower()
        
        is_v2 = "questionRows" in topic and isinstance(topic.get("questionRows"), list) and len(topic["questionRows"]) > 0
        current_type = topic["questionRows"][0].get("questionType", "") if is_v2 else topic.get("questionType", "")
        
        # ⭐ CRITICAL: If respect_user_choice is True and question type is already set, skip validation
        if respect_user_choice and current_type and current_type not in ["", "pending"]:
            logger.info(f"✅ PHASE 1: Skipping '{label}' - user has explicitly set question type to {current_type}")
            continue
        
        if current_type == "Coding":
            continue
        
        # ⭐ CRITICAL: Skip AIML topics in Phase 1 - they will be handled in Phase 3
        # Don't convert "Pandas", "Machine Learning", etc. to Coding
        has_aiml_kw = any(kw in label_lower for kw in AIML_KW_PHASE1)
        if has_aiml_kw:
            # Check if non-Python language is mentioned (if so, might be Coding, not AIML)
            mentions_non_python = False
            for lang in CODING_LANGUAGES:
                if lang.lower() == "python":
                    continue
                pattern = r'\b' + re.escape(lang.lower()) + r'\b'
                if re.search(pattern, label_lower):
                    mentions_non_python = True
                    break
            
            # If no non-Python language mentioned, skip Phase 1 (let Phase 3 handle it)
            if not mentions_non_python:
                logger.info(f"✅ PHASE 1: Skipping '{label}' (AIML topic, will be handled in Phase 3)")
                continue
        
        # ⭐ CRITICAL FIX: Don't convert MCQ/Subjective topics unless they have STRONG implementation keywords
        # Topics like "JavaScript Closure and Scope" (MCQ) should stay MCQ
        # Topics like "Implementing Concurrency in Python" (MCQ) should stay MCQ (weak keyword)
        # Only convert if topic explicitly mentions STRONG implementation intent (write code, algorithm, etc.)
        if current_type in ["MCQ", "Subjective"]:
            # Check if topic has STRONG implementation keywords - weak keywords don't count
            has_strong_impl = any(kw in label_lower for kw in IMPLEMENTATION_KW)
            has_weak_impl_only = any(kw in label_lower for kw in WEAK_IMPLEMENTATION_KW) and not has_strong_impl
            
            if has_weak_impl_only:
                # Topic has weak keywords like "Implementing" or "Designing" but no strong implementation intent
                # Keep it as MCQ/Subjective - these are often conceptual topics
                logger.info(f"✅ PHASE 1: Keeping '{label}' as {current_type} (weak implementation keyword only, likely conceptual)")
                continue
            
            if not has_strong_impl:
                # This is a theory/concept topic - keep it as MCQ/Subjective
                logger.info(f"✅ PHASE 1: Keeping '{label}' as {current_type} (theory/concept, no strong implementation keywords)")
                continue
        
        should_be_coding = False
        detected_lang = None
        
        for lang in CODING_LANGUAGES:
            pattern = None
            matches = False
            
            if lang.lower() == "c":
                # Special handling for "C" to avoid matching "C++" or "C#"
                pattern = r'\bc\b(?![\+\#\w])'
                if re.search(pattern, label_lower):
                    # Additional check: must be "C programming", "C language", or start with "C "
                    c_context = r'\bc\s+(programming|language|code)'
                    if re.search(c_context, label_lower) or re.search(r'^c\s+', label_lower):
                        matches = True
            else:
                pattern = r'\b' + re.escape(lang.lower()) + r'\b'
                if re.search(pattern, label_lower):
                    matches = True
            
            if matches:
                is_theory = any(kw in label_lower for kw in THEORY_KW)
                if is_theory:
                    # Theory topics should NOT be converted to Coding
                    break
                
                # Check if this language is in any of the coding skills
                lang_in_skills = any(lang.lower() in skill for skill in coding_skills)
                
                # ⭐ CRITICAL: Only convert if topic has STRONG implementation keywords
                # Just mentioning a language (e.g., "JavaScript Closure") is NOT enough
                # Weak keywords like "Implementing" or "Designing" don't count
                has_strong_impl = any(kw in label_lower for kw in IMPLEMENTATION_KW)
                has_weak_impl_only = any(kw in label_lower for kw in WEAK_IMPLEMENTATION_KW) and not has_strong_impl
                
                if has_strong_impl and not has_weak_impl_only:
                    # Topic mentions implementation - convert to Coding
                    is_framework, _ = contains_unsupported_framework(label_lower)
                    if not is_framework:
                        should_be_coding = True
                        detected_lang = lang
                        break
                elif lang_in_skills and current_type in ["PseudoCode", ""]:
                    # Only convert PseudoCode or unset types if language is in skills
                    # Don't convert MCQ/Subjective unless they have implementation keywords
                    is_framework, _ = contains_unsupported_framework(label_lower)
                    if not is_framework:
                        should_be_coding = True
                        detected_lang = lang
                        break
        
        if should_be_coding:
            logger.warning(f"🔧 PHASE 1: '{label}': {current_type} → Coding ({detected_lang})")
            if is_v2:
                topic["questionRows"][0]["questionType"] = "Coding"
                topic["questionRows"][0]["canUseJudge0"] = True
            else:
                topic["questionType"] = "Coding"
                topic["canUseJudge0"] = True
    
    # PHASE 2: SQL DETECTION
    logger.info("🔍 PHASE 2: SQL detection...")
    for topic in topics:
        label_lower = topic.get("label", "").lower()
        is_v2 = "questionRows" in topic and isinstance(topic.get("questionRows"), list) and len(topic["questionRows"]) > 0
        current_type = topic["questionRows"][0].get("questionType", "") if is_v2 else topic.get("questionType", "")
        
        # ⭐ CRITICAL: If respect_user_choice is True and question type is already set, skip validation
        if respect_user_choice and current_type and current_type not in ["", "pending"]:
            continue
        
        if current_type in ["Coding", "SQL"]:
            continue
        
        if _v2_is_sql_topic(label_lower):
            logger.warning(f"🔧 PHASE 2: '{topic['label']}': {current_type} → SQL")
            if is_v2:
                topic["questionRows"][0]["questionType"] = "SQL"
            else:
                topic["questionType"] = "SQL"
    
    # PHASE 3: AIML DETECTION (STRICT - Python + ML only)
    logger.info("🔍 PHASE 3: AIML detection (strict Python + ML only)...")
    
    AIML_KW = [
        "machine learning", "deep learning", "neural network", "model training",
        "tensorflow", "pytorch", "keras", "scikit", "pandas", "numpy",
        "computer vision", "nlp", "classification", "regression"
    ]
    
    for topic in topics:
        label = topic.get("label", "")
        label_lower = label.lower()
        
        is_v2 = "questionRows" in topic and isinstance(topic.get("questionRows"), list) and len(topic["questionRows"]) > 0
        current_type = topic["questionRows"][0].get("questionType", "") if is_v2 else topic.get("questionType", "")
        
        # ⭐ CRITICAL: Skip validation if user explicitly edited the question type
        if is_v2 and topic["questionRows"][0].get("userEdited", False):
            logger.info(f"✅ Respecting user choice: '{label}' = {current_type} (userEdited=True)")
            continue
        
        # ⭐ CRITICAL: If respect_user_choice is True and question type is already set, skip validation
        if respect_user_choice and current_type and current_type not in ["", "pending"]:
            logger.info(f"✅ Preserving existing type: '{label}' = {current_type}")
            continue
        
        # ⭐ CRITICAL FIX: Check for non-Python languages first
        mentions_non_python = False
        for lang in CODING_LANGUAGES:
            if lang.lower() == "python":
                continue
            pattern = r'\b' + re.escape(lang.lower()) + r'\b'
            if re.search(pattern, label_lower):
                mentions_non_python = True
                
                if current_type == "AIML":
                    logger.warning(f"🔧 PHASE 3: '{label}': AIML → Coding ({lang} detected, not Python)")
                    if is_v2:
                        topic["questionRows"][0]["questionType"] = "Coding"
                        topic["questionRows"][0]["canUseJudge0"] = True
                    else:
                        topic["questionType"] = "Coding"
                        topic["canUseJudge0"] = True
                break
        
        if mentions_non_python or current_type in ["Coding", "SQL"]:
            continue
        
        # Check for Python + ML keywords
        # ⭐ CRITICAL: AIML topics don't need to explicitly mention "Python" in the label
        # If topic has AIML keywords and no non-Python language is mentioned, it's AIML
        # Examples: "Pandas", "Machine Learning", "TensorFlow" → AIML (assuming Python in skills)
        has_python_in_label = "python" in label_lower
        has_aiml_kw = any(kw in label_lower for kw in AIML_KW)
        
        # Check if Python is in the skills (even if not in label)
        has_python_in_skills = any("python" in skill.lower() for skill in skill_names)
        
        # Convert to AIML if:
        # 1. Has AIML keywords AND
        # 2. (Python is in label OR Python is in skills OR no coding language mentioned) AND
        # 3. No non-Python language mentioned (already checked above)
        if has_aiml_kw and (has_python_in_label or has_python_in_skills or not any(lang.lower() in label_lower for lang in CODING_LANGUAGES)):
            if current_type != "AIML":
                logger.warning(f"🔧 PHASE 3: '{label}': {current_type} → AIML (AIML keywords detected, Python in skills: {has_python_in_skills})")
                if is_v2:
                    topic["questionRows"][0]["questionType"] = "AIML"
                else:
                    topic["questionType"] = "AIML"
    
    # PHASE 4: ENFORCE MINIMUMS
    logger.info("🔍 PHASE 4: Enforcing minimums for execution types...")
    
    # Count current execution types
    coding_count = sum(1 for t in topics if (
        (t.get("questionRows") and t["questionRows"][0].get("questionType") == "Coding") or
        t.get("questionType") == "Coding"
    ))
    
    # ⭐ Enforce minimum coding topics if programming skills present
    if len(coding_skills) > 0:
        min_required = 2  # ⭐ MINIMUM 2 coding topics
        
        if coding_count < min_required:
            shortage = min_required - coding_count
            logger.warning(f"⚠️ PHASE 4: Only {coding_count} Coding, need {min_required}. Converting {shortage}...")
            
            converted = 0
            for topic in topics:
                if converted >= shortage:
                    break
                
                is_v2 = "questionRows" in topic and isinstance(topic.get("questionRows"), list) and len(topic["questionRows"]) > 0
                qt = topic["questionRows"][0].get("questionType", "") if is_v2 else topic.get("questionType", "")
                
                # ⭐ CRITICAL: If respect_user_choice is True, don't force-convert user-set question types
                if respect_user_choice and qt and qt not in ["", "pending"]:
                    continue
                
                if qt not in ["MCQ", "Subjective", "PseudoCode"]:
                    continue
                
                label_lower = topic["label"].lower()
                is_framework, _ = contains_unsupported_framework(label_lower)
                if is_framework:
                    continue
                
                # ⭐ CRITICAL: Only convert MCQ/Subjective if they have STRONG implementation keywords
                # Don't convert theory/concept topics (e.g., "JavaScript Closure and Scope")
                # Don't convert topics with only weak keywords (e.g., "Implementing Concurrency")
                if qt in ["MCQ", "Subjective"]:
                    has_strong_impl = any(kw in label_lower for kw in IMPLEMENTATION_KW)
                    has_weak_impl_only = any(kw in label_lower for kw in WEAK_IMPLEMENTATION_KW) and not has_strong_impl
                    
                    if has_weak_impl_only:
                        # Topic has weak keywords but no strong implementation intent - skip conversion
                        logger.info(f"✅ PHASE 4: Skipping '{topic['label']}' - weak implementation keyword only")
                        continue
                    
                    if not has_strong_impl:
                        # This is a theory/concept topic - skip conversion
                        continue
                
                is_suitable = False
                for lang in CODING_LANGUAGES:
                    pattern = r'\b' + re.escape(lang.lower()) + r'\b'
                    if re.search(pattern, label_lower):
                        is_theory = any(kw in label_lower for kw in THEORY_KW)
                        if not is_theory:
                            is_suitable = True
                            break
                
                # Check for STRONG implementation keywords only
                if not is_suitable:
                    has_strong_impl = any(kw in label_lower for kw in IMPLEMENTATION_KW)
                    has_weak_impl_only = any(kw in label_lower for kw in WEAK_IMPLEMENTATION_KW) and not has_strong_impl
                    if has_strong_impl and not has_weak_impl_only:
                        is_suitable = True
                
                if is_suitable:
                    logger.warning(f"🔧 PHASE 4: Force-converting '{topic['label']}': {qt} → Coding")
                    if is_v2:
                        topic["questionRows"][0]["questionType"] = "Coding"
                        topic["questionRows"][0]["canUseJudge0"] = True
                    else:
                        topic["questionType"] = "Coding"
                        topic["canUseJudge0"] = True
                    converted += 1
            
            logger.info(f"✅ PHASE 4: Converted {converted}, total Coding now: {coding_count + converted}")
    
    return topics


# ============================================================================
# TOPIC GENERATION
# ============================================================================

async def generate_topics_v2(
    assessment_title: Optional[str],
    job_designation: str,
    selected_skills: List[str],
    experience_min: int,
    experience_max: int,
    experience_mode: str,
    previous_topic_label: Optional[str] = None  # ⭐ NEW - For regeneration (avoid repeating)
) -> List[Dict[str, Any]]:
    """
    Generate topics using OpenAI with multi-row data model.
    
    Returns list of topics following exact structure:
    {
        "id": str,
        "label": str,
        "locked": False,
        "questionRows": [
            {
                "rowId": str,
                "questionType": "MCQ" | "Subjective" | "PseudoCode" | "Coding",
                "difficulty": "Easy" | "Medium" | "Hard",
                "questionsCount": int,
                "canUseJudge0": bool,
                "status": "pending",
                "locked": False,
                "questions": []
            }
        ]
    }
    Each topic starts with ONE auto-generated questionRow.
    
    Args:
        assessment_title: Optional assessment title
        job_designation: Job role/designation
        selected_skills: List of selected skills
        experience_min: Minimum experience years
        experience_max: Maximum experience years
        experience_mode: Experience mode (corporate/college)
        
    Returns:
        List of topic dictionaries
        
    Raises:
        HTTPException: If topic generation fails
    """
    # TODO: Move implementation from topic_service_v2.py line 943
    pass


async def generate_topics_unified(
    assessment_title: Optional[str],
    job_designation: Optional[str],
    combined_skills: List[Dict[str, Any]],
    experience_min: int,
    experience_max: int,
    experience_mode: str,
    previous_topic_label: Optional[str] = None  # ⭐ NEW - For regeneration (avoid repeating)
) -> List[Dict[str, Any]]:
    """
    Generate topics from combined skills from multiple sources (role-based, manual, CSV).
    ALL skills from all sources are combined with EQUAL PRIORITY and generate 8-12 topics total.
    Distribution is based on role and skills - ensures all skills are covered.
    
    Args:
        assessment_title: Optional assessment title
        job_designation: Optional job designation
        combined_skills: List of skill dictionaries with metadata (skill_name, description, importance_level, source)
        experience_min: Minimum experience years
        experience_max: Maximum experience years
        experience_mode: Experience mode (corporate/college)
        
    Returns:
        List of topic dictionaries (8-12 topics)
        
    Raises:
        HTTPException: If topic generation fails
    """
    if not combined_skills:
        raise HTTPException(status_code=400, detail="At least one skill must be provided")
    
    # ⭐ STEP 1: Detect non-tech role
    is_non_tech = _is_non_tech_role(job_designation, combined_skills)
    
    if is_non_tech:
        logger.info("=" * 80)
        logger.info("🔒 NON-TECH ROLE DETECTED - NO Coding/SQL/AIML")
        logger.info("=" * 80)
    
    # Extract skill names and create context from metadata
    skill_names = [skill.get("skill_name") for skill in combined_skills if skill.get("skill_name")]
    skills_list = ", ".join(skill_names)
    
    # Build enhanced context from skill metadata
    skill_details = []
    for skill in combined_skills:
        skill_name = skill.get("skill_name", "")
        description = skill.get("description")
        importance = skill.get("importance_level")
        source = skill.get("source", "")
        
        detail = f"- {skill_name}"
        if importance:
            detail += f" (Priority: {importance})"
        if description:
            detail += f": {description}"
        skill_details.append(detail)
    
    skill_context = "\n".join(skill_details)
    
    # Get experience level context based on mode
    if experience_mode == "corporate":
        exp_level, _ = _get_experience_level_corporate(experience_min, experience_max)
        exp_range_text = f"{experience_min}-{experience_max} years"
        mode_context = "professional/corporate candidates with industry experience"
    else:  # student
        exp_level, _ = _get_experience_level_student(experience_min, experience_max)
        exp_range_text = f"{exp_level} level"
        mode_context = "college students with academic experience"
    
    # Build title context
    title_context = f"\nAssessment Title: {assessment_title}" if assessment_title else ""
    job_context = f"\nJob Role: {job_designation}" if job_designation else ""
    
    # ⭐ STEP 2: Detect skill types for distribution
    skill_names_lower = [s.lower() for s in skill_names]
    
    # Detect programming language skills for Coding questions
    coding_skills = []
    for skill in skill_names_lower:
        skill_clean = skill.strip()
        for lang in CODING_LANGUAGES:
            if lang.lower() == "c":
                if skill_clean == "c" or skill_clean.startswith("c "):
                    is_framework, _ = contains_unsupported_framework(skill_clean)
                    if not is_framework:
                        coding_skills.append(skill)
                        break
            else:
                if lang.lower() in skill_clean or skill_clean == lang.lower():
                    is_framework, _ = contains_unsupported_framework(skill_clean)
                    if not is_framework:
                        coding_skills.append(skill)
                        break
    
    has_coding_skills = len(coding_skills) > 0 and not is_non_tech
    
    # Detect SQL skills
    has_sql_skills = any(
        keyword in skill_str
        for skill_str in skill_names_lower
        for keyword in ["sql", "database", "postgresql", "mysql", "mongodb", "query", "rdbms"]
    ) and not is_non_tech
    
    # Detect AIML skills (Python + ML only)
    has_aiml_skills = any(
        keyword in skill_str
        for skill_str in skill_names_lower
        for keyword in ["machine learning", "deep learning", "ai", "ml", "neural", 
                       "data science", "tensorflow", "pytorch", "model", "computer vision",
                       "nlp", "scikit", "keras", "artificial intelligence"]
    ) and any("python" in skill_str for skill_str in skill_names_lower) and not is_non_tech
    
    logger.info(f"📊 Skills: Coding={has_coding_skills}, SQL={has_sql_skills}, AIML={has_aiml_skills}")
    
    # Build question type guidance with distribution requirements
    if is_non_tech:
        question_type_guidance = f"""
🔒 NON-TECH ROLE - STRICTLY FORBIDDEN: Coding, SQL, AIML questions

**Available Question Types**: MCQ, Subjective, PseudoCode ONLY

TARGET DISTRIBUTION:
- 30% MCQ (concepts, theory, quick checks)
- 45% Subjective (explanations, scenarios, case studies, problem-solving)
- 25% PseudoCode (process flows, logical thinking, procedures)

❌ DO NOT generate any Coding, SQL, or AIML topics
✅ Focus on business, management, communication, and analytical skills
"""
    else:
        question_type_guidance = f"""
CRITICAL QUESTION TYPE ASSIGNMENT RULES:

**Available Question Types**: MCQ, Subjective, PseudoCode, Coding, SQL, AIML

⭐ CRITICAL DISTRIBUTION REQUIREMENTS:

Target Distribution:
- 25% MCQ (concepts, theory, quick checks)
- 30% Subjective (explanations, scenarios, design questions)
- 20% PseudoCode (algorithm logic, process flows)
- 20% Coding (implementation - if programming language present)
- 3% SQL (if database skills present)
- 2% AIML (if Python + ML skills present)

PRIORITY ORDER: Coding/SQL/AIML > Subjective > PseudoCode > MCQ

1. **CODING Topics** - MUST use questionType: "Coding"
   - ONLY for these 10 Judge0-supported languages: Python, JavaScript, C++, Java, C, Go, Rust, C#, Kotlin, TypeScript
   - Topics about: algorithms, data structures, problem-solving (Judge0-executable)
   - Must be stdin/stdout compatible (NO frameworks, NO libraries)
   - Must NOT contain: Django, Flask, React, Angular, Spring, Rails, TensorFlow, PyTorch, Pandas, NumPy, etc.
   
   Examples of VALID Coding topics:
   ✅ "Python Sorting Algorithms" - Algorithm implementation
   ✅ "Java Data Structures (Arrays, Lists)" - Core language features
   ✅ "JavaScript Recursion and Dynamic Programming" - Problem solving
   ✅ "C++ STL Algorithms" - Standard library (Judge0 compatible)
   ✅ "Go Concurrency with Goroutines" - Core language feature
   
   Examples of INVALID Coding topics (use MCQ/Subjective instead):
   ❌ "Django REST Framework" - Web framework, not Judge0 compatible
   ❌ "React Hooks and State Management" - Frontend framework
   ❌ "TensorFlow Model Training" - ML library, use AIML type
   ❌ "Pandas Data Analysis" - Data library, use AIML type
   ❌ "Spring Boot Microservices" - Framework
   
   - Set canUseJudge0: true ONLY for Coding topics

2. **SQL Topics** - MUST use questionType: "SQL"
   - Topics about: SQL, databases, queries, joins, PostgreSQL, MySQL, MongoDB, database design, query optimization
   - Examples: "Advanced SQL Join Techniques", "Database Indexing", "Query Performance Optimization"
   - ✅ CORRECT: {{"label": "Advanced SQL Techniques", "questionType": "SQL"}}
   - ❌ WRONG: {{"label": "Advanced SQL Techniques", "questionType": "Subjective"}}

3. **AIML Topics** - MUST use questionType: "AIML"
   - Topics about: Machine Learning, Deep Learning, Neural Networks, AI, Data Science, Model Training, Computer Vision, NLP, TensorFlow, PyTorch, Scikit-learn, Model Evaluation
   - ⚠️ CRITICAL: ONLY for Python + ML libraries (TensorFlow, PyTorch, Scikit-learn, Pandas, NumPy, Keras)
   - ❌ NEVER use AIML for: Java, Kotlin, Go, C++, or other non-Python languages
   - Examples: "Model Evaluation Metrics", "Neural Network Architecture", "Feature Engineering", "Computer Vision Algorithms"
   - ✅ CORRECT: {{"label": "Model Evaluation", "questionType": "AIML"}}
   - ❌ WRONG: {{"label": "Model Evaluation", "questionType": "PseudoCode"}}

4. **Other Topics** - Use: MCQ, Subjective, PseudoCode
   - Theory, concepts, comparisons, best practices, frameworks
"""
        
        if has_coding_skills:
            coding_skills_str = ', '.join(set(coding_skills))
            question_type_guidance += f"\n🔥 **MANDATORY**: You MUST generate at least 2 CODING topics.\nProgramming languages detected: {coding_skills_str}\n"
        
        if has_sql_skills:
            question_type_guidance += "\n**YOU MUST GENERATE AT LEAST 1-2 SQL TOPICS** with questionType: \"SQL\""
        
        if has_aiml_skills:
            question_type_guidance += "\n**YOU MUST GENERATE AT LEAST 1-2 AIML TOPICS** with questionType: \"AIML\" (Python + ML only)"
    
    # ⭐ BUILD EXCLUSION CONTEXT FOR REGENERATION (HIGHEST PRIORITY)
    exclusion_context = ""
    if previous_topic_label:
        exclusion_context = f"""
{'=' * 80}
🔥 CRITICAL: TOPIC REGENERATION - AVOID REPEATING OLD TOPIC
{'=' * 80}

The user is REGENERATING a topic they found unsatisfactory.

OLD TOPIC (DO NOT REPEAT OR REUSE THIS):
\"\"\"{previous_topic_label}\"\"\"

MANDATORY REQUIREMENTS FOR NEW TOPIC:
1. MUST be COMPLETELY DIFFERENT from the old topic above
2. MUST take a DIFFERENT ANGLE on the skills/technologies
3. AVOID similar concepts, keywords, or phrasing from the old topic
4. Generate a FRESH topic that covers different aspects of the skills

Examples of Good Regeneration:
- Old: "Python List Comprehensions"
- New: "Python Generators and Iterators" ✅ (Different concept)
- New: "Python Memory Management and Garbage Collection" ✅ (Different angle)
- New: "Python Decorators and Context Managers" ✅ (Different topic)

Examples of Bad Regeneration:
- Old: "Python List Comprehensions"
- New: "Advanced Python List Comprehensions" ❌ (TOO SIMILAR!)
- New: "List Comprehensions and Lambda Functions" ❌ (Contains old topic!)

⚠️ CRITICAL: If you generate something similar to the old topic, the user will reject it!

Generate topics that are GENUINELY DIFFERENT while still being relevant to the skills provided.
{'=' * 80}
"""
    
    # Define validation message (extracted to avoid backslash in f-string expression)
    if is_non_tech:
        validation_message = "⚠️ CRITICAL: For non-tech roles, NEVER generate Coding, SQL, or AIML topics"
    else:
        validation_message = """CRITICAL VALIDATION - ONLY 10 JUDGE0-SUPPORTED LANGUAGES:
- If skill is "Python" → MUST have at least 1 topic with questionType: "Coding"
- If skill is "JavaScript" → MUST have at least 1 topic with questionType: "Coding"
- If skill is "C++" → MUST have at least 1 topic with questionType: "Coding"
- If skill is "Java" → MUST have at least 1 topic with questionType: "Coding"
- If skill is "C" → MUST have at least 1 topic with questionType: "Coding"
- If skill is "Go" → MUST have at least 1 topic with questionType: "Coding"
- If skill is "Rust" → MUST have at least 1 topic with questionType: "Coding"
- If skill is "C#" → MUST have at least 1 topic with questionType: "Coding"
- If skill is "Kotlin" → MUST have at least 1 topic with questionType: "Coding"
- If skill is "TypeScript" → MUST have at least 1 topic with questionType: "Coding"

⚠️ ANY OTHER LANGUAGE/FRAMEWORK → MCQ or Subjective (NOT Coding)
Examples: Ruby, Swift, PHP, Perl, Scala, R, Bash → MCQ/Subjective
Examples: Django, Flask, React, Angular, Spring → MCQ/Subjective"""
    
    prompt = f"""
You are an expert assessment designer creating topics for {len(combined_skills)} skills.

{exclusion_context}

ROLE TYPE: {"NON-TECH (Business/Management)" if is_non_tech else "TECH (Technical)"}
{title_context}{job_context}

- Skills/Technologies:
{skill_context}
- Experience Range: {exp_range_text}
- Experience Level: {exp_level}
- Experience Mode: {experience_mode.upper()} ({mode_context})
- Programming Languages Detected: {', '.join(set(coding_skills)) if coding_skills else 'None'}
- Has SQL Skills: {"YES - MUST include SQL topics" if has_sql_skills else "NO"}
- Has AIML Skills: {"YES - MUST include AIML topics (Python + ML only)" if has_aiml_skills else "NO"}

{'=' * 80}
{question_type_guidance}
{'=' * 80}

Generate 8-12 relevant assessment topics covering all provided skills.
Each topic should be specific, testable, and appropriate for {mode_context} at {exp_level} level.

REQUIREMENTS:
1. **STRICTLY FOLLOW QUESTION TYPE RULES AND DISTRIBUTION ABOVE** - This is CRITICAL
2. Topic distribution:
   {("- MCQ: ~30%, Subjective: ~45%, PseudoCode: ~25%" if is_non_tech else (
       "- Coding topics: MINIMUM 2 topics (for: " + (', '.join(set(coding_skills)) if coding_skills else 'N/A') + ")\n" +
       "   - SQL topics: " + str(1 if has_sql_skills else 0) + "-2 topics\n" +
       "   - AIML topics: " + str(1 if has_aiml_skills else 0) + "-2 topics (Python + ML only)\n" +
       "   - MCQ/Subjective/PseudoCode: Remaining topics (balanced distribution)"
   ))}
3. Ensure all skills are covered across the topics
4. Vary question types and difficulties
5. Set canUseJudge0 to true ONLY for Coding questions with executable languages
6. **DO NOT generate all MCQ questions** - Balance the distribution as specified above

{validation_message}

Return ONLY a JSON object with a "topics" array. Use this exact structure:
{{
  "topics": [
    {{
      "label": "Topic name",
      "questionType": "MCQ" | "Subjective" | "PseudoCode" | "Coding" | "SQL" | "AIML",
      "difficulty": "Easy" | "Medium" | "Hard",
      "canUseJudge0": true | false
    }}
  ]
}}
"""

    client = _get_openai_client()
    try:
        response = await client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
    except Exception as exc:
        logger.error(f"OpenAI API error in generate_topics_unified: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate topics") from exc

    # Parse response
    content = response.choices[0].message.content.strip() if response.choices else ""
    topics_data = _parse_json_response(content)
    
    # Handle multiple response formats
    if isinstance(topics_data, dict) and "topics" in topics_data:
        # Expected format: {"topics": [...]}
        topics_list = topics_data["topics"]
    elif isinstance(topics_data, list):
        # Array format: [...]
        topics_list = topics_data
    elif isinstance(topics_data, dict) and "label" in topics_data:
        # Single topic object: {...} - wrap it in a list
        logger.warning(f"Received single topic object instead of array, wrapping it: {topics_data}")
        topics_list = [topics_data]
    else:
        logger.error(f"Unexpected response format: {topics_data}")
        raise HTTPException(status_code=500, detail="Invalid response format from AI")
    
    # Convert to v2 data model structure
    result_topics = []
    for topic in topics_list:
        if not isinstance(topic, dict) or "label" not in topic:
            continue
            
        label = topic.get("label", "").strip()
        question_type = topic.get("questionType", "MCQ")
        difficulty = topic.get("difficulty", "Medium")
        can_use_judge0 = topic.get("canUseJudge0", False)
        
        # Auto-correct question type based on topic content (CRITICAL FIX)
        label_lower = label.lower()
        
        # Check if topic should be SQL
        if _v2_is_sql_execution_topic(label_lower):
            if question_type != "SQL":
                logger.warning(f"Auto-correcting topic '{label}': {question_type} → SQL")
                question_type = "SQL"
        
        # Check if topic should be AIML
        elif _v2_is_aiml_execution_topic(label_lower):
            if question_type != "AIML":
                logger.warning(f"Auto-correcting topic '{label}': {question_type} → AIML")
                question_type = "AIML"
        
        # Validate and sanitize
        if question_type not in ["MCQ", "Subjective", "PseudoCode", "Coding", "SQL", "AIML"]:
            question_type = "MCQ"
        if difficulty not in ["Easy", "Medium", "Hard"]:
            difficulty = "Medium"
        
        # Additional validation: canUseJudge0 should only be true for Coding
        if question_type != "Coding":
            can_use_judge0 = False
        
        # Check if topic contains unsupported frameworks
        is_framework, _ = contains_unsupported_framework(label)
        if question_type == "Coding" and is_framework:
            can_use_judge0 = False
        
        # Determine default questionsCount based on question type
        # ⭐ ALL question types default to 1 - user can increase if needed
        default_count = 1  # Default to 1 for all question types
        
        # Create topic with v2 data model structure
        # ⭐ Set category: "technical" for all topics generated from skills (default)
        topic_dict = {
            "id": str(uuid.uuid4()),
            "label": label,
            "category": "technical",  # ⭐ CRITICAL: Set category for frontend
            "locked": False,
            "questionRows": [
                {
                    "rowId": str(uuid.uuid4()),
                    "questionType": question_type,
                    "difficulty": difficulty,
                    "questionsCount": default_count,
                    "canUseJudge0": can_use_judge0 if question_type == "Coding" else False,
                    "status": "pending",
                    "locked": False,
                    "questions": []
                }
            ]
        }
        result_topics.append(topic_dict)
    
    if not result_topics:
        raise HTTPException(status_code=500, detail="No valid topics generated")
    
    # Filter out topics with unsupported coding frameworks
    result_topics = filter_topics_with_coding_unsupported(result_topics)
    
    # ⭐ STEP 3: Validate and fix question types (4-phase validation with execution-type priority)
    result_topics = _validate_and_fix_question_types(result_topics, combined_skills, is_non_tech=is_non_tech)
    
    # ⭐ STEP 4: Enforce balanced distribution (prevent MCQ dominance)
    result_topics = _enforce_balanced_distribution(
        result_topics,
        is_non_tech=is_non_tech,
        has_coding_skills=has_coding_skills,
        has_sql_skills=has_sql_skills,
        has_aiml_skills=has_aiml_skills
    )
    
    # Ensure all question types are present
    result_topics = await _ensure_all_question_types_present(result_topics)
    
    logger.info(f"Generated {len(result_topics)} topics from {len(combined_skills)} combined skills")
    return result_topics


async def generate_topics_from_requirements_v2(
    requirements: List[Dict[str, Any]],
    experience_min: int,
    experience_max: int,
    experience_mode: str
) -> List[Dict[str, Any]]:
    """
    Generate topics from CSV requirements.
    
    Args:
        requirements: List of requirement dictionaries (skill_name, skill_description, importance_level)
        experience_min: Minimum experience years
        experience_max: Maximum experience years
        experience_mode: Experience mode (corporate/college)
        
    Returns:
        List of topic dictionaries
        
    Raises:
        HTTPException: If topic generation fails
    """
    # TODO: Move implementation from topic_service_v2.py line 3012
    pass


async def improve_topic(
    previous_topic_label: str,
    skill_context: Optional[str] = None,
    skill_description: Optional[str] = None,
    importance_level: Optional[str] = None,
    experience_mode: str = "corporate",
    experience_min: int = 0,
    experience_max: int = 10,
    combined_skills: Optional[List[Dict[str, Any]]] = None,
    job_designation: Optional[str] = None,
    assessment_title: Optional[str] = None
) -> Dict[str, Any]:
    """
    Improve a topic label by generating a completely different topic while staying relevant to the skills.
    Uses generate_topics_unified with previous_topic_label to avoid repetition.
    
    Args:
        previous_topic_label: Current topic label to improve (will be passed as exclusion)
        skill_context: Optional skill context
        skill_description: Optional skill description
        importance_level: Optional importance level
        experience_mode: Experience mode (corporate/college)
        experience_min: Minimum experience years
        experience_max: Maximum experience years
        combined_skills: Optional list of combined skills
        job_designation: Optional job designation
        assessment_title: Optional assessment title
        
    Returns:
        Dictionary with:
        - label: Improved (different) topic label
        - questionType: Assigned question type
        - difficulty: Assigned difficulty
        - canUseJudge0: Whether Judge0 can be used
        
    Raises:
        HTTPException: If topic improvement fails
    """
    logger.info(f"Improving topic: '{previous_topic_label}'")
    
    # Build combined_skills if not provided
    if not combined_skills:
        if skill_context:
            # Build from provided skill context
            combined_skills = [{
                "skill_name": skill_context,
                "description": skill_description,
                "importance_level": importance_level,
                "source": "manual"
            }]
        else:
            # Fallback: Extract skill name from previous topic label
            # Example: "Python List Comprehensions" → "Python"
            combined_skills = [{
                "skill_name": previous_topic_label,
                "source": "manual"
            }]
    
    try:
        # ⭐ Call generate_topics_unified with previous_topic_label to avoid repetition
        topics = await generate_topics_unified(
            assessment_title=assessment_title,
            job_designation=job_designation,
            combined_skills=combined_skills,
            experience_min=experience_min,
            experience_max=experience_max,
            experience_mode=experience_mode,
            previous_topic_label=previous_topic_label  # ⭐ CRITICAL: Pass old topic to avoid repeating
        )
        
        if not topics or len(topics) == 0:
            logger.error(f"No topics generated for improvement of '{previous_topic_label}'")
            raise HTTPException(status_code=500, detail="Failed to generate improved topic")
        
        # Return first generated topic
        first_topic = topics[0]
        
        # Extract question row data for return
        question_rows = first_topic.get("questionRows", [])
        if question_rows:
            question_row = question_rows[0]
            question_type = question_row.get("questionType", "MCQ")
            difficulty = question_row.get("difficulty", "Medium")
            can_use_judge0 = question_row.get("canUseJudge0", False)
        else:
            # Fallback if no question rows
            question_type = "MCQ"
            difficulty = "Medium"
            can_use_judge0 = False
        
        improved_label = first_topic.get("label", previous_topic_label)
        
        logger.info(
            f"Topic improved: '{previous_topic_label}' → '{improved_label}' "
            f"(Type: {question_type}, Difficulty: {difficulty})"
        )
        
        return {
            "label": improved_label,
            "questionType": question_type,
            "difficulty": difficulty,
            "canUseJudge0": can_use_judge0
        }
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error improving topic '{previous_topic_label}': {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to improve topic: {str(exc)}"
        ) from exc

