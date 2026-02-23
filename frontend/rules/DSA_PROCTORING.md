# DSA Proctoring Implementation Documentation

## Overview

This document describes the complete proctoring system implementation for DSA (Data Structures and Algorithms) tests. The implementation includes both **AI-based proctoring** (camera-based detection) and **Live Proctoring** (real-time WebRTC streaming).

---

## Features Implemented

### 1. AI Proctoring (Camera-Based Detection)
- **Gaze Away Detection**: Detects when candidate's eyes are not on the screen
- **No Face Detection**: Detects when no face is present in the camera frame
- **Multiple Faces Detection**: Detects when more than one face is present
- **Tab Switch Detection**: Detects when candidate switches browser tabs
- **Focus Lost Detection**: Detects when browser window loses focus

### 2. Live Proctoring (Real-Time Streaming)
- **Webcam Stream**: Real-time video feed from candidate's webcam
- **Screen Share Stream**: Real-time screen sharing from candidate's display
- **Admin Dashboard**: Multi-candidate monitoring interface
- **Auto-Reconnection**: Candidate automatically reconnects if admin disconnects
- **Session Persistence**: Candidate sessions remain active for admin reconnection

---

## Files Modified/Created

### Frontend Files

#### 1. `frontend/src/pages/test/[id]/take.tsx`
**Purpose**: Candidate-side test taking page with full proctoring integration

**Key Changes**:
- Added AI proctoring hooks (`useFaceMesh`, `useProctorUpload`)
- Added live proctoring hook (`useLiveProctoring`)
- Integrated `WebcamPreview` component
- Added violation handling and toast notifications
- Implemented live proctoring start/stop logic with guard refs

**Key Features**:
- Proctoring settings loaded from backend (`proctoringSettings`)
- Live proctoring starts automatically when test begins
- Live proctoring guard ref prevents infinite loops
- Auto-restart capability when streaming stops

#### 2. `frontend/src/pages/dsa/tests/[id]/analytics.tsx`
**Purpose**: Admin analytics page with live proctoring dashboard

**Key Changes**:
- Added Live Proctoring Dashboard button in overall analytics view
- Integrated `LiveProctoringDashboard` component
- Connected `useMultiLiveProctorAdmin` hook
- Added proctoring logs fetching using candidate email

**Key Features**:
- Live Proctoring button prominently displayed (not inside candidate analytics)
- Proctoring logs fetched using `candidate.email` (not `user_id`)
- Fallback mechanism for log retrieval

#### 3. `frontend/src/hooks/useLiveProctoring.ts`
**Purpose**: Candidate-side hook for live proctoring streaming

**Key Features**:
- WebRTC peer connection management
- WebSocket connection with auto-reconnect
- Screen stream and webcam stream handling
- Offer/answer exchange with admin
- ICE candidate exchange
- Duplicate answer handling (checks `signalingState === "stable"`)

**Critical Fixes**:
- Fixed duplicate answer handling by checking `signalingState` in addition to `connectionState`
- Prevents `InvalidStateError` when admin sends duplicate answers
- Auto-reconnect logic keeps streams active even when admin disconnects

#### 4. `frontend/src/hooks/useMultiLiveProctorAdmin.ts`
**Purpose**: Admin-side hook for monitoring multiple candidate streams

**Key Features**:
- WebSocket connection to receive active sessions
- Individual WebRTC peer connections per candidate
- Stream preservation using `streamsRef` (prevents React state batching issues)
- Track order-based screen/webcam detection (when labels are UUIDs)
- Connection state management

**Critical Fixes**:
- Introduced `streamsRef` to track streams independently of React state
- Fixed race condition where screen stream was lost due to state batching
- Enhanced duplicate track detection
- Preserves streams even when connection state changes

#### 5. `frontend/src/components/proctor/LiveProctoringDashboard.tsx`
**Purpose**: Admin dashboard UI for live proctoring

**Key Features**:
- Displays all active candidates
- Shows webcam and screen streams for each candidate
- Connection status indicators
- Expandable candidate cards
- Refresh functionality per candidate

### Backend Files

#### 1. `backend/app/api/v1/dsa/models/test.py`
**Purpose**: DSA test data models

**Key Changes**:
- Added `liveProctoringEnabled: Optional[bool] = None` to `ProctoringSettings` model
- Ensures live proctoring setting is persisted in database

#### 2. `backend/app/api/v1/dsa/routers/tests.py`
**Purpose**: DSA test API endpoints

**Key Changes**:
- Ensured `proctoringSettings` is included in create and get responses
- Validates and saves `liveProctoringEnabled` flag

---

## Implementation Details

### 1. AI Proctoring Flow

```
Candidate Starts Test
    ↓
Load Proctoring Settings from Backend
    ↓
Initialize Webcam Stream
    ↓
Initialize FaceMesh Model (BlazeFace + FaceMesh)
    ↓
Start Detection Loop (requestAnimationFrame)
    ↓
Detect Violations:
    - Gaze Away (FaceMesh)
    - No Face (BlazeFace)
    - Multiple Faces (BlazeFace)
    - Tab Switch (Page Visibility API)
    - Focus Lost (Window Focus Events)
    ↓
Capture Snapshot (if required)
    ↓
Upload Snapshot + Record Violation
    ↓
Display Toast Notification
```

### 2. Live Proctoring Flow (Candidate Side)

```
Candidate Starts Test
    ↓
Check: liveProctoringEnabled && streams available
    ↓
Create Session (POST /api/v1/proctor/live/start-session)
    ↓
Get Session ID
    ↓
Connect WebSocket (ws://.../live/candidate/{sessionId})
    ↓
Get Webcam Stream (getUserMedia)
    ↓
Get Screen Stream (getDisplayMedia or from identity-verify)
    ↓
Create Peer Connection (RTCPeerConnection)
    ↓
Add Tracks (webcam + screen)
    ↓
Create Offer
    ↓
Send Offer via WebSocket
    ↓
Wait for Answer from Admin
    ↓
Set Remote Description (Answer)
    ↓
Exchange ICE Candidates
    ↓
Connection Established
    ↓
Streams Active (keep active even if admin disconnects)
```

### 3. Live Proctoring Flow (Admin Side)

```
Admin Opens Live Proctoring Dashboard
    ↓
Connect WebSocket (ws://.../live/admin/{assessmentId})
    ↓
Receive active_sessions message
    ↓
For Each Active Session:
    ↓
    Request Session Data
    ↓
    Receive Session Data (offer + ICE candidates)
    ↓
    Create Peer Connection
    ↓
    Set Remote Description (Offer)
    ↓
    Add ICE Candidates
    ↓
    Create Answer
    ↓
    Set Local Description (Answer)
    ↓
    Send Answer via WebSocket
    ↓
    Exchange ICE Candidates
    ↓
    Receive Tracks (ontrack event)
    ↓
    Identify Stream Type (webcam vs screen):
        - First video track = webcam
        - Second video track = screen
        - Fallback: track label contains "screen"
    ↓
    Store Streams in streamsRef (source of truth)
    ↓
    Update React State (candidateStreams)
    ↓
    Display Streams in UI
```

---

## Key Technical Solutions

### 1. Screen Stream Detection (Track Order)
**Problem**: Track labels are UUIDs, so label-based detection fails.

**Solution**: Use track order as primary detection method:
- First video track received = webcam
- Second video track received = screen
- Fallback to label-based detection if available

**Implementation**: `useMultiLiveProctorAdmin.ts` - `receivedVideoTracksRef` tracks unique video tracks per session.

### 2. Stream Preservation (React State Batching)
**Problem**: Screen stream was lost when `onconnectionstatechange` fired immediately after `ontrack` due to React state batching.

**Solution**: Use `useRef` (`streamsRef`) to track streams independently of React state:
- `ontrack` updates both `streamsRef` and React state
- `onconnectionstatechange` reads from `streamsRef` (always up-to-date)
- Prevents stale state issues

**Implementation**: `useMultiLiveProctorAdmin.ts` - `streamsRef` Map stores `{ webcamStream, screenStream }` per session.

### 3. Duplicate Answer Handling
**Problem**: Candidate received duplicate answers, causing `InvalidStateError: Called in wrong state: stable`.

**Solution**: Check `signalingState === "stable"` in addition to `connectionState`:
- If `signalingState === "stable"`, both descriptions are set → ignore duplicate
- Only recreate peer connection if connection is in bad state

**Implementation**: `useLiveProctoring.ts` - Answer handler checks both `signalingState` and `connectionState`.

### 4. Live Proctoring Restart Guard
**Problem**: `liveProctoringStartedRef` stayed `true` after first start, preventing restart when admin reconnected.

**Solution**: Reset guard when `isLiveProctoringStreaming` becomes `false`:
- Monitor `isLiveProctoringStreaming` state
- Reset `liveProctoringStartedRef` when streaming stops
- Allows restart when conditions are met again

**Implementation**: `frontend/src/pages/test/[id]/take.tsx` - Added `useEffect` to reset guard on streaming stop.

### 5. Proctoring Logs User ID Mismatch
**Problem**: Violations recorded with candidate email, but analytics queried with `user_id` (ObjectId).

**Solution**: Use `candidate.email` when fetching proctoring logs:
- Modified `fetchProctorLogs` to use email
- Added fallback to search assessment-wide and filter by email

**Implementation**: `frontend/src/pages/dsa/tests/[id]/analytics.tsx` - Updated log fetching logic.

---

## Configuration

### Proctoring Settings (Backend Model)

```python
class ProctoringSettings(BaseModel):
    aiProctoringEnabled: Optional[bool] = None
    liveProctoringEnabled: Optional[bool] = None
    # ... other settings
```

### Frontend State

```typescript
const [aiProctoringEnabled, setAiProctoringEnabled] = useState(false);
const [liveProctoringEnabled, setLiveProctoringEnabled] = useState(false);
const [liveProctorScreenStream, setLiveProctorScreenStream] = useState<MediaStream | null>(null);
```

---

## Testing Checklist

### AI Proctoring
- [ ] Gaze away detection works
- [ ] No face detection works
- [ ] Multiple faces detection works (with cooldown)
- [ ] Tab switch detection works
- [ ] Focus lost detection works
- [ ] Snapshots captured for AI violations
- [ ] Violations recorded in backend
- [ ] Toast notifications appear
- [ ] Webcam preview shows correct status

### Live Proctoring (Candidate Side)
- [ ] Live proctoring starts when test begins
- [ ] Webcam stream acquired
- [ ] Screen stream acquired (from identity-verify or getDisplayMedia)
- [ ] Session created successfully
- [ ] WebSocket connects
- [ ] Offer sent
- [ ] Answer received
- [ ] Connection established
- [ ] Streams remain active when admin disconnects
- [ ] Auto-reconnect works
- [ ] Live proctoring restarts when streaming stops

### Live Proctoring (Admin Side)
- [ ] Dashboard opens successfully
- [ ] WebSocket connects
- [ ] Active sessions received
- [ ] Candidate appears in dashboard
- [ ] Webcam stream displays
- [ ] Screen stream displays
- [ ] Connection status updates correctly
- [ ] Streams preserved on connection state change
- [ ] Dashboard can be closed and reopened
- [ ] Candidates appear on reconnect

### Integration
- [ ] Proctoring settings saved in backend
- [ ] Proctoring settings loaded correctly
- [ ] Proctoring logs fetched using email
- [ ] Live proctoring button in correct location (overall analytics, not candidate-specific)
- [ ] No console errors
- [ ] No infinite loops

---

## Known Issues & Solutions

### Issue 1: Screen Stream Not Appearing
**Symptom**: Webcam appears but screen shows "Waiting for screen..."

**Solution**: 
- Check `streamsRef` in `useMultiLiveProctorAdmin.ts`
- Verify track order detection logic
- Check that screen stream is preserved in `onconnectionstatechange`

### Issue 2: Connection Disconnects Immediately
**Symptom**: Connection reaches "connected" then immediately "disconnected"

**Solution**:
- Check for duplicate answers on candidate side
- Verify `signalingState` check in answer handler
- Check ICE candidate exchange

### Issue 3: Live Proctoring Not Starting on Reconnect
**Symptom**: First time works, second time doesn't start

**Solution**:
- Check `liveProctoringStartedRef` guard
- Verify `isLiveProctoringStreaming` state
- Ensure guard resets when streaming stops

### Issue 4: 0 Active Candidates
**Symptom**: Admin dashboard shows "0 active candidates" but candidate is taking test

**Solution**:
- Check candidate-side logs for `[LiveProctoring]` messages
- Verify session is created on backend
- Check WebSocket connection on candidate side
- Verify `liveProctoringEnabled` is `true` in backend

---

## Debugging Tips

### Enable Debug Mode

**Candidate Side**:
```typescript
useLiveProctoring({
  // ...
  debugMode: true,
});
```

**Admin Side**:
```typescript
useMultiLiveProctorAdmin({
  // ...
  debugMode: true,
});
```

### Key Logs to Monitor

**Candidate Side**:
- `[DSA Take] Starting Live Proctoring...`
- `[LiveProctoring] Session created`
- `[LiveProctoring] WebSocket connected`
- `[LiveProctoring] Offer sent`
- `[LiveProctoring] Answer set`
- `[LiveProctoring] Connection state changed`

**Admin Side**:
- `[MultiLiveProctorAdmin] Starting monitoring...`
- `[MultiLiveProctorAdmin] Admin WebSocket connected`
- `[MultiLiveProctorAdmin] Received X active sessions`
- `[MultiLiveProctorAdmin] Set screen stream`
- `[MultiLiveProctorAdmin] Connection established`

### Network Tab Checks

1. **WebSocket Connections**: Filter by "WS" or "Socket"
   - Should see WebSocket connection with status 101
   - Check for WebSocket messages (active_sessions, offer, answer, ice_candidate)

2. **API Calls**:
   - `POST /api/v1/proctor/live/start-session` (candidate side)
   - `GET /api/v1/proctor/live/admin/{assessmentId}/sessions` (admin side)

---

## Future Improvements

1. **Connection Quality Indicators**: Show network quality metrics (bitrate, packet loss)
2. **Recording**: Option to record live proctoring sessions
3. **Alerts**: Notify admin when candidate disconnects
4. **Multi-Admin Support**: Multiple admins can monitor same assessment
5. **Bandwidth Optimization**: Adaptive bitrate based on network conditions
6. **Mobile Support**: Optimize for mobile devices
7. **Offline Detection**: Detect when candidate goes offline

---

## References

- **Main Assessment Proctoring**: `frontend/src/pages/assessment/[id]/[token]/take.tsx`
- **Proctoring Rules**: `frontend/rules/PROCTORING_RULES.md`
- **Live Proctoring Rules**: `frontend/rules/LIVE_PROCTORING_RULES.md`
- **WebRTC Documentation**: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- **MediaPipe FaceMesh**: https://google.github.io/mediapipe/solutions/face_mesh.html

---

## Version History

- **v1.0** (2025-12-21): Initial implementation
  - AI proctoring (gaze away, no face, multiple faces, tab switch, focus lost)
  - Live proctoring (webcam + screen streaming)
  - Admin dashboard
  - Auto-reconnection
  - Stream preservation fixes
  - Duplicate answer handling
  - Live proctoring restart guard

---

## Contact & Support

For issues or questions regarding DSA proctoring implementation, refer to:
- Code comments in relevant files
- This documentation
- Main proctoring rules documentation

