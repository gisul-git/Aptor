"""
Debug script for AST-based evaluation system
Analyzes why an evaluation scored 33.33/100
"""
import asyncio
import sys
import os
import json

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bson import ObjectId
from app.api.v1.aiml.database import get_aiml_database, connect_to_aiml_mongo
from app.api.v1.aiml.services.code_analyzer import CodeAnalyzer


async def debug_evaluation(test_id: str):
    # Initialize database connection
    await connect_to_aiml_mongo()
    """Debug evaluation result for a specific test"""
    
    print("=" * 80)
    print("EVALUATION DEBUG - AST-BASED VALIDATION")
    print("=" * 80)
    print()
    
    db = get_aiml_database()
    
    # Get test submission
    submission = await db.test_submissions.find_one({"test_id": test_id})
    if not submission:
        print(f"[ERROR] Test submission not found for test_id: {test_id}")
        return
    
    print(f"Test ID: {test_id}")
    print(f"User ID: {submission.get('user_id')}")
    print(f"AI Feedback Status: {submission.get('ai_feedback_status', 'unknown')}")
    print()
    
    # Get evaluations
    evaluations = submission.get("evaluations", [])
    if not evaluations:
        print("[ERROR] No evaluations found in submission")
        return
    
    print(f"Number of evaluations: {len(evaluations)}")
    print()
    
    # Analyze each evaluation
    for idx, eval_data in enumerate(evaluations):
        print("=" * 80)
        print(f"EVALUATION {idx + 1}")
        print("=" * 80)
        
        question_id = eval_data.get("question_id")
        feedback = eval_data.get("feedback", {})
        
        print(f"Question ID: {question_id}")
        print(f"Overall Score: {feedback.get('overall_score', 0)}/100")
        print()
        
        # Get question to see test_cases
        question = await db.questions.find_one({"_id": ObjectId(question_id)})
        if not question:
            print(f"[ERROR] Question {question_id} not found")
            continue
        
        test_cases = question.get("test_cases", [])
        print(f"Question Title: {question.get('title', 'N/A')}")
        print(f"Number of test_cases: {len(test_cases)}")
        print()
        
        # Show test_cases
        print("TEST CASES IN QUESTION:")
        print("-" * 80)
        for tc in test_cases:
            print(f"  Task {tc.get('task_number', 'N/A')}: {tc.get('validation_type', 'N/A')}")
            print(f"    Description: {tc.get('description', 'N/A')}")
            print(f"    Expected Output: {tc.get('expected_output', 'N/A')}")
            print(f"    Points: {tc.get('points', 0)}")
            print()
        
        # Show task scores
        task_scores = feedback.get("task_scores", [])
        print("TASK SCORES FROM EVALUATION:")
        print("-" * 80)
        for ts in task_scores:
            print(f"  Task {ts.get('task_number', 'N/A')}: {ts.get('score', 0)}/{ts.get('max_score', 0)}")
            print(f"    Status: {ts.get('status', 'unknown')}")
            print(f"    Feedback: {ts.get('feedback', 'N/A')[:150]}...")
            print()
        
        # Get source code
        submissions_list = submission.get("submissions", [])
        question_submission = next(
            (s for s in submissions_list if str(s.get("question_id")) == question_id),
            None
        )
        
        if not question_submission:
            print("[ERROR] Question submission not found")
            continue
        
        source_code = question_submission.get("source_code", "")
        outputs = question_submission.get("outputs", [])
        
        print("SUBMITTED CODE:")
        print("-" * 80)
        print(source_code[:500] + "..." if len(source_code) > 500 else source_code)
        print()
        
        print("OUTPUTS:")
        print("-" * 80)
        for i, output in enumerate(outputs):
            print(f"Output {i+1}: {output[:200]}...")
        print()
        
        # Debug code analyzer
        print("=" * 80)
        print("CODE ANALYZER DEBUG")
        print("=" * 80)
        
        analyzer = CodeAnalyzer(source_code)
        
        print("Imports found:")
        imports = analyzer.get_imports()
        for imp in sorted(imports):
            print(f"  - {imp}")
        print()
        
        print("Function calls found:")
        calls = analyzer.get_function_calls()
        for call in sorted(calls):
            print(f"  - {call}")
        print()
        
        print("Dataset loading check:")
        print(f"  has_dataset_loading(): {analyzer.has_dataset_loading()}")
        print()
        
        print("Model training check:")
        print(f"  has_model_training(): {analyzer.has_model_training()}")
        print()
        
        print("Cross-validation check:")
        print(f"  has_cross_validation(): {analyzer.has_cross_validation()}")
        print()
        
        # Test each validation type
        print("=" * 80)
        print("VALIDATION TYPE CHECKS")
        print("=" * 80)
        
        for tc in test_cases:
            validation_type = tc.get("validation_type", "")
            expected_output = tc.get("expected_output", "")
            description = tc.get("description", "")
            
            print(f"\nTest Case: {description}")
            print(f"  Validation Type: {validation_type}")
            print(f"  Expected Output: {expected_output}")
            
            if validation_type == "import_check":
                result = analyzer.verify_import(expected_output)
                print(f"  Result: {'PASS' if result else 'FAIL'}")
                if not result:
                    print(f"  Debug: Checking for '{expected_output}' in imports")
                    print(f"    Available imports: {list(imports)}")
            
            elif validation_type == "function_call_check":
                result = analyzer.verify_function_call(expected_output)
                print(f"  Result: {'PASS' if result else 'FAIL'}")
                if not result:
                    print(f"  Debug: Checking for '{expected_output}' in function calls")
                    print(f"    Available calls: {list(calls)}")
            
            elif validation_type == "dataset_load_check":
                result = analyzer.has_dataset_loading()
                print(f"  Result: {'PASS' if result else 'FAIL'}")
            
            elif validation_type == "model_training_check":
                result = analyzer.has_model_training()
                print(f"  Result: {'PASS' if result else 'FAIL'}")
            
            elif validation_type == "output_structure_check":
                combined_output = "\n".join(outputs).lower()
                has_numeric = any(char.isdigit() for char in combined_output)
                has_array_like = '[' in combined_output or 'array' in combined_output.lower()
                has_dataframe = 'dataframe' in combined_output.lower() or '|' in combined_output
                
                if expected_output == "numeric":
                    result = has_numeric
                elif expected_output == "contains_array":
                    result = has_array_like
                elif expected_output == "contains_dataframe":
                    result = has_dataframe
                else:
                    result = False
                
                print(f"  Result: {'PASS' if result else 'FAIL'}")
                print(f"  Debug: has_numeric={has_numeric}, has_array={has_array_like}, has_dataframe={has_dataframe}")
            
            elif validation_type == "code_check":
                source_lower = source_code.lower()
                if isinstance(expected_output, list):
                    result = any(str(item).lower() in source_lower for item in expected_output)
                elif isinstance(expected_output, str) and "|" in expected_output:
                    # Handle pipe-separated values
                    keywords = expected_output.lower().split("|")
                    result = any(keyword.strip() in source_lower for keyword in keywords)
                else:
                    result = str(expected_output).lower() in source_lower
                print(f"  Result: {'PASS' if result else 'FAIL'}")
                if not result:
                    print(f"  Debug: Checking for '{expected_output}' in source code")
                    print(f"    Source code contains 'TfidfVectorizer': {'TfidfVectorizer'.lower() in source_lower}")
                    print(f"    Source code contains 'GridSearchCV': {'GridSearchCV'.lower() in source_lower}")
            
            else:
                print(f"  Result: UNKNOWN VALIDATION TYPE")
        
        print()
        print("=" * 80)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python debug_evaluation.py <test_id>")
        print("Example: python debug_evaluation.py 698c310b7ab64ff48afe4a8e")
        sys.exit(1)
    
    test_id = sys.argv[1]
    asyncio.run(debug_evaluation(test_id))
