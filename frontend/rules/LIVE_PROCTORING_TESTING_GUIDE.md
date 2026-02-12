# Live Proctoring Testing Guide

## Prerequisites

1. **Backend Server Running**
   ```bash
   cd backend
   # Make sure FastAPI server is running on port 8000
   # Check: http://localhost:8000/docs
   ```

2. **Frontend Server Running**
   ```bash
   cd frontend
   npm run dev
   # Should be running on port 3000
   ```

3. **Database Connection**
   - MongoDB should be running and accessible
   - Backend should be able to connect to MongoDB

4. **Browser Requirements**
   - Use Chrome or Edge (best WebRTC support)
   - Enable camera and microphone permissions
   - Allow screen sharing permissions

---

## Testing Setup

### 1. Create a Test Assessment

1. **Login as Admin**
   - Go to admin dashboard
   - Create a new assessment (DSA, AIML, Custom MCQ, or AI Assessment)

2. **Enable Live Proctoring**
   - In the assessment creation page, find "Proctoring Settings" section
   - Check "Live Proctoring" checkbox
   - Note: This should also auto-enable "Enable AI Proctoring"
   - Save the assessment

3. **Get Assessment ID**
   - Note the assessment ID from the URL or dashboard
   - You'll need this for testing

---

## Testing Flow

### Phase 1: Candidate Side - Start Streaming

#### Step 1: Candidate Entry
1. **Open candidate entry URL**
   - For DSA: `/test/{id}?token=...`
   - For AIML: `/aiml/test/{id}?token=...`
   - For Custom MCQ: `/custom-mcq/entry/{assessmentId}?token=...`
   - For AI Assessment: `/assessment/{id}/{token}`

2. **Complete Precheck**
   - Browser check ✓
   - Network check ✓
   - Camera check ✓ (allow camera permission)
   - Microphone check ✓

3. **Complete Instructions**
   - Read and acknowledge instructions

4. **Complete Candidate Requirements**
   - Fill in required fields

5. **Complete Identity Verify**
   - Capture photo ✓
   - **Share screen** ✓ (IMPORTANT: Select "Entire Screen")
   - Enable fullscreen ✓

#### Step 2: Start Assessment
1. **Click "Start Assessment" button**
   - This should trigger `useLiveProctoring.startStreaming()`

2. **Check Browser Console (Candidate Side)**
   ```
   [LiveProctoring] Starting Live Proctoring streaming...
   [LiveProctoring] Webcam stream obtained
   [LiveProctoring] Using window.__screenStream
   [LiveProctoring] Session created: {sessionId}
   [LiveProctoring] WebSocket connected
   [LiveProctoring] Offer sent
   [LiveProctoring] Connection state changed: connecting
   ```

3. **Check Network Tab (Candidate Side)**
   - `POST /api/v1/proctor/live/start-session` → Should return `{ sessionId, ... }`
   - WebSocket connection: `ws://localhost:8000/api/v1/proctor/ws/live/candidate/{sessionId}?candidate_id=...`
   - WebSocket messages: `{ type: "offer", ... }`, `{ type: "ice", ... }`

4. **Verify State**
   - `isStreaming: true`
   - `connectionState: "connecting"` (will become "connected" when admin connects)

---

### Phase 2: Admin Side - View Streams

#### Step 1: Open Analytics Page
1. **Login as Admin**
2. **Navigate to Analytics Page**
   - For DSA: `/dsa/tests/{id}/analytics`
   - For AIML: `/aiml/tests/{id}/analytics`
   - For Custom MCQ: `/custom-mcq/{assessmentId}`
   - For AI Assessment: `/assessments/{id}/analytics`

#### Step 2: Open Live Proctoring Dashboard
1. **Click "Live Proctoring" button**
   - Should open a modal/dashboard

2. **Check Browser Console (Admin Side)**
   ```
   [MultiLiveProctorAdmin] Starting monitoring...
   [MultiLiveProctorAdmin] Admin WebSocket connected
   [MultiLiveProctorAdmin] Received X active sessions
   [MultiLiveProctorAdmin] Connecting to candidate...
   [MultiLiveProctorAdmin] Received session data for {sessionId}
   [MultiLiveProctorAdmin] Sent answer for {sessionId}
   [MultiLiveProctorAdmin] Connection state for {sessionId}: connected
   ```

3. **Check Network Tab (Admin Side)**
   - WebSocket connection: `ws://localhost:8000/api/v1/proctor/ws/live/admin/{assessmentId}`
   - WebSocket messages:
     - `{ type: "active_sessions", sessions: [...] }`
     - `{ type: "get_session", sessionId: "..." }`
     - `{ type: "session_data", ... }`
     - `{ type: "answer", ... }`
     - `{ type: "ice", ... }`

4. **Verify Dashboard**
   - Should show candidate card(s)
   - Each card should have:
     - Candidate email/ID
     - Webcam video (live feed)
     - Screen video (live feed)
     - Connection status: "Connected"

---

### Phase 3: Critical Test - Admin Disconnection

#### Step 1: Admin Closes Dashboard
1. **Click "Close" button** on Live Proctoring dashboard
2. **Check Browser Console (Admin Side)**
   ```
   [MultiLiveProctorAdmin] Stopping monitoring...
   [MultiLiveProctorAdmin] Closed peer connection for {sessionId}
   [MultiLiveProctorAdmin] Monitoring stopped (local cleanup only)
   ```

3. **Check Browser Console (Candidate Side)**
   ```
   [LiveProctoring] Connection state changed: disconnected
   [LiveProctoring] Peer connection disconnected/failed - keeping streams active, waiting for admin reconnection
   ```
   - **CRITICAL**: Should NOT see "Streaming stopped" or "Session ended"
   - **CRITICAL**: Should NOT see `POST /api/v1/proctor/live/end-session`

4. **Verify Candidate State**
   - `isStreaming: true` (still streaming!)
   - `connectionState: "disconnected"` (but streams active)
   - Webcam and screen streams still active
   - WebSocket still connected

5. **Check Network Tab (Candidate Side)**
   - WebSocket connection should still be open
   - No `end-session` API call

---

### Phase 4: Critical Test - Admin Reconnection

#### Step 1: Admin Reopens Dashboard
1. **Click "Live Proctoring" button again**
2. **Check Browser Console (Admin Side)**
   ```
   [MultiLiveProctorAdmin] Starting monitoring...
   [MultiLiveProctorAdmin] Admin WebSocket connected
   [MultiLiveProctorAdmin] Received X active sessions
   [MultiLiveProctorAdmin] Connecting to candidate...
   [MultiLiveProctorAdmin] Closing old peer connection for {sessionId} (state: disconnected)
   [MultiLiveProctorAdmin] Received session data for {sessionId}
   [MultiLiveProctorAdmin] Sent answer for {sessionId}
   [MultiLiveProctorAdmin] Connection state for {sessionId}: connected
   ```

3. **Check Browser Console (Candidate Side)**
   ```
   [LiveProctoring] Received WebSocket message: answer
   [LiveProctoring] Peer connection in bad state, recreating...
   [LiveProctoring] Connection state changed: connecting
   [LiveProctoring] Connection state changed: connected
   ```

4. **Verify Dashboard**
   - Should show candidate card(s) again
   - Webcam and screen videos should be visible
   - Connection status: "Connected"

5. **Verify Candidate State**
   - `isStreaming: true`
   - `connectionState: "connected"`
   - Streams still active

---

### Phase 5: Candidate Ends Assessment

#### Step 1: Candidate Submits/Ends
1. **Candidate clicks "End Assessment" or submits**
2. **Check Browser Console (Candidate Side)**
   ```
   [LiveProctoring] Stopping streaming...
   [LiveProctoring] Session ended
   [LiveProctoring] WebSocket closed
   [LiveProctoring] Streaming stopped
   ```

3. **Check Network Tab (Candidate Side)**
   - `POST /api/v1/proctor/live/end-session/{sessionId}` → Should return success
   - WebSocket should close

4. **Check Browser Console (Admin Side)**
   ```
   [MultiLiveProctorAdmin] Received admin WebSocket message: session_ended
   [MultiLiveProctorAdmin] Session ended: {sessionId}
   [MultiLiveProctorAdmin] Closed peer connection for {sessionId}
   ```

5. **Verify Dashboard**
   - Candidate should be removed from active list
   - Card should disappear

---

## Edge Cases to Test

### 1. Multiple Admins
- **Test**: Two admins open Live Proctoring dashboard simultaneously
- **Expected**: Both admins should see the same candidate streams
- **Verify**: Both can monitor independently

### 2. Candidate Connection Drops
- **Test**: Disconnect candidate's internet temporarily
- **Expected**: 
  - Candidate keeps streaming (streams stay active)
  - Admin sees "disconnected" status
  - When candidate reconnects, admin can reconnect

### 3. Admin Connection Drops
- **Test**: Disconnect admin's internet temporarily
- **Expected**:
  - Candidate keeps streaming
  - Admin WebSocket reconnects automatically
  - Admin can see streams again after reconnection

### 4. Multiple Candidates
- **Test**: Multiple candidates start assessment simultaneously
- **Expected**: Admin dashboard shows all candidates in grid
- **Verify**: Each candidate has separate webcam + screen streams

### 5. Candidate Refreshes Page
- **Test**: Candidate refreshes browser page during assessment
- **Expected**: 
  - Session should be recreated (new sessionId)
  - Admin should see new session
  - Streaming should resume

---

## Troubleshooting

### Issue: Candidate streaming not starting

**Check:**
1. Browser console for errors
2. Network tab for failed API calls
3. Camera/screen permissions granted
4. `window.__screenStream` exists (check in console: `window.__screenStream`)

**Common Causes:**
- Screen not shared in identity-verify gate
- Camera permission denied
- Backend not running
- WebSocket connection failed

**Fix:**
- Ensure screen is shared before starting assessment
- Grant camera permission
- Check backend is running on port 8000
- Check WebSocket URL is correct

---

### Issue: Admin not seeing streams

**Check:**
1. Browser console for errors
2. Network tab for WebSocket messages
3. Candidate is actually streaming (check candidate console)
4. Session exists in database

**Common Causes:**
- WebSocket not connected
- Peer connection not established
- Offer/answer exchange failed
- ICE candidates not exchanged

**Fix:**
- Check WebSocket connection status
- Check peer connection state
- Verify offer/answer in WebSocket messages
- Check ICE candidates in WebSocket messages

---

### Issue: Admin closes dashboard, candidate streaming stops

**This is a CRITICAL BUG!**

**Check:**
1. Candidate console for `stopStreaming()` call
2. Network tab for `end-session` API call
3. `useLiveProctoring` hook - connection state handler

**Expected Behavior:**
- When `pc.connectionState === "disconnected"` or `"failed"`, should NOT call `stopStreaming()`
- Should only log and wait for admin reconnection

**Fix:**
- Remove any `stopStreaming()` calls from connection state handler
- Ensure streams stay active

---

### Issue: Admin reopens dashboard, streams not visible

**Check:**
1. Admin console for peer connection creation
2. WebSocket messages for `session_data`
3. Candidate console for answer processing

**Common Causes:**
- Old peer connection not closed
- New peer connection not created
- Offer/answer exchange failed
- Candidate not recreating peer connection

**Fix:**
- Ensure admin always creates NEW peer connection
- Ensure candidate recreates peer connection when receiving answer in bad state
- Check WebSocket message flow

---

## Verification Checklist

### Candidate Side
- [ ] Session created when starting assessment
- [ ] WebSocket connects successfully
- [ ] Webcam stream obtained
- [ ] Screen stream obtained (from `window.__screenStream`)
- [ ] Peer connection created
- [ ] Offer sent via WebSocket
- [ ] ICE candidates sent via WebSocket
- [ ] When admin disconnects: streams stay active, no `end-session` call
- [ ] When admin reconnects: peer connection recreated, streaming resumes
- [ ] When ending assessment: session ended, streams stopped

### Admin Side
- [ ] WebSocket connects successfully
- [ ] Receives active sessions list
- [ ] Creates NEW peer connection for each candidate
- [ ] Requests session data (offer)
- [ ] Receives offer and sets as remote description
- [ ] Creates answer and sends via WebSocket
- [ ] Exchanges ICE candidates
- [ ] Receives webcam + screen streams
- [ ] Displays streams in dashboard
- [ ] When closing dashboard: only local cleanup, no backend calls
- [ ] When reopening dashboard: creates new connections, sees streams

### Backend
- [ ] `start-session` endpoint creates session in database
- [ ] `end-session` endpoint marks session as ended
- [ ] `all-sessions` endpoint returns active sessions
- [ ] Candidate WebSocket routes messages correctly
- [ ] Admin WebSocket routes messages correctly
- [ ] Session persists when admin disconnects
- [ ] Session ends only when candidate calls `end-session`

---

## Quick Test Script

```bash
# Terminal 1: Backend
cd backend
# Start FastAPI server

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Check MongoDB
# Verify live_proctor_sessions collection exists
```

**Browser 1 (Candidate):**
1. Open candidate entry URL
2. Complete all gates
3. Start assessment
4. Check console for streaming logs

**Browser 2 (Admin):**
1. Open analytics page
2. Click "Live Proctoring"
3. Verify streams visible
4. Close dashboard
5. Reopen dashboard
6. Verify streams visible again

---

## Success Criteria

✅ **Test Passes If:**
- Candidate can start streaming
- Admin can see candidate's webcam + screen
- Admin can close/reopen dashboard without affecting candidate
- Candidate streaming continues when admin disconnects
- Candidate streaming resumes when admin reconnects
- Candidate can end assessment properly
- Multiple candidates can stream simultaneously
- Multiple admins can monitor simultaneously

❌ **Test Fails If:**
- Candidate streaming stops when admin disconnects
- Admin cannot see streams
- WebSocket connections fail
- Peer connections fail to establish
- Sessions not persisted in database
- Any backend errors in logs

