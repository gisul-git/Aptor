// ============================================================================
// Universal Proctoring System - Candidate Live Proctoring Service (Agora)
// ============================================================================
//
// This service handles the CANDIDATE side of live proctoring using Agora RTC:
// - Gets Agora token from backend
// - Joins Agora channel
// - Publishes webcam and screen streams
//
// ============================================================================

import type {
  ILocalVideoTrack,
  IAgoraRTCClient,
} from "agora-rtc-sdk-ng";

import {
  CandidateLiveProctoringConfig,
  CandidateLiveState,
  CandidateLiveCallbacks,
  DEFAULT_CANDIDATE_LIVE_CONFIG,
  INITIAL_CANDIDATE_LIVE_STATE,
  LIVE_PROCTORING_ENDPOINTS,
} from "./types";
import {
  liveLog,
  setLiveDebugMode,
} from "./utils";

type AgoraModule = typeof import("agora-rtc-sdk-ng");

// ============================================================================
// Candidate Live Proctoring Service
// ============================================================================

/**
 * Candidate Live Proctoring Service (Agora-based).
 *
 * Manages the candidate's side of live proctoring using Agora RTC SDK.
 */
export class CandidateLiveService {
  private config: CandidateLiveProctoringConfig & { debugMode?: boolean };
  private callbacks: CandidateLiveCallbacks | null = null;

  // Agora - Use separate clients for webcam and screen (RTC mode doesn't support multiple video tracks per client)
  private agoraModule: AgoraModule | null = null;
  private cameraClient: IAgoraRTCClient | null = null;
  private screenClient: IAgoraRTCClient | null = null;
  private cameraTrack: ILocalVideoTrack | null = null;
  private screenTrack: ILocalVideoTrack | null = null;

  // Media streams
  private webcamStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  // Session tracking
  private sessionId: string | null = null;

  // Guards
  private isStarting: boolean = false;
  private isStopping: boolean = false;

  // State
  private state: CandidateLiveState = { ...INITIAL_CANDIDATE_LIVE_STATE };

  constructor(
    config: Pick<CandidateLiveProctoringConfig, "assessmentId" | "candidateId"> &
      Partial<CandidateLiveProctoringConfig> & { debugMode?: boolean }
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
  // Private Helpers
  // ============================================================================

  private log(msg: string, data?: unknown): void {
    liveLog("[CandidateLiveService]", msg, data);
  }

  private async getAgora(): Promise<AgoraModule | null> {
    if (typeof window === "undefined") {
      return null;
    }

    if (this.agoraModule) {
      return this.agoraModule;
    }

    try {
      this.agoraModule = await import("agora-rtc-sdk-ng");
      if (this.config.debugMode && this.agoraModule.default) {
        this.agoraModule.default.setLogLevel(0); // 0 = DEBUG, 1 = INFO, 2 = WARNING, 3 = ERROR, 4 = NONE
      }
      return this.agoraModule;
    } catch (error) {
      this.log("Failed to load Agora SDK", error);
      return null;
    }
  }

  private updateState(updates: Partial<CandidateLiveState>): void {
    this.state = { ...this.state, ...updates };
    this.callbacks?.onStateChange(updates);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Start live proctoring session.
   *
   * @param callbacks - Callbacks for state changes and errors
   * @param screenStream - Optional pre-captured screen stream
   * @param existingWebcamStream - Optional existing webcam stream (shared with AI)
   * @param existingSessionId - Optional existing session ID
   * @param _existingWebSocket - Not used (kept for backward compatibility)
   */
  async start(
    callbacks: CandidateLiveCallbacks,
    screenStream?: MediaStream | null,
    existingWebcamStream?: MediaStream | null,
    existingSessionId?: string | null,
    _existingWebSocket?: WebSocket | null
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
      this.log("✅ Starting Live Proctoring (Agora)...");

      // 1. Load Agora SDK
      const AgoraRTC = (await this.getAgora())?.default;
      if (!AgoraRTC) {
        throw new Error("Failed to load Agora SDK");
      }

      // 2. Get webcam stream (reuse existing if available)
      if (existingWebcamStream && existingWebcamStream.active) {
        this.log("✅ Reusing existing webcam stream");
        this.webcamStream = existingWebcamStream;
      } else {
        this.log("Getting new webcam stream...");
        const videoTrack = existingWebcamStream?.getVideoTracks()[0];
        if (videoTrack) {
          this.webcamStream = new MediaStream([videoTrack]);
        } else {
          this.webcamStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
        this.log("✅ Webcam obtained");
      }

      // 3. Get screen stream (optional)
      this.screenStream = screenStream || null;
      if (this.screenStream) {
        this.log("✅ Screen stream available");
      } else {
        this.log("⚠️ Screen stream not available - continuing with webcam only");
      }

      // 4. Use existing session ID or create new one
      this.sessionId = existingSessionId || null;

      // 5. Get Agora token
      this.log(`🔍 [DEBUG] Requesting Agora token with candidateId: ${this.config.candidateId}`);
      const tokenResponse = await fetch(LIVE_PROCTORING_ENDPOINTS.agoraToken(), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assessmentId: this.config.assessmentId,
          candidateId: this.config.candidateId,
          role: "candidate",
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Failed to get Agora token: ${tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();
      if (tokenData.status !== "ok") {
        throw new Error("Invalid token response");
      }

      this.log("✅ Agora token received");
      this.log(`🔍 [DEBUG] Token response keys: ${Object.keys(tokenData).join(', ')}`);
      this.log(`🔍 [DEBUG] Token response candidateName: ${tokenData.candidateName || 'MISSING'}`);
      this.log(`🔍 [DEBUG] Token response candidateEmail: ${tokenData.candidateEmail || 'MISSING'}`);
      
      // Store candidate info in global map for admin to use
      if (typeof window !== 'undefined') {
        const candidateInfoMap = (window as any).__CANDIDATE_INFO_MAP || new Map();
        if (tokenData.candidateName || tokenData.candidateEmail) {
          candidateInfoMap.set(this.config.candidateId, {
            candidateName: tokenData.candidateName,
            candidateEmail: tokenData.candidateEmail,
            timestamp: Date.now(),
          });
          (window as any).__CANDIDATE_INFO_MAP = candidateInfoMap;
          this.log(`✅ Stored candidate info: ${tokenData.candidateName || tokenData.candidateEmail || 'no name'} (candidateId: ${this.config.candidateId})`);
          this.log(`🔍 [DEBUG] Map size after store: ${candidateInfoMap.size}`);
          this.log(`🔍 [DEBUG] Map keys: ${Array.from(candidateInfoMap.keys()).join(', ')}`);
        } else {
          this.log(`⚠️ No candidate name/email in token response for candidateId: ${this.config.candidateId}`);
          this.log(`🔍 [DEBUG] Full token response:`, JSON.stringify(tokenData, null, 2));
        }
      }

      // 6. Create separate Agora clients for webcam and screen
      // Live Broadcast mode supports up to 1,000 hosts per channel (vs 17 in RTC mode)
      this.cameraClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      this.screenClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });

      // 7. Join channels with separate clients
      // Use different UIDs to differentiate webcam vs screen on admin side
      const cameraUid = tokenData.uid; // Original candidate ID for webcam
      const screenUid = `${tokenData.uid}-screen`; // Candidate ID + "-screen" for screen share

      // Get tokens for both clients (same channel, different UIDs)
      const screenTokenResponse = await fetch(LIVE_PROCTORING_ENDPOINTS.agoraToken(), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assessmentId: this.config.assessmentId,
          candidateId: `${this.config.candidateId}-screen`,
          role: "candidate",
        }),
      });

      if (!screenTokenResponse.ok) {
        throw new Error(`Failed to get screen Agora token: ${screenTokenResponse.statusText}`);
      }

      const screenTokenData = await screenTokenResponse.json();
      if (screenTokenData.status !== "ok") {
        throw new Error("Invalid screen token response");
      }

      // Join webcam client
      if (this.webcamStream) {
        this.log("Joining Agora channel (webcam)...");
        await this.cameraClient.join(
          tokenData.appId,
          tokenData.channel,
          tokenData.token,
          cameraUid
        );
        await this.cameraClient.setClientRole("host");
        this.log("✅ Joined Agora channel (webcam)");

        // Publish webcam track
        const cameraVideoTrack = this.webcamStream.getVideoTracks()[0];
        if (cameraVideoTrack) {
          this.cameraTrack = await AgoraRTC.createCustomVideoTrack({
            mediaStreamTrack: cameraVideoTrack,
          });
          await this.cameraClient.publish(this.cameraTrack);
          this.log("✅ Webcam track published");
        }
      }

      // Join screen client
      if (this.screenStream) {
        this.log("Joining Agora channel (screen)...");
        await this.screenClient.join(
          screenTokenData.appId,
          screenTokenData.channel,
          screenTokenData.token,
          screenUid
        );
        await this.screenClient.setClientRole("host");
        this.log("✅ Joined Agora channel (screen)");

        // Publish screen share track
        const screenVideoTrack = this.screenStream.getVideoTracks()[0];
        if (screenVideoTrack) {
          this.screenTrack = await AgoraRTC.createCustomVideoTrack({
            mediaStreamTrack: screenVideoTrack,
          });
          await this.screenClient.publish(this.screenTrack);
          this.log("✅ Screen track published");
        }
      }

      // Mark as streaming
      this.updateState({
        isStreaming: true,
        sessionId: this.sessionId,
        connectionState: "connected",
      });

      this.log("✅ Live Proctoring started (Agora)");
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
      // Unpublish and leave webcam client
      if (this.cameraClient) {
        if (this.cameraTrack) {
          await this.cameraClient.unpublish(this.cameraTrack).catch(() => {});
          // ⚠️ DO NOT close cameraTrack - it wraps a shared MediaStreamTrack used by AI Proctoring
          // Closing it would stop the underlying track and turn off the camera for AI Proctoring
          this.cameraTrack = null;
        }
        await this.cameraClient.leave().catch(() => {});
        this.cameraClient = null;
      }

      // Unpublish and leave screen client
      if (this.screenClient) {
        if (this.screenTrack) {
          await this.screenClient.unpublish(this.screenTrack).catch(() => {});
          this.screenTrack.close();
          this.screenTrack = null;
        }
        await this.screenClient.leave().catch(() => {});
        this.screenClient = null;
      }

      // End session on backend (if sessionId exists)
      if (this.sessionId) {
        try {
          await fetch(LIVE_PROCTORING_ENDPOINTS.endSession(this.sessionId), {
            method: "POST",
            credentials: "include",
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
   * Start screen sharing (if not already started).
   */
  async startScreenShare(): Promise<boolean> {
    if (this.screenTrack) {
      this.log("Screen share already active");
      return true;
    }

    try {
      const AgoraRTC = (await this.getAgora())?.default;
      if (!AgoraRTC || !this.screenClient) {
        throw new Error("Agora screen client not initialized");
      }

      const screenTrack = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: "1080p_1",
      });

      // createScreenVideoTrack can return ILocalVideoTrack or [ILocalVideoTrack, ILocalAudioTrack]
      const videoTrack = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;
      this.screenTrack = videoTrack;
      await this.screenClient.publish(screenTrack);
      this.log("✅ Screen share started");
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to start screen share";
      this.log(`❌ Error starting screen share: ${msg}`);
      return false;
    }
  }

  /**
   * Stop screen sharing.
   */
  async stopScreenShare(): Promise<void> {
    if (this.screenTrack && this.screenClient) {
      try {
        await this.screenClient.unpublish(this.screenTrack);
        this.screenTrack.close();
        this.screenTrack = null;
        this.log("✅ Screen share stopped");
      } catch (error) {
        this.log("Error stopping screen share", error);
      }
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private cleanup(): void {
    // Stop Agora tracks (these are separate from the original MediaStream)
    if (this.cameraTrack) {
      // ⚠️ DO NOT close cameraTrack - it wraps a shared MediaStreamTrack used by AI Proctoring
      // Closing it would stop the underlying track and turn off the camera for AI Proctoring
      // Just clear the reference - unpublishing was already done in stop() if called
      this.cameraTrack = null;
    }
    if (this.screenTrack) {
      this.screenTrack.close();
      this.screenTrack = null;
    }

    // ⚠️ DO NOT stop webcam stream tracks - camera is shared with AI Proctoring
    // The webcam stream is reused from AI Proctoring and must stay active
    // Only clear the reference, don't stop the tracks
    if (this.webcamStream) {
      // Don't stop tracks - camera is shared with AI Proctoring
      this.webcamStream = null;
    }
    
    // Stop screen stream only if it's a separate stream (not shared)
    // Screen sharing is typically separate, so it's safe to stop
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    // Leave Agora channels
    if (this.cameraClient) {
      this.cameraClient.leave().catch(() => {});
      this.cameraClient = null;
    }
    if (this.screenClient) {
      this.screenClient.leave().catch(() => {});
      this.screenClient = null;
    }

    // Reset state
    this.updateState({
      isStreaming: false,
      connectionState: "disconnected",
      sessionId: null,
    });
  }
}
