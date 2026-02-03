from __future__ import annotations

import asyncio
import logging
import secrets
import copy
import os
import re
import ipaddress
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.dependencies import require_editor
from ....core.security import sanitize_input, sanitize_text_field
from ....db.mongo import get_db
from .schemas import (
    SuggestTopicsRequest,
    ClassifyTechnicalTopicRequest,
    AddCustomTopicsRequest,
    AITopicSuggestionRequest,
    AddCustomTopicRequest,
    AddNewQuestionRequest,
    CreateAssessmentFromJobDesignationRequest,
    DeleteQuestionRequest,
    DeleteTopicQuestionsRequest,
    FinalizeAssessmentRequest,
    AddQuestionRowRequest,
    GenerateAllQuestionsRequest,
    GenerateQuestionRequest,
    GenerateQuestionsFromConfigRequest,
    RegenerateSingleQuestionRequest,
    RemoveQuestionRowRequest,
    GenerateQuestionsRequest,
    GenerateTopicCardsRequest,
    GenerateTopicsFromSkillRequest,
    GenerateTopicsFromRequirementsRequest,
    GenerateTopicsRequest,
    GenerateTopicsRequestOld,
    RegenerateSingleTopicRequest,
    RegenerateTopicRequest,
    ImproveTopicRequest,
    ImproveAllTopicsRequest,
    RegenerateQuestionRequest,
    RemoveCustomTopicsRequest,
    ScheduleUpdateRequest,
    TopicConfigRow,
    TopicModel,
    UpdateAssessmentDraftRequest,
    UpdateQuestionsRequest,
    UpdateSingleQuestionRequest,
    UpdateSingleQuestionRequestV2,
    UpdateTopicSettingsRequest,
    ValidateQuestionTypeRequest,
    AITopicSuggestionRequest,
    AddCustomTopicRequest,
)
from .topic_suggestions import suggest_topic_contexts, generate_topic_context_summary, _detect_category_semantically, suggest_topics, classify_technical_topic
# Import all assessment services from the new services package (single entry point)
from .services import (
    # Legacy compatibility functions (wrapped from services.py via legacy_compat)
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
    # V2 topic and question generation
    generate_questions_for_row_v2,
    generate_questions_for_topic_v2,
    generate_topics_v2,
    generate_topics_from_requirements_v2,
    generate_topics_unified,
    improve_topic,
    regenerate_question,
    validate_topic_category,
    _is_technical_topic_ai,
    ai_topic_suggestion,
    _get_openai_client,
)
from ....utils.mongo import convert_object_ids, serialize_document, to_object_id
from bson import ObjectId
from ....utils.responses import success_response
from ....models.aptitude_topics import (
    APTITUDE_MAIN_TOPICS,
    APTITUDE_TOPICS_STRUCTURE,
    get_aptitude_subtopics,
    get_aptitude_question_types,
)

logger = logging.getLogger(__name__)

# In-memory lock to prevent concurrent requests for the same URL
_website_fetch_locks: Dict[str, asyncio.Lock] = {}

router = APIRouter(prefix="/api/v1/assessments", tags=["assessments"])


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _check_assessment_access(assessment: Dict[str, Any], current_user: Dict[str, Any]) -> None:
    if current_user.get("role") == "super_admin":
        return
    
    # Normalize organization IDs to strings for comparison
    assessment_org = assessment.get("organization")
    if assessment_org is not None:
        # Convert ObjectId to string if needed
        assessment_org = str(assessment_org)
    
    user_org = current_user.get("organization")
    if user_org is not None:
        # Already a string from serialization, but ensure it's a string
        user_org = str(user_org)
    
    # Allow access if organizations match (including both None)
    if assessment_org == user_org:
        return
    
    # If assessment has no organization, allow access if user is the creator
    if assessment_org is None:
        assessment_created_by = assessment.get("createdBy")
        user_id = current_user.get("id")
        if assessment_created_by is not None and user_id is not None:
            # Convert both to strings for comparison (createdBy is ObjectId, user_id is string)
            if str(assessment_created_by) == str(user_id):
                return
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied. You can only access your organization's assessments.",
    )


async def _get_assessment(db: AsyncIOMotorDatabase, assessment_id: str) -> Dict[str, Any]:
    try:
        oid = to_object_id(assessment_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid assessment ID") from exc

    assessment = await db.assessments.find_one({"_id": oid})
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    return assessment


async def _save_assessment(db: AsyncIOMotorDatabase, assessment: Dict[str, Any]) -> None:
    assessment_id = assessment.get("_id")
    if not assessment_id:
        raise RuntimeError("Assessment document missing _id")
    assessment["updatedAt"] = _now_utc()
    await db.assessments.replace_one({"_id": assessment_id}, assessment)
    # ✅ SPEED OPTIMIZATION: Invalidate cache after saving
    try:
        from .services.assessment_cache import invalidate_assessment_cache_async
        await invalidate_assessment_cache_async(str(assessment_id))
    except Exception as e:
        logger.warning(f"Failed to invalidate cache for assessment {assessment_id}: {e}")
    # ✅ SPEED OPTIMIZATION: Invalidate cache after saving
    from .services.assessment_cache import invalidate_assessment_cache_async
    await invalidate_assessment_cache_async(str(assessment_id))


async def _find_or_get_existing_draft(
    db: AsyncIOMotorDatabase,
    current_user: Dict[str, Any],
    assessment_id: str = None
) -> Dict[str, Any] | None:
    """
    Find existing draft assessment for the user.
    Priority:
    1. If assessment_id is provided, return that assessment if it's a draft
    2. Otherwise, find the most recent draft for this user
    
    Returns None if no draft exists.
    """
    user_id = to_object_id(current_user.get("id"))
    user_org = current_user.get("organization")
    
    # If assessment_id is provided, check if it's a draft for this user
    if assessment_id:
        try:
            assessment = await _get_assessment(db, assessment_id)
            # Check if it's a draft and belongs to this user
            if assessment.get("status") == "draft":
                assessment_created_by = assessment.get("createdBy")
                if assessment_created_by and str(assessment_created_by) == str(user_id):
                    return assessment
        except HTTPException:
            pass  # Assessment doesn't exist or access denied
    
    # Find the most recent draft for this user
    query = {
        "createdBy": user_id,
        "status": "draft"
    }
    
    # If user has organization, also match by organization
    if user_org:
        query["organization"] = to_object_id(user_org)
    
    # Get the most recent draft (sorted by updatedAt descending)
    draft = await db.assessments.find_one(
        query,
        sort=[("updatedAt", -1)]
    )
    
    return draft


def _ensure_topic_structure(topic: Dict[str, Any]) -> Dict[str, Any]:
    topic.setdefault("questions", [])
    topic.setdefault("questionConfigs", [])
    topic.setdefault("questionTypes", [])
    return topic


def _is_aptitude_skill(skill: str) -> bool:
    """Check if a skill is aptitude-related."""
    skill_lower = skill.lower().strip()
    aptitude_keywords = ["aptitude", "apti"]
    
    # Check for aptitude keywords
    if any(keyword in skill_lower for keyword in aptitude_keywords):
        return True
    
    # Check if skill matches aptitude main topics
    aptitude_main_topics_lower = [topic.lower() for topic in APTITUDE_MAIN_TOPICS]
    for apt_topic in aptitude_main_topics_lower:
        if apt_topic in skill_lower or skill_lower in apt_topic:
            return True
    
    # Check for common variations
    if "quantitative" in skill_lower or "logical reasoning" in skill_lower or "verbal ability" in skill_lower:
        return True
    
    return False


def _is_aptitude_requested(job_designation: str, selected_skills: List[str]) -> bool:
    """Check if aptitude assessment is requested based on job designation or selected skills."""
    # Normalize inputs for case-insensitive matching
    job_designation_lower = job_designation.lower().strip()
    
    # Check job designation
    aptitude_keywords = ["aptitude", "apti"]
    if any(keyword in job_designation_lower for keyword in aptitude_keywords):
        return True
    
    # Check selected skills
    for skill in selected_skills:
        if _is_aptitude_skill(skill):
            return True
    
    return False


def _separate_skills(selected_skills: List[str]) -> tuple[List[str], List[str]]:
    """Separate selected skills into aptitude skills and technical skills.
    
    Returns:
        Tuple of (aptitude_skills, technical_skills)
    """
    aptitude_skills = []
    technical_skills = []
    
    for skill in selected_skills:
        if _is_aptitude_skill(skill):
            aptitude_skills.append(skill)
        else:
            technical_skills.append(skill)
    
    return aptitude_skills, technical_skills


@router.post("/generate-topics-old")
async def generate_topics_old(
    payload: GenerateTopicsRequestOld,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    # Validate assessment type
    valid_types = {"aptitude", "technical"}
    assessment_types = set(payload.assessmentType)
    if not assessment_types.issubset(valid_types):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid assessment type. Must be one or more of: {valid_types}",
        )

    # Validate required fields based on assessment type
    if "technical" in assessment_types:
        if not payload.jobRole or not payload.experience or not payload.skills or len(payload.skills) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Job role, experience, and at least one skill are required for technical assessments",
            )
        if not payload.numTopics or payload.numTopics < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of topics is required and must be at least 1 for technical assessments",
            )

    if "aptitude" in assessment_types:
        if not payload.aptitudeConfig:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aptitude configuration is required for aptitude assessments",
            )
        # Check if at least one aptitude category is enabled
        apt_config = payload.aptitudeConfig
        has_enabled = (
            (apt_config.quantitative and apt_config.quantitative.enabled)
            or (apt_config.logicalReasoning and apt_config.logicalReasoning.enabled)
            or (apt_config.verbalAbility and apt_config.verbalAbility.enabled)
            or (apt_config.numericalReasoning and apt_config.numericalReasoning.enabled)
        )
        if not has_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one aptitude category must be enabled",
            )

    topic_docs: List[Dict[str, Any]] = []
    custom_topics: List[str] = []
    title_parts: List[str] = []
    description_parts: List[str] = []

    # Handle Aptitude topics
    if "aptitude" in assessment_types and payload.aptitudeConfig:
        apt_config = payload.aptitudeConfig
        aptitude_category_map = {
            "quantitative": "Quantitative",
            "logicalReasoning": "Logical Reasoning",
            "verbalAbility": "Verbal Ability",
            "numericalReasoning": "Numerical Reasoning",
        }

        for key, category_name in aptitude_category_map.items():
            category_config = getattr(apt_config, key, None)
            if category_config and category_config.enabled:
                # Aptitude topics don't support coding
                coding_supported = await determine_topic_coding_support(category_name)
                topic_docs.append(
                    {
                        "topic": category_name,
                        "numQuestions": category_config.numQuestions,
                        "questionTypes": ["MCQ"],
                        "difficulty": category_config.difficulty,
                        "source": "AI",
                        "category": "aptitude",
                        "questions": [],
                        "questionConfigs": [],
                        "coding_supported": coding_supported,
                    }
                )
                custom_topics.append(category_name)
                title_parts.append(category_name)
                description_parts.append(f"{category_name} ({category_config.difficulty})")

    # Handle Technical topics
    if "technical" in assessment_types:
        # Sanitize user inputs
        sanitized_job_role = sanitize_text_field(payload.jobRole)
        sanitized_skills = [sanitize_text_field(skill) for skill in payload.skills]
        
        topics = await generate_topics_from_input(sanitized_job_role, payload.experience, sanitized_skills, payload.numTopics)
        # Sanitize generated topics
        sanitized_topics = [sanitize_text_field(topic) for topic in topics]
        # Determine coding support for each topic
        technical_topic_docs = []
        for t in sanitized_topics:
            coding_supported = await determine_topic_coding_support(t)
            technical_topic_docs.append({
                "topic": t,
                "numQuestions": 0,
                "questionTypes": [],
                "difficulty": "Medium",
                "source": "AI",
                "category": "technical",
                "questions": [],
                "questionConfigs": [],
                "coding_supported": coding_supported,
            })
        topic_docs.extend(technical_topic_docs)
        custom_topics.extend(sanitized_topics)
        title_parts.append(sanitized_job_role)
        description_parts.append(f"{sanitized_job_role} test for {payload.experience} exp level")

    # Build title and description
    # Sanitize title parts to prevent XSS
    sanitized_title_parts = [sanitize_text_field(part) for part in title_parts]
    sanitized_description_parts = [sanitize_text_field(part) for part in description_parts]
    
    if len(sanitized_title_parts) == 1:
        title = f"{sanitized_title_parts[0]} Assessment"
    elif len(sanitized_title_parts) == 2:
        title = f"{sanitized_title_parts[0]} & {sanitized_title_parts[1]} Assessment"
    else:
        title = "Assessment"

    description = ". ".join(sanitized_description_parts) if sanitized_description_parts else "Assessment"

    assessment_doc: Dict[str, Any] = {
        "title": title,
        "description": description,
        "topics": topic_docs,
        "customTopics": custom_topics,
        "assessmentType": list(assessment_types),
        "status": "draft",
        "createdBy": to_object_id(current_user.get("id")),
        "organization": to_object_id(current_user.get("organization")) if current_user.get("organization") else None,
        "isGenerated": False,
        "createdAt": _now_utc(),
        "updatedAt": _now_utc(),
    }

    # Store configuration
    if "technical" in assessment_types:
        assessment_doc["technicalConfig"] = {
            "jobRole": payload.jobRole,
            "experience": payload.experience,
            "skills": payload.skills,
        }

    if "aptitude" in assessment_types and payload.aptitudeConfig:
        apt_config_dict: Dict[str, Any] = {}
        if payload.aptitudeConfig.quantitative:
            apt_config_dict["quantitative"] = payload.aptitudeConfig.quantitative.model_dump()
        if payload.aptitudeConfig.logicalReasoning:
            apt_config_dict["logicalReasoning"] = payload.aptitudeConfig.logicalReasoning.model_dump()
        if payload.aptitudeConfig.verbalAbility:
            apt_config_dict["verbalAbility"] = payload.aptitudeConfig.verbalAbility.model_dump()
        if payload.aptitudeConfig.numericalReasoning:
            apt_config_dict["numericalReasoning"] = payload.aptitudeConfig.numericalReasoning.model_dump()
        assessment_doc["aptitudeConfig"] = apt_config_dict

    result = await db.assessments.insert_one(assessment_doc)
    assessment_doc["_id"] = result.inserted_id
    return success_response("Topics generated successfully", serialize_document(assessment_doc))


@router.post("/update-topics")
async def update_topic_settings(
    payload: UpdateTopicSettingsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not payload.updatedTopics:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid input")

    assessment = await _get_assessment(db, payload.assessmentId)
    _check_assessment_access(assessment, current_user)

    topics = assessment.get("topics", [])
    for update in payload.updatedTopics:
        # Sanitize topic name
        sanitized_topic = sanitize_text_field(update.topic)
        topic_obj = next((t for t in topics if t.get("topic") == sanitized_topic), None)
        if not topic_obj:
            continue
        topic_obj = _ensure_topic_structure(topic_obj)
        
        # Update topic name if sanitized
        if sanitized_topic != update.topic:
            topic_obj["topic"] = sanitized_topic

        if update.numQuestions is not None:
            topic_obj["numQuestions"] = update.numQuestions
        if update.questionTypes is not None:
            topic_obj["questionTypes"] = update.questionTypes
        if update.difficulty:
            topic_obj["difficulty"] = sanitize_text_field(update.difficulty) if update.difficulty else update.difficulty

        if update.questions:
            for idx, question_config in enumerate(update.questions):
                if idx < len(topic_obj.get("questions", [])):
                    existing_question = topic_obj["questions"][idx]
                    existing_question.update(question_config.model_dump(exclude_unset=True))

        if update.questionConfigs:
            topic_obj["questionConfigs"] = [qc.model_dump(exclude_unset=True) for qc in update.questionConfigs]

    assessment["topics"] = topics
    await _save_assessment(db, assessment)
    # Serialize topics to convert ObjectIds and datetimes to JSON-serializable formats
    serialized_topics = convert_object_ids(assessment["topics"])
    return success_response("Topic settings updated successfully", serialized_topics)


@router.post("/add-topic")
async def add_custom_topics(
    payload: AddCustomTopicsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not payload.newTopics:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid input")

    assessment = await _get_assessment(db, payload.assessmentId)
    _check_assessment_access(assessment, current_user)

    topics = assessment.get("topics", [])
    custom_topics = set(assessment.get("customTopics", []))

    for topic_data in payload.newTopics:
        if isinstance(topic_data, str):
            # Sanitize topic name
            topic_name = sanitize_text_field(topic_data)
            exists = any(t.get("topic") == topic_name for t in topics)
            if not exists:
                # Automatically determine if topic supports coding
                coding_supported = await determine_topic_coding_support(topic_name)
                topics.append(
                    {
                        "topic": topic_name,
                        "numQuestions": 0,
                        "questionTypes": [],
                        "difficulty": "Medium",
                        "source": "User",
                        "questions": [],
                        "questionConfigs": [],
                        "coding_supported": coding_supported,
                    }
                )
            custom_topics.add(topic_name)
        else:
            topic_dict = topic_data.model_dump(exclude_unset=True)
            # Sanitize topic name and difficulty
            topic_name = sanitize_text_field(topic_dict.get("topic", ""))
            sanitized_difficulty = sanitize_text_field(topic_dict.get("difficulty", "Medium")) if topic_dict.get("difficulty") else "Medium"
            exists = any(t.get("topic") == topic_name for t in topics)
            if not exists:
                topics.append(
                    {
                        "topic": topic_name,
                        "numQuestions": topic_dict.get("numQuestions", 0),
                        "questionTypes": topic_dict.get("questionTypes", []),
                        "difficulty": sanitized_difficulty,
                        "source": "User",
                        "questions": [],
                        "questionConfigs": topic_dict.get("questionConfigs", []),
                    }
                )
            custom_topics.add(topic_name)

    assessment["topics"] = topics
    assessment["customTopics"] = list(custom_topics)
    await _save_assessment(db, assessment)
    # Serialize topics to convert ObjectIds and datetimes to JSON-serializable formats
    serialized_topics = convert_object_ids(assessment["topics"])
    return success_response("Custom topics added successfully", serialized_topics)


@router.delete("/remove-topic")
async def remove_custom_topics(
    payload: RemoveCustomTopicsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not payload.topicsToRemove:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid input")

    assessment = await _get_assessment(db, payload.assessmentId)
    _check_assessment_access(assessment, current_user)

    topics_to_remove = set(payload.topicsToRemove)
    
    # Remove topics from topics array
    assessment["topics"] = [t for t in assessment.get("topics", []) if t.get("topic") not in topics_to_remove]
    
    # Remove topics from customTopics array
    assessment["customTopics"] = [t for t in assessment.get("customTopics", []) if t not in topics_to_remove]
    
    # Remove questions that belong to removed topics
    # Questions are stored in assessment["questions"] array, and each question has a "topic" field
    if "questions" in assessment and isinstance(assessment["questions"], list):
        assessment["questions"] = [
            q for q in assessment["questions"] 
            if q.get("topic") not in topics_to_remove
        ]
    
    # Also remove questions from topic objects themselves
    for topic in assessment.get("topics", []):
        if isinstance(topic, dict) and "questions" in topic:
            if isinstance(topic["questions"], list):
                # Keep only questions that don't belong to removed topics
                # (though this shouldn't be necessary if questions are properly structured)
                topic["questions"] = [
                    q for q in topic["questions"]
                    if q.get("topic") not in topics_to_remove
                ]

    await _save_assessment(db, assessment)
    # Serialize topics to convert ObjectIds and datetimes to JSON-serializable formats
    serialized_topics = convert_object_ids(assessment["topics"])
    return success_response("Topics removed successfully", serialized_topics)


# New flow endpoints
@router.post("/generate-topic-cards")
async def generate_topic_cards_endpoint(
    payload: GenerateTopicCardsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Generate topic cards (technologies/skills) from job designation."""
    try:
        # Sanitize input to prevent XSS
        sanitized_job_designation = sanitize_text_field(payload.jobDesignation)
        sanitized_title = sanitize_text_field(payload.assessmentTitle) if payload.assessmentTitle else None
        experience_min = payload.experienceMin if payload.experienceMin is not None else 0
        experience_max = payload.experienceMax if payload.experienceMax is not None else 10
        experience_mode = payload.experienceMode if payload.experienceMode else "corporate"
        
        # Validate experience mode
        if experience_mode not in ["corporate", "student"]:
            raise HTTPException(status_code=400, detail="experienceMode must be either 'corporate' or 'student'")
        
        cards = await generate_topic_cards_from_job_designation(
            sanitized_job_designation, 
            experience_min, 
            experience_max,
            experience_mode,
            sanitized_title
        )
        
        return success_response(
            "Topic cards generated successfully",
            {
                "cards": cards,
            }
        )
    except HTTPException:
        # Re-raise HTTPExceptions as-is (they already have proper status codes and messages)
        raise
    except Exception as exc:
        logger.error(f"Error generating topic cards: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate topic cards: {str(exc)}") from exc


@router.post("/generate-topics-from-skill")
async def generate_topics_from_skill_endpoint(
    payload: GenerateTopicsFromSkillRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Generate topics from skill(s) input. Handles both single skill and comma-separated multiple skills."""
    try:
        # Parse skills: if comma-separated, split into list; otherwise treat as single skill
        skill_input = payload.skill.strip()
        if "," in skill_input:
            # Multiple skills (comma-separated) - use generate_topics_from_selected_skills
            skills_list = [s.strip() for s in skill_input.split(",") if s.strip()]
            if not skills_list:
                raise HTTPException(status_code=400, detail="No valid skills provided")
            
            # Filter out aptitude skills (only use technical skills for topic generation)
            _, technical_skills = _separate_skills(skills_list)
            if not technical_skills:
                raise HTTPException(status_code=400, detail="No technical skills found. Please provide technical skills for topic generation.")
            
            experience_mode = payload.experienceMode if hasattr(payload, 'experienceMode') and payload.experienceMode else "corporate"
            topics = await generate_topics_from_selected_skills(
                technical_skills,
                payload.experienceMin,
                payload.experienceMax,
                experience_mode
            )
            # Get question types from the first skill (or combine if needed)
            question_types = await get_relevant_question_types(technical_skills[0] if technical_skills else skill_input)
        else:
            # Single skill - use generate_topics_from_skill
            experience_mode = payload.experienceMode if hasattr(payload, 'experienceMode') and payload.experienceMode else "corporate"
            topics = await generate_topics_from_skill(payload.skill, payload.experienceMin, payload.experienceMax, experience_mode)
            question_types = await get_relevant_question_types(payload.skill)
        
        return success_response(
            "Topics generated successfully",
            {
                "topics": topics,
                "questionTypes": question_types,
            }
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating topics from skill: {exc}")
        raise HTTPException(status_code=500, detail="Failed to generate topics") from exc


@router.post("/validate-question-type")
async def validate_question_type_endpoint(
    payload: ValidateQuestionTypeRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """
    Validate if a question type is appropriate for a given topic.
    Specifically validates that 'coding' type is only used for topics that support Judge0 execution.
    """
    try:
        # Sanitize input to prevent XSS
        sanitized_topic = sanitize_text_field(payload.topic)
        question_type = payload.questionType.strip()
        
        if not sanitized_topic or not sanitized_topic.strip():
            raise HTTPException(status_code=400, detail="Topic name is required")
        
        if question_type not in ["MCQ", "Subjective", "Pseudo Code", "Descriptive", "coding"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid question type: {question_type}. Must be one of: MCQ, Subjective, Pseudo Code, Descriptive, coding"
            )
        
        # Special validation for coding type
        if question_type == "coding":
            coding_supported = await determine_topic_coding_support(sanitized_topic)
            if not coding_supported:
                # Also determine the appropriate question type for this topic
                suggested_type = await get_question_type_for_topic(sanitized_topic)
                return success_response(
                    "Question type validation failed",
                    {
                        "valid": False,
                        "reason": f"Topic '{sanitized_topic}' does not support coding questions that can be executed by Judge0. Topics related to frameworks, UI/UX, theory, or non-executable concepts do not support coding type.",
                        "suggestedType": suggested_type,
                        "codingSupported": False,
                    }
                )
            return success_response(
                "Question type is valid",
                {
                    "valid": True,
                    "codingSupported": True,
                }
            )
        
        # For non-coding types, they're generally valid for any topic
        # But we can still check if the topic would be better suited for coding
        coding_supported = await determine_topic_coding_support(sanitized_topic)
        suggested_type = await get_question_type_for_topic(sanitized_topic)
        
        return success_response(
            "Question type is valid",
            {
                "valid": True,
                "codingSupported": coding_supported,
                "suggestedType": suggested_type,
                "note": f"Topic supports coding: {coding_supported}. Suggested type: {suggested_type}" if coding_supported and question_type != "coding" else None,
            }
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error validating question type: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to validate question type: {str(exc)}") from exc


@router.post("/regenerate-single-topic")
async def regenerate_single_topic_endpoint(
    payload: RegenerateSingleTopicRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Regenerate a new topic name based on skills, update question type and coding support, delete its questions."""
    try:
        # Sanitize input to prevent XSS
        old_topic_name = sanitize_text_field(payload.topic)
        
        if not old_topic_name or not old_topic_name.strip():
            raise HTTPException(status_code=400, detail="Topic name is required")
        
        new_topic_name = old_topic_name
        question_type = "MCQ"
        coding_supported = False
        
        # If assessmentId is provided, regenerate topic based on skills and update the assessment
        if payload.assessmentId:
            assessment = await _get_assessment(db, payload.assessmentId)
            _check_assessment_access(assessment, current_user)
            
            # Get skills and experience from assessment
            selected_skills = assessment.get("selectedSkills", [])
            experience_min = assessment.get("experienceMin", 0)
            experience_max = assessment.get("experienceMax", 10)
            
            # Find the topic to regenerate
            topics = assessment.get("topics", [])
            topic_obj = next((t for t in topics if t.get("topic") == old_topic_name), None)
            
            if topic_obj:
                # Only regenerate technical topics (not aptitude)
                if not topic_obj.get("isAptitude", False) and selected_skills:
                    # Generate a new topic based on skills
                    try:
                        # Filter out aptitude skills
                        _, technical_skills = _separate_skills(selected_skills)
                        if technical_skills:
                            # Generate new topics from skills
                            # Get experience mode from assessment
                            exp_mode = assessment.get("experienceMode", "corporate")
                            new_topics = await generate_topics_from_selected_skills(
                                technical_skills,
                                str(experience_min),
                                str(experience_max),
                                exp_mode
                            )
                            # Use the first generated topic as the new topic name
                            if new_topics and len(new_topics) > 0:
                                new_topic_name = sanitize_text_field(new_topics[0])
                                # Update the topic name in the assessment
                                topic_obj["topic"] = new_topic_name
                    except Exception as e:
                        logger.warning(f"Failed to generate new topic name: {e}. Keeping original topic name.")
                        # If generation fails, keep the old topic name
                        new_topic_name = old_topic_name
                
                # Clear questions for this topic
                topic_obj["questions"] = []
                topic_obj["numQuestions"] = 0
                
                # Get question type and coding support for the new topic
                # Uses get_question_type_for_topic which now properly returns MCQ/Subjective for appropriate topics
                question_type, coding_supported = await asyncio.gather(
                    get_question_type_for_topic(new_topic_name),
                    determine_topic_coding_support(new_topic_name),
                    return_exceptions=True
                )
                
                # Handle exceptions gracefully
                if isinstance(question_type, Exception):
                    logger.warning(f"Failed to determine question type for topic '{new_topic_name}': {question_type}")
                    question_type = "MCQ"  # Safe fallback
                if isinstance(coding_supported, Exception):
                    logger.warning(f"Failed to determine coding support for topic '{new_topic_name}': {coding_supported}")
                    coding_supported = False  # Safe fallback
                
                # Update topic with new question type and coding support
                topic_obj["questionTypes"] = [question_type]
                topic_obj["coding_supported"] = coding_supported
                
                # Save the assessment
                await _save_assessment(db, assessment)
        else:
            # If no assessmentId, just get question type and coding support for the topic
            # Uses get_question_type_for_topic which now properly returns MCQ/Subjective for appropriate topics
            question_type, coding_supported = await asyncio.gather(
                get_question_type_for_topic(new_topic_name),
                determine_topic_coding_support(new_topic_name),
                return_exceptions=True
            )
            
            # Handle exceptions gracefully
            if isinstance(question_type, Exception):
                logger.warning(f"Failed to determine question type for topic '{new_topic_name}': {question_type}")
                question_type = "MCQ"  # Safe fallback
            if isinstance(coding_supported, Exception):
                logger.warning(f"Failed to determine coding support for topic '{new_topic_name}': {coding_supported}")
                coding_supported = False  # Safe fallback
        
        # If question type is "coding" but topic doesn't support coding, change to a safe default
        # The improved get_question_type_for_topic should rarely return "coding" for non-coding topics,
        # but this is a safety check
        if question_type == "coding" and not coding_supported:
            logger.warning(f"Topic '{new_topic_name}' was assigned 'coding' but doesn't support coding. Changing to 'Subjective'.")
            question_type = "Subjective"  # Safe fallback for non-coding topics
        
        return success_response(
            "Topic regenerated successfully",
            {
                "topic": new_topic_name,
                "questionType": question_type,
                "coding_supported": coding_supported,
            }
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error regenerating single topic: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to regenerate topic: {str(exc)}") from exc


@router.post("/delete-topic-questions")
async def delete_topic_questions(
    payload: DeleteTopicQuestionsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete questions for a specific topic or all topics."""
    try:
        assessment = await _get_assessment(db, payload.assessmentId)
        _check_assessment_access(assessment, current_user)
        
        topics = assessment.get("topics", [])
        
        if payload.topic:
            # Delete questions for a specific topic only
            topic_obj = next((t for t in topics if t.get("topic") == payload.topic), None)
            if topic_obj:
                topic_obj["questions"] = []
                topic_obj["numQuestions"] = 0
        else:
            # Delete questions for all topics
            for topic_obj in topics:
                topic_obj["questions"] = []
                topic_obj["numQuestions"] = 0
        
        await _save_assessment(db, assessment)
        
        return success_response(
            "Questions deleted successfully",
            {"deleted": True}
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error deleting topic questions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete questions: {str(exc)}") from exc


@router.post("/create-assessment-from-job-designation")
async def create_assessment_from_job_designation(
    payload: CreateAssessmentFromJobDesignationRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Create a new assessment with topics from job designation and selected skills, or update existing draft if one exists."""
    try:
        # SINGLE DRAFT LOGIC: Check for existing draft first
        existing_assessment = None
        if hasattr(payload, 'assessmentId') and payload.assessmentId:
            # If assessmentId is provided, try to use that specific draft
            try:
                existing_assessment = await _get_assessment(db, payload.assessmentId)
                _check_assessment_access(existing_assessment, current_user)
                # Only use it if it's a draft
                if existing_assessment.get("status") != "draft":
                    logger.warning(f"Assessment {payload.assessmentId} is not a draft, will find/create new draft")
                    existing_assessment = None
                else:
                    logger.info(f"Updating existing draft {payload.assessmentId} with new topics")
            except HTTPException:
                existing_assessment = None
            except Exception as exc:
                logger.warning(f"Error fetching assessment {payload.assessmentId}: {exc}")
                existing_assessment = None
        
        # If no specific assessmentId provided or it doesn't exist, find existing draft
        if not existing_assessment:
            existing_assessment = await _find_or_get_existing_draft(db, current_user, payload.assessmentId if hasattr(payload, 'assessmentId') else None)
            if existing_assessment:
                logger.info(f"Found existing draft {existing_assessment['_id']}, updating instead of creating new")
        # Sanitize user inputs to prevent XSS
        sanitized_job_designation = sanitize_text_field(payload.jobDesignation)
        sanitized_skills = [sanitize_text_field(skill) for skill in payload.selectedSkills]
        experience_mode = payload.experienceMode if hasattr(payload, 'experienceMode') and payload.experienceMode else "corporate"
        
        # Validate experience mode
        if experience_mode not in ["corporate", "student"]:
            experience_mode = "corporate"  # Default fallback
        
        # Infer coding language from job designation and skills
        coding_language = infer_language_from_skill(
            job_designation=sanitized_job_designation,
            selected_skills=sanitized_skills
        )
        
        # Separate skills into aptitude and technical skills
        aptitude_skills, technical_skills = _separate_skills(sanitized_skills)
        
        # Check if aptitude is requested (from job designation or skills)
        is_aptitude = _is_aptitude_requested(sanitized_job_designation, sanitized_skills)
        
        # Build topics list
        topic_docs = []
        custom_topics = []
        assessment_types = []
        all_question_types = []
        has_technical_topics = False
        
        # Generate aptitude topics if requested
        if is_aptitude:
            aptitude_topics = APTITUDE_MAIN_TOPICS.copy()
            
            for main_topic in aptitude_topics:
                sanitized_main_topic = sanitize_text_field(main_topic)
                sub_topics = get_aptitude_subtopics(main_topic)
                
                topic_doc = {
                    "topic": sanitized_main_topic,
                    "numQuestions": 0,
                    "questionTypes": ["MCQ"],  # Aptitude topics use MCQ
                    "difficulty": "Medium",
                    "source": "Predefined",
                    "category": "aptitude",
                    "questions": [],
                    "questionConfigs": [],
                    "isAptitude": True,  # Flag to identify aptitude topics
                    "subTopics": sub_topics,  # List of available sub-topics
                    "aptitudeStructure": APTITUDE_TOPICS_STRUCTURE[main_topic],  # Full structure for frontend
                }
                topic_docs.append(topic_doc)
                custom_topics.append(sanitized_main_topic)
            
            assessment_types.append("aptitude")
            all_question_types.append("MCQ")
        
        # Generate technical topics if there are technical skills
        if technical_skills:
            # Generate topics from technical skills only
            technical_topics = await generate_topics_from_selected_skills(
                technical_skills, 
                payload.experienceMin, 
                payload.experienceMax,
                experience_mode
            )
            
            # Process topics in parallel to determine question types and coding support (optimized)
            topic_processing_tasks = []
            for topic in technical_topics:
                sanitized_topic = sanitize_text_field(topic)
                # Create tasks for parallel processing
                topic_processing_tasks.append({
                    "topic": sanitized_topic,
                    "question_type_task": get_question_type_for_topic(sanitized_topic),
                    "coding_support_task": determine_topic_coding_support(sanitized_topic),
                })
            
            # Execute all tasks in parallel for better performance
            for task_info in topic_processing_tasks:
                question_type, coding_supported = await asyncio.gather(
                    task_info["question_type_task"],
                    task_info["coding_support_task"],
                    return_exceptions=True
                )
                
                # Handle exceptions gracefully
                if isinstance(question_type, Exception):
                    logger.warning(f"Failed to determine question type for topic '{task_info['topic']}': {question_type}")
                    question_type = "MCQ"  # Safe fallback
                if isinstance(coding_supported, Exception):
                    logger.warning(f"Failed to determine coding support for topic '{task_info['topic']}': {coding_supported}")
                    coding_supported = False  # Safe fallback
                
                # If question type is "coding" but topic doesn't support coding, change to a safe default
                if question_type == "coding" and not coding_supported:
                    logger.warning(f"Topic '{task_info['topic']}' was assigned 'coding' but doesn't support coding. Changing to 'Subjective'.")
                    question_type = "Subjective"  # Safe fallback for non-coding topics
                
                topic_doc = {
                    "topic": task_info["topic"],
                    "numQuestions": 0,
                    "questionTypes": [question_type],  # Topic-specific question type
                    "difficulty": "Medium",  # Default difficulty
                    "source": "AI",
                    "category": "technical",
                    "questions": [],
                    "questionConfigs": [],
                    "isAptitude": False,  # Flag to identify technical topics
                    "coding_supported": coding_supported,
                }
                topic_docs.append(topic_doc)
                custom_topics.append(task_info["topic"])
                
                # Add question type to all_question_types (avoid duplicates)
                if question_type not in all_question_types:
                    all_question_types.append(question_type)
            
            assessment_types.append("technical")
            has_technical_topics = True
        
        # If no topics were generated, raise an error
        if not topic_docs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid skills selected. Please select at least one technical skill or aptitude."
            )
        
        # Build description
        if is_aptitude and has_technical_topics:
            technical_skills_str = ", ".join(technical_skills)
            description = f"Mixed Assessment (Aptitude + Technical) for {sanitized_job_designation} - Technical Skills: {technical_skills_str} (Experience: {payload.experienceMin}-{payload.experienceMax} years)"
        elif is_aptitude:
            description = f"Aptitude Assessment for {sanitized_job_designation} (Experience: {payload.experienceMin}-{payload.experienceMax} years)"
        else:
            technical_skills_str = ", ".join(technical_skills)
            description = f"Assessment for {sanitized_job_designation} - Skills: {technical_skills_str} (Experience: {payload.experienceMin}-{payload.experienceMax} years)"
        
        # Ensure we have at least one question type
        if not all_question_types:
            all_question_types = ["Subjective"]  # Fallback
        
        # Generate a default title if not provided
        default_title = f"Assessment for {sanitized_job_designation}"
        if is_aptitude and has_technical_topics:
            default_title = f"Mixed Assessment: {sanitized_job_designation}"
        elif is_aptitude:
            default_title = f"Aptitude Assessment: {sanitized_job_designation}"
        
        if existing_assessment:
            # UPDATE EXISTING ASSESSMENT: Replace all topics and clear questions
            existing_assessment["topics"] = topic_docs  # Replace all topics
            existing_assessment["customTopics"] = custom_topics
            existing_assessment["assessmentType"] = assessment_types if assessment_types else ["technical"]
            existing_assessment["updatedAt"] = _now_utc()
            existing_assessment["jobDesignation"] = sanitized_job_designation
            existing_assessment["selectedSkills"] = sanitized_skills
            existing_assessment["experienceMin"] = payload.experienceMin
            existing_assessment["experienceMax"] = payload.experienceMax
            existing_assessment["experienceMode"] = experience_mode
            existing_assessment["availableQuestionTypes"] = all_question_types
            existing_assessment["isAptitudeAssessment"] = is_aptitude
            existing_assessment["codingLanguage"] = coding_language
            
            # Clear all questions from all topics (regeneration means fresh start)
            for topic_doc in topic_docs:
                topic_doc["questions"] = []
                topic_doc["numQuestions"] = 0
                topic_doc["questionConfigs"] = []
            
            # Update the assessment in database
            await _save_assessment(db, existing_assessment)
            assessment_doc = existing_assessment
            
            logger.info(f"Updated assessment {payload.assessmentId} with {len(topic_docs)} new topics. Cleared all questions.")
        else:
            # CREATE NEW ASSESSMENT
            assessment_doc: Dict[str, Any] = {
                "title": default_title,  # Set default title based on job designation
                "description": description,  # Use generated description
                "topics": topic_docs,
                "customTopics": custom_topics,
                "assessmentType": assessment_types if assessment_types else ["technical"],
                "status": "draft",
                "createdBy": to_object_id(current_user.get("id")),
                "organization": to_object_id(current_user.get("organization")) if current_user.get("organization") else None,
                "isGenerated": False,
                "createdAt": _now_utc(),
                "updatedAt": _now_utc(),
                "jobDesignation": sanitized_job_designation,
                "selectedSkills": sanitized_skills,
                "experienceMin": payload.experienceMin,
                "experienceMax": payload.experienceMax,
                "experienceMode": experience_mode,
                "availableQuestionTypes": all_question_types,
                "isAptitudeAssessment": is_aptitude,  # Flag for frontend (true if aptitude is included)
                "codingLanguage": coding_language,  # Store inferred coding language
            }
            
            result = await db.assessments.insert_one(assessment_doc)
            assessment_doc["_id"] = result.inserted_id
        
        return success_response(
            "Assessment created successfully" if not existing_assessment else "Assessment topics regenerated successfully",
            {
                "assessment": serialize_document(assessment_doc),
                "questionTypes": assessment_doc.get("availableQuestionTypes", ["MCQ"]),
            }
        )
    except Exception as exc:
        logger.error(f"Error creating assessment from job designation: {exc}")
        raise HTTPException(status_code=500, detail="Failed to create assessment") from exc


@router.post("/create-assessment-from-skill")
async def create_assessment_from_skill(
    payload: GenerateTopicsFromSkillRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Create a new assessment with topics from skill input, or update existing draft if one exists."""
    try:
        # SINGLE DRAFT LOGIC: Check for existing draft first
        existing_assessment = await _find_or_get_existing_draft(db, current_user)
        if existing_assessment:
            logger.info(f"Found existing draft {existing_assessment['_id']}, updating instead of creating new")
        
        experience_mode = payload.experienceMode if hasattr(payload, 'experienceMode') and payload.experienceMode else "corporate"
        topics = await generate_topics_from_skill(payload.skill, payload.experienceMin, payload.experienceMax, experience_mode)
        question_types = await get_relevant_question_types(payload.skill)
        
        # Sanitize user inputs to prevent XSS
        sanitized_skill = sanitize_text_field(payload.skill)
        sanitized_topics = [sanitize_text_field(topic) for topic in topics]
        
        if existing_assessment:
            # UPDATE EXISTING DRAFT
            existing_assessment["title"] = f"{sanitized_skill} Assessment"
            existing_assessment["description"] = f"Assessment for {sanitized_skill} (Experience: {payload.experienceMin}-{payload.experienceMax} years)"
            existing_assessment["topics"] = [
                {
                    "topic": topic,
                    "numQuestions": 0,
                    "questionTypes": [],
                    "difficulty": "Medium",
                    "source": "AI",
                    "category": "technical",
                    "questions": [],
                    "questionConfigs": [],
                }
                for topic in sanitized_topics
            ]
            existing_assessment["customTopics"] = sanitized_topics
            existing_assessment["assessmentType"] = ["technical"]
            existing_assessment["status"] = "draft"
            existing_assessment["skill"] = sanitized_skill
            existing_assessment["experienceMin"] = payload.experienceMin
            existing_assessment["experienceMax"] = payload.experienceMax
            existing_assessment["availableQuestionTypes"] = question_types
            existing_assessment["updatedAt"] = _now_utc()
            
            await _save_assessment(db, existing_assessment)
            assessment_doc = existing_assessment
        else:
            # CREATE NEW DRAFT
            assessment_doc: Dict[str, Any] = {
                "title": f"{sanitized_skill} Assessment",
                "description": f"Assessment for {sanitized_skill} (Experience: {payload.experienceMin}-{payload.experienceMax} years)",
                "topics": [
                    {
                        "topic": topic,
                        "numQuestions": 0,
                        "questionTypes": [],
                        "difficulty": "Medium",
                        "source": "AI",
                        "category": "technical",
                        "questions": [],
                        "questionConfigs": [],
                    }
                    for topic in sanitized_topics
                ],
                "customTopics": sanitized_topics,
                "assessmentType": ["technical"],
                "status": "draft",
                "createdBy": to_object_id(current_user.get("id")),
                "organization": to_object_id(current_user.get("organization")) if current_user.get("organization") else None,
                "isGenerated": False,
                "createdAt": _now_utc(),
                "updatedAt": _now_utc(),
                "skill": sanitized_skill,
                "experienceMin": payload.experienceMin,
                "experienceMax": payload.experienceMax,
                "availableQuestionTypes": question_types,
            }
            
            result = await db.assessments.insert_one(assessment_doc)
            assessment_doc["_id"] = result.inserted_id
        
        return success_response(
            "Assessment created successfully",
            {
                "assessment": serialize_document(assessment_doc),
                "questionTypes": question_types,
            }
        )
    except Exception as exc:
        logger.error(f"Error creating assessment from skill: {exc}")
        raise HTTPException(status_code=500, detail="Failed to create assessment") from exc


@router.post("/suggest-time-score")
async def suggest_time_score(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Get AI suggestions for time and score for a question."""
    question = payload.get("question")
    if not question:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question is required")
    
    try:
        suggestion = await suggest_time_and_score(question)
        return success_response("Time and score suggested successfully", suggestion)
    except Exception as exc:
        logger.error(f"Error suggesting time and score: {exc}")
        raise HTTPException(status_code=500, detail="Failed to suggest time and score") from exc


# NOTE: generate-questions-from-config endpoint moved to api/v2/assessments/routers.py


def _build_generation_config(topic_obj: Dict[str, Any]) -> Dict[str, Any]:
    config = {"numQuestions": topic_obj.get("numQuestions", 0)}
    question_configs = topic_obj.get("questionConfigs") or []
    
    # For aptitude topics, always use MCQ only
    if topic_obj.get("category") == "aptitude":
        num_questions = topic_obj.get("numQuestions", 0)
        difficulty = topic_obj.get("difficulty", "Medium")
        for index in range(num_questions):
            config[f"Q{index + 1}type"] = "MCQ"
            config[f"Q{index + 1}difficulty"] = difficulty
        return config
    
    if question_configs:
        for index, q_config in enumerate(question_configs):
            config[f"Q{index + 1}type"] = q_config.get("type", "Subjective")
            config[f"Q{index + 1}difficulty"] = q_config.get("difficulty", "Medium")
    else:
        question_types = topic_obj.get("questionTypes") or []
        # For technical topics, use only the first question type if multiple are selected
        q_type = question_types[0] if question_types else "Subjective"
        for index in range(topic_obj.get("numQuestions", 0)):
            config[f"Q{index + 1}type"] = q_type
            config[f"Q{index + 1}difficulty"] = topic_obj.get("difficulty", "Medium")
    return config


# Rate limiting for AI generation (3 requests/min/user)
# Import will be added at top of file
@router.post("/generate-questions")
async def generate_questions(
    payload: GenerateQuestionsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    assessment = await _get_assessment(db, payload.assessmentId)
    _check_assessment_access(assessment, current_user)

    topics = [
        t
        for t in assessment.get("topics", [])
        if t.get("numQuestions", 0) > 0
        and (
            (t.get("questionTypes") and len(t["questionTypes"]) > 0)
            or (t.get("questionConfigs") and len(t["questionConfigs"]) > 0)
        )
    ]
    if not topics:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid topics for question generation")

    results = []
    failed_topics = []
    
    for topic in topics:
        topic = _ensure_topic_structure(topic)
        config = _build_generation_config(topic)
        expected_count = topic.get("numQuestions", 0)
        
        # Retry logic for each topic
        max_retries = 2
        generated_questions = []
        
        for retry in range(max_retries):
            try:
                generated_questions = await generate_questions_for_topic_safe(topic.get("topic"), config)
                # Check if we got enough questions
                if len(generated_questions) >= expected_count:
                    break
                elif retry < max_retries - 1:
                    logger.warning(f"Topic '{topic.get('topic')}' generated only {len(generated_questions)}/{expected_count} questions. Retrying...")
                    await asyncio.sleep(1)  # Brief delay before retry
                else:
                    logger.warning(f"Topic '{topic.get('topic')}' generated only {len(generated_questions)}/{expected_count} questions after retries.")
            except Exception as exc:
                logger.error(f"Error generating questions for topic '{topic.get('topic')}': {exc}")
                if retry < max_retries - 1:
                    await asyncio.sleep(1)
                else:
                    failed_topics.append(topic.get("topic"))
                    break
        
        # If we got some questions but not all, still use what we have
        if generated_questions:
            existing_questions = topic.get("questions", [])
            merged_questions: List[Dict[str, Any]] = []
            for index, new_question in enumerate(generated_questions):
                if index < len(existing_questions):
                    merged = existing_questions[index].copy()
                    merged.update(new_question)
                else:
                    merged = new_question
                
                # Auto-generate time and score if not already set
                if "time" not in merged or "score" not in merged:
                    try:
                        time_score = await suggest_time_and_score(merged)
                        merged["time"] = time_score.get("time", 10)
                        merged["score"] = time_score.get("score", 5)
                    except Exception as exc:
                        logger.warning(f"Failed to generate time/score for question, using defaults: {exc}")
                        merged["time"] = merged.get("time", 10)
                        merged["score"] = merged.get("score", 5)
                
                merged_questions.append(merged)
            topic["questions"] = merged_questions
            results.append({"topic": topic.get("topic"), "questions": merged_questions, "expected": expected_count, "generated": len(merged_questions)})
        else:
            failed_topics.append(topic.get("topic"))
    
    # Save assessment even if some topics failed
    assessment["isGenerated"] = True
    assessment["status"] = "draft"
    await _save_assessment(db, assessment)
    
    if failed_topics:
        logger.warning(f"Failed to generate questions for topics: {failed_topics}")
        if not results:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate questions for all topics: {', '.join(failed_topics)}"
            )
    
    return success_response(
        "Questions generated and saved successfully",
        {
            "results": results,
            "failedTopics": failed_topics if failed_topics else None,
            "summary": {
                "totalTopics": len(topics),
                "successfulTopics": len(results),
                "failedTopics": len(failed_topics),
                "totalQuestions": sum(len(r["questions"]) for r in results)
            }
        }
    )


@router.put("/update-questions")
async def update_questions(
    payload: UpdateQuestionsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    assessment = await _get_assessment(db, payload.assessmentId)
    _check_assessment_access(assessment, current_user)

    topic = next((t for t in assessment.get("topics", []) if t.get("topic") == payload.topic), None)
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found in assessment")

    # Update questions, preserving all properties including time and score
    topic["questions"] = [q.model_dump(exclude_unset=True) for q in payload.updatedQuestions]
    assessment["status"] = "draft"
    await _save_assessment(db, assessment)
    return success_response(
        "Updated questions saved successfully",
        {
            "topic": topic.get("topic"),
            "questions": topic["questions"],
            "totalQuestions": len(topic["questions"]),
        },
    )


@router.put("/update-single-question")
async def update_single_question(
    payload: UpdateSingleQuestionRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    assessment = await _get_assessment(db, payload.assessmentId)
    _check_assessment_access(assessment, current_user)

    topic = next((t for t in assessment.get("topics", []) if t.get("topic") == payload.topic), None)
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found in assessment")

    questions = topic.get("questions", [])
    if payload.questionIndex >= len(questions):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    updated_question = questions[payload.questionIndex]
    updated_question.update(payload.updatedQuestion.model_dump(exclude_unset=True))
    updated_question["updatedAt"] = _now_utc()
    assessment["status"] = "draft"
    await _save_assessment(db, assessment)
    return success_response(
        "Question updated successfully",
        {
            "topic": topic.get("topic"),
            "questionIndex": payload.questionIndex,
            "question": updated_question,
        },
    )


@router.post("/add-question")
async def add_new_question(
    payload: AddNewQuestionRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    assessment = await _get_assessment(db, payload.assessmentId)
    _check_assessment_access(assessment, current_user)

    topic = next((t for t in assessment.get("topics", []) if t.get("topic") == payload.topic), None)
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found in assessment")

    topic = _ensure_topic_structure(topic)
    question = payload.newQuestion.model_dump(exclude_unset=True)
    question["createdAt"] = _now_utc()
    question["updatedAt"] = _now_utc()
    topic["questions"].append(question)
    assessment["status"] = "draft"
    await _save_assessment(db, assessment)
    return success_response(
        "Question added successfully",
        {
            "topic": topic.get("topic"),
            "question": question,
            "questionIndex": len(topic["questions"]) - 1,
            "totalQuestions": len(topic["questions"]),
        },
    )


@router.delete("/delete-question")
async def delete_question(
    payload: DeleteQuestionRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    assessment = await _get_assessment(db, payload.assessmentId)
    _check_assessment_access(assessment, current_user)

    topic = next((t for t in assessment.get("topics", []) if t.get("topic") == payload.topic), None)
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found in assessment")

    questions = topic.get("questions", [])
    if payload.questionIndex >= len(questions):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    deleted_question = questions.pop(payload.questionIndex)
    assessment["status"] = "draft"
    await _save_assessment(db, assessment)
    return success_response(
        "Question deleted successfully",
        {
            "topic": topic.get("topic"),
            "deletedQuestion": deleted_question,
            "totalQuestions": len(questions),
        },
    )


@router.post("/finalize-assessment")
async def finalize_assessment(
    payload: FinalizeAssessmentRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Finalize assessment by converting draft to ready status.
    SINGLE DRAFT LOGIC: Converts the existing draft, does NOT create new assessment.
    """
    try:
        logger.info("=" * 80)
        logger.info("[FINALIZE] Starting assessment finalization")
        logger.info(f"[FINALIZE] Assessment ID: {payload.assessmentId}")
        logger.info(f"[FINALIZE] Received scoringRules in payload: {payload.scoringRules}")
        logger.info(f"[FINALIZE] Received passPercentage in payload: {payload.passPercentage}")
        logger.info(f"[FINALIZE] Received enablePerSectionTimers: {payload.enablePerSectionTimers}")
        logger.info(f"[FINALIZE] Received sectionTimers: {payload.sectionTimers}")
        
        assessment = await _get_assessment(db, payload.assessmentId)
        _check_assessment_access(assessment, current_user)
        
        logger.info(f"[FINALIZE] Current assessment status: {assessment.get('status')}")
        logger.info(f"[FINALIZE] Existing scoringRules in assessment: {assessment.get('scoringRules')}")
        logger.info(f"[FINALIZE] Existing passPercentage in assessment: {assessment.get('passPercentage')}")
        
        # Ensure it's a draft before finalizing
        if assessment.get("status") not in {"draft", "ready"}:
            raise HTTPException(status_code=400, detail="Only draft assessments can be finalized")

        # CONVERT DRAFT TO FINAL: Update status and add finalized timestamp
        assessment["status"] = "ready"
        if payload.title:
            assessment["title"] = sanitize_text_field(payload.title)
        if payload.description:
            assessment["description"] = sanitize_text_field(payload.description)
        if payload.questionTypeTimes:
            assessment["questionTypeTimes"] = payload.questionTypeTimes
        if payload.enablePerSectionTimers is not None:
            assessment["enablePerSectionTimers"] = payload.enablePerSectionTimers
        if payload.sectionTimers is not None:
            assessment["sectionTimers"] = payload.sectionTimers
        if payload.scoringRules is not None:
            assessment["scoringRules"] = payload.scoringRules
            logger.info("=" * 80)
            logger.info(f"[FINALIZE] ✓ SAVING scoringRules from payload")
            logger.info(f"[FINALIZE] ScoringRules value: {payload.scoringRules}")
            logger.info(f"[FINALIZE] ScoringRules type: {type(payload.scoringRules)}")
            logger.info(f"[FINALIZE] ScoringRules keys: {list(payload.scoringRules.keys()) if isinstance(payload.scoringRules, dict) else 'N/A'}")
            logger.info(f"[FINALIZE] ScoringRules values: {payload.scoringRules}")
            logger.info("=" * 80)
        elif assessment.get("scoringRules"):
            # Preserve existing scoringRules if not provided
            logger.info("=" * 80)
            logger.info(f"[FINALIZE] ⚠ No scoringRules in payload, preserving existing")
            logger.info(f"[FINALIZE] Existing scoringRules: {assessment.get('scoringRules')}")
            logger.info("=" * 80)
        else:
            logger.warning("=" * 80)
            logger.warning(f"[FINALIZE] ❌ ERROR: No scoringRules provided and none exist in assessment!")
            logger.warning(f"[FINALIZE] This will cause max_marks to default to 1.0 for all questions")
            logger.warning("=" * 80)
        if payload.passPercentage is not None:
            assessment["passPercentage"] = payload.passPercentage
        else:
            # Preserve existing passPercentage if not provided
            if "passPercentage" not in assessment:
                assessment["passPercentage"] = 50  # Default to 50%
                logger.info(f"[FINALIZE] Setting default passPercentage: 50%")
        
        assessment["finalizedAt"] = _now_utc()
        assessment["updatedAt"] = _now_utc()
        
        # Generate assessment token if it doesn't exist
        if not assessment.get("assessmentToken"):
            assessment["assessmentToken"] = secrets.token_urlsafe(32)
        
        # Save the converted draft (same document, status changed to "ready")
        await _save_assessment(db, assessment)
        
        # Auto-send invitations if not sent manually (private mode only)
        candidates = assessment.get("candidates", [])
        access_mode = assessment.get("accessMode", "public")
        assessment_url = assessment.get("assessmentUrl")
        
        if access_mode == "private" and candidates and assessment_url:
            # Check if any candidates haven't been invited
            candidates_not_invited = [c for c in candidates if not c.get("invited", False)]
            
            if candidates_not_invited:
                try:
                    # Use stored template or default template
                    stored_template = assessment.get("invitationTemplate", {})
                    default_template = {
                        "logoUrl": "",
                        "companyName": "",
                        "message": "You have been invited to take an assessment. Please click the link below to start.",
                        "footer": "",
                        "sentBy": "AI Assessment Platform"
                    }
                    template_to_use = stored_template if stored_template else default_template
                    
                    # Send invitations
                    from ....utils.email import get_email_service
                    from ....config.settings import get_settings
                    settings = get_settings()
                    
                    if settings.sendgrid_api_key and settings.sendgrid_from_email:
                        email_service = get_email_service()
                        sent_count = 0
                        
                        for candidate in candidates_not_invited:
                            email = candidate.get("email", "").strip().lower()
                            name = candidate.get("name", "").strip()
                            
                            if not email or not name:
                                continue
                            
                            # Build email content
                            import urllib.parse
                            encoded_email = urllib.parse.quote(email)
                            encoded_name = urllib.parse.quote(name)
                            exam_url_with_params = f"{assessment_url}?email={encoded_email}&name={encoded_name}"
                            
                            # Replace placeholders
                            message = template_to_use.get("message", default_template["message"])
                            email_body = message
                            email_body = email_body.replace("{{candidate_name}}", name)
                            email_body = email_body.replace("{{candidate_email}}", email)
                            email_body = email_body.replace("{{exam_url}}", exam_url_with_params)
                            email_body = email_body.replace("{{company_name}}", template_to_use.get("companyName", ""))
                            
                            # Build HTML email
                            logo_url = template_to_use.get("logoUrl", "")
                            company_name = template_to_use.get("companyName", "")
                            footer = template_to_use.get("footer", "")
                            sent_by = template_to_use.get("sentBy", "AI Assessment Platform")
                            
                            html_content = f"""
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <style>
                                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                                    .header {{ text-align: center; margin-bottom: 30px; }}
                                    .logo {{ max-width: 200px; margin-bottom: 20px; }}
                                    .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
                                    .button {{ display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                                    .footer {{ text-align: center; color: #64748b; font-size: 0.875rem; margin-top: 30px; }}
                                    .candidate-info {{ background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #3b82f6; }}
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="header">
                                        {f'<img src="{logo_url}" alt="Logo" class="logo" />' if logo_url else ''}
                                        {f'<h1>{company_name}</h1>' if company_name else ''}
                                    </div>
                                    <div class="content">
                                        <p>Dear {name},</p>
                                        <p>{email_body}</p>
                                        <div class="candidate-info">
                                            <p><strong>Your Details:</strong></p>
                                            <p><strong>Name:</strong> {name}</p>
                                            <p><strong>Email:</strong> {email}</p>
                                        </div>
                                        <div style="text-align: center;">
                                            <a href="{exam_url_with_params}" class="button">Start Assessment</a>
                                        </div>
                                    </div>
                                    {f'<div class="footer"><p>{footer}</p></div>' if footer else ''}
                                    <div class="footer">
                                        <p>Sent by {sent_by}</p>
                                    </div>
                                </div>
                            </body>
                            </html>
                            """
                            
                            subject = f"Assessment Invitation - {company_name if company_name else 'AI Assessment Platform'}"
                            
                            try:
                                await email_service.send_email(email, subject, html_content)
                                sent_count += 1
                                
                                # Update candidate invite status
                                for idx, c in enumerate(candidates):
                                    if c.get("email", "").lower() == email:
                                        candidates[idx]["invited"] = True
                                        candidates[idx]["inviteSentAt"] = _now_utc().isoformat()
                                        break
                                
                                assessment["candidates"] = candidates
                                await _save_assessment(db, assessment)
                            except Exception as email_err:
                                logger.warning(f"Failed to auto-send invitation to {email}: {email_err}")
                                # Continue with other candidates even if one fails
                        
                        if sent_count > 0:
                            logger.info(f"Auto-sent {sent_count} invitation(s) during finalization")
                except Exception as auto_invite_err:
                    # Don't block finalization if auto-send fails
                    logger.warning(f"Error during auto-send invitations: {auto_invite_err}")
        
        # Serialize the assessment document before returning
        serialized_assessment = serialize_document(assessment)
        if serialized_assessment is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to serialize assessment document",
            )
        
        return success_response("Assessment finalized successfully", serialized_assessment)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error finalizing assessment: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to finalize assessment: {str(exc)}",
        ) from exc


@router.get("/get-questions")
async def get_questions_by_topic(
    assessmentId: str = Query(..., alias="assessmentId"),
    topic: str = Query(...),
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    assessment = await _get_assessment(db, assessmentId)
    _check_assessment_access(assessment, current_user)

    topic_obj = next((t for t in assessment.get("topics", []) if t.get("topic") == topic), None)
    if not topic_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    return success_response("Questions fetched successfully", topic_obj.get("questions", []))


@router.get("/{assessment_id}/header")
async def get_assessment_header(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    assessment = await _get_assessment(db, assessment_id)
    _check_assessment_access(assessment, current_user)

    data = {
        "id": str(assessment.get("_id")),
        "title": assessment.get("title"),
        "status": assessment.get("status"),
        "hasSchedule": bool(assessment.get("schedule")),
    }
    return success_response("Assessment header fetched successfully", data)


@router.get("/{assessment_id}/schedule")
async def get_assessment_schedule(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    assessment = await _get_assessment(db, assessment_id)
    _check_assessment_access(assessment, current_user)

    data = {
        "assessmentId": str(assessment.get("_id")),
        "title": assessment.get("title"),
        "status": assessment.get("status"),
        "schedule": assessment.get("schedule"),
    }
    return success_response("Assessment schedule fetched successfully", data)


@router.get("/get-current-draft")
async def get_current_draft(
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get the current draft assessment for the user. Returns None if no draft exists."""
    try:
        draft = await _find_or_get_existing_draft(db, current_user)
        if draft:
            return success_response("Draft found", serialize_document(draft))
        else:
            return success_response("No draft found", None)
    except Exception as exc:
        logger.error(f"Error fetching current draft: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch draft") from exc


@router.put("/update-draft")
async def update_assessment_draft(
    payload: UpdateAssessmentDraftRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update assessment draft data (preserves placeholder data). SINGLE DRAFT: Always updates the same draft."""
    logger.info("=" * 80)
    logger.info("[UPDATE_DRAFT] Starting draft update")
    logger.info(f"[UPDATE_DRAFT] Assessment ID: {payload.assessmentId}")
    logger.info(f"[UPDATE_DRAFT] Received scoringRules: {payload.scoringRules}")
    logger.info(f"[UPDATE_DRAFT] Received passPercentage: {payload.passPercentage}")
    logger.info(f"[UPDATE_DRAFT] Received enablePerSectionTimers: {payload.enablePerSectionTimers}")
    logger.info(f"[UPDATE_DRAFT] Received sectionTimers: {payload.sectionTimers}")
    
    # SINGLE DRAFT LOGIC: If assessmentId is provided, use it. Otherwise, find existing draft.
    if payload.assessmentId:
        try:
            assessment = await _get_assessment(db, payload.assessmentId)
            _check_assessment_access(assessment, current_user)
            # Allow updates for draft and paused assessments (paused assessments need schedule updates)
            current_status = assessment.get("status")
            if current_status not in ["draft", "paused"]:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Assessment cannot be updated (current status: {current_status}). Only 'draft' or 'paused' assessments can be updated via this endpoint."
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching assessment {payload.assessmentId}: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to fetch assessment: {str(e)}")
    else:
        # Find existing draft
        assessment = await _find_or_get_existing_draft(db, current_user)
        if not assessment:
            # Create a new minimal draft if none exists
            user_id = to_object_id(current_user.get("id"))
            user_org = current_user.get("organization")
            
            new_assessment = {
                "_id": ObjectId(),
                "title": payload.title or "New Assessment",
                "description": payload.description or "",
                "status": "draft",
                "createdBy": user_id,
                "createdAt": _now_utc(),
                "updatedAt": _now_utc(),
                "jobDesignation": payload.jobDesignation or "",
                "selectedSkills": payload.selectedSkills or [],
                "experienceMin": payload.experienceMin if payload.experienceMin is not None else 0,
                "experienceMax": payload.experienceMax if payload.experienceMax is not None else 10,
                "experienceMode": payload.experienceMode or "corporate",
                "topics": [],
                "topics_v2": [],
                "questions": [],
                "auditLogs": [],
                "companyContext": payload.companyContext or "",
                "contextSummary": payload.contextSummary if payload.contextSummary else None,
            }
            
            if user_org:
                new_assessment["organization"] = to_object_id(user_org)
            
            await db.assessments.insert_one(new_assessment)
            assessment = new_assessment
    
    # Update title and description (even if empty/placeholder)
    if payload.title is not None:
        assessment["title"] = sanitize_text_field(payload.title) if payload.title else ""
    if payload.description is not None:
        assessment["description"] = sanitize_text_field(payload.description) if payload.description else ""
    
    # Update job designation and skills
    if payload.jobDesignation is not None:
        assessment["jobDesignation"] = sanitize_text_field(payload.jobDesignation) if payload.jobDesignation else ""
    if payload.selectedSkills is not None:
        assessment["selectedSkills"] = [sanitize_text_field(skill) for skill in payload.selectedSkills] if payload.selectedSkills else []
    if payload.experienceMin is not None:
        assessment["experienceMin"] = payload.experienceMin
    if payload.experienceMax is not None:
        assessment["experienceMax"] = payload.experienceMax
    if payload.experienceMode is not None:
        # Validate experience mode
        if payload.experienceMode not in ["corporate", "student"]:
            raise HTTPException(status_code=400, detail="experienceMode must be either 'corporate' or 'student'")
        assessment["experienceMode"] = payload.experienceMode
    
    # Update topics if provided
    if payload.topics is not None:
        # Convert topic configs to the format expected by the assessment
        updated_topics = []
        for topic_config in payload.topics:
            topic_name = sanitize_text_field(topic_config.get("topic", ""))
            if not topic_name:
                continue
                
            # Check if topic already exists
            existing_topic = next((t for t in assessment.get("topics", []) if t.get("topic") == topic_name), None)
            
            if existing_topic:
                # Update existing topic
                topic_obj = existing_topic
            else:
                # Create new topic
                topic_obj = {
                    "topic": topic_name,
                    "numQuestions": 0,
                    "questionTypes": [],
                    "difficulty": "Medium",
                    "source": "manual",
                    "category": "technical",
                    "questions": [],
                    "questionConfigs": [],
                }
            
            # Update topic with question type configs
            question_type_configs = topic_config.get("questionTypeConfigs", [])
            if question_type_configs:
                topic_obj["questionTypes"] = [qtc.get("questionType") for qtc in question_type_configs if qtc.get("questionType")]
                topic_obj["questionConfigs"] = []
                total_questions = 0
                
                for qtc in question_type_configs:
                    q_type = qtc.get("questionType", "MCQ")
                    difficulty = qtc.get("difficulty", "Medium")
                    num_questions = qtc.get("numQuestions", 1)
                    
                    for i in range(num_questions):
                        q_config = {
                            "questionNumber": total_questions + i + 1,
                            "type": q_type,
                            "difficulty": difficulty,
                        }
                        if q_type == "coding":
                            q_config["judge0_enabled"] = qtc.get("judge0_enabled", True)
                            if qtc.get("language"):
                                q_config["language"] = qtc.get("language")
                        topic_obj["questionConfigs"].append(q_config)
                    
                    total_questions += num_questions
                
                topic_obj["numQuestions"] = total_questions
                topic_obj["difficulty"] = question_type_configs[0].get("difficulty", "Medium")
            
            # Handle aptitude topic fields
            if topic_config.get("isAptitude"):
                topic_obj["isAptitude"] = True
                topic_obj["category"] = "aptitude"
                if topic_config.get("subTopic"):
                    topic_obj["subTopic"] = sanitize_text_field(topic_config.get("subTopic"))
                if topic_config.get("aptitudeStructure"):
                    topic_obj["aptitudeStructure"] = topic_config.get("aptitudeStructure")
                if topic_config.get("availableSubTopics"):
                    topic_obj["availableSubTopics"] = topic_config.get("availableSubTopics")
            else:
                # Handle technical topic fields
                topic_obj["isAptitude"] = False
                topic_obj["category"] = "technical"
                # Preserve coding_supported if provided
                if topic_config.get("coding_supported") is not None:
                    topic_obj["coding_supported"] = topic_config.get("coding_supported")
            
            updated_topics.append(topic_obj)
        
        # Update assessment topics
        assessment["topics"] = updated_topics
    
    # Update topics_v2 if provided (new structure) - check both direct field and draft wrapper
    if payload.topics_v2 is not None:
        assessment["topics_v2"] = payload.topics_v2
    elif payload.draft and "topics_v2" in payload.draft:
        assessment["topics_v2"] = payload.draft["topics_v2"]
    
    # Update combinedSkills if provided in draft
    if payload.draft and "combinedSkills" in payload.draft:
        assessment["combinedSkills"] = payload.draft["combinedSkills"]
    
    # Update questions if provided
    if payload.questions is not None:
        assessment["questions"] = payload.questions
    
    # Update questionTypeTimes independently (can be set without questions)
    if payload.questionTypeTimes is not None:
        assessment["questionTypeTimes"] = payload.questionTypeTimes
    
    # Update enablePerSectionTimers independently
    if payload.enablePerSectionTimers is not None:
        assessment["enablePerSectionTimers"] = payload.enablePerSectionTimers
    
    # Update sectionTimers independently
    if payload.sectionTimers is not None:
        assessment["sectionTimers"] = payload.sectionTimers
    
    # Update scoringRules independently (can be set from review station)
    if payload.scoringRules is not None:
        logger.info("=" * 80)
        logger.info("[UPDATE_DRAFT] Updating scoringRules")
        logger.info(f"[UPDATE_DRAFT] Received scoringRules: {payload.scoringRules}")
        logger.info(f"[UPDATE_DRAFT] ScoringRules type: {type(payload.scoringRules)}")
        logger.info(f"[UPDATE_DRAFT] ScoringRules keys: {list(payload.scoringRules.keys()) if isinstance(payload.scoringRules, dict) else 'N/A'}")
        assessment["scoringRules"] = payload.scoringRules
        logger.info(f"[UPDATE_DRAFT] ✓ ScoringRules updated in assessment object")
        logger.info("=" * 80)
    
    # Update passPercentage independently (can be set from review station)
    if payload.passPercentage is not None:
        logger.info(f"[UPDATE_DRAFT] Updating passPercentage: {payload.passPercentage}")
        assessment["passPercentage"] = payload.passPercentage
    
    # Update schedule if provided
    if payload.schedule is not None:
        # Merge into existing schedule instead of overwriting to preserve
        # additional fields like candidateRequirements and proctoringSettings.
        existing_schedule = assessment.get("schedule") or {}
        merged_schedule = existing_schedule.copy()
        merged_schedule.update(payload.schedule)
        assessment["schedule"] = merged_schedule
    
    # Update additionalRequirements if provided
    if payload.additionalRequirements is not None:
        assessment["additionalRequirements"] = sanitize_text_field(payload.additionalRequirements) if payload.additionalRequirements else ""
    
    # Update companyContext if provided (new unified field)
    if payload.companyContext is not None:
        assessment["companyContext"] = sanitize_text_field(payload.companyContext) if payload.companyContext else ""
    
    # Update contextSummary if provided (processed context from URL or text)
    if payload.contextSummary is not None:
        assessment["contextSummary"] = payload.contextSummary
    
    # Update candidates if provided
    if payload.candidates is not None:
        assessment["candidates"] = payload.candidates
    
    # Update assessment URL if provided
    if payload.assessmentUrl is not None:
        assessment["assessmentUrl"] = payload.assessmentUrl
    
    # Preserve status: keep as draft if draft, keep as paused if paused
    # Don't overwrite paused status with draft
    current_status = assessment.get("status")
    if current_status != "paused":
        assessment["status"] = "draft"
    # If paused, keep it paused (don't change status)
    
    assessment["updatedAt"] = _now_utc()
    
    # Log what will be saved before saving
    logger.info("=" * 80)
    logger.info("[UPDATE_DRAFT] About to save draft assessment:")
    logger.info(f"[UPDATE_DRAFT]   scoringRules: {assessment.get('scoringRules')}")
    logger.info(f"[UPDATE_DRAFT]   passPercentage: {assessment.get('passPercentage')}")
    logger.info(f"[UPDATE_DRAFT]   status: {assessment.get('status')}")
    logger.info("=" * 80)
    
    await _save_assessment(db, assessment)
    
    # Verify what was actually saved
    saved_assessment = await _get_assessment(db, payload.assessmentId)
    logger.info("=" * 80)
    logger.info("[UPDATE_DRAFT] ✓ Draft saved. Verifying saved values:")
    logger.info(f"[UPDATE_DRAFT]   Saved scoringRules: {saved_assessment.get('scoringRules')}")
    logger.info(f"[UPDATE_DRAFT]   Saved passPercentage: {saved_assessment.get('passPercentage')}")
    if saved_assessment.get('scoringRules') and isinstance(saved_assessment.get('scoringRules'), dict) and len(saved_assessment.get('scoringRules')) > 0:
        logger.info(f"[UPDATE_DRAFT] ✓ SUCCESS: scoringRules were saved correctly!")
    else:
        logger.error(f"[UPDATE_DRAFT] ❌ FAILED: scoringRules were NOT saved correctly or are empty!")
    logger.info("=" * 80)
    
    return success_response("Draft updated successfully", serialize_document(assessment))


@router.post("/update-schedule-and-candidates")
async def update_schedule_and_candidates(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update assessment schedule and candidates."""
    assessment_id = payload.get("assessmentId")
    if not assessment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assessment ID is required")
    
    assessment = await _get_assessment(db, assessment_id)
    _check_assessment_access(assessment, current_user)

    # Update schedule - MERGE into existing schedule to preserve extra settings
    # such as candidateRequirements and proctoringSettings.
    existing_schedule = assessment.get("schedule") or {}
    schedule = existing_schedule.copy()
    
    # Update schedule with new timer fields (Custom-MCQ style)
    schedule_update = {
        "timezone": "Asia/Kolkata",  # IST
    }
    
    # Add startTime (required for both modes)
    if payload.get("startTime"):
        schedule_update["startTime"] = payload.get("startTime")
    
    # Add endTime (only for flexible mode)
    if payload.get("endTime"):
        schedule_update["endTime"] = payload.get("endTime")
    
    # Add examMode (strict or flexible)
    if payload.get("examMode"):
        schedule_update["examMode"] = payload.get("examMode")
        assessment["examMode"] = payload.get("examMode")
    
    # Add duration (required, in minutes)
    if payload.get("duration"):
        schedule_update["duration"] = payload.get("duration")
        assessment["duration"] = payload.get("duration")
    
    # Remove accessTimeBeforeStart if it exists (no longer used)
    if "accessTimeBeforeStart" in schedule_update:
        del schedule_update["accessTimeBeforeStart"]
    if "accessTimeBeforeStart" in assessment:
        del assessment["accessTimeBeforeStart"]
    
    schedule.update(schedule_update)
    assessment["schedule"] = schedule
    
    # Save per-section timer settings if provided
    if payload.get("enablePerSectionTimers"):
        assessment["enablePerSectionTimers"] = True
        if payload.get("sectionTimers"):
            assessment["sectionTimers"] = payload.get("sectionTimers")
    else:
        # If explicitly disabled, remove the fields
        if "enablePerSectionTimers" in assessment:
            del assessment["enablePerSectionTimers"]
        if "sectionTimers" in assessment:
            del assessment["sectionTimers"]
    
    # Remove old timer mode fields if they exist
    if "timerMode" in assessment:
        del assessment["timerMode"]
    if "sectionTotalTime" in assessment:
        del assessment["sectionTotalTime"]
    if "scheduledWindowTime" in assessment:
        del assessment["scheduledWindowTime"]
    if "examDuration" in assessment:
        del assessment["examDuration"]
    if "questionTypeTimes" in assessment:
        del assessment["questionTypeTimes"]

    # Update candidates - NORMALIZE EMAIL AND NAME
    candidates = payload.get("candidates", [])
    normalized_candidates = []
    for candidate in candidates:
        if isinstance(candidate, dict):
            # Normalize email (lowercase + strip) and name (strip)
            normalized_candidate = {
                "email": candidate.get("email", "").strip().lower(),
                "name": candidate.get("name", "").strip(),
            }
            # Preserve any other fields from the original candidate object
            for key, value in candidate.items():
                if key not in ["email", "name"]:
                    normalized_candidate[key] = value
            normalized_candidates.append(normalized_candidate)
        else:
            # If it's not a dict, keep it as-is (shouldn't happen, but defensive coding)
            normalized_candidates.append(candidate)
    
    assessment["candidates"] = normalized_candidates

    # Update assessment URL and token
    assessment["assessmentUrl"] = payload.get("assessmentUrl")
    assessment["examAccessUrl"] = payload.get("assessmentUrl")  # Store as examAccessUrl for future-proofing
    assessment["assessmentToken"] = payload.get("token")
    
    # Store access mode
    access_mode = payload.get("accessMode", "private")
    assessment["accessMode"] = access_mode
    
    # Store invitation template if provided
    if payload.get("invitationTemplate"):
        assessment["invitationTemplate"] = payload.get("invitationTemplate")
    
    # If this is a completion request (Complete Assessment clicked), mark as active
    if payload.get("complete", False):
        assessment["status"] = "active"
        assessment["completed"] = True
        assessment["isDraft"] = False
        assessment["finalizedAt"] = _now_utc()
        # Ensure candidates keep their invited status
        for candidate in assessment.get("candidates", []):
            if candidate.get("invited"):
                candidate["invited"] = True

    await _save_assessment(db, assessment)
    return success_response("Schedule and candidates updated successfully", serialize_document(assessment))

@router.post("/send-invitations")
async def send_invitations(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Send email invitations to candidates using SendGrid with custom template."""
    from ....utils.email import get_email_service
    
    assessment_id = payload.get("assessmentId")
    if not assessment_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assessment ID is required")
    
    assessment = await _get_assessment(db, assessment_id)
    _check_assessment_access(assessment, current_user)
    
    candidates = payload.get("candidates", [])
    exam_url = payload.get("examUrl")
    template = payload.get("template", {})
    
    if not candidates or not exam_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Candidates and exam URL are required")
    
    # Get template values
    logo_url = template.get("logoUrl", "")
    company_name = template.get("companyName", "")
    message = template.get("message", "You have been invited to take an assessment. Please click the link below to start.")
    footer = template.get("footer", "")
    sent_by = template.get("sentBy", "AI Assessment Platform")
    
    # Get email service and verify it's configured
    from ....config.settings import get_settings
    settings = get_settings()
    
    # Check if SendGrid is configured
    if not settings.sendgrid_api_key or not settings.sendgrid_from_email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SendGrid is not configured. Please set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL environment variables."
        )
    
    email_service = get_email_service()
    
    sent_count = 0
    failed_emails = []
    error_messages = []
    skipped_emails = []  # Already invited candidates
    
    # Get existing candidates from assessment to check invite status
    existing_candidates = assessment.get("candidates", [])
    existing_candidates_dict = {
        c.get("email", "").strip().lower(): c 
        for c in existing_candidates 
        if c.get("email")
    }
    
    for candidate in candidates:
        email = candidate.get("email", "").strip().lower()
        name = candidate.get("name", "").strip()
        
        if not email or not name:
            failed_emails.append(email or "unknown")
            error_messages.append(f"Invalid candidate data: email={email}, name={name}")
            continue
        
        # Check if candidate has already been invited (unless forceResend is true)
        force_resend = payload.get("forceResend", False)
        existing_candidate = existing_candidates_dict.get(email)
        if existing_candidate and existing_candidate.get("invited") and not force_resend:
            # Candidate already received an invitation, skip (unless force resend)
            skipped_emails.append(email)
            logger.info(f"Skipping invitation to {email} - already invited on {existing_candidate.get('inviteSentAt', 'unknown date')}")
            continue
        
        # Encode candidate info in URL for auto-fill
        import urllib.parse
        encoded_email = urllib.parse.quote(email)
        encoded_name = urllib.parse.quote(name)
        exam_url_with_params = f"{exam_url}?email={encoded_email}&name={encoded_name}"
        
        # Replace placeholders in message
        email_body = message
        email_body = email_body.replace("{{candidate_name}}", name)
        email_body = email_body.replace("{{candidate_email}}", email)
        email_body = email_body.replace("{{exam_url}}", exam_url_with_params)
        email_body = email_body.replace("{{company_name}}", company_name)
        email_body = email_body.replace("{{custom_message}}", message)
        
        # Build HTML email with candidate details displayed
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .logo {{ max-width: 200px; margin-bottom: 20px; }}
                .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .footer {{ text-align: center; color: #64748b; font-size: 0.875rem; margin-top: 30px; }}
                .candidate-info {{ background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #3b82f6; }}
                .candidate-info p {{ margin: 5px 0; }}
                .candidate-info strong {{ color: #1e293b; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    {f'<img src="{logo_url}" alt="Logo" class="logo" />' if logo_url else ''}
                    {f'<h1>{company_name}</h1>' if company_name else ''}
                </div>
                <div class="content">
                    <p>Dear {name},</p>
                    <p>{email_body}</p>
                    
                    <div class="candidate-info">
                        <p><strong>Your Details:</strong></p>
                        <p><strong>Name:</strong> {name}</p>
                        <p><strong>Email:</strong> {email}</p>
                        <p style="font-size: 0.875rem; color: #64748b; margin-top: 10px;">
                            These details will be auto-filled when you start the assessment.
                        </p>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="{exam_url_with_params}" class="button">Start Assessment</a>
                    </div>
                </div>
                {f'<div class="footer"><p>{footer}</p></div>' if footer else ''}
                <div class="footer">
                    <p>Sent by {sent_by}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        subject = f"Assessment Invitation - {company_name if company_name else 'AI Assessment Platform'}"
        
        try:
            logger.info(f"Attempting to send invitation email to {email} via {settings.email_provider}")
            await email_service.send_email(email, subject, html_content)
            logger.info(f"Email sent successfully to {email}")
            sent_count += 1
            
            # Update candidate invite status in assessment
            candidates_list = assessment.get("candidates", [])
            for idx, c in enumerate(candidates_list):
                if c.get("email", "").lower() == email:
                    candidates_list[idx]["invited"] = True
                    candidates_list[idx]["inviteSentAt"] = datetime.now(timezone.utc).isoformat()
                    break
            
            assessment["candidates"] = candidates_list
            await _save_assessment(db, assessment)
            
        except Exception as exc:
            error_msg = f"Failed to send invitation to {email}: {str(exc)}"
            logger.error(error_msg, exc_info=True)
            failed_emails.append(email)
            error_messages.append(error_msg)
    
    # Only raise error if all candidates failed (not if some were skipped)
    if sent_count == 0 and len(failed_emails) > 0 and len(skipped_emails) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send all invitations. Errors: {', '.join(error_messages[:3])}"
        )
    
    message = f"Invitations sent to {sent_count} candidate(s)"
    if len(skipped_emails) > 0:
        message += f". {len(skipped_emails)} already invited (skipped): {', '.join(skipped_emails[:5])}"
    if len(failed_emails) > 0:
        message += f". {len(failed_emails)} failed: {', '.join(failed_emails[:5])}"
    
    return success_response(
        message,
        {
            "sentCount": sent_count,
            "failedCount": len(failed_emails),
            "skippedCount": len(skipped_emails),
            "failedEmails": failed_emails,
            "skippedEmails": skipped_emails,
            "errorMessages": error_messages,
        }
    )


@router.post("/{assessment_id}/add-candidate")
async def add_candidate_to_assessment(
    assessment_id: str,
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Add a single candidate to an active assessment and auto-send invitation."""
    from ....utils.email import get_email_service
    from ....config.settings import get_settings
    
    assessment = await _get_assessment(db, assessment_id)
    _check_assessment_access(assessment, current_user)
    
    # Only allow adding candidates to active assessments
    if assessment.get("status") not in {"active", "completed"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidates can only be added to active or completed assessments"
        )
    
    email = payload.get("email", "").strip().lower()
    name = payload.get("name", "").strip()
    
    if not email or not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and name are required"
        )
    
    # Validate email format
    import re
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid email address"
        )
    
    # Check if candidate already exists
    existing_candidates = assessment.get("candidates", [])
    for existing in existing_candidates:
        if existing.get("email", "").lower() == email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This candidate already exists in the list"
            )
    
    # Create new candidate object
    new_candidate = {
        "email": email,
        "name": name,
        "status": "invited",
        "invited": True,
        "invitedAt": _now_utc().isoformat(),
    }
    
    # Add candidate to assessment
    existing_candidates.append(new_candidate)
    assessment["candidates"] = existing_candidates
    
    # Auto-send invitation email
    assessment_url = assessment.get("assessmentUrl")
    if not assessment_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment URL not found. Please generate the assessment URL first."
        )
    
    # Get template (stored or default)
    stored_template = assessment.get("invitationTemplate", {})
    default_template = {
        "logoUrl": "",
        "companyName": "",
        "message": "You have been invited to take an assessment. Please click the link below to start.",
        "footer": "",
        "sentBy": "AI Assessment Platform"
    }
    template_to_use = stored_template if stored_template else default_template
    
    # Send invitation email
    settings = get_settings()
    if settings.sendgrid_api_key and settings.sendgrid_from_email:
        try:
            email_service = get_email_service()
            
            # Build exam URL with candidate params
            import urllib.parse
            encoded_email = urllib.parse.quote(email)
            encoded_name = urllib.parse.quote(name)
            exam_url_with_params = f"{assessment_url}?email={encoded_email}&name={encoded_name}"
            
            # Replace placeholders
            message = template_to_use.get("message", default_template["message"])
            email_body = message
            email_body = email_body.replace("{{candidate_name}}", name)
            email_body = email_body.replace("{{candidate_email}}", email)
            email_body = email_body.replace("{{exam_url}}", exam_url_with_params)
            email_body = email_body.replace("{{company_name}}", template_to_use.get("companyName", ""))
            
            # Build HTML email
            logo_url = template_to_use.get("logoUrl", "")
            company_name = template_to_use.get("companyName", "")
            footer = template_to_use.get("footer", "")
            sent_by = template_to_use.get("sentBy", "AI Assessment Platform")
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ text-align: center; margin-bottom: 30px; }}
                    .logo {{ max-width: 200px; margin-bottom: 20px; }}
                    .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
                    .button {{ display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                    .footer {{ text-align: center; color: #64748b; font-size: 0.875rem; margin-top: 30px; }}
                    .candidate-info {{ background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #3b82f6; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        {f'<img src="{logo_url}" alt="Logo" class="logo" />' if logo_url else ''}
                        {f'<h1>{company_name}</h1>' if company_name else ''}
                    </div>
                    <div class="content">
                        <p>Dear {name},</p>
                        <p>{email_body}</p>
                        <div class="candidate-info">
                            <p><strong>Your Details:</strong></p>
                            <p><strong>Name:</strong> {name}</p>
                            <p><strong>Email:</strong> {email}</p>
                        </div>
                        <div style="text-align: center;">
                            <a href="{exam_url_with_params}" class="button">Start Assessment</a>
                        </div>
                    </div>
                    {f'<div class="footer"><p>{footer}</p></div>' if footer else ''}
                    <div class="footer">
                        <p>Sent by {sent_by}</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            subject = f"Assessment Invitation - {company_name if company_name else 'AI Assessment Platform'}"
            
            await email_service.send_email(email, subject, html_content)
            logger.info(f"Invitation email sent successfully to {email}")
        except Exception as email_err:
            logger.error(f"Failed to send invitation email to {email}: {email_err}", exc_info=True)
            # Don't fail the entire operation if email fails, but log it
            # The candidate is still added to the assessment
    
    # Save assessment with new candidate
    await _save_assessment(db, assessment)
    
    return success_response(
        "Candidate added and invitation sent successfully",
        serialize_document(new_candidate)
    )


@router.post("/{assessment_id}/resend-invite")
async def resend_invitation(
    assessment_id: str,
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Resend invitation email to a specific candidate."""
    from ....utils.email import get_email_service
    from ....config.settings import get_settings
    
    assessment = await _get_assessment(db, assessment_id)
    _check_assessment_access(assessment, current_user)
    
    candidate_email = payload.get("email", "").strip().lower()
    if not candidate_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate email is required"
        )
    
    # Find candidate in assessment
    candidates = assessment.get("candidates", [])
    candidate = None
    for c in candidates:
        if c.get("email", "").lower() == candidate_email:
            candidate = c
            break
    
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found in this assessment"
        )
    
    email = candidate.get("email", "").strip().lower()
    name = candidate.get("name", "").strip()
    
    if not email or not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid candidate data"
        )
    
    # Get assessment URL
    assessment_url = assessment.get("assessmentUrl")
    if not assessment_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment URL not found"
        )
    
    # Get template
    stored_template = assessment.get("invitationTemplate", {})
    default_template = {
        "logoUrl": "",
        "companyName": "",
        "message": "You have been invited to take an assessment. Please click the link below to start.",
        "footer": "",
        "sentBy": "AI Assessment Platform"
    }
    template_to_use = stored_template if stored_template else default_template
    
    # Send invitation email
    settings = get_settings()
    if not settings.sendgrid_api_key or not settings.sendgrid_from_email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SendGrid is not configured"
        )
    
    try:
        email_service = get_email_service()
        
        # Build exam URL with candidate params
        import urllib.parse
        encoded_email = urllib.parse.quote(email)
        encoded_name = urllib.parse.quote(name)
        exam_url_with_params = f"{assessment_url}?email={encoded_email}&name={encoded_name}"
        
        # Replace placeholders
        message = template_to_use.get("message", default_template["message"])
        email_body = message
        email_body = email_body.replace("{{candidate_name}}", name)
        email_body = email_body.replace("{{candidate_email}}", email)
        email_body = email_body.replace("{{exam_url}}", exam_url_with_params)
        email_body = email_body.replace("{{company_name}}", template_to_use.get("companyName", ""))
        
        # Build HTML email
        logo_url = template_to_use.get("logoUrl", "")
        company_name = template_to_use.get("companyName", "")
        footer = template_to_use.get("footer", "")
        sent_by = template_to_use.get("sentBy", "AI Assessment Platform")
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .logo {{ max-width: 200px; margin-bottom: 20px; }}
                .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .footer {{ text-align: center; color: #64748b; font-size: 0.875rem; margin-top: 30px; }}
                .candidate-info {{ background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #3b82f6; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    {f'<img src="{logo_url}" alt="Logo" class="logo" />' if logo_url else ''}
                    {f'<h1>{company_name}</h1>' if company_name else ''}
                </div>
                <div class="content">
                    <p>Dear {name},</p>
                    <p>{email_body}</p>
                    <div class="candidate-info">
                        <p><strong>Your Details:</strong></p>
                        <p><strong>Name:</strong> {name}</p>
                        <p><strong>Email:</strong> {email}</p>
                    </div>
                    <div style="text-align: center;">
                        <a href="{exam_url_with_params}" class="button">Start Assessment</a>
                    </div>
                </div>
                {f'<div class="footer"><p>{footer}</p></div>' if footer else ''}
                <div class="footer">
                    <p>Sent by {sent_by}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        subject = f"Assessment Invitation - {company_name if company_name else 'AI Assessment Platform'}"
        
        await email_service.send_email(email, subject, html_content)
        logger.info(f"Invitation email resent successfully to {email}")
        
        # Update candidate invitedAt timestamp
        for idx, c in enumerate(candidates):
            if c.get("email", "").lower() == candidate_email:
                candidates[idx]["invitedAt"] = _now_utc().isoformat()
                candidates[idx]["invited"] = True
                break
        
        assessment["candidates"] = candidates
        await _save_assessment(db, assessment)
        
        return success_response("Invitation resent successfully", serialize_document(candidate))
    except Exception as email_err:
        logger.error(f"Failed to resend invitation email to {email}: {email_err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resend invitation: {str(email_err)}"
        )


@router.put("/{assessment_id}/update-schedule")
async def update_assessment_schedule(
    assessment_id: str,
    payload: ScheduleUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    assessment = await _get_assessment(db, assessment_id)
    _check_assessment_access(assessment, current_user)

    start_time = payload.startTime
    end_time = payload.endTime
    if start_time >= end_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start time must be before end time")

    # Merge new schedule data into any existing schedule so we don't lose
    # fields such as candidateRequirements or proctoringSettings.
    existing_schedule = assessment.get("schedule") or {}
    schedule_updates = {
        "startTime": start_time,
        "endTime": end_time,
        "duration": payload.duration,
        "durationUnit": payload.durationUnit or "hours",
        "attemptCount": payload.attemptCount or 1,
        "vpnRequired": payload.vpnRequired or False,
        "linkSharingEnabled": payload.linkSharingEnabled or False,
        "mailFeedbackReport": payload.mailFeedbackReport or False,
        "candidateQuestions": (
            payload.candidateQuestions.model_dump(exclude_unset=True)
            if payload.candidateQuestions
            else {
                "allowed": True,
                "maxQuestions": 3,
                "timeLimit": 5,
                "questions": [],
            }
        ),
        "instructions": payload.instructions,
        "timezone": payload.timezone or "UTC",
        "isActive": bool(payload.isActive),
    }
    schedule = {**existing_schedule, **schedule_updates}

    assessment["schedule"] = schedule
    if assessment.get("status") in {"draft", "ready"}:
        assessment["status"] = "scheduled"
    await _save_assessment(db, assessment)
    return success_response(
        "Assessment schedule updated successfully",
        {"assessmentId": str(assessment.get("_id")), "schedule": schedule, "status": assessment.get("status")},
    )


@router.get("/{assessment_id}/topics")
async def get_topics(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    assessment = await _get_assessment(db, assessment_id)
    _check_assessment_access(assessment, current_user)
    return success_response("Topics fetched successfully", assessment.get("topics", []))


@router.get("/{assessment_id}/answer-logs")
async def get_answer_logs(
    assessment_id: str,
    candidateEmail: str = Query(...),
    candidateName: str = Query(...),
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get answer logs for a specific candidate."""
    try:
        assessment = await _get_assessment(db, assessment_id)
        _check_assessment_access(assessment, current_user)

        # Match the format used in log-answer endpoint: email_lowercase_name_stripped
        # Format: email.strip().lower() + "_" + name.strip()
        # CRITICAL: Must match EXACTLY the format in log-answer endpoint
        candidate_key = f"{candidateEmail.strip().lower()}_{candidateName.strip()}"
        logger.info(f"Fetching answer logs for candidate key: '{candidate_key}' (email='{candidateEmail}', name='{candidateName}')")
        
        answer_logs = assessment.get("answerLogs")
        if not answer_logs or not isinstance(answer_logs, dict):
            logger.info(f"No answerLogs found in assessment or answerLogs is not a dict. Type: {type(answer_logs)}")
            logger.info(f"Assessment ID: {assessment_id}, Full assessment keys: {list(assessment.keys())}")
            # Don't return early - continue to process questions from candidateResponses (especially MCQs)
            answer_logs = {}
        
        logger.info(f"Answer logs keys in database: {list(answer_logs.keys())}")
        logger.info(f"Looking for candidate key: '{candidate_key}'")
        
        # Try exact match first
        candidate_logs = answer_logs.get(candidate_key, {})
        
        # If not found, try to find a similar key (for debugging)
        if not candidate_logs or not isinstance(candidate_logs, dict):
            logger.warning(f"No logs found for candidate key '{candidate_key}'. Available keys: {list(answer_logs.keys())}")
            # Try to find a key that's close (for debugging)
            if answer_logs:
                for key in answer_logs.keys():
                    if candidate_key.lower() in key.lower() or key.lower() in candidate_key.lower():
                        logger.info(f"Found similar key: '{key}' (searching for '{candidate_key}')")
            # Don't return early - continue to process questions from candidateResponses (especially MCQs)
            candidate_logs = {}
        
        logger.info(f"Found candidate logs with question keys: {list(candidate_logs.keys())}")

        # Collect all questions to map question indices
        all_questions = []
        for topic in assessment.get("topics", []):
            if not topic or not isinstance(topic, dict):
                continue
            topic_questions = topic.get("questions", [])
            if topic_questions and isinstance(topic_questions, list):
                for question in topic_questions:
                    if question and isinstance(question, dict):
                        all_questions.append(question)

        # Get submitted answers from candidate responses
        candidate_responses = assessment.get("candidateResponses", {})
        submitted_answers = {}  # {questionIndex: answer}
        if isinstance(candidate_responses, dict):
            candidate_response = candidate_responses.get(candidate_key, {})
            if isinstance(candidate_response, dict):
                # Get submitted answers
                answers_list = candidate_response.get("answers", [])
                if isinstance(answers_list, list):
                    for ans in answers_list:
                        if isinstance(ans, dict):
                            q_idx = ans.get("questionIndex")
                            if q_idx is not None:
                                submitted_answers[q_idx] = ans.get("answer", "")

        # Format logs with question details
        # First, process questions that have logs
        questions_with_logs = set()
        formatted_logs = []
        for question_index_str, log_entries in candidate_logs.items():
            try:
                if not isinstance(log_entries, list):
                    logger.warning(f"Log entries for question {question_index_str} is not a list, skipping")
                    continue
                    
                question_index = int(question_index_str)
                if 0 <= question_index < len(all_questions):
                    question = all_questions[question_index]
                    # Serialize log entries to ensure they're JSON-serializable
                    # Use array index + 1 as version fallback to handle any race conditions during write
                    serialized_logs = []
                    for idx, log_entry in enumerate(log_entries):
                        if isinstance(log_entry, dict):
                            # Use stored version if available, otherwise use array index + 1
                            # This ensures versions are always correct even if there was a race condition
                            stored_version = log_entry.get("version", 0)
                            version = stored_version if stored_version > 0 else (idx + 1)
                            serialized_logs.append({
                                "answer": str(log_entry.get("answer", "")),
                                "questionType": str(log_entry.get("questionType", "")),
                                "timestamp": str(log_entry.get("timestamp", "")),
                                "version": int(version),
                            })
                    
                    # For MCQ questions, check if answer is correct
                    is_mcq_correct = None
                    if question.get("type") == "MCQ":
                        correct_answer = question.get("correctAnswer", "")
                        # Get the last answer from logs
                        if serialized_logs and len(serialized_logs) > 0:
                            last_log = serialized_logs[-1]  # Last version
                            candidate_answer = last_log.get("answer", "").strip()
                            is_mcq_correct = (candidate_answer == correct_answer) if correct_answer else None
                    
                    formatted_logs.append({
                        "questionIndex": question_index,
                        "questionText": str(question.get("questionText", "")),
                        "questionType": str(question.get("type", "")),
                        "logs": serialized_logs,  # Already in order (version 1, 2, 3, etc.)
                        "maxScore": question.get("score", 5),
                        "isMcqCorrect": is_mcq_correct,  # For MCQ: True/False, for others: None
                        "correctAnswer": question.get("correctAnswer") if question.get("type") == "MCQ" else None,
                        "options": question.get("options", []) if question.get("type") == "MCQ" else None,  # MCQ options
                    })
                    questions_with_logs.add(question_index)
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid question index in logs: {question_index_str}, error: {e}")
                continue
            except Exception as e:
                logger.warning(f"Error processing log entry for question {question_index_str}: {e}")
                continue

        # Add questions that don't have logs but have submitted answers (especially MCQ)
        # Also include ALL MCQ questions even if they have no logs or submitted answers
        # Get submission time from candidate response
        submission_time = None
        if isinstance(candidate_responses, dict):
            candidate_response = candidate_responses.get(candidate_key, {})
            if isinstance(candidate_response, dict):
                submitted_at = candidate_response.get("submittedAt")
                if submitted_at:
                    submission_time = submitted_at
        if not submission_time:
            submission_time = datetime.now(timezone.utc).isoformat()
        
        for idx, question in enumerate(all_questions):
            if idx not in questions_with_logs and isinstance(question, dict):
                # Check if there's a submitted answer for this question
                submitted_answer = submitted_answers.get(idx)
                
                # For MCQ questions, ALWAYS include them (even if no logs and no submitted answer)
                # For other question types, only include if there's a submitted answer
                is_mcq = question.get("type") == "MCQ"
                should_include = submitted_answer is not None or is_mcq
                
                if should_include:
                    # Create a log entry from submitted answer (or empty for MCQ without answer)
                    serialized_logs = []
                    answer_to_use = str(submitted_answer) if submitted_answer is not None else ""
                    # Always create a log entry for MCQs, even if answer is empty
                    if answer_to_use or is_mcq:
                        # Create a single log entry for the submitted answer
                        serialized_logs.append({
                            "answer": answer_to_use,
                            "questionType": str(question.get("type", "")),
                            "timestamp": submission_time,
                            "version": 1,
                        })
                    
                    # For MCQ questions, check if answer is correct
                    is_mcq_correct = None
                    if is_mcq:
                        correct_answer = question.get("correctAnswer", "")
                        if answer_to_use:
                            is_mcq_correct = (answer_to_use.strip() == correct_answer) if correct_answer else None
                        else:
                            is_mcq_correct = False  # No answer provided = incorrect
                    
                    formatted_logs.append({
                        "questionIndex": idx,
                        "questionText": str(question.get("questionText", "")),
                        "questionType": str(question.get("type", "")),
                        "logs": serialized_logs,
                        "maxScore": question.get("score", 5),
                        "isMcqCorrect": is_mcq_correct,
                        "correctAnswer": question.get("correctAnswer") if is_mcq else None,
                        "options": question.get("options", []) if is_mcq else None,
                    })

        # Sort by question index
        formatted_logs.sort(key=lambda x: x["questionIndex"])

        return success_response("Answer logs fetched successfully", formatted_logs)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error fetching answer logs: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch answer logs: {str(exc)}",
        ) from exc


@router.get("/{assessment_id}/candidate-results")
async def get_candidate_results(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get candidate results for an assessment."""
    try:
        assessment = await _get_assessment(db, assessment_id)
        _check_assessment_access(assessment, current_user)

        # Handle candidateResponses - it might be None, empty dict, or not exist
        candidate_responses = assessment.get("candidateResponses")
        if candidate_responses is None:
            candidate_responses = {}
        elif not isinstance(candidate_responses, dict):
            candidate_responses = {}
        
        results = []
        
        # Safely iterate over candidate responses
        if candidate_responses:
            for key, response in candidate_responses.items():
                if not isinstance(response, dict):
                    continue
                    
                # Extract email and name from response or key
                email = response.get("email", "")
                name = response.get("name", "")
                if not email or not name:
                    # Try to extract from key format: "email_name"
                    parts = key.split("_", 1)
                    if len(parts) == 2:
                        email = email or parts[0]
                        name = name or parts[1].replace("_", " ").title()
                
                # Safely extract all fields with defaults
                result_item = {
                    "email": email,
                    "name": name,
                    "score": response.get("score", 0),
                    "maxScore": response.get("maxScore", 0),
                    "attempted": response.get("attempted", 0),
                    "notAttempted": response.get("notAttempted", 0),
                    "correctAnswers": response.get("correctAnswers", 0),
                    "submittedAt": response.get("submittedAt") or response.get("answers", {}).get("submittedAt"),
                    "startedAt": response.get("startedAt"),
                }
                
                # Include candidate info (requirements filled during assessment)
                candidate_info = response.get("candidateInfo", {})
                if candidate_info:
                    result_item["candidateInfo"] = {
                        "phone": candidate_info.get("phone"),
                        "hasResume": candidate_info.get("hasResume", False),
                        "savedAt": candidate_info.get("savedAt"),
                    }
                    # Include LinkedIn, GitHub, and custom fields if available
                    if "linkedIn" in candidate_info:
                        result_item["candidateInfo"]["linkedIn"] = candidate_info.get("linkedIn")
                    if "github" in candidate_info:
                        result_item["candidateInfo"]["github"] = candidate_info.get("github")
                    if "customFields" in candidate_info:
                        result_item["candidateInfo"]["customFields"] = candidate_info.get("customFields")
                
                results.append(result_item)
        
        return success_response("Candidate results fetched successfully", results)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error getting candidate results for assessment {assessment_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get candidate results: {str(exc)}"
        ) from exc


@router.post("/start-session")
async def start_assessment_session(
    payload: Dict[str, Any],
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Start an assessment session for a candidate.
    Records startedAt timestamp in candidateResponses.
    This endpoint does not require authentication (public endpoint for candidates).
    """
    try:
        assessment_id = payload.get("assessmentId")
        token = payload.get("token")
        email = payload.get("email")
        name = payload.get("name")
        
        if not assessment_id or not token or not email or not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields: assessmentId, token, email, name"
            )
        
        assessment_id_obj = to_object_id(assessment_id)
        assessment = await db.assessments.find_one({"_id": assessment_id_obj})
        
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        # Validate token
        assessment_token = assessment.get("assessmentToken")
        if not assessment_token or assessment_token != token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or expired assessment token"
            )
        
        # Create candidate key
        candidate_key = f"{email.strip().lower()}_{name.strip().lower()}"
        
        # Initialize candidateResponses if needed
        if "candidateResponses" not in assessment:
            assessment["candidateResponses"] = {}
        
        if candidate_key not in assessment["candidateResponses"]:
            assessment["candidateResponses"][candidate_key] = {
                "email": email.strip().lower(),
                "name": name.strip(),
                "logs": [],
                "answers": {},
            }
        
        # Record startedAt if not already set (don't overwrite if already started)
        now_utc = datetime.now(timezone.utc)
        started_at_iso = now_utc.isoformat()
        
        if "startedAt" not in assessment["candidateResponses"][candidate_key]:
            assessment["candidateResponses"][candidate_key]["startedAt"] = started_at_iso
            
            # Log the event
            if "logs" not in assessment["candidateResponses"][candidate_key]:
                assessment["candidateResponses"][candidate_key]["logs"] = []
            
            assessment["candidateResponses"][candidate_key]["logs"].append({
                "eventType": "ASSESSMENT_STARTED",
                "timestamp": started_at_iso,
                "metadata": {
                    "email": email,
                    "name": name,
                }
            })
            
            # Update assessment in database
            await db.assessments.update_one(
                {"_id": assessment_id_obj},
                {"$set": {"candidateResponses": assessment["candidateResponses"]}}
            )
        else:
            # Use existing startedAt
            started_at_iso = assessment["candidateResponses"][candidate_key]["startedAt"]
        
        # Return startedAt and serverTime
        return success_response(
            "Session started successfully",
            {
                "startedAt": started_at_iso,
                "serverTime": now_utc.isoformat(),
            }
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Error starting assessment session: {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start session: {str(exc)}"
        ) from exc


@router.get("/{assessment_id}/candidate/{candidate_email}/detailed-results")
async def get_candidate_detailed_results(
    assessment_id: str,
    candidate_email: str,
    candidate_name: str = Query(..., description="Candidate name"),
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get detailed evaluation results for a specific candidate."""
    try:
        assessment = await _get_assessment(db, assessment_id)
        _check_assessment_access(assessment, current_user)
        
        # Find candidate response
        candidate_key = f"{candidate_email.strip().lower()}_{candidate_name.strip().lower()}"
        candidate_responses = assessment.get("candidateResponses", {})
        candidate_response = candidate_responses.get(candidate_key)
        
        if not candidate_response:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Candidate results not found"
            )
        
        # Extract evaluation data
        evaluations = candidate_response.get("evaluations", {})
        section_summaries = candidate_response.get("sectionSummaries", [])
        overall_summary = candidate_response.get("overallSummary", {})
        
        # Calculate overall scores from evaluations if not in summary
        if not overall_summary and evaluations:
            total_score = sum(eval.get("score", 0) for eval in evaluations.values())
            total_max = sum(eval.get("max_marks", 0) for eval in evaluations.values())
            overall_percentage = (total_score / total_max * 100) if total_max > 0 else 0.0
            
            overall_summary = {
                "overall_score": round(total_score, 2),
                "overall_max_marks": round(total_max, 2),
                "overall_percentage": round(overall_percentage, 2),
                "grade": "A+" if overall_percentage >= 90 else "A" if overall_percentage >= 85 else "B+" if overall_percentage >= 80 else "B" if overall_percentage >= 75 else "C+" if overall_percentage >= 70 else "C" if overall_percentage >= 65 else "D" if overall_percentage >= 60 else "F"
            }
        
        # Extract key strengths and areas of improvement from overall summary
        key_strengths = overall_summary.get("overall_strengths", [])
        areas_of_improvement = overall_summary.get("overall_weaknesses", [])
        
        # If not in summary, extract from evaluations
        if not key_strengths or not areas_of_improvement:
            all_strengths = []
            all_weaknesses = []
            
            for eval_data in evaluations.values():
                feedback = eval_data.get("feedback", {})
                if isinstance(feedback, dict):
                    all_strengths.extend(feedback.get("strengths", []))
                    all_weaknesses.extend(feedback.get("weaknesses", []))
                
                # Also get from areas_of_improvement
                for area in eval_data.get("areas_of_improvement", []):
                    skill = area.get("skill", "")
                    gap = area.get("gap_analysis", "")
                    if skill and gap:
                        all_weaknesses.append(f"{skill}: {gap}")
            
            if not key_strengths:
                key_strengths = list(set(all_strengths))[:10]
            if not areas_of_improvement:
                areas_of_improvement = list(set(all_weaknesses))[:10]
        
        # Get all questions from assessment to show attempted/not attempted
        all_questions = []
        questions_map = {}  # question_id -> question
        question_index_map = {}  # question_index -> question_id
        
        def extract_question_id(q: Dict[str, Any], topic_id: str, row_id: str, q_idx: int) -> str:
            """Extract or generate question ID from question object."""
            q_id = q.get("_id")
            if q_id:
                if hasattr(q_id, '__str__'):
                    q_id = str(q_id)
                else:
                    q_id = str(q_id)
                if q_id and q_id.lower() != "none":
                    return q_id
            
            q_id = q.get("id")
            if q_id:
                q_id = str(q_id)
                if q_id and q_id.lower() != "none":
                    return q_id
            
            return f"{topic_id}-{row_id}-{q_idx}"
        
        global_question_index = 0
        topics_v2 = assessment.get("topics_v2", [])
        for topic in topics_v2:
            topic_id = str(topic.get("id", ""))
            question_rows = topic.get("questionRows", [])
            for row in question_rows:
                row_id = str(row.get("rowId", ""))
                row_questions = row.get("questions", [])
                question_type = row.get("questionType", "")
                for q_idx, q in enumerate(row_questions):
                    q_id = extract_question_id(q, topic_id, row_id, q_idx)
                    question_obj = {
                        **q,
                        "_id": q_id,
                        "questionId": q_id,
                        "topicId": topic_id,
                        "topicLabel": topic.get("label"),
                        "rowId": row_id,
                        "questionType": question_type,
                        "difficulty": row.get("difficulty"),
                        "globalIndex": global_question_index,
                    }
                    all_questions.append(question_obj)
                    questions_map[q_id] = question_obj
                    question_index_map[global_question_index] = q_id
                    global_question_index += 1
        
        # Get submitted answers
        submitted_answers_data = candidate_response.get("answers", {}).get("submitted", [])
        logger.info(f"[DETAILED_RESULTS] Total submitted answers: {len(submitted_answers_data)}")
        submitted_answers_map = {}  # questionIndex -> answer data
        submitted_answers_by_id = {}  # questionId -> answer data (fallback)
        
        # Build maps: prioritize answers with both index and ID matching
        for idx, answer_data in enumerate(submitted_answers_data):
            question_index = answer_data.get("questionIndex")
            question_id = answer_data.get("questionId")
            logger.info(f"[DETAILED_RESULTS] Answer {idx}: questionIndex={question_index}, questionId={question_id}, keys={list(answer_data.keys())}")
            
            # Store by index (preferred matching method)
            if question_index is not None:
                # If multiple answers have same index, keep the one that also has matching ID
                if question_index not in submitted_answers_map:
                    submitted_answers_map[question_index] = answer_data
                else:
                    # Prefer answer with matching questionId if available
                    existing_id = submitted_answers_map[question_index].get("questionId")
                    if question_id and str(question_id) == str(existing_id):
                        submitted_answers_map[question_index] = answer_data
            
            # Store by ID for fallback matching
            if question_id:
                question_id_str = str(question_id)
                # If multiple answers have same ID, keep the one that also has matching index
                if question_id_str not in submitted_answers_by_id:
                    submitted_answers_by_id[question_id_str] = answer_data
                else:
                    # Prefer answer with matching questionIndex if available
                    existing_index = submitted_answers_by_id[question_id_str].get("questionIndex")
                    if question_index is not None and question_index == existing_index:
                        submitted_answers_by_id[question_id_str] = answer_data
        
        # Build question results with evaluation and answer data
        question_results = []
        logger.info(f"[DETAILED_RESULTS] Processing {len(all_questions)} questions")
        for q_idx, question in enumerate(all_questions):
            q_id = question.get("questionId") or question.get("_id")
            q_id_str = str(q_id) if q_id else None
            evaluation = evaluations.get(q_id) if q_id else None
            question_type = question.get("questionType", "")
            
            logger.info(f"[DETAILED_RESULTS] Question {q_idx}: ID={q_id}, Type={question_type}, HasEvaluation={bool(evaluation)}")
            
            # Try to get answer by index first (most reliable matching method)
            submitted_answer = None
            answer_from_map = submitted_answers_map.get(q_idx)
            
            logger.info(f"[DETAILED_RESULTS] Question {q_idx}: answer_from_map exists={bool(answer_from_map)}")
            
            if answer_from_map:
                # Index match found - validate consistency if both ID fields are present
                answer_id = answer_from_map.get("questionId")
                if answer_id and q_id_str:
                    answer_id_str = str(answer_id)
                    # If both question and answer have IDs, they should match
                    # This is a validation check to catch data inconsistencies
                    if answer_id_str == q_id_str:
                        submitted_answer = answer_from_map
                    # If IDs don't match but index does, still use it (index is primary)
                    # but log/warn about inconsistency (for now, we'll use it to avoid losing answers)
                    else:
                        submitted_answer = answer_from_map
                else:
                    # Index matches, use it (most reliable match)
                    submitted_answer = answer_from_map
            
            # Fallback: try by questionId only if index match failed
            if not submitted_answer and q_id_str:
                answer_from_id = submitted_answers_by_id.get(q_id_str)
                logger.info(f"[DETAILED_RESULTS] Question {q_idx}: Trying ID match, answer_from_id exists={bool(answer_from_id)}")
                if answer_from_id:
                    # ID match found - validate that answer's index doesn't conflict
                    answer_index = answer_from_id.get("questionIndex")
                    if answer_index is not None:
                        # If answer has index, check if it matches current question index
                        if answer_index == q_idx:
                            # Both ID and index match - perfect match
                            submitted_answer = answer_from_id
                            logger.info(f"[DETAILED_RESULTS] Question {q_idx}: Matched by ID with matching index")
                        # If index doesn't match, this might be a wrong match
                        # But since index match already failed, use ID match as fallback
                        else:
                            submitted_answer = answer_from_id
                            logger.warning(f"[DETAILED_RESULTS] Question {q_idx}: Matched by ID but index mismatch (answer_index={answer_index}, q_idx={q_idx})")
                    else:
                        # ID matches but answer doesn't have index - use it
                        submitted_answer = answer_from_id
                        logger.info(f"[DETAILED_RESULTS] Question {q_idx}: Matched by ID (no index in answer)")
            
            logger.info(f"[DETAILED_RESULTS] Question {q_idx}: Final submitted_answer exists={bool(submitted_answer)}")
            if submitted_answer:
                logger.info(f"[DETAILED_RESULTS] Question {q_idx}: submitted_answer keys={list(submitted_answer.keys())}")
                # Log the actual answer content (first 200 chars) to help debug
                answer_content = submitted_answer.get("answer", "")
                if answer_content:
                    logger.info(f"[DETAILED_RESULTS] Question {q_idx}: submitted_answer['answer'] preview (first 200 chars): {str(answer_content)[:200]}")
            
            # Determine attempt status
            is_attempted = False
            candidate_answer_text = None
            candidate_code = None
            candidate_query = None
            candidate_selected_answers = None
            test_results = None
            test_result = None
            aiml_outputs = None
            has_valid_answer = False
            
            # Get question text for validation (to avoid showing question text as answer)
            question_text = question.get("questionText") or question.get("question") or question.get("description") or ""
            question_text_normalized = question_text.strip().lower() if question_text else ""
            
            if submitted_answer:
                logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): Extracting answer from submitted_answer")
                # Extract answer fields based on question type
                question_type_upper = question_type.upper() if question_type else ""
                
                if question_type_upper in ["SUBJECTIVE", "PSEUDOCODE"]:
                    # For Subjective and PseudoCode questions, extract text answer
                    candidate_answer_text = (
                        submitted_answer.get("textAnswer") or 
                        submitted_answer.get("answer", "") or 
                        ""
                    )
                    logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): textAnswer={bool(submitted_answer.get('textAnswer'))}, answer={bool(submitted_answer.get('answer'))}, extracted_length={len(candidate_answer_text) if candidate_answer_text else 0}")
                    # If answer is just a string, use it as text answer
                    if not candidate_answer_text or not candidate_answer_text.strip():
                        answer_value = submitted_answer.get("answer", "")
                        if isinstance(answer_value, str) and answer_value.strip():
                            candidate_answer_text = answer_value
                            logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): Used fallback answer field, length={len(candidate_answer_text)}")
                    
                    # Validate that answer is not empty and not the same as question text
                    if candidate_answer_text and candidate_answer_text.strip():
                        answer_text_normalized = candidate_answer_text.strip().lower()
                        # Check if answer is not the same as question text (avoid showing question as answer)
                        if answer_text_normalized != question_text_normalized:
                            has_valid_answer = True
                            logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): Valid text answer found (length={len(candidate_answer_text)})")
                        else:
                            logger.warning(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): Answer matches question text, filtering out")
                    else:
                        logger.warning(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): No valid text answer found")
                
                elif question_type_upper in ["CODING", "AIML"]:
                    # For CODING and AIML questions, extract code (try multiple field names)
                    candidate_code = (
                        submitted_answer.get("source_code") or 
                        submitted_answer.get("code") or
                        submitted_answer.get("answer") or 
                        ""
                    )
                    logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): source_code={bool(submitted_answer.get('source_code'))}, code={bool(submitted_answer.get('code'))}, answer={bool(submitted_answer.get('answer'))}, extracted_length={len(candidate_code) if candidate_code else 0}")
                    # Log what's actually in the answer field
                    answer_field_value = submitted_answer.get("answer", "")
                    if answer_field_value:
                        logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): answer field content preview: {str(answer_field_value)[:200]}")
                    # Validate that we have valid code (not empty string)
                    if candidate_code and isinstance(candidate_code, str) and candidate_code.strip():
                        has_valid_answer = True
                        logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): Valid code found (length={len(candidate_code)})")
                    else:
                        logger.warning(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): No valid code found, answer field was: {str(answer_field_value)[:100] if answer_field_value else 'empty'}")
                    # Always extract test results for CODING questions (even if code is empty)
                    if question_type_upper == "CODING":
                        test_results = submitted_answer.get("testResults") or submitted_answer.get("test_results")
                        logger.info(f"[DETAILED_RESULTS] Question {q_idx} (CODING): testResults exists={bool(test_results)}")
                    # Extract AIML outputs for AIML questions
                    if question_type_upper == "AIML":
                        aiml_outputs = submitted_answer.get("outputs") or submitted_answer.get("codeOutputs") or submitted_answer.get("code_outputs")
                        logger.info(f"[DETAILED_RESULTS] Question {q_idx} (AIML): outputs exists={bool(aiml_outputs)}")
                
                elif question_type_upper == "SQL":
                    # For SQL questions, extract SQL query (try multiple field names)
                    candidate_query = (
                        submitted_answer.get("sql_query") or 
                        submitted_answer.get("query") or
                        submitted_answer.get("sqlQuery") or
                        submitted_answer.get("answer") or
                        ""
                    )
                    logger.info(f"[DETAILED_RESULTS] Question {q_idx} (SQL): sql_query={bool(submitted_answer.get('sql_query'))}, query={bool(submitted_answer.get('query'))}, sqlQuery={bool(submitted_answer.get('sqlQuery'))}, answer={bool(submitted_answer.get('answer'))}, extracted_length={len(candidate_query) if candidate_query else 0}")
                    # Validate that we have a valid SQL query (not empty string)
                    if candidate_query and isinstance(candidate_query, str) and candidate_query.strip():
                        has_valid_answer = True
                        logger.info(f"[DETAILED_RESULTS] Question {q_idx} (SQL): Valid query found (length={len(candidate_query)})")
                    else:
                        logger.warning(f"[DETAILED_RESULTS] Question {q_idx} (SQL): No valid query found")
                    # Always extract test result for SQL questions (even if query is empty)
                    test_result = submitted_answer.get("testResult") or submitted_answer.get("test_result")
                    logger.info(f"[DETAILED_RESULTS] Question {q_idx} (SQL): testResult exists={bool(test_result)}")
                
                elif question_type_upper == "MCQ":
                    # For MCQ questions, extract selected answers
                    candidate_selected_answers = submitted_answer.get("selectedAnswers", [])
                    logger.info(f"[DETAILED_RESULTS] Question {q_idx} (MCQ): selectedAnswers={candidate_selected_answers}, answer={submitted_answer.get('answer')}")
                    # If selectedAnswers is empty, check if answer field contains the selection
                    if not candidate_selected_answers or not isinstance(candidate_selected_answers, list) or len(candidate_selected_answers) == 0:
                        answer_value = submitted_answer.get("answer", "")
                        if answer_value:
                            logger.info(f"[DETAILED_RESULTS] Question {q_idx} (MCQ): selectedAnswers empty, checking answer field: {answer_value[:100] if isinstance(answer_value, str) else answer_value}")
                            # Try to parse answer as list or string
                            if isinstance(answer_value, list):
                                candidate_selected_answers = answer_value
                            elif isinstance(answer_value, str) and answer_value.strip():
                                # If it's a string, try to split by comma or use as single answer
                                candidate_selected_answers = [a.strip() for a in answer_value.split(",")] if "," in answer_value else [answer_value.strip()]
                                logger.info(f"[DETAILED_RESULTS] Question {q_idx} (MCQ): Parsed answer field as selectedAnswers: {candidate_selected_answers}")
                    # Validate that we have valid selected answers
                    if candidate_selected_answers and isinstance(candidate_selected_answers, list) and len(candidate_selected_answers) > 0:
                        has_valid_answer = True
                        logger.info(f"[DETAILED_RESULTS] Question {q_idx} (MCQ): Valid selectedAnswers found: {candidate_selected_answers}")
            
            # Get score from evaluation
            logger.info("=" * 80)
            logger.info(f"[DETAILED_RESULTS] Extracting scores for question {q_idx}")
            logger.info(f"[DETAILED_RESULTS] Question ID: {q_id}")
            logger.info(f"[DETAILED_RESULTS] Question type: {question_type}")
            logger.info(f"[DETAILED_RESULTS] Has evaluation: {bool(evaluation)}")
            
            if evaluation:
                logger.info(f"[DETAILED_RESULTS] Evaluation keys: {list(evaluation.keys())}")
                logger.info(f"[DETAILED_RESULTS] evaluation.get('score'): {evaluation.get('score')}")
                logger.info(f"[DETAILED_RESULTS] evaluation.get('max_marks'): {evaluation.get('max_marks')}")
                logger.info(f"[DETAILED_RESULTS] evaluation.get('percentage'): {evaluation.get('percentage')}")
            
            logger.info(f"[DETAILED_RESULTS] question.get('marks'): {question.get('marks')}")
            logger.info(f"[DETAILED_RESULTS] question.get('maxMarks'): {question.get('maxMarks')}")
            
            score = evaluation.get("score", 0) if evaluation else 0
            
            # Extract max_marks with priority: scoringRules > question.marks > question.maxMarks > evaluation.max_marks > default 1
            # This ensures we use the correct max_marks even if evaluation was stored with wrong value
            max_marks = 1.0
            marks_source = "default"
            
            # First try scoringRules (highest priority - this is what was set in review station)
            scoring_rules = assessment.get("scoringRules", {})
            logger.info(f"[DETAILED_RESULTS] Checking scoringRules: {scoring_rules}")
            
            if scoring_rules and isinstance(scoring_rules, dict):
                # Normalize question type to match scoringRules keys
                qtype_normalized = question_type
                if question_type == "PSEUDOCODE" or question_type == "PSEUDO CODE":
                    qtype_normalized = "PseudoCode"
                elif question_type not in ["MCQ", "Subjective", "Coding", "SQL", "AIML"]:
                    qtype_normalized = question_type.capitalize()
                
                logger.info(f"[DETAILED_RESULTS] Normalized question type for scoringRules: {qtype_normalized}")
                logger.info(f"[DETAILED_RESULTS] scoringRules keys: {list(scoring_rules.keys())}")
                
                if qtype_normalized in scoring_rules:
                    max_marks = float(scoring_rules[qtype_normalized])
                    marks_source = f"scoringRules[{qtype_normalized}]"
                    logger.info(f"[DETAILED_RESULTS] Found max_marks in scoringRules[{qtype_normalized}]: {max_marks}")
                elif question_type in scoring_rules:
                    max_marks = float(scoring_rules[question_type])
                    marks_source = f"scoringRules[{question_type}]"
                    logger.info(f"[DETAILED_RESULTS] Found max_marks in scoringRules[{question_type}]: {max_marks}")
                else:
                    logger.warning(f"[DETAILED_RESULTS] Question type '{question_type}' or '{qtype_normalized}' not found in scoringRules")
            else:
                logger.warning(f"[DETAILED_RESULTS] scoringRules is empty or not a dict: {type(scoring_rules)}")
            
            # Fallback to question.marks if scoringRules didn't have it
            if max_marks == 1.0 and marks_source == "default":
                if question.get("marks"):
                    max_marks = float(question.get("marks"))
                    marks_source = "question.marks"
                    logger.info(f"[DETAILED_RESULTS] Using max_marks from question.marks: {max_marks}")
                elif question.get("maxMarks"):
                    max_marks = float(question.get("maxMarks"))
                    marks_source = "question.maxMarks"
                    logger.info(f"[DETAILED_RESULTS] Using max_marks from question.maxMarks: {max_marks}")
                elif evaluation and evaluation.get("max_marks"):
                    max_marks = float(evaluation.get("max_marks"))
                    marks_source = "evaluation.max_marks"
                    logger.info(f"[DETAILED_RESULTS] Using max_marks from evaluation (fallback): {max_marks}")
                else:
                    logger.warning(f"[DETAILED_RESULTS] No max_marks found anywhere, using default 1.0")
            
            # Ensure max_marks is valid
            try:
                max_marks = float(max_marks)
                if max_marks <= 0:
                    logger.warning(f"[DETAILED_RESULTS] max_marks was <= 0, resetting to 1.0")
                    max_marks = 1.0
            except (ValueError, TypeError) as e:
                logger.error(f"[DETAILED_RESULTS] Error converting max_marks to float: {e}, using default 1.0")
                max_marks = 1.0
            
            # Calculate percentage based on correct max_marks
            if evaluation and max_marks > 0:
                original_score = evaluation.get("score", 0)
                percentage = (original_score / max_marks) * 100
                logger.info(f"[DETAILED_RESULTS] Calculated percentage: {percentage}% (score: {original_score}/{max_marks})")
            else:
                percentage = evaluation.get("percentage", 0) if evaluation else 0
                logger.info(f"[DETAILED_RESULTS] Using percentage from evaluation: {percentage}%")
            
            logger.info(f"[DETAILED_RESULTS] Final extracted values:")
            logger.info(f"[DETAILED_RESULTS]   score: {score}")
            logger.info(f"[DETAILED_RESULTS]   max_marks: {max_marks}")
            logger.info(f"[DETAILED_RESULTS]   percentage: {percentage}")
            logger.info(f"[DETAILED_RESULTS]   Score display will be: {score}/{max_marks}")
            logger.info("=" * 80)
            
            # Determine if question was attempted:
            # - If evaluation exists, question was definitely attempted
            # - If valid answer exists, question was attempted
            # - Otherwise, not attempted
            is_attempted = bool(evaluation) or (submitted_answer and has_valid_answer)
            logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): is_attempted={is_attempted} (evaluation={bool(evaluation)}, submitted_answer={bool(submitted_answer)}, has_valid_answer={has_valid_answer})")
            
            # Build candidate answer object conditionally based on question type
            # CRITICAL FIX: Always extract from answer field first as the primary source
            candidate_answer = {}
            question_type_upper = question_type.upper() if question_type else ""
            
            # PRIMARY EXTRACTION: Always try to get answer from submitted_answer['answer'] field first
            if submitted_answer:
                answer_value = submitted_answer.get("answer", "")
                if answer_value and isinstance(answer_value, str) and answer_value.strip():
                    if question_type_upper in ["SUBJECTIVE", "PSEUDOCODE"]:
                        if not candidate_answer_text:
                            candidate_answer_text = answer_value
                            logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): PRIMARY extraction - set candidate_answer_text from answer field (length={len(answer_value)})")
                    elif question_type_upper in ["CODING", "AIML"]:
                        if not candidate_code:
                            candidate_code = answer_value
                            logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): PRIMARY extraction - set candidate_code from answer field (length={len(answer_value)})")
                    elif question_type_upper == "SQL":
                        if not candidate_query:
                            candidate_query = answer_value
                            logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): PRIMARY extraction - set candidate_query from answer field (length={len(answer_value)})")
            
            if question_type_upper in ["SUBJECTIVE", "PSEUDOCODE"]:
                # Only include if answer exists and is not the same as question text
                if candidate_answer_text is not None and isinstance(candidate_answer_text, str) and candidate_answer_text.strip():
                    answer_text_normalized = candidate_answer_text.strip().lower()
                    if answer_text_normalized != question_text_normalized:
                        candidate_answer["textAnswer"] = candidate_answer_text
                        logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): Added textAnswer to candidate_answer (length={len(candidate_answer_text)})")
                    else:
                        logger.warning(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): Skipped textAnswer (matches question text)")
                else:
                    logger.warning(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): No textAnswer to add - candidate_answer_text={candidate_answer_text}, is_none={candidate_answer_text is None}")
            elif question_type_upper in ["CODING", "AIML"]:
                # Include code if it exists and is not empty - check both None and empty string
                if candidate_code is not None and isinstance(candidate_code, str) and candidate_code.strip():
                    candidate_answer["code"] = candidate_code
                    logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): Added code to candidate_answer (length={len(candidate_code)})")
                else:
                    logger.warning(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): No code to add - candidate_code={candidate_code}, is_none={candidate_code is None}, type={type(candidate_code)}, value_preview={str(candidate_code)[:100] if candidate_code else 'None/Empty'}")
                # Also include AIML outputs in candidate_answer for easier access
                if question_type_upper == "AIML" and aiml_outputs:
                    candidate_answer["outputs"] = aiml_outputs if isinstance(aiml_outputs, list) else [aiml_outputs]
            elif question_type_upper == "SQL":
                # Include query if it exists and is not empty
                if candidate_query and isinstance(candidate_query, str) and candidate_query.strip():
                    candidate_answer["sqlQuery"] = candidate_query
                    logger.info(f"[DETAILED_RESULTS] Question {q_idx} (SQL): Added sqlQuery to candidate_answer (length={len(candidate_query)})")
                else:
                    logger.warning(f"[DETAILED_RESULTS] Question {q_idx} (SQL): No sqlQuery to add (empty or None)")
            elif question_type_upper == "MCQ":
                # Include selected answers if they exist and are not empty
                if candidate_selected_answers and isinstance(candidate_selected_answers, list) and len(candidate_selected_answers) > 0:
                    candidate_answer["selectedAnswers"] = candidate_selected_answers
                    logger.info(f"[DETAILED_RESULTS] Question {q_idx} (MCQ): Added selectedAnswers to candidate_answer (count={len(candidate_selected_answers)})")
                else:
                    logger.warning(f"[DETAILED_RESULTS] Question {q_idx} (MCQ): No selectedAnswers to add (empty or None)")
            
            logger.info(f"[DETAILED_RESULTS] Question {q_idx} ({question_type}): candidate_answer keys={list(candidate_answer.keys())}, candidate_answer={candidate_answer}")
            
            # Build question result with conditional answers and test results
            question_result = {
                "questionId": q_id,
                "questionIndex": q_idx,
                "questionType": question_type,
                "questionText": question.get("questionText") or question.get("question", ""),
                "section": question.get("topicLabel", ""),
                "difficulty": question.get("difficulty", "Medium"),
                "isAttempted": is_attempted,
                "score": round(score, 2),
                "maxMarks": max_marks,
                "percentage": round(percentage, 2),
                "candidateAnswer": candidate_answer,
                "evaluation": serialize_document(evaluation) if evaluation else None,
            }
            
            # Include testResults for CODING questions with full details
            if question_type_upper == "CODING":
                # Try to get test_results from evaluation first, then from submitted_answer
                test_results_for_display = test_results
                if not test_results_for_display and submitted_answer:
                    test_results_for_display = submitted_answer.get("testResults") or submitted_answer.get("test_results")
                
                if test_results_for_display:
                    # Ensure test_results is serialized and includes all details
                    serialized_test_results = []
                    for tr in test_results_for_display if isinstance(test_results_for_display, list) else []:
                        serialized_tr = serialize_document(tr) if not isinstance(tr, dict) else tr
                        # Ensure all fields are present with proper normalization
                        serialized_tr.setdefault("input", serialized_tr.get("input", serialized_tr.get("visible", {}).get("input", "")))
                        serialized_tr.setdefault("expected_output", serialized_tr.get("expected_output", serialized_tr.get("expected", serialized_tr.get("visible", {}).get("expected", ""))))
                        serialized_tr.setdefault("actual_output", serialized_tr.get("actual_output", serialized_tr.get("output", serialized_tr.get("stdout", serialized_tr.get("visible", {}).get("output", "")))))
                        serialized_tr.setdefault("passed", serialized_tr.get("passed", False))
                        serialized_tr.setdefault("status", serialized_tr.get("status", "unknown"))
                        serialized_tr.setdefault("time", serialized_tr.get("time", None))
                        serialized_tr.setdefault("memory", serialized_tr.get("memory", None))
                        serialized_tr.setdefault("stdout", serialized_tr.get("stdout", serialized_tr.get("actual_output", "")))
                        serialized_tr.setdefault("stderr", serialized_tr.get("stderr", ""))
                        serialized_tr.setdefault("compile_output", serialized_tr.get("compile_output", ""))
                        serialized_tr.setdefault("error", serialized_tr.get("error", ""))
                        serialized_test_results.append(serialized_tr)
                    question_result["testResults"] = serialized_test_results
                    logger.info(f"[DETAILED_RESULTS] Question {q_idx} (CODING): Added {len(serialized_test_results)} test results to question_result")
                else:
                    question_result["testResults"] = []
                    logger.warning(f"[DETAILED_RESULTS] Question {q_idx} (CODING): No test results found for display")
            
            # Include testResult for SQL questions with full details
            elif question_type_upper == "SQL":
                if test_result:
                    serialized_test_result = serialize_document(test_result) if not isinstance(test_result, dict) else test_result
                    # Ensure all SQL result fields are present
                    serialized_test_result.setdefault("passed", serialized_test_result.get("passed", False))
                    serialized_test_result.setdefault("user_output", serialized_test_result.get("user_output", serialized_test_result.get("output", "")))
                    serialized_test_result.setdefault("expected_output", serialized_test_result.get("expected_output", serialized_test_result.get("reference_result", "")))
                    serialized_test_result.setdefault("error", serialized_test_result.get("error", ""))
                    serialized_test_result.setdefault("time", serialized_test_result.get("time", None))
                    serialized_test_result.setdefault("memory", serialized_test_result.get("memory", None))
                    serialized_test_result.setdefault("status", serialized_test_result.get("status", "executed"))
                    question_result["testResult"] = serialized_test_result
                else:
                    question_result["testResult"] = None
            
            # Include AIML outputs
            elif question_type_upper == "AIML":
                if aiml_outputs:
                    # Ensure outputs are serialized
                    if isinstance(aiml_outputs, list):
                        question_result["aimlOutputs"] = [serialize_document(o) if not isinstance(o, dict) else o for o in aiml_outputs]
                    else:
                        question_result["aimlOutputs"] = serialize_document(aiml_outputs) if not isinstance(aiml_outputs, dict) else aiml_outputs
                else:
                    question_result["aimlOutputs"] = []
            
            question_results.append(question_result)
        
        logger.info(f"[DETAILED_RESULTS] Completed processing. Total question_results: {len(question_results)}")
        logger.info(f"[DETAILED_RESULTS] Summary - Questions with answers: {sum(1 for qr in question_results if qr.get('candidateAnswer') and len(qr.get('candidateAnswer', {})) > 0)}")
        logger.info(f"[DETAILED_RESULTS] Summary - Questions attempted: {sum(1 for qr in question_results if qr.get('isAttempted'))}")
        
        # Recalculate overall summary from question_results with corrected max_marks
        total_score = sum(qr.get("score", 0) for qr in question_results)
        total_max_marks = sum(qr.get("maxMarks", 0) for qr in question_results)
        overall_percentage = (total_score / total_max_marks * 100) if total_max_marks > 0 else 0.0
        
        logger.info(f"[DETAILED_RESULTS] Recalculated overall summary:")
        logger.info(f"[DETAILED_RESULTS]   total_score: {total_score}")
        logger.info(f"[DETAILED_RESULTS]   total_max_marks: {total_max_marks}")
        logger.info(f"[DETAILED_RESULTS]   overall_percentage: {overall_percentage}%")
        
        # Update overall summary with corrected values
        overall_summary = {
            "overall_score": round(total_score, 2),
            "overall_max_marks": round(total_max_marks, 2),
            "overall_percentage": round(overall_percentage, 2),
            "grade": "A+" if overall_percentage >= 90 else "A" if overall_percentage >= 85 else "B+" if overall_percentage >= 80 else "B" if overall_percentage >= 75 else "C+" if overall_percentage >= 70 else "C" if overall_percentage >= 65 else "D" if overall_percentage >= 60 else "F",
            **{k: v for k, v in (overall_summary or {}).items() if k not in ["overall_score", "overall_max_marks", "overall_percentage", "grade"]}  # Preserve other fields
        }
        
        # Calculate pass/fail based on passPercentage
        pass_percentage = assessment.get("passPercentage", 50)
        logger.info(f"[DETAILED_RESULTS] Pass percentage: {pass_percentage}%")
        logger.info(f"[DETAILED_RESULTS] Candidate overall percentage: {overall_percentage}%")
        is_passed = overall_percentage >= pass_percentage
        logger.info(f"[DETAILED_RESULTS] Pass/fail status: {'PASSED' if is_passed else 'FAILED'}")
        
        # Serialize datetime objects to strings
        completed_at = candidate_response.get("completedAt")
        if completed_at and isinstance(completed_at, datetime):
            completed_at = completed_at.isoformat()
        elif completed_at is None:
            completed_at = None
        
        submitted_at = candidate_response.get("answers", {}).get("submittedAt")
        if submitted_at and isinstance(submitted_at, datetime):
            submitted_at = submitted_at.isoformat()
        elif submitted_at is None:
            submitted_at = None
        
        # Serialize the response data to handle any datetime objects
        response_data = {
            "candidate": {
                "email": candidate_response.get("email", candidate_email),
                "name": candidate_response.get("name", candidate_name)
            },
            "overallSummary": serialize_document(overall_summary) if overall_summary else {},
            "keyStrengths": key_strengths,
            "areasOfImprovement": areas_of_improvement,
            "sectionSummaries": [serialize_document(s) for s in section_summaries] if section_summaries else [],
            "evaluations": {k: serialize_document(v) for k, v in evaluations.items()} if evaluations else {},
            "questionResults": question_results,  # New: per-question breakdown
            "passFail": {
                "isPassed": is_passed,
                "overallPercentage": round(overall_percentage, 2),
                "passPercentage": pass_percentage,
                "status": "PASSED" if is_passed else "FAILED"
            },
            "submissionInfo": {
                "submittedAt": submitted_at,
                "completedAt": completed_at,
                "status": candidate_response.get("status", "completed")
            }
        }
        
        return success_response("Detailed results fetched successfully", response_data)
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error getting detailed results for candidate {candidate_email}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get detailed results: {str(exc)}"
        ) from exc

@router.get("/{assessment_id}/questions", response_model=None)
async def get_all_questions(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    logger.info(f"[get_all_questions] GET /api/assessments/{assessment_id}/questions - Request received")
    print(f"[get_all_questions] GET /api/assessments/{assessment_id}/questions - Request received")
    try:
        assessment = await _get_assessment(db, assessment_id)
    except HTTPException as e:
        logger.error(f"[get_all_questions] Error getting assessment {assessment_id}: {e.detail}")
        print(f"[get_all_questions] Error getting assessment {assessment_id}: {e.detail}")
        raise
    _check_assessment_access(assessment, current_user)

    # Generate assessment token if it doesn't exist and assessment is ready/active
    if assessment.get("status") != "draft" and not assessment.get("assessmentToken"):
        assessment["assessmentToken"] = secrets.token_urlsafe(32)
        await _save_assessment(db, assessment)

    questions_with_topics: List[Dict[str, Any]] = []
    for topic in assessment.get("topics", []):
        topic_questions = topic.get("questions") or []
        for index, question in enumerate(topic_questions):
            question_with_topic = question.copy()
            question_with_topic.update(
                {
                    "topic": topic.get("topic"),
                    "topicDifficulty": topic.get("difficulty"),
                    "topicSource": topic.get("source"),
                    "questionIndex": index,
                }
            )
            questions_with_topics.append(question_with_topic)

    # Serialize full assessment with all fields for draft loading
    # Convert topics to serializable format
    serialized_topics = convert_object_ids(assessment.get("topics", []))
    # Convert topics_v2 to serializable format (if exists)
    serialized_topics_v2 = convert_object_ids(assessment.get("topics_v2", []))
    # Convert candidateResponses to serializable format (handles ObjectIds and datetimes)
    serialized_candidate_responses = convert_object_ids(assessment.get("candidateResponses", {}))
    
    data = {
        "assessment": {
            "id": str(assessment.get("_id")),
            "title": assessment.get("title"),
            "description": assessment.get("description"),
            "status": assessment.get("status"),
            "totalQuestions": len(questions_with_topics),
            "schedule": assessment.get("schedule"),
            "assessmentToken": assessment.get("assessmentToken"),
            # Include all assessment fields needed for draft loading
            "jobDesignation": assessment.get("jobDesignation"),
            "selectedSkills": assessment.get("selectedSkills"),
            "experienceMin": assessment.get("experienceMin"),
            "experienceMax": assessment.get("experienceMax"),
            "experienceMode": assessment.get("experienceMode"),
            "availableQuestionTypes": assessment.get("availableQuestionTypes"),
            "isAptitudeAssessment": assessment.get("isAptitudeAssessment"),
            "topics": serialized_topics,  # Include full topic objects with all fields (questionConfigs, isAptitude, coding_supported, etc.)
            "topics_v2": serialized_topics_v2,  # Include topics_v2 (new format) for draft loading
            "fullTopicRegenLocked": assessment.get("fullTopicRegenLocked", False),
            "allQuestionsGenerated": assessment.get("allQuestionsGenerated", False),
            "passPercentage": assessment.get("passPercentage"),
            "questionTypeTimes": assessment.get("questionTypeTimes"),
            "enablePerSectionTimers": assessment.get("enablePerSectionTimers"),
            "candidates": assessment.get("candidates"),
            "candidateResponses": serialized_candidate_responses,
            "assessmentUrl": assessment.get("assessmentUrl"),
            "accessMode": assessment.get("accessMode"),
            "invitationTemplate": assessment.get("invitationTemplate"),
            "currentStation": assessment.get("currentStation"),
        },
        "topics": [
            {
                "topic": topic.get("topic"),
                "numQuestions": topic.get("numQuestions"),
                "questionTypes": topic.get("questionTypes"),
                "difficulty": topic.get("difficulty"),
                "source": topic.get("source"),
                "questionCount": len(topic.get("questions") or []),
            }
            for topic in assessment.get("topics", [])
        ],
        "questions": questions_with_topics,
    }
    return success_response("All questions fetched successfully", data)


@router.get("")
async def get_all_assessments_with_schedule(
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        query: Dict[str, Any] = {}
        if current_user.get("role") == "super_admin":
            # For super_admin: only show assessments created by super_admins (any super_admin)
            # Query users collection to get all super_admin user IDs
            super_admin_cursor = db.users.find(
                {"role": "super_admin"},
                {"_id": 1}
            )
            super_admin_ids = [doc["_id"] async for doc in super_admin_cursor]
            
            if super_admin_ids:
                # Filter assessments where createdBy is in the list of super_admin IDs
                query["createdBy"] = {"$in": super_admin_ids}
            else:
                # No super_admins found - return empty result
                query["createdBy"] = {"$in": []}
        else:
            user_org = current_user.get("organization")
            user_id = current_user.get("id")
            
            logger.info(f"[get_all_assessments] User info: user_id={user_id}, user_org={user_org}, role={current_user.get('role')}")
            
            # Build query based on user's organization
            if user_org:
                # User has organization - query by organization
                try:
                    query["organization"] = to_object_id(user_org)
                    logger.info(f"[get_all_assessments] Querying by organization: {user_org}")
                except ValueError as e:
                    logger.warning(f"[get_all_assessments] Invalid organization ID {user_org}: {e}, falling back to createdBy")
                    # Invalid organization ID - fall back to createdBy
                    if user_id:
                        try:
                            query["createdBy"] = to_object_id(user_id)
                            logger.info(f"[get_all_assessments] Querying by createdBy (fallback): {user_id}")
                        except ValueError as e2:
                            logger.warning(f"[get_all_assessments] Invalid user_id {user_id}: {e2}")
            else:
                # User has no organization - query by createdBy
                if user_id:
                    try:
                        query["createdBy"] = to_object_id(user_id)
                        logger.info(f"[get_all_assessments] Querying by createdBy: {user_id}")
                    except ValueError as e:
                        logger.warning(f"[get_all_assessments] Invalid user_id {user_id}: {e}")
                else:
                    logger.warning("[get_all_assessments] No user_id or organization, query will be empty (may return all assessments)")

        logger.info(f"[get_all_assessments] Final query: {query}")
        
        # Fetch assessments with required fields - optimized query
        # Limit to prevent loading too many documents at once (safety limit)
        # Increased limit to 500 for better results, with timeout handling
        try:
            from pymongo.errors import NetworkTimeout, ServerSelectionTimeoutError, OperationFailure
            cursor = db.assessments.find(query, {"title": 1, "status": 1, "schedule": 1, "createdAt": 1, "updatedAt": 1, "organization": 1, "createdBy": 1}).limit(500)
            all_docs = await cursor.to_list(length=500)  # Fetch all at once with limit
            logger.info(f"[get_all_assessments] Found {len(all_docs)} documents from database")
        except (NetworkTimeout, ServerSelectionTimeoutError, OperationFailure) as db_error:
            # Handle MongoDB timeout and connection errors gracefully
            logger.error(f"MongoDB timeout/connection error fetching assessments: {db_error}")
            # Log the error but try to continue - don't silently return empty
            # This allows partial results if some were fetched before timeout
            all_docs = []
            logger.warning("Returning empty assessments list due to database timeout - this may indicate a performance issue")
        
        assessments = []
        
        # Process documents in batch
        for doc in all_docs:
            try:
                # Quick access check - skip if user doesn't have access
                # Only check if query didn't already filter by organization/createdBy
                if current_user.get("role") != "super_admin":
                    try:
                        _check_assessment_access(doc, current_user)
                    except HTTPException:
                        continue  # Skip this assessment
                
                schedule = doc.get("schedule")
                assessment_data = {
                    "id": str(doc.get("_id")),
                    "title": doc.get("title", ""),
                    "status": doc.get("status", "draft"),
                    "hasSchedule": bool(schedule),
                    "scheduleStatus": None,
                    "createdAt": doc.get("createdAt"),
                    "updatedAt": doc.get("updatedAt"),
                }
                
                if schedule:
                    assessment_data["scheduleStatus"] = {
                        "startTime": schedule.get("startTime"),
                        "endTime": schedule.get("endTime"),
                        "duration": schedule.get("duration"),
                        "isActive": schedule.get("isActive", False),
                    }
                
                # Serialize datetime and ObjectId fields recursively
                assessments.append(convert_object_ids(assessment_data))
            except HTTPException as http_exc:
                # Access denied - skip this assessment
                logger.debug(f"Access denied for assessment {doc.get('_id')}: {http_exc.detail}")
                continue
            except Exception as exc:
                logger.warning(f"Error processing assessment document {doc.get('_id')}: {exc}", exc_info=True)
                # Skip this assessment if there's an error processing it
                continue

        logger.info(f"[get_all_assessments] Returning {len(assessments)} assessments after processing")
        return success_response("Assessments with schedule status fetched successfully", assessments)
    except Exception as exc:
        logger.exception("Error fetching assessments: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch assessments: {str(exc)}",
        ) from exc


@router.delete("/{assessment_id}")
async def delete_assessment(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete an assessment. Only users with access to the assessment can delete it."""
    try:
        assessment = await _get_assessment(db, assessment_id)
        _check_assessment_access(assessment, current_user)

        # Delete the assessment
        result = await db.assessments.delete_one({"_id": to_object_id(assessment_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found or already deleted",
            )

        return success_response("Assessment deleted successfully", {"assessmentId": assessment_id})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error deleting assessment: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete assessment: {str(exc)}",
        ) from exc


# ============================================
# NEW TOPIC GENERATION ENDPOINTS (v2)
# ============================================

@router.post("/generate-topics")
async def generate_topics_endpoint_v2(
    payload: GenerateTopicsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Generate topics using new v2 architecture.
    Returns topics with strict data model structure.
    SINGLE DRAFT LOGIC: If assessmentId is provided, updates that draft. Otherwise, finds or creates draft.
    """
    try:
        # CREATE NEW vs EDIT DRAFT LOGIC:
        # - If assessmentId is provided: Update that specific draft (edit mode)
        # - If assessmentId is NOT provided: Always create a NEW draft (new assessment flow)
        existing_assessment = None
        if payload.assessmentId:
            # Edit mode: Update the specific assessment
            try:
                existing_assessment = await _get_assessment(db, payload.assessmentId)
                _check_assessment_access(existing_assessment, current_user)
                if existing_assessment.get("status") != "draft":
                    logger.warning(f"Assessment {payload.assessmentId} is not a draft, will create new draft")
                    existing_assessment = None
                else:
                    logger.info(f"Edit mode: Updating existing draft {payload.assessmentId}")
            except HTTPException:
                existing_assessment = None
        # If no assessmentId provided, this is a NEW assessment - always create new draft
        # Do NOT look for existing drafts - user explicitly wants a new assessment
        
        # Sanitize inputs
        sanitized_job_designation = sanitize_text_field(payload.jobDesignation) if payload.jobDesignation else None
        sanitized_title = sanitize_text_field(payload.assessmentTitle) if payload.assessmentTitle else None
        
        # Validate experience mode
        if payload.experienceMode not in ["corporate", "student"]:
            raise HTTPException(status_code=400, detail="experienceMode must be 'corporate' or 'student'")
        
        # Sanitize combined skills
        sanitized_combined_skills = []
        for skill in payload.combinedSkills:
            sanitized_skill = {
                "skill_name": sanitize_text_field(skill.skill_name),
                "source": skill.source,
                "description": sanitize_text_field(skill.description) if skill.description else None,
                "importance_level": skill.importance_level
            }
            sanitized_combined_skills.append(sanitized_skill)
        
        # Infer coding language from job designation and skills (if available)
        skill_names = [s["skill_name"] for s in sanitized_combined_skills]
        coding_language = infer_language_from_skill(
            job_designation=sanitized_job_designation or "General",
            selected_skills=skill_names
        )
        
        # Generate topics using unified function
        topics = await generate_topics_unified(
            assessment_title=sanitized_title,
            job_designation=sanitized_job_designation,
            combined_skills=sanitized_combined_skills,
            experience_min=payload.experienceMin,
            experience_max=payload.experienceMax,
            experience_mode=payload.experienceMode
        )
        
        # If existing draft found, update it. Otherwise, create new draft.
        if existing_assessment:
            # UPDATE EXISTING DRAFT
            # topics is already List[Dict[str, Any]], no need to call .dict()
            existing_assessment["topics_v2"] = topics
            existing_assessment["combinedSkills"] = sanitized_combined_skills  # Save combined skills
            if sanitized_job_designation:
                existing_assessment["jobDesignation"] = sanitized_job_designation
            existing_assessment["experienceMin"] = payload.experienceMin
            existing_assessment["experienceMax"] = payload.experienceMax
            existing_assessment["experienceMode"] = payload.experienceMode
            existing_assessment["codingLanguage"] = coding_language
            if sanitized_title:
                existing_assessment["title"] = sanitized_title
            existing_assessment["status"] = "draft"
            existing_assessment["updatedAt"] = _now_utc()
            
            await _save_assessment(db, existing_assessment)
            assessment_id = str(existing_assessment["_id"])
        else:
            # CREATE NEW DRAFT
            # topics is already List[Dict[str, Any]], no need to call .dict()
            skill_names_str = ", ".join(skill_names)
            assessment_doc: Dict[str, Any] = {
                "title": sanitized_title or f"Assessment for {sanitized_job_designation or 'Multiple Skills'}",
                "description": f"Assessment - Skills: {skill_names_str}",
                "topics_v2": topics,
                "combinedSkills": sanitized_combined_skills,  # Save combined skills
                "jobDesignation": sanitized_job_designation,
                "experienceMin": payload.experienceMin,
                "experienceMax": payload.experienceMax,
                "experienceMode": payload.experienceMode,
                "codingLanguage": coding_language,
                "status": "draft",
                "createdBy": to_object_id(current_user.get("id")),
                "organization": to_object_id(current_user.get("organization")) if current_user.get("organization") else None,
                "createdAt": _now_utc(),
                "updatedAt": _now_utc(),
            }
            result = await db.assessments.insert_one(assessment_doc)
            assessment_id = str(result.inserted_id)
        
        return success_response(
            "Topics generated successfully",
            {
                "topics": topics,  # Already List[Dict[str, Any]]
                "assessmentId": assessment_id
            }
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating topics: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate topics: {str(exc)}") from exc


@router.post("/generate-topics-from-requirements")
async def generate_topics_from_requirements_endpoint(
    payload: GenerateTopicsFromRequirementsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Generate topics from CSV requirements.
    Returns topics with source="csv" in the same format as generate_topics_v2.
    """
    try:
        # Validate experience mode
        if payload.experienceMode not in ["corporate", "student"]:
            raise HTTPException(status_code=400, detail="experienceMode must be 'corporate' or 'student'")
        
        # Convert requirements to dict format
        requirements_list = [
            {
                "skill_name": req.skill_name,
                "skill_description": req.skill_description,
                "importance_level": req.importance_level
            }
            for req in payload.requirements
        ]
        
        # Generate topics from requirements
        topics = await generate_topics_from_requirements_v2(
            requirements=requirements_list,
            experience_min=payload.experienceMin or 0,
            experience_max=payload.experienceMax or 10,
            experience_mode=payload.experienceMode
        )
        
        return success_response(
            "Topics generated successfully from requirements",
            {
                "topics": topics,
            }
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating topics from requirements: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate topics from requirements: {str(exc)}") from exc


@router.post("/regenerate-topic")
async def regenerate_topic_endpoint_v2(
    payload: RegenerateTopicRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Regenerate a single topic.
    Only allowed when topic.locked == False AND fullTopicRegenLocked == False.
    """
    try:
        # ✅ SPEED OPTIMIZATION: Get cached context (or load from MongoDB if not cached)
        from .services.assessment_cache import get_assessment_context
        cached_context = await get_assessment_context(db, payload.assessmentId)
        
        # Still need full assessment for topics_v2
        # Get assessment
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        # Get topics_v2
        topics_v2 = assessment.get("topics_v2", [])
        topic_index = None
        for idx, topic in enumerate(topics_v2):
            if topic.get("id") == payload.topicId:
                topic_index = idx
                break
        
        if topic_index is None:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        # Check if topic is locked
        if topics_v2[topic_index].get("locked", False):
            raise HTTPException(status_code=400, detail="Topic is locked and cannot be regenerated")
        
        # Check if full topic regeneration is locked
        if assessment.get("fullTopicRegenLocked", False):
            raise HTTPException(status_code=400, detail="Topic regeneration is locked after preview")
        
        # [STAR] CRITICAL FIX: Extract old topic label to avoid regenerating same content
        old_topic = topics_v2[topic_index]
        old_topic_label = old_topic.get("label", "")
        
        logger.info(f"[TOPIC-REGEN] Regenerating topic at index {topic_index}. Old topic: '{old_topic_label}'")
        
        # Sanitize inputs
        sanitized_job_designation = sanitize_text_field(payload.jobDesignation)
        sanitized_skills = [sanitize_text_field(skill) for skill in payload.selectedSkills]
        sanitized_title = sanitize_text_field(payload.assessmentTitle) if payload.assessmentTitle else None
        
        # Generate new topic with exclusion of old topic
        # Use generate_topics_unified for better control
        combined_skills = [{"skill_name": skill, "source": "manual"} for skill in sanitized_skills]
        new_topics = await generate_topics_unified(
            assessment_title=sanitized_title,
            job_designation=sanitized_job_designation,
            combined_skills=combined_skills,
            experience_min=payload.experienceMin,
            experience_max=payload.experienceMax,
            experience_mode=payload.experienceMode,
            previous_topic_label=old_topic_label  # [STAR] CRITICAL: Pass old topic to avoid repeating
        )
        
        if not new_topics:
            raise HTTPException(status_code=500, detail="Failed to generate new topic")
        
        # Replace topic at same position, reset state
        new_topic = new_topics[0]
        new_topic["id"] = payload.topicId  # Keep same ID
        new_topic["locked"] = False
        # ⭐ CRITICAL: Preserve category from old topic (don't lose it on regeneration)
        old_topic = topics_v2[topic_index]
        if old_topic.get("category"):
            new_topic["category"] = old_topic["category"]
        else:
            new_topic["category"] = "technical"  # Default if not set
        # Reset all questionRows - keep only the first auto-generated one
        if new_topic.get("questionRows"):
            first_row = new_topic["questionRows"][0]
            first_row["status"] = "pending"
            first_row["locked"] = False
            first_row["questions"] = []
            new_topic["questionRows"] = [first_row]  # Remove manually added rows
        
        topics_v2[topic_index] = new_topic
        
        # Update assessment
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response(
            "Topic regenerated successfully",
            {"topic": new_topic}
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error regenerating topic: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to regenerate topic: {str(exc)}") from exc


@router.post("/generate-question")
async def generate_question_endpoint_v2(
    payload: GenerateQuestionRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Generate questions for a single question row (preview).
    After generation: row.status = "generated", row.locked = True, topic.locked = True
    Sets fullTopicRegenLocked = True on assessment.
    """
    try:
        # ✅ SPEED OPTIMIZATION: Get cached context (or load from MongoDB if not cached)
        from .services.assessment_cache import get_assessment_context
        cached_context = await get_assessment_context(db, payload.assessmentId)
        
        # Still need full assessment for topics_v2
        # Get assessment
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        # Get topics_v2
        topics_v2 = assessment.get("topics_v2", [])
        topic_index = None
        for idx, topic in enumerate(topics_v2):
            if topic.get("id") == payload.topicId:
                topic_index = idx
                break
        
        if topic_index is None:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        topic = topics_v2[topic_index]
        
        # Find the question row
        question_rows = topic.get("questionRows", [])
        row_index = None
        for idx, row in enumerate(question_rows):
            if row.get("rowId") == payload.rowId:
                row_index = idx
                break
        
        if row_index is None:
            raise HTTPException(status_code=404, detail="Question row not found")
        
        row = question_rows[row_index]
        
        # Check if already generated
        if row.get("status") == "generated" and row.get("questions") and len(row.get("questions", [])) > 0:
            return success_response(
                "Questions already generated",
                {"questions": row.get("questions", []), "row": row, "topic": topic}
            )
        
        # Check if locked (but allow if questions don't exist yet)
        if row.get("locked", False) and row.get("questions") and len(row.get("questions", [])) > 0:
            raise HTTPException(status_code=400, detail="Row is locked and already has questions")
        if topic.get("locked", False) and row.get("questions") and len(row.get("questions", [])) > 0:
            raise HTTPException(status_code=400, detail="Topic is locked and row already has questions")
        
        # ⭐ CRITICAL FIX: Use question type from database row (source of truth), not payload
        # The payload might have stale data if frontend state wasn't updated
        question_type = row.get("questionType") or payload.questionType
        difficulty = row.get("difficulty") or payload.difficulty
        questions_count = row.get("questionsCount") or payload.questionsCount
        can_use_judge0 = row.get("canUseJudge0", False) if (row.get("questionType") or payload.questionType) == "Coding" else False
        
        # Validate required fields
        if not question_type:
            raise HTTPException(status_code=400, detail="questionType is required")
        if not difficulty:
            raise HTTPException(status_code=400, detail="difficulty is required")
        if not questions_count or questions_count < 1:
            raise HTTPException(status_code=400, detail="questionsCount must be at least 1")
        
        logger.info(f"Generating {questions_count} {question_type} question(s) for topic: {payload.topicLabel}, difficulty: {difficulty}, canUseJudge0: {can_use_judge0} (using row.questionType from DB)")
        
        # ✅ SPEED OPTIMIZATION: Use cached context instead of extracting from assessment
        if cached_context:
            coding_language = cached_context.get("coding_language", "python")
            experience_mode = payload.experienceMode or cached_context.get("experience_mode", "corporate")
            company_context = cached_context.get("company_context")
            website_summary = cached_context.get("website_summary")
            assessment_requirements = cached_context.get("assessment_requirements")
            job_designation = cached_context.get("job_designation")
            experience_min = cached_context.get("experience_min")
            experience_max = cached_context.get("experience_max")
            company_name = cached_context.get("company_name")
            additional_requirements = payload.additionalRequirements or cached_context.get("additional_requirements")
        else:
            # Fallback to assessment if cache fails
            coding_language = assessment.get("codingLanguage", "python")
            experience_mode = payload.experienceMode or assessment.get("experienceMode", "corporate")
            company_context = assessment.get("contextSummary")
            website_summary = None
            if not company_context and assessment.get("websiteSummary") and assessment["websiteSummary"].get("useForQuestions"):
                website_summary = assessment["websiteSummary"]
            additional_requirements = payload.additionalRequirements or assessment.get("additionalRequirements")
            assessment_requirements = assessment.get("requirements")
            job_designation = assessment.get("jobDesignation")
            experience_min = assessment.get("experienceMin")
            experience_max = assessment.get("experienceMax")
            company_name = company_context.get("company_name") if company_context else None
        
        # ⭐ CRITICAL FIX: Use question type from database row (source of truth), not payload
        # The payload might have stale data if frontend state wasn't updated
        question_type = row.get("questionType") or payload.questionType
        difficulty = row.get("difficulty") or payload.difficulty
        questions_count = row.get("questionsCount") or payload.questionsCount
        can_use_judge0 = row.get("canUseJudge0", False) if question_type == "Coding" else False
        
        questions = await generate_questions_for_row_v2(
            topic_label=payload.topicLabel,
            question_type=question_type,  # ⭐ Use row's question type from DB
            difficulty=difficulty,  # ⭐ Use row's difficulty from DB
            questions_count=questions_count,  # ⭐ Use row's questions count from DB
            can_use_judge0=can_use_judge0,  # ⭐ Use row's canUseJudge0 from DB
            coding_language=coding_language,
            additional_requirements=additional_requirements,
            experience_mode=experience_mode,
            website_summary=website_summary,  # Legacy
            company_context=company_context,  # New unified field
            job_designation=job_designation,  # ⭐ NEW
            experience_min=experience_min,  # ⭐ NEW
            experience_max=experience_max,  # ⭐ NEW
            company_name=company_name,  # ⭐ NEW
            assessment_requirements=assessment_requirements,
            previous_question=None  # Not regenerating  # ⭐ NEW - Highest priority context
        )
        
        if not questions or len(questions) == 0:
            logger.error(f"No questions generated for topic: {payload.topicLabel}, type: {payload.questionType}")
            raise HTTPException(status_code=500, detail="Failed to generate questions - no questions returned")
        
        # Update row
        row["questions"] = questions
        row["status"] = "generated"
        row["locked"] = True
        
        # Lock topic and full topic regeneration
        topic["locked"] = True
        assessment["fullTopicRegenLocked"] = True
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {
                "topics_v2": topics_v2,
                "fullTopicRegenLocked": True,
                "updatedAt": assessment["updatedAt"]
            }}
        )
        
        return success_response(
            "Questions generated successfully",
            {"questions": questions, "row": row, "topic": topic}
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating questions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(exc)}") from exc


@router.post("/generate-all-questions")
async def generate_all_questions_endpoint_v2(
    payload: GenerateAllQuestionsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Generate questions for all pending topics.
    After completion: lock all topics, disable all buttons.
    Sets allQuestionsGenerated = True on assessment.
    """
    try:
        # ✅ SPEED OPTIMIZATION: Get cached context (or load from MongoDB if not cached)
        from .services.assessment_cache import get_assessment_context
        cached_context = await get_assessment_context(db, payload.assessmentId)
        
        # Still need full assessment for topics_v2
        # Get assessment
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        topics_v2 = payload.topics
        
        # Convert Pydantic models to dicts if needed
        topics_list = [topic if isinstance(topic, dict) else topic.model_dump() for topic in topics_v2]
        
        # Get coding language from assessment (fallback to python)
        coding_language = assessment.get("codingLanguage", "python")
        
        # Generate questions only for pending rows
        generated_count = 0
        for topic in topics_list:
            question_rows = topic.get("questionRows", [])
            for row in question_rows:
                if row.get("status") == "pending" and not row.get("questions") and not row.get("locked"):
                    try:
                        # Get company context (new) or websiteSummary (legacy)
                        company_context = assessment.get("contextSummary")
                        website_summary = None
                        if not company_context and assessment.get("websiteSummary") and assessment["websiteSummary"].get("useForQuestions"):
                            website_summary = assessment["websiteSummary"]
                        
                        # Priority: row-level > assessment-level > company context > website summary
                        additional_requirements = row.get("additionalRequirements")  # Topic/row-level (highest priority)
                        if not additional_requirements:
                            additional_requirements = assessment.get("additionalRequirements")  # Assessment-level (fallback)
                        
                        # ⭐ Extract context-aware personalization parameters
                        assessment_requirements = assessment.get("requirements")
                        job_designation = assessment.get("jobDesignation")
                        experience_min = assessment.get("experienceMin")
                        experience_max = assessment.get("experienceMax")
                        company_name = company_context.get("company_name") if company_context else None
                        
                        questions = await generate_questions_for_row_v2(
                            topic_label=topic["label"],
                            question_type=row["questionType"],
                            difficulty=row["difficulty"],
                            questions_count=row["questionsCount"],
                            can_use_judge0=row.get("canUseJudge0", False),
                            coding_language=coding_language,
                            additional_requirements=additional_requirements,
                            experience_mode=assessment.get("experienceMode", "corporate"),
                            website_summary=website_summary,
                            company_context=company_context,
                            job_designation=job_designation,  # ⭐ NEW
                            experience_min=experience_min,  # ⭐ NEW
                            experience_max=experience_max,  # ⭐ NEW
                            company_name=company_name,  # ⭐ NEW
                            assessment_requirements=assessment_requirements  # ⭐ NEW
                        )
                        
                        row["questions"] = questions
                        row["status"] = "generated"
                        row["locked"] = True
                        generated_count += 1
                    except Exception as exc:
                        logger.error(f"Error generating questions for row {row.get('rowId')}: {exc}")
                        # Continue with other rows
            
            # Lock topic if any row was generated
            if any(r.get("locked") for r in question_rows):
                topic["locked"] = True
        
        # Lock all topics and set flags
        for topic in topics_list:
            topic["locked"] = True
        
        # Update assessment
        assessment["topics_v2"] = topics_list
        assessment["allQuestionsGenerated"] = True
        assessment["fullTopicRegenLocked"] = True
        assessment["updatedAt"] = datetime.now(timezone.utc)
        
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {
                "topics_v2": topics_list,
                "allQuestionsGenerated": True,
                "fullTopicRegenLocked": True,
                "updatedAt": assessment["updatedAt"]
            }}
        )
        
        return success_response(
            f"Generated questions for {generated_count} question rows",
            {"topics": topics_list, "generatedCount": generated_count}
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating all questions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate all questions: {str(exc)}") from exc


@router.post("/add-question-row")
async def add_question_row_endpoint(
    payload: AddQuestionRowRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Add a new question row to a topic."""
    try:
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        topics_v2 = assessment.get("topics_v2", [])
        topic = next((t for t in topics_v2 if t.get("id") == payload.topicId), None)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        if topic.get("locked"):
            raise HTTPException(status_code=400, detail="Topic is locked")
        
        # Get first row's canUseJudge0 as default
        first_row = topic.get("questionRows", [{}])[0] if topic.get("questionRows") else {}
        can_use_judge0 = first_row.get("canUseJudge0", False)
        
        # Check if topic is in special category (aptitude, communication, logical_reasoning)
        topic_category = topic.get("category", "technical")
        special_categories = ["aptitude", "communication", "logical_reasoning"]
        is_special_category = topic_category in special_categories
        
        # Get allowed question types from topic (for soft skills)
        allowed_question_types = topic.get("allowedQuestionTypes", [])
        if allowed_question_types and len(allowed_question_types) > 0:
            # Use first allowed type as default for soft skills
            default_question_type = allowed_question_types[0]
        elif not is_special_category and first_row:
            # For technical topics, use first row's question type or MCQ
            default_question_type = first_row.get("questionType", "MCQ")
        else:
            # Default to MCQ for special categories
            default_question_type = "MCQ"
        
        # Create new row
        import uuid
        new_row = {
            "rowId": str(uuid.uuid4()),
            "questionType": default_question_type,
            "difficulty": "Easy",
            "questionsCount": 1,
            "canUseJudge0": False if is_special_category else can_use_judge0,  # Special categories never use Judge0
            "status": "pending",
            "locked": False,
            "questions": []
        }
        
        topic.setdefault("questionRows", []).append(new_row)
        
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response("Question row added successfully", {"row": new_row, "topic": topic})
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error adding question row: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add question row: {str(exc)}") from exc


@router.post("/remove-question-row")
async def remove_question_row_endpoint(
    payload: RemoveQuestionRowRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Remove a question row from a topic."""
    try:
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        topics_v2 = assessment.get("topics_v2", [])
        topic = next((t for t in topics_v2 if t.get("id") == payload.topicId), None)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        question_rows = topic.get("questionRows", [])
        if len(question_rows) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last question row")
        
        row = next((r for r in question_rows if r.get("rowId") == payload.rowId), None)
        if not row:
            raise HTTPException(status_code=404, detail="Question row not found")
        
        if row.get("locked"):
            raise HTTPException(status_code=400, detail="Question row is locked")
        
        # Remove row
        topic["questionRows"] = [r for r in question_rows if r.get("rowId") != payload.rowId]
        
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response("Question row removed successfully", {"topic": topic})
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error removing question row: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to remove question row: {str(exc)}") from exc


@router.post("/regenerate-single-question")
async def regenerate_single_question_endpoint(
    payload: RegenerateSingleQuestionRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Regenerate a single question within a row."""
    try:
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        topics_v2 = assessment.get("topics_v2", [])
        topic = next((t for t in topics_v2 if t.get("id") == payload.topicId), None)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        question_rows = topic.get("questionRows", [])
        row = next((r for r in question_rows if r.get("rowId") == payload.rowId), None)
        if not row:
            raise HTTPException(status_code=404, detail="Question row not found")
        
        questions = row.get("questions", [])
        if payload.questionIndex >= len(questions):
            raise HTTPException(status_code=400, detail="Question index out of range")
        
        # Regenerate single question
        
        # ⭐ CRITICAL FIX: Extract old question to avoid regenerating same content
        old_question = questions[payload.questionIndex]
        old_question_text = None
        
        # Extract question text based on question type
        if isinstance(old_question, dict):
            # For most question types, extract the "question" field
            old_question_text = old_question.get("question", "")
            
            # For MCQ, include options context too (so AI knows full question)
            if row.get("questionType") == "MCQ" and old_question.get("options"):
                old_question_text = f"{old_question_text}\nOptions: {', '.join(old_question.get('options', []))}"
        else:
            old_question_text = str(old_question)
        
        logger.info(f"[REGEN] Regenerating question at index {payload.questionIndex}. Old question preview: {old_question_text[:100] if old_question_text else 'N/A'}...")
        # Get company context (new) or websiteSummary (legacy)
        company_context = assessment.get("contextSummary")
        website_summary = None
        if not company_context and assessment.get("websiteSummary") and assessment["websiteSummary"].get("useForQuestions"):
            website_summary = assessment["websiteSummary"]
        
        # Priority: row-level > assessment-level > company context > website summary
        additional_requirements = row.get("additionalRequirements")  # Topic/row-level (highest priority)
        if not additional_requirements:
            additional_requirements = assessment.get("additionalRequirements")  # Assessment-level (fallback)
        
        # ⭐ Extract context-aware personalization parameters
        assessment_requirements = assessment.get("requirements")
        job_designation = assessment.get("jobDesignation")
        experience_min = assessment.get("experienceMin")
        experience_max = assessment.get("experienceMax")
        company_name = company_context.get("company_name") if company_context else None
        
        new_questions = await generate_questions_for_row_v2(
            topic_label=topic["label"],
            question_type=row["questionType"],
            difficulty=row["difficulty"],
            questions_count=1,
            can_use_judge0=row.get("canUseJudge0", False),
            additional_requirements=additional_requirements,
            experience_mode=assessment.get("experienceMode", "corporate"),
            website_summary=website_summary,
            company_context=company_context,
            job_designation=job_designation,  # ⭐ NEW
            experience_min=experience_min,  # ⭐ NEW
            experience_max=experience_max,  # ⭐ NEW
            company_name=company_name,  # ⭐ NEW
            assessment_requirements=assessment_requirements  # ⭐ NEW
        )
        
        if new_questions:
            questions[payload.questionIndex] = new_questions[0]
            row["questions"] = questions
        
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response("Question regenerated successfully", {"row": row})
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error regenerating question: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to regenerate question: {str(exc)}") from exc


@router.put("/update-single-question-v2")
async def update_single_question_endpoint_v2(
    payload: UpdateSingleQuestionRequestV2,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update a single question within a row (topicsV2 structure)."""
    try:
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        topics_v2 = assessment.get("topics_v2", [])
        topic = next((t for t in topics_v2 if t.get("id") == payload.topicId), None)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        question_rows = topic.get("questionRows", [])
        row = next((r for r in question_rows if r.get("rowId") == payload.rowId), None)
        if not row:
            raise HTTPException(status_code=404, detail="Question row not found")
        
        questions = row.get("questions", [])
        if payload.questionIndex >= len(questions):
            raise HTTPException(status_code=400, detail="Question index out of range")
        
        # Update the question
        questions[payload.questionIndex] = payload.question
        row["questions"] = questions
        
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response("Question updated successfully", {"row": row, "topic": topic})
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error updating single question: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update single question: {str(exc)}") from exc


@router.post("/suggest-topic-contexts")
async def suggest_topic_contexts_endpoint(
    partial_input: str = Query(..., min_length=2),
    category: str = Query(..., pattern=r"^(aptitude|communication|logical_reasoning)$"),
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Get semantic topic suggestions based on partial user input."""
    try:
        suggestions = await suggest_topic_contexts(partial_input, category)
        return success_response("Suggestions generated", {"suggestions": suggestions})
    except Exception as exc:
        logger.error(f"Error generating topic suggestions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(exc)}") from exc


@router.post("/generate-topic-context")
async def generate_topic_context_endpoint(
    topic_name: str = Query(..., min_length=1),
    category: str = Query(..., pattern=r"^(aptitude|communication|logical_reasoning)$"),
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Generate context summary and suggested question type for a topic."""
    try:
        context_data = await generate_topic_context_summary(topic_name, category)
        return success_response("Context generated", context_data)
    except Exception as exc:
        logger.error(f"Error generating topic context: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate context: {str(exc)}") from exc


@router.post("/detect-topic-category")
async def detect_topic_category_endpoint(
    topic_name: str = Query(..., min_length=1),
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Detect topic category (aptitude, communication, logical_reasoning, or technical) using semantic understanding."""
    try:
        category = await _detect_category_semantically(topic_name)
        return success_response("Category detected", {"category": category})
    except Exception as exc:
        logger.error(f"Error detecting topic category: {exc}", exc_info=True)
        # Fallback to technical
        return success_response("Category detected", {"category": "technical"})


@router.post("/topics/suggest")
async def suggest_topics_endpoint(
    payload: SuggestTopicsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Get AI-powered topic suggestions based on category and partial query."""
    try:
        suggestions = await suggest_topics(payload.category, payload.query)
        return success_response("Suggestions generated", {"suggestions": suggestions})
    except Exception as exc:
        logger.error(f"Error generating topic suggestions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(exc)}") from exc


@router.post("/topics/classify-technical-topic")
async def classify_technical_topic_endpoint(
    payload: ClassifyTechnicalTopicRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Classify a technical topic to determine question type, Judge0 support, and context."""
    try:
        classification = await classify_technical_topic(payload.topic)
        return success_response("Topic classified", classification)
    except Exception as exc:
        logger.error(f"Error classifying technical topic: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to classify topic: {str(exc)}") from exc




        all_questions = []
        for topic in assessment.get("topics", []):
            if not topic or not isinstance(topic, dict):
                continue
            topic_questions = topic.get("questions", [])
            if topic_questions and isinstance(topic_questions, list):
                for question in topic_questions:
                    if question and isinstance(question, dict):
                        all_questions.append(question)

        # Get submitted answers from candidate responses
        candidate_responses = assessment.get("candidateResponses", {})
        submitted_answers = {}  # {questionIndex: answer}
        if isinstance(candidate_responses, dict):
            candidate_response = candidate_responses.get(candidate_key, {})
            if isinstance(candidate_response, dict):
                # Get submitted answers
                answers_list = candidate_response.get("answers", [])
                if isinstance(answers_list, list):
                    for ans in answers_list:
                        if isinstance(ans, dict):
                            q_idx = ans.get("questionIndex")
                            if q_idx is not None:
                                submitted_answers[q_idx] = ans.get("answer", "")

        # Format logs with question details
        # First, process questions that have logs
        questions_with_logs = set()
        formatted_logs = []
        for question_index_str, log_entries in candidate_logs.items():
            try:
                if not isinstance(log_entries, list):
                    logger.warning(f"Log entries for question {question_index_str} is not a list, skipping")
                    continue
                    
                question_index = int(question_index_str)
                if 0 <= question_index < len(all_questions):
                    question = all_questions[question_index]
                    # Serialize log entries to ensure they're JSON-serializable
                    # Use array index + 1 as version fallback to handle any race conditions during write
                    serialized_logs = []
                    for idx, log_entry in enumerate(log_entries):
                        if isinstance(log_entry, dict):
                            # Use stored version if available, otherwise use array index + 1
                            # This ensures versions are always correct even if there was a race condition
                            stored_version = log_entry.get("version", 0)
                            version = stored_version if stored_version > 0 else (idx + 1)
                            serialized_logs.append({
                                "answer": str(log_entry.get("answer", "")),
                                "questionType": str(log_entry.get("questionType", "")),
                                "timestamp": str(log_entry.get("timestamp", "")),
                                "version": int(version),
                            })
                    
                    # For MCQ questions, check if answer is correct
                    is_mcq_correct = None
                    if question.get("type") == "MCQ":
                        correct_answer = question.get("correctAnswer", "")
                        # Get the last answer from logs
                        if serialized_logs and len(serialized_logs) > 0:
                            last_log = serialized_logs[-1]  # Last version
                            candidate_answer = last_log.get("answer", "").strip()
                            is_mcq_correct = (candidate_answer == correct_answer) if correct_answer else None
                    
                    formatted_logs.append({
                        "questionIndex": question_index,
                        "questionText": str(question.get("questionText", "")),
                        "questionType": str(question.get("type", "")),
                        "logs": serialized_logs,  # Already in order (version 1, 2, 3, etc.)
                        "maxScore": question.get("score", 5),
                        "isMcqCorrect": is_mcq_correct,  # For MCQ: True/False, for others: None
                        "correctAnswer": question.get("correctAnswer") if question.get("type") == "MCQ" else None,
                        "options": question.get("options", []) if question.get("type") == "MCQ" else None,  # MCQ options
                    })
                    questions_with_logs.add(question_index)
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid question index in logs: {question_index_str}, error: {e}")
                continue
            except Exception as e:
                logger.warning(f"Error processing log entry for question {question_index_str}: {e}")
                continue

        # Add questions that don't have logs but have submitted answers (especially MCQ)
        # Also include ALL MCQ questions even if they have no logs or submitted answers
        # Get submission time from candidate response
        submission_time = None
        if isinstance(candidate_responses, dict):
            candidate_response = candidate_responses.get(candidate_key, {})
            if isinstance(candidate_response, dict):
                submitted_at = candidate_response.get("submittedAt")
                if submitted_at:
                    submission_time = submitted_at
        if not submission_time:
            submission_time = datetime.now(timezone.utc).isoformat()
        
        for idx, question in enumerate(all_questions):
            if idx not in questions_with_logs and isinstance(question, dict):
                # Check if there's a submitted answer for this question
                submitted_answer = submitted_answers.get(idx)
                
                # For MCQ questions, ALWAYS include them (even if no logs and no submitted answer)
                # For other question types, only include if there's a submitted answer
                is_mcq = question.get("type") == "MCQ"
                should_include = submitted_answer is not None or is_mcq
                
                if should_include:
                    # Create a log entry from submitted answer (or empty for MCQ without answer)
                    serialized_logs = []
                    answer_to_use = str(submitted_answer) if submitted_answer is not None else ""
                    # Always create a log entry for MCQs, even if answer is empty
                    if answer_to_use or is_mcq:
                        # Create a single log entry for the submitted answer
                        serialized_logs.append({
                            "answer": answer_to_use,
                            "questionType": str(question.get("type", "")),
                            "timestamp": submission_time,
                            "version": 1,
                        })
                    
                    # For MCQ questions, check if answer is correct
                    is_mcq_correct = None
                    if is_mcq:
                        correct_answer = question.get("correctAnswer", "")
                        if answer_to_use:
                            is_mcq_correct = (answer_to_use.strip() == correct_answer) if correct_answer else None
                        else:
                            is_mcq_correct = False  # No answer provided = incorrect
                    
                    formatted_logs.append({
                        "questionIndex": idx,
                        "questionText": str(question.get("questionText", "")),
                        "questionType": str(question.get("type", "")),
                        "logs": serialized_logs,
                        "maxScore": question.get("score", 5),
                        "isMcqCorrect": is_mcq_correct,
                        "correctAnswer": question.get("correctAnswer") if is_mcq else None,
                        "options": question.get("options", []) if is_mcq else None,
                    })

        # Sort by question index
        formatted_logs.sort(key=lambda x: x["questionIndex"])

        return success_response("Answer logs fetched successfully", formatted_logs)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error fetching answer logs: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch answer logs: {str(exc)}",
        ) from exc


@router.get("/{assessment_id}/candidate-results")
async def get_candidate_results(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get candidate results for an assessment."""
    try:
        assessment = await _get_assessment(db, assessment_id)
        _check_assessment_access(assessment, current_user)

        # Handle candidateResponses - it might be None, empty dict, or not exist
        candidate_responses = assessment.get("candidateResponses")
        if candidate_responses is None:
            candidate_responses = {}
        elif not isinstance(candidate_responses, dict):
            candidate_responses = {}
        
        results = []
        
        # Safely iterate over candidate responses
        if candidate_responses:
            for key, response in candidate_responses.items():
                if not isinstance(response, dict):
                    continue
                    
                # Extract email and name from response or key
                email = response.get("email", "")
                name = response.get("name", "")
                if not email or not name:
                    # Try to extract from key format: "email_name"
                    parts = key.split("_", 1)
                    if len(parts) == 2:
                        email = email or parts[0]
                        name = name or parts[1].replace("_", " ").title()
                
                # Safely extract all fields with defaults
                result_item = {
                    "email": email,
                    "name": name,
                    "score": response.get("score", 0),
                    "maxScore": response.get("maxScore", 0),
                    "attempted": response.get("attempted", 0),
                    "notAttempted": response.get("notAttempted", 0),
                    "correctAnswers": response.get("correctAnswers", 0),
                    "submittedAt": response.get("submittedAt") or response.get("answers", {}).get("submittedAt"),
                    "startedAt": response.get("startedAt"),
                }
                
                # Include candidate info (requirements filled during assessment)
                candidate_info = response.get("candidateInfo", {})
                if candidate_info:
                    result_item["candidateInfo"] = {
                        "phone": candidate_info.get("phone"),
                        "hasResume": candidate_info.get("hasResume", False),
                        "savedAt": candidate_info.get("savedAt"),
                    }
                    # Include LinkedIn, GitHub, and custom fields if available
                    if "linkedIn" in candidate_info:
                        result_item["candidateInfo"]["linkedIn"] = candidate_info.get("linkedIn")
                    if "github" in candidate_info:
                        result_item["candidateInfo"]["github"] = candidate_info.get("github")
                    if "customFields" in candidate_info:
                        result_item["candidateInfo"]["customFields"] = candidate_info.get("customFields")
                
                results.append(result_item)
        
        return success_response("Candidate results fetched successfully", results)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error getting candidate results for assessment {assessment_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get candidate results: {str(exc)}"
        ) from exc


@router.get("/{assessment_id}/questions", response_model=None)
async def get_all_questions(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    logger.info(f"[get_all_questions] GET /api/assessments/{assessment_id}/questions - Request received")
    print(f"[get_all_questions] GET /api/assessments/{assessment_id}/questions - Request received")
    try:
        assessment = await _get_assessment(db, assessment_id)
    except HTTPException as e:
        logger.error(f"[get_all_questions] Error getting assessment {assessment_id}: {e.detail}")
        print(f"[get_all_questions] Error getting assessment {assessment_id}: {e.detail}")
        raise
    _check_assessment_access(assessment, current_user)

    # Generate assessment token if it doesn't exist and assessment is ready/active
    if assessment.get("status") != "draft" and not assessment.get("assessmentToken"):
        assessment["assessmentToken"] = secrets.token_urlsafe(32)
        await _save_assessment(db, assessment)

    questions_with_topics: List[Dict[str, Any]] = []
    for topic in assessment.get("topics", []):
        topic_questions = topic.get("questions") or []
        for index, question in enumerate(topic_questions):
            question_with_topic = question.copy()
            question_with_topic.update(
                {
                    "topic": topic.get("topic"),
                    "topicDifficulty": topic.get("difficulty"),
                    "topicSource": topic.get("source"),
                    "questionIndex": index,
                }
            )
            questions_with_topics.append(question_with_topic)

    # Serialize full assessment with all fields for draft loading
    # Convert topics to serializable format
    serialized_topics = convert_object_ids(assessment.get("topics", []))
    # Convert topics_v2 to serializable format (if exists)
    serialized_topics_v2 = convert_object_ids(assessment.get("topics_v2", []))
    # Convert candidateResponses to serializable format (handles ObjectIds and datetimes)
    serialized_candidate_responses = convert_object_ids(assessment.get("candidateResponses", {}))
    
    data = {
        "assessment": {
            "id": str(assessment.get("_id")),
            "title": assessment.get("title"),
            "description": assessment.get("description"),
            "status": assessment.get("status"),
            "totalQuestions": len(questions_with_topics),
            "schedule": assessment.get("schedule"),
            "assessmentToken": assessment.get("assessmentToken"),
            # Include all assessment fields needed for draft loading
            "jobDesignation": assessment.get("jobDesignation"),
            "selectedSkills": assessment.get("selectedSkills"),
            "experienceMin": assessment.get("experienceMin"),
            "experienceMax": assessment.get("experienceMax"),
            "experienceMode": assessment.get("experienceMode"),
            "availableQuestionTypes": assessment.get("availableQuestionTypes"),
            "isAptitudeAssessment": assessment.get("isAptitudeAssessment"),
            "topics": serialized_topics,  # Include full topic objects with all fields (questionConfigs, isAptitude, coding_supported, etc.)
            "topics_v2": serialized_topics_v2,  # Include topics_v2 (new format) for draft loading
            "fullTopicRegenLocked": assessment.get("fullTopicRegenLocked", False),
            "allQuestionsGenerated": assessment.get("allQuestionsGenerated", False),
            "passPercentage": assessment.get("passPercentage"),
            "questionTypeTimes": assessment.get("questionTypeTimes"),
            "enablePerSectionTimers": assessment.get("enablePerSectionTimers"),
            "candidates": assessment.get("candidates"),
            "candidateResponses": serialized_candidate_responses,
            "assessmentUrl": assessment.get("assessmentUrl"),
            "accessMode": assessment.get("accessMode"),
            "invitationTemplate": assessment.get("invitationTemplate"),
            "currentStation": assessment.get("currentStation"),
        },
        "topics": [
            {
                "topic": topic.get("topic"),
                "numQuestions": topic.get("numQuestions"),
                "questionTypes": topic.get("questionTypes"),
                "difficulty": topic.get("difficulty"),
                "source": topic.get("source"),
                "questionCount": len(topic.get("questions") or []),
            }
            for topic in assessment.get("topics", [])
        ],
        "questions": questions_with_topics,
    }
    return success_response("All questions fetched successfully", data)


@router.get("")
async def get_all_assessments_with_schedule(
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        query: Dict[str, Any] = {}
        if current_user.get("role") == "super_admin":
            # For super_admin: only show assessments created by super_admins (any super_admin)
            # Query users collection to get all super_admin user IDs
            super_admin_cursor = db.users.find(
                {"role": "super_admin"},
                {"_id": 1}
            )
            super_admin_ids = [doc["_id"] async for doc in super_admin_cursor]
            
            if super_admin_ids:
                # Filter assessments where createdBy is in the list of super_admin IDs
                query["createdBy"] = {"$in": super_admin_ids}
            else:
                # No super_admins found - return empty result
                query["createdBy"] = {"$in": []}
        else:
            user_org = current_user.get("organization")
            user_id = current_user.get("id")
            
            logger.info(f"[get_all_assessments] User info: user_id={user_id}, user_org={user_org}, role={current_user.get('role')}")
            
            # Build query based on user's organization
            if user_org:
                # User has organization - query by organization
                try:
                    query["organization"] = to_object_id(user_org)
                    logger.info(f"[get_all_assessments] Querying by organization: {user_org}")
                except ValueError as e:
                    logger.warning(f"[get_all_assessments] Invalid organization ID {user_org}: {e}, falling back to createdBy")
                    # Invalid organization ID - fall back to createdBy
                    if user_id:
                        try:
                            query["createdBy"] = to_object_id(user_id)
                            logger.info(f"[get_all_assessments] Querying by createdBy (fallback): {user_id}")
                        except ValueError as e2:
                            logger.warning(f"[get_all_assessments] Invalid user_id {user_id}: {e2}")
            else:
                # User has no organization - query by createdBy
                if user_id:
                    try:
                        query["createdBy"] = to_object_id(user_id)
                        logger.info(f"[get_all_assessments] Querying by createdBy: {user_id}")
                    except ValueError as e:
                        logger.warning(f"[get_all_assessments] Invalid user_id {user_id}: {e}")
                else:
                    logger.warning("[get_all_assessments] No user_id or organization, query will be empty (may return all assessments)")

        logger.info(f"[get_all_assessments] Final query: {query}")
        
        # Fetch assessments with required fields - optimized query
        # Limit to prevent loading too many documents at once (safety limit)
        # Increased limit to 500 for better results, with timeout handling
        try:
            from pymongo.errors import NetworkTimeout, ServerSelectionTimeoutError, OperationFailure
            cursor = db.assessments.find(query, {"title": 1, "status": 1, "schedule": 1, "createdAt": 1, "updatedAt": 1, "organization": 1, "createdBy": 1}).limit(500)
            all_docs = await cursor.to_list(length=500)  # Fetch all at once with limit
            logger.info(f"[get_all_assessments] Found {len(all_docs)} documents from database")
        except (NetworkTimeout, ServerSelectionTimeoutError, OperationFailure) as db_error:
            # Handle MongoDB timeout and connection errors gracefully
            logger.error(f"MongoDB timeout/connection error fetching assessments: {db_error}")
            # Log the error but try to continue - don't silently return empty
            # This allows partial results if some were fetched before timeout
            all_docs = []
            logger.warning("Returning empty assessments list due to database timeout - this may indicate a performance issue")
        
        assessments = []
        
        # Process documents in batch
        for doc in all_docs:
            try:
                # Quick access check - skip if user doesn't have access
                # Only check if query didn't already filter by organization/createdBy
                if current_user.get("role") != "super_admin":
                    try:
                        _check_assessment_access(doc, current_user)
                    except HTTPException:
                        continue  # Skip this assessment
                
                schedule = doc.get("schedule")
                assessment_data = {
                    "id": str(doc.get("_id")),
                    "title": doc.get("title", ""),
                    "status": doc.get("status", "draft"),
                    "hasSchedule": bool(schedule),
                    "scheduleStatus": None,
                    "createdAt": doc.get("createdAt"),
                    "updatedAt": doc.get("updatedAt"),
                }
                
                if schedule:
                    assessment_data["scheduleStatus"] = {
                        "startTime": schedule.get("startTime"),
                        "endTime": schedule.get("endTime"),
                        "duration": schedule.get("duration"),
                        "isActive": schedule.get("isActive", False),
                    }
                
                # Serialize datetime and ObjectId fields recursively
                assessments.append(convert_object_ids(assessment_data))
            except HTTPException as http_exc:
                # Access denied - skip this assessment
                logger.debug(f"Access denied for assessment {doc.get('_id')}: {http_exc.detail}")
                continue
            except Exception as exc:
                logger.warning(f"Error processing assessment document {doc.get('_id')}: {exc}", exc_info=True)
                # Skip this assessment if there's an error processing it
                continue

        logger.info(f"[get_all_assessments] Returning {len(assessments)} assessments after processing")
        return success_response("Assessments with schedule status fetched successfully", assessments)
    except Exception as exc:
        logger.exception("Error fetching assessments: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch assessments: {str(exc)}",
        ) from exc


@router.delete("/{assessment_id}")
async def delete_assessment(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete an assessment. Only users with access to the assessment can delete it."""
    try:
        assessment = await _get_assessment(db, assessment_id)
        _check_assessment_access(assessment, current_user)

        # Delete the assessment
        result = await db.assessments.delete_one({"_id": to_object_id(assessment_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found or already deleted",
            )

        return success_response("Assessment deleted successfully", {"assessmentId": assessment_id})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error deleting assessment: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete assessment: {str(exc)}",
        ) from exc


# ============================================
# NEW TOPIC GENERATION ENDPOINTS (v2)
# ============================================

@router.post("/generate-topics")
async def generate_topics_endpoint_v2(
    payload: GenerateTopicsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Generate topics using new v2 architecture.
    Returns topics with strict data model structure.
    SINGLE DRAFT LOGIC: If assessmentId is provided, updates that draft. Otherwise, finds or creates draft.
    """
    try:
        # CREATE NEW vs EDIT DRAFT LOGIC:
        # - If assessmentId is provided: Update that specific draft (edit mode)
        # - If assessmentId is NOT provided: Always create a NEW draft (new assessment flow)
        existing_assessment = None
        if payload.assessmentId:
            # Edit mode: Update the specific assessment
            try:
                existing_assessment = await _get_assessment(db, payload.assessmentId)
                _check_assessment_access(existing_assessment, current_user)
                if existing_assessment.get("status") != "draft":
                    logger.warning(f"Assessment {payload.assessmentId} is not a draft, will create new draft")
                    existing_assessment = None
                else:
                    logger.info(f"Edit mode: Updating existing draft {payload.assessmentId}")
            except HTTPException:
                existing_assessment = None
        # If no assessmentId provided, this is a NEW assessment - always create new draft
        # Do NOT look for existing drafts - user explicitly wants a new assessment
        
        # Sanitize inputs
        sanitized_job_designation = sanitize_text_field(payload.jobDesignation) if payload.jobDesignation else None
        sanitized_title = sanitize_text_field(payload.assessmentTitle) if payload.assessmentTitle else None
        
        # Validate experience mode
        if payload.experienceMode not in ["corporate", "student"]:
            raise HTTPException(status_code=400, detail="experienceMode must be 'corporate' or 'student'")
        
        # Sanitize combined skills
        sanitized_combined_skills = []
        for skill in payload.combinedSkills:
            sanitized_skill = {
                "skill_name": sanitize_text_field(skill.skill_name),
                "source": skill.source,
                "description": sanitize_text_field(skill.description) if skill.description else None,
                "importance_level": skill.importance_level
            }
            sanitized_combined_skills.append(sanitized_skill)
        
        # Infer coding language from job designation and skills (if available)
        skill_names = [s["skill_name"] for s in sanitized_combined_skills]
        coding_language = infer_language_from_skill(
            job_designation=sanitized_job_designation or "General",
            selected_skills=skill_names
        )
        
        # Generate topics using unified function
        topics = await generate_topics_unified(
            assessment_title=sanitized_title,
            job_designation=sanitized_job_designation,
            combined_skills=sanitized_combined_skills,
            experience_min=payload.experienceMin,
            experience_max=payload.experienceMax,
            experience_mode=payload.experienceMode
        )
        
        # If existing draft found, update it. Otherwise, create new draft.
        if existing_assessment:
            # UPDATE EXISTING DRAFT
            # topics is already List[Dict[str, Any]], no need to call .dict()
            existing_assessment["topics_v2"] = topics
            existing_assessment["combinedSkills"] = sanitized_combined_skills  # Save combined skills
            if sanitized_job_designation:
                existing_assessment["jobDesignation"] = sanitized_job_designation
            existing_assessment["experienceMin"] = payload.experienceMin
            existing_assessment["experienceMax"] = payload.experienceMax
            existing_assessment["experienceMode"] = payload.experienceMode
            existing_assessment["codingLanguage"] = coding_language
            if sanitized_title:
                existing_assessment["title"] = sanitized_title
            existing_assessment["status"] = "draft"
            existing_assessment["updatedAt"] = _now_utc()
            
            await _save_assessment(db, existing_assessment)
            assessment_id = str(existing_assessment["_id"])
        else:
            # CREATE NEW DRAFT
            # topics is already List[Dict[str, Any]], no need to call .dict()
            skill_names_str = ", ".join(skill_names)
            assessment_doc: Dict[str, Any] = {
                "title": sanitized_title or f"Assessment for {sanitized_job_designation or 'Multiple Skills'}",
                "description": f"Assessment - Skills: {skill_names_str}",
                "topics_v2": topics,
                "combinedSkills": sanitized_combined_skills,  # Save combined skills
                "jobDesignation": sanitized_job_designation,
                "experienceMin": payload.experienceMin,
                "experienceMax": payload.experienceMax,
                "experienceMode": payload.experienceMode,
                "codingLanguage": coding_language,
                "status": "draft",
                "createdBy": to_object_id(current_user.get("id")),
                "organization": to_object_id(current_user.get("organization")) if current_user.get("organization") else None,
                "createdAt": _now_utc(),
                "updatedAt": _now_utc(),
            }
            result = await db.assessments.insert_one(assessment_doc)
            assessment_id = str(result.inserted_id)
        
        return success_response(
            "Topics generated successfully",
            {
                "topics": topics,  # Already List[Dict[str, Any]]
                "assessmentId": assessment_id
            }
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating topics: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate topics: {str(exc)}") from exc


@router.post("/generate-topics-from-requirements")
async def generate_topics_from_requirements_endpoint(
    payload: GenerateTopicsFromRequirementsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Generate topics from CSV requirements.
    Returns topics with source="csv" in the same format as generate_topics_v2.
    """
    try:
        # Validate experience mode
        if payload.experienceMode not in ["corporate", "student"]:
            raise HTTPException(status_code=400, detail="experienceMode must be 'corporate' or 'student'")
        
        # Convert requirements to dict format
        requirements_list = [
            {
                "skill_name": req.skill_name,
                "skill_description": req.skill_description,
                "importance_level": req.importance_level
            }
            for req in payload.requirements
        ]
        
        # Generate topics from requirements
        topics = await generate_topics_from_requirements_v2(
            requirements=requirements_list,
            experience_min=payload.experienceMin or 0,
            experience_max=payload.experienceMax or 10,
            experience_mode=payload.experienceMode
        )
        
        return success_response(
            "Topics generated successfully from requirements",
            {
                "topics": topics,
            }
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating topics from requirements: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate topics from requirements: {str(exc)}") from exc


@router.post("/regenerate-topic")
async def regenerate_topic_endpoint_v2(
    payload: RegenerateTopicRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Regenerate a single topic.
    Only allowed when topic.locked == False AND fullTopicRegenLocked == False.
    """
    try:
        # ✅ SPEED OPTIMIZATION: Get cached context (or load from MongoDB if not cached)
        from .services.assessment_cache import get_assessment_context
        cached_context = await get_assessment_context(db, payload.assessmentId)
        
        # Still need full assessment for topics_v2
        # Get assessment
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        # Get topics_v2
        topics_v2 = assessment.get("topics_v2", [])
        topic_index = None
        for idx, topic in enumerate(topics_v2):
            if topic.get("id") == payload.topicId:
                topic_index = idx
                break
        
        if topic_index is None:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        # Check if topic is locked
        if topics_v2[topic_index].get("locked", False):
            raise HTTPException(status_code=400, detail="Topic is locked and cannot be regenerated")
        
        # Check if full topic regeneration is locked
        if assessment.get("fullTopicRegenLocked", False):
            raise HTTPException(status_code=400, detail="Topic regeneration is locked after preview")
        
        # [STAR] CRITICAL FIX: Extract old topic label to avoid regenerating same content
        old_topic = topics_v2[topic_index]
        old_topic_label = old_topic.get("label", "")
        
        logger.info(f"[TOPIC-REGEN] Regenerating topic at index {topic_index}. Old topic: '{old_topic_label}'")
        
        # Sanitize inputs
        sanitized_job_designation = sanitize_text_field(payload.jobDesignation)
        sanitized_skills = [sanitize_text_field(skill) for skill in payload.selectedSkills]
        sanitized_title = sanitize_text_field(payload.assessmentTitle) if payload.assessmentTitle else None
        
        # Generate new topic with exclusion of old topic
        # Use generate_topics_unified for better control
        combined_skills = [{"skill_name": skill, "source": "manual"} for skill in sanitized_skills]
        new_topics = await generate_topics_unified(
            assessment_title=sanitized_title,
            job_designation=sanitized_job_designation,
            combined_skills=combined_skills,
            experience_min=payload.experienceMin,
            experience_max=payload.experienceMax,
            experience_mode=payload.experienceMode,
            previous_topic_label=old_topic_label  # [STAR] CRITICAL: Pass old topic to avoid repeating
        )
        
        if not new_topics:
            raise HTTPException(status_code=500, detail="Failed to generate new topic")
        
        # Replace topic at same position, reset state
        new_topic = new_topics[0]
        new_topic["id"] = payload.topicId  # Keep same ID
        new_topic["locked"] = False
        # ⭐ CRITICAL: Preserve category from old topic (don't lose it on regeneration)
        old_topic = topics_v2[topic_index]
        if old_topic.get("category"):
            new_topic["category"] = old_topic["category"]
        else:
            new_topic["category"] = "technical"  # Default if not set
        # Reset all questionRows - keep only the first auto-generated one
        if new_topic.get("questionRows"):
            first_row = new_topic["questionRows"][0]
            first_row["status"] = "pending"
            first_row["locked"] = False
            first_row["questions"] = []
            new_topic["questionRows"] = [first_row]  # Remove manually added rows
        
        topics_v2[topic_index] = new_topic
        
        # Update assessment
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response(
            "Topic regenerated successfully",
            {"topic": new_topic}
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error regenerating topic: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to regenerate topic: {str(exc)}") from exc

async def _update_question_type_impl(
    payload: dict,
    current_user: Dict[str, Any],
    db: AsyncIOMotorDatabase,
):
    """
    Internal implementation for updating question type.
    Shared by both POST and PUT endpoints.
    """
    assessment_id = payload.get("assessmentId")
    topic_id = payload.get("topicId")
    row_id = payload.get("rowId")
    new_question_type = payload.get("questionType")
    new_difficulty = payload.get("difficulty", "Medium")
    can_use_judge0 = payload.get("canUseJudge0", False)
    
    if not all([assessment_id, topic_id, row_id, new_question_type]):
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    # Get assessment
    assessment = await db.assessments.find_one({
        "_id": to_object_id(assessment_id)
    })
    
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Verify user has access to this assessment
    _check_assessment_access(assessment, current_user)
    
    # Update the specific row
    topics_v2 = assessment.get("topics_v2", [])
    row_updated = False
    
    for topic in topics_v2:
        if topic.get("id") == topic_id:
            for row in topic.get("questionRows", []):
                if row.get("rowId") == row_id:
                    row["questionType"] = new_question_type
                    row["difficulty"] = new_difficulty
                    row["canUseJudge0"] = can_use_judge0
                    row["status"] = "pending"
                    row["questions"] = []
                    row["locked"] = False
                    row["userEdited"] = True  # ⭐ Mark that user explicitly set this type
                    row_updated = True
                    logger.info(f"✅ Updated {topic.get('label')} to {new_question_type} (userEdited=True)")
                    break
            if row_updated:
                topic["status"] = "pending"
                topic["locked"] = False  # Unlock topic to allow regeneration
                break
    
    if not row_updated:
        raise HTTPException(status_code=404, detail="Row not found")
    
    # Save to database
    await db.assessments.update_one(
        {"_id": to_object_id(assessment_id)},
        {"$set": {"topics_v2": topics_v2}}
    )
    
    return success_response(
        f"Updated to {new_question_type}",
        {"topicId": topic_id, "rowId": row_id, "questionType": new_question_type}
    )


@router.post("/update-question-type")
async def update_question_type_post(
    payload: dict = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Update question type for a specific topic row (POST).
    """
    try:
        return await _update_question_type_impl(payload, current_user, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating question type: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-question-type")
async def update_question_type_put(
    payload: dict = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Update question type for a specific topic row (PUT).
    """
    try:
        return await _update_question_type_impl(payload, current_user, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating question type: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-question")
async def generate_question_endpoint_v2(
    payload: GenerateQuestionRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Generate questions for a single question row (preview).
    After generation: row.status = "generated", row.locked = True, topic.locked = True
    Sets fullTopicRegenLocked = True on assessment.
    """
    try:
        # ✅ SPEED OPTIMIZATION: Get cached context (or load from MongoDB if not cached)
        from .services.assessment_cache import get_assessment_context
        cached_context = await get_assessment_context(db, payload.assessmentId)
        
        # Still need full assessment for topics_v2
        # Get assessment
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        # Get topics_v2
        topics_v2 = assessment.get("topics_v2", [])
        topic_index = None
        for idx, topic in enumerate(topics_v2):
            if topic.get("id") == payload.topicId:
                topic_index = idx
                break
        
        if topic_index is None:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        topic = topics_v2[topic_index]
        
        # Find the question row
        question_rows = topic.get("questionRows", [])
        row_index = None
        for idx, row in enumerate(question_rows):
            if row.get("rowId") == payload.rowId:
                row_index = idx
                break
        
        if row_index is None:
            raise HTTPException(status_code=404, detail="Question row not found")
        
        row = question_rows[row_index]
        
        # Check if already generated
        if row.get("status") == "generated" and row.get("questions") and len(row.get("questions", [])) > 0:
            return success_response(
                "Questions already generated",
                {"questions": row.get("questions", []), "row": row, "topic": topic}
            )
        
        # Check if locked (but allow if questions don't exist yet)
        if row.get("locked", False) and row.get("questions") and len(row.get("questions", [])) > 0:
            raise HTTPException(status_code=400, detail="Row is locked and already has questions")
        if topic.get("locked", False) and row.get("questions") and len(row.get("questions", [])) > 0:
            raise HTTPException(status_code=400, detail="Topic is locked and row already has questions")
        
        # ⭐ CRITICAL FIX: Use question type from database row (source of truth), not payload
        # The payload might have stale data if frontend state wasn't updated
        question_type = row.get("questionType") or payload.questionType
        difficulty = row.get("difficulty") or payload.difficulty
        questions_count = row.get("questionsCount") or payload.questionsCount
        can_use_judge0 = row.get("canUseJudge0", False) if (row.get("questionType") or payload.questionType) == "Coding" else False
        
        # Validate required fields
        if not question_type:
            raise HTTPException(status_code=400, detail="questionType is required")
        if not difficulty:
            raise HTTPException(status_code=400, detail="difficulty is required")
        if not questions_count or questions_count < 1:
            raise HTTPException(status_code=400, detail="questionsCount must be at least 1")
        
        logger.info(f"Generating {questions_count} {question_type} question(s) for topic: {payload.topicLabel}, difficulty: {difficulty}, canUseJudge0: {can_use_judge0} (using row.questionType from DB)")
        
        # ✅ SPEED OPTIMIZATION: Use cached context instead of extracting from assessment
        if cached_context:
            coding_language = cached_context.get("coding_language", "python")
            experience_mode = payload.experienceMode or cached_context.get("experience_mode", "corporate")
            company_context = cached_context.get("company_context")
            website_summary = cached_context.get("website_summary")
            assessment_requirements = cached_context.get("assessment_requirements")
            job_designation = cached_context.get("job_designation")
            experience_min = cached_context.get("experience_min")
            experience_max = cached_context.get("experience_max")
            company_name = cached_context.get("company_name")
            additional_requirements = payload.additionalRequirements or cached_context.get("additional_requirements")
        else:
            # Fallback to assessment if cache fails
            coding_language = assessment.get("codingLanguage", "python")
            experience_mode = payload.experienceMode or assessment.get("experienceMode", "corporate")
            company_context = assessment.get("contextSummary")
            website_summary = None
            if not company_context and assessment.get("websiteSummary") and assessment["websiteSummary"].get("useForQuestions"):
                website_summary = assessment["websiteSummary"]
            additional_requirements = payload.additionalRequirements or assessment.get("additionalRequirements")
            assessment_requirements = assessment.get("requirements")
            job_designation = assessment.get("jobDesignation")
            experience_min = assessment.get("experienceMin")
            experience_max = assessment.get("experienceMax")
            company_name = company_context.get("company_name") if company_context else None
        
        # ⭐ CRITICAL FIX: Use question type from database row (source of truth), not payload
        # The payload might have stale data if frontend state wasn't updated
        question_type = row.get("questionType") or payload.questionType
        difficulty = row.get("difficulty") or payload.difficulty
        questions_count = row.get("questionsCount") or payload.questionsCount
        can_use_judge0 = row.get("canUseJudge0", False) if question_type == "Coding" else False
        
        questions = await generate_questions_for_row_v2(
            topic_label=payload.topicLabel,
            question_type=question_type,  # ⭐ Use row's question type from DB
            difficulty=difficulty,  # ⭐ Use row's difficulty from DB
            questions_count=questions_count,  # ⭐ Use row's questions count from DB
            can_use_judge0=can_use_judge0,  # ⭐ Use row's canUseJudge0 from DB
            coding_language=coding_language,
            additional_requirements=additional_requirements,
            experience_mode=experience_mode,
            website_summary=website_summary,  # Legacy
            company_context=company_context,  # New unified field
            job_designation=job_designation,  # ⭐ NEW
            experience_min=experience_min,  # ⭐ NEW
            experience_max=experience_max,  # ⭐ NEW
            company_name=company_name,  # ⭐ NEW
            assessment_requirements=assessment_requirements,
            previous_question=None  # Not regenerating  # ⭐ NEW - Highest priority context
        )
        
        if not questions or len(questions) == 0:
            logger.error(f"No questions generated for topic: {payload.topicLabel}, type: {payload.questionType}")
            raise HTTPException(status_code=500, detail="Failed to generate questions - no questions returned")
        
        # Update row
        row["questions"] = questions
        row["status"] = "generated"
        row["locked"] = True
        
        # Lock topic and full topic regeneration
        topic["locked"] = True
        assessment["fullTopicRegenLocked"] = True
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {
                "topics_v2": topics_v2,
                "fullTopicRegenLocked": True,
                "updatedAt": assessment["updatedAt"]
            }}
        )
        
        return success_response(
            "Questions generated successfully",
            {"questions": questions, "row": row, "topic": topic}
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating questions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(exc)}") from exc


@router.post("/generate-all-questions")
async def generate_all_questions_endpoint_v2(
    payload: GenerateAllQuestionsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Generate questions for all pending topics.
    After completion: lock all topics, disable all buttons.
    Sets allQuestionsGenerated = True on assessment.
    """
    try:
        # ✅ SPEED OPTIMIZATION: Get cached context (or load from MongoDB if not cached)
        from .services.assessment_cache import get_assessment_context
        cached_context = await get_assessment_context(db, payload.assessmentId)
        
        # Still need full assessment for topics_v2
        # Get assessment
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        topics_v2 = payload.topics
        
        # Convert Pydantic models to dicts if needed
        topics_list = [topic if isinstance(topic, dict) else topic.model_dump() for topic in topics_v2]
        
        # Get coding language from assessment (fallback to python)
        coding_language = assessment.get("codingLanguage", "python")
        
        # Generate questions only for pending rows
        generated_count = 0
        for topic in topics_list:
            question_rows = topic.get("questionRows", [])
            for row in question_rows:
                if row.get("status") == "pending" and not row.get("questions") and not row.get("locked"):
                    try:
                        # Get company context (new) or websiteSummary (legacy)
                        company_context = assessment.get("contextSummary")
                        website_summary = None
                        if not company_context and assessment.get("websiteSummary") and assessment["websiteSummary"].get("useForQuestions"):
                            website_summary = assessment["websiteSummary"]
                        
                        # Priority: row-level > assessment-level > company context > website summary
                        additional_requirements = row.get("additionalRequirements")  # Topic/row-level (highest priority)
                        if not additional_requirements:
                            additional_requirements = assessment.get("additionalRequirements")  # Assessment-level (fallback)
                        
                        # ⭐ Extract context-aware personalization parameters
                        assessment_requirements = assessment.get("requirements")
                        job_designation = assessment.get("jobDesignation")
                        experience_min = assessment.get("experienceMin")
                        experience_max = assessment.get("experienceMax")
                        company_name = company_context.get("company_name") if company_context else None
                        
                        questions = await generate_questions_for_row_v2(
                            topic_label=topic["label"],
                            question_type=row["questionType"],
                            difficulty=row["difficulty"],
                            questions_count=row["questionsCount"],
                            can_use_judge0=row.get("canUseJudge0", False),
                            coding_language=coding_language,
                            additional_requirements=additional_requirements,
                            experience_mode=assessment.get("experienceMode", "corporate"),
                            website_summary=website_summary,
                            company_context=company_context,
                            job_designation=job_designation,  # ⭐ NEW
                            experience_min=experience_min,  # ⭐ NEW
                            experience_max=experience_max,  # ⭐ NEW
                            company_name=company_name,  # ⭐ NEW
                            assessment_requirements=assessment_requirements  # ⭐ NEW
                        )
                        
                        row["questions"] = questions
                        row["status"] = "generated"
                        row["locked"] = True
                        generated_count += 1
                    except Exception as exc:
                        logger.error(f"Error generating questions for row {row.get('rowId')}: {exc}")
                        # Continue with other rows
            
            # Lock topic if any row was generated
            if any(r.get("locked") for r in question_rows):
                topic["locked"] = True
        
        # Lock all topics and set flags
        for topic in topics_list:
            topic["locked"] = True
        
        # Update assessment
        assessment["topics_v2"] = topics_list
        assessment["allQuestionsGenerated"] = True
        assessment["fullTopicRegenLocked"] = True
        assessment["updatedAt"] = datetime.now(timezone.utc)
        
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {
                "topics_v2": topics_list,
                "allQuestionsGenerated": True,
                "fullTopicRegenLocked": True,
                "updatedAt": assessment["updatedAt"]
            }}
        )
        
        return success_response(
            f"Generated questions for {generated_count} question rows",
            {"topics": topics_list, "generatedCount": generated_count}
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating all questions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate all questions: {str(exc)}") from exc


@router.post("/add-question-row")
async def add_question_row_endpoint(
    payload: AddQuestionRowRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Add a new question row to a topic."""
    try:
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        topics_v2 = assessment.get("topics_v2", [])
        topic = next((t for t in topics_v2 if t.get("id") == payload.topicId), None)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        if topic.get("locked"):
            raise HTTPException(status_code=400, detail="Topic is locked")
        
        # Get first row's canUseJudge0 as default
        first_row = topic.get("questionRows", [{}])[0] if topic.get("questionRows") else {}
        can_use_judge0 = first_row.get("canUseJudge0", False)
        
        # Check if topic is in special category (aptitude, communication, logical_reasoning)
        topic_category = topic.get("category", "technical")
        special_categories = ["aptitude", "communication", "logical_reasoning"]
        is_special_category = topic_category in special_categories
        
        # Get allowed question types from topic (for soft skills)
        allowed_question_types = topic.get("allowedQuestionTypes", [])
        if allowed_question_types and len(allowed_question_types) > 0:
            # Use first allowed type as default for soft skills
            default_question_type = allowed_question_types[0]
        elif not is_special_category and first_row:
            # For technical topics, use first row's question type or MCQ
            default_question_type = first_row.get("questionType", "MCQ")
        else:
            # Default to MCQ for special categories
            default_question_type = "MCQ"
        
        # Create new row
        import uuid
        new_row = {
            "rowId": str(uuid.uuid4()),
            "questionType": default_question_type,
            "difficulty": "Easy",
            "questionsCount": 1,
            "canUseJudge0": False if is_special_category else can_use_judge0,  # Special categories never use Judge0
            "status": "pending",
            "locked": False,
            "questions": []
        }
        
        topic.setdefault("questionRows", []).append(new_row)
        
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response("Question row added successfully", {"row": new_row, "topic": topic})
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error adding question row: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add question row: {str(exc)}") from exc


@router.post("/remove-question-row")
async def remove_question_row_endpoint(
    payload: RemoveQuestionRowRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Remove a question row from a topic."""
    try:
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        topics_v2 = assessment.get("topics_v2", [])
        topic = next((t for t in topics_v2 if t.get("id") == payload.topicId), None)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        question_rows = topic.get("questionRows", [])
        if len(question_rows) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last question row")
        
        row = next((r for r in question_rows if r.get("rowId") == payload.rowId), None)
        if not row:
            raise HTTPException(status_code=404, detail="Question row not found")
        
        if row.get("locked"):
            raise HTTPException(status_code=400, detail="Question row is locked")
        
        # Remove row
        topic["questionRows"] = [r for r in question_rows if r.get("rowId") != payload.rowId]
        
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response("Question row removed successfully", {"topic": topic})
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error removing question row: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to remove question row: {str(exc)}") from exc


@router.post("/regenerate-single-question")
async def regenerate_single_question_endpoint(
    payload: RegenerateSingleQuestionRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Regenerate a single question within a row."""
    try:
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        topics_v2 = assessment.get("topics_v2", [])
        topic = next((t for t in topics_v2 if t.get("id") == payload.topicId), None)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        question_rows = topic.get("questionRows", [])
        row = next((r for r in question_rows if r.get("rowId") == payload.rowId), None)
        if not row:
            raise HTTPException(status_code=404, detail="Question row not found")
        
        questions = row.get("questions", [])
        if payload.questionIndex >= len(questions):
            raise HTTPException(status_code=400, detail="Question index out of range")
        
        # Regenerate single question
        
        # ⭐ CRITICAL FIX: Extract old question to avoid regenerating same content
        old_question = questions[payload.questionIndex]
        old_question_text = None
        
        # Extract question text based on question type
        if isinstance(old_question, dict):
            # For most question types, extract the "question" field
            old_question_text = old_question.get("question", "")
            
            # For MCQ, include options context too (so AI knows full question)
            if row.get("questionType") == "MCQ" and old_question.get("options"):
                old_question_text = f"{old_question_text}\nOptions: {', '.join(old_question.get('options', []))}"
        else:
            old_question_text = str(old_question)
        
        logger.info(f"[REGEN] Regenerating question at index {payload.questionIndex}. Old question preview: {old_question_text[:100] if old_question_text else 'N/A'}...")
        # Get company context (new) or websiteSummary (legacy)
        company_context = assessment.get("contextSummary")
        website_summary = None
        if not company_context and assessment.get("websiteSummary") and assessment["websiteSummary"].get("useForQuestions"):
            website_summary = assessment["websiteSummary"]
        
        # Priority: row-level > assessment-level > company context > website summary
        additional_requirements = row.get("additionalRequirements")  # Topic/row-level (highest priority)
        if not additional_requirements:
            additional_requirements = assessment.get("additionalRequirements")  # Assessment-level (fallback)
        
        # ⭐ Extract context-aware personalization parameters
        assessment_requirements = assessment.get("requirements")
        job_designation = assessment.get("jobDesignation")
        experience_min = assessment.get("experienceMin")
        experience_max = assessment.get("experienceMax")
        company_name = company_context.get("company_name") if company_context else None
        
        new_questions = await generate_questions_for_row_v2(
            topic_label=topic["label"],
            question_type=row["questionType"],
            difficulty=row["difficulty"],
            questions_count=1,
            can_use_judge0=row.get("canUseJudge0", False),
            additional_requirements=additional_requirements,
            experience_mode=assessment.get("experienceMode", "corporate"),
            website_summary=website_summary,
            company_context=company_context,
            job_designation=job_designation,  # ⭐ NEW
            experience_min=experience_min,  # ⭐ NEW
            experience_max=experience_max,  # ⭐ NEW
            company_name=company_name,  # ⭐ NEW
            assessment_requirements=assessment_requirements  # ⭐ NEW
        )
        
        if new_questions:
            questions[payload.questionIndex] = new_questions[0]
            row["questions"] = questions
        
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response("Question regenerated successfully", {"row": row})
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error regenerating question: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to regenerate question: {str(exc)}") from exc


@router.put("/update-single-question-v2")
async def update_single_question_endpoint_v2(
    payload: UpdateSingleQuestionRequestV2,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update a single question within a row (topicsV2 structure)."""
    try:
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        topics_v2 = assessment.get("topics_v2", [])
        topic = next((t for t in topics_v2 if t.get("id") == payload.topicId), None)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        question_rows = topic.get("questionRows", [])
        row = next((r for r in question_rows if r.get("rowId") == payload.rowId), None)
        if not row:
            raise HTTPException(status_code=404, detail="Question row not found")
        
        questions = row.get("questions", [])
        if payload.questionIndex >= len(questions):
            raise HTTPException(status_code=400, detail="Question index out of range")
        
        # Update the question
        questions[payload.questionIndex] = payload.question
        row["questions"] = questions
        
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response("Question updated successfully", {"row": row, "topic": topic})
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error updating single question: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update single question: {str(exc)}") from exc


@router.post("/suggest-topic-contexts")
async def suggest_topic_contexts_endpoint(
    partial_input: str = Query(..., min_length=2),
    category: str = Query(..., pattern=r"^(aptitude|communication|logical_reasoning)$"),
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Get semantic topic suggestions based on partial user input."""
    try:
        suggestions = await suggest_topic_contexts(partial_input, category)
        return success_response("Suggestions generated", {"suggestions": suggestions})
    except Exception as exc:
        logger.error(f"Error generating topic suggestions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(exc)}") from exc


@router.post("/generate-topic-context")
async def generate_topic_context_endpoint(
    topic_name: str = Query(..., min_length=1),
    category: str = Query(..., pattern=r"^(aptitude|communication|logical_reasoning)$"),
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Generate context summary and suggested question type for a topic."""
    try:
        context_data = await generate_topic_context_summary(topic_name, category)
        return success_response("Context generated", context_data)
    except Exception as exc:
        logger.error(f"Error generating topic context: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate context: {str(exc)}") from exc


@router.post("/detect-topic-category")
async def detect_topic_category_endpoint(
    topic_name: str = Query(..., min_length=1),
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Detect topic category (aptitude, communication, logical_reasoning, or technical) using semantic understanding."""
    try:
        category = await _detect_category_semantically(topic_name)
        return success_response("Category detected", {"category": category})
    except Exception as exc:
        logger.error(f"Error detecting topic category: {exc}", exc_info=True)
        # Fallback to technical
        return success_response("Category detected", {"category": "technical"})


@router.post("/topics/suggest")
async def suggest_topics_endpoint(
    payload: SuggestTopicsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Get AI-powered topic suggestions based on category and partial query."""
    try:
        suggestions = await suggest_topics(payload.category, payload.query)
        return success_response("Suggestions generated", {"suggestions": suggestions})
    except Exception as exc:
        logger.error(f"Error generating topic suggestions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(exc)}") from exc


@router.post("/topics/classify-technical-topic")
async def classify_technical_topic_endpoint(
    payload: ClassifyTechnicalTopicRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """Classify a technical topic to determine question type, Judge0 support, and context."""
    try:
        classification = await classify_technical_topic(payload.topic)
        return success_response("Topic classified", classification)
    except Exception as exc:
        logger.error(f"Error classifying technical topic: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to classify topic: {str(exc)}") from exc


@router.post("/topics/validate-category")
async def validate_topic_category_endpoint(
    topic: str = Query(..., min_length=1),
    category: str = Query(..., pattern=r"^(aptitude|communication|logical_reasoning)$"),
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """
    Validate if a custom topic belongs to the selected non-technical category.
    Uses gpt-4o-mini (same as other functionality) for consistency.
    """
    try:
        result = await validate_topic_category(topic, category)
        return success_response("Topic validated", result)
    except Exception as exc:
        logger.error(f"Error validating topic category: {exc}", exc_info=True)
        return success_response("Topic validated", {
            "valid": False,
            "error": "Unable to validate topic. Please try again."
        })


@router.post("/topics/check-technical")
async def check_technical_topic_endpoint(
    topic: str = Query(..., min_length=1),
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """
    Check if a topic is technical/programming-related using OpenAI's models.
    Uses gpt-4o-mini (same as other functionality) for consistency.
    """
    try:
        is_technical = await _is_technical_topic_ai(topic)
        return success_response("Topic checked", {
            "isTechnical": is_technical
        })
    except Exception as exc:
        logger.error(f"Error checking if topic is technical: {exc}", exc_info=True)
        return success_response("Topic checked", {
            "isTechnical": False  # Default to False on error to allow topic
        })


@router.post("/ai/topic-suggestion")
async def ai_topic_suggestion_endpoint(
    payload: AITopicSuggestionRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """
    AI-powered topic validation and suggestions.
    Validates if the input is relevant to the selected category and provides suggestions.
    """
    try:
        result = await ai_topic_suggestion(payload.category, payload.input)
        return success_response("Topic suggestion generated", result)
    except Exception as exc:
        logger.error(f"Error generating AI topic suggestion: {exc}", exc_info=True)
        return success_response("Topic suggestion generated", {
            "isValid": True,  # Default to valid on error
            "reason": "",
            "suggestions": []
        })


@router.post("/topics/add-custom")
async def add_custom_topic_endpoint(
    payload: AddCustomTopicRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Add a single custom topic to the assessment draft.
    """
    try:
        # Get assessment ID from query or find draft
        # For now, find the most recent draft for the user
        assessment = await db.assessments.find_one(
            {"status": "draft", "createdBy": current_user.get("id")},
            sort=[("createdAt", -1)]
        )
        if not assessment:
            raise HTTPException(status_code=404, detail="No draft assessment found")
        
        # Validate topic name
        topic_name = payload.topicName.strip()
        if not topic_name or len(topic_name) < 2:
            raise HTTPException(status_code=400, detail="Topic name must be at least 2 characters")
        
        # Check for duplicates
        topics_v2 = assessment.get("topics_v2", [])
        if any(t.get("label", "").lower() == topic_name.lower() for t in topics_v2):
            raise HTTPException(status_code=400, detail="Topic already exists")
        
        # ⭐ STEP 1: Auto-detect category based on topic content
        # Check if topic is a programming language, SQL, or AIML → automatically technical
        from .services.ai_topic_generator import CODING_LANGUAGES
        from .services.ai_utils import _v2_is_aiml_execution_topic, _v2_is_sql_execution_topic
        from .services.judge0_utils import contains_unsupported_framework
        import re
        
        topic_lower = topic_name.lower().strip()
        topic_clean = topic_name.strip()
        
        # Check if topic is a programming language, SQL, or AIML → must be technical
        is_programming_lang = False
        is_sql_topic = False
        is_aiml_topic = False
        
        # Check for programming languages with aliases
        LANGUAGE_ALIASES = {
            "cpp": ["c++", "cpp", "c plus plus"],
            "csharp": ["c#", "csharp", "c sharp"],
            "c": ["c"],
            "java": ["java"],
            "kotlin": ["kotlin"],
            "python": ["python"],
            "javascript": ["javascript", "js"],
            "typescript": ["typescript", "ts"],
            "go": ["go", "golang"],
            "rust": ["rust"]
        }
        
        for lang in CODING_LANGUAGES:
            lang_lower = lang.lower()
            aliases = LANGUAGE_ALIASES.get(lang_lower, [lang_lower])
            
            for alias in aliases:
                if lang_lower == "c":
                    # Special handling for "C" - match standalone "C" or "C " at start
                    if topic_clean.lower() == "c" or topic_clean.lower() == "c ":
                        is_framework, _ = contains_unsupported_framework(topic_lower)
                        if not is_framework:
                            is_programming_lang = True
                            break
                    elif re.search(r'\bc\b(?![\+\#\w])', topic_lower):
                        c_context = r'\bc\s+(programming|language|code)'
                        if re.search(c_context, topic_lower) or re.search(r'^c\s+', topic_lower):
                            is_framework, _ = contains_unsupported_framework(topic_lower)
                            if not is_framework:
                                is_programming_lang = True
                                break
                elif lang_lower == "cpp":
                    # Match "C++", "cpp", "C Plus Plus", etc.
                    if alias in topic_lower or "c++" in topic_lower or "c plus" in topic_lower:
                        is_framework, _ = contains_unsupported_framework(topic_lower)
                        if not is_framework:
                            is_programming_lang = True
                            break
                elif lang_lower == "csharp":
                    # Match "C#", "csharp", "C Sharp", etc.
                    if alias in topic_lower or "c#" in topic_lower or "c sharp" in topic_lower:
                        is_framework, _ = contains_unsupported_framework(topic_lower)
                        if not is_framework:
                            is_programming_lang = True
                            break
                else:
                    # For other languages, match whole word
                    pattern = r'\b' + re.escape(alias) + r'\b'
                    if re.search(pattern, topic_lower):
                        is_framework, _ = contains_unsupported_framework(topic_lower)
                        if not is_framework:
                            is_programming_lang = True
                            break
            
            if is_programming_lang:
                break
        
        # Check for SQL topics
        is_sql_topic = _v2_is_sql_execution_topic(topic_lower)
        
        # Check for AIML topics (but exclude if non-Python language is mentioned)
        if _v2_is_aiml_execution_topic(topic_lower):
            # Only AIML if no non-Python language is mentioned
            mentions_non_python = False
            for lang in CODING_LANGUAGES:
                if lang.lower() == "python":
                    continue
                pattern = r'\b' + re.escape(lang.lower()) + r'\b'
                if re.search(pattern, topic_lower):
                    mentions_non_python = True
                    break
            if not mentions_non_python:
                is_aiml_topic = True
        
        # ⭐ If topic is programming language, SQL, or AIML → MUST be technical category
        if is_programming_lang or is_sql_topic or is_aiml_topic:
            detected_category = "technical"
            logger.info(f"✅ Auto-detected category: technical (programming_lang={is_programming_lang}, sql={is_sql_topic}, aiml={is_aiml_topic})")
        elif not detected_category or detected_category == "technical":
            # Use AI to verify if it's actually technical
            try:
                is_technical = await _is_technical_topic_ai(topic_name)
                if is_technical:
                    detected_category = "technical"
                else:
                    # If user said "technical" but topic is not technical, keep as technical (trust user)
                    detected_category = payload.category or "technical"
            except Exception as detect_err:
                logger.warning(f"Failed to detect topic category: {detect_err}")
                detected_category = payload.category or "technical"
        
        # ⭐ STEP 2: Generate topic context and detect question type
        context_data = {}
        if detected_category == "technical":
            try:
                # This function now properly detects Coding/SQL/AIML in correct order
                context_data = await generate_topic_context_summary(topic_name, "technical")
                suggested_question_type = context_data.get("suggestedQuestionType", "MCQ")
                logger.info(f"✅ Detected question type: {suggested_question_type} for topic: {topic_name}")
            except Exception as ctx_err:
                logger.warning(f"Failed to generate context for technical topic: {ctx_err}")
                # Fallback: Use detected types from above
                if is_programming_lang:
                    suggested_question_type = "Coding"
                elif is_sql_topic:
                    suggested_question_type = "SQL"
                elif is_aiml_topic:
                    suggested_question_type = "AIML"
                else:
                    suggested_question_type = "MCQ"
        else:
            suggested_question_type = "MCQ"
        
        # Create new topic
        import uuid
        new_topic = {
            "id": f"custom-{uuid.uuid4().hex[:12]}",
            "label": topic_name,
            "category": detected_category,  # ⭐ Use detected/validated category
            "locked": False,
            "source": "custom",
            "status": "pending",
            "contextSummary": context_data.get("contextSummary", "") if detected_category == "technical" else "",
            "suggestedQuestionType": suggested_question_type,
            "questionRows": []
        }
        
        # Add topic to assessment
        topics_v2.append(new_topic)
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = _now_utc()
        
        await db.assessments.replace_one({"_id": assessment["_id"]}, assessment)
        
        return success_response("Topic added successfully", {
            "topic": new_topic
        })
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error adding custom topic: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add topic: {str(exc)}") from exc


@router.post("/improve-topic")
async def improve_topic_endpoint(
    payload: ImproveTopicRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Improve a single topic (not regenerate from scratch).
    Takes the previous topic label and returns an improved version of the SAME topic.
    Preserves questionRows and question state.
    """
    try:
        # ✅ SPEED OPTIMIZATION: Get cached context (or load from MongoDB if not cached)
        from .services.assessment_cache import get_assessment_context
        cached_context = await get_assessment_context(db, payload.assessmentId)
        
        # Still need full assessment for topics_v2
        # Get assessment
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        # Get topics_v2
        topics_v2 = assessment.get("topics_v2", [])
        topic_index = None
        for idx, topic in enumerate(topics_v2):
            if topic.get("id") == payload.topicId:
                topic_index = idx
                break
        
        if topic_index is None:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        current_topic = topics_v2[topic_index]
        
        # Check if topic is locked
        if current_topic.get("locked", False):
            raise HTTPException(status_code=400, detail="Topic is locked and cannot be improved")
        
        # Check if full topic regeneration is locked
        if assessment.get("fullTopicRegenLocked", False):
            raise HTTPException(status_code=400, detail="Topic improvement is locked after preview")
        
        # Get skill metadata if available
        skill_context = None
        skill_description = None
        importance_level = None
        
        if payload.skillMetadataProvided:
            skill_context = payload.skillMetadataProvided.get("skill_name")
            skill_description = payload.skillMetadataProvided.get("description")
            importance_level = payload.skillMetadataProvided.get("importance_level")
        
        # Get assessment context for topic improvement
        job_designation = assessment.get("jobDesignation") or assessment.get("jobRole")
        assessment_title = assessment.get("title")
        
        # Build combined_skills if available from assessment
        combined_skills = None
        # Try to get from assessment's combinedSkills or reconstruct from selectedSkills
        if assessment.get("combinedSkills"):
            combined_skills = assessment.get("combinedSkills")
        elif assessment.get("selectedSkills"):
            # Reconstruct combined_skills format
            selected_skills = assessment.get("selectedSkills", [])
            combined_skills = [{"skill_name": skill, "source": "manual", "description": None, "importance_level": None} for skill in selected_skills]
        
        # Improve the topic (now returns label, questionType, difficulty, canUseJudge0)
        improved_result = await improve_topic(
            previous_topic_label=payload.previousTopicLabel,
            skill_context=skill_context,
            skill_description=skill_description,
            importance_level=importance_level,
            experience_mode=payload.experienceMode,
            experience_min=payload.experienceMin,
            experience_max=payload.experienceMax,
            combined_skills=combined_skills,
            job_designation=job_designation,
            assessment_title=assessment_title
        )
        
        # Update topic with improved data
        # Preserve previous version in history
        previous_versions = current_topic.get("previousVersion", [])
        if payload.previousTopicLabel not in previous_versions:
            previous_versions.append(payload.previousTopicLabel)
        
        current_topic["label"] = improved_result["label"]
        current_topic["regenerated"] = True
        current_topic["previousVersion"] = previous_versions
        
        # Update questionRows with new question type
        question_rows = current_topic.get("questionRows", [])
        if question_rows and len(question_rows) > 0:
            # Update the first question row with new question type
            first_row = question_rows[0]
            first_row["questionType"] = improved_result["questionType"]
            first_row["difficulty"] = improved_result["difficulty"]
            first_row["canUseJudge0"] = improved_result["canUseJudge0"]
            # Reset status to pending so questions will regenerate
            first_row["status"] = "pending"
            first_row["questions"] = []
        else:
            # If no questionRows exist, create one with the new question type
            if "questionRows" not in current_topic:
                current_topic["questionRows"] = []
            new_row = {
                "rowId": str(uuid.uuid4()),
                "questionType": improved_result["questionType"],
                "difficulty": improved_result["difficulty"],
                "canUseJudge0": improved_result["canUseJudge0"],
                "status": "pending",
                "questions": []
            }
            current_topic["questionRows"].append(new_row)
        
        # Update assessment
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response(
            "Topic improved successfully",
            {
                "topic": current_topic,
                "updatedTopicLabel": improved_result["label"],
                "questionType": improved_result["questionType"],
                "difficulty": improved_result["difficulty"],
                "canUseJudge0": improved_result["canUseJudge0"]
            }
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error improving topic: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to improve topic: {str(exc)}") from exc


@router.post("/improve-all-topics")
async def improve_all_topics_endpoint(
    payload: ImproveAllTopicsRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Improve all topics (not regenerate from scratch).
    Takes previous topic labels and returns improved versions of the SAME topics.
    Preserves questionRows and question state for all topics.
    """
    try:
        # ✅ SPEED OPTIMIZATION: Get cached context (or load from MongoDB if not cached)
        from .services.assessment_cache import get_assessment_context
        cached_context = await get_assessment_context(db, payload.assessmentId)
        
        # Still need full assessment for topics_v2
        # Get assessment
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        # Check if full topic regeneration is locked
        if assessment.get("fullTopicRegenLocked", False):
            raise HTTPException(status_code=400, detail="Topic improvement is locked after preview")
        
        # Get topics_v2
        topics_v2 = assessment.get("topics_v2", [])
        
        # Create a map of topicId -> topic for quick lookup
        topic_map = {topic.get("id"): topic for topic in topics_v2}
        
        # Improve each topic
        improved_count = 0
        for previous_topic in payload.previousTopics:
            topic_id = previous_topic.get("topicId")
            if not topic_id:
                continue
            
            current_topic = topic_map.get(topic_id)
            if not current_topic:
                logger.warning(f"Topic {topic_id} not found in assessment, skipping")
                continue
            
            # Check if topic is locked
            if current_topic.get("locked", False):
                logger.info(f"Topic {topic_id} is locked, skipping improvement")
                continue
            
            previous_label = previous_topic.get("previousTopicLabel")
            if not previous_label:
                logger.warning(f"No previousTopicLabel for topic {topic_id}, skipping")
                continue
            
            # Get skill context
            related_skill = previous_topic.get("relatedSkill")
            
            skill_context = related_skill
            skill_description = None
            importance_level = None
            
            # Try to find skill metadata from combinedSkills
            if payload.combinedSkills and related_skill:
                for skill in payload.combinedSkills:
                    # CombinedSkill is a Pydantic model, use attribute access
                    if skill.skill_name == related_skill:
                        skill_description = skill.description
                        importance_level = skill.importance_level
                        break
            
            # Get assessment context for topic improvement
            job_designation = assessment.get("jobDesignation") or assessment.get("jobRole")
            assessment_title = assessment.get("title")
            
            # Improve the topic (now returns label, questionType, difficulty, canUseJudge0)
            improved_result = await improve_topic(
                previous_topic_label=previous_label,
                skill_context=skill_context,
                skill_description=skill_description,
                importance_level=importance_level,
                experience_mode=payload.experienceMode,
                experience_min=payload.experienceMin,
                experience_max=payload.experienceMax,
                combined_skills=payload.combinedSkills,
                job_designation=job_designation,
                assessment_title=assessment_title
            )
            
            # Update topic with improved data
            previous_versions = current_topic.get("previousVersion", [])
            if previous_label not in previous_versions:
                previous_versions.append(previous_label)
            
            current_topic["label"] = improved_result["label"]
            current_topic["regenerated"] = True
            current_topic["previousVersion"] = previous_versions
            
            # Update questionRows with new question type
            question_rows = current_topic.get("questionRows", [])
            if question_rows and len(question_rows) > 0:
                # Update the first question row with new question type
                first_row = question_rows[0]
                first_row["questionType"] = improved_result["questionType"]
                first_row["difficulty"] = improved_result["difficulty"]
                first_row["canUseJudge0"] = improved_result["canUseJudge0"]
                # Reset status to pending so questions will regenerate
                first_row["status"] = "pending"
                first_row["questions"] = []
            else:
                # If no questionRows exist, create one with the new question type
                if "questionRows" not in current_topic:
                    current_topic["questionRows"] = []
                new_row = {
                    "rowId": str(uuid.uuid4()),
                    "questionType": improved_result["questionType"],
                    "difficulty": improved_result["difficulty"],
                    "canUseJudge0": improved_result["canUseJudge0"],
                    "status": "pending",
                    "questions": []
                }
                current_topic["questionRows"].append(new_row)
            
            improved_count += 1
        
        # Update assessment
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {"topics_v2": topics_v2, "updatedAt": assessment["updatedAt"]}}
        )
        
        return success_response(
            f"Improved {improved_count} topic(s) successfully",
            {
                "topics": topics_v2,
                "improvedCount": improved_count
            }
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error improving all topics: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to improve topics: {str(exc)}") from exc


@router.post("/regenerate-question")
async def regenerate_question_endpoint(
    payload: RegenerateQuestionRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_editor),
):
    """
    Regenerate a single question based on the old question text and optional feedback.
    """
    try:
        assessment = await db.assessments.find_one({"_id": to_object_id(payload.assessmentId)})
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        _check_assessment_access(assessment, current_user)
        
        topics_v2 = assessment.get("topics_v2", [])
        topic = next((t for t in topics_v2 if t.get("id") == payload.topicId), None)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        row = next((r for r in topic.get("questionRows", []) if r.get("rowId") == payload.rowId), None)
        if not row:
            raise HTTPException(status_code=404, detail="Question row not found")
        
        questions = row.get("questions", [])
        if payload.questionIndex < 0 or payload.questionIndex >= len(questions):
            raise HTTPException(status_code=404, detail="Question not found")
        
        old_question_obj = questions[payload.questionIndex]
        
        # Get old question text (format based on question type)
        old_question_text = payload.oldQuestion
        
        # Regenerate the question
        regenerated_question = await regenerate_question(
            old_question=old_question_text,
            question_type=payload.questionType,
            difficulty=payload.difficulty,
            experience_mode=payload.experienceMode,
            experience_min=payload.experienceMin,
            experience_max=payload.experienceMax,
            additional_requirements=payload.additionalRequirements,
            feedback=payload.feedback,
            topic_name=topic.get("label"),
        )
        
        # Preserve timer and score from old question
        new_question_obj = {
            **regenerated_question,
            "timer": old_question_obj.get("timer"),
            "score": old_question_obj.get("score"),
            "status": "regenerated",
            "oldVersions": old_question_obj.get("oldVersions", []) + [{
                "question": old_question_obj,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }],
        }
        
        # Update the question in the array
        questions[payload.questionIndex] = new_question_obj
        row["questions"] = questions
        
        # Update assessment
        assessment["topics_v2"] = topics_v2
        assessment["updatedAt"] = datetime.now(timezone.utc)
        
        await db.assessments.update_one(
            {"_id": to_object_id(payload.assessmentId)},
            {"$set": {
                "topics_v2": topics_v2,
                "updatedAt": assessment["updatedAt"]
            }}
        )
        
        return success_response(
            data={"question": new_question_obj},
            message="Question regenerated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error regenerating question: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to regenerate question: {str(exc)}") from exc


@router.post("/{assessment_id}/pause")
async def pause_assessment(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Pause an active assessment.
    Sets status to "paused" and records pausedAt timestamp.
    Does not affect candidates who have already started.
    """
    try:
        assessment = await _get_assessment(db, assessment_id)
        _check_assessment_access(assessment, current_user)
        
        current_status = assessment.get("status")
        if current_status == "paused":
            # Idempotent: already paused
            return success_response(
                "Assessment is already paused",
                {"assessment": serialize_document(assessment)}
            )
        
        if current_status not in ["active", "scheduled"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot pause assessment with status '{current_status}'. Only 'active' or 'scheduled' assessments can be paused."
            )
        
        now = _now_utc()
        
        # Store previous status for resume
        status_before_pause = current_status
        
        # Atomic update
        result = await db.assessments.update_one(
            {"_id": to_object_id(assessment_id)},
            {
                "$set": {
                    "status": "paused",
                    "statusBeforePause": status_before_pause,
                    "pausedAt": now,
                    "updatedAt": now,
                },
                "$push": {
                    "auditLogs": {
                        "action": "paused",
                        "userId": str(current_user.get("id", "")),
                        "timestamp": now,
                        "meta": {"previousStatus": current_status}
                    }
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Assessment not found or not modified")
        
        # Fetch updated assessment
        updated_assessment = await db.assessments.find_one({"_id": to_object_id(assessment_id)})
        
        return success_response(
            "Assessment paused successfully",
            {"assessment": serialize_document(updated_assessment)}
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error pausing assessment: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to pause assessment: {str(exc)}") from exc


@router.post("/{assessment_id}/resume")
async def resume_assessment(
    assessment_id: str,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Resume a paused assessment.
    Sets status back to previous status (usually "active") and records resumeAt timestamp.
    """
    try:
        assessment = await _get_assessment(db, assessment_id)
        _check_assessment_access(assessment, current_user)
        
        current_status = assessment.get("status")
        if current_status != "paused":
            if current_status == "active":
                # Idempotent: already active
                return success_response(
                    "Assessment is already active",
                    {"assessment": serialize_document(assessment)}
                )
            raise HTTPException(
                status_code=400,
                detail=f"Cannot resume assessment with status '{current_status}'. Only 'paused' assessments can be resumed."
            )
        
        now = _now_utc()
        previous_status = assessment.get("statusBeforePause", "active")  # Default to active if not set
        
        # Atomic update
        result = await db.assessments.update_one(
            {"_id": to_object_id(assessment_id)},
            {
                "$set": {
                    "status": previous_status,
                    "resumeAt": now,
                    "updatedAt": now,
                },
                "$unset": {
                    "pausedAt": "",
                    "statusBeforePause": "",
                },
                "$push": {
                    "auditLogs": {
                        "action": "resumed",
                        "userId": str(current_user.get("id", "")),
                        "timestamp": now,
                        "meta": {"resumedToStatus": previous_status}
                    }
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Assessment not found or not modified")
        
        # Fetch updated assessment
        updated_assessment = await db.assessments.find_one({"_id": to_object_id(assessment_id)})
        
        return success_response(
            "Assessment resumed successfully",
            {"assessment": serialize_document(updated_assessment)}
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error resuming assessment: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to resume assessment: {str(exc)}") from exc


@router.post("/{assessment_id}/clone")
async def clone_assessment(
    assessment_id: str,
    request: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Clone an assessment with deep copy of topics, questions, and configuration.
    Does NOT copy schedule, candidates, or invitation settings by default.
    
    Request body:
    - newTitle: str (required, min 3 chars)
    - keepSchedule: bool (default False)
    - keepCandidates: bool (default False)
    """
    try:
        import uuid
        
        new_title = request.get("newTitle", "").strip()
        keep_schedule = request.get("keepSchedule", False)
        keep_candidates = request.get("keepCandidates", False)
        
        # Validate newTitle
        if not new_title or len(new_title) < 3:
            raise HTTPException(
                status_code=400,
                detail="New assessment name is required and must be at least 3 characters"
            )
        
        original_assessment = await _get_assessment(db, assessment_id)
        _check_assessment_access(original_assessment, current_user)
        
        now = _now_utc()
        
        # Deep copy the assessment document
        cloned_assessment = copy.deepcopy(original_assessment)
        
        # Remove MongoDB-specific fields
        cloned_assessment.pop("_id", None)
        cloned_assessment.pop("createdAt", None)
        cloned_assessment.pop("updatedAt", None)
        
        # Set new fields
        cloned_assessment["title"] = new_title
        cloned_assessment["status"] = "draft"
        cloned_assessment["clonedFrom"] = str(original_assessment.get("_id"))
        cloned_assessment["createdAt"] = now
        cloned_assessment["updatedAt"] = now
        # Set createdBy as ObjectId to match other assessments (required for filtering)
        cloned_assessment["createdBy"] = to_object_id(current_user.get("id"))
        # Preserve organization from original or set from current user
        if current_user.get("organization"):
            cloned_assessment["organization"] = to_object_id(current_user.get("organization"))
        elif original_assessment.get("organization"):
            cloned_assessment["organization"] = original_assessment.get("organization")
        
        # Remove schedule-related fields unless keep_schedule is True
        if not keep_schedule:
            cloned_assessment.pop("schedule", None)
            cloned_assessment.pop("scheduleStatus", None)
            cloned_assessment.pop("startTime", None)
            cloned_assessment.pop("endTime", None)
            cloned_assessment.pop("duration", None)
        
        # Remove candidate-related fields unless keep_candidates is True
        if not keep_candidates:
            cloned_assessment.pop("candidates", None)
            cloned_assessment.pop("invitationTemplate", None)
            cloned_assessment.pop("sentAt", None)
            cloned_assessment.pop("accessTokens", None)
            cloned_assessment.pop("invitations", None)
        
        # Deep copy topics_v2 (includes all question rows and questions)
        if "topics_v2" in cloned_assessment:
            cloned_assessment["topics_v2"] = copy.deepcopy(cloned_assessment["topics_v2"])
            # Regenerate IDs and reset statuses for topics
            for topic in cloned_assessment["topics_v2"]:
                # Regenerate topic ID
                topic["id"] = str(uuid.uuid4())
                topic["locked"] = False
                topic.pop("regenerated", None)
                
                # Regenerate question row IDs and reset statuses
                for row in topic.get("questionRows", []):
                    row["rowId"] = str(uuid.uuid4())
                    row["locked"] = False
                    
                    # Regenerate question IDs if they exist
                    has_questions = False
                    if "questions" in row and row.get("questions"):
                        has_questions = len(row.get("questions", [])) > 0
                        for question in row.get("questions", []):
                            if "_id" in question:
                                question["_id"] = str(uuid.uuid4())
                            if "id" in question:
                                question["id"] = str(uuid.uuid4())
                            # Reset question status to generated if applicable
                            if "status" in question:
                                question["status"] = "generated"
                    
                    # Set row status based on whether it has questions
                    # If questions exist, status should be "generated", otherwise "pending"
                    row["status"] = "generated" if has_questions else "pending"
        
        # Regenerate IDs for questions array if it exists at assessment level
        if "questions" in cloned_assessment:
            for question in cloned_assessment["questions"]:
                if "_id" in question:
                    question["_id"] = str(uuid.uuid4())
                if "id" in question:
                    question["id"] = str(uuid.uuid4())
                if "status" in question:
                    question["status"] = "generated"
        
        # Deep copy other assessment-specific data
        # Keep: topics, topics_v2, questionRows, questions, marks, timers, section configuration
        # Keep: additionalRequirements, codingLanguage, experienceMode
        
        # Reset assessment-level locks
        cloned_assessment.pop("fullTopicRegenLocked", None)
        cloned_assessment.pop("locked", None)
        
        # Preserve allQuestionsGenerated flag if all questions are actually generated
        # Check if all question rows have questions
        all_questions_generated = True
        if "topics_v2" in cloned_assessment:
            for topic in cloned_assessment["topics_v2"]:
                for row in topic.get("questionRows", []):
                    if not row.get("questions") or len(row.get("questions", [])) == 0:
                        all_questions_generated = False
                        break
                if not all_questions_generated:
                    break
        
        cloned_assessment["allQuestionsGenerated"] = all_questions_generated
        
        # Initialize audit logs
        cloned_assessment["auditLogs"] = [{
            "action": "cloned",
            "userId": str(current_user.get("id", "")),
            "timestamp": now,
            "meta": {
                "clonedFrom": str(original_assessment.get("_id")),
                "originalTitle": original_assessment.get("title", "")
            }
        }]
        
        # Insert the cloned assessment
        result = await db.assessments.insert_one(cloned_assessment)
        new_assessment_id = result.inserted_id
        
        # Also add audit log to original assessment
        await db.assessments.update_one(
            {"_id": to_object_id(assessment_id)},
            {
                "$push": {
                    "auditLogs": {
                        "action": "cloned_by",
                        "userId": str(current_user.get("id", "")),
                        "timestamp": now,
                        "meta": {
                            "clonedTo": str(new_assessment_id),
                            "newTitle": cloned_assessment.get("title", "")
                        }
                    }
                }
            }
        )
        
        # Fetch the newly created assessment
        new_assessment = await db.assessments.find_one({"_id": new_assessment_id})
        
        # Convert datetime objects to ISO format strings
        created_at = new_assessment.get("createdAt", now)
        updated_at = new_assessment.get("updatedAt", now)
        
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        elif created_at is None:
            created_at = now.isoformat()
        
        if isinstance(updated_at, datetime):
            updated_at = updated_at.isoformat()
        elif updated_at is None:
            updated_at = now.isoformat()
        
        # Return minimal assessment object for frontend
        assessment_response = {
            "id": str(new_assessment_id),
            "_id": str(new_assessment_id),
            "title": new_assessment.get("title", new_title),
            "status": new_assessment.get("status", "draft"),
            "createdAt": created_at,
            "updatedAt": updated_at,
            "clonedFrom": str(new_assessment.get("clonedFrom")) if new_assessment.get("clonedFrom") else None,
        }
        
        return success_response(
            "Assessment cloned successfully",
            {
                "assessment": assessment_response,
                "assessmentId": str(new_assessment_id)
            }
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error cloning assessment: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to clone assessment: {str(exc)}") from exc


def _is_private_ip(ip: str) -> bool:
    """Check if an IP address is in a private range."""
    try:
        ip_obj = ipaddress.ip_address(ip)
        return ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local
    except ValueError:
        return False


def _validate_url_safety(url: str) -> tuple[bool, str]:
    """Validate URL for SSRF safety. Returns (is_safe, error_message)."""
    try:
        parsed = urlparse(url)
        
        # Only allow http and https
        if parsed.scheme not in ("http", "https"):
            return False, "Only http and https URLs are allowed"
        
        # Check for private IP ranges in hostname
        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid hostname"
        
        # Block localhost variations
        if hostname.lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            return False, "Localhost URLs are not allowed"
        
        # Try to resolve and check IP
        try:
            import socket
            ip = socket.gethostbyname(hostname)
            if _is_private_ip(ip):
                return False, "Private IP addresses are not allowed"
        except socket.gaierror:
            # DNS resolution failed, but we'll still try to fetch
            pass
        
        # Block common private hostname patterns
        private_patterns = [
            r"^10\.", r"^172\.(1[6-9]|2[0-9]|3[01])\.", r"^192\.168\.", r"^127\.", r"^169\.254\."
        ]
        for pattern in private_patterns:
            if re.match(pattern, hostname):
                return False, "Private network URLs are not allowed"
        
        return True, ""
    except Exception as e:
        return False, f"Invalid URL format: {str(e)}"


def _extract_text_from_html(html: str) -> str:
    """Extract main textual content from HTML."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        
        # Remove script and style elements
        for script in soup(["script", "style", "meta", "link"]):
            script.decompose()
        
        # Try to find main content areas
        main_content = soup.find("main") or soup.find("article") or soup.find("body")
        if main_content:
            text = main_content.get_text(separator=" ", strip=True)
        else:
            text = soup.get_text(separator=" ", strip=True)
        
        # Clean up whitespace
        text = re.sub(r"\s+", " ", text)
        return text[:50000]  # Limit to 50k chars
    except ImportError:
        # Fallback: simple regex extraction
        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text[:50000]


@router.post("/{assessment_id}/fetch-website-summary")
async def fetch_website_summary(
    assessment_id: str,
    request: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Fetch and summarize a website using OpenAI. Assessment ID is optional - if not provided or empty, summary is returned without saving."""
    url = request.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    # Validate URL safety
    is_safe, error_msg = _validate_url_safety(url)
    if not is_safe:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Assessment ID is optional - if provided, save to assessment; if not, just return summary
    # "temp" is a special value that means don't save to any assessment
    assessment = None
    save_to_assessment = False
    if assessment_id and assessment_id.strip() and assessment_id != "null" and assessment_id != "undefined" and assessment_id != "temp":
        try:
            assessment = await _get_assessment(db, assessment_id)
            _check_assessment_access(assessment, current_user)
            save_to_assessment = True
            
            # Check if website summary already exists for this URL
            existing_summary = assessment.get("websiteSummary")
            if existing_summary and existing_summary.get("url") == url:
                # Return existing summary instead of fetching again
                logger.info(f"Website summary already exists for URL {url} in assessment {assessment_id}, returning existing summary")
                return success_response(
                    "Website summary already exists. Using existing summary.",
                    existing_summary
                )
        except HTTPException:
            # If assessment not found, just continue without saving
            save_to_assessment = False
    
    # Prevent concurrent requests for the same URL
    if url not in _website_fetch_locks:
        _website_fetch_locks[url] = asyncio.Lock()
    
    url_lock = _website_fetch_locks[url]
    
    # Check if another request is already processing this URL
    if url_lock.locked():
        logger.warning(f"Another request is already processing URL {url}, returning error to prevent duplicate")
        raise HTTPException(
            status_code=429,
            detail="A request for this URL is already in progress. Please wait and try again."
        )
    
    # Acquire lock for this URL
    async with url_lock:
        try:
            # Get OpenAI client
            try:
                openai_client = _get_openai_client()
            except ValueError as exc:
                logger.error(f"OpenAI API key not configured: {exc}")
                raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured. Please set OPENAI_API_KEY in your .env file.")
            
            # Fetch website content
            try:
                async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, max_redirects=5) as client:
                    response = await client.get(url, headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    })
                    response.raise_for_status()
                    
                    # Limit response size
                    if len(response.content) > 1.5 * 1024 * 1024:  # 1.5MB
                        raise HTTPException(status_code=400, detail="Response too large (max 1.5MB)")
                    
                    raw_html = response.text
                    raw_text = _extract_text_from_html(raw_html)
                    
                    if not raw_text or len(raw_text.strip()) < 100:
                        raise HTTPException(status_code=400, detail="Unable to extract meaningful content from the website")
            
            except httpx.HTTPError as e:
                logger.error(f"Error fetching website {url}: {e}")
                raise HTTPException(status_code=400, detail=f"Unable to fetch website: {str(e)}")
            
            # Call OpenAI API
            try:
                # Limit content to fit within token limits (approximately 30k chars = ~7500 tokens)
                content_text = raw_text[:30000]
                
                openai_prompt = f"""Extract and summarize the following website content. Return ONLY a valid JSON object with these exact fields:
{{
  "company_name": "string or null - the official name of the company/organization",
  "company_type": "one of: edtech, fintech, healthcare, ecommerce, manufacturing, services, consulting, government, unknown, other",
  "short_summary": "A comprehensive 3-5 sentence summary that MUST include: (1) Company name and what they do (their core business/industry), (2) What services/products they provide (be specific - list actual services, products, or solutions), (3) Key value propositions or unique features. This summary will be used to generate contextual assessment questions, so make it detailed and informative with specific service names.",
  "key_topics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "confidence": 0-100
}}

CRITICAL REQUIREMENTS FOR short_summary:
1. MUST start with the company name (if available) and clearly state what they do (their core business/industry)
2. MUST explicitly list the services/products they provide (e.g., "They provide employee training solutions, onboarding programs, learning management systems, etc.")
3. MUST include key value propositions or unique features
4. Be specific about service names and offerings - avoid generic descriptions
5. Structure: "Company Name is a [industry] company that [what they do]. They provide [list specific services/products]. [Additional details about value propositions or unique features]."

Example format:
"[Company Name] is a [industry type] company specializing in [core business]. They provide [Service 1], [Service 2], [Service 3], and [Service 4]. Their solutions focus on [key value proposition]. [Additional unique features or approach]."

Website content:
{content_text}
"""
                
                response = await openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an expert at extracting and summarizing company information from website content. Your summaries will be used to generate contextual assessment questions, so they must be comprehensive and structured. ALWAYS include: (1) Company name and what they do (core business/industry), (2) Specific services/products they provide (list actual service names, not generic descriptions), (3) Key value propositions or unique features. Be specific about service offerings. Always return valid JSON objects. Never include markdown code blocks or explanations outside the JSON."
                        },
                        {"role": "user", "content": openai_prompt}
                    ],
                    temperature=0.3,
                )
                
                response_text = response.choices[0].message.content.strip()
                
                # Remove markdown code blocks if present
                if response_text.startswith("```"):
                    response_text = response_text.split("```")[1]
                    if response_text.startswith("json"):
                        response_text = response_text[4:]
                    response_text = response_text.strip()
                
                # Try to extract JSON from response
                json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
                if json_match:
                    summary_data = json.loads(json_match.group())
                else:
                    # Fallback: try to parse the whole response
                    summary_data = json.loads(response_text)
            
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing OpenAI response: {e}")
                # Retry with shorter content
                try:
                    shorter_content = raw_text[:10000]
                    shorter_prompt = f"""Extract company information from this website content. Return JSON:
{{
  "company_name": "string or null - the official name of the company/organization",
  "company_type": "edtech|fintech|healthcare|ecommerce|manufacturing|services|consulting|government|unknown|other",
  "short_summary": "A comprehensive 3-5 sentence summary that MUST include: (1) Company name and what they do (their core business/industry), (2) What services/products they provide (be specific - list actual services, products, or solutions), (3) Key value propositions or unique features. Make it detailed and informative with specific service names.",
  "key_topics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "confidence": 50
}}

CRITICAL REQUIREMENTS FOR short_summary:
1. MUST start with the company name (if available) and clearly state what they do (their core business/industry)
2. MUST explicitly list the services/products they provide (e.g., "They provide employee training solutions, onboarding programs, learning management systems, etc.")
3. MUST include key value propositions or unique features
4. Be specific about service names and offerings - avoid generic descriptions
5. Structure: "Company Name is a [industry] company that [what they do]. They provide [list specific services/products]. [Additional details about value propositions or unique features]."

Content: {shorter_content}
"""
                    response = await openai_client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {
                                "role": "system",
                                "content": "You are an expert at extracting company information from website content. Your summaries will be used to generate contextual assessment questions, so they must be comprehensive and structured. ALWAYS include: (1) Company name and what they do (core business/industry), (2) Specific services/products they provide (list actual service names, not generic descriptions), (3) Key value propositions or unique features. Be specific about service offerings. Always return valid JSON objects. Never include markdown code blocks."
                            },
                            {"role": "user", "content": shorter_prompt}
                        ],
                        temperature=0.3,
                    )
                    
                    response_text = response.choices[0].message.content.strip()
                    
                    # Remove markdown code blocks if present
                    if response_text.startswith("```"):
                        response_text = response_text.split("```")[1]
                        if response_text.startswith("json"):
                            response_text = response_text[4:]
                        response_text = response_text.strip()
                    
                    json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
                    if json_match:
                        summary_data = json.loads(json_match.group())
                    else:
                        raise HTTPException(status_code=500, detail="Unable to parse OpenAI response")
                except Exception as retry_e:
                    logger.error(f"Retry failed: {retry_e}")
                    raise HTTPException(status_code=500, detail="Unable to extract website summary")
            except Exception as e:
                logger.error(f"Error calling OpenAI API: {e}")
                raise HTTPException(status_code=500, detail=f"Error calling OpenAI API: {str(e)}")
            
            # Prepare website summary object
            website_summary = {
                "url": url,
                "fetchedAt": _now_utc().isoformat(),
                "rawHtml": raw_html[:100000],  # Store first 100k chars
                "rawText": raw_text[:50000],  # Store first 50k chars
                "openaiResponseRaw": {
                    "model": "gpt-4o-mini",
                    "usage": response.usage.model_dump() if hasattr(response, 'usage') and hasattr(response.usage, 'model_dump') else {},
                },
                "company_name": summary_data.get("company_name"),
                "company_type": summary_data.get("company_type", "unknown"),
                "short_summary": summary_data.get("short_summary", ""),
                "key_topics": summary_data.get("key_topics", [])[:5],  # Ensure max 5
                "confidence": summary_data.get("confidence", 50),
                "useForQuestions": True,
                "lastEditedBy": str(current_user["id"]),
                "lastEditedAt": _now_utc().isoformat(),
            }
            
            # Save to assessment only if assessment ID was provided and valid
            if save_to_assessment and assessment:
                update_result = await db.assessments.update_one(
                    {"_id": to_object_id(assessment_id)},
                    {
                        "$set": {
                            "websiteSummary": website_summary,
                            "updatedAt": _now_utc(),
                        },
                        "$push": {
                            "auditLogs": {
                                "action": "fetchWebsiteSummary",
                                "userId": str(current_user["id"]),
                                "timestamp": _now_utc().isoformat(),
                                "meta": {"url": url},
                            }
                        }
                    }
                )
                
                if update_result.modified_count == 0:
                    logger.warning(f"Failed to save website summary to assessment {assessment_id}, but returning summary anyway")
            
            return success_response(
                "Website summary extracted. Review and save or edit before generating questions.",
                website_summary
            )
        finally:
            # Lock is automatically released when exiting the async with block
            pass


@router.patch("/{assessment_id}/website-summary")
async def update_website_summary(
    assessment_id: str,
    request: Dict[str, Any] = Body(...),
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update website summary fields."""
    assessment = await _get_assessment(db, assessment_id)
    _check_assessment_access(assessment, current_user)
    
    if "websiteSummary" not in assessment:
        raise HTTPException(status_code=404, detail="Website summary not found. Please fetch it first.")
    
    # Build update object
    update_fields = {}
    if "company_name" in request:
        update_fields["websiteSummary.company_name"] = request["company_name"]
    if "company_type" in request:
        update_fields["websiteSummary.company_type"] = request["company_type"]
    if "short_summary" in request:
        update_fields["websiteSummary.short_summary"] = request["short_summary"]
    if "key_topics" in request:
        update_fields["websiteSummary.key_topics"] = request["key_topics"][:5]  # Max 5
    if "useForQuestions" in request:
        update_fields["websiteSummary.useForQuestions"] = request["useForQuestions"]
    
    update_fields["websiteSummary.lastEditedBy"] = str(current_user["id"])
    update_fields["websiteSummary.lastEditedAt"] = _now_utc().isoformat()
    update_fields["updatedAt"] = _now_utc()
    
    update_result = await db.assessments.update_one(
        {"_id": to_object_id(assessment_id)},
        {"$set": update_fields}
    )
    
    if update_result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update website summary")
    
    # Fetch updated assessment
    updated_assessment = await _get_assessment(db, assessment_id)
    return success_response("Website summary updated successfully", updated_assessment.get("websiteSummary"))
     #more code##
