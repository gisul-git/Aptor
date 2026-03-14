import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def check_events():
    # Connect to MongoDB
    mongo_uri = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_uri)
    db = client["aptor_design"]
    
    # Count events
    count = await db.advanced_events.count_documents({})
    print(f"✅ Total events in DB: {count}")
    
    # Get sample events
    if count > 0:
        events = await db.advanced_events.find().limit(5).to_list(5)
        print("\n📋 Sample Events:")
        for e in events:
            print(f"  - {e['event_type']} | Session: {e['session_id']} | Time: {e['timestamp']}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_events())
