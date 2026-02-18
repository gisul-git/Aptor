"""
Re-evaluate an AIML submission to see updated component scores
"""
import asyncio
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from app.api.v1.aiml.database import connect_to_aiml_mongo, get_aiml_database
from app.api.v1.aiml.services.ai_feedback import evaluate_aiml_submission


async def re_evaluate_submission(test_id: str, user_id: str, question_id: str = None):
    """
    Re-evaluate a submission and show updated component scores
    
    Args:
        test_id: Test ID
        user_id: User ID
        question_id: Optional question ID (if None, re-evaluates all questions)
    """
    await connect_to_aiml_mongo()
    db = get_aiml_database()
    
    print("=" * 80)
    print("RE-EVALUATING SUBMISSION")
    print("=" * 80)
    print(f"Test ID: {test_id}")
    print(f"User ID: {user_id}")
    if question_id:
        print(f"Question ID: {question_id}")
    print()
    
    # Get test submission
    submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if not submission:
        print(f"[ERROR] Submission not found for test {test_id}, user {user_id}")
        return
    
    print(f"[INFO] Found submission: {submission.get('_id')}")
    print(f"[INFO] Current overall score: {submission.get('score', 0)}")
    print(f"[INFO] AI feedback status: {submission.get('ai_feedback_status', 'unknown')}")
    print()
    
    # Get questions
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        print(f"[ERROR] Test not found: {test_id}")
        return
    
    question_ids = test.get("question_ids", [])
    questions = {}
    for qid in question_ids:
        if ObjectId.is_valid(str(qid)):
            q = await db.questions.find_one({"_id": ObjectId(str(qid))})
            if q:
                questions[str(qid)] = q
    
    # Get submissions
    submissions_list = submission.get("submissions", [])
    
    # Filter by question_id if specified
    if question_id:
        submissions_list = [s for s in submissions_list if str(s.get("question_id")) == str(question_id)]
    
    if not submissions_list:
        print(f"[ERROR] No submissions found")
        return
    
    print(f"[INFO] Re-evaluating {len(submissions_list)} submission(s)...")
    print()
    
    # Re-evaluate each submission
    updated_submissions = []
    for sub in submissions_list:
        qid = str(sub.get("question_id"))
        question = questions.get(qid)
        
        if not question:
            print(f"[WARNING] Question {qid} not found, skipping")
            continue
        
        print(f"[INFO] Re-evaluating question: {question.get('title', 'Unknown')}")
        print(f"       Question ID: {qid}")
        print(f"       Source code length: {len(sub.get('source_code', ''))}")
        print(f"       Outputs count: {len(sub.get('outputs', []))}")
        
        # Re-evaluate
        try:
            evaluation = evaluate_aiml_submission(sub, question)
            
            print(f"\n[RESULT] Evaluation completed:")
            print(f"  Overall Score: {evaluation.get('overall_score', 0)}/100")
            
            # Show component scores
            code_quality = evaluation.get('code_quality', {})
            library_usage = evaluation.get('library_usage', {})
            output_quality = evaluation.get('output_quality', {})
            
            print(f"\n  Component Scores:")
            print(f"    Code Quality: {code_quality.get('score', 0)}/25")
            print(f"    Library Usage: {library_usage.get('score', 0)}/20")
            print(f"    Output Quality: {output_quality.get('score', 0)}/15")
            
            total_component = code_quality.get('score', 0) + library_usage.get('score', 0) + output_quality.get('score', 0)
            print(f"    Total Components: {total_component}/60")
            print(f"    Overall Score: {evaluation.get('overall_score', 0)}/100")
            
            # Update submission
            updated_submission = {
                "question_id": qid,
                "source_code": sub.get("source_code", ""),
                "outputs": sub.get("outputs", []),
                "submitted_at": sub.get("submitted_at"),
                "status": "evaluated",
                "ai_feedback": evaluation,
                "score": evaluation.get("overall_score", 0)
            }
            updated_submissions.append(updated_submission)
            
            print(f"\n  ✅ Re-evaluation complete!")
            print()
            
        except Exception as e:
            print(f"[ERROR] Failed to re-evaluate question {qid}: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    # Update database if we have updated submissions
    if updated_submissions:
        # Get all existing submissions
        all_submissions = submission.get("submissions", [])
        
        # Update the ones we re-evaluated
        submissions_dict = {str(s.get("question_id")): s for s in all_submissions}
        for updated in updated_submissions:
            submissions_dict[updated["question_id"]] = updated
        
        # Update in database
        await db.test_submissions.update_one(
            {"_id": submission["_id"]},
            {"$set": {
                "submissions": list(submissions_dict.values()),
                "ai_feedback_status": "completed"
            }}
        )
        
        print(f"[SUCCESS] Updated {len(updated_submissions)} submission(s) in database")
        print(f"[INFO] You can now view the updated scores in the analytics page")
    else:
        print(f"[WARNING] No submissions were updated")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage:")
        print("  python re_evaluate_submission.py <test_id> <user_id> [question_id]")
        print()
        print("Example:")
        print("  python re_evaluate_submission.py 698c6be92f3c27c6e8ad66d3 697b5e693272fc7bd19955c4")
        print("  python re_evaluate_submission.py 698c6be92f3c27c6e8ad66d3 697b5e693272fc7bd19955c4 698c6b922f3c27c6e8ad66d2")
        sys.exit(1)
    
    test_id = sys.argv[1]
    user_id = sys.argv[2]
    question_id = sys.argv[3] if len(sys.argv) > 3 else None
    
    asyncio.run(re_evaluate_submission(test_id, user_id, question_id))
