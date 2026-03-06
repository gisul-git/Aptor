"""
Final Verification Script for Design Competency Publish Feature
Tests:
1. Cloud database connection
2. Backend API endpoint
3. Publish/Unpublish functionality
4. Data persistence
"""

import asyncio
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv
import os

load_dotenv("services/design-service/.env")

async def verify_all():
    print("=" * 60)
    print("DESIGN COMPETENCY - FINAL VERIFICATION")
    print("=" * 60)
    
    # 1. Verify Cloud Database Connection
    print("\n[1/5] Verifying Cloud Database Connection...")
    mongo_uri = os.getenv("MONGODB_URL")
    db_name = os.getenv("MONGODB_DB_NAME")
    
    if not mongo_uri or not db_name:
        print("   ERROR: Database configuration missing!")
        return False
    
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    
    try:
        collections = await db.list_collection_names()
        question_count = await db.design_questions.count_documents({})
        print(f"   SUCCESS: Connected to {db_name}")
        print(f"   Collections: {len(collections)}")
        print(f"   Questions: {question_count}")
    except Exception as e:
        print(f"   ERROR: {e}")
        return False
    
    # 2. Get a test question
    print("\n[2/5] Getting test question...")
    question = await db.design_questions.find_one({})
    if not question:
        print("   ERROR: No questions found!")
        return False
    
    question_id = str(question["_id"])
    initial_status = question.get("is_published", False)
    print(f"   Question ID: {question_id}")
    print(f"   Title: {question.get('title', 'N/A')}")
    print(f"   Initial Status: {initial_status}")
    
    # 3. Test Backend API - Publish
    print("\n[3/5] Testing Backend API - Publish...")
    api_url = f"http://localhost:3007/api/v1/design/questions/{question_id}/publish"
    
    try:
        response = requests.patch(api_url, params={"is_published": True})
        if response.status_code == 200:
            data = response.json()
            print(f"   SUCCESS: {data.get('message')}")
            print(f"   New Status: {data.get('is_published')}")
        else:
            print(f"   ERROR: Status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"   ERROR: {e}")
        return False
    
    # 4. Verify in Database
    print("\n[4/5] Verifying in Database...")
    await asyncio.sleep(1)
    updated_question = await db.design_questions.find_one({"_id": ObjectId(question_id)})
    db_status = updated_question.get("is_published", False)
    
    if db_status == True:
        print(f"   SUCCESS: Database updated correctly")
        print(f"   Published: {db_status}")
    else:
        print(f"   ERROR: Database not updated!")
        print(f"   Expected: True, Got: {db_status}")
        return False
    
    # 5. Test Unpublish
    print("\n[5/5] Testing Unpublish...")
    try:
        response = requests.patch(api_url, params={"is_published": False})
        if response.status_code == 200:
            data = response.json()
            print(f"   SUCCESS: {data.get('message')}")
            print(f"   New Status: {data.get('is_published')}")
        else:
            print(f"   ERROR: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"   ERROR: {e}")
        return False
    
    # Final verification
    await asyncio.sleep(1)
    final_question = await db.design_questions.find_one({"_id": ObjectId(question_id)})
    final_status = final_question.get("is_published", False)
    
    if final_status == False:
        print(f"   SUCCESS: Unpublish verified in database")
    else:
        print(f"   ERROR: Unpublish failed!")
        return False
    
    # Summary
    print("\n" + "=" * 60)
    print("VERIFICATION COMPLETE")
    print("=" * 60)
    print("\nAll tests passed!")
    print("\nConfiguration:")
    print(f"  Database: {db_name}")
    print(f"  Backend Port: 3007")
    print(f"  Frontend Port: 3002")
    print("\nFeatures Working:")
    print("  - Cloud database connection")
    print("  - Publish/Unpublish API endpoint")
    print("  - Data persistence")
    print("  - Query parameter support")
    
    client.close()
    return True

if __name__ == "__main__":
    success = asyncio.run(verify_all())
    exit(0 if success else 1)
