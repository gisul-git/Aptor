// ============================================================================
// Universal Proctoring System
// ============================================================================
//
// A standalone, universal proctoring system for all competencies
// (DSA, AIML, Custom MCQ, General Assessments).
//
// FEATURES:
// - AI Proctoring: Gaze away, no face, multiple faces detection
// - Tab Switch Detection: Tab switches, window blur/focus
// - Fullscreen Enforcement: Fullscreen exit detection
// - Live Proctoring: Admin monitoring via webcam/screen streams (CCTV-style)
//
// USAGE (Service):
//   import { UniversalProctoringService } from '@/universal-proctoring';
//
//   const service = new UniversalProctoringService();
//   await service.startProctoring({
//     settings: { aiProctoringEnabled: true, liveProctoringEnabled: false },
//     session: { userId: '...', assessmentId: '...' },
//     videoElement: videoRef.current,
//   });
//   service.stopProctoring();
//
// USAGE (React Hook):
//   import { useUniversalProctoring } from '@/universal-proctoring';
//
//   const { state, startProctoring, stopProctoring, violations } = useUniversalProctoring();
//
// API:
//   startProctoring(options) - Start proctoring with given settings
//   stopProctoring()         - Stop all proctoring services
//   getState()               - Get current proctoring state
//   getViolations()          - Get all recorded violations
//   requestFullscreen()      - Request fullscreen mode (needs user gesture)
//   exitFullscreen()         - Exit fullscreen mode
//
// ============================================================================

// Types
export type {
  ProctoringSettings,
  ProctoringEventType,
  ProctoringViolation,
  ViolationCallback,
  ProctoringSession,
  GazeDirection,
  FaceBox,
  AIProctoringConfig,
  TabSwitchConfig,
  ProctoringState,
} from "./types";

export {
  DEFAULT_AI_CONFIG,
  DEFAULT_TAB_CONFIG,
  INITIAL_PROCTORING_STATE,
  GAZE_THRESHOLDS,
  EYE_AR_THRESHOLD,
  VIDEO_DIMENSIONS,
} from "./types";

// Main Service
export {
  UniversalProctoringService,
  getUniversalProctoringService,
  resetUniversalProctoringService,
  type StartProctoringOptions,
  type ProctoringCallbacks,
} from "./UniversalProctoringService";

// React Hook
export {
  useUniversalProctoring,
  type UseUniversalProctoringOptions,
  type UseUniversalProctoringReturn,
  type StartProctoringParams,
} from "./useUniversalProctoring";

// Sub-services (for advanced usage)
export {
  AIProctoringService,
  getAIProctoringService,
  resetAIProctoringService,
  TabSwitchService,
  getTabSwitchService,
  resetTabSwitchService,
  FullscreenService,
  getFullscreenService,
  resetFullscreenService,
  type AIProctoringState,
  type AIProctoringCallbacks,
  type TabSwitchState,
  type TabSwitchCallbacks,
  type FullscreenConfig,
  type FullscreenState,
  type FullscreenCallbacks,
} from "./services";

// Utilities
export {
  setDebugMode,
  isDebugMode,
  debugLog,
  calculateEAR,
  isBlinking,
  calculateGazeDirection,
  extractEyeLandmarks,
  // createThrottleTracker - REMOVED: Legacy helper replaced by incident-based state machines
  createConsecutiveCounter,
  getTimestamp,
  FACE_MESH_LANDMARKS,
} from "./utils";

// ============================================================================
// Live Proctoring (Admin Monitoring / CCTV-style)
// ============================================================================
//
// Live proctoring is exported as a separate namespace to keep it
// independent from AI proctoring.
//
// USAGE:
//   import { live } from '@/universal-proctoring';
//
//   // Candidate side
//   const candidateService = new live.CandidateLiveService({ assessmentId, candidateId });
//   await candidateService.start(callbacks);
//
//   // Admin side
//   const adminService = new live.AdminLiveService({ assessmentId, adminId });
//   await adminService.startMonitoring(callbacks);
//
// ============================================================================

import * as live from "./live";
export { live };

// Also export live proctoring types and services directly for convenience
export type {
  LiveConnectionState,
  CandidateSession,
  CandidateLiveProctoringConfig,
  CandidateLiveState,
  CandidateLiveCallbacks,
  AdminLiveProctoringConfig,
  CandidateStreamInfo,
  AdminLiveState,
  AdminLiveCallbacks,
} from "./live";

export {
  CandidateLiveService,
  AdminLiveService,
} from "./live";

// Utilities
export { resolveUserIdForProctoring } from "./utils/resolveUserId";
