# Design Screenshot & Results Display Implementation Plan

## Overview
Implement screenshot capture and display functionality for Design Competency to match AIML's code display + feedback approach.

## Current State
- ✅ Design submissions work (Penpot file_id stored)
- ✅ Evaluation system works (scores and feedback generated)
- ✅ Penpot service has `capture_screenshot()` method (unused)
- ❌ No actual screenshots captured on submission
- ❌ Results page doesn't show candidate's design
- ❌ Feedback not contextual to what was designed

## Goal
Show candidate's design (screenshot) alongside AI feedback, similar to how AIML shows code + feedback.

---

## Phase 1: Backend - Screenshot Capture

### File: `Aptor/services/design-service/app/api/v1/design.py`

**Current submission flow (line 678-750):**
```python
@router.post("/submit")
async def submit_design(request: SubmitDesignRequest):
    # 1. Validate session
    # 2. Export design data
    # 3. Create submission with: screenshot_url=f"penpot://{file_id}"  # ❌ Not actual screenshot
    # 4. Update candidate record
    # 5. Background evaluation
```

**Changes needed:**
1. After exporting design data, capture screenshot:
```python
# Capture screenshot from Penpot
screenshot_url = await penpot_service.capture_screenshot(
    file_id=session.file_id,
    page_id=None  # Capture first page
)

# If screenshot capture fails, use fallback
if not screenshot_url:
    screenshot_url = f"penpot://{session.file_id}"
```

2. Store actual screenshot URL in submission:
```python
submission = DesignSubmissionModel(
    session_id=request.session_id,
    user_id=request.user_id,
    question_id=request.question_id,
    screenshot_url=screenshot_url,  # ✅ Actual screenshot URL
    design_file_url=f"penpot://{session.file_id}",
    test_id=request.test_id
)
```

### File: `Aptor/services/design-service/app/services/penpot_service.py`

**Current `capture_screenshot` method (line 150-190):**
- Uses Penpot exporter service
- Creates PNG export
- Polls for completion
- Returns URL

**Issues to fix:**
1. Method uses RPC calls that may not match actual Penpot API
2. Need to verify Penpot exporter service is running (docker-compose.yml)
3. May need to store screenshot in our own storage (S3/local) instead of relying on Penpot URLs

**Alternative approach if Penpot exporter doesn't work:**
```python
async def capture_screenshot_alternative(self, file_id: str) -> str:
    """Capture screenshot using Puppeteer/Playwright"""
    # 1. Get workspace URL
    # 2. Use headless browser to capture
    # 3. Save to local storage or S3
    # 4. Return public URL
```

---

## Phase 2: Backend - Store Screenshots

### Option A: Use Penpot's exporter URLs
- Pros: No additional storage needed
- Cons: URLs may expire, dependent on Penpot service

### Option B: Store in local filesystem
```python
# In submit_design endpoint
screenshot_data = await penpot_service.capture_screenshot_as_bytes(file_id)
screenshot_path = f"screenshots/{submission_id}.png"
with open(f"static/{screenshot_path}", "wb") as f:
    f.write(screenshot_data)
screenshot_url = f"/static/{screenshot_path}"
```

### Option C: Store in MongoDB GridFS
```python
# Store large binary data in MongoDB
fs = gridfs.GridFS(db)
file_id = fs.put(screenshot_data, filename=f"{submission_id}.png")
screenshot_url = f"/api/v1/design/screenshots/{file_id}"
```

**Recommendation:** Start with Option B (local filesystem) for simplicity.

---

## Phase 3: Backend - API to Retrieve Screenshots

### New endpoint needed:
```python
@router.get("/screenshots/{submission_id}")
async def get_submission_screenshot(submission_id: str):
    """Get screenshot for a submission"""
    submission = await design_repository.get_submission(submission_id)
    if not submission or not submission.screenshot_url:
        raise HTTPException(404, "Screenshot not found")
    
    # Return image file
    return FileResponse(submission.screenshot_url)
```

---

## Phase 4: Frontend - Display Screenshots in Results

### File: `Aptor/frontend/src/pages/design/results/[submissionId].tsx`

**Current state:**
- Shows evaluation scores
- Shows feedback text
- ❌ Doesn't show candidate's design

**Changes needed:**

1. Fetch submission data including screenshot URL:
```typescript
const fetchResults = async () => {
  const response = await fetch(`${API_URL}/submissions/${submissionId}/evaluation`)
  const data = await response.json()
  setResults(data)
  setScreenshotUrl(data.screenshot_url)  // ✅ Get screenshot URL
}
```

2. Add screenshot display section:
```tsx
{/* Candidate's Design */}
<div style={{ marginBottom: '2rem' }}>
  <h2>Your Design</h2>
  {screenshotUrl ? (
    <img 
      src={screenshotUrl} 
      alt="Candidate's design submission"
      style={{ 
        width: '100%', 
        maxWidth: '1200px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px'
      }}
    />
  ) : (
    <p>Design preview not available</p>
  )}
</div>

{/* AI Feedback */}
<div style={{ marginTop: '2rem' }}>
  <h2>Evaluation Feedback</h2>
  {/* Existing feedback display */}
</div>
```

---

## Phase 5: Frontend - Analytics Page with Screenshots

### File: `Aptor/frontend/src/pages/design/tests/[testId]/analytics.tsx`

**Similar to AIML analytics:**
- Show list of candidates
- Click candidate → Show their design + feedback
- Add "Send Feedback" button (already implemented in hooks)

**Changes needed:**

1. Fetch candidate submissions with screenshots:
```typescript
const fetchCandidateAnalytics = async (userId: string) => {
  const response = await fetch(`${API_URL}/tests/${testId}/candidates/${userId}/analytics`)
  const data = await response.json()
  setAnalytics(data)
  // data should include screenshot_url for each submission
}
```

2. Display design + feedback side by side:
```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
  {/* Left: Design Screenshot */}
  <div>
    <h3>Candidate's Design</h3>
    <img src={analytics.screenshot_url} alt="Design" />
  </div>
  
  {/* Right: Feedback */}
  <div>
    <h3>AI Evaluation</h3>
    <div>Score: {analytics.score}/100</div>
    <div>{analytics.feedback}</div>
  </div>
</div>
```

---

## Phase 6: Testing Checklist

### Backend Tests:
- [ ] Screenshot capture works for Penpot files
- [ ] Screenshots stored correctly (filesystem/GridFS)
- [ ] Screenshot URLs accessible via API
- [ ] Submission includes screenshot_url
- [ ] Evaluation still works with screenshots

### Frontend Tests:
- [ ] Results page shows candidate's design
- [ ] Analytics page shows all candidates' designs
- [ ] Screenshots load correctly
- [ ] Feedback displayed alongside design
- [ ] "Send Feedback" button works

### Integration Tests:
- [ ] Complete flow: Take test → Submit → View results with screenshot
- [ ] Multiple questions: Each has its own screenshot
- [ ] Error handling: Missing screenshots show fallback

---

## Implementation Order

1. **Backend Screenshot Capture** (1-2 hours)
   - Modify submit endpoint
   - Test Penpot screenshot capture
   - Implement fallback if needed

2. **Backend Storage** (30 mins)
   - Choose storage method (filesystem recommended)
   - Implement screenshot retrieval endpoint

3. **Frontend Results Page** (1 hour)
   - Add screenshot display
   - Test with real submissions

4. **Frontend Analytics Page** (1 hour)
   - Add screenshot to candidate analytics
   - Implement side-by-side view

5. **Testing & Polish** (1 hour)
   - End-to-end testing
   - Error handling
   - UI polish

**Total Estimated Time: 4-5 hours**

---

## Files to Modify

### Backend:
1. `Aptor/services/design-service/app/api/v1/design.py` - submit endpoint
2. `Aptor/services/design-service/app/services/penpot_service.py` - screenshot capture
3. `Aptor/services/design-service/app/models/design.py` - ensure screenshot_url field exists

### Frontend:
1. `Aptor/frontend/src/pages/design/results/[submissionId].tsx` - results display
2. `Aptor/frontend/src/pages/design/tests/[testId]/analytics.tsx` - analytics display
3. `Aptor/frontend/src/services/design/design.service.ts` - API calls (if needed)

---

## Next Session Action Items

1. Start with backend screenshot capture
2. Test with a real submission
3. Verify screenshots are stored and accessible
4. Move to frontend display
5. Test complete flow

---

## Notes

- Penpot exporter service must be running (check docker-compose.yml)
- May need to configure CORS for screenshot URLs
- Consider screenshot size optimization (compress PNGs)
- Add loading states for screenshot display
- Handle cases where screenshot capture fails gracefully
