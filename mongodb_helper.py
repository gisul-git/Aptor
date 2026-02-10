"""
MongoDB Connection Helper
Connects to the Docker MongoDB instance (same as backend)
"""
from pymongo import MongoClient
import sys

def get_mongodb_connection():
    """
    Get MongoDB connection to Docker instance
    The Docker MongoDB is exposed on localhost:27017
    """
    try:
        # Try to connect to Docker MongoDB
        # Note: If you have a local MongoDB running, you may need to stop it first
        client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=5000)
        
        # Test connection
        client.server_info()
        
        db = client['aptor_design']
        
        # Verify we're connected to the right database by checking collections
        collections = db.list_collection_names()
        
        print(f"✅ Connected to MongoDB at localhost:27017")
        print(f"   Database: aptor_design")
        print(f"   Collections: {', '.join(collections) if collections else 'none'}")
        
        return db
        
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        print("\nTroubleshooting:")
        print("1. Make sure Docker containers are running: docker ps")
        print("2. Check if local MongoDB is running and conflicting")
        print("3. Try: docker exec aptor-mongo-1 mongosh --eval 'db.adminCommand(\"ping\")'")
        sys.exit(1)

if __name__ == "__main__":
    # Test connection
    db = get_mongodb_connection()
    
    # Show counts
    print(f"\n📊 Document counts:")
    print(f"   design_sessions: {db.design_sessions.count_documents({})}")
    print(f"   screenshots: {db.screenshots.count_documents({})}")
    print(f"   events: {db.events.count_documents({})}")
    print(f"   design_submissions: {db.design_submissions.count_documents({})}")
