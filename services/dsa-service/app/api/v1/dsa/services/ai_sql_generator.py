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
    }}
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

7. DO NOT INCLUDE:
   - expected_output (will be computed by running reference query)
   - reference_solution (admin will provide separately)
   - stdin/stdout testcases (SQL uses result set comparison)

8. DIFFICULTY GUIDELINES:
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
        
        # === CRITICAL: Remove any expected_output or reference_solution ===
        # These should NEVER be generated by AI
        if "expected_output" in question_data:
            del question_data["expected_output"]
            logger.warning("[SQL Generator] Removed unexpected 'expected_output' from AI response")
        
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

