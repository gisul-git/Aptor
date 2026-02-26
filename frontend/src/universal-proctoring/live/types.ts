// ============================================================================
// Universal Proctoring System - Live Proctoring Types
// ============================================================================

/**
 * WebSocket message types for live proctoring signaling.
 */
export type LiveProctoringMessageType =
  // Candidate → Server
  | "offer"
  | "ice"
  | "ping"
  // Server → Candidate
  | "answer"
  | "ice_candidate"
  | "pong"
  | "request_offer"
  // Server → Admin
  | "active_sessions"
  | "new_session"
  | "session_ended"
  | "session_data"
  // Admin → Server
  | "get_session"
  | "admin_ice";

/**
 * Connection states for live proctoring.
 */
export type LiveConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "failed";

/**
 * Candidate session info (from backend).
 */
export interface CandidateSession {
  sessionId: string;
  candidateId: string;
  assessmentId: string;
  status: string;
  createdAt?: string;
}

/**
 * Stream types available in live proctoring.
 */
export type StreamType = "webcam" | "screen";

/**
 * Track info for debugging/logging.
 */
export interface TrackInfo {
  trackId: string;
  kind: "video" | "audio";
  label: string;
  streamId: string;
  type: StreamType;
}

// ============================================================================
// Candidate-Side Types
// ============================================================================

/**
 * Options for candidate live proctoring service.
 */
export interface CandidateLiveProctoringConfig {
  /** Assessment ID */
  assessmentId: string;
  /** Candidate ID */
  candidateId: string;
  /** WebSocket heartbeat interval (default: 30000ms) */
  heartbeatIntervalMs: number;
  /** Connection timeout (default: 10000ms) */
  connectionTimeoutMs: number;
  /** Enable debug logging */
  debugMode: boolean;
}

/**
 * Candidate live proctoring state.
 */
export interface CandidateLiveState {
  isStreaming: boolean;
  connectionState: LiveConnectionState;
  sessionId: string | null;
  error: string | null;
}

/**
 * Callbacks for candidate live proctoring.
 */
export interface CandidateLiveCallbacks {
  onStateChange: (state: Partial<CandidateLiveState>) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// Admin-Side Types
// ============================================================================

/**
 * Options for admin live proctoring service.
 */
export interface AdminLiveProctoringConfig {
  /** Assessment ID to monitor */
  assessmentId: string;
  /** Admin ID */
  adminId: string;
  /** Enable debug logging */
  debugMode: boolean;
}

/**
 * Single candidate stream info for admin view.
 */
export interface CandidateStreamInfo {
  sessionId: string;
  candidateId: string;
  candidateName?: string;
  candidateEmail?: string;
  status: LiveConnectionState;
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
  error: string | null;
}

/**
 * Admin live proctoring state.
 */
export interface AdminLiveState {
  isMonitoring: boolean;
  isLoading: boolean;
  activeSessions: string[];
  candidateStreams: Map<string, CandidateStreamInfo>;
}

/**
 * Callbacks for admin live proctoring.
 */
export interface AdminLiveCallbacks {
  onStateChange: (state: Partial<AdminLiveState>) => void;
  onCandidateConnected?: (sessionId: string, candidateId: string) => void;
  onCandidateDisconnected?: (sessionId: string) => void;
  onError?: (error: string) => void;
}

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_CANDIDATE_LIVE_CONFIG: Omit<
  CandidateLiveProctoringConfig,
  "assessmentId" | "candidateId"
> = {
  heartbeatIntervalMs: 30000,
  connectionTimeoutMs: 10000,
  debugMode: false,
};

export const DEFAULT_ADMIN_LIVE_CONFIG: Omit<
  AdminLiveProctoringConfig,
  "assessmentId" | "adminId"
> = {
  debugMode: false,
};

// ============================================================================
// Initial States
// ============================================================================

export const INITIAL_CANDIDATE_LIVE_STATE: CandidateLiveState = {
  isStreaming: false,
  connectionState: "disconnected",
  sessionId: null,
  error: null,
};

export const INITIAL_ADMIN_LIVE_STATE: AdminLiveState = {
  isMonitoring: false,
  isLoading: false,
  activeSessions: [],
  candidateStreams: new Map(),
};

// ============================================================================
// WebRTC Configuration
// ============================================================================

export const WEBRTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * Get API Gateway base URL for WebSocket connections.
 * WebSockets need absolute URLs, so we construct from window.location or use env var.
 */
function getApiBaseUrl(): string {
  // Client-side: construct from current origin or use env var
  if (typeof window !== 'undefined') {
    // Use env var if available (set at build time or runtime)
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    // Fallback: construct from current origin
    // In production, API Gateway is typically on the same host but different port
    // or behind the same domain via reverse proxy
    const origin = window.location.origin;
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    
    // For production (HTTPS), use same hostname with port 80 or no port
    // For local dev, replace port 3000 with 80
    if (origin.includes(':3000')) {
      return origin.replace(':3000', ':80');
    }
    // If no port specified and on HTTPS, assume API Gateway is on same host
    // (behind reverse proxy) or use port 80
    if (protocol === 'https:') {
      // Try to use same hostname (API Gateway might be behind reverse proxy)
      return `${protocol}//${hostname}`;
    }
    // HTTP: use port 80
    return `${protocol}//${hostname}:80`;
  }
  // Server-side: use env var or default
  return process.env.NEXT_PUBLIC_API_URL || process.env.API_GATEWAY_URL || 'http://localhost:80';
}

export const LIVE_PROCTORING_ENDPOINTS = {
  /** Create a new live proctoring session - uses relative URL for Next.js proxy */
  startSession: '/api/v1/proctor/live/start-session',
  /** End a live proctoring session - uses relative URL for Next.js proxy */
  endSession: (sessionId: string) =>
    `/api/v1/proctor/live/end-session/${sessionId}`,
  /** Get Agora token for live proctoring - uses Next.js API route */
  agoraToken: () => '/api/proctor/agora/get-token',
  /** Log proctoring event - uses relative URL for Next.js proxy */
  proctoringLog: () => '/api/v1/proctoring/log',
  /** WebSocket URL for candidate - needs absolute URL */
  candidateWs: (sessionId: string, candidateId: string) => {
    const apiBase = getApiBaseUrl();
    const wsBase = apiBase.replace("http://", "ws://").replace(
      "https://",
      "wss://"
    );
    return `${wsBase}/api/v1/proctor/ws/live/candidate/${sessionId}?candidate_id=${encodeURIComponent(
      candidateId
    )}`;
  },
  /** WebSocket URL for admin - needs absolute URL */
  adminWs: (assessmentId: string) => {
    const apiBase = getApiBaseUrl();
    const wsBase = apiBase.replace("http://", "ws://").replace(
      "https://",
      "wss://"
    );
    return `${wsBase}/api/v1/proctor/ws/live/admin/${assessmentId}`;
  },
};
