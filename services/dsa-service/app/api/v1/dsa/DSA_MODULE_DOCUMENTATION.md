# DSA Module Complete Documentation

## Overview
The DSA (Data Structures and Algorithms) module is a separate competency testing system within the AI Assessment Platform. It handles coding questions, test creation, code execution via Judge0, and candidate management.

---

## Directory Structure

```
dsa/
├── __init__.py                 # Module initialization
├── config.py                  # Configuration settings (MongoDB, Judge0, OpenAI)
├── database.py                # Database connection management
├── models/                    # Pydantic data models
│   ├── question.py           # Question data models
│   ├── test.py               # Test data models
│   ├── submission.py         # Submission data models
│   └── user.py               # User data models (if any)
├── routers/                   # FastAPI route handlers
│   ├── admin.py              # Admin endpoints (AI question generation)
│   ├── assessment.py         # Code execution and submission endpoints
│   ├── questions.py          # Question CRUD operations
│   ├── run.py                # Code execution endpoints
│   ├── submissions.py        # Submission management
│   └── tests.py              # Test CRUD and candidate management
├── services/                  # Business logic services
│   ├── ai_feedback.py        # AI-powered code feedback generation
│   ├── ai_generator.py       # AI question generation
│   ├── code_wrapper.py       # Code validation and wrapping
│   └── judge0_service.py     # Judge0 API integration
└── utils/                     # Utility functions
    ├── evaluator.py          # Code evaluation logic
    └── judge0.py              # Judge0 helper functions
```

---

## File-by-File Breakdown

### 1. `config.py` - Configuration Settings
**Purpose**: Manages environment variables and settings for the DSA module

**Key Functions/Classes**:
- `DSASettings`: Pydantic settings class that reads from `.env` file
  - `mongo_uri`: MongoDB connection string
  - `mongo_db`: Database name
  - `judge0_url`: Judge0 API endpoint
  - `judge0_timeout`: Execution timeout
  - `openai_api_key`: OpenAI API key for AI features

**Usage**: Provides centralized configuration for all DSA components

---

### 2. `database.py` - Database Connection
**Purpose**: Manages MongoDB connection for DSA module

**Key Functions**:
- `connect_to_dsa_mongo()`: Initialize MongoDB connection
- `close_dsa_mongo_connection()`: Close connection on shutdown
- `get_dsa_database()`: Get database instance (raises error if not initialized)

**Collections Used**:
- `tests`: DSA competency tests
- `questions`: Coding questions
- `submissions`: Code submissions
- `test_submissions`: Test-level submissions
- `test_candidates`: Candidate records for tests

---

### 3. `models/question.py` - Question Data Models
**Purpose**: Defines Pydantic models for questions

**Key Models**:
- `Question`: Full question model with:
  - `title`, `description`, `difficulty`
  - `languages`: Supported programming languages
  - `public_testcases`: Visible test cases
  - `hidden_testcases`: Hidden test cases
  - `starter_code`: Template code per language
  - `is_published`: Publication status
  - `created_by`: User ID who created the question (CRITICAL for security)
  - `created_at`, `updated_at`: Timestamps

- `QuestionCreate`: Model for creating questions
- `QuestionUpdate`: Model for updating questions
- `TestCase`: Individual test case model
- `FunctionSignature`: Function signature for code wrapping

---

### 4. `models/test.py` - Test Data Models
**Purpose**: Defines Pydantic models for tests

**Key Models**:
- `Test`: Full test model with:
  - `title`, `description`
  - `question_ids`: List of question IDs
  - `duration_minutes`: Test duration
  - `start_time`, `end_time`: Time window
  - `is_active`: Active status
  - `is_published`: Publication status
  - `created_by`: User ID who created the test (CRITICAL for security)
  - `invited_users`: List of candidate emails
  - `test_token`: Shared token for candidates

- `TestCreate`: Model for creating tests
- `TestSubmission`: Model for test submissions
- `TestInviteRequest`: Model for inviting candidates

---

### 5. `models/submission.py` - Submission Data Models
**Purpose**: Defines Pydantic models for code submissions

**Key Models**:
- `Submission`: Full submission model with:
  - `user_id`: User who submitted
  - `question_id`: Question being answered
  - `language`: Programming language used
  - `code`: Submitted code
  - `status`: Execution status
  - `test_results`: Test case results
  - `passed_testcases`, `total_testcases`: Pass counts

- `SubmissionCreate`: Model for creating submissions

---

### 6. `routers/questions.py` - Question Management Endpoints
**Purpose**: Handles all question CRUD operations

**Endpoints**:
1. `GET /api/dsa/questions/` - **List questions**
   - **Auth**: Required (`get_current_user`)
   - **Filter**: Only returns questions where `created_by == current_user.id`
   - **Params**: `skip`, `limit`, `published_only`
   - **Security**: ✅ Filtered by user

2. `GET /api/dsa/questions/{question_id}` - **Get single question**
   - **Auth**: Required (`get_current_user`)
   - **Security**: ✅ Verifies ownership before returning

3. `POST /api/dsa/questions/` - **Create question**
   - **Auth**: Required (`require_editor`)
   - **Sets**: `created_by = current_user.id`
   - **Security**: ✅ Sets ownership correctly

4. `PUT /api/dsa/questions/{question_id}` - **Update question**
   - **Auth**: Required (`require_editor`)
   - **Security**: ✅ Verifies ownership before updating

5. `PATCH /api/dsa/questions/{question_id}/publish` - **Toggle publish status**
   - **Auth**: Required (`require_editor`)
   - **Security**: ✅ Verifies ownership

6. `DELETE /api/dsa/questions/{question_id}` - **Delete question**
   - **Auth**: Required (`require_editor`)
   - **Security**: ✅ Verifies ownership

---

### 7. `routers/tests.py` - Test Management Endpoints
**Purpose**: Handles test CRUD and candidate management

**Endpoints**:

#### Test CRUD:
1. `GET /api/dsa/tests/` - **List tests**
   - **Auth**: Required (`get_current_user`)
   - **Filter**: Only returns tests where `created_by == current_user.id`
   - **Security**: ✅ Filtered by user

2. `GET /api/dsa/tests/{test_id}` - **Get single test**
   - **Auth**: Required (`get_current_user`)
   - **Security**: ✅ Verifies ownership before returning

3. `POST /api/dsa/tests/` - **Create test**
   - **Auth**: Required (`require_editor`)
   - **Sets**: `created_by = current_user.id`
   - **Validates**: All question_ids belong to current user
   - **Security**: ✅ Sets ownership correctly

4. `PUT /api/dsa/tests/{test_id}` - **Update test**
   - **Auth**: Required (`require_editor`)
   - **Security**: ✅ Verifies ownership

5. `PATCH /api/dsa/tests/{test_id}/publish` - **Publish/unpublish test**
   - **Auth**: Required (`require_editor`)
   - **Security**: ✅ Verifies ownership

6. `DELETE /api/dsa/tests/{test_id}` - **Delete test**
   - **Auth**: Required (`require_editor`)
   - **Security**: ✅ Verifies ownership

#### Candidate Management:
7. `POST /api/dsa/tests/{test_id}/add-candidate` - **Add single candidate**
   - **Auth**: None (uses test token validation)
   - **Purpose**: Add candidate to test

8. `POST /api/dsa/tests/{test_id}/bulk-add-candidates` - **Bulk add candidates (CSV)**
   - **Auth**: None (uses test token validation)
   - **Purpose**: Upload CSV to add multiple candidates

9. `GET /api/dsa/tests/{test_id}/candidates` - **List candidates**
   - **Auth**: Required (`get_current_user`)
   - **Security**: ✅ Verifies test ownership

10. `GET /api/dsa/tests/{test_id}/candidates/{user_id}/analytics` - **Get candidate analytics**
    - **Auth**: Required (`get_current_user`)
    - **Security**: ✅ Verifies test ownership

#### Test Taking (Public):
11. `GET /api/dsa/tests/{test_id}/verify-link` - **Verify test link token**
    - **Auth**: None (public endpoint for candidates)
    - **Purpose**: Validate test token for candidates

12. `POST /api/dsa/tests/{test_id}/start` - **Start test**
    - **Auth**: None (uses user_id from query)
    - **Purpose**: Initialize test session for candidate

13. `GET /api/dsa/tests/{test_id}/submission` - **Get test submission**
    - **Auth**: None (uses user_id from query)
    - **Purpose**: Get candidate's submission

14. `POST /api/dsa/tests/{test_id}/final-submit` - **Final submit test**
    - **Auth**: None (uses user_id from query)
    - **Purpose**: Submit completed test

#### Debug:
15. `GET /api/dsa/tests/debug/user-info` - **Debug user info**
    - **Auth**: Required (`get_current_user`)
    - **Purpose**: Verify authentication is working

---

### 8. `routers/assessment.py` - Code Execution Endpoints
**Purpose**: Handles code execution, submission, and evaluation

**Endpoints**:
1. `POST /api/dsa/assessment/run` - **Run code (public test cases only)**
   - **Auth**: None
   - **Purpose**: Execute code against public test cases

2. `POST /api/dsa/assessment/submit` - **Submit code (all test cases)**
   - **Auth**: None (uses user_id from query)
   - **Purpose**: Submit code for full evaluation

3. `POST /api/dsa/assessment/run-single` - **Run single test case**
   - **Auth**: None
   - **Purpose**: Test single test case execution

4. `GET /api/dsa/assessment/submissions/{question_id}` - **Get user submissions**
   - **Auth**: None (uses user_id from query)
   - **Purpose**: Get submission history

5. `GET /api/dsa/assessment/languages` - **Get supported languages**
   - **Auth**: None
   - **Purpose**: List available programming languages

6. `POST /api/dsa/assessment/validate-code` - **Validate code syntax**
   - **Auth**: None
   - **Purpose**: Check code validity without execution

#### Admin Endpoints:
7. `GET /api/dsa/assessment/admin/submission/{submission_id}` - **Get submission (admin)**
   - **Auth**: Admin key required
   - **Purpose**: Admin access to submissions

8. `GET /api/dsa/assessment/admin/submissions` - **List all submissions (admin)**
   - **Auth**: Admin key required
   - **Purpose**: Admin view of all submissions

9. `POST /api/dsa/assessment/admin/regenerate-feedback/{submission_id}` - **Regenerate AI feedback**
   - **Auth**: Admin key required
   - **Purpose**: Regenerate feedback for a submission

10. `POST /api/dsa/assessment/admin/regenerate-all-feedback` - **Regenerate all feedback**
    - **Auth**: Admin key required
    - **Purpose**: Bulk regenerate feedback

---

### 9. `routers/submissions.py` - Submission Management
**Purpose**: Alternative submission endpoints

**Endpoints**:
1. `POST /api/dsa/submissions/` - **Create submission**
   - **Auth**: None (uses user_id from query)
   - **Purpose**: Submit code

2. `GET /api/dsa/submissions/` - **List submissions**
   - **Auth**: None (filtered by user_id/question_id)
   - **Security**: ⚠️ No authentication - relies on query params

3. `GET /api/dsa/submissions/{submission_id}` - **Get submission**
   - **Auth**: None
   - **Security**: ⚠️ No authentication

4. `POST /api/dsa/submissions/evaluate` - **Evaluate code**
   - **Auth**: None
   - **Purpose**: Evaluate without storing

---

### 10. `routers/run.py` - Code Execution
**Purpose**: Simple code execution endpoints

**Endpoints**:
- Likely contains code execution logic (check file for details)

---

### 11. `routers/admin.py` - Admin Operations
**Purpose**: Admin-only endpoints

**Endpoints**:
1. `POST /api/dsa/admin/generate-question` - **Generate question with AI**
   - **Auth**: None (should be added)
   - **Purpose**: Use AI to generate complete coding questions
   - **Security**: ⚠️ No authentication - should be secured

---

### 12. `services/ai_feedback.py` - AI Feedback Generation
**Purpose**: Generate AI-powered code feedback

**Key Functions**:
- `generate_code_feedback()`: Generate feedback using OpenAI
  - Takes: code, question description, test results
  - Returns: Detailed feedback with suggestions

---

### 13. `services/ai_generator.py` - AI Question Generation
**Purpose**: Generate coding questions using AI

**Key Functions**:
- `generate_question()`: Generate complete question
  - Takes: difficulty, topic, concepts, languages
  - Returns: Full question with test cases and starter code

---

### 14. `services/code_wrapper.py` - Code Validation & Wrapping
**Purpose**: Validate and wrap user code for secure execution

**Key Functions**:
- `validate_user_code()`: Check code validity
- `detect_hardcoding()`: Detect hardcoded solutions
- `wrap_user_code()`: Wrap code for execution
- `validate_boilerplate_not_modified()`: Check starter code integrity
- `generate_boilerplate()`: Generate starter code

---

### 15. `services/judge0_service.py` - Judge0 Integration
**Purpose**: Interface with Judge0 API for code execution

**Key Functions**:
- `execute_code()`: Execute code via Judge0
- `check_judge0_health()`: Check Judge0 availability

---

### 16. `utils/judge0.py` - Judge0 Utilities
**Purpose**: Helper functions for Judge0

**Key Functions**:
- `run_all_test_cases()`: Execute all test cases
- `run_test_case()`: Execute single test case
- `LANGUAGE_IDS`: Mapping of language names to Judge0 IDs

---

### 17. `utils/evaluator.py` - Code Evaluation
**Purpose**: Code evaluation logic

**Key Functions**:
- Likely contains evaluation and scoring logic

---

## Security Status Summary

### ✅ SECURED (Authentication + Ownership Check):
- `GET /api/dsa/tests/` - List tests
- `GET /api/dsa/tests/{test_id}` - Get test
- `POST /api/dsa/tests/` - Create test
- `PUT /api/dsa/tests/{test_id}` - Update test
- `PATCH /api/dsa/tests/{test_id}/publish` - Publish test
- `DELETE /api/dsa/tests/{test_id}` - Delete test
- `GET /api/dsa/tests/{test_id}/candidates` - List candidates
- `GET /api/dsa/tests/{test_id}/candidates/{user_id}/analytics` - Get analytics
- `GET /api/dsa/questions/` - List questions
- `GET /api/dsa/questions/{question_id}` - Get question
- `POST /api/dsa/questions/` - Create question
- `PUT /api/dsa/questions/{question_id}` - Update question
- `PATCH /api/dsa/questions/{question_id}/publish` - Publish question
- `DELETE /api/dsa/questions/{question_id}` - Delete question

### ⚠️ NEEDS SECURITY REVIEW:
- `GET /api/dsa/submissions/` - No authentication
- `GET /api/dsa/submissions/{submission_id}` - No authentication
- `POST /api/dsa/admin/generate-question` - No authentication

### ✅ PUBLIC (Intentionally):
- Test-taking endpoints (for candidates)
- Code execution endpoints (for candidates)

---

## Critical Security Fields

### `created_by` Field
- **Location**: `tests` and `questions` collections
- **Type**: String (user ID)
- **Purpose**: Track ownership for user isolation
- **Set On**: Creation of test/question
- **Checked On**: All read/update/delete operations

### Authentication Flow
1. Frontend sends JWT token in `Authorization: Bearer <token>` header
2. Backend extracts user via `get_current_user` dependency
3. User ID extracted: `current_user.get("id") or current_user.get("_id")`
4. Normalized: `str(user_id).strip()`
5. Used in queries: `{"created_by": user_id}`

---

## Common Issues & Solutions

### Issue: Tests visible to all users
**Possible Causes**:
1. `created_by` field missing in database (old records)
2. Authentication token not being sent
3. User ID format mismatch
4. Frontend calling wrong endpoint

**Solution**:
1. Check backend logs for authentication errors
2. Verify token is sent in request headers
3. Use debug endpoint: `GET /api/dsa/tests/debug/user-info`
4. Check database: Ensure all tests have `created_by` field

---

## Database Collections

### `tests`
- Stores DSA competency tests
- **Index**: `created_by` (for filtering)
- **Security**: Filtered by `created_by` on all queries

### `questions`
- Stores coding questions
- **Index**: `created_by` (for filtering)
- **Security**: Filtered by `created_by` on all queries

### `submissions`
- Stores code submissions
- **Index**: `user_id`, `question_id`
- **Security**: Filtered by `user_id` in queries

### `test_submissions`
- Stores test-level submissions
- **Index**: `test_id`, `user_id`
- **Security**: Filtered by `test_id` and `user_id`

### `test_candidates`
- Stores candidate records
- **Index**: `test_id`, `email`
- **Security**: Filtered by `test_id`

---

## Next Steps for Debugging

1. **Check Authentication**:
   ```bash
   curl -H "Authorization: Bearer <token>" http://localhost:8000/api/dsa/tests/debug/user-info
   ```

2. **Check Database**:
   ```javascript
   // MongoDB query
   db.tests.find({}, {created_by: 1, title: 1}).limit(10)
   ```

3. **Check Logs**:
   - Look for `[get_tests]` or `[get_questions]` log entries
   - Check for "SECURITY ISSUE" warnings

4. **Verify Token**:
   - Check if `dsaApi` interceptor is adding token
   - Verify token is valid and not expired

---

## 🔍 COMPREHENSIVE DEBUGGING GUIDE

### When Tests/Questions Are Visible to Wrong Users

Follow these steps to identify the root cause:

---

### 1. Database State - MongoDB Queries

Run these queries in MongoDB shell or Compass:

```javascript
// Query 1: Check tests collection - show created_by field format
db.tests.find({}, {
  _id: 1,
  title: 1,
  created_by: 1,
  created_at: 1
}).limit(10).pretty()

// Query 2: Count tests with/without created_by
db.tests.aggregate([
  {
    $group: {
      _id: {
        $cond: [
          { $ifNull: ["$created_by", false] },
          "has_created_by",
          "missing_created_by"
        ]
      },
      count: { $sum: 1 }
    }
  }
])

// Query 3: Check questions collection - show created_by field format
db.questions.find({}, {
  _id: 1,
  title: 1,
  created_by: 1,
  created_at: 1
}).limit(10).pretty()

// Query 4: Count questions with/without created_by
db.questions.aggregate([
  {
    $group: {
      _id: {
        $cond: [
          { $ifNull: ["$created_by", false] },
          "has_created_by",
          "missing_created_by"
        ]
      },
      count: { $sum: 1 }
    }
  }
])

// Query 5: Check for null/empty created_by values
db.tests.find({
  $or: [
    { created_by: null },
    { created_by: "" },
    { created_by: { $exists: false } }
  ]
}, {
  _id: 1,
  title: 1,
  created_by: 1
}).limit(5).pretty()
```

**What to look for:**
- Format of `created_by` field (ObjectId string, plain string, null, missing)
- Any documents missing `created_by` field
- Any documents with `created_by: null` or `created_by: ""`

---

### 2. Authentication Verification - Debug Endpoint

Call the debug endpoint to verify authentication:

**Via cURL:**
```bash
curl -H "Authorization: Bearer <your-token>" \
  http://localhost:8000/api/dsa/tests/debug/user-info
```

**Via Browser Console (if logged in):**
```javascript
fetch('/api/dsa/tests/debug/user-info', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token') || 'YOUR_TOKEN_HERE'}`
  }
}).then(r => r.json()).then(console.log)
```

**What to check in response:**
- `user_id`: The extracted user ID (should match your actual user ID)
- `user_id_type`: Type of the ID (should be "str")
- `current_user_id` and `current_user__id`: Both values should be present
- `database_stats.user_tests_count`: How many tests belong to you
- `database_stats.all_tests_count`: Total tests in database
- `database_stats.tests_without_created_by`: Tests missing the field
- `database_stats.sample_tests`: Sample showing `created_by` format

**Expected output:**
```json
{
  "user_id": "507f1f77bcf86cd799439011",
  "user_id_type": "str",
  "current_user_id": "507f1f77bcf86cd799439011",
  "current_user__id": "507f1f77bcf86cd799439011",
  "current_user_email": "user@example.com",
  "database_stats": {
    "user_tests_count": 5,
    "all_tests_count": 10,
    "tests_without_created_by": 0,
    "sample_tests": [...]
  }
}
```

---

### 3. Frontend Token Check - Network Tab

**Steps:**
1. Open Browser DevTools (F12) → **Network** tab
2. Filter by "tests" or "dsa"
3. Refresh dashboard or navigate to DSA tests page
4. Find request to `/api/dsa/tests` or `/api/dsa/tests/`
5. Click the request → **Headers** tab
6. Check **Request Headers** section

**What to verify:**
- ✅ `Authorization: Bearer <token>` header is present
- ✅ Token value is not empty
- ✅ Request URL is correct (`/api/dsa/tests` or `/api/dsa/tests/`)
- ✅ Response status code (should be 200, not 401 or 403)
- ✅ Response body shows correct number of tests

**If Authorization header is missing:**
- Check `dsaApi` interceptor in `frontend/src/lib/dsa/api.ts`
- Verify NextAuth session has `backendToken`
- Check if token is in `localStorage.getItem('token')`

---

### 4. Backend Logs - Specific Output

When fetching tests, check backend logs for:

**Look for these log lines:**
```
[get_tests] Fetching tests for user_id: '507f1f77bcf86cd799439011'
[get_tests] Current user data: id=507f1f77bcf86cd799439011, _id=507f1f77bcf86cd799439011, email=user@example.com
[get_tests] MongoDB query: {'created_by': '507f1f77bcf86cd799439011'}
[get_tests] DEBUG: Sample of ALL tests in DB (first 5):
[get_tests] DEBUG: Test ID=..., created_by=..., title=...
[get_tests] Found 5 tests in database for user_id: 507f1f77bcf86cd799439011 using query: {'created_by': '507f1f77bcf86cd799439011'}
[get_tests] Returning 5 tests for user_id: 507f1f77bcf86cd799439011
```

**Red flags to watch for:**
- ❌ `Invalid user ID in current_user` - Authentication failed
- ❌ `SECURITY ISSUE: Excluding test ... created_by='...' != user_id='...'` - Format mismatch
- ❌ `SECURITY: Excluding test ... missing created_by field` - Old records without field
- ❌ `Filtered out X tests` - Tests were filtered (should investigate why)

**What to provide:**
- Complete log output for ONE request (from start to finish)
- Include all `[get_tests]` or `[get_questions]` log entries
- Include any `SECURITY ISSUE` or `SECURITY` warnings

---

### 5. Current Behavior Test

Test both scenarios to confirm the issue:

#### Test A: Dashboard List
1. **Login as User A** → Create a test → Note the test title
2. **Logout**
3. **Login as User B** → Go to dashboard
4. **Check:** Does User B see User A's test in the list?
   - ✅ **Expected:** No
   - ❌ **Actual:** Yes (if this happens, there's a bug)

#### Test B: Direct API Call
1. While logged in as **User B**, open browser console
2. Run:
   ```javascript
   fetch('/api/dsa/tests', {
     headers: {
       'Authorization': `Bearer ${localStorage.getItem('token')}`
     }
   }).then(r => r.json()).then(data => {
     console.log('Tests returned:', data);
     console.log('Count:', data.length);
     // Check if User A's test is in the list
     const userATest = data.find(t => t.title === 'User A Test Title');
     if (userATest) {
       console.error('SECURITY ISSUE: User B can see User A test!', userATest);
     }
   })
   ```
3. **Check:** Does the response include User A's test?
   - ✅ **Expected:** No
   - ❌ **Actual:** Yes (if this happens, there's a bug)

**Report back:**
- Test A result: ✅/❌ (User B sees User A's test in dashboard)
- Test B result: ✅/❌ (User B gets User A's test via API)
- If ❌, paste the test object that shouldn't be visible

---

### 6. Data Collection Summary

**Provide all of the following:**

1. ✅ **MongoDB Query Results** - All 5 queries from section 1
2. ✅ **Debug Endpoint Response** - Full JSON from section 2
3. ✅ **Network Tab Info** - Screenshot OR Authorization header value from section 3
4. ✅ **Backend Logs** - One complete request log from section 4
5. ✅ **Behavior Test Results** - Test A and Test B results from section 5

Once all data is collected, the root cause can be identified and fixed.

---

### 7. Common Issues & Solutions

#### Issue: Tests visible to all users

**Possible Causes:**

1. **Missing `created_by` field in database**
   - **Symptom:** Old tests created before security fix
   - **Solution:** Run migration script to add `created_by` to old records

2. **User ID format mismatch**
   - **Symptom:** `created_by` stored as ObjectId, queried as string (or vice versa)
   - **Solution:** Normalize user ID format in all queries

3. **Authentication token not sent**
   - **Symptom:** No `Authorization` header in requests
   - **Solution:** Fix `dsaApi` interceptor or NextAuth session

4. **Query filter not applied**
   - **Symptom:** Some code path bypasses `created_by` filter
   - **Solution:** Add filter to all query paths

5. **Frontend caching**
   - **Symptom:** Old data cached in browser
   - **Solution:** Clear cache, hard refresh (Ctrl+Shift+R)

---

### 8. Quick Diagnostic Checklist

Before reporting an issue, verify:

- [ ] All tests in database have `created_by` field
- [ ] `created_by` values are not null or empty
- [ ] Authentication token is being sent in requests
- [ ] Backend logs show correct `user_id` extraction
- [ ] MongoDB query includes `{"created_by": user_id}` filter
- [ ] Client-side filter is removing non-matching items
- [ ] No old tests without `created_by` are being returned

