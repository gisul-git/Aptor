"""
AI Feedback Service for AIML Competency Assessments
Evaluates code submissions with AI and generates feedback
"""
import logging
import json
import re
from typing import Dict, Any, List, Optional
from openai import OpenAI

from ..config import OPENAI_API_KEY
from .code_analyzer import CodeAnalyzer
from .task_evaluator import evaluate_all_tasks
from .concise_feedback import generate_concise_feedback

logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = None
if OPENAI_API_KEY:
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        logger.info("OpenAI client initialized successfully for AIML feedback")
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {e}")


def generate_aiml_feedback(
    source_code: str,
    outputs: List[str],
    question_title: str,
    question_description: str,
    tasks: List[str],
    constraints: List[str],
    difficulty: str = "medium",
    skill: Optional[str] = None,
    dataset_info: Optional[Dict[str, Any]] = None,
    test_cases: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Generate AI feedback for an AIML code submission.
    
    Args:
        source_code: The Python code submitted by the candidate
        outputs: List of outputs from code execution
        question_title: Title of the question
        question_description: Description of the problem
        tasks: List of tasks to complete
        constraints: List of constraints
        difficulty: Question difficulty (easy, medium, hard)
        skill: The skill being assessed (numpy, pandas, etc.)
        dataset_info: Information about the dataset used
        test_cases: Optional list of test cases with validation criteria
    
    Returns:
        Dictionary containing score, feedback, and detailed evaluation
    """
    
    if not source_code or not source_code.strip():
        return {
            "overall_score": 0,
            "feedback_summary": "No code was submitted. Please write and execute your code to receive evaluation.",
            "one_liner": "No code submitted",
            "code_quality": {"score": 0, "comments": "No code was submitted."},
            "correctness": {"score": 0, "comments": "Cannot evaluate - no code submitted."},
            "task_completion": {"completed": 0, "total": len(tasks), "details": []},
            "suggestions": ["Submit your code implementation to receive feedback."],
            "strengths": [],
            "areas_for_improvement": ["Complete and submit your code solution."],
            "ai_generated": False,
        }
    
    if not outputs or (len(outputs) == 1 and not outputs[0].strip()):
        return {
            "overall_score": 0,
            "feedback_summary": "Code was submitted but no output was produced. Please run your code to generate outputs.",
            "one_liner": "No output produced",
            "code_quality": {"score": 0, "comments": "Code exists but was not executed."},
            "correctness": {"score": 0, "comments": "Cannot evaluate correctness without output."},
            "task_completion": {"completed": 0, "total": len(tasks), "details": []},
            "suggestions": ["Run your code in the notebook to produce outputs."],
            "strengths": [],
            "areas_for_improvement": ["Execute your code to see results."],
            "ai_generated": False,
        }
    
    # NEW TASK-BASED EVALUATION SYSTEM
    # Use task-based evaluation if test_cases exist
    if test_cases and len(test_cases) > 0:
        logger.info("Using task-based evaluation system")
        
        # Evaluate all tasks using AST-based validation
        task_evaluation_result = evaluate_all_tasks(
            tasks=tasks,
            test_cases=test_cases,
            source_code=source_code,
            outputs=outputs
        )
        
        overall_score = task_evaluation_result["overall_score"]
        task_evaluations = task_evaluation_result["task_scores"]
        
        # Generate concise feedback
        feedback_text = generate_concise_feedback(
            overall_score=overall_score,
            task_evaluations=task_evaluations,
            source_code=source_code,
            outputs=outputs,
            tasks=tasks
        )
        
        # Build result dictionary
        result = {
            "overall_score": overall_score,
            "feedback_summary": feedback_text,  # Use concise feedback as summary
            "one_liner": f"Score: {int(overall_score)}/100 | {'Excellent' if overall_score >= 90 else 'Good' if overall_score >= 75 else 'Needs work' if overall_score >= 50 else 'Incomplete'}",
            "task_scores": [
                {
                    "task_number": te["task_number"],
                    "task_description": te["task_description"],
                    "score": te["score"],
                    "max_score": te["max_score"],
                    "status": te["status"],
                    "feedback": f"{te.get('status_symbol', '✅')} {te['task_description']}: {te['score']}/{te['max_score']}"
                }
                for te in task_evaluations
            ],
            "task_completion": {
                "completed": len([te for te in task_evaluations if te["score"] >= te["max_score"] * 0.9]),
                "total": len(tasks),
                "details": [f"Task {te['task_number']}: {te['status']}" for te in task_evaluations]
            },
            # Component scores are now descriptive only, not separate scores
            "code_quality": {
                "score": 0,  # Not scored separately
                "comments": "Code quality assessed as part of task evaluation"
            },
            "library_usage": {
                "score": 0,  # Not scored separately
                "comments": "Library usage assessed as part of task evaluation"
            },
            "output_quality": {
                "score": 0,  # Not scored separately
                "comments": "Output quality assessed as part of task evaluation"
            },
            "strengths": [],
            "areas_for_improvement": [],
            "suggestions": [],
            "deduction_reasons": [],
            "ai_generated": False  # Deterministic evaluation
        }
        
        logger.info(f"Task-based evaluation completed. Score: {overall_score}/100")
        return result
    
    # Fallback: If no test_cases, use old system (shouldn't happen in production)
    logger.warning("No test_cases provided, falling back to old evaluation system")
    
    # Old system continues below...
    deterministic_scores = None
    
    try:
        # Build the evaluation prompt
        prompt = _build_evaluation_prompt(
            source_code, outputs, question_title, question_description,
            tasks, constraints, difficulty, skill, dataset_info, deterministic_scores
        )
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert AIML/Data Science code evaluator with EXTREME ATTENTION TO ACCURACY. 
Your job is to evaluate code submissions for data science and machine learning problems with PRECISION and CORRECTNESS.

CRITICAL EVALUATION PRIORITIES (in order of importance):
1. **OUTPUT CORRECTNESS** - This is THE MOST IMPORTANT factor. You MUST:
   - Understand what the task expects as output
   - Analyze the actual outputs from code execution
   - Determine if outputs are CORRECT, PARTIALLY CORRECT, or INCORRECT
   - Be STRICT: incorrect outputs should receive low correctness scores
   - Verify outputs match expected format, values, and logic

2. **TASK COMPLETION** - Verify each task requirement:
   - Check if code accomplishes what each task asks for
   - Verify outputs demonstrate task completion
   - Be specific about what was completed vs. what was missed

3. **CODE QUALITY** - Assess structure, readability, best practices

4. **LIBRARY USAGE** - Evaluate appropriate and efficient use of AIML libraries

5. **OUTPUT QUALITY** - Assess format, presentation, completeness

CRITICAL: Provide COMPREHENSIVE, HIGHLY DETAILED feedback with extensive educational context. Users want thorough, detailed feedback, not brief summaries. Every section should be 4-7 sentences with substantial detail, examples, and educational insights. Explain the 'why' behind every observation. Include specific code examples when discussing strengths or improvements. Be educational and comprehensive in every response. Make feedback_summary 5-7 sentences, all comment fields 4-6 sentences, and include multiple detailed suggestions, strengths, and improvement areas.

MOST IMPORTANTLY: Be ACCURATE and CORRECT in your evaluation. If outputs are wrong, say so clearly. If outputs are correct, acknowledge that. Your evaluation must reflect the actual correctness of the solution."""
                },
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=4000,  # Increased to allow for more comprehensive feedback
        )
        
        result = json.loads(response.choices[0].message.content)
        result["ai_generated"] = True
        
        # If deterministic scores exist, use them instead of GPT scores
        if deterministic_scores:
            result["overall_score"] = deterministic_scores["overall_score"]
            result["task_scores"] = deterministic_scores["task_scores"]
            
            # Calculate component scores based on actual evaluation
            component_scores = _calculate_component_scores(
                deterministic_scores,
                source_code,
                outputs,
                analyzer=CodeAnalyzer(source_code) if source_code else None
            )
            
            # Update component scores in result
            if "code_quality" in result:
                result["code_quality"]["score"] = component_scores["code_quality"]
            if "library_usage" in result:
                result["library_usage"]["score"] = component_scores["library_usage"]
            if "output_quality" in result:
                result["output_quality"]["score"] = component_scores["output_quality"]
            
            logger.info(f"Using deterministic scores. Overall score: {result['overall_score']}, Component scores: {component_scores}")
        else:
            # Ensure score is within bounds
            if "overall_score" in result:
                result["overall_score"] = max(0, min(100, int(result.get("overall_score", 0))))
            else:
                result["overall_score"] = 50  # Default if not provided
        
        logger.info(f"AI evaluation completed. Score: {result['overall_score']}")
        return result
        
    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
        return _generate_rule_based_feedback(
            source_code, outputs, question_title, tasks, constraints, difficulty
        )


def _validate_outputs_with_test_cases(
    outputs: List[str],
    source_code: str,
    test_cases: List[Dict[str, Any]],
    tasks: List[str],
) -> Dict[str, Any]:
    """
    Validate outputs against test cases deterministically.
    
    Args:
        outputs: List of output strings from code execution
        source_code: The submitted source code
        test_cases: List of test case dictionaries with validation criteria
        tasks: List of task descriptions
    
    Returns:
        Dictionary with overall_score and task_scores
    """
    combined_output = "\n".join(outputs).lower()
    source_code_lower = source_code.lower()
    
    # Create code analyzer
    analyzer = CodeAnalyzer(source_code)
    
    task_scores = []
    total_score = 0.0
    
    for tc in test_cases:
        task_num = tc.get("task_number", 0)
        validation_type = tc.get("validation_type", "").lower()
        expected_output = tc.get("expected_output", "")
        points = float(tc.get("points", 0))
        description = tc.get("description", "")
        
        score = 0.0
        status = "not_attempted"
        passed = False
        feedback = None  # Will be set by validation logic or default at end
        
        if validation_type == "exact_match":
            # Check if output contains exact value
            if expected_output.lower() in combined_output:
                score = points
                status = "completed"
                passed = True
            else:
                status = "attempted_incorrect"
        
        elif validation_type == "contains":
            # Check if output contains keyword/substring
            keywords = expected_output.lower().split("|")  # Support multiple keywords with |
            if any(keyword.strip() in combined_output for keyword in keywords):
                score = points
                status = "completed"
                passed = True
            else:
                status = "attempted_incorrect"
        
        elif validation_type == "numeric_range":
            # Check if number is in range (format: "0.8-0.9" or ">0.8" or "<0.9")
            try:
                # Extract numbers from outputs
                numbers = re.findall(r'-?\d+\.?\d*', combined_output)
                if numbers:
                    for num_str in numbers:
                        try:
                            num = float(num_str)
                            if "-" in expected_output:
                                # Range format: "0.8-0.9"
                                min_val, max_val = map(float, expected_output.split("-"))
                                if min_val <= num <= max_val:
                                    score = points
                                    status = "completed"
                                    passed = True
                                    break
                            elif expected_output.startswith(">"):
                                # Greater than format: ">0.8"
                                threshold = float(expected_output[1:])
                                if num > threshold:
                                    score = points
                                    status = "completed"
                                    passed = True
                                    break
                            elif expected_output.startswith("<"):
                                # Less than format: "<0.9"
                                threshold = float(expected_output[1:])
                                if num < threshold:
                                    score = points
                                    status = "completed"
                                    passed = True
                                    break
                        except ValueError:
                            continue
                if not passed:
                    status = "attempted_incorrect"
            except Exception as e:
                logger.warning(f"Error in numeric_range validation: {e}")
                status = "attempted_incorrect"
        
        elif validation_type == "code_check":
            # Check if code contains expected pattern
            # Handle list, pipe-separated string, or single string expected_output
            if isinstance(expected_output, list):
                # Check if any item in the list is found in code
                found = any(str(item).lower() in source_code_lower for item in expected_output)
            elif isinstance(expected_output, str) and "|" in expected_output:
                # Handle pipe-separated values (e.g., "CountVectorizer|TfidfVectorizer")
                keywords = expected_output.lower().split("|")
                found = any(keyword.strip() in source_code_lower for keyword in keywords)
            else:
                found = str(expected_output).lower() in source_code_lower
            
            if found:
                score = points
                status = "completed"
                passed = True
            else:
                status = "attempted_incorrect"
        
        elif validation_type == "import_check":
            # Verify import exists in code
            if analyzer.verify_import(expected_output):
                score = points
                status = "completed"
                passed = True
                feedback = f"✅ Required import found: {expected_output}"
            else:
                status = "attempted_incorrect"
                feedback = f"❌ Missing import: {expected_output}"
        
        elif validation_type == "function_call_check":
            # Verify function was called
            if analyzer.verify_function_call(expected_output):
                score = points
                status = "completed"
                passed = True
                feedback = f"✅ Function called: {expected_output}"
            else:
                status = "attempted_incorrect"
                feedback = f"❌ Function not called: {expected_output}"
        
        elif validation_type == "dataset_load_check":
            # Verify dataset was loaded
            if analyzer.has_dataset_loading():
                score = points
                status = "completed"
                passed = True
                feedback = "✅ Dataset loading code detected"
            else:
                status = "attempted_incorrect"
                feedback = "❌ No dataset loading code found"
        
        elif validation_type == "model_training_check":
            # Verify model training (.fit())
            if analyzer.has_model_training():
                score = points
                status = "completed"
                passed = True
                feedback = "✅ Model training code detected (.fit())"
            else:
                status = "attempted_incorrect"
                feedback = "❌ No model training code found"
        
        elif validation_type == "output_structure_check":
            # Verify output contains actual data structures
            has_numeric = any(char.isdigit() for char in combined_output)
            has_array_like = '[' in combined_output or 'array' in combined_output.lower()
            has_dataframe = 'dataframe' in combined_output.lower() or '|' in combined_output
            
            if expected_output == "numeric" and has_numeric:
                score = points
                status = "completed"
                passed = True
                feedback = "✅ Output contains numeric data"
            elif expected_output == "contains_array" and has_array_like:
                score = points
                status = "completed"
                passed = True
                feedback = "✅ Output contains array-like structure"
            elif expected_output == "contains_dataframe" and has_dataframe:
                score = points
                status = "completed"
                passed = True
                feedback = "✅ Output contains DataFrame structure"
            else:
                status = "attempted_incorrect"
                feedback = f"❌ Output doesn't match expected structure: {expected_output}"
        
        else:
            logger.warning(f"Unknown validation_type: {validation_type}")
            status = "not_attempted"
            feedback = f"Unknown validation type: {validation_type}"
        
        # Use custom feedback if available, otherwise generate default feedback
        if feedback is None:
            feedback = f"Test case validation: {'PASSED' if passed else 'FAILED'}. {description}"
        
        task_scores.append({
            "task_number": task_num,
            "task_description": tasks[task_num - 1] if task_num > 0 and task_num <= len(tasks) else description,
            "score": round(score, 2),
            "max_score": round(points, 2),
            "status": status,
            "feedback": feedback
        })
        
        total_score += score
    
    # Ensure overall_score is between 0 and 100
    overall_score = max(0, min(100, round(total_score, 2)))
    
    return {
        "overall_score": overall_score,
        "task_scores": task_scores
    }


def _calculate_component_scores(
    deterministic_scores: Dict[str, Any],
    source_code: str,
    outputs: List[str],
    analyzer: Optional[CodeAnalyzer] = None
) -> Dict[str, float]:
    """
    Calculate component scores (code_quality, library_usage, output_quality) 
    based on deterministic evaluation results.
    
    Args:
        deterministic_scores: Dictionary with overall_score and task_scores
        source_code: The submitted source code
        outputs: List of output strings
        analyzer: Optional CodeAnalyzer instance
    
    Returns:
        Dictionary with code_quality, library_usage, output_quality scores
    """
    overall_score = deterministic_scores.get("overall_score", 0)
    task_scores = deterministic_scores.get("task_scores", [])
    
    if not analyzer:
        analyzer = CodeAnalyzer(source_code)
    
    # Analyze code structure
    has_functions = 'def ' in source_code
    has_comments = '#' in source_code
    has_imports = len(analyzer.get_imports()) > 0
    has_structure = has_functions or len(source_code.split('\n')) > 10
    
    # Code Quality Score (0-25): Based on structure, readability, best practices
    code_quality_score = 0.0
    if has_structure:
        code_quality_score += 10  # Basic structure
    if has_functions:
        code_quality_score += 5  # Functions present
    if has_comments:
        code_quality_score += 5  # Comments present
    if has_imports:
        code_quality_score += 5  # Imports present
    
    # Scale to 0-25 based on overall_score (if code is good, quality should be high)
    code_quality_score = min(25, code_quality_score * (overall_score / 100.0) * 1.2)
    
    # Library Usage Score (0-20): Based on appropriate library usage
    library_usage_score = 0.0
    imports = analyzer.get_imports()
    function_calls = analyzer.get_function_calls()
    
    # Check for common AIML libraries
    aiml_libraries = ['pandas', 'numpy', 'sklearn', 'tensorflow', 'keras', 'torch', 'matplotlib', 'seaborn']
    library_count = sum(1 for lib in aiml_libraries if any(lib.lower() in imp.lower() for imp in imports))
    
    if library_count > 0:
        library_usage_score = min(20, library_count * 5 + (len(function_calls) * 0.5))
    
    # Scale based on overall_score
    library_usage_score = min(20, library_usage_score * (overall_score / 100.0) * 1.1)
    
    # Output Quality Score (0-15): Based on output presence and structure
    output_quality_score = 0.0
    combined_output = "\n".join(outputs).lower()
    
    if outputs and any(o.strip() for o in outputs):
        output_quality_score += 5  # Outputs exist
        
        # Check for errors
        has_errors = 'error' in combined_output or 'traceback' in combined_output or 'exception' in combined_output
        if not has_errors:
            output_quality_score += 5  # No errors
        
        # Check for meaningful data
        has_numeric = any(char.isdigit() for char in combined_output)
        has_structure = '[' in combined_output or '{' in combined_output or 'dataframe' in combined_output
        
        if has_numeric or has_structure:
            output_quality_score += 5  # Meaningful output
    
    # Scale based on overall_score
    output_quality_score = min(15, output_quality_score * (overall_score / 100.0) * 1.1)
    
    # Normalize to ensure component scores roughly match overall_score
    # Component scores should sum to approximately overall_score
    total_component_score = code_quality_score + library_usage_score + output_quality_score
    
    if total_component_score > 0 and overall_score > 0:
        # Scale factor to make components sum closer to overall_score
        scale_factor = min(1.2, overall_score / max(1, total_component_score))
        code_quality_score = round(code_quality_score * scale_factor, 2)
        library_usage_score = round(library_usage_score * scale_factor, 2)
        output_quality_score = round(output_quality_score * scale_factor, 2)
    
    # Ensure scores are within bounds
    code_quality_score = max(0, min(25, code_quality_score))
    library_usage_score = max(0, min(20, library_usage_score))
    output_quality_score = max(0, min(15, output_quality_score))
    
    return {
        "code_quality": code_quality_score,
        "library_usage": library_usage_score,
        "output_quality": output_quality_score
    }


def _build_evaluation_prompt(
    source_code: str,
    outputs: List[str],
    question_title: str,
    question_description: str,
    tasks: List[str],
    constraints: List[str],
    difficulty: str,
    skill: Optional[str],
    dataset_info: Optional[Dict[str, Any]],
    deterministic_scores: Optional[Dict[str, Any]] = None,
) -> str:
    """Build the evaluation prompt for OpenAI."""
    
    tasks_text = "\n".join([f"  {i+1}. {task}" for i, task in enumerate(tasks)]) if tasks else "  No specific tasks defined"
    constraints_text = "\n".join([f"  - {c}" for c in constraints]) if constraints else "  No specific constraints"
    outputs_text = "\n---\n".join(outputs) if outputs else "No outputs"
    
    # Calculate points per task for task-based scoring
    num_tasks = len(tasks) if tasks else 0
    if num_tasks > 0:
        points_per_task = 100 / num_tasks
        # Round to 2 decimal places for precision, but ensure sum equals 100
        points_per_task_rounded = round(points_per_task, 2)
        # Adjust last task to ensure sum equals exactly 100
        points_list = [points_per_task_rounded] * num_tasks
        total_rounded = sum(points_list)
        if total_rounded != 100:
            # Adjust the last task to make sum exactly 100
            points_list[-1] = round(100 - sum(points_list[:-1]), 2)
        points_per_task_rounded = points_list[0]  # Use first value for display
    else:
        # Fallback: if no tasks, use old system (but this shouldn't happen)
        points_per_task = 0
        points_per_task_rounded = 0
        points_list = []
    
    # Include dataset info if available
    dataset_text = ""
    if dataset_info:
        dataset_text = f"\nDataset Information:\n"
        if dataset_info.get("schema"):
            dataset_text += f"  Schema: {dataset_info.get('schema')}\n"
        if dataset_info.get("rows"):
            dataset_text += f"  Sample rows: {len(dataset_info.get('rows', []))} rows\n"
    
    # Define strings with newlines outside f-string to avoid backslash issues
    task_separator = ",\n        {"
    task_separator_prefix = task_separator if num_tasks > 1 else ""
    
    prompt = f"""
Evaluate the following AIML/Data Science code submission with EXTREME ACCURACY and ATTENTION TO DETAIL:

== QUESTION ==
Title: {question_title}
Difficulty: {difficulty}
Skill Area: {skill or "General Data Science"}

Description:
{question_description}
{dataset_text}
Tasks to Complete:
{tasks_text}

Constraints:
{constraints_text}

== CANDIDATE'S CODE ==
```python
{source_code}
```

== EXECUTION OUTPUTS ==
{outputs_text}
{f'''

== DETERMINISTIC VALIDATION RESULTS ==
The following scores have been calculated deterministically from test cases:
Overall Score: {deterministic_scores.get('overall_score', 0)}/100
Task Scores:
{chr(10).join([f"  Task {ts.get('task_number', 0)}: {ts.get('score', 0)}/{ts.get('max_score', 0)} - {ts.get('status', 'unknown')}" for ts in deterministic_scores.get('task_scores', [])])}

NOTE: Use these scores as-is. Focus your evaluation on providing detailed feedback text only.
''' if deterministic_scores else ''}

== CRITICAL EVALUATION REQUIREMENTS ==
1. **TASK COMPLETION ANALYSIS**: 
   - Carefully read EACH task requirement
   - Check if the code actually accomplishes what each task asks for
   - Verify that outputs demonstrate task completion
   - Be STRICT: partial completion should be penalized appropriately

2. **OUTPUT CORRECTNESS VERIFICATION**:
   - Understand what the EXPECTED output should be based on the task requirements
   - Analyze the ACTUAL outputs from the code execution
   - Determine if outputs are CORRECT, PARTIALLY CORRECT, or INCORRECT
   - Check if outputs match the expected format, data types, and values
   - Verify logical correctness: do the outputs make sense for the given task?
   - Look for errors, warnings, or unexpected results in outputs

3. **CODE QUALITY ASSESSMENT**:
   - Evaluate code structure, readability, and organization
   - Check for best practices (proper variable names, comments, modularity)
   - Assess efficiency and optimization
   - Review error handling and edge case considerations

4. **LIBRARY USAGE EVALUATION**:
   - Verify appropriate use of AIML/Data Science libraries
   - Check if libraries are used correctly and efficiently
   - Assess whether the right tools were chosen for the task

== EVALUATION INSTRUCTIONS ==
Evaluate the submission and return a JSON response with this exact structure:

{{
    "overall_score": <0-100>,
    "feedback_summary": "<Comprehensive 5-7 sentence detailed summary of performance. Include: (1) Overall assessment with specific details about what was accomplished, (2) Detailed evaluation of code quality and structure, (3) Comprehensive analysis of correctness and results, (4) Detailed discussion of library usage and appropriateness, (5) Detailed analysis of output quality, (6) Specific strengths with examples, (7) Specific areas for improvement with actionable guidance. Make it highly informative, educational, and comprehensive. Provide substantial detail in every sentence.>",
    "one_liner": "<Brief 5-10 word summary like 'Good implementation | Minor issues'>",
    "task_scores": [
        {{
            "task_number": 1,
            "task_description": "<Task 1 description>",
            "score": <0 to {points_per_task_rounded if num_tasks > 0 else 0}>,
            "max_score": {points_per_task_rounded if num_tasks > 0 else 0},
            "status": "<'completed' | 'partially_completed' | 'attempted_incorrect' | 'not_attempted'>",
            "feedback": "<Comprehensive 3-5 sentence detailed feedback for this specific task. Include: (1) Whether the task was completed correctly, (2) Evidence from code/outputs showing completion or lack thereof, (3) If partially completed, what was done correctly and what is missing, (4) If attempted but incorrect, what is wrong, (5) Specific examples from code/outputs. Be VERY SPECIFIC and reference actual code/outputs.>"
        }}{task_separator_prefix}
        {task_separator.join([f'''
            "task_number": {i+2},
            "task_description": "<Task {i+2} description>",
            "score": <0 to {points_per_task_rounded if num_tasks > 0 else 0}>,
            "max_score": {points_per_task_rounded if num_tasks > 0 else 0},
            "status": "<'completed' | 'partially_completed' | 'attempted_incorrect' | 'not_attempted'>",
            "feedback": "<Comprehensive 3-5 sentence detailed feedback for this specific task. Include: (1) Whether the task was completed correctly, (2) Evidence from code/outputs showing completion or lack thereof, (3) If partially completed, what was done correctly and what is missing, (4) If attempted but incorrect, what is wrong, (5) Specific examples from code/outputs. Be VERY SPECIFIC and reference actual code/outputs.>"
        }}''' for i in range(num_tasks - 1)]) if num_tasks > 1 else ""}
    ],
    "code_quality": {{
        "score": <Calculate score 0-25 based on: code structure (functions, organization), readability (comments, naming), best practices (error handling, modularity). Score should reflect actual code quality, not be 0.>,
        "comments": "<Comprehensive 4-6 sentence detailed assessment of code structure, readability, best practices. Include: (1) Detailed analysis of code organization and structure, (2) Evaluation of readability and clarity with specific examples, (3) Assessment of whether best practices are followed, (4) Discussion of maintainability and scalability, (5) Code style and conventions evaluation, (6) Educational insights about code quality. Be detailed and educational. The score should reflect the actual code quality (0-25).>"
    }},
    "library_usage": {{
        "score": <Calculate score 0-20 based on: appropriate library selection, efficient usage, library-specific best practices. Score should reflect actual library usage quality, not be 0.>,
        "comments": "<Comprehensive 4-6 sentence detailed assessment of appropriate library usage. Include: (1) Detailed evaluation of which libraries were used and why, (2) Assessment of whether libraries were used appropriately and efficiently, (3) Discussion of alternative library choices if relevant, (4) Evaluation of library-specific best practices, (5) Educational insights about library selection and usage, (6) Specific examples of good or poor library usage. Be detailed and educational. The score should reflect the actual library usage quality (0-20).>"
    }},
    "output_quality": {{
        "score": <Calculate score 0-15 based on: output format, clarity, completeness, absence of errors. Score should reflect actual output quality, not be 0.>,
        "comments": "<Comprehensive 3-5 sentence detailed assessment of output format and presentation. Include: (1) Detailed evaluation of output format and structure, (2) Assessment of output clarity and presentation, (3) Discussion of whether output meets requirements, (4) Evaluation of output completeness, (5) Educational insights about output quality. Be detailed and educational. The score should reflect the actual output quality (0-15).>"
    }},
    "task_completion": {{
        "completed": <number of tasks completed CORRECTLY>,
        "total": {num_tasks},
        "details": ["<For EACH task, provide: (1) Whether the task was completed, (2) Evidence from code/outputs showing completion, (3) If not completed, what is missing, (4) If completed incorrectly, what is wrong. Be VERY SPECIFIC and reference actual code/outputs.>"]
    }},
    "strengths": ["<Comprehensive, detailed strengths - explain what was done well, why it's good, and provide specific examples from the code. Be educational and detailed.>", "<Additional detailed strengths with specific examples>", "<More strengths with explanations of why they matter>"],
    "areas_for_improvement": ["<Comprehensive, specific areas to improve with detailed explanations, examples, and why these improvements matter. Be educational.>", "<Additional detailed improvement areas with explanations>", "<More improvement areas with specific actionable guidance>"],
    "suggestions": ["<Comprehensive, detailed actionable suggestions for better code with explanations of why each suggestion would improve the code. Be very specific and educational.>", "<Additional detailed suggestions with explanations>", "<More specific suggestions with code examples if applicable>"],
    "deduction_reasons": ["<If score < 80, provide comprehensive, detailed list of specific reasons for deductions with explanations. Be very specific and educational.>", "<Additional detailed deduction reasons>"]
}}

CRITICAL TASK-BASED SCORING RULES:
{f'''
**POINTS PER TASK: {points_per_task_rounded} points each (Total: 100 points across {num_tasks} tasks)**

For EACH task, you must:
1. **Evaluate if the task was attempted in the code**
2. **Verify correctness via outputs and code logic**
3. **Assign a score from 0 to {points_per_task_rounded} based on:**
   - **Completed correctly**: Full points ({points_per_task_rounded} points)
   - **Partially correct**: 50-75% of points ({round(points_per_task_rounded * 0.5, 2)} to {round(points_per_task_rounded * 0.75, 2)} points)
   - **Attempted but incorrect**: 25-40% of points ({round(points_per_task_rounded * 0.25, 2)} to {round(points_per_task_rounded * 0.4, 2)} points)
   - **Not attempted**: 0 points

4. **Set status for each task:**
   - "completed": Task is fully correct and complete
   - "partially_completed": Task is partially correct (50-75% credit)
   - "attempted_incorrect": Task was attempted but is wrong (25-40% credit)
   - "not_attempted": Task was not attempted (0% credit)

5. **IMPORTANT**: If a task is written but incorrect, DO NOT give full points. Give partial credit (25-50% of task points).

**OVERALL SCORE CALCULATION:**
- overall_score = sum of all task scores (must equal sum of task_scores array)
- overall_score MUST be between 0 and 100
- overall_score should exactly equal: sum(task_scores[].score)
- Validate: overall_score should be 0-100
''' if num_tasks > 0 else '''
**FALLBACK SCORING (No tasks defined):**
- Use traditional scoring: code_quality (25) + correctness (40) + library_usage (20) + output_quality (15) = 100
- This should not happen in normal operation
'''}

SCORING GUIDELINES for difficulty "{difficulty}":
- Easy: Be lenient, focus on basic correctness (70+ for working code with correct outputs)
- Medium: Balanced evaluation (60+ for mostly correct implementation with mostly correct outputs)
- Hard: Stricter evaluation (50+ for partial solutions with partially correct outputs)

COMPONENT SCORING GUIDELINES:
- **code_quality.score**: Calculate 0-25 based on code structure, readability, best practices
- **library_usage.score**: Calculate 0-20 based on appropriate library selection and usage
- **output_quality.score**: Calculate 0-15 based on output format, clarity, completeness
- These component scores should reflect actual performance and may not sum exactly to overall_score
- The overall_score is primarily determined by task completion and correctness

IMPORTANT FEEDBACK REQUIREMENTS:
- Make the feedback_summary 5-7 sentences with substantial detail, context, and educational insights
- Make all comment fields highly detailed and educational (4-6 sentences each)
- Provide very specific, actionable feedback with examples from the code
- Be comprehensive, thorough, and educational - explain the 'why' behind observations
- Include specific code examples when discussing strengths or improvements
- Provide educational context about data science, machine learning, and best practices
- Be detailed in every section - users want comprehensive feedback, not brief summaries
- For each task, provide detailed status with specific observations
- Explain library choices and usage patterns in detail
"""
    return prompt


def _generate_rule_based_feedback(
    source_code: str,
    outputs: List[str],
    question_title: str,
    tasks: List[str],
    constraints: List[str],
    difficulty: str,
) -> Dict[str, Any]:
    """Generate rule-based feedback when AI is not available."""
    
    score = 0
    strengths = []
    improvements = []
    suggestions = []
    
    # Check code length (basic metric)
    code_lines = [l for l in source_code.split('\n') if l.strip() and not l.strip().startswith('#')]
    if len(code_lines) >= 5:
        score += 15
        strengths.append("Substantial code implementation")
    elif len(code_lines) >= 2:
        score += 8
        suggestions.append("Consider expanding your implementation")
    else:
        improvements.append("Code is too minimal")
    
    # Check for common library imports
    libraries_found = []
    for lib in ['numpy', 'pandas', 'sklearn', 'matplotlib', 'seaborn', 'scipy', 'tensorflow', 'torch']:
        if lib in source_code.lower():
            libraries_found.append(lib)
    
    if libraries_found:
        score += min(20, len(libraries_found) * 5)
        strengths.append(f"Good use of libraries: {', '.join(libraries_found)}")
    else:
        improvements.append("Consider using appropriate data science libraries")
    
    # Check outputs
    if outputs and any(o.strip() for o in outputs):
        output_content = '\n'.join(outputs)
        
        # Check for error messages
        if 'error' in output_content.lower() or 'traceback' in output_content.lower():
            score += 5
            improvements.append("Code produced errors - debug your implementation")
        else:
            score += 25
            strengths.append("Code executed successfully with output")
            
            # Check for numerical/data outputs
            if any(c.isdigit() for c in output_content):
                score += 10
                strengths.append("Output contains meaningful data")
    else:
        improvements.append("No output produced - run your code")
    
    # Check for comments/documentation
    comments = [l for l in source_code.split('\n') if '#' in l]
    if len(comments) >= 2:
        score += 10
        strengths.append("Good code documentation with comments")
    elif len(comments) >= 1:
        score += 5
        suggestions.append("Add more comments to explain your approach")
    else:
        suggestions.append("Add comments to explain your code")
    
    # Check for functions/structure
    if 'def ' in source_code:
        score += 10
        strengths.append("Well-structured code with functions")
    
    # Difficulty adjustment
    if difficulty == "easy":
        score = min(100, int(score * 1.2))
    elif difficulty == "hard":
        score = int(score * 0.9)
    
    # Cap score
    score = max(0, min(100, score))
    
    # Estimate task completion
    task_completed = min(len(tasks), max(1, score // 25)) if tasks else 0
    
    return {
        "overall_score": score,
        "feedback_summary": f"Your submission scored {score}/100. " + 
            (f"Strengths: {', '.join(strengths[:2])}. " if strengths else "") +
            (f"Areas to improve: {', '.join(improvements[:2])}." if improvements else ""),
        "one_liner": f"Score: {score}/100 | {'Needs work' if score < 50 else 'Good effort' if score < 75 else 'Well done'}",
        "code_quality": {
            "score": min(25, score // 4),
            "comments": "Code structure analysis based on patterns and best practices."
        },
        "correctness": {
            "score": min(40, score // 2),
            "comments": "Correctness evaluated based on output presence and error-free execution."
        },
        "task_completion": {
            "completed": task_completed,
            "total": len(tasks),
            "details": [f"Task {i+1}: {'Attempted' if i < task_completed else 'Not completed'}" for i in range(len(tasks))]
        },
        "library_usage": {
            "score": min(20, len(libraries_found) * 5),
            "comments": f"Libraries detected: {', '.join(libraries_found) if libraries_found else 'None'}"
        },
        "output_quality": {
            "score": min(15, 15 if outputs and not any('error' in o.lower() for o in outputs) else 5),
            "comments": "Output quality based on successful execution."
        },
        "strengths": strengths or ["Code was submitted"],
        "areas_for_improvement": improvements or ["Continue developing your solution"],
        "suggestions": suggestions or ["Review the problem requirements"],
        "deduction_reasons": improvements if score < 80 else [],
        "ai_generated": False,
    }


def evaluate_aiml_submission(
    submission: Dict[str, Any],
    question: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Convenience function to evaluate a complete AIML submission.
    
    Args:
        submission: Dictionary with source_code and outputs
        question: Question document from database
    
    Returns:
        Evaluation result dictionary
    """
    source_code = submission.get("source_code", "")
    outputs = submission.get("outputs", [])
    
    return generate_aiml_feedback(
        source_code=source_code,
        outputs=outputs,
        question_title=question.get("title", "Unknown"),
        question_description=question.get("description", ""),
        tasks=question.get("tasks", []),
        constraints=question.get("constraints", []),
        difficulty=question.get("difficulty", "medium"),
        skill=question.get("assessment_metadata", {}).get("skill") or question.get("library"),
        dataset_info=question.get("dataset"),
        test_cases=question.get("test_cases"),
    )


