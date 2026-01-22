# System Pre-Check Page

This document describes the candidate pre-check system that validates camera, microphone, fullscreen, network, and tab-switch readiness before starting an exam.

## Overview

The pre-check page runs a series of automated tests to ensure the candidate's system is ready for a proctored exam. All checks run client-side with no data sent to servers except for the initial assessment info fetch.

## Features

### Checks Performed

| Check | Description | Pass Criteria |
|-------|-------------|---------------|
| **Camera** | Validates camera access and stream | Permission granted, stream received |
| **Microphone** | Validates microphone access and audio input | Permission granted, audio levels detected |
| **Fullscreen** | Tests browser fullscreen API support | API available, fullscreen can be entered |
| **Network** | Measures latency and download speed | Latency < 500ms, Download > 0.5 Mbps |
| **Tab Switch** | Verifies visibility change detection | Tab switch event captured |
| **Browser** | Checks browser compatibility | Supported browser and version |

### Privacy

- **No Recording**: No audio or video is recorded during pre-check
- **No Upload**: Media streams are not sent to any server
- **Immediate Release**: Streams are stopped after each check completes
- **Local Processing**: All tests run entirely in the browser

## Files

```
frontend/
├── src/
│   ├── hooks/
│   │   └── usePrecheck.ts           # Core pre-check logic hook
│   ├── components/
│   │   └── precheck/
│   │       ├── PrecheckCard.tsx     # Individual check card component
│   │       ├── NetworkTest.tsx      # Network metrics display
│   │       ├── index.ts             # Exports
│   │       └── PRECHECK_README.md   # This documentation
│   └── pages/
│       └── precheck/
│           └── [assessmentId]/
│               └── [token].tsx      # Pre-check page
```

## How to Test Locally

### 1. Access the Pre-Check Page

After entering your credentials on the assessment entry page, you'll be automatically redirected to:

```
http://localhost:3000/precheck/{assessmentId}/{token}
```

### 2. Enable Debug Mode

Add `?debug=1` to the URL or set the environment variable:

```bash
# In .env.local
NEXT_PUBLIC_PRECHECK_DEBUG=1
```

Debug mode shows:
- Device lists (cameras, microphones)
- Browser information
- Real-time logs
- Timing information

### 3. Test Each Check

#### Camera Test
1. Click "Retry" on the Camera card
2. Allow camera permission when prompted
3. Verify video preview appears
4. Use device dropdown to switch cameras

#### Microphone Test
1. Click "Retry" on the Microphone card
2. Allow microphone permission when prompted
3. Speak to see the audio level meter respond
4. Use device dropdown to switch microphones

#### Network Test
1. Click "Retry" on the Network card
2. Wait for latency and download speed measurement
3. Verify metrics display in the card

#### Fullscreen Test
1. Click "Test Fullscreen" button
2. Browser should enter fullscreen mode briefly
3. Check should pass after returning from fullscreen

#### Tab Switch Test
1. Click "Test Tab Switch" button
2. Switch to another browser tab
3. Wait 1-2 seconds
4. Return to the pre-check tab
5. Check should pass upon return

## Network Thresholds

Default thresholds can be adjusted in the `usePrecheck` hook:

```typescript
const {
  // ...
} = usePrecheck({
  maxLatencyMs: 500,        // Maximum acceptable latency
  minDownloadMbps: 0.5,     // Minimum download speed (Mbps)
  minUploadMbps: 0.25,      // Minimum upload speed (Mbps) - optional
});
```

### Recommended Thresholds by Exam Type

| Exam Type | Max Latency | Min Download |
|-----------|-------------|--------------|
| Text-only | 1000ms | 0.25 Mbps |
| Standard | 500ms | 0.5 Mbps |
| Video proctored | 300ms | 1.5 Mbps |
| Live interview | 200ms | 2.0 Mbps |

## QA Checklist

### ✅ Acceptance Criteria

- [ ] **Candidate with working camera & mic**
  - All checks run automatically and pass
  - "Proceed to Exam" button is enabled
  - "System Ready" banner displays

- [ ] **Candidate denies camera**
  - Camera check fails with "Permission Denied" message
  - Helpful troubleshooting steps are shown
  - "Proceed to Exam" stays disabled (unless policy allows)
  - "Proceed Without Camera" option shown (if policy allows)

- [ ] **Candidate with poor network**
  - Network card shows measured latency and speed
  - Card shows FAIL status with red indicators
  - Troubleshooting steps suggest network improvements

- [ ] **Tab-switch test**
  - Instructions display when test starts
  - Switching tabs is detected
  - Returning to tab completes the test successfully

- [ ] **Fullscreen test**
  - "Test Fullscreen" button triggers fullscreen mode
  - Browser-specific guidance shown if blocked
  - Check passes after successful fullscreen entry

- [ ] **Debug mode**
  - `?debug=1` shows debug panel
  - Device lists are visible
  - Logs are captured and displayable

### Edge Cases

- [ ] No camera connected - shows "NO_DEVICE" error with steps
- [ ] No microphone connected - shows appropriate error
- [ ] Camera in use by another app - provides troubleshooting
- [ ] Browser not supported - shows warning with alternatives
- [ ] Non-HTTPS context - displays secure context warning
- [ ] Multiple cameras/mics - device selector works correctly

## Error Codes

| Code | Description | User Message |
|------|-------------|--------------|
| `NO_DEVICE` | Device not found | "No camera/microphone detected" |
| `PERMISSION_DENIED` | User denied access | "Access denied. Please allow permissions" |
| `CONSTRAINTS_NOT_SATISFIED` | Device can't meet requirements | "Device doesn't support required settings" |
| `NOT_ALLOWED` | Blocked by browser policy | "Access blocked. Check browser settings" |
| `UNKNOWN` | Unrecognized error | "An error occurred. Please try again" |

## Integration Flow

```
┌─────────────────────┐
│  Assessment Entry   │
│  (Verify candidate) │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Pre-Check Page     │ ◄── You are here
│  (System validation)│
└─────────┬───────────┘
          │ All checks pass
          ▼
┌─────────────────────┐
│  Instructions Page  │
│  (Exam rules)       │
└─────────┬───────────┘
          │ Accept & Fullscreen
          ▼
┌─────────────────────┐
│  Camera Consent     │
│  (Start proctoring) │
└─────────┬───────────┘
          │ Allow camera
          ▼
┌─────────────────────┐
│  Take Assessment    │
│  (Exam in progress) │
└─────────────────────┘
```

## Supported Browsers

| Browser | Minimum Version | Notes |
|---------|-----------------|-------|
| Chrome | 80+ | Recommended |
| Firefox | 75+ | Full support |
| Edge | 80+ | Full support |
| Safari | 14+ | Limited WebRTC |

## Troubleshooting for Developers

### Camera Not Working in Development

1. Ensure you're using `localhost` or HTTPS
2. Check if camera is being used by another application
3. Try incognito mode to reset permissions

### Network Test Fails

1. Check if `/api/health` endpoint exists
2. Verify no CORS issues in development
3. Check network tab for failed requests

### Tab Switch Not Detecting

1. Ensure Page Visibility API is supported
2. Check for extensions blocking visibility events
3. Verify the page has focus before testing

### Audio Level Always Zero

1. Check microphone isn't muted at OS level
2. Verify correct microphone is selected
3. Try speaking louder or closer to mic

