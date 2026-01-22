// ============================================================================
// Universal Proctoring System - Candidate Live Proctoring Service
// ============================================================================
//
// This service handles the CANDIDATE side of live proctoring:
// - Creates a session on the backend
// - Connects WebSocket for signaling
// - Creates WebRTC peer connection with webcam (+ optional screen)
// - Sends offer and handles answer from admin
// - Exchanges ICE candidates
//
// The webcam stream starts ONLY when this service is started.
// Admin viewing is independent - admin can connect at any time.
//
// ============================================================================

import {
  CandidateLiveProctoringConfig,
  CandidateLiveState,
  CandidateLiveCallbacks,
  DEFAULT_CANDIDATE_LIVE_CONFIG,
  INITIAL_CANDIDATE_LIVE_STATE,
  LIVE_PROCTORING_ENDPOINTS,
  WEBRTC_CONFIG,
} from "./types";
import {
  liveLog,
  setLiveDebugMode,
  createWebSocketConnection,
  sendWebSocketMessage,
  createPeerConnection,
  getWebcamStream,
  getAvailableScreenStream,
  stopStream,
  addStreamTracks,
  parseIceCandidate,
  formatIceCandidate,
} from "./utils";

// ============================================================================
// Candidate Live Proctoring Service
// ============================================================================

/**
 * Candidate Live Proctoring Service.
 *
 * Manages the candidate's side of live proctoring:
 * - Registers with backend (creates session)
 * - Starts webcam and optionally screen sharing
 * - Sets up WebRTC connection for admin to view
 *
 * The streaming starts ONLY when explicitly called via start().
 */
export class CandidateLiveService {
  private config: CandidateLiveProctoringConfig;
  private callbacks: CandidateLiveCallbacks | null = null;

  // WebSocket & WebRTC
  private ws: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;

  // Media streams
  private webcamStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private screenSender: RTCRtpSender | null = null; // Reference to screen track sender for replacement

  // Session tracking
  private sessionId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Guards
  private isStarting: boolean = false;
  private isStopping: boolean = false;

  // State
  private state: CandidateLiveState = { ...INITIAL_CANDIDATE_LIVE_STATE };

  constructor(
    config: Pick<CandidateLiveProctoringConfig, "assessmentId" | "candidateId"> &
      Partial<CandidateLiveProctoringConfig>
  ) {
    this.config = {
      ...DEFAULT_CANDIDATE_LIVE_CONFIG,
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
   * Start live proctoring session.
   *
   * This will:
   * 1. Get webcam stream (or reuse existing)
   * 2. Get screen stream (if available)
   * 3. Create session on backend (or use existing)
   * 4. Connect WebSocket (or use existing)
   * 5. Create peer connection and send offer
   *
   * @param callbacks - Callbacks for state changes and errors
   * @param screenStream - Optional pre-captured screen stream
   * @param existingWebcamStream - Optional existing webcam stream (shared with AI)
   * @param existingSessionId - Optional existing session ID (to avoid duplicate session creation)
   * @param existingWebSocket - Optional existing WebSocket (to avoid duplicate WebSocket)
   */
  async start(
    callbacks: CandidateLiveCallbacks,
    screenStream?: MediaStream | null,
    existingWebcamStream?: MediaStream | null,
    existingSessionId?: string | null,
    existingWebSocket?: WebSocket | null
  ): Promise<boolean> {
    // Guards
    if (this.isStarting) {
      this.log("Already starting, skipping");
      return false;
    }
    if (this.state.isStreaming) {
      this.log("Already streaming, skipping");
      return true;
    }

    this.isStarting = true;
    this.callbacks = callbacks;
    this.updateState({ error: null, connectionState: "connecting" });

    try {
      this.log("✅ Starting Live Proctoring...");

      // 1. Get webcam stream (reuse existing if available)
      if (existingWebcamStream && existingWebcamStream.active) {
        this.log("✅ Reusing existing webcam stream (shared with AI or Universal Proctoring)");
        this.webcamStream = existingWebcamStream;
      } else {
        this.log("Getting new webcam stream...");
        this.webcamStream = await getWebcamStream();
        this.log("✅ Webcam obtained");
      }

      // 2. Get screen stream (optional but expected)
      this.screenStream = getAvailableScreenStream(screenStream);
      if (this.screenStream) {
        this.log("✅ Screen stream available");
      } else {
        this.log("⚠️ Screen stream not available - continuing with webcam only");
      }

      // 3. Create session on backend (or use existing)
      if (existingSessionId) {
        this.log(`Using existing session: ${existingSessionId}`);
        this.sessionId = existingSessionId;
      } else {
        this.log("Creating session...");
        const newSessionId = await this.createBackendSession();
        this.sessionId = newSessionId;
        this.log(`✅ Session created: ${newSessionId}`);
      }

      // 4. Connect WebSocket (or use existing)
      if (existingWebSocket && existingWebSocket.readyState === WebSocket.OPEN) {
        this.log("Using existing WebSocket");
        this.ws = existingWebSocket;
        // Setup message handler on existing WebSocket
        this.ws.onmessage = this.handleWebSocketMessage.bind(this);
      } else {
        this.log("Connecting WebSocket...");
        await this.connectWebSocket();
        this.log("✅ WebSocket connected");
      }

      // 5. Setup peer connection (offer will be sent when ADMIN_CONNECTED is received)
      this.log("Setting up peer connection...");
      await this.setupPeerConnection();
      this.log("✅ Peer connection ready");

      // Note: Offer is NOT sent here automatically
      // It will be sent when ADMIN_CONNECTED signal is received (handled in handleWebSocketMessage)
      // This prevents duplicate offers and ensures proper signaling state

      // 6. Start heartbeat
      this.startHeartbeat();

      // Mark as streaming
      this.updateState({
        isStreaming: true,
        sessionId: this.sessionId, // Use this.sessionId instead of local variable
        connectionState: "connecting",
      });

      this.log("✅ Live Proctoring started - waiting for admin to connect");
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to start streaming";
      this.log(`❌ Error: ${msg}`);
      this.updateState({ error: msg, connectionState: "failed" });
      this.callbacks?.onError?.(msg);
      this.cleanup();
      return false;
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stop live proctoring session.
   */
  async stop(): Promise<void> {
    if (this.isStopping) {
      this.log("Already stopping");
      return;
    }

    this.isStopping = true;
    this.log("✅ Stopping Live Proctoring...");

    try {
      // End session on backend
      if (this.sessionId) {
        try {
          await fetch(LIVE_PROCTORING_ENDPOINTS.endSession(this.sessionId), {
            method: "POST",
          });
          this.log("Session ended on backend");
        } catch (e) {
          this.log("Error ending session (ignored)", e);
        }
      }
    } finally {
      this.cleanup();
      this.isStopping = false;
      this.log("✅ Live Proctoring stopped");
    }
  }

  /**
   * Get current state.
   */
  getState(): CandidateLiveState {
    return { ...this.state };
  }

  /**
   * Check if streaming is active.
   */
  isStreaming(): boolean {
    return this.state.isStreaming;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Create session on backend.
   */
  private async createBackendSession(): Promise<string> {
    const response = await fetch(LIVE_PROCTORING_ENDPOINTS.startSession, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assessmentId: this.config.assessmentId,
        candidateId: this.config.candidateId,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.detail || `Session creation failed: ${response.statusText}`
      );
    }

    const data = await response.json();
    const sessionId = data.data?.sessionId || data.sessionId;
    if (!sessionId) {
      throw new Error("No sessionId returned from backend");
    }

    return sessionId;
  }

  /**
   * Connect WebSocket for signaling.
   */
  private async connectWebSocket(): Promise<void> {
    if (!this.sessionId) {
      throw new Error("No session ID for WebSocket connection");
    }

    const wsUrl = LIVE_PROCTORING_ENDPOINTS.candidateWs(
      this.sessionId,
      this.config.candidateId
    );

    this.ws = await createWebSocketConnection(
      wsUrl,
      this.config.connectionTimeoutMs
    );

    // Setup message handler
    this.ws.onmessage = this.handleWebSocketMessage.bind(this);

    this.ws.onclose = () => {
      this.log("⚠️ WebSocket closed");
      // Don't cleanup - session may still be active
    };

    this.ws.onerror = (err) => {
      this.log("❌ WebSocket error", err);
    };
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private async handleWebSocketMessage(event: MessageEvent): Promise<void> {
    try {
      const msg = JSON.parse(event.data);
      this.log(`WS message: ${msg.type}`);

      switch (msg.type) {
        case "ADMIN_CONNECTED":
          // Admin connected - send offer if not already sent
          // This handles ADMIN_CONNECTED arriving after the service has replaced the WebSocket handler
          this.log("✅ Admin connected - ensuring offer is sent");
          if (!this.peerConnection) {
            // No peer connection - setup and send offer
            this.log("Setting up peer connection and sending offer...");
            await this.setupPeerConnection();
            await this.sendOffer();
          } else if (this.peerConnection.signalingState === "have-local-offer") {
            // Offer already sent, just log
            this.log("Offer already sent, waiting for answer");
          } else if (this.peerConnection.signalingState === "stable") {
            // In stable state - send offer (normal case)
            this.log("Peer connection ready - sending offer...");
            await this.sendOffer();
          } else {
            // Other signaling state - log for debugging
            this.log(`Peer connection in unexpected state: ${this.peerConnection.signalingState} - attempting to send offer`);
            await this.sendOffer();
          }
          break;

        case "answer":
          await this.handleAnswer(msg.answer);
          break;

        case "ice_candidate":
          await this.handleIceCandidate(msg.candidate);
          break;

        case "pong":
          this.log("Received pong");
          break;

        case "request_offer":
          // Admin requesting new offer (reconnection)
          this.log("Admin requested new offer - checking peer connection state...");
          
          // Check if peer connection needs to be recreated for reconnection
          // This ensures clean state when admin reconnects
          const needsRecreation = !this.peerConnection || 
            this.peerConnection.connectionState === "disconnected" ||
            this.peerConnection.connectionState === "failed" ||
            this.peerConnection.connectionState === "closed" ||
            this.peerConnection.signalingState === "have-local-offer"; // Waiting for old answer from previous admin
          
          if (needsRecreation) {
            this.log(`Peer connection in bad state (connectionState: ${this.peerConnection?.connectionState}, signalingState: ${this.peerConnection?.signalingState}) - recreating for reconnection`);
            // Close old peer connection (streams stay active - we maintain single stream)
            if (this.peerConnection) {
              try {
                this.peerConnection.close();
                this.log("Closed old peer connection");
              } catch (e) {
                this.log("Error closing old peer connection:", e);
              }
            }
            // Recreate peer connection with same streams (maintains single stream: webcam + screen)
            await this.setupPeerConnection();
            this.log("✅ Peer connection recreated - ready for fresh offer");
          } else {
            // In else branch, peerConnection exists (needsRecreation was false)
            if (this.peerConnection) {
              this.log(`Peer connection in good state (connectionState: ${this.peerConnection.connectionState}, signalingState: ${this.peerConnection.signalingState}) - using existing`);
            } else {
              this.log("Peer connection is null - recreating");
              await this.setupPeerConnection();
            }
          }
          
          // Send fresh offer (from new or existing peer connection)
          await this.sendOffer();
          break;

        default:
          this.log(`Unknown message type: ${msg.type}`);
      }
    } catch (err) {
      this.log("Error processing WS message", err);
    }
  }

  /**
   * Handle answer from admin.
   */
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      this.log("⚠️ No peer connection for answer");
      return;
    }

    // Handle answer - only accept if in have-local-offer state (normal case)
    // If in stable state, it means offer wasn't sent yet - send offer first, then answer will be handled on next message
    if (this.peerConnection.signalingState === "have-local-offer") {
      // Normal case - proceed with answer
      this.log("Setting remote description (answer)...");
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
      this.log(`✅ Answer set - ICE state: ${this.peerConnection.iceConnectionState}, signaling: ${this.peerConnection.signalingState}`);
    } else if (this.peerConnection.signalingState === "stable") {
      // Edge case: Answer arrived but we're in stable state (offer not sent yet)
      // This can happen if answer arrives before ADMIN_CONNECTED triggers offer sending
      // Send offer first, then the answer will be queued or we'll get a new one
      this.log(`⚠️ Answer received in stable state - offer not sent yet. Sending offer first...`);
      await this.sendOffer();
      // Try to set answer after sending offer (might work if timing is right)
      try {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        this.log(`✅ Answer set after sending offer`);
      } catch (e) {
        this.log(`⚠️ Could not set answer immediately - will be handled when answer arrives again`);
      }
    } else {
      this.log(
        `⚠️ Ignoring answer - wrong signaling state: ${this.peerConnection.signalingState}`
      );
      return;
    }
    this.log("✅ Connection establishing - ICE candidates will now be exchanged");
  }

  /**
   * Handle ICE candidate from admin.
   */
  private async handleIceCandidate(candidateData: unknown): Promise<void> {
    if (!this.peerConnection) {
      this.log("⚠️ No peer connection when ICE candidate received");
      return;
    }
    
    if (!this.peerConnection.remoteDescription) {
      this.log("⚠️ Remote description not set yet, ICE candidate will be queued");
    }

    const candidate = parseIceCandidate(candidateData);
    if (candidate) {
      try {
        await this.peerConnection.addIceCandidate(candidate);
        this.log(`✅ Added admin ICE candidate - ICE state: ${this.peerConnection.iceConnectionState}`);
      } catch (err) {
        // Ignore duplicate/invalid ICE candidates
        this.log(`ICE candidate error (ignored): ${err}`);
      }
    } else {
      this.log("⚠️ Failed to parse ICE candidate");
    }
  }

  /**
   * Setup WebRTC peer connection.
   */
  private async setupPeerConnection(): Promise<void> {
    this.peerConnection = createPeerConnection(WEBRTC_CONFIG);

    // Add webcam tracks
    if (this.webcamStream) {
      addStreamTracks(this.peerConnection, this.webcamStream, "webcam");
    }

    // Add screen tracks (if available)
    if (this.screenStream && this.peerConnection) {
      const screenTracks = this.screenStream.getVideoTracks();
      screenTracks.forEach((track) => {
        // Store sender reference for track replacement
        const sender = this.peerConnection!.addTrack(track, this.screenStream!);
        this.screenSender = sender;
        this.log(`Added screen track: ${track.label}`);
        
        // Monitor screen track ending - re-acquire if assessment is still active
        const handleTrackEnded = async () => {
          // Only re-acquire if streaming is active and not stopping
          if (this.state.isStreaming && !this.isStopping) {
            this.log("⚠️ Screen track ended - re-acquiring screen stream");
            try {
              const newScreenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
              });
              
              const newTrack = newScreenStream.getVideoTracks()[0];
              if (newTrack && this.peerConnection && this.screenSender) {
                // Replace the track in the existing sender
                await this.screenSender.replaceTrack(newTrack);
                this.log("✅ Screen track replaced in peer connection");
                
                // Update stored stream
                if (this.screenStream) {
                  this.screenStream.getTracks().forEach(t => {
                    if (t !== track) t.stop(); // Don't stop the track we're replacing
                  });
                }
                this.screenStream = newScreenStream;
                
                // Update global reference
                if (typeof window !== "undefined") {
                  (window as any).__screenStream = newScreenStream;
                }
                
                // Monitor the new track for future replacements
                newTrack.onended = handleTrackEnded;
              }
            } catch (err) {
              this.log(`❌ Failed to re-acquire screen stream: ${err}`);
            }
          }
        };
        
        track.onended = handleTrackEnded;
      });
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.peerConnection) {
        const iceState = this.peerConnection.iceConnectionState;
        this.log(`Generated ICE candidate:`, {
          candidate: event.candidate.candidate.substring(0, 50) + '...',
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          iceState: iceState,
          signalingState: this.peerConnection.signalingState,
        });
        
        sendWebSocketMessage(this.ws, {
          type: "ice",
          ...formatIceCandidate(event.candidate),
        });
        this.log("✅ Sent ICE candidate to admin");
      } else if (this.peerConnection) {
        this.log(`ICE candidate gathering complete - final state: ${this.peerConnection.iceConnectionState}`);
      }
    };

    // Handle ICE connection state - CRITICAL for WebRTC
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      const connectionState = this.peerConnection?.connectionState;
      this.log(`ICE connection state: ${iceState} (connection: ${connectionState})`);
      
      switch (iceState) {
        case "new":
          this.log("🔄 ICE negotiation starting");
          break;
        case "checking":
          this.log("🔄 ICE checking in progress");
          break;
        case "connected":
        case "completed":
          this.log(`✅ ICE ${iceState} - streaming should be active!`);
          this.updateState({ connectionState: "connected" });
          break;
        case "failed":
          this.log("❌ ICE connection failed");
          this.updateState({ connectionState: "failed" });
          break;
        case "disconnected":
          this.log("⚠️ ICE disconnected");
          this.updateState({ connectionState: "disconnected" });
          break;
        case "closed":
          this.log("🔒 ICE closed");
          break;
      }
    };
    
    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      const iceState = this.peerConnection?.iceConnectionState;
      this.log(`Connection state: ${state} (ICE: ${iceState})`);

      switch (state) {
        case "connected":
          if (iceState === "connected" || iceState === "completed") {
            this.updateState({ connectionState: "connected" });
            this.log("✅ WebRTC fully connected - streaming to admin!");
          }
          break;
        case "disconnected":
          this.updateState({ connectionState: "disconnected" });
          this.log("⚠️ WebRTC disconnected");
          break;
        case "failed":
          this.updateState({ connectionState: "failed" });
          this.log("❌ WebRTC connection failed");
          break;
      }
    };

    // Send initial offer
    await this.sendOffer();
  }

  /**
   * Create and send WebRTC offer.
   */
  private async sendOffer(): Promise<void> {
    if (!this.peerConnection) return;

    this.log("Creating offer...");
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    sendWebSocketMessage(this.ws, {
      type: "offer",
      offer: { type: offer.type, sdp: offer.sdp },
    });

    this.log("✅ Offer sent");
  }

  /**
   * Start WebSocket heartbeat.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      sendWebSocketMessage(this.ws, { type: "ping" });
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Cleanup all resources.
   */
  private cleanup(): void {
    // Clear sender reference
    this.screenSender = null;
    this.log("Cleaning up resources...");

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        /* ignore */
      }
      this.ws = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        /* ignore */
      }
      this.peerConnection = null;
    }

    // Stop webcam stream (we own it)
    stopStream(this.webcamStream);
    this.webcamStream = null;

    // Stop screen stream when assessment ends (cleanup)
    if (this.isStopping && this.screenStream) {
      stopStream(this.screenStream);
      this.screenStream = null;
      // Clear global reference
      if (typeof window !== "undefined") {
        (window as any).__screenStream = null;
      }
    }

    // Reset state
    this.sessionId = null;
    this.updateState({
      ...INITIAL_CANDIDATE_LIVE_STATE,
    });
  }

  /**
   * Update state and notify callback.
   */
  private updateState(partial: Partial<CandidateLiveState>): void {
    this.state = { ...this.state, ...partial };
    this.callbacks?.onStateChange(partial);
  }

  /**
   * Log with prefix.
   */
  private log(msg: string, data?: unknown): void {
    liveLog("CandidateLive", msg, data);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let candidateLiveInstance: CandidateLiveService | null = null;

/**
 * Get or create the candidate live proctoring service.
 */
export function getCandidateLiveService(
  config: Pick<CandidateLiveProctoringConfig, "assessmentId" | "candidateId"> &
    Partial<CandidateLiveProctoringConfig>
): CandidateLiveService {
  if (!candidateLiveInstance) {
    candidateLiveInstance = new CandidateLiveService(config);
  }
  return candidateLiveInstance;
}

/**
 * Reset the candidate live proctoring service.
 */
export async function resetCandidateLiveService(): Promise<void> {
  if (candidateLiveInstance) {
    await candidateLiveInstance.stop();
    candidateLiveInstance = null;
  }
}
