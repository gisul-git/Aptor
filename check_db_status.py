"""Quick script to check database status"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv("services/design-service/.env")

async def check():
    client = AsyncIOMotorClient(os.getenv('MONGODB_URL'))
    db = client[os.getenv('MONGODB_DB_NAME')]
    
    sessions = await db.design_sessions.count_documents({})
    submissions = await db.design_submissions.count_documents({})
    events = await db.design_events.count_documents({})
    tests = await db.design_tests.count_documents({})
    questions = await db.design_questions.count_documents({})
    published_questions = await db.design_questions.count_documents({"is_published": True})
    published_tests = await db.design_tests.count_documents({"is_published": True})
    
    print("=" * 60)
    print("DATABASE STATUS")
    print("=" * 60)
    print(f"Questions: {questions} (Published: {published_questions})")
    print(f"Tests: {tests} (Published: {published_tests})")
    print(f"Sessions: {sessions}")
    print(f"Submissions: {submissions}")
    print(f"Events: {events}")
    print("=" * 60)
    
    # Get latest submission
    if submissions > 0:
        latest = await db.design_submissions.find_one(sort=[("created_at", -1)])
        print("\nLatest Submission:")
        print(f"  ID: {latest.get('_id')}")
        print(f"  User: {latest.get('user_id')}")
        print(f"  Score: {latest.get('final_score')}")
        print(f"  Created: {latest.get('created_at')}")
    
    client.close()

asyncio.run(check())
