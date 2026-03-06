"""
Test the publish endpoint
"""

import requests
import pymongo

CLOUD_URI = "mongodb+srv://gisul2102_db_user:5cNJ1DcNCxwaJDaU@cluster0.dwcfp0l.mongodb.net/aptor_design_Competency?retryWrites=true&w=majority&appName=Cluster0"
CLOUD_DB = "aptor_design_Competency"
API_URL = "http://localhost:3006/api/v1/design"

# Get a question to test
client = pymongo.MongoClient(CLOUD_URI)
db = client[CLOUD_DB]

question = db['design_questions'].find_one({'is_published': False})

if not question:
    print("No unpublished questions found to test")
    client.close()
    exit()

question_id = str(question['_id'])
print(f"Testing with question: {question.get('title')}")
print(f"Question ID: {question_id}")
print(f"Current status: is_published={question.get('is_published')}")
print()

# Test publishing
print("Testing PUBLISH...")
response = requests.patch(
    f"{API_URL}/questions/{question_id}/publish",
    json={"is_published": True}
)

print(f"Status Code: {response.status_code}")
print(f"Response: {response.json()}")
print()

# Verify in database
updated_question = db['design_questions'].find_one({'_id': question['_id']})
print(f"Database status: is_published={updated_question.get('is_published')}")
print()

# Test unpublishing
print("Testing UNPUBLISH...")
response = requests.patch(
    f"{API_URL}/questions/{question_id}/publish",
    json={"is_published": False}
)

print(f"Status Code: {response.status_code}")
print(f"Response: {response.json()}")
print()

# Verify in database
updated_question = db['design_questions'].find_one({'_id': question['_id']})
print(f"Database status: is_published={updated_question.get('is_published')}")

client.close()
