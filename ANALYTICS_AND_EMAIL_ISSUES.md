# Analytics and Email Issues - Fixed ✅

## Issues Found

### 1. Analytics Endpoint Missing ✅ FIXED
The backend was missing the `/tests/{test_id}/candidates/{candidate_id}/analytics` endpoint that the frontend was calling.

**Solution**: Added the endpoint to `design.py`

### 2. Wrong API Port in Frontend ✅ FIXED
The analytics page was using port 3006 instead of 3007.

**Solution**: Changed `API_URL` default from 3006 to 3007

### 3. SendGrid API Key Not Configured ⚠️ NEEDS USER ACTION
The email sending feature works (button responds) but emails aren't being sent because SendGrid API key is not configured.

**Solution**: Added configuration template to `.env` file

### 4. Candidate Submissions Not Linked Properly ⚠️ DATA ISSUE
The candidates added to the test don't have their submissions linked. The submissions exist in the database but with different `user_id` values.

**Current State**:
- Candidates in `design_candidates`: 2 (Rashya, Nishan)
- Both show `has_submitted: False`
- Submissions in `design_submissions`: 13
- Submissions have `user_id` like `candidate-1772797136366` (not matching candidate emails)

## What Was Fixed

### 1. Added Analytics Endpoint
```python
@router.get("/tests/{test_id}/candidates/{candidate_id}/analytics")
async def get_candidate_analytics(test_id: str, candidate_id: str):
    """Get detailed analytics for a specific candidate"""
    # Returns candidate info, submission data, scores, feedback
```

### 2. Fixed Frontend API URL
```typescript
const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3007/api/v1/design'
```

### 3. Added SendGrid Configuration Template
```env
# SendGrid Email Configuration (for sending test invitations)
# Get your API key from: https://app.sendgrid.com/settings/api_keys
# SENDGRID_API_KEY=your_sendgrid_api_key_here
# SENDGRID_FROM_EMAIL=noreply@yourdomain.com
# SENDGRID_FROM_NAME=Aptor Design Assessment
```

## How to Fix Email Sending

### Step 1: Get SendGrid API Key
1. Go to https://sendgrid.com/
2. Sign up for a free account (100 emails/day free)
3. Go to Settings → API Keys
4. Create a new API key with "Mail Send" permissions
5. Copy the API key

### Step 2: Configure .env File
1. Open `Aptor/services/design-service/.env`
2. Uncomment and fill in these lines:
```env
SENDGRID_API_KEY=SG.your_actual_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Aptor Design Assessment
```

### Step 3: Verify Sender Email
1. In SendGrid, go to Settings → Sender Authentication
2. Verify your sender email address
3. Use that verified email in `SENDGRID_FROM_EMAIL`

### Step 4: Restart Design Service
```bash
# The service will automatically reload with new .env values
```

## Why Results Aren't Showing

The analytics page shows "0/2 submitted" because:

1. **Candidates were added manually** via the "Add Candidate" button
2. **Test submissions were made** using the test link (without being logged in as those candidates)
3. **User IDs don't match**: 
   - Candidates have emails: `rashyashetty2004@gmail.com`, `nishankulal45@gmail.com`
   - Submissions have user_ids: `candidate-1772797136366`, etc.

### How to See Results

**Option 1: Take Test as Added Candidate**
1. Copy the test URL
2. Open in incognito/private window
3. When prompted, enter the exact email of an added candidate
4. Complete the test
5. The submission will be linked to that candidate

**Option 2: Check Existing Submissions**
The 13 existing submissions are in the database with scores. They just aren't linked to the 2 candidates you added later.

## Current System Status

### Services Running ✅
- Frontend: http://localhost:3002
- Design Service: http://localhost:3007
- Auth Service: http://localhost:4000
- MongoDB: Cloud (aptor_design_Competency)

### Database Stats
- Questions: 32 (1 Published)
- Tests: 1 (1 Published)
- Candidates: 2 (added to test)
- Sessions: 28
- Submissions: 13 (with scores)

### Features Working
- ✅ Analytics endpoint added
- ✅ Frontend using correct port
- ✅ Email button works (but needs SendGrid key to actually send)
- ⚠️ Results will show once candidates take the test with their registered emails

## Testing the Fix

### 1. Test Analytics Endpoint
```bash
# After a candidate submits with their registered email
curl http://localhost:3007/api/v1/design/tests/1772777232346239/candidates/{candidate_id}/analytics
```

### 2. Test Email Sending (after configuring SendGrid)
1. Go to analytics page
2. Click "Resend Invitation" for a candidate
3. Check the candidate's email inbox
4. Should receive invitation email with test link

## Summary

**Fixed**:
- ✅ Analytics endpoint added to backend
- ✅ Frontend API URL corrected to port 3007
- ✅ SendGrid configuration template added

**Needs User Action**:
- ⚠️ Configure SendGrid API key to enable email sending
- ⚠️ Have candidates take the test using their registered emails to see results

**Data Issue**:
- The 13 existing submissions were made before candidates were added
- They have different user_ids and won't show in the candidate list
- New submissions by registered candidates will show correctly
