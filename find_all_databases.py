"""
Find all MongoDB databases and search for your submissions
"""

import pymongo
import json

MONGO_URI = "mongodb://localhost:27017/"

client = pymongo.MongoClient(MONGO_URI)

print("=" * 80)
print("SEARCHING ALL DATABASES FOR YOUR SUBMISSIONS")
print("=" * 80)
print()

# List all databases
db_names = client.list_database_names()
print(f"📊 Found {len(db_names)} databases:")
for db_name in db_names:
    print(f"   - {db_name}")
print()

# Search for your question ID in all databases
question_id = "69a53010cd0a4e95d541c2a6"
user_ids = ["candidate-1772433471064", "candidate-1772433475001", "candidate-1772433479010"]

print(f"🔍 Searching for question ID: {question_id}")
print(f"🔍 Searching for user IDs: {', '.join(user_ids)}")
print()

found = False

for db_name in db_names:
    if db_name in ['admin', 'config', 'local']:
        continue
    
    db = client[db_name]
    collections = db.list_collection_names()
    
    # Check for submissions
    for coll_name in collections:
        if 'submission' in coll_name.lower():
            coll = db[coll_name]
            
            # Search by question_id
            submissions = list(coll.find({'question_id': question_id}))
            
            if submissions:
                found = True
                print(f"✅ FOUND IN: {db_name}.{coll_name}")
                print(f"   Total submissions: {len(submissions)}")
                print()
                
                for i, sub in enumerate(submissions, 1):
                    print(f"   Submission {i}:")
                    print(f"      _id: {sub.get('_id')}")
                    print(f"      user_id: {sub.get('user_id')}")
                    print(f"      question_id: {sub.get('question_id')}")
                    print(f"      session_id: {sub.get('session_id')}")
                    print(f"      score: {sub.get('final_score')}/100")
                    print(f"      submitted_at: {sub.get('submitted_at')}")
                    print()
                
                # Now find the test_id
                print("   🔍 Looking for test_id...")
                
                # Check session
                session_id = submissions[0].get('session_id')
                if session_id:
                    sessions_coll = db.get_collection('design_sessions') if 'design_sessions' in collections else None
                    if sessions_coll:
                        session = sessions_coll.find_one({'_id': session_id})
                        if session:
                            print(f"   ✅ Found session: {session_id}")
                            if 'test_id' in session:
                                test_id = session['test_id']
                                print(f"   ✅ Test ID: {test_id}")
                                print()
                                print(f"   🎯 YOUR ANALYTICS URL:")
                                print(f"      http://localhost:3002/design/tests/{test_id}/analytics")
                                print()
                            else:
                                print(f"   ⚠️  Session found but no test_id field")
                                print(f"   Session data: {json.dumps(session, indent=6, default=str)}")
                                print()
                
                # Check candidates
                candidates_coll = db.get_collection('design_candidates') if 'design_candidates' in collections else None
                if candidates_coll:
                    for user_id in user_ids:
                        candidate = candidates_coll.find_one({'user_id': user_id})
                        if candidate:
                            print(f"   ✅ Found candidate: {user_id}")
                            if 'test_id' in candidate:
                                test_id = candidate['test_id']
                                print(f"   ✅ Test ID: {test_id}")
                                print()
                                print(f"   🎯 YOUR ANALYTICS URL:")
                                print(f"      http://localhost:3002/design/tests/{test_id}/analytics")
                                print()
                                break

if not found:
    print("❌ No submissions found in any database")
    print()
    print("💡 This could mean:")
    print("   1. MongoDB is not running")
    print("   2. Data was cleared")
    print("   3. Wrong MongoDB connection string")
    print("   4. Data is in a different MongoDB instance")

client.close()
