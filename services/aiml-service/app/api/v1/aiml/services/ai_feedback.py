"""
AI Feedback Service for AIML Competency Assessments
Evaluates code submissions with AI and generates feedback
"""
import logging
import json
from typing import Dict, Any, List, Optional
from openai import OpenAI

from ..config import OPENAI_API_KEY

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
    
    if not client:
        logger.warning("OpenAI client not available, using rule-based evaluation")
        return _generate_rule_based_feedback(
            source_code, outputs, question_title, tasks, constraints, difficulty
        )
    
    try:
        # Build the evaluation prompt
        prompt = _build_evaluation_prompt(
            source_code, outputs, question_title, question_description,
            tasks, constraints, difficulty, skill, dataset_info
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
) -> str:
    """Build the evaluation prompt for OpenAI."""
    
    tasks_text = "\n".join([f"  {i+1}. {task}" for i, task in enumerate(tasks)]) if tasks else "  No specific tasks defined"
    constraints_text = "\n".join([f"  - {c}" for c in constraints]) if constraints else "  No specific constraints"
    outputs_text = "\n---\n".join(outputs) if outputs else "No outputs"
    
    # Include dataset info if available
    dataset_text = ""
    if dataset_info:
        dataset_text = f"\nDataset Information:\n"
        if dataset_info.get("schema"):
            dataset_text += f"  Schema: {dataset_info.get('schema')}\n"
        if dataset_info.get("rows"):
            dataset_text += f"  Sample rows: {len(dataset_info.get('rows', []))} rows\n"
    
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
    "code_quality": {{
        "score": <0-25>,
        "comments": "<Comprehensive 4-6 sentence detailed assessment of code structure, readability, best practices. Include: (1) Detailed analysis of code organization and structure, (2) Evaluation of readability and clarity with specific examples, (3) Assessment of whether best practices are followed, (4) Discussion of maintainability and scalability, (5) Code style and conventions evaluation, (6) Educational insights about code quality. Be detailed and educational.>"
    }},
    "correctness": {{
        "score": <0-40>,
        "comments": "<CRITICAL: This is the MOST IMPORTANT criterion. Provide comprehensive 4-6 sentence detailed assessment. You MUST: (1) Analyze the ACTUAL outputs against what the task EXPECTS - are outputs correct? (2) Verify if outputs match expected format, values, and data types based on task requirements, (3) Check if the logic produces the right results for the given problem, (4) Identify any errors, incorrect calculations, or wrong outputs, (5) Determine if outputs demonstrate successful task completion, (6) Be SPECIFIC about what is correct/incorrect in the outputs. This score should heavily penalize incorrect outputs. Be detailed, specific, and educational.>"
    }},
    "task_completion": {{
        "completed": <number of tasks completed CORRECTLY>,
        "total": {len(tasks)},
        "details": ["<For EACH task, provide: (1) Whether the task was completed, (2) Evidence from code/outputs showing completion, (3) If not completed, what is missing, (4) If completed incorrectly, what is wrong. Be VERY SPECIFIC and reference actual code/outputs.>"]
    }},
    "library_usage": {{
        "score": <0-20>,
        "comments": "<Comprehensive 4-6 sentence detailed assessment of appropriate library usage. Include: (1) Detailed evaluation of which libraries were used and why, (2) Assessment of whether libraries were used appropriately and efficiently, (3) Discussion of alternative library choices if relevant, (4) Evaluation of library-specific best practices, (5) Educational insights about library selection and usage, (6) Specific examples of good or poor library usage. Be detailed and educational.>"
    }},
    "output_quality": {{
        "score": <0-15>,
        "comments": "<Comprehensive 3-5 sentence detailed assessment of output format and presentation. Include: (1) Detailed evaluation of output format and structure, (2) Assessment of output clarity and presentation, (3) Discussion of whether output meets requirements, (4) Evaluation of output completeness, (5) Educational insights about output quality. Be detailed and educational.>"
    }},
    "strengths": ["<Comprehensive, detailed strengths - explain what was done well, why it's good, and provide specific examples from the code. Be educational and detailed.>", "<Additional detailed strengths with specific examples>", "<More strengths with explanations of why they matter>"],
    "areas_for_improvement": ["<Comprehensive, specific areas to improve with detailed explanations, examples, and why these improvements matter. Be educational.>", "<Additional detailed improvement areas with explanations>", "<More improvement areas with specific actionable guidance>"],
    "suggestions": ["<Comprehensive, detailed actionable suggestions for better code with explanations of why each suggestion would improve the code. Be very specific and educational.>", "<Additional detailed suggestions with explanations>", "<More specific suggestions with code examples if applicable>"],
    "deduction_reasons": ["<If score < 80, provide comprehensive, detailed list of specific reasons for deductions with explanations. Be very specific and educational.>", "<Additional detailed deduction reasons>"]
}}

SCORING GUIDELINES for difficulty "{difficulty}":
- Easy: Be lenient, focus on basic correctness (70+ for working code with correct outputs)
- Medium: Balanced evaluation (60+ for mostly correct implementation with mostly correct outputs)
- Hard: Stricter evaluation (50+ for partial solutions with partially correct outputs)

CRITICAL SCORING RULES:
1. **Correctness (40 points) is MOST IMPORTANT**: 
   - If outputs are CORRECT and match task requirements: 30-40 points
   - If outputs are PARTIALLY CORRECT: 15-29 points
   - If outputs are INCORRECT or missing: 0-14 points
   - If code has errors preventing execution: 0-10 points

2. **Task Completion**: 
   - All tasks completed correctly: Full points
   - Some tasks completed: Proportional points
   - No tasks completed: 0 points

3. **Code Quality (25 points)**: 
   - Well-structured, readable, follows best practices: 20-25 points
   - Acceptable structure: 10-19 points
   - Poor structure: 0-9 points

4. **Library Usage (20 points)**: 
   - Appropriate and efficient library usage: 15-20 points
   - Acceptable usage: 8-14 points
   - Poor or missing library usage: 0-7 points

5. **Output Quality (15 points)**: 
   - Well-formatted, complete outputs: 12-15 points
   - Acceptable outputs: 6-11 points
   - Poor outputs: 0-5 points

The overall_score should approximately equal: code_quality.score + correctness.score + library_usage.score + output_quality.score
Adjust slightly based on task completion percentage. If correctness score is very low (<15), overall score should reflect that the solution is fundamentally incorrect.

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
    )


