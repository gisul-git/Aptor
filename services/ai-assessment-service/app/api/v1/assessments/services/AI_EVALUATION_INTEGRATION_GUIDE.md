# AI Evaluation Integration Guide

This guide explains how to integrate the unified AI evaluation system into your submission endpoints.

## Overview

The unified AI evaluation service (`unified_ai_evaluation.py`) provides comprehensive evaluation for all question types:
- ✅ Subjective
- ✅ Pseudocode (NEW)
- ✅ Coding (Enhanced)
- ✅ SQL (NEW)
- ⚠️ MCQ (automatic, no AI needed)
- ⚠️ AIML (uses existing service)

## Quick Start

### 1. Import the Service

```python
from .services.unified_ai_evaluation import (
    evaluate_question_by_type,
    evaluate_pseudocode_answer,
    evaluate_sql_answer,
    evaluate_coding_answer_enhanced,
    evaluate_subjective_answer_enhanced,
    aggregate_section_evaluation,
    generate_overall_assessment_summary
)
```

### 2. Evaluate Individual Questions

#### For Pseudocode Questions

```python
evaluation = await evaluate_pseudocode_answer(
    question_id=str(question["_id"]),
    question_text=question.get("questionText", ""),
    candidate_answer=submission.get("textAnswer", ""),
    max_marks=question.get("marks", 1),
    section=section_name,
    sample_input=question.get("sampleInput"),
    expected_output=question.get("expectedOutput"),
    rubric=question.get("rubric"),
    difficulty=question.get("difficulty", "Medium")
)
```

#### For SQL Questions

```python
# First, execute SQL via Judge0 (existing code)
test_result = await execute_sql_with_judge0(user_sql_script)
reference_result = await execute_sql_with_judge0(reference_script)
passed = compare_sql_results(user_result, reference_result, order_sensitive)

# Then, evaluate with AI
evaluation = await evaluate_sql_answer(
    question_id=str(question["_id"]),
    question_description=question.get("questionText", ""),
    user_query=submission.get("sql_query", ""),
    reference_query=question.get("reference_query"),
    max_marks=question.get("marks", 1),
    section=section_name,
    schemas=question.get("schemas"),
    test_result={
        "passed": passed,
        "user_result": user_result,
        "reference_result": reference_result
    },
    order_sensitive=question.get("evaluation", {}).get("order_sensitive", False),
    difficulty=question.get("difficulty", "Medium")
)
```

#### For Coding Questions (Enhanced)

```python
# First, execute code via Judge0 (existing code)
test_results = await run_all_test_cases(
    source_code=submission.get("code", ""),
    language_id=language_id,
    test_cases=all_testcases
)

passed_count = sum(1 for t in test_results["results"] if t.get("passed", False))
total_count = len(test_results["results"])

# Then, evaluate with enhanced AI
evaluation = await evaluate_coding_answer_enhanced(
    question_id=str(question["_id"]),
    problem_statement=question.get("questionText", ""),
    source_code=submission.get("code", ""),
    language=question.get("codingLanguage", "python"),
    max_marks=question.get("marks", 1),
    section=section_name,
    test_results=test_results["results"],
    passed_count=passed_count,
    total_count=total_count,
    starter_code=question.get("starterCode"),
    difficulty=question.get("difficulty", "Medium")
)
```

#### For Subjective Questions (Enhanced)

```python
evaluation = await evaluate_subjective_answer_enhanced(
    question_id=str(question["_id"]),
    question=question.get("question", ""),
    answer=submission.get("textAnswer", ""),
    max_marks=question.get("marks", 1),
    section=section_name,
    rubric=question.get("rubric"),
    answer_key=question.get("answerKey"),
    difficulty=question.get("difficulty", "Medium")
)
```

### 3. Using the Convenience Function

For easier integration, use `evaluate_question_by_type`:

```python
evaluation = await evaluate_question_by_type(
    question_id=str(question["_id"]),
    question_type=question.get("type", ""),
    question_data=question,
    candidate_answer=submission,
    max_marks=question.get("marks", 1),
    section=section_name,
    # Additional kwargs based on question type:
    test_results=test_results.get("results"),  # For coding
    passed_count=passed_count,  # For coding
    total_count=total_count,  # For coding
    test_result=sql_test_result,  # For SQL
    rubric=question.get("rubric"),  # For subjective/pseudocode
    answer_key=question.get("answerKey")  # For subjective
)
```

### 4. Aggregate Section Evaluations

```python
# After evaluating all questions in a section
section_evaluations = [eval1, eval2, eval3, ...]  # List of question evaluations

section_summary = await aggregate_section_evaluation(
    section_name="Data Structures",
    question_evaluations=section_evaluations
)
```

### 5. Generate Overall Assessment Summary

```python
# After evaluating all questions and sections
all_question_evaluations = []  # All question evaluations across all sections
section_summaries = []  # All section summaries

overall_summary = await generate_overall_assessment_summary(
    section_summaries=section_summaries,
    question_evaluations=all_question_evaluations,
    job_role="Software Engineer"  # Optional
)
```

## Integration Example: Custom MCQ Assessment

Here's how to integrate into `custom_mcq/routers.py`:

```python
from ...assessments.services.unified_ai_evaluation import (
    evaluate_question_by_type,
    aggregate_section_evaluation,
    generate_overall_assessment_summary
)

@router.post("/submit")
async def submit_custom_mcq_assessment(
    request: SubmitCustomMCQRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> Dict[str, Any]:
    # ... existing code ...
    
    # Separate submissions by type
    mcq_submissions = []
    subjective_submissions = []
    pseudocode_submissions = []  # NEW
    
    for submission in request.submissions:
        question = questions_dict.get(submission.questionId)
        if not question:
            continue
        
        question_type = question.get("questionType", "").lower()
        
        if question_type == "mcq":
            mcq_submissions.append({...})
        elif question_type == "subjective":
            subjective_submissions.append({...})
        elif question_type == "pseudocode":  # NEW
            pseudocode_submissions.append({
                "questionId": submission.questionId,
                "question": question,
                "answer": submission.get("textAnswer", ""),
                "max_marks": question.get("marks", 1)
            })
    
    # Grade MCQ (automatic)
    # ... existing MCQ grading code ...
    
    # Grade Subjective (AI)
    subjective_evaluations = []
    for sub in subjective_submissions:
        evaluation = await evaluate_subjective_answer_enhanced(
            question_id=sub["questionId"],
            question=sub["question"].get("question", ""),
            answer=sub["answer"],
            max_marks=sub["max_marks"],
            section=None
        )
        subjective_evaluations.append(evaluation)
        # Update graded_submissions with evaluation data
    
    # Grade Pseudocode (AI) - NEW
    pseudocode_evaluations = []
    for sub in pseudocode_submissions:
        evaluation = await evaluate_pseudocode_answer(
            question_id=sub["questionId"],
            question_text=sub["question"].get("questionText", ""),
            candidate_answer=sub["answer"],
            max_marks=sub["max_marks"],
            section=None
        )
        pseudocode_evaluations.append(evaluation)
        # Update graded_submissions with evaluation data
    
    # Aggregate and generate summary
    all_evaluations = subjective_evaluations + pseudocode_evaluations
    section_summary = await aggregate_section_evaluation(
        section_name="Assessment",
        question_evaluations=all_evaluations
    )
    
    overall_summary = await generate_overall_assessment_summary(
        section_summaries=[section_summary],
        question_evaluations=all_evaluations
    )
    
    # Store evaluation results in submission document
    # ... save to database ...
```

## Integration Example: DSA/SQL Assessment

Here's how to integrate into `dsa/routers/assessment.py`:

```python
from ...assessments.services.unified_ai_evaluation import (
    evaluate_sql_answer,
    evaluate_coding_answer_enhanced
)

@router.post("/assessment/submit-sql")
async def submit_sql(
    request: SubmitSQLRequest,
    user_id: str = Query(None),
):
    # ... existing Judge0 execution code ...
    
    # Execute user's SQL
    user_result = await execute_sql_with_judge0(user_sql_script)
    reference_result = await execute_sql_with_judge0(reference_script)
    passed = compare_sql_results(user_result, reference_result, order_sensitive)
    
    # NEW: AI Evaluation
    evaluation = await evaluate_sql_answer(
        question_id=request.question_id,
        question_description=question.get("questionText", ""),
        user_query=request.sql_query,
        reference_query=question.get("reference_query"),
        max_marks=question.get("marks", 100),
        section=None,
        schemas=question.get("schemas"),
        test_result={
            "passed": passed,
            "user_result": user_result,
            "reference_result": reference_result,
            "error": user_result.get("error") if not passed else None
        },
        order_sensitive=order_sensitive,
        difficulty=question.get("difficulty", "Medium")
    )
    
    # Store evaluation in submission
    submission_data = {
        "question_id": request.question_id,
        "sql_query": request.sql_query,
        "test_passed": passed,
        "score": evaluation["score"],
        "ai_evaluation": evaluation,  # Store full evaluation
        "submitted_at": datetime.utcnow()
    }
    
    # ... save to database ...
```

## Storing Evaluation Results

### Database Schema

Store evaluation results in your submission documents:

```python
{
    "assessment_id": ObjectId,
    "candidate_id": ObjectId,
    "submission_timestamp": datetime,
    
    "question_evaluations": [
        {
            "question_id": ObjectId,
            "evaluation": {
                # Full evaluation object from AI
                "score": float,
                "max_marks": float,
                "percentage": float,
                "criteria_scores": {...},
                "feedback": {...},
                "answer_log": {...},
                "areas_of_improvement": [...],
                "benchmarking": {...},
                "insights": {...},
                "flags": {...}
            },
            "evaluated_at": datetime,
            "evaluator": "AI",
            "ai_confidence": float
        }
    ],
    
    "section_summaries": [
        {
            "section_name": str,
            "section_score": float,
            "section_percentage": float,
            "section_performance": {...},
            "skill_breakdown": [...]
        }
    ],
    
    "overall_evaluation": {
        "overall_score": float,
        "overall_percentage": float,
        "grade": str,
        "section_wise_performance": [...],
        "skill_matrix": [...],
        "overall_strengths": [...],
        "overall_weaknesses": [...],
        "comprehensive_improvement_plan": {...},
        "personalized_recommendations": {...},
        "readiness_assessment": {...}
    },
    
    "evaluation_metadata": {
        "ai_model_used": "gpt-4o-mini",
        "evaluation_version": "1.0",
        "total_evaluation_time_ms": int,
        "requires_human_review": bool,
        "human_reviewed": bool
    }
}
```

### Example: Saving Evaluation

```python
# After evaluating all questions
submission_doc = {
    "assessment_id": assessment_id,
    "candidate_id": candidate_id,
    "submission_timestamp": datetime.utcnow(),
    "question_evaluations": [
        {
            "question_id": eval["question_id"],
            "evaluation": eval,
            "evaluated_at": datetime.utcnow(),
            "evaluator": "AI",
            "ai_confidence": eval.get("flags", {}).get("confidence_level", 0.8)
        }
        for eval in all_evaluations
    ],
    "section_summaries": section_summaries,
    "overall_evaluation": overall_summary,
    "evaluation_metadata": {
        "ai_model_used": "gpt-4o-mini",
        "evaluation_version": "1.0",
        "total_evaluation_time_ms": evaluation_time_ms,
        "requires_human_review": any(
            eval.get("flags", {}).get("requires_human_review", False)
            for eval in all_evaluations
        ),
        "human_reviewed": False
    }
}

await db.submissions.insert_one(submission_doc)
```

## Error Handling

The evaluation functions handle errors gracefully:

```python
try:
    evaluation = await evaluate_pseudocode_answer(...)
except Exception as e:
    logger.error(f"AI evaluation failed: {e}")
    # Fallback to basic scoring or manual review
    evaluation = {
        "score": 0.0,
        "max_marks": max_marks,
        "percentage": 0.0,
        "feedback": {
            "summary": "Evaluation failed. Requires manual review.",
            "strengths": [],
            "weaknesses": [],
            "detailed_analysis": "",
            "suggestions": []
        },
        "flags": {
            "requires_human_review": True,
            "confidence_level": 0.0
        }
    }
```

## Performance Considerations

1. **Async Execution**: All evaluation functions are async - use `await`
2. **Background Tasks**: For large assessments, consider background tasks
3. **Caching**: Consider caching evaluations for identical answers
4. **Rate Limiting**: Be aware of OpenAI API rate limits
5. **Batch Processing**: Evaluate questions in parallel when possible

## Testing

Test the integration:

```python
# Test pseudocode evaluation
evaluation = await evaluate_pseudocode_answer(
    question_id="test-1",
    question_text="Design an algorithm to find the maximum element in an array.",
    candidate_answer="1. Initialize max = arr[0]\n2. Loop through array\n3. If arr[i] > max, update max\n4. Return max",
    max_marks=10,
    section="Algorithms"
)

assert evaluation["score"] >= 0
assert evaluation["score"] <= 10
assert "feedback" in evaluation
assert "criteria_scores" in evaluation
```

## Next Steps

1. Integrate into submission endpoints
2. Add database storage for evaluations
3. Create API endpoints to retrieve evaluations
4. Add UI components to display detailed feedback
5. Implement human review workflow for flagged evaluations


