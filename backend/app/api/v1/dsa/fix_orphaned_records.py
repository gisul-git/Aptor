"""
Script to fix orphaned DSA records (records without valid created_by).

This script will DELETE records that don't have a valid created_by field.
These records are security risks as they may be visible to all users.

⚠️  WARNING: This will permanently delete records without created_by!
"""
import asyncio
import sys
from .database import connect_to_dsa_mongo, get_dsa_database

async def fix_orphaned_records(dry_run=True):
    """Fix orphaned records by deleting those without valid created_by"""
    await connect_to_dsa_mongo()
    db = get_dsa_database()
    
    print("=" * 60)
    print("DSA Orphaned Records Fix")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (will delete records)'}")
    print("=" * 60)
    
    # Find problematic records
    problematic_tests_query = {
        "$or": [
            {"created_by": {"$exists": False}},
            {"created_by": None},
            {"created_by": ""}
        ]
    }
    
    problematic_questions_query = {
        "$or": [
            {"created_by": {"$exists": False}},
            {"created_by": None},
            {"created_by": ""}
        ]
    }
    
    problematic_tests = await db.tests.find(problematic_tests_query).to_list(length=100)
    problematic_questions = await db.questions.find(problematic_questions_query).to_list(length=100)
    
    print(f"\nFound {len(problematic_tests)} tests without valid created_by")
    print(f"Found {len(problematic_questions)} questions without valid created_by")
    
    if problematic_tests:
        print("\nTests to be deleted:")
        for test in problematic_tests:
            print(f"  - ID: {test.get('_id')}, Title: {test.get('title', 'Unknown')}, created_by: {test.get('created_by')}")
    
    if problematic_questions:
        print("\nQuestions to be deleted:")
        for question in problematic_questions:
            print(f"  - ID: {question.get('_id')}, Title: {question.get('title', 'Unknown')}, created_by: {question.get('created_by')}")
    
    if not dry_run:
        print("\n⚠️  DELETING RECORDS...")
        if problematic_tests:
            result_tests = await db.tests.delete_many(problematic_tests_query)
            print(f"Deleted {result_tests.deleted_count} tests")
        
        if problematic_questions:
            result_questions = await db.questions.delete_many(problematic_questions_query)
            print(f"Deleted {result_questions.deleted_count} questions")
        
        print("\n✅ Cleanup complete!")
    else:
        print("\n⚠️  DRY RUN - No records were deleted")
        print("Run with dry_run=False to actually delete these records")
    
    print("=" * 60)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Fix orphaned DSA records")
    parser.add_argument("--execute", action="store_true", help="Actually delete records (default is dry run)")
    args = parser.parse_args()
    
    asyncio.run(fix_orphaned_records(dry_run=not args.execute))

