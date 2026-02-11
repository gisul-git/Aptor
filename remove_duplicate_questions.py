"""
Remove Duplicate Design Questions from MongoDB
Keeps only the first occurrence of each unique title
"""

import pymongo
from collections import defaultdict

# MongoDB connection
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "design_assessment"
COLLECTION_NAME = "questions"

def remove_duplicates():
    """Remove duplicate questions based on title"""
    try:
        # Connect to MongoDB
        client = pymongo.MongoClient(MONGO_URI)
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]
        
        print("🔍 Checking for duplicate questions...")
        
        # Get all questions
        all_questions = list(collection.find())
        print(f"📊 Total questions: {len(all_questions)}")
        
        # Group by title
        title_groups = defaultdict(list)
        for q in all_questions:
            title = q.get('title', 'Untitled')
            title_groups[title].append(q)
        
        # Find duplicates
        duplicates_to_remove = []
        for title, questions in title_groups.items():
            if len(questions) > 1:
                print(f"\n🔄 Found {len(questions)} duplicates of: '{title}'")
                # Keep the first one, mark others for deletion
                for q in questions[1:]:
                    duplicates_to_remove.append(q['_id'])
                    print(f"   ❌ Will remove: {q['_id']}")
        
        if not duplicates_to_remove:
            print("\n✅ No duplicates found!")
            return
        
        # Confirm deletion
        print(f"\n⚠️  Found {len(duplicates_to_remove)} duplicate questions to remove")
        confirm = input("Do you want to delete them? (yes/no): ")
        
        if confirm.lower() == 'yes':
            result = collection.delete_many({'_id': {'$in': duplicates_to_remove}})
            print(f"\n✅ Deleted {result.deleted_count} duplicate questions")
            
            # Show final count
            final_count = collection.count_documents({})
            print(f"📊 Remaining questions: {final_count}")
            
            # Show unique titles
            unique_titles = collection.distinct('title')
            print(f"\n📝 Unique question titles ({len(unique_titles)}):")
            for title in sorted(unique_titles):
                count = collection.count_documents({'title': title})
                print(f"   - {title} ({count})")
        else:
            print("❌ Deletion cancelled")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    remove_duplicates()
