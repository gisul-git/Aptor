"""
Check and update questions to have is_published field
"""

import pymongo

CLOUD_URI = "mongodb+srv://gisul2102_db_user:5cNJ1DcNCxwaJDaU@cluster0.dwcfp0l.mongodb.net/aptor_design_Competency?retryWrites=true&w=majority&appName=Cluster0"
CLOUD_DB = "aptor_design_Competency"

client = pymongo.MongoClient(CLOUD_URI)
db = client[CLOUD_DB]

print("Checking questions for is_published field...")
print()

questions = list(db['design_questions'].find())

print(f"Total questions: {len(questions)}")
print()

# Check which questions don't have is_published field
questions_without_field = []
for q in questions:
    if 'is_published' not in q:
        questions_without_field.append(q['_id'])
        print(f"Question '{q.get('title', 'Unknown')}' (ID: {q['_id']}) - Missing is_published field")

if questions_without_field:
    print()
    print(f"Found {len(questions_without_field)} questions without is_published field")
    print("Setting is_published=false for these questions...")
    
    result = db['design_questions'].update_many(
        {'_id': {'$in': questions_without_field}},
        {'$set': {'is_published': False}}
    )
    
    print(f"Updated {result.modified_count} questions")
else:
    print("All questions have is_published field!")

print()
print("Current status:")
published_count = db['design_questions'].count_documents({'is_published': True})
unpublished_count = db['design_questions'].count_documents({'is_published': False})

print(f"Published: {published_count}")
print(f"Unpublished: {unpublished_count}")

client.close()
