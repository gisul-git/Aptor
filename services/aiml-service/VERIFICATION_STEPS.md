# Verification Steps for Submission Status Fix

## Immediate Actions

### 1. Restart the AIML Service
The CodeAnalyzer changes require a service restart to take effect.

```bash
# Stop the current service
# Then restart it (depends on your deployment method)
```

### 2. Clear Redis Cache (if using Redis)
The analytics endpoint caches results. Clear stale cache:

```bash
# Option 1: Clear all analytics cache
redis-cli KEYS "candidate_analytics:*" | xargs redis-cli DEL

# Option 2: Clear specific test cache
redis-cli DEL "candidate_analytics:{test_id}:{user_id}"
```

### 3. Test the Fix

#### A. Test CodeAnalyzer Fix
1. Generate a new AIML question
2. Submit code that includes `pip install` lines at the start
3. Verify evaluation correctly identifies:
   - Imports (TfidfVectorizer, cross_val_score, etc.)
   - Function calls (GridSearchCV, etc.)
   - Dataset loading
   - Model training

#### B. Test Status Update
1. Submit a test with code
2. Wait for AI evaluation to complete (check logs)
3. Check analytics endpoint: `/api/v1/aiml/tests/{test_id}/analytics/{user_id}`
4. Verify status shows `"evaluated"` (not `"not_submitted"`)

#### C. Test Question ID Consistency
1. Submit code via `/submit-answer` endpoint
2. Submit final test via `/submit` endpoint
3. Check analytics - all submissions should be found correctly

## Expected Results

### Before Fix:
- ❌ Status shows "Not submitted" despite evaluation
- ❌ Score shows 0/100 for correct code
- ❌ CodeAnalyzer returns empty imports/functions

### After Fix:
- ✅ Status shows "evaluated" after evaluation completes
- ✅ Score reflects actual code quality (e.g., 90/100)
- ✅ CodeAnalyzer correctly identifies imports/functions
- ✅ Analytics endpoint finds all submissions

## Monitoring

### Check Logs
```bash
# Watch for evaluation logs
tail -f logs/aiml-service.log | grep "evaluation"

# Check for errors
tail -f logs/aiml-service.log | grep "ERROR"
```

### Database Verification
Run the debug script to verify:
```bash
python debug_submission_status.py
```

## If Issues Persist

1. **Frontend still shows "Not submitted"**:
   - Clear browser cache / hard refresh (Ctrl+Shift+R)
   - Check React Query cache invalidation
   - Verify API response in browser DevTools

2. **Score still 0/100**:
   - Check CodeAnalyzer is being called (add debug logs)
   - Verify test_cases exist in question document
   - Check evaluation logs for errors

3. **Status not updating**:
   - Verify background task is running
   - Check `ai_feedback_status` in database
   - Verify `process_ai_evaluation_background` completes successfully

## Quick Test Script

```python
# test_fix.py
import asyncio
from app.api.v1.aiml.services.code_analyzer import CodeAnalyzer

code = """pip install pandas
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
scores = cross_val_score(model, X, y, cv=5)
"""

analyzer = CodeAnalyzer(code)
print("Imports:", analyzer.get_imports())
print("Function calls:", analyzer.get_function_calls())
print("Has TfidfVectorizer:", analyzer.verify_import("sklearn.feature_extraction.text.TfidfVectorizer"))
print("Has cross_val_score:", analyzer.verify_function_call("cross_val_score"))
```

Run: `python test_fix.py`

Expected output should show imports and function calls (not empty sets).
