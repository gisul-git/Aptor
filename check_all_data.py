from pymongo import MongoClient
import sys

# Connect to Docker MongoDB (same as backend)
# If you're running this script locally, MongoDB is exposed on localhost:27017
# but the data is in the Docker container's MongoDB
try:
    client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=5000)
    # Test connection
    client.server_info()
    db = client['aptor_design']
    print("✅ Connected to MongoDB at localhost:27017")
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")
    sys.exit(1)

print("\n" + "="*80)
print("📊 MONGODB DATA CHECK")
print("="*80 + "\n")

# Check sessions
sessions = list(db.design_sessions.find())
print(f"✅ design_sessions: {len(sessions)} documents")
if sessions:
    for i, s in enumerate(sessions[:3], 1):
        print(f"   {i}. session_id: {s.get('session_id')}, user: {s.get('user_id')}, question: {s.get('question_id')}")

# Check screenshots
screenshots = list(db.screenshots.find())
print(f"\n✅ screenshots: {len(screenshots)} documents")
if screenshots:
    for i, s in enumerate(screenshots[:3], 1):
        print(f"   {i}. session_id: {s.get('session_id')}, timestamp: {s.get('timestamp')}")

# Check events
events = list(db.events.find())
print(f"\n✅ events: {len(events)} documents")
if events:
    for i, e in enumerate(events[:3], 1):
        print(f"   {i}. session_id: {e.get('session_id')}, type: {e.get('type')}")

# Check submissions
submissions = list(db.design_submissions.find())
print(f"\n✅ design_submissions: {len(submissions)} documents")
if submissions:
    for i, sub in enumerate(submissions[:3], 1):
        print(f"   {i}. session_id: {sub.get('session_id')}, score: {sub.get('final_score')}")

print("\n" + "="*80 + "\n")
