"""
Test the new task-based evaluation system
"""
import asyncio
import sys
import os
import json

# Fix Unicode encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from app.api.v1.aiml.database import connect_to_aiml_mongo, get_aiml_database
from app.api.v1.aiml.services.ai_feedback import generate_aiml_feedback


async def test_evaluation(test_id: str, user_id: str, question_id: str):
    """Test the new evaluation system"""
    await connect_to_aiml_mongo()
    db = get_aiml_database()
    
    print("=" * 80)
    print("TESTING NEW TASK-BASED EVALUATION SYSTEM")
    print("=" * 80)
    print()
    
    # Get submission
    submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if not submission:
        print(f"[ERROR] Submission not found")
        return
    
    # Get question
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not question:
        print(f"[ERROR] Question not found")
        return
    
    # Get submission for this question
    question_submission = None
    for sub in submission.get("submissions", []):
        if str(sub.get("question_id")) == question_id:
            question_submission = sub
            break
    
    if not question_submission:
        print(f"[ERROR] Question submission not found")
        return
    
    source_code = question_submission.get("source_code", "")
    outputs = question_submission.get("outputs", [])
    tasks = question.get("tasks", [])
    test_cases = question.get("test_cases", [])
    
    print(f"Question: {question.get('title', 'Unknown')}")
    print(f"Tasks: {len(tasks)}")
    print(f"Test Cases: {len(test_cases)}")
    print(f"Source Code Length: {len(source_code)}")
    print(f"Outputs: {len(outputs)}")
    print()
    
    # Run new evaluation
    print("Running NEW evaluation system...")
    print("-" * 80)
    
    evaluation_result = generate_aiml_feedback(
        source_code=source_code,
        outputs=outputs,
        question_title=question.get("title", ""),
        question_description=question.get("description", ""),
        tasks=tasks,
        constraints=question.get("constraints", []),
        difficulty=question.get("difficulty", "medium"),
        skill=question.get("skill"),
        dataset_info=question.get("dataset"),
        test_cases=test_cases
    )
    
    # Display results
    print("\n" + "=" * 80)
    print("EVALUATION RESULTS")
    print("=" * 80)
    print()
    
    print(f"Overall Score: {evaluation_result.get('overall_score', 0)}/100")
    print()
    
    # Task scores
    task_scores = evaluation_result.get("task_scores", [])
    print("TASK SCORES:")
    print("-" * 80)
    total_task_score = 0.0
    for ts in task_scores:
        task_score = ts.get("score", 0)
        max_score = ts.get("max_score", 0)
        total_task_score += task_score
        test_case_earned = ts.get("test_case_earned", 0)
        test_case_total = ts.get("test_case_total", 0)
        scaling_factor = ts.get("scaling_factor", 1.0)
        
        print(f"Task {ts.get('task_number')}: {task_score:.2f}/{max_score:.2f} ({ts.get('status', 'unknown')})")
        print(f"  Description: {ts.get('task_description', '')}")
        print(f"  Test Cases: {test_case_earned:.2f}/{test_case_total:.2f} points earned")
        print(f"  Scaling Factor: {scaling_factor:.4f} (scales to task max)")
        print(f"  Final Score: {test_case_earned:.2f} × {scaling_factor:.4f} = {task_score:.2f}")
        print(f"  Feedback: {ts.get('feedback', '')}")
        print()
    
    print(f"Sum of Task Scores: {total_task_score:.2f}/100")
    print(f"Overall Score: {evaluation_result.get('overall_score', 0)}/100")
    match_status = "YES" if abs(total_task_score - evaluation_result.get('overall_score', 0)) < 0.01 else "NO"
    match_symbol = "[OK]" if match_status == "YES" else "[FAIL]"
    print(f"Match: {match_symbol} {match_status}")
    print()
    
    # Feedback
    print("FEEDBACK:")
    print("-" * 80)
    feedback = evaluation_result.get("feedback_summary", "")
    print(feedback)
    print()
    
    # Word count
    word_count = len(feedback.split())
    print(f"Word Count: {word_count} (Target: <300)")
    has_bullets = '•' in feedback or '-' in feedback
    format_status = "[OK] Bullets" if has_bullets else "[FAIL] Paragraphs"
    print(f"Format Check: {format_status}")
    print()
    
    # Component scores (should be 0)
    code_quality = evaluation_result.get("code_quality", {}).get("score", 0)
    library_usage = evaluation_result.get("library_usage", {}).get("score", 0)
    output_quality = evaluation_result.get("output_quality", {}).get("score", 0)
    
    print("COMPONENT SCORES (should be 0, not separate scores):")
    print(f"  Code Quality: {code_quality}/25")
    print(f"  Library Usage: {library_usage}/20")
    print(f"  Output Quality: {output_quality}/15")
    print(f"  Total Components: {code_quality + library_usage + output_quality}/60")
    print(f"  Overall Score: {evaluation_result.get('overall_score', 0)}/100")
    print()
    
    # Task completion
    task_completion = evaluation_result.get("task_completion", {})
    print(f"Task Completion: {task_completion.get('completed', 0)}/{task_completion.get('total', 0)}")
    print()
    
    # Save result
    print("=" * 80)
    print("SAVING RESULT...")
    print("=" * 80)
    
    # Update submission in database
    updated_submissions = submission.get("submissions", [])
    for sub in updated_submissions:
        if str(sub.get("question_id")) == question_id:
            sub["ai_feedback"] = evaluation_result
            sub["score"] = evaluation_result.get("overall_score", 0)
            sub["status"] = "evaluated"
            break
    
    await db.test_submissions.update_one(
        {"_id": submission["_id"]},
        {"$set": {"submissions": updated_submissions}}
    )
    
    print("[SUCCESS] Result saved to database")
    print()
    print("You can now view the updated evaluation in the analytics page")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 4:
        print("Usage:")
        print("  python test_new_evaluation.py <test_id> <user_id> <question_id>")
        print()
        print("Example:")
        print("  python test_new_evaluation.py 698c6be92f3c27c6e8ad66d3 697b5e693272fc7bd19955c4 698c6b922f3c27c6e8ad66d2")
        sys.exit(1)
    
    test_id = sys.argv[1]
    user_id = sys.argv[2]
    question_id = sys.argv[3]
    
    asyncio.run(test_evaluation(test_id, user_id, question_id))
