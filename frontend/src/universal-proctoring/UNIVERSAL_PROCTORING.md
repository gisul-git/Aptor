# Universal Proctoring System Documentation

## Overview

The Universal Proctoring System is a comprehensive, standalone proctoring solution designed to work across all assessment competencies (AI Assessments, DSA Tests, AIML Tests, and Custom MCQ). It provides a unified API for implementing proctoring features regardless of the assessment type.

## Architecture

The system is built with a modular architecture:

```
UniversalProctoringService (Main Orchestrator)
├── AIProctoringService (Face detection, gaze tracking)
├── TabSwitchService (Tab/window focus detection)
├── FullscreenService (Fullscreen enforcement)
└── Live Proctoring (WebRTC-based admin monitoring)
    ├── CandidateLiveService (Candidate-side streaming)
    └── AdminLiveService (Admin-side monitoring)
```

## Core Features

### 1. AI Proctoring
- **Face Detection**: Detects presence/absence of face, multiple faces
- **Gaze Tracking**: Monitors eye direction (center, left, right, up, down, away)
- **Blink Detection**: Tracks eye aspect ratio for blink detection
- **Violation Detection**: 
  - `NO_FACE_DETECTED`: No face detected for threshold duration
  - `MULTIPLE_FACES_DETECTED`: Multiple faces detected
  - `GAZE_AWAY`: Gaze away from screen for threshold duration

### 2. Tab Switch Detection
- **Tab Switch Detection**: Monitors when user switches browser tabs
- **Window Focus Detection**: Detects when browser window loses focus
- **Violation Events**:
  - `TAB_SWITCH`: User switched to another tab
  - `FOCUS_LOST`: Browser window lost focus

### 3. Fullscreen Enforcement
- **Fullscreen Detection**: Monitors fullscreen state
- **Fullscreen Lock**: Prevents exiting fullscreen mode
- **Violation Events**:
  - `FULLSCREEN_EXIT`: User exited fullscreen mode
  - `FULLSCREEN_ENABLED`: Fullscreen mode entered

### 4. Live Proctoring (CCTV-style Monitoring)
- **WebRTC Streaming**: Real-time video streaming from candidate to admin
- **Dual Stream Support**: Webcam + Screen sharing
- **Admin Dashboard**: Real-time monitoring of multiple candidates
- **Connection Management**: Automatic reconnection and session management

## Proctoring Modes

### AI Proctoring Mode
When `aiProctoringEnabled: true`:
- ✅ AI face detection and gaze tracking
- ✅ Tab switch detection
- ✅ Fullscreen enforcement
- ✅ Camera required

### Live Proctoring Mode
When `liveProctoringEnabled: true`:
- ✅ Webcam streaming to admin
- ✅ Screen sharing to admin
- ✅ Admin can monitor in real-time
- ✅ Camera required
- ❌ Tab switch detection disabled (candidates can switch tabs freely)
- ❌ Fullscreen enforcement disabled (no fullscreen lock)

### Combined Mode
When both `aiProctoringEnabled: true` and `liveProctoringEnabled: true`:
- ✅ All AI proctoring features
- ✅ All live proctoring features
- ✅ Camera shared between both systems

## Usage

### React Hook (Recommended)

```typescript
import { useUniversalProctoring } from '@/universal-proctoring';

function AssessmentPage() {
  const {
    state,
    isRunning,
    violations,
    startProctoring,
    stopProctoring,
    requestFullscreen,
    isFullscreen,
  } = useUniversalProctoring({
    onViolation: (violation) => {
      console.log('Violation:', violation);
    },
    onFullscreenExit: () => {
      console.log('Fullscreen exited');
    },
    debug: true,
  });

  useEffect(() => {
    if (videoRef.current) {
      startProctoring({
        settings: {
          aiProctoringEnabled: true,
          liveProctoringEnabled: false,
        },
        session: {
          userId: candidateId,
          assessmentId: assessmentId,
        },
        videoElement: videoRef.current,
      });
    }

    return () => {
      stopProctoring();
    };
  }, []);

  return (
    <div>
      {state.isModelLoaded && (
        <video ref={videoRef} autoPlay playsInline muted />
      )}
      {violations.length > 0 && (
        <div>Violations: {violations.length}</div>
      )}
    </div>
  );
}
```

### Service Class (Advanced)

```typescript
import { UniversalProctoringService } from '@/universal-proctoring';

const service = new UniversalProctoringService();

await service.startProctoring({
  settings: {
    aiProctoringEnabled: true,
    liveProctoringEnabled: false,
  },
  session: {
    userId: 'candidate-id',
    assessmentId: 'assessment-id',
  },
  videoElement: videoElement,
  debug: true,
}, {
  onViolation: (violation) => {
    console.log('Violation:', violation);
  },
  onStateChange: (state) => {
    console.log('State:', state);
  },
});

// Later...
service.stopProctoring();
```

## Live Proctoring Implementation

### Candidate Side

```typescript
import { live } from '@/universal-proctoring';

const candidateService = new live.CandidateLiveService({
  assessmentId: 'assessment-id',
  candidateId: 'candidate-id',
  debugMode: true,
});

await candidateService.start({
  onStateChange: (state) => {
    console.log('Live state:', state);
  },
  onError: (error) => {
    console.error('Live error:', error);
  },
}, screenStream, webcamStream, existingSessionId, existingWebSocket);

// Later...
await candidateService.stop();
```

### Admin Side

```typescript
import { live } from '@/universal-proctoring';

const adminService = new live.AdminLiveService({
  assessmentId: 'assessment-id',
  adminId: 'admin-id',
  debugMode: true,
});

await adminService.startMonitoring({
  onStateChange: (state) => {
    console.log('Admin state:', state);
    // state.candidateStreams contains all candidate streams
  },
  onCandidateConnected: (sessionId, candidateId) => {
    console.log('Candidate connected:', candidateId);
  },
  onCandidateDisconnected: (sessionId) => {
    console.log('Candidate disconnected:', sessionId);
  },
  onError: (error) => {
    console.error('Admin error:', error);
  },
});

// Get candidate streams
const streams = adminService.getState().candidateStreams;
streams.forEach((streamInfo, sessionId) => {
  console.log('Session:', sessionId);
  console.log('Webcam:', streamInfo.webcamStream);
  console.log('Screen:', streamInfo.screenStream);
});

// Later...
adminService.stopMonitoring();
```

## Configuration

### AI Proctoring Configuration

```typescript
const aiConfig = {
  detectionIntervalMs: 700,        // Detection interval (default: 700ms)
  throttleIntervalMs: 5000,        // Throttle same event type (default: 5s)
  gazeAwayThreshold: 3,            // Consecutive gaze away checks (default: 3)
  noFaceThreshold: 5,              // Consecutive no-face checks (default: 5)
  faceConfidenceThreshold: 0.5,    // Face detection confidence (default: 0.5)
  debugMode: false,                 // Enable debug logging
};
```

### Tab Switch Configuration

```typescript
const tabConfig = {
  enableFullscreenDetection: true,  // Enable fullscreen exit detection
  enableTabSwitchDetection: true,    // Enable tab switch detection
  enableFocusDetection: true,        // Enable window blur/focus detection
};
```

## Violation Types

### AI Proctoring Violations
- `NO_FACE_DETECTED`: No face detected for threshold duration
- `MULTIPLE_FACES_DETECTED`: Multiple faces detected in frame
- `GAZE_AWAY`: Gaze away from screen for threshold duration

### Tab Switch Violations
- `TAB_SWITCH`: User switched to another browser tab
- `FOCUS_LOST`: Browser window lost focus

### Fullscreen Violations
- `FULLSCREEN_EXIT`: User exited fullscreen mode
- `FULLSCREEN_ENABLED`: Fullscreen mode entered (informational)

### System Events
- `PROCTORING_STARTED`: Proctoring system started
- `PROCTORING_STOPPED`: Proctoring system stopped
- `CAMERA_DENIED`: Camera permission denied
- `CAMERA_ERROR`: Camera access error

## Violation Data Structure

```typescript
interface ProctoringViolation {
  eventType: ProctoringEventType;
  timestamp: string;              // ISO 8601 timestamp
  assessmentId: string;
  userId: string;
  metadata?: Record<string, unknown>;  // Additional violation data
  snapshotBase64?: string | null;      // Base64 encoded snapshot (if available)
}
```

## State Management

### Proctoring State

```typescript
interface ProctoringState {
  isRunning: boolean;              // Whether proctoring is active
  isCameraOn: boolean;             // Whether camera is active
  isModelLoaded: boolean;          // Whether AI model is loaded
  modelError: string | null;       // Model loading error (if any)
  facesCount: number;              // Number of faces detected
  gazeDirection: GazeDirection | null;  // Current gaze direction
  isFullscreen: boolean;            // Whether in fullscreen mode
  errors: string[];                // Array of error messages
  lastViolation: ProctoringViolation | null;  // Last violation recorded
}
```

### Live Proctoring State (Candidate)

```typescript
interface CandidateLiveState {
  isStreaming: boolean;            // Whether streaming is active
  connectionState: LiveConnectionState;  // Connection state
  sessionId: string | null;        // Session ID
  error: string | null;            // Error message (if any)
}
```

### Live Proctoring State (Admin)

```typescript
interface AdminLiveState {
  isMonitoring: boolean;            // Whether monitoring is active
  isLoading: boolean;               // Whether loading sessions
  activeSessions: string[];         // Array of active session IDs
  candidateStreams: Map<string, CandidateStreamInfo>;  // Candidate streams
}
```

## Backend Integration

### Violation Recording

All violations are automatically sent to the backend via:
```
POST /api/proctor/record
```

The backend stores violations in the assessment's `candidateResponses` with metadata.

### Live Proctoring Backend

Live proctoring uses WebSocket signaling and REST APIs:

**REST Endpoints:**
- `POST /api/v1/proctor/live/start-session`: Create/retrieve session
- `POST /api/v1/proctor/live/end-session/{sessionId}`: End session

**WebSocket Endpoints:**
- `ws://host/api/v1/proctor/ws/live/candidate/{sessionId}?candidate_id={id}`: Candidate signaling
- `ws://host/api/v1/proctor/ws/live/admin/{assessmentId}`: Admin signaling

## Integration with Competencies

### AI Assessments
- File: `frontend/src/pages/assessment/[id]/[token]/take.tsx`
- Uses `useUniversalProctoring` hook
- Supports both AI and Live proctoring

### DSA Tests
- File: `frontend/src/pages/test/[id]/take.tsx`
- Uses `useUniversalProctoring` hook
- Supports both AI and Live proctoring

### AIML Tests
- File: `frontend/src/pages/aiml/test/[id]/take.tsx`
- Uses `useUniversalProctoring` hook
- Supports both AI and Live proctoring

### Custom MCQ
- File: `frontend/src/pages/custom-mcq/take/[assessmentId].tsx`
- Uses `useUniversalProctoring` hook
- Supports both AI and Live proctoring

## Camera Stream Management

### Stream Reuse
The system intelligently reuses camera streams:
- If AI proctoring is enabled, the camera stream is shared with Live proctoring
- Camera stream is stored in `window.__cameraStream` for reuse
- Screen stream is stored in `window.__screenStream` for reuse

### Stream Lifecycle
1. **Pre-check Phase**: Camera captured during identity verification
2. **Assessment Phase**: Stream reused from pre-check (no new permission request)
3. **Cleanup**: Streams stopped when assessment ends

## WebRTC Configuration

The system uses Google STUN servers for NAT traversal:
```typescript
const WEBRTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};
```

For production, TURN servers should be configured for better connectivity.

## Error Handling

The system includes comprehensive error handling:
- **Camera Errors**: Gracefully handles permission denied, device errors
- **Model Loading Errors**: Falls back gracefully if AI model fails to load
- **WebRTC Errors**: Handles connection failures, ICE candidate errors
- **Network Errors**: Retries and reconnection logic for WebSocket

## Debug Mode

Enable debug mode for detailed logging:

```typescript
// In hook
useUniversalProctoring({ debug: true })

// In service
await service.startProctoring({ ..., debug: true })

// In live services
new CandidateLiveService({ ..., debugMode: true })
new AdminLiveService({ ..., debugMode: true })
```

Debug logs are prefixed with:
- `[UniversalProctoring]`: Main service logs
- `[AIProctoring]`: AI proctoring logs
- `[TabSwitch]`: Tab switch logs
- `[Fullscreen]`: Fullscreen logs
- `[CandidateLive]`: Candidate live proctoring logs
- `[AdminLive]`: Admin live proctoring logs

## Best Practices

1. **Always Cleanup**: Call `stopProctoring()` in component unmount
2. **Handle Errors**: Implement error callbacks for production
3. **User Feedback**: Show loading states while model loads
4. **Permission Handling**: Guide users through camera permissions
5. **Network Resilience**: Handle network failures gracefully
6. **Performance**: Use appropriate detection intervals for your use case

## Limitations

1. **Browser Support**: Requires modern browsers with WebRTC support
2. **Camera Required**: AI and Live proctoring require camera access
3. **Network Dependency**: Live proctoring requires stable network connection
4. **Model Loading**: AI model takes ~20-40ms to load initially
5. **Fullscreen**: Fullscreen API requires user gesture to activate

## Future Enhancements

Potential improvements:
- Custom TURN server configuration
- Advanced AI model options
- Violation severity levels
- Real-time violation notifications
- Multi-admin support for live proctoring
- Recording and playback of proctoring sessions

## Support

For issues or questions:
1. Check debug logs with `debug: true`
2. Verify camera permissions
3. Check network connectivity for live proctoring
4. Review browser console for errors
5. Verify backend API endpoints are accessible



