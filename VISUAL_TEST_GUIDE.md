# 🎨 Visual Test Guide - Multi-User Isolation

## Quick Visual Reference

This guide shows you EXACTLY what to look for when testing.

---

## 📱 What You'll See

### Initial Page Load

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    ⏳ Initializing workspace...                 │
│                                                                 │
│                         [Spinner]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Wait 3-5 seconds** for the page to load.

---

### Loaded Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Food Delivery Dashboard                      Timer: 60:00       │
│ Designer • Intermediate                      [Submit]           │
│ ┌─────────────────────────────────────┐                        │
│ │ 🔒 File ID: ...8b8610cdb49d         │ ← GREEN BOX            │
│ └─────────────────────────────────────┘                        │
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│ 📋 Challenge     │                                              │
│                  │                                              │
│ You are          │         PENPOT WORKSPACE                     │
│ designing a      │         (Draw here)                          │
│ mobile...        │                                              │
│                  │                                              │
│ ⚠️ Constraints   │                                              │
│ • Design for     │                                              │
│   mobile         │                                              │
│ • Include 3      │                                              │
│   sections       │                                              │
│                  │                                              │
│ ┌──────────────┐ │                                              │
│ │🔒 Workspace  │ │                                              │
│ │ Info         │ │                                              │
│ │              │ │                                              │
│ │ User:        │ │                                              │
│ │ test_user    │ │                                              │
│ │              │ │                                              │
│ │ File ID:     │ │                                              │
│ │ 92a07493-    │ │                                              │
│ │ 962a-80c4-   │ │                                              │
│ │ 8007-        │ │                                              │
│ │ 8b8610cdb49d │ │                                              │
│ │              │ │                                              │
│ │ ✓ Isolated   │ │                                              │
│ │   workspace  │ │                                              │
│ └──────────────┘ │                                              │
└──────────────────┴──────────────────────────────────────────────┘
```

---

## 🔍 Where to Find File ID

### Location 1: Top Header (Green Box)
```
┌─────────────────────────────────────┐
│ 🔒 File ID: ...8b8610cdb49d         │  ← Look here first!
└─────────────────────────────────────┘
```
- **Color**: Green background with dark green border
- **Location**: Under the title "Food Delivery Dashboard"
- **Format**: Shows last 12 characters of file ID

### Location 2: Left Sidebar (Blue Box)
```
┌──────────────────────────┐
│ 🔒 Workspace Info        │
│                          │
│ User: test_user          │
│                          │
│ File ID:                 │
│ ┌──────────────────────┐ │
│ │ 92a07493-962a-80c4-  │ │  ← Full file ID here
│ │ 8007-8b8610cdb49d    │ │
│ └──────────────────────┘ │
│                          │
│ ✓ Isolated workspace     │
└──────────────────────────┘
```
- **Color**: Blue background with blue border
- **Location**: Bottom of left sidebar
- **Format**: Shows FULL file ID (UUID format)

---

## 🎯 Step-by-Step Visual Test

### Step 1: Open in Two Browsers

**Browser 1 (Edge):**
```
Address bar: http://localhost:3001/test-workspace.html
```

**Browser 2 (Chrome):**
```
Address bar: http://localhost:3001/test-workspace.html
```

---

### Step 2: Compare File IDs

**Browser 1 (Edge) - Green Box:**
```
🔒 File ID: ...8b8610cdb49d
                 ↑↑↑↑↑↑↑↑↑↑↑↑
            Write this down!
```

**Browser 2 (Chrome) - Green Box:**
```
🔒 File ID: ...8b8621f7a3e2
                 ↑↑↑↑↑↑↑↑↑↑↑↑
            Write this down!
```

**Compare the last 12 characters:**
```
Edge:   ...8b8610cdb49d
Chrome: ...8b8621f7a3e2
           ↑↑↑↑↑↑↑↑↑↑↑↑
        DIFFERENT? ✅ PASS
        SAME?      ❌ FAIL
```

---

### Step 3: Draw in Browser 1 (Edge)

**Find Penpot Toolbar (left side of workspace):**
```
┌─────┐
│  ▭  │ ← Rectangle tool (click this)
│  ○  │ ← Circle tool
│  ✏  │ ← Pen tool
│  T  │ ← Text tool
└─────┘
```

**Draw a rectangle:**
1. Click the **Rectangle tool** (▭)
2. Click and drag in the canvas to draw
3. Your rectangle appears

**Change color to RED:**
1. Select the rectangle (click on it)
2. Look for color picker on the right side
3. Click on "Fill" color
4. Choose RED (#FF0000)

**Result in Browser 1:**
```
┌──────────────────────────────────────┐
│                                      │
│     ┌─────────────────┐              │
│     │                 │              │
│     │   RED RECTANGLE │              │
│     │                 │              │
│     └─────────────────┘              │
│                                      │
└──────────────────────────────────────┘
```

---

### Step 4: Check Browser 2 (Chrome)

**Look at the Penpot workspace in Chrome:**

**✅ CORRECT (Isolated):**
```
┌──────────────────────────────────────┐
│                                      │
│                                      │
│         (Empty canvas)               │
│                                      │
│                                      │
└──────────────────────────────────────┘
```
**No red rectangle visible!**

**❌ WRONG (Not Isolated):**
```
┌──────────────────────────────────────┐
│                                      │
│     ┌─────────────────┐              │
│     │   RED RECTANGLE │ ← Visible!   │
│     └─────────────────┘              │
│                                      │
└──────────────────────────────────────┘
```
**Red rectangle is visible - isolation failed!**

---

### Step 5: Draw in Browser 2 (Chrome)

**Draw a blue circle:**
1. Click the **Circle tool** (○)
2. Click and drag to draw a circle
3. Change color to BLUE (#0000FF)

**Result in Browser 2:**
```
┌──────────────────────────────────────┐
│                                      │
│                  ●                   │
│              BLUE CIRCLE             │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

---

### Step 6: Final Check

**Browser 1 (Edge) should show:**
```
┌──────────────────────────────────────┐
│     ┌─────────────────┐              │
│     │   RED RECTANGLE │ ← Only this  │
│     └─────────────────┘              │
│                                      │
│  (No blue circle)                    │
└──────────────────────────────────────┘
```

**Browser 2 (Chrome) should show:**
```
┌──────────────────────────────────────┐
│                                      │
│                  ●                   │
│              BLUE CIRCLE  ← Only this│
│                                      │
│  (No red rectangle)                  │
└──────────────────────────────────────┘
```

**✅ If each browser shows ONLY its own drawing → ISOLATION WORKS!**

---

## 🚨 Common Visual Issues

### Issue 1: File ID shows "N/A"

**What you see:**
```
┌─────────────────────────────────────┐
│ 🔒 File ID: N/A                     │  ← Problem!
└─────────────────────────────────────┘
```

**Fix:**
```bash
docker-compose restart design-service
# Wait 5 seconds, refresh browser
```

---

### Issue 2: Same File ID in Both Browsers

**Browser 1:**
```
🔒 File ID: ...8b8610cdb49d
```

**Browser 2:**
```
🔒 File ID: ...8b8610cdb49d  ← Same! Problem!
```

**Fix:**
- Hard refresh both browsers: `Ctrl + Shift + R`
- Close and reopen both browsers
- Check backend logs

---

### Issue 3: Spinner Never Stops

**What you see:**
```
┌─────────────────────────────────────┐
│                                     │
│    ⏳ Initializing workspace...     │
│         [Spinning forever]          │
│                                     │
└─────────────────────────────────────┘
```

**Fix:**
1. Press `F12` to open console
2. Look for red errors
3. Check if services are running:
   ```bash
   docker-compose ps
   ```

---

### Issue 4: Black/Empty Workspace

**What you see:**
```
┌──────────────┬──────────────────────┐
│              │                      │
│  Sidebar     │   [Black screen]    │
│  loads OK    │                      │
│              │                      │
└──────────────┴──────────────────────┘
```

**Fix:**
```bash
docker-compose restart penpot-frontend penpot-backend
# Wait 10 seconds, refresh browser
```

---

## ✅ Success Checklist

Use this checklist while testing:

```
[ ] Both pages loaded (no spinner)
[ ] File ID displayed in green box (not "N/A")
[ ] File IDs are DIFFERENT in each browser
[ ] Red rectangle drawn in Browser 1
[ ] Red rectangle NOT visible in Browser 2
[ ] Blue circle drawn in Browser 2
[ ] Blue circle NOT visible in Browser 1
[ ] No console errors (F12)
[ ] Both users can draw simultaneously
```

**If all checked → 🎉 TEST PASSED!**

---

## 📸 Take Screenshots

For documentation, take screenshots of:

1. **Both browsers side-by-side** showing different file IDs
2. **Browser 1** with red rectangle
3. **Browser 2** with blue circle (no red rectangle)
4. **Penpot dashboard** showing multiple files

---

## 🎉 Expected Final State

### Browser 1 (Edge)
- File ID: `...8b8610cdb49d`
- Canvas: Red rectangle only
- Status: ✓ Isolated

### Browser 2 (Chrome)
- File ID: `...8b8621f7a3e2` (different!)
- Canvas: Blue circle only
- Status: ✓ Isolated

### Penpot Dashboard
- Multiple files in "Design Assessment" project
- Each file has different content
- Files created at different times

---

**Test Duration**: 5 minutes  
**Difficulty**: Easy  
**Success Rate**: Should be 100%

**Ready? Open the test page in two browsers!**

🔗 **http://localhost:3001/test-workspace.html**
