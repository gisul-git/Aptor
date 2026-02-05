/**
 * Unified Proctoring Engine Core
 * 
 * Centralized proctoring system that works across all platforms
 */

import { ProctorConfig } from "../config/proctorConfig";
import { 
  initializeFaceDetection, 
  detectFaces, 
  cleanupFaceDetection,
  type FaceDetectionState 
} from "./faceDetection";
import { 
  createViolation, 
  logViolation, 
  captureScreenshot,
  setSessionIdForViolations,
  type ViolationType 
} from "./violationHandler";

export interface ProctorEngineOptions {
  assessmentId: string;
  candidateEmail: string;
  config: ProctorConfig;
  referenceImageUrl?: string;
  onViolation?: (violation: ViolationType, metadata?: Record<string, unknown>) => void;
  videoElement?: HTMLVideoElement | null;
  canvasElement?: HTMLCanvasElement | null;
  getVideoElement?: () => HTMLVideoElement | null; // Optional getter for dynamic video element
  getCanvasElement?: () => HTMLCanvasElement | null; // Optional getter for dynamic canvas element
}

export interface ProctorEngineState {
  isActive: boolean;
  isInitialized: boolean;
  faceDetectionState: FaceDetectionState;
  violations: Array<{
    type: ViolationType;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface ProctorEngine {
  start: () => Promise<boolean>;
  stop: () => void;
  getState: () => ProctorEngineState;
  isRunning: () => boolean;
}

// Face monitoring interval (check every 5-10 seconds)
const FACE_CHECK_INTERVAL_MS = 7000; // 7 seconds
const NO_FACE_CONSECUTIVE_THRESHOLD = 2;

/**
 * Create a unified proctoring engine instance
 */
export function createProctorEngine(options: ProctorEngineOptions): ProctorEngine {
  const {
    assessmentId,
    candidateEmail,
    config,
    onViolation,
    videoElement,
    canvasElement,
    getVideoElement,
    getCanvasElement,
  } = options;

  // State (will be managed by React hook)
  let state: ProctorEngineState = {
    isActive: false,
    isInitialized: false,
    faceDetectionState: "NO_FACE",
    violations: [],
  };

  // Refs (using closures instead of React refs for pure engine)
  let isRunning = false;
  let faceCheckInterval: NodeJS.Timeout | null = null;
  let consecutiveNoFace = 0;
  const lastViolationTime: Record<string, number> = {};

  // Create getter functions that always return current video/canvas elements
  const getVideoRef = () => {
    if (getVideoElement) return getVideoElement();
    if (videoElement) return videoElement;
    if (typeof window !== "undefined") {
      // Try to find video element in DOM (fallback)
      return document.querySelector("video") as HTMLVideoElement | null;
    }
    return null;
  };
  
  const getCanvasRef = () => {
    if (getCanvasElement) return getCanvasElement();
    return canvasElement || null;
  };

  /**
   * Check for violations with debouncing
   */
  const shouldLogViolation = (violationType: ViolationType): boolean => {
    const now = Date.now();
    const lastTime = lastViolationTime[violationType] || 0;
    const DEBOUNCE_MS = 5000;

    if (now - lastTime < DEBOUNCE_MS) {
      return false;
    }

    lastViolationTime[violationType] = now;
    return true;
  };

  /**
   * Perform face monitoring check
   */
  const performFaceCheck = async () => {
    const currentVideoRef = getVideoRef();
    if (!currentVideoRef || !config.enableFaceMonitoring) {
      return;
    }

    try {
      const detectionResult = await detectFaces(currentVideoRef);
      
      state.faceDetectionState = detectionResult.state;

      // Check for violations
      if (detectionResult.state === "NO_FACE") {
        consecutiveNoFace += 1;
        
        if (consecutiveNoFace >= NO_FACE_CONSECUTIVE_THRESHOLD) {
          if (shouldLogViolation("NO_FACE_DETECTED")) {
            const screenshot = captureScreenshot(currentVideoRef, getCanvasRef() || undefined);
            // Get sessionId from sessionStorage
            const sessionId = typeof window !== "undefined" 
              ? sessionStorage.getItem("proctoringSessionId") 
              : null;
            
            const violation = createViolation(
              "NO_FACE_DETECTED",
              assessmentId,
              candidateEmail,
              { consecutiveChecks: consecutiveNoFace },
              screenshot || undefined
            );
            violation.sessionId = sessionId || undefined;

            await logViolation(violation);
            state.violations.push({
              type: "NO_FACE_DETECTED",
              timestamp: violation.timestamp,
              metadata: violation.metadata,
            });

            if (onViolation) {
              onViolation("NO_FACE_DETECTED", violation.metadata);
            }
          }
        }
      } else {
        consecutiveNoFace = 0;
      }

      if (detectionResult.state === "MULTIPLE_FACES") {
        if (shouldLogViolation("MULTIPLE_FACE_DETECTED")) {
          const screenshot = captureScreenshot(currentVideoRef, getCanvasRef() || undefined);
          // Get sessionId from sessionStorage
          const sessionId = typeof window !== "undefined" 
            ? sessionStorage.getItem("proctoringSessionId") 
            : null;
          
          const violation = createViolation(
            "MULTIPLE_FACE_DETECTED",
            assessmentId,
            candidateEmail,
            { faceCount: detectionResult.faceCount },
            screenshot || undefined
          );
          violation.sessionId = sessionId || undefined;

          await logViolation(violation);
          state.violations.push({
            type: "MULTIPLE_FACE_DETECTED",
            timestamp: violation.timestamp,
            metadata: violation.metadata,
          });

          if (onViolation) {
            onViolation("MULTIPLE_FACE_DETECTED", violation.metadata);
          }
        }
      }

      // Gaze-away detection (placeholder - detection logic to be implemented)
      // This will be called when gaze-away is detected
      // For now, this is a placeholder structure
      const detectGazeAway = () => {
        // TODO: Implement gaze-away detection logic
        // When detected, log with snapshot:
        // if (shouldLogViolation("GAZE_AWAY_DETECTED")) {
        //   const screenshot = captureScreenshot(currentVideoRef, getCanvasRef() || undefined);
        //   const violation = createViolation(
        //     "GAZE_AWAY_DETECTED",
        //     assessmentId,
        //     candidateEmail,
        //     { /* gaze metadata */ },
        //     screenshot || undefined
        //   );
        //   await logViolation(violation);
        // }
      };

    } catch (error) {
      console.error("[ProctorEngine] Face check error:", error);
    }
  };

  /**
   * Start proctoring engine
   */
  const start = async (): Promise<boolean> => {
    if (isRunning) {
      return true;
    }

    try {
      if (config.enableFaceMonitoring) {
        const initialized = await initializeFaceDetection();
        if (!initialized) {
          return false;
        }

        state.isInitialized = true;
      }

      if (config.enableFaceMonitoring) {
        faceCheckInterval = setInterval(performFaceCheck, FACE_CHECK_INTERVAL_MS);
        performFaceCheck();
      }

      isRunning = true;
      state.isActive = true;

      return true;
    } catch (error) {
      console.error("[ProctorEngine] Failed to start:", error);
      return false;
    }
  };

  /**
   * Stop proctoring engine
   */
  const stop = () => {
    if (!isRunning) {
      return;
    }

    if (faceCheckInterval) {
      clearInterval(faceCheckInterval);
      faceCheckInterval = null;
    }

    if (config.enableFaceMonitoring) {
      cleanupFaceDetection();
    }

    isRunning = false;
    state.isActive = false;
    state.isInitialized = false;
  };

  /**
   * Get current state
   */
  const getState = (): ProctorEngineState => {
    return state;
  };

  /**
   * Check if engine is running
   */
  const isRunningCheck = (): boolean => {
    return isRunning;
  };

  return {
    start,
    stop,
    getState,
    isRunning: isRunningCheck,
  };
}

