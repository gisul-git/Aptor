"""
Migrate all data from local aptor_design to cloud aptor_design_Competency
"""

import pymongo
from pymongo import MongoClient

# Source: Local MongoDB
LOCAL_URI = "mongodb://localhost:27017/"
LOCAL_DB = "aptor_design"

# Destination: Cloud MongoDB
CLOUD_URI = "mongodb+srv://gisul2102_db_user:5cNJ1DcNCxwaJDaU@cluster0.dwcfp0l.mongodb.net/aptor_design_Competency?retryWrites=true&w=majority&appName=Cluster0"
CLOUD_DB = "aptor_design_Competency"

def migrate_data():
    """Migrate all collections from local to cloud"""
    try:
        print("=" * 80)
        print("MIGRATING DATA FROM LOCAL TO CLOUD")
        print("=" * 80)
        print()
        
        # Connect to both databases
        print("📡 Connecting to local MongoDB...")
        local_client = MongoClient(LOCAL_URI)
        local_db = local_client[LOCAL_DB]
        
        print("☁️  Connecting to cloud MongoDB...")
        cloud_client = MongoClient(CLOUD_URI)
        cloud_db = cloud_client[CLOUD_DB]
        
        print("✅ Connected to both databases")
        print()
        
        # Get all collections from local
        collections = local_db.list_collection_names()
        print(f"📦 Found {len(collections)} collections to migrate:")
        for coll in collections:
            count = local_db[coll].count_documents({})
            print(f"   - {coll}: {count} documents")
        print()
        
        # Migrate each collection
        total_migrated = 0
        
        for coll_name in collections:
            print(f"🔄 Migrating {coll_name}...")
            
            # Get all documents from local
            local_coll = local_db[coll_name]
            documents = list(local_coll.find())
            
            if documents:
                # Clear existing data in cloud (optional - remove if you want to keep existing)
                cloud_coll = cloud_db[coll_name]
                existing_count = cloud_coll.count_documents({})
                
                if existing_count > 0:
                    print(f"   ⚠️  Cloud already has {existing_count} documents")
                    print(f"   🗑️  Clearing existing data...")
                    cloud_coll.delete_many({})
                
                # Insert all documents to cloud
                cloud_coll.insert_many(documents)
                print(f"   ✅ Migrated {len(documents)} documents")
                total_migrated += len(documents)
            else:
                print(f"   ⚠️  No documents to migrate")
            
            print()
        
        print("=" * 80)
        print(f"✅ MIGRATION COMPLETE!")
        print(f"📊 Total documents migrated: {total_migrated}")
        print("=" * 80)
        print()
        
        # Verify migration
        print("🔍 Verifying migration...")
        print()
        
        for coll_name in collections:
            local_count = local_db[coll_name].count_documents({})
            cloud_count = cloud_db[coll_name].count_documents({})
            
            status = "✅" if local_count == cloud_count else "❌"
            print(f"{status} {coll_name}: Local={local_count}, Cloud={cloud_count}")
        
        print()
        print("=" * 80)
        print("🎉 ALL DATA MIGRATED TO CLOUD!")
        print("=" * 80)
        
        # Close connections
        local_client.close()
        cloud_client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print()
    print("⚠️  WARNING: This will REPLACE all data in cloud with local data!")
    print()
    confirm = input("Continue? (yes/no): ")
    
    if confirm.lower() == 'yes':
        migrate_data()
    else:
        print("❌ Migration cancelled")
