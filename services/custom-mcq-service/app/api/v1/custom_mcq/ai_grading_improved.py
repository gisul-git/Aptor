"""
Improved AI Grading Module for Subjective Questions
Enhanced version with better reliability, rubrics, and detailed feedback
"""
from __future__ import annotations

import logging
import json
import os
from typing import Dict, Any, List, Optional
from openai import AsyncOpenAI

from ....config.settings import get_settings

logger = logging.getLogger(__name__)


def _get_openai_client() -> AsyncOpenAI:
    """Get OpenAI client instance."""
    settings = get_settings()
    # Check settings first, then fallback to environment variable
    api_key = getattr(settings, 'openai_api_key', None) or os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OpenAI API key not configured. Set OPENAI_API_KEY environment variable or configure openai_api_key in settings.")
    return AsyncOpenAI(api_key=api_key)


async def grade_subjective_answer_improved(
    question: str,
    answer: str,
    max_marks: int,
    section: Optional[str] = None,
    rubric: Optional[str] = None,
    answer_key: Optional[str] = None,
    grading_style: str = "balanced"  # "strict", "balanced", "lenient"
) -> Dict[str, Any]:
    """
    Improved version: Grade a subjective answer using OpenAI with enhanced features.
    
    Args:
        question: The question text
        answer: The candidate's answer
        max_marks: Maximum marks for this question
        section: Optional section name for context
        rubric: Optional grading rubric or criteria
        answer_key: Optional ideal answer or key points
        grading_style: "strict", "balanced", or "lenient"
    
    Returns:
        Dict with:
            - score: float (marks awarded)
            - percentage: float (score as percentage of max_marks)
            - feedback: str (AI-generated feedback)
            - reasoning: str (AI's reasoning for the score)
            - criteria_scores: dict (breakdown by evaluation criteria)
            - confidence: float (AI's confidence in the score, 0-1)
    """
    try:
        client = _get_openai_client()
        
        # Grading style instructions
        style_instructions = {
            "strict": "Be very strict. Award full marks only for exceptional, comprehensive answers. Deduct marks heavily for minor errors or omissions.",
            "balanced": "Be fair but thorough. Award full marks for excellent and comprehensive answers. Deduct marks appropriately for errors or omissions.",
            "lenient": "Be generous but fair. Award marks for demonstrating understanding, even if not perfect. Focus on what the candidate got right."
        }
        
        # Build enhanced prompt
        section_context = f"Section: {section}\n" if section else ""
        rubric_context = f"\nGrading Rubric:\n{rubric}\n" if rubric else ""
        answer_key_context = f"\nKey Points to Look For:\n{answer_key}\n" if answer_key else ""
        
        prompt = f"""You are an expert evaluator grading a subjective answer. Please evaluate the following answer and provide a detailed assessment.

{section_context}Question: {question}

Candidate's Answer: {answer}

Maximum Marks: {max_marks}
{rubric_context}{answer_key_context}
Grading Style: {style_instructions.get(grading_style, style_instructions["balanced"])}

Please evaluate the answer based on these criteria (weight each equally):
1. **Accuracy and Correctness** (20%): Is the information factually correct? Are there any errors?
2. **Completeness** (20%): Does the answer address all parts of the question? Are key points covered?
3. **Clarity and Coherence** (20%): Is the answer well-structured and easy to understand?
4. **Depth of Understanding** (20%): Does the answer demonstrate deep understanding or just surface knowledge?
5. **Relevance** (20%): Is the answer directly relevant to the question? Is there irrelevant content?

Provide your evaluation in the following JSON format (use JSON mode):
{{
    "score": <number between 0 and {max_marks}, can be decimal>,
    "criteria_scores": {{
        "accuracy": <0-1 score>,
        "completeness": <0-1 score>,
        "clarity": <0-1 score>,
        "depth": <0-1 score>,
        "relevance": <0-1 score>
    }},
    "feedback": "<constructive, specific feedback for the candidate - 2-3 sentences>",
    "reasoning": "<brief explanation of why this score was awarded - 1-2 sentences>",
    "strengths": ["<key strength 1>", "<key strength 2>"],
    "improvements": ["<area for improvement 1>", "<area for improvement 2>"],
    "confidence": <0-1, how confident you are in this evaluation>
}}

Guidelines:
- Score should reflect the overall quality relative to maximum marks
- Be specific in feedback - mention what was good and what could be improved
- Confidence should be lower if the answer is ambiguous or partially correct
- If answer is completely wrong or irrelevant, score should be near 0
- If answer is excellent and comprehensive, score should be near maximum

Return ONLY valid JSON, no additional text."""

        # Use JSON mode for more reliable parsing (if supported)
        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert evaluator. Always respond with valid JSON only. Use JSON mode."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=800,  # Increased for more detailed feedback
                response_format={"type": "json_object"}  # JSON mode for reliability
            )
        except Exception as e:
            # Fallback if JSON mode not supported
            logger.warning(f"JSON mode not supported, using standard mode: {e}")
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert evaluator. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=800,
            )
        
        # Parse response
        content = response.choices[0].message.content.strip()
        
        # Try to extract JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            # Fallback: try to extract JSON object from text
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                raise ValueError("Could not parse AI response as JSON")
        
        # Extract and validate score
        score = float(result.get("score", 0))
        score = max(0, min(score, max_marks))
        
        # Extract criteria scores
        criteria_scores = result.get("criteria_scores", {})
        if not isinstance(criteria_scores, dict):
            criteria_scores = {}
        
        # Extract confidence
        confidence = float(result.get("confidence", 0.8))
        confidence = max(0, min(confidence, 1))
        
        percentage = (score / max_marks * 100) if max_marks > 0 else 0
        
        return {
            "score": round(score, 2),
            "percentage": round(percentage, 2),
            "feedback": result.get("feedback", "No feedback provided"),
            "reasoning": result.get("reasoning", "No reasoning provided"),
            "criteria_scores": criteria_scores,
            "strengths": result.get("strengths", []),
            "improvements": result.get("improvements", []),
            "confidence": round(confidence, 2),
        }
        
    except Exception as e:
        logger.exception(f"Error grading subjective answer: {e}")
        return {
            "score": 0.0,
            "percentage": 0.0,
            "feedback": f"Error during AI grading: {str(e)}",
            "reasoning": "Could not evaluate answer due to technical error",
            "criteria_scores": {},
            "strengths": [],
            "improvements": [],
            "confidence": 0.0,
        }


# Comparison: Current vs Improved
"""
CURRENT IMPLEMENTATION:
✅ Works well for basic grading
✅ Cost-effective
✅ Provides feedback
⚠️ Limited detail in evaluation
⚠️ No rubric support
⚠️ No confidence scores
⚠️ No criteria breakdown

IMPROVED VERSION:
✅ JSON mode for reliability
✅ Detailed criteria breakdown
✅ Rubric and answer key support
✅ Confidence scores
✅ Strengths/improvements list
✅ Customizable grading styles
✅ More detailed feedback
⚠️ Slightly more expensive (more tokens)
⚠️ Requires OpenAI API with JSON mode support
"""

