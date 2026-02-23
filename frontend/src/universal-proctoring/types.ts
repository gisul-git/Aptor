// ============================================================================
// Universal Proctoring System - Type Definitions
// ============================================================================

/**
 * Proctoring settings input from Create Assessment flow.
 * This is the SINGLE SOURCE OF TRUTH schema used by all competencies.
 */
export interface ProctoringSettings {
  aiProctoringEnabled: boolean;
  faceMismatchEnabled?: boolean; // Sub-option: Only visible when aiProctoringEnabled is true
  liveProctoringEnabled: boolean;
}

/**
 * All supported proctoring violation event types.
 */
export type ProctoringEventType =
  // AI Proctoring Events
  | "NO_FACE_DETECTED"
  | "MULTIPLE_FACES_DETECTED"
  | "GAZE_AWAY"
  | "FACE_MISMATCH"
  // Tab Switch Events
  | "TAB_SWITCH"
  | "FOCUS_LOST"
  // Fullscreen Events
  | "FULLSCREEN_EXIT"
  | "FULLSCREEN_ENABLED"
  // System Events
  | "PROCTORING_STARTED"
  | "PROCTORING_STOPPED"
  | "CAMERA_DENIED"
  | "CAMERA_ERROR";

/**
 * Proctoring violation record sent to backend.
 */
export interface ProctoringViolation {
  eventType: ProctoringEventType;
  timestamp: string;
  assessmentId: string;
  userId: string;
  metadata?: Record<string, unknown>;
  snapshotBase64?: string | null;
}

/**
 * Callback for handling violations.
 */
export type ViolationCallback = (violation: ProctoringViolation) => void;

/**
 * Session context required for proctoring.
 */
export interface ProctoringSession {
  userId: string;
  assessmentId: string;
  onViolation?: ViolationCallback;
}

/**
 * Gaze direction detected by AI proctoring.
 */
export interface GazeDirection {
  direction: "center" | "left" | "right" | "up" | "down" | "away";
  confidence: number;
}

/**
 * Face bounding box detected by AI proctoring.
 */
export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * AI Proctoring configuration thresholds.
 * These are preserved from the existing DSA implementation.
 */
export interface AIProctoringConfig {
  /** Detection interval in milliseconds (default: 700ms) */
  detectionIntervalMs: number;
  /** Throttle interval for same event type (default: 5000ms) */
  throttleIntervalMs: number;
  /** Consecutive gaze away checks before violation (default: 3 = ~2.1s) */
  gazeAwayThreshold: number;
  /** Consecutive no-face checks before violation (default: 5) */
  noFaceThreshold: number;
  /** Minimum confidence for face detection (default: 0.5) */
  faceConfidenceThreshold: number;
  /** Enable debug mode */
  debugMode: boolean;
}

/**
 * Tab Switch/Fullscreen configuration.
 */
export interface TabSwitchConfig {
  /** Enable fullscreen exit detection */
  enableFullscreenDetection: boolean;
  /** Enable tab switch detection */
  enableTabSwitchDetection: boolean;
  /** Enable window blur/focus detection */
  enableFocusDetection: boolean;
}

/**
 * Current state of the proctoring system.
 */
export interface ProctoringState {
  isRunning: boolean;
  isCameraOn: boolean;
  isModelLoaded: boolean;
  modelError: string | null;
  facesCount: number;
  gazeDirection: GazeDirection | null;
  isFullscreen: boolean;
  errors: string[];
  lastViolation: ProctoringViolation | null;
}

/**
 * Default AI proctoring configuration.
 * Preserved from existing DSA implementation.
 */
export const DEFAULT_AI_CONFIG: AIProctoringConfig = {
  detectionIntervalMs: 700,
  throttleIntervalMs: 5000,
  gazeAwayThreshold: 3,      // 3 checks × 700ms = ~2.1s
  noFaceThreshold: 5,        // 5 checks × 700ms = ~3.5s
  faceConfidenceThreshold: 0.5,
  debugMode: false,
};

/**
 * Default tab switch configuration.
 */
export const DEFAULT_TAB_CONFIG: TabSwitchConfig = {
  enableFullscreenDetection: true,
  enableTabSwitchDetection: true,
  enableFocusDetection: true,
};

/**
 * Initial proctoring state.
 */
export const INITIAL_PROCTORING_STATE: ProctoringState = {
  isRunning: false,
  isCameraOn: false,
  isModelLoaded: false,
  modelError: null,
  facesCount: 0,
  gazeDirection: null,
  isFullscreen: false,
  errors: [],
  lastViolation: null,
};

// ============================================================================
// Gaze Detection Constants (preserved from useCameraProctor.ts)
// ============================================================================

/** Gaze thresholds - relative pupil position */
export const GAZE_THRESHOLDS = {
  LEFT: -0.15,
  RIGHT: 0.15,
  UP: -0.12,
  DOWN: 0.12,
};

/** Eye aspect ratio threshold for blink detection */
export const EYE_AR_THRESHOLD = 0.2;

/** Video dimensions */
export const VIDEO_DIMENSIONS = {
  WIDTH: 640,
  HEIGHT: 480,
  INFERENCE_WIDTH: 320,
  INFERENCE_HEIGHT: 240,
};
