# Design Service Testing Guide

## ✅ Service Status

The Design Service is **RUNNING and WORKING** on port 3006.

### What's Working:
- ✅ Service is healthy and accessible
- ✅ AI question generation (with fallback when OpenAI unavailable)
- ✅ Penpot workspace creation
- ✅ Database integration (MongoDB)
- ✅ API endpoints (12 endpoints total)
- ✅ Frontend integration ready

### What's Temporarily Disabled:
- ⚠️ Evaluation engine (OpenCV/NumPy compatibility issue - can be re-enabled later)

---

## 🧪 Testing the Service

### 1. Test Backend API Directly

#### Health Check
```powershell
Invoke-RestMethod -Uri 'http://localhost:3006/health' -Method Get
```

#### Generate Question
```powershell
$body = @{
    role='ui_designer'
    difficulty='intermediate'
    task_type='dashboard'
    topic='food delivery'
    created_by='test_user'
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:3006/api/v1/design/questions/generate' -Method Post -Body $body -ContentType 'application/json'
```

#### Create Workspace
```powershell
# First, get a question ID from the generate question response above
$body = @{
    user_id='test_user_123'
    assessment_id='test_assessment_456'
    question_id='YOUR_QUESTION_ID_HERE'
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:3006/api/v1/design/workspace/create' -Method Post -Body $body -ContentType 'application/json'
```

---

### 2. Test Frontend Integration

#### Step 1: Verify Environment Variable
Make sure `Aptor/frontend/.env.local` contains:
```
NEXT_PUBLIC_DESIGN_SERVICE_URL=http://localhost:3006/api/v1/design
```

#### Step 2: Access Test Pages

**API Test Page** (Simple API testing):
```
http://localhost:3000/design/api-test
```

**Full Assessment Page** (Complete user flow):
```
http://localhost:3000/design/test
```

#### Step 3: Test Flow
1. Open `http://localhost:3000/design/api-test`
2. Click "Test Health Check" - should show service status
3. Click "Test Generate Question" - should generate a design challenge
4. Click "Test Create Workspace" - should create Penpot workspace
5. Click "Open Penpot Workspace" - should open Penpot in new tab

---

## 📊 API Endpoints Reference

### Question Management
- `POST /api/v1/design/questions/generate` - Generate AI question
- `GET /api/v1/design/questions` - List questions (with filters)
- `GET /api/v1/design/questions/{id}` - Get specific question

### Workspace Management
- `POST /api/v1/design/workspace/create` - Create Penpot workspace
- `GET /api/v1/design/workspace/{session_id}/status` - Get workspace status
- `POST /api/v1/design/workspace/{session_id}/end` - End workspace session

### Submission & Evaluation
- `POST /api/v1/design/submit` - Submit design for evaluation
- `GET /api/v1/design/submissions/{id}/evaluation` - Get evaluation results
- `GET /api/v1/design/submissions/user/{user_id}` - Get user submissions

### Analytics
- `GET /api/v1/design/analytics/question/{id}` - Question analytics
- `GET /api/v1/design/analytics/user/{user_id}` - User performance

### Health
- `GET /api/v1/design/health` - Service health check
- `GET /health` - Legacy health check

---

## 🔧 Troubleshooting

### Service Not Running
```powershell
# Check service status
docker ps --filter "name=design-service"

# Restart service
docker restart aptor-design-service-1

# View logs
docker logs aptor-design-service-1 --tail 50
```

### Frontend Can't Connect
1. Verify `.env.local` has `NEXT_PUBLIC_DESIGN_SERVICE_URL`
2. Restart Next.js dev server
3. Check browser console for CORS errors

### Database Issues
```powershell
# Check MongoDB is running
docker ps --filter "name=mongo"

# Restart MongoDB
docker restart aptor-mongodb-1
```

### Penpot Issues
```powershell
# Check Penpot is running
docker ps --filter "name=penpot"

# Access Penpot directly
# Open: http://localhost:9001
```

---

## 🎯 Next Steps

### Immediate Tasks (DONE ✅)
1. ✅ Test workspace creation - **WORKING**
2. ✅ Frontend integration - **READY**

### Future Enhancements
1. **Re-enable Evaluation Engine**
   - Fix OpenCV/NumPy compatibility
   - Uncomment evaluation imports in `app/services/__init__.py`
   - Test rule-based and AI-based evaluation

2. **Add Screenshot Capture**
   - Implement html2canvas in frontend
   - Capture design before submission

3. **Add Real-time Proctoring**
   - Integrate with existing proctoring service
   - Track design activity events

4. **Add Analytics Dashboard**
   - Visualize question performance
   - Show user progress

---

## 📝 Example Test Scenario

### Complete End-to-End Test

1. **Generate Question**
   ```
   POST /api/v1/design/questions/generate
   Body: {role: 'ui_designer', difficulty: 'intermediate', task_type: 'dashboard'}
   Response: {id: '123...', title: 'Food Delivery Dashboard', ...}
   ```

2. **Create Workspace**
   ```
   POST /api/v1/design/workspace/create
   Body: {user_id: 'user123', assessment_id: 'assess456', question_id: '123...'}
   Response: {session_id: 'abc...', workspace_url: 'http://localhost:9001/#/workspace?token=...'}
   ```

3. **Open Workspace**
   - Navigate to `workspace_url` in browser
   - Design interface should load
   - User can create design

4. **Submit Design** (when ready)
   ```
   POST /api/v1/design/submit
   Body: FormData with screenshot
   Response: {submission_id: 'xyz...', evaluation_status: 'processing'}
   ```

5. **Get Results**
   ```
   GET /api/v1/design/submissions/xyz.../evaluation
   Response: {final_score: 75.0, feedback: {...}}
   ```

---

## 🚀 Quick Start Commands

```powershell
# 1. Ensure services are running
docker ps --filter "name=design-service"
docker ps --filter "name=mongo"
docker ps --filter "name=penpot"

# 2. Test backend
Invoke-RestMethod -Uri 'http://localhost:3006/health'

# 3. Open frontend test page
Start-Process "http://localhost:3000/design/api-test"

# 4. View API documentation
Start-Process "http://localhost:3006/docs"
```

---

## 📚 Documentation Files

- `START_HERE.md` - Initial setup guide
- `STEP_BY_STEP_GUIDE.md` - Detailed implementation guide
- `PROMPT_ENGINEERING_GUIDE.md` - AI question generation framework
- `IMPLEMENTATION_SUMMARY.md` - Technical implementation details
- `TESTING_GUIDE.md` - This file

---

## ✨ Success Criteria

Your design service is working correctly if:
- ✅ Health check returns `{"status": "healthy"}`
- ✅ Question generation returns structured design challenge
- ✅ Workspace creation returns valid Penpot URL
- ✅ Frontend can connect and display questions
- ✅ Penpot workspace loads in iframe

**All criteria are currently MET! 🎉**
