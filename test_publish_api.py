import requests
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv("services/design-service/.env")

async def get_question_id():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client[os.getenv("MONGODB_DB_NAME")]
    q = await db.design_questions.find_one({})
    client.close()
    return str(q["_id"]) if q else None

# Get a question ID
question_id = asyncio.run(get_question_id())
print(f"Testing with question ID: {question_id}")

# Test publish API
url = f"http://localhost:3007/api/v1/design/questions/{question_id}/publish"
print(f"\nTesting: PATCH {url}?is_published=true")

response = requests.patch(url, params={"is_published": True})

print(f"\nStatus Code: {response.status_code}")
print(f"Response: {response.text}")

if response.status_code == 200:
    print("\n✅ Publish API is working!")
else:
    print("\n❌ Publish API failed!")
