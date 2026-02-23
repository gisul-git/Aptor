"""
Concise Feedback Generator for AIML Evaluations

Generates structured, concise feedback following the exact format:
- Bullet points, not paragraphs
- Under 300 words
- Matches numerical scores
- Distinguishes code vs data issues
"""
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


def detect_data_limitations(outputs: List[str], source_code: str) -> Dict[str, Any]:
    """
    Detect if poor results are due to data limitations vs code errors.
    
    Returns:
        Dictionary with:
        - has_data_issue: bool
        - data_issue_type: str (e.g., "small_dataset", "class_imbalance")
        - evidence: List[str]
    """
    combined_output = "\n".join(outputs).lower()
    
    data_issues = {
        "has_data_issue": False,
        "data_issue_type": None,
        "evidence": []
    }
    
    # Check for small dataset warnings
    if "least populated class" in combined_output or "n_splits" in combined_output:
        data_issues["has_data_issue"] = True
        data_issues["data_issue_type"] = "small_dataset"
        data_issues["evidence"].append("Cross-validation warnings about small dataset")
    
    # Check for NaN values in results (often due to small data)
    if "nan" in combined_output or "non-finite" in combined_output:
        data_issues["has_data_issue"] = True
        if not data_issues["data_issue_type"]:
            data_issues["data_issue_type"] = "insufficient_data"
        data_issues["evidence"].append("NaN values in results (likely due to data size)")
    
    # Check for class imbalance warnings
    if "imbalanced" in combined_output or "only 1 class" in combined_output:
        data_issues["has_data_issue"] = True
        data_issues["data_issue_type"] = "class_imbalance"
        data_issues["evidence"].append("Class imbalance detected")
    
    # Check if code adapts to data constraints (good sign)
    if "cv=3" in source_code.lower() and "small" in source_code.lower():
        data_issues["evidence"].append("Code adapts to data constraints (good practice)")
    
    return data_issues


def generate_concise_feedback(
    overall_score: float,
    task_evaluations: List[Dict[str, Any]],
    source_code: str,
    outputs: List[str],
    tasks: List[str]
) -> str:
    """
    Generate concise, structured feedback following exact format.
    
    Args:
        overall_score: Overall score (0-100)
        task_evaluations: List of task evaluation results
        source_code: Submitted code
        outputs: Execution outputs
        tasks: List of task descriptions
    
    Returns:
        Formatted feedback string (<300 words)
    """
    data_issues = detect_data_limitations(outputs, source_code)
    
    # Build feedback sections
    feedback_parts = []
    
    # Score header
    feedback_parts.append(f"Score: {int(overall_score)}/100\n")
    
    # Overall summary (2-3 sentences)
    if overall_score >= 90:
        summary = f"Excellent implementation completing all tasks correctly. "
        if data_issues["has_data_issue"]:
            summary += f"Results limited by dataset constraints, not code errors. "
        summary += f"Code demonstrates strong ML fundamentals."
    elif overall_score >= 75:
        summary = f"Good implementation with minor issues. "
        if data_issues["has_data_issue"]:
            summary += f"Some results affected by dataset size. "
        summary += f"Core requirements met with room for improvement."
    elif overall_score >= 50:
        summary = f"Partial implementation with significant gaps. "
        summary += f"Some tasks completed correctly, others need work."
    else:
        summary = f"Incomplete implementation. "
        summary += f"Most tasks not completed or contain errors."
    
    feedback_parts.append(summary)
    feedback_parts.append("\n")
    
    # Task breakdown
    feedback_parts.append("TASK BREAKDOWN:\n")
    feedback_parts.append("-------------\n\n")
    
    for task_eval in task_evaluations:
        task_num = task_eval["task_number"]
        task_desc = task_eval["task_description"]
        score = task_eval["score"]
        max_score = task_eval["max_score"]
        status_symbol = task_eval.get("status_symbol", "✅")
        test_results = task_eval.get("test_results", [])
        
        # Task header
        feedback_parts.append(f"{status_symbol} Task {task_num}: {task_desc} ({int(score)}/{int(max_score)})\n")
        
        # What was required (from task description)
        feedback_parts.append(f"   • Required: {task_desc}\n")
        
        # What student did (from test results)
        passed_tests = [tr for tr in test_results if tr.get("passed")]
        failed_tests = [tr for tr in test_results if not tr.get("passed")]
        
        if passed_tests:
            what_done = []
            for tr in passed_tests[:2]:  # Max 2 items
                desc = tr.get("description", "")
                if desc:
                    what_done.append(desc.split(".")[0])  # First sentence only
            
            if what_done:
                feedback_parts.append(f"   • Student: {', '.join(what_done)}\n")
        
        # Result/issue
        if score >= max_score * 0.9:
            feedback_parts.append(f"   • Result: All requirements met correctly\n")
        elif score >= max_score * 0.6:
            if failed_tests:
                issue = failed_tests[0].get("feedback", "").replace("❌ ", "").replace("✅ ", "")
                feedback_parts.append(f"   • Issue: {issue}\n")
            else:
                feedback_parts.append(f"   • Result: Mostly correct with minor gaps\n")
        elif score > 0:
            if failed_tests:
                issue = failed_tests[0].get("feedback", "").replace("❌ ", "").replace("✅ ", "")
                feedback_parts.append(f"   • Issue: {issue}\n")
            else:
                feedback_parts.append(f"   • Result: Partial implementation\n")
        else:
            feedback_parts.append(f"   • Issue: Task not attempted or completely incorrect\n")
        
        feedback_parts.append("\n")
    
    # Code quality observations
    feedback_parts.append("CODE QUALITY OBSERVATIONS:\n")
    feedback_parts.append("-------------------------\n")
    
    # Analyze code structure
    has_functions = 'def ' in source_code
    has_comments = '#' in source_code
    has_structure = len(source_code.split('\n')) > 20
    
    quality_points = []
    if has_structure and has_functions:
        quality_points.append("Well-structured code with clear organization")
    elif has_structure:
        quality_points.append("Code organized into logical sections")
    
    if has_comments:
        quality_points.append("Good use of comments for clarity")
    else:
        quality_points.append("Consider adding comments for complex logic")
    
    for point in quality_points[:2]:  # Max 2 points
        feedback_parts.append(f"- {point}\n")
    
    feedback_parts.append("\n")
    
    # Strengths
    feedback_parts.append("STRENGTHS:\n")
    feedback_parts.append("---------\n")
    
    strengths = []
    
    # Task completion strengths
    completed_tasks = [te for te in task_evaluations if te["score"] >= te["max_score"] * 0.9]
    if len(completed_tasks) == len(task_evaluations):
        strengths.append("All tasks completed correctly")
    elif len(completed_tasks) > 0:
        strengths.append(f"{len(completed_tasks)}/{len(task_evaluations)} tasks completed correctly")
    
    # Code quality strengths
    if has_functions:
        strengths.append("Proper use of functions for modularity")
    
    # Library usage strengths
    from .code_analyzer import CodeAnalyzer
    analyzer = CodeAnalyzer(source_code)
    imports = analyzer.get_imports()
    if len(imports) >= 3:
        strengths.append("Appropriate library selection and usage")
    
    # Data handling strengths
    if data_issues.get("evidence") and "adapts" in str(data_issues["evidence"]):
        strengths.append("Intelligent adaptation to data constraints")
    
    for strength in strengths[:3]:  # Max 3 strengths
        feedback_parts.append(f"- {strength}\n")
    
    if not strengths:
        feedback_parts.append("- Code submitted and executed\n")
    
    feedback_parts.append("\n")
    
    # Improvements needed (only if score < 95)
    if overall_score < 95:
        feedback_parts.append("IMPROVEMENTS NEEDED:\n")
        feedback_parts.append("-------------------\n")
        
        improvements = []
        
        # Task-specific improvements
        incomplete_tasks = [te for te in task_evaluations if te["score"] < te["max_score"] * 0.9]
        for task_eval in incomplete_tasks[:2]:  # Max 2 tasks
            failed_tests = [tr for tr in task_eval.get("test_results", []) if not tr.get("passed")]
            if failed_tests:
                issue = failed_tests[0].get("feedback", "").replace("❌ ", "")
                improvements.append(issue)
        
        # General improvements
        if not has_comments and overall_score < 80:
            improvements.append("Add comments to explain complex logic")
        
        if not has_functions and len(source_code.split('\n')) > 30:
            improvements.append("Break code into functions for better organization")
        
        for improvement in improvements[:2]:  # Max 2 improvements
            feedback_parts.append(f"- {improvement}\n")
        
        if not improvements:
            feedback_parts.append("- Minor refinements could improve code quality\n")
        
        feedback_parts.append("\n")
    
    # Final note
    feedback_parts.append("FINAL NOTE:\n")
    feedback_parts.append("----------\n")
    
    if overall_score >= 90:
        if data_issues["has_data_issue"]:
            feedback_parts.append("Excellent code implementation. Results limited by dataset size, not code quality.\n")
        else:
            feedback_parts.append("Strong implementation demonstrating solid ML fundamentals.\n")
    elif overall_score >= 75:
        feedback_parts.append("Good work. Continue refining implementation details.\n")
    elif overall_score >= 50:
        feedback_parts.append("Keep working on completing all task requirements.\n")
    else:
        feedback_parts.append("Focus on implementing core requirements for each task.\n")
    
    # Combine and verify word count
    feedback = "".join(feedback_parts)
    word_count = len(feedback.split())
    
    if word_count > 300:
        logger.warning(f"Feedback exceeds 300 words ({word_count}), truncating...")
        # Truncate by removing some details
        lines = feedback.split("\n")
        truncated = []
        word_count = 0
        for line in lines:
            line_words = len(line.split())
            if word_count + line_words > 300:
                break
            truncated.append(line)
            word_count += line_words
        feedback = "\n".join(truncated)
        feedback += "\n\n[Feedback truncated to meet word limit]"
    
    return feedback.strip()
