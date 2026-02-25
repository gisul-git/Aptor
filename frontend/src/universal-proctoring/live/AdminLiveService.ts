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

// Global map to store candidate info (name/email) by candidateId
// Populated when candidates request tokens, used by admin to display names
const CANDIDATE_INFO_MAP = new Map<string, {
  candidateName?: string;
  candidateEmail?: string;
  timestamp: number;
}>();

// Initialize global map on window if not exists (for CandidateLiveService to access)
if (typeof window !== 'undefined') {
  (window as any).__CANDIDATE_INFO_MAP = CANDIDATE_INFO_MAP;
  
  // Sync from window if CandidateLiveService already populated it
  const syncFromWindow = () => {
    const windowMap = (window as any).__CANDIDATE_INFO_MAP;
    if (windowMap && windowMap instanceof Map) {
      for (const [key, value] of Array.from(windowMap.entries())) {
        if (!CANDIDATE_INFO_MAP.has(key)) {
          CANDIDATE_INFO_MAP.set(key, value as any);
        }
      }
    }
  };
  
  // Sync periodically
  setInterval(syncFromWindow, 1000);
  
  // Cleanup old candidate info every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [candidateId, info] of Array.from(CANDIDATE_INFO_MAP.entries())) {
      if (now - info.timestamp > 300000) { // 5 minutes
        CANDIDATE_INFO_MAP.delete(candidateId);
        if ((window as any).__CANDIDATE_INFO_MAP) {
          (window as any).__CANDIDATE_INFO_MAP.delete(candidateId);
        }
      }
    }
  }, 60000); // Check every minute
}

// Cleanup old connections every 30 seconds
// PRODUCTION FIX: Increased timeout from 10s to 60s to prevent premature cleanup
// during React Strict Mode double mounting in development
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [channelId, conn] of Array.from(GLOBAL_AGORA_CONNECTIONS.entries())) {
      // Only cleanup connections that are inactive AND older than 60 seconds
      // This gives enough time for React Strict Mode remounts to reuse the connection
      if (!conn.isActive && now - conn.timestamp > 60000) {
        // Only log in development to reduce console noise in production
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Admin] 🗑️ Cleaning up stale connection for ${channelId}`);
        }
        GLOBAL_AGORA_CONNECTIONS.delete(channelId);
        PENDING_CONNECTIONS.delete(channelId); // Also clean up pending
      }
    }
  }, 30000); // Check every 30 seconds instead of 10
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
  private ownsConnection: boolean = false; // Track if this instance owns the connection

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
   * Also subscribes to remote users that aren't subscribed yet.
   * 
   * PRODUCTION FIX: Validates connection state and remote user validity before subscribing.
   */
  private async rebuildCandidateStreamsFromRemoteUsers(): Promise<void> {
    if (!this.client) {
      return;
    }

    this.log("🔄 Rebuilding candidate streams from existing remote users...");

    // PRODUCTION FIX: Check connection state before proceeding
    // Agora client connection states: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING" | "DISCONNECTING" | "FAILED"
    try {
      // Get current connection state (Agora SDK tracks this internally)
      // We can't directly query it, but we can check if client is in a valid state
      // by checking if remoteUsers array is accessible and client hasn't been destroyed
      
      // Validate client is still active and not in a disconnected state
      // If client was destroyed or connection is broken, remoteUsers might be stale
      if (!this.client.remoteUsers) {
        this.log("⚠️ Cannot access remoteUsers - client may be disconnected");
        // Clear mappings and return early (connection is broken)
        this.remoteTracks.clear();
        this.candidateStreams.clear();
        this.uidToSessionId.clear();
        this.sessionIdToUid.clear();
        return;
      }
      
      // PRODUCTION FIX: Having no remote users is NORMAL when no candidates have joined yet
      // Don't return early - just log and continue (monitoring should stay active)
      if (this.client.remoteUsers.length === 0) {
        this.log("ℹ️ No remote users found (no candidates have joined yet - this is normal)");
        // Clear mappings but continue - monitoring should stay active to wait for candidates
        this.remoteTracks.clear();
        this.candidateStreams.clear();
        this.uidToSessionId.clear();
        this.sessionIdToUid.clear();
        // Don't return - continue to end of function to allow monitoring to stay active
      }
    } catch (error) {
      // If we can't access remoteUsers, client is likely disconnected
      this.log("⚠️ Cannot access remoteUsers - client may be disconnected:", error);
      this.remoteTracks.clear();
      this.candidateStreams.clear();
      this.uidToSessionId.clear();
      this.sessionIdToUid.clear();
      return; // Return early only if we can't access remoteUsers (connection broken)
    }

    // Clear existing mappings
    this.remoteTracks.clear();
    this.candidateStreams.clear();
    this.uidToSessionId.clear();
    this.sessionIdToUid.clear();

    // PRODUCTION FIX: Filter and validate remote users before subscribing
    // Only attempt subscription for users that:
    // 1. Have video available (hasVideo = true)
    // 2. Don't already have a videoTrack (not subscribed yet)
    // 3. Are still in the channel (we'll validate this during subscription)
    const usersToSubscribe: UID[] = [];
    const validRemoteUsers: typeof this.client.remoteUsers = [];
    
    for (const remoteUser of this.client.remoteUsers) {
      // Validate remote user object is still valid
      if (!remoteUser || typeof remoteUser.uid === 'undefined') {
        this.log(`⚠️ Skipping invalid remote user`);
        continue;
      }
      
      // Track valid users for later processing
      validRemoteUsers.push(remoteUser);
      
      // Check if user has video but no videoTrack (needs subscription)
      if (remoteUser.hasVideo && !remoteUser.videoTrack) {
        usersToSubscribe.push(remoteUser.uid);
      }
    }

    // PRODUCTION FIX: Subscribe to users with proper error handling and state validation
    // Only subscribe if we have valid users and client is still active
    if (usersToSubscribe.length > 0) {
      this.log(`📡 Attempting to subscribe to ${usersToSubscribe.length} remote user(s)...`);
      
      for (const uid of usersToSubscribe) {
        try {
          // PRODUCTION FIX: Validate client is still valid before each subscription
          if (!this.client) {
            this.log("⚠️ Client destroyed during rebuild, stopping subscription attempts");
            break;
          }
          
          // PRODUCTION FIX: Check if remote user still exists in remoteUsers array
          // If user left the channel, they won't be in remoteUsers anymore
          const userStillExists = this.client.remoteUsers.some(u => u.uid === uid);
          if (!userStillExists) {
            this.log(`⚠️ User ${uid} no longer in channel, skipping subscription`);
            continue;
          }
          
          this.log(`Subscribing to remote user ${uid} during rebuild...`);
          
          // PRODUCTION FIX: Use try-catch with specific error handling
          // This will catch:
          // - INVALID_OPERATION: peerConnection disconnected
          // - INVALID_REMOTE_USER: user not in channel
          await this.client.subscribe(uid, "video");
          this.log(`✅ Subscribed to remote user ${uid}`);
        } catch (error: any) {
          // PRODUCTION FIX: Handle specific Agora errors gracefully
          const errorMessage = error?.message || String(error);
          const errorCode = error?.code;
          
          // These errors are expected when connection is unstable or user left
          if (errorMessage.includes("peerConnection disconnected") || 
              errorMessage.includes("INVALID_OPERATION")) {
            this.log(`⚠️ Cannot subscribe to ${uid}: peerConnection disconnected (connection may be unstable)`);
            // Don't continue subscribing if connection is broken
            break;
          } else if (errorMessage.includes("not in the channel") || 
                     errorMessage.includes("INVALID_REMOTE_USER")) {
            this.log(`⚠️ User ${uid} is not in the channel anymore, skipping`);
            // Continue with other users
            continue;
          } else {
            this.log(`⚠️ Failed to subscribe to ${uid} during rebuild:`, errorMessage);
            // For other errors, continue with remaining users
            continue;
          }
        }
      }
    } else {
      this.log("ℹ️ No users need subscription (all already subscribed or no video available)");
    }

    // PRODUCTION FIX: Use validated remote users list (filtered above)
    // Group remoteUsers by UID (in case same user has multiple tracks)
    const usersByUid = new Map<UID, typeof this.client.remoteUsers>();
    
    // Re-validate remoteUsers before grouping (they might have changed during subscription)
    if (!this.client || !this.client.remoteUsers) {
      this.log("⚠️ Client or remoteUsers no longer available after subscription");
      return;
    }
    
    for (const remoteUser of this.client.remoteUsers) {
      // PRODUCTION FIX: Validate each remote user before processing
      if (!remoteUser || typeof remoteUser.uid === 'undefined') {
        continue;
      }
      
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
          // If user has video but no track, try subscribing (might have failed above)
          if (remoteUser.hasVideo) {
            this.log(`⚠️ User ${uid} has video but no track, subscription may have failed`);
          }
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

        // Look up candidate info - try multiple sources
        let candidateName: string | undefined;
        let candidateEmail: string | undefined;
        
        // 1. Check window map (same tab only)
        if (typeof window !== 'undefined') {
          const windowMap = (window as any).__CANDIDATE_INFO_MAP;
          if (windowMap && windowMap instanceof Map) {
            const windowInfo = windowMap.get(candidateId);
            if (windowInfo) {
              candidateName = windowInfo.candidateName;
              candidateEmail = windowInfo.candidateEmail;
            }
          }
        }
        
        // 2. Check local map
        const localInfo = CANDIDATE_INFO_MAP.get(candidateId);
        if (localInfo) {
          candidateName = candidateName || localInfo.candidateName;
          candidateEmail = candidateEmail || localInfo.candidateEmail;
        }
        
        // 3. Fetch from backend if not found (works across tabs/windows)
        if (!candidateName && !candidateEmail) {
          try {
            const tokenResponse = await fetch(LIVE_PROCTORING_ENDPOINTS.agoraToken(), {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                assessmentId: this.config.assessmentId,
                candidateId: candidateId,
                role: "candidate",
              }),
            });
            
            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              if (tokenData.candidateName || tokenData.candidateEmail) {
                candidateName = tokenData.candidateName;
                candidateEmail = tokenData.candidateEmail;
                
                // Store in maps for future use
                CANDIDATE_INFO_MAP.set(candidateId, {
                  candidateName,
                  candidateEmail,
                  timestamp: Date.now(),
                });
                if (typeof window !== 'undefined') {
                  const windowMap = (window as any).__CANDIDATE_INFO_MAP || new Map();
                  windowMap.set(candidateId, { candidateName, candidateEmail, timestamp: Date.now() });
                  (window as any).__CANDIDATE_INFO_MAP = windowMap;
                }
                
                this.log(`✅ Fetched candidate info from backend: ${candidateName || candidateEmail || 'none'}`);
              }
            }
          } catch (error) {
            // Silently fail - fallback to existing lookup
          }
        }

        // Create CandidateStreamInfo
        const streamInfo = this.toCandidateStreamInfo(
      sessionId,
      candidateId,
          existing.webcam || null,
          existing.screen || null,
          candidateName,
          candidateEmail
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
      if (existingConnection?.adminId === this.config.adminId) {
        const age = Date.now() - existingConnection.timestamp;
        const isRecent = age < 60000; // Connection is recent if less than 60 seconds old
        
        // PRODUCTION FIX: Validate connection before reuse
        // Check if client exists and is still connected
        const isClientValid = existingConnection.client && 
          existingConnection.client.connectionState !== 'DISCONNECTED' &&
          existingConnection.client.connectionState !== 'FAILED';
        
        // Only reuse if connection is active AND client is valid
        // OR if connection is recently inactive but client is still valid (React Strict Mode case)
        if (isClientValid && (existingConnection.isActive || (isRecent && !existingConnection.isActive))) {
          if (!existingConnection.isActive) {
            // Reactivate the connection if it was recently inactive
            existingConnection.isActive = true;
            existingConnection.timestamp = Date.now();
            this.log(`🔄 Reactivating recently inactive connection (age: ${age}ms)`);
          } else {
            this.log(`⚠️ Connection already exists (age: ${age}ms), reusing...`);
          }
          
          this.client = existingConnection.client;
          this.setupClientCallbacks();
          this.ownsConnection = existingConnection.isActive; // Own if we reactivated it
          
          // 🔥 PRODUCTION FIX: Rebuild candidateStreams from existing client's remoteUsers
          await this.rebuildCandidateStreamsFromRemoteUsers();
          
          this.updateState({
            candidateStreams: new Map(this.candidateStreams),
            activeSessions: Array.from(this.candidateStreams.keys()),
            isMonitoring: true,
            isLoading: false,
          });
          
          this.log("✅ Reusing existing Agora connection with restored candidate streams");
          return { success: true, connectionReused: true };
        } else if (!isClientValid) {
          // Client is dead, remove from map and create new connection
          this.log("⚠️ Existing connection has dead client, removing and creating new...");
          GLOBAL_AGORA_CONNECTIONS.delete(this.config.assessmentId);
          // Fall through to create new connection
        }
      }

      // 3. Check if another mount is already creating a connection
      const pendingConnection = PENDING_CONNECTIONS.get(this.config.assessmentId);
      if (pendingConnection) {
        this.log("⏳ Another connection is being created, waiting...");
        
        // Wait for the pending connection to complete
        await pendingConnection;
        
        // After waiting, check if connection now exists
        const nowExisting = GLOBAL_AGORA_CONNECTIONS.get(this.config.assessmentId);
        if (nowExisting) {
          const age = Date.now() - nowExisting.timestamp;
          const isRecent = age < 60000;
          
          // PRODUCTION FIX: Validate connection before reuse
          const isClientValid = nowExisting.client && 
            nowExisting.client.connectionState !== 'DISCONNECTED' &&
            nowExisting.client.connectionState !== 'FAILED';
          
          // Only reuse if client is valid AND (active OR recently inactive)
          if (isClientValid && (nowExisting.isActive || (isRecent && !nowExisting.isActive))) {
            if (!nowExisting.isActive) {
              // Reactivate the connection
              nowExisting.isActive = true;
              nowExisting.timestamp = Date.now();
              this.log("🔄 Reactivating recently inactive connection from pending");
            } else {
              this.log("✅ Pending connection completed, reusing...");
            }
            
            this.client = nowExisting.client;
            this.setupClientCallbacks();
            this.ownsConnection = nowExisting.isActive;
            
            // 🔥 PRODUCTION FIX: Rebuild candidateStreams from existing client's remoteUsers
            await this.rebuildCandidateStreamsFromRemoteUsers();
            
            this.updateState({
              candidateStreams: new Map(this.candidateStreams),
              activeSessions: Array.from(this.candidateStreams.keys()),
              isMonitoring: true,
              isLoading: false,
            });
            
            return { success: true, connectionReused: true };
          } else if (!isClientValid) {
            // Client is dead, remove from map and create new connection
            this.log("⚠️ Pending connection has dead client, removing and creating new...");
            GLOBAL_AGORA_CONNECTIONS.delete(this.config.assessmentId);
            // Fall through to create new connection
          }
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

          this.client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
          this.setupClientCallbacks();

          this.log("Joining Agora channel...");
          await this.client.join(
            tokenData.appId,
            tokenData.channel,
            tokenData.token,
            tokenData.uid
          );
          await this.client.setClientRole("audience");
          this.log("✅ Joined Agora channel");

          // Store as global active connection
          GLOBAL_AGORA_CONNECTIONS.set(this.config.assessmentId, {
            client: this.client,
            adminId: this.config.adminId,
            timestamp: Date.now(),
            isActive: true,
          });
          this.ownsConnection = true; // We own this connection
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
   * Only disconnects if this instance owns the connection.
   */
  async stopMonitoring(): Promise<void> {
    this.log(`✅ Stopping admin monitoring... (ownsConnection: ${this.ownsConnection})`);

    // Cleanup remote tracks (always do this, even if reusing)
    this.remoteTracks.forEach((tracks) => {
      tracks.webcam?.stop();
      tracks.screen?.stop();
    });
    this.remoteTracks.clear();

    // Only leave channel if we own the connection
    // If we're reusing a connection, don't disconnect it (other instances might be using it)
    if (this.client && this.ownsConnection) {
      try {
        // PRODUCTION FIX: Check if already disconnected to prevent double leave
        const connectionState = this.client.connectionState;
        if (connectionState === 'DISCONNECTED' || connectionState === 'DISCONNECTING') {
          this.log("⚠️ Connection already disconnected, skipping leave()");
        } else {
          // Remove all event listeners before leaving
          this.client.removeAllListeners();
          await this.client.leave();
        }
        
        // PRODUCTION FIX: Remove connection from map immediately when we own it
        // This prevents other instances from trying to reuse a dead connection
        const conn = GLOBAL_AGORA_CONNECTIONS.get(this.config.assessmentId);
        if (conn && conn.adminId === this.config.adminId) {
          // Only remove if we're the owner
          GLOBAL_AGORA_CONNECTIONS.delete(this.config.assessmentId);
          this.log("🗑️ Removed connection from global map (owned by this instance)");
        }
      } catch (error) {
        this.log("Error leaving channel", error);
        // Still remove from map even if leave() failed
        const conn = GLOBAL_AGORA_CONNECTIONS.get(this.config.assessmentId);
        if (conn && conn.adminId === this.config.adminId) {
          GLOBAL_AGORA_CONNECTIONS.delete(this.config.assessmentId);
        }
      }
      this.client = null;
      this.ownsConnection = false;
    } else if (this.client && !this.ownsConnection) {
      // Just remove our callbacks, don't disconnect shared connection
      this.client.removeAllListeners();
      this.client = null;
      this.log("🔗 Removed callbacks from shared connection (not disconnecting)");
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

      // Look up candidate info - try multiple sources
      let candidateName: string | undefined;
      let candidateEmail: string | undefined;
      
      this.log(`🔍 [DEBUG] Looking up candidate info for candidateId: ${candidateId}`);
      
      // 1. Check window map (same tab only)
      if (typeof window !== 'undefined') {
        const windowMap = (window as any).__CANDIDATE_INFO_MAP;
        if (windowMap && windowMap instanceof Map) {
          const windowInfo = windowMap.get(candidateId);
          if (windowInfo) {
            candidateName = windowInfo.candidateName;
            candidateEmail = windowInfo.candidateEmail;
            this.log(`✅ Found candidate info from window map: ${candidateName || candidateEmail || 'none'}`);
          }
        }
      }
      
      // 2. Check local map
      const localInfo = CANDIDATE_INFO_MAP.get(candidateId);
      if (localInfo) {
        candidateName = candidateName || localInfo.candidateName;
        candidateEmail = candidateEmail || localInfo.candidateEmail;
        if (candidateName || candidateEmail) {
          this.log(`✅ Found candidate info from local map: ${candidateName || candidateEmail || 'none'}`);
        }
      }
      
      // 3. Fetch from backend if not found (works across tabs/windows)
      if (!candidateName && !candidateEmail) {
        try {
          this.log(`🔍 [DEBUG] Fetching candidate info from backend for candidateId: ${candidateId}`);
          const tokenResponse = await fetch(LIVE_PROCTORING_ENDPOINTS.agoraToken(), {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assessmentId: this.config.assessmentId,
              candidateId: candidateId,
              role: "candidate",
            }),
          });
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            if (tokenData.candidateName || tokenData.candidateEmail) {
              candidateName = tokenData.candidateName;
              candidateEmail = tokenData.candidateEmail;
              
              // Store in maps for future use
              CANDIDATE_INFO_MAP.set(candidateId, {
                candidateName,
                candidateEmail,
                timestamp: Date.now(),
              });
              if (typeof window !== 'undefined') {
                const windowMap = (window as any).__CANDIDATE_INFO_MAP || new Map();
                windowMap.set(candidateId, { candidateName, candidateEmail, timestamp: Date.now() });
                (window as any).__CANDIDATE_INFO_MAP = windowMap;
              }
              
              this.log(`✅ Fetched candidate info from backend: ${candidateName || candidateEmail || 'none'}`);
            } else {
              this.log(`⚠️ Backend token response has no candidate info for candidateId: ${candidateId}`);
            }
          } else {
            this.log(`⚠️ Failed to fetch candidate info from backend: ${tokenResponse.statusText}`);
          }
        } catch (error) {
          this.log(`⚠️ Error fetching candidate info from backend: ${error}`);
        }
      }
      
      if (!candidateName && !candidateEmail) {
        this.log(`⚠️ No candidate info found for candidateId: ${candidateId}`);
      } else {
        this.log(`✅ Final candidate info: name=${candidateName || 'none'}, email=${candidateEmail || 'none'}`);
      }

      // Create or update CandidateStreamInfo
      const streamInfo = this.toCandidateStreamInfo(
      sessionId,
      candidateId,
        existing.webcam || null,
        existing.screen || null,
        candidateName,
        candidateEmail
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

  /**
   * Flag a candidate for suspicious behavior/mischief.
   * Logs the flag event to proctoring logs.
   */
  async flagCandidate(
    candidateId: string,
    reason: string,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<boolean> {
    try {
      // Get candidate info from streams
      const candidateInfo = this.candidateStreams.get(candidateId);
      const candidateEmail = candidateInfo?.candidateEmail || candidateId;
      const candidateName = candidateInfo?.candidateName;

      // Capture snapshot from webcam stream if available
      let snapshotBase64: string | null = null;
      try {
        const candidateInfo = this.candidateStreams.get(candidateId);
        const webcamStream = candidateInfo?.webcamStream;
        if (webcamStream && typeof window !== 'undefined') {
          const videoElement = document.createElement('video');
          videoElement.srcObject = webcamStream;
          videoElement.play();
          
          await new Promise((resolve) => setTimeout(resolve, 200)); // Wait for video to load
          
          if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth || 640;
            canvas.height = videoElement.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            if (ctx && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
              ctx.drawImage(videoElement, 0, 0);
              snapshotBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
            }
          }
        }
      } catch (snapshotError) {
        this.log('Failed to capture snapshot for flag:', snapshotError);
        // Continue without snapshot
      }

      // Prepare payload for /api/proctor/record (same endpoint as AI proctoring violations)
      // This ensures flags appear in analytics page alongside AI violations
      // Use same userId format as AI violations: "email:candidateEmail" for consistency
      const userId = candidateEmail.includes('@') 
        ? `email:${candidateEmail}` 
        : candidateEmail; // If not an email, use as-is (might be token or ID)
      
      const payload = {
        userId: userId, // Use "email:email" format to match AI violations
        assessmentId: this.config.assessmentId,
        eventType: 'ADMIN_FLAGGED',
        timestamp: new Date().toISOString(),
        metadata: {
          reason: reason,
          severity: severity, // 'low' | 'medium' | 'high'
          candidateName: candidateName,
          candidateEmail: candidateEmail, // For analytics filtering (backup)
          flagType: 'admin_flag',
          source: 'live-proctor',
        },
        snapshotBase64: snapshotBase64 || null,
      };

      // Send to /api/proctor/record (same endpoint as AI proctoring violations)
      // This saves to proctor_events collection, which analytics page reads from
      const response = await fetch('/api/proctor/record', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.log(`Failed to log flag event: ${response.status} ${errorText}`);
        return false;
      }

      this.log(`✅ Candidate ${candidateId} flagged: ${reason}`);
      return true;
    } catch (error) {
      this.log(`Error flagging candidate ${candidateId}:`, error);
      return false;
    }
  }
}
