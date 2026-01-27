"""
Module: ai_utils.py
Purpose: Core utility functions for AI operations

This module provides shared utilities used across all AI generators.
It handles OpenAI client management, JSON parsing, URL processing,
and deterministic topic classification.

Dependencies:
- External: openai, fastapi, httpx (optional), urllib.parse
- Internal: prompt_templates (for constants)
- NO dependencies on other service modules (prevents circular imports)

Example usage:
    ```python
    from app.api.v1.assessments.services.ai_utils import get_openai_client, parse_json_response
    
    client = get_openai_client()
    response = await client.chat.completions.create(...)
    content = parse_json_response(response.choices[0].message.content)
    ```

Note: This module has NO dependencies on other service modules
to prevent circular imports. It's safe to import from anywhere.
"""
from __future__ import annotations

import json
import logging
import re
import string
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import HTTPException

try:
    import httpx
except ImportError:
    httpx = None

try:
    from openai import AsyncOpenAI, APIError, APIConnectionError, AuthenticationError, RateLimitError
except ImportError:
    AsyncOpenAI = None
    APIError = None
    APIConnectionError = None
    AuthenticationError = None
    RateLimitError = None

from .....core.config import get_settings
from .prompt_templates import (
    V2_AIML_KEYWORDS,
    V2_AIML_THEORY_KEYWORDS,
    V2_AIML_EXECUTION_KEYWORDS,
    V2_SQL_INDICATOR_PATTERNS,
    V2_SQL_THEORY_KEYWORDS,
    V2_SQL_EXECUTION_KEYWORDS,
)

logger = logging.getLogger(__name__)


# ============================================================================
# OPENAI CLIENT MANAGEMENT
# ============================================================================

# Moved from topic_service_v2.py:934-940
def _get_openai_client() -> AsyncOpenAI:
    """Get OpenAI client instance."""
    settings = get_settings()
    api_key = getattr(settings, 'openai_api_key', None)
    if not api_key:
        raise ValueError("OpenAI API key not configured")
    return AsyncOpenAI(api_key=api_key)


# Moved from topic_service_v2.py:496-568
def _build_openai_payload(
    model: str,
    messages: List[Dict[str, str]],
    temperature: float = 0.7,
    top_p: float = 1.0,
    max_tokens: Optional[int] = None,
    max_completion_tokens: Optional[int] = None,
    frequency_penalty: float = 0.0,
    presence_penalty: float = 0.0,
    **kwargs
) -> Dict[str, Any]:
    """
    Build OpenAI API payload, excluding unsupported parameters for o3-mini and o1-mini models.
    
    o3-mini and o1-mini do NOT support:
    - temperature
    - top_p
    - frequency_penalty
    - presence_penalty
    
    They also require max_completion_tokens instead of max_tokens.
    
    Args:
        model: The model name (e.g., "o3-mini", "gpt-4o-mini")
        messages: List of message dicts
        temperature: Temperature parameter (ignored for o3-mini/o1-mini)
        top_p: Top-p parameter (ignored for o3-mini/o1-mini)
        max_tokens: Max tokens (converted to max_completion_tokens for o3-mini/o1-mini)
        max_completion_tokens: Max completion tokens (used directly for o3-mini/o1-mini)
        frequency_penalty: Frequency penalty (ignored for o3-mini/o1-mini)
        presence_penalty: Presence penalty (ignored for o3-mini/o1-mini)
        **kwargs: Additional parameters
    
    Returns:
        Dict with OpenAI API payload
    """
    payload = {
        "model": model,
        "messages": messages,
    }
    
    # o3-mini and o1-mini don't support sampling parameters
    if model not in ["o3-mini", "o1-mini"]:
        payload["temperature"] = temperature
        payload["top_p"] = top_p
        if frequency_penalty != 0.0:
            payload["frequency_penalty"] = frequency_penalty
        if presence_penalty != 0.0:
            payload["presence_penalty"] = presence_penalty
    
    # Handle max_tokens vs max_completion_tokens
    if model in ["o3-mini", "o1-mini"]:
        if max_completion_tokens is not None:
            payload["max_completion_tokens"] = max_completion_tokens
        elif max_tokens is not None:
            payload["max_completion_tokens"] = max_tokens
    else:
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
    
    # Add any additional kwargs
    payload.update(kwargs)
    
    # Debug logging to confirm temperature is removed for o3-mini/o1-mini
    if model in ["o3-mini", "o1-mini"]:
        logger.debug(f"Payload for model {model} (no sampling params): {payload}")
        # Verify temperature is NOT in payload
        if "temperature" in payload or "top_p" in payload or "frequency_penalty" in payload or "presence_penalty" in payload:
            logger.warning(f"WARNING: Sampling parameters found in payload for {model} - this should not happen!")
    else:
        logger.debug(f"Payload for model {model}: {payload}")
    
    return payload


# ============================================================================
# JSON PARSING
# ============================================================================

# Moved from topic_service_v2.py:571-708
def _parse_json_response(content: str, error_context: str = "JSON") -> Any:
    """
    Robustly parse JSON from OpenAI response, handling markdown code blocks and control characters.
    
    Args:
        content: Raw content from OpenAI response
        error_context: Context string for error messages
        
    Returns:
        Parsed JSON object (usually a list)
        
    Raises:
        HTTPException: If JSON parsing fails after all attempts
    """
    # Remove markdown code blocks if present
    if content.startswith("```"):
        parts = content.split("```")
        if len(parts) > 1:
            # Take the content between first ``` and last ```
            content = "```".join(parts[1:-1]) if len(parts) > 2 else parts[1]
            # Remove language identifier if present
            if content.startswith("json"):
                content = content[4:]
            elif content.startswith("JSON"):
                content = content[4:]
        content = content.strip()
    
    # First, try to parse as-is
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass  # Continue to cleaning steps
    
    # Clean control characters and escape unescaped newlines in string values
    # The issue is that OpenAI sometimes returns JSON with unescaped newlines in strings
    # We need to escape newlines within string values (between quotes)
    cleaned_content = ""
    i = 0
    in_string = False
    escape_next = False
    
    while i < len(content):
        char = content[i]
        char_code = ord(char)
        
        # Track if we're inside a string (between unescaped quotes)
        if not escape_next:
            if char == '"':
                # Check if this quote is escaped (count backslashes before it)
                backslash_count = 0
                j = i - 1
                while j >= 0 and content[j] == '\\':
                    backslash_count += 1
                    j -= 1
                # If even number of backslashes, quote is not escaped
                if backslash_count % 2 == 0:
                    in_string = not in_string
                cleaned_content += char
                i += 1
                continue
            elif char == '\\':
                escape_next = True
                cleaned_content += char
                i += 1
                continue
        
        # Reset escape flag after processing escaped character
        if escape_next:
            escape_next = False
            cleaned_content += char
            i += 1
            continue
        
        # If we're inside a string, escape unescaped newlines and control chars
        if in_string:
            # Check if this character is escaped
            is_escaped = False
            if i > 0:
                backslash_count = 0
                j = i - 1
                while j >= 0 and content[j] == '\\':
                    backslash_count += 1
                    j -= 1
                is_escaped = (backslash_count % 2 == 1)
            
            if not is_escaped:
                if char == '\n':
                    # Escape unescaped newline
                    cleaned_content += '\\n'
                elif char == '\r':
                    # Escape unescaped carriage return
                    cleaned_content += '\\r'
                elif char == '\t':
                    # Escape unescaped tab
                    cleaned_content += '\\t'
                elif char_code < 32:
                    # Replace other control characters with space
                    cleaned_content += ' '
                else:
                    cleaned_content += char
            else:
                # Character is already escaped, keep as-is
                cleaned_content += char
        else:
            # Outside strings, allow printable characters and whitespace
            if char in string.printable or char in '\n\r\t ':
                cleaned_content += char
            elif char_code < 32:
                cleaned_content += ' '
            else:
                cleaned_content += char
        
        i += 1
    
    # Try to parse cleaned JSON
    try:
        return json.loads(cleaned_content)
    except json.JSONDecodeError as json_err:
        # If still failing, try to extract JSON array using regex as fallback
        json_match = re.search(r'\[.*\]', cleaned_content, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError as e2:
                logger.error(f"{error_context} parsing failed even after regex extraction. Error: {e2}")
                logger.error(f"Content preview (first 500 chars): {cleaned_content[:500]}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to parse {error_context}. Please try regenerating."
                ) from e2
        else:
            logger.error(f"{error_context} parsing failed. Error: {json_err}")
            logger.error(f"Content preview (first 500 chars): {cleaned_content[:500]}")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to parse {error_context}. Please try regenerating."
            ) from json_err


# ============================================================================
# URL PROCESSING
# ============================================================================

# Moved from topic_service_v2.py:1459-1484
def _is_url(text: str) -> bool:
    """
    Check if the given text is a URL.
    
    Args:
        text: Text to check
        
    Returns:
        True if text is a URL, False otherwise
    """
    if not text or not isinstance(text, str):
        return False
    
    text = text.strip()
    if not text:
        return False
    
    # Check if it starts with http:// or https://
    if text.startswith(("http://", "https://")):
        try:
            result = urlparse(text)
            return all([result.scheme, result.netloc])
        except Exception:
            return False
    
    return False


# Moved from topic_service_v2.py:1487-1541
async def _fetch_and_summarize_url(url: str) -> str:
    """
    Fetch content from URL and summarize it using OpenAI.
    
    Args:
        url: URL to fetch and summarize
        
    Returns:
        Summarized text from the URL
    """
    if not httpx:
        logger.error("httpx not available, cannot fetch URL")
        raise HTTPException(status_code=500, detail="URL fetching not available")
    
    try:
        # Fetch URL content
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, max_redirects=5) as client:
            response = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            response.raise_for_status()
            content = response.text
        
        # Limit content length to avoid token limits (first 10000 characters)
        content_preview = content[:10000] if len(content) > 10000 else content
        
        # Summarize using OpenAI
        client = _get_openai_client()
        summarize_prompt = f"""Please summarize the following content from a webpage. 
Extract the key information, main points, and important details that would be useful for generating technical assessment questions.

Content:
{content_preview}

Provide a concise but comprehensive summary (200-500 words) that captures the essential information:"""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at summarizing technical content. Provide clear, concise summaries that capture key information."
                },
                {"role": "user", "content": summarize_prompt}
            ],
            temperature=0.3,
        )
        
        summary = response.choices[0].message.content.strip()
        logger.info(f"Successfully fetched and summarized URL: {url[:50]}...")
        return summary
        
    except Exception as exc:
        logger.error(f"Error fetching or summarizing URL {url}: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch or summarize URL: {str(exc)}") from exc


# Moved from topic_service_v2.py:1544-1573
async def _process_requirements_for_subjective(requirements: Optional[str]) -> Optional[str]:
    """
    Process requirements text for subjective question generation.
    - If it's a URL, fetch and summarize it
    - If it's plain text, use it directly
    
    Args:
        requirements: Requirements text or URL
        
    Returns:
        Processed requirements text (summarized if URL, original if text, None if empty)
    """
    if not requirements or not requirements.strip():
        return None
    
    requirements = requirements.strip()
    
    # Check if it's a URL
    if _is_url(requirements):
        logger.info(f"Detected URL in requirements, fetching and summarizing: {requirements[:50]}...")
        try:
            summarized = await _fetch_and_summarize_url(requirements)
            return summarized
        except Exception as exc:
            logger.warning(f"Failed to fetch/summarize URL, using URL as-is: {exc}")
            # Fallback: return a note about the URL
            return f"Reference URL: {requirements}"
    
    # It's plain text, use it directly
    return requirements


# ============================================================================
# DETERMINISTIC CLASSIFIERS
# ============================================================================

# Moved from topic_service_v2.py:238-239
def _v2_contains_any(haystack: str, needles: List[str]) -> bool:
    return any(n in haystack for n in needles)


# Moved from topic_service_v2.py:241-264
def _v2_is_sql_topic(text: str) -> bool:
    for pat in V2_SQL_INDICATOR_PATTERNS:
        if re.search(pat, text):
            return True
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
    hits = 0
    for pat in sql_op_patterns:
        if re.search(pat, text):
            hits += 1
            if hits >= 2:
                return True
    return False


# Moved from topic_service_v2.py:266-287
def _v2_is_sql_execution_topic(text: str) -> bool:
    if not _v2_is_sql_topic(text):
        return False
    if _v2_contains_any(text, V2_SQL_THEORY_KEYWORDS):
        return False
    if _v2_contains_any(text, V2_SQL_EXECUTION_KEYWORDS):
        return True
    # If it contains strong SQL op context (e.g., SELECT...FROM) treat as execution
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
    return any(re.search(pat, text) for pat in sql_op_patterns)


# Moved from topic_service_v2.py:289-294
def _v2_is_aiml_execution_topic(text: str) -> bool:
    if not _v2_contains_any(text, V2_AIML_KEYWORDS):
        return False
    if _v2_contains_any(text, V2_AIML_THEORY_KEYWORDS):
        return False
    return _v2_contains_any(text, V2_AIML_EXECUTION_KEYWORDS)


# ============================================================================
# EXPERIENCE LEVEL HELPERS
# ============================================================================

def _get_experience_level_corporate(experience_min: int, experience_max: int) -> tuple[str, str]:
    """
    Get corporate experience level and guidance.
    
    Args:
        experience_min: Minimum years of experience
        experience_max: Maximum years of experience
        
    Returns:
        Tuple of (level_name, guidance_text)
    """
    # Moved from services.py:151-165
    if experience_min == 0 and experience_max <= 1:
        return ("Junior", """For junior positions (0-1 years), focus on ROLE-SPECIFIC fundamental skills:
        - Include the PRIMARY technology/language mentioned in the job designation (e.g., for "Java Developer" include Java, Spring, Maven, etc.)
        - Include essential tools and frameworks directly related to the role
        - Include fundamental concepts specific to that technology stack
        - DO NOT include unrelated technologies (e.g., don't include Python/HTML/CSS for a Java Developer role unless it's a full-stack role)
        - Only include technologies that are directly relevant to the specific job designation""")
    elif experience_min <= 1 and experience_max <= 3:
        return ("Mid-level", "Include role-specific technologies AND related intermediate-level frameworks, tools, and libraries. Focus on technologies actually used in this specific role, not general programming skills.")
    elif experience_min <= 3 and experience_max <= 6:
        return ("Senior", "Include advanced role-specific technologies, architectural patterns, enterprise tools, cloud platforms, and DevOps tools relevant to this specific role.")
    else:
        return ("Expert", "Include cutting-edge role-specific technologies, advanced architectural patterns, enterprise solutions, and technologies for building large-scale systems in this domain.")


def _get_experience_level_student(experience_min: int, experience_max: int) -> tuple[str, str]:
    """
    Get student experience level and guidance based on three stages: Beginner, Intermediate, Advanced.
    
    Args:
        experience_min: Minimum years of experience
        experience_max: Maximum years of experience
        
    Returns:
        Tuple of (level_name, guidance_text)
    """
    # Moved from services.py:168-194
    avg_level = (experience_min + experience_max) / 2

    if avg_level < 1.5:
        return ("Beginner",
                "Beginner-level students should receive foundational and easy-to-learn skills. "
                "Include basic programming concepts, introductory tools, and fundamental academic topics. "
                "Skills should be simple, conceptual, and suitable for early academic progression. "
                "Do NOT include any advanced frameworks, enterprise-level technologies, or production tools.")

    elif avg_level < 3:
        return ("Intermediate",
                "Intermediate students should receive moderate-complexity academic skills. "
                "Include technologies and concepts typically found in intermediate college courses. "
                "Focus on bridging foundational concepts to applied skills. "
                "Allow introductory frameworks only at a beginner-friendly level. "
                "Avoid enterprise tools or production systems unless mentioned at a very basic conceptual level.")

    else:
        return ("Advanced",
                "Advanced students should receive academically advanced and internship-ready skills. "
                "Include deeper concepts, applied tools, and project-development capabilities. "
                "Industry tools may be mentioned only at an academic or conceptual level. "
                "Do NOT include enterprise-level or production-focused systems. "
                "Focus on preparing students for internships, final-year projects, and practical applications.")

