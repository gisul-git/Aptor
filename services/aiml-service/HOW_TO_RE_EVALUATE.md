# How to Re-Evaluate a Submission

## Method 1: Using the Re-Evaluation Script (Recommended)

I've created a script that will re-evaluate a submission and show you the updated component scores.

### Usage:

```bash
cd C:\aptor\Aptor\services\aiml-service

# Re-evaluate all questions for a submission
python re_evaluate_submission.py <test_id> <user_id>

# Re-evaluate a specific question
python re_evaluate_submission.py <test_id> <user_id> <question_id>
```

### Example:

```bash
# Re-evaluate all questions
python re_evaluate_submission.py 698c6be92f3c27c6e8ad66d3 697b5e693272fc7bd19955c4

# Re-evaluate specific question
python re_evaluate_submission.py 698c6be92f3c27c6e8ad66d3 697b5e693272fc7bd19955c4 698c6b922f3c27c6e8ad66d2
```

### What it does:

1. Finds the submission in the database
2. Re-runs the evaluation with the updated code
3. Shows you the new component scores:
   - Code Quality (0-25)
   - Library Usage (0-20)
   - Output Quality (0-15)
   - Overall Score (0-100)
4. Updates the database with the new scores

---

## Method 2: Using the API Endpoint Directly

You can also call the evaluation endpoint directly:

### Endpoint:
```
POST /api/v1/aiml/evaluate
```

### Request Body:
```json
{
  "source_code": "...",
  "outputs": ["..."],
  "question_title": "...",
  "question_description": "...",
  "tasks": ["..."],
  "constraints": ["..."],
  "difficulty": "medium",
  "test_cases": [...]
}
```

### Response:
```json
{
  "overall_score": 90,
  "code_quality": {
    "score": 23,
    "comments": "..."
  },
  "library_usage": {
    "score": 18,
    "comments": "..."
  },
  "output_quality": {
    "score": 12,
    "comments": "..."
  },
  ...
}
```

---

## Method 3: Automatic Re-Evaluation

When a candidate submits a test, evaluation happens automatically in the background. However, if you want to trigger it manually:

1. **Via Frontend**: The evaluation happens automatically when a test is submitted
2. **Via Database**: Update the `ai_feedback_status` to `"evaluating"` and the system will re-evaluate

---

## What Changed?

After the fix:
- ✅ Component scores are now calculated based on actual code quality
- ✅ Scores are proportional to overall_score
- ✅ Code Quality: 0-25 (based on structure, functions, comments)
- ✅ Library Usage: 0-20 (based on library imports and usage)
- ✅ Output Quality: 0-15 (based on output presence and quality)

Before the fix:
- ❌ Component scores were always 0
- ❌ Overall score was correct but components showed 0

---

## Verification

After re-evaluating, check:
1. Component scores are non-zero (if overall_score > 0)
2. Component scores are proportional to overall_score
3. Scores make sense (e.g., if overall_score = 90, components should be high)

Example for overall_score = 90:
- Code Quality: ~20-23/25 ✅
- Library Usage: ~16-18/20 ✅
- Output Quality: ~10-12/15 ✅
