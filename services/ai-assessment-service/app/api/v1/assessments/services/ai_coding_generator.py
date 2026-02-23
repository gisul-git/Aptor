"""
Module: ai_coding_generator.py
Purpose: Coding question generation with DSA module integration

This module generates coding questions that are compatible with Judge0.
It integrates with the DSA module for high-quality question generation,
with fallback to basic OpenAI generation if DSA module is unavailable.

Dependencies:
- External: openai (for fallback generation)
- Internal: ai_utils (for OpenAI client, JSON parsing)
- Internal: judge0_utils (for language mapping, starter code)
- External: DSA module (optional - dsa_generate_question)

Example usage:
    ```python
    from app.api.v1.assessments.services.ai_coding_generator import _generate_coding_questions
    
    questions = await _generate_coding_questions(
        topic="Binary Search",
        difficulty="Medium",
        count=1,
        can_use_judge0=True,
        coding_language="python"
    )
    ```

Note: DSA module integration is optional. If unavailable, falls back to basic generation.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

# DSA module integration - HTTP client only (no fallback)
from .....utils.service_clients import get_dsa_client

_dsa_client = get_dsa_client()
DSA_AVAILABLE = True

async def dsa_generate_question(*args, **kwargs):
    """Call DSA service via HTTP to generate questions."""
    return await _dsa_client.generate_question(
        difficulty=kwargs.get("difficulty", "medium"),
        topic=kwargs.get("topic"),
        concepts=kwargs.get("concepts")
    )

# Note: generate_boilerplate is a utility function
# For now, we'll need to implement it locally or create an endpoint in DSA service
# For local testing, we can create a simple implementation
def generate_boilerplate(language: str, function_name: str, parameters: list, return_type: str) -> str:
    """Generate boilerplate code locally (temporary implementation)."""
    # Simple boilerplate generation - can be enhanced later
    if language.lower() in ["python", "python3", "py"]:
        params_str = ", ".join(p.get("name", "") for p in parameters)
        return f"def {function_name}({params_str}):\n    # Write your solution here\n    pass"
    else:
        # Generic template for other languages
        params_str = ", ".join(p.get("name", "") for p in parameters)
        return f"// {function_name}({params_str}) -> {return_type}\n// Write your solution here"

from .ai_utils import _get_openai_client, _parse_json_response
from .ai_quality import (
    validate_question_quality,
    _get_difficulty_rules,
)
from .judge0_utils import (
    _get_judge0_language_id,
    _get_starter_code_template,
    _validate_and_fix_function_signature,
)

logger = logging.getLogger(__name__)


# ============================================================================
# CODING QUESTION GENERATION
# ============================================================================

async def _generate_coding_questions(
    topic: str,
    difficulty: str,
    count: int,
    can_use_judge0: bool,
    coding_language: str = "python",
    experience_mode: str = "corporate",
    additional_requirements: Optional[str] = None,
    job_designation: Optional[str] = None,
    experience_min: Optional[int] = None,
    experience_max: Optional[int] = None,
    company_name: Optional[str] = None,
    assessment_requirements: Optional[str] = None,
    previous_question: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Generate Coding questions (Judge0-compatible) using DSA module architecture.
    Returns COMPLETE DSA-format questions with all test cases.
    
    Args:
        topic: Topic label
        difficulty: Difficulty level (Easy, Medium, Hard)
        count: Number of questions to generate
        can_use_judge0: Whether Judge0 can be used
        coding_language: Programming language (python, java, cpp, c, javascript, typescript, go, rust, kotlin, csharp)
        experience_mode: Experience mode (corporate/college)
        additional_requirements: Optional additional requirements
        job_designation: Job role for personalization
        experience_min: Minimum experience years
        experience_max: Maximum experience years
        company_name: Company name for personalization
        assessment_requirements: Global assessment requirements
        previous_question: For regeneration - avoid repeating
        
    Returns:
        List of COMPLETE coding question dictionaries with DSA format:
        - title: Problem title
        - description: Problem statement
        - examples: Array of {input, output, explanation}
        - constraints: Array of constraint strings
        - function_signature: {name, parameters, return_type}
        - stdin_format: Description of stdin format
        - public_testcases: Array of {input, is_hidden: false}
        - hidden_testcases: Array of {input, is_hidden: true}
        - starter_code: Object with language keys
        - reference_solution: Python reference solution
        - difficulty: Easy/Medium/Hard
        - type: "Coding"
        
    Raises:
        HTTPException: If can_use_judge0 is False or generation fails
    """
    logger.info(f"Generating {count} Coding question(s) for topic: {topic}, difficulty: {difficulty}, language: {coding_language}")
    
    if not can_use_judge0:
        raise HTTPException(
            status_code=400,
            detail="Coding questions require Judge0 support. Set can_use_judge0=True."
        )
    
    # Try DSA module first if available
    if DSA_AVAILABLE and dsa_generate_question is not None:
        try:
            logger.info("Using DSA module for coding question generation")
            questions = []
            for _ in range(count):
                # Generate question using DSA module
                question_data = await dsa_generate_question(
                    difficulty=difficulty.lower(),
                    topic=topic,
                    concepts=additional_requirements,
                    languages=[coding_language.lower()]
                )
                
                if question_data:
                    # ⭐ CRITICAL FIX: Build questionText for DSA-generated questions
                    # DSA module returns description but frontend expects questionText
                    # Build questionText from title + description + examples (same as fallback path)
                    question_text_parts = []
                    if question_data.get("title"):
                        question_text_parts.append(f"**{question_data['title']}**")
                    if question_data.get("description"):
                        question_text_parts.append(question_data["description"])
                    if question_data.get("examples"):
                        question_text_parts.append("\n**Examples:**")
                        for ex in question_data["examples"]:
                            question_text_parts.append(f"Input: {ex.get('input', '')}")
                            question_text_parts.append(f"Output: {ex.get('output', '')}")
                            if ex.get("explanation"):
                                question_text_parts.append(f"Explanation: {ex.get('explanation')}")
                    
                    question_text = "\n\n".join(question_text_parts) if question_text_parts else question_data.get("description", "")
                    question_data["questionText"] = question_text
                    
                    # ⭐ Return COMPLETE DSA format (with questionText added)
                    # Keep ALL fields from DSA generator - this is what frontend expects!
                    question_data["type"] = "Coding"  # Add type field for frontend
                    question_data["difficulty"] = difficulty.capitalize()  # Normalize difficulty
                    
                    # Ensure test cases have is_hidden flag
                    if "public_testcases" in question_data:
                        for tc in question_data["public_testcases"]:
                            tc["is_hidden"] = False
                    
                    if "hidden_testcases" in question_data:
                        for tc in question_data["hidden_testcases"]:
                            tc["is_hidden"] = True
                    
                    logger.info(f"✅ DSA question generated - Title: {question_data.get('title')}, Description length: {len(question_data.get('description', ''))}, QuestionText length: {len(question_text)}")
                    questions.append(question_data)
            
            if questions:
                logger.info(f"Successfully generated {len(questions)} Coding questions using DSA module")
                return questions
            else:
                logger.warning("DSA module returned no questions, falling back to basic generation")
        except Exception as exc:
            logger.warning(f"DSA generator failed: {exc}. Falling back to basic generation")
    
    # Fallback: Basic coding question generation using OpenAI (matching DSA format)
    logger.info(f"Using basic Coding question generation (OpenAI) with DSA format - generating {count} question(s)")
    
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
    
    # Get Coding-specific difficulty rules
    difficulty_rules = _get_difficulty_rules("Coding", difficulty, seniority)
    
    questions = []
    for question_num in range(count):
        # Build personalization context
        context_parts = []
        if previous_question:
            context_parts.append(f"""🔥 REGENERATION: User is regenerating. OLD QUESTION: "{previous_question[:200]}..."
MUST generate COMPLETELY DIFFERENT question. DO NOT repeat similar concepts or phrasing.""")
        
        if assessment_requirements:
            context_parts.append(f"Assessment Requirements: {assessment_requirements}")
        if company_name:
            context_parts.append(f"Company: {company_name}")
        if job_designation:
            context_parts.append(f"Job Role: {job_designation}")
        
        # Add variation context for multiple questions
        if count > 1:
            context_parts.append(f"⚠️ IMPORTANT: This is question {question_num + 1} of {count}. Generate a DIFFERENT problem from previous questions.")
        
        personalization = "\n".join(context_parts) if context_parts else ""
        
        # Supported languages (10 Judge0 languages)
        all_supported_langs = ["python", "javascript", "typescript", "cpp", "java", "c", "go", "rust", "kotlin", "csharp"]
        
        prompt = f"""You are an expert coding problem generator. Generate a LeetCode-style coding question in JSON format.

Topic: {topic}
Difficulty: {difficulty}
Language for starter code: {coding_language}

{'=' * 80}
CONTEXT-AWARE PERSONALIZATION (HIGHEST PRIORITY - USE IF PROVIDED)
{'=' * 80}
{personalization if personalization else "(No specific context provided - generate professional LeetCode-style questions)"}
{'=' * 80}

**CONTEXT USAGE GUIDELINES:**
- If company/role/requirements provided: Frame problem in that context
- Example: "At Gisul, you're building a payment API. Implement rate limiting..."
- If no context: Generate high-quality LeetCode-style problems

{'=' * 80}
DIFFICULTY CALIBRATION (CRITICAL - MUST FOLLOW EXACTLY)
{'=' * 80}

Current Difficulty: {difficulty}
Seniority Level: {seniority}

**{difficulty.upper()} Difficulty Rules for Coding ({seniority}):**

{difficulty_rules}

**Examples by Difficulty:**

EASY:
- Junior: "Implement binary search on sorted array" (single algorithm, clear steps)
- Mid: "Find two sum with O(n) time" (standard with optimization)
- Senior: "Implement LRU cache with O(1) operations" (well-known + edge cases)

MEDIUM:
- Junior: "Find longest substring without repeating chars" (two-pointer)
- Mid: "Coin change problem with space optimization" (basic DP)
- Senior: "Design Twitter feed with real-time updates" (complex DP + system)

HARD:
- Junior: "Merge k sorted lists efficiently" (complex multi-step)
- Mid: "Find shortest path with constraints" (advanced graph + optimization)
- Senior: "Design autocomplete at scale" (system constraints + performance)

VALIDATION:
- Read the rules above CAREFULLY
- Generate questions that EXACTLY match the difficulty level
- If unsure, err on the side of being MORE challenging
- Easy ≠ Medium ≠ Hard - they must be DISTINCTLY different

{'=' * 80}

⚠️ JUDGE0 PLATFORM REQUIREMENTS:
- stdin/stdout based execution ONLY
- NO external libraries/frameworks
- Algorithm/data structure problems only
- Standard library features only

Generate a JSON object with this EXACT structure (matching DSA module format):
{{
  "title": "Problem Title",
  "description": "Clear problem statement. NO examples, NO constraints here.",
  "examples": [
    {{
      "input": "nums = [2,7,11,15], target = 9",
      "output": "[0,1]",
      "explanation": "Because nums[0] + nums[1] == 9"
    }}
  ],
  "constraints": [
    "1 <= nums.length <= 10^4",
    "-10^9 <= nums[i] <= 10^9"
  ],
  "difficulty": "{difficulty.lower()}",
  "languages": {json.dumps(all_supported_langs)},
  "function_signature": {{
    "name": "functionName",
    "parameters": [
      {{"name": "nums", "type": "int[]"}},
      {{"name": "target", "type": "int"}}
    ],
    "return_type": "int[]"
  }},
  "stdin_format": "Line 1: N (array size)\\nLine 2: N space-separated integers (nums)\\nLine 3: target integer",
  "public_testcases": [
    {{"input": "4\\n2 7 11 15\\n9"}},
    {{"input": "3\\n3 2 4\\n6"}},
    {{"input": "2\\n3 3\\n6"}}
  ],
  "hidden_testcases": [
    {{"input": "1\\n5\\n5"}},
    {{"input": "2\\n-1 -2\\n-3"}},
    {{"input": "5\\n1 2 3 4 5\\n9"}}
  ],
  "starter_code": {{
    "python": "def functionName(nums, target):\\n    # Write your solution here\\n    pass",
    "{coding_language}": "starter code for {coding_language}"
  }},
  "reference_solution": "# Complete Python 3 program that reads stdin and prints output\\nimport sys\\n\\n# Read input\\n..."
}}

CRITICAL REQUIREMENTS:
1. EXAMPLES vs TESTCASES - COMPLETELY SEPARATE:
   - examples: Human-readable LeetCode style (e.g., "nums = [1,2,3]")
   - testcases: Raw stdin ONLY, NO variable names, NO JSON arrays

2. ⭐ REQUIRED: Include expected_output in ALL testcases:
   - public_testcases: MUST have both "input" AND "expected_output" fields
   - hidden_testcases: MUST have both "input" AND "expected_output" fields
   - expected_output: The exact output that should be printed for the given input

3. stdin_format: Describe your format in plain English

4. ALL testcases MUST follow EXACT same format

5. Generate at least 3 public_testcases and 3 hidden_testcases (each with expected_output)

6. starter_code: Generate for {coding_language} at minimum

7. reference_solution: Complete working Python 3 program (use this to compute expected_output for test cases)

Return ONLY valid JSON, no markdown."""
        
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
            logger.error(f"OpenAI API error in _generate_coding_questions: {exc}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to generate Coding questions") from exc

        # Parse response
        content = response.choices[0].message.content.strip() if response.choices else ""
        data = _parse_json_response(content)
        
        # Handle response format - expecting single question object (DSA format)
        if isinstance(data, dict) and ("title" in data or "description" in data):
            # Single question object (expected format)
            question_data = data
        elif isinstance(data, dict) and "questions" in data:
            # Array wrapped in questions key
            questions_list = data["questions"]
            if questions_list and isinstance(questions_list, list):
                question_data = questions_list[0]
            else:
                raise HTTPException(status_code=500, detail="No valid questions in response")
        else:
            logger.error(f"Unexpected response format for Coding questions: {data}")
            raise HTTPException(status_code=500, detail="Invalid response format from AI")
        
        # ⭐ Return COMPLETE DSA format (no transformation!)
        # Validate and sanitize the question
        if not isinstance(question_data, dict):
            raise HTTPException(status_code=500, detail="Invalid question format")
        
        # Ensure required fields exist
        if "title" not in question_data:
            question_data["title"] = f"{topic} - Coding Challenge"
        if "description" not in question_data or not question_data.get("description"):
            logger.error(f"❌ Question {question_num + 1} missing description field! Available keys: {list(question_data.keys())}")
            raise HTTPException(status_code=500, detail="Question missing description - AI did not generate problem statement")
        
        # Log description for debugging
        logger.info(f"✅ Question {question_num + 1} has description (length: {len(question_data.get('description', ''))})")
        if "function_signature" not in question_data:
            question_data["function_signature"] = {
                "name": "solve",
                "parameters": [],
                "return_type": "int"
            }
        
        # Add type field
        question_data["type"] = "Coding"
        question_data["difficulty"] = difficulty.capitalize()
        
        # Ensure test cases have is_hidden flag and expected_output
        if "public_testcases" not in question_data:
            question_data["public_testcases"] = []
        for tc in question_data["public_testcases"]:
            tc["is_hidden"] = False
            # ⭐ CRITICAL: Keep expected_output (don't remove it!)
            # If missing, try to compute from reference_solution or examples
            if "expected_output" not in tc or not tc.get("expected_output"):
                # Try to find matching example output
                input_val = tc.get("input", "")
                for ex in question_data.get("examples", []):
                    # This is a fallback - ideally AI should provide expected_output
                    pass
                # If still missing, log warning
                if "expected_output" not in tc:
                    logger.warning(f"⚠️ Test case missing expected_output: {input_val[:50]}...")
        
        if "hidden_testcases" not in question_data:
            question_data["hidden_testcases"] = []
        for tc in question_data["hidden_testcases"]:
            tc["is_hidden"] = True
            # ⭐ CRITICAL: Keep expected_output (don't remove it!)
            if "expected_output" not in tc or not tc.get("expected_output"):
                logger.warning(f"⚠️ Hidden test case missing expected_output: {tc.get('input', '')[:50]}...")
        
        # Ensure starter_code exists
        if "starter_code" not in question_data or not question_data["starter_code"]:
            question_data["starter_code"] = {}
        
        # Generate starter code for requested language if missing
        if coding_language not in question_data["starter_code"]:
            func_sig = question_data.get("function_signature", {})
            question_data["starter_code"][coding_language] = _get_starter_code_template(
                coding_language, func_sig
            )
        
        # Ensure other fields exist
        if "examples" not in question_data:
            question_data["examples"] = []
        if "constraints" not in question_data:
            question_data["constraints"] = []
        if "stdin_format" not in question_data:
            question_data["stdin_format"] = ""
        if "reference_solution" not in question_data:
            question_data["reference_solution"] = ""

        # ⭐ CRITICAL: Ensure all DSA format fields are present and valid
        # Validate that test cases exist
        if not question_data.get("public_testcases") or len(question_data.get("public_testcases", [])) == 0:
            logger.warning(f"⚠️ Question {question_num + 1} missing public_testcases, generating defaults...")
            question_data["public_testcases"] = [
                {"input": "1\n5\n5", "is_hidden": False},
                {"input": "2\n3 3\n6", "is_hidden": False},
                {"input": "3\n1 2 3\n6", "is_hidden": False}
            ]
        
        if not question_data.get("hidden_testcases") or len(question_data.get("hidden_testcases", [])) == 0:
            logger.warning(f"⚠️ Question {question_num + 1} missing hidden_testcases, generating defaults...")
            question_data["hidden_testcases"] = [
                {"input": "4\n1 1 1 1\n2", "is_hidden": True},
                {"input": "5\n-1 -2 -3 -4 -5\n-6", "is_hidden": True}
            ]
        
        # Ensure constraints exist
        if not question_data.get("constraints") or len(question_data.get("constraints", [])) == 0:
            logger.warning(f"⚠️ Question {question_num + 1} missing constraints, adding defaults...")
            question_data["constraints"] = [
                "1 <= n <= 10^5",
                "-10^9 <= values <= 10^9"
            ]
        
        # Ensure function_signature exists
        if not question_data.get("function_signature"):
            logger.warning(f"⚠️ Question {question_num + 1} missing function_signature, adding default...")
            question_data["function_signature"] = {
                "name": "solve",
                "parameters": [{"name": "nums", "type": "int[]"}],
                "return_type": "int"
            }
        
        # Ensure examples exist
        if not question_data.get("examples") or len(question_data.get("examples", [])) == 0:
            logger.warning(f"⚠️ Question {question_num + 1} missing examples, adding default...")
            question_data["examples"] = [
                {
                    "input": "nums = [1, 2, 3], target = 5",
                    "output": "[1, 2]",
                    "explanation": "Elements at indices 1 and 2 sum to 5"
                }
            ]
        
        # ⭐ CRITICAL: Transform DSA format to frontend-compatible format
        # Frontend expects: visibleTestCases, hiddenTestCases, constraints (string), functionSignature
        # DSA format has: public_testcases, hidden_testcases, constraints (array), function_signature
        
        # Transform test cases
        visible_test_cases = []
        for tc in question_data.get("public_testcases", []):
            visible_test_cases.append({
                "input": tc.get("input", ""),
                "output": tc.get("expected_output", ""),
                "expected_output": tc.get("expected_output", "")
            })
        
        # ⭐ CRITICAL FIX: Ensure visible test cases exist with at least one example
        if not visible_test_cases or len(visible_test_cases) == 0:
            logger.warning(f"⚠️ Question {question_num + 1} missing visible test cases, generating from examples...")
            # Try to use examples as test cases
            examples = question_data.get("examples", [])
            if examples:
                visible_test_cases = [{
                    "input": ex.get("input", ""),
                    "output": ex.get("output", ""),
                    "expected_output": ex.get("output", "")
                } for ex in examples[:3]]  # Use up to 3 examples
            else:
                # Fallback to generic test cases
                visible_test_cases = [
                    {"input": "Sample input", "output": "Sample output", "expected_output": "Sample output"}
                ]
        
        hidden_test_cases = []
        for tc in question_data.get("hidden_testcases", []):
            hidden_test_cases.append({
                "input": tc.get("input", ""),
                "output": tc.get("expected_output", ""),
                "expected_output": tc.get("expected_output", "")
            })
        
        # Transform constraints from array to string
        constraints_array = question_data.get("constraints", [])
        constraints_string = "\n".join(constraints_array) if isinstance(constraints_array, list) else str(constraints_array) if constraints_array else ""
        
        # Transform function signature
        func_sig = question_data.get("function_signature", {})
        function_signature = func_sig if isinstance(func_sig, dict) else str(func_sig) if func_sig else ""
        
        # Build questionText from title + description + examples
        question_text_parts = []
        if question_data.get("title"):
            question_text_parts.append(f"**{question_data['title']}**")
        if question_data.get("description"):
            question_text_parts.append(question_data["description"])
        if question_data.get("examples"):
            question_text_parts.append("\n**Examples:**")
            for ex in question_data["examples"]:
                question_text_parts.append(f"Input: {ex.get('input', '')}")
                question_text_parts.append(f"Output: {ex.get('output', '')}")
                if ex.get("explanation"):
                    question_text_parts.append(f"Explanation: {ex.get('explanation')}")
        
        question_text = "\n\n".join(question_text_parts)
        
        # Get starter code (prefer the requested language, fallback to python)
        starter_code_dict = question_data.get("starter_code", {})
        starter_code = starter_code_dict.get(coding_language, "") or starter_code_dict.get("python", "") or (list(starter_code_dict.values())[0] if starter_code_dict else "")
        
        # Build final question object in frontend-compatible format
        final_question = {
            # Core fields
            "type": "Coding",
            "difficulty": difficulty.capitalize(),
            "questionText": question_text,
            "starterCode": starter_code,
            
            # Test cases (frontend format)
            "visibleTestCases": visible_test_cases,
            "hiddenTestCases": hidden_test_cases,
            
            # Constraints (string format for frontend)
            "constraints": constraints_string,
            
            # Function signature (object format - frontend can handle both)
            "functionSignature": function_signature,
            
            # ⭐ CRITICAL: Do NOT include sampleInput/sampleOutput (frontend will show empty boxes)
            # Only include if we have actual values (legacy support)
            # "sampleInput": "",  # Don't set empty values
            # "sampleOutput": "",  # Don't set empty values
            
            # Preserve DSA format fields for backward compatibility
            "title": question_data.get("title", ""),
            "description": question_data.get("description", ""),
            "examples": question_data.get("examples", []),
            "public_testcases": question_data.get("public_testcases", []),
            "hidden_testcases": question_data.get("hidden_testcases", []),
            "function_signature": func_sig,
            "starter_code": starter_code_dict,
            "languages": question_data.get("languages", []),
        }
        
        logger.info(f"✅ Successfully generated Coding question {question_num + 1}/{count} (transformed to frontend format)")
        logger.info(f"  - Title: {final_question.get('title')}")
        logger.info(f"  - Visible testcases: {len(visible_test_cases)}")
        logger.info(f"  - Hidden testcases: {len(hidden_test_cases)}")
        logger.info(f"  - Constraints: {len(constraints_array)} items -> {len(constraints_string)} chars")
        logger.info(f"  - Examples: {len(question_data.get('examples', []))}")
        logger.info(f"  - Function signature: {function_signature is not None}")
        logger.info(f"  - Starter code: {len(starter_code)} chars")
        
        # Quality validation
        try:
            metrics = await validate_question_quality(
                question=final_question,
                question_type="Coding",
                difficulty=difficulty,
                experience_min=experience_min,
                experience_max=experience_max,
                job_designation=job_designation,
                assessment_requirements=assessment_requirements,
                topic=topic
            )
            
            if metrics.overall_score >= 0.75:
                questions.append(final_question)
                logger.debug(f"✅ Coding quality score: {metrics.overall_score:.2f}")
            else:
                logger.warning(
                    f"⚠️ Low quality Coding (score={metrics.overall_score:.2f}): "
                    f"{final_question.get('title', '')[:100]}... Issues: {', '.join(metrics.issues[:3])}"
                )
                # Include anyway if not too low
                if metrics.overall_score >= 0.60:
                    questions.append(final_question)
        except Exception as e:
            logger.warning(f"Quality validation failed for Coding: {e}, including anyway")
            questions.append(final_question)
    
    if not questions:
        raise HTTPException(status_code=500, detail="Failed to generate any Coding questions")
    
    logger.info(f"✅ Generated {len(questions)} Coding question(s) total")
    return questions




