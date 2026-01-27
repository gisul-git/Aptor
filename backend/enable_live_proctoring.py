#!/usr/bin/env python3
"""
Script to enable live proctoring for a DSA test.
Usage: python enable_live_proctoring.py <test_id>
"""

import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from app.api.v1.dsa.config import get_dsa_settings

async def enable_live_proctoring(test_id: str):
    """Enable live proctoring for a test"""
    settings = get_dsa_settings()
    
    client = AsyncIOMotorClient(
        settings.mongo_uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        socketTimeoutMS=30000,
    )
    db = client[settings.mongo_db]
    
    try:
        # Validate test ID
        if not ObjectId.is_valid(test_id):
            print(f"ERROR: Invalid test ID: {test_id}")
            return False
        
        # Check if test exists
        test = await db.tests.find_one({"_id": ObjectId(test_id)})
        if not test:
            print(f"ERROR: Test not found: {test_id}")
            return False
        
        print(f"Test found: {test.get('title', 'Unknown')}")
        print(f"Current proctoringSettings: {test.get('proctoringSettings', {})}")
        
        # Get current proctoring settings or create new
        current_settings = test.get("proctoringSettings", {})
        if not isinstance(current_settings, dict):
            current_settings = {}
        
        # Update proctoring settings
        new_settings = {
            **current_settings,
            "liveProctoringEnabled": True,
            # Also enable AI proctoring if not already set (live proctoring requires it)
            "aiProctoringEnabled": current_settings.get("aiProctoringEnabled", True),
        }
        
        # Update the test
        result = await db.tests.update_one(
            {"_id": ObjectId(test_id)},
            {"$set": {"proctoringSettings": new_settings}}
        )
        
        if result.modified_count > 0:
            print(f"SUCCESS: Enabled live proctoring for test {test_id}")
            print(f"Updated proctoringSettings: {new_settings}")
            return True
        else:
            print(f"WARNING: Test updated but no changes were made (settings may already be set)")
            return True
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        client.close()

async def main():
    if len(sys.argv) < 2:
        print("Usage: python enable_live_proctoring.py <test_id>")
        print(f"Example: python enable_live_proctoring.py 6947df27dd32a1876f90ddf0")
        sys.exit(1)
    
    test_id = sys.argv[1]
    success = await enable_live_proctoring(test_id)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
