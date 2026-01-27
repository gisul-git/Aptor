from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ....core.dependencies import require_editor
from ....db.mongo import get_db
from ...v1.assessments.schemas import GenerateQuestionsFromConfigRequest
from ...v1.assessments.services import (
    determine_topic_coding_support,
    generate_questions_for_topic_safe,
    suggest_time_and_score,
)
from ....utils.mongo import convert_object_ids, to_object_id
from ....utils.responses import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2/assessments", tags=["assessments-v2"])


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


@router.post("/generate-questions-from-config")
async def generate_questions_from_config(
    payload: GenerateQuestionsFromConfigRequest,
    current_user: Dict[str, Any] = Depends(require_editor),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Generate questions based on topic configuration."""
    assessment = await _get_assessment(db, payload.assessmentId)
    _check_assessment_access(assessment, current_user)
    
    # Update topics with configuration
    topics_dict = {t.get("topic"): t for t in assessment.get("topics", [])}
    
    # Track question types and configs per topic (to handle multiple question types per topic)
    topic_question_types: Dict[str, List[str]] = {}
    topic_question_configs: Dict[str, List[Dict[str, Any]]] = {}
    
    for topic_config in payload.topics:
        topic_obj = topics_dict.get(topic_config.topic)
        if topic_obj:
            # Initialize lists if not exists
            if topic_config.topic not in topic_question_types:
                topic_question_types[topic_config.topic] = []
                topic_question_configs[topic_config.topic] = []
            
            # Accumulate question types (avoid duplicates)
            if topic_config.questionType not in topic_question_types[topic_config.topic]:
                topic_question_types[topic_config.topic].append(topic_config.questionType)
            
            # Build question configs for this question type
            for i in range(topic_config.numQuestions):
                # Question generation engine doesn't have dedicated SQL/AIML generators in this endpoint.
                # Generate them as Subjective prompts but preserve the original type for UI/review.
                requested_type = topic_config.questionType
                engine_type = "Subjective" if requested_type in ["SQL", "AIML"] else requested_type
                q_config = {
                    "questionNumber": len(topic_question_configs[topic_config.topic]) + 1,
                    "type": engine_type,
                    "requestedType": requested_type,
                    "difficulty": topic_config.difficulty,
                }
                # Add coding-specific fields if question type is coding
                if engine_type == "coding":
                    # Always enable Judge0 for coding questions
                    q_config["judge0_enabled"] = True
                    # Set language if specified
                    if topic_config.language:
                        q_config["language"] = topic_config.language
                topic_question_configs[topic_config.topic].append(q_config)
    
    # Update topic objects with accumulated data
    for topic_name, topic_obj in topics_dict.items():
        if topic_name in topic_question_types:
            topic_obj["questionTypes"] = topic_question_types[topic_name]
            topic_obj["questionConfigs"] = topic_question_configs[topic_name]
            # Set numQuestions to total across all question types
            topic_obj["numQuestions"] = len(topic_question_configs[topic_name])
            # Keep difficulty as the first one (or could be a list, but keeping simple for now)
            if topic_question_configs[topic_name]:
                topic_obj["difficulty"] = topic_question_configs[topic_name][0].get("difficulty", "Medium")
    
    # Generate questions for each topic
    all_questions = []
    failed_topics = []
    
    for topic_config in payload.topics:
        topic_obj = topics_dict.get(topic_config.topic)
        if not topic_obj:
            continue
        
        requested_type = topic_config.questionType
        engine_type = "Subjective" if requested_type in ["SQL", "AIML"] else requested_type

        # Validate: Reject coding questions for topics that don't support coding
        if engine_type == "coding":
            # Dynamically determine coding support (don't rely on stored value which might be outdated)
            coding_supported = await determine_topic_coding_support(topic_config.topic)
            if not coding_supported:
                # Skip this question instead of failing the entire generation
                logger.warning(f"Topic '{topic_config.topic}' does not support coding questions. Skipping this question.")
                failed_topics.append(f"{topic_config.topic} (coding not supported)")
                continue
            # Update the topic object with the correct coding_supported value
            topic_obj["coding_supported"] = coding_supported
            
        config = {
            "numQuestions": topic_config.numQuestions,
        }
        for i in range(1, topic_config.numQuestions + 1):
            config[f"Q{i}type"] = engine_type
            config[f"Q{i}difficulty"] = topic_config.difficulty
        # Add coding-specific fields if question type is coding
        if engine_type == "coding":
            # Always enable Judge0 for coding questions
            config["judge0_enabled"] = True
            # Set language if specified
            if topic_config.language:
                config["language"] = topic_config.language
        
        # For aptitude topics, build topic string with sub-topic and question type
        topic_for_generation = topic_config.topic
        if getattr(topic_config, 'isAptitude', False):
            sub_topic = getattr(topic_config, 'subTopic', None)
            question_type = topic_config.questionType
            if sub_topic:
                # Format: "Main Topic - Sub Topic: Question Type"
                # Example: "QUANTITATIVE APTITUDE (Maths) - Number Systems: Divisibility rules"
                topic_for_generation = f"{topic_config.topic} - {sub_topic}: {question_type}"
        
        try:
            questions = await generate_questions_for_topic_safe(topic_for_generation, config)
            if questions:
                # Auto-generate time and score for each question
                for q in questions:
                    q["topic"] = topic_config.topic
                    # Preserve requested type for SQL/AIML so UI/review sees the right category
                    if requested_type in ["SQL", "AIML"]:
                        q["type"] = requested_type
                    # Ensure coding-specific fields are set for coding questions
                    if engine_type == "coding":
                        # Always enable Judge0 for coding questions
                        q["judge0_enabled"] = True
                        # Set language if specified
                        if topic_config.language:
                            q["language"] = topic_config.language
                        # Preserve coding_data (testcases, starter_code, etc.) for Judge0 execution
                        # This data is essential for Judge0 stdin/stdout test case execution
                        if "coding_data" in q:
                            # Ensure testcases are in Judge0 format (stdin/stdout)
                            coding_data = q["coding_data"]
                            if "public_testcases" in coding_data:
                                q["public_testcases"] = coding_data["public_testcases"]
                            if "hidden_testcases" in coding_data:
                                q["hidden_testcases"] = coding_data["hidden_testcases"]
                            if "starter_code" in coding_data:
                                q["starter_code"] = coding_data["starter_code"]
                            if "function_signature" in coding_data:
                                q["function_signature"] = coding_data["function_signature"]
                    try:
                        time_score = await suggest_time_and_score(q)
                        q["time"] = time_score.get("time", 10)
                        q["score"] = time_score.get("score", 5)
                    except Exception as exc:
                        logger.warning(f"Failed to generate time/score for question, using defaults: {exc}")
                        q["time"] = 10
                        q["score"] = 5
                topic_obj["questions"] = questions
                all_questions.extend(questions)
            else:
                failed_topics.append(topic_config.topic)
        except Exception as exc:
            logger.error(f"Error generating questions for topic {topic_config.topic}: {exc}")
            failed_topics.append(topic_config.topic)
    
    assessment["topics"] = list(topics_dict.values())
    assessment["skill"] = payload.skill
    await _save_assessment(db, assessment)
    
    return success_response(
        "Questions generated successfully",
        {
            "totalQuestions": len(all_questions),
            "failedTopics": failed_topics,
            "topics": convert_object_ids(assessment["topics"]),
        }
    )

