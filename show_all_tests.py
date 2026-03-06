"""
Show all design tests
"""

import pymongo

MONGO_URI = "mongodb://localhost:27017/"

client = pymongo.MongoClient(MONGO_URI)
db = client['aptor_design']

print("=" * 80)
print("ALL DESIGN TESTS")
print("=" * 80)
print()

tests = list(db['design_tests'].find())

for i, test in enumerate(tests, 1):
    test_id = test.get('_id')
    print(f"{i}. Test ID: {test_id}")
    print(f"   Title: {test.get('title')}")
    print(f"   Description: {test.get('description')}")
    print(f"   Question IDs: {test.get('question_ids', [])}")
    print(f"   Duration: {test.get('duration_minutes')} minutes")
    print(f"   Active: {test.get('is_active')}")
    print(f"   Created: {test.get('created_at')}")
    print()
    
    # Check if there are candidates
    candidates = list(db['design_candidates'].find({'test_id': test_id}))
    print(f"   Candidates: {len(candidates)}")
    
    if candidates:
        for cand in candidates:
            print(f"      - {cand.get('name')} ({cand.get('email')})")
            if cand.get('has_submitted'):
                print(f"        ✅ Submitted - Score: {cand.get('submission_score')}")
    
    print()
    print(f"   📊 Analytics URL: http://localhost:3002/design/tests/{test_id}/analytics")
    print(f"   ⚙️  Manage URL: http://localhost:3002/design/tests/{test_id}/manage")
    print()
    print("-" * 80)
    print()

client.close()
