"""
Check question ID format
"""

import pymongo
from bson import ObjectId

CLOUD_URI = "mongodb+srv://gisul2102_db_user:5cNJ1DcNCxwaJDaU@cluster0.dwcfp0l.mongodb.net/aptor_design_Competency?retryWrites=true&w=majority&appName=Cluster0"
CLOUD_DB = "aptor_design_Competency"

client = pymongo.MongoClient(CLOUD_URI)
db = client[CLOUD_DB]

questions = list(db['design_questions'].find().limit(5))

print("Sample question IDs:")
print()

for q in questions:
    _id = q['_id']
    print(f"Title: {q.get('title', 'Unknown')}")
    print(f"_id: {_id}")
    print(f"Type: {type(_id)}")
    print(f"Is ObjectId: {isinstance(_id, ObjectId)}")
    
    # Try to convert to string and back
    id_str = str(_id)
    print(f"String: {id_str}")
    
    try:
        back_to_objectid = ObjectId(id_str)
        print(f"Can convert back: Yes")
        
        # Try to find with this ID
        found = db['design_questions'].find_one({'_id': back_to_objectid})
        print(f"Can find in DB: {'Yes' if found else 'No'}")
    except Exception as e:
        print(f"Can convert back: No - {e}")
    
    print()

client.close()
