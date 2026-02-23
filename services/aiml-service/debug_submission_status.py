"""
Debug submission status issue - why shows "Not submitted" despite evaluation
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from app.api.v1.aiml.database import connect_to_aiml_mongo, get_aiml_database


async def debug_submission_status():
    """Debug why submission shows 'Not submitted' despite evaluation"""
    
    test_id = "698c6be92f3c27c6e8ad66d3"
    question_id = "698c6b922f3c27c6e8ad66d2"
    user_id = "697b5e693272fc7bd19955c4"
    
    await connect_to_aiml_mongo()
    db = get_aiml_database()
    
    print("=" * 80)
    print("DEBUG: SUBMISSION STATUS ISSUE")
    print("=" * 80)
    print()
    
    # Check test_submissions
    submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    print("=== SUBMISSION STATUS ===")
    print(f"Submission exists: {submission is not None}")
    if submission:
        print(f"Test submission ID: {submission.get('_id')}")
        print(f"Overall score: {submission.get('score', 0)}")
        print(f"AI feedback status: {submission.get('ai_feedback_status', 'N/A')}")
        print(f"Is completed: {submission.get('is_completed', False)}")
        print(f"Submissions count: {len(submission.get('submissions', []))}")
        print()
        
        for idx, sub in enumerate(submission.get("submissions", [])):
            print(f"Submission {idx + 1}:")
            print(f"  Question ID: {sub.get('question_id')}")
            print(f"  Source code length: {len(sub.get('source_code', ''))}")
            print(f"  Outputs count: {len(sub.get('outputs', []))}")
            print(f"  Status field: {sub.get('status', 'NOT SET')}")
            print(f"  Score: {sub.get('score', 'NOT SET')}")
            print(f"  Has ai_feedback: {bool(sub.get('ai_feedback'))}")
            print(f"  Submitted at: {sub.get('submitted_at')}")
            print()
            
            if str(sub.get('question_id')) == question_id:
                print(f"  >>> MATCHING QUESTION FOUND <<<")
                print(f"  Full submission data:")
                import json
                print(json.dumps(sub, indent=2, default=str))
    
    # Check question
    question = await db.questions.find_one({
        "_id": ObjectId(question_id)
    })
    
    print("\n=== QUESTION TEST CASES ===")
    if question:
        print(f"Question title: {question.get('title', 'N/A')}")
        test_cases = question.get("test_cases", [])
        print(f"Test cases count: {len(test_cases)}")
        for tc in test_cases:
            print(f"  Task {tc.get('task_number')}:")
            print(f"    Validation type: {tc.get('validation_type')}")
            print(f"    Expected: {tc.get('expected_output')}")
            print(f"    Points: {tc.get('points')}")
    
    # Check if evaluation ran
    print("\n=== EVALUATION CHECK ===")
    if submission:
        evaluations = submission.get("evaluations", [])
        print(f"Evaluations count: {len(evaluations)}")
        for eval_result in evaluations:
            if str(eval_result.get("question_id")) == question_id:
                print(f"  >>> EVALUATION FOUND FOR QUESTION <<<")
                print(f"  Score: {eval_result.get('score', 'N/A')}")
                feedback = eval_result.get("feedback", {})
                print(f"  Overall score: {feedback.get('overall_score', 'N/A')}")
                print(f"  Task scores count: {len(feedback.get('task_scores', []))}")
    
    # Test CodeAnalyzer if code exists
    if submission:
        for sub in submission.get("submissions", []):
            if str(sub.get('question_id')) == question_id:
                code = sub.get("source_code", "")
                if code:
                    print("\n=== CODE ANALYSIS ===")
                    from app.api.v1.aiml.services.code_analyzer import CodeAnalyzer
                    analyzer = CodeAnalyzer(code)
                    print(f"Imports: {analyzer.get_imports()}")
                    print(f"Function calls: {analyzer.get_function_calls()}")
                    print(f"Has TfidfVectorizer import: {any('TfidfVectorizer' in imp for imp in analyzer.get_imports())}")
                    print(f"Has cross_val_score call: {'cross_val_score' in analyzer.get_function_calls()}")
                    print(f"Has GridSearchCV call: {'GridSearchCV' in analyzer.get_function_calls()}")
                    print(f"Has dataset loading: {analyzer.has_dataset_loading()}")
                    print(f"Has model training: {analyzer.has_model_training()}")
                break


if __name__ == "__main__":
    asyncio.run(debug_submission_status())
