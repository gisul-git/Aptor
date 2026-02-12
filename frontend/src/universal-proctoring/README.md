# Universal Proctoring System

A standalone, universal proctoring system for all competencies (DSA, AIML, Custom MCQ, General Assessments).

## Overview

This system provides:
- **AI Proctoring**: Gaze away, no face, multiple faces detection
- **Tab Switch Detection**: Tab switches, window blur/focus
- **Fullscreen Enforcement**: Fullscreen exit detection
- **Live Proctoring**: Admin monitoring via webcam/screen streams (CCTV-style)

## Directory Structure

```
frontend/src/universal-proctoring/
├── index.ts                      # Main export file
├── types.ts                      # Type definitions
├── utils.ts                      # Utility functions (gaze, EAR, etc.)
├── UniversalProctoringService.ts # Main orchestrator service
├── useUniversalProctoring.ts     # React hook wrapper
├── README.md                     # This file
├── services/
│   ├── index.ts                  # Services export
│   ├── aiProctoring.ts           # AI proctoring (face/gaze)
│   ├── tabSwitch.ts              # Tab switch detection
│   └── fullscreen.ts             # Fullscreen enforcement
└── live/                         # Live Proctoring (Admin Monitoring)
    ├── index.ts                  # Module exports
    ├── types.ts                  # Live proctoring types
    ├── utils.ts                  # WebRTC/WebSocket utilities
    ├── CandidateLiveService.ts   # Candidate-side streaming
    ├── AdminLiveService.ts       # Admin-side monitoring
    └── README.md                 # Live proctoring documentation
```

## API

### Input Schema

The system accepts the proctoring settings from the Create Assessment flow:

```typescript
interface ProctoringSettings {
  aiProctoringEnabled: boolean;
  liveProctoringEnabled: boolean;
}
```

### Main API

```typescript
// Start proctoring
startProctoring(options: StartProctoringOptions): Promise<boolean>

// Stop proctoring
stopProctoring(): void

// Get current state
getState(): ProctoringState

// Get all violations
getViolations(): ProctoringViolation[]
```

## Usage

### Option 1: Direct Service Usage

```typescript
import { UniversalProctoringService } from '@/universal-proctoring';

// Create service instance
const proctoring = new UniversalProctoringService();

// Start proctoring
await proctoring.startProctoring({
  settings: {
    aiProctoringEnabled: true,
    liveProctoringEnabled: false,
  },
  session: {
    userId: 'user-123',
    assessmentId: 'assessment-456',
  },
  videoElement: document.getElementById('camera-video'),
}, {
  onViolation: (violation) => {
    console.log('Violation:', violation);
  },
  onStateChange: (state) => {
    console.log('State:', state);
  },
  onFullscreenExit: () => {
    console.log('User exited fullscreen');
  },
});

// Stop proctoring
proctoring.stopProctoring();
```

### Option 2: React Hook

```tsx
import { useUniversalProctoring } from '@/universal-proctoring';
import { useRef, useEffect } from 'react';

function AssessmentPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const {
    state,
    isRunning,
    violations,
    startProctoring,
    stopProctoring,
    requestFullscreen,
    isFullscreen,
  } = useUniversalProctoring({
    onViolation: (v) => console.log('Violation:', v),
    onFullscreenExit: () => showFullscreenPrompt(),
    debug: true,
  });

  const handleStart = async () => {
    await startProctoring({
      settings: {
        aiProctoringEnabled: true,
        liveProctoringEnabled: false,
      },
      session: {
        userId: 'user-123',
        assessmentId: 'assessment-456',
      },
      videoElement: videoRef.current,
    });
  };

  return (
    <div>
      <video ref={videoRef} style={{ display: 'none' }} />
      <button onClick={handleStart}>Start Assessment</button>
      <button onClick={stopProctoring}>End Assessment</button>
      <p>Violations: {violations.length}</p>
      <p>Faces: {state.facesCount}</p>
      <p>Gaze: {state.gazeDirection?.direction}</p>
    </div>
  );
}
```

## Violation Event Types

| Event Type | Description | When Triggered |
|------------|-------------|----------------|
| `NO_FACE_DETECTED` | No face visible in camera | After 5 consecutive checks (~3.5s) |
| `MULTIPLE_FACES_DETECTED` | More than one face detected | Immediately |
| `GAZE_AWAY` | User looking away from screen | After 3 consecutive checks (~2.1s) |
| `TAB_SWITCH` | User switched browser tabs | On visibility change |
| `FOCUS_LOST` | Browser window lost focus | On window blur |
| `FULLSCREEN_EXIT` | User exited fullscreen mode | On fullscreen change |
| `FULLSCREEN_ENABLED` | User entered fullscreen mode | On fullscreen change (informational) |
| `PROCTORING_STARTED` | Proctoring session started | On start |
| `PROCTORING_STOPPED` | Proctoring session stopped | On stop |
| `CAMERA_DENIED` | Camera access denied | On permission denial |
| `CAMERA_ERROR` | Camera error occurred | On camera error |

## Configuration

### AI Proctoring Config

```typescript
interface AIProctoringConfig {
  detectionIntervalMs: number;       // Default: 700ms
  throttleIntervalMs: number;        // Default: 5000ms
  gazeAwayThreshold: number;         // Default: 3 (consecutive checks)
  noFaceThreshold: number;           // Default: 5 (consecutive checks)
  faceConfidenceThreshold: number;   // Default: 0.5
  debugMode: boolean;                // Default: false
}
```

### Tab Switch Config

```typescript
interface TabSwitchConfig {
  enableFullscreenDetection: boolean;  // Default: true
  enableTabSwitchDetection: boolean;   // Default: true
  enableFocusDetection: boolean;       // Default: true
}
```

## Thresholds (Preserved from DSA)

These thresholds are preserved from the existing DSA proctoring implementation:

| Threshold | Value | Description |
|-----------|-------|-------------|
| Gaze Left | -0.15 | Relative iris position |
| Gaze Right | 0.15 | Relative iris position |
| Gaze Up | -0.12 | Relative iris position |
| Gaze Down | 0.12 | Relative iris position |
| Eye AR (Blink) | 0.2 | Eye aspect ratio |
| Detection Interval | 700ms | Time between checks |
| Throttle Interval | 5000ms | Min time between same events |
| Gaze Away Threshold | 3 | Consecutive checks (~2.1s) |
| No Face Threshold | 5 | Consecutive checks (~3.5s) |

## State Object

```typescript
interface ProctoringState {
  isRunning: boolean;
  isCameraOn: boolean;
  isModelLoaded: boolean;
  facesCount: number;
  gazeDirection: GazeDirection | null;
  isFullscreen: boolean;
  errors: string[];
  lastViolation: ProctoringViolation | null;
}
```

## Debug Mode

Enable debug logging via:

1. URL parameter: `?proctorDebug=true`
2. Environment variable: `NEXT_PUBLIC_CAMERA_DEBUG=true`
3. Code: `setDebugMode(true)` or `debug: true` in options

## Dependencies

This system uses:
- `@tensorflow/tfjs` - TensorFlow.js runtime
- `@tensorflow-models/blazeface` - Face detection
- `@tensorflow-models/face-landmarks-detection` - Face mesh / gaze detection

These should already be installed in the frontend project.

## Important Notes

1. **No UI Rendering**: This system is logic-only. UI components should be built separately.

2. **No Backend Changes**: This system uses existing endpoints.

3. **No Take Page Integration**: This system is standalone and NOT connected to take pages yet.

4. **User Gesture Required**: `requestFullscreen()` must be called from a user gesture (click/keypress).

5. **Camera Permission**: The browser will prompt for camera access when AI proctoring starts.

## Live Proctoring

Live proctoring (admin monitoring) is available as a separate module. See [live/README.md](live/README.md) for details.

```typescript
import { CandidateLiveService, AdminLiveService } from '@/universal-proctoring';

// Candidate side
const candidateService = new CandidateLiveService({ assessmentId, candidateId });
await candidateService.start(callbacks, screenStream);

// Admin side
const adminService = new AdminLiveService({ assessmentId, adminId });
await adminService.startMonitoring(callbacks);
```

## Next Steps (Future)

1. Connect to take pages
2. Build UI components for proctoring status
3. Remove old proctoring hooks after migration
4. ~~Add live proctoring support (streaming to admin)~~ ✅ Done

