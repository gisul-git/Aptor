"""
Debug script to check analytics API response for specific candidate
"""
import asyncio
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bson import ObjectId
from app.api.v1.aiml.database import get_aiml_database, connect_to_aiml_mongo


async def debug_analytics_api(test_id: str, candidate_email: str):
    """Debug analytics API response"""
    
    await connect_to_aiml_mongo()
    db = get_aiml_database()
    
    print("=" * 80)
    print("ANALYTICS API DEBUG")
    print("=" * 80)
    print()
    
    # Find candidate by email
    candidate = await db.test_candidates.find_one({
        "test_id": test_id,
        "email": candidate_email.lower()
    })
    
    if not candidate:
        print(f"[ERROR] Candidate not found: {candidate_email}")
        return
    
    user_id = candidate.get("user_id")
    print(f"Test ID: {test_id}")
    print(f"Candidate Email: {candidate_email}")
    print(f"User ID: {user_id}")
    print()
    
    # Get submission
    submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if not submission:
        print("[ERROR] Test submission not found")
        return
    
    print("SUBMISSION DATA:")
    print("-" * 80)
    submissions_list = submission.get("submissions", [])
    print(f"Number of question submissions: {len(submissions_list)}")
    print()
    
    # Get test to find question IDs
    test = await db.tests.find_one({"_id": ObjectId(test_id)})
    if not test:
        print("[ERROR] Test not found")
        return
    
    question_ids = test.get("question_ids", [])
    print(f"Question IDs in test: {len(question_ids)}")
    print()
    
    # Simulate the analytics endpoint logic
    valid_question_ids = [ObjectId(qid) for qid in question_ids if ObjectId.is_valid(qid)]
    questions_cursor = db.questions.find(
        {"_id": {"$in": valid_question_ids}},
        {"_id": 1, "title": 1, "description": 1, "tasks": 1, "difficulty": 1}
    )
    questions_list = await questions_cursor.to_list(length=len(valid_question_ids))
    questions_dict = {str(q["_id"]): q for q in questions_list}
    
    # Create submission lookup dict
    submissions_dict = {str(sub.get("question_id")): sub for sub in submissions_list if sub.get("question_id")}
    
    print("DEBUG INFO:")
    print(f"  Questions found: {len(questions_dict)}")
    print(f"  Question keys in dict: {list(questions_dict.keys())}")
    print(f"  Submissions found: {len(submissions_dict)}")
    print(f"  Submission keys: {list(submissions_dict.keys())}")
    print(f"  Question IDs in test (raw): {question_ids}")
    print(f"  Question IDs in test (str): {[str(qid) for qid in question_ids]}")
    print()
    
    print("QUESTION ANALYTICS (as returned by API):")
    print("-" * 80)
    
    question_analytics = []
    for qid in question_ids:
        qid_str = str(qid)
        print(f"\nProcessing question_id: {qid_str} (type: {type(qid)})")
        
        if not ObjectId.is_valid(qid_str):
            print(f"  [SKIP] Invalid ObjectId: {qid_str}")
            continue
        
        question = questions_dict.get(qid_str)
        if not question:
            print(f"  [SKIP] Question not found in questions_dict")
            print(f"    Available keys: {list(questions_dict.keys())}")
            continue
        
        print(f"  [OK] Question found: {question.get('title', 'N/A')}")
        
        question_submission = submissions_dict.get(qid_str)
        if question_submission:
            print(f"  [OK] Submission found")
        else:
            print(f"  [WARN] No submission found for this question")
        
        # Get AI feedback from submission if available
        ai_feedback = question_submission.get("ai_feedback") if question_submission else None
        question_score = question_submission.get("score", 0) if question_submission else 0
        
        qa_item = {
            "question_id": str(qid),
            "question_title": question.get("title", ""),
            "description": question.get("description", ""),
            "tasks": question.get("tasks", []),
            "difficulty": question.get("difficulty", "medium"),
            "language": "python3",
            "status": question_submission.get("status", "submitted") if question_submission else "not_submitted",
            "code": question_submission.get("source_code", "") if question_submission else "",
            "outputs": question_submission.get("outputs", []) if question_submission else [],
            "submitted_at": question_submission.get("submitted_at").isoformat() if question_submission and question_submission.get("submitted_at") else None,
            "created_at": question_submission.get("submitted_at").isoformat() if question_submission and question_submission.get("submitted_at") else None,
            "score": question_score,
            "ai_feedback": ai_feedback,
        }
        
        question_analytics.append(qa_item)
        
        print(f"\nQuestion: {qa_item['question_title']}")
        print(f"  question_id: {qa_item['question_id']}")
        print(f"  status: {qa_item['status']}")
        print(f"  code (type): {type(qa_item['code'])}")
        print(f"  code (value): {repr(qa_item['code'][:100]) if qa_item['code'] else 'None/Empty'}")
        print(f"  code (length): {len(qa_item['code']) if qa_item['code'] else 0}")
        print(f"  code (truthy?): {bool(qa_item['code'])}")
        print(f"  outputs (type): {type(qa_item['outputs'])}")
        print(f"  outputs (count): {len(qa_item['outputs']) if qa_item['outputs'] else 0}")
        print(f"  outputs (truthy?): {bool(qa_item['outputs'])}")
        print(f"  ai_feedback (present?): {bool(qa_item['ai_feedback'])}")
        print(f"  score: {qa_item['score']}")
        
        # Check database directly
        if question_submission:
            print(f"\n  DATABASE CHECK:")
            print(f"    source_code in DB: {bool(question_submission.get('source_code'))}")
            print(f"    source_code length: {len(question_submission.get('source_code', ''))}")
            print(f"    outputs in DB: {bool(question_submission.get('outputs'))}")
            print(f"    outputs count: {len(question_submission.get('outputs', []))}")
    
    print()
    print("=" * 80)
    print("JSON RESPONSE (first question only):")
    print("=" * 80)
    if question_analytics:
        print(json.dumps(question_analytics[0], indent=2, default=str))
    else:
        print("No question analytics found")
    
    print()
    print("=" * 80)
    print("ISSUE DIAGNOSIS:")
    print("=" * 80)
    
    if question_analytics:
        qa = question_analytics[0]
        if not qa.get('code'):
            print("[ISSUE] 'code' field is empty/None")
            first_qid = str(question_ids[0]) if question_ids else None
            if first_qid:
                db_sub = submissions_dict.get(first_qid, {})
                has_source_code = bool(db_sub.get('source_code'))
                print(f"   - Database has source_code: {has_source_code}")
            print("   - Mapping issue: source_code -> code")
        else:
            print("[OK] 'code' field has data")
        
        if not qa.get('outputs'):
            print("[ISSUE] 'outputs' field is empty/None")
            first_qid = str(question_ids[0]) if question_ids else None
            if first_qid:
                db_sub = submissions_dict.get(first_qid, {})
                has_outputs = bool(db_sub.get('outputs'))
                print(f"   - Database has outputs: {has_outputs}")
        else:
            print("[OK] 'outputs' field has data")
    else:
        print("[ISSUE] No question analytics returned")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python debug_analytics_api.py <test_id> <candidate_email>")
        print("Example: python debug_analytics_api.py 698c310b7ab64ff48afe4a8e nishan@gmail.com")
        sys.exit(1)
    
    test_id = sys.argv[1]
    candidate_email = sys.argv[2]
    asyncio.run(debug_analytics_api(test_id, candidate_email))
