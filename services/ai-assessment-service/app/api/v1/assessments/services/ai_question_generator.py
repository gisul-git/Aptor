"""
Module: ai_question_generator.py
Purpose: Core question generation for MCQ, Subjective, and PseudoCode types

This module is the main entry point for question generation. It handles
MCQ, Subjective, and PseudoCode questions directly, and delegates
Coding, SQL, and AIML questions to specialized generators.

Dependencies:
- External: openai (for question generation)
- Internal: ai_utils (for OpenAI client, JSON parsing, URL processing)
- Internal: ai_coding_generator (_generate_coding_questions)
- Internal: ai_sql_generator (_generate_sql_questions)
- Internal: ai_aiml_generator (_generate_aiml_questions)

Example usage:
    ```python
    from app.api.v1.assessments.services.ai_question_generator import (
        generate_questions_for_row_v2
    )
    
    questions = await generate_questions_for_row_v2(
        topic_label="Python Functions",
        question_type="MCQ",
        difficulty="Medium",
        questions_count=5,
        can_use_judge0=False
    )
    ```

Note: This is the main entry point. All question generation flows through here.
"""
from __future__ import annotations

import importlib.util
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from .ai_utils import (
    _get_openai_client,
    _parse_json_response,
    _process_requirements_for_subjective,
)
from .ai_coding_generator import _generate_coding_questions
from .ai_sql_generator import _generate_sql_questions
from .ai_aiml_generator import _generate_aiml_questions
from .ai_quality import (
    validate_question_quality,
    _get_difficulty_rules,
)

logger = logging.getLogger(__name__)

# Temporary bridge to old implementation
_legacy_generate_questions = None
try:
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
        _legacy_generate_questions = legacy_services.generate_questions_for_topic
except Exception as e:
    logger.warning(f"Could not load legacy services for fallback: {e}")


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

async def generate_questions_for_row_v2(
    topic_label: str,
    question_type: str,
    difficulty: str,
    questions_count: int,
    can_use_judge0: bool,
    coding_language: str = "python",
    additional_requirements: Optional[str] = None,
    experience_mode: Optional[str] = None,
    website_summary: Optional[Dict[str, Any]] = None,
    company_context: Optional[Dict[str, Any]] = None,
    job_designation: Optional[str] = None,
    experience_min: Optional[int] = None,
    experience_max: Optional[int] = None,
    company_name: Optional[str] = None,
    assessment_requirements: Optional[str] = None,  # Global requirements from assessment creation
    previous_question: Optional[str] = None  # ⭐ NEW - For regeneration (avoid repeating)
) -> List[Dict[str, Any]]:
    """
    Generate questions for a single question row based on question type.
    Returns questions in appropriate format for each type.
    
    This is the main entry point for question generation. It routes to
    specialized generators based on question type.
    
    Args:
        topic_label: The topic label
        question_type: Type of question (MCQ, Subjective, PseudoCode, Coding, SQL, AIML)
        difficulty: Difficulty level (Easy, Medium, Hard)
        questions_count: Number of questions to generate
        can_use_judge0: Whether Judge0 can be used (for coding questions)
        coding_language: Programming language for coding questions
        additional_requirements: Optional additional requirements for question generation
        experience_mode: Experience mode (corporate/student/college)
        website_summary: Legacy website summary (deprecated, use company_context)
        company_context: Company context with name, type, summary, key_topics
        job_designation: Job role/designation (e.g., "Senior Software Engineer")
        experience_min: Minimum years of experience required
        experience_max: Maximum years of experience required
        company_name: Company name for personalization (e.g., "Gisul")
        
    Returns:
        List of question dictionaries in appropriate format for question type
        
    Raises:
        HTTPException: If question type is unsupported or generation fails
    """
    if not topic_label or not question_type or not difficulty or questions_count <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid parameters: topic_label, question_type, difficulty are required and questions_count must be > 0"
        )
    
    # Normalize question type
    question_type_upper = question_type.upper()
    experience_mode = experience_mode or "corporate"
    
    # Route to appropriate generator based on question type
    if question_type_upper in ["CODING", "CODE"]:
        if not can_use_judge0:
            raise HTTPException(
                status_code=400,
                detail="Coding questions require Judge0 support (can_use_judge0 must be True)"
            )
        return await _generate_coding_questions(
            topic=topic_label,
            difficulty=difficulty,
            count=questions_count,
            can_use_judge0=can_use_judge0,
            coding_language=coding_language,
            experience_mode=experience_mode,
            additional_requirements=additional_requirements,
            job_designation=job_designation,
            experience_min=experience_min,
            experience_max=experience_max,
            company_name=company_name,
            assessment_requirements=assessment_requirements,
            previous_question=previous_question
        )
    
    elif question_type_upper in ["SQL"]:
        return await _generate_sql_questions(
            topic=topic_label,
            difficulty=difficulty,
            count=questions_count,
            experience_mode=experience_mode,
            additional_requirements=additional_requirements,
            job_designation=job_designation,
            experience_min=experience_min,
            experience_max=experience_max,
            company_name=company_name,
            assessment_requirements=assessment_requirements
        )
    
    elif question_type_upper in ["AIML", "AI/ML", "MACHINE LEARNING", "ML"]:
        return await _generate_aiml_questions(
            topic=topic_label,
            difficulty=difficulty,
            count=questions_count,
            experience_mode=experience_mode,
            additional_requirements=additional_requirements,
            job_designation=job_designation,
            experience_min=experience_min,
            experience_max=experience_max,
            company_name=company_name,
            assessment_requirements=assessment_requirements
        )
    
    elif question_type_upper in ["MCQ", "MULTIPLE CHOICE"]:
        return await _generate_mcq_questions(
            topic=topic_label,
            difficulty=difficulty,
            count=questions_count,
            experience_mode=experience_mode,
            additional_requirements=additional_requirements,
            job_designation=job_designation,
            experience_min=experience_min,
            experience_max=experience_max,
            company_name=company_name,
            assessment_requirements=assessment_requirements,
            previous_question=previous_question  # ⭐ NEW - Pass through for regeneration
        )
    
    elif question_type_upper in ["SUBJECTIVE", "DESCRIPTIVE"]:
        return await _generate_subjective_questions(
            topic=topic_label,
            difficulty=difficulty,
            count=questions_count,
            experience_mode=experience_mode,
            additional_requirements=additional_requirements,
            job_designation=job_designation,
            experience_min=experience_min,
            experience_max=experience_max,
            company_name=company_name,
            assessment_requirements=assessment_requirements,
            previous_question=previous_question  # ⭐ NEW - Pass through for regeneration
        )
    
    elif question_type_upper in ["PSEUDOCODE", "PSEUDO CODE", "PSEUDO-CODE"]:
        return await _generate_pseudocode_questions(
            topic=topic_label,
            difficulty=difficulty,
            count=questions_count,
            experience_mode=experience_mode,
            additional_requirements=additional_requirements,
            job_designation=job_designation,
            experience_min=experience_min,
            experience_max=experience_max,
            company_name=company_name,
            assessment_requirements=assessment_requirements,
            previous_question=previous_question  # ⭐ NEW - Pass through for regeneration
        )
    
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported question type: {question_type}. Supported types: MCQ, Subjective, PseudoCode, Coding, SQL, AIML"
        )


# Keep old function name for backward compatibility during transition
async def generate_questions_for_topic_v2(
    topic_label: str,
    question_type: str,
    difficulty: str,
    questions_count: int,
    can_use_judge0: bool,
    coding_language: str = "python"
) -> List[Dict[str, Any]]:
    """
    Alias for generate_questions_for_row_v2 for backward compatibility.
    
    Args:
        topic_label: The topic label
        question_type: Type of question
        difficulty: Difficulty level
        questions_count: Number of questions to generate
        can_use_judge0: Whether Judge0 can be used
        coding_language: Programming language for coding questions
        
    Returns:
        List of question dictionaries
    """
    # TODO: Move implementation from topic_service_v2.py line 1343
    return await generate_questions_for_row_v2(
        topic_label, question_type, difficulty, questions_count, can_use_judge0, coding_language
    )


# ============================================================================
# MCQ QUESTION GENERATION
# ============================================================================

async def _generate_mcq_questions(
    topic: str,
    difficulty: str,
    count: int,
    experience_mode: str = "corporate",
    additional_requirements: Optional[str] = None,
    job_designation: Optional[str] = None,
    experience_min: Optional[int] = None,
    experience_max: Optional[int] = None,
    company_name: Optional[str] = None,
    assessment_requirements: Optional[str] = None,  # Global requirements
    previous_question: Optional[str] = None  # ⭐ NEW - For regeneration (avoid repeating)
) -> List[Dict[str, Any]]:
    """
    Generate MCQ questions - PRODUCTION-GRADE WITH CONTEXT-AWARE PERSONALIZATION.
    
    Rules:
    - MCQ must include exactly 4 options
    - One correct answer
    - Should NOT be overly simple syntax questions unless topic requires it
    - Should match the difficulty level
    - Generate both question + options + correctAnswer
    - PERSONALIZED based on assessment requirements, job role, experience level, and company
    
    Args:
        topic: Topic label
        difficulty: Difficulty level (Easy, Medium, Hard)
        count: Number of questions to generate
        experience_mode: Experience mode (corporate/college)
        additional_requirements: Optional topic-specific requirements
        job_designation: Job role/designation (e.g., "Senior Software Engineer")
        experience_min: Minimum years of experience required
        experience_max: Maximum years of experience required
        company_name: Company name for personalization (e.g., "Gisul")
        assessment_requirements: Global assessment requirements (HIGHEST PRIORITY)
        previous_question: For regeneration - the old question to avoid repeating
        
    Returns:
        List of MCQ question dictionaries with:
        - question: Question text
        - options: List of exactly 4 options
        - correctAnswer: The correct option (must match one of the options)
    """
    # ⭐ BUILD PERSONALIZATION CONTEXT (PRIORITY ORDER)
    context_parts = []
    
    # Priority 0: REGENERATION CONTEXT (ABSOLUTE HIGHEST PRIORITY - Avoid repeating)
    if previous_question:
        # Extract question text from previous question (MCQs may include options)
        prev_q_text = previous_question
        if isinstance(previous_question, dict):
            prev_q_text = previous_question.get("question", str(previous_question))
        
        context_parts.append(f"""**🔥 REGENERATION CONTEXT (CRITICAL - READ THIS FIRST)**:
The user is REGENERATING a question they found unsatisfactory.

OLD QUESTION (DO NOT REPEAT OR REUSE THIS):
\"\"\"{prev_q_text}\"\"\"

MANDATORY REQUIREMENTS FOR NEW QUESTION:
1. MUST be COMPLETELY DIFFERENT from the old question above
2. MUST be HIGHER QUALITY - more specific, more challenging, more professional
3. MUST be MORE PERSONALIZED - use company name, role, requirements if provided below
4. AVOID similar concepts, scenarios, or phrasing from the old question
5. Take a FRESH perspective on the topic "{topic}" while maintaining difficulty: {difficulty}

Example Improvements:
- Old (generic): "What is the time complexity of binary search?"
- New (context-aware): "At Gisul, you need to optimize search performance for a user database with 100M+ records. Which search algorithm would you implement for a sorted user ID lookup and why?"

⚠️ CRITICAL: If you generate something similar to the old question, the user will reject it!
""")
    
    # Priority 1: Assessment-level requirements (highest priority - from "Requirements" field)
    if assessment_requirements:
        context_parts.append(f"**Assessment Context (CRITICAL - USE THIS)**: {assessment_requirements}")
    
    # Priority 2: Topic-level additional requirements
    if additional_requirements:
        context_parts.append(f"**Topic-Specific Requirements**: {additional_requirements}")
    
    # Priority 3: Job role and company
    if job_designation:
        context_parts.append(f"**Job Role**: {job_designation}")
    
    if company_name:
        context_parts.append(f"**Company**: {company_name}")
    
    if experience_min is not None and experience_max is not None:
        years_text = f"{experience_min}-{experience_max} years"
        
        # Determine seniority level
        if experience_max <= 2:
            seniority = "Junior"
            focus_areas = "Focus on: execution, syntax, debugging, basic problem-solving"
        elif experience_max <= 5:
            seniority = "Mid"
            focus_areas = "Focus on: design patterns, best practices, code reviews, system design basics"
        elif experience_max <= 10:
            seniority = "Senior"
            focus_areas = "Focus on: architecture, scalability, team impact, technology choices"
        else:
            seniority = "Lead"
            focus_areas = "Focus on: strategic decisions, business impact, cross-team collaboration"
        
        context_parts.append(f"**Experience Required**: {years_text} ({seniority})")
        context_parts.append(f"**Focus Areas**: {focus_areas}")
    else:
        seniority = "Mid"  # Default
    
    personalization_context = "\n".join(context_parts) if context_parts else ""
    
    # Get difficulty calibration rules
    difficulty_rules = _get_difficulty_rules("MCQ", difficulty, seniority)
    
    # Build prompt with personalization
    prompt = f"""You are an expert technical assessment writer. Generate EXACTLY {count} Multiple Choice Question(s) for the topic: {topic}.

CRITICAL: You MUST generate EXACTLY {count} question(s). Do NOT generate fewer or more than {count} questions.

{'=' * 80}
CRITICAL: PERSONALIZATION CONTEXT (HIGHEST PRIORITY - MUST USE)
{'=' * 80}
{personalization_context if personalization_context else "(No specific personalization context provided - generate generic professional questions)"}
{'=' * 80}

MANDATORY PERSONALIZATION REQUIREMENTS:

1. **USE EXACT CONTEXT FROM ABOVE** - This is your #1 priority!
   - If assessment context is provided: Frame questions around that specific scenario/company/role
   - If company name is provided: Reference it in scenario-based questions
   - If job role is provided: Use exact job title when creating scenarios
   - If requirements mention technologies: Reference them in questions
   
2. **SCENARIO FRAMING EXAMPLES**:
   
   ✅ WITH ASSESSMENT CONTEXT (e.g., "Candidate will work at Gisul on AWS serverless"):
   "You are working at Gisul on an AWS serverless architecture. Your Lambda functions need 
   to process S3 events. Which approach would best handle temporary failures?"
   
   ✅ WITH ROLE CONTEXT (e.g., role: "Senior Backend Engineer"):
   "As a Senior Backend Engineer, you need to decide on a caching strategy for a high-traffic 
   API. Which approach would you recommend?"
   
   ❌ WITHOUT CONTEXT (generic - AVOID IF CONTEXT PROVIDED):
   "Which caching strategy is best for APIs?"

{'=' * 80}
DIFFICULTY CALIBRATION (CRITICAL - MUST FOLLOW EXACTLY)
{'=' * 80}

Current Difficulty: {difficulty}
Seniority Level: {seniority}

**{difficulty.upper()} Difficulty Rules for MCQ ({seniority}):**

{difficulty_rules}

VALIDATION:
- Read the rules above CAREFULLY
- Generate questions that EXACTLY match the difficulty level
- If unsure, err on the side of being MORE challenging
- Easy ≠ Medium ≠ Hard - they must be DISTINCTLY different

{'=' * 80}

STANDARD MCQ REQUIREMENTS:
3. Each question MUST have exactly 4 options (no more, no less)
4. One option must be the correct answer
5. Difficulty level: {difficulty} (MUST follow difficulty rules above)
6. Experience mode: {experience_mode}
7. All options must be plausible - avoid obviously wrong answers
8. Options should be similar in length and structure
9. Vary question types (conceptual, application, problem-solving)

Output format (JSON object with questions array):
{{
  "questions": [
    {{
      "question": "<question text - MUST use personalization context if provided>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correctAnswer": "<option text that matches one of the options exactly>"
    }}
  ]
}}

FINAL REMINDER: If personalization context is provided above, you MUST use it in your questions. 
Generic questions are ONLY acceptable when NO context is provided.

Return ONLY a JSON object with questions array."""

    client = _get_openai_client()
    try:
        # ✅ SPEED OPTIMIZATION: Use gpt-4o-mini for MCQ (faster, cheaper)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
    except Exception as exc:
        logger.error(f"OpenAI API error in _generate_mcq_questions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate MCQ questions") from exc

    # Parse response
    content = response.choices[0].message.content.strip() if response.choices else ""
    data = _parse_json_response(content)
    
    # Handle response format
    if isinstance(data, dict) and "questions" in data:
        questions_list = data["questions"]
    elif isinstance(data, list):
        questions_list = data
    elif isinstance(data, dict) and "question" in data:
        # Single question object
        questions_list = [data]
    else:
        logger.error(f"Unexpected response format for MCQ questions: {data}")
        raise HTTPException(status_code=500, detail="Invalid response format from AI")
    
    # Format and validate questions with quality check
    result = []
    validated_questions = []
    
    for q in questions_list[:count]:
        if isinstance(q, dict) and "question" in q and "options" in q and "correctAnswer" in q:
            # Validate that we have exactly 4 options
            if len(q["options"]) == 4:
                question_obj = {
                    "question": q["question"],
                    "options": q["options"],
                    "correctAnswer": q["correctAnswer"],
                    "type": "MCQ",
                    "difficulty": difficulty
                }
                
                # Quality validation
                try:
                    metrics = await validate_question_quality(
                        question=question_obj,
                        question_type="MCQ",
                        difficulty=difficulty,
                        experience_min=experience_min,
                        experience_max=experience_max,
                        job_designation=job_designation,
                        assessment_requirements=assessment_requirements,
                        topic=topic
                    )
                    
                    if metrics.overall_score >= 0.75:  # Quality threshold
                        validated_questions.append((question_obj, metrics.overall_score))
                        result.append(question_obj)
                        logger.debug(f"✅ MCQ quality score: {metrics.overall_score:.2f}")
                    else:
                        logger.warning(
                            f"⚠️ Low quality MCQ (score={metrics.overall_score:.2f}): "
                            f"{q.get('question', '')[:100]}... Issues: {', '.join(metrics.issues[:3])}"
                        )
                except Exception as e:
                    logger.warning(f"Quality validation failed for MCQ: {e}, including question anyway")
                    result.append(question_obj)  # Include even if validation fails
    
    # ⭐ CRITICAL FIX: Ensure we generate the requested number of questions
    if len(result) < count:
        logger.warning(f"⚠️ AI generated only {len(result)}/{count} MCQ questions. Requested {count}, got {len(questions_list)} from AI.")
        # If we got fewer questions than requested, retry to get the remaining ones
        remaining = count - len(result)
        logger.info(f"🔄 Retrying to generate {remaining} more MCQ question(s)...")
        
        # Retry with a more explicit prompt for the remaining count
        retry_prompt = f"""You are an expert technical assessment writer. Generate EXACTLY {remaining} additional Multiple Choice Question(s) for the topic: {topic}.

CRITICAL: You MUST generate EXACTLY {remaining} question(s). Do NOT generate fewer or more.

{'=' * 80}
CRITICAL: PERSONALIZATION CONTEXT (HIGHEST PRIORITY - MUST USE)
{'=' * 80}
{personalization_context if personalization_context else "(No specific personalization context provided - generate generic professional questions)"}
{'=' * 80}

IMPORTANT: These are ADDITIONAL questions. Make sure they are DIFFERENT from any previous questions.

Each question MUST have exactly 4 options and one correct answer.
Difficulty level: {difficulty}
Experience mode: {experience_mode}

Return ONLY a JSON object with questions array:
{{
  "questions": [
    {{
      "question": "<question text>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correctAnswer": "<option text that matches one of the options exactly>"
    }}
  ]
}}"""
        
        try:
            # ✅ SPEED OPTIMIZATION: Use gpt-4o-mini for MCQ retry (faster, cheaper)
            retry_response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": retry_prompt}],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            retry_content = retry_response.choices[0].message.content.strip() if retry_response.choices else ""
            retry_data = _parse_json_response(retry_content)
            
            if isinstance(retry_data, dict) and "questions" in retry_data:
                retry_questions = retry_data["questions"]
            elif isinstance(retry_data, list):
                retry_questions = retry_data
            else:
                retry_questions = []
            
            for q in retry_questions[:remaining]:
                if isinstance(q, dict) and "question" in q and "options" in q and "correctAnswer" in q:
                    if len(q["options"]) == 4:
                        result.append({
                            "question": q["question"],
                            "options": q["options"],
                            "correctAnswer": q["correctAnswer"],
                            "type": "MCQ",
                            "difficulty": difficulty
                        })
        except Exception as retry_exc:
            logger.error(f"Error retrying MCQ generation: {retry_exc}")
    
    if not result:
        raise HTTPException(status_code=500, detail="No valid MCQ questions generated")
    
    if len(result) < count:
        logger.warning(f"⚠️ Generated {len(result)}/{count} MCQ questions after retry. Proceeding with available questions.")
    
    return result[:count]  # Return exactly the requested count (or fewer if generation failed)


# ============================================================================
# SUBJECTIVE QUESTION GENERATION
# ============================================================================

async def _generate_subjective_questions(
    topic: str,
    difficulty: str,
    count: int,
    experience_mode: str = "corporate",
    additional_requirements: Optional[str] = None,
    job_designation: Optional[str] = None,
    experience_min: Optional[int] = None,
    experience_max: Optional[int] = None,
    company_name: Optional[str] = None,
    assessment_requirements: Optional[str] = None,  # Global requirements
    previous_question: Optional[str] = None  # ⭐ NEW - For regeneration (avoid repeating)
) -> List[Dict[str, Any]]:
    """
    Generate Subjective questions - PRODUCTION-GRADE WITH CONTEXT-AWARE PERSONALIZATION.
    
    Rules:
    - ONLY scenario-based, real-world, case-study style questions
    - Minimum 2-4 sentences
    - Requires reasoning, explanation, trade-offs, evaluation
    - NO: MCQ-like phrasing, "which of the following", one-liners
    - Should reflect real-world usage of the topic
    - PERSONALIZED based on assessment requirements, job role, experience level, and company
    
    Args:
        topic: Topic label
        difficulty: Difficulty level (Easy, Medium, Hard)
        count: Number of questions to generate
        experience_mode: Experience mode (corporate/college)
        additional_requirements: Optional topic-specific requirements (can be URL)
        job_designation: Job role/designation (e.g., "Senior Software Engineer")
        experience_min: Minimum years of experience required
        experience_max: Maximum years of experience required
        company_name: Company name for personalization (e.g., "Gisul")
        assessment_requirements: Global assessment requirements (HIGHEST PRIORITY)
        previous_question: For regeneration - the old question to avoid repeating
        
    Returns:
        List of Subjective question dictionaries with:
        - question: Scenario-based question text (2-4 sentences minimum)
    """
    # ⭐ BUILD PERSONALIZATION CONTEXT (PRIORITY ORDER)
    context_parts = []
    
    # Priority 0: REGENERATION CONTEXT (ABSOLUTE HIGHEST PRIORITY - Avoid repeating)
    if previous_question:
        context_parts.append(f"""**🔥 REGENERATION CONTEXT (CRITICAL - READ THIS FIRST)**:
The user is REGENERATING a question they found unsatisfactory.

OLD QUESTION (DO NOT REPEAT OR REUSE THIS):
\"\"\"{previous_question}\"\"\"

MANDATORY REQUIREMENTS FOR NEW QUESTION:
1. MUST be COMPLETELY DIFFERENT from the old question above
2. MUST be HIGHER QUALITY - more specific, more detailed, more professional
3. MUST be MORE PERSONALIZED - use company name, role, requirements if provided below
4. AVOID similar concepts, scenarios, or phrasing from the old question
5. Take a FRESH perspective on the topic "{topic}" while maintaining difficulty: {difficulty}

Example Improvements:
- Old (generic): "Explain REST API design principles"
- New (personalized): "You are a Senior Backend Engineer at Gisul building a payment gateway handling 10M+ transactions/day on AWS. Design a REST API that ensures PCI-DSS compliance, implements rate limiting for different user tiers, and provides comprehensive error handling. Explain your authentication strategy and how you would monitor API performance in Gisul's production environment."

⚠️ CRITICAL: If you generate something similar to the old question, the user will reject it!
""")
    
    # Priority 1: Assessment-level requirements (highest priority - from "Requirements" field)
    if assessment_requirements:
        context_parts.append(f"**Assessment Context (CRITICAL - USE THIS)**: {assessment_requirements}")
    
    # Priority 2: Topic-level additional requirements
    if additional_requirements:
        context_parts.append(f"**Topic-Specific Requirements**: {additional_requirements}")
    
    # Priority 3: Job role and company
    if job_designation:
        context_parts.append(f"**Job Role**: {job_designation}")
    
    if company_name:
        context_parts.append(f"**Company**: {company_name}")
    
    if experience_min is not None and experience_max is not None:
        years_text = f"{experience_min}-{experience_max} years"
        
        # Determine seniority level
        if experience_max <= 2:
            seniority = "Junior"
            focus_areas = "Focus on: execution, syntax, debugging, basic problem-solving"
        elif experience_max <= 5:
            seniority = "Mid"
            focus_areas = "Focus on: design patterns, best practices, code reviews, system design basics"
        elif experience_max <= 10:
            seniority = "Senior"
            focus_areas = "Focus on: architecture, scalability, team impact, technology choices"
        else:
            seniority = "Lead"
            focus_areas = "Focus on: strategic decisions, business impact, cross-team collaboration"
        
        context_parts.append(f"**Experience Required**: {years_text} ({seniority})")
        context_parts.append(f"**Focus Areas**: {focus_areas}")
    else:
        seniority = "Mid"  # Default
    
    personalization_context = "\n".join(context_parts) if context_parts else ""
    
    # Get difficulty calibration rules
    difficulty_rules = _get_difficulty_rules("Subjective", difficulty, seniority)
    
    # Build prompt with personalization
    prompt = f"""You are an expert technical assessment writer. Generate EXACTLY {count} scenario-based subjective question(s) for the topic: {topic}.

CRITICAL: You MUST generate EXACTLY {count} question(s). Do NOT generate fewer or more than {count} questions.

{'=' * 80}
CRITICAL: PERSONALIZATION CONTEXT (HIGHEST PRIORITY - MUST USE)
{'=' * 80}
{personalization_context if personalization_context else "(No specific personalization context provided - generate generic professional questions)"}
{'=' * 80}

MANDATORY PERSONALIZATION REQUIREMENTS:

1. **USE EXACT CONTEXT FROM ABOVE** - This is your #1 priority!
   - If assessment context is provided: Frame ALL scenarios around that specific context
   - If company name is provided: Use it in EVERY scenario
   - If job role is provided: Use exact job title in EVERY scenario
   - If requirements mention technologies: Reference them in scenarios
   - If requirements mention constraints: Include them in scenarios

2. **SCENARIO FRAMING EXAMPLES**:
   
   ✅ WITH FULL CONTEXT (company: Gisul, role: Senior Backend Engineer, context: "AWS serverless"):
   "You are a Senior Backend Engineer at Gisul working on AWS serverless architecture. 
   Your team is building a high-traffic e-commerce platform serving 50M+ users daily. 
   The platform uses Python Lambda functions on AWS. Design an API rate-limiting strategy 
   that handles peak traffic during flash sales. Explain your approach to distributing 
   rate limits across multiple Lambda instances, handling burst traffic, and ensuring 
   cost-optimization for Gisul's AWS budget."
   
   ✅ WITH ASSESSMENT REQUIREMENTS (requirements: "Focus on healthcare compliance HIPAA"):
   "Your application handles sensitive patient health records and must comply with HIPAA 
   regulations. Explain your approach to implementing encryption for data at rest and in 
   transit. Include specific technologies you would use, key management strategies, and how 
   you would ensure audit logging meets HIPAA requirements."
   
   ✅ WITH TOPIC REQUIREMENTS (additional: "Focus on microservices high availability"):
   "You are a Senior Backend Engineer at Gisul. Your team is building a microservices platform 
   that requires high availability (99.99% uptime SLA). Design a deployment strategy that allows 
   zero-downtime updates across 50+ microservices. Explain your approach to blue-green deployments, 
   rollback procedures, and health checks."
   
   ❌ WITHOUT CONTEXT (generic - AVOID IF CONTEXT PROVIDED):
   "Design an API rate-limiting strategy for a high-traffic system..."

3. **ALIGN COMPLEXITY WITH EXPERIENCE LEVEL**:
   - Junior (0-2 years): Focus on technical execution, learning, debugging, following best practices
   - Mid-level (3-5 years): Add system design basics, code reviews, mentoring junior developers
   - Senior (5-10 years): Include architecture decisions, team leadership, cross-team collaboration
   - Principal/Lead (10+ years): Strategic planning, stakeholder management, technical direction

{'=' * 80}
DIFFICULTY CALIBRATION (CRITICAL - MUST FOLLOW EXACTLY)
{'=' * 80}

Current Difficulty: {difficulty}
Seniority Level: {seniority}

**{difficulty.upper()} Difficulty Rules for Subjective ({seniority}):**

{difficulty_rules}

VALIDATION:
- Read the rules above CAREFULLY
- Generate questions that EXACTLY match the difficulty level
- If unsure, err on the side of being MORE challenging
- Easy ≠ Medium ≠ Hard - they must be DISTINCTLY different

{'=' * 80}

4. **QUESTION STRUCTURE** (2-4 sentences minimum):
   - Sentence 1: Context (role, company, current situation using provided context)
   - Sentence 2: Problem/challenge
   - Sentence 3-4: What needs to be explained/designed/analyzed

STANDARD REQUIREMENTS:
5. Generate ONLY scenario-based, real-world, case-study style questions
6. Each question MUST be minimum 2-4 sentences
7. Questions MUST require reasoning, explanation, trade-offs, or evaluation
8. NO MCQ-like phrasing (no "which of the following", no multiple choice options)
9. NO one-liner questions
10. Difficulty level: {difficulty}
11. Experience mode: {experience_mode}
12. **CRITICAL DIVERSITY REQUIREMENT**: Each question MUST be unique and different from the others

Output format (JSON object with questions array):
{{
  "questions": [
    {{
      "question": "<scenario-based question text, 2-4 sentences minimum, MUST use personalization context if provided>"
    }}
  ]
}}

DO NOT include idealAnswer, expectedAnswer, or any answer fields.

FINAL REMINDER: If personalization context is provided above, you MUST use it in EVERY question. 
Generic questions are ONLY acceptable when NO context is provided.

Return ONLY a JSON object with questions array."""

    client = _get_openai_client()
    try:
        # ✅ SPEED OPTIMIZATION: Use gpt-4o-mini for Subjective (faster, cheaper)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
    except Exception as exc:
        logger.error(f"OpenAI API error in _generate_subjective_questions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate subjective questions") from exc

    # Parse response
    content = response.choices[0].message.content.strip() if response.choices else ""
    data = _parse_json_response(content)
    
    # Handle response format
    if isinstance(data, dict) and "questions" in data:
        questions_list = data["questions"]
    elif isinstance(data, list):
        questions_list = data
    elif isinstance(data, dict) and "question" in data:
        # Single question object
        questions_list = [data]
    else:
        logger.error(f"Unexpected response format for subjective questions: {data}")
        raise HTTPException(status_code=500, detail="Invalid response format from AI")
    
    # Format and validate questions with quality check
    result = []
    validated_questions = []
    
    for q in questions_list[:count]:
        if isinstance(q, dict) and "question" in q:
            question_obj = {
                "question": q["question"],
                "type": "Subjective",
                "difficulty": difficulty
            }
            
            # Quality validation
            try:
                metrics = await validate_question_quality(
                    question=question_obj,
                    question_type="Subjective",
                    difficulty=difficulty,
                    experience_min=experience_min,
                    experience_max=experience_max,
                    job_designation=job_designation,
                    assessment_requirements=assessment_requirements,
                    topic=topic
                )
                
                if metrics.overall_score >= 0.75:  # Quality threshold
                    validated_questions.append((question_obj, metrics.overall_score))
                    result.append(question_obj)
                    logger.debug(f"✅ Subjective quality score: {metrics.overall_score:.2f}")
                else:
                    logger.warning(
                        f"⚠️ Low quality Subjective (score={metrics.overall_score:.2f}): "
                        f"{q.get('question', '')[:100]}... Issues: {', '.join(metrics.issues[:3])}"
                    )
            except Exception as e:
                logger.warning(f"Quality validation failed for Subjective: {e}, including question anyway")
                result.append(question_obj)  # Include even if validation fails
    
    # ⭐ CRITICAL FIX: Ensure we generate the requested number of questions
    if len(result) < count:
        logger.warning(f"⚠️ AI generated only {len(result)}/{count} Subjective questions. Requested {count}, got {len(questions_list)} from AI.")
        # Retry to get the remaining questions
        remaining = count - len(result)
        logger.info(f"🔄 Retrying to generate {remaining} more Subjective question(s)...")
        
        # Build retry prompt (reuse the same personalization context)
        retry_prompt = f"""You are an expert technical assessment writer. Generate EXACTLY {remaining} additional scenario-based subjective question(s) for the topic: {topic}.

CRITICAL: You MUST generate EXACTLY {remaining} question(s). Do NOT generate fewer or more.

{'=' * 80}
CRITICAL: PERSONALIZATION CONTEXT (HIGHEST PRIORITY - MUST USE)
{'=' * 80}
{personalization_context if personalization_context else "(No specific personalization context provided - generate generic professional questions)"}
{'=' * 80}

IMPORTANT: These are ADDITIONAL questions. Make sure they are DIFFERENT from any previous questions.

Return ONLY a JSON object with questions array:
{{
  "questions": [
    {{
      "question": "<scenario-based question text>"
    }}
  ]
}}"""
        
        try:
            # ✅ SPEED OPTIMIZATION: Use gpt-4o-mini for Subjective retry (faster, cheaper)
            retry_response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": retry_prompt}],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            retry_content = retry_response.choices[0].message.content.strip() if retry_response.choices else ""
            retry_data = _parse_json_response(retry_content)
            
            if isinstance(retry_data, dict) and "questions" in retry_data:
                retry_questions = retry_data["questions"]
            elif isinstance(retry_data, list):
                retry_questions = retry_data
            else:
                retry_questions = []
            
            for q in retry_questions[:remaining]:
                if isinstance(q, dict) and "question" in q:
                    result.append({
                        "question": q["question"],
                        "type": "Subjective",
                        "difficulty": difficulty
                    })
        except Exception as retry_exc:
            logger.error(f"Error retrying Subjective generation: {retry_exc}")
    
    if not result:
        raise HTTPException(status_code=500, detail="No valid subjective questions generated")
    
    if len(result) < count:
        logger.warning(f"⚠️ Generated {len(result)}/{count} Subjective questions after retry. Proceeding with available questions.")
    
    return result[:count]  # Return exactly the requested count (or fewer if generation failed)


# ============================================================================
# PSEUDOCODE QUESTION GENERATION
# ============================================================================

async def _generate_pseudocode_questions(
    topic: str,
    difficulty: str,
    count: int,
    experience_mode: str = "corporate",
    additional_requirements: Optional[str] = None,
    job_designation: Optional[str] = None,
    experience_min: Optional[int] = None,
    experience_max: Optional[int] = None,
    company_name: Optional[str] = None,
    assessment_requirements: Optional[str] = None,  # Global requirements
    previous_question: Optional[str] = None  # ⭐ NEW - For regeneration (avoid repeating)
) -> List[Dict[str, Any]]:
    """
    Generate Pseudocode questions - WITH CONTEXT-AWARE PERSONALIZATION.
    
    Rules:
    - Generate a pseudocode-related question ONLY
    - Should require algorithmic thinking
    - Must be scenario-based, not trivial
    - DO NOT generate the answer
    - Answer will be evaluated by AI scoring model
    - PERSONALIZED based on assessment requirements, experience level, role, and company
    
    Args:
        topic: Topic label
        difficulty: Difficulty level (Easy, Medium, Hard)
        count: Number of questions to generate
        experience_mode: Experience mode (corporate/college)
        additional_requirements: Optional topic-specific requirements
        job_designation: Job role/designation (used for context framing)
        experience_min: Minimum years of experience required
        experience_max: Maximum years of experience required
        company_name: Company name for personalization (e.g., "Gisul")
        assessment_requirements: Global assessment requirements (HIGHEST PRIORITY)
        
    Returns:
        List of PseudoCode question dictionaries with:
        - questionText: Scenario-based pseudocode question with sample input/output
    """
    # ⭐ BUILD PERSONALIZATION CONTEXT (PRIORITY ORDER)
    context_parts = []
    
    # Priority 1: Assessment-level requirements
    if assessment_requirements:
        context_parts.append(f"**Assessment Context**: {assessment_requirements}")
    
    # Priority 2: Topic-level requirements
    if additional_requirements:
        context_parts.append(f"**Topic Requirements**: {additional_requirements}")
    
    # Build context intro for framing
    context_intro = ""
    if job_designation and company_name:
        context_intro = f"At {company_name}, you are a {job_designation} working on"
    elif company_name:
        context_intro = f"At {company_name}, you need to"
    elif job_designation:
        context_intro = f"You are a {job_designation} and need to"
    
    if context_intro:
        context_parts.append(f"**Framing**: {context_intro}")
    
    # Determine complexity level
    complexity_hint = ""
    if experience_max is not None:
        if experience_max <= 2:
            complexity_hint = "(Junior level: Focus on basic algorithms and simple data structures)"
        elif experience_max <= 5:
            complexity_hint = "(Mid level: Include optimizations and moderate complexity)"
        elif experience_max <= 10:
            complexity_hint = "(Senior level: Complex algorithms, efficiency considerations)"
        else:
            complexity_hint = "(Lead level: System-level algorithms, scalability focus)"
    
    if complexity_hint:
        context_parts.append(f"**Complexity**: {complexity_hint}")
    
    personalization_context = "\n".join(context_parts) if context_parts else ""
    
    # Use legacy implementation with context awareness
    if _legacy_generate_questions:
        # Build a full config so every requested slot is explicitly pseudocode; otherwise
        # the legacy generator defaults Q2..Qn to Subjective and we end up with only one pseudocode.
        config = {"numQuestions": count}
        for i in range(1, count + 1):
            config[f"Q{i}type"] = "Pseudo Code"
            config[f"Q{i}difficulty"] = difficulty

        questions = await _legacy_generate_questions(topic, config, coding_supported=False, experience_mode=experience_mode)
        # Filter to only PseudoCode questions and ensure proper format
        pseudocode_questions = []
        for q in questions:
            if q.get("type", "").upper() in ["PSEUDO CODE", "PSEUDOCODE", "PSEUDO-CODE"]:
                pseudocode_questions.append(q)
        return pseudocode_questions[:count] if pseudocode_questions else questions[:count]
    
    logger.warning(f"Pseudocode question generation not yet implemented for topic: {topic}")
    raise HTTPException(
        status_code=501,
        detail="Pseudocode question generation is not yet implemented. Please use the legacy endpoint."
    )


# ============================================================================
# QUESTION REGENERATION
# ============================================================================

async def regenerate_question(
    old_question: str,
    question_type: str,
    difficulty: str,
    experience_mode: Optional[str] = "corporate",
    experience_min: Optional[int] = 0,
    experience_max: Optional[int] = 10,
    additional_requirements: Optional[str] = None,
    feedback: Optional[str] = None,
    topic_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Regenerate a single question based on the old question text and optional feedback.
    
    Args:
        old_question: Original question text
        question_type: Type of question (MCQ, Subjective, etc.)
        difficulty: Difficulty level
        experience_mode: Experience mode (corporate/college)
        experience_min: Minimum experience years
        experience_max: Maximum experience years
        additional_requirements: Optional additional requirements
        feedback: Optional user feedback for improvement
        topic_name: Optional topic name for context
        
    Returns:
        Regenerated question dictionary (format depends on question_type)
        
    Raises:
        HTTPException: If regeneration fails
    """
    # Prepare merged additional requirements including feedback
    merged_additional = additional_requirements or ""
    if feedback:
        merged_additional = f"{merged_additional}\nUser feedback: {feedback}" if merged_additional else f"User feedback: {feedback}"

    # Determine whether Judge0/coding is required
    qtype_norm = (question_type or "").strip().lower()
    can_use_judge0 = qtype_norm in ("coding", "code")

    # Use topic_name as topic_label if provided, otherwise empty string
    topic_label = topic_name or ""

    # Attempt to generate via AI pipeline; if it fails, return a safe fallback
    try:
        questions = await generate_questions_for_row_v2(
            topic_label=topic_label,
            question_type=question_type,
            difficulty=difficulty,
            questions_count=1,
            can_use_judge0=can_use_judge0,
            coding_language="python",
            additional_requirements=merged_additional if merged_additional else None,
            experience_mode=experience_mode,
            website_summary=None,
            company_context=None,
            job_designation=None,
            experience_min=experience_min,
            experience_max=experience_max,
            company_name=None,
            assessment_requirements=None,
            previous_question=old_question,
        )

        if not questions or len(questions) == 0:
            raise RuntimeError("AI generator returned no questions")

        return questions[0]

    except Exception as exc:
        # Log the original error for debugging
        logger.exception("AI regeneration failed, falling back to safe regeneration: %s", exc)

        # Build a safe fallback question object to avoid 500s
        try:
            # If old_question is a dict-like structure, try to preserve options/answers
            if isinstance(old_question, dict):
                fallback = old_question.copy()
                # Prefix question text to indicate regeneration
                if "question" in fallback and isinstance(fallback["question"], str):
                    fallback["question"] = f"Regenerated: {fallback['question']}"
                else:
                    fallback["question"] = f"Regenerated question for topic {topic_label}"
                # Mark regenerated metadata
                fallback["regeneratedFallback"] = True
                fallback["difficulty"] = difficulty
                return fallback

            # If old_question is a string, return a simple regenerated object
            if isinstance(old_question, str) and old_question.strip():
                return {
                    "question": f"Regenerated: {old_question}",
                    "type": question_type or "Subjective",
                    "difficulty": difficulty,
                    "regeneratedFallback": True,
                }

            # Ultimate generic fallback
            return {
                "question": f"Regenerated question for topic {topic_label} (fallback)",
                "type": question_type or "Subjective",
                "difficulty": difficulty,
                "regeneratedFallback": True,
            }
        except Exception:
            # If building fallback also fails, raise a 500 to surface error
            logger.exception("Failed to build regeneration fallback")
            raise HTTPException(status_code=500, detail="Failed to regenerate question") from exc



