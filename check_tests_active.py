"""
Check if tests have is_active field
"""

import pymongo

CLOUD_URI = "mongodb+srv://gisul2102_db_user:5cNJ1DcNCxwaJDaU@cluster0.dwcfp0l.mongodb.net/aptor_design_Competency?retryWrites=true&w=majority&appName=Cluster0"
CLOUD_DB = "aptor_design_Competency"

client = pymongo.MongoClient(CLOUD_URI)
db = client[CLOUD_DB]

print("Checking tests...")
print()

tests = list(db['design_tests'].find())

for test in tests:
    print(f"Test ID: {test.get('_id')}")
    print(f"Title: {test.get('title')}")
    print(f"is_active: {test.get('is_active')}")
    print()

# Update all tests to be active
print("Updating all tests to is_active=true...")
result = db['design_tests'].update_many({}, {"$set": {"is_active": True}})
print(f"Updated {result.modified_count} tests")

client.close()
