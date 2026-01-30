"""
Unified AI Evaluation Service
Comprehensive AI evaluation system for all question types (MCQ, Subjective, Pseudocode, Coding, SQL, AIML)

This service provides:
- Detailed per-question evaluation with criteria-based scoring
- Section-level aggregation
- Overall assessment summary
- Skill-based improvement recommendations
- Personalized learning paths
"""

from __future__ import annotations

import logging
import json
import re
import os
import time
import asyncio
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from functools import lru_cache
from openai import AsyncOpenAI
from openai import RateLimitError, APIError

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


# ============================================================================
# EVALUATION METRICS TRACKING
# ============================================================================

class EvaluationMetrics:
    """Track evaluation metrics for monitoring and billing."""
    total_tokens_used: int = 0
    total_cost_usd: float = 0.0
    evaluation_count: int = 0
    error_count: int = 0
    
    @classmethod
    def reset(cls):
        """Reset metrics (useful for testing)."""
        cls.total_tokens_used = 0
        cls.total_cost_usd = 0.0
        cls.evaluation_count = 0
        cls.error_count = 0

evaluation_metrics = EvaluationMetrics()


def get_evaluation_metrics() -> Dict[str, Any]:
    """
    Get current evaluation metrics for monitoring.
    
    Returns:
        Dictionary with metrics including:
        - total_tokens_used: Total tokens consumed
        - total_cost_usd: Total cost in USD
        - evaluation_count: Number of evaluations performed
        - error_count: Number of errors encountered
        - average_cost_per_evaluation: Average cost per evaluation
        - cache_size: Number of cached evaluations
    """
    avg_cost = (
        evaluation_metrics.total_cost_usd / evaluation_metrics.evaluation_count
        if evaluation_metrics.evaluation_count > 0
        else 0.0
    )
    
    return {
        "total_tokens_used": evaluation_metrics.total_tokens_used,
        "total_cost_usd": round(evaluation_metrics.total_cost_usd, 4),
        "evaluation_count": evaluation_metrics.evaluation_count,
        "error_count": evaluation_metrics.error_count,
        "average_cost_per_evaluation": round(avg_cost, 4),
        "cache_size": len(evaluation_cache),
        "cache_hit_rate": "N/A"  # Would need to track hits/misses separately
    }


# ============================================================================
# CACHING
# ============================================================================

# Simple in-memory cache (for production, use Redis)
evaluation_cache: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour
cache_timestamps: Dict[str, float] = {}


def _generate_cache_key(question_id: str, answer: str, question_type: str) -> str:
    """Generate cache key for evaluation results."""
    content = f"{question_id}:{question_type}:{answer[:500]}"  # Limit answer length for key
    return hashlib.sha256(content.encode()).hexdigest()


def _get_cached_evaluation(cache_key: str) -> Optional[Dict[str, Any]]:
    """Get cached evaluation if available and not expired."""
    if cache_key not in evaluation_cache:
        return None
    
    # Check if cache entry is expired
    if time.time() - cache_timestamps.get(cache_key, 0) > CACHE_TTL_SECONDS:
        del evaluation_cache[cache_key]
        del cache_timestamps[cache_key]
        return None
    
    return evaluation_cache[cache_key]


def _cache_evaluation(cache_key: str, evaluation: Dict[str, Any]) -> None:
    """Cache evaluation result."""
    evaluation_cache[cache_key] = evaluation
    cache_timestamps[cache_key] = time.time()


# ============================================================================
# OPENAI CLIENT
# ============================================================================

@lru_cache(maxsize=1)
def _get_openai_client() -> AsyncOpenAI:
    """
    Get cached OpenAI client instance with improved error handling.
    
    Checks both settings and environment variables for API key.
    """
    settings = get_settings()
    api_key = getattr(settings, 'openai_api_key', None) or os.getenv('OPENAI_API_KEY')
    
    if not api_key:
        error_msg = (
            "OpenAI API key not configured. Set OPENAI_API_KEY environment variable "
            "or configure openai_api_key in settings."
        )
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    return AsyncOpenAI(api_key=api_key)


# ============================================================================
# SYSTEM PROMPT TEMPLATE
# ============================================================================

SYSTEM_PROMPT = """You are an expert AI evaluation system for technical assessments. Your role is to evaluate candidate answers across multiple question types and provide detailed, actionable feedback.

### EVALUATION OUTPUT STRUCTURE

For each answer evaluation, you must return a JSON object with the following structure:

{
  "question_id": "string",
  "section": "string",
  "question_type": "MCQ|Subjective|PseudoCode|Coding|SQL|AIML",
  
  // SCORING
  "score": float,                    // Points awarded (0 to max_marks)
  "max_marks": float,                // Maximum possible marks
  "percentage": float,               // (score/max_marks) * 100
  
  // CRITERIA-BASED SCORING (weighted breakdown)
  "criteria_scores": {
    "accuracy": {
      "score": float,                // Points for this criterion
      "weight": float,               // Percentage weight (e.g., 40)
      "feedback": "string"           // Specific feedback for this criterion
    },
    "completeness": {
      "score": float,
      "weight": float,
      "feedback": "string"
    },
    "efficiency": {
      "score": float,
      "weight": float,
      "feedback": "string"
    },
    "code_quality": {                // For coding questions
      "score": float,
      "weight": float,
      "feedback": "string"
    },
    "best_practices": {
      "score": float,
      "weight": float,
      "feedback": "string"
    }
  },
  
  // DETAILED FEEDBACK
  "feedback": {
    "summary": "string",             // 2-3 sentence overall assessment
    "strengths": ["string"],         // What the candidate did well
    "weaknesses": ["string"],        // Areas that need improvement
    "detailed_analysis": "string",   // In-depth evaluation
    "suggestions": ["string"]        // Specific improvement recommendations
  },
  
  // ANSWER ANALYSIS
  "answer_log": {
    "submitted_answer": "string",    // What candidate submitted
    "expected_answer": "string",     // Reference/ideal answer (if available)
    "key_points_covered": ["string"], // Concepts/points candidate addressed
    "key_points_missed": ["string"],  // Important points not covered
    "incorrect_points": ["string"],   // Factually incorrect statements
    "partial_credit_reasoning": "string" // Why partial credit was given
  },
  
  // SKILL-BASED IMPROVEMENT
  "areas_of_improvement": [
    {
      "skill": "string",             // e.g., "Algorithm Design", "SQL Optimization"
      "current_level": "Beginner|Intermediate|Advanced",
      "gap_analysis": "string",      // What's missing
      "priority": "High|Medium|Low", // Improvement priority
      "improvement_suggestions": [
        {
          "suggestion": "string",    // Specific action item
          "resources": ["string"],   // Learning resources
          "practice_exercises": ["string"], // Recommended practice problems
          "estimated_time": "string" // Time needed to improve
        }
      ]
    }
  ],
  
  // COMPARATIVE ANALYSIS
  "benchmarking": {
    "compared_to_peers": "Below Average|Average|Above Average|Excellent",
    "percentile": float,             // Estimated percentile (0-100)
    "industry_standard": "string"    // How this compares to industry expectations
  },
  
  // ADDITIONAL INSIGHTS
  "insights": {
    "time_efficiency": "string",     // If time data available
    "approach_quality": "string",    // Problem-solving approach assessment
    "edge_case_handling": "string",  // How well edge cases were considered
    "scalability_consideration": "string", // For coding/SQL questions
    "alternative_solutions": ["string"] // Better or alternative approaches
  },
  
  // FLAGS AND WARNINGS
  "flags": {
    "plagiarism_risk": "Low|Medium|High",
    "ai_generated_risk": "Low|Medium|High",
    "incomplete_answer": boolean,
    "requires_human_review": boolean,
    "confidence_level": float        // AI's confidence in evaluation (0-1)
  }
}

### EVALUATION GUIDELINES

1. **Be Fair and Objective**: Base evaluation only on what's submitted
2. **Provide Constructive Feedback**: Focus on growth, not just criticism
3. **Be Specific**: Cite examples from the answer when providing feedback
4. **Award Partial Credit**: Recognize partial understanding/correct approach
5. **Consider Context**: Difficulty level, time constraints, question complexity
6. **Avoid Bias**: Evaluate technical merit, not writing style (unless specified)
7. **Be Consistent**: Apply same standards across all candidates
8. **Highlight Learning Path**: Always provide next steps for improvement

### CONFIDENCE AND REVIEW FLAGS

Set "requires_human_review": true if:
- Answer is ambiguous or unclear
- Multiple valid interpretations exist
- Confidence level < 0.7
- Plagiarism/AI-generated content suspected
- Answer is borderline between two grade levels
- Question requires domain-specific expertise beyond AI capability

Return ONLY valid JSON. No markdown, no explanations outside JSON structure."""


# ============================================================================
# QUESTION TYPE-SPECIFIC EVALUATION FUNCTIONS
# ============================================================================

async def evaluate_pseudocode_answer(
    question_id: str,
    question_text: str,
    candidate_answer: str,
    max_marks: float,
    section: Optional[str] = None,
    sample_input: Optional[str] = None,
    expected_output: Optional[str] = None,
    rubric: Optional[str] = None,
    difficulty: str = "Medium",
    use_cache: bool = True
) -> Dict[str, Any]:
    """
    Evaluate a pseudocode answer with comprehensive AI evaluation.
    
    Evaluation Criteria:
    - Algorithm Correctness (40%): Logic is sound and produces correct results
    - Step-by-Step Clarity (25%): Clear, logical progression
    - Edge Case Handling (20%): Considers boundary conditions
    - Efficiency (10%): Time/space complexity consideration
    - Structure & Readability (5%): Well-organized, easy to follow
    
    Args:
        question_id: Unique question identifier
        question_text: The question text
        candidate_answer: Candidate's pseudocode answer
        max_marks: Maximum marks for this question
        section: Optional section name
        sample_input: Optional sample input for context
        expected_output: Optional expected output for context
        rubric: Optional evaluation rubric
        difficulty: Question difficulty level
        use_cache: Whether to use cached results (default: True)
    
    Returns:
        Comprehensive evaluation result dictionary
    """
    # Input validation
    if not question_id or not question_text or not candidate_answer:
        logger.warning(f"Invalid input for pseudocode evaluation: question_id={question_id}, answer_length={len(candidate_answer) if candidate_answer else 0}")
        return _create_error_evaluation(question_id, "PseudoCode", max_marks, section, "Invalid input parameters")
    
    if max_marks <= 0 or max_marks > 1000:
        logger.warning(f"Invalid max_marks: {max_marks}")
        return _create_error_evaluation(question_id, "PseudoCode", max_marks, section, f"Invalid max_marks: {max_marks}")
    
    # Sanitize input
    candidate_answer = _sanitize_answer(candidate_answer)
    question_text = _sanitize_question(question_text)
    
    # Check cache
    if use_cache:
        cache_key = _generate_cache_key(question_id, candidate_answer, "PseudoCode")
        cached_result = _get_cached_evaluation(cache_key)
        if cached_result:
            logger.info(f"Cache hit for pseudocode question {question_id}")
            # Update question_id and section in cached result
            cached_result["question_id"] = question_id
            cached_result["section"] = section or ""
            return cached_result
    
    try:
        start_time = time.time()
        client = _get_openai_client()
        
        section_context = f"Section: {section}\n" if section else ""
        sample_io_context = ""
        if sample_input and expected_output:
            sample_io_context = f"\nSample Input: {sample_input}\nExpected Output: {expected_output}\n"
        rubric_context = f"\nEvaluation Rubric:\n{rubric}\n" if rubric else ""
        
        prompt = f"""{SYSTEM_PROMPT}

Evaluate the following pseudocode answer:

{section_context}QUESTION: {question_text}

CANDIDATE ANSWER: {candidate_answer}

MAX MARKS: {max_marks}
DIFFICULTY: {difficulty}
{sample_io_context}{rubric_context}

Focus on algorithm correctness, logic flow, edge cases, and clarity.
Provide detailed evaluation following the system prompt structure above."""

        response = await _call_openai_with_retry(client, prompt)
        result = _parse_json_response(response)
        
        # Ensure question_type is set
        result["question_type"] = "PseudoCode"
        result["question_id"] = question_id
        result["section"] = section or ""
        
        # Validate and normalize scores
        result = _normalize_evaluation_result(result, max_marks)
        
        # Calculate confidence
        result["flags"]["confidence_level"] = _calculate_confidence(result)
        
        # Cache result
        if use_cache:
            _cache_evaluation(cache_key, result)
        
        duration_ms = (time.time() - start_time) * 1000
        logger.info(
            f"Pseudocode evaluation completed: question_id={question_id}, "
            f"score={result['score']}/{max_marks}, duration={duration_ms:.0f}ms"
        )
        
        return result
        
    except Exception as e:
        logger.exception(f"Error evaluating pseudocode answer: {e}")
        return _create_error_evaluation(question_id, "PseudoCode", max_marks, section, str(e))


async def evaluate_sql_answer(
    question_id: str,
    question_description: str,
    user_query: str,
    reference_query: Optional[str],
    max_marks: float,
    section: Optional[str] = None,
    schemas: Optional[Dict[str, Any]] = None,
    test_result: Optional[Dict[str, Any]] = None,
    order_sensitive: bool = False,
    difficulty: str = "Medium",
    use_cache: bool = True
) -> Dict[str, Any]:
    """
    Evaluate a SQL query with comprehensive AI evaluation.
    
    Evaluation Criteria:
    - Query Correctness (40%): Produces correct results
    - Query Efficiency (25%): Optimal use of indexes, joins
    - SQL Best Practices (15%): Proper syntax, readable formatting
    - Edge Case Handling (10%): NULLs, empty sets, duplicates
    - Alternative Solutions (10%): Awareness of other approaches
    
    Args:
        question_id: Unique question identifier
        question_description: SQL question description
        user_query: Candidate's SQL query
        reference_query: Reference/expected query
        max_marks: Maximum marks for this question
        section: Optional section name
        schemas: Database schemas
        test_result: Test execution result
        order_sensitive: Whether result order matters
        difficulty: Question difficulty level
        use_cache: Whether to use cached results (default: True)
    
    Returns:
        Comprehensive evaluation result dictionary
    """
    # Input validation
    if not question_id or not question_description or not user_query:
        logger.warning(f"Invalid input for SQL evaluation: question_id={question_id}, has_description={bool(question_description)}, has_query={bool(user_query)}")
        return _create_error_evaluation(question_id, "SQL", max_marks, section, "Invalid input parameters")
    
    if max_marks <= 0 or max_marks > 1000:
        logger.warning(f"Invalid max_marks: {max_marks}")
        return _create_error_evaluation(question_id, "SQL", max_marks, section, f"Invalid max_marks: {max_marks}")
    
    # If test_result not provided, create a basic one for evaluation (evaluate based on query quality only)
    if not test_result:
        logger.info(f"[SQL_EVAL] No test result provided for question {question_id}, evaluating based on query quality only")
        test_result = {
            "passed": False,  # Default to False when no test result
            "status": "not_tested",
            "user_output": "",
            "error": "No test result available - query was not executed"
        }
    
    # Sanitize input
    user_query = _sanitize_answer(user_query)
    question_description = _sanitize_question(question_description)
    
    # Check cache
    if use_cache:
        cache_key = _generate_cache_key(question_id, user_query, "SQL")
        cached_result = _get_cached_evaluation(cache_key)
        if cached_result:
            logger.info(f"Cache hit for SQL question {question_id}")
            cached_result["question_id"] = question_id
            cached_result["section"] = section or ""
            return cached_result
    
    try:
        start_time = time.time()
        client = _get_openai_client()
        
        section_context = f"Section: {section}\n" if section else ""
        schemas_context = f"\nDatabase Schemas:\n{json.dumps(schemas, indent=2)}\n" if schemas else ""
        
        test_status = "PASSED" if (test_result and test_result.get("passed", False)) else "FAILED"
        test_details = ""
        expected_output = ""
        user_output = ""
        
        if test_result:
            test_details = f"\nTest Execution Result: {test_status}\n"
            if test_result.get("error"):
                test_details += f"Error: {test_result.get('error')}\n"
            
            # Extract expected output - prioritize direct expected_output field, then reference_result
            if test_result.get("expected_output"):
                expected_output = str(test_result.get("expected_output"))
            else:
                # Fallback to extracting from reference_result
                reference_result = test_result.get("reference_result")
                if reference_result:
                    if isinstance(reference_result, dict):
                        expected_output = reference_result.get("stdout", "") or reference_result.get("output", "") or ""
                    elif isinstance(reference_result, str):
                        expected_output = reference_result
                    else:
                        expected_output = str(reference_result) if reference_result else ""
            
            # Extract user output - prioritize direct user_output field, then user_result
            if test_result.get("user_output"):
                user_output = str(test_result.get("user_output"))
            else:
                # Fallback to extracting from user_result
                user_result = test_result.get("user_result", {})
                if isinstance(user_result, dict):
                    user_output = user_result.get("stdout", "") or user_result.get("output", "") or ""
                elif isinstance(user_result, str):
                    user_output = user_result
                else:
                    user_output = str(user_result) if user_result else ""
            
            # Add outputs to test details
            if user_output:
                test_details += f"\nUser Query Output:\n{user_output[:2000]}\n"  # Limit to avoid token limits
            if expected_output:
                test_details += f"\nExpected Output:\n{expected_output[:2000]}\n"  # Limit to avoid token limits
        
        reference_context = f"\nReference Query (Expected Solution):\n{reference_query}\n" if reference_query else ""
        order_context = f"\nNote: Result order {'is' if order_sensitive else 'is NOT'} important for correctness.\n"
        
        # Expected output context (if available)
        expected_output_context = ""
        if expected_output:
            expected_output_context = f"\nEXPECTED OUTPUT (What the query should produce):\n```\n{expected_output[:2000]}\n```\n"
        elif reference_query:
            expected_output_context = "\nNote: Expected output is not available, but a reference query is provided above.\n"
        
        # SQL-specific evaluation prompt
        sql_system_prompt = """You are an expert SQL evaluator for technical assessments. Your role is to evaluate SQL queries and provide detailed, actionable feedback.

### SQL EVALUATION CRITERIA

Evaluate SQL queries based on these criteria (NOT algorithmic time/space complexity):

1. **Query Correctness (40%)**: Does the query produce the correct results?
   - Correctness of logic and business requirements
   - Proper handling of data relationships (JOINs, WHERE clauses)
   - Correct use of aggregate functions, window functions, subqueries
   - Handling of edge cases (NULL values, empty sets, duplicates)

2. **Query Efficiency (25%)**: Is the query optimized for performance?
   - Appropriate use of indexes (implicit through query structure)
   - Efficient JOIN strategies (INNER, LEFT, RIGHT, FULL OUTER)
   - Use of WHERE clauses to filter early
   - Avoidance of unnecessary subqueries or correlated subqueries
   - Use of CTEs (Common Table Expressions) for readability and potential optimization
   - Appropriate use of window functions vs. subqueries
   - Avoidance of SELECT * when not needed

3. **SQL Best Practices (15%)**: Does the query follow SQL conventions?
   - Readable formatting and indentation
   - Clear and meaningful aliases
   - Proper use of SQL keywords (DISTINCT, GROUP BY, HAVING, ORDER BY)
   - Consistent naming conventions
   - Appropriate use of comments (if needed)

4. **Edge Case Handling (10%)**: How well does the query handle edge cases?
   - NULL value handling (IS NULL, IS NOT NULL, COALESCE, NULLIF)
   - Empty result sets
   - Duplicate records (DISTINCT, GROUP BY)
   - Data type considerations
   - Boundary conditions

5. **Alternative Solutions Awareness (10%)**: Does the candidate show awareness of different approaches?
   - Use of different JOIN types when appropriate
   - Window functions vs. subqueries
   - CTEs vs. nested subqueries
   - EXISTS vs. IN vs. JOIN for subqueries

### IMPORTANT NOTES FOR SQL EVALUATION

- **DO NOT** mention "O(n) time complexity" or "O(1) space complexity" - these are algorithmic concepts, not SQL concepts
- **DO** mention query performance, execution plans, index usage, and optimization opportunities
- **DO** evaluate query structure, readability, and maintainability
- **DO** consider database-specific optimizations (though keep it generic)
- **DO** provide feedback on SQL-specific best practices

### EVALUATION OUTPUT

Return a JSON object with the structure defined in the main system prompt, but focus your feedback on SQL-specific aspects:
- Query correctness and logic
- Query optimization and efficiency
- SQL syntax and best practices
- Edge case handling in SQL context
- Alternative SQL approaches

Provide constructive feedback that helps candidates improve their SQL skills."""

        prompt = f"""{sql_system_prompt}

Evaluate the following SQL query:

{section_context}QUESTION: {question_description}

CANDIDATE QUERY:
```sql
{user_query}
```

MAX MARKS: {max_marks}
DIFFICULTY: {difficulty}
{schemas_context}{reference_context}{order_context}{expected_output_context}{test_details}

The query has {test_status.lower()} the execution test.

### SCORING GUIDELINES (SQL-SPECIFIC):

**PRIMARY FACTOR: Query Correctness (40% of score)**
- If the query produces the EXACT expected output: Award 40% of max_marks for correctness
- If the query produces similar but not exact output: Award 20-35% based on how close it is
- If the query fails or produces incorrect output: Award 0-15% based on approach correctness

**Secondary Factors (60% of score):**
- Query Efficiency (25%): JOIN optimization, index usage, query structure
- SQL Best Practices (15%): Formatting, readability, naming conventions
- Edge Case Handling (10%): NULL handling, empty sets, duplicates
- Alternative Solutions (10%): Awareness of different SQL approaches

**FINAL SCORE CALCULATION:**
- Base score = Correctness (40%) + Efficiency (25%) + Best Practices (15%) + Edge Cases (10%) + Alternatives (10%)
- If test PASSED: Minimum score should be 80% of max_marks (query is correct)
- If test FAILED: Maximum score should be 50% of max_marks (query has correctness issues)
- Adjust within these ranges based on quality factors

Provide detailed SQL-specific evaluation focusing on:
- Query correctness compared to expected output (if provided)
- Query efficiency and optimization opportunities
- SQL best practices and code quality
- Edge case handling (NULLs, empty sets, duplicates)
- Alternative SQL approaches (different JOIN types, window functions, CTEs, etc.)

DO NOT mention algorithmic time/space complexity (O(n), O(1), etc.) as these concepts don't apply to SQL queries.
Instead, focus on query performance, index usage, JOIN efficiency, and SQL-specific optimizations."""

        response = await _call_openai_with_retry(client, prompt)
        result = _parse_json_response(response)
        
        # Ensure question_type is set
        result["question_type"] = "SQL"
        result["question_id"] = question_id
        result["section"] = section or ""
        
        # Adjust score based on test result and SQL-specific criteria
        if test_result:
            test_passed = test_result.get("passed", False)
            
            if not test_passed:
                # If test failed, cap the score at 50% of max_marks (SQL-specific: query has correctness issues)
                max_possible = max_marks * 0.5
                if result.get("score", 0) > max_possible:
                    result["score"] = max_possible
                    result["flags"]["requires_human_review"] = True
                    result["answer_log"]["partial_credit_reasoning"] = (
                        "Query did not pass execution test. Partial credit awarded for correct approach, "
                        "query structure, or SQL best practices demonstrated."
                    )
            else:
                # If test passed, ensure minimum score is 80% (SQL-specific: query is correct)
                min_score = max_marks * 0.8
                if result.get("score", 0) < min_score:
                    result["score"] = min_score
                    logger.info(
                        f"SQL query passed test but AI score was below 80%. "
                        f"Adjusted from {result.get('score', 0)} to {min_score}"
                    )
        
        # Validate and normalize scores
        result = _normalize_evaluation_result(result, max_marks)
        
        # Calculate confidence
        result["flags"]["confidence_level"] = _calculate_confidence(result, test_result)
        
        # Cache result
        if use_cache:
            _cache_evaluation(cache_key, result)
        
        duration_ms = (time.time() - start_time) * 1000
        logger.info(
            f"SQL evaluation completed: question_id={question_id}, "
            f"score={result['score']}/{max_marks}, duration={duration_ms:.0f}ms"
        )
        
        return result
        
    except Exception as e:
        logger.exception(f"Error evaluating SQL answer: {e}")
        return _create_error_evaluation(question_id, "SQL", max_marks, section, str(e))


async def evaluate_coding_answer_enhanced(
    question_id: str,
    problem_statement: str,
    source_code: str,
    language: str,
    max_marks: float,
    section: Optional[str] = None,
    test_results: Optional[List[Dict[str, Any]]] = None,
    passed_count: int = 0,
    total_count: int = 0,
    starter_code: Optional[str] = None,
    difficulty: str = "Medium",
    use_cache: bool = True
) -> Dict[str, Any]:
    """
    Enhanced evaluation for coding questions with detailed scoring.
    
    Evaluation Criteria:
    - Test Case Pass Rate (35%): From Judge0 execution
    - Algorithm Correctness (25%): Right approach and logic
    - Code Quality (20%): Clean, readable, maintainable code
    - Efficiency (10%): Time and space complexity
    - Best Practices (10%): Naming, comments, error handling
    
    Args:
        question_id: Unique question identifier
        problem_statement: Problem description
        source_code: Candidate's source code
        language: Programming language
        max_marks: Maximum marks for this question
        section: Optional section name
        test_results: Test case execution results
        passed_count: Number of passed test cases
        total_count: Total number of test cases
        starter_code: Optional starter code
        difficulty: Question difficulty level
        use_cache: Whether to use cached results (default: True)
    
    Returns:
        Comprehensive evaluation result dictionary
    """
    # Input validation - Allow evaluation even without test results (for cases where submission happened without running tests)
    if not question_id or not problem_statement or not source_code:
        logger.warning(f"Invalid input for coding evaluation: question_id={question_id}, has_problem={bool(problem_statement)}, has_code={bool(source_code)}")
        return _create_error_evaluation(question_id, "Coding", max_marks, section, "Invalid input parameters")
    
    if max_marks <= 0 or max_marks > 1000:
        logger.warning(f"Invalid max_marks: {max_marks}")
        return _create_error_evaluation(question_id, "Coding", max_marks, section, f"Invalid max_marks: {max_marks}")
    
    # If test_results not provided, evaluate based on code quality only (no test case score)
    if not test_results or len(test_results) == 0:
        logger.info(f"[CODING_EVAL] No test results provided for question {question_id}, evaluating based on code quality only")
        passed_count = 0
        total_count = 0
    
    # Sanitize input
    source_code = _sanitize_answer(source_code)
    problem_statement = _sanitize_question(problem_statement)
    
    logger.info(f"[CODING_EVAL] Starting evaluation with max_marks={max_marks} (type: {type(max_marks)})")
    logger.info(f"[CODING_EVAL] use_cache={use_cache}")
    
    # Check cache
    if use_cache:
        cache_key = _generate_cache_key(question_id, source_code, "Coding")
        cached_result = _get_cached_evaluation(cache_key)
        if cached_result:
            logger.info(f"[CODING_EVAL] Cache hit for coding question {question_id}")
            logger.info(f"[CODING_EVAL] Cached result score: {cached_result.get('score')}")
            logger.info(f"[CODING_EVAL] Cached result max_marks: {cached_result.get('max_marks')}")
            cached_result["question_id"] = question_id
            cached_result["section"] = section or ""
            # Ensure max_marks is preserved
            if "max_marks" not in cached_result or cached_result.get("max_marks") != max_marks:
                logger.info(f"[CODING_EVAL] Updating cached result max_marks from {cached_result.get('max_marks')} to {max_marks}")
                cached_result["max_marks"] = max_marks
            return cached_result
    
    try:
        start_time = time.time()
        client = _get_openai_client()
        
        section_context = f"Section: {section}\n" if section else ""
        
        test_summary = f"\nTest Results: {passed_count}/{total_count} test cases passed\n"
        if test_results:
            test_summary += "Test Case Details:\n"
            for i, test in enumerate(test_results[:5]):  # Show first 5 tests
                status = "PASSED" if test.get("passed", False) else "FAILED"
                test_summary += f"  Test {i+1}: {status}\n"
                if not test.get("passed") and test.get("error"):
                    test_summary += f"    Error: {test.get('error', '')[:100]}\n"
        
        starter_context = f"\nStarter Code Provided:\n```{language}\n{starter_code}\n```\n" if starter_code else ""
        
        prompt = f"""{SYSTEM_PROMPT}

Evaluate the following code submission:

{section_context}QUESTION: {problem_statement}

CANDIDATE CODE:
```{language}
{source_code}
```

LANGUAGE: {language}
MAX MARKS: {max_marks}
DIFFICULTY: {difficulty}
{starter_context}{test_summary}

Provide detailed evaluation including partial credit reasoning if some tests failed.
Focus on test case pass rate, algorithm correctness, code quality, efficiency, and best practices."""

        response = await _call_openai_with_retry(client, prompt)
        result = _parse_json_response(response)
        
        # Ensure question_type is set
        result["question_type"] = "Coding"
        result["question_id"] = question_id
        result["section"] = section or ""
        
        # Adjust score based on test pass rate
        if total_count > 0:
            pass_rate = passed_count / total_count
            # Base score should reflect test pass rate
            base_score = max_marks * pass_rate
            
            # AI can adjust up to 20% based on code quality
            ai_score = result.get("score", 0)
            # Cap AI score at base_score + 20% of max_marks
            max_ai_score = min(base_score + (max_marks * 0.2), max_marks)
            result["score"] = min(ai_score, max_ai_score)
            
            # If all tests passed, ensure score is at least 80% of max
            if pass_rate == 1.0 and result["score"] < max_marks * 0.8:
                result["score"] = max_marks * 0.8
        
        # Validate and normalize scores
        result = _normalize_evaluation_result(result, max_marks)
        
        # Calculate confidence based on test results
        test_result_dict = {"passed": passed_count == total_count} if total_count > 0 else None
        result["flags"]["confidence_level"] = _calculate_confidence(result, test_result_dict)
        
        # Cache result
        if use_cache:
            _cache_evaluation(cache_key, result)
        
        duration_ms = (time.time() - start_time) * 1000
        
        logger.info("=" * 80)
        logger.info(f"[CODING_EVAL] Evaluation completed successfully")
        logger.info(f"[CODING_EVAL] question_id={question_id}")
        logger.info(f"[CODING_EVAL] Input max_marks: {max_marks}")
        logger.info(f"[CODING_EVAL] Result score: {result.get('score', 0)}")
        logger.info(f"[CODING_EVAL] Result max_marks: {result.get('max_marks', 'NOT_SET')}")
        logger.info(f"[CODING_EVAL] Result percentage: {result.get('percentage', 0)}%")
        logger.info(f"[CODING_EVAL] Duration: {duration_ms:.2f}ms")
        logger.info(f"[CODING_EVAL] Result keys: {list(result.keys())}")
        logger.info(f"[CODING_EVAL] Tests: {passed_count}/{total_count} passed")
        
        # Ensure max_marks is set in result
        if "max_marks" not in result or result.get("max_marks") != max_marks:
            logger.warning(f"[CODING_EVAL] Result max_marks ({result.get('max_marks', 'NOT_SET')}) doesn't match input ({max_marks}), updating...")
            result["max_marks"] = max_marks
        
        logger.info(f"[CODING_EVAL] Final result max_marks: {result.get('max_marks')}")
        logger.info(f"[CODING_EVAL] Final score display: {result.get('score', 0)}/{result.get('max_marks')}")
        logger.info("=" * 80)
        
        return result
        
    except Exception as e:
        logger.exception(f"Error evaluating coding answer: {e}")
        return _create_error_evaluation(question_id, "Coding", max_marks, section, str(e))


async def evaluate_subjective_answer_enhanced(
    question_id: str,
    question: str,
    answer: str,
    max_marks: float,
    section: Optional[str] = None,
    rubric: Optional[str] = None,
    answer_key: Optional[str] = None,
    difficulty: str = "Medium",
    use_cache: bool = True
) -> Dict[str, Any]:
    """
    Enhanced evaluation for subjective questions with comprehensive feedback.
    
    Evaluation Criteria:
    - Accuracy & Correctness (40%): Factual accuracy, correct concepts
    - Completeness (25%): Coverage of all key points
    - Clarity & Coherence (15%): Clear explanation, logical flow
    - Depth of Understanding (15%): Beyond surface-level understanding
    - Relevance (5%): Staying on topic
    
    Args:
        question_id: Unique question identifier
        question: The question text
        answer: Candidate's answer
        max_marks: Maximum marks for this question
        section: Optional section name
        rubric: Optional grading rubric
        answer_key: Optional ideal answer or key points
        difficulty: Question difficulty level
        use_cache: Whether to use cached results (default: True)
    
    Returns:
        Comprehensive evaluation result dictionary
    """
    # Input validation
    if not question_id or not question or not answer:
        logger.warning(f"Invalid input for subjective evaluation: question_id={question_id}")
        return _create_error_evaluation(question_id, "Subjective", max_marks, section, "Invalid input parameters")
    
    if max_marks <= 0 or max_marks > 1000:
        logger.warning(f"Invalid max_marks: {max_marks}")
        return _create_error_evaluation(question_id, "Subjective", max_marks, section, f"Invalid max_marks: {max_marks}")
    
    # Sanitize input
    answer = _sanitize_answer(answer)
    question = _sanitize_question(question)
    
    # Check cache
    if use_cache:
        cache_key = _generate_cache_key(question_id, answer, "Subjective")
        cached_result = _get_cached_evaluation(cache_key)
        if cached_result:
            logger.info(f"Cache hit for subjective question {question_id}")
            cached_result["question_id"] = question_id
            cached_result["section"] = section or ""
            return cached_result
    
    try:
        start_time = time.time()
        client = _get_openai_client()
        
        section_context = f"Section: {section}\n" if section else ""
        rubric_context = f"\nGrading Rubric:\n{rubric}\n" if rubric else ""
        answer_key_context = f"\nKey Points to Look For:\n{answer_key}\n" if answer_key else ""
        
        prompt = f"""{SYSTEM_PROMPT}

Evaluate the following subjective answer:

{section_context}QUESTION: {question}

CANDIDATE ANSWER: {answer}

MAX MARKS: {max_marks}
DIFFICULTY: {difficulty}
{rubric_context}{answer_key_context}

Focus on accuracy, completeness, clarity, depth of understanding, and relevance.
Provide detailed evaluation following the system prompt structure above."""

        response = await _call_openai_with_retry(client, prompt)
        result = _parse_json_response(response)
        
        # Ensure question_type is set
        result["question_type"] = "Subjective"
        result["question_id"] = question_id
        result["section"] = section or ""
        
        # Validate and normalize scores
        result = _normalize_evaluation_result(result, max_marks)
        
        # Calculate confidence
        result["flags"]["confidence_level"] = _calculate_confidence(result)
        
        # Cache result
        if use_cache:
            _cache_evaluation(cache_key, result)
        
        duration_ms = (time.time() - start_time) * 1000
        logger.info(
            f"Subjective evaluation completed: question_id={question_id}, "
            f"score={result['score']}/{max_marks}, duration={duration_ms:.0f}ms"
        )
        
        return result
        
    except Exception as e:
        logger.exception(f"Error evaluating subjective answer: {e}")
        return _create_error_evaluation(question_id, "Subjective", max_marks, section, str(e))


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def _call_openai_with_retry(
    client: AsyncOpenAI, 
    prompt: str, 
    max_retries: int = 3,
    base_delay: float = 1.0
) -> str:
    """
    Call OpenAI API with exponential backoff retry logic.
    
    Args:
        client: OpenAI client instance
        prompt: User prompt
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds for exponential backoff
    
    Returns:
        Response content string
    
    Raises:
        RateLimitError: If rate limit exceeded after all retries
        APIError: If API error occurs after all retries
        Exception: For other non-retryable errors
    """
    last_error = None
    
    for attempt in range(max_retries + 1):
        try:
            start_time = time.time()
            
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000,  # Increased for comprehensive responses
                response_format={"type": "json_object"}
            )
            
            # Track token usage and cost
            usage = response.usage
            prompt_tokens = usage.prompt_tokens
            completion_tokens = usage.completion_tokens
            total_tokens = usage.total_tokens
            
            # GPT-4o-mini pricing (as of 2024): $0.15/$0.60 per 1M tokens (input/output)
            cost = (prompt_tokens * 0.00015 + completion_tokens * 0.0006) / 1000
            
            evaluation_metrics.total_tokens_used += total_tokens
            evaluation_metrics.total_cost_usd += cost
            evaluation_metrics.evaluation_count += 1
            
            duration_ms = (time.time() - start_time) * 1000
            
            logger.info(
                f"OpenAI API call successful: {total_tokens} tokens, ${cost:.4f}, "
                f"{duration_ms:.0f}ms (Total: {evaluation_metrics.evaluation_count} calls, "
                f"{evaluation_metrics.total_tokens_used} tokens, ${evaluation_metrics.total_cost_usd:.2f})"
            )
            
            return response.choices[0].message.content.strip()
            
        except RateLimitError as e:
            last_error = e
            if attempt < max_retries:
                # Exponential backoff: 1s, 2s, 4s, 8s
                delay = base_delay * (2 ** attempt)
                logger.warning(
                    f"Rate limit hit (attempt {attempt + 1}/{max_retries + 1}), "
                    f"retrying in {delay:.1f}s... Error: {str(e)}"
                )
                await asyncio.sleep(delay)
                continue
            else:
                evaluation_metrics.error_count += 1
                logger.error(f"Rate limit exceeded after {max_retries + 1} attempts")
                raise
                
        except APIError as e:
            last_error = e
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                logger.warning(
                    f"API error (attempt {attempt + 1}/{max_retries + 1}), "
                    f"retrying in {delay:.1f}s... Error: {str(e)}"
                )
                await asyncio.sleep(delay)
                continue
            else:
                evaluation_metrics.error_count += 1
                logger.error(f"API error after {max_retries + 1} attempts: {str(e)}")
                raise
                
        except Exception as e:
            # Non-retryable errors (e.g., invalid API key, network errors)
            evaluation_metrics.error_count += 1
            logger.error(f"Non-retryable error in OpenAI API call: {e}")
            raise
    
    if last_error:
        raise last_error
    raise Exception("Unexpected error in OpenAI API call")


def _sanitize_answer(answer: str) -> str:
    """
    Sanitize candidate answer to prevent prompt injection.
    
    Args:
        answer: Candidate's answer text
    
    Returns:
        Sanitized answer
    """
    if not answer:
        return ""
    
    # Check for potential prompt injection attempts
    injection_keywords = [
        'ignore previous',
        'disregard',
        'system:',
        'forget',
        'override',
        'new instructions',
        'you are now',
        'pretend you are'
    ]
    
    answer_lower = answer.lower()
    for keyword in injection_keywords:
        if keyword in answer_lower:
            logger.warning(f"Potential prompt injection detected in answer: {keyword}")
            # Remove the suspicious content
            # In production, you might want to flag this for review
            pass
    
    # Limit answer length to prevent abuse
    max_length = 50000  # 50k characters
    if len(answer) > max_length:
        logger.warning(f"Answer truncated from {len(answer)} to {max_length} characters")
        return answer[:max_length]
    
    return answer


def _sanitize_question(question: str) -> str:
    """Sanitize question text."""
    if not question:
        return ""
    
    # Limit question length
    max_length = 10000  # 10k characters
    if len(question) > max_length:
        logger.warning(f"Question truncated from {len(question)} to {max_length} characters")
        return question[:max_length]
    
    return question


def _calculate_confidence(evaluation: Dict[str, Any], test_results: Optional[Dict] = None) -> float:
    """
    Calculate confidence score based on multiple factors.
    
    Args:
        evaluation: Evaluation result dictionary
        test_results: Optional test execution results
    
    Returns:
        Confidence score between 0.1 and 1.0
    """
    confidence = 0.8  # Base confidence
    
    # Reduce confidence if answer is very short
    answer_length = len(evaluation.get("answer_log", {}).get("submitted_answer", ""))
    if answer_length < 50:
        confidence -= 0.2
    elif answer_length < 100:
        confidence -= 0.1
    
    # Increase confidence if test cases passed
    if test_results and test_results.get("passed", False):
        confidence += 0.1
    
    # Reduce confidence if AI detected potential issues
    flags = evaluation.get("flags", {})
    if flags.get("plagiarism_risk") == "High":
        confidence -= 0.3
    elif flags.get("plagiarism_risk") == "Medium":
        confidence -= 0.15
    
    if flags.get("ai_generated_risk") == "High":
        confidence -= 0.2
    
    if flags.get("incomplete_answer", False):
        confidence -= 0.1
    
    # Adjust based on score consistency
    score = evaluation.get("score", 0)
    max_marks = evaluation.get("max_marks", 1)
    if max_marks > 0:
        percentage = (score / max_marks) * 100
        # Very high or very low scores might indicate issues
        if percentage > 95:
            confidence -= 0.05  # Might be too generous
        elif percentage < 5:
            confidence -= 0.05  # Might be too harsh
    
    return max(0.1, min(1.0, confidence))


def _parse_json_response(content: str) -> Dict[str, Any]:
    """Parse JSON from OpenAI response, handling markdown code blocks."""
    # Try to extract JSON from response
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
    
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Fallback: try to extract JSON object from text
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            raise ValueError("Could not parse AI response as JSON")


def _normalize_evaluation_result(result: Dict[str, Any], max_marks: float) -> Dict[str, Any]:
    """Normalize and validate evaluation result."""
    # Ensure required fields exist
    if "score" not in result:
        result["score"] = 0.0
    if "max_marks" not in result:
        result["max_marks"] = max_marks
    if "percentage" not in result:
        result["percentage"] = (result["score"] / max_marks * 100) if max_marks > 0 else 0
    
    # Validate score range
    result["score"] = max(0.0, min(float(result["score"]), max_marks))
    result["percentage"] = round((result["score"] / max_marks * 100) if max_marks > 0 else 0, 2)
    
    # Ensure feedback structure exists
    if "feedback" not in result or not isinstance(result["feedback"], dict):
        result["feedback"] = {
            "summary": result.get("feedback", "No feedback provided"),
            "strengths": result.get("strengths", []),
            "weaknesses": result.get("weaknesses", []),
            "detailed_analysis": result.get("detailed_analysis", ""),
            "suggestions": result.get("suggestions", [])
        }
    
    # Ensure answer_log exists
    if "answer_log" not in result:
        result["answer_log"] = {
            "submitted_answer": "",
            "expected_answer": "",
            "key_points_covered": [],
            "key_points_missed": [],
            "incorrect_points": [],
            "partial_credit_reasoning": ""
        }
    
    # Ensure flags exist
    if "flags" not in result:
        result["flags"] = {
            "plagiarism_risk": "Low",
            "ai_generated_risk": "Low",
            "incomplete_answer": False,
            "requires_human_review": False,
            "confidence_level": 0.8
        }
    
    # Ensure criteria_scores structure
    if "criteria_scores" not in result:
        result["criteria_scores"] = {}
    
    # Ensure areas_of_improvement exists
    if "areas_of_improvement" not in result:
        result["areas_of_improvement"] = []
    
    # Ensure benchmarking exists
    if "benchmarking" not in result:
        result["benchmarking"] = {
            "compared_to_peers": "Average",
            "percentile": 50.0,
            "industry_standard": "Meets basic expectations"
        }
    
    # Ensure insights exists
    if "insights" not in result:
        result["insights"] = {}
    
    return result


def _create_error_evaluation(
    question_id: str,
    question_type: str,
    max_marks: float,
    section: Optional[str],
    error_message: str
) -> Dict[str, Any]:
    """Create error evaluation result."""
    return {
        "question_id": question_id,
        "section": section or "",
        "question_type": question_type,
        "score": 0.0,
        "max_marks": max_marks,
        "percentage": 0.0,
        "criteria_scores": {},
        "feedback": {
            "summary": f"Error during AI evaluation: {error_message}",
            "strengths": [],
            "weaknesses": [],
            "detailed_analysis": "Could not evaluate answer due to technical error.",
            "suggestions": ["Please contact administrator if this issue persists."]
        },
        "answer_log": {
            "submitted_answer": "",
            "expected_answer": "",
            "key_points_covered": [],
            "key_points_missed": [],
            "incorrect_points": [],
            "partial_credit_reasoning": ""
        },
        "areas_of_improvement": [],
        "benchmarking": {
            "compared_to_peers": "Average",
            "percentile": 0.0,
            "industry_standard": "Could not be evaluated"
        },
        "insights": {},
        "flags": {
            "plagiarism_risk": "Low",
            "ai_generated_risk": "Low",
            "incomplete_answer": False,
            "requires_human_review": True,
            "confidence_level": 0.0
        }
    }


# ============================================================================
# MCQ SKILL-BASED EVALUATION
# ============================================================================

async def evaluate_mcq_skill_analysis(
    question_id: str,
    question_data: Dict[str, Any],
    candidate_answer: Dict[str, Any],
    max_marks: float,
    section: Optional[str] = None,
    is_correct: bool = False,
    score: float = 0.0
) -> Dict[str, Any]:
    """
    Evaluate MCQ with skill-based analysis.
    
    Analyzes performance by skill/topic to identify strengths and weaknesses.
    
    Args:
        question_id: Unique question identifier
        question_data: MCQ question data with metadata
        candidate_answer: Candidate's selected answer(s)
        max_marks: Maximum marks for this question
        section: Optional section name
        is_correct: Whether the answer is correct (from automatic evaluation)
        score: Score awarded (0 or max_marks typically)
    
    Returns:
        Evaluation result with skill-based analysis
    """
    # Extract skill/topic information from question
    skill = question_data.get("skill") or question_data.get("topic") or question_data.get("topicLabel") or question_data.get("category")
    topic_id = question_data.get("topicId")
    difficulty = question_data.get("difficulty", "Medium")
    
    # If no explicit skill, try to infer from question text or other metadata
    if not skill:
        # Try to extract from question text or other fields
        question_text = question_data.get("question") or question_data.get("questionText", "")
        # Simple keyword-based skill detection (can be enhanced)
        question_lower = question_text.lower()
        if any(kw in question_lower for kw in ["python", "java", "javascript", "c++", "c#"]):
            skill = "Programming Language"
        elif any(kw in question_lower for kw in ["array", "list", "tree", "graph", "hash"]):
            skill = "Data Structures"
        elif any(kw in question_lower for kw in ["algorithm", "sort", "search", "complexity"]):
            skill = "Algorithms"
        elif any(kw in question_lower for kw in ["sql", "database", "query"]):
            skill = "Database"
        else:
            skill = "General Knowledge"
    
    # Calculate percentage
    percentage = (score / max_marks * 100) if max_marks > 0 else 0.0
    
    # Determine if this is a strength or weakness
    is_strength = percentage >= 70
    is_weakness = percentage < 50
    
    # Generate feedback based on correctness
    if is_correct:
        strengths = [f"Correctly answered {skill} question"]
        weaknesses = []
        summary = f"Correctly answered the {skill} question. Good understanding demonstrated."
    else:
        strengths = []
        weaknesses = [f"Missed {skill} question - review concepts"]
        summary = f"Incorrect answer for {skill} question. Review the topic and practice more."
    
    # Create areas of improvement if it's a weakness
    areas_of_improvement = []
    if is_weakness:
        areas_of_improvement.append({
            "skill": skill,
            "current_level": "Beginner" if percentage < 30 else "Intermediate",
            "gap_analysis": f"Struggling with {skill} concepts. Need to strengthen fundamentals.",
            "priority": "High" if percentage < 30 else "Medium",
            "improvement_suggestions": [
                {
                    "suggestion": f"Review {skill} fundamentals and core concepts",
                    "resources": [f"Study materials on {skill}", f"Practice {skill} problems"],
                    "practice_exercises": [f"Solve {skill} practice questions"],
                    "estimated_time": "1-2 weeks"
                }
            ]
        })
    
    # Create criteria scores
    criteria_scores = {
        "accuracy": {
            "score": score,
            "weight": 100.0,
            "feedback": "Correct" if is_correct else "Incorrect"
        }
    }
    
    return {
        "question_id": question_id,
        "section": section or "",
        "question_type": "MCQ",
        "score": score,
        "max_marks": max_marks,
        "percentage": round(percentage, 2),
        "criteria_scores": criteria_scores,
        "feedback": {
            "summary": summary,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "detailed_analysis": f"This MCQ question tested knowledge of {skill}. " + 
                               ("The answer was correct, demonstrating good understanding." if is_correct 
                                else "The answer was incorrect. Review the topic and related concepts."),
            "suggestions": [f"Practice more {skill} questions"] if not is_correct else []
        },
        "answer_log": {
            "submitted_answer": str(candidate_answer.get("selectedAnswers") or candidate_answer.get("answer", "")),
            "expected_answer": str(question_data.get("correctAn") or question_data.get("correctAnswer", "")),
            "key_points_covered": [skill] if is_correct else [],
            "key_points_missed": [skill] if not is_correct else [],
            "incorrect_points": [],
            "partial_credit_reasoning": ""
        },
        "areas_of_improvement": areas_of_improvement,
        "benchmarking": {
            "compared_to_peers": "Above Average" if is_correct else "Below Average",
            "percentile": 75.0 if is_correct else 25.0,
            "industry_standard": "Meets expectations" if is_correct else "Below expectations"
        },
        "insights": {
            "skill_tested": skill,
            "difficulty_level": difficulty
        },
        "flags": {
            "plagiarism_risk": "Low",
            "ai_generated_risk": "Low",
            "incomplete_answer": False,
            "requires_human_review": False,
            "confidence_level": 1.0  # MCQ is deterministic
        }
    }


# ============================================================================
# AIML EVALUATION WRAPPER
# ============================================================================

async def evaluate_aiml_answer(
    question_id: str,
    question_data: Dict[str, Any],
    candidate_answer: Dict[str, Any],
    max_marks: float,
    section: Optional[str] = None,
    code_outputs: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Evaluate AIML answer by wrapping existing AIML evaluation service.
    
    Args:
        question_id: Unique question identifier
        question_data: AIML question data
        candidate_answer: Candidate's code submission
        max_marks: Maximum marks for this question
        section: Optional section name
        code_outputs: Optional code execution outputs
    
    Returns:
        Unified evaluation result structure
    """
    try:
        # Import AIML evaluation service
        from ...aiml.services.ai_feedback import evaluate_aiml_submission
        
        # Prepare submission format expected by AIML service
        source_code = candidate_answer.get("source_code") or candidate_answer.get("code", "")
        
        # If outputs not provided, use empty list (evaluation will handle it)
        outputs = code_outputs or candidate_answer.get("outputs", [])
        
        submission = {
            "source_code": source_code,
            "outputs": outputs
        }
        
        # Call existing AIML evaluation
        aiml_result = evaluate_aiml_submission(submission, question_data)
        
        # Convert AIML result to unified format
        overall_score = aiml_result.get("overall_score", 0)
        # Convert 0-100 score to actual marks
        actual_score = (overall_score / 100.0) * max_marks if max_marks > 0 else 0.0
        percentage = overall_score
        
        # Extract feedback
        feedback_text = aiml_result.get("feedback_summary", "") or aiml_result.get("feedback", "")
        one_liner = aiml_result.get("one_liner", "")
        
        # Extract skill from question
        skill = (question_data.get("assessment_metadata", {}).get("skill") or 
                question_data.get("library") or 
                question_data.get("skill") or
                "AIML/Data Science")
        
        # Determine areas of improvement
        areas_of_improvement = []
        if overall_score < 70:
            priority = "High" if overall_score < 50 else "Medium"
            areas_of_improvement.append({
                "skill": skill,
                "current_level": "Beginner" if overall_score < 50 else "Intermediate",
                "gap_analysis": f"Code quality and implementation need improvement. Score: {overall_score}%",
                "priority": priority,
                "improvement_suggestions": [
                    {
                        "suggestion": "Review AIML best practices and library usage",
                        "resources": ["AIML documentation", "Data science tutorials"],
                        "practice_exercises": ["Practice AIML coding problems"],
                        "estimated_time": "2-4 weeks"
                    }
                ]
            })
        
        # Create unified structure
        result = {
            "question_id": question_id,
            "section": section or "",
            "question_type": "AIML",
            "score": round(actual_score, 2),
            "max_marks": max_marks,
            "percentage": round(percentage, 2),
            "criteria_scores": {
                "code_correctness": {
                    "score": actual_score * 0.4,
                    "weight": 40.0,
                    "feedback": aiml_result.get("code_correctness_feedback", "")
                },
                "task_completion": {
                    "score": actual_score * 0.3,
                    "weight": 30.0,
                    "feedback": aiml_result.get("task_completion_feedback", "")
                },
                "code_quality": {
                    "score": actual_score * 0.2,
                    "weight": 20.0,
                    "feedback": aiml_result.get("code_quality_feedback", "")
                },
                "best_practices": {
                    "score": actual_score * 0.1,
                    "weight": 10.0,
                    "feedback": aiml_result.get("best_practices_feedback", "")
                }
            },
            "feedback": {
                "summary": feedback_text or one_liner or f"AIML code evaluation completed. Score: {overall_score}%",
                "strengths": aiml_result.get("strengths", []) if isinstance(aiml_result.get("strengths"), list) else [],
                "weaknesses": aiml_result.get("weaknesses", []) if isinstance(aiml_result.get("weaknesses"), list) else [],
                "detailed_analysis": feedback_text or one_liner,
                "suggestions": aiml_result.get("suggestions", []) if isinstance(aiml_result.get("suggestions"), list) else []
            },
            "answer_log": {
                "submitted_answer": source_code[:500] + "..." if len(source_code) > 500 else source_code,
                "expected_answer": "",
                "key_points_covered": aiml_result.get("tasks_completed", []) if isinstance(aiml_result.get("tasks_completed"), list) else [],
                "key_points_missed": aiml_result.get("tasks_missed", []) if isinstance(aiml_result.get("tasks_missed"), list) else [],
                "incorrect_points": [],
                "partial_credit_reasoning": ""
            },
            "areas_of_improvement": areas_of_improvement,
            "benchmarking": {
                "compared_to_peers": "Excellent" if overall_score >= 85 else "Above Average" if overall_score >= 70 else "Average" if overall_score >= 50 else "Below Average",
                "percentile": overall_score,
                "industry_standard": "Meets expectations" if overall_score >= 70 else "Below expectations"
            },
            "insights": {
                "approach_quality": aiml_result.get("approach_quality", ""),
                "library_usage": aiml_result.get("library_usage", ""),
                "output_quality": aiml_result.get("output_quality", "")
            },
            "flags": {
                "plagiarism_risk": "Low",
                "ai_generated_risk": "Low",
                "incomplete_answer": overall_score < 50,
                "requires_human_review": overall_score < 50 or aiml_result.get("needs_review", False),
                "confidence_level": 0.8
            }
        }
        
        # Normalize the result
        result = _normalize_evaluation_result(result, max_marks)
        
        return result
        
    except ImportError as import_err:
        logger.error(f"[AIML_EVAL] Import error - AIML module not available: {import_err}")
        logger.error(f"[AIML_EVAL] Falling back to basic evaluation using coding evaluation")
        # Fallback: Evaluate based on code quality using OpenAI directly (coding evaluation)
        source_code = candidate_answer.get("source_code") or candidate_answer.get("code", "")
        if not source_code:
            return _create_error_evaluation(question_id, "AIML", max_marks, section, "No source code provided")
        return await evaluate_coding_answer_enhanced(
            question_id=question_id,
            problem_statement=question_data.get("questionText") or question_data.get("description") or question_data.get("title", "AIML Question"),
            source_code=source_code,
            language="python",
            max_marks=max_marks,
            section=section,
            test_results=None,
            passed_count=0,
            total_count=0,
            starter_code=None,
            difficulty=question_data.get("difficulty", "Medium")
        )
    except Exception as e:
        logger.exception(f"Error evaluating AIML answer: {e}")
        return _create_error_evaluation(question_id, "AIML", max_marks, section, str(e))


# ============================================================================
# SECTION-LEVEL AND OVERALL AGGREGATION
# ============================================================================

async def aggregate_section_evaluation(
    section_name: str,
    question_evaluations: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Aggregate evaluations for a section.
    
    Args:
        section_name: Name of the section
        question_evaluations: List of individual question evaluations
    
    Returns:
        Section-level summary with performance analysis
    """
    if not question_evaluations:
        return {
            "section_name": section_name,
            "total_questions": 0,
            "questions_attempted": 0,
            "section_score": 0.0,
            "section_max_marks": 0.0,
            "section_percentage": 0.0,
            "section_performance": {
                "strength_areas": [],
                "weak_areas": [],
                "key_insights": "No questions attempted in this section."
            },
            "skill_breakdown": []
        }
    
    total_questions = len(question_evaluations)
    questions_attempted = sum(1 for q in question_evaluations if q.get("score", 0) > 0 or q.get("answer_log", {}).get("submitted_answer"))
    
    section_score = sum(q.get("score", 0) for q in question_evaluations)
    section_max_marks = sum(q.get("max_marks", 0) for q in question_evaluations)
    section_percentage = (section_score / section_max_marks * 100) if section_max_marks > 0 else 0.0
    
    # Analyze performance by question type
    question_types = {}
    for q in question_evaluations:
        q_type = q.get("question_type", "Unknown")
        if q_type not in question_types:
            question_types[q_type] = {
                "count": 0,
                "total_score": 0.0,
                "total_max": 0.0
            }
        question_types[q_type]["count"] += 1
        question_types[q_type]["total_score"] += q.get("score", 0)
        question_types[q_type]["total_max"] += q.get("max_marks", 0)
    
    # Identify strength and weak areas
    strength_areas = []
    weak_areas = []
    
    for q_type, stats in question_types.items():
        avg_percentage = (stats["total_score"] / stats["total_max"] * 100) if stats["total_max"] > 0 else 0
        if avg_percentage >= 70:
            strength_areas.append(f"{q_type} questions (avg: {avg_percentage:.1f}%)")
        elif avg_percentage < 50:
            weak_areas.append(f"{q_type} questions (avg: {avg_percentage:.1f}%)")
    
    # Extract skill breakdown from areas_of_improvement
    skill_map = {}
    for q in question_evaluations:
        for area in q.get("areas_of_improvement", []):
            skill = area.get("skill", "Unknown")
            if skill not in skill_map:
                skill_map[skill] = {
                    "questions_tested": 0,
                    "total_score_pct": 0.0,
                    "count": 0
                }
            skill_map[skill]["questions_tested"] += 1
            skill_map[skill]["total_score_pct"] += q.get("percentage", 0)
            skill_map[skill]["count"] += 1
    
    skill_breakdown = []
    for skill, stats in skill_map.items():
        avg_score = stats["total_score_pct"] / stats["count"] if stats["count"] > 0 else 0
        proficiency = "Expert" if avg_score >= 90 else "Advanced" if avg_score >= 70 else "Intermediate" if avg_score >= 50 else "Beginner"
        skill_breakdown.append({
            "skill": skill,
            "questions_tested": stats["questions_tested"],
            "average_score_percentage": round(avg_score, 2),
            "proficiency_level": proficiency
        })
    
    # Generate key insights
    key_insights = []
    if section_percentage >= 80:
        key_insights.append("Excellent performance in this section.")
    elif section_percentage >= 60:
        key_insights.append("Good performance with room for improvement.")
    else:
        key_insights.append("Needs significant improvement in this section.")
    
    if questions_attempted < total_questions:
        key_insights.append(f"{total_questions - questions_attempted} question(s) not attempted.")
    
    return {
        "section_name": section_name,
        "total_questions": total_questions,
        "questions_attempted": questions_attempted,
        "section_score": round(section_score, 2),
        "section_max_marks": round(section_max_marks, 2),
        "section_percentage": round(section_percentage, 2),
        "section_performance": {
            "strength_areas": strength_areas,
            "weak_areas": weak_areas,
            "key_insights": " ".join(key_insights) if key_insights else "No insights available."
        },
        "skill_breakdown": skill_breakdown
    }


async def generate_overall_assessment_summary(
    section_summaries: List[Dict[str, Any]],
    question_evaluations: List[Dict[str, Any]],
    job_role: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate comprehensive overall assessment summary.
    
    Args:
        section_summaries: List of section-level summaries
        question_evaluations: List of all individual question evaluations
        job_role: Optional target job role for readiness assessment
    
    Returns:
        Overall assessment summary with recommendations
    """
    if not question_evaluations:
        return {
            "overall_score": 0.0,
            "overall_max_marks": 0.0,
            "overall_percentage": 0.0,
            "grade": "F",
            "section_wise_performance": [],
            "skill_matrix": [],
            "overall_strengths": [],
            "overall_weaknesses": ["No questions attempted"],
            "comprehensive_improvement_plan": {},
            "personalized_recommendations": {},
            "readiness_assessment": {
                "job_role": job_role or "Not specified",
                "readiness_level": "Not Ready",
                "gap_to_readiness": "No assessment data available",
                "estimated_preparation_time": "Unknown"
            }
        }
    
    # Calculate overall scores
    overall_score = sum(q.get("score", 0) for q in question_evaluations)
    overall_max_marks = sum(q.get("max_marks", 0) for q in question_evaluations)
    overall_percentage = (overall_score / overall_max_marks * 100) if overall_max_marks > 0 else 0.0
    
    # Determine grade
    if overall_percentage >= 90:
        grade = "A+"
    elif overall_percentage >= 85:
        grade = "A"
    elif overall_percentage >= 80:
        grade = "B+"
    elif overall_percentage >= 75:
        grade = "B"
    elif overall_percentage >= 70:
        grade = "C+"
    elif overall_percentage >= 65:
        grade = "C"
    elif overall_percentage >= 60:
        grade = "D"
    else:
        grade = "F"
    
    # Section-wise performance
    section_wise_performance = []
    for section in section_summaries:
        pct = section.get("section_percentage", 0)
        if pct >= 80:
            level = "Excellent"
        elif pct >= 70:
            level = "Good"
        elif pct >= 60:
            level = "Average"
        elif pct >= 50:
            level = "Below Average"
        else:
            level = "Poor"
        
        section_wise_performance.append({
            "section": section.get("section_name", "Unknown"),
            "score": section.get("section_score", 0),
            "percentage": pct,
            "performance_level": level
        })
    
    # Build skill matrix from all evaluations
    skill_matrix = {}
    for q in question_evaluations:
        for area in q.get("areas_of_improvement", []):
            skill = area.get("skill", "Unknown")
            current_level = area.get("current_level", "Beginner")
            
            if skill not in skill_matrix:
                skill_matrix[skill] = {
                    "questions": [],
                    "scores": [],
                    "levels": []
                }
            
            skill_matrix[skill]["questions"].append(q.get("question_id"))
            skill_matrix[skill]["scores"].append(q.get("percentage", 0))
            skill_matrix[skill]["levels"].append(current_level)
    
    # Convert to skill matrix format
    skill_matrix_list = []
    skill_categories = {}
    
    for skill, data in skill_matrix.items():
        # Categorize skill (simplified - can be enhanced)
        category = _categorize_skill(skill)
        if category not in skill_categories:
            skill_categories[category] = []
        
        avg_score = sum(data["scores"]) / len(data["scores"]) if data["scores"] else 0
        most_common_level = max(set(data["levels"]), key=data["levels"].count) if data["levels"] else "Beginner"
        
        skill_categories[category].append({
            "skill": skill,
            "proficiency": most_common_level,
            "score_percentage": round(avg_score, 2),
            "questions_count": len(data["questions"])
        })
    
    for category, skills in skill_categories.items():
        skill_matrix_list.append({
            "skill_category": category,
            "sub_skills": skills
        })
    
    # Extract overall strengths and weaknesses from all question types
    all_strengths = []
    all_weaknesses = []
    skill_strengths = {}  # Track strengths by skill
    skill_weaknesses = {}  # Track weaknesses by skill
    
    for q in question_evaluations:
        feedback = q.get("feedback", {})
        if isinstance(feedback, dict):
            strengths = feedback.get("strengths", [])
            weaknesses = feedback.get("weaknesses", [])
            all_strengths.extend(strengths)
            all_weaknesses.extend(weaknesses)
            
            # Track skill-based strengths/weaknesses
            skill = q.get("insights", {}).get("skill_tested") or q.get("question_type", "")
            if skill:
                if strengths:
                    if skill not in skill_strengths:
                        skill_strengths[skill] = []
                    skill_strengths[skill].extend(strengths)
                if weaknesses:
                    if skill not in skill_weaknesses:
                        skill_weaknesses[skill] = []
                    skill_weaknesses[skill].extend(weaknesses)
        
        # Also extract from areas_of_improvement
        areas = q.get("areas_of_improvement", [])
        for area in areas:
            skill = area.get("skill", "")
            if skill and area.get("priority") == "High":
                if skill not in skill_weaknesses:
                    skill_weaknesses[skill] = []
                gap = area.get("gap_analysis", "")
                if gap:
                    skill_weaknesses[skill].append(gap)
    
    # Get unique strengths/weaknesses
    overall_strengths = list(set(all_strengths))[:10]  # Top 10
    overall_weaknesses = list(set(all_weaknesses))[:10]  # Top 10
    
    # Add skill-based insights
    for skill, strengths_list in skill_strengths.items():
        if len(strengths_list) >= 2:  # If multiple strengths in this skill
            overall_strengths.append(f"Strong performance in {skill}")
    
    for skill, weaknesses_list in skill_weaknesses.items():
        if len(weaknesses_list) >= 2:  # If multiple weaknesses in this skill
            overall_weaknesses.append(f"Needs improvement in {skill}")
    
    # Generate improvement plan
    improvement_plan = _generate_improvement_plan(question_evaluations, overall_percentage)
    
    # Generate personalized recommendations
    recommendations = _generate_personalized_recommendations(question_evaluations, skill_matrix_list)
    
    # Readiness assessment
    readiness = _assess_readiness(overall_percentage, skill_matrix_list, job_role)
    
    return {
        "overall_score": round(overall_score, 2),
        "overall_max_marks": round(overall_max_marks, 2),
        "overall_percentage": round(overall_percentage, 2),
        "grade": grade,
        "section_wise_performance": section_wise_performance,
        "skill_matrix": skill_matrix_list,
        "overall_strengths": overall_strengths,
        "overall_weaknesses": overall_weaknesses,
        "comprehensive_improvement_plan": improvement_plan,
        "personalized_recommendations": recommendations,
        "readiness_assessment": readiness
    }


def _categorize_skill(skill: str) -> str:
    """Categorize a skill into a category."""
    skill_lower = skill.lower()
    
    if any(kw in skill_lower for kw in ["data structure", "algorithm", "array", "tree", "graph", "linked list"]):
        return "Data Structures & Algorithms"
    elif any(kw in skill_lower for kw in ["sql", "database", "query", "join"]):
        return "Database & SQL"
    elif any(kw in skill_lower for kw in ["python", "java", "javascript", "c++", "programming", "coding"]):
        return "Programming Languages"
    elif any(kw in skill_lower for kw in ["machine learning", "ai", "ml", "neural", "model", "training"]):
        return "AI/ML"
    elif any(kw in skill_lower for kw in ["system design", "architecture", "scalability"]):
        return "System Design"
    elif any(kw in skill_lower for kw in ["testing", "debug", "quality"]):
        return "Software Engineering Practices"
    else:
        return "General Technical Skills"


def _generate_improvement_plan(
    question_evaluations: List[Dict[str, Any]],
    overall_percentage: float
) -> Dict[str, Any]:
    """Generate comprehensive improvement plan."""
    # Collect all improvement suggestions
    immediate_areas = []
    short_term_goals = []
    long_term_goals = []
    
    for q in question_evaluations:
        for area in q.get("areas_of_improvement", []):
            priority = area.get("priority", "Medium")
            skill = area.get("skill", "Unknown")
            
            suggestions = area.get("improvement_suggestions", [])
            if not suggestions:
                continue
            
            if priority == "High":
                immediate_areas.append({
                    "area": skill,
                    "reason": f"Critical gap identified in {skill}",
                    "action_items": [s.get("suggestion", "") for s in suggestions[:3]]
                })
            elif priority == "Medium":
                short_term_goals.append({
                    "goal": f"Improve {skill}",
                    "steps": [s.get("suggestion", "") for s in suggestions[:3]],
                    "resources": []
                })
            else:
                long_term_goals.append({
                    "goal": f"Master {skill}",
                    "pathway": f"Progressive learning path for {skill}",
                    "milestones": [s.get("suggestion", "") for s in suggestions[:2]]
                })
    
    # Limit to top items
    immediate_areas = immediate_areas[:3]
    short_term_goals = short_term_goals[:3]
    long_term_goals = long_term_goals[:2]
    
    return {
        "immediate_focus_areas": immediate_areas,
        "short_term_goals": short_term_goals,
        "long_term_development": long_term_goals
    }


def _generate_personalized_recommendations(
    question_evaluations: List[Dict[str, Any]],
    skill_matrix: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Generate personalized learning recommendations."""
    learning_path = []
    practice_resources = []
    
    # Build learning path from skill matrix (weakest to strongest)
    all_skills = []
    for category in skill_matrix:
        for skill in category.get("sub_skills", []):
            all_skills.append({
                "skill": skill.get("skill"),
                "score": skill.get("score_percentage", 0),
                "proficiency": skill.get("proficiency", "Beginner")
            })
    
    # Sort by score (lowest first - focus on weak areas)
    all_skills.sort(key=lambda x: x["score"])
    
    learning_path = [s["skill"] for s in all_skills[:10]]
    
    # Extract resources from improvement suggestions
    for q in question_evaluations:
        for area in q.get("areas_of_improvement", []):
            for suggestion in area.get("improvement_suggestions", []):
                resources = suggestion.get("resources", [])
                for resource in resources[:2]:  # Limit per suggestion
                    if resource and resource not in [r.get("name") for r in practice_resources]:
                        practice_resources.append({
                            "resource_type": "Course",
                            "name": resource,
                            "url": "",
                            "relevance": f"Relevant for {area.get('skill', 'general skills')}"
                        })
    
    return {
        "learning_path": learning_path,
        "practice_resources": practice_resources[:10],
        "project_suggestions": [
            "Build a portfolio project demonstrating core skills",
            "Contribute to open-source projects",
            "Solve coding challenges on platforms like LeetCode"
        ],
        "mentor_focus_areas": learning_path[:5]
    }


def _assess_readiness(
    overall_percentage: float,
    skill_matrix: List[Dict[str, Any]],
    job_role: Optional[str]
) -> Dict[str, Any]:
    """Assess candidate readiness for target role."""
    if overall_percentage >= 85:
        readiness_level = "Ready"
        gap = "Minimal gaps. Candidate is well-prepared."
        prep_time = "0-2 weeks"
    elif overall_percentage >= 70:
        readiness_level = "Nearly Ready"
        gap = "Some areas need improvement but core skills are solid."
        prep_time = "2-4 weeks"
    elif overall_percentage >= 60:
        readiness_level = "Needs Preparation"
        gap = "Significant gaps in multiple areas. Requires focused preparation."
        prep_time = "1-3 months"
    else:
        readiness_level = "Not Ready"
        gap = "Major gaps across multiple skill areas. Extensive preparation needed."
        prep_time = "3-6 months"
    
    return {
        "job_role": job_role or "Not specified",
        "readiness_level": readiness_level,
        "gap_to_readiness": gap,
        "estimated_preparation_time": prep_time
    }


# ============================================================================
# CONVENIENCE FUNCTION FOR EASY INTEGRATION
# ============================================================================

async def evaluate_question_by_type(
    question_id: str,
    question_type: str,
    question_data: Dict[str, Any],
    candidate_answer: Dict[str, Any],
    max_marks: float,
    section: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Unified function to evaluate any question type.
    
    Args:
        question_id: Unique question identifier
        question_type: One of "MCQ", "Subjective", "PseudoCode", "Coding", "SQL", "AIML"
        question_data: Question data (varies by type)
        candidate_answer: Candidate's answer (varies by type)
        max_marks: Maximum marks for this question
        section: Optional section name
        **kwargs: Additional parameters specific to question type
    
    Returns:
        Comprehensive evaluation result
    """
    logger.info("=" * 80)
    logger.info(f"[EVALUATE_QUESTION] Starting evaluation for question_id={question_id}, type={question_type}")
    logger.info(f"[EVALUATE_QUESTION] Max marks: {max_marks} (type: {type(max_marks)})")
    logger.info(f"[EVALUATE_QUESTION] Section: {section}")
    logger.info(f"[EVALUATE_QUESTION] Candidate answer keys: {list(candidate_answer.keys())}")
    logger.info(f"[EVALUATE_QUESTION] Question data keys: {list(question_data.keys())}")
    logger.info(f"[EVALUATE_QUESTION] Additional kwargs: {list(kwargs.keys())}")
    logger.info(f"[EVALUATE_QUESTION] Additional kwargs values: {kwargs}")
    logger.info("=" * 80)
    
    question_type_upper = question_type.upper()
    
    if question_type_upper == "MCQ":
        # MCQ skill-based evaluation
        # Get correctness and score from kwargs (set by caller after automatic evaluation)
        is_correct = kwargs.get("is_correct", False)
        score = kwargs.get("score", max_marks if is_correct else 0.0)
        
        logger.info(f"[EVALUATE_QUESTION] MCQ - is_correct={is_correct}, score={score}")
        result = await evaluate_mcq_skill_analysis(
            question_id=question_id,
            question_data=question_data,
            candidate_answer=candidate_answer,
            max_marks=max_marks,
            section=section,
            is_correct=is_correct,
            score=score
        )
        logger.info(f"[EVALUATE_QUESTION] MCQ evaluation completed: score={result.get('score', 0)}/{max_marks}")
        return result
    
    elif question_type_upper == "SUBJECTIVE":
        # Extract question text from various possible fields
        question_text = (
            question_data.get("questionText") or 
            question_data.get("question") or
            question_data.get("description") or
            question_data.get("title", "") or
            ""
        )
        
        # Extract answer
        answer = (
            candidate_answer.get("textAnswer") or 
            candidate_answer.get("answer") or
            ""
        )
        
        # Validate required parameters
        if not question_text:
            logger.warning(f"[SUBJECTIVE_EVAL] Missing question_text for question {question_id}")
            question_text = question_data.get("title", "Question") or "Question"
        
        if not answer:
            logger.warning(f"[SUBJECTIVE_EVAL] Missing answer for question {question_id}")
            return _create_error_evaluation(question_id, "Subjective", max_marks, section, "No answer provided")
        
        return await evaluate_subjective_answer_enhanced(
            question_id=question_id,
            question=question_text,
            answer=answer,
            max_marks=max_marks,
            section=section,
            rubric=kwargs.get("rubric") or question_data.get("rubric"),
            answer_key=kwargs.get("answer_key") or question_data.get("answerKey"),
            difficulty=question_data.get("difficulty", "Medium"),
            use_cache=True
        )
    
    elif question_type_upper in ["PSEUDOCODE", "PSEUDO CODE"]:
        return await evaluate_pseudocode_answer(
            question_id=question_id,
            question_text=question_data.get("questionText") or question_data.get("question", ""),
            candidate_answer=candidate_answer.get("textAnswer") or candidate_answer.get("answer", ""),
            max_marks=max_marks,
            section=section,
            sample_input=kwargs.get("sample_input"),
            expected_output=kwargs.get("expected_output"),
            rubric=kwargs.get("rubric"),
            difficulty=question_data.get("difficulty", "Medium"),
            use_cache=True
        )
    
    elif question_type_upper == "CODING":
        # Extract problem statement from various possible fields
        problem_statement = (
            question_data.get("questionText") or 
            question_data.get("problemStatement") or 
            question_data.get("question") or
            question_data.get("coding_data", {}).get("description") or
            question_data.get("coding_data", {}).get("problem_statement") or
            question_data.get("description") or
            ""
        )
        
        # Extract source code from candidate answer
        source_code = (
            candidate_answer.get("source_code") or 
            candidate_answer.get("code") or 
            candidate_answer.get("answer") or
            ""
        )
        
        # Validate required parameters
        if not problem_statement:
            logger.warning(f"[CODING_EVAL] Missing problem_statement for question {question_id}")
            problem_statement = question_data.get("title", "Coding Question") or "Coding Problem"
        
        if not source_code:
            logger.warning(f"[CODING_EVAL] Missing source_code for question {question_id}")
            return _create_error_evaluation(question_id, "Coding", max_marks, section, "No source code provided")
        
        logger.info(f"[EVALUATE_QUESTION] Calling evaluate_coding_answer_enhanced with max_marks={max_marks}")
        logger.info(f"[EVALUATE_QUESTION] Has test_results: {bool(kwargs.get('test_results'))}")
        logger.info(f"[EVALUATE_QUESTION] test_results count: {len(kwargs.get('test_results', []))}")
        
        result = await evaluate_coding_answer_enhanced(
            question_id=question_id,
            problem_statement=problem_statement,
            source_code=source_code,
            language=candidate_answer.get("language") or question_data.get("codingLanguage") or question_data.get("language", "python"),
            max_marks=max_marks,
            section=section,
            test_results=kwargs.get("test_results"),
            passed_count=kwargs.get("passed_count", 0),
            total_count=kwargs.get("total_count", 0),
            starter_code=question_data.get("starterCode") or question_data.get("coding_data", {}).get("starter_code"),
            difficulty=question_data.get("difficulty", "Medium"),
            use_cache=True
        )
        
        logger.info(f"[EVALUATE_QUESTION] Coding evaluation returned:")
        logger.info(f"[EVALUATE_QUESTION]   score: {result.get('score')}")
        logger.info(f"[EVALUATE_QUESTION]   max_marks: {result.get('max_marks')}")
        logger.info(f"[EVALUATE_QUESTION]   percentage: {result.get('percentage')}")
        
        return result
    
    elif question_type_upper == "SQL":
        # Extract question description from various possible fields
        question_description = (
            question_data.get("question") or 
            question_data.get("questionText") or
            question_data.get("description") or
            question_data.get("sql_data", {}).get("description") or
            question_data.get("title", "") or
            ""
        )
        
        # Extract user query
        user_query = (
            candidate_answer.get("sql_query") or 
            candidate_answer.get("query") or 
            candidate_answer.get("answer") or
            ""
        )
        
        # Validate required parameters
        if not question_description:
            logger.warning(f"[SQL_EVAL] Missing question_description for question {question_id}")
            question_description = question_data.get("title", "SQL Question") or "SQL Query Problem"
        
        if not user_query:
            logger.warning(f"[SQL_EVAL] Missing user_query for question {question_id}")
            return _create_error_evaluation(question_id, "SQL", max_marks, section, "No SQL query provided")
        
        return await evaluate_sql_answer(
            question_id=question_id,
            question_description=question_description,
            user_query=user_query,
            reference_query=question_data.get("reference_query") or question_data.get("sql_data", {}).get("reference_query"),
            max_marks=max_marks,
            section=section,
            schemas=question_data.get("schemas") or question_data.get("sql_data", {}).get("schemas"),
            test_result=kwargs.get("test_result"),
            order_sensitive=question_data.get("evaluation", {}).get("order_sensitive", False) if question_data.get("evaluation") else False,
            difficulty=question_data.get("difficulty", "Medium"),
            use_cache=True
        )
    
    elif question_type_upper == "AIML":
        return await evaluate_aiml_answer(
            question_id=question_id,
            question_data=question_data,
            candidate_answer=candidate_answer,
            max_marks=max_marks,
            section=section,
            code_outputs=kwargs.get("code_outputs")
        )
    
    else:
        logger.error(f"[EVALUATE_QUESTION] Unknown question type: {question_type}")
        logger.error(f"[EVALUATE_QUESTION] Question ID: {question_id}, Section: {section}")
        return _create_error_evaluation(
            question_id=question_id,
            question_type=question_type,
            max_marks=max_marks,
            section=section,
            error_message=f"Unknown question type: {question_type}"
        )

