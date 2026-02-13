"""
Check what submission data exists in database
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bson import ObjectId
from app.api.v1.aiml.database import get_aiml_database, connect_to_aiml_mongo


async def check_submission_data(test_id: str):
    """Check what data is stored in test_submissions"""
    
    await connect_to_aiml_mongo()
    db = get_aiml_database()
    
    print("=" * 80)
    print("DATABASE SUBMISSION DATA CHECK")
    print("=" * 80)
    print()
    
    # Get test submission
    submission = await db.test_submissions.find_one({"test_id": test_id})
    if not submission:
        print(f"[ERROR] Test submission not found for test_id: {test_id}")
        return
    
    print(f"Test ID: {test_id}")
    print(f"User ID: {submission.get('user_id')}")
    print()
    
    # Check submissions array
    submissions_list = submission.get("submissions", [])
    print(f"Number of question submissions: {len(submissions_list)}")
    print()
    
    for idx, q_sub in enumerate(submissions_list):
        print(f"Question Submission {idx + 1}:")
        print(f"  Question ID: {q_sub.get('question_id')}")
        print(f"  Status: {q_sub.get('status', 'unknown')}")
        print(f"  Has source_code: {bool(q_sub.get('source_code'))}")
        print(f"  source_code length: {len(q_sub.get('source_code', ''))}")
        print(f"  Has outputs: {bool(q_sub.get('outputs'))}")
        print(f"  outputs count: {len(q_sub.get('outputs', []))}")
        print(f"  Has ai_feedback: {bool(q_sub.get('ai_feedback'))}")
        print(f"  Score: {q_sub.get('score', 0)}")
        print()
        
        # Show first 200 chars of source_code if exists
        if q_sub.get('source_code'):
            print(f"  source_code preview: {q_sub.get('source_code')[:200]}...")
            print()
        
        # Show outputs if exist
        if q_sub.get('outputs'):
            print(f"  outputs:")
            for i, output in enumerate(q_sub.get('outputs', [])[:3]):  # Show first 3
                print(f"    Output {i+1}: {output[:100]}...")
            print()
    
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total submissions: {len(submissions_list)}")
    submissions_with_code = sum(1 for s in submissions_list if s.get('source_code'))
    submissions_with_outputs = sum(1 for s in submissions_list if s.get('outputs'))
    print(f"Submissions with source_code: {submissions_with_code}/{len(submissions_list)}")
    print(f"Submissions with outputs: {submissions_with_outputs}/{len(submissions_list)}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_submission_data.py <test_id>")
        print("Example: python check_submission_data.py 698c310b7ab64ff48afe4a8e")
        sys.exit(1)
    
    test_id = sys.argv[1]
    asyncio.run(check_submission_data(test_id))
