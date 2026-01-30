"""
AI Question Generator - CLEAN, DETERMINISTIC, CORRECT

Generates complete DSA coding questions with strict consistency guarantees.
No mismatches. No placeholders. No guessing.
"""

import os
import json
import logging
from dotenv import load_dotenv
from typing import Dict, Any, Optional, List, Union

from openai import OpenAI

load_dotenv()

logger = logging.getLogger("backend")


def _validate_json_testcase_format(question_data: Dict[str, Any]) -> Optional[str]:
    """
    Validate that test cases are in JSON format (new LeetCode-style format).
    Returns error message if validation fails, None otherwise.
    """
    issues = []
    
    for tc_type in ["public_testcases", "hidden_testcases"]:
        testcases = question_data.get(tc_type, [])
        if isinstance(testcases, list):
            for idx, tc in enumerate(testcases):
                if isinstance(tc, dict) and "input" in tc:
                    test_input = tc.get("input")
                    
                    # Input should be a dict (JSON object) with parameter names as keys
                    if not isinstance(test_input, dict):
                        issues.append(f"{tc_type}[{idx}].input must be a JSON object (dict), got {type(test_input).__name__}")
                    
                    # Expected output should be a JSON value (not necessarily a string)
                    expected_output = tc.get("expected_output")
                    if expected_output is not None:
                        # If it's a string, try to parse it as JSON
                        if isinstance(expected_output, str):
                            try:
                                json.loads(expected_output)
                            except json.JSONDecodeError:
                                # If it's not valid JSON string, it might be a plain string value
                                pass
    
    if issues:
        return "; ".join(issues)
    return None


def _normalize_json_testcase_format(question_data: Dict[str, Any]) -> None:
    
    for tc_type in ["public_testcases", "hidden_testcases"]:
        testcases = question_data.get(tc_type, [])
        if not isinstance(testcases, list):
            continue

        for idx, tc in enumerate(testcases):
            if not isinstance(tc, dict):
                continue

            # Normalize input: stringified JSON -> dict
            test_input = tc.get("input")
            if isinstance(test_input, str):
                stripped = test_input.strip()
                # Heuristic: looks like JSON object
                if stripped.startswith("{") and stripped.endswith("}"):
                    try:
                        parsed = json.loads(stripped)
                        if isinstance(parsed, dict):
                            tc["input"] = parsed
                    except json.JSONDecodeError:
                        # Leave as-is; validator will report if needed
                        pass

            # Normalize expected_output: stringified JSON -> JSON value
            expected_output = tc.get("expected_output")
            if isinstance(expected_output, str):
                stripped_eo = expected_output.strip()
                # Only attempt to parse when it looks like JSON (array, object, number, boolean, null)
                if stripped_eo and stripped_eo[0] in "[{\"-0123456789tfn":
                    try:
                        parsed_eo = json.loads(stripped_eo)
                        tc["expected_output"] = parsed_eo
                    except json.JSONDecodeError:
                        # Not valid JSON string; keep original plain string
                        pass


def _infer_function_signature_from_testcases(question_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Infer function signature from test cases.
    Analyzes test case inputs to determine parameter names and types.
    """
    # Get first test case to infer structure
    first_tc = None
    for tc_type in ["public_testcases", "hidden_testcases"]:
        testcases = question_data.get(tc_type, [])
        if testcases and isinstance(testcases[0], dict):
            first_tc = testcases[0]
            break
    
    if not first_tc or not isinstance(first_tc.get("input"), dict):
        return None
    
    test_input = first_tc["input"]
    expected_output = first_tc.get("expected_output")
    
    # Infer parameter names and types
    parameters = []
    for param_name, param_value in test_input.items():
        # Infer type from value
        param_type = "int"
        if isinstance(param_value, list):
            if param_value and isinstance(param_value[0], int):
                param_type = "int[]"
            elif param_value and isinstance(param_value[0], str):
                param_type = "string[]"
            elif param_value and isinstance(param_value[0], list):
                param_type = "int[][]"  # Matrix
            else:
                param_type = "int[]"
        elif isinstance(param_value, str):
            param_type = "string"
        elif isinstance(param_value, bool):
            param_type = "boolean"
        
        parameters.append({
            "name": param_name,
            "type": param_type
        })
    
    # Infer return type from expected output
    return_type = "int"
    if isinstance(expected_output, list):
        if expected_output and isinstance(expected_output[0], int):
            return_type = "int[]"
        elif expected_output and isinstance(expected_output[0], str):
            return_type = "string[]"
        else:
            return_type = "int[]"
    elif isinstance(expected_output, str):
        return_type = "string"
    elif isinstance(expected_output, bool):
        return_type = "boolean"
    elif expected_output is None:
        return_type = "void"
    
    # Generate function name from title
    title = question_data.get("title", "solution")
    function_name = "".join(word.capitalize() for word in title.split()[:3])
    if not function_name:
        function_name = "solution"
    # Convert to camelCase
    function_name = function_name[0].lower() + function_name[1:] if len(function_name) > 1 else function_name.lower()
    
    return {
        "name": function_name,
        "parameters": parameters,
        "return_type": return_type
    }


def _validate_question_consistency(question_data: Dict[str, Any]) -> Optional[str]:
    """
    Validate that all parts of the question describe the same problem.
    Returns error message if inconsistencies found, None otherwise.
    """
    title = question_data.get("title", "").lower()
    description = question_data.get("description", "").lower()
    if not description:
        # Fallback to old field name
        description = question_data.get("problem_description", "").lower()
    
    # Get examples (new format) or example (old format)
    examples = question_data.get("examples", [])
    if examples and isinstance(examples, list) and len(examples) > 0:
        example = examples[0]
        example_input = str(example.get("input", "")).lower()
        example_output = str(example.get("output", "")).lower()
        example_explanation = str(example.get("explanation", "")).lower()
    else:
        # Fallback to old format
        example = question_data.get("example", {})
        example_input = str(example.get("input", "")).lower()
        example_output = str(example.get("output", "")).lower()
        example_explanation = str(example.get("explanation", "")).lower()
    
    # Collect all testcase inputs and outputs (handle JSON format)
    all_testcase_inputs = []
    all_testcase_outputs = []
    for tc_type in ["public_testcases", "hidden_testcases"]:
        for tc in question_data.get(tc_type, []):
            # For JSON format, convert dict to string representation
            tc_input = tc.get("input", "")
            if isinstance(tc_input, dict):
                # Convert JSON object to string for comparison
                tc_input_str = json.dumps(tc_input, sort_keys=True)
            else:
                tc_input_str = str(tc_input)
            all_testcase_inputs.append(tc_input_str.lower())
            
            tc_output = tc.get("expected_output")
            if isinstance(tc_output, (dict, list)):
                # Convert JSON value to string
                tc_output_str = json.dumps(tc_output, sort_keys=True)
            else:
                tc_output_str = str(tc_output) if tc_output is not None else ""
            all_testcase_outputs.append(tc_output_str.lower())
    
    # Combine all testcase text
    testcase_text = " ".join(all_testcase_inputs + all_testcase_outputs)
    
    issues = []
    
    # Problem type keywords
    problem_types = {
        "matrix": ["matrix", "spiral", "grid", "transpose", "rotate"],
        "prime": ["prime", "factor", "divisible", "composite"],
        "array": ["array", "list", "sequence"],
        "tree": ["tree", "binary", "node", "leaf"],
        "graph": ["graph", "node", "edge", "vertex"],
        "string": ["string", "substring", "character"],
        "sort": ["sort", "sorted", "order"],
        "search": ["search", "find", "locate"],
    }
    
    # Detect problem type from title
    title_type = None
    for prob_type, keywords in problem_types.items():
        if any(kw in title for kw in keywords):
            title_type = prob_type
            break
    
    # Detect problem type from testcases (what they actually test)
    # For JSON format, extract text from JSON values
    testcase_text_for_type = testcase_text
    # Try to extract meaningful text from JSON objects
    try:
        for tc_type in ["public_testcases", "hidden_testcases"]:
            for tc in question_data.get(tc_type, []):
                if isinstance(tc, dict):
                    input_val = tc.get("input", {})
                    if isinstance(input_val, dict):
                        # Extract values from JSON object
                        testcase_text_for_type += " " + " ".join(str(v) for v in input_val.values() if v)
                    output_val = tc.get("expected_output")
                    if output_val:
                        testcase_text_for_type += " " + str(output_val)
    except:
        pass
    
    testcase_type = None
    for prob_type, keywords in problem_types.items():
        if any(kw in testcase_text_for_type.lower() for kw in keywords):
            testcase_type = prob_type
            break
    
    # Detect problem type from description
    description_type = None
    for prob_type, keywords in problem_types.items():
        if any(kw in description for kw in keywords):
            description_type = prob_type
            break
    
    # Detect problem type from examples
    examples = question_data.get("examples", [])
    example_text = ""
    if examples and isinstance(examples, list) and len(examples) > 0:
        example = examples[0]
        example_text = f"{example.get('input', '')} {example.get('output', '')} {example.get('explanation', '')}"
    else:
        # Fallback to old format
        example_text = f"{example_input} {example_output} {example_explanation}"
    
    example_type = None
    for prob_type, keywords in problem_types.items():
        if any(kw in example_text.lower() for kw in keywords):
            example_type = prob_type
            break
                    
    # Check 1: Title and testcases should match (they're usually correct)
    if title_type and testcase_type and title_type != testcase_type:
        issues.append(f"Title suggests '{title_type}' problem but testcases show '{testcase_type}' problem")
    
    # Check 2: Description must match title/testcases
    if title_type and description_type and title_type != description_type:
        issues.append(f"Title suggests '{title_type}' problem but description describes '{description_type}' problem")
    
    if testcase_type and description_type and testcase_type != description_type:
        issues.append(f"Testcases show '{testcase_type}' problem but description describes '{description_type}' problem")
    
    # Check 3: Example must match title/testcases
    if title_type and example_type and title_type != example_type:
        issues.append(f"Title suggests '{title_type}' problem but example shows '{example_type}' problem")
    
    if testcase_type and example_type and testcase_type != example_type:
        issues.append(f"Testcases show '{testcase_type}' problem but example shows '{example_type}' problem")
    
    # Check 4: Specific common mismatches
    # Matrix vs Prime (very common mismatch)
    if ("matrix" in title or "transpose" in title or "spiral" in title) and "prime" in description:
        issues.append("Title mentions matrix/transpose/spiral but description mentions prime numbers")
    
    if ("matrix" in testcase_text or "transpose" in testcase_text) and "prime" in description:
        issues.append("Testcases show matrix/transpose problem but description mentions prime numbers")
    
    if ("matrix" in title or "transpose" in title) and "prime" in example_text:
        issues.append("Title mentions matrix/transpose but example shows prime number problem")
    
    if ("matrix" in testcase_text or "transpose" in testcase_text) and "prime" in example_text:
        issues.append("Testcases show matrix/transpose problem but example shows prime number problem")
    
    # Check 5: Example input/output pattern should match testcase patterns
    # If testcases have matrix-like inputs (multiple lines with space-separated numbers)
    # but example has single integer input, that's a mismatch
    if testcase_text:
        # Check if testcases suggest matrix input (multiple lines)
        testcase_lines = [tc for tc in all_testcase_inputs if tc.count('\n') > 0]
        example_has_multiple_lines = example_input.count('\n') > 0
        
        if len(testcase_lines) >= 2 and not example_has_multiple_lines:
            # Testcases use multi-line input but example uses single-line
            if "matrix" in title or "matrix" in testcase_text:
                issues.append("Testcases use multi-line matrix input but example uses single-line input")
    
    # Check 6: Description should mention what testcases actually test
    # If testcases show matrix operations but description talks about something else
    if testcase_type and description_type and testcase_type != description_type:
        # Already caught above, but be more specific
        if testcase_type == "matrix" and description_type == "prime":
            issues.append("CRITICAL: Testcases test matrix operations but description explains prime number checking")
    
    if issues:
        return "; ".join(issues)
    return None


async def generate_question(
    difficulty: str = "medium", 
    topic: Optional[str] = None,
    concepts: Optional[Union[str, List[str]]] = None,
    languages: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Generate a complete, correct, and internally consistent DSA coding question.
    
    Args:
        difficulty: "easy", "medium", or "hard"
        topic: Main topic (e.g., "Arrays", "Trees", "Graphs")
        concepts: String or list of concepts (e.g., "Two Pointers" or ["Two Pointers", "BFS"])
        languages: List of languages to generate starter code for (e.g., ["python", "java", "cpp"])
                   If None, defaults to all 10 supported languages
    
    Returns:
        Complete question JSON with all fields populated and validated
    
    Raises:
        ValueError: If generation fails or question is inconsistent
    """
    # Validate difficulty
    if difficulty not in ["easy", "medium", "hard"]:
        raise ValueError(f"Invalid difficulty: {difficulty}. Must be 'easy', 'medium', or 'hard'")
    
    # Validate and set languages
    supported_languages = ["python", "javascript", "typescript", "cpp", "java", "c", "go", "rust", "csharp", "kotlin"]
    if languages is None:
        languages = supported_languages
        logger.info(f"No languages specified, defaulting to all supported languages: {languages}")
    else:
        # Validate all requested languages are supported
        if not isinstance(languages, list):
            raise ValueError(f"Languages must be a list, got {type(languages)}")
        invalid_languages = [lang for lang in languages if lang not in supported_languages]
        if invalid_languages:
            raise ValueError(f"Unsupported languages: {invalid_languages}. Supported: {supported_languages}")
        if not languages:
            raise ValueError("At least one language must be selected")
        logger.info(f"Generating starter code for selected languages: {languages}")
    
    # Convert concepts to string
    concepts_str = ""
    if concepts:
        if isinstance(concepts, list):
            concepts_str = ", ".join(concepts)
        else:
            concepts_str = str(concepts)
    
    # Build system prompt
    system_prompt = """You are a JSON-only coding question generator.

CORE PRINCIPLES:
- Simplicity over complexity
- Determinism over creativity
- Correctness over cleverness
- NO hardcoding tricks
- NO dynamic generation inside JSON

 CRITICAL: ZERO MISMATCHES ALLOWED 
The title, description, example, and ALL testcases MUST describe the EXACT SAME problem.
If you generate testcases for one problem but description for another, that is a CRITICAL ERROR.
You MUST generate correctly from the start - validation is a safety net, not a fix.

GENERATION RULE:
Generate testcases FIRST, then write title/description/example to match those testcases.
Do NOT write description first and then testcases - this causes mismatches.

STRICT OUTPUT RULES:
- Output MUST be valid JSON only
- No markdown, no explanations outside JSON
- Response MUST start with '{' and end with '}'
- All values must be literal strings
- NO code execution or expressions inside JSON
- NO placeholders like "e.g." or dummy values

FAIL-SAFE:
If you cannot guarantee correctness or consistency, return:
{"error":"CANNOT_GENERATE_CLEAN_QUESTION"}"""
    
    # Build languages list for prompt
    languages_str = ", ".join(languages) if languages else "all supported languages"
    
    # Build user prompt - STRICT GENERATION ORDER TO PREVENT MISMATCHES
    user_prompt = f"""Generate a complete DSA coding question.

INPUTS:
Topic: {topic or "General"}
Concepts: {concepts_str or "General"}
Difficulty: {difficulty}
Languages: {languages_str}

🚨 MANDATORY GENERATION ORDER (FOLLOW EXACTLY) 🚨
You MUST generate in this order to prevent mismatches:

STEP 1: DECIDE THE PROBLEM
- Choose ONE specific problem type (e.g., matrix transpose, prime checking, array rotation)
- Write down what problem you chose: "I am generating a [PROBLEM TYPE] problem"

STEP 2: GENERATE TESTCASES FIRST
- Generate public_testcases (3 testcases) for the chosen problem
- Generate hidden_testcases (3 testcases) for the chosen problem
- These testcases DEFINE what problem you're solving
- Look at your testcases: What problem do they actually test? Write it down.

STEP 3: GENERATE TITLE
- Title MUST match what the testcases test
- If testcases show matrix operations → title must mention "matrix"
- If testcases show prime checking → title must mention "prime"
- Verify: Does title match testcases? If NO, fix it.

STEP 4: GENERATE DESCRIPTION
- Description MUST explain EXACTLY what the testcases test
- Read your testcases again - what operation are they testing?
- Write description that explains THAT operation, NOT a different one
- Verify: Does description explain what testcases test? If NO, rewrite it.

STEP 5: GENERATE EXAMPLE
- Example MUST demonstrate the SAME problem as testcases
- Look at testcase input format - does it use multi-line? single integer? array?
- Example input MUST use the SAME format as testcases
- Example output MUST follow the SAME logic as testcases
- Verify: Does example show same problem as testcases? If NO, fix it.

STEP 6: FINAL CHECK
Before returning JSON, verify:
1. All testcases test the SAME problem type
2. Title mentions that problem type
3. Description explains that problem type
4. Example demonstrates that problem type
5. Input formats match (if testcases use multi-line, example uses multi-line)
6. Output formats match (if testcases output matrices, example outputs matrix)

If ANY check fails, DO NOT return the JSON. Fix it first or return {{"error":"CANNOT_GENERATE_CLEAN_QUESTION"}}

REQUIRED OUTPUT (JSON ONLY):
{{
  "title": string,
  "difficulty": "easy" | "medium" | "hard",
  "description": string,
  "examples": [
    {{"input": string, "output": string, "explanation": string}}
  ],
  "constraints": [string, string, ...],
  "public_testcases": [
    {{"input": {{"param1": value1, "param2": value2}}, "expected_output": jsonValue, "is_hidden": false}},
    {{"input": {{"param1": value1, "param2": value2}}, "expected_output": jsonValue, "is_hidden": false}},
    {{"input": {{"param1": value1, "param2": value2}}, "expected_output": jsonValue, "is_hidden": false}}
  ],
  "hidden_testcases": [
    {{"input": {{"param1": value1, "param2": value2}}, "expected_output": jsonValue, "is_hidden": true}},
    {{"input": {{"param1": value1, "param2": value2}}, "expected_output": jsonValue, "is_hidden": true}},
    {{"input": {{"param1": value1, "param2": value2}}, "expected_output": jsonValue, "is_hidden": true}}
  ],
  "function_signature": {{
    "name": "functionName",
    "parameters": [
      {{"name": "param1", "type": "int[]"}},
      {{"name": "param2", "type": "int"}}
    ],
    "return_type": "int[]"
  }},
  "starter_code": {{
    // Generate starter code ONLY for the selected languages: {languages_str}
    // Example (only include languages from the list):
    "python": "def functionName(params):\n    pass",
    "java": "class Solution {{\n    public returnType functionName(params) {{\n        \n    }}\n}}"
    // DO NOT include languages not in the selected list
  }}
}}

IMPORTANT: The starter_code examples above show the SIMPLE format you must use.
- Use appropriate function name based on the problem (e.g., countPrimes, transposeMatrix, findMax)
- Use appropriate parameters based on testcase inputs (e.g., nums: List[int], matrix: List[List[int]])
- Use appropriate return type based on testcase outputs (e.g., int, List[int], void)
- Keep it SIMPLE - just function signatures, NO full programs, NO stdin reading, NO main() functions

TECHNICAL RULES - TESTCASE INPUT FORMAT (CRITICAL - JSON FORMAT):
- Test cases MUST use JSON format for inputs and outputs
- Input format: JSON object with parameter names as keys
  * Example: {{"nums": [2,7,11,15], "target": 9}}
  * Example: {{"n": 5}}
  * Example: {{"s": "hello", "k": 2}}
- Expected output format: JSON value (not string)
  * Example: [0,1] (not "[0,1]")
  * Example: 42 (not "42")
  * Example: true (not "true")
- DO NOT use string-based formats:
  * ❌ "nums = [1,2,3], target = 5"
  * ❌ "5\n"
  * ❌ "[1,2,3]"
- Expected outputs MUST be logically computed, NOT guessed
- NO placeholders like "e.g." or dummy values
- ALL values must be proper JSON (arrays, objects, primitives)
- LeetCode-style execution → function-only code, system handles I/O

STARTER CODE REQUIREMENTS:
- Generate starter code ONLY for these selected languages: {languages_str}
- DO NOT generate starter code for languages not in the list above
- Starter code must be SIMPLE function signatures ONLY - NO full programs, NO stdin reading, NO main() functions
- Based on your testcases, determine the function signature (function name, parameters, return type)
- Generate function signatures in the format appropriate for each language:
  * Python: def functionName(params): followed by pass
  * JavaScript: function functionName(params) {{ }}
  * TypeScript: function functionName(params): returnType {{ }}
  * C++: returnType functionName(params) {{ }}
  * Java: public returnType functionName(params) {{ }}
  * C: returnType functionName(params) {{ }}
  * Go: func functionName(params) returnType {{ }}
  * Rust: fn functionName(params) -> returnType {{ }}
  * C#: public returnType FunctionName(params) {{ }}
  * Kotlin: fun functionName(params): returnType {{ }}
- Use literal strings only - NO dynamic generation in starter code values
- Keep it SIMPLE - just function signatures with proper parameters and return types, nothing more

Return ONLY the JSON object. No markdown. No explanations."""
    
    # Call OpenAI
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set. Please configure it in your .env file.")
    client = OpenAI(api_key=openai_api_key)
    
    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
            )
            
            if not response.choices or not response.choices[0].message.content:
                if attempt < max_retries:
                    logger.warning(f"Attempt {attempt + 1}: Empty response. Retrying...")
                    continue
                else:
                    raise ValueError("AI returned empty response")
            
            content = response.choices[0].message.content.strip()
            
            # Log raw AI response for debugging
            logger.info("=" * 80)
            logger.info(f"ATTEMPT {attempt + 1}: Raw AI Response:")
            logger.info("=" * 80)
            logger.info(content)
            logger.info("=" * 80)
            
            # Remove markdown code fences if present
            if content.startswith("```"):
                lines = content.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                content = "\n".join(lines)

            # If the model wrapped the JSON with explanation steps (STEP 1..., RETURNING JSON: {...}),
            # try to isolate the final JSON block after 'RETURNING JSON:' to avoid extra text.
            marker = "RETURNING JSON:"
            if marker in content:
                marker_idx = content.find(marker)
                # Take everything after the marker to minimize non-JSON preamble
                content = content[marker_idx + len(marker):].strip()

            # Extract JSON boundaries robustly
            content = content.strip()
            if not content.startswith("{"):
                # Prefer the last JSON object in the content (final answer),
                # since earlier ones may appear in examples inside the explanation.
                last_brace_idx = content.rfind("{")
                if last_brace_idx >= 0:
                    content = content[last_brace_idx:]
                else:
                    if attempt < max_retries:
                        logger.warning(f"Attempt {attempt + 1}: No JSON found. Retrying...")
                        continue
                    else:
                        raise ValueError("No JSON object found in response")

            if not content.endswith("}"):
                end_idx = content.rfind("}")
                if end_idx >= 0:
                    content = content[:end_idx + 1]
                else:
                    if attempt < max_retries:
                        logger.warning(f"Attempt {attempt + 1}: Incomplete JSON. Retrying...")
                        continue
                    else:
                        raise ValueError("Incomplete JSON object in response")
            
            # Parse JSON
            try:
                question_data = json.loads(content)

                # Best-effort normalization of testcase formats (stringified JSON -> proper JSON)
                _normalize_json_testcase_format(question_data)
                
                # Validate JSON test case format
                json_format_error = _validate_json_testcase_format(question_data)
                if json_format_error:
                    if attempt < max_retries:
                        logger.warning(f"Attempt {attempt + 1}: JSON format validation failed: {json_format_error}. Retrying...")
                        retry_instruction = f"\n\n⚠️ RETRY ATTEMPT {attempt + 1} - INVALID JSON FORMAT:\n"
                        retry_instruction += f"{json_format_error}\n"
                        retry_instruction += "CRITICAL: Test case inputs MUST be JSON objects with parameter names as keys.\n"
                        retry_instruction += "Example: {{\"input\": {{\"nums\": [1,2,3], \"target\": 5}}, \"expected_output\": [0,1]}}\n"
                        user_prompt += retry_instruction
                        continue
                    else:
                        raise ValueError(f"Test case format validation failed: {json_format_error}")
                
                # Infer function_signature from test cases if not provided
                if "function_signature" not in question_data or not question_data.get("function_signature"):
                    inferred_sig = _infer_function_signature_from_testcases(question_data)
                    if inferred_sig:
                        question_data["function_signature"] = inferred_sig
                        logger.info("Inferred function_signature from test cases")
                
                # Log parsed JSON for debugging
                logger.info("Parsed JSON successfully:")
                logger.info(json.dumps(question_data, indent=2))
                
            except json.JSONDecodeError as e:
                if attempt < max_retries:
                    logger.warning(f"Attempt {attempt + 1}: JSON parse failed: {e}. Retrying...")
                    continue
                else:
                    raise ValueError(f"Invalid JSON: {e}")
            
            # Check for error response
            if isinstance(question_data, dict) and question_data.get("error"):
                error_type = question_data.get("error")
                if error_type == "CANNOT_GENERATE_CLEAN_QUESTION":
                    if attempt < max_retries:
                        logger.warning(f"Attempt {attempt + 1}: AI returned CANNOT_GENERATE_CLEAN_QUESTION. Retrying...")
                        continue
                    else:
                        raise ValueError("AI could not generate a clean question after all retries")
                elif error_type == "JSON_OUTPUT_REQUIRED":
                    if attempt < max_retries:
                        logger.warning(f"Attempt {attempt + 1}: AI returned JSON_OUTPUT_REQUIRED. Retrying...")
                        continue
                    else:
                        raise ValueError("AI returned error: JSON_OUTPUT_REQUIRED after all retries")
            
            # Validate required fields
            required_fields = ["title", "difficulty", "description", 
                            "public_testcases", "hidden_testcases", "constraints", "starter_code"]
            missing_fields = [field for field in required_fields if field not in question_data]
            if missing_fields:
                if attempt < max_retries:
                    logger.warning(f"Attempt {attempt + 1}: Missing fields: {missing_fields}. Retrying...")
                    continue
                else:
                    raise ValueError(f"Missing required fields: {missing_fields}")
            
            # function_signature is required (should be inferred if not provided)
            if "function_signature" not in question_data or not question_data.get("function_signature"):
                if attempt < max_retries:
                    logger.warning(f"Attempt {attempt + 1}: Missing function_signature. Retrying...")
                    continue
                else:
                    raise ValueError("Missing function_signature field")
            
            # Validate starter_code structure
            starter_code = question_data.get("starter_code", {})
            if not isinstance(starter_code, dict):
                if attempt < max_retries:
                    logger.warning(f"Attempt {attempt + 1}: starter_code must be an object. Retrying...")
                    continue
                else:
                    raise ValueError("starter_code must be an object (dictionary)")
            
            # Check for required languages in starter_code (only the selected ones)
            missing_languages = [lang for lang in languages if lang not in starter_code or not starter_code[lang]]
            if missing_languages:
                if attempt < max_retries:
                    logger.warning(f"Attempt {attempt + 1}: Missing starter code for selected languages: {missing_languages}. Retrying...")
                    continue
                else:
                    raise ValueError(f"Missing starter code for selected languages: {missing_languages}")
            
            # Filter starter_code to only include selected languages
            filtered_starter_code = {lang: starter_code[lang] for lang in languages if lang in starter_code}
            question_data["starter_code"] = filtered_starter_code
            question_data["languages"] = languages
            
            # Validate structure
            # Check examples (array format)
            examples = question_data.get("examples", [])
            if not isinstance(examples, list) or len(examples) == 0:
                # Fallback: check for old "example" format
                example = question_data.get("example", {})
                if isinstance(example, dict) and example.get("input"):
                    # Convert old format to new format
                    question_data["examples"] = [example]
                else:
                    if attempt < max_retries:
                        logger.warning(f"Attempt {attempt + 1}: Missing examples. Retrying...")
                        continue
                    else:
                        raise ValueError("Missing examples field")
            
            # Validate function_signature structure
            func_sig = question_data.get("function_signature", {})
            if not isinstance(func_sig, dict):
                raise ValueError("function_signature must be an object")
            for field in ["name", "parameters", "return_type"]:
                if field not in func_sig:
                    raise ValueError(f"function_signature missing '{field}' field")
            
            if not isinstance(func_sig.get("parameters"), list):
                raise ValueError("function_signature.parameters must be an array")
            
            # Check testcases
            for tc_type in ["public_testcases", "hidden_testcases"]:
                testcases = question_data.get(tc_type, [])
                if not isinstance(testcases, list):
                    raise ValueError(f"{tc_type} must be an array")
                if len(testcases) != 3:
                    if attempt < max_retries:
                        logger.warning(f"Attempt {attempt + 1}: {tc_type} must have exactly 3 testcases, got {len(testcases)}. Retrying...")
                        continue
                    else:
                        raise ValueError(f"{tc_type} must have exactly 3 testcases, got {len(testcases)}")
                
                for idx, tc in enumerate(testcases):
                    if not isinstance(tc, dict):
                        raise ValueError(f"{tc_type}[{idx}] must be an object")
                    if "input" not in tc:
                        raise ValueError(f"{tc_type}[{idx}] missing 'input' field")
                    if "expected_output" not in tc:
                        raise ValueError(f"{tc_type}[{idx}] missing 'expected_output' field")
                    
                    # Validate input format - must be JSON object (dict)
                    tc_input = tc.get("input")
                    if not isinstance(tc_input, dict):
                        if attempt < max_retries:
                            logger.warning(f"Attempt {attempt + 1}: {tc_type}[{idx}] input must be JSON object. Retrying...")
                            retry_instruction = f"\n\n⚠️ RETRY ATTEMPT {attempt + 1} - INVALID TESTCASE INPUT FORMAT:\n"
                            retry_instruction += f"Testcase {tc_type}[{idx}] input must be a JSON object (dict), not a string.\n"
                            retry_instruction += "CORRECT format: {{\"input\": {{\"nums\": [1,2,3], \"target\": 5}}, \"expected_output\": [0,1]}}\n"
                            retry_instruction += "INCORRECT format: {{\"input\": \"[1,2,3]\", \"expected_output\": \"[0,1]\"}} ❌\n"
                            user_prompt += retry_instruction
                            continue
                        else:
                            raise ValueError(f"{tc_type}[{idx}] input must be a JSON object (dict), got {type(tc_input).__name__}")
                    
                    # Validate expected_output is a JSON value (not necessarily a string)
                    expected_output = tc.get("expected_output")
                    if expected_output is None:
                        if attempt < max_retries:
                            logger.warning(f"Attempt {attempt + 1}: {tc_type}[{idx}] missing expected_output. Retrying...")
                            continue
                        else:
                            raise ValueError(f"{tc_type}[{idx}] missing 'expected_output' field")
            
            # Validate consistency
            consistency_issues = _validate_question_consistency(question_data)
            if consistency_issues:
                logger.error("=" * 80)
                logger.error(f"CONSISTENCY ISSUES DETECTED (Attempt {attempt + 1}):")
                logger.error(consistency_issues)
                logger.error("=" * 80)
                print("\n" + "=" * 80)
                print(f"CONSISTENCY ISSUES DETECTED (Attempt {attempt + 1}):")
                print(consistency_issues)
                print("=" * 80 + "\n")
                
                if attempt < max_retries:
                    logger.warning(f"Attempt {attempt + 1}: Consistency issues: {consistency_issues}. Retrying...")
                    # Build detailed retry instruction
                    retry_instruction = f"\n\n⚠️ RETRY ATTEMPT {attempt + 1} - CONSISTENCY ISSUES DETECTED:\n"
                    retry_instruction += f"{consistency_issues}\n\n"
                    retry_instruction += "CRITICAL FIXES REQUIRED:\n"
                    retry_instruction += "1. Look at the testcases - what problem do they actually test?\n"
                    retry_instruction += "2. The problem_description MUST explain EXACTLY what the testcases test.\n"
                    retry_instruction += "3. The example MUST demonstrate the SAME problem as the testcases.\n"
                    retry_instruction += "4. If testcases show matrix operations, description MUST explain matrix operations, NOT prime numbers.\n"
                    retry_instruction += "5. If testcases use multi-line input, example MUST also use multi-line input.\n"
                    retry_instruction += "6. The title, description, example, and ALL testcases MUST describe the SAME problem.\n"
                    user_prompt += retry_instruction
                    continue
                else:
                    raise ValueError(f"Question consistency validation failed: {consistency_issues}")
            
            # Success
            logger.info("=" * 80)
            logger.info("SUCCESS: Question generated and validated!")
            logger.info(f"Title: {question_data.get('title', 'Unknown')}")
            logger.info("=" * 80)
            
            return question_data
            
        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:

            error_str = str(e)
            if "401" in error_str or "invalid_api_key" in error_str.lower() or "authentication" in error_str.lower():
                raise ValueError(
                    "Invalid OpenAI API key. Please check your OPENAI_API_KEY in the .env file. "
                    "Get a valid key from https://platform.openai.com/account/api-keys"
                )
            
            if attempt < max_retries:
                logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying...")
                continue
            else:
                raise Exception(f"OpenAI API error after {max_retries + 1} attempts: {e}")
    
    # Should never reach here
    raise Exception("Failed to generate valid response after all retries")
