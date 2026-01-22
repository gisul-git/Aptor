# Live Proctoring Module

Live proctoring (CCTV-style admin monitoring) for the Universal Proctoring System.

## Overview

Live proctoring allows admins to monitor candidates in real-time via webcam and screen sharing streams. This is separate from AI proctoring (automated violation detection).

### Key Features

- **Candidate Registration**: Candidate creates a session when assessment starts
- **Admin Dashboard**: Admin sees list of active candidate sessions
- **On-Demand Streaming**: Webcam stream starts when admin requests to view
- **P2P Streaming**: WebRTC for efficient peer-to-peer media streaming
- **WebSocket Signaling**: Real-time session updates and WebRTC signaling

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│    Candidate    │         │     Server      │         │      Admin      │
│  (Take Page)    │         │   (Signaling)   │         │   (Dashboard)   │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         │  1. Start Session (HTTP)  │                           │
         │ ─────────────────────────>│                           │
         │                           │                           │
         │  2. Connect WebSocket     │                           │
         │ ─────────────────────────>│                           │
         │                           │                           │
         │                           │  3. Admin connects WS     │
         │                           │ <─────────────────────────│
         │                           │                           │
         │                           │  4. Send active_sessions  │
         │                           │ ─────────────────────────>│
         │                           │                           │
         │                           │  5. get_session(id)       │
         │                           │ <─────────────────────────│
         │                           │                           │
         │  6. Send Offer            │                           │
         │ ─────────────────────────>│  7. Forward Offer         │
         │                           │ ─────────────────────────>│
         │                           │                           │
         │                           │  8. Send Answer           │
         │  9. Forward Answer        │ <─────────────────────────│
         │ <─────────────────────────│                           │
         │                           │                           │
         │  10. Exchange ICE         │  10. Exchange ICE         │
         │ <────────────────────────>│<────────────────────────>│
         │                           │                           │
         │                 ┌─────────┴─────────┐                 │
         │                 │  11. P2P Stream   │                 │
         │ ═══════════════>│    (WebRTC)       │═══════════════>│
         │  webcam + screen│                   │                 │
         │                 └───────────────────┘                 │
```

## Directory Structure

```
frontend/src/universal-proctoring/live/
├── index.ts                  # Module exports
├── types.ts                  # Type definitions
├── utils.ts                  # Utility functions
├── CandidateLiveService.ts   # Candidate-side service
├── AdminLiveService.ts       # Admin-side service
└── README.md                 # This file
```

## Usage

### Candidate Side (Take Page)

```typescript
import { CandidateLiveService } from '@/universal-proctoring/live';

// Create service
const liveService = new CandidateLiveService({
  assessmentId: 'assessment-123',
  candidateId: 'candidate-456',
  debugMode: true,
});

// Start streaming (when liveProctoringEnabled)
await liveService.start({
  onStateChange: (state) => {
    console.log('State:', state);
  },
  onError: (error) => {
    console.error('Error:', error);
  },
}, screenStream); // Optional screen stream

// Stop when assessment ends
await liveService.stop();
```

### Admin Side (Monitoring Dashboard)

```typescript
import { AdminLiveService } from '@/universal-proctoring/live';

// Create service
const adminService = new AdminLiveService({
  assessmentId: 'assessment-123',
  adminId: 'admin-789',
  debugMode: true,
});

// Start monitoring
await adminService.startMonitoring({
  onStateChange: (state) => {
    // Update UI with active sessions
    console.log('Active sessions:', state.activeSessions);
    console.log('Streams:', state.candidateStreams);
  },
  onCandidateConnected: (sessionId, candidateId) => {
    console.log(`Connected to ${candidateId}`);
  },
  onCandidateDisconnected: (sessionId) => {
    console.log(`Disconnected from ${sessionId}`);
  },
});

// Get streams for a candidate
const streams = adminService.getCandidateStreams(sessionId);
if (streams?.webcamStream) {
  videoElement.srcObject = streams.webcamStream;
}

// Refresh a candidate connection
await adminService.refreshCandidate(sessionId);

// Stop monitoring
adminService.stopMonitoring();
```

## API Reference

### CandidateLiveService

| Method | Description |
|--------|-------------|
| `start(callbacks, screenStream?)` | Start live proctoring session |
| `stop()` | Stop session and cleanup |
| `getState()` | Get current state |
| `isStreaming()` | Check if streaming |

### AdminLiveService

| Method | Description |
|--------|-------------|
| `startMonitoring(callbacks)` | Start monitoring active candidates |
| `stopMonitoring()` | Stop monitoring (local cleanup only) |
| `refreshCandidate(sessionId)` | Reconnect to a candidate |
| `getState()` | Get current state |
| `getCandidateStreams(sessionId)` | Get streams for a candidate |
| `getActiveSessions()` | Get list of active session IDs |
| `isMonitoring()` | Check if monitoring |

## State Objects

### CandidateLiveState

```typescript
interface CandidateLiveState {
  isStreaming: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'failed';
  sessionId: string | null;
  error: string | null;
}
```

### AdminLiveState

```typescript
interface AdminLiveState {
  isMonitoring: boolean;
  isLoading: boolean;
  activeSessions: string[];
  candidateStreams: Map<string, CandidateStreamInfo>;
}

interface CandidateStreamInfo {
  sessionId: string;
  candidateId: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
  error: string | null;
}
```

## Backend Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/proctor/live/start-session` | POST | Create candidate session |
| `/api/v1/proctor/live/end-session/{id}` | POST | End candidate session |
| `/api/v1/proctor/ws/live/candidate/{id}` | WebSocket | Candidate signaling |
| `/api/v1/proctor/ws/live/admin/{assessmentId}` | WebSocket | Admin signaling |

## WebSocket Message Types

### Candidate → Server

| Type | Description |
|------|-------------|
| `offer` | WebRTC offer SDP |
| `ice` | ICE candidate |
| `ping` | Heartbeat |

### Server → Candidate

| Type | Description |
|------|-------------|
| `answer` | WebRTC answer SDP |
| `ice_candidate` | ICE candidate from admin |
| `pong` | Heartbeat response |
| `request_offer` | Admin requesting new offer |

### Server → Admin

| Type | Description |
|------|-------------|
| `active_sessions` | List of active candidate sessions |
| `new_session` | New candidate started |
| `session_ended` | Candidate ended session |
| `session_data` | Session info with offer |

### Admin → Server

| Type | Description |
|------|-------------|
| `get_session` | Request session data |
| `answer` | WebRTC answer SDP |
| `ice` | ICE candidate |

## Integration with AI Proctoring

Live proctoring and AI proctoring are **independent**:

```typescript
// In take page
const settings = {
  aiProctoringEnabled: true,   // Automated violation detection
  liveProctoringEnabled: true, // Admin can watch
};

// AI Proctoring (separate)
const aiService = new UniversalProctoringService();
await aiService.startProctoring({ settings, session, videoElement });

// Live Proctoring (separate)
const liveService = new CandidateLiveService({ assessmentId, candidateId });
if (settings.liveProctoringEnabled) {
  await liveService.start(callbacks);
}
```

## Debug Mode

Enable via:
- URL parameter: `?liveProctorDebug=true`
- Environment variable: `NEXT_PUBLIC_LIVE_PROCTOR_DEBUG=true`
- Code: `setLiveDebugMode(true)` or `debugMode: true` in config

## Future: Screen Sharing

The system is designed to support screen sharing:

```typescript
// Future API (not implemented yet)
const screenStream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: false,
});

liveService.start(callbacks, screenStream);
```

## Important Notes

1. **Candidate sessions persist**: When admin closes dashboard, candidate sessions continue. Admin can reconnect later.

2. **P2P streaming**: Media flows directly between candidate and admin browsers (via WebRTC). Server only handles signaling.

3. **Screen sharing requires**: The candidate must share their screen via `getDisplayMedia()` before starting live proctoring.

4. **STUN servers**: Uses Google's public STUN servers. For production behind strict firewalls, consider adding TURN servers.
