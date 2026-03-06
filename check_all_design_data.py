"""
Check All Design Data to Find Your Test
"""

import pymongo
from datetime import datetime

# MongoDB connection
MONGO_URI = "mongodb://localhost:27017/"

def check_all_data():
    """Check all collections to understand the data structure"""
    try:
        client = pymongo.MongoClient(MONGO_URI)
        db = client['aptor_design_Competency']
        
        print("=" * 80)
        print("DESIGN COMPETENCY DATABASE OVERVIEW")
        print("=" * 80)
        print()
        
        # 1. Check design_questions
        print("📋 DESIGN QUESTIONS:")
        print("-" * 80)
        questions_coll = db['design_questions']
        questions = list(questions_coll.find())
        
        for q in questions:
            print(f"   Question ID: {q.get('_id')}")
            print(f"   Title: {q.get('title', 'N/A')}")
            print(f"   Created: {q.get('created_at', 'N/A')}")
            print()
        
        # 2. Check design_candidates
        print("👥 DESIGN CANDIDATES:")
        print("-" * 80)
        candidates_coll = db['design_candidates']
        candidates = list(candidates_coll.find())
        
        if candidates:
            for c in candidates:
                print(f"   Candidate ID: {c.get('_id')}")
                print(f"   Name: {c.get('name', 'N/A')}")
                print(f"   Email: {c.get('email', 'N/A')}")
                print(f"   Test ID: {c.get('test_id', 'N/A')}")
                print(f"   Question ID: {c.get('question_id', 'N/A')}")
                print(f"   Status: {c.get('status', 'N/A')}")
                print()
        else:
            print("   ⚠️  No candidates found")
            print()
        
        # 3. Check design_submissions
        print("📝 DESIGN SUBMISSIONS:")
        print("-" * 80)
        submissions_coll = db['design_submissions']
        submissions = list(submissions_coll.find())
        
        for i, s in enumerate(submissions, 1):
            print(f"   Submission {i}:")
            print(f"      ID: {s.get('_id')}")
            print(f"      User ID: {s.get('user_id')}")
            print(f"      Question ID: {s.get('question_id')}")
            print(f"      Session ID: {s.get('session_id')}")
            print(f"      Score: {s.get('final_score')}/100")
            print(f"      Submitted: {s.get('submitted_at')}")
            print()
        
        # 4. Check design_sessions
        print("🔐 DESIGN SESSIONS:")
        print("-" * 80)
        sessions_coll = db['design_sessions']
        sessions = list(sessions_coll.find())
        
        if sessions:
            for sess in sessions:
                print(f"   Session ID: {sess.get('_id')}")
                print(f"   Question ID: {sess.get('question_id', 'N/A')}")
                print(f"   User ID: {sess.get('user_id', 'N/A')}")
                print(f"   Status: {sess.get('status', 'N/A')}")
                print(f"   Created: {sess.get('created_at', 'N/A')}")
                print()
        else:
            print("   ⚠️  No sessions found")
            print()
        
        # 5. Check for tests collection
        print("🧪 DESIGN TESTS:")
        print("-" * 80)
        collections = db.list_collection_names()
        
        if 'design_tests' in collections:
            tests_coll = db['design_tests']
            tests = list(tests_coll.find())
            
            if tests:
                for t in tests:
                    print(f"   Test ID: {t.get('_id')}")
                    print(f"   Title: {t.get('title', 'N/A')}")
                    print(f"   Question ID: {t.get('question_id', 'N/A')}")
                    print(f"   Status: {t.get('status', 'N/A')}")
                    print()
            else:
                print("   ⚠️  No tests found")
                print()
        else:
            print("   ⚠️  'design_tests' collection doesn't exist")
            print()
        
        # 6. List all collections
        print("📦 ALL COLLECTIONS:")
        print("-" * 80)
        for coll_name in collections:
            count = db[coll_name].count_documents({})
            print(f"   {coll_name}: {count} documents")
        print()
        
        print("=" * 80)
        print("ANALYSIS:")
        print("=" * 80)
        
        # Find the connection
        question_id = "69a53010cd0a4e95d541c2a6"
        
        # Check if session has the link
        session = sessions_coll.find_one({'question_id': question_id})
        if session:
            print(f"✅ Found session for question {question_id}")
            print(f"   Session ID: {session.get('_id')}")
            
            # Try to find test_id in session
            if 'test_id' in session:
                test_id = session['test_id']
                print(f"   Test ID: {test_id}")
                print()
                print(f"🎯 YOUR ANALYTICS URL:")
                print(f"   http://localhost:3002/design/tests/{test_id}/analytics")
            else:
                print("   ⚠️  Session doesn't have test_id field")
        else:
            print(f"❌ No session found for question {question_id}")
            print()
            print("💡 POSSIBLE REASONS:")
            print("   1. Test was created without proper test_id linking")
            print("   2. Data structure mismatch between frontend and backend")
            print("   3. Test might be using a different identifier")
        
        print()
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_all_data()
