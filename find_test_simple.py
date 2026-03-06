"""
Simple script to find test ID
"""

import pymongo
import json

MONGO_URI = "mongodb://localhost:27017/"

client = pymongo.MongoClient(MONGO_URI)
db = client['aptor_design_Competency']

print("CHECKING COLLECTIONS...")
print()

# Check what collections exist
collections = db.list_collection_names()
print(f"Collections: {collections}")
print()

# Check submissions
print("SUBMISSIONS:")
submissions = list(db['design_submissions'].find())
print(f"Total: {len(submissions)}")
if submissions:
    print(json.dumps(submissions[0], indent=2, default=str))
print()

# Check sessions
print("SESSIONS:")
sessions = list(db['design_sessions'].find())
print(f"Total: {len(sessions)}")
if sessions:
    print(json.dumps(sessions[0], indent=2, default=str))
print()

# Check candidates
print("CANDIDATES:")
candidates = list(db['design_candidates'].find())
print(f"Total: {len(candidates)}")
if candidates:
    print(json.dumps(candidates[0], indent=2, default=str))
print()

# Check questions
print("QUESTIONS:")
questions = list(db['design_questions'].find())
print(f"Total: {len(questions)}")
if questions:
    print(json.dumps(questions[0], indent=2, default=str))

client.close()
