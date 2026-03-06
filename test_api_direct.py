"""
Test API directly with MongoDB query
"""

import pymongo
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

CLOUD_URI = "mongodb+srv://gisul2102_db_user:5cNJ1DcNCxwaJDaU@cluster0.dwcfp0l.mongodb.net/aptor_design_Competency?retryWrites=true&w=majority&appName=Cluster0"
CLOUD_DB = "aptor_design_Competency"

async def test_query():
    client = AsyncIOMotorClient(CLOUD_URI)
    db = client[CLOUD_DB]
    
    print("Testing MongoDB query...")
    print()
    
    # Test the exact query from the API
    tests = await db.design_tests.find(
        {"is_active": True}
    ).sort("created_at", -1).limit(50).to_list(length=None)
    
    print(f"Found {len(tests)} tests with is_active=True")
    print()
    
    for test in tests:
        print(f"- {test.get('title')} (ID: {test.get('_id')})")
    
    client.close()

asyncio.run(test_query())
