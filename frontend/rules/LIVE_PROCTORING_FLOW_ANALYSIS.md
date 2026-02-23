# Live Proctoring Flow Analysis

## Critical Requirement: Admin Disconnection Does NOT End Candidate Streaming

### Key Principle
**When admin closes monitoring dashboard, the candidate's streaming MUST continue uninterrupted. Admin can reconnect anytime to view ongoing streams.**

---

## Detailed Flow Analysis

### 1. **Candidate Starts Assessment Flow**

```
CANDIDATE SIDE:
1. Candidate clicks "Start Assessment"
2. Call backend ONCE: POST /api/v1/proctor/live/start-session
   → Creates session in DB with status "candidate_initiated"
   → Returns: { sessionId, ... }
3. Connect WebSocket: ws://.../ws/live/candidate/{sessionId}
4. Get webcam stream: getUserMedia()
5. Get screen stream: Reuse window.__screenStream (from identity-verify gate)
6. Create WebRTC peer connection (ONCE)
7. Add webcam + screen tracks to peer connection
8. Create offer → setLocalDescription(offer)
9. Send offer via WebSocket to backend
10. Wait for admin's answer via WebSocket
11. When answer received → setRemoteDescription(answer)
12. Exchange ICE candidates via WebSocket
13. Connection establishes → streaming begins
14. Keep peer connection active (even if admin disconnects)
```

**Critical Points:**
- Session created ONCE (backend call ONCE)
- Peer connection created ONCE (recreated only if connection fails)
- Streams (webcam + screen) stay active throughout assessment
- WebSocket stays connected throughout assessment

---

### 2. **Admin Opens Monitoring Dashboard Flow**

```
ADMIN SIDE:
1. Admin clicks "Live Proctoring" button
2. Connect WebSocket: ws://.../ws/live/admin/{assessmentId}
3. Backend sends: { type: "active_sessions", sessions: [...] }
4. For each active session:
   a. Create NEW WebRTC peer connection (ALWAYS NEW, never reuse)
   b. Send via WebSocket: { type: "get_session", sessionId: "..." }
   c. Backend responds: { type: "session_data", offer: {...}, ... }
   d. Set offer as remote description: setRemoteDescription(offer)
   e. Create answer → setLocalDescription(answer)
   f. Send answer via WebSocket: { type: "answer", sessionId: "...", answer: {...} }
   g. Exchange ICE candidates via WebSocket
   h. Connection establishes → admin sees candidate's stream
```

**Critical Points:**
- Admin creates NEW peer connection EVERY TIME (never reuse old ones)
- If old peer connection exists and is disconnected/failed → close it first
- Admin can connect to multiple candidates simultaneously

---

### 3. **Admin Closes Monitoring Dashboard Flow**

```
ADMIN SIDE:
1. Admin clicks "Close" button
2. Close WebSocket connection (local cleanup)
3. Close all peer connections (local cleanup only)
4. Clear local state (candidateStreams, etc.)

CANDIDATE SIDE:
→ NO ACTION REQUIRED
→ Peer connection stays active (may go to "disconnected" state but NOT closed)
→ Webcam + screen streams stay active
→ WebSocket stays connected
→ Session remains in database with status "active"

BACKEND:
→ Session remains in database
→ No cleanup required
→ Candidate's WebSocket connection remains active
```

**Critical Points:**
- Admin's actions are LOCAL ONLY (no backend calls to end session)
- Candidate's peer connection is NOT closed (may be disconnected but tracks stay active)
- Candidate's streams stay active
- Backend session remains active

---

### 4. **Admin Reopens Monitoring Dashboard Flow**

```
ADMIN SIDE:
1. Admin clicks "Live Proctoring" button again
2. Connect NEW WebSocket: ws://.../ws/live/admin/{assessmentId}
3. Backend sends: { type: "active_sessions", sessions: [...] }
   → Same candidates still streaming (session still active)
4. For each active session:
   a. Create NEW WebRTC peer connection (ALWAYS NEW)
   b. Request session data (offer) via WebSocket
   c. Receive offer → setRemoteDescription(offer)
   d. Create answer → send via WebSocket
   e. Exchange ICE candidates
   f. Connection establishes → admin sees candidate's stream again

CANDIDATE SIDE:
1. Candidate's peer connection may be in "disconnected" or "failed" state
2. When admin sends new answer:
   a. Check peer connection state
   b. If disconnected/failed:
      - Close old peer connection
      - Create NEW peer connection
      - Re-add webcam + screen tracks
      - Create new offer → send via WebSocket
      - Set admin's answer as remote description
      - Exchange ICE candidates
   c. If still connected:
      - Process answer normally
      - Exchange ICE candidates
3. Connection re-establishes → streaming continues
```

**Critical Points:**
- Admin ALWAYS creates NEW peer connection (never reuse)
- Candidate recreates peer connection ONLY if it's in bad state
- Candidate's streams stay active throughout
- Session remains active in backend

---

### 5. **Candidate's Connection Drops Flow**

```
CANDIDATE SIDE:
1. Peer connection goes to "disconnected" or "failed"
2. DO NOT call stopStreaming()
3. DO NOT end session
4. Keep webcam + screen streams active
5. Keep WebSocket connected
6. Wait for admin to reconnect
7. When admin sends new answer:
   - Detect peer connection is in bad state
   - Close old peer connection
   - Create NEW peer connection
   - Re-add tracks
   - Create new offer → send via WebSocket
   - Process admin's answer
   - Connection re-establishes
```

**Critical Points:**
- Connection drops do NOT end session
- Streams stay active
- Candidate waits for admin reconnection
- Candidate recreates peer connection when admin sends new answer

---

### 6. **Candidate Ends Assessment Flow**

```
CANDIDATE SIDE:
1. Candidate clicks "End Assessment" or submits
2. Call backend ONCE: POST /api/v1/proctor/live/end-session/{sessionId}
3. Close WebSocket connection
4. Close peer connection
5. Stop webcam stream: webcamStream.getTracks().forEach(t => t.stop())
6. Stop screen stream: screenStream.getTracks().forEach(t => t.stop())
7. Cleanup local state

BACKEND:
1. Mark session as "ended" in database
2. Notify all connected admins: { type: "session_ended", sessionId: "..." }

ADMIN SIDE:
1. Receive "session_ended" message via WebSocket
2. Remove candidate from active list
3. Close peer connection for that candidate (local cleanup)
4. Update UI
```

**Critical Points:**
- Session ended ONLY when candidate calls end-session (ONCE)
- Streams stopped ONLY when candidate ends assessment
- Backend notifies all admins
- Admin cleans up locally

---

## Technical Implementation Details

### WebRTC Peer Connection States

**Candidate Side:**
- `connecting` → Normal, waiting for answer
- `connected` → Streaming active
- `disconnected` → Connection lost, but DO NOT close peer connection
- `failed` → Connection failed, but DO NOT close peer connection
- **Action on disconnected/failed**: Keep streams active, wait for admin reconnection

**Admin Side:**
- `connecting` → Normal, establishing connection
- `connected` → Receiving stream
- `disconnected` → Connection lost, allow refresh
- `failed` → Connection failed, allow refresh
- **Action on disconnected/failed**: Log error, allow admin to refresh

### WebSocket Message Types

**Candidate → Backend:**
```typescript
{ type: "offer", sessionId: string, sdp: string }
{ type: "ice", sessionId: string, candidate: RTCIceCandidate }
```

**Backend → Candidate:**
```typescript
{ type: "answer", sessionId: string, sdp: string }
{ type: "ice_candidate", sessionId: string, candidate: RTCIceCandidate }
{ type: "error", message: string }
```

**Admin → Backend:**
```typescript
{ type: "get_session", sessionId: string }
{ type: "answer", sessionId: string, sdp: string }
{ type: "ice", sessionId: string, candidate: RTCIceCandidate }
```

**Backend → Admin:**
```typescript
{ type: "active_sessions", sessions: Session[] }
{ type: "new_session", session: Session }
{ type: "session_ended", sessionId: string }
{ type: "session_data", sessionId: string, offer: RTCSessionDescription, ... }
{ type: "ice_candidate", sessionId: string, candidate: RTCIceCandidate }
{ type: "error", message: string }
```

### Session Lifecycle States

```typescript
type SessionStatus = 
  | "candidate_initiated"  // Candidate created session, waiting for offer
  | "offer_sent"          // Candidate sent offer, waiting for answer
  | "active"              // Connection established, streaming active
  | "ended"               // Candidate ended session
```

### Critical Code Patterns

#### Candidate Side: Connection State Handler
```typescript
pc.onconnectionstatechange = () => {
  if (pc.connectionState === "connected") {
    // Log success
  } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
    // DO NOT call stopStreaming()
    // DO NOT close peer connection
    // DO NOT stop streams
    // Just log and wait for admin reconnection
  }
};
```

#### Candidate Side: Answer Handler
```typescript
// When receiving answer from admin
if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
  // Recreate peer connection
  pc.close();
  pc = new RTCPeerConnection({...});
  // Re-add tracks
  webcamStream.getTracks().forEach(t => pc.addTrack(t, webcamStream));
  screenStream.getTracks().forEach(t => pc.addTrack(t, screenStream));
  // Create new offer
  const newOffer = await pc.createOffer();
  await pc.setLocalDescription(newOffer);
  // Send new offer via WebSocket
  // Then process admin's answer
}
```

#### Admin Side: Connect to Candidate
```typescript
const connectToCandidate = (session: Session) => {
  // ALWAYS create NEW peer connection
  const existingPc = peerConnections.get(session.sessionId);
  if (existingPc && (existingPc.connectionState === "disconnected" || existingPc.connectionState === "failed")) {
    existingPc.close(); // Close old one first
  }
  
  const pc = new RTCPeerConnection({...}); // NEW connection
  peerConnections.set(session.sessionId, pc);
  
  // Request session data (offer)
  ws.send({ type: "get_session", sessionId: session.sessionId });
  // ... rest of connection logic
};
```

#### Admin Side: Stop Monitoring
```typescript
const stopMonitoring = () => {
  // Close WebSocket (local cleanup)
  ws.close();
  
  // Close all peer connections (local cleanup only)
  peerConnections.forEach(pc => pc.close());
  peerConnections.clear();
  
  // Clear local state
  setCandidateStreams({});
  
  // DO NOT call backend to end sessions
  // DO NOT affect candidate's streaming
};
```

---

## Summary of Critical Behaviors

1. **Session Persistence**: Candidate's session stays active when admin disconnects
2. **Stream Continuity**: Candidate's streams stay active when admin disconnects
3. **Peer Connection Lifecycle**: 
   - Candidate: Creates ONCE, recreates only if needed
   - Admin: Creates NEW every time
4. **Reconnection Logic**:
   - Admin reconnects → Creates new peer connection
   - Candidate detects bad state → Recreates peer connection when admin sends answer
5. **One-Time Calls**: 
   - `start-session`: Called ONCE by candidate
   - `end-session`: Called ONCE by candidate
6. **WebSocket Signaling**: All signaling via WebSocket (no polling)

---

## Testing Scenarios

1. ✅ Candidate starts → Admin sees stream
2. ✅ Admin closes dashboard → Candidate keeps streaming
3. ✅ Admin reopens dashboard → Sees candidate's stream again
4. ✅ Multiple admins can monitor same candidate
5. ✅ Candidate's connection drops → Admin can still reconnect
6. ✅ Admin's connection drops → Can reconnect and see streams
7. ✅ Candidate ends assessment → Session ends, streams stop

