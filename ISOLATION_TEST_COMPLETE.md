# 🎯 Complete Multi-User Isolation Test Guide

## Current Status: READY FOR TESTING ✅

**Last Updated**: February 9, 2026  
**Backend**: Fixed - Now returns `file_id` in API response  
**Frontend**: Fixed - Displays file ID with green highlight  
**Services**: Running and ready

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Open Test Page in Two Browsers

**Browser 1 (Edge):**
```
http://localhost:3001/test-workspace.html
```

**Browser 2 (Chrome):**
```
http://localhost:3001/test-workspace.html
```

### Step 2: Wait for Both Pages to Load

You should see:
- ✅ Question title: "Food Delivery Dashboard"
- ✅ Green box with File ID (e.g., `🔒 File ID: ...8b792337c3f2`)
- ✅ Penpot workspace iframe on the right
- ✅ Timer showing 60:00

### Step 3: Compare File IDs

**Look at the green box under the title in BOTH browsers**

**Expected Result:**
```
Browser 1 (Edge):   🔒 File ID: ...337c3f2
Browser 2 (Chrome): 🔒 File ID: ...41a5d98a
                              ↑↑↑↑↑↑↑↑↑↑
                         THESE SHOULD BE DIFFERENT!
```

**If they're different** → ✅ Isolation is working! Continue to Step 4.  
**If they're the same** → ❌ Problem! Check troubleshooting section.

### Step 4: Test Visual Isolation

**In Browser 1 (Edge):**
1. Click inside the Penpot workspace (right side)
2. Look for the toolbar on the left side of Penpot
3. Click the **Rectangle tool** (square icon)
4. Draw a **large red rectangle** in the center
5. Change its color to RED using the color picker

**In Browser 2 (Chrome):**
1. Look at your Penpot workspace
2. **You should NOT see the red rectangle**
3. Your canvas should be completely blank

**Expected Result:**
- ✅ Browser 1: Shows red rectangle
- ✅ Browser 2: Shows blank canvas (no rectangle)

### Step 5: Test Bidirectional Isolation

**In Browser 2 (Chrome):**
1. Draw a **blue circle** in a different location
2. Change its color to BLUE

**Check Both Browsers:**
- ✅ Browser 1: Only sees red rectangle (no blue circle)
- ✅ Browser 2: Only sees blue circle (no red rectangle)

---

## 📊 Test Results Template

Copy this and fill it out:

```
=== ISOLATION TEST RESULTS ===
Date: February 9, 2026
Tester: [Your Name]

✅ STEP 1: Both pages loaded successfully
   - Browser 1 (Edge): [YES/NO]
   - Browser 2 (Chrome): [YES/NO]

✅ STEP 2: File IDs are different
   - Browser 1 File ID: [Last 8 chars, e.g., 337c3f2]
   - Browser 2 File ID: [Last 8 chars, e.g., 41a5d98a]
   - Are they different? [YES/NO]

✅ STEP 3: Visual isolation works
   - Browser 1 red rectangle visible in Browser 1: [YES/NO]
   - Browser 1 red rectangle visible in Browser 2: [YES/NO - should be NO]
   - Browser 2 blue circle visible in Browser 2: [YES/NO]
   - Browser 2 blue circle visible in Browser 1: [YES/NO - should be NO]

✅ STEP 4: No errors
   - Browser 1 console errors: [YES/NO]
   - Browser 2 console errors: [YES/NO]

OVERALL RESULT: [PASS/FAIL]

Notes:
[Any observations]
```

---

## 🔍 What to Look For

### ✅ SUCCESS Indicators

1. **Different File IDs**: Last 8 characters are different
   ```
   Edge:   ...337c3f2
   Chrome: ...41a5d98a  ← Different!
   ```

2. **Green File ID Box**: Shows actual UUID, not "N/A"
   ```
   🔒 File ID: 92a07493-962a-80c4-8007-8b792337c3f2
   ```

3. **Separate Canvases**: Each browser has its own blank workspace

4. **No Cross-Contamination**: Drawings don't appear in other browser

### ❌ FAILURE Indicators

1. **Same File IDs**: Last 8 characters are identical
   ```
   Edge:   ...337c3f2
   Chrome: ...337c3f2  ← Same! Problem!
   ```

2. **"N/A" File ID**: API didn't return file_id
   ```
   🔒 File ID: N/A  ← Problem!
   ```

3. **Shared Canvas**: Both browsers show the same drawings

4. **Console Errors**: Red errors in browser console (F12)

---

## 🐛 Troubleshooting

### Problem 1: File ID shows "N/A"

**Symptoms:**
- Green box shows `🔒 File ID: N/A`

**Solution:**
```bash
# Check if design-service is running
cd C:\gisul\Aptor
docker-compose ps design-service

# Check logs
docker-compose logs design-service --tail=50

# Restart service
docker-compose restart design-service

# Wait 5 seconds and refresh browser
```

### Problem 2: Same File ID in Both Browsers

**Symptoms:**
- Both browsers show identical file IDs

**Solution:**
```bash
# Hard refresh both browsers
# Edge: Ctrl + Shift + R
# Chrome: Ctrl + Shift + R

# If still same, check backend logs
docker-compose logs design-service --tail=50

# Look for "File created successfully" messages
# Each should have a different file ID
```

### Problem 3: Drawings Appear in Both Browsers

**Symptoms:**
- Red rectangle from Browser 1 appears in Browser 2

**Cause:**
- File IDs are the same (check Step 3)

**Solution:**
- Close both browsers completely
- Reopen and test again
- Verify file IDs are different

### Problem 4: Page Won't Load

**Symptoms:**
- Spinner keeps spinning
- "Error" message appears

**Solution:**
```bash
# Check all services are running
cd C:\gisul\Aptor
docker-compose ps

# Check design-service logs
docker-compose logs design-service --tail=50

# Check if MongoDB is running
docker-compose logs mongodb --tail=20

# Restart all services if needed
docker-compose restart
```

### Problem 5: Penpot Workspace Not Loading

**Symptoms:**
- Left sidebar loads but right side is black/empty

**Solution:**
```bash
# Check Penpot is running
docker-compose ps penpot-frontend penpot-backend

# Check Penpot logs
docker-compose logs penpot-backend --tail=30

# Restart Penpot
docker-compose restart penpot-frontend penpot-backend

# Wait 10 seconds and refresh browser
```

---

## 🔧 Backend Verification

### Check API Response

Open browser console (F12) → Network tab → Look for:

**Request:**
```
POST http://localhost:3006/api/v1/design/workspace/create
```

**Response should include:**
```json
{
  "session_id": "...",
  "workspace_url": "http://localhost:9001/#/workspace?...",
  "session_token": "...",
  "file_id": "92a07493-962a-80c4-8007-8b792337c3f2",  ← Should be present!
  "project_id": "...",
  "question": {...},
  "time_limit_minutes": 60
}
```

**If `file_id` is missing:**
- Backend API needs to be updated
- Check `Aptor/services/design-service/app/api/v1/design.py`
- Line should include: `"file_id": session.file_id,`

---

## 📁 Verify in Penpot Dashboard

### Manual Verification

1. Open Penpot: `http://localhost:9001`
2. Login:
   - Email: `admin@example.com`
   - Password: `12312312`
3. Go to **Projects** → **Design Assessment**
4. You should see multiple files:
   ```
   Food Delivery Dashboard_test_1234_abc123
   Food Delivery Dashboard_test_5678_def456
   Food Delivery Dashboard_test_9012_ghi789
   ```

5. Open each file:
   - First file: Should show red rectangle
   - Second file: Should show blue circle
   - Third file: Should be blank

**Expected Result:**
- ✅ Multiple files with different names
- ✅ Each file has unique content
- ✅ Files created at different timestamps

---

## 🎉 Success Criteria

All of these must be TRUE:

- [x] Both browsers load the test page without errors
- [x] File IDs are displayed (not "N/A")
- [x] File IDs are DIFFERENT in each browser
- [x] Red rectangle in Browser 1 is NOT visible in Browser 2
- [x] Blue circle in Browser 2 is NOT visible in Browser 1
- [x] Penpot dashboard shows multiple distinct files
- [x] No console errors in either browser
- [x] Both users can draw simultaneously without conflicts

**If all checked** → 🎉 **ISOLATION IS WORKING!**

---

## 📸 Expected Screenshots

### Browser 1 (Edge)
```
┌─────────────────────────────────────────────────────────┐
│ Food Delivery Dashboard                                 │
│ Designer • Intermediate                                 │
│ 🔒 File ID: ...337c3f2  [Green box]                    │
│                                          Timer: 60:00   │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Challenge   │         [Red Rectangle]                  │
│  Description │                                          │
│              │                                          │
│  Constraints │         Penpot Workspace                 │
│  - ...       │                                          │
│              │                                          │
│  Workspace   │                                          │
│  Info        │                                          │
│  File ID:    │                                          │
│  ...337c3f2  │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### Browser 2 (Chrome)
```
┌─────────────────────────────────────────────────────────┐
│ Food Delivery Dashboard                                 │
│ Designer • Intermediate                                 │
│ 🔒 File ID: ...41a5d98a  [Green box - DIFFERENT!]     │
│                                          Timer: 60:00   │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Challenge   │              ●                           │
│  Description │         [Blue Circle]                    │
│              │                                          │
│  Constraints │         Penpot Workspace                 │
│  - ...       │                                          │
│              │                                          │
│  Workspace   │                                          │
│  Info        │                                          │
│  File ID:    │                                          │
│  ...41a5d98a │                                          │
└──────────────┴──────────────────────────────────────────┘
```

**Key Difference:** File IDs and canvas content are DIFFERENT!

---

## 🚀 Next Steps After Passing

Once isolation is confirmed working:

1. ✅ **Mark as Complete**: Update project status
2. 🔄 **Integrate with Main Flow**: Add to assessment creation
3. 🧹 **Add Cleanup**: Delete files after assessment ends
4. 📤 **Implement Submission**: Save final design
5. 🤖 **Add Evaluation**: AI-based scoring
6. 📊 **Add Analytics**: Track design metrics

---

## 📞 Support

**If test fails:**
1. Check all services are running: `docker-compose ps`
2. Check logs: `docker-compose logs design-service --tail=50`
3. Restart services: `docker-compose restart`
4. Clear browser cache and retry

**Common Issues:**
- File ID shows "N/A" → Backend not returning file_id
- Same file ID → Backend creating same file for all users
- Drawings visible in both → File IDs are actually the same
- Page won't load → Services not running

---

**Test Duration**: 5 minutes  
**Difficulty**: Easy  
**Prerequisites**: Docker running, both browsers installed  
**Success Rate**: Should be 100% if services are running

---

## ✅ Final Checklist

Before starting test:
- [ ] Docker Desktop is running
- [ ] All services are up: `docker-compose ps`
- [ ] Frontend is running on port 3001
- [ ] Backend is running on port 3006
- [ ] Penpot is running on port 9001
- [ ] Both browsers (Edge and Chrome) are installed

During test:
- [ ] Both pages load successfully
- [ ] File IDs are displayed (not "N/A")
- [ ] File IDs are different
- [ ] Visual isolation works (drawings don't cross over)
- [ ] No console errors

After test:
- [ ] Document results
- [ ] Take screenshots if needed
- [ ] Report any issues
- [ ] Proceed to next steps if passed

---

**Ready to test? Open the test page in two browsers and follow the steps above!**

🔗 **Test URL**: `http://localhost:3001/test-workspace.html`
