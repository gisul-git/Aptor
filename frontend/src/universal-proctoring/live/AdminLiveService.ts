// ============================================================================
// Universal Proctoring System - Admin Live Proctoring Service
// ============================================================================
//
// This service handles the ADMIN side of live proctoring:
// - Connects WebSocket to receive session updates
// - Gets list of active candidate sessions
// - Creates peer connections to view candidate streams
// - Handles reconnection when admin reopens dashboard
//
// CRITICAL DESIGN DECISIONS (from existing implementation):
// - Admin ALWAYS creates NEW peer connection (never reuse old ones)
// - When admin closes dashboard, only local cleanup (don't end candidate sessions)
// - When admin reopens dashboard, creates new connections to ongoing streams
//
// ============================================================================

import {
  AdminLiveProctoringConfig,
  AdminLiveState,
  AdminLiveCallbacks,
  CandidateStreamInfo,
  DEFAULT_ADMIN_LIVE_CONFIG,
  INITIAL_ADMIN_LIVE_STATE,
  LIVE_PROCTORING_ENDPOINTS,
  WEBRTC_CONFIG,
  LiveConnectionState,
} from "./types";
import {
  liveLog,
  setLiveDebugMode,
  createWebSocketConnection,
  sendWebSocketMessage,
  createPeerConnection,
  detectStreamType,
  parseIceCandidate,
  formatIceCandidate,
} from "./utils";

// ============================================================================
// Admin Live Proctoring Service
// ============================================================================

/**
 * Admin Live Proctoring Service.
 *
 * Manages the admin's side of live proctoring (CCTV-style monitoring):
 * - Connects to signaling server via WebSocket
 * - Receives list of active candidate sessions
 * - Creates peer connections to view candidate webcam/screen streams
 *
 * Admin can:
 * - Start monitoring (connects WebSocket, gets active sessions)
 * - Stop monitoring (closes all connections, but does NOT end candidate sessions)
 * - Refresh a specific candidate connection
 */
export class AdminLiveService {
  private config: AdminLiveProctoringConfig;
  private callbacks: AdminLiveCallbacks | null = null;

  // WebSocket
  private ws: WebSocket | null = null;

  // Peer connections (one per candidate session)
  private peerConnections: Map<string, RTCPeerConnection> = new Map();

  // Stream tracking
  private candidateStreams: Map<string, CandidateStreamInfo> = new Map();
  private receivedVideoTracks: Map<string, Set<string>> = new Map();

  // Session tracking
  private connectingSessions: Set<string> = new Set();
  private candidateIdMap: Map<string, string> = new Map(); // sessionId -> candidateId

  // Guards
  private isStarting: boolean = false;

  // State
  private state: AdminLiveState = { ...INITIAL_ADMIN_LIVE_STATE };

  constructor(
    config: Pick<AdminLiveProctoringConfig, "assessmentId" | "adminId"> &
      Partial<AdminLiveProctoringConfig>
  ) {
    this.config = {
      ...DEFAULT_ADMIN_LIVE_CONFIG,
      ...config,
    };

    if (this.config.debugMode) {
      setLiveDebugMode(true);
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Start monitoring active candidates.
   *
   * This will:
   * 1. Connect WebSocket to signaling server
   * 2. Receive list of active candidate sessions
   * 3. Create peer connections to view each candidate's streams
   *
   * @param callbacks - Callbacks for state changes and events
   */
  async startMonitoring(callbacks: AdminLiveCallbacks): Promise<boolean> {
    if (this.isStarting) {
      this.log("Already starting monitoring");
      return false;
    }

    if (this.state.isMonitoring) {
      this.log("Already monitoring");
      return true;
    }

    this.isStarting = true;
    this.callbacks = callbacks;
    this.updateState({ isLoading: true });

    try {
      this.log("✅ Starting admin monitoring...");

      // Connect WebSocket
      const wsUrl = LIVE_PROCTORING_ENDPOINTS.adminWs(this.config.assessmentId);
      this.log("Connecting WebSocket", wsUrl);

      this.ws = await createWebSocketConnection(wsUrl, 10000);
      this.log("✅ WebSocket connected");

      // Setup message handler
      this.ws.onmessage = this.handleWebSocketMessage.bind(this);

      this.ws.onclose = () => {
        this.log("⚠️ Admin WebSocket closed");
        // Don't cleanup - admin may want to reconnect
      };

      this.ws.onerror = (err) => {
        this.log("❌ Admin WebSocket error", err);
      };

      this.updateState({ isMonitoring: true });
      this.log("✅ Admin monitoring started");

      return true;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to start monitoring";
      this.log(`❌ Error: ${msg}`);
      this.callbacks?.onError?.(msg);
      this.cleanup();
      return false;
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stop monitoring.
   *
   * IMPORTANT: This only closes local connections.
   * Candidate sessions continue running - admin can reconnect later.
   */
  stopMonitoring(): void {
    this.log("✅ Stopping admin monitoring...");
    this.cleanup();
    this.log("✅ Admin monitoring stopped");
  }

  /**
   * Refresh connection to a specific candidate.
   * Use this if the stream is not showing or connection failed.
   *
   * @param sessionId - Session ID to refresh
   */
  async refreshCandidate(sessionId: string): Promise<void> {
    this.log(`Refreshing connection to ${sessionId}`);

    // Close existing connection
    this.closePeerConnection(sessionId);

    // Get candidateId from map
    const candidateId = this.candidateIdMap.get(sessionId) || sessionId;

    // Reconnect
    await this.connectToCandidate({
      sessionId,
      candidateId,
      status: "candidate_initiated",
    }, true);
  }

  /**
   * Get current state.
   */
  getState(): AdminLiveState {
    return {
      ...this.state,
      candidateStreams: new Map(this.candidateStreams),
    };
  }

  /**
   * Get streams for a specific candidate.
   */
  getCandidateStreams(sessionId: string): CandidateStreamInfo | undefined {
    return this.candidateStreams.get(sessionId);
  }

  /**
   * Get all active session IDs.
   */
  getActiveSessions(): string[] {
    return [...this.state.activeSessions];
  }

  /**
   * Check if monitoring is active.
   */
  isMonitoring(): boolean {
    return this.state.isMonitoring;
  }

  // ============================================================================
  // WebSocket Message Handling
  // ============================================================================

  /**
   * Handle incoming WebSocket messages from signaling server.
   */
  private async handleWebSocketMessage(event: MessageEvent): Promise<void> {
    try {
      const message = JSON.parse(event.data);
      this.log(`Received message: ${message.type}`);

      switch (message.type) {
        case "active_sessions":
          await this.handleActiveSessions(message.sessions || []);
          break;

        case "new_session":
          await this.handleNewSession(message);
          break;

        case "candidate_connected":
          // Handle real-time notification when candidate WebSocket connects
          await this.handleNewSession(message.session || message);
          break;

        case "session_ended":
          this.handleSessionEnded(message.sessionId);
          break;

        case "session_data":
          await this.handleSessionData(message);
          break;

        default:
          this.log(`Unknown message type: ${message.type}`);
      }
    } catch (err) {
      this.log("Error processing message", err);
    }
  }

  /**
   * Handle list of active sessions from server.
   */
  private async handleActiveSessions(
    sessions: Array<{ sessionId: string; candidateId: string; status: string }>
  ): Promise<void> {
    this.log(`Received ${sessions.length} active sessions`, sessions);

    const sessionIds = sessions.map((s) => s.sessionId);
    this.updateState({ activeSessions: sessionIds, isLoading: false });

    // Connect to each active candidate
    for (const session of sessions) {
      await this.connectToCandidate(session);
    }
  }

  /**
   * Handle new session notification.
   */
  private async handleNewSession(message: {
    sessionId: string;
    candidateId: string;
    status?: string;
  }): Promise<void> {
    const { sessionId, candidateId, status } = message;
    this.log(`New session started: ${sessionId}`);

    // Add to active sessions
    if (!this.state.activeSessions.includes(sessionId)) {
      this.updateState({
        activeSessions: [...this.state.activeSessions, sessionId],
      });
    }

    // Connect if not already connected
    const existingPc = this.peerConnections.get(sessionId);
    const isConnecting = this.connectingSessions.has(sessionId);

    if (
      !existingPc ||
      existingPc.connectionState === "disconnected" ||
      existingPc.connectionState === "failed" ||
      existingPc.connectionState === "closed"
    ) {
      if (!isConnecting) {
        await this.connectToCandidate(
          { sessionId, candidateId, status: status || "candidate_initiated" },
          false
        );
      }
    }
  }

  /**
   * Handle session ended notification.
   */
  private handleSessionEnded(sessionId: string): void {
    this.log(`Session ended: ${sessionId}`);

    // Remove from active sessions
    this.updateState({
      activeSessions: this.state.activeSessions.filter((id) => id !== sessionId),
    });

    // Close peer connection
    this.closePeerConnection(sessionId);

    // Remove from streams map
    this.candidateStreams.delete(sessionId);

    // Notify callback
    this.callbacks?.onCandidateDisconnected?.(sessionId);
  }

  /**
   * Handle session data (offer) from server.
   */
  private async handleSessionData(message: {
    sessionId: string;
    candidateId?: string;
    offer?: RTCSessionDescriptionInit;
    candidateICE?: unknown[];
  }): Promise<void> {
    const { sessionId, candidateId, offer, candidateICE } = message;

    if (!offer) {
      this.log(`No offer in session_data for ${sessionId}, retrying...`);
      // Retry after delay
      setTimeout(() => {
        sendWebSocketMessage(this.ws, {
          type: "get_session",
          sessionId,
        });
      }, 2000);
      return;
    }

    this.log(`Received session data for ${sessionId}`);

    // Remove from connecting set
    this.connectingSessions.delete(sessionId);

    // Store candidateId
    if (candidateId) {
      this.candidateIdMap.set(sessionId, candidateId);
    }

    // Check existing connection
    const existingPc = this.peerConnections.get(sessionId);
    if (
      existingPc &&
      (existingPc.connectionState === "connected" ||
        existingPc.connectionState === "connecting")
    ) {
      this.log(`Already connected to ${sessionId}, skipping (fresh offer will be ignored)`);
      return;
    }

    // Close existing if in bad state (disconnected/failed/closed)
    // This allows reconnection with fresh offer
    if (existingPc) {
      this.log(`Closing existing connection in state: ${existingPc.connectionState}`);
      this.closePeerConnection(sessionId);
    }

    // Create new peer connection
    await this.setupPeerConnection(
      sessionId,
      candidateId || sessionId,
      offer,
      candidateICE || []
    );
  }

  // ============================================================================
  // Peer Connection Management
  // ============================================================================

  /**
   * Connect to a candidate session.
   */
  private async connectToCandidate(
    session: { sessionId: string; candidateId: string; status: string },
    forceReconnect: boolean = false
  ): Promise<void> {
    const { sessionId, candidateId } = session;

    // Check if already connecting
    if (this.connectingSessions.has(sessionId) && !forceReconnect) {
      this.log(`Already connecting to ${sessionId}, skipping`);
      return;
    }

    // Check existing connection
    const existingPc = this.peerConnections.get(sessionId);
    if (existingPc && !forceReconnect) {
      const state = existingPc.connectionState;
      if (state === "connected" || state === "connecting") {
        this.log(`Already have active connection for ${sessionId}`);
        return;
      }
    }

    // Mark as connecting
    this.connectingSessions.add(sessionId);
    this.candidateIdMap.set(sessionId, candidateId);

    // Update stream state
    this.updateCandidateStream(sessionId, {
      sessionId,
      candidateId,
      status: "connecting",
      webcamStream: null,
      screenStream: null,
      error: null,
    });

    // Request session data (offer) from server
    if (!sendWebSocketMessage(this.ws, { type: "get_session", sessionId })) {
      this.log(`Failed to request session data for ${sessionId}`);
      this.connectingSessions.delete(sessionId);
      this.updateCandidateStream(sessionId, {
        status: "failed",
        error: "WebSocket not connected",
      });
    }

    this.log(`Requested session data for ${sessionId}`);
  }

  /**
   * Setup peer connection for a candidate.
   */
  private async setupPeerConnection(
    sessionId: string,
    candidateId: string,
    offer: RTCSessionDescriptionInit,
    candidateICE: unknown[]
  ): Promise<void> {
    const pc = createPeerConnection(WEBRTC_CONFIG);
    this.peerConnections.set(sessionId, pc);

    // Initialize video track tracking
    this.receivedVideoTracks.set(sessionId, new Set());

    // Handle incoming tracks
    pc.ontrack = (event) => {
      this.handleTrack(sessionId, candidateId, event);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWebSocketMessage(this.ws, {
          type: "ice",
          sessionId,
          ...formatIceCandidate(event.candidate),
        });
        this.log(`Sent ICE candidate for ${sessionId}`);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      this.handleConnectionStateChange(sessionId, pc);
    };

    // Set remote description (offer)
    this.log(`Setting remote description for ${sessionId}`);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Add candidate ICE candidates
    for (const ice of candidateICE) {
      const candidate = parseIceCandidate(ice);
      if (candidate) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          // Ignore invalid ICE candidates
        }
      }
    }

    // Create and send answer
    this.log(`Creating answer for ${sessionId}`);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendWebSocketMessage(this.ws, {
      type: "answer",
      sessionId,
      answer: { type: answer.type, sdp: answer.sdp },
    });

    this.log(`✅ Answer sent for ${sessionId}`);
  }

  /**
   * Handle incoming track from candidate.
   */
  private handleTrack(
    sessionId: string,
    candidateId: string,
    event: RTCTrackEvent
  ): void {
    if (event.track.kind !== "video") return;

    const stream = event.streams[0];
    const trackId = event.track.id;
    const streamType = detectStreamType(event.track, stream?.id);

    this.log(`Received ${streamType} track for ${sessionId}`, {
      trackId,
      label: event.track.label,
      streamId: stream?.id,
    });

    // Track received video tracks to distinguish webcam/screen by order
    const sessionTracks = this.receivedVideoTracks.get(sessionId) || new Set();
    const isFirstTrack = sessionTracks.size === 0;
    sessionTracks.add(trackId);
    this.receivedVideoTracks.set(sessionId, sessionTracks);

    // Determine stream type (priority: detected type > order)
    const isScreen = streamType === "screen" || (!isFirstTrack && sessionTracks.size === 2);

    // Get current stream info
    const current = this.candidateStreams.get(sessionId) || {
      sessionId,
      candidateId,
      status: "connecting" as LiveConnectionState,
      webcamStream: null,
      screenStream: null,
      error: null,
    };

    // Update appropriate stream
    if (isScreen && !current.screenStream) {
      this.log(`✅ Screen stream for ${sessionId}`);
      this.updateCandidateStream(sessionId, {
        screenStream: stream,
        status: current.webcamStream ? "connected" : "connecting",
      });
    } else if (!isScreen && !current.webcamStream) {
      this.log(`✅ Webcam stream for ${sessionId}`);
      this.updateCandidateStream(sessionId, {
        webcamStream: stream,
        status: current.screenStream ? "connected" : "connecting",
      });
    }
  }

  /**
   * Handle peer connection state changes.
   */
  private handleConnectionStateChange(
    sessionId: string,
    pc: RTCPeerConnection
  ): void {
    const state = pc.connectionState;
    this.log(`Connection state for ${sessionId}: ${state}`);

    switch (state) {
      case "connected":
        this.connectingSessions.delete(sessionId);
        this.updateCandidateStream(sessionId, { status: "connected" });
        this.callbacks?.onCandidateConnected?.(
          sessionId,
          this.candidateIdMap.get(sessionId) || sessionId
        );
        break;

      case "disconnected":
        this.updateCandidateStream(sessionId, { status: "disconnected" });
        break;

      case "failed":
        this.connectingSessions.delete(sessionId);
        this.updateCandidateStream(sessionId, {
          status: "failed",
          error: "Connection failed",
        });
        break;
    }
  }

  /**
   * Close peer connection for a session.
   */
  private closePeerConnection(sessionId: string): void {
    const pc = this.peerConnections.get(sessionId);
    if (pc) {
      try {
        pc.close();
      } catch (err) {
        // Ignore
      }
      this.peerConnections.delete(sessionId);
    }

    this.connectingSessions.delete(sessionId);
    this.receivedVideoTracks.delete(sessionId);
    this.log(`Closed peer connection for ${sessionId}`);
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Update state and notify callback.
   */
  private updateState(partial: Partial<AdminLiveState>): void {
    this.state = { ...this.state, ...partial };
    this.callbacks?.onStateChange({
      ...partial,
      candidateStreams: new Map(this.candidateStreams),
    });
  }

  /**
   * Update stream info for a candidate.
   */
  private updateCandidateStream(
    sessionId: string,
    partial: Partial<CandidateStreamInfo>
  ): void {
    const current = this.candidateStreams.get(sessionId) || {
      sessionId,
      candidateId: this.candidateIdMap.get(sessionId) || sessionId,
      status: "disconnected" as LiveConnectionState,
      webcamStream: null,
      screenStream: null,
      error: null,
    };

    this.candidateStreams.set(sessionId, { ...current, ...partial });

    // Notify state change
    this.callbacks?.onStateChange({
      candidateStreams: new Map(this.candidateStreams),
    });
  }

  /**
   * Cleanup all resources.
   */
  private cleanup(): void {
    this.log("Cleaning up...");

    // Close WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        /* ignore */
      }
      this.ws = null;
    }

    // Close all peer connections
    Array.from(this.peerConnections.keys()).forEach((sessionId) => {
      this.closePeerConnection(sessionId);
    });

    // Reset state
    this.candidateStreams.clear();
    this.candidateIdMap.clear();
    this.connectingSessions.clear();
    this.receivedVideoTracks.clear();

    this.state = { ...INITIAL_ADMIN_LIVE_STATE };
    this.callbacks?.onStateChange(this.state);
  }

  /**
   * Log with prefix.
   */
  private log(msg: string, data?: unknown): void {
    liveLog("AdminLive", msg, data);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let adminLiveInstance: AdminLiveService | null = null;

/**
 * Get or create the admin live proctoring service.
 */
export function getAdminLiveService(
  config: Pick<AdminLiveProctoringConfig, "assessmentId" | "adminId"> &
    Partial<AdminLiveProctoringConfig>
): AdminLiveService {
  if (!adminLiveInstance) {
    adminLiveInstance = new AdminLiveService(config);
  }
  return adminLiveInstance;
}

/**
 * Reset the admin live proctoring service.
 */
export function resetAdminLiveService(): void {
  if (adminLiveInstance) {
    adminLiveInstance.stopMonitoring();
    adminLiveInstance = null;
  }
}
