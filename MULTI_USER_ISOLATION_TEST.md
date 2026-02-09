# Multi-User Isolation Test Guide

## 🎯 Objective
Verify that each candidate gets their own isolated Penpot workspace and cannot see other candidates' work.

---

## 📋 Test Steps

### Step 1: Open in Two Browsers

1. **Browser 1 (Edge)** - Already open at:
   ```
   http://localhost:3001/design/test-direct
   ```

2. **Browser 2 (Chrome/Firefox)** - Open a new browser and navigate to:
   ```
   http://localhost:3001/design/test-direct
   ```

3. **Wait** for both pages to fully load (you'll see the Penpot workspace)

---

### Step 2: Verify Different File IDs

**Check the File ID in both browsers:**

- **Location 1**: Top of the page, under the title (small blue text)
- **Location 2**: Left sidebar, in the blue "Workspace Info" box

**Expected Result:**
- ✅ File IDs should be **DIFFERENT** in each browser
- ✅ Example:
  - Browser 1: `92a07493-962a-80c4-8007-880631e602c4`
  - Browser 2: `92a07493-962a-80c4-8007-880641a5d98a`

**If they're the same:**
- ❌ Isolation is NOT working
- Refresh both browsers and check again

---

### Step 3: Test Visual Isolation

**In Browser 1 (Edge):**
1. Click on the Penpot canvas (right side)
2. Select the **Rectangle tool** (or any shape tool)
3. Draw a **large red rectangle** in the center of the canvas
4. The rectangle should appear in Browser 1

**In Browser 2 (Chrome):**
1. Look at the Penpot canvas
2. Check if you can see the red rectangle from Browser 1

**Expected Result:**
- ✅ Browser 2 should **NOT** see the red rectangle
- ✅ Each browser has its own blank canvas
- ✅ Changes in one browser don't appear in the other

**If you see the rectangle in both:**
- ❌ Isolation is NOT working
- Both browsers are using the same file

---

### Step 4: Test Bidirectional Isolation

**In Browser 2 (Chrome):**
1. Draw a **blue circle** in a different location
2. The circle should appear in Browser 2

**Check Both Browsers:**
- ✅ Browser 1 should only see the red rectangle (not the blue circle)
- ✅ Browser 2 should only see the blue circle (not the red rectangle)

---

### Step 5: Verify in Penpot Dashboard

**Open Penpot directly:**
1. Navigate to: `http://localhost:9001`
2. Sign in with:
   - Email: `admin@example.com`
   - Password: `12312312`
3. Go to **Projects** → **Design Assessment**
4. You should see **multiple files** (one for each test)

**Expected Result:**
- ✅ Multiple "Food Delivery Dashboard" files
- ✅ Each file has a different timestamp
- ✅ Opening each file shows different content

---

## ✅ Success Criteria

All of the following must be true:

1. ✅ **Different File IDs**: Each browser shows a unique file ID
2. ✅ **Visual Isolation**: Drawings in one browser don't appear in the other
3. ✅ **Separate Files**: Penpot dashboard shows multiple distinct files
4. ✅ **No Errors**: No console errors in either browser
5. ✅ **Concurrent Access**: Both users can work simultaneously without conflicts

---

## ❌ Failure Scenarios

### Scenario 1: Same File ID in Both Browsers
**Problem**: Workspace isolation is not working
**Cause**: Backend is returning the same file for all users
**Solution**: Check backend logs for file creation errors

### Scenario 2: Drawings Appear in Both Browsers
**Problem**: Both browsers are connected to the same Penpot file
**Cause**: File IDs are the same or URL is cached
**Solution**: 
- Hard refresh both browsers (Ctrl + Shift + R)
- Check file IDs again
- Verify backend is creating new files

### Scenario 3: One Browser Shows Error
**Problem**: File creation failed for one user
**Cause**: API error or rate limiting
**Solution**: Check backend logs and retry

---

## 🔍 Debugging

### Check Backend Logs
```bash
docker-compose logs design-service --tail=50
```

Look for:
- ✅ "File created successfully: <file-id>"
- ✅ "Workspace created successfully"
- ❌ "Create file failed"
- ❌ "Login failed"

### Check Browser Console
Press **F12** in each browser and check the Console tab for:
- ✅ "Question generated: ..."
- ✅ "Workspace created: ..."
- ❌ CORS errors
- ❌ Network errors

### Check Network Tab
Press **F12** → **Network** tab and verify:
- ✅ POST to `/api/v1/design/questions/generate` returns 200
- ✅ POST to `/api/v1/design/workspace/create` returns 200
- ✅ Response includes unique `file_id`

---

## 📊 Test Results Template

```
=== MULTI-USER ISOLATION TEST RESULTS ===

Date: [DATE]
Time: [TIME]

Browser 1 (Edge):
- File ID: [FILE_ID_1]
- Drawing: Red rectangle
- Visible: [YES/NO]

Browser 2 (Chrome):
- File ID: [FILE_ID_2]
- Drawing: Blue circle
- Visible: [YES/NO]

Cross-Browser Visibility:
- Browser 1 sees Browser 2's drawing: [YES/NO]
- Browser 2 sees Browser 1's drawing: [YES/NO]

Penpot Dashboard:
- Number of files created: [COUNT]
- Files have different IDs: [YES/NO]

Overall Result: [PASS/FAIL]

Notes:
[Any observations or issues]
```

---

## 🎉 Expected Final Result

When the test passes, you should see:

**Browser 1 (Edge):**
- File ID: `...e602c4` (last 6 chars)
- Canvas: Red rectangle only
- Status: ✓ Isolated workspace

**Browser 2 (Chrome):**
- File ID: `...d98a` (last 6 chars, different)
- Canvas: Blue circle only
- Status: ✓ Isolated workspace

**Penpot Dashboard:**
- 2+ files in "Design Assessment" project
- Each file shows different content
- Files created at different times

---

## 🚀 Next Steps After Passing

Once isolation is confirmed:
1. ✅ Mark isolation as verified
2. Move to submission implementation
3. Add cleanup for old files
4. Integrate with main assessment flow

---

**Test Duration**: ~5 minutes
**Difficulty**: Easy
**Prerequisites**: Both browsers installed, design-service running
