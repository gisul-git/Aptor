"""
Script to diagnose and fix user isolation issues in DSA module.

This script:
1. Identifies tests/questions without created_by field
2. Identifies tests/questions with null/empty created_by
3. Reports statistics on user isolation
4. Optionally fixes records (use with caution)

Run with: python -m app.api.v1.dsa.fix_user_isolation
"""
import asyncio
import sys
from .database import connect_to_dsa_mongo, get_dsa_database

async def diagnose_user_isolation():
    """Diagnose user isolation issues"""
    await connect_to_dsa_mongo()
    db = get_dsa_database()
    
    print("=" * 60)
    print("DSA User Isolation Diagnostic")
    print("=" * 60)
    
    # Check tests
    print("\n--- TESTS COLLECTION ---")
    total_tests = await db.tests.count_documents({})
    tests_without_created_by = await db.tests.count_documents({"created_by": {"$exists": False}})
    tests_with_null_created_by = await db.tests.count_documents({"created_by": None})
    tests_with_empty_created_by = await db.tests.count_documents({"created_by": ""})
    tests_with_created_by = await db.tests.count_documents({"created_by": {"$exists": True, "$ne": None, "$ne": ""}})
    
    print(f"Total tests: {total_tests}")
    print(f"Tests WITH created_by: {tests_with_created_by}")
    print(f"Tests WITHOUT created_by field: {tests_without_created_by}")
    print(f"Tests with NULL created_by: {tests_with_null_created_by}")
    print(f"Tests with EMPTY created_by: {tests_with_empty_created_by}")
    
    if tests_without_created_by > 0 or tests_with_null_created_by > 0 or tests_with_empty_created_by > 0:
        print(f"\n⚠️  WARNING: {tests_without_created_by + tests_with_null_created_by + tests_with_empty_created_by} tests have invalid created_by!")
        print("These tests may be visible to all users!")
        
        # Show sample problematic tests
        problematic_tests = await db.tests.find({
            "$or": [
                {"created_by": {"$exists": False}},
                {"created_by": None},
                {"created_by": ""}
            ]
        }).limit(5).to_list(length=5)
        
        print("\nSample problematic tests:")
        for test in problematic_tests:
            print(f"  - Test ID: {test.get('_id')}, Title: {test.get('title', 'Unknown')}, created_by: {test.get('created_by')}")
    
    # Check questions
    print("\n--- QUESTIONS COLLECTION ---")
    total_questions = await db.questions.count_documents({})
    questions_without_created_by = await db.questions.count_documents({"created_by": {"$exists": False}})
    questions_with_null_created_by = await db.questions.count_documents({"created_by": None})
    questions_with_empty_created_by = await db.questions.count_documents({"created_by": ""})
    questions_with_created_by = await db.questions.count_documents({"created_by": {"$exists": True, "$ne": None, "$ne": ""}})
    
    print(f"Total questions: {total_questions}")
    print(f"Questions WITH created_by: {questions_with_created_by}")
    print(f"Questions WITHOUT created_by field: {questions_without_created_by}")
    print(f"Questions with NULL created_by: {questions_with_null_created_by}")
    print(f"Questions with EMPTY created_by: {questions_with_empty_created_by}")
    
    if questions_without_created_by > 0 or questions_with_null_created_by > 0 or questions_with_empty_created_by > 0:
        print(f"\n⚠️  WARNING: {questions_without_created_by + questions_with_null_created_by + questions_with_empty_created_by} questions have invalid created_by!")
        print("These questions may be visible to all users!")
        
        # Show sample problematic questions
        problematic_questions = await db.questions.find({
            "$or": [
                {"created_by": {"$exists": False}},
                {"created_by": None},
                {"created_by": ""}
            ]
        }).limit(5).to_list(length=5)
        
        print("\nSample problematic questions:")
        for question in problematic_questions:
            print(f"  - Question ID: {question.get('_id')}, Title: {question.get('title', 'Unknown')}, created_by: {question.get('created_by')}")
    
    # Check for duplicate created_by values (same user might have multiple formats)
    print("\n--- CREATED_BY VALUE ANALYSIS ---")
    # Get distinct created_by values
    pipeline = [
        {"$group": {"_id": "$created_by", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    test_created_by_stats = await db.tests.aggregate(pipeline).to_list(length=10)
    question_created_by_stats = await db.questions.aggregate(pipeline).to_list(length=10)
    
    print("\nTop 10 created_by values in tests:")
    for stat in test_created_by_stats:
        created_by_val = stat["_id"]
        count = stat["count"]
        print(f"  - '{created_by_val}' (type: {type(created_by_val).__name__}): {count} tests")
    
    print("\nTop 10 created_by values in questions:")
    for stat in question_created_by_stats:
        created_by_val = stat["_id"]
        count = stat["count"]
        print(f"  - '{created_by_val}' (type: {type(created_by_val).__name__}): {count} questions")
    
    print("\n" + "=" * 60)
    print("Diagnostic complete!")
    print("=" * 60)
    
    if tests_without_created_by > 0 or tests_with_null_created_by > 0 or tests_with_empty_created_by > 0 or \
       questions_without_created_by > 0 or questions_with_null_created_by > 0 or questions_with_empty_created_by > 0:
        print("\n⚠️  ACTION REQUIRED:")
        print("There are records without valid created_by fields.")
        print("These records may be visible to all users.")
        print("\nTo fix (DELETE these records - use with caution):")
        print("  - Delete tests without created_by: await db.tests.delete_many({'created_by': {'$exists': False}})")
        print("  - Delete questions without created_by: await db.questions.delete_many({'created_by': {'$exists': False}})")
        print("\n⚠️  WARNING: This will permanently delete these records!")

if __name__ == "__main__":
    asyncio.run(diagnose_user_isolation())


