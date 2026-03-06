"""
Find Test ID for Question ID
"""

import pymongo

# MongoDB connection
MONGO_URI = "mongodb://localhost:27017/"

def find_test_for_question():
    """Find which test contains the question ID"""
    try:
        client = pymongo.MongoClient(MONGO_URI)
        db = client['aptor_design_Competency']
        
        # The question ID from your submissions
        question_id = "69a53010cd0a4e95d541c2a6"
        
        print(f"🔍 Looking for test containing question: {question_id}")
        print()
        
        # Check design_questions collection
        questions_coll = db['design_questions']
        question = questions_coll.find_one({'_id': question_id})
        
        if question:
            print("✅ Found Question:")
            print(f"   Title: {question.get('title', 'N/A')}")
            print(f"   Description: {question.get('description', 'N/A')[:100]}...")
            print()
        
        # Check design_candidates collection to find test_id
        candidates_coll = db['design_candidates']
        candidate = candidates_coll.find_one({'question_id': question_id})
        
        if candidate:
            test_id = candidate.get('test_id')
            print("✅ Found Test ID:")
            print(f"   Test ID: {test_id}")
            print(f"   Candidate: {candidate.get('name', 'N/A')}")
            print(f"   Email: {candidate.get('email', 'N/A')}")
            print()
            
            # Get all candidates for this test
            all_candidates = list(candidates_coll.find({'test_id': test_id}))
            print(f"📊 Total Candidates in Test: {len(all_candidates)}")
            print()
            
            # Check submissions
            submissions_coll = db['design_submissions']
            submissions = list(submissions_coll.find({'question_id': question_id}))
            
            print(f"📝 Submissions Found: {len(submissions)}")
            print()
            
            for i, sub in enumerate(submissions, 1):
                print(f"   Submission {i}:")
                print(f"      User ID: {sub.get('user_id')}")
                print(f"      Score: {sub.get('final_score')}/100")
                print(f"      Submitted: {sub.get('submitted_at')}")
                print()
            
            # Generate analytics URL
            analytics_url = f"http://localhost:3002/design/tests/{test_id}/analytics"
            print("🎯 YOUR ANALYTICS URL:")
            print(f"   {analytics_url}")
            print()
            print("👉 Open this URL in your browser to see all results!")
            
        else:
            print("❌ No test found for this question")
            print("   This might mean the test was deleted or the question is orphaned")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    find_test_for_question()
