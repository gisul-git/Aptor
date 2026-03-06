# Design Competency - Testing Guide

## 🔗 Testing Links

### Frontend Pages
- **Login**: http://localhost:3002/auth/signin
- **Dashboard**: http://localhost:3002/dashboard
- **Design Questions List**: http://localhost:3002/design/questions
- **Create Design Assessment**: http://localhost:3002/design/create
- **Design Tests List**: http://localhost:3002/design/tests

### Backend API
- **Health Check**: http://localhost:3007/health
- **API Docs**: http://localhost:3007/docs
- **Get All Questions**: http://localhost:3007/api/v1/design/questions
- **Get Published Questions**: http://localhost:3007/api/v1/design/questions?is_published=true

## 📋 Test Scenarios

### Scenario 1: Publish/Unpublish Question

1. **Go to Questions Page**
   - URL: http://localhost:3002/design/questions
   - Login if needed

2. **Find a Question**
   - Look for any question in the list
   - Check the status badge (Published/Draft)

3. **Click Publish/Unpublish Button**
   - Button shows current action (Publish or Unpublish)
   - Click the button

4. **Verify Immediate UI Update**
   - Status badge should change immediately (optimistic update)
   - Button text should change

5. **Verify Database Persistence**
   - Refresh the page (F5)
   - Status should remain the same
   - This confirms data was saved to cloud database

### Scenario 2: Create Assessment with Published Questions

1. **Publish Some Questions**
   - Go to: http://localhost:3002/design/questions
   - Publish 2-3 questions

2. **Go to Create Assessment**
   - URL: http://localhost:3002/design/create
   - Should see info message: "Only published questions are shown here"

3. **Verify Only Published Questions Appear**
   - Count the questions in the list
   - Should only see the questions you published
   - Unpublished questions should NOT appear

4. **Create an Assessment**
   - Fill in title and description
   - Select published questions
   - Set duration
   - Click "Create Test"

5. **Verify Assessment Created**
   - Should redirect to tests list
   - New assessment should appear

### Scenario 3: Unpublish and Verify Filter

1. **Unpublish a Question**
   - Go to: http://localhost:3002/design/questions
   - Find a published question
   - Click "Unpublish"

2. **Go to Create Assessment**
   - URL: http://localhost:3002/design/create
   - The unpublished question should disappear from the list

3. **Verify Count**
   - Number of available questions should decrease by 1

## 🔍 Comparison with AIML Competency

### Similarities ✅
1. **Publish Button**: Both have publish/unpublish button on questions page
2. **Optimistic UI**: Both update UI immediately before backend confirms
3. **Status Badge**: Both show Published (green) / Draft (gray) badges
4. **Query Parameters**: Both use `?is_published=true/false` in API

### Differences ⚠️
1. **Create Assessment Filter**:
   - **AIML**: Shows ALL questions (no filter)
   - **Design**: Shows ONLY published questions ✅ (Better UX)

2. **Authentication**:
   - **AIML**: Requires user authentication and ownership check
   - **Design**: No authentication (simpler for now)

3. **API Response**:
   - **AIML**: Returns full question object after publish
   - **Design**: Returns simple success message

## 🧪 Backend API Testing

### Test Publish Endpoint
```bash
# Publish a question
curl -X PATCH "http://localhost:3007/api/v1/design/questions/698dc4d0988067e56eb458ed/publish?is_published=true"

# Expected Response:
{
  "message": "Question publish status updated successfully",
  "is_published": true
}
```

### Test Unpublish Endpoint
```bash
# Unpublish a question
curl -X PATCH "http://localhost:3007/api/v1/design/questions/698dc4d0988067e56eb458ed/publish?is_published=false"

# Expected Response:
{
  "message": "Question publish status updated successfully",
  "is_published": false
}
```

### Test Get Published Questions
```bash
# Get only published questions
curl "http://localhost:3007/api/v1/design/questions?is_published=true"

# Should return array of only published questions
```

## 🗄️ Database Verification

### Run Verification Script
```bash
cd Aptor
python FINAL_VERIFICATION.py
```

### Expected Output
```
============================================================
DESIGN COMPETENCY - FINAL VERIFICATION
============================================================

[1/5] Verifying Cloud Database Connection...
   ✅ SUCCESS: Connected to aptor_design_Competency
   Collections: 7
   Questions: 31

[2/5] Getting test question...
   ✅ Question ID: 698dc4d0988067e56eb458ed
   Title: E-commerce - UI Designer Beginner Challenge
   Initial Status: False

[3/5] Testing Backend API - Publish...
   ✅ SUCCESS: Question publish status updated successfully
   New Status: True

[4/5] Verifying in Database...
   ✅ SUCCESS: Database updated correctly
   Published: True

[5/5] Testing Unpublish...
   ✅ SUCCESS: Question publish status updated successfully
   New Status: False
   ✅ SUCCESS: Unpublish verified in database

============================================================
VERIFICATION COMPLETE
============================================================

All tests passed!
```

## ✅ Checklist

### Frontend
- [ ] Questions page loads correctly
- [ ] Publish button appears on each question
- [ ] Status badge shows correct state (Published/Draft)
- [ ] Clicking publish updates UI immediately
- [ ] Clicking unpublish updates UI immediately
- [ ] Refresh page maintains the status
- [ ] Create assessment page shows only published questions
- [ ] Info message appears: "Only published questions are shown here"

### Backend
- [ ] Health check returns 200: http://localhost:3007/health
- [ ] Questions endpoint returns all questions
- [ ] Publish endpoint accepts query parameter
- [ ] Publish endpoint returns success message
- [ ] Unpublish endpoint works correctly
- [ ] Database updates persist

### Database
- [ ] All data in cloud: `aptor_design_Competency`
- [ ] No local database conflicts
- [ ] All 31 questions have `is_published` field
- [ ] Updates persist after service restart

## 🐛 Troubleshooting

### Issue: Publish button not working
**Solution**: Check browser console for errors. Verify backend is running on port 3007.

### Issue: Questions not filtering in create assessment
**Solution**: Clear browser cache and refresh. Check if questions have `is_published` field.

### Issue: Status not persisting after refresh
**Solution**: Check backend logs. Verify database connection. Run verification script.

### Issue: Port 3006 still being used
**Solution**: Stop old service, clear cache, restart on port 3007.

## 📊 Current Status

- ✅ Backend: Running on port 3007
- ✅ Frontend: Running on port 3002
- ✅ Database: Cloud MongoDB Atlas (aptor_design_Competency)
- ✅ Questions: 31 total with is_published field
- ✅ Publish/Unpublish: Working
- ✅ Create Assessment Filter: Working
- ✅ Data Persistence: Working

## 🎯 Next Steps

1. Test the complete flow manually using the links above
2. Verify all scenarios work as expected
3. Check that it matches AIML competency behavior
4. Report any issues found
