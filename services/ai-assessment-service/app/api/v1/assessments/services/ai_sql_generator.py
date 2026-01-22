"""
Module: ai_sql_generator.py
Purpose: SQL question generation with DSA SQL module integration

This module generates SQL questions with complete database schemas,
sample data, and test cases. It integrates with the DSA SQL module
for high-quality question generation.

Dependencies:
- External: openai (for fallback generation)
- Internal: ai_utils (for OpenAI client, JSON parsing)
- External: DSA SQL module (optional - dsa_generate_sql_question)

Example usage:
    ```python
    from app.api.v1.assessments.services.ai_sql_generator import _generate_sql_questions
    
    questions = await _generate_sql_questions(
        topic="JOIN Operations",
        difficulty="Medium",
        count=1,
        experience_mode="corporate"
    )
    ```

Note: DSA SQL module integration is optional. If unavailable, falls back to basic generation.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

# DSA SQL module integration - HTTP client only (no fallback)
from .....utils.service_clients import get_dsa_client

_dsa_client = get_dsa_client()
DSA_AVAILABLE = True

async def dsa_generate_sql_question(*args, **kwargs):
    """Call DSA service via HTTP to generate SQL questions."""
    return await _dsa_client.generate_sql_question(
        difficulty=kwargs.get("difficulty", "medium"),
        topic=kwargs.get("topic"),
        concepts=kwargs.get("concepts")
    )

from .ai_utils import _get_openai_client, _parse_json_response
from .ai_quality import (
    validate_question_quality,
    _get_difficulty_rules,
)

logger = logging.getLogger(__name__)


# ============================================================================
# SQL CATEGORIES AND CONSTANTS
# ============================================================================

# SQL categories for classification
SQL_CATEGORIES = [
    "select",       # Basic SELECT queries
    "join",         # JOIN operations (INNER, LEFT, RIGHT, FULL)
    "aggregation",  # GROUP BY, HAVING, COUNT, SUM, AVG
    "subquery",     # Nested queries, EXISTS, IN
    "window",       # Window functions (ROW_NUMBER, RANK, LAG, LEAD)
    "manipulation", # INSERT, UPDATE, DELETE (less common for assessments)
]


# ============================================================================
# SQL QUESTION GENERATION
# ============================================================================

async def _generate_sql_questions(
    topic: str,
    difficulty: str,
    count: int,
    experience_mode: str = "corporate",
    additional_requirements: Optional[str] = None,
    job_designation: Optional[str] = None,
    experience_min: Optional[int] = None,
    experience_max: Optional[int] = None,
    company_name: Optional[str] = None,
    assessment_requirements: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Generate SQL questions using structured format from DSA SQL generator.
    
    Returns questions with schemas, sample_data, constraints, starter_query, etc.
    Similar to how coding questions use DSA generator.
    
    Args:
        topic: Topic label
        difficulty: Difficulty level (Easy, Medium, Hard)
        count: Number of questions to generate
        experience_mode: Experience mode (corporate/college)
        additional_requirements: Optional additional requirements
        
    Returns:
        List of SQL question dictionaries with:
        - question/questionText (formatted with schema and sample data)
        - type: "SQL"
        - difficulty
        - sql_data: {
            - title, description, difficulty
            - schemas: {table_name: {columns: {...}}}
            - sample_data: {table_name: [rows]}
            - constraints: [...]
            - starter_query: "..."
            - hints: [...]
            - evaluation: {...}
          }
    """
    logger.info(f"Generating {count} SQL question(s) for topic: {topic}, difficulty: {difficulty}")
    
    # Try DSA SQL module first if available
    if DSA_AVAILABLE and dsa_generate_sql_question is not None:
        try:
            logger.info("Using DSA SQL module for question generation")
            questions = []
            for _ in range(count):
                question_data = await dsa_generate_sql_question(
                    topic=topic,
                    difficulty=difficulty,
                    experience_mode=experience_mode
                )
                if question_data:
                    questions.append(question_data)
            
            if questions:
                logger.info(f"Successfully generated {len(questions)} SQL questions using DSA module")
                return questions
            else:
                logger.warning("DSA SQL module returned no questions, falling back to basic generation")
        except Exception as exc:
            logger.warning(f"DSA SQL generator failed: {exc}. Falling back to basic generation")
    
    # Fallback: Comprehensive SQL question generation using OpenAI
    logger.info("Using comprehensive SQL question generation (OpenAI)")
    
    # Determine SQL category based on topic
    topic_lower = topic.lower()
    sql_category = "select"  # default
    if any(kw in topic_lower for kw in ["join", "inner", "left", "right", "outer"]):
        sql_category = "join"
    elif any(kw in topic_lower for kw in ["group", "having", "count", "sum", "avg", "aggregate"]):
        sql_category = "aggregation"
    elif any(kw in topic_lower for kw in ["subquery", "nested", "exists", "in"]):
        sql_category = "subquery"
    elif any(kw in topic_lower for kw in ["window", "row_number", "rank", "lag", "lead", "partition"]):
        sql_category = "window"
    elif any(kw in topic_lower for kw in ["insert", "update", "delete", "manipulate"]):
        sql_category = "manipulation"
    
    # Determine seniority for difficulty rules
    if experience_max is not None:
        if experience_max <= 2:
            seniority = "Junior"
        elif experience_max <= 5:
            seniority = "Mid"
        elif experience_max <= 10:
            seniority = "Senior"
        else:
            seniority = "Lead"
    else:
        seniority = "Mid"  # Default
    
    # Get SQL-specific difficulty rules
    difficulty_rules = _get_difficulty_rules("SQL", difficulty, seniority)
    
    # Determine table count based on difficulty
    if difficulty.lower() == "easy":
        table_count = "1-2 tables"
    elif difficulty.lower() == "medium":
        table_count = "2-3 tables"
    else:  # hard
        table_count = "3-4 tables"
    
    prompt = f"""You are an expert SQL question generator for technical assessments.
Generate EXACTLY {count} comprehensive SQL question(s) for the topic: {topic}.

CRITICAL: You MUST generate EXACTLY {count} question(s). Do NOT generate fewer or more than {count} questions.

Topic: {topic}
Difficulty: {difficulty}
SQL Category: {sql_category}
Experience Mode: {experience_mode}
Recommended Tables: {table_count}
{f"Additional Requirements: {additional_requirements}" if additional_requirements else ""}

{'=' * 80}
SQL QUESTION QUALITY STANDARDS (CRITICAL - MUST FOLLOW)
{'=' * 80}

Current Difficulty: {difficulty}
Seniority Level: {seniority}

**CRITICAL: SQL difficulty is about PROBLEM COMPLEXITY, not query length**

**{difficulty.upper()} Difficulty Rules for SQL ({seniority}):**

{difficulty_rules}

**FORBIDDEN (too simple for Hard):**
❌ Just adding more JOINs (length ≠ difficulty)
❌ "Write a query with 5 JOINs" (arbitrary complexity)

**REQUIRED for Hard:**
✅ Performance analysis
✅ Optimization decisions
✅ Indexing strategy
✅ Execution plan understanding
✅ Scale considerations (10M+ rows)

**EXAMPLES BY DIFFICULTY:**
- **Easy**: "Find all users who registered in the last 30 days" (simple SELECT + WHERE)
- **Medium**: "Find top 3 products per category by revenue, showing YoY growth %" (JOINs + window functions)
- **Hard**: "This query takes 30 seconds on 50M rows. Optimize it. Explain your indexing strategy and expected performance improvement." (optimization + scale)

**CRITICAL: For Hard questions, provide:**
- A slow query scenario (or describe the performance problem)
- Ask candidate to optimize it
- Require explanation of indexing strategy
- Include scale considerations (10M+ rows)

{'=' * 80}

=== GENERATE JSON WITH THIS EXACT STRUCTURE ===

{{
  "questions": [
    {{
      "title": "Problem Title",
      
      "description": "Clear problem statement explaining what data needs to be retrieved or manipulated. Describe the business scenario. NO table schemas here, NO sample data here. Just the problem description.",
      
      "difficulty": "{difficulty}",
      
      "sql_category": "{sql_category}",
      
      "schemas": {{
        "employees": {{
          "columns": {{
            "id": "INT PRIMARY KEY",
            "name": "VARCHAR(100)",
            "department_id": "INT",
            "salary": "DECIMAL(10,2)",
            "hire_date": "DATE"
          }}
        }},
        "departments": {{
          "columns": {{
            "id": "INT PRIMARY KEY",
            "name": "VARCHAR(100)",
            "manager_id": "INT"
          }}
        }}
      }},
      
      "sample_data": {{
        "employees": [
          [1, "Alice", 1, 75000.00, "2020-01-15"],
          [2, "Bob", 2, 65000.00, "2019-06-20"],
          [3, "Charlie", 1, 80000.00, "2018-03-10"]
        ],
        "departments": [
          [1, "Engineering", 3],
          [2, "Marketing", 2]
        ]
      }},
      
      "constraints": [
        "Return results ordered by salary descending",
        "Include only employees hired after 2019-01-01",
        "Handle NULL values appropriately"
      ],
      
      "starter_query": "-- Write your SQL query here\\n\\nSELECT ",
      
      "hints": [
        "Consider using a JOIN to combine employee and department data",
        "Use WHERE clause for filtering"
      ],
      
      "evaluation": {{
        "engine": "postgres",
        "comparison": "result_set",
        "order_sensitive": true
      }}
    }}
  ]
}}

=== CRITICAL REQUIREMENTS ===

1. SQL CATEGORY (required):
   Must be one of: "select", "join", "aggregation", "subquery", "window", "manipulation"
   Suggested category: {sql_category}

2. SCHEMAS (required):
   - Create realistic table structures for the problem
   - Use appropriate data types: INT, VARCHAR, DECIMAL, DATE, TIMESTAMP, BOOLEAN
   - Include PRIMARY KEY constraints
   - Use foreign key relationships where appropriate
   - Easy: 1-2 tables, Medium: 2-3 tables, Hard: 3-4 tables

3. SAMPLE DATA (required):
   - Provide 3-5 rows per table
   - Data must be realistic and consistent with schemas
   - Include edge cases in data (nulls, duplicates if relevant)
   - Data should be small enough to understand but complete enough to test logic

4. CONSTRAINTS (required):
   - List specific requirements for the query output
   - Include ordering, filtering, and formatting requirements
   - Be explicit about edge cases to handle

5. DESCRIPTION (required):
   - Write a clear business problem
   - Do NOT include table schemas in description
   - Do NOT include sample data in description
   - Focus on WHAT to retrieve, not HOW

6. STARTER QUERY:
   - Simple comment and SELECT starter
   - Do NOT provide solution hints in starter

7. DO NOT INCLUDE:
   - expected_output (will be computed by running reference query)
   - reference_solution (admin will provide separately)
   - stdin/stdout testcases (SQL uses result set comparison)

8. DIFFICULTY GUIDELINES:
   - Easy: Single table, basic SELECT, WHERE, ORDER BY
   - Medium: JOINs, GROUP BY, HAVING, basic subqueries
   - Hard: Window functions, complex subqueries, CTEs, multiple JOINs

IMPORTANT: Return ONLY valid JSON. No markdown code blocks, no explanations."""

    client = _get_openai_client()
    try:
        # ✅ SPEED OPTIMIZATION: Use gpt-4o (newer, faster) with fallback to gpt-4-turbo-preview
        try:
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
        except Exception as gpt4o_error:
            logger.warning(f"gpt-4o failed, falling back to gpt-4-turbo-preview: {gpt4o_error}")
            response = await client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
    except Exception as exc:
        logger.error(f"OpenAI API error in _generate_sql_questions: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate SQL questions") from exc

    # Parse response
    content = response.choices[0].message.content.strip() if response.choices else ""
    data = _parse_json_response(content)
    
    # Handle response format
    if isinstance(data, dict) and "questions" in data:
        questions_list = data["questions"]
    elif isinstance(data, list):
        questions_list = data
    elif isinstance(data, dict) and ("title" in data or "description" in data):
        # Single question object (new comprehensive format)
        questions_list = [data]
    elif isinstance(data, dict) and "question" in data:
        # Single question object (old format)
        questions_list = [data]
    else:
        logger.error(f"Unexpected response format for SQL questions: {data}")
        raise HTTPException(status_code=500, detail="Invalid response format from AI")
    
    # Format questions with comprehensive structure
    result = []
    for q in questions_list[:count]:
        if not isinstance(q, dict):
            continue
        
        # Extract components
        title = q.get("title", "SQL Query Challenge")
        description = q.get("description", q.get("question", ""))
        schemas = q.get("schemas", {})
        sample_data = q.get("sample_data", {})
        constraints = q.get("constraints", [])
        starter_query = q.get("starter_query", "-- Write your SQL query here\n\nSELECT ")
        hints = q.get("hints", [])
        evaluation = q.get("evaluation", {
            "engine": "postgres",
            "comparison": "result_set",
            "order_sensitive": False
        })
        question_sql_category = q.get("sql_category", sql_category)
        
        # Validate sql_category
        if question_sql_category not in SQL_CATEGORIES:
            logger.warning(f"Invalid sql_category: {question_sql_category}, defaulting to '{sql_category}'")
            question_sql_category = sql_category
        
        # Validate required fields
        if not schemas:
            logger.warning("SQL question missing schemas, skipping")
            continue
        
        # Remove any expected_output or reference_solution (should never be there)
        if "expected_output" in q:
            logger.warning("Removed unexpected 'expected_output' from AI response")
        if "reference_solution" in q:
            logger.warning("Removed unexpected 'reference_solution' from AI response")
        
        # Build formatted question text
        question_text = f"**{title}**\n\n{description}"
        
        # Add schemas
        if schemas:
            question_text += "\n\n**Database Schema:**\n"
            for table_name, table_def in schemas.items():
                columns = table_def.get("columns", {})
                question_text += f"\n**Table: `{table_name}`**\n"
                for col_name, col_type in columns.items():
                    question_text += f"- `{col_name}`: {col_type}\n"
        
        # Add sample data
        if sample_data:
            question_text += "\n**Sample Data:**\n"
            for table_name, rows in sample_data.items():
                if rows and len(rows) > 0:
                    question_text += f"\n**{table_name}:**\n"
                    # Get column names from schema
                    if table_name in schemas:
                        columns = list(schemas[table_name].get("columns", {}).keys())
                        question_text += "| " + " | ".join(columns) + " |\n"
                        question_text += "|" + "|".join("---" for _ in columns) + "|\n"
                        
                        # Add rows (show all rows since it's sample data)
                        for row in rows[:5]:  # Limit to 5 rows for display
                            question_text += "| " + " | ".join(str(val) for val in row) + " |\n"
                        
                        if len(rows) > 5:
                            question_text += f"\n*(... and {len(rows) - 5} more rows)*\n"
        
        # Add constraints
        if constraints:
            question_text += "\n**Requirements:**\n"
            for constraint in constraints:
                question_text += f"- {constraint}\n"
        
        # Add hints if available
        if hints:
            question_text += "\n**Hints:**\n"
            for hint in hints:
                question_text += f"- {hint}\n"
        
        # Create question object
        question_obj = {
            "question": question_text,
            "type": "SQL",
            "difficulty": difficulty,
            "sql_data": {
                "title": title,
                "description": description,
                "sql_category": question_sql_category,
                "schemas": schemas,
                "sample_data": sample_data,
                "constraints": constraints,
                "starter_query": starter_query,
                "hints": hints,
                "evaluation": evaluation
            }
        }
        
        # Quality validation
        try:
            metrics = await validate_question_quality(
                question=question_obj,
                question_type="SQL",
                difficulty=difficulty,
                experience_min=experience_min,
                experience_max=experience_max,
                job_designation=job_designation,
                assessment_requirements=assessment_requirements,
                topic=topic
            )
            
            if metrics.overall_score >= 0.75:
                result.append(question_obj)
                logger.debug(f"✅ SQL quality score: {metrics.overall_score:.2f}")
            else:
                logger.warning(
                    f"⚠️ Low quality SQL (score={metrics.overall_score:.2f}): "
                    f"{title[:100]}... Issues: {', '.join(metrics.issues[:3])}"
                )
                # Include anyway if not too low
                if metrics.overall_score >= 0.60:
                    result.append(question_obj)
        except Exception as e:
            logger.warning(f"Quality validation failed for SQL: {e}, including anyway")
            result.append(question_obj)
    
    if not result:
        raise HTTPException(status_code=500, detail="No valid SQL questions generated")
    
    logger.info(f"Successfully generated {len(result)} SQL questions with comprehensive structure")
    return result



