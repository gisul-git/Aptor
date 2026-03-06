"""Check candidates in database"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv("services/design-service/.env")

async def check():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db = client[os.getenv('MONGODB_DB_NAME')]
    
    # Get test
    test = await db.design_tests.find_one({"_id": "1772777232346239"})
    print("Test:", test.get("title") if test else "Not found")
    
    # Get candidates
    candidates = await db.design_candidates.find({"test_id": "1772777232346239"}).to_list(length=None)
    print(f"\nCandidates: {len(candidates)}")
    for c in candidates:
        print(f"  ID: {c.get('_id')}")
        print(f"  Name: {c.get('name')}")
        print(f"  Email: {c.get('email')}")
        print(f"  Has Submitted: {c.get('has_submitted')}")
        print()
    
    # Get submissions
    submissions = await db.design_submissions.find({}).to_list(length=None)
    print(f"Total Submissions: {len(submissions)}")
    for s in submissions:
        print(f"  User: {s.get('user_id')}")
        print(f"  Score: {s.get('final_score')}")
        print()
    
    client.close()

asyncio.run(check())
