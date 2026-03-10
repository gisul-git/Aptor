# Coding Question Duplication Fix

## Issue
Coding questions were displaying duplicate content in Step 4 (Review Questions):
- Problem statement appeared twice
- Same content shown in two different sections

## Root Cause

In `frontend/src/pages/assessments/create-new.tsx`, the `renderCodingQuestion` function was displaying the problem statement **TWICE**:

1. **First display** (~line 1227): Showed `problemStatementText` (which is `questionText`)
2. **Second display** (~line 1410): Showed `questionText` again

### Why This Happened

The backend generates coding questions with:
- `questionText` = Combined string with title + description + examples
- `description` = Just the description part
- `title` = Just the title

The frontend was displaying:
1. `questionText` (full content)
2. Then separately displaying `description` again

This caused the problem statement to appear twice.

## Fix Applied

### Changes Made

**File**: `frontend/src/pages/assessments/create-new.tsx`

1. **Removed duplicate "Problem Statement" section** (lines ~1410-1430)
   - Deleted the second display of `questionText`
   - Deleted the fallback title display

2. **Kept single "Problem Statement" section** (lines ~1227-1250)
   - Displays `problemStatementText` once
   - Contains full content: title + description + examples

3. **Removed debug console logs**
   - Cleaned up unnecessary logging code
   - Removed debug warnings

### Display Order (After Fix)

Coding questions now display in this order:
1. **Problem Statement** (once) - Contains title, description, examples
2. **Starter Code** (readonly)
3. **Function Signature**
4. **Constraints**
5. **Visible Test Cases**
6. **Hidden Test Cases**

## Testing

To verify the fix:

1. Create a new AI assessment
2. Add coding questions
3. Generate questions
4. Go to Step 4 (Review Questions)
5. Check coding questions - problem statement should appear **ONLY ONCE**

## Expected Result

**Before Fix**:
```
Problem Statement:
[Full content with title, description, examples]

Starter Code: ...
Function Signature: ...

Problem Statement:  <-- DUPLICATE
[Same content repeated]

Constraints: ...
```

**After Fix**:
```
Problem Statement:
[Full content with title, description, examples]

Starter Code: ...
Function Signature: ...
Constraints: ...
```

## Files Modified

1. `frontend/src/pages/assessments/create-new.tsx`
   - Removed duplicate problem statement display
   - Removed debug console logs
   - Cleaned up rendering logic

## Related Issues

This fix is part of the overall question generation improvements:
- See `QUESTION_GENERATION_FIXES.md` for performance fixes
- See `FIXES_APPLIED.md` for other bug fixes

## Rollback

If issues occur, the duplicate display can be restored by adding back the removed section:

```typescript
{/* Problem Statement - Always show if available */}
{questionText && (
  <div style={{ marginBottom: "1.5rem" }}>
    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
      Problem Statement:
    </div>
    <div style={{ padding: "1.25rem", backgroundColor: "#ffffff", borderRadius: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b", whiteSpace: "pre-wrap", lineHeight: "1.7", fontSize: "1rem" }}>
      {questionText}
    </div>
  </div>
)}
```

However, this would bring back the duplication issue.
