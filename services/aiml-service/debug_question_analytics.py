"""
Debug why question_analytics is empty
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bson import ObjectId
from app.api.v1.aiml.database import get_aiml_database, connect_to_aiml_mongo


async def debug_question_analytics(test_id: str, user_id: str):
    """Debug question_analytics population"""
    
    await connect_to_aiml_mongo()
    db = get_aiml_database()
    
    print("=" * 80)
    print("DEBUG: question_analytics EMPTY ARRAY ISSUE")
    print("=" * 80)
    print()
    
    # Get test
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        print("[ERROR] Test not found")
        return
    
    question_ids = test.get("question_ids", [])
    print(f"Test Question IDs: {question_ids}")
    print(f"Question IDs type: {[type(qid) for qid in question_ids]}")
    print()
    
    # Get submission
    submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if not submission:
        print("[ERROR] Submission not found")
        return
    
    submissions_list = submission.get("submissions", [])
    print(f"Submissions array length: {len(submissions_list)}")
    print()
    
    # Check submissions structure
    for idx, sub in enumerate(submissions_list):
        print(f"Submission {idx + 1}:")
        print(f"  question_id: {sub.get('question_id')} (type: {type(sub.get('question_id'))})")
        print(f"  question_id as string: {str(sub.get('question_id'))}")
        print(f"  has source_code: {bool(sub.get('source_code'))}")
        print(f"  has outputs: {bool(sub.get('outputs'))}")
        print(f"  has ai_feedback: {bool(sub.get('ai_feedback'))}")
        print()
    
    # Create submissions_dict
    submissions_dict = {str(sub.get("question_id")): sub for sub in submissions_list if sub.get("question_id")}
    print(f"Submissions dict keys: {list(submissions_dict.keys())}")
    print()
    
    # Get questions
    valid_question_ids = [ObjectId(qid) for qid in question_ids if ObjectId.is_valid(qid)]
    questions_cursor = db.questions.find(
        {"_id": {"$in": valid_question_ids}},
        {"_id": 1, "title": 1, "description": 1, "tasks": 1, "difficulty": 1}
    )
    questions_list = await questions_cursor.to_list(length=len(valid_question_ids))
    questions_dict = {str(q["_id"]): q for q in questions_list}
    
    print(f"Questions dict keys: {list(questions_dict.keys())}")
    print()
    
    # Simulate the loop
    print("SIMULATING question_analytics BUILD:")
    print("-" * 80)
    
    question_analytics = []
    for qid in question_ids:
        if not ObjectId.is_valid(qid):
            print(f"[SKIP] Invalid ObjectId: {qid}")
            continue
        
        qid_str = str(qid)
        print(f"\nProcessing question_id: {qid_str}")
        
        question = questions_dict.get(qid_str)
        if not question:
            print(f"  [FAIL] Question not found in questions_dict")
            print(f"    Available keys: {list(questions_dict.keys())}")
            continue
        
        print(f"  [OK] Question found: {question.get('title', 'N/A')}")
        
        question_submission = submissions_dict.get(qid_str)
        if not question_submission:
            print(f"  [FAIL] Submission not found in submissions_dict")
            print(f"    Available keys: {list(submissions_dict.keys())}")
            print(f"    Looking for: {qid_str}")
            continue
        
        print(f"  [OK] Submission found!")
        print(f"    source_code length: {len(question_submission.get('source_code', ''))}")
        print(f"    outputs count: {len(question_submission.get('outputs', []))}")
        
        question_analytics.append({
            "question_id": qid_str,
            "question_title": question.get("title", ""),
            "code": question_submission.get("source_code", ""),
            "outputs": question_submission.get("outputs", []),
            "ai_feedback": question_submission.get("ai_feedback"),
        })
    
    print()
    print(f"Result: question_analytics length = {len(question_analytics)}")
    if question_analytics:
        print(f"First item code length: {len(question_analytics[0].get('code', ''))}")
        print(f"First item outputs count: {len(question_analytics[0].get('outputs', []))}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python debug_question_analytics.py <test_id> <user_id>")
        print("Example: python debug_question_analytics.py 698c310b7ab64ff48afe4a8e 697b5e693272fc7bd19955c4")
        sys.exit(1)
    
    test_id = sys.argv[1]
    user_id = sys.argv[2]
    asyncio.run(debug_question_analytics(test_id, user_id))
