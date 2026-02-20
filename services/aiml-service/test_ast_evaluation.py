"""
End-to-end test script for AST-based AIML evaluation system
Tests fake code vs real code to verify AST validation works correctly
"""
import asyncio
import json
import sys
import os
import io

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.api.v1.aiml.services.ai_question_generator import generate_aiml_question
from app.api.v1.aiml.services.ai_feedback import generate_aiml_feedback


async def test_ast_evaluation():
    """Test AST-based evaluation with fake and real code"""
    
    print("=" * 80)
    print("AST-BASED EVALUATION SYSTEM - END-TO-END TEST")
    print("=" * 80)
    print()
    
    # STEP 1: Generate Test Question
    print("STEP 1: Generating Test Question")
    print("-" * 80)
    
    try:
        generated_data = await generate_aiml_question(
            title="Text Classification with Model Comparison",
            skill="Machine Learning",
            topic="Text Classification with Model Comparison",
            difficulty="medium",
            dataset_format="csv"
        )
        
        question_id = "test-question-generated"
        test_cases = generated_data.get("test_cases", [])
        question_info = generated_data.get("question", {})
        tasks = question_info.get("tasks", [])
        constraints = question_info.get("constraints", [])
        dataset_info = generated_data.get("dataset")
        
        print(f"[OK] Question Generated Successfully")
        print(f"   Question ID: {question_id}")
        print(f"   Title: {generated_data.get('assessment', {}).get('title', 'N/A')}")
        print(f"   Number of tasks: {len(tasks)}")
        print(f"   Number of test_cases: {len(test_cases)}")
        print()
        
        # Analyze test_cases
        total_points = sum(tc.get("points", 0) for tc in test_cases)
        code_validation_count = sum(1 for tc in test_cases if tc.get("validation_type") in [
            "import_check", "function_call_check", "dataset_load_check", 
            "model_training_check", "code_check"
        ])
        output_validation_count = sum(1 for tc in test_cases if tc.get("validation_type") in [
            "exact_match", "contains", "numeric_range", "output_structure_check"
        ])
        
        print("Test Cases Analysis:")
        print(f"   Total points: {total_points:.2f} (should be 100)")
        print(f"   Code validation checks: {code_validation_count}")
        print(f"   Output validation checks: {output_validation_count}")
        print()
        
        print("Complete test_cases array:")
        print(json.dumps(test_cases, indent=2))
        print()
        
    except Exception as e:
        print(f"[ERROR] Error generating question: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # STEP 2: Test with FAKE Code
    print("=" * 80)
    print("STEP 2: Testing with FAKE Code (Print Statements Only)")
    print("-" * 80)
    
    fake_code = """print("Loading dataset with pandas")
print("Using TfidfVectorizer for text preprocessing")
print("Cross-validation scores: [0.82, 0.85, 0.83, 0.84, 0.86]")
print("Model training complete")
print("Final accuracy: 0.84")"""
    
    fake_outputs = [
        "Loading dataset with pandas",
        "Using TfidfVectorizer for text preprocessing",
        "Cross-validation scores: [0.82, 0.85, 0.83, 0.84, 0.86]",
        "Model training complete",
        "Final accuracy: 0.84"
    ]
    
    print("Fake Code:")
    print(fake_code)
    print()
    
    try:
        fake_result = generate_aiml_feedback(
            source_code=fake_code,
            outputs=fake_outputs,
            question_title=generated_data.get("assessment", {}).get("title", "Test Question"),
            question_description=question_info.get("description", ""),
            tasks=tasks,
            constraints=constraints,
            difficulty="medium",
            skill="Machine Learning",
            dataset_info=dataset_info,
            test_cases=test_cases
        )
        
        print("[OK] Fake Code Evaluation Completed")
        print(f"   Overall Score: {fake_result.get('overall_score', 0)}/100")
        print()
        
        print("Task Scores:")
        for task_score in fake_result.get("task_scores", []):
            print(f"   Task {task_score.get('task_number', 'N/A')}: "
                  f"{task_score.get('score', 0)}/{task_score.get('max_score', 0)} "
                  f"({task_score.get('status', 'unknown')})")
            feedback_text = task_score.get('feedback', 'N/A')[:100]
            # Remove emojis for Windows compatibility
            feedback_text = feedback_text.encode('ascii', 'ignore').decode('ascii')
            print(f"      Feedback: {feedback_text}...")
        print()
        
        # Analyze which test cases passed/failed
        print("Test Case Results (Fake Code):")
        fake_validation_results = {}
        for tc in test_cases:
            validation_type = tc.get("validation_type", "")
            # Find matching task score
            task_num = tc.get("task_number", 0)
            matching_score = next(
                (ts for ts in fake_result.get("task_scores", []) 
                 if ts.get("task_number") == task_num), 
                None
            )
            if matching_score:
                score = matching_score.get("score", 0)
                max_score = matching_score.get("max_score", 0)
                passed = score > 0
                fake_validation_results[validation_type] = {
                    "passed": passed,
                    "score": score,
                    "max_score": max_score,
                    "description": tc.get("description", "")
                }
                status = "[PASS]" if passed else "[FAIL]"
                print(f"   {status} - {validation_type}: {tc.get('description', 'N/A')} "
                      f"({score}/{max_score} points)")
        
        print()
        
    except Exception as e:
        print(f"[ERROR] Error evaluating fake code: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # STEP 3: Test with REAL Code
    print("=" * 80)
    print("STEP 3: Testing with REAL Code (Actual Implementation)")
    print("-" * 80)
    
    real_code = """import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import cross_val_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier

df = pd.read_csv('dataset.csv')
vectorizer = TfidfVectorizer()
X = vectorizer.fit_transform(df['text'])
y = df['label']

models = [LogisticRegression(), RandomForestClassifier()]
for model in models:
    scores = cross_val_score(model, X, y, cv=5)
    print(f"{model.__class__.__name__}: {scores.mean():.3f}")

final_model = LogisticRegression()
final_model.fit(X, y)
print("Training complete")"""
    
    real_outputs = [
        "LogisticRegression: 0.842",
        "RandomForestClassifier: 0.856",
        "Training complete"
    ]
    
    print("Real Code:")
    print(real_code)
    print()
    
    try:
        real_result = generate_aiml_feedback(
            source_code=real_code,
            outputs=real_outputs,
            question_title=generated_data.get("assessment", {}).get("title", "Test Question"),
            question_description=question_info.get("description", ""),
            tasks=tasks,
            constraints=constraints,
            difficulty="medium",
            skill="Machine Learning",
            dataset_info=dataset_info,
            test_cases=test_cases
        )
        
        print("[OK] Real Code Evaluation Completed")
        print(f"   Overall Score: {real_result.get('overall_score', 0)}/100")
        print()
        
        print("Task Scores:")
        for task_score in real_result.get("task_scores", []):
            print(f"   Task {task_score.get('task_number', 'N/A')}: "
                  f"{task_score.get('score', 0)}/{task_score.get('max_score', 0)} "
                  f"({task_score.get('status', 'unknown')})")
            feedback_text = task_score.get('feedback', 'N/A')[:100]
            # Remove emojis for Windows compatibility
            feedback_text = feedback_text.encode('ascii', 'ignore').decode('ascii')
            print(f"      Feedback: {feedback_text}...")
        print()
        
        # Analyze which test cases passed/failed
        print("Test Case Results (Real Code):")
        real_validation_results = {}
        for tc in test_cases:
            validation_type = tc.get("validation_type", "")
            task_num = tc.get("task_number", 0)
            matching_score = next(
                (ts for ts in real_result.get("task_scores", []) 
                 if ts.get("task_number") == task_num), 
                None
            )
            if matching_score:
                score = matching_score.get("score", 0)
                max_score = matching_score.get("max_score", 0)
                passed = score > 0
                real_validation_results[validation_type] = {
                    "passed": passed,
                    "score": score,
                    "max_score": max_score,
                    "description": tc.get("description", "")
                }
                status = "[PASS]" if passed else "[FAIL]"
                print(f"   {status} - {validation_type}: {tc.get('description', 'N/A')} "
                      f"({score}/{max_score} points)")
        
        print()
        
    except Exception as e:
        print(f"[ERROR] Error evaluating real code: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # STEP 4: Comparison Summary
    print("=" * 80)
    print("STEP 4: Comparison Summary")
    print("-" * 80)
    print()
    
    print("Validation Check Comparison:")
    print(f"{'Validation Check':<30} {'Fake Code':<15} {'Real Code':<15}")
    print("-" * 60)
    
    # Get all unique validation types
    all_validation_types = set()
    for tc in test_cases:
        all_validation_types.add(tc.get("validation_type", ""))
    
    comparison_data = []
    for validation_type in sorted(all_validation_types):
        fake_result_item = fake_validation_results.get(validation_type, {})
        real_result_item = real_validation_results.get(validation_type, {})
        
        fake_status = "[PASS]" if fake_result_item.get("passed", False) else "[FAIL]"
        real_status = "[PASS]" if real_result_item.get("passed", False) else "[FAIL]"
        
        print(f"{validation_type:<30} {fake_status:<15} {real_status:<15}")
        
        comparison_data.append({
            "validation_type": validation_type,
            "fake_passed": fake_result_item.get("passed", False),
            "real_passed": real_result_item.get("passed", False)
        })
    
    print()
    print(f"{'TOTAL SCORE':<30} {fake_result.get('overall_score', 0):<15} {real_result.get('overall_score', 0):<15}")
    print()
    
    # Analysis
    fake_score = fake_result.get("overall_score", 0)
    real_score = real_result.get("overall_score", 0)
    
    print("Analysis:")
    if fake_score <= 20:
        print(f"[PASS] Fake code correctly scored low ({fake_score}/100)")
    else:
        print(f"[FAIL] Fake code scored too high ({fake_score}/100) - should be <=20")
        print("   Issues detected:")
        for item in comparison_data:
            if item["fake_passed"] and item["validation_type"] in [
                "import_check", "function_call_check", "dataset_load_check", 
                "model_training_check"
            ]:
                print(f"      - {item['validation_type']} incorrectly passed for fake code")
    
    if real_score >= 80:
        print(f"[PASS] Real code correctly scored high ({real_score}/100)")
    else:
        print(f"[WARNING] Real code scored lower than expected ({real_score}/100) - should be >=80")
    
    print()
    print("=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(test_ast_evaluation())
