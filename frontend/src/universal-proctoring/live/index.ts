// ============================================================================
// Universal Proctoring System - Live Proctoring Module
// ============================================================================
//
// Live Proctoring (CCTV-style admin monitoring):
// - Candidate registers session when assessment starts
// - Admin can see list of active candidates
// - Admin clicks candidate to view webcam/screen stream
// - Streams are P2P via WebRTC, signaling via WebSocket
//
// ============================================================================

// Types
export type {
  LiveProctoringMessageType,
  LiveConnectionState,
  CandidateSession,
  StreamType,
  TrackInfo,
  CandidateLiveProctoringConfig,
  CandidateLiveState,
  CandidateLiveCallbacks,
  AdminLiveProctoringConfig,
  CandidateStreamInfo,
  AdminLiveState,
  AdminLiveCallbacks,
} from "./types";

export {
  DEFAULT_CANDIDATE_LIVE_CONFIG,
  DEFAULT_ADMIN_LIVE_CONFIG,
  INITIAL_CANDIDATE_LIVE_STATE,
  INITIAL_ADMIN_LIVE_STATE,
  WEBRTC_CONFIG,
  LIVE_PROCTORING_ENDPOINTS,
} from "./types";

// Candidate Service
export {
  CandidateLiveService,
  getCandidateLiveService,
  resetCandidateLiveService,
} from "./CandidateLiveService";

// Admin Service
export {
  AdminLiveService,
  getAdminLiveService,
  resetAdminLiveService,
} from "./AdminLiveService";

// Utilities
export {
  setLiveDebugMode,
  isLiveDebugMode,
  liveLog,
  createWebSocketConnection,
  sendWebSocketMessage,
  createPeerConnection,
  detectStreamType,
  extractTrackInfo,
  addStreamTracks,
  getWebcamStream,
  getAvailableScreenStream,
  stopStream,
  parseIceCandidate,
  formatIceCandidate,
} from "./utils";
