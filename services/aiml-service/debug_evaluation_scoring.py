"""
Debug evaluation scoring - why correct code is getting low scores
"""
import asyncio
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bson import ObjectId
from app.api.v1.aiml.database import get_aiml_database, connect_to_aiml_mongo
from app.api.v1.aiml.services.code_analyzer import CodeAnalyzer


async def debug_evaluation_scoring(test_id: str, user_id: str, question_id: str):
    """Debug why evaluation is scoring incorrectly"""
    
    await connect_to_aiml_mongo()
    db = get_aiml_database()
    
    print("=" * 80)
    print("DEBUG: EVALUATION SCORING ISSUE")
    print("=" * 80)
    print()
    
    # Get question
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not question:
        print(f"[ERROR] Question {question_id} not found")
        return
    
    print(f"Question: {question.get('title', 'N/A')}")
    print(f"Question ID: {question_id}")
    print()
    
    # Get test_cases
    test_cases = question.get("test_cases", [])
    print(f"Test Cases Count: {len(test_cases)}")
    print()
    
    print("=" * 80)
    print("TEST CASES ANALYSIS:")
    print("=" * 80)
    for idx, tc in enumerate(test_cases, 1):
        print(f"\nTest Case {idx}:")
        print(f"  task_number: {tc.get('task_number')}")
        print(f"  description: {tc.get('description', 'N/A')}")
        print(f"  validation_type: {tc.get('validation_type')}")
        print(f"  expected_output: {tc.get('expected_output')}")
        print(f"  points: {tc.get('points')}")
        print()
    
    # Get submission
    submission = await db.test_submissions.find_one({
        "test_id": test_id,
        "user_id": user_id
    })
    
    if not submission:
        print("[ERROR] Submission not found")
        return
    
    submissions_list = submission.get("submissions", [])
    question_submission = None
    for sub in submissions_list:
        if str(sub.get("question_id")) == question_id:
            question_submission = sub
            break
    
    if not question_submission:
        print("[ERROR] Question submission not found")
        return
    
    source_code = question_submission.get("source_code", "")
    outputs = question_submission.get("outputs", [])
    
    print("=" * 80)
    print("SUBMITTED CODE:")
    print("=" * 80)
    print(source_code)
    print()
    
    print("=" * 80)
    print("SUBMITTED OUTPUTS:")
    print("=" * 80)
    for idx, output in enumerate(outputs, 1):
        print(f"Output {idx}:")
        print(output)
        print()
    
    # Run CodeAnalyzer
    print("=" * 80)
    print("CODE ANALYZER RESULTS:")
    print("=" * 80)
    analyzer = CodeAnalyzer(source_code)
    
    print(f"Imports found: {analyzer.get_imports()}")
    print(f"Function calls found: {analyzer.get_function_calls()}")
    print(f"Has dataset loading: {analyzer.has_dataset_loading()}")
    print(f"Has model training: {analyzer.has_model_training()}")
    print(f"Has cross-validation: {analyzer.has_cross_validation()}")
    print()
    
    # Test each validation type
    print("=" * 80)
    print("TEST CASE VALIDATION RESULTS:")
    print("=" * 80)
    
    combined_output = "\n".join(outputs).lower()
    source_code_lower = source_code.lower()
    
    for idx, tc in enumerate(test_cases, 1):
        task_num = tc.get("task_number", 0)
        validation_type = tc.get("validation_type", "").lower()
        expected_output = tc.get("expected_output", "")
        points = float(tc.get("points", 0))
        description = tc.get("description", "")
        
        print(f"\n{'='*80}")
        print(f"Test Case {idx}: {description}")
        print(f"{'='*80}")
        print(f"Validation Type: {validation_type}")
        print(f"Expected Output: {expected_output}")
        print(f"Points: {points}")
        print()
        
        score = 0.0
        passed = False
        feedback = ""
        
        if validation_type == "exact_match":
            if expected_output.lower() in combined_output:
                score = points
                passed = True
                feedback = f"✅ Exact match found"
            else:
                feedback = f"❌ Exact match not found. Looking for: {expected_output}"
        
        elif validation_type == "contains":
            if expected_output.lower() in combined_output:
                score = points
                passed = True
                feedback = f"✅ Contains found"
            else:
                feedback = f"❌ Contains not found. Looking for: {expected_output}"
        
        elif validation_type == "numeric_range":
            # Extract numbers from output
            import re
            numbers = re.findall(r'-?\d+\.?\d*', combined_output)
            if numbers:
                try:
                    num = float(numbers[0])
                    if isinstance(expected_output, str) and "-" in expected_output:
                        min_val, max_val = map(float, expected_output.split("-"))
                        if min_val <= num <= max_val:
                            score = points
                            passed = True
                            feedback = f"✅ Number {num} is in range [{min_val}, {max_val}]"
                        else:
                            feedback = f"❌ Number {num} is NOT in range [{min_val}, {max_val}]"
                except:
                    feedback = f"❌ Could not parse numeric value"
            else:
                feedback = f"❌ No numbers found in output"
        
        elif validation_type == "code_check":
            # String matching (old method)
            if isinstance(expected_output, list):
                found = any(str(item).lower() in source_code_lower for item in expected_output)
            elif isinstance(expected_output, str) and "|" in expected_output:
                keywords = expected_output.lower().split("|")
                found = any(keyword.strip() in source_code_lower for keyword in keywords)
            else:
                found = str(expected_output).lower() in source_code_lower
            
            if found:
                score = points
                passed = True
                feedback = f"[OK] Code pattern found: {expected_output}"
            else:
                feedback = f"[FAIL] Code pattern not found: {expected_output}"
        
        elif validation_type == "import_check":
            if analyzer.verify_import(expected_output):
                score = points
                passed = True
                feedback = f"[OK] Required import found: {expected_output}"
            else:
                feedback = f"[FAIL] Missing import: {expected_output}"
                print(f"   Available imports: {analyzer.get_imports()}")
        
        elif validation_type == "function_call_check":
            if analyzer.verify_function_call(expected_output):
                score = points
                passed = True
                feedback = f"[OK] Function called: {expected_output}"
            else:
                feedback = f"[FAIL] Function not called: {expected_output}"
                print(f"   Available function calls: {analyzer.get_function_calls()}")
        
        elif validation_type == "dataset_load_check":
            if analyzer.has_dataset_loading():
                score = points
                passed = True
                feedback = f"[OK] Dataset loading code detected"
            else:
                feedback = f"[FAIL] No dataset loading code found"
        
        elif validation_type == "model_training_check":
            if analyzer.has_model_training():
                score = points
                passed = True
                feedback = f"[OK] Model training code detected (.fit())"
            else:
                feedback = f"[FAIL] No model training code found"
        
        elif validation_type == "output_structure_check":
            has_numeric = any(char.isdigit() for char in combined_output)
            has_array_like = '[' in combined_output or 'array' in combined_output.lower()
            has_dataframe = 'dataframe' in combined_output.lower() or '|' in combined_output
            
            if expected_output == "numeric" and has_numeric:
                score = points
                passed = True
                feedback = f"✅ Output contains numeric data"
            elif expected_output == "contains_array" and has_array_like:
                score = points
                passed = True
                feedback = f"✅ Output contains array-like structure"
            elif expected_output == "contains_dataframe" and has_dataframe:
                score = points
                passed = True
                feedback = f"✅ Output contains DataFrame structure"
            else:
                feedback = f"❌ Output doesn't match expected structure: {expected_output}"
        
        else:
            feedback = f"❌ Unknown validation type: {validation_type}"
        
        print(f"Result: {'[PASSED]' if passed else '[FAILED]'}")
        print(f"Score: {score}/{points}")
        print(f"Feedback: {feedback}")
    
    # Calculate total score
    print()
    print("=" * 80)
    print("SCORING SUMMARY:")
    print("=" * 80)
    
    total_score = 0.0
    total_points = 0.0
    
    for tc in test_cases:
        validation_type = tc.get("validation_type", "").lower()
        expected_output = tc.get("expected_output", "")
        points = float(tc.get("points", 0))
        total_points += points
        
        # Re-run validation
        score = 0.0
        if validation_type == "import_check":
            if analyzer.verify_import(expected_output):
                score = points
        elif validation_type == "function_call_check":
            if analyzer.verify_function_call(expected_output):
                score = points
        elif validation_type == "dataset_load_check":
            if analyzer.has_dataset_loading():
                score = points
        elif validation_type == "model_training_check":
            if analyzer.has_model_training():
                score = points
        elif validation_type == "code_check":
            if isinstance(expected_output, list):
                found = any(str(item).lower() in source_code_lower for item in expected_output)
            elif isinstance(expected_output, str) and "|" in expected_output:
                keywords = expected_output.lower().split("|")
                found = any(keyword.strip() in source_code_lower for keyword in keywords)
            else:
                found = str(expected_output).lower() in source_code_lower
            if found:
                score = points
        elif validation_type == "contains":
            if expected_output.lower() in combined_output:
                score = points
        elif validation_type == "exact_match":
            if expected_output.lower() in combined_output:
                score = points
        
        total_score += score
    
    print(f"Total Score: {total_score}/{total_points} ({round((total_score/total_points)*100, 2) if total_points > 0 else 0}%)")
    print()
    
    # Get current evaluation result
    print("=" * 80)
    print("CURRENT EVALUATION RESULT:")
    print("=" * 80)
    
    evaluations = submission.get("evaluations", [])
    for eval_result in evaluations:
        if str(eval_result.get("question_id")) == question_id:
            print(f"Overall Score: {eval_result.get('score', 0)}")
            feedback = eval_result.get("feedback", {})
            print(f"Feedback Overall Score: {feedback.get('overall_score', 0)}")
            task_scores = feedback.get("task_scores", [])
            print(f"\nTask Scores:")
            for ts in task_scores:
                print(f"  Task {ts.get('task_number')}: {ts.get('score')}/{ts.get('max_score')} - {ts.get('status')}")
                print(f"    Feedback: {ts.get('feedback', '')[:100]}")
            break


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python debug_evaluation_scoring.py <test_id> <user_id> <question_id>")
        print("Example: python debug_evaluation_scoring.py 698c310b7ab64ff48afe4a8e 697b5e693272fc7bd19955c4 698c30757ab64ff48afe4a8d")
        sys.exit(1)
    
    test_id = sys.argv[1]
    user_id = sys.argv[2]
    question_id = sys.argv[3]
    asyncio.run(debug_evaluation_scoring(test_id, user_id, question_id))
