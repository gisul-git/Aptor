/**
 * Unified Proctoring Module Exports
 * 
 * This module provides a centralized proctoring system for all platforms
 */

// Config
export { defaultProctorConfig, normalizeProctorConfig, type ProctorConfig } from "./config/proctorConfig";

// Engine
export {
  initializeFaceDetection,
  detectFaces,
  cleanupFaceDetection,
  isFaceDetectionInitialized,
  createFaceDetectionModule,
  extractFaceLandmarks,
  type FaceDetectionState,
  type FaceDetectionResult,
  type FaceDetectionModule,
} from "./engine/faceDetection";

export {
  createViolation,
  logViolation,
  captureScreenshot,
  type ViolationType,
  type Violation,
} from "./engine/violationHandler";

export {
  createProctorEngine,
  type ProctorEngineOptions,
  type ProctorEngineState,
  type ProctorEngine,
} from "./engine/proctorEngine";

// Hooks
export {
  useProctorEngine,
  type UseProctorEngineOptions,
  type UseProctorEngineReturn,
} from "./hooks/useProctorEngine";

// Components
export { default as IdentityVerification } from "./components/IdentityVerification";
export { default as ProctorViolationBar } from "./components/ProctorViolationBar";
export { default as ProctorAlerts } from "./components/ProctorAlerts";
