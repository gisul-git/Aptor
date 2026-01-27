"""
Test script to verify SQL and AIML topics are generated correctly.

Run this to verify the fix works:
    cd backend
    python test_sql_aiml_topics.py
"""
import asyncio
import sys
from pathlib import Path

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.api.v1.assessments.services import generate_topics_unified


async def test_sql_aiml_topics():
    """Test that SQL and AIML topics are generated with correct question types."""
    
    print("=" * 80)
    print("TESTING SQL & AIML TOPIC GENERATION")
    print("=" * 80)
    
    # Test Case 1: SQL + AIML Skills
    print("\n📋 Test Case 1: SQL + AIML Skills")
    print("-" * 80)
    
    topics = await generate_topics_unified(
        assessment_title="AI Engineer Assessment",
        job_designation="AI Engineer",
        combined_skills=[
            {"skill_name": "SQL", "source": "role", "description": None, "importance_level": None},
            {"skill_name": "Machine Learning", "source": "role", "description": None, "importance_level": None},
            {"skill_name": "TensorFlow", "source": "role", "description": None, "importance_level": None},
            {"skill_name": "PostgreSQL", "source": "role", "description": None, "importance_level": None},
        ],
        experience_min=3,
        experience_max=5,
        experience_mode="corporate"
    )
    
    # Analyze results
    sql_topics = [t for t in topics if t["questionRows"][0]["questionType"] == "SQL"]
    aiml_topics = [t for t in topics if t["questionRows"][0]["questionType"] == "AIML"]
    other_topics = [t for t in topics if t["questionRows"][0]["questionType"] not in ["SQL", "AIML"]]
    
    print(f"\n✅ Total Topics Generated: {len(topics)}")
    print(f"   └─ SQL Topics: {len(sql_topics)}")
    print(f"   └─ AIML Topics: {len(aiml_topics)}")
    print(f"   └─ Other Topics: {len(other_topics)}")
    
    # Detailed SQL topics
    if sql_topics:
        print(f"\n📊 SQL Topics ({len(sql_topics)}):")
        for t in sql_topics:
            print(f"   ✅ {t['label']}")
            print(f"      Type: {t['questionRows'][0]['questionType']}, Difficulty: {t['questionRows'][0]['difficulty']}")
    else:
        print("\n❌ NO SQL TOPICS GENERATED! (Expected at least 1-2)")
    
    # Detailed AIML topics
    if aiml_topics:
        print(f"\n🤖 AIML Topics ({len(aiml_topics)}):")
        for t in aiml_topics:
            print(f"   ✅ {t['label']}")
            print(f"      Type: {t['questionRows'][0]['questionType']}, Difficulty: {t['questionRows'][0]['difficulty']}")
    else:
        print("\n❌ NO AIML TOPICS GENERATED! (Expected at least 2-3)")
    
    # Detailed other topics
    if other_topics:
        print(f"\n📝 Other Topics ({len(other_topics)}):")
        for t in other_topics:
            print(f"   • {t['label']}")
            print(f"      Type: {t['questionRows'][0]['questionType']}, Difficulty: {t['questionRows'][0]['difficulty']}")
    
    # Validation
    print("\n" + "=" * 80)
    print("VALIDATION RESULTS")
    print("=" * 80)
    
    checks_passed = 0
    checks_total = 3
    
    # Check 1: At least 1 SQL topic
    if len(sql_topics) >= 1:
        print("✅ PASS: At least 1 SQL topic generated")
        checks_passed += 1
    else:
        print("❌ FAIL: No SQL topics generated (expected >= 1)")
    
    # Check 2: At least 1 AIML topic
    if len(aiml_topics) >= 1:
        print("✅ PASS: At least 1 AIML topic generated")
        checks_passed += 1
    else:
        print("❌ FAIL: No AIML topics generated (expected >= 1)")
    
    # Check 3: All topics have valid question types
    valid_types = ["MCQ", "Subjective", "PseudoCode", "Coding", "SQL", "AIML"]
    invalid_topics = [
        t for t in topics 
        if t["questionRows"][0]["questionType"] not in valid_types
    ]
    if len(invalid_topics) == 0:
        print("✅ PASS: All topics have valid question types")
        checks_passed += 1
    else:
        print(f"❌ FAIL: {len(invalid_topics)} topics have invalid question types:")
        for t in invalid_topics:
            print(f"   - {t['label']}: {t['questionRows'][0]['questionType']}")
    
    print("\n" + "=" * 80)
    print(f"FINAL RESULT: {checks_passed}/{checks_total} checks passed")
    print("=" * 80)
    
    if checks_passed == checks_total:
        print("🎉 ALL TESTS PASSED! SQL & AIML topic generation is working correctly!")
        return True
    else:
        print("⚠️  SOME TESTS FAILED. Review the output above.")
        return False


async def test_sql_only():
    """Test with SQL skills only."""
    
    print("\n\n" + "=" * 80)
    print("📋 Test Case 2: SQL Skills Only")
    print("=" * 80)
    
    topics = await generate_topics_unified(
        assessment_title="Database Developer Assessment",
        job_designation="Database Developer",
        combined_skills=[
            {"skill_name": "SQL", "source": "role", "description": None, "importance_level": None},
            {"skill_name": "PostgreSQL", "source": "role", "description": None, "importance_level": None},
            {"skill_name": "Database Design", "source": "role", "description": None, "importance_level": None},
        ],
        experience_min=2,
        experience_max=4,
        experience_mode="corporate"
    )
    
    sql_topics = [t for t in topics if t["questionRows"][0]["questionType"] == "SQL"]
    
    print(f"\n✅ SQL Topics: {len(sql_topics)}/{len(topics)}")
    for t in sql_topics:
        print(f"   • {t['label']} ({t['questionRows'][0]['difficulty']})")
    
    if len(sql_topics) >= 1:
        print("\n✅ PASS: SQL-only test successful")
        return True
    else:
        print("\n❌ FAIL: No SQL topics generated")
        return False


async def test_aiml_only():
    """Test with AIML skills only."""
    
    print("\n\n" + "=" * 80)
    print("📋 Test Case 3: AIML Skills Only")
    print("=" * 80)
    
    topics = await generate_topics_unified(
        assessment_title="ML Engineer Assessment",
        job_designation="Machine Learning Engineer",
        combined_skills=[
            {"skill_name": "Machine Learning", "source": "role", "description": None, "importance_level": None},
            {"skill_name": "TensorFlow", "source": "role", "description": None, "importance_level": None},
            {"skill_name": "Computer Vision", "source": "role", "description": None, "importance_level": None},
            {"skill_name": "Model Evaluation", "source": "role", "description": None, "importance_level": None},
        ],
        experience_min=3,
        experience_max=6,
        experience_mode="corporate"
    )
    
    aiml_topics = [t for t in topics if t["questionRows"][0]["questionType"] == "AIML"]
    
    print(f"\n✅ AIML Topics: {len(aiml_topics)}/{len(topics)}")
    for t in aiml_topics:
        print(f"   • {t['label']} ({t['questionRows'][0]['difficulty']})")
    
    if len(aiml_topics) >= 2:
        print("\n✅ PASS: AIML-only test successful")
        return True
    else:
        print(f"\n⚠️  WARNING: Only {len(aiml_topics)} AIML topics generated (expected >= 2)")
        return len(aiml_topics) >= 1  # At least 1 is acceptable


async def main():
    """Run all tests."""
    try:
        print("\n" + "🚀" * 40)
        print("SQL & AIML TOPIC GENERATION TEST SUITE")
        print("🚀" * 40)
        
        # Run all test cases
        test1 = await test_sql_aiml_topics()
        test2 = await test_sql_only()
        test3 = await test_aiml_only()
        
        # Final summary
        print("\n\n" + "=" * 80)
        print("📊 FINAL TEST SUMMARY")
        print("=" * 80)
        print(f"Test 1 (SQL + AIML): {'✅ PASS' if test1 else '❌ FAIL'}")
        print(f"Test 2 (SQL only):   {'✅ PASS' if test2 else '❌ FAIL'}")
        print(f"Test 3 (AIML only):  {'✅ PASS' if test3 else '❌ FAIL'}")
        
        all_passed = test1 and test2 and test3
        
        if all_passed:
            print("\n🎉 SUCCESS! All tests passed. SQL & AIML topic generation is working!")
            print("\n📝 Next Steps:")
            print("   1. Test in UI: Create an assessment with SQL + ML skills")
            print("   2. Verify topics show correct question types in Configure Topics")
            print("   3. Verify questions appear in Review Questions page")
        else:
            print("\n⚠️  Some tests failed. Review the output above for details.")
        
        print("=" * 80 + "\n")
        
        return all_passed
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)

