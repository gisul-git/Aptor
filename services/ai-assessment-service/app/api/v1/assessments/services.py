from __future__ import annotations

import asyncio
import json
import logging
import re
from functools import lru_cache
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

try:
    from openai import AsyncOpenAI
    # Import OpenAI exception types - available in openai>=1.0.0
    try:
        from openai import RateLimitError, APIError, APIConnectionError, AuthenticationError
    except ImportError:
        # For older versions, these exceptions might not exist
        # We'll handle errors by checking error messages instead
        RateLimitError = None
        APIError = None
        APIConnectionError = None
        AuthenticationError = None
except ImportError as exc:  # pragma: no cover - optional dependency guard
    raise RuntimeError("The openai package is required. Ensure it is installed.") from exc

# Use absolute import to work with both normal import and importlib loading
try:
    from app.core.config import get_settings
except ImportError:
    # Fallback to relative import if absolute doesn't work
    from ....core.config import get_settings

# Import experience level helpers from services package to avoid duplication
# Using absolute import to avoid confusion with services.py file vs services/ package
from app.api.v1.assessments.services.ai_utils import (
    _get_experience_level_corporate,
    _get_experience_level_student,
)

logger = logging.getLogger(__name__)

_enrichment_cache: Dict[str, str] = {}


def infer_language_from_skill(job_designation: Optional[str] = None, selected_skills: Optional[List[str]] = None) -> str:
    """
    Infer coding language from job designation or selected skills.
    
    Mapping rules:
    - "java" → "java"
    - "c++" OR "cpp" → "cpp"
    - "c " or " c" or "c programming" → "c"
    - "python" → "python"
    - "javascript" OR "js" → "javascript"
    - "typescript" → "typescript"
    - "go" → "go"
    - "ruby" → "ruby"
    
    Default fallback: "python"
    
    Args:
        job_designation: Job designation string
        selected_skills: List of selected skills
        
    Returns:
        Normalized language name (python, java, cpp, c, javascript, typescript, go, ruby)
    """
    # Combine job designation and skills into a single searchable string
    search_text = ""
    if job_designation:
        search_text += " " + job_designation.lower()
    if selected_skills:
        search_text += " " + " ".join(selected_skills).lower()
    
    search_text = search_text.lower()
    
    # Check for language keywords (order matters - more specific first)
    if "c++" in search_text or "cpp" in search_text or "cplusplus" in search_text:
        return "cpp"
    if "typescript" in search_text or "ts " in search_text:
        return "typescript"
    if "javascript" in search_text or " js " in search_text or search_text.startswith("js ") or search_text.endswith(" js"):
        return "javascript"
    if "java" in search_text and "javascript" not in search_text:  # Avoid matching "javascript"
        return "java"
    if (" c " in search_text or search_text.startswith("c ") or search_text.endswith(" c") or 
        "c programming" in search_text) and "c++" not in search_text and "cpp" not in search_text:
        return "c"
    if "python" in search_text:
        return "python"
    if " go " in search_text or search_text.startswith("go ") or search_text.endswith(" go"):
        return "go"
    if "ruby" in search_text:
        return "ruby"
    
    # Default fallback
    return "python"


@lru_cache(maxsize=1)
def _get_client() -> AsyncOpenAI:
    settings = get_settings()
    if not settings.openai_api_key:
        raise ValueError("OpenAI API key not configured. Please set OPENAI_API_KEY in your environment variables.")
    return AsyncOpenAI(api_key=settings.openai_api_key)


def _get_paragraph_requirements(difficulty: str) -> Dict[str, str]:
    """Get paragraph requirements based on difficulty level."""
    requirements = {
        "Easy": {
            "min_paragraphs": "1",
            "max_paragraphs": "1",
            "description": "within 1 paragraph (short and easy)",
            "length_note": "Keep it concise - exactly 1 paragraph, short and straightforward."
        },
        "Medium": {
            "min_paragraphs": "2",
            "max_paragraphs": "2",
            "description": "above 1 paragraph and within 2 paragraphs",
            "length_note": "Should be more than 1 paragraph but exactly 2 paragraphs total - provide moderate detail."
        },
        "Hard": {
            "min_paragraphs": "3",
            "max_paragraphs": "3",
            "description": "above 2 paragraphs and within 3 paragraphs",
            "length_note": "Should be more than 2 paragraphs but exactly 3 paragraphs total - provide comprehensive detail and complexity."
        }
    }
    return requirements.get(difficulty, requirements["Medium"])


async def generate_topics_from_input(job_role: str, experience: str, skills: List[str], num_topics: int) -> List[str]:
    prompt = f"""
You are an AI assistant that generates technical assessment topics.
Based on:
- Job Role: {job_role}
- Experience Range: {experience}
- Key Skills: {', '.join(skills)}

Generate exactly {num_topics} concise, relevant technical topics.
Output only a simple list (no explanation).
"""

    client = _get_client()
    try:
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
    except Exception as exc:  # pragma: no cover - external API
        raise HTTPException(status_code=500, detail="Failed to generate topics") from exc

    text = response.choices[0].message.content.strip() if response.choices else ""
    topics = [line.strip("- ") for line in text.splitlines() if line.strip()]
    topics = [t.split(". ", 1)[-1] if ". " in t else t for t in topics]
    return topics[:num_topics]


# Experience level helpers are now imported from .services.ai_utils
# Removed duplicate definitions to fix circular import issue


async def generate_topic_cards_from_job_designation(
    job_designation: str, 
    experience_min: int = 0, 
    experience_max: int = 10,
    experience_mode: str = "corporate",
    assessment_title: Optional[str] = None
) -> List[str]:
    """Generate technology/skill cards from job designation, experience range, and experience mode."""
    
    # Get experience level and guidance based on mode
    if experience_mode == "corporate":
        experience_level, experience_guidance = _get_experience_level_corporate(experience_min, experience_max)
        experience_range_text = f"{experience_min}-{experience_max} years"
    else:  # student
        experience_level, experience_guidance = _get_experience_level_student(experience_min, experience_max)
        # For students, show the level name instead of year numbers
        experience_range_text = f"{experience_level} level"
    
    # Build prompt based on experience mode
    title_context = f"\nAssessment Title: {assessment_title}" if assessment_title else ""
    
    prompt = f"""Generate a list of 10–14 relevant skills for the following assessment:

Assessment Title: {assessment_title if assessment_title else 'Not specified'}
Job Role / Domain: {job_designation}
Experience Mode: {experience_mode}          # "corporate" or "student"
Experience Range: {experience_range_text}
Mapped Experience Level: {experience_level}

Your task:
Generate skills that match both the job role AND the chosen experience mode.

STRICT RULES:

1. When Experience Mode = "student" (college level):
   - Generate beginner-friendly, academic-oriented, foundational, or internship-level skills.
   - Use a learning-oriented progression relevant to students.
   - Focus on core concepts, principles, tools used in colleges, and simple real-world applications.
   - Avoid advanced enterprise systems unless extremely basic exposure is reasonable.
   - Examples of allowed student-level items:
     - Fundamentals, core concepts, introductory tools, basic frameworks, soft skills, mini-project skills.
   - Examples NOT allowed for students:
     - Advanced cloud, Kubernetes, Kafka, complex microservices, DevOps pipelines, production-grade tools, enterprise architecture.

2. When Experience Mode = "corporate" (industry level):
   - Generate skills expected at real companies for the given experience level.
   - Include practical tools, frameworks, workflows, methodologies, and technologies used in real jobs.
   - Use industry readiness and practical implementation as guiding criteria.
   - Avoid overly basic or academic-only skills unless essential.

3. Always ensure:
   - Skills must be relevant to the job role/domain.
   - No mixing of unrelated technologies.
   - No mixing corporate and student-level skills.
   - No explanations, no definitions, no numbering, no categorization.
   - Only return a clean JSON list of skill names.

4. If the job role is non-technical (e.g., HR, sales, finance, marketing):
   - Adapt the skills accordingly.
   - For students → beginner-level domain skills + academic foundation + essential tools.
   - For corporates → workplace skills + industry tools + domain practices.

OUTPUT FORMAT:
- Generate exactly 10-14 skill names
- Each skill should be a single word or short phrase (max 2-3 words)
- Use standard, widely-recognized skill/technology names
- Output ONLY the skill names, one per line
- No explanations, numbering, or descriptions
- No duplicates
- ALL skills must be directly relevant to "{job_designation}"
- Return only skill names, no explanations

Generate skills now:"""

    try:
        client = _get_client()
    except ValueError as exc:
        # API key not configured
        logger.error(f"OpenAI API key not configured: {exc}")
        raise HTTPException(status_code=500, detail="OpenAI API key not configured. Please contact the administrator.") from exc
    
    try:
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are an expert technical recruiter and assessment designer who understands job roles, required skills, and how experience levels and modes (corporate vs student) affect skill selection.

CRITICAL RULES:
1. Generate ONLY skills that are DIRECTLY relevant to the specific job role/domain
2. DO NOT include unrelated skills (e.g., don't include Python/HTML/CSS for a Java Developer role unless it's full-stack)
3. EXPERIENCE MODE: {experience_mode.upper()}
   - If CORPORATE: Generate industry-level skills, tools, frameworks suitable for professionals at the given experience level
   - If STUDENT: Generate beginner-friendly, academic-oriented, foundational skills appropriate for college learners
4. Match skills to the exact job role and experience mode
5. For students: Focus on learning-oriented, foundational concepts. Avoid advanced enterprise systems.
6. For corporates: Focus on practical, industry-ready skills used in real jobs.
7. Return only skill names, one per line. No explanations, no numbering, no categorization."""
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,  # Lower temperature for more consistent, focused results
        )
    except Exception as exc:
        # Check if this is a RateLimitError (quota/rate limit)
        is_rate_limit = False
        if RateLimitError is not None:
            is_rate_limit = isinstance(exc, RateLimitError)
        else:
            # Fallback: check error message or class name
            error_class_name = exc.__class__.__name__
            error_msg = str(exc)
            is_rate_limit = (
                'RateLimitError' in error_class_name or
                'rate limit' in error_msg.lower() or
                '429' in error_msg or
                'quota' in error_msg.lower()
            )
        
        if is_rate_limit:
            # Handle quota/rate limit errors specifically
            error_msg = str(exc)
            error_type = None
            error_code = None
            
            # Try to extract error details from the exception
            try:
                if hasattr(exc, 'response') and exc.response:
                    error_body = exc.response.get('error', {}) if isinstance(exc.response, dict) else {}
                    error_type = error_body.get('type', '')
                    error_code = error_body.get('code', '')
            except Exception:
                pass
            
            # Check for quota errors in error message or error details
            if (error_type == 'insufficient_quota' or 
                error_code == 'insufficient_quota' or 
                'quota' in error_msg.lower() or 
                'insufficient_quota' in error_msg.lower()):
                logger.error(f"OpenAI API quota exceeded: {exc}")
                raise HTTPException(
                    status_code=503,
                    detail="OpenAI API quota exceeded. Please check your OpenAI account billing and plan. The service is temporarily unavailable."
                ) from exc
            else:
                logger.error(f"OpenAI API rate limit error: {exc}")
                raise HTTPException(
                    status_code=503,
                    detail="OpenAI API rate limit exceeded. Please try again in a few moments."
                ) from exc
        
        # Check if this is an AuthenticationError
        is_auth_error = False
        if AuthenticationError is not None:
            is_auth_error = isinstance(exc, AuthenticationError)
        else:
            error_msg = str(exc)
            error_class_name = exc.__class__.__name__
            is_auth_error = (
                'AuthenticationError' in error_class_name or
                'api key' in error_msg.lower() or
                'authentication' in error_msg.lower() or
                '401' in error_msg
            )
        
        if is_auth_error:
            logger.error(f"OpenAI API authentication failed: {exc}")
            raise HTTPException(
                status_code=500,
                detail="OpenAI API authentication failed. Please check API key configuration."
            ) from exc
        
        # Check if this is an APIConnectionError
        is_conn_error = False
        if APIConnectionError is not None:
            is_conn_error = isinstance(exc, APIConnectionError)
        else:
            error_msg = str(exc)
            error_class_name = exc.__class__.__name__
            is_conn_error = (
                'APIConnectionError' in error_class_name or
                'connection' in error_msg.lower() or
                'timeout' in error_msg.lower()
            )
        
        if is_conn_error:
            logger.error(f"OpenAI API connection error: {exc}")
            raise HTTPException(
                status_code=503,
                detail="Failed to connect to OpenAI API. Please try again later."
            ) from exc
        
        # Check if this is a general APIError
        is_api_error = False
        if APIError is not None:
            is_api_error = isinstance(exc, APIError)
        
        if is_api_error:
            logger.error(f"OpenAI API error: {exc}", exc_info=True)
            error_msg = str(exc)
            raise HTTPException(
                status_code=500,
                detail=f"OpenAI API error: {error_msg}"
            ) from exc
        
        # If we get here, it's an unexpected error
        logger.error(f"Unexpected error calling OpenAI API: {exc}", exc_info=True)
        error_msg = str(exc)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate topic cards: {error_msg}"
        ) from exc

    text = response.choices[0].message.content.strip() if response.choices else ""
    if not text:
        logger.warning("OpenAI API returned empty response")
        raise HTTPException(status_code=500, detail="OpenAI API returned an empty response. Please try again.")
    
    # Parse the response - handle various formats and filter out non-technology entries
    cards = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        
        # Remove common prefixes and formatting
        line = line.strip("- •*")
        # Remove numbering (e.g., "1. Python" -> "Python")
        if ". " in line and (line[0].isdigit() or line.startswith("(")):
            line = line.split(". ", 1)[-1]
        # Remove any remaining numbering patterns
        line = line.lstrip("0123456789. )")
        line = line.strip()
        
        # Filter out non-technology entries (explanations, descriptions, etc.)
        if line and len(line) < 50:  # Technology names should be short
            # Skip lines that look like explanations or descriptions
            skip_keywords = ["example", "include", "such as", "like", "typically", "usually", "common", "focus on", "consider"]
            if not any(keyword in line.lower() for keyword in skip_keywords):
                cards.append(line)
    
    # Remove duplicates while preserving order, and filter out empty strings
    unique_cards = []
    seen = set()
    for card in cards:
        card_clean = card.strip()
        if card_clean and card_clean.lower() not in seen:
            seen.add(card_clean.lower())
            unique_cards.append(card_clean)
    
    # Limit to 12 cards max
    unique_cards = unique_cards[:12]
    
    if not unique_cards:
        logger.warning("No topic cards generated from OpenAI response")
        raise HTTPException(status_code=500, detail="Failed to parse topic cards from AI response. Please try again.")
    
    return unique_cards[:12]  # Limit to 12 cards


async def determine_topic_coding_support(topic: str) -> bool:
    """
    Determine if a topic supports coding questions based on algorithmic/coding relevance.
    
    ENGINE-DRIVEN: Uses AI to determine if the topic is:
    - Algorithmic in nature
    - Relates to data structures, logic, programming, system behavior
    - Typically appears in coding assessments
    - Can be solved via input/output transformation
    
    Returns True if the topic supports coding questions (e.g., "Array", "Matrix", "Stack", "Linked List").
    Returns False for non-coding topics (e.g., "Agile Methodology", "Communication", "UI/UX Basics").
    """
    topic_lower = topic.lower().strip()
    
    # Quick keyword check for obvious coding topics (for performance)
    obvious_coding_keywords = [
        "array", "arrays", "string", "strings", "linked list", "linkedlist", "hashmap", "hash map",
        "sorting", "searching", "matrix", "matrices", "binary tree", "graph", "graphs",
        "dp", "dynamic programming", "stack", "queue", "heap", "trie", "tree", "trees",
        "sql query", "sql queries", "json parsing", "file handling", "number problems",
        "java oop", "c functions", "algorithm design", "coding implementation",
        "data structure", "data structures", "algorithm", "algorithms", "dsa",
        "competitive programming", "problem solving", "recursion", "backtracking",
        "greedy", "binary search", "graph algorithm", "string algorithm"
    ]
    
    for keyword in obvious_coding_keywords:
        if keyword in topic_lower:
            return True
    
    # Quick check for obvious non-coding topics
    non_coding_keywords = [
        "agile methodology", "communication", "cloud benefits", "ui/ux basics",
        "ui ux basics", "debugging theory", "networking osi layer", "osi layer",
        "soft skills", "aptitude", "reasoning", "hr", "human resources"
    ]
    
    for keyword in non_coding_keywords:
        if keyword in topic_lower:
                return False
    
    # Use AI for ENGINE-DRIVEN classification (for ambiguous cases)
    try:
        client = _get_client()
        prompt = f"""Determine if the topic "{topic}" supports coding questions.

A topic supports coding if it is:
- Algorithmic in nature (e.g., "Array", "Matrix", "Stack", "Linked List")
- Relates to data structures, logic, programming, or system behavior
- Typically appears in coding assessments
- Can be solved via input/output transformation

Examples of topics that SUPPORT coding (return "true"):
- "Array", "Arrays", "Strings", "Linked List", "HashMap", "Sorting", "Searching"
- "Matrix", "Binary Tree", "Graph", "DP", "Stack", "Queue"
- "SQL Query Writing", "JSON Parsing", "File Handling", "Number Problems"
- "Java OOP", "C Functions", "Algorithm Design", "Coding Implementation"

Examples of topics that do NOT support coding (return "false"):
- "Agile Methodology", "Communication", "Cloud Benefits"
- "UI/UX Basics", "Debugging Theory", "Networking OSI Layer"
- Soft skills, theory-only topics, methodology topics

Respond with ONLY "true" or "false" (no explanation, no quotes, just the word)."""

        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at classifying technical topics for coding question support. Determine if the topic is algorithmic/coding-related. Respond with only 'true' or 'false'."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=10
        )
        
        result = response.choices[0].message.content.strip().lower()
        return result == "true"
    except Exception as e:
        logger.warning(f"Failed to determine coding support for topic '{topic}' using AI, defaulting to False: {e}")
        return False


async def generate_topics_from_selected_skills(
    skills: List[str], 
    experience_min: str, 
    experience_max: str,
    experience_mode: str = "corporate"
) -> List[str]:
    """Generate topics from multiple selected skills/technologies."""
    if not skills:
        return []
    
    skills_list = ", ".join(skills)
    
    # Get experience level context based on mode
    try:
        exp_min_int = int(experience_min)
        exp_max_int = int(experience_max)
        if experience_mode == "corporate":
            exp_level, _ = _get_experience_level_corporate(exp_min_int, exp_max_int)
            exp_range_text = f"{experience_min}-{experience_max} years"
            mode_context = "professional/corporate candidates with industry experience"
        else:  # student
            exp_level, _ = _get_experience_level_student(exp_min_int, exp_max_int)
            exp_range_text = f"{exp_level} level"
            mode_context = "college students with academic experience"
    except (ValueError, TypeError):
        exp_level = "General"
        exp_range_text = f"{experience_min} to {experience_max} years"
        mode_context = "candidates" if experience_mode == "corporate" else "students"
    
    prompt = f"""
You are an AI assistant that generates assessment topics.
Based on:
- Selected Skills/Technologies: {skills_list}
- Experience Range: {exp_range_text}
- Experience Level: {exp_level}
- Experience Mode: {experience_mode.upper()} ({mode_context})

Generate 5-8 concise, relevant topics for each selected skill/technology.
If multiple skills are provided, generate topics that cover all of them.
Output only a simple list (no explanation, no numbering).
Each topic should be a single line, starting with "- " or just the topic name.
Make sure topics are specific to the selected skills and appropriate for {mode_context} at {exp_level} level.
"""

    client = _get_client()
    try:
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
    except Exception as exc:  # pragma: no cover - external API
        raise HTTPException(status_code=500, detail="Failed to generate topics") from exc

    text = response.choices[0].message.content.strip() if response.choices else ""
    topics = [line.strip("- ") for line in text.splitlines() if line.strip()]
    topics = [t.split(". ", 1)[-1] if ". " in t else t for t in topics]
    # Filter out empty topics and return
    return [t for t in topics if t.strip()]


async def generate_topics_from_skill(
    skill: str, 
    experience_min: str, 
    experience_max: str,
    experience_mode: str = "corporate"
) -> List[str]:
    """Generate topics from a single skill/domain input."""
    
    # Get experience level context based on mode
    try:
        exp_min_int = int(experience_min)
        exp_max_int = int(experience_max)
        if experience_mode == "corporate":
            exp_level, _ = _get_experience_level_corporate(exp_min_int, exp_max_int)
            exp_range_text = f"{experience_min}-{experience_max} years"
            mode_context = "professional/corporate candidates with industry experience"
        else:  # student
            exp_level, _ = _get_experience_level_student(exp_min_int, exp_max_int)
            exp_range_text = f"{exp_level} level"
            mode_context = "college students with academic experience"
    except (ValueError, TypeError):
        exp_level = "General"
        exp_range_text = f"{experience_min} to {experience_max} years"
        mode_context = "candidates" if experience_mode == "corporate" else "students"
    
    prompt = f"""
You are an AI assistant that generates assessment topics.
Based on:
- Skill/Domain: {skill}
- Experience Range: {exp_range_text}
- Experience Level: {exp_level}
- Experience Mode: {experience_mode.upper()} ({mode_context})

Generate 5-8 concise, relevant topics for this skill/domain.
Output only a simple list (no explanation, no numbering).
Each topic should be a single line, starting with "- " or just the topic name.
Make sure topics are appropriate for {mode_context} at {exp_level} level.
"""

    client = _get_client()
    try:
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
    except Exception as exc:  # pragma: no cover - external API
        raise HTTPException(status_code=500, detail="Failed to generate topics") from exc

    text = response.choices[0].message.content.strip() if response.choices else ""
    topics = [line.strip("- ") for line in text.splitlines() if line.strip()]
    topics = [t.split(". ", 1)[-1] if ". " in t else t for t in topics]
    # Filter out empty topics and return
    return [t for t in topics if t.strip()]


async def get_relevant_question_types_from_domain(domain: str) -> List[str]:
    """Determine relevant question types based on domain/designation using AI."""
    if not domain or not domain.strip():
        return ["MCQ", "Subjective", "Descriptive"]
    
    prompt = f"""
You are an AI assistant that determines appropriate question types for assessments.
Based on the domain/designation: "{domain}"

Determine if this domain requires programming/coding skills (like software development, computer science, etc.) or not.

Question types available:
- MCQ: Multiple Choice Questions (suitable for all domains)
- Subjective: Open-ended questions requiring explanation (suitable for all domains)
- Pseudo Code: Algorithm design and logical problem-solving (ONLY for programming/coding domains)
- Descriptive: Detailed explanation questions (suitable for all domains)
- coding: Programming questions with code execution (ONLY for programming/coding domains)

Rules:
1. If the domain is related to programming, software development, computer science, coding, algorithms, or software engineering → Include ALL types: MCQ, Subjective, Pseudo Code, Descriptive, coding
2. If the domain is NOT programming-related (e.g., Mechanical Engineering, Civil Engineering, Aptitude, Soft Skills, etc.) → Exclude Pseudo Code and coding: MCQ, Subjective, Descriptive

Respond with ONLY a comma-separated list of question types (e.g., "MCQ, Subjective, Descriptive" or "MCQ, Subjective, Pseudo Code, Descriptive, coding").
Do not include any explanation, just the list.
"""

    client = _get_client()
    try:
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,  # Lower temperature for more consistent results
        )
    except Exception as exc:  # pragma: no cover - external API
        # Fallback to safe defaults if AI fails
        logger.warning(f"Failed to get question types from AI, using fallback: {exc}")
        return ["MCQ", "Subjective", "Descriptive"]
    
    text = response.choices[0].message.content.strip() if response.choices else ""
    
    # Parse the response
    question_types = [qt.strip() for qt in text.split(",") if qt.strip()]
    
    # Validate question types
    valid_types = {"MCQ", "Subjective", "Pseudo Code", "Descriptive", "coding"}
    filtered_types = [qt for qt in question_types if qt in valid_types]
    
    # If no valid types found, return safe defaults
    if not filtered_types:
        return ["MCQ", "Subjective", "Descriptive"]
    
    return filtered_types


async def get_question_type_for_topic(topic: str) -> str:
    """
    Optimized function to determine the most appropriate question type for a specific topic.
    Uses fast keyword matching first, then AI only if needed.
    Returns a single question type (not a list).
    """
    if not topic or not topic.strip():
        return "MCQ"
    
    topic_lower = topic.lower().strip()

    # High-priority deterministic routing (no AI):
    # 1) AIML topics
    # AIML type is ONLY for topics requiring writing/executing ML/DS code (notebook).
    aiml_keywords = [
        "pandas", "numpy", "matplotlib", "seaborn", "plotly", "scipy",
        "tensorflow", "keras", "pytorch", "torch", "scikit-learn", "sklearn",
        "machine learning", "deep learning", "neural network", "random forest", "decision tree",
        "regression", "classification", "clustering", "supervised learning", "unsupervised learning",
        "gradient descent", "backpropagation",
        "jupyter", "notebook", "colab", "anaconda",
        "data preprocessing", "feature engineering", "model training", "dataframe", "series",
        "model evaluation", "cross validation",
    ]
    aiml_theory_keywords = [
        " vs ", " versus ", "compare", "comparison", "difference", "differences",
        "advantages", "disadvantages", "benefits", "drawbacks",
        "concept", "concepts", "principle", "principles", "fundamental", "fundamentals", "basic", "basics",
        "theory", "explained", "explain", "explanation", "understanding", "overview", "introduction",
        "what is", "why", "when", "how does",
        "architecture", "design", "workflow", "process",
    ]
    aiml_execution_keywords = [
        "implement", "implementation", "build", "train", "fit", "predict",
        "write code", "coding", "notebook", "jupyter", "colab",
        "using pandas", "with pandas", "using numpy", "with numpy",
        "using sklearn", "with sklearn", "using scikit-learn", "with scikit-learn",
        "using tensorflow", "with tensorflow", "using pytorch", "with pytorch",
        "data preprocessing", "feature engineering", "model training",
    ]
    if any(k in topic_lower for k in aiml_keywords):
        # If it's AIML-related but conceptual/comparison-focused, keep it Subjective (no notebook execution).
        if any(k in topic_lower for k in aiml_theory_keywords) and not any(k in topic_lower for k in aiml_execution_keywords):
            return "Subjective"
        # Require explicit execution intent for AIML type
        if any(k in topic_lower for k in aiml_execution_keywords):
            return "AIML"
        return "Subjective"

    # 2) SQL topics
    # SQL type is ONLY for topics requiring writing/executing SQL queries/procedures (sandbox).
    # Use word-boundary + contextual patterns to avoid false positives like "selectors" -> "select" and "overview" -> "view".
    import re

    sql_theory_keywords = [
        " vs ", " versus ", "compare", "comparison", "difference", "differences",
        "advantages", "disadvantages", "benefits", "drawbacks",
        "concept", "concepts", "principle", "principles", "fundamental", "fundamentals", "basic", "basics",
        "explained", "explain", "explanation", "understanding", "overview", "introduction",
        "types of", "what is", "why", "when",
        "strategy", "strategies", "approach", "approaches", "technique", "techniques", "best practice", "best practices",
        "design", "architecture", "modeling", "modelling",
        "vulnerability", "vulnerabilities", "security", "prevention", "mitigation",
        "injection",
    ]
    sql_execution_keywords = [
        "write sql", "write a sql", "write query", "write a query", "construct query", "create query",
        "sql query to", "query to", "using sql to",
        "implement stored procedure", "write stored procedure", "create stored procedure", "stored procedure implementation",
        "create procedure", "write procedure", "implement procedure",
        "create trigger", "write trigger", "trigger implementation",
        "optimize query", "optimizing query", "query optimization", "rewrite query", "improve query performance",
        "recursive query", "writing recursive",
    ]
    sql_indicator_patterns = [
        r"\bsql\b",
        r"\bmysql\b",
        r"\bpostgresql\b",
        r"\bsqlite\b",
        r"\boracle\b",
        r"\bmssql\b",
        r"\bdatabase\b",
        r"\bdb\b",
        r"\bschema\b",
        r"\btable\b",
        r"\btables\b",
        r"\bquery\b",
        r"\bqueries\b",
        r"\bstored\s+procedure\b",
        r"\btrigger\b",
        r"\bview\b",
        r"\bindex\b",
        r"\bindexes\b",
        r"\bindexing\b",
        r"\btransaction\b",
        r"\btransactions\b",
        r"\bacid\b",
        r"\bprimary\s+key\b",
        r"\bforeign\s+key\b",
        r"\bnormalization\b",
        r"\bdenormalization\b",
    ]
    sql_op_patterns = [
        r"\bselect\b.*\bfrom\b",
        r"\bjoin\b.*\bon\b",
        r"\bgroup\s+by\b",
        r"\border\s+by\b",
        r"\bwhere\b",
        r"\bhaving\b",
        r"\binsert\b.*\binto\b",
        r"\bupdate\b.*\bset\b",
        r"\bdelete\b.*\bfrom\b",
        r"\bsubquery\b",
        r"\bsubqueries\b",
    ]

    is_sql_related = any(re.search(p, topic_lower) for p in sql_indicator_patterns)
    if not is_sql_related:
        op_hits = sum(1 for p in sql_op_patterns if re.search(p, topic_lower))
        is_sql_related = op_hits >= 2

    if is_sql_related:
        # SQL theory/security/comparison stays Subjective (no sandbox execution).
        if any(k in topic_lower for k in sql_theory_keywords) and not any(k in topic_lower for k in sql_execution_keywords):
            return "Subjective"
        # Require explicit execution intent or strong SQL op context
        if any(k in topic_lower for k in sql_execution_keywords) or any(re.search(p, topic_lower) for p in sql_op_patterns):
            return "SQL"
        return "Subjective"

    # 3) Web technology topics are NEVER coding (platform doesn't support browser/web execution)
    web_keywords = [
        # Frontend frameworks
        "react", "angular", "vue", "svelte", "nextjs", "next.js", "nuxt", "gatsby", "ember",
        # Web technologies
        "html", "css", "scss", "sass", "less", "tailwind", "bootstrap", "material ui", "chakra ui", "ant design",
        # Browser/DOM
        "dom", "browser", "document", "window", "event listener", "fetch api", "localstorage", "sessionstorage",
        "cookie", "webstorage",
        # Web frameworks (backend)
        "express", "koa", "fastify", "nest", "nestjs", "meteor",
        # Frontend build tools
        "webpack", "vite", "rollup", "parcel", "babel",
        # UI libraries
        "jquery", "d3", "chart.js", "three.js", "gsap", "anime.js",
        # Web concepts
        "frontend", "web development", "responsive design", "web page", "website", "web app", "web application",
        "spa", "single page", "ssr", "server side rendering", "csr", "client side rendering",
        # Node.js web
        "node server", "express server", "api endpoint", "http server", "rest api in node",
    ]
    if any(k in topic_lower for k in web_keywords):
        implementation_keywords = ["build", "create", "implement", "design", "develop", "write"]
        return "Subjective" if any(k in topic_lower for k in implementation_keywords) else "MCQ"
    
    # Fast keyword-based matching (no AI call needed)
    # Coding-related topics
    coding_keywords = [
        "algorithm", "data structure", "programming", "coding", "code", 
        "leetcode", "hackerrank", "problem solving", "competitive programming",
        "array", "linked list", "tree", "graph", "dynamic programming", "dp",
        "sorting", "searching", "recursion", "backtracking", "greedy",
        "python", "java", "javascript", "c++", "c#", "go", "rust", "sql",
        "oops", "oop", "object oriented", "object-oriented", "design pattern", "system design",
        "inheritance", "polymorphism", "encapsulation", "abstraction", "classes", "objects"
    ]
    
    # Subjective/Descriptive topics (theory/conceptual)
    theory_keywords = [
        "theory", "concept", "overview", "introduction", "fundamentals",
        "architecture", "design", "methodology", "process", "framework",
        "best practices", "principles", "guidelines", "standards"
    ]
    
    # Pseudo Code topics (algorithm design without execution)
    pseudo_code_keywords = [
        "pseudo code", "pseudocode", "algorithm design", "flowchart",
        "logic", "step by step", "procedure", "methodology"
    ]
    
    # MCQ keywords (factual, definition-based, quick assessment topics)
    mcq_keywords = [
        "definition", "what is", "basics", "fundamentals", "introduction", "overview",
        "concept", "principles", "features", "characteristics", "types", "kinds",
        "components", "parts", "elements", "tools", "technologies", "frameworks",
        "libraries", "packages", "syntax", "keywords", "operators", "data types",
        "variables", "functions", "methods", "classes", "modules", "imports",
        "comparison", "difference", "similarities", "advantages", "disadvantages",
        "benefits", "limitations", "use cases", "examples", "applications"
    ]
    
    # Subjective keywords (explanation, reasoning, understanding-based topics)
    subjective_keywords = [
        "explain", "describe", "how", "why", "when", "where", "discuss",
        "analyze", "evaluate", "compare", "contrast", "elaborate", "detail",
        "reasoning", "logic", "approach", "strategy", "method", "process",
        "workflow", "pipeline", "architecture", "design", "pattern", "best practices",
        "optimization", "performance", "scalability", "security", "testing",
        "debugging", "troubleshooting", "implementation", "deployment", "maintenance"
    ]
    
    # PRIORITY ORDER: Check MCQ and Subjective FIRST before coding/descriptive
    # This ensures more variety in question types instead of always defaulting to coding/descriptive
    
    # 1. Check for MCQ topics first (most common for tech topics)
    # Expand MCQ keywords to include common tech topic patterns
    expanded_mcq_indicators = mcq_keywords + [
        "framework", "library", "tool", "technology", "language", "platform",
        "features", "syntax", "api", "component", "module", "package"
    ]
    if any(keyword in topic_lower for keyword in expanded_mcq_indicators):
        return "MCQ"
    
    # 2. Check for Subjective topics (explanation-based)
    # Expand Subjective keywords to include common explanation patterns
    expanded_subjective_indicators = subjective_keywords + [
        "working", "functionality", "mechanism", "operation", "behavior",
        "lifecycle", "rendering", "state management", "routing", "authentication"
    ]
    if any(keyword in topic_lower for keyword in expanded_subjective_indicators):
        return "Subjective"
    
    # 3. Check for pseudo code topics (algorithm design)
    if any(keyword in topic_lower for keyword in pseudo_code_keywords):
        return "Pseudo Code"
    
    # 4. Check for explicit coding execution keywords (very specific - only for actual code execution)
    explicit_coding_keywords = ["leetcode", "hackerrank", "competitive programming", "code solution", "write code", "implement algorithm"]
    if any(kw in topic_lower for kw in explicit_coding_keywords):
        coding_supported = await determine_topic_coding_support(topic)
        if coding_supported:
            return "coding"
        # If not supported, continue to other checks
    
    # 5. Check for coding-related topics (but be more selective)
    # Only check coding keywords if topic explicitly mentions execution/implementation
    execution_keywords = ["implementation", "execute", "run", "compile", "debug", "algorithm", "data structure", "dsa", "problem solving"]
    has_execution_context = any(kw in topic_lower for kw in execution_keywords)
    
    if has_execution_context and any(keyword in topic_lower for keyword in coding_keywords):
        coding_supported = await determine_topic_coding_support(topic)
        if coding_supported:
            # Only return coding if it's explicitly about writing/running code
            return "coding"
        # If not supported, default to Subjective
        return "Subjective"
    
    # 6. For topics with coding keywords but no execution context, prefer MCQ/Subjective
    if any(keyword in topic_lower for keyword in coding_keywords):
        # Check if it's more about basics/fundamentals (MCQ) or concepts (Subjective)
        if any(kw in topic_lower for kw in ["basics", "fundamentals", "introduction", "overview", "what is", "definition", "features", "syntax"]):
            return "MCQ"
        if any(kw in topic_lower for kw in ["how", "why", "explain", "describe", "concept", "understanding", "working"]):
            return "Subjective"
        # Default to MCQ for general tech topics
        return "MCQ"
    
    # 7. Check for theory/conceptual topics (but prioritize MCQ/Subjective)
    if any(keyword in topic_lower for keyword in theory_keywords):
        # Check if it's more about explanation (Subjective) or factual (MCQ)
        if any(kw in topic_lower for kw in subjective_keywords):
            return "Subjective"
        if any(kw in topic_lower for kw in mcq_keywords):
            return "MCQ"
        # Only use Descriptive if it truly requires comprehensive explanation
        return "Descriptive"
    
    # For ambiguous cases, use AI (but optimized with low temperature and max_tokens)
    # First check if topic supports coding before allowing AI to return "coding"
    coding_supported = await determine_topic_coding_support(topic)
    
    try:
        client = _get_client()
        prompt = f"""Determine the most appropriate question type for the topic: "{topic}"

Available question types:
- MCQ: Multiple choice questions (best for factual knowledge, definitions, quick assessments, "what is" questions)
- Subjective: Open-ended questions requiring explanation (best for understanding concepts, reasoning, "how/why" questions)
- Pseudo Code: Algorithm design and logical problem-solving (best for algorithm design without code execution)
- Descriptive: Detailed explanation questions (best for comprehensive understanding, theory, long-form answers)
- coding: Programming questions with code execution via Judge0 (ONLY for executable code)

CRITICAL RULES:
1. Return "coding" ONLY if:
   - Topic involves executable code that Judge0 can run (e.g., Data Structures, Algorithms, DSA, Programming languages with execution)
   - Topic is about writing code that can be validated (e.g., Python programming, Java coding, C++ algorithms)
   - NOT for frameworks (React, Angular, Django), UI/UX, theory, or non-executable concepts

2. Do NOT return "coding" for:
   - Framework/library concepts (React, Angular, Vue, Django, Flask, Spring)
   - UI/UX, design, CSS, HTML styling
   - Theory subjects (OS theory, DBMS theory, CN theory)
   - DevOps, Docker, Kubernetes, deployment tools
   - Testing frameworks (Jest, JUnit, pytest)
   - Architecture, design patterns (conceptual only)
   - Git, version control, tools

3. PRIORITY ORDER (MUST follow this order strictly):
   a) For factual/definition/"what is"/basics/fundamentals topics → "MCQ" (HIGHEST PRIORITY - use for most tech topics)
   b) For explanation/"how/why"/process/understanding topics → "Subjective" (SECOND PRIORITY - use for conceptual topics)
   c) For algorithm design without execution → "Pseudo Code" (ONLY if explicitly about algorithm design)
   d) For executable code topics (leetcode, hackerrank, coding problems) → "coding" (ONLY if explicitly about code execution)
   e) For theoretical/conceptual topics requiring VERY detailed explanation → "Descriptive" (LAST RESORT - avoid if possible)

4. DEFAULT PREFERENCES (IMPORTANT - follow these defaults):
   - MOST tech topics (frameworks, libraries, tools, languages) → "MCQ" (default choice)
   - Conceptual/explanation topics (how things work, processes) → "Subjective" (default choice)
   - Algorithm/data structure problems requiring code → "coding" (only if explicitly about execution)
   - Comprehensive theory requiring long-form answers → "Descriptive" (rarely use)
   
5. WHEN TO USE EACH TYPE:
   - "MCQ": Use for 70% of topics - frameworks, libraries, tools, syntax, features, basics, fundamentals
   - "Subjective": Use for 20% of topics - explanations, processes, how things work, concepts
   - "Pseudo Code": Use for 5% of topics - algorithm design, flowcharts, step-by-step logic
   - "coding": Use for 3% of topics - only explicit coding problems (leetcode-style)
   - "Descriptive": Use for 2% of topics - only comprehensive theory requiring long answers

IMPORTANT: Prefer "MCQ" for factual/definition topics and "Subjective" for explanation topics. Only use "Descriptive" for topics requiring very detailed, comprehensive explanations. Only return "coding" if code can be EXECUTED by Judge0.

Respond with ONLY one word: the question type name (e.g., "MCQ", "Subjective", "Pseudo Code", "Descriptive", or "coding").
No explanation, just the type name."""

        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at determining appropriate question types. Respond with only the question type name."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,  # Very low temperature for consistency
            max_tokens=15,  # Limit response length for speed
        )
        
        result = response.choices[0].message.content.strip() if response.choices else ""
        result = result.strip('"\'')  # Remove quotes if present
        
        # Validate result and ensure "coding" is only returned if topic supports coding
        valid_types = {"MCQ", "Subjective", "Pseudo Code", "Descriptive", "coding", "SQL", "AIML"}
        if result in valid_types:
            # Sanity-check SQL returned from AI to avoid mislabeling non-SQL topics
            if result == "SQL":
                # Check if topic actually contains SQL-related patterns
                # sql_indicator_patterns and sql_op_patterns are defined earlier in this function
                has_sql_indicator = any(re.search(p, topic_lower) for p in sql_indicator_patterns)
                has_sql_op = any(re.search(p, topic_lower) for p in sql_op_patterns)
                if not (has_sql_indicator or has_sql_op):
                    result = "Subjective" if any(k in topic_lower for k in ["vs", "versus", "difference", "compare", "comparison"]) else "MCQ"
            # If AI returned "coding" but topic doesn't support coding, change to safe default
            if result == "coding" and not coding_supported:
                logger.warning(f"AI returned 'coding' for topic '{topic}' but topic doesn't support coding. Changing to 'Subjective'.")
                return "Subjective"
            return result
    except Exception as e:
        logger.warning(f"Failed to determine question type for topic '{topic}' using AI, defaulting to MCQ: {e}")
    
    # Default fallback
    return "MCQ"


async def get_relevant_question_types(skill: str) -> List[str]:
    """Determine relevant question types based on skill/domain (legacy function for backward compatibility)."""
    # Technical/coding skills that support all types including Pseudo Code
    technical_keywords = [
        "programming", "code", "coding", "developer", "software", "algorithm", 
        "data structure", "python", "java", "javascript", "c++", "c#", "react", 
        "node", "backend", "frontend", "fullstack", "database", "sql", "api",
        "framework", "library", "git", "docker", "kubernetes", "aws", "cloud"
    ]
    
    # Non-technical skills that don't need Pseudo Code
    non_technical_keywords = [
        "softskill", "soft skill", "communication", "leadership", "management",
        "teamwork", "presentation", "negotiation", "sales", "marketing", "hr",
        "human resources", "training", "coaching", "mentoring"
    ]
    
    skill_lower = skill.lower()
    
    # Check if it's a technical skill
    is_technical = any(keyword in skill_lower for keyword in technical_keywords)
    
    # Check if it's explicitly non-technical
    is_non_technical = any(keyword in skill_lower for keyword in non_technical_keywords)
    
    # Default question types for technical skills
    all_types = ["MCQ", "Subjective", "Pseudo Code", "Descriptive", "coding"]
    
    # If it's clearly non-technical, exclude Pseudo Code and coding
    if is_non_technical and not is_technical:
        return ["MCQ", "Subjective", "Descriptive"]
    
    # If it's technical or unclear, include all types including coding
    return all_types


async def generate_coding_question_for_topic(topic: str, difficulty: str, language_id: str) -> Dict[str, Any]:
    """
    Generate a coding question similar to DSA questions.
    Uses the DSA AI generator to create LeetCode-style questions.
    """
    # Validate language_id
    if not language_id:
        raise ValueError("Language ID is required for coding questions")
    
    # Map Judge0 language IDs to language names for DSA generator
    language_id_to_name = {
        "50": "c",
        "54": "cpp",
        "62": "java",
        "71": "python",
        "70": "python2",
        "63": "javascript",
        "74": "typescript",
        "68": "php",
        "72": "ruby",
        "83": "swift",
        "60": "go",
        "78": "kotlin",
        "73": "rust",
        "82": "sql",
        "51": "csharp",
        "84": "vbnet"
    }
    
    # Map difficulty format (Easy/Medium/Hard to easy/medium/hard)
    difficulty_map = {
        "Easy": "easy",
        "Medium": "medium",
        "Hard": "hard"
    }
    difficulty_lower = difficulty_map.get(difficulty, "medium")
    
    # Get language name from ID
    language_name = language_id_to_name.get(language_id)
    if not language_name:
        raise ValueError(f"Invalid language ID: {language_id}")
    
    # Import DSA generator (lazy import to avoid circular dependencies)
    # Use absolute import to avoid issues
    try:
        import importlib
        dsa_module = importlib.import_module("app.dsa.services.ai_generator")
        generate_dsa_question = dsa_module.generate_question
    except ImportError as e:
        logger.error(f"Failed to import DSA generator: {e}")
        raise ValueError(f"Failed to import DSA question generator: {e}") from e
    
    try:
        # Generate question using DSA generator
        question_data = await generate_dsa_question(
            difficulty=difficulty_lower,
            topic=topic,
            concepts=None,
            languages=[language_name]
        )
        
        # Validate that we got valid data
        if not question_data or not isinstance(question_data, dict):
            raise ValueError(f"Invalid question data returned from DSA generator: {type(question_data)}")
        
        # Convert DSA question format to assessment question format
        # Build questionText from description, examples, and constraints
        question_text_parts = [question_data.get("description", "")]
        
        # Add examples
        examples = question_data.get("examples", [])
        if examples:
            question_text_parts.append("\n\nExamples:")
            for i, ex in enumerate(examples, 1):
                ex_text = f"Example {i}:\nInput: {ex.get('input', '')}\nOutput: {ex.get('output', '')}"
                if ex.get('explanation'):
                    ex_text += f"\nExplanation: {ex.get('explanation')}"
                question_text_parts.append(ex_text)
        
        # Add constraints
        constraints = question_data.get("constraints", [])
        if constraints:
            question_text_parts.append("\n\nConstraints:")
            for constraint in constraints:
                question_text_parts.append(f"- {constraint}")
        
        question_text = "\n".join(question_text_parts)
        
        # Build the question object in assessment format
        question = {
            "questionText": question_text,
            "type": "coding",
            "difficulty": difficulty,
            "judge0_enabled": True,  # Always enabled for coding
            "language": language_id,
            # Store DSA-specific data for later use
            "coding_data": {
                "title": question_data.get("title", ""),
                "description": question_data.get("description", ""),
                "examples": examples,
                "constraints": constraints,
                "function_signature": question_data.get("function_signature"),
                "public_testcases": question_data.get("public_testcases", []),
                "hidden_testcases": question_data.get("hidden_testcases", []),
                "starter_code": question_data.get("starter_code", {}),
                "languages": question_data.get("languages", [])
            }
        }
        
        return question
    except ValueError as e:
        # Re-raise ValueError with more context
        error_msg = str(e)
        logger.error(f"Error generating coding question (ValueError): {error_msg}")
        raise ValueError(f"Failed to generate coding question: {error_msg}") from e
    except Exception as e:
        # Log full exception details
        logger.exception(f"Error generating coding question: {type(e).__name__}: {e}")
        # Re-raise with better error message
        raise Exception(f"Failed to generate coding question: {str(e)}") from e


async def generate_questions_for_topic(topic: str, config: Dict[str, Any], coding_supported: bool = True, experience_mode: str = "corporate") -> List[Dict[str, Any]]:
    num_questions = config.get("numQuestions")
    if not topic or not num_questions or num_questions <= 0:
        return []
    
    # Check if this is a coding question type
    question_type = config.get("Q1type", "Subjective")
    if question_type == "coding":
        # Validate that topic supports coding
        if not coding_supported:
            logger.warning(f"Coding question requested for topic '{topic}' which does not support coding. Skipping.")
            return []
        # Generate coding questions using DSA-style generation
        difficulty = config.get("Q1difficulty", "Medium")
        language_id = config.get("language")  # No default - must be specified
        
        # Language must be specified for coding questions
        if not language_id:
            logger.warning(f"Language not specified for coding question on topic: {topic}. Skipping generation.")
            return []
        
        questions = []
        for i in range(num_questions):
            try:
                coding_question = await generate_coding_question_for_topic(topic, difficulty, language_id)
                questions.append(coding_question)
            except ValueError as e:
                # Language validation error - skip this question
                logger.warning(f"Invalid language for coding question {i+1} on topic {topic}: {e}")
                continue
            except Exception as e:
                logger.error(f"Error generating coding question {i+1}: {e}")
                # Add fallback question only if we have a valid language_id
                if language_id:
                    questions.append({
                        "questionText": f"Write a program to solve a problem related to {topic}.",
                        "type": "coding",
                        "difficulty": difficulty,
                        "judge0_enabled": True,
                        "language": language_id,
                    })
        return questions

    question_config = []
    for i in range(1, num_questions + 1):
        q_type = config.get(f"Q{i}type", "Subjective")
        difficulty = config.get(f"Q{i}difficulty", "Easy")
        question_config.append({"type": q_type, "difficulty": difficulty})

    # Build detailed configuration list with paragraph requirements
    config_list_parts = []
    for idx, qc in enumerate(question_config):
        para_req = _get_paragraph_requirements(qc["difficulty"])
        config_list_parts.append(
            f"{idx + 1}. {qc['type']} ({qc['difficulty']}) - {para_req['description']}"
        )
    config_list = "; ".join(config_list_parts)

    # Build paragraph requirements description for the prompt
    para_requirements_text = "\n".join([
        f"- {difficulty}: {_get_paragraph_requirements(difficulty)['description']}"
        for difficulty in ["Easy", "Medium", "Hard"]
    ])

    # Determine if this is an aptitude topic based on topic name
    aptitude_topics = ["Quantitative", "Logical Reasoning", "Verbal Ability", "Numerical Reasoning"]
    is_aptitude = any(apt_topic.lower() in topic.lower() for apt_topic in aptitude_topics)
    
    # Check if all questions are MCQ (indicates aptitude)
    all_mcq = all(config.get(f"Q{i}type", "") == "MCQ" for i in range(1, num_questions + 1))
    is_aptitude = is_aptitude or all_mcq
    
    question_type_label = "aptitude" if is_aptitude else "technical"
    
    # Context for scenario-based subjective questions
    mode_context = ""
    if experience_mode == "student" or experience_mode == "college":
        mode_context = "\n\nCONTEXT FOR SUBJECTIVE QUESTIONS: This assessment is for college students. When generating subjective questions, use scenarios related to academic projects, mini-projects, lab tasks, internships, or programming assignments."
    else:
        mode_context = "\n\nCONTEXT FOR SUBJECTIVE QUESTIONS: This assessment is for corporate/professional candidates. When generating subjective questions, use scenarios related to production systems, debugging real issues, business workflows, system design choices, team collaboration, or customer-facing problems."
    
    prompt = f"""
You are an expert assessment writer with years of experience creating high-quality technical and aptitude assessments. 
Generate {num_questions} high-quality {question_type_label} questions for the topic "{topic}".{mode_context}

CRITICAL REQUIREMENTS - READ CAREFULLY:

QUESTION CONFIGURATION:
{config_list}

PARAGRAPH REQUIREMENTS BY DIFFICULTY (STRICT - MUST FOLLOW):
{para_requirements_text}

QUALITY STANDARDS (MANDATORY):
1. **Question Authenticity**: 
   - Questions must be realistic and reflect real-world scenarios or professional contexts
   - Avoid generic or overly simplistic questions
   - Each question should test genuine understanding, not just memorization

2. **Question Variety**:
   - Mix DIRECT questions (straightforward, test core knowledge) with SCENARIO-BASED questions (realistic professional situations)
   - Vary the complexity and approach - do NOT make all questions identical in style
   - Include practical, application-based questions that test problem-solving skills

3. **Difficulty Appropriateness**:
   - Easy: Test fundamental concepts, basic understanding. Questions should be solvable with foundational knowledge.
   - Medium: Require analysis, comparison, or application of concepts. Moderate complexity.
   - Hard: Test deep understanding, complex problem-solving, or advanced concepts. Require critical thinking.

4. **Paragraph Structure (STRICT)**:
   - Easy: EXACTLY 1 paragraph - concise, clear, and to the point
   - Medium: EXACTLY 2 paragraphs - first paragraph sets context, second presents the question
   - Hard: EXACTLY 3 paragraphs - comprehensive context, detailed scenario, and clear question

QUESTION FORMAT REQUIREMENTS:
Each question MUST be a valid JSON object with these exact fields:
- questionText (string): The question text following paragraph requirements above
- type (string): Must match exactly - "MCQ", "Subjective", "Pseudo Code", "Descriptive", "Aptitude", "Reasoning", or "coding"
- difficulty (string): Must match exactly - "Easy", "Medium", or "Hard"
- idealAnswer (string, required for Subjective/Descriptive): Comprehensive answer (2-3 paragraphs for Medium/Hard, 1-2 for Easy)
- expectedLogic (string, required for Pseudo Code): Detailed step-by-step logic explanation
- options (array of strings, required for MCQ): Exactly 4-5 realistic, plausible options
- correctAnswer (string, required for MCQ): The correct option letter (e.g., "A", "B", "C", "D", "E")

SPECIFIC QUESTION TYPE REQUIREMENTS:

MCQ Questions:
- Provide exactly 4-5 options (preferably 4 for clarity)
- Options must be plausible and test deep understanding
- Only ONE option should be clearly correct
- Options should be similar in length and structure
- For aptitude: Focus on numerical reasoning, logical thinking, verbal ability, problem-solving
- Avoid obviously wrong options - make all options credible

Subjective Questions (CRITICAL - MUST BE SCENARIO-BASED):
- You MUST generate a scenario-based subjective question
- The question should describe a real situation, system behavior, business case, technical issue, or applied use case tied directly to the topic
- The candidate must analyze, justify choices, propose solutions, identify problems, compare approaches, or evaluate outcomes
- NEVER create simple definition-level questions
- NEVER create "Explain X" type questions without a scenario
- Each question MUST include:
  - questionText: Scenario description with the question
  - idealAnswer: Comprehensive answer addressing the scenario
  - expectedKeyPoints: Array of 3-5 key points that should be covered (e.g., ["key point 1", "key point 2", "key point 3"])
  - wordLimit: Integer between 150-250 words indicating expected answer length
- Difficulty mapping:
  - Easy: Short scenario, simple decision or basic analysis
  - Medium: Multi-step scenario with constraints or trade-offs requiring analysis
  - Hard: Complex real-world scenario with multiple stakeholders or constraints requiring deep analysis
- Context-aware scenarios based on assessment mode:
  - If assessmentMode = "college" or experience_mode = "student": Scenarios should relate to academic projects, mini-projects, lab tasks, internships, programming assignments
  - If assessmentMode = "corporate" or experience_mode = "corporate": Scenarios should relate to production systems, debugging real issues, business workflows, system design choices, team collaboration, customer-facing problems
- idealAnswer should be 2-3 paragraphs for Medium/Hard, 1-2 for Easy

Pseudo Code Questions:
- Require algorithm design or logical problem-solving
- expectedLogic must provide detailed step-by-step explanation
- Should test logical thinking and problem-solving approach

Descriptive Questions:
- Test ability to explain concepts clearly
- idealAnswer should be comprehensive and well-organized
- Should demonstrate deep understanding of the topic

Aptitude Questions (if applicable):
- MUST be MCQ format only
- Focus on numerical reasoning, logical thinking, verbal ability, or problem-solving
- Test analytical and reasoning capabilities
- Should be realistic and practical

Reasoning Questions:
- Test logical reasoning, analytical thinking, or pattern recognition
- Can be MCQ or Subjective format
- Should require critical thinking

OUTPUT FORMAT:
You MUST output a valid JSON array containing exactly {num_questions} question objects.
Each question object must be complete with all required fields based on its type.

EXAMPLE STRUCTURE (DO NOT COPY, USE AS REFERENCE):
[
  {{
    "questionText": "Paragraph 1 for context.\\n\\nParagraph 2 with the actual question?",
    "type": "MCQ",
    "difficulty": "Medium",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "B"
  }},
  {{
    "questionText": "Scenario description with the question for easy difficulty?",
    "type": "Subjective",
    "difficulty": "Easy",
    "idealAnswer": "Comprehensive answer addressing the scenario...",
    "expectedKeyPoints": ["key point 1", "key point 2", "key point 3"],
    "wordLimit": 200
  }}
]

CRITICAL REMINDERS:
- Generate EXACTLY {num_questions} questions
- Follow paragraph requirements STRICTLY (1 for Easy, 2 for Medium, 3 for Hard)
- Ensure all required fields are present based on question type
- Make questions high-quality, realistic, and professionally relevant
- Vary question styles (mix direct and scenario-based)
- Output ONLY valid JSON - no markdown, no explanations, just the JSON array
"""

    client = _get_client()
    max_retries = 3
    last_error = None
    
    for attempt in range(max_retries):
        try:
            # Calculate tokens based on difficulty levels
            # Easy: 1 paragraph (~200 tokens), Medium: 2 paragraphs (~400 tokens), Hard: 3 paragraphs (~600 tokens)
            # Plus answers: Easy (~200), Medium (~400), Hard (~600)
            max_tokens_per_question = {
                "Easy": 600,   # 1 para question + answer
                "Medium": 1000,  # 2 para question + answer
                "Hard": 1600   # 3 para question + answer
            }
            
            # Calculate total tokens needed
            total_tokens = 0
            for qc in question_config:
                total_tokens += max_tokens_per_question.get(qc["difficulty"], 1000)
            total_tokens += 1000  # Buffer for JSON structure and formatting
            
            # Use gpt-4o-mini for better quality, with higher token limit
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert assessment writer. Always output valid JSON arrays. Never include markdown code blocks or explanations outside the JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=min(total_tokens, 8000),  # Increased cap for better quality
            )
            break  # Success, exit retry loop
        except Exception as exc:  # pragma: no cover - external API
            last_error = exc
            if attempt < max_retries - 1:
                # Wait before retry (exponential backoff)
                await asyncio.sleep(2 ** attempt)
                continue
            else:
                raise HTTPException(status_code=500, detail=f"Failed to generate questions after {max_retries} attempts: {str(exc)}") from exc

    raw = response.choices[0].message.content.strip() if response.choices else ""
    
    # Clean up markdown code blocks if present
    if raw.startswith("```json"):
        raw = raw[7:]  # Remove ```json
    elif raw.startswith("```"):
        raw = raw[3:]  # Remove ```
    if raw.endswith("```"):
        raw = raw[:-3]  # Remove trailing ```
    raw = raw.strip()

    parsed: Any = None
    questions: List[Dict[str, Any]] = []
    
    # Try parsing as JSON
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON array from text
        if "[" in raw and "]" in raw:
            start_idx = raw.find("[")
            end_idx = raw.rfind("]") + 1
            try:
                parsed = json.loads(raw[start_idx:end_idx])
            except json.JSONDecodeError:
                pass
    
    # Parse the result
    if parsed is None:
        # Last resort: try to find and parse individual question objects
        json_objects = re.findall(r'\{[^{}]*"questionText"[^{}]*\}', raw, re.DOTALL)
        for obj_str in json_objects:
            try:
                obj = json.loads(obj_str)
                if isinstance(obj, dict) and obj.get("questionText"):
                    questions.append(obj)
            except json.JSONDecodeError:
                continue
    elif isinstance(parsed, list):
        questions = [q for q in parsed if isinstance(q, dict) and q.get("questionText")]
    elif isinstance(parsed, dict):
        # Check if it's a wrapper object
        if "questions" in parsed and isinstance(parsed["questions"], list):
            questions = [q for q in parsed["questions"] if isinstance(q, dict) and q.get("questionText")]
        elif parsed.get("questionText"):
            questions = [parsed]
        # Check for array-like structure in values
        elif any(isinstance(v, list) for v in parsed.values()):
            for v in parsed.values():
                if isinstance(v, list):
                    questions.extend([q for q in v if isinstance(q, dict) and q.get("questionText")])
                    break

    # Validate and clean questions
    validated_questions = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        if not q.get("questionText"):
            continue
        
        # Ensure required fields based on type
        q_type = q.get("type", "").strip()
        q["type"] = q_type
        q["difficulty"] = q.get("difficulty", "Medium").strip()
        
        # Validate MCQ questions have options and correctAnswer
        if q_type == "MCQ":
            if not q.get("options") or not isinstance(q.get("options"), list) or len(q.get("options", [])) < 2:
                continue  # Skip invalid MCQ
            if not q.get("correctAnswer"):
                # Try to infer from options
                if q.get("options"):
                    q["correctAnswer"] = "A"  # Default to first option
                else:
                    continue
        
        # Validate Subjective/Descriptive have idealAnswer
        if q_type in ["Subjective", "Descriptive"]:
            if not q.get("idealAnswer"):
                q["idealAnswer"] = "Answer not provided."
        
        # Validate Pseudo Code has expectedLogic
        if q_type == "Pseudo Code":
            if not q.get("expectedLogic"):
                q["expectedLogic"] = "Logic explanation not provided."
        
        # For coding questions, always set judge0_enabled to true and language if provided
        if q_type == "coding":
            q["judge0_enabled"] = True  # Always enabled for coding
            if "language" in config:
                q["language"] = config.get("language")
        
        validated_questions.append(q)
    
    return validated_questions


async def suggest_time_and_score(question: Dict[str, Any]) -> Dict[str, Any]:
    """Suggest time (in minutes) and score for a question based on its type and difficulty."""
    question_type = question.get("type", "Subjective")
    difficulty = question.get("difficulty", "Medium")
    question_text = question.get("questionText", "")
    
    prompt = f"""
You are an expert assessment evaluator. Based on the following question, suggest appropriate time (in minutes) and score (points).

Question Type: {question_type}
Difficulty: {difficulty}
Question: {question_text[:200]}...

Provide your suggestion in the following format:
- Time: [number] minutes (considering the question type and difficulty)
- Score: [number] points (considering the question complexity and importance)

Guidelines:
- MCQ questions: Usually 1-3 minutes, 1-2 points
- Subjective questions: 5-15 minutes, 3-10 points depending on difficulty
- Pseudo Code questions: 10-20 minutes, 5-15 points depending on difficulty
- Descriptive questions: 10-20 minutes, 5-15 points depending on difficulty
- Easy difficulty: Lower time and score
- Medium difficulty: Moderate time and score
- Hard difficulty: Higher time and score

Respond ONLY with a JSON object in this exact format:
{{"time": <number>, "score": <number>}}
"""

    client = _get_client()
    try:
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
    except Exception as exc:
        # Fallback to default values
        defaults = {
            "MCQ": {"time": 2, "score": 1},
            "Subjective": {"time": 10, "score": 5},
            "Pseudo Code": {"time": 15, "score": 10},
            "Descriptive": {"time": 15, "score": 10},
        }
        difficulty_multiplier = {"Easy": 0.7, "Medium": 1.0, "Hard": 1.5}
        base = defaults.get(question_type, {"time": 10, "score": 5})
        multiplier = difficulty_multiplier.get(difficulty, 1.0)
        return {
            "time": int(base["time"] * multiplier),
            "score": int(base["score"] * multiplier),
        }
    
    text = response.choices[0].message.content.strip() if response.choices else ""
    
    # Try to parse JSON from response
    try:
        import json
        # Extract JSON from text
        if "{" in text and "}" in text:
            start = text.find("{")
            end = text.rfind("}") + 1
            parsed = json.loads(text[start:end])
            if "time" in parsed and "score" in parsed:
                return {"time": int(parsed["time"]), "score": int(parsed["score"])}
    except:
        pass
    
    # Fallback
    defaults = {
        "MCQ": {"time": 2, "score": 1},
        "Subjective": {"time": 10, "score": 5},
        "Pseudo Code": {"time": 15, "score": 10},
        "Descriptive": {"time": 15, "score": 10},
    }
    difficulty_multiplier = {"Easy": 0.7, "Medium": 1.0, "Hard": 1.5}
    base = defaults.get(question_type, {"time": 10, "score": 5})
    multiplier = difficulty_multiplier.get(difficulty, 1.0)
    return {
        "time": int(base["time"] * multiplier),
        "score": int(base["score"] * multiplier),
    }


async def generate_questions_for_topic_safe(topic: str, config: Dict[str, Any], coding_supported: bool = True) -> List[Dict[str, Any]]:
    try:
        result = await generate_questions_for_topic(topic, config, coding_supported)
        return result if isinstance(result, list) else []
    except HTTPException:
        raise
    except Exception:  # pragma: no cover - guard for unexpected errors
        return []
