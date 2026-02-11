"""
Check Questions Database and Remove Duplicates
"""

import pymongo
from collections import defaultdict

# MongoDB connection
MONGO_URI = "mongodb://localhost:27017/"

def check_and_clean():
    """Check all databases for questions and remove duplicates"""
    try:
        # Connect to MongoDB
        client = pymongo.MongoClient(MONGO_URI)
        
        print("🔍 Checking all databases for questions...")
        
        # List all databases
        db_names = client.list_database_names()
        print(f"\n📊 Available databases: {db_names}")
        
        questions_found = False
        
        for db_name in db_names:
            if db_name in ['admin', 'config', 'local']:
                continue
                
            db = client[db_name]
            collections = db.list_collection_names()
            
            if 'questions' in collections or 'design_questions' in collections:
                print(f"\n✅ Found questions in database: {db_name}")
                
                # Try both collection names
                for coll_name in ['questions', 'design_questions']:
                    if coll_name in collections:
                        collection = db[coll_name]
                        count = collection.count_documents({})
                        print(f"   📝 Collection '{coll_name}': {count} documents")
                        
                        if count > 0:
                            questions_found = True
                            
                            # Get all questions
                            all_questions = list(collection.find())
                            
                            # Group by title
                            title_groups = defaultdict(list)
                            for q in all_questions:
                                title = q.get('title', 'Untitled')
                                title_groups[title].append(q)
                            
                            # Show duplicates
                            duplicates_to_remove = []
                            print(f"\n   📋 Question titles:")
                            for title, questions in sorted(title_groups.items()):
                                if len(questions) > 1:
                                    print(f"      🔄 {title} - {len(questions)} copies (DUPLICATE)")
                                    # Keep first, mark others for deletion
                                    for q in questions[1:]:
                                        duplicates_to_remove.append(q['_id'])
                                else:
                                    print(f"      ✓ {title}")
                            
                            # Remove duplicates if found
                            if duplicates_to_remove:
                                print(f"\n   ⚠️  Found {len(duplicates_to_remove)} duplicates")
                                confirm = input("   Delete duplicates? (yes/no): ")
                                
                                if confirm.lower() == 'yes':
                                    result = collection.delete_many({'_id': {'$in': duplicates_to_remove}})
                                    print(f"   ✅ Deleted {result.deleted_count} duplicates")
                                    print(f"   📊 Remaining: {collection.count_documents({})} questions")
                                else:
                                    print("   ❌ Deletion cancelled")
                            else:
                                print(f"   ✅ No duplicates found!")
        
        if not questions_found:
            print("\n❌ No questions found in any database")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_and_clean()
