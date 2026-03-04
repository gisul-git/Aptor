"""
AI-powered code review service for PySpark solutions.
Provides comprehensive analysis of correctness, performance, and best practices.
"""

import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import structlog

from app.services.ai_service import get_ai_service, AIServiceError, RateLimitError, APIError
from app.models.execution import ExecutionResult, CodeReview
from app.core.redis_client import get_redis, CacheManager


logger = structlog.get_logger()


@dataclass
class ReviewMetrics:
    """Metrics for code review analysis."""
    analysis_time: float
    model_used: str
    tokens_used: Optional[int] = None
    cache_hit: bool = False


class CodeReviewError(Exception):
    """Base exception for code review errors."""
    pass


class CodeReviewer:
    """
    AI-powered code reviewer that provides comprehensive analysis of PySpark solutions.
    
    Features:
    - Correctness analysis with edge case detection
    - Performance optimization suggestions
    - Best practices assessment
    - Code quality evaluation
    - Alternative approach recommendations
    - Structured feedback with actionable insights
    """
    
    def __init__(self):
        self.logger = logger.bind(service="code_reviewer")
        self.ai_service = get_ai_service()
        self.cache_ttl = 3600 * 24  # Cache reviews for 24 hours
    
    async def review_solution(
        self,
        user_id: str,
        code: str,
        question_title: str,
        question_description: str,
        execution_result: ExecutionResult,
        question_difficulty: Optional[str] = None,
        question_topic: Optional[str] = None
    ) -> CodeReview:
        """
        Perform comprehensive AI-powered code review of a PySpark solution.
        
        Args:
            user_id: User identifier for rate limiting and caching
            code: User's PySpark code solution
            question_title: Title of the question being solved
            question_description: Detailed question description for context
            execution_result: Results from code execution including validation
            question_difficulty: Difficulty level (beginner, intermediate, advanced)
            question_topic: Topic area (transformations, joins, aggregations, etc.)
            
        Returns:
            Comprehensive code review with structured feedback
            
        Raises:
            CodeReviewError: If review generation fails
            RateLimitError: If rate limit is exceeded
        """
        start_time = time.time()
        
        self.logger.info(
            "Starting code review",
            user_id=user_id,
            question_title=question_title,
            code_length=len(code),
            execution_status=execution_result.status.value if execution_result else "unknown"
        )
        
        try:
            # Check cache first
            cache_key = self._generate_cache_key(code, question_title, execution_result)
            cached_review = await self._get_cached_review(cache_key)
            
            if cached_review:
                self.logger.info("Using cached code review", user_id=user_id)
                cached_review.analysis_time = time.time() - start_time
                return cached_review
            
            # Prepare execution context for AI review
            execution_context = self._prepare_execution_context(
                execution_result, question_difficulty, question_topic
            )
            
            # Generate enhanced prompt with additional context
            enhanced_prompt = self._create_enhanced_review_prompt(
                code, question_title, question_description, execution_context
            )
            
            # Get AI review
            ai_review_data = await self.ai_service.review_code(
                user_id=user_id,
                code=enhanced_prompt,  # Use enhanced prompt
                question_title=question_title,
                execution_result=execution_context
            )
            
            # Process and structure the review
            code_review = self._process_ai_review(ai_review_data, start_time)
            
            # Cache the review
            await self._cache_review(cache_key, code_review)
            
            self.logger.info(
                "Code review completed",
                user_id=user_id,
                overall_score=code_review.overall_score,
                analysis_time=code_review.analysis_time
            )
            
            return code_review
            
        except (RateLimitError, APIError) as e:
            # Re-raise AI service errors
            raise e
        except Exception as e:
            self.logger.error("Code review failed", user_id=user_id, error=str(e))
            raise CodeReviewError(f"Failed to generate code review: {str(e)}")
    
    def _generate_cache_key(self, code: str, question_title: str, execution_result: ExecutionResult) -> str:
        """Generate cache key for code review."""
        import hashlib
        
        # Create hash from code, question, and execution status
        content = f"{code}|{question_title}|{execution_result.status.value if execution_result else 'none'}"
        return f"code_review:{hashlib.sha256(content.encode()).hexdigest()[:16]}"
    
    async def _get_cached_review(self, cache_key: str) -> Optional[CodeReview]:
        """Get cached code review if available."""
        try:
            cached_data = await CacheManager.get_cache(cache_key)
            if cached_data:
                return CodeReview(**cached_data)
        except Exception as e:
            self.logger.warning("Failed to get cached review", error=str(e))
        return None
    
    async def _cache_review(self, cache_key: str, review: CodeReview) -> None:
        """Cache code review for future use."""
        try:
            await CacheManager.set_cache(
                cache_key, 
                review.model_dump(), 
                ttl=self.cache_ttl
            )
        except Exception as e:
            self.logger.warning("Failed to cache review", error=str(e))
    
    def _prepare_execution_context(
        self,
        execution_result: ExecutionResult,
        question_difficulty: Optional[str],
        question_topic: Optional[str]
    ) -> Dict[str, Any]:
        """Prepare execution context for AI review."""
        context = {
            "execution_successful": execution_result.status.value == "completed" if execution_result else False,
            "execution_time": execution_result.execution_time if execution_result else 0.0,
            "memory_usage": execution_result.memory_usage if execution_result else 0.0,
            "validation_passed": False,
            "validation_details": None
        }
        
        if execution_result and execution_result.validation_result:
            context.update({
                "validation_passed": execution_result.validation_result.is_correct,
                "schema_match": execution_result.validation_result.schema_match,
                "row_count_match": execution_result.validation_result.row_count_match,
                "data_match": execution_result.validation_result.data_match,
                "similarity_score": execution_result.validation_result.similarity_score,
                "validation_errors": [
                    {
                        "type": error.error_type,
                        "message": error.message,
                        "details": error.details
                    }
                    for error in execution_result.validation_result.error_details
                ] if execution_result.validation_result.error_details else []
            })
        
        if question_difficulty:
            context["difficulty_level"] = question_difficulty
        
        if question_topic:
            context["topic_area"] = question_topic
        
        return context
    
    def _create_enhanced_review_prompt(
        self,
        code: str,
        question_title: str,
        question_description: str,
        execution_context: Dict[str, Any]
    ) -> str:
        """Create enhanced prompt for more comprehensive code review."""
        
        # Analyze code patterns for targeted feedback
        code_patterns = self._analyze_code_patterns(code)
        
        prompt = f"""You are an expert data engineer and PySpark specialist providing comprehensive code review.

QUESTION CONTEXT:
Title: {question_title}
Description: {question_description}

USER'S CODE:
```python
{code}
```

EXECUTION CONTEXT:
{self._format_execution_context(execution_context)}

CODE ANALYSIS:
{self._format_code_patterns(code_patterns)}

REVIEW REQUIREMENTS:
Please provide a comprehensive review covering:

1. **CORRECTNESS ANALYSIS** (Requirements 5.1):
   - Verify solution correctness and logic
   - Identify potential edge cases and error handling
   - Check for proper data type handling
   - Assess null value handling

2. **PERFORMANCE OPTIMIZATION** (Requirements 5.2, 5.3):
   - Identify performance bottlenecks and inefficiencies
   - Suggest specific optimization techniques
   - Recommend better PySpark operations where applicable
   - Consider data partitioning and caching strategies

3. **BEST PRACTICES ASSESSMENT** (Requirements 5.4):
   - Evaluate adherence to PySpark best practices
   - Check code structure and readability
   - Assess error handling and robustness
   - Review variable naming and code organization

4. **IMPROVEMENT SUGGESTIONS** (Requirements 5.5):
   - Provide specific, actionable improvement recommendations
   - Include code examples demonstrating better approaches
   - Explain the reasoning behind each suggestion

5. **ALTERNATIVE APPROACHES** (Requirements 5.6):
   - Suggest alternative solution methods
   - Compare different approaches and their trade-offs
   - Recommend when to use each approach

Output Format (JSON):
{{
  "overall_score": 0.0-10.0,
  "correctness_feedback": "Detailed correctness analysis with specific observations",
  "performance_feedback": "Performance analysis with specific optimization suggestions",
  "best_practices_feedback": "Best practices assessment with specific recommendations",
  "improvement_suggestions": [
    "Specific, actionable suggestion 1",
    "Specific, actionable suggestion 2",
    "Specific, actionable suggestion 3"
  ],
  "code_examples": [
    {{
      "description": "Clear description of what this example demonstrates",
      "improved_code": "# Complete, runnable code example showing improvement",
      "explanation": "Detailed explanation of why this is better"
    }}
  ],
  "alternative_approaches": [
    {{
      "approach": "Alternative approach name",
      "description": "Detailed description of the alternative method",
      "code_example": "# Code example of alternative approach",
      "pros_cons": "When to use this approach and trade-offs"
    }}
  ],
  "strengths": [
    "Specific strength 1",
    "Specific strength 2"
  ],
  "areas_for_improvement": [
    "Specific area 1 with explanation",
    "Specific area 2 with explanation"
  ]
}}

Provide constructive, educational feedback that helps improve PySpark and data engineering skills.
"""
        return prompt
    
    def _analyze_code_patterns(self, code: str) -> Dict[str, Any]:
        """Analyze code patterns to provide targeted feedback."""
        patterns = {
            "has_imports": "import" in code.lower(),
            "uses_spark_session": "sparksession" in code.lower() or "spark =" in code.lower(),
            "uses_dataframe_ops": any(op in code.lower() for op in ["select", "filter", "groupby", "join", "withcolumn"]),
            "uses_sql": ".sql(" in code or "spark.sql" in code,
            "has_error_handling": "try:" in code or "except" in code,
            "uses_caching": ".cache()" in code or ".persist()" in code,
            "uses_window_functions": "window" in code.lower(),
            "uses_udfs": "udf" in code.lower() or "@udf" in code,
            "line_count": len(code.split('\n')),
            "has_comments": "#" in code,
            "uses_collect": ".collect()" in code,
            "uses_show": ".show()" in code
        }
        return patterns
    
    def _format_execution_context(self, context: Dict[str, Any]) -> str:
        """Format execution context for prompt."""
        lines = []
        lines.append(f"- Execution Status: {'Success' if context['execution_successful'] else 'Failed'}")
        lines.append(f"- Execution Time: {context['execution_time']:.2f} seconds")
        lines.append(f"- Memory Usage: {context['memory_usage']:.2f} MB")
        lines.append(f"- Validation Passed: {'Yes' if context['validation_passed'] else 'No'}")
        
        if context.get('difficulty_level'):
            lines.append(f"- Difficulty Level: {context['difficulty_level']}")
        
        if context.get('topic_area'):
            lines.append(f"- Topic Area: {context['topic_area']}")
        
        if context.get('validation_errors'):
            lines.append("- Validation Errors:")
            for error in context['validation_errors'][:3]:  # Limit to first 3 errors
                lines.append(f"  * {error['type']}: {error['message']}")
        
        return '\n'.join(lines)
    
    def _format_code_patterns(self, patterns: Dict[str, Any]) -> str:
        """Format code patterns for prompt."""
        lines = []
        lines.append(f"- Code Length: {patterns['line_count']} lines")
        lines.append(f"- Has Imports: {'Yes' if patterns['has_imports'] else 'No'}")
        lines.append(f"- Uses Spark Session: {'Yes' if patterns['uses_spark_session'] else 'No'}")
        lines.append(f"- Uses DataFrame Operations: {'Yes' if patterns['uses_dataframe_ops'] else 'No'}")
        lines.append(f"- Uses SQL: {'Yes' if patterns['uses_sql'] else 'No'}")
        lines.append(f"- Has Error Handling: {'Yes' if patterns['has_error_handling'] else 'No'}")
        lines.append(f"- Uses Caching: {'Yes' if patterns['uses_caching'] else 'No'}")
        lines.append(f"- Has Comments: {'Yes' if patterns['has_comments'] else 'No'}")
        
        if patterns['uses_collect']:
            lines.append("- WARNING: Uses .collect() - potential performance issue")
        
        return '\n'.join(lines)
    
    def _process_ai_review(self, ai_review_data: Dict[str, Any], start_time: float) -> CodeReview:
        """Process AI review data into structured CodeReview object."""
        analysis_time = time.time() - start_time
        
        # Extract and validate required fields
        overall_score = float(ai_review_data.get('overall_score', 0.0))
        overall_score = max(0.0, min(10.0, overall_score))  # Clamp to 0-10 range
        
        correctness_feedback = ai_review_data.get('correctness_feedback', 'No correctness feedback provided')
        performance_feedback = ai_review_data.get('performance_feedback', 'No performance feedback provided')
        best_practices_feedback = ai_review_data.get('best_practices_feedback', 'No best practices feedback provided')
        
        # Process improvement suggestions
        improvement_suggestions = ai_review_data.get('improvement_suggestions', [])
        if not isinstance(improvement_suggestions, list):
            improvement_suggestions = []
        
        # Process code examples
        code_examples = []
        for example in ai_review_data.get('code_examples', []):
            if isinstance(example, dict):
                code_examples.append({
                    'description': example.get('description', 'Code improvement example'),
                    'improved_code': example.get('improved_code', example.get('code', '')),
                    'explanation': example.get('explanation', 'Improvement explanation')
                })
        
        # Process alternative approaches
        alternative_approaches = []
        for approach in ai_review_data.get('alternative_approaches', []):
            if isinstance(approach, dict):
                alternative_approaches.append({
                    'approach': approach.get('approach', 'Alternative approach'),
                    'description': approach.get('description', 'Alternative description'),
                    'code_example': approach.get('code_example', ''),
                    'pros_cons': approach.get('pros_cons', 'Trade-offs not specified')
                })
            elif isinstance(approach, str):
                alternative_approaches.append({
                    'approach': 'Alternative Approach',
                    'description': approach,
                    'code_example': '',
                    'pros_cons': 'See description for details'
                })
        
        # Extract strengths and areas for improvement
        strengths = ai_review_data.get('strengths', [])
        if not isinstance(strengths, list):
            strengths = []
        
        areas_for_improvement = ai_review_data.get('areas_for_improvement', [])
        if not isinstance(areas_for_improvement, list):
            areas_for_improvement = []
        
        return CodeReview(
            overall_score=overall_score,
            correctness_feedback=correctness_feedback,
            performance_feedback=performance_feedback,
            best_practices_feedback=best_practices_feedback,
            improvement_suggestions=improvement_suggestions,
            code_examples=code_examples,
            alternative_approaches=alternative_approaches,
            strengths=strengths,
            areas_for_improvement=areas_for_improvement,
            analysis_time=analysis_time,
            model_used="groq-llama3",
            reviewed_at=datetime.utcnow()
        )
    
    async def get_review_statistics(self, user_id: str) -> Dict[str, Any]:
        """Get code review statistics for a user."""
        try:
            redis = await get_redis()
            
            # Get review history from cache
            stats_key = f"review_stats:{user_id}"
            stats_data = await redis.get(stats_key)
            
            if stats_data:
                import json
                return json.loads(stats_data)
            else:
                return {
                    "total_reviews": 0,
                    "average_score": 0.0,
                    "reviews_this_month": 0,
                    "improvement_trend": "no_data"
                }
        except Exception as e:
            self.logger.warning("Failed to get review statistics", user_id=user_id, error=str(e))
            return {
                "total_reviews": 0,
                "average_score": 0.0,
                "reviews_this_month": 0,
                "improvement_trend": "no_data"
            }
    
    async def update_review_statistics(self, user_id: str, review: CodeReview) -> None:
        """Update review statistics for a user."""
        try:
            redis = await get_redis()
            stats_key = f"review_stats:{user_id}"
            
            # Get current stats
            stats_data = await redis.get(stats_key)
            if stats_data:
                import json
                stats = json.loads(stats_data)
            else:
                stats = {
                    "total_reviews": 0,
                    "total_score": 0.0,
                    "reviews_this_month": 0,
                    "last_review_date": None,
                    "score_history": []
                }
            
            # Update stats
            stats["total_reviews"] += 1
            stats["total_score"] += review.overall_score
            stats["average_score"] = stats["total_score"] / stats["total_reviews"]
            stats["last_review_date"] = datetime.utcnow().isoformat()
            
            # Add to score history (keep last 10)
            stats["score_history"].append(review.overall_score)
            if len(stats["score_history"]) > 10:
                stats["score_history"] = stats["score_history"][-10:]
            
            # Calculate improvement trend
            if len(stats["score_history"]) >= 3:
                recent_avg = sum(stats["score_history"][-3:]) / 3
                older_avg = sum(stats["score_history"][:-3]) / len(stats["score_history"][:-3])
                if recent_avg > older_avg + 0.5:
                    stats["improvement_trend"] = "improving"
                elif recent_avg < older_avg - 0.5:
                    stats["improvement_trend"] = "declining"
                else:
                    stats["improvement_trend"] = "stable"
            
            # Save updated stats
            await redis.setex(stats_key, 86400 * 30, json.dumps(stats))  # Keep for 30 days
            
        except Exception as e:
            self.logger.warning("Failed to update review statistics", user_id=user_id, error=str(e))


# Global code reviewer instance
_code_reviewer = None


def get_code_reviewer() -> CodeReviewer:
    """Get the global code reviewer instance."""
    global _code_reviewer
    if _code_reviewer is None:
        _code_reviewer = CodeReviewer()
    return _code_reviewer