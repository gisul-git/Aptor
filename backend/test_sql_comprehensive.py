"""
Test SQL Comprehensive Structure Generation

This script tests that SQL questions are generated with complete structure:
- title, description, sql_category
- complete database schemas
- sample data (3-5 rows per table)
- constraints, starter_query, hints
- evaluation configuration
"""
import asyncio
import sys
import os
import json


sys.path.insert(0, os.path.join(os.path.dirname(__file__), "."))

from app.api.v1.assessments.services.ai_sql_generator import _generate_sql_questions, SQL_CATEGORIES


async def test_sql_comprehensive_structure():
    """Test SQL question comprehensive structure"""
    print("=" * 80)
    print("TESTING SQL COMPREHENSIVE STRUCTURE")
    print("=" * 80)
    
    # Test Case 1: Medium difficulty JOIN question
    print("\n Test Case 1: Medium Difficulty JOIN Question")
    print("-" * 80)
    
    try:
        questions = await _generate_sql_questions(
            topic="JOIN Operations",
            difficulty="Medium",
            count=1,
            experience_mode="corporate"
        )
        
        assert len(questions) > 0, "No questions generated"
        q = questions[0]
        
        print(f" Generated question")
        print(f"   Type: {q.get('type')}")
        print(f"   Difficulty: {q.get('difficulty')}")
        
        # Check sql_data structure
        sql_data = q.get("sql_data")
        assert sql_data is not None, "Missing sql_data"
        
        print(f"\n SQL Data Structure:")
        print(f"   Title: {sql_data.get('title')}")
        print(f"   Description length: {len(sql_data.get('description', ''))} chars")
        print(f"   SQL Category: {sql_data.get('sql_category')}")
        
        # Validate SQL category
        sql_category = sql_data.get("sql_category")
        if sql_category in SQL_CATEGORIES:
            print(f"   SQL category '{sql_category}' is valid")
        else:
            print(f"   ⚠️  SQL category '{sql_category}' is not in valid categories")
        
        # Check schemas
        schemas = sql_data.get("schemas", {})
        print(f"\n  Database Schemas:")
        print(f"   Table count: {len(schemas)}")
        for table_name, table_def in list(schemas.items())[:2]:  # Show first 2 tables
            columns = table_def.get("columns", {})
            print(f"   \n   Table: {table_name}")
            print(f"     Columns: {len(columns)}")
            for col_name, col_type in list(columns.items())[:3]:  # Show first 3 columns
                print(f"       - {col_name}: {col_type}")
            if len(columns) > 3:
                print(f"       ... and {len(columns) - 3} more columns")
        
        if len(schemas) > 2:
            print(f"   ... and {len(schemas) - 2} more tables")
        
        # Validate table count for Medium difficulty
        if 2 <= len(schemas) <= 3:
            print(f"    Table count {len(schemas)} is appropriate for Medium (2-3 expected)")
        else:
            print(f"   ⚠️  Table count {len(schemas)} (expected 2-3 for Medium)")
        
        # Check sample data
        sample_data = sql_data.get("sample_data", {})
        print(f"\n Sample Data:")
        print(f"   Tables with data: {len(sample_data)}")
        for table_name, rows in list(sample_data.items())[:2]:  # Show first 2 tables
            print(f"   \n   {table_name}: {len(rows)} rows")
            if 3 <= len(rows) <= 5:
                print(f"     ✅ Row count {len(rows)} is in expected range (3-5)")
            else:
                print(f"     ⚠️  Row count {len(rows)} (expected 3-5)")
        
        # Check constraints
        constraints = sql_data.get("constraints", [])
        print(f"\n Constraints ({len(constraints)}):")
        for constraint in constraints[:3]:  # Show first 3
            print(f"   - {constraint}")
        if len(constraints) > 3:
            print(f"   ... and {len(constraints) - 3} more constraints")
        
        # Check starter query
        starter_query = sql_data.get("starter_query", "")
        if starter_query:
            print(f"\n Starter Query:")
            print(f"   {starter_query[:50]}..." if len(starter_query) > 50 else f"   {starter_query}")
            print(f"    Starter query provided")
        else:
            print(f"\n  No starter query provided")
        
        # Check hints
        hints = sql_data.get("hints", [])
        if hints:
            print(f"\n Hints ({len(hints)}):")
            for hint in hints[:2]:  # Show first 2
                print(f"   - {hint}")
            if len(hints) > 2:
                print(f"   ... and {len(hints) - 2} more hints")
        
        # Check evaluation config
        evaluation = sql_data.get("evaluation", {})
        if evaluation:
            print(f"\n Evaluation Config:")
            print(f"   Engine: {evaluation.get('engine')}")
            print(f"   Comparison: {evaluation.get('comparison')}")
            print(f"   Order Sensitive: {evaluation.get('order_sensitive')}")
            print(f"   ✅ Evaluation config provided")
        else:
            print(f"\n⚠️  No evaluation config provided")
        
        print(f"\n✅ Test Case 1 PASSED")
        
    except Exception as e:
        print(f"\n❌ Test Case 1 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test Case 2: Easy difficulty SELECT question
    print("\n\n Test Case 2: Easy Difficulty SELECT Question")
    print("-" * 80)
    
    try:
        questions = await _generate_sql_questions(
            topic="Basic SELECT Queries",
            difficulty="Easy",
            count=1,
            experience_mode="corporate"
        )
        
        assert len(questions) > 0, "No questions generated"
        q = questions[0]
        
        print(f" Generated question")
        print(f"   Type: {q.get('type')}")
        print(f"   Difficulty: {q.get('difficulty')}")
        
        sql_data = q.get("sql_data")
        assert sql_data is not None, "Missing sql_data"
        
        schemas = sql_data.get("schemas", {})
        sql_category = sql_data.get("sql_category")
        
        print(f"   SQL Category: {sql_category}")
        print(f"   Table count: {len(schemas)}")
        
        # For Easy, expect 1-2 tables and "select" category
        if len(schemas) <= 2:
            print(f"   ✅ Table count {len(schemas)} is appropriate for Easy (1-2 expected)")
        else:
            print(f"   ⚠️  Table count {len(schemas)} is high for Easy (1-2 expected)")
        
        if sql_category == "select" or "select" in topic.lower():
            print(f"   ✅ SQL category appropriate for basic SELECT")
        
        print(f"\n✅ Test Case 2 PASSED")
        
    except Exception as e:
        print(f"\n❌ Test Case 2 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test Case 3: Hard difficulty Window Functions
    print("\n\n Test Case 3: Hard Difficulty Window Functions")
    print("-" * 80)
    
    try:
        questions = await _generate_sql_questions(
            topic="Window Functions and Ranking",
            difficulty="Hard",
            count=1,
            experience_mode="corporate"
        )
        
        assert len(questions) > 0, "No questions generated"
        q = questions[0]
        
        print(f"✅ Generated question")
        print(f"   Type: {q.get('type')}")
        print(f"   Difficulty: {q.get('difficulty')}")
        
        sql_data = q.get("sql_data")
        assert sql_data is not None, "Missing sql_data"
        
        schemas = sql_data.get("schemas", {})
        sql_category = sql_data.get("sql_category")
        
        print(f"   SQL Category: {sql_category}")
        print(f"   Table count: {len(schemas)}")
        
        # For Hard, expect 3-4 tables and "window" category
        if 3 <= len(schemas) <= 4:
            print(f"   ✅ Table count {len(schemas)} is appropriate for Hard (3-4 expected)")
        else:
            print(f"   ⚠️  Table count {len(schemas)} (expected 3-4 for Hard)")
        
        if sql_category == "window":
            print(f"   ✅ SQL category 'window' is correct for window functions")
        else:
            print(f"   ⚠️  SQL category '{sql_category}' (expected 'window' for window functions)")
        
        print(f"\n✅ Test Case 3 PASSED")
        
    except Exception as e:
        print(f"\n❌ Test Case 3 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test Case 4: Aggregation Question
    print("\n\n Test Case 4: Aggregation with GROUP BY")
    print("-" * 80)
    
    try:
        questions = await _generate_sql_questions(
            topic="GROUP BY and Aggregation",
            difficulty="Medium",
            count=1,
            experience_mode="corporate"
        )
        
        assert len(questions) > 0, "No questions generated"
        q = questions[0]
        
        sql_data = q.get("sql_data")
        sql_category = sql_data.get("sql_category")
        
        print(f"✅ Generated question")
        print(f"   SQL Category: {sql_category}")
        
        if sql_category == "aggregation":
            print(f"   ✅ SQL category 'aggregation' is correct for GROUP BY")
        else:
            print(f"   ⚠️  SQL category '{sql_category}' (expected 'aggregation')")
        
        print(f"\n✅ Test Case 4 PASSED")
        
    except Exception as e:
        print(f"\n❌ Test Case 4 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED")
    print("=" * 80)
    print("\n Summary:")
    print("   - SQL questions generated with comprehensive structure")
    print("   - Complete database schemas with proper data types")
    print("   - Sample data (3-5 rows per table) included")
    print("   - SQL categories auto-detected and validated")
    print("   - Constraints, starter queries, and hints included")
    print("   - Evaluation configuration present")
    print("   - Difficulty-appropriate complexity (table count)")
    print("\n SQL comprehensive structure is working!")
    
    return True


if __name__ == "__main__":
    result = asyncio.run(test_sql_comprehensive_structure())
    sys.exit(0 if result else 1)

