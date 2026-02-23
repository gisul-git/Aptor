# Camera-Based Proctoring System

This document describes the client-side camera-based proctoring implementation for the AI Assessment Platform.

## Overview

The camera proctoring system runs entirely in the browser using TensorFlow.js models for face detection and analysis. No video is streamed to servers - only violation snapshots are sent when detected.

## Features

### Detection Types

| Event Type | Description | Metadata |
|------------|-------------|----------|
| `MULTI_FACE` | More than one face detected with confidence > 0.5 | `{ facesCount, boxes: [...] }` |
| `GAZE_AWAY` | Eyes looking away for ~2+ seconds (3 consecutive checks) | `{ direction, durationSeconds, confidence }` |
| `SPOOF_DETECTED` | No blinks in 6s or near-zero head movement | `{ reason: "noBlink"\|"staticHead", ... }` |
| `CAMERA_DENIED` | User denied camera permission | `{ error }` |
| `CAMERA_ERROR` | Technical error starting camera | `{ error, stage }` |

### Privacy

- **Local Processing**: All face detection runs in-browser using TensorFlow.js
- **Minimal Data**: Only snapshots captured on violations, not continuous video
- **Consent Required**: Explicit user consent before camera activation
- **Transparent**: Clear notice about what is monitored

## Files

```
frontend/
├── src/
│   ├── hooks/
│   │   └── useCameraProctor.ts    # Core detection hook
│   ├── components/
│   │   └── proctor/
│   │       ├── CameraProctorModal.tsx   # Consent modal
│   │       ├── ProctorStatusWidget.tsx  # Status indicator
│   │       └── index.ts                 # Exports
│   └── pages/
│       └── assessment/[id]/[token]/
│           ├── instructions.tsx  # Shows consent modal
│           └── take.tsx          # Shows status widget
```

## How to Enable Debug Mode

Add one of these query parameters to the assessment URL:

```
?cameraDebug=true
?proctorDebug=true
```

Or set the environment variable:
```
NEXT_PUBLIC_CAMERA_DEBUG=true
```

Debug mode shows:
- Live video preview with face detection boxes
- FPS and detection time metrics
- Gaze vector visualization
- Blink count
- Head movement values

## Configuration

The `useCameraProctor` hook accepts these options:

```typescript
interface UseCameraProctorOptions {
  userId: string;
  assessmentId: string;
  onViolation?: (violation) => void;
  detectionIntervalMs?: number;      // Default: 700ms
  throttleIntervalMs?: number;       // Default: 5000ms (same event)
  gazeAwayThreshold?: number;        // Default: 3 consecutive checks
  multiFaceConfidenceThreshold?: number;  // Default: 0.5
  blinkTimeoutSeconds?: number;      // Default: 6 seconds
  debugMode?: boolean;
  enabled?: boolean;
}
```

## Test Plan

### 1. MULTI_FACE Detection

**Steps:**
1. Start assessment with camera proctoring enabled
2. Have a second person appear in frame
3. Wait for detection (~0.7s)

**Expected Payload:**
```json
{
  "eventType": "MULTI_FACE",
  "timestamp": "2025-12-01T10:30:00.000Z",
  "assessmentId": "abc123",
  "userId": "candidate@example.com",
  "metadata": {
    "facesCount": 2,
    "boxes": [
      { "x": 100, "y": 50, "width": 150, "height": 180, "confidence": 0.95 },
      { "x": 350, "y": 80, "width": 140, "height": 170, "confidence": 0.88 }
    ]
  },
  "snapshotBase64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

### 2. GAZE_AWAY Detection

**Steps:**
1. Start assessment with camera proctoring enabled
2. Look consistently left/right/up/down for ~2.5 seconds
3. Wait for detection

**Expected Payload:**
```json
{
  "eventType": "GAZE_AWAY",
  "timestamp": "2025-12-01T10:31:00.000Z",
  "assessmentId": "abc123",
  "userId": "candidate@example.com",
  "metadata": {
    "direction": "left",
    "durationSeconds": 2.1,
    "confidence": 0.85
  },
  "snapshotBase64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

### 3. SPOOF_DETECTED (No Blink)

**Steps:**
1. Start assessment with camera proctoring enabled
2. Hold a printed photo in front of camera
3. Wait 6+ seconds without blinking

**Expected Payload:**
```json
{
  "eventType": "SPOOF_DETECTED",
  "timestamp": "2025-12-01T10:32:00.000Z",
  "assessmentId": "abc123",
  "userId": "candidate@example.com",
  "metadata": {
    "reason": "noBlink",
    "lastBlinkSecondsAgo": 7.2,
    "totalBlinks": 5
  },
  "snapshotBase64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

### 4. SPOOF_DETECTED (Static Head)

**Steps:**
1. Start assessment with camera proctoring enabled
2. Hold device very still showing a static image
3. Wait for 10+ detection cycles

**Expected Payload:**
```json
{
  "eventType": "SPOOF_DETECTED",
  "timestamp": "2025-12-01T10:33:00.000Z",
  "assessmentId": "abc123",
  "userId": "candidate@example.com",
  "metadata": {
    "reason": "staticHead",
    "avgMovement": 0.8
  },
  "snapshotBase64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

### 5. CAMERA_DENIED

**Steps:**
1. Start assessment and reach camera consent modal
2. Click "Deny Camera" button

**Expected Payload:**
```json
{
  "eventType": "CAMERA_DENIED",
  "timestamp": "2025-12-01T10:34:00.000Z",
  "assessmentId": "abc123",
  "userId": "candidate@example.com",
  "metadata": {
    "source": "consent_modal"
  },
  "snapshotBase64": null
}
```

## Performance Notes

### Model Loading
- BlazeFace (~1MB) loads in ~1-2 seconds
- FaceMesh (~4MB) loads in ~2-4 seconds
- Total initial load: ~3-6 seconds on typical hardware

### Inference Performance
- Detection interval: 700ms default (configurable)
- Inference time: ~50-150ms per frame on modern hardware
- Downscaled to 320x180 for inference to reduce CPU load

### Memory Usage
- TensorFlow.js WebGL backend: ~100-200MB GPU memory
- Video buffer: ~5MB
- Models: ~5MB

### Throttling
- Same event type throttled to once per 5 seconds
- Prevents spam during continuous violations
- Configurable via `throttleIntervalMs`

### Graceful Degradation
- If WebGL unavailable, falls back to CPU (slower)
- If models fail to load, camera proctoring is disabled
- If detection consistently slow, consider increasing interval

## Models Used

1. **BlazeFace** (TensorFlow.js)
   - Face detection
   - Bounding boxes
   - Confidence scores
   - Source: `@tensorflow-models/blazeface`

2. **MediaPipe FaceMesh** (TensorFlow.js)
   - 468 facial landmarks
   - Iris tracking (landmarks 468, 473)
   - Eye landmarks for blink detection
   - Source: `@tensorflow-models/face-landmarks-detection`

## Browser Compatibility

- Chrome 80+ (recommended)
- Firefox 75+
- Edge 80+
- Safari 14+ (limited WebGL support)

WebGL 2.0 required for optimal performance.

## Troubleshooting

### Camera Not Starting
1. Check browser permissions (camera must be allowed)
2. Verify no other app is using the camera
3. Try refreshing the page

### Slow Detection
1. Close other browser tabs
2. Reduce video resolution in code
3. Increase detection interval

### False Positives
1. Ensure good lighting
2. Face camera directly
3. Adjust thresholds in hook options

### Model Loading Failed
1. Check network connection
2. Verify TensorFlow.js packages installed
3. Check browser console for errors

