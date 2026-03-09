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
        
        # If Redis is not available, skip rate limiting
        if redis is None:
            self.logger.warning("Redis not available, skipping rate limit check")
            return
            
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
    
    def _get_question_prompt(
        self, 
        experience_level: ExperienceLevel, 
        topic: Optional[str] = None,
        job_role: Optional[str] = None,
        custom_requirements: Optional[str] = None
    ) -> str:
        """
        Generate prompt template for question generation based on experience level, job role, and custom requirements.
        
        Args:
            experience_level: User's experience level
            topic: Optional specific topic to focus on
            job_role: Optional target job role
            custom_requirements: Optional custom requirements or scenario
            
        Returns:
            Formatted prompt string for AI question generation
        """
        from datetime import datetime
        
        timestamp = datetime.now().isoformat()
        
        base_prompt = f"""You are a Staff Data Engineer at a FAANG company creating interview questions for Senior/Staff Data Engineer positions.
Generate CHALLENGING, SCENARIO-BASED PySpark problems that test production-level data engineering expertise.

!!!ABSOLUTE CRITICAL FOR ADVANCED LEVEL!!!
You are NOT creating tutorial problems. You are creating INTERVIEW QUESTIONS that would be asked at:
- Google/Meta/Amazon for L6/L7 Data Engineer roles
- Netflix/Uber/Airbnb for Senior/Staff Data Engineer roles
- Stripe/Databricks for Principal Engineer roles

These problems should:
- Make candidates THINK for 30-45 minutes before coding
- Require PLANNING and ARCHITECTURE decisions
- Test DEPTH of distributed systems knowledge
- Include TRADE-OFFS and optimization decisions
- Have MULTIPLE valid approaches with different trade-offs
- Contain SUBTLE edge cases that break naive solutions
- Require understanding of PySpark INTERNALS and performance characteristics

REAL INTERVIEW PROBLEM EXAMPLES (Study these patterns):

1. FRAUD DETECTION SYSTEM:
"Build a real-time fraud detection system that analyzes transaction patterns. For each transaction, calculate:
- User's transaction velocity (count in last 1 hour, 24 hours, 7 days)
- Deviation from user's historical average amount (z-score)
- Geographic anomaly score (distance from usual locations)
- Device fingerprint changes
Flag transactions with composite risk score > 0.8. Handle: new users (no history), missing location data, concurrent transactions."

2. CUSTOMER 360 WITH CONFLICT RESOLUTION:
"Merge customer data from 4 sources (CRM, Support, Web, Mobile) with conflicting information. Priority rules:
- Email: CRM > Web > Mobile > Support
- Phone: Support > CRM > Mobile > Web
- Address: Most recent non-null value
- Name: Longest non-null value (more complete)
Calculate customer lifetime value with time-decay (0.95^months_ago). Handle: duplicate records within sources, circular references, partial matches."

3. SLOWLY CHANGING DIMENSION TYPE 2:
"Implement SCD Type 2 for product catalog tracking price/category changes. Requirements:
- Maintain effective_from/effective_to dates
- Handle backdated updates (price change effective last week)
- Support bulk updates and late-arriving data
- Ensure no gaps or overlaps in date ranges
- Provide current_flag for active records
Handle: same-day multiple changes, future-dated changes, corrections to historical data."

4. SESSION ANALYSIS WITH ATTRIBUTION:
"Sessionize clickstream (30-min timeout) and attribute conversions to marketing channels:
- Last-touch attribution (credit to last channel before purchase)
- Calculate session metrics: duration, page views, bounce rate
- Identify drop-off points in conversion funnel
- Handle: cross-device sessions, multiple conversions, session timeout edge cases
- Optimize for 100M+ events per day with skewed user distribution."

5. DATA QUALITY MONITORING SYSTEM:
"Build automated data quality checks for daily ETL pipeline:
- Detect schema drift (new columns, type changes)
- Identify anomalies in distributions (sudden spikes/drops)
- Find referential integrity violations across 5 tables
- Calculate completeness scores per column
- Flag records with suspicious patterns (all nulls, duplicates, outliers)
Generate quality report with severity levels and affected record counts."

CRITICAL REQUIREMENTS FOR EXECUTABLE PYSPARK CODE:
- Use ONLY PySpark DataFrame API operations (select, filter, withColumn, groupBy, agg, join, orderBy, window functions, when, lit, col, etc.)
- NO external libraries (no pandas, numpy, sklearn, scipy, etc.)
- NO file I/O operations (no read/write to files)
- NO Spark SQL DDL (no CREATE TABLE, ALTER TABLE)
- Focus on in-memory DataFrame transformations
- Solution must be a function: DataFrame(s) → DataFrame

DATASET COMPLEXITY REQUIREMENTS (STRICTLY ENFORCED):

For ADVANCED problems, datasets MUST have:
- **Minimum 60-120 rows** (200+ for performance optimization problems)
- **12-20 columns** with realistic business data
- **Multiple related datasets** (3-5 tables for join scenarios, each 50-100 rows)
- **Production-like complexity**:
  * Power-law distributions (80/20 rule, long tail)
  * Multiple simultaneous data quality issues
  * Time-series with gaps, out-of-order events, duplicates
  * Hierarchical relationships (parent-child, multi-level)
  * Skewed data requiring optimization
  * Edge cases in 10-15% of records
  * Realistic null patterns (not random - business logic driven)
  * Data requiring multi-pass processing
  * Scenarios where naive approach fails or is too slow

PROBLEM STRUCTURE REQUIREMENTS:

1. **Business Context** (2-3 sentences):
   - Real company scenario (e-commerce, fintech, adtech, etc.)
   - Business problem and impact
   - Why this matters to the business

2. **Technical Requirements** (4-6 specific requirements):
   - What transformations are needed
   - What metrics to calculate
   - What edge cases to handle
   - Performance considerations

3. **Constraints & Edge Cases** (3-5 items):
   - Data quality issues to handle
   - Performance requirements
   - Edge cases that break naive solutions

4. **Expected Complexity**:
   - 8-15 PySpark operations
   - 3-4 different operation types (windows, joins, aggregations, conditionals)
   - Requires careful sequencing (order matters)
   - Multiple valid approaches with trade-offs

WHAT MAKES A PROBLEM "EXPERT LEVEL":

✓ Requires understanding of distributed computing concepts
✓ Tests ability to handle data quality issues systematically
✓ Involves optimization thinking (not just correctness)
✓ Has trade-offs between approaches (memory vs speed, accuracy vs performance)
✓ Tests knowledge of PySpark internals (partitioning, shuffling, broadcasting)
✓ Requires multi-step reasoning (can't solve linearly)
✓ Has subtle edge cases that are easy to miss
✓ Would take a senior engineer 30-45 minutes to solve correctly
✓ Solution quality separates senior from staff engineers

AVOID THESE (Not Expert Level):
✗ Simple aggregations ("group by and count")
✗ Basic joins without complexity
✗ Textbook examples
✗ Problems solvable in 3-4 operations
✗ No edge cases or data quality issues
✗ No optimization considerations
✗ Generic problems without business context
✗ Problems where one approach is obviously correct

Generation timestamp: {timestamp}

"""
        
        # Job role-specific context
        job_role_prompt = ""
        if job_role and job_role.strip():
            job_role_prompt = f"""
TARGET JOB ROLE: {job_role}

Tailor the question to PySpark skills and data engineering scenarios relevant to a {job_role} position.
Focus on executable PySpark DataFrame operations that this role would use in production.
"""
            job_role_lower = job_role.lower()
            
            if "data engineer" in job_role_lower:
                job_role_prompt += """- Focus on ETL pipeline operations: data transformation, cleaning, and aggregation
- Include scenarios involving data ingestion processing and quality checks
- Emphasize PySpark DataFrame operations for scalable data processing
- Use cases: joining datasets, handling duplicates, data type conversions, filtering
"""
            elif "senior data engineer" in job_role_lower:
                job_role_prompt += """- Focus on advanced PySpark optimization and complex transformations
- Include performance tuning scenarios (partitioning, caching, broadcast joins)
- Emphasize scalable solutions for large datasets
- Use cases: complex window functions, multi-table joins, performance optimization
"""
            elif "etl developer" in job_role_lower:
                job_role_prompt += """- Focus on Extract, Transform, Load operations using PySpark
- Include data integration and transformation scenarios
- Emphasize data quality validation and cleansing
- Use cases: data type conversions, null handling, deduplication, data validation
"""
            elif "big data" in job_role_lower:
                job_role_prompt += """- Focus on large-scale distributed data processing with PySpark
- Include performance optimization and partitioning strategies
- Emphasize scalability and efficiency in DataFrame operations
- Use cases: partitioning, caching, broadcast joins, aggregations on large datasets
"""
            elif "pipeline engineer" in job_role_lower:
                job_role_prompt += """- Focus on automated data pipeline operations using PySpark
- Include data transformation and quality check scenarios
- Emphasize reliable and maintainable DataFrame operations
- Use cases: data validation, transformation chains, error handling
"""
            elif "analytics engineer" in job_role_lower:
                job_role_prompt += """- Focus on transforming raw data into analytics-ready datasets
- Include aggregation, grouping, and analytical query scenarios
- Emphasize deriving metrics and KPIs using PySpark
- Use cases: complex aggregations, window functions, pivot operations
"""
        
        # Custom requirements
        custom_prompt = ""
        if custom_requirements and custom_requirements.strip():
            custom_prompt = f"""
CUSTOM REQUIREMENTS:
{custom_requirements}

IMPORTANT: Incorporate these specific requirements into the question design.
The question should address these custom requirements while maintaining technical rigor.

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

DATASET REQUIREMENTS FOR BEGINNER:
- Provide 5-8 rows of sample data
- Use 3-5 columns with simple data types (string, int, float, boolean)
- Include straightforward data patterns that are easy to understand
- Ensure data is clean with minimal edge cases

Avoid: Complex joins, window functions, advanced optimizations
"""
        elif experience_level == ExperienceLevel.INTERMEDIATE:
            experience_prompt = """DIFFICULTY LEVEL: INTERMEDIATE (3-7 years experience)

Focus on multi-step data processing with moderate complexity:
- Combine 3-4 DataFrame operations in sequence
- Use various join types (inner, left, right, full outer) between datasets
- Apply window functions for ranking, running totals, or partitioned calculations
- Implement data quality checks and sophisticated deduplication logic
- Handle null values with conditional logic and data cleaning scenarios
- Use aggregate functions with groupBy and multiple aggregation columns
- Implement conditional transformations using when/otherwise
- Basic performance considerations (simple caching, filter pushdown)

DATASET REQUIREMENTS FOR INTERMEDIATE (MORE CHALLENGING):
- Provide 15-30 rows of sample data
- Use 6-10 columns with varied data types (string, int, float, date, timestamp, boolean, decimal)
- Include realistic data patterns with moderate complexity:
  * Multiple duplicate scenarios requiring different handling strategies
  * Various null patterns across different columns
  * Edge cases that require conditional logic
  * Data inconsistencies that need normalization
- For join operations, provide 2-3 datasets with 15-25 rows each
- Include data quality issues requiring multi-step handling:
  * Nulls in critical columns
  * Duplicate records with different criteria
  * Data format inconsistencies
  * Missing or incomplete records
- Add business logic complexity requiring 2-3 conditional checks

Include moderate to high complexity with 3-4 transformation steps requiring careful sequencing.
"""
        else:  # ADVANCED
            experience_prompt = """DIFFICULTY LEVEL: ADVANCED (8+ years) - STAFF/PRINCIPAL ENGINEER INTERVIEW LEVEL

!!!THIS IS A FAANG-LEVEL INTERVIEW QUESTION - MAKE IT GENUINELY HARD!!!

You are creating a problem for candidates interviewing at Google L6, Meta E6, Amazon L6, or equivalent Staff Engineer roles.
The problem should be something that:
- A mid-level engineer would struggle with or solve incorrectly
- A senior engineer would need 30-45 minutes to solve correctly
- Tests deep understanding of distributed systems and PySpark internals
- Requires careful planning before coding
- Has multiple approaches with different trade-offs

MANDATORY PROBLEM CHARACTERISTICS:

1. **MULTI-DIMENSIONAL COMPLEXITY** (Must have ALL of these):
   - Requires 10-20 PySpark operations in sequence
   - Uses at least 3 different operation categories (windows, joins, aggregations, UDFs)
   - Has 4-6 explicit requirements in the problem statement
   - Includes 3-5 edge cases that must be handled
   - Requires optimization thinking (not just correctness)

2. **PRODUCTION SCENARIO** (Choose ONE and make it realistic):
   
   A. **FRAUD/ANOMALY DETECTION**:
      - Multi-dimensional risk scoring (velocity, amount deviation, location, device)
      - Time-window calculations (1hr, 24hr, 7day, 30day)
      - Statistical anomaly detection (z-scores, percentiles)
      - Handle: new users, missing data, concurrent events
      - Example: "Flag transactions with risk score > 0.8 based on: transaction velocity (>10 in 1hr), amount deviation (>3 std devs), new device, location change >500km"

   B. **CUSTOMER 360 / DATA UNIFICATION**:
      - Merge 4-5 data sources with conflicts
      - Complex priority rules for conflict resolution
      - Fuzzy matching or deduplication logic
      - Calculate derived metrics (LTV, engagement score, churn risk)
      - Handle: duplicates within sources, circular references, partial matches
      - Example: "Merge customer data from CRM, Support, Web, Mobile. Priority: email (CRM>Web>Mobile), phone (Support>CRM). Calculate LTV with 0.95^months time decay"

   C. **SLOWLY CHANGING DIMENSIONS (SCD TYPE 2)**:
      - Track historical changes with effective dates
      - Handle backdated updates and corrections
      - Maintain current_flag and version numbers
      - Ensure no gaps/overlaps in date ranges
      - Handle: same-day multiple changes, future-dated changes, late-arriving data
      - Example: "Implement SCD Type 2 for product prices. Handle backdated price changes, ensure no date gaps, maintain current_flag, support bulk updates"

   D. **SESSION ANALYSIS / FUNNEL ANALYSIS**:
      - Sessionize events with timeout logic
      - Calculate session-level metrics
      - Identify conversion paths and drop-off points
      - Attribution modeling (first-touch, last-touch, multi-touch)
      - Handle: cross-device, timeout edge cases, multiple conversions
      - Example: "Sessionize clicks (30min timeout), identify 5-step funnel (view→cart→checkout→payment→confirm), calculate drop-off rates, attribute to last marketing channel"

   E. **INCREMENTAL PROCESSING / CDC**:
      - Implement upsert logic (insert + update)
      - Handle deletes and soft deletes
      - Merge incremental with historical data
      - Maintain audit trail (created_at, updated_at, deleted_at)
      - Handle: late-arriving data, out-of-order updates, duplicate keys
      - Example: "Process daily order updates. Upsert based on order_id, handle cancellations (soft delete), maintain update history, handle out-of-order arrivals"

   F. **COMPLEX AGGREGATIONS / ANALYTICS**:
      - Multi-level aggregations with rollups
      - Cohort analysis or retention metrics
      - Moving averages, percentiles, or cumulative calculations
      - Time-series analysis with gaps
      - Handle: sparse data, irregular intervals, multiple dimensions
      - Example: "Calculate 7-day rolling retention by cohort and segment. Cohort = signup week, retention = active in week N. Handle: users with gaps, multiple segments"

   G. **DATA QUALITY / VALIDATION SYSTEM**:
      - Multi-dimensional quality checks
      - Anomaly detection in distributions
      - Referential integrity across tables
      - Completeness and consistency scoring
      - Handle: schema evolution, missing references, outliers
      - Example: "Build quality report: schema drift detection, null rate by column, referential integrity (orders→customers), distribution anomalies (>3 std dev), duplicate detection"

   H. **HIERARCHICAL DATA / GRAPH OPERATIONS**:
      - Process parent-child relationships
      - Calculate hierarchical aggregations (rollups)
      - Flatten or build hierarchies
      - Handle: circular references, orphaned nodes, multiple levels
      - Example: "Calculate total sales by org hierarchy (company→division→dept→team). Handle: employees in multiple teams, circular reporting, missing managers"

   I. **PERFORMANCE OPTIMIZATION SCENARIO**:
      - Optimize slow query with data skew
      - Implement salting or bucketing
      - Use broadcast joins appropriately
      - Cache intermediate results strategically
      - Handle: skewed keys, large shuffles, memory pressure
      - Example: "Optimize join between 1B orders (skewed by merchant_id) and 10K merchants. Use salting for top 100 merchants, broadcast for rest. Reduce shuffle from 500GB to 50GB"

   J. **COMPLEX BUSINESS LOGIC**:
      - Multi-step business rules with dependencies
      - State machine or workflow processing
      - Conditional logic with many branches
      - Calculate derived metrics with complex formulas
      - Handle: circular dependencies, invalid states, edge cases
      - Example: "Calculate customer tier (Bronze/Silver/Gold/Platinum) based on: total spend, recency, frequency, returns rate, support tickets. Rules have 15+ conditions with dependencies"

3. **DATASET REQUIREMENTS** (MANDATORY - AI MUST FOLLOW):
   - **Minimum 80-150 rows** in primary dataset (200+ for optimization problems)
   - **15-20 columns** with realistic business data types
   - **3-5 related datasets** for join scenarios (each 60-100 rows)
   - **Realistic distributions**:
     * Power-law (80/20 rule): 20% of users generate 80% of events
     * Long tail: Many entities with 1-2 records, few with 100+
     * Skewed keys: Some join keys appear 100x more than others
   - **Data quality issues** (include 5-7 of these):
     * 10-15% null values in non-critical columns
     * 5-8% duplicate records (exact or near-duplicates)
     * 3-5% outliers (values >3 std deviations)
     * Time-series gaps (missing days/hours)
     * Out-of-order timestamps (5-10% of records)
     * Referential integrity violations (orphaned foreign keys)
     * Schema inconsistencies (mixed formats, types)
   - **Edge cases** (include 4-6 of these):
     * Records with all nulls except ID
     * Same entity with conflicting information
     * Circular references in hierarchies
     * Events with same timestamp
     * Extreme values (0, negative, very large)
     * Missing required fields
     * Invalid state transitions

4. **SOLUTION COMPLEXITY REQUIREMENTS**:
   - **10-20 operations** required (not 3-4)
   - **Multiple passes** over data (can't solve in one linear pass)
   - **Intermediate results** need to be joined back
   - **Window functions** with complex partitioning/ordering
   - **Conditional logic** with 5+ branches
   - **Performance considerations** explicitly mentioned
   - **Trade-offs** between approaches

5. **EVALUATION CRITERIA** (What makes this HARD):
   - ✓ Naive solution produces incorrect results (not just slow)
   - ✓ Requires understanding of PySpark execution model
   - ✓ Edge cases are subtle and easy to miss
   - ✓ Multiple valid approaches with different trade-offs
   - ✓ Optimization is necessary, not optional
   - ✓ Tests ability to handle data quality systematically
   - ✓ Requires planning and architecture decisions
   - ✓ Would take 30-45 minutes for senior engineer

6. **PROBLEM STATEMENT STRUCTURE**:
   ```
   [Business Context - 2-3 sentences about the company/scenario]
   
   You need to [main objective].
   
   Requirements:
   1. [Specific requirement with metrics]
   2. [Specific requirement with edge case]
   3. [Specific requirement with optimization]
   4. [Specific requirement with business logic]
   5. [Specific requirement with validation]
   
   Edge Cases to Handle:
   - [Edge case 1 with example]
   - [Edge case 2 with example]
   - [Edge case 3 with example]
   - [Edge case 4 with example]
   
   Performance Considerations:
   - [Optimization requirement or constraint]
   
   Output should contain: [specific columns and format]
   ```

ABSOLUTELY AVOID:
- Simple "group by and aggregate" problems
- Basic joins without complexity
- Problems solvable in 5 operations
- No edge cases or data quality issues
- Generic problems without business context
- Problems where solution is obvious
- Toy datasets with 10-20 rows
- Problems that don't require optimization thinking

REMEMBER: This is a STAFF ENGINEER interview question. It should be HARD. Make candidates THINK.
"""
        
        # Topic-specific guidance - CRITICAL: This must be respected
        topic_prompt = ""
        if topic and topic.strip():
            # Map topic to specific requirements
            topic_lower = topic.lower().replace("_", " ")
            
            topic_prompt = f"""
!!!CRITICAL REQUIREMENT - MUST BE FOLLOWED!!!
REQUIRED TOPIC: {topic}

The generated question MUST be stored with "topic": "{topic}" in the JSON output.
The problem MUST specifically focus on and test {topic_lower} concepts.
This is the PRIMARY and MANDATORY requirement - the question MUST directly address this topic.
DO NOT generate questions about other topics. ONLY generate questions about {topic}.

VALIDATION: Before returning the JSON, verify that:
1. The "topic" field in JSON is set to "{topic}"
2. The question description explicitly mentions {topic_lower}
3. The solution requires {topic_lower} operations

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

CRITICAL DATASET SIZE REQUIREMENTS:
- BEGINNER (0-2 years): Provide 5-8 rows minimum in sample_input
- INTERMEDIATE (3-7 years): Provide 10-20 rows minimum in sample_input
- ADVANCED (8+ years): Provide 25-50 rows minimum in sample_input
- For problems with multiple datasets (joins), each dataset should follow the same row count guidelines
- Test cases should also follow similar row count patterns
- Ensure datasets are large enough to demonstrate the complexity of the problem
- Include diverse data patterns, edge cases, and realistic scenarios

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations - just the JSON object.
"""
        
        return base_prompt + job_role_prompt + custom_prompt + experience_prompt + topic_prompt + format_prompt
    
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
        topic: Optional[str] = None,
        job_role: Optional[str] = None,
        custom_requirements: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a PySpark question using AI with job role and custom requirements.
        
        Args:
            user_id: User identifier for rate limiting
            experience_years: User's years of experience
            topic: Optional specific topic to focus on
            job_role: Optional target job role (e.g., Data Engineer, ML Engineer)
            custom_requirements: Optional custom requirements or scenario
            
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
            topic=topic,
            job_role=job_role,
            has_custom_requirements=bool(custom_requirements)
        )
        
        # Check rate limits
        await self._check_rate_limit(user_id)
        
        # Determine experience level
        experience_level = self._get_experience_level(experience_years)
        
        # Generate prompt with job role and custom requirements
        prompt = self._get_question_prompt(
            experience_level, 
            topic, 
            job_role=job_role,
            custom_requirements=custom_requirements
        )
        
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