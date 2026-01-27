# DSA API CURL Commands

## Prerequisites

1. **Get Authentication Token**: First, sign in to get your JWT token
2. **Set Environment Variables**: 
   ```bash
   export API_URL="http://localhost:8000"
   export TOKEN="your_jwt_token_here"
   ```

---

## 1. Get Authentication Token

### Sign In (Email/Password)
```bash
curl -X POST "${API_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your_email@example.com",
    "password": "your_password"
  }'
```

### Sign In (Google OAuth - if applicable)
```bash
# This typically requires browser-based OAuth flow
# The token will be in the response or session
```

**Response will contain:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {...}
}
```

**Extract token:**
```bash
export TOKEN=$(curl -X POST "${API_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "your_email@example.com", "password": "your_password"}' \
  | jq -r '.access_token')
```

---

## 2. Debug User Info (Check Authentication)

**⚠️ IMPORTANT: Authorization must be in headers, NOT query parameters!**

```bash
curl -X GET "${API_URL}/api/dsa/tests/debug/user-info" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

**❌ WRONG (Authorization in query string):**
```bash
# This will return 401 Unauthorized
curl "${API_URL}/api/dsa/tests/debug/user-info?Authorization=Bearer%20${TOKEN}"
```

**✅ CORRECT (Authorization in headers):**
```bash
curl -X GET "${API_URL}/api/dsa/tests/debug/user-info" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Expected Response:**
```json
{
  "user_id": "69280dc16fda179a8301d40a",
  "user_id_type": "str",
  "current_user_keys": ["id", "email", "name", ...],
  "current_user_id": "69280dc16fda179a8301d40a",
  "database_stats": {
    "user_tests_count": 2,
    "all_tests_count": 3,
    "tests_without_created_by": 0,
    "sample_tests": [...]
  }
}
```

---

## 3. Get All Tests (Filtered by User)

```bash
curl -X GET "${API_URL}/api/dsa/tests/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -G \
  --data-urlencode "active_only=false"
```

**With query parameters:**
```bash
# Get only active tests
curl -X GET "${API_URL}/api/dsa/tests/?active_only=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

---

## 4. Get Specific Test (with Ownership Check)

```bash
curl -X GET "${API_URL}/api/dsa/tests/693176ca18a14c505e464c62" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

**Note:** This will return 403 if the test doesn't belong to the authenticated user.

---

## 5. Create a Test

```bash
curl -X POST "${API_URL}/api/dsa/tests/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Title",
    "description": "Test Description",
    "question_ids": ["question_id_1", "question_id_2"],
    "duration_minutes": 60,
    "start_time": "2025-12-04T11:55:00.000Z",
    "end_time": "2025-12-05T11:55:00.000Z"
  }'
```

---

## 6. Get All Questions (Filtered by User)

```bash
curl -X GET "${API_URL}/api/dsa/questions/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

**With query parameters:**
```bash
# Get only published questions
curl -X GET "${API_URL}/api/dsa/questions/?published_only=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"

# Get only unpublished questions
curl -X GET "${API_URL}/api/dsa/questions/?published_only=false" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"

# Get all questions (published and unpublished)
curl -X GET "${API_URL}/api/dsa/questions/?published_only=" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

---

## 7. Get Specific Question (with Ownership Check)

```bash
curl -X GET "${API_URL}/api/dsa/questions/question_id_here" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

**Note:** This will return 403 if the question doesn't belong to the authenticated user.

---

## 8. Create a Question

```bash
curl -X POST "${API_URL}/api/dsa/questions/" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Question Title",
    "description": "Question Description",
    "difficulty": "medium",
    "languages": ["python3"],
    "starter_code": {
      "python3": "def solution():\n    pass"
    },
    "public_testcases": [
      {
        "input": "test_input",
        "expected_output": "test_output"
      }
    ],
    "hidden_testcases": []
  }'
```

---

## 9. Update a Test

```bash
curl -X PUT "${API_URL}/api/dsa/tests/693176ca18a14c505e464c62" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "description": "Updated Description",
    "question_ids": ["question_id_1"],
    "duration_minutes": 90,
    "start_time": "2025-12-04T12:00:00.000Z",
    "end_time": "2025-12-05T12:00:00.000Z"
  }'
```

---

## 10. Delete a Test

```bash
curl -X DELETE "${API_URL}/api/dsa/tests/693176ca18a14c505e464c62" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

---

## 11. Publish/Unpublish a Test

```bash
curl -X PATCH "${API_URL}/api/dsa/tests/693176ca18a14c505e464c62/publish" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "is_published": true
  }'
```

---

## 12. Test User Isolation

### As User A:
```bash
# Set User A token
export TOKEN_A="user_a_token_here"

# Get User A's tests
curl -X GET "${API_URL}/api/dsa/tests/" \
  -H "Authorization: Bearer ${TOKEN_A}" \
  -H "Content-Type: application/json"
```

### As User B:
```bash
# Set User B token
export TOKEN_B="user_b_token_here"

# Get User B's tests (should NOT see User A's tests)
curl -X GET "${API_URL}/api/dsa/tests/" \
  -H "Authorization: Bearer ${TOKEN_B}" \
  -H "Content-Type: application/json"
```

**Expected:** User B should only see their own tests, not User A's tests.

---

## Quick Test Script

```bash
#!/bin/bash

API_URL="http://localhost:8000"
EMAIL="your_email@example.com"
PASSWORD="your_password"

# Get token
echo "Getting authentication token..."
TOKEN=$(curl -s -X POST "${API_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${EMAIL}\", \"password\": \"${PASSWORD}\"}" \
  | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to get token. Check credentials."
  exit 1
fi

echo "Token obtained: ${TOKEN:0:20}..."

# Debug user info
echo -e "\n=== Debug User Info ==="
curl -s -X GET "${API_URL}/api/dsa/tests/debug/user-info" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'

# Get tests
echo -e "\n=== Getting Tests ==="
curl -s -X GET "${API_URL}/api/dsa/tests/" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'

# Get questions
echo -e "\n=== Getting Questions ==="
curl -s -X GET "${API_URL}/api/dsa/questions/" \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq '.'
```

---

## Troubleshooting

### 401 Unauthorized
- Check that the token is valid and not expired
- Verify the Authorization header format: `Bearer ${TOKEN}`
- Re-authenticate to get a fresh token

### 403 Forbidden
- The resource (test/question) doesn't belong to the authenticated user
- This is expected behavior for user isolation

### 404 Not Found
- The resource ID doesn't exist
- Or the resource belongs to another user (check logs)

### Check Backend Logs
Look for entries like:
```
[get_tests] Fetching tests for user_id: '69280dc16fda179a8301d40a'
[get_tests] STRICT MongoDB query: {...}
[get_tests] Found X tests in database for user_id: ...
```

---

## Windows PowerShell Alternative

For Windows PowerShell users:

```powershell
$API_URL = "http://localhost:8000"
$TOKEN = "your_token_here"

# Get tests
Invoke-RestMethod -Uri "$API_URL/api/dsa/tests/" `
  -Method Get `
  -Headers @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
  }
```

