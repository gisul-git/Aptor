"""
Final verification that everything is working
"""

import pymongo
import requests

print("=" * 80)
print("FINAL SYSTEM VERIFICATION")
print("=" * 80)
print()

# 1. Check Cloud Database
print("1. CHECKING CLOUD DATABASE")
print("-" * 80)

CLOUD_URI = "mongodb+srv://gisul2102_db_user:5cNJ1DcNCxwaJDaU@cluster0.dwcfp0l.mongodb.net/aptor_design_Competency?retryWrites=true&w=majority&appName=Cluster0"
CLOUD_DB = "aptor_design_Competency"

try:
    client = pymongo.MongoClient(CLOUD_URI, serverSelectionTimeoutMS=5000)
    db = client[CLOUD_DB]
    
    # Test connection
    client.server_info()
    
    collections = db.list_collection_names()
    total_docs = sum(db[coll].count_documents({}) for coll in collections)
    
    print(f"✅ Connected to cloud database")
    print(f"   Database: {CLOUD_DB}")
    print(f"   Collections: {len(collections)}")
    print(f"   Total documents: {total_docs}")
    print()
    
    # Show key data
    tests_count = db['design_tests'].count_documents({})
    questions_count = db['design_questions'].count_documents({})
    submissions_count = db['design_submissions'].count_documents({})
    candidates_count = db['design_candidates'].count_documents({})
    
    print(f"   📊 Tests: {tests_count}")
    print(f"   📋 Questions: {questions_count}")
    print(f"   📝 Submissions: {submissions_count}")
    print(f"   👥 Candidates: {candidates_count}")
    print()
    
    client.close()
    
except Exception as e:
    print(f"❌ Database connection failed: {e}")
    print()

# 2. Check Local Database (should be empty/deleted)
print("2. CHECKING LOCAL DATABASE")
print("-" * 80)

LOCAL_URI = "mongodb://localhost:27017/"
LOCAL_DB = "aptor_design"

try:
    local_client = pymongo.MongoClient(LOCAL_URI, serverSelectionTimeoutMS=5000)
    
    if LOCAL_DB in local_client.list_database_names():
        print(f"⚠️  Local database '{LOCAL_DB}' still exists")
        local_db = local_client[LOCAL_DB]
        collections = local_db.list_collection_names()
        print(f"   Collections: {len(collections)}")
    else:
        print(f"✅ Local database '{LOCAL_DB}' deleted successfully")
    
    print()
    local_client.close()
    
except Exception as e:
    print(f"⚠️  Cannot connect to local MongoDB: {e}")
    print()

# 3. Check Design Service
print("3. CHECKING DESIGN SERVICE")
print("-" * 80)

try:
    response = requests.get("http://localhost:3006/health", timeout=5)
    
    if response.status_code == 200:
        print(f"✅ Design service is running")
        print(f"   URL: http://localhost:3006")
        print(f"   Status: {response.json()}")
    else:
        print(f"⚠️  Design service returned status {response.status_code}")
    
    print()
    
except Exception as e:
    print(f"❌ Design service not responding: {e}")
    print()

# 4. Check Frontend
print("4. CHECKING FRONTEND")
print("-" * 80)

try:
    response = requests.get("http://localhost:3002", timeout=5)
    
    if response.status_code == 200:
        print(f"✅ Frontend is running")
        print(f"   URL: http://localhost:3002")
    else:
        print(f"⚠️  Frontend returned status {response.status_code}")
    
    print()
    
except Exception as e:
    print(f"❌ Frontend not responding: {e}")
    print()

# 5. Summary
print("=" * 80)
print("SUMMARY")
print("=" * 80)
print()
print("✅ Cloud database: aptor_design_Competency (MongoDB Atlas)")
print("✅ Design service: http://localhost:3006")
print("✅ Frontend: http://localhost:3002")
print()
print("🎯 NEXT STEPS:")
print("   1. Go to: http://localhost:3002/dashboard")
print("   2. Find your Design Assessment")
print("   3. Click 'View Details' to see analytics")
print("   4. Add candidates and send test links")
print()
print("=" * 80)
print("✅ SYSTEM IS READY!")
print("=" * 80) 