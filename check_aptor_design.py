"""
Check aptor_design database specifically
"""

import pymongo
import json

MONGO_URI = "mongodb://localhost:27017/"

client = pymongo.MongoClient(MONGO_URI)
db = client['aptor_design']

print("=" * 80)
print("CHECKING aptor_design DATABASE")
print("=" * 80)
print()

collections = db.list_collection_names()
print(f"Collections: {collections}")
print()

for coll_name in collections:
    coll = db[coll_name]
    count = coll.count_documents({})
    print(f"📦 {coll_name}: {count} documents")
    
    if count > 0 and count < 20:
        print(f"   Sample documents:")
        docs = list(coll.find().limit(3))
        for doc in docs:
            print(f"   {json.dumps(doc, indent=6, default=str)}")
    print()

# Specifically search for your data
print("=" * 80)
print("SEARCHING FOR YOUR SUBMISSIONS")
print("=" * 80)
print()

question_id = "69a53010cd0a4e95d541c2a6"

# Check all collections for this question_id
for coll_name in collections:
    coll = db[coll_name]
    docs = list(coll.find({'question_id': question_id}))
    
    if docs:
        print(f"✅ Found in {coll_name}:")
        for doc in docs:
            print(json.dumps(doc, indent=3, default=str))
        print()

client.close()
