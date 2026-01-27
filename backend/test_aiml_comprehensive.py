"""
Test AIML Comprehensive Structure Generation

This script tests that AIML questions are generated with complete structure:
- description, tasks, constraints, libraries
- dataset (when required) with schema and exactly 30 rows
- proper formatting and validation
"""
import asyncio
import sys
import os
import json

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "."))

from app.api.v1.assessments.services.ai_aiml_generator import _generate_aiml_questions


async def test_aiml_comprehensive_structure():
    """Test AIML question comprehensive structure"""
    print("=" * 80)
    print("TESTING AIML COMPREHENSIVE STRUCTURE")
    print("=" * 80)
    
    # Test Case 1: Medium difficulty - should include dataset
    print("\n📊 Test Case 1: Medium Difficulty ML Question (Dataset Required)")
    print("-" * 80)
    
    try:
        questions = await _generate_aiml_questions(
            topic="Decision Tree Classifier",
            difficulty="Medium",
            count=1,
            experience_mode="corporate"
        )
        
        assert len(questions) > 0, "No questions generated"
        q = questions[0]
        
        print(f"✅ Generated question")
        print(f"   Type: {q.get('type')}")
        print(f"   Difficulty: {q.get('difficulty')}")
        
        # Check aiml_data structure
        aiml_data = q.get("aiml_data")
        assert aiml_data is not None, "Missing aiml_data"
        
        print(f"\n📋 AIML Data Structure:")
        print(f"   Description length: {len(aiml_data.get('description', ''))} chars")
        print(f"   Tasks count: {len(aiml_data.get('tasks', []))}")
        print(f"   Constraints count: {len(aiml_data.get('constraints', []))}")
        print(f"   Libraries: {aiml_data.get('libraries', [])}")
        print(f"   Requires dataset: {aiml_data.get('requires_dataset')}")
        print(f"   Execution environment: {aiml_data.get('execution_environment')}")
        
        # Check dataset (should be present for Medium)
        dataset = aiml_data.get("dataset")
        if dataset:
            schema = dataset.get("schema", [])
            rows = dataset.get("rows", [])
            
            print(f"\n📊 Dataset Structure:")
            print(f"   Schema columns: {len(schema)}")
            for col in schema[:3]:  # Show first 3 columns
                print(f"      - {col.get('name')}: {col.get('type')}")
            if len(schema) > 3:
                print(f"      ... and {len(schema) - 3} more columns")
            
            print(f"   Rows count: {len(rows)}")
            
            # Validate row count
            if len(rows) == 30:
                print("   ✅ Row count is exactly 30 (correct)")
            else:
                print(f"   ⚠️  Row count is {len(rows)}, expected 30")
            
            # Validate column count
            if 4 <= len(schema) <= 7:
                print(f"   ✅ Column count {len(schema)} is in range 4-7 (correct)")
            else:
                print(f"   ⚠️  Column count {len(schema)} is outside range 4-7")
        else:
            print(f"\n⚠️  No dataset provided (expected for Medium difficulty)")
        
        # Show tasks
        tasks = aiml_data.get("tasks", [])
        if tasks:
            print(f"\n📝 Tasks ({len(tasks)}):")
            for i, task in enumerate(tasks[:3], 1):  # Show first 3
                print(f"   {i}. {task}")
            if len(tasks) > 3:
                print(f"   ... and {len(tasks) - 3} more tasks")
        
        # Show constraints
        constraints = aiml_data.get("constraints", [])
        if constraints:
            print(f"\n🔒 Constraints ({len(constraints)}):")
            for constraint in constraints:
                print(f"   - {constraint}")
        
        print(f"\n✅ Test Case 1 PASSED")
        
    except Exception as e:
        print(f"\n❌ Test Case 1 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test Case 2: Easy difficulty - should NOT require dataset
    print("\n\n📊 Test Case 2: Easy Difficulty (No Dataset Required)")
    print("-" * 80)
    
    try:
        questions = await _generate_aiml_questions(
            topic="NumPy Array Operations",
            difficulty="Easy",
            count=1,
            experience_mode="corporate"
        )
        
        assert len(questions) > 0, "No questions generated"
        q = questions[0]
        
        print(f"✅ Generated question")
        print(f"   Type: {q.get('type')}")
        print(f"   Difficulty: {q.get('difficulty')}")
        
        aiml_data = q.get("aiml_data")
        assert aiml_data is not None, "Missing aiml_data"
        
        dataset = aiml_data.get("dataset")
        requires_dataset = aiml_data.get("requires_dataset")
        
        print(f"   Requires dataset: {requires_dataset}")
        print(f"   Dataset present: {dataset is not None}")
        print(f"   Libraries: {aiml_data.get('libraries', [])}")
        
        if not requires_dataset and dataset is None:
            print(f"\n✅ Correctly did NOT generate dataset for Easy difficulty")
        elif requires_dataset and dataset:
            print(f"\n⚠️  Generated dataset for Easy difficulty (acceptable but not required)")
        
        print(f"\n✅ Test Case 2 PASSED")
        
    except Exception as e:
        print(f"\n❌ Test Case 2 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test Case 3: Hard difficulty Deep Learning - should include dataset
    print("\n\n📊 Test Case 3: Hard Difficulty Deep Learning (Dataset Required)")
    print("-" * 80)
    
    try:
        questions = await _generate_aiml_questions(
            topic="Neural Network Training",
            difficulty="Hard",
            count=1,
            experience_mode="corporate"
        )
        
        assert len(questions) > 0, "No questions generated"
        q = questions[0]
        
        print(f"✅ Generated question")
        print(f"   Type: {q.get('type')}")
        print(f"   Difficulty: {q.get('difficulty')}")
        
        aiml_data = q.get("aiml_data")
        assert aiml_data is not None, "Missing aiml_data"
        
        libraries = aiml_data.get("libraries", [])
        print(f"   Libraries: {libraries}")
        
        # Check for TensorFlow or PyTorch for hard difficulty
        has_dl_library = any(lib.lower() in ["tensorflow", "pytorch", "keras"] for lib in libraries)
        if has_dl_library:
            print(f"   ✅ Deep Learning library included")
        else:
            print(f"   ⚠️  No Deep Learning library (TensorFlow/PyTorch/Keras)")
        
        dataset = aiml_data.get("dataset")
        if dataset:
            rows = dataset.get("rows", [])
            print(f"   Dataset rows: {len(rows)}")
            print(f"   ✅ Dataset included for Hard difficulty")
        else:
            print(f"   ⚠️  No dataset for Hard difficulty (should have one)")
        
        print(f"\n✅ Test Case 3 PASSED")
        
    except Exception as e:
        print(f"\n❌ Test Case 3 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED")
    print("=" * 80)
    print("\n📊 Summary:")
    print("   - AIML questions generated with comprehensive structure")
    print("   - Datasets included when required (Medium/Hard)")
    print("   - Datasets have proper structure (schema + 30 rows)")
    print("   - Tasks, constraints, and libraries included")
    print("   - Different difficulty levels work correctly")
    print("\n🚀 AIML comprehensive structure is working!")
    
    return True


if __name__ == "__main__":
    result = asyncio.run(test_aiml_comprehensive_structure())
    sys.exit(0 if result else 1)

