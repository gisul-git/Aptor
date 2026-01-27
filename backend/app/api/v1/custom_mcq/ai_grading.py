"""
AI Grading Module for Subjective Questions
Uses OpenAI API to grade subjective answers with enhanced evaluation capabilities.
"""
from __future__ import annotations

import logging
import json
import re
from typing import Dict, Any, List, Optional
from openai import AsyncOpenAI

from ....config.settings import get_settings
from .question_analyzer import analyze_question, get_criteria_weights
from .answer_preprocessor import preprocess_answer, should_skip_evaluation, get_empty_answer_evaluation
from .scoring_validator import (
    validate_answer_completeness,
    apply_completeness_cap,
    normalize_score,
    validate_evaluation_result,
    calculate_confidence_score
)
from .prompt_builder import build_enhanced_evaluation_prompt

logger = logging.getLogger(__name__)


def _get_openai_client() -> AsyncOpenAI:
    """Get OpenAI client instance."""
    settings = get_settings()
    api_key = getattr(settings, 'openai_api_key', None)
    if not api_key:
        raise ValueError("OpenAI API key not configured")
    return AsyncOpenAI(api_key=api_key)


async def grade_subjective_answer(
    question: str,
    answer: str,
    max_marks: int,
    section: Optional[str] = None,
    rubric: Optional[str] = None,
    answer_key: Optional[str] = None,
    difficulty: str = "Medium"
) -> Dict[str, Any]:
    """
    Enhanced grade subjective answer using OpenAI with comprehensive evaluation.
    
    Args:
        question: The question text
        answer: The candidate's answer
        max_marks: Maximum marks for this question
        section: Optional section name for context
        rubric: Optional grading rubric
        answer_key: Optional ideal answer or key points
        difficulty: Question difficulty level
    
    Returns:
        Dict with comprehensive evaluation results including:
            - score: float (marks awarded)
            - max_marks: float
            - percentage: float
            - feedback: Dict with summary, strengths, weaknesses, etc.
            - reasoning: str
            - criteria_scores: Dict with breakdown by criterion
            - completeness_check: Dict with completeness validation
            - flags: Dict with confidence, review flags, etc.
    """
    try:
        max_marks_float = float(max_marks)
        
        # Step 1: Preprocess answer
        answer_preprocessing = preprocess_answer(answer, question)
        
        # Step 2: Check if we should skip evaluation (empty/too short)
        if should_skip_evaluation(answer_preprocessing):
            logger.info(f"Skipping AI evaluation for empty/very short answer (word_count={answer_preprocessing.get('word_count', 0)})")
            return get_empty_answer_evaluation(max_marks_float)
        
        # Step 3: Analyze question
        try:
            question_analysis = analyze_question(question)
            logger.debug(f"Question analysis: is_multi_part={question_analysis.get('is_multi_part')}, type={question_analysis.get('question_type')}")
        except Exception as e:
            logger.warning(f"Error analyzing question, using default analysis: {e}")
            question_analysis = {
                "is_multi_part": False,
                "parts": [{"id": 1, "text": question, "required": True, "keywords": []}],
                "part_count": 1,
                "question_type": "general",
                "complexity": "medium",
                "required_keywords": [],
                "original_question": question
            }
        
        # Step 4: Validate completeness (pre-check)
        completeness_result = validate_answer_completeness(answer, question_analysis)
        
        # Step 5: Build enhanced prompt
        try:
            prompt = build_enhanced_evaluation_prompt(
                question=question,
                answer=answer,
                max_marks=max_marks_float,
                question_analysis=question_analysis,
                section=section,
                rubric=rubric,
                answer_key=answer_key,
                difficulty=difficulty
            )
        except Exception as e:
            logger.warning(f"Error building enhanced prompt, using basic prompt: {e}")
            # Fallback to basic prompt
            prompt = _build_basic_prompt(question, answer, max_marks_float, section)
        
        # Step 6: Call OpenAI API
        client = _get_openai_client()
        
        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert evaluator. Always respond with valid JSON only. Use JSON mode."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000,  # Increased for comprehensive responses
                response_format={"type": "json_object"}  # JSON mode for reliability
            )
        except Exception as e:
            # Fallback if JSON mode not supported
            logger.warning(f"JSON mode failed, trying without: {e}")
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert evaluator. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000,
            )
        
        # Step 7: Parse response
        content = response.choices[0].message.content.strip()
        
        # Extract JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            # Fallback: try to extract JSON object from text
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                raise ValueError("Could not parse AI response as JSON")
        
        # Step 8: Process and normalize result
        evaluation_result = _process_ai_response(result, max_marks_float, question_analysis)
        
        # Step 9: Apply completeness cap if needed
        if question_analysis.get("is_multi_part", False):
            capped_score, max_possible, cap_info = apply_completeness_cap(
                evaluation_result.get("score", 0),
                max_marks_float,
                completeness_result,
                question_analysis
            )
            evaluation_result["score"] = capped_score
            evaluation_result["max_possible_score"] = max_possible
            if cap_info.get("capped"):
                logger.info(f"Applied completeness cap: {cap_info['reason']}, score capped to {capped_score}")
        
        # Step 10: Validate and normalize
        evaluation_result, warnings = validate_evaluation_result(
            evaluation_result,
            answer,
            question_analysis,
            max_marks_float
        )
        
        # Step 11: Calculate confidence
        confidence = calculate_confidence_score(
            evaluation_result,
            answer_preprocessing,
            completeness_result
        )
        evaluation_result.setdefault("flags", {})["confidence_level"] = confidence
        
        # Add warnings if any
        if warnings:
            evaluation_result["warnings"] = warnings
        
        # Step 12: Ensure response format matches expected structure
        return _format_evaluation_response(evaluation_result, max_marks_float)
        
    except Exception as e:
        logger.exception(f"Error grading subjective answer: {e}")
        # Return error evaluation
        return _create_error_evaluation(max_marks, str(e))


def _build_basic_prompt(question: str, answer: str, max_marks: float, section: Optional[str]) -> str:
    """Build basic prompt as fallback."""
    section_context = f"Section: {section}\n" if section else ""
    return f"""You are an expert evaluator grading a subjective answer. Please evaluate the following answer and provide a score.

{section_context}Question: {question}

Candidate's Answer: {answer}

Maximum Marks: {max_marks}

Please evaluate the answer based on:
1. Accuracy and correctness
2. Completeness
3. Clarity and coherence
4. Depth of understanding
5. Relevance to the question

Provide your evaluation in the following JSON format:
{{
    "score": <number between 0 and {max_marks}>,
    "feedback": {{"summary": "<constructive feedback>"}},
    "reasoning": "<brief explanation of why this score was awarded>"
}}

Return ONLY valid JSON, no additional text."""


def _process_ai_response(ai_result: Dict[str, Any], max_marks: float, question_analysis: Dict[str, Any]) -> Dict[str, Any]:
    """Process AI response and ensure all required fields are present."""
    
    # Extract score
    score = float(ai_result.get("score", 0))
    score = normalize_score(score, max_marks)
    
    # Extract criteria scores (with defaults)
    criteria_scores = ai_result.get("criteria_scores", {})
    if not isinstance(criteria_scores, dict):
        criteria_scores = {}
    
    # Ensure all criteria have proper structure
    default_criteria = ["accuracy", "completeness", "clarity", "depth", "relevance"]
    weights = get_criteria_weights(
        question_analysis.get("question_type", "general"),
        question_analysis.get("is_multi_part", False)
    )
    
    for criterion in default_criteria:
        if criterion not in criteria_scores:
            criteria_scores[criterion] = {
                "score": 0,
                "weight": weights.get(criterion, 20),
                "feedback": "Not evaluated"
            }
        else:
            # Ensure weight is set
            if "weight" not in criteria_scores[criterion]:
                criteria_scores[criterion]["weight"] = weights.get(criterion, 20)
    
    # Extract completeness check
    completeness_check = ai_result.get("completeness_check", {})
    if not isinstance(completeness_check, dict):
        completeness_check = {"all_parts_covered": True}
    
    # Extract feedback (handle both string and dict formats)
    feedback_data = ai_result.get("feedback", {})
    if isinstance(feedback_data, str):
        feedback = {
            "summary": feedback_data,
            "strengths": [],
            "weaknesses": [],
            "detailed_analysis": "",
            "suggestions": []
        }
    else:
        feedback = {
            "summary": feedback_data.get("summary", ""),
            "strengths": feedback_data.get("strengths", []),
            "weaknesses": feedback_data.get("weaknesses", []),
            "detailed_analysis": feedback_data.get("detailed_analysis", ""),
            "suggestions": feedback_data.get("suggestions", [])
        }
    
    # Extract flags
    flags = ai_result.get("flags", {})
    if not isinstance(flags, dict):
        flags = {}
    
    return {
        "score": score,
        "max_marks": max_marks,
        "percentage": (score / max_marks * 100) if max_marks > 0 else 0,
        "criteria_scores": criteria_scores,
        "completeness_check": completeness_check,
        "feedback": feedback,
        "reasoning": ai_result.get("reasoning", ""),
        "flags": flags
    }


def _format_evaluation_response(evaluation_result: Dict[str, Any], max_marks: float) -> Dict[str, Any]:
    """Format evaluation response to match expected structure."""
    
    # Ensure all fields are present
    result = {
        "score": evaluation_result.get("score", 0.0),
        "max_marks": max_marks,
        "percentage": evaluation_result.get("percentage", 0.0),
        "feedback": evaluation_result.get("feedback", {}).get("summary", ""),  # For backward compatibility
        "reasoning": evaluation_result.get("reasoning", ""),
        "criteria_scores": evaluation_result.get("criteria_scores", {}),
        "completeness_check": evaluation_result.get("completeness_check", {}),
        "flags": evaluation_result.get("flags", {})
    }
    
    # Add detailed feedback if available
    detailed_feedback = evaluation_result.get("feedback", {})
    if isinstance(detailed_feedback, dict):
        result["detailed_feedback"] = detailed_feedback
    
    # Add warnings if any
    if "warnings" in evaluation_result:
        result["warnings"] = evaluation_result["warnings"]
    
    return result


def _create_error_evaluation(max_marks: float, error_message: str) -> Dict[str, Any]:
    """Create error evaluation response."""
    return {
        "score": 0.0,
        "max_marks": max_marks,
        "percentage": 0.0,
        "feedback": f"Error during AI grading: {error_message}",
        "reasoning": "Could not evaluate answer due to technical error",
        "criteria_scores": {},
        "completeness_check": {"all_parts_covered": False},
        "flags": {
            "confidence_level": 0.0,
            "requires_human_review": True,
            "error": True
        }
    }


async def grade_multiple_subjective_answers(
    questions_and_answers: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Grade multiple subjective answers in batch with enhanced evaluation.
    
    Args:
        questions_and_answers: List of dicts with:
            - question: str
            - answer: str
            - max_marks: int
            - section: Optional[str]
            - questionId: str
            - rubric: Optional[str]
            - answer_key: Optional[str]
            - difficulty: Optional[str]
    
    Returns:
        List of grading results with questionId included
    """
    results = []
    
    logger.info(f"Grading {len(questions_and_answers)} subjective answers with enhanced evaluation")
    
    for item in questions_and_answers:
        try:
            question_id = item.get("questionId", "unknown")
            question_text = item.get("question", "")
            answer_text = item.get("answer", "")
            max_marks_raw = item.get("max_marks", 1)
            section = item.get("section", "")
            rubric = item.get("rubric")
            answer_key = item.get("answer_key")
            difficulty = item.get("difficulty", "Medium")
            
            # Ensure max_marks is a number
            if isinstance(max_marks_raw, str):
                try:
                    max_marks = float(max_marks_raw)
                except (ValueError, TypeError):
                    logger.warning(f"Invalid max_marks for question {question_id}: {max_marks_raw}, defaulting to 1")
                    max_marks = 1
            elif isinstance(max_marks_raw, (int, float)):
                max_marks = float(max_marks_raw)
            else:
                max_marks = 1.0
            
            if max_marks < 1:
                max_marks = 1.0
            
            logger.info(f"Grading question {question_id}: max_marks={max_marks}, answer_length={len(answer_text) if answer_text else 0}")
            
            # Check for empty answer (will be handled by preprocessor, but log early)
            if not answer_text or not answer_text.strip():
                logger.warning(f"Question {question_id} has empty answer, will be handled by preprocessor")
            
            # Grade with enhanced evaluation
            grade_result = await grade_subjective_answer(
                question=question_text,
                answer=answer_text,
                max_marks=max_marks,
                section=section,
                rubric=rubric,
                answer_key=answer_key,
                difficulty=difficulty
            )
            
            # Add questionId to result
            grade_result["questionId"] = question_id
            
            logger.info(
                f"Question {question_id} graded: {grade_result.get('score', 0)}/{max_marks} "
                f"(confidence: {grade_result.get('flags', {}).get('confidence_level', 'N/A')})"
            )
            
            results.append(grade_result)
            
        except Exception as e:
            logger.exception(f"Error grading question {item.get('questionId')}: {e}")
            max_marks = float(item.get("max_marks", 1))
            results.append({
                "questionId": item.get("questionId", "unknown"),
                "score": 0.0,
                "max_marks": max_marks,
                "percentage": 0.0,
                "feedback": f"Error: {str(e)}",
                "reasoning": "Could not evaluate answer due to technical error",
                "criteria_scores": {},
                "completeness_check": {"all_parts_covered": False},
                "flags": {
                    "confidence_level": 0.0,
                    "requires_human_review": True,
                    "error": True
                }
            })
    
    logger.info(f"Completed grading {len(results)} answers")
    return results
