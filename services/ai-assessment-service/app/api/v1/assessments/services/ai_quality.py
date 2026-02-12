"""
Module: ai_quality.py
Purpose: Question quality validation and quality checks

This module provides comprehensive quality validation functions for generated questions.
It ensures questions meet LeetCode/HackerRank quality standards before being saved.

Dependencies:
- External: openai (for AI-based quality checks)
- Internal: ai_utils (for OpenAI client)

Example usage:
    ```python
    from app.api.v1.assessments.services.ai_quality import validate_question_quality
    
    metrics = await validate_question_quality(
        question=question_dict,
        question_type="MCQ",
        difficulty="Medium",
        experience_min=3,
        experience_max=5,
        job_designation="Senior Backend Engineer",
        assessment_requirements="Building payment API"
    )
    
    if metrics.overall_score >= 0.80:
        # Question meets quality threshold
    ```

Note: This module provides production-grade validation with detailed feedback.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

from .ai_utils import _get_openai_client, _parse_json_response

logger = logging.getLogger(__name__)


# ============================================================================
# QUALITY METRICS CLASS
# ============================================================================

class QualityMetrics:
    """
    Comprehensive quality metrics for a question.
    
    All scores are between 0.0 and 1.0, where 1.0 is perfect.
    """
    
    def __init__(
        self,
        clarity_score: float = 0.0,
        technical_accuracy: float = 0.0,
        difficulty_match: float = 0.0,
        completeness_score: float = 0.0,
        role_relevance: float = 0.0,
        experience_match: float = 0.0,
        professional_score: float = 0.0,
        issues: Optional[List[str]] = None
    ):
        self.clarity_score = clarity_score
        self.technical_accuracy = technical_accuracy
        self.difficulty_match = difficulty_match
        self.completeness_score = completeness_score
        self.role_relevance = role_relevance
        self.experience_match = experience_match
        self.professional_score = professional_score
        self.issues = issues or []
    
    @property
    def overall_score(self) -> float:
        """
        Calculate weighted overall quality score.
        
        Weights:
        - Clarity: 15%
        - Technical Accuracy: 20% (critical - wrong answers are unacceptable)
        - Difficulty Match: 20% (critical - must match stated difficulty)
        - Completeness: 10%
        - Role Relevance: 15% (new - matches job role context)
        - Experience Match: 15% (new - matches seniority level)
        - Professional Score: 5% (bonus for LeetCode/HackerRank quality)
        """
        weights = {
            'clarity': 0.15,
            'technical_accuracy': 0.20,
            'difficulty_match': 0.20,
            'completeness': 0.10,
            'role_relevance': 0.15,
            'experience_match': 0.15,
            'professional_score': 0.05
        }
        
        weighted_sum = (
            self.clarity_score * weights['clarity'] +
            self.technical_accuracy * weights['technical_accuracy'] +
            self.difficulty_match * weights['difficulty_match'] +
            self.completeness_score * weights['completeness'] +
            self.role_relevance * weights['role_relevance'] +
            self.experience_match * weights['experience_match'] +
            self.professional_score * weights['professional_score']
        )
        
        return round(weighted_sum, 3)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metrics to dictionary for logging/debugging."""
        return {
            'overall_score': self.overall_score,
            'clarity_score': self.clarity_score,
            'technical_accuracy': self.technical_accuracy,
            'difficulty_match': self.difficulty_match,
            'completeness_score': self.completeness_score,
            'role_relevance': self.role_relevance,
            'experience_match': self.experience_match,
            'professional_score': self.professional_score,
            'issues': self.issues
        }


# ============================================================================
# MAIN VALIDATION FUNCTION
# ============================================================================

async def validate_question_quality(
    question: Dict[str, Any],
    question_type: str,
    difficulty: Optional[str] = None,
    experience_min: Optional[int] = None,
    experience_max: Optional[int] = None,
    job_designation: Optional[str] = None,
    assessment_requirements: Optional[str] = None,
    topic: Optional[str] = None
) -> QualityMetrics:
    """
    Comprehensive quality validation for a question.
    
    Args:
        question: Question dictionary
        question_type: Type of question (MCQ, Subjective, Coding, SQL, AIML, PseudoCode)
        difficulty: Stated difficulty level (Easy, Medium, Hard)
        experience_min: Minimum experience years
        experience_max: Maximum experience years
        job_designation: Job role/designation
        assessment_requirements: Global assessment requirements
        topic: Optional topic for context
        
    Returns:
        QualityMetrics object with all scores and issues
    """
    metrics = QualityMetrics()
    
    # 1. Clarity validation
    metrics.clarity_score, clarity_issues = await _validate_clarity(question, question_type)
    metrics.issues.extend(clarity_issues)
    
    # 2. Technical accuracy validation
    metrics.technical_accuracy, accuracy_issues = await _validate_technical_accuracy(
        question, question_type, topic
    )
    metrics.issues.extend(accuracy_issues)
    
    # 3. Completeness validation
    metrics.completeness_score, completeness_issues = _validate_completeness(question, question_type)
    metrics.issues.extend(completeness_issues)
    
    # 4. Difficulty calibration validation
    if difficulty:
        metrics.difficulty_match, difficulty_issues = await _validate_difficulty_calibration(
            question, difficulty, question_type, experience_max
        )
        metrics.issues.extend(difficulty_issues)
    else:
        metrics.difficulty_match = 0.5  # Neutral if no difficulty specified
    
    # 5. Experience appropriateness validation
    if experience_max is not None:
        metrics.experience_match, experience_issues = await _validate_experience_appropriateness(
            question, experience_min or 0, experience_max, job_designation, question_type
        )
        metrics.issues.extend(experience_issues)
    else:
        metrics.experience_match = 0.5  # Neutral if no experience specified
    
    # 6. Role relevance validation
    if job_designation or assessment_requirements:
        metrics.role_relevance, role_issues = await _validate_role_relevance(
            question, job_designation, assessment_requirements, question_type
        )
        metrics.issues.extend(role_issues)
    else:
        metrics.role_relevance = 0.5  # Neutral if no role context
    
    # 7. Professional quality validation
    metrics.professional_score, professional_issues = await _validate_professional_quality(
        question, question_type
    )
    metrics.issues.extend(professional_issues)
    
    return metrics


# ============================================================================
# INDIVIDUAL VALIDATORS
# ============================================================================

async def _validate_clarity(
    question: Dict[str, Any],
    question_type: str
) -> Tuple[float, List[str]]:
    """
    Validate question clarity: grammar, ambiguity, sentence structure.
    
    Returns:
        (score, issues_list)
    """
    issues = []
    score = 1.0
    
    # Extract question text
    question_text = question.get('question') or question.get('questionText') or question.get('description') or ''
    if not question_text:
        return 0.0, ["Missing question text"]
    
    # Basic checks
    if len(question_text.strip()) < 20:
        issues.append("Question text too short (less than 20 characters)")
        score -= 0.3
    
    # Check for common clarity issues
    clarity_patterns = {
        r'\b(?:what|which|how|why)\s+(?:is|are|does|do)\s+(?:the|a|an)\s+(?:question|problem|task)\s*\?': 
            "Question is meta-referential (asking about itself)",
        r'\b(?:this|that)\s+(?:question|problem)\b': 
            "Vague reference (use specific terms)",
        r'\b(?:etc|\.\.\.)\b': 
            "Incomplete thought (etc, ...)",
        r'\?\s*\?': 
            "Multiple question marks",
        r'[A-Z]{5,}': 
            "Excessive capitalization (likely formatting issue)",
    }
    
    for pattern, issue_desc in clarity_patterns.items():
        if re.search(pattern, question_text, re.IGNORECASE):
            issues.append(issue_desc)
            score -= 0.1
    
    # Check for balanced parentheses/brackets
    if question_text.count('(') != question_text.count(')'):
        issues.append("Unbalanced parentheses")
        score -= 0.2
    
    # Check for question mark (for MCQ, Subjective, PseudoCode)
    if question_type in ['MCQ', 'Subjective', 'PseudoCode']:
        if '?' not in question_text:
            issues.append("Missing question mark")
            score -= 0.1
    
    # Use AI for advanced clarity check
    try:
        ai_clarity_score, ai_issues = await _ai_clarity_check(question_text, question_type)
        score = min(score, ai_clarity_score)  # Take the lower score (more conservative)
        issues.extend(ai_issues)
    except Exception as e:
        logger.warning(f"AI clarity check failed: {e}")
        # Continue with basic checks only
    
    score = max(0.0, min(1.0, score))  # Clamp to [0, 1]
    return round(score, 3), issues


async def _validate_technical_accuracy(
    question: Dict[str, Any],
    question_type: str,
    topic: Optional[str] = None
) -> Tuple[float, List[str]]:
    """
    Validate technical accuracy using AI.
    
    Returns:
        (score, issues_list)
    """
    issues = []
    
    # Extract question content
    question_text = question.get('question') or question.get('questionText') or question.get('description') or ''
    if not question_text:
        return 0.0, ["Missing question text for accuracy check"]
    
    # For MCQ, check options and correct answer
    if question_type == 'MCQ':
        options = question.get('options', [])
        correct_answer = question.get('correctAnswer', '')
        
        if not options or len(options) < 2:
            return 0.0, ["MCQ missing options"]
        
        if not correct_answer:
            return 0.0, ["MCQ missing correct answer"]
        
        if correct_answer not in options:
            return 0.0, [f"Correct answer '{correct_answer}' not in options"]
    
    # Use AI to validate technical accuracy
    try:
        score, ai_issues = await _ai_technical_accuracy_check(
            question, question_type, topic
        )
        issues.extend(ai_issues)
        return score, issues
    except Exception as e:
        logger.warning(f"AI technical accuracy check failed: {e}")
        # Default to neutral if AI check fails
        return 0.7, ["Could not verify technical accuracy (AI check failed)"]


def _validate_completeness(
    question: Dict[str, Any],
    question_type: str
) -> Tuple[float, List[str]]:
    """
    Validate question completeness (all required fields present).
    
    Returns:
        (score, issues_list)
    """
    issues = []
    score = 1.0
    
    # Common required fields
    has_question_text = bool(question.get('question') or question.get('questionText') or question.get('description'))
    has_difficulty = bool(question.get('difficulty'))
    has_type = bool(question.get('type') or question.get('question_type'))
    
    if not has_question_text:
        issues.append("Missing question text")
        score -= 0.4
    
    if not has_difficulty:
        issues.append("Missing difficulty level")
        score -= 0.2
    
    if not has_type:
        issues.append("Missing question type")
        score -= 0.2
    
    # Type-specific requirements
    if question_type == 'MCQ':
        options = question.get('options', [])
        correct_answer = question.get('correctAnswer', '')
        
        if not options:
            issues.append("MCQ missing options")
            score -= 0.3
        
        if len(options) < 2:
            issues.append(f"MCQ has only {len(options)} option(s), need at least 2")
            score -= 0.2
        
        if not correct_answer:
            issues.append("MCQ missing correct answer")
            score -= 0.3
    
    elif question_type == 'Coding':
        # Check for test cases
        public_testcases = question.get('public_testcases', [])
        hidden_testcases = question.get('hidden_testcases', [])
        
        if not public_testcases and not hidden_testcases:
            issues.append("Coding question missing test cases")
            score -= 0.3
        
        # Check for starter code
        starter_code = question.get('starter_code', {})
        if not starter_code:
            issues.append("Coding question missing starter code")
            score -= 0.2
    
    elif question_type == 'SQL':
        schemas = question.get('schemas') or question.get('sql_data', {}).get('schemas', {})
        if not schemas:
            issues.append("SQL question missing database schemas")
            score -= 0.4
    
    elif question_type == 'AIML':
        dataset = question.get('dataset') or question.get('aiml_data', {}).get('dataset', {})
        tasks = question.get('tasks') or question.get('aiml_data', {}).get('tasks', [])
        
        if not dataset:
            issues.append("AIML question missing dataset")
            score -= 0.3
        
        if not tasks:
            issues.append("AIML question missing tasks")
            score -= 0.3
    
    score = max(0.0, min(1.0, score))  # Clamp to [0, 1]
    return round(score, 3), issues


async def _validate_difficulty_calibration(
    question: Dict[str, Any],
    stated_difficulty: str,
    question_type: str,
    experience_max: Optional[int] = None
) -> Tuple[float, List[str]]:
    """
    Validate that question difficulty matches stated level AND experience.
    
    Returns:
        (score, issues_list)
    """
    issues = []
    
    # Determine seniority level
    if experience_max is None:
        seniority = "Mid"
    elif experience_max <= 2:
        seniority = "Junior"
    elif experience_max <= 5:
        seniority = "Mid"
    elif experience_max <= 10:
        seniority = "Senior"
    else:
        seniority = "Lead"
    
    # Use AI to validate difficulty match
    try:
        score, ai_issues = await _ai_difficulty_check(
            question, stated_difficulty, question_type, seniority
        )
        issues.extend(ai_issues)
        return score, issues
    except Exception as e:
        logger.warning(f"AI difficulty check failed: {e}")
        # Default to neutral if AI check fails
        return 0.5, ["Could not verify difficulty calibration (AI check failed)"]


async def _validate_experience_appropriateness(
    question: Dict[str, Any],
    experience_min: int,
    experience_max: int,
    job_designation: Optional[str],
    question_type: str
) -> Tuple[float, List[str]]:
    """
    Validate that question matches candidate seniority level.
    
    Returns:
        (score, issues_list)
    """
    issues = []
    
    # Determine expected focus based on experience
    if experience_max <= 2:
        expected_focus = "execution, syntax, debugging, basic problem-solving"
        level_name = "Junior"
    elif experience_max <= 5:
        expected_focus = "design patterns, best practices, code reviews, system design basics"
        level_name = "Mid-level"
    elif experience_max <= 10:
        expected_focus = "architecture, scalability, team impact, technology choices"
        level_name = "Senior"
    else:
        expected_focus = "strategic decisions, business impact, cross-team collaboration"
        level_name = "Lead/Principal"
    
    # Use AI to validate experience match
    try:
        score, ai_issues = await _ai_experience_check(
            question, experience_min, experience_max, level_name, expected_focus, question_type
        )
        issues.extend(ai_issues)
        return score, issues
    except Exception as e:
        logger.warning(f"AI experience check failed: {e}")
        # Default to neutral if AI check fails
        return 0.5, ["Could not verify experience appropriateness (AI check failed)"]


async def _validate_role_relevance(
    question: Dict[str, Any],
    job_designation: Optional[str],
    assessment_requirements: Optional[str],
    question_type: str
) -> Tuple[float, List[str]]:
    """
    Validate that question is relevant to job role and assessment requirements.
    
    Returns:
        (score, issues_list)
    """
    issues = []
    
    if not job_designation and not assessment_requirements:
        return 0.5, []  # No context to validate against
    
    # Use AI to validate role relevance
    try:
        score, ai_issues = await _ai_role_relevance_check(
            question, job_designation, assessment_requirements, question_type
        )
        issues.extend(ai_issues)
        return score, issues
    except Exception as e:
        logger.warning(f"AI role relevance check failed: {e}")
        # Default to neutral if AI check fails
        return 0.5, ["Could not verify role relevance (AI check failed)"]


async def _validate_professional_quality(
    question: Dict[str, Any],
    question_type: str
) -> Tuple[float, List[str]]:
    """
    Validate professional quality (LeetCode/HackerRank standards).
        
    Returns:
        (score, issues_list)
    """
    issues = []
    score = 1.0
    
    question_text = question.get('question') or question.get('questionText') or question.get('description') or ''
    
    # Check for professional quality indicators
    quality_indicators = {
        'real_world_context': bool(re.search(r'\b(?:company|team|system|application|service|api|database)\b', question_text, re.IGNORECASE)),
        'specific_scenario': bool(re.search(r'\b(?:scenario|situation|case|problem|challenge)\b', question_text, re.IGNORECASE)),
        'technical_depth': bool(re.search(r'\b(?:optimize|performance|scalability|efficiency|complexity|algorithm)\b', question_text, re.IGNORECASE)),
    }
    
    # Penalize generic questions
    generic_patterns = [
        r'^what is\s+',
        r'^explain\s+',
        r'^define\s+',
        r'^list\s+',
    ]
    
    for pattern in generic_patterns:
        if re.match(pattern, question_text, re.IGNORECASE):
            issues.append("Question is too generic (starts with 'what is', 'explain', etc.)")
            score -= 0.3
            break
    
    # Reward professional indicators
    indicator_count = sum(quality_indicators.values())
    if indicator_count == 0:
        issues.append("Question lacks real-world context or specific scenario")
        score -= 0.2
    elif indicator_count >= 2:
        score += 0.1  # Bonus for professional quality
    
    score = max(0.0, min(1.0, score))  # Clamp to [0, 1]
    return round(score, 3), issues


# ============================================================================
# AI-BASED VALIDATORS
# ============================================================================

async def _ai_clarity_check(
    question_text: str,
    question_type: str
) -> Tuple[float, List[str]]:
    """Use AI to check question clarity."""
    client = _get_openai_client()
    
    prompt = f"""Analyze this {question_type} question for clarity issues:

Question: {question_text[:1000]}

Check for:
1. Grammar and spelling errors
2. Ambiguous wording
3. Unclear instructions
4. Missing context
5. Confusing sentence structure

Respond with JSON:
{{
    "score": 0.0-1.0,
    "issues": ["issue1", "issue2"]
}}"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content.strip()
        data = _parse_json_response(content)
        
        score = float(data.get('score', 0.5))
        issues = data.get('issues', [])
        
        return score, issues
    except Exception as e:
        logger.error(f"AI clarity check error: {e}")
        return 0.7, ["AI clarity check failed"]


async def _ai_technical_accuracy_check(
    question: Dict[str, Any],
    question_type: str,
    topic: Optional[str] = None
) -> Tuple[float, List[str]]:
    """Use AI to check technical accuracy."""
    client = _get_openai_client()
    
    question_text = question.get('question') or question.get('questionText') or question.get('description') or ''
    
    # Build context
    context_parts = [f"Question Type: {question_type}"]
    if topic:
        context_parts.append(f"Topic: {topic}")
    
    if question_type == 'MCQ':
        options = question.get('options', [])
        correct_answer = question.get('correctAnswer', '')
        context_parts.append(f"Options: {options}")
        context_parts.append(f"Correct Answer: {correct_answer}")
    
    context = "\n".join(context_parts)
    
    prompt = f"""Analyze this {question_type} question for technical accuracy:

{context}

Question: {question_text[:1000]}

Check for:
1. Technical correctness (are concepts accurate?)
2. For MCQ: Is the correct answer actually correct?
3. Are there any misleading or incorrect statements?
4. Are technical terms used correctly?

Respond with JSON:
{{
    "score": 0.0-1.0,
    "issues": ["issue1", "issue2"]
}}"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content.strip()
        data = _parse_json_response(content)
        
        score = float(data.get('score', 0.5))
        issues = data.get('issues', [])
        
        return score, issues
    except Exception as e:
        logger.error(f"AI technical accuracy check error: {e}")
        return 0.7, ["AI technical accuracy check failed"]


async def _ai_difficulty_check(
    question: Dict[str, Any],
    stated_difficulty: str,
    question_type: str,
    seniority: str
) -> Tuple[float, List[str]]:
    """Use AI to check if difficulty matches stated level."""
    client = _get_openai_client()
    
    question_text = question.get('question') or question.get('questionText') or question.get('description') or ''
    
    # Get difficulty rules
    rules = _get_difficulty_rules(question_type, stated_difficulty, seniority)
    
    prompt = f"""Analyze if this {question_type} question matches the stated difficulty level:

Stated Difficulty: {stated_difficulty}
Seniority Level: {seniority}
Question Type: {question_type}

Difficulty Rules for {stated_difficulty} ({seniority}):
{rules}

Question: {question_text[:1000]}

Check:
1. Does the question complexity match {stated_difficulty}?
2. Is it appropriate for {seniority} level?
3. Are the concepts/operations at the right difficulty?

Respond with JSON:
{{
    "score": 0.0-1.0,
    "issues": ["issue1", "issue2"]
}}"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content.strip()
        data = _parse_json_response(content)
        
        score = float(data.get('score', 0.5))
        issues = data.get('issues', [])
        
        return score, issues
    except Exception as e:
        logger.error(f"AI difficulty check error: {e}")
        return 0.5, ["AI difficulty check failed"]


async def _ai_experience_check(
    question: Dict[str, Any],
    experience_min: int,
    experience_max: int,
    level_name: str,
    expected_focus: str,
    question_type: str
) -> Tuple[float, List[str]]:
    """Use AI to check if question matches experience level."""
    client = _get_openai_client()
    
    question_text = question.get('question') or question.get('questionText') or question.get('description') or ''
    
    prompt = f"""Analyze if this {question_type} question is appropriate for the experience level:

Experience Range: {experience_min}-{experience_max} years
Level: {level_name}
Expected Focus: {expected_focus}

Question: {question_text[:1000]}

Check:
1. Is this question appropriate for {level_name} ({experience_min}-{experience_max} years)?
2. Does it focus on {expected_focus}?
3. Is it too easy or too hard for this level?

Respond with JSON:
{{
    "score": 0.0-1.0,
    "issues": ["issue1", "issue2"]
}}"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content.strip()
        data = _parse_json_response(content)
        
        score = float(data.get('score', 0.5))
        issues = data.get('issues', [])
        
        return score, issues
    except Exception as e:
        logger.error(f"AI experience check error: {e}")
        return 0.5, ["AI experience check failed"]


async def _ai_role_relevance_check(
    question: Dict[str, Any],
    job_designation: Optional[str],
    assessment_requirements: Optional[str],
    question_type: str
) -> Tuple[float, List[str]]:
    """Use AI to check if question is relevant to role and requirements."""
    client = _get_openai_client()
    
    question_text = question.get('question') or question.get('questionText') or question.get('description') or ''
    
    context_parts = []
    if job_designation:
        context_parts.append(f"Job Role: {job_designation}")
    if assessment_requirements:
        context_parts.append(f"Assessment Requirements: {assessment_requirements}")
    
    if not context_parts:
        return 0.5, []  # No context to validate
    
    context = "\n".join(context_parts)
    
    prompt = f"""Analyze if this {question_type} question is relevant to the job role and assessment requirements:

{context}

Question: {question_text[:1000]}

Check:
1. Is this question relevant to {job_designation or 'the role'}?
2. Does it align with the assessment requirements?
3. Would this question help assess the candidate for this role?

Respond with JSON:
{{
    "score": 0.0-1.0,
    "issues": ["issue1", "issue2"]
}}"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content.strip()
        data = _parse_json_response(content)
        
        score = float(data.get('score', 0.5))
        issues = data.get('issues', [])
        
        return score, issues
    except Exception as e:
        logger.error(f"AI role relevance check error: {e}")
        return 0.5, ["AI role relevance check failed"]


# ============================================================================
# DIFFICULTY RULES HELPER
# ============================================================================

def _get_difficulty_rules(question_type: str, difficulty: str, seniority: str) -> str:
    """
    Return specific difficulty rules for question type + seniority.
    
    This is used by both generators and validators to ensure consistency.
    """
    rules_dict = {
        "MCQ": {
            "Easy": {
                "Junior": "Direct concept recall, single-concept, no tricky edge cases. Example: 'What is the time complexity of binary search?'",
                "Mid": "Fundamental best practices, common patterns. Example: 'Which HTTP method should be used for idempotent operations?'",
                "Senior": "Quick architecture decisions, well-known trade-offs. Example: 'Which caching strategy minimizes cache invalidation overhead?'",
                "Lead": "Strategic technology choices, business impact. Example: 'Which database choice balances consistency and performance for 100M+ users?'"
            },
            "Medium": {
                "Junior": "Apply 2-3 concepts together, recognize common patterns. Example: 'Which data structure is best for implementing a LRU cache?'",
                "Mid": "Evaluate trade-offs, identify problems in code snippets. Example: 'What is the issue with this REST API design?'",
                "Senior": "Complex system decisions, multi-factor considerations. Example: 'Which approach handles eventual consistency in a distributed system?'",
                "Lead": "Strategic decisions with business constraints. Example: 'Which architecture pattern supports both monolith migration and new microservices?'"
            },
            "Hard": {
                "Junior": "Debug complex scenarios, deep edge case understanding. Example: 'Why does this code fail with concurrent access?'",
                "Mid": "Architecture decisions with constraints, performance analysis. Example: 'How would you optimize this query for 10M+ rows?'",
                "Senior": "Strategic technology choices, scale considerations, business impact. Example: 'Which approach minimizes latency while maintaining data consistency across regions?'",
                "Lead": "Cross-system impact, business strategy alignment. Example: 'Which technology stack supports both current needs and 5-year scalability goals?'"
            }
        },
        "Coding": {
            "Easy": {
                "Junior": "Single algorithm, clear steps, basic data structure (array/string). Example: 'Implement binary search on sorted array.'",
                "Mid": "Standard algorithm with 1 optimization. Example: 'Find two sum with O(n) time complexity.'",
                "Senior": "Well-known algorithm with edge cases handled. Example: 'Implement LRU cache with O(1) operations.'",
                "Lead": "Production-ready code with error handling. Example: 'Implement rate limiter with distributed support.'"
            },
            "Medium": {
                "Junior": "Two-pointer, sliding window, basic graph/tree traversal. Example: 'Find longest substring without repeating characters.'",
                "Mid": "Dynamic programming basics, optimize time/space. Example: 'Coin change problem with space optimization.'",
                "Senior": "Complex DP, graph algorithms, system constraints. Example: 'Design Twitter feed with real-time updates.'",
                "Lead": "System-level design with scalability. Example: 'Design distributed rate limiter with Redis backend.'"
            },
            "Hard": {
                "Junior": "Complex algorithm with multiple steps. Example: 'Merge k sorted lists efficiently.'",
                "Mid": "Advanced DP, complex graph problems, optimization required. Example: 'Find shortest path in weighted graph with constraints.'",
                "Senior": "System-level constraints, distributed considerations, performance-critical. Example: 'Design autocomplete system with prefix matching at scale.'",
                "Lead": "Enterprise architecture, business logic integration. Example: 'Design payment processing system with idempotency and retries.'"
            }
        },
        "SQL": {
            "Easy": {
                "Junior": "Simple SELECT with 1-2 JOINs, basic WHERE. Example: 'Find all users who registered in the last 30 days.'",
                "Mid": "Aggregate functions, GROUP BY, HAVING. Example: 'Calculate average salary per department.'",
                "Senior": "Quick query optimization decisions. Example: 'Which index would improve this query performance?'",
                "Lead": "Database strategy decisions. Example: 'Which partitioning strategy supports both OLTP and OLAP workloads?'"
            },
            "Medium": {
                "Junior": "Multiple JOINs, subqueries, basic window functions. Example: 'Find top 3 products per category by revenue.'",
                "Mid": "CTEs, complex aggregations, query analysis. Example: 'Calculate running total with window functions.'",
                "Senior": "Index strategy decisions, query plan understanding. Example: 'Optimize this query for 50M rows with proper indexing.'",
                "Lead": "Database architecture decisions. Example: 'Design schema for time-series data with efficient queries.'"
            },
            "Hard": {
                "Junior": "Recursive CTEs, complex subqueries. Example: 'Find all ancestors of a node in hierarchical data.'",
                "Mid": "Performance optimization, execution plan analysis. Example: 'This query takes 30 seconds. Optimize it with indexing strategy.'",
                "Senior": "Database design decisions, sharding strategies, scale considerations. Example: 'Design partitioning strategy for 1B+ row table with time-based queries.'",
                "Lead": "Enterprise data architecture. Example: 'Design data warehouse schema supporting both real-time analytics and batch processing.'"
            }
        },
        "AIML": {
            "Easy": {
                "Junior": "Basic pandas operations, simple sklearn fit/predict. Example: 'Load CSV, handle missing values, split into train/test.'",
                "Mid": "Load data, train basic model, interpret metrics. Example: 'Train RandomForest classifier and evaluate accuracy.'",
                "Senior": "Quick ML pipeline decisions. Example: 'Which feature engineering approach improves model performance?'",
                "Lead": "ML strategy decisions. Example: 'Which model architecture supports both accuracy and inference speed requirements?'"
            },
            "Medium": {
                "Junior": "Feature engineering, hyperparameter tuning basics. Example: 'Build pipeline with StandardScaler + RandomForest, tune hyperparameters.'",
                "Mid": "Model selection, cross-validation, metric interpretation. Example: 'Compare 3 models using cross-validation and select best.'",
                "Senior": "Production pipeline design, model monitoring. Example: 'Design ML pipeline with data validation and model versioning.'",
                "Lead": "ML system architecture. Example: 'Design A/B testing framework for model deployment with rollback capability.'"
            },
            "Hard": {
                "Junior": "Complex feature engineering, model debugging. Example: 'Your model accuracy dropped from 95% to 70%. Debug and fix.'",
                "Mid": "Production ML pipelines, model optimization, deployment. Example: 'Optimize model for production: reduce latency, handle data drift.'",
                "Senior": "ML system architecture, scale, business impact, A/B testing. Example: 'Design real-time ML inference system handling 1M requests/day with <100ms latency.'",
                "Lead": "Enterprise ML strategy. Example: 'Design ML platform supporting multiple teams with model governance and monitoring.'"
            }
        },
        "Subjective": {
            "Easy": {
                "Junior": "Explain basic concept with example (2-3 sentences). Example: 'Explain what REST API is with an example.'",
                "Mid": "Describe approach to common problem. Example: 'How would you handle API rate limiting?'",
                "Senior": "Quick decision explanation. Example: 'Explain your approach to database sharding strategy.'",
                "Lead": "Strategic direction explanation. Example: 'Explain your approach to technology stack selection for new product.'"
            },
            "Medium": {
                "Junior": "Compare 2-3 approaches, explain trade-offs. Example: 'Compare synchronous vs asynchronous API design.'",
                "Mid": "Design solution to moderately complex problem. Example: 'Design caching strategy for e-commerce product catalog.'",
                "Senior": "Architectural decision with multiple factors. Example: 'Design microservices architecture for payment processing system.'",
                "Lead": "Strategic technical direction. Example: 'Design migration strategy from monolith to microservices with zero downtime.'"
            },
            "Hard": {
                "Junior": "Complex scenario with multiple solutions. Example: 'How would you debug a production issue affecting 10% of users?'",
                "Mid": "System design with constraints and trade-offs. Example: 'Design distributed system for real-time analytics with eventual consistency.'",
                "Senior": "Strategic technical direction, business impact, team implications. Example: 'Design technical roadmap for scaling from 1M to 100M users.'",
                "Lead": "Enterprise strategy with business alignment. Example: 'Design technology strategy supporting both current products and future acquisitions.'"
            }
        },
        "PseudoCode": {
            "Easy": {
                "Junior": "Simple algorithm steps, basic logic. Example: 'Write pseudocode for finding maximum in array.'",
                "Mid": "Standard algorithm with clear steps. Example: 'Write pseudocode for binary search.'",
                "Senior": "Algorithm with optimization considerations. Example: 'Write pseudocode for efficient sorting with space constraints.'",
                "Lead": "Algorithm with system considerations. Example: 'Write pseudocode for distributed cache update strategy.'"
            },
            "Medium": {
                "Junior": "Multi-step algorithm, basic data structures. Example: 'Write pseudocode for implementing stack using arrays.'",
                "Mid": "Complex algorithm with edge cases. Example: 'Write pseudocode for graph traversal with cycle detection.'",
                "Senior": "Algorithm with performance optimization. Example: 'Write pseudocode for optimizing database query execution.'",
                "Lead": "Algorithm with architectural considerations. Example: 'Write pseudocode for load balancing algorithm with health checks.'"
            },
            "Hard": {
                "Junior": "Complex multi-step algorithm. Example: 'Write pseudocode for implementing LRU cache.'",
                "Mid": "Advanced algorithm with optimization. Example: 'Write pseudocode for dynamic programming solution with space optimization.'",
                "Senior": "System-level algorithm with constraints. Example: 'Write pseudocode for distributed consensus algorithm.'",
                "Lead": "Enterprise algorithm with business logic. Example: 'Write pseudocode for multi-tenant data isolation strategy.'"
            }
        }
    }
    
    return rules_dict.get(question_type, {}).get(difficulty, {}).get(seniority, "Standard difficulty rules apply")


# ============================================================================
# SEMANTIC SIMILARITY (for diversity)
# ============================================================================

def _check_semantic_similarity(questions: List[Dict[str, Any]]) -> List[float]:
    """
    Check semantic similarity between questions to ensure diversity.
    
    Args:
        questions: List of question dictionaries
        
    Returns:
        List of similarity scores (lower is better, 0.0 = no similarity)
    """
    # TODO: Implement with embeddings (sentence-transformers or OpenAI embeddings)
    # For now, return neutral scores
    return [0.0] * len(questions)


# ============================================================================
# QUALITY-CHECKED GENERATION WRAPPER
# ============================================================================

async def _generate_with_quality_check(
    generator_func,
    *args,
    min_quality: float = 0.75,
    max_retries: int = 3,
    **kwargs
) -> Dict[str, Any]:
    """
    Generate question with quality check and retry if quality is low.
    
    Args:
        generator_func: Function to generate question
        *args: Positional arguments for generator
        min_quality: Minimum quality threshold
        max_retries: Maximum retry attempts
        **kwargs: Keyword arguments for generator
        
    Returns:
        Generated question dictionary
        
    Raises:
        HTTPException: If quality threshold not met after retries
    """
    best_question = None
    best_score = 0.0
    
    for attempt in range(max_retries):
        try:
            question = await generator_func(*args, **kwargs)
            
            # Validate quality
            # Extract validation params from kwargs
            metrics = await validate_question_quality(
                question=question if isinstance(question, dict) else question[0] if isinstance(question, list) else {},
                question_type=kwargs.get('question_type', 'MCQ'),
                difficulty=kwargs.get('difficulty'),
                experience_min=kwargs.get('experience_min'),
                experience_max=kwargs.get('experience_max'),
                job_designation=kwargs.get('job_designation'),
                assessment_requirements=kwargs.get('assessment_requirements')
            )
            
            score = metrics.overall_score
            
            if score > best_score:
                best_score = score
                best_question = question
            
            if score >= min_quality:
                logger.info(f"✅ Generated quality question (score={score:.2f}) on attempt {attempt + 1}")
                return question
            
            logger.warning(f"🔄 Attempt {attempt + 1} quality too low ({score:.2f} < {min_quality}), retrying...")
            
        except Exception as e:
            logger.error(f"Generation attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                raise
    
    # If we get here, all attempts failed quality threshold
    if best_question and best_score > 0.5:
        logger.warning(f"⚠️ Using best question despite low quality (score={best_score:.2f})")
        return best_question
    
    raise HTTPException(
        status_code=500,
        detail=f"Could not generate question meeting quality threshold ({min_quality}) after {max_retries} attempts. Best score: {best_score:.2f}"
    )
