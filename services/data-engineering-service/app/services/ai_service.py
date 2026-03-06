"""
AI service wrapper for OpenAI API integration.
Handles question generation and code review using OpenAI's AI models.
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

import structlog
from openai import AsyncOpenAI
import httpx

from app.core.config import settings
from app.core.redis_client import get_redis


logger = structlog.get_logger()


class AIServiceError(Exception):
    """Base exception for AI service errors."""
    pass


class RateLimitError(AIServiceError):
    """Raised when rate limits are exceeded."""
    pass


class APIError(AIServiceError):
    """Raised when API calls fail."""
    pass


@dataclass
class RateLimitInfo:
    """Rate limiting information for a user."""
    requests_made: int
    window_start: float
    requests_per_hour: int


class ExperienceLevel(Enum):
    """Experience level categories for question generation."""
    BEGINNER = "beginner"  # 0-2 years
    INTERMEDIATE = "intermediate"  # 3-7 years
    ADVANCED = "advanced"  # 8+ years


class AIService:
    """
    AI service wrapper for OpenAI API integration.
    Provides question generation and code review capabilities with rate limiting.
    """
    
    def __init__(self):
        self.logger = logger.bind(service="ai_service")
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
        self.redis_client = None
        
        if not self.client:
            self.logger.warning("OpenAI API key not configured, AI service will be disabled")
    
    async def _get_redis_client(self):
        """Get Redis client for rate limiting."""
        if not self.redis_client:
            self.redis_client = await get_redis()
        return self.redis_client
    
    async def _check_rate_limit(self, user_id: str, requests_per_hour: int = None) -> None:
        """
        Check if user has exceeded rate limits.
        
        Args:
            user_id: User identifier for rate limiting
            requests_per_hour: Override default rate limit
            
        Raises:
            RateLimitError: If rate limit is exceeded
        """
        if requests_per_hour is None:
            requests_per_hour = settings.AI_REQUESTS_PER_HOUR
            
        redis = await self._get_redis_client()
        current_time = time.time()
        window_start = current_time - 3600  # 1 hour window
        
        # Get current rate limit info
        key = f"rate_limit:ai:{user_id}"
        rate_data = await redis.get(key)
        
        if rate_data:
            try:
                rate_info = json.loads(rate_data)
                # Reset if window has passed
                if rate_info["window_start"] < window_start:
                    rate_info = {"requests_made": 0, "window_start": current_time}
            except (json.JSONDecodeError, KeyError, TypeError):
                # Handle corrupted data by resetting
                self.logger.warning("Corrupted rate limit data, resetting", user_id=user_id)
                rate_info = {"requests_made": 0, "window_start": current_time}
        else:
            rate_info = {"requests_made": 0, "window_start": current_time}
        
        # Check if limit exceeded
        if rate_info["requests_made"] >= requests_per_hour:
            self.logger.warning(
                "Rate limit exceeded",
                user_id=user_id,
                requests_made=rate_info["requests_made"],
                limit=requests_per_hour
            )
            raise RateLimitError(f"Rate limit of {requests_per_hour} requests per hour exceeded")
        
        # Increment counter and save
        rate_info["requests_made"] += 1
        await redis.setex(key, 3600, json.dumps(rate_info))
        
        self.logger.debug(
            "Rate limit check passed",
            user_id=user_id,
            requests_made=rate_info["requests_made"],
            limit=requests_per_hour
        )
    
    def _get_experience_level(self, years: int) -> ExperienceLevel:
        """Convert years of experience to experience level enum."""
        if years <= 2:
            return ExperienceLevel.BEGINNER
        elif years <= 7:
            return ExperienceLevel.INTERMEDIATE
        else:
            return ExperienceLevel.ADVANCED
    
    def _get_question_prompt(self, experience_level: ExperienceLevel, topic: Optional[str] = None) -> str:
        """
        Generate prompt template for question generation based on experience level.
        
        Args:
            experience_level: User's experience level
            topic: Optional specific topic to focus on
            
        Returns:
            Formatted prompt string for AI question generation
        """
        from datetime import datetime
        
        timestamp = datetime.now().isoformat()
        
        base_prompt = f"""You are an expert data engineer creating PySpark coding questions for technical assessments.
Generate a unique, practical PySpark problem that tests real-world data engineering skills.

IMPORTANT REQUIREMENTS:
- Create an original problem scenario with realistic business context
- Use clear, descriptive column names that reflect the business domain
- Include realistic sample data with appropriate data types (minimum 3-5 rows)
- Ensure the expected output is deterministic and verifiable
- Make the problem solvable using PySpark DataFrame operations
- Focus on practical scenarios that data engineers encounter in production

Generation timestamp: {timestamp}

"""
        
        # Experience-specific requirements
        if experience_level == ExperienceLevel.BEGINNER:
            experience_prompt = """DIFFICULTY LEVEL: BEGINNER (0-2 years experience)

Focus on fundamental PySpark operations:
- Basic DataFrame operations: select, filter, withColumn, groupBy
- Simple transformations and aggregations (count, sum, avg, max, min)
- Basic column operations and data type conversions
- Simple filtering conditions
- Keep the problem straightforward with clear requirements

Avoid: Complex joins, window functions, advanced optimizations
"""
        elif experience_level == ExperienceLevel.INTERMEDIATE:
            experience_prompt = """DIFFICULTY LEVEL: INTERMEDIATE (3-7 years experience)

Focus on multi-step data processing:
- Combine multiple DataFrame operations in sequence
- Use joins (inner, left, right) between datasets
- Apply window functions for ranking, running totals, or partitioned calculations
- Implement data quality checks and deduplication logic
- Handle null values and data cleaning scenarios

Include moderate complexity with 2-3 transformation steps
"""
        else:  # ADVANCED
            experience_prompt = """DIFFICULTY LEVEL: ADVANCED (8+ years experience)

Focus on complex data engineering challenges:
- Performance optimization techniques (partitioning, caching, broadcast joins)
- Advanced window functions with complex partitioning
- Complex multi-table joins with aggregations
- Data pipeline design considerations
- Scalability and efficiency optimization
- Advanced SQL operations and complex business logic

Require sophisticated thinking and best practices
"""
        
        # Topic-specific guidance - CRITICAL: This must be respected
        topic_prompt = ""
        if topic and topic.strip():
            # Map topic to specific requirements
            topic_lower = topic.lower().replace("_", " ")
            
            topic_prompt = f"""
REQUIRED TOPIC: {topic}

The problem MUST specifically focus on and test {topic_lower} concepts.
This is the PRIMARY requirement - ensure the question directly addresses this topic.

"""
            # Add topic-specific guidance
            if "transformation" in topic_lower:
                topic_prompt += """- Focus on data transformation operations (withColumn, select, cast, etc.)
- Include column manipulations, data type conversions, or derived columns
"""
            elif "aggregation" in topic_lower:
                topic_prompt += """- Focus on aggregation operations (groupBy, agg, sum, count, avg, etc.)
- Include grouped calculations and summary statistics
"""
            elif "join" in topic_lower:
                topic_prompt += """- Focus on joining multiple datasets (inner, left, right, outer joins)
- Include scenarios requiring data from multiple sources
"""
            elif "window" in topic_lower:
                topic_prompt += """- Focus on window functions (row_number, rank, lag, lead, running totals)
- Include partitioning and ordering within groups
"""
            elif "performance" in topic_lower or "optimization" in topic_lower:
                topic_prompt += """- Focus on performance optimization (partitioning, caching, broadcast)
- Include scenarios where efficiency and scalability matter
"""
            elif "quality" in topic_lower:
                topic_prompt += """- Focus on data quality checks (null handling, deduplication, validation)
- Include data cleaning and quality assurance scenarios
"""
            elif "streaming" in topic_lower:
                topic_prompt += """- Focus on streaming data processing concepts
- Include real-time or incremental data processing scenarios
"""
        
        # Output format requirements
        format_prompt = """
OUTPUT FORMAT (Valid JSON only):
{
  "title": "Clear, specific problem title that describes the task",
  "description": "Detailed problem description with business context, requirements, and expected behavior. Be specific about what transformations or operations are needed.",
  "input_schema": {
    "column_name": "data_type",
    "another_column": "data_type"
  },
  "sample_input": {
    "data": [
      {"column_name": "value", "another_column": "value"},
      {"column_name": "value", "another_column": "value"},
      {"column_name": "value", "another_column": "value"}
    ]
  },
  "expected_output": {
    "data": [
      {"result_column": "value", "another_result": "value"}
    ]
  },
  "test_cases": [
    {
      "description": "Test case description",
      "input_data": {"data": [...]},
      "expected_output": {"data": [...]}
    }
  ]
}

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations - just the JSON object.
"""
        
        return base_prompt + experience_prompt + topic_prompt + format_prompt
    
    def _get_code_review_prompt(self, code: str, question_title: str, execution_result: Dict[str, Any]) -> str:
        """
        Generate prompt template for code review.
        
        Args:
            code: User's PySpark code
            question_title: Title of the question being solved
            execution_result: Results from code execution
            
        Returns:
            Formatted prompt string for AI code review
        """
        return f"""You are an expert data engineer reviewing PySpark code for best practices, performance, and correctness.

Question: {question_title}

User's Code:
```python
{code}
```

Execution Result:
{json.dumps(execution_result, indent=2)}

Please provide a comprehensive code review covering:

1. **Correctness**: Is the solution correct and does it handle edge cases?
2. **Performance**: Are there performance optimizations or inefficiencies?
3. **Best Practices**: Does the code follow PySpark and data engineering best practices?
4. **Code Quality**: Is the code readable, maintainable, and well-structured?

IMPORTANT: Return ONLY valid JSON. Use regular ASCII characters only (no em-dashes, smart quotes, or special Unicode). Use simple hyphens (-) and regular quotes (").

Output Format (JSON):
{{
  "overall_score": 7.5,
  "correctness_feedback": "Detailed feedback on correctness",
  "performance_feedback": "Performance analysis and optimization suggestions",
  "best_practices_feedback": "Best practices assessment",
  "improvement_suggestions": [
    "Specific suggestion 1",
    "Specific suggestion 2"
  ],
  "code_examples": [
    {{
      "description": "What this example shows",
      "code": "# Improved code example"
    }}
  ],
  "alternative_approaches": [
    "Alternative approach 1 with explanation",
    "Alternative approach 2 with explanation"
  ]
}}

Return ONLY the JSON object, no additional text before or after.
"""
    
    async def _make_api_call(self, prompt: str, max_retries: int = 3) -> str:
        """
        Make API call to GROQ with retry logic and error handling.
        
        Args:
            prompt: The prompt to send to the AI
            max_retries: Maximum number of retry attempts
            
        Returns:
            AI response text
            
        Raises:
            APIError: If API call fails after retries
        """
        if not self.client:
            raise APIError("OpenAI API client not configured")
        
        for attempt in range(max_retries):
            try:
                self.logger.debug(f"Making API call, attempt {attempt + 1}")
                
                response = await self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an expert data engineer and PySpark specialist. Generate high-quality, practical questions for technical assessments."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.8,
                    max_tokens=4000,
                    top_p=0.95,
                    stream=False
                )
                
                if response.choices and response.choices[0].message:
                    content = response.choices[0].message.content
                    self.logger.debug("API call successful")
                    return content
                else:
                    raise APIError("Empty response from OpenAI API")
                    
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:  # Rate limit
                    wait_time = 2 ** attempt  # Exponential backoff
                    self.logger.warning(
                        f"Rate limited, waiting {wait_time}s before retry",
                        attempt=attempt + 1,
                        max_retries=max_retries
                    )
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    self.logger.error(f"HTTP error: {e.response.status_code}")
                    raise APIError(f"HTTP error: {e.response.status_code}")
                    
            except Exception as e:
                self.logger.error(f"API call failed", error=str(e), attempt=attempt + 1)
                if attempt == max_retries - 1:
                    raise APIError(f"API call failed after {max_retries} attempts: {str(e)}")
                
                # Wait before retry
                wait_time = 2 ** attempt
                await asyncio.sleep(wait_time)
        
        raise APIError(f"API call failed after {max_retries} attempts")
    
    def _clean_json_response(self, response: str) -> str:
        """
        Clean and fix common JSON errors from AI responses.
        
        Args:
            response: Raw response string
            
        Returns:
            Cleaned JSON string
        """
        import re
        
        # Remove markdown code blocks
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        elif response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        
        response = response.strip()
        
        # Extract JSON from text - find first { and last }
        lines = response.split('\n')
        json_start = -1
        json_end = -1
        
        for i, line in enumerate(lines):
            if line.strip().startswith('{'):
                json_start = i
                break
        
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].strip().endswith('}'):
                json_end = i + 1
                break
        
        if json_start >= 0 and json_end > json_start:
            response = '\n'.join(lines[json_start:json_end])
        
        # Replace ALL problematic Unicode characters with ASCII equivalents
        # Em-dash, en-dash -> regular hyphen
        response = response.replace('\u2013', '-')  # en-dash
        response = response.replace('\u2014', '-')  # em-dash
        response = response.replace('\u2015', '-')  # horizontal bar
        response = response.replace('\u2212', '-')  # minus sign
        
        # Smart quotes -> regular quotes
        response = response.replace('\u2018', "'")  # left single quote
        response = response.replace('\u2019', "'")  # right single quote  
        response = response.replace('\u201a', "'")  # single low-9 quote
        response = response.replace('\u201b', "'")  # single high-reversed-9 quote
        response = response.replace('\u201c', '"')  # left double quote
        response = response.replace('\u201d', '"')  # right double quote
        response = response.replace('\u201e', '"')  # double low-9 quote
        response = response.replace('\u201f', '"')  # double high-reversed-9 quote
        
        # Other special characters
        response = response.replace('\u2026', '...')  # ellipsis
        response = response.replace('\u2032', "'")  # prime
        response = response.replace('\u2033', '"')  # double prime
        
        # Fix common JSON errors
        # 1. Remove trailing commas before closing braces/brackets
        response = re.sub(r',(\s*[}\]])', r'\1', response)
        
        # 2. Remove comments (// and /* */)
        response = re.sub(r'//.*?$', '', response, flags=re.MULTILINE)
        response = re.sub(r'/\*.*?\*/', '', response, flags=re.DOTALL)
        
        # 3. Fix unquoted property names (common AI error)
        # Match: word: (but not "word":)
        response = re.sub(r'(\n\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', response)
        
        # 4. Remove any remaining non-ASCII characters
        response = response.encode('ascii', 'ignore').decode('ascii')
        
        # 5. Remove any non-printable characters except newlines, tabs, carriage returns
        response = ''.join(char for char in response if char.isprintable() or char in '\n\r\t')
        
        return response.strip()
    
    async def generate_question(
        self,
        user_id: str,
        experience_years: int,
        topic: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a PySpark question using AI.
        
        Args:
            user_id: User identifier for rate limiting
            experience_years: User's years of experience
            topic: Optional specific topic to focus on
            
        Returns:
            Generated question data as dictionary
            
        Raises:
            RateLimitError: If rate limit is exceeded
            APIError: If API call fails
        """
        self.logger.info(
            "Generating question",
            user_id=user_id,
            experience_years=experience_years,
            topic=topic
        )
        
        # Check rate limits
        await self._check_rate_limit(user_id)
        
        # Determine experience level
        experience_level = self._get_experience_level(experience_years)
        
        # Generate prompt
        prompt = self._get_question_prompt(experience_level, topic)
        
        # Make API call
        response = await self._make_api_call(prompt)
        
        # Parse JSON response with robust error handling
        try:
            # Clean the response
            cleaned_response = self._clean_json_response(response)
            
            # Try to parse
            question_data = json.loads(cleaned_response)
            
            self.logger.info("Question generated successfully", user_id=user_id)
            return question_data
            
        except json.JSONDecodeError as e:
            # Log the error with context
            self.logger.error(
                "Failed to parse AI response as JSON",
                error=str(e),
                response_preview=response[:500] if len(response) > 500 else response
            )
            raise APIError(f"Invalid JSON response from AI: {str(e)}")
    
    async def review_code(
        self,
        user_id: str,
        code: str,
        question_title: str,
        execution_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate AI-powered code review.
        
        Args:
            user_id: User identifier for rate limiting
            code: User's PySpark code
            question_title: Title of the question being solved
            execution_result: Results from code execution
            
        Returns:
            Code review data as dictionary
            
        Raises:
            RateLimitError: If rate limit is exceeded
            APIError: If API call fails
        """
        self.logger.info("Generating code review", user_id=user_id, question_title=question_title)
        
        # Check rate limits
        await self._check_rate_limit(user_id)
        
        # Generate prompt
        prompt = self._get_code_review_prompt(code, question_title, execution_result)
        
        # Make API call
        response = await self._make_api_call(prompt)
        
        # Parse JSON response with robust error handling
        try:
            # Clean the response
            cleaned_response = self._clean_json_response(response)
            
            # Try to parse
            review_data = json.loads(cleaned_response)
            
            self.logger.info("Code review generated successfully", user_id=user_id)
            return review_data
            
        except json.JSONDecodeError as e:
            self.logger.error("Failed to parse AI response as JSON", error=str(e), response=response)
            raise APIError(f"Invalid JSON response from AI: {str(e)}")
    
    async def get_rate_limit_status(self, user_id: str) -> RateLimitInfo:
        """
        Get current rate limit status for a user.
        
        Args:
            user_id: User identifier
            
        Returns:
            Current rate limit information
        """
        redis = await self._get_redis_client()
        key = f"rate_limit:ai:{user_id}"
        rate_data = await redis.get(key)
        
        if rate_data:
            rate_info = json.loads(rate_data)
            return RateLimitInfo(
                requests_made=rate_info["requests_made"],
                window_start=rate_info["window_start"],
                requests_per_hour=settings.AI_REQUESTS_PER_HOUR
            )
        else:
            return RateLimitInfo(
                requests_made=0,
                window_start=time.time(),
                requests_per_hour=settings.AI_REQUESTS_PER_HOUR
            )


# Global AI service instance
ai_service = AIService()

def get_ai_service() -> AIService:
    """Get the global AI service instance."""
    return ai_service