"""
Delete local aptor_design database (data is now in cloud)
"""

import pymongo

LOCAL_URI = "mongodb://localhost:27017/"
LOCAL_DB = "aptor_design"

try:
    print("=" * 80)
    print("DELETING LOCAL DATABASE")
    print("=" * 80)
    print()
    
    client = pymongo.MongoClient(LOCAL_URI)
    
    print(f"🗑️  Dropping database: {LOCAL_DB}")
    client.drop_database(LOCAL_DB)
    
    print("✅ Local database deleted!")
    print()
    print("=" * 80)
    print("✅ ALL DATA NOW IN CLOUD: aptor_design_Competency")
    print("=" * 80)
    
    client.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
