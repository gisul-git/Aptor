# Evaluation Scoring Fix - Root Cause Analysis

## Problem Identified

Students with **correct code** are getting penalized with low scores (33.33/100) when they should score 85-90/100.

## Root Cause

### Issue 1: Test Cases Using `code_check` Instead of AST-Based Validation

**Current Problem:**
- Test cases are using `code_check` (simple string matching) instead of AST-based validation
- `code_check` matches strings ANYWHERE in code, including print statements
- Example: `print("GridSearchCV")` will pass `code_check` even though GridSearchCV was never actually used

**Example from Current Question:**
```json
{
  "validation_type": "code_check",
  "expected_output": "CountVectorizer|TfidfVectorizer",
  "points": 33.33
}
```

**Why This Fails:**
- If student writes: `print("Using TfidfVectorizer")` → PASSES (wrong!)
- If student writes: `from sklearn.feature_extraction.text import TfidfVectorizer` → PASSES (correct)
- Both pass, but only one is correct!

### Issue 2: CodeAnalyzer Not Being Used Properly

**Current State:**
- CodeAnalyzer exists and works correctly
- But test cases use `code_check` which bypasses CodeAnalyzer
- AST-based validation (`function_call_check`, `import_check`) is available but not being used

## Fix Applied

### 1. Updated Question Generation Prompt

**Changed:**
- Emphasized AST-based validation types as **PREFERRED**
- Added warnings against using `code_check` for function/class validation
- Updated examples to show AST-based validation

**New Prompt Instructions:**
```
**CRITICAL: PREFER AST-based validation over string matching for code verification**
* "import_check": ✅ PREFERRED - Verify import exists using AST
* "function_call_check": ✅ PREFERRED - Verify function was called using AST
* "code_check": ⚠️ AVOID - Only use for simple string patterns that can't be detected by AST
```

**Key Changes:**
- **NEVER use code_check for function/class names - use function_call_check instead**
- **NEVER use code_check for imports - use import_check instead**
- code_check can be fooled by print statements - AST validation checks actual code structure

### 2. Updated Examples in Prompt

**Before:**
```json
{
  "validation_type": "code_check",
  "expected_output": "cross_val_score"
}
```

**After:**
```json
{
  "validation_type": "function_call_check",
  "expected_output": "cross_val_score"
}
```

## Expected Behavior After Fix

### For Correct Code:
- **import_check**: Verifies actual imports using AST → ✅ Correct imports pass
- **function_call_check**: Verifies actual function calls using AST → ✅ Correct calls pass
- **model_training_check**: Verifies `.fit()` was called → ✅ Correct training passes
- **dataset_load_check**: Verifies dataset loading code → ✅ Correct loading passes

### For Fake Code (Print Statements Only):
- **import_check**: No imports found → ❌ Fails correctly
- **function_call_check**: No function calls found → ❌ Fails correctly
- **model_training_check**: No `.fit()` found → ❌ Fails correctly

## Scoring Breakdown

### Correct Submission Should Score:
- **Overall Score: 85-90/100**
- **Code Quality: 22/25** (well-organized, proper imports, good structure)
- **Library Usage: 18/20** (correct sklearn usage, appropriate algorithms)
- **Output Quality: 10/15** (outputs present, but model failed due to data size)
- **Task 1: 33.33/33.33** (✅ Complete - imports and preprocessing verified via AST)
- **Task 2: 33.33/33.33** (✅ Complete - cross-validation verified via AST)
- **Task 3: 25/33.34** (⚠️ Code correct, execution failed on small dataset)

## Action Required

### Immediate:
1. ✅ **Fix Applied**: Updated prompt to prefer AST-based validation
2. ⚠️ **Action Needed**: Regenerate questions with new prompt to get AST-based test_cases
3. ⚠️ **Action Needed**: Update existing questions manually or regenerate

### For New Questions:
- GPT will now generate AST-based test_cases automatically
- Test cases will use `function_call_check` instead of `code_check`
- Test cases will use `import_check` instead of `code_check` for imports

### For Existing Questions:
- Manually update test_cases to use AST-based validation
- Or regenerate questions using the updated prompt

## Verification

Run debug script to verify:
```bash
python debug_evaluation_scoring.py <test_id> <user_id> <question_id>
```

Check:
1. Test cases use `function_call_check` not `code_check`
2. Test cases use `import_check` not `code_check` for imports
3. CodeAnalyzer is detecting actual code structure
4. Scores match expected values for correct code

## Files Modified

1. `app/api/v1/aiml/services/ai_question_generator.py`
   - Updated prompt to emphasize AST-based validation
   - Updated examples to show AST-based validation
   - Added warnings against `code_check` misuse

2. `app/api/v1/aiml/services/ai_feedback.py`
   - Already supports AST-based validation (no changes needed)
   - CodeAnalyzer integration already exists

## Next Steps

1. **Test**: Generate a new question and verify test_cases use AST validation
2. **Update**: Manually fix existing questions or regenerate them
3. **Monitor**: Check evaluation scores for correct code submissions
4. **Document**: Update question generation guidelines
