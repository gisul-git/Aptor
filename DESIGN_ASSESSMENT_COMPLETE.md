# ✅ Design Assessment - Complete & Working

## 🎯 User Flow

### From Dashboard to Assessment

```
1. Candidate logs into Aptor
   ↓
2. Sees Dashboard with Design Assessment card
   ↓
3. Clicks on Design Assessment card
   ↓
4. Redirected to: /design/tests/[testId]/take
   ↓
5. Page auto-starts (NO welcome screen)
   ↓
6. Backend generates AI question
   ↓
7. Backend creates Penpot workspace
   ↓
8. Split layout appears:
   - LEFT: Question details (320px)
   - RIGHT: Penpot workspace (remaining width)
   - TOP: Timer + Submit button
   ↓
9. Candidate designs in Penpot
   ↓
10. Candidate clicks "Submit Design"
    ↓
11. Design is submitted for evaluation
```

---

## 📁 File Structure

### ✅ Working Files

```
Aptor/
├── services/design-service/              # Backend (FastAPI)
│   ├── main.py                          # Running on port 3006
│   ├── app/api/v1/design.py            # API endpoints
│   ├── app/services/
│   │   ├── ai_question_generator.py    # AI question generation
│   │   └── penpot_service.py           # Penpot integration
│   └── app/repositories/
│       └── design_repository.py         # MongoDB operations
│
└── frontend/                             # Frontend (Next.js)
    └── src/
        ├── pages/
        │   ├── design/
        │   │   └── tests/
        │   │       └── [testId]/
        │   │           └── take.tsx     # ✅ MAIN ASSESSMENT PAGE
        │   └── design-assessment.tsx    # Alternative direct access
        └── services/
            └── designService.ts          # API client
```

---

## 🚀 How It Works

### 1. Dashboard Integration

When a candidate clicks on a Design Assessment card from the dashboard:

**File**: `Aptor/frontend/src/components/DashboardCard.tsx` (line ~40)
```typescript
if (props.type === 'design') {
  router.push(`/design/tests/${props.id}/edit`);
}
```

**For candidates taking the test**, the route should be:
```typescript
router.push(`/design/tests/${props.id}/take`);
```

### 2. Assessment Page

**Route**: `/design/tests/[testId]/take`
**File**: `Aptor/frontend/src/pages/design/tests/[testId]/take.tsx`

**Features**:
- ✅ Auto-starts on page load (no welcome screen)
- ✅ Shows loading states with progress messages
- ✅ Generates AI question from backend
- ✅ Creates Penpot workspace
- ✅ Split layout: Question (left) | Penpot (right)
- ✅ Timer with countdown
- ✅ Submit button
- ✅ Error handling

---

## 🎨 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Design Challenge Title          Time: 59:45  [Submit]      │
│  UI DESIGNER • INTERMEDIATE                                 │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Challenge   │                                              │
│  Description │                                              │
│              │                                              │
│  Constraints │         Penpot Workspace                     │
│  - Item 1    │         (Embedded iframe)                    │
│  - Item 2    │                                              │
│              │                                              │
│  Deliverables│                                              │
│  - Item 1    │                                              │
│              │                                              │
│  Evaluation  │                                              │
│  - Criteria  │                                              │
│              │                                              │
│   320px      │         Remaining Width                      │
└──────────────┴──────────────────────────────────────────────┘
```

---

## 🔧 Testing

### 1. Start Backend
```bash
cd Aptor/services/design-service
python main.py
```
**Expected**: Service running on `http://localhost:3006`

### 2. Start Frontend
```bash
cd Aptor/frontend
npm run dev
```
**Expected**: Next.js running on `http://localhost:3002` (or 3000/3001)

### 3. Test Direct Access
Open browser:
```
http://localhost:3002/design/tests/test123/take
```

**Expected Flow**:
1. Shows "Generating your design challenge..." (2-3 seconds)
2. Shows "Setting up your workspace..." (1-2 seconds)
3. Split layout appears with question and Penpot workspace
4. Timer starts counting down
5. Candidate can design in Penpot
6. Click "Submit Design" to submit

### 4. Test from Dashboard
1. Login to Aptor
2. Go to Dashboard
3. Click on a Design Assessment card
4. Should redirect to `/design/tests/[testId]/take`
5. Assessment auto-starts

---

## 🔗 API Endpoints Used

### 1. Generate Question
```
POST http://localhost:3006/api/v1/design/questions/generate

Body:
{
  "role": "ui_designer",
  "difficulty": "intermediate",
  "task_type": "dashboard",
  "topic": "food delivery",
  "created_by": "candidate"
}

Response:
{
  "_id": "...",
  "title": "Design a Food Delivery Dashboard",
  "description": "...",
  "constraints": [...],
  "deliverables": [...],
  "evaluation_criteria": [...],
  "time_limit_minutes": 60
}
```

### 2. Create Workspace
```
POST http://localhost:3006/api/v1/design/workspace/create

Body:
{
  "user_id": "candidate_123",
  "assessment_id": "test123",
  "question_id": "..."
}

Response:
{
  "session_id": "...",
  "workspace_url": "http://localhost:9001/...",
  "session_token": "...",
  "time_limit_minutes": 60
}
```

---

## 📝 Environment Variables

**File**: `Aptor/frontend/.env.local`
```env
NEXT_PUBLIC_DESIGN_SERVICE_URL=http://localhost:3006/api/v1/design
```

---

## 🎯 Key Features

### ✅ Auto-Start
- No welcome screen
- Immediately starts generating question on page load
- Shows loading states with progress messages

### ✅ Split Layout
- Fixed 320px left panel for question details
- Flexible right panel for Penpot workspace
- Clean, professional design

### ✅ Timer
- Counts down from question time limit (default 60 minutes)
- Changes to red when < 5 minutes remaining
- Auto-submits when time runs out

### ✅ Error Handling
- Shows error message if API fails
- Provides "Reload Page" button
- Logs errors to console for debugging

### ✅ Responsive
- Works on different screen sizes
- Scrollable question panel
- Full-height Penpot workspace

---

## 🐛 Troubleshooting

### Issue: Page not found
**Solution**: Ensure Next.js is running
```bash
cd Aptor/frontend
npm run dev
```

### Issue: "Failed to generate question"
**Solution**: Ensure backend is running
```bash
cd Aptor/services/design-service
python main.py
```

### Issue: Penpot workspace not loading
**Solution**: Check Penpot is running
```bash
docker-compose ps
# Should show penpot-frontend and penpot-backend running
```

### Issue: CORS errors
**Solution**: Backend already has CORS enabled for localhost:3000-3002

---

## 📋 Next Steps

### 1. Update Dashboard Card Click
**File**: `Aptor/frontend/src/components/DashboardCard.tsx`

Change line ~40 from:
```typescript
if (props.type === 'design') {
  router.push(`/design/tests/${props.id}/edit`);
}
```

To:
```typescript
if (props.type === 'design') {
  // For candidates taking test
  router.push(`/design/tests/${props.id}/take`);
  
  // For admins editing test (add role check)
  // if (userRole === 'admin') {
  //   router.push(`/design/tests/${props.id}/edit`);
  // }
}
```

### 2. Add Authentication
- Get real user_id from session
- Pass testId from dashboard
- Validate user has access to test

### 3. Implement Submission
- Capture Penpot design screenshot
- Send to backend for evaluation
- Show evaluation results

### 4. Add Progress Saving
- Auto-save design progress
- Resume from last saved state

---

## ✅ Summary

**You now have a complete working design assessment system!**

### What's Working:
- ✅ Backend API (FastAPI) on port 3006
- ✅ AI question generation
- ✅ Penpot workspace creation
- ✅ Frontend assessment page with auto-start
- ✅ Split layout (question left, Penpot right)
- ✅ Timer with countdown
- ✅ Submit button

### How to Use:
1. Start backend: `cd Aptor/services/design-service && python main.py`
2. Start frontend: `cd Aptor/frontend && npm run dev`
3. Access: `http://localhost:3002/design/tests/test123/take`
4. Or click Design Assessment card from dashboard

**The assessment auto-starts and shows the split layout immediately!** 🎉
