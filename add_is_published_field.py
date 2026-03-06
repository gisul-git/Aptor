import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv("services/design-service/.env")

async def add_is_published_field():
    mongo_uri = os.getenv("MONGODB_URL")
    db_name = os.getenv("MONGODB_DB_NAME")
    
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    
    # Check current status
    total = await db.design_questions.count_documents({})
    with_field = await db.design_questions.count_documents({"is_published": {"$exists": True}})
    without_field = total - with_field
    
    print(f"Total questions: {total}")
    print(f"With is_published field: {with_field}")
    print(f"Without is_published field: {without_field}")
    
    if without_field > 0:
        print(f"\nAdding is_published field to {without_field} questions...")
        result = await db.design_questions.update_many(
            {"is_published": {"$exists": False}},
            {"$set": {"is_published": False}}
        )
        print(f"✅ Updated {result.modified_count} questions")
    else:
        print("\n✅ All questions already have is_published field")
    
    # Verify
    sample = await db.design_questions.find_one({})
    if sample:
        print(f"\nSample question fields: {list(sample.keys())}")
        print(f"is_published value: {sample.get('is_published', 'NOT FOUND')}")
    
    client.close()

asyncio.run(add_is_published_field())
