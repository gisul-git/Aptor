"""
Task-Based Evaluation System for AIML Submissions

Evaluates each task independently and calculates scores based on:
1. Code implementation (AST validation)
2. Output correctness
3. Task requirements completion
"""
import logging
import re
from typing import Dict, Any, List, Optional
from .code_analyzer import CodeAnalyzer

logger = logging.getLogger(__name__)


def evaluate_task(
    task_number: int,
    task_description: str,
    task_test_cases: List[Dict[str, Any]],
    source_code: str,
    outputs: List[str],
    analyzer: CodeAnalyzer,
    max_points: float
) -> Dict[str, Any]:
    """
    Evaluate a single task based on test cases and code analysis.
    
    Args:
        task_number: Task number (1-indexed)
        task_description: Description of what the task requires
        task_test_cases: List of test cases for this task
        source_code: Submitted source code
        outputs: Execution outputs
        analyzer: CodeAnalyzer instance
        max_points: Maximum points for this task
    
    Returns:
        Dictionary with task evaluation results
    """
    combined_output = "\n".join(outputs).lower()
    source_code_lower = source_code.lower()
    
    task_score = 0.0
    passed_tests = 0
    total_tests = len(task_test_cases)
    test_results = []
    
    # Calculate total points for test cases in this task
    total_test_case_points = sum(float(tc.get("points", 0)) for tc in task_test_cases)
    
    # CRITICAL: ALWAYS scale test case points to match task max_points
    # This ensures each task has equal weight regardless of test case point distribution
    # Scale UP if test cases < task max, Scale DOWN if test cases > task max
    scaling_factor = 1.0
    if total_test_case_points > 0:
        scaling_factor = max_points / total_test_case_points
    else:
        # No test cases = 0 points
        scaling_factor = 0
    
    # Track earned points (before scaling)
    test_case_earned = 0.0
    
    # Evaluate each test case for this task
    for tc in task_test_cases:
        validation_type = tc.get("validation_type", "").lower()
        expected_output = tc.get("expected_output", "")
        original_points = float(tc.get("points", 0))
        description = tc.get("description", "")
        
        passed = False
        feedback = ""
        
        if validation_type == "import_check":
            # Verify import exists via AST
            if analyzer.verify_import(expected_output):
                passed = True
                feedback = f"✅ Import found: {expected_output}"
            else:
                feedback = f"❌ Missing import: {expected_output}"
        
        elif validation_type == "function_call_check":
            # Verify function was called via AST
            if analyzer.verify_function_call(expected_output):
                passed = True
                feedback = f"✅ Function called: {expected_output}"
            else:
                feedback = f"❌ Function not called: {expected_output}"
        
        elif validation_type == "dataset_load_check":
            # Verify dataset loading
            if analyzer.has_dataset_loading():
                passed = True
                feedback = "✅ Dataset loading code detected"
            else:
                feedback = "❌ No dataset loading code found"
        
        elif validation_type == "model_training_check":
            # Verify model training
            if analyzer.has_model_training():
                passed = True
                feedback = "✅ Model training code detected (.fit())"
            else:
                feedback = "❌ No model training code found"
        
        elif validation_type == "output_structure_check":
            # Verify output structure
            has_numeric = any(char.isdigit() for char in combined_output)
            has_array_like = '[' in combined_output or 'array' in combined_output.lower()
            has_dataframe = 'dataframe' in combined_output.lower() or '|' in combined_output
            
            if expected_output == "numeric" and has_numeric:
                passed = True
                feedback = "✅ Output contains numeric data"
            elif expected_output == "contains_array" and has_array_like:
                passed = True
                feedback = "✅ Output contains array-like structure"
            elif expected_output == "contains_dataframe" and has_dataframe:
                passed = True
                feedback = "✅ Output contains DataFrame structure"
            else:
                feedback = f"❌ Output doesn't match expected structure: {expected_output}"
        
        elif validation_type == "exact_match":
            # Check if output contains exact value
            if expected_output.lower() in combined_output:
                passed = True
                feedback = f"✅ Expected output found: {expected_output}"
            else:
                feedback = f"❌ Expected output not found: {expected_output}"
        
        elif validation_type == "contains":
            # Check if output contains keyword
            keywords = expected_output.lower().split("|")
            if any(keyword.strip() in combined_output for keyword in keywords):
                passed = True
                feedback = f"✅ Expected content found: {expected_output}"
            else:
                feedback = f"❌ Expected content not found: {expected_output}"
        
        elif validation_type == "numeric_range":
            # Check if number is in range
            try:
                numbers = re.findall(r'-?\d+\.?\d*', combined_output)
                if numbers:
                    for num_str in numbers:
                        try:
                            num = float(num_str)
                            if "-" in expected_output:
                                min_val, max_val = map(float, expected_output.split("-"))
                                if min_val <= num <= max_val:
                                    passed = True
                                    feedback = f"✅ Value {num} in range {expected_output}"
                                    break
                            elif expected_output.startswith(">"):
                                threshold = float(expected_output[1:])
                                if num > threshold:
                                    passed = True
                                    feedback = f"✅ Value {num} > {threshold}"
                                    break
                            elif expected_output.startswith("<"):
                                threshold = float(expected_output[1:])
                                if num < threshold:
                                    passed = True
                                    feedback = f"✅ Value {num} < {threshold}"
                                    break
                        except ValueError:
                            continue
                if not passed:
                    feedback = f"❌ No value found in range: {expected_output}"
            except Exception as e:
                logger.warning(f"Error in numeric_range validation: {e}")
                feedback = f"❌ Error checking range: {expected_output}"
        
        else:
            logger.warning(f"Unknown validation_type: {validation_type}")
            feedback = f"Unknown validation type: {validation_type}"
        
        if passed:
            test_case_earned += original_points  # Track original points earned
            passed_tests += 1
        
        test_results.append({
            "description": description,
            "validation_type": validation_type,
            "expected": expected_output,
            "passed": passed,
            "original_points": round(original_points, 2),
            "scaled_points": round(original_points * scaling_factor if passed else 0, 2),
            "feedback": feedback
        })
    
    # CRITICAL: Scale earned points to match task max_points
    # This ensures perfect code gets full marks regardless of test case point distribution
    if total_test_case_points > 0:
        task_score = test_case_earned * scaling_factor
        # Safety check: cap at max_points (shouldn't exceed due to scaling, but just in case)
        task_score = min(task_score, max_points)
    else:
        task_score = 0.0
    
    # Calculate percentage completion
    completion_pct = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    
    # Determine status
    if completion_pct >= 90:
        status = "completed"
        status_symbol = "✅"
    elif completion_pct >= 60:
        status = "partially_completed"
        status_symbol = "⚠️"
    elif completion_pct > 0:
        status = "attempted_incorrect"
        status_symbol = "⚠️"
    else:
        status = "not_attempted"
        status_symbol = "❌"
    
    return {
        "task_number": task_number,
        "task_description": task_description,
        "score": round(task_score, 2),
        "max_score": round(max_points, 2),
        "status": status,
        "status_symbol": status_symbol,
        "completion_percentage": round(completion_pct, 1),
        "passed_tests": passed_tests,
        "total_tests": total_tests,
        "test_case_earned": round(test_case_earned, 2),
        "test_case_total": round(total_test_case_points, 2),
        "scaling_factor": round(scaling_factor, 4),
        "test_results": test_results
    }


def evaluate_all_tasks(
    tasks: List[str],
    test_cases: List[Dict[str, Any]],
    source_code: str,
    outputs: List[str]
) -> Dict[str, Any]:
    """
    Evaluate all tasks for a submission.
    
    Args:
        tasks: List of task descriptions
        test_cases: List of all test cases (grouped by task_number)
        source_code: Submitted source code
        outputs: Execution outputs
    
    Returns:
        Dictionary with overall_score and task_scores
    """
    analyzer = CodeAnalyzer(source_code)
    
    # Group test cases by task number
    tasks_dict = {}
    for tc in test_cases:
        task_num = tc.get("task_number", 0)
        if task_num not in tasks_dict:
            tasks_dict[task_num] = []
        tasks_dict[task_num].append(tc)
    
    # Calculate points per task
    num_tasks = len(tasks)
    if num_tasks == 0:
        return {
            "overall_score": 0,
            "task_scores": [],
            "error": "No tasks defined"
        }
    
    points_per_task = 100.0 / num_tasks
    # Distribute points evenly, adjusting last task to sum to exactly 100
    points_list = [round(points_per_task, 2) for _ in range(num_tasks)]
    total_rounded = sum(points_list)
    if abs(total_rounded - 100.0) > 0.01:
        # Adjust last task to make sum exactly 100
        points_list[-1] = round(100.0 - sum(points_list[:-1]), 2)
    
    # Evaluate each task
    task_evaluations = []
    total_score = 0.0
    
    # Evaluate tasks based on task numbers found in test_cases
    for task_num in sorted(tasks_dict.keys()):
        task_test_cases = tasks_dict[task_num]
        # Get task description from tasks list (index is task_num - 1)
        task_desc = tasks[task_num - 1] if task_num <= len(tasks) else f"Task {task_num}"
        # Get max points for this task (index is task_num - 1)
        max_points = points_list[task_num - 1] if task_num <= len(points_list) else points_per_task
        
        task_result = evaluate_task(
            task_number=task_num,
            task_description=task_desc,
            task_test_cases=task_test_cases,
            source_code=source_code,
            outputs=outputs,
            analyzer=analyzer,
            max_points=max_points
        )
        
        task_evaluations.append(task_result)
        total_score += task_result["score"]
    
    # Sort by task_number to ensure correct order
    task_evaluations.sort(key=lambda x: x["task_number"])
    
    # Ensure overall_score is between 0 and 100
    overall_score = max(0, min(100, round(total_score, 2)))
    
    return {
        "overall_score": overall_score,
        "task_scores": task_evaluations
    }
