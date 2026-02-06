// ============================================================================
// Universal Proctoring System - Admin Live Proctoring Service (Agora)
// ============================================================================
//
// This service handles the ADMIN side of live proctoring using Agora RTC:
// - Gets Agora token from backend
// - Joins Agora channel
// - Subscribes to remote user streams (candidates)
// - Maps remote tracks to CandidateStreamInfo
//
// ============================================================================

// Global singleton to prevent React Strict Mode duplicate connections
const GLOBAL_AGORA_CONNECTIONS = new Map<string, {
  client: any;
  adminId: string;
  timestamp: number;
  isActive: boolean;
}>();

// Track pending connections to prevent race conditions
const PENDING_CONNECTIONS = new Map<string, Promise<boolean>>();

// Cleanup old connections every 10 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [channelId, conn] of Array.from(GLOBAL_AGORA_CONNECTIONS.entries())) {
      if (!conn.isActive && now - conn.timestamp > 10000) {
        console.log(`[Admin] 🗑️ Cleaning up stale connection for ${channelId}`);
        GLOBAL_AGORA_CONNECTIONS.delete(channelId);
        PENDING_CONNECTIONS.delete(channelId); // Also clean up pending
      }
    }
  }, 10000);
}

import type {
  IRemoteVideoTrack,
  IAgoraRTCClient,
  UID,
} from "agora-rtc-sdk-ng";

import {
  AdminLiveProctoringConfig,
  AdminLiveState,
  AdminLiveCallbacks,
  CandidateStreamInfo,
  DEFAULT_ADMIN_LIVE_CONFIG,
  INITIAL_ADMIN_LIVE_STATE,
  LIVE_PROCTORING_ENDPOINTS,
  LiveConnectionState,
} from "./types";
import {
  liveLog,
  setLiveDebugMode,
} from "./utils";

type AgoraModule = typeof import("agora-rtc-sdk-ng");

// ============================================================================
// Admin Live Proctoring Service
// ============================================================================

/**
 * Admin Live Proctoring Service (Agora-based).
 *
 * Manages the admin's side of live proctoring using Agora RTC SDK.
 */
export class AdminLiveService {
  private config: AdminLiveProctoringConfig & { debugMode?: boolean };
  private callbacks: AdminLiveCallbacks | null = null;

  // Agora
  private agoraModule: AgoraModule | null = null;
  private client: IAgoraRTCClient | null = null;

  // Stream tracking
  private candidateStreams: Map<string, CandidateStreamInfo> = new Map();
  private remoteTracks: Map<UID, { webcam?: IRemoteVideoTrack; screen?: IRemoteVideoTrack }> = new Map();
  private uidToSessionId: Map<UID, string> = new Map();
  private sessionIdToUid: Map<string, UID> = new Map();

  // Guards
  private isStarting: boolean = false;

  // State
  private state: AdminLiveState = { ...INITIAL_ADMIN_LIVE_STATE };

  constructor(
    config: Pick<AdminLiveProctoringConfig, "assessmentId" | "adminId"> &
      Partial<AdminLiveProctoringConfig> & { debugMode?: boolean }
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
  // Private Helpers
  // ============================================================================

  private log(msg: string, data?: unknown): void {
    liveLog("[AdminLiveService]", msg, data);
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
        this.agoraModule.default.setLogLevel(0); // DEBUG
      }
      return this.agoraModule;
    } catch (error) {
      this.log("Failed to load Agora SDK", error);
      return null;
    }
  }

  private updateState(updates: Partial<AdminLiveState>): void {
    this.state = { ...this.state, ...updates };
    this.callbacks?.onStateChange(updates);
  }

  /**
   * Rebuild candidateStreams from existing client's remoteUsers.
   * Used when reusing a connection to restore candidate state.
   * 
   * Production-level: Handles multiple video tracks per user (webcam + screen).
   */
  private rebuildCandidateStreamsFromRemoteUsers(): void {
    if (!this.client) {
      return;
    }

    this.log("🔄 Rebuilding candidate streams from existing remote users...");

    // Clear existing mappings
    this.remoteTracks.clear();
    this.candidateStreams.clear();
    this.uidToSessionId.clear();
    this.sessionIdToUid.clear();

    // Group remoteUsers by UID (in case same user has multiple tracks)
    const usersByUid = new Map<UID, typeof this.client.remoteUsers>();
    for (const remoteUser of this.client.remoteUsers) {
      const uid = remoteUser.uid;
      if (!usersByUid.has(uid)) {
        usersByUid.set(uid, []);
      }
      usersByUid.get(uid)!.push(remoteUser);
    }

    // Rebuild from grouped remoteUsers
    // Group by candidateId (strip -screen suffix) to combine webcam and screen tracks
    const tracksByCandidate = new Map<string, { webcam?: IRemoteVideoTrack; screen?: IRemoteVideoTrack }>();

    for (const [uid, remoteUsers] of Array.from(usersByUid.entries())) {
      const uidString = uid.toString();
      const isScreenTrack = uidString.endsWith("-screen");
      const candidateId = isScreenTrack ? uidString.replace(/-screen$/, "") : uidString;

      // Get or create tracks for this candidate
      let existing = tracksByCandidate.get(candidateId);
      if (!existing) {
        existing = {};
        tracksByCandidate.set(candidateId, existing);
      }

      // Process all video tracks for this user
      for (const remoteUser of remoteUsers) {
        const videoTrack = remoteUser.videoTrack as IRemoteVideoTrack | undefined;
        if (!videoTrack) {
          continue;
        }

        this.log(`Rebuilt: Track from user ${uid}: ${isScreenTrack ? "SCREEN" : "WEBCAM"} (candidateId: ${candidateId})`);

        // Store track in correct slot
        if (isScreenTrack) {
          if (existing.screen === videoTrack) {
            this.log(`Rebuilt: Candidate ${candidateId} screen track already stored, skipping duplicate`);
            continue;
          }
          if (existing.screen) {
            existing.screen.stop();
          }
          existing.screen = videoTrack;
          this.log(`Rebuilt: Candidate ${candidateId} screen track`);
        } else {
          if (existing.webcam === videoTrack) {
            this.log(`Rebuilt: Candidate ${candidateId} webcam track already stored, skipping duplicate`);
            continue;
          }
          if (existing.webcam) {
            existing.webcam.stop();
          }
          existing.webcam = videoTrack;
          this.log(`Rebuilt: Candidate ${candidateId} webcam track`);
        }
      }

      // Map UIDs to candidateId
      this.uidToSessionId.set(uid, candidateId);
      this.sessionIdToUid.set(candidateId, uid);
    }

    // Store tracks by candidateId and create stream info
    for (const [candidateId, existing] of Array.from(tracksByCandidate.entries())) {
      if (existing.webcam || existing.screen) {
        this.remoteTracks.set(candidateId as UID, existing);

        // Use candidateId as sessionId
        const sessionId = candidateId;

        // Create CandidateStreamInfo
        const streamInfo = this.toCandidateStreamInfo(
          sessionId,
          candidateId,
          existing.webcam || null,
          existing.screen || null
        );

        this.candidateStreams.set(sessionId, streamInfo);
      }
    }

    this.log(`✅ Rebuilt ${this.candidateStreams.size} candidate stream(s) from ${usersByUid.size} remote user(s)`);
  }

  private toCandidateStreamInfo(
    sessionId: string,
    candidateId: string,
    webcamTrack: IRemoteVideoTrack | null,
    screenTrack: IRemoteVideoTrack | null,
    candidateName?: string,
    candidateEmail?: string
  ): CandidateStreamInfo {
    const webcamStream = webcamTrack ? new MediaStream([webcamTrack.getMediaStreamTrack()]) : null;
    const screenStream = screenTrack ? new MediaStream([screenTrack.getMediaStreamTrack()]) : null;

    return {
      sessionId,
      candidateId,
      candidateName,
      candidateEmail,
      status: webcamStream || screenStream ? "connected" : "disconnected",
      webcamStream,
      screenStream,
      error: null,
    };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Start monitoring active candidates.
   *
   * @param callbacks - Callbacks for state changes and events
   */
  async startMonitoring(callbacks: AdminLiveCallbacks): Promise<{ success: boolean; connectionReused: boolean }> {
    if (this.isStarting) {
      this.log("Already starting monitoring");
      return { success: false, connectionReused: false };
    }

    if (this.state.isMonitoring) {
      this.log("Already monitoring");
      return { success: true, connectionReused: false };
    }

    // CRITICAL: Cleanup any existing client before starting
    if (this.client) {
      this.log("Cleaning up existing client before starting...");
      try {
        await this.client.leave().catch(() => {});
        this.client = null;
      } catch (e) {
        this.log("Error cleaning up existing client", e);
      }
    }

    this.isStarting = true;
    this.callbacks = callbacks;
    this.updateState({ isLoading: true });

    try {
      this.log("✅ Starting admin monitoring (Agora)...");

      // 1. Get Agora token FIRST (before any SDK loading or client creation)
      this.log("Requesting Agora token...");
      const tokenResponse = await fetch(LIVE_PROCTORING_ENDPOINTS.agoraToken(), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assessmentId: this.config.assessmentId,
          adminId: this.config.adminId,
          role: "admin",
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

      // 2. ✅ CHECK FOR EXISTING OR PENDING CONNECTION
      const existingConnection = GLOBAL_AGORA_CONNECTIONS.get(this.config.assessmentId);
      if (existingConnection?.adminId === this.config.adminId && existingConnection?.isActive) {
        const age = Date.now() - existingConnection.timestamp;
        this.log(`⚠️ Connection already exists (age: ${age}ms), reusing...`);
        
        this.client = existingConnection.client;
        this.setupClientCallbacks();
        
        // 🔥 PRODUCTION FIX: Rebuild candidateStreams from existing client's remoteUsers
        this.rebuildCandidateStreamsFromRemoteUsers();
        
        this.updateState({
          candidateStreams: new Map(this.candidateStreams),
          activeSessions: Array.from(this.candidateStreams.keys()),
          isMonitoring: true,
          isLoading: false,
        });
        
        this.log("✅ Reusing existing Agora connection with restored candidate streams");
        return { success: true, connectionReused: true };
      }

      // 3. Check if another mount is already creating a connection
      const pendingConnection = PENDING_CONNECTIONS.get(this.config.assessmentId);
      if (pendingConnection) {
        this.log("⏳ Another connection is being created, waiting...");
        
        // Wait for the pending connection to complete
        await pendingConnection;
        
        // After waiting, check if connection now exists
        const nowExisting = GLOBAL_AGORA_CONNECTIONS.get(this.config.assessmentId);
        if (nowExisting?.isActive) {
          this.log("✅ Pending connection completed, reusing...");
          this.client = nowExisting.client;
          this.setupClientCallbacks();
          
          // 🔥 PRODUCTION FIX: Rebuild candidateStreams from existing client's remoteUsers
          this.rebuildCandidateStreamsFromRemoteUsers();
          
          this.updateState({
            candidateStreams: new Map(this.candidateStreams),
            activeSessions: Array.from(this.candidateStreams.keys()),
            isMonitoring: true,
            isLoading: false,
          });
          
          return { success: true, connectionReused: true };
        }
      }

      // 4. Mark this connection as pending
      const connectionPromise = (async () => {
        try {
          this.log("🆕 Creating new Agora connection...");
          const AgoraRTC = (await this.getAgora())?.default;
          if (!AgoraRTC) {
            throw new Error("Failed to load Agora SDK");
          }

          this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
          this.setupClientCallbacks();

          this.log("Joining Agora channel...");
          await this.client.join(
            tokenData.appId,
            tokenData.channel,
            tokenData.token,
            tokenData.uid
          );
          this.log("✅ Joined Agora channel");

          // Store as global active connection
          GLOBAL_AGORA_CONNECTIONS.set(this.config.assessmentId, {
            client: this.client,
            adminId: this.config.adminId,
            timestamp: Date.now(),
            isActive: true,
          });
          this.log("✅ Stored as global connection");

          return true;
        } finally {
          // Remove from pending when done
          PENDING_CONNECTIONS.delete(this.config.assessmentId);
        }
      })();

      // Store the promise so other mounts can wait
      PENDING_CONNECTIONS.set(this.config.assessmentId, connectionPromise);

      // Wait for our connection to complete
      await connectionPromise;

      this.updateState({ isMonitoring: true, isLoading: false });
      this.log("✅ Admin monitoring started (Agora)");

      return { success: true, connectionReused: false };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to start monitoring";
      this.log(`❌ Error: ${msg}`);
      this.updateState({ isLoading: false });
      this.callbacks?.onError?.(msg);
      return { success: false, connectionReused: false };
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stop monitoring.
   */
  async stopMonitoring(): Promise<void> {
    this.log("✅ Stopping admin monitoring...");

    // Cleanup remote tracks
    this.remoteTracks.forEach((tracks) => {
      tracks.webcam?.stop();
      tracks.screen?.stop();
    });
    this.remoteTracks.clear();

    // Leave Agora channel and cleanup client
    if (this.client) {
      try {
        // Remove all event listeners before leaving
        this.client.removeAllListeners();
        await this.client.leave();
        
        // Mark connection as inactive (will be cleaned up by interval)
        const conn = GLOBAL_AGORA_CONNECTIONS.get(this.config.assessmentId);
        if (conn) {
          conn.isActive = false;
          conn.timestamp = Date.now();
          this.log("🔒 Marked connection as inactive");
        }
      } catch (error) {
        this.log("Error leaving channel", error);
      }
      this.client = null;
    }

    // Clear mappings
    this.uidToSessionId.clear();
    this.sessionIdToUid.clear();
    this.candidateStreams.clear();

    // Reset state flags
    this.isStarting = false;
    this.updateState({
      isMonitoring: false,
      candidateStreams: new Map(),
      activeSessions: [],
    });

    this.log("✅ Admin monitoring stopped");
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
   * Refresh candidate connection (no-op for Agora, kept for compatibility).
   */
  async refreshCandidate(sessionId: string): Promise<void> {
    this.log(`Refresh candidate ${sessionId} (no-op for Agora)`);
    // Agora handles reconnection automatically
  }

  // ============================================================================
  // Private Helpers - Client Callbacks Setup
  // ============================================================================

  private setupClientCallbacks(): void {
    if (!this.client) return;
    
    // Remove existing listeners to prevent duplicates
    this.client.removeAllListeners();
    
    this.client.on("user-published", async (user, mediaType) => {
      if (mediaType === "video" || mediaType === "audio") {
        await this.handleUserPublished(user.uid, mediaType);
      }
    });

    this.client.on("user-unpublished", async (user, mediaType) => {
      if (mediaType === "video" || mediaType === "audio") {
        await this.handleUserUnpublished(user.uid, mediaType);
      }
    });

    this.client.on("user-left", async (user) => {
      await this.handleUserLeft(user.uid);
    });

    this.client.on("connection-state-change", (curState: string, prevState: string) => {
      this.log(`Connection state changed: ${prevState} -> ${curState}`);
      if (curState === "DISCONNECTED" || curState === "FAILED") {
        this.callbacks?.onError?.(`Connection ${curState.toLowerCase()}`);
      }
    });
  }

  // ============================================================================
  // Private Event Handlers
  // ============================================================================

  private async handleUserPublished(uid: UID, mediaType: "video" | "audio"): Promise<void> {
    if (!this.client || mediaType !== "video") {
      return;
    }

    try {
      this.log(`User ${uid} published video`);

      // Subscribe to remote video track
      await this.client.subscribe(uid, mediaType);
      const remoteUser = this.client.remoteUsers.find((u) => u.uid === uid);
      if (!remoteUser || !remoteUser.videoTrack) {
        return;
      }

      const videoTrack = remoteUser.videoTrack as IRemoteVideoTrack;

      // Identify track type: UID ending with "-screen" is screen share, otherwise webcam
      const uidString = uid.toString();
      const isScreenTrack = uidString.endsWith("-screen");
      const candidateId = isScreenTrack ? uidString.replace(/-screen$/, "") : uidString;

      this.log(`Track from user ${uid}: ${isScreenTrack ? "SCREEN" : "WEBCAM"} (candidateId: ${candidateId})`);

      // Get or create tracks for this candidate (group by candidateId, not UID)
      const existing = this.remoteTracks.get(candidateId as UID) || {};

      // Store track in correct slot (prevent duplicate processing)
      if (isScreenTrack) {
        // If screen track already exists and it's the same track, skip
        if (existing.screen === videoTrack) {
          this.log(`Candidate ${candidateId} screen track already stored, skipping duplicate`);
          return;
        }
        // If screen track already exists, replace it (newer track takes precedence)
        if (existing.screen) {
          existing.screen.stop();
        }
        existing.screen = videoTrack;
        this.log(`Candidate ${candidateId} screen track received and stored`);
      } else {
        // If webcam track already exists and it's the same track, skip
        if (existing.webcam === videoTrack) {
          this.log(`Candidate ${candidateId} webcam track already stored, skipping duplicate`);
          return;
        }
        // If webcam track already exists, replace it (newer track takes precedence)
        if (existing.webcam) {
          existing.webcam.stop();
        }
        existing.webcam = videoTrack;
        this.log(`Candidate ${candidateId} webcam track received and stored`);
      }

      // Store tracks by candidateId (not UID) so webcam and screen are grouped together
      this.remoteTracks.set(candidateId as UID, existing);

      // Map UIDs to candidateId
      this.uidToSessionId.set(uid, candidateId);
      this.sessionIdToUid.set(candidateId, uid);

      // Use candidateId as sessionId
      const sessionId = candidateId;

      // Create or update CandidateStreamInfo
      const streamInfo = this.toCandidateStreamInfo(
        sessionId,
        candidateId,
        existing.webcam || null,
        existing.screen || null
      );

      this.candidateStreams.set(sessionId, streamInfo);
      this.updateState({
        candidateStreams: new Map(this.candidateStreams),
        activeSessions: Array.from(this.candidateStreams.keys()),
      });

      this.callbacks?.onCandidateConnected?.(sessionId, candidateId);
    } catch (error) {
      this.log(`Error handling user published ${uid}:`, error);
    }
  }

  private async handleUserUnpublished(uid: UID, mediaType: "video" | "audio"): Promise<void> {
    if (mediaType !== "video") {
      return;
    }

    this.log(`User ${uid} unpublished video`);

    // Identify track type by UID
    const uidString = uid.toString();
    const isScreenTrack = uidString.endsWith("-screen");
    const candidateId = isScreenTrack ? uidString.replace(/-screen$/, "") : uidString;

    const existing = this.remoteTracks.get(candidateId as UID);
    if (existing) {
      // Remove the appropriate track based on UID
      if (isScreenTrack && existing.screen) {
        existing.screen.stop();
        existing.screen = undefined;
        this.log(`Candidate ${candidateId} screen track unpublished`);
      } else if (!isScreenTrack && existing.webcam) {
        existing.webcam.stop();
        existing.webcam = undefined;
        this.log(`Candidate ${candidateId} webcam track unpublished`);
      }

      if (!existing.webcam && !existing.screen) {
        this.remoteTracks.delete(candidateId as UID);
      } else {
        this.remoteTracks.set(candidateId as UID, existing);
      }

      // Update CandidateStreamInfo
      const sessionId = candidateId;
      const streamInfo = this.toCandidateStreamInfo(
        sessionId,
        candidateId,
        existing.webcam || null,
        existing.screen || null
      );

      this.candidateStreams.set(sessionId, streamInfo);
      this.updateState({
        candidateStreams: new Map(this.candidateStreams),
      });
    }
  }

  private async handleUserLeft(uid: UID): Promise<void> {
    this.log(`User ${uid} left`);

    // Identify candidateId from UID
    const uidString = uid.toString();
    const isScreenTrack = uidString.endsWith("-screen");
    const candidateId = isScreenTrack ? uidString.replace(/-screen$/, "") : uidString;

    const existing = this.remoteTracks.get(candidateId as UID);
    if (existing) {
      // Remove the appropriate track based on UID
      if (isScreenTrack && existing.screen) {
        existing.screen.stop();
        existing.screen = undefined;
        this.log(`Candidate ${candidateId} screen track left`);
      } else if (!isScreenTrack && existing.webcam) {
        existing.webcam.stop();
        existing.webcam = undefined;
        this.log(`Candidate ${candidateId} webcam track left`);
      }

      // Only delete candidate if both tracks are gone
      if (!existing.webcam && !existing.screen) {
        this.remoteTracks.delete(candidateId as UID);
        const sessionId = candidateId;
        this.candidateStreams.delete(sessionId);
        this.uidToSessionId.delete(uid);
        this.sessionIdToUid.delete(sessionId);

        this.updateState({
          candidateStreams: new Map(this.candidateStreams),
          activeSessions: Array.from(this.candidateStreams.keys()),
        });

        this.callbacks?.onCandidateDisconnected?.(sessionId);
      } else {
        // Update state with remaining track
        this.remoteTracks.set(candidateId as UID, existing);
        const sessionId = candidateId;
        const streamInfo = this.toCandidateStreamInfo(
          sessionId,
          candidateId,
          existing.webcam || null,
          existing.screen || null
        );
        this.candidateStreams.set(sessionId, streamInfo);
        this.updateState({
          candidateStreams: new Map(this.candidateStreams),
          activeSessions: Array.from(this.candidateStreams.keys()),
        });
      }
    }

    // Clean up UID mappings
    this.uidToSessionId.delete(uid);
  }
}
