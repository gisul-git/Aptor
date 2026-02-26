# Testing Guide: Activity Patterns Monitoring (Feature #7)

This guide will help you test all the activity pattern detection features.

## Prerequisites

1. **Start the application:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Ensure backend is running** (API Gateway on port 80)

3. **Open browser DevTools Console** (F12) to see violation logs

## Test Scenarios

### 1. Test Rapid Clicking Detection

**Threshold:** >5 clicks in 2 seconds

**Steps:**
1. Start a test/assessment as a candidate
2. Wait for the test to load (proctoring should be active)
3. Rapidly click anywhere on the page (6+ clicks within 2 seconds)
4. **Expected Result:**
   - Console log: `[ActivityPatternProctor] RAPID_CLICKING violation recorded`
   - Violation sent to backend
   - Visible in admin analytics page under "🖱️ Activity Patterns" tab

**Verify in Admin Dashboard:**
- Go to Analytics page for the test
- Select the candidate
- Open "Proctoring Logs"
- Check "🖱️ Activity Patterns" tab
- Should see "Rapid clicking detected" with metadata:
  ```json
  {
    "clickCount": 6,
    "windowMs": 2000,
    "clicksPerSecond": 3.0
  }
  ```

---

### 2. Test Copy-Paste Detection

**Threshold:** >50 characters per second

**Steps:**
1. Start a test/assessment
2. Open a text editor or notepad outside the browser
3. Copy a large block of text (100+ characters)
4. Switch back to the test page
5. Paste the text (Ctrl+V or Cmd+V) into any text field
6. **Expected Result:**
   - Console log: `[ActivityPatternProctor] COPY_PASTE_DETECTED violation recorded`
   - Violation recorded with character count

**Verify:**
- Admin dashboard → Analytics → Proctoring Logs
- "Activity Patterns" tab
- Should see "Copy-paste pattern detected" with:
  ```json
  {
    "characters": 150,
    "windowMs": 1000,
    "charsPerSecond": 150.0
  }
  ```

---

### 3. Test Excessive Mouse Movement

**Threshold:** >10,000 pixels moved in 10 seconds

**Steps:**
1. Start a test/assessment
2. Move your mouse rapidly in large circles or zigzag patterns
3. Keep moving for 10+ seconds continuously
4. **Expected Result:**
   - Console log: `[ActivityPatternProctor] EXCESSIVE_MOUSE_MOVEMENT violation recorded`
   - Violation recorded when threshold exceeded

**Verify:**
- Admin dashboard → Analytics → Proctoring Logs
- "Activity Patterns" tab
- Should see "Excessive mouse movement" with:
  ```json
  {
    "distance": 12500,
    "windowMs": 10000,
    "pixelsPerSecond": 1250.0
  }
  ```

**Tip:** To test faster, you can temporarily lower the threshold in the code:
```typescript
excessiveMouseDistance = 5000, // Lower threshold for testing
```

---

### 4. Test Excessive Scrolling

**Threshold:** >50 scroll events in 5 seconds

**Steps:**
1. Start a test/assessment
2. Rapidly scroll up and down using:
   - Mouse wheel
   - Trackpad gestures
   - Scroll bar dragging
3. Scroll continuously for 5+ seconds (50+ scroll events)
4. **Expected Result:**
   - Console log: `[ActivityPatternProctor] EXCESSIVE_SCROLLING violation recorded`
   - Violation recorded

**Verify:**
- Admin dashboard → Analytics → Proctoring Logs
- "Activity Patterns" tab
- Should see "Excessive scrolling" with:
  ```json
  {
    "scrollCount": 55,
    "windowMs": 5000,
    "scrollsPerSecond": 11.0
  }
  ```

---

### 5. Test Prolonged Inactivity

**Threshold:** >5 minutes (300,000ms) without any activity

**Steps:**
1. Start a test/assessment
2. **Stop all activity:**
   - Don't move the mouse
   - Don't type anything
   - Don't click anything
   - Don't scroll
3. Wait 5+ minutes
4. **Expected Result:**
   - Console log: `[ActivityPatternProctor] PROLONGED_INACTIVITY violation recorded`
   - Violation recorded every minute after 5 minutes of inactivity

**Verify:**
- Admin dashboard → Analytics → Proctoring Logs
- "Activity Patterns" tab
- Should see "Prolonged inactivity" with:
  ```json
  {
    "inactivityMs": 300000,
    "inactivityMinutes": 5
  }
  ```

**Tip:** For faster testing, you can temporarily lower the threshold:
```typescript
inactivityThresholdMs = 60000, // 1 minute for testing
```

---

## Quick Test Script

For a quick test of all features, you can use this browser console script:

```javascript
// Run this in the browser console while on a test page

// 1. Test rapid clicking
console.log('Testing rapid clicking...');
for (let i = 0; i < 10; i++) {
  document.body.click();
  await new Promise(r => setTimeout(r, 100));
}

// 2. Test copy-paste (simulate)
console.log('Testing copy-paste...');
const textarea = document.querySelector('textarea, input[type="text"]');
if (textarea) {
  const longText = 'A'.repeat(100);
  textarea.value = longText;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// 3. Test excessive scrolling
console.log('Testing excessive scrolling...');
for (let i = 0; i < 60; i++) {
  window.scrollBy(0, 10);
  await new Promise(r => setTimeout(r, 50));
}
```

---

## Monitoring in Real-Time

### Browser Console

Watch for these logs:
```
[ActivityPatternProctor] RAPID_CLICKING violation recorded
[ActivityPatternProctor] COPY_PASTE_DETECTED violation recorded
[ActivityPatternProctor] EXCESSIVE_MOUSE_MOVEMENT violation recorded
[ActivityPatternProctor] EXCESSIVE_SCROLLING violation recorded
[ActivityPatternProctor] PROLONGED_INACTIVITY violation recorded
```

### Network Tab

Check the Network tab in DevTools:
- Filter by "record"
- Look for POST requests to `/api/proctor/record`
- Check the request payload for activity pattern violations

### Admin Dashboard

1. Navigate to: `/assessments/[id]/analytics` or `/dsa/tests/[id]/analytics`
2. Select a candidate
3. Click "Proctoring Logs"
4. Open the "🖱️ Activity Patterns" tab
5. View all activity pattern violations

---

## Adjusting Thresholds for Testing

If you want to test with lower thresholds, modify `useActivityPatternProctor` hook:

```typescript
useActivityPatternProctor({
  userId: candidateIdStr,
  assessmentId: assessmentIdStr,
  // Lower thresholds for easier testing
  rapidClickThreshold: 3,        // 3 clicks instead of 5
  rapidClickWindowMs: 1000,       // 1 second instead of 2
  copyPasteThreshold: 20,          // 20 chars instead of 50
  inactivityThresholdMs: 30000,   // 30 seconds instead of 5 minutes
  excessiveMouseDistance: 5000,    // 5000 pixels instead of 10000
  excessiveScrollThreshold: 20,   // 20 scrolls instead of 50
  // ... rest of config
});
```

---

## Troubleshooting

### Violations not appearing?

1. **Check if proctoring is enabled:**
   - Console should show: `[ActivityPatternProctor] Monitoring started for assessment: [id]`

2. **Check browser console for errors:**
   - Look for any JavaScript errors
   - Check if the hook is being called

3. **Verify backend is receiving:**
   - Check Network tab for POST requests to `/api/proctor/record`
   - Check backend logs

4. **Check event types are registered:**
   - Verify in `frontend/src/pages/api/proctor/record.ts`
   - Event types should be in `VALID_EVENT_TYPES` set

### Violations appearing too frequently?

- Increase the thresholds in the hook configuration
- Adjust the time windows (`*WindowMs` parameters)

### Violations not appearing frequently enough?

- Decrease the thresholds
- Check if the `enabled` prop is `true`
- Verify the test is in the correct state (`appState === 'ready'`)

---

## Expected Performance

- **No lag for candidates:** All monitoring is lightweight
- **Minimal CPU usage:** Event listeners are passive
- **Network impact:** Only sends violations (not continuous data)
- **Memory usage:** Event history is cleaned up automatically

---

## Next Steps

After testing Feature #7, you can proceed to:
- Feature #3/#8: Automated Screenshot Analysis
- Feature #6: Multi-Monitor Detection
- AI Tool Detection
