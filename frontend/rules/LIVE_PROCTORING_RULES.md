# Live Proctoring Rules & Requirements

## Overview
Live Proctoring allows admins to monitor candidates in real-time via webcam and screen sharing. The system uses WebRTC for media streaming and WebSocket for signaling.

## Core Requirements

### 1. **Connection Architecture**
- **Candidate Side**: Streams webcam + screen to admin
- **Admin Side**: Receives and displays webcam + screen streams from candidates
- **Communication**: WebRTC (P2P) for media, WebSocket for signaling
- **Session Management**: Backend tracks active sessions, allows admin reconnection

### 2. **Key Behaviors**

#### When Candidate Starts Assessment:
1. Candidate clicks "Start Assessment"
2. Candidate creates Live Proctoring session (backend call ONCE)
3. Candidate establishes WebSocket connection to backend
4. Candidate gets webcam stream (`getUserMedia`)
5. Candidate gets screen stream (reuse `window.__screenStream` from identity-verify)
6. Candidate creates WebRTC peer connection
7. Candidate adds webcam + screen tracks to peer connection
8. Candidate creates offer and sends via WebSocket
9. Candidate waits for admin's answer via WebSocket
10. Candidate exchanges ICE candidates via WebSocket
11. Connection establishes → streaming begins

#### When Admin Opens Live Proctoring Dashboard:
1. Admin clicks "Live Proctoring" button
2. Admin establishes WebSocket connection to backend
3. Backend sends list of active sessions (candidates currently streaming)
4. For each active candidate:
   - Admin creates NEW WebRTC peer connection
   - Admin requests candidate's session data (offer) via WebSocket
   - Admin receives offer and sets as remote description
   - Admin creates answer and sends via WebSocket
   - Admin exchanges ICE candidates via WebSocket
   - Connection establishes → admin sees candidate's stream

#### When Admin Closes Dashboard:
1. Admin closes Live Proctoring dashboard
2. Admin closes WebSocket connection
3. Admin closes all peer connections (local cleanup only)
4. **CRITICAL**: Candidate's session remains ACTIVE
5. **CRITICAL**: Candidate keeps streaming (peer connection stays active)
6. **CRITICAL**: Backend session remains in database

#### When Admin Reopens Dashboard:
1. Admin clicks "Live Proctoring" button again
2. Admin establishes NEW WebSocket connection
3. Backend sends list of active sessions (same candidates still streaming)
4. For each active candidate:
   - Admin creates NEW WebRTC peer connection (always new, never reuse old)
   - Admin requests candidate's session data (offer) via WebSocket
   - Admin receives offer and sets as remote description
   - Admin creates answer and sends via WebSocket
   - Admin exchanges ICE candidates via WebSocket
   - Connection establishes → admin sees candidate's stream again

#### When Candidate's Connection Drops:
1. Candidate's peer connection goes to "disconnected" or "failed"
2. **CRITICAL**: Candidate does NOT end session
3. **CRITICAL**: Candidate keeps webcam + screen streams active
4. Candidate waits for admin to reconnect
5. When admin reconnects and sends new answer:
   - Candidate detects peer connection is in bad state
   - Candidate recreates peer connection
   - Candidate re-adds tracks
   - Candidate creates new offer and sends via WebSocket
   - Candidate processes admin's answer
   - Connection re-establishes

#### When Candidate Ends Assessment:
1. Candidate clicks "End Assessment" or submits
2. Candidate calls backend ONCE to end session
3. Candidate closes WebSocket connection
4. Candidate closes peer connection
5. Candidate stops webcam + screen streams
6. Backend marks session as "ended"
7. Admin dashboard removes candidate from active list

## Technical Implementation

### 3. **WebRTC Signaling Flow**

```
CANDIDATE SIDE                          BACKEND                          ADMIN SIDE
     |                                     |                                 |
     |--- create session (POST) ---------->|                                 |
     |<-- sessionId ----------------------|                                 |
     |                                     |                                 |
     |--- WebSocket connect ------------->|                                 |
     |                                     |                                 |
     |--- create offer ------------------->|                                 |
     |                                     |--- WebSocket connect ---------->|
     |                                     |<-- get active sessions ---------|
     |                                     |--- send active sessions ------->|
     |                                     |                                 |
     |                                     |<-- request session data --------|
     |                                     |--- send offer ----------------->|
     |                                     |                                 |
     |<-- answer (WebSocket) -------------|                                 |
     |                                     |<-- answer (WebSocket) ----------|
     |                                     |--- send answer ---------------->|
     |                                     |                                 |
     |<-- ICE candidate (WebSocket) ------|                                 |
     |                                     |<-- ICE candidate (WebSocket) ---|
     |                                     |--- forward ICE ---------------->|
     |                                     |                                 |
     |<================================== WebRTC Media Stream ==============>|
```

### 4. **WebSocket Message Types**

#### Candidate → Backend:
- `offer`: WebRTC offer SDP
- `ice`: ICE candidate

#### Backend → Candidate:
- `answer`: WebRTC answer SDP
- `ice_candidate`: ICE candidate from admin
- `error`: Error message

#### Admin → Backend:
- `get_session`: Request candidate's session data (offer)
- `answer`: WebRTC answer SDP
- `ice`: ICE candidate

#### Backend → Admin:
- `active_sessions`: List of active candidate sessions
- `new_session`: New candidate started streaming
- `session_ended`: Candidate ended session
- `session_data`: Response to get_session (includes offer)
- `ice_candidate`: ICE candidate from candidate
- `error`: Error message

### 5. **Backend Endpoints**

#### POST `/api/v1/proctor/live/start-session`
- **Called by**: Candidate (ONCE when starting assessment)
- **Request**: `{ assessmentId, candidateId }`
- **Response**: `{ sessionId, turnConfig? }`
- **Action**: Creates session in database with status "candidate_initiated"

#### POST `/api/v1/proctor/live/end-session/{sessionId}`
- **Called by**: Candidate (ONCE when ending assessment)
- **Request**: None
- **Response**: `{ success: true }`
- **Action**: Marks session as "ended" in database

#### GET `/api/v1/proctor/live/all-sessions/{assessmentId}`
- **Called by**: Admin (when opening dashboard)
- **Response**: `{ sessions: [...] }`
- **Action**: Returns all active sessions for assessment

#### WebSocket `/api/v1/proctor/ws/live/candidate/{sessionId}?candidate_id={candidateId}`
- **Connected by**: Candidate
- **Purpose**: Signaling channel for candidate
- **Messages**: Receives answer, ICE candidates; Sends offer, ICE candidates

#### WebSocket `/api/v1/proctor/ws/live/admin/{assessmentId}`
- **Connected by**: Admin
- **Purpose**: Signaling channel for admin
- **On Connect**: Backend sends `active_sessions` message
- **Messages**: Receives active_sessions, new_session, session_ended, session_data, ICE candidates; Sends get_session, answer, ICE candidates

### 6. **Frontend Hooks**

#### `useLiveProctoring` (Candidate Side)
- **Purpose**: Manage candidate's streaming
- **Props**: `{ assessmentId, candidateId, enabled, preScreenStream, onError }`
- **Returns**: `{ isStreaming, connectionState, error, startStreaming, stopStreaming }`
- **Key Functions**:
  - `startStreaming()`: Called when candidate clicks "Start Assessment"
    - Creates session (backend call ONCE)
    - Connects WebSocket
    - Gets webcam stream
    - Uses `preScreenStream` (from `window.__screenStream`)
    - Creates peer connection
    - Adds tracks
    - Creates offer and sends via WebSocket
  - `stopStreaming()`: Called when candidate ends assessment
    - Ends session (backend call ONCE)
    - Closes WebSocket
    - Closes peer connection
    - Stops streams
  - **Connection State Handler**:
    - `connected`: Log success
    - `connecting`: Log status
    - `disconnected`/`failed`: **DO NOT call stopStreaming()** - keep streaming, wait for admin reconnection
  - **Answer Handler**:
    - When receiving answer and peer connection is `disconnected`/`failed`:
      - Recreate peer connection
      - Re-add tracks
      - Create new offer
      - Set answer as remote description

#### `useMultiLiveProctorAdmin` (Admin Side)
- **Purpose**: Manage admin's monitoring of multiple candidates
- **Props**: `{ assessmentId, adminId, onError }`
- **Returns**: `{ candidateStreams, activeCandidates, isLoading, startMonitoring, stopMonitoring, refreshCandidate }`
- **Key Functions**:
  - `startMonitoring()`: Called when admin opens dashboard
    - Connects WebSocket
    - Receives active_sessions
    - For each session: calls `connectToCandidate()`
  - `stopMonitoring()`: Called when admin closes dashboard
    - Closes WebSocket
    - Closes all peer connections (local cleanup only)
    - **DO NOT** end candidate sessions
  - `connectToCandidate(session)`: Connect to a single candidate
    - **CRITICAL**: Always create NEW peer connection (never reuse old one)
    - If old peer connection exists and is `disconnected`/`failed`: close it first
    - Request session data (offer) via WebSocket
    - Set offer as remote description
    - Create answer and send via WebSocket
    - Exchange ICE candidates
  - **Connection State Handler**:
    - `connected`: Update candidate stream state
    - `disconnected`/`failed`: Log but don't cleanup (admin can refresh)

### 7. **Critical Rules**

#### Rule 1: Session Lifecycle
- **Session Created**: When candidate calls `start-session` (ONCE)
- **Session Active**: While candidate is streaming
- **Session Ended**: Only when candidate calls `end-session` (ONCE)
- **Admin Actions**: Admin closing/reopening dashboard does NOT affect session

#### Rule 2: Peer Connection Lifecycle
- **Candidate**: Creates peer connection ONCE when starting streaming
  - Recreates only if connection fails and admin sends new answer
- **Admin**: Creates NEW peer connection EVERY TIME they connect to a candidate
  - Never reuse old peer connections
  - Always start fresh

#### Rule 3: Reconnection Logic
- **Admin Reconnection**: 
  - Admin closes dashboard → closes local peer connections
  - Admin reopens dashboard → creates NEW peer connections
  - Candidate's peer connection stays active (may be `disconnected` but not closed)
  - When admin sends new answer, candidate recreates peer connection if needed
- **Candidate Reconnection**:
  - If candidate's peer connection goes `disconnected`/`failed`:
    - Keep streaming (don't stop)
    - Wait for admin to reconnect
    - When admin sends new answer, recreate peer connection

#### Rule 4: WebSocket Lifecycle
- **Candidate**: Connects ONCE when starting streaming, disconnects when ending
- **Admin**: Connects when opening dashboard, disconnects when closing
- **Backend**: Maintains active connections, routes messages

#### Rule 5: Stream Management
- **Candidate**: 
  - Webcam: Get via `getUserMedia()` when starting
  - Screen: Reuse `window.__screenStream` from identity-verify
  - Stop streams only when ending assessment
- **Admin**:
  - Receive streams via WebRTC `ontrack` event
  - Display in video elements
  - Stop streams when closing dashboard (local cleanup)

### 8. **Error Handling**

#### Candidate Side:
- WebSocket disconnect: Attempt reconnect (3 second delay)
- Peer connection `failed`: Log error, keep streaming, wait for admin
- Stream errors: Log error, show to user
- Backend errors: Log error, show to user

#### Admin Side:
- WebSocket disconnect: Attempt reconnect (3 second delay)
- Peer connection `failed`: Log error, allow refresh
- No active sessions: Show "No active candidates" message
- Stream errors: Log error, show in UI

### 9. **UI Components**

#### Admin Pages:
- **Analytics Page**: "Live Proctoring" button
  - Opens modal/dashboard
  - Shows list of active candidates
  - Displays webcam + screen for each candidate
- **Live Proctoring Dashboard**:
  - Header: "Live Proctoring Dashboard" + "Monitoring X active candidates"
  - Grid: One card per candidate
  - Each card: Candidate email, status, webcam video, screen video
  - Close button: Closes dashboard (calls `stopMonitoring()`)

#### Candidate Pages:
- **Take Page**: No UI changes needed
  - Live Proctoring runs in background
  - Uses `useLiveProctoring` hook
  - Starts when candidate clicks "Start Assessment"

### 10. **Database Schema**

#### `proctor_sessions` Collection:
```javascript
{
  sessionId: string,           // UUID
  assessmentId: string,         // Assessment ID
  candidateId: string,          // Candidate email/ID
  adminId: string | null,       // Admin email/ID (null for candidate-initiated)
  status: string,               // "candidate_initiated" | "offer_sent" | "active" | "ended"
  offer: {                      // WebRTC offer
    sdp: string,
    type: "offer"
  } | null,
  answer: {                     // WebRTC answer
    sdp: string,
    type: "answer"
  } | null,
  candidateICE: [],             // ICE candidates from candidate
  adminICE: [],                 // ICE candidates from admin
  createdAt: ISO string,
  updatedAt: ISO string,
  endedAt: ISO string | null
}
```

### 11. **Testing Checklist**

#### Candidate Side:
- [ ] Candidate starts assessment → session created
- [ ] Candidate streams webcam + screen
- [ ] Admin can see candidate's stream
- [ ] Admin closes dashboard → candidate keeps streaming
- [ ] Admin reopens dashboard → can see candidate's stream again
- [ ] Candidate ends assessment → session ended, streams stopped

#### Admin Side:
- [ ] Admin opens dashboard → sees active candidates
- [ ] Admin sees candidate's webcam + screen
- [ ] Admin closes dashboard → streams stop (local)
- [ ] Admin reopens dashboard → sees same candidates, streams work
- [ ] Multiple admins can monitor same candidate (if needed)

#### Edge Cases:
- [ ] Candidate's connection drops → admin can still reconnect
- [ ] Admin's connection drops → can reconnect and see streams
- [ ] Multiple candidates → admin sees all
- [ ] No active candidates → shows "No active candidates" message

### 12. **Implementation Steps**

1. **Backend**:
   - Create `start-session` endpoint
   - Create `end-session` endpoint
   - Create `all-sessions` endpoint
   - Create candidate WebSocket endpoint
   - Create admin WebSocket endpoint
   - Implement WebSocket message routing

2. **Frontend - Candidate**:
   - Create `useLiveProctoring` hook
   - Integrate into take pages
   - Handle connection states
   - Handle reconnection logic

3. **Frontend - Admin**:
   - Create `useMultiLiveProctorAdmin` hook
   - Create Live Proctoring dashboard component
   - Add "Live Proctoring" button to analytics pages
   - Handle connection states
   - Handle reconnection logic

4. **Testing**:
   - Test candidate streaming
   - Test admin viewing
   - Test admin reconnection
   - Test candidate reconnection
   - Test error scenarios

## Summary

**Key Principles:**
1. **Session Persistence**: Candidate's session stays active when admin disconnects
2. **Fresh Connections**: Admin always creates new peer connections (never reuse)
3. **Graceful Degradation**: Candidate keeps streaming even if connection drops
4. **One-Time Calls**: Backend calls (`start-session`, `end-session`) happen ONCE
5. **WebSocket Signaling**: All WebRTC signaling via WebSocket (no polling)

**Critical Behaviors:**
- Admin closing dashboard → candidate keeps streaming
- Admin reopening dashboard → creates new connections, sees streams
- Candidate connection drops → waits for admin, recreates when needed
- Candidate ends assessment → session ends, streams stop

