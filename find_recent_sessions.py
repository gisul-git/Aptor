"""
Find recent sessions and their test IDs
"""

import pymongo
from datetime import datetime, timedelta

MONGO_URI = "mongodb://localhost:27017/"

client = pymongo.MongoClient(MONGO_URI)
db = client['aptor_design']

print("=" * 80)
print("RECENT DESIGN SESSIONS (Last 7 days)")
print("=" * 80)
print()

# Get sessions from last 7 days
sessions = list(db['design_sessions'].find().sort('created_at', -1).limit(30))

print(f"Found {len(sessions)} recent sessions")
print()

for i, session in enumerate(sessions, 1):
    print(f"{i}. Session ID: {session.get('_id')}")
    print(f"   Question ID: {session.get('question_id')}")
    print(f"   User ID: {session.get('user_id')}")
    print(f"   Test ID: {session.get('test_id', 'N/A')}")
    print(f"   Status: {session.get('status')}")
    print(f"   Created: {session.get('created_at')}")
    
    # Get question details
    question_id = session.get('question_id')
    if question_id:
        question = db['design_questions'].find_one({'_id': question_id})
        if question:
            print(f"   Question: {question.get('title', 'N/A')}")
    
    # Check if there's a submission
    submission = db['design_submissions'].find_one({'session_id': session.get('_id')})
    if submission:
        print(f"   ✅ Submitted - Score: {submission.get('final_score')}/100")
    
    print()

# Now find test IDs
print("=" * 80)
print("FINDING YOUR TEST")
print("=" * 80)
print()

# Look for sessions with your user IDs or recent submissions
user_ids = ["candidate-1772433471064", "candidate-1772433475001", "candidate-1772433479010"]

for user_id in user_ids:
    session = db['design_sessions'].find_one({'user_id': user_id})
    if session:
        test_id = session.get('test_id')
        print(f"✅ Found your session!")
        print(f"   User ID: {user_id}")
        print(f"   Test ID: {test_id}")
        print()
        print(f"🎯 YOUR ANALYTICS URL:")
        print(f"   http://localhost:3002/design/tests/{test_id}/analytics")
        print()
        break

client.close()
