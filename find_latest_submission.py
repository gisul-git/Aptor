from pymongo import MongoClient
from bson import ObjectId

client = MongoClient('mongodb://localhost:27017/')
db = client['aptor_design']

submission_id = "698aee2900a53da08bb20fb"

print(f"\n🔍 Looking for submission: {submission_id}\n")

try:
    # Try to find by ObjectId
    submission = db.design_submissions.find_one({"_id": ObjectId(submission_id)})
    
    if submission:
        print("✅ FOUND SUBMISSION!\n")
        print(f"Session ID: {submission.get('session_id')}")
        print(f"User ID: {submission.get('user_id')}")
        print(f"Question ID: {submission.get('question_id')}")
        print(f"Final Score: {submission.get('final_score')}/100")
    else:
        print("❌ Submission not found in design_submissions!")
        
        # Check all collections
        print("\n📊 Checking all collections:")
        print(f"   design_sessions: {db.design_sessions.count_documents({})}")
        print(f"   screenshots: {db.screenshots.count_documents({})}")
        print(f"   events: {db.events.count_documents({})}")
        print(f"   design_submissions: {db.design_submissions.count_documents({})}")
        
        # List all collection names
        print("\n📋 All collections in aptor_design:")
        for name in db.list_collection_names():
            count = db[name].count_documents({})
            print(f"   - {name}: {count} documents")
        
except Exception as e:
    print(f"Error: {e}")
