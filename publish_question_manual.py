"""
Manually publish a question in the database
"""

import pymongo
from datetime import datetime
from bson import ObjectId

CLOUD_URI = "mongodb+srv://gisul2102_db_user:5cNJ1DcNCxwaJDaU@cluster0.dwcfp0l.mongodb.net/aptor_design_Competency?retryWrites=true&w=majority&appName=Cluster0"
CLOUD_DB = "aptor_design_Competency"

client = pymongo.MongoClient(CLOUD_URI)
db = client[CLOUD_DB]

# The E-Commerce question
question_id = "698dc4d0988067e56eb458ed"

print(f"Publishing question: {question_id}")

result = db['design_questions'].update_one(
    {'_id': ObjectId(question_id)},
    {'$set': {'is_published': True, 'updated_at': datetime.utcnow()}}
)

print(f"Matched: {result.matched_count}")
print(f"Modified: {result.modified_count}")

# Verify
question = db['design_questions'].find_one({'_id': ObjectId(question_id)})
if question:
    print(f"Question: {question.get('title')}")
    print(f"is_published: {question.get('is_published')}")
else:
    print("Question not found!")

client.close()
