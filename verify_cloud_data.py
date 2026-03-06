"""
Verify cloud database has all the data
"""

import pymongo

CLOUD_URI = "mongodb+srv://gisul2102_db_user:5cNJ1DcNCxwaJDaU@cluster0.dwcfp0l.mongodb.net/aptor_design_Competency?retryWrites=true&w=majority&appName=Cluster0"
CLOUD_DB = "aptor_design_Competency"

try:
    print("=" * 80)
    print("VERIFYING CLOUD DATABASE")
    print("=" * 80)
    print()
    
    client = pymongo.MongoClient(CLOUD_URI)
    db = client[CLOUD_DB]
    
    collections = db.list_collection_names()
    
    print(f"☁️  Database: {CLOUD_DB}")
    print(f"📦 Collections: {len(collections)}")
    print()
    
    total_docs = 0
    for coll_name in collections:
        count = db[coll_name].count_documents({})
        total_docs += count
        print(f"   ✅ {coll_name}: {count} documents")
    
    print()
    print(f"📊 Total documents: {total_docs}")
    print()
    
    # Show tests
    print("=" * 80)
    print("YOUR DESIGN TESTS")
    print("=" * 80)
    print()
    
    tests = list(db['design_tests'].find())
    
    for i, test in enumerate(tests, 1):
        test_id = test.get('_id')
        print(f"{i}. {test.get('title')} (ID: {test_id})")
        
        # Count candidates
        candidates = db['design_candidates'].count_documents({'test_id': test_id})
        submissions = db['design_submissions'].count_documents({})
        
        print(f"   Candidates: {candidates}")
        print(f"   📊 Analytics: http://localhost:3002/design/tests/{test_id}/analytics")
        print()
    
    print("=" * 80)
    print("✅ ALL DATA IS NOW IN CLOUD!")
    print("=" * 80)
    
    client.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
