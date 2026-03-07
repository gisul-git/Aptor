"""
SQL Question Generator - DSA Competency

Generates SQL questions using OpenAI.
Creates questions with:
1. Description - Problem statement
2. Table Schemas - Database structure
3. Sample Data - Example rows
4. Constraints - Query requirements

SQL questions are a separate question_type within DSA competency.
They do NOT use stdin/stdout testcases like coding questions.
"""

import os
import json
import logging
from dotenv import load_dotenv
from typing import Dict, Any, Optional

from openai import OpenAI

load_dotenv()

logger = logging.getLogger("backend")

# SQL categories for classification
SQL_CATEGORIES = [
    "select",       # Basic SELECT queries
    "join",         # JOIN operations (INNER, LEFT, RIGHT, FULL)
    "aggregation",  # GROUP BY, HAVING, COUNT, SUM, AVG
    "subquery",     # Nested queries, EXISTS, IN
    "window",       # Window functions (ROW_NUMBER, RANK, LAG, LEAD)
    "manipulation", # INSERT, UPDATE, DELETE (less common for assessments)
]


async def generate_sql_question(
    difficulty: str = "medium",
    topic: Optional[str] = None,
    concepts: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a complete SQL question using OpenAI.
    
    Creates SQL question with:
    - description: Problem statement
    - schemas: Table definitions
    - sample_data: Example data for tables
    - constraints: Query requirements
    
    Args:
        difficulty: easy, medium, or hard
        topic: Main topic (e.g., "Joins", "Aggregation", "Window Functions")
        concepts: Specific concepts to cover (e.g., "LEFT JOIN, GROUP BY")
    
    Returns:
        Complete SQL question JSON with all fields populated
    """
    # Build topic/concept prompt
    topic_prompt = ""
    if topic:
        topic_prompt += f"Topic: {topic}. "
    if concepts:
        topic_prompt += f"Concepts to cover: {concepts}. "
    
    prompt = f"""You are an expert SQL question generator for technical assessments.
Generate a SQL question in JSON format.

{topic_prompt}Difficulty: {difficulty}

=== GENERATE A JSON OBJECT WITH THIS EXACT STRUCTURE ===

{{
    "title": "Problem Title",
    
    "description": "Clear problem statement explaining what data needs to be retrieved or manipulated. Describe the business scenario. NO table schemas here, NO sample data here. Just the problem description.",
    
    "difficulty": "{difficulty}",
    
    "sql_category": "join",
    
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
    }},
    
    "reference_query": "SELECT e.name, e.salary, d.name as department FROM employees e JOIN departments d ON e.department_id = d.id WHERE e.hire_date > '2019-01-01' ORDER BY e.salary DESC;"
}}

=== CRITICAL REQUIREMENTS ===

1. SQL CATEGORY (required):
   Must be one of: "select", "join", "aggregation", "subquery", "window", "manipulation"

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

7. REFERENCE QUERY (required):
   - Provide a complete, correct SQL query that solves the problem
   - This will be used to generate expected_output automatically
   - Must work with the provided schemas and sample_data
   - Should follow all constraints and requirements

8. DO NOT INCLUDE:
   - expected_output (will be computed by running reference_query)
   - stdin/stdout testcases (SQL uses result set comparison)

9. DIFFICULTY GUIDELINES:
   - Easy: Single table, basic SELECT, WHERE, ORDER BY
   - Medium: JOINs, GROUP BY, HAVING, basic subqueries
   - Hard: Window functions, complex subqueries, CTEs, multiple JOINs

IMPORTANT: Return ONLY valid JSON. No markdown code blocks, no explanations."""

    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert SQL question generator for technical assessments.

CRITICAL RULES:
1. Generate realistic database schemas with proper relationships
2. Create meaningful sample data that tests the problem requirements
3. NEVER include expected_output or reference_solution
4. Focus on practical SQL skills testing
5. Return valid JSON only - no markdown, no explanations"""
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
        )
        
        # Get content from response
        if not response.choices or not response.choices[0].message.content:
            raise ValueError("OpenAI API returned empty response")
        
        content = response.choices[0].message.content.strip()
        
        # Log raw content for debugging (first 500 chars)
        logger.info(f"[SQL Generator] Raw AI response (first 500 chars): {content[:500]}")
        
        if not content:
            raise ValueError("OpenAI API returned empty content")
        
        # Remove markdown code blocks if present
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        # Extract JSON from content
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        
        if json_start >= 0 and json_end > json_start:
            content = content[json_start:json_end]
        
        if not content:
            raise ValueError("No JSON content found in AI response")
        
        # Parse JSON
        try:
            question_data = json.loads(content)
        except json.JSONDecodeError as json_err:
            logger.error(f"[SQL Generator] Failed to parse JSON: {json_err}")
            logger.error(f"[SQL Generator] Content preview: {content[:200]}...")
            raise ValueError(f"Failed to parse AI response as JSON: {json_err}")
        
        # Validate required fields
        required_fields = ["title", "description", "difficulty", "sql_category", "schemas", "sample_data"]
        for field in required_fields:
            if field not in question_data:
                if field == "sql_category":
                    question_data["sql_category"] = "select"  # Default
                    logger.warning(f"[SQL Generator] Missing sql_category, using default: select")
                elif field == "schemas":
                    raise ValueError(f"Generated SQL question missing required field: {field}")
                elif field == "sample_data":
                    question_data["sample_data"] = {}
                    logger.warning(f"[SQL Generator] Missing sample_data, using empty object")
                else:
                    raise ValueError(f"Generated SQL question missing required field: {field}")
        
        # Validate sql_category
        if question_data.get("sql_category") not in SQL_CATEGORIES:
            logger.warning(f"[SQL Generator] Invalid sql_category: {question_data.get('sql_category')}, defaulting to 'select'")
            question_data["sql_category"] = "select"
        
        # Ensure constraints exist
        if "constraints" not in question_data:
            question_data["constraints"] = []
        
        # Ensure starter_query exists
        if "starter_query" not in question_data:
            question_data["starter_query"] = "-- Write your SQL query here\n\nSELECT "
        
        # Ensure hints exist (optional but nice to have)
        if "hints" not in question_data:
            question_data["hints"] = []
        
        # Ensure evaluation config exists
        if "evaluation" not in question_data:
            question_data["evaluation"] = {
                "engine": "postgres",
                "comparison": "result_set",
                "order_sensitive": False
            }
        
        # Ensure reference_query exists (required for generating expected_output)
        if "reference_query" not in question_data or not question_data.get("reference_query", "").strip():
            logger.warning("[SQL Generator] No reference_query generated by AI, question will need manual reference query")
        
        # === CRITICAL: Remove any expected_output (will be generated from reference_query) ===
        if "expected_output" in question_data:
            del question_data["expected_output"]
            logger.warning("[SQL Generator] Removed unexpected 'expected_output' from AI response - will be generated from reference_query")
        
        if "reference_solution" in question_data:
            del question_data["reference_solution"]
            logger.warning("[SQL Generator] Removed unexpected 'reference_solution' from AI response")
        
        # Add metadata
        question_data["competency"] = "DSA"
        question_data["question_type"] = "SQL"
        
        return question_data
        
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse AI response as JSON: {e}")
    except Exception as e:
        raise Exception(f"OpenAI API error: {e}")


async def create_seed_for_generated_question(question_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a seed for a generated SQL question and add groupId/seedSql.
    Also generates expected_output from reference_query if available.
    
    This should be called after generate_sql_question() to create the seed
    in the SQL execution engine and generate expected output.
    
    Args:
        question_data: Generated question data with schemas and sample_data
        
    Returns:
        Updated question_data with groupId, seedSql, and expected_output added
    """
    from .sql_question_service import get_sql_question_service
    from .sql_seed_converter import convert_to_seed_sql
    import json
    
    schemas = question_data.get("schemas", {})
    sample_data = question_data.get("sample_data", {})
    reference_query = question_data.get("reference_query", "").strip()
    
    if not schemas:
        logger.warning("[SQL Generator] No schemas found, skipping seed creation")
        return question_data
    
    try:
        sql_service = get_sql_question_service()
        group_id = await sql_service.create_seed_for_question(schemas, sample_data)
        seed_sql = convert_to_seed_sql(schemas, sample_data)
        
        question_data["groupId"] = group_id
        question_data["seedSql"] = seed_sql
        
        logger.info(f"[SQL Generator] Created seed with groupId: {group_id}")
        
        # Generate expected_output from reference_query if available
        if reference_query:
            try:
                # Use a temporary question_id for execution (we don't have a real question_id yet)
                # The SQL engine will create a temporary database for this execution
                temp_question_id = "temp_generation"
                expected_output = await sql_service.generate_expected_output(
                    question_id=temp_question_id,
                    reference_query=reference_query,
                    group_id=group_id
                )
                
                # Store expected_output as JSON string for compatibility
                if expected_output:
                    question_data["sql_expected_output"] = json.dumps(expected_output, indent=2)
                    logger.info(f"[SQL Generator] Generated expected_output from reference_query ({len(expected_output)} rows)")
                else:
                    logger.warning("[SQL Generator] Reference query executed but returned empty result")
            except Exception as e:
                logger.warning(f"[SQL Generator] Failed to generate expected_output from reference_query: {e}")
                # Don't fail the generation, just log the warning
        else:
            logger.info("[SQL Generator] No reference_query provided, skipping expected_output generation")
            
    except Exception as e:
        logger.error(f"[SQL Generator] Failed to create seed: {e}")
        # Don't fail the generation, just log the error
        # The seed can be created later when the question is saved
    
    return question_data
