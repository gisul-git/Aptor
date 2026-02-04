// ============================================================================
// Universal Proctoring System - AI Proctoring Service
// Handles: Gaze away, No face, Multiple faces detection
// 
// ARCHITECTURE: Matches the proven useFaceMesh.ts implementation:
// - BlazeFace for face detection/counting (sole source of truth)
// - MediaPipe FaceMesh for gaze detection via head pose
// - requestAnimationFrame loop at ~12 FPS
// - Proper face count debouncing with stability frames
// - Gaze state machine: idle → detecting → cooldown
// ============================================================================

import {
  AIProctoringConfig,
  DEFAULT_AI_CONFIG,
  GazeDirection,
  FaceBox,
  ProctoringViolation,
  ProctoringSession,
  VIDEO_DIMENSIONS,
} from "../types";
import {
  debugLog,
  getTimestamp,
} from "../utils";
import { faceVerificationService } from "@/services/proctoring/faceVerification.service";
// ============================================================================
// Constants - Preserved from useFaceMesh.ts
// ============================================================================

// Face validation thresholds
const CONFIDENCE_THRESHOLD = 0.4;
const MIN_FACE_AREA_RATIO = 0.01; // 1% of frame
const ASPECT_RATIO_MIN = 0.4;
const ASPECT_RATIO_MAX = 2.0;
const IN_FRAME_RATIO = 0.5; // 50%
const IOU_THRESHOLD = 0.3;
const CENTROID_DISTANCE_THRESHOLD = 60;

// Face count stability (debouncing) - frames required
const SINGLE_FACE_FRAMES = 2;
const MULTIPLE_FACE_FRAMES = 3;
const FACE_DECREASE_FRAMES = 3;

// Gaze-away thresholds (degrees)
const YAW_THRESHOLD = 15;
const PITCH_THRESHOLD = 20;
const LOOKING_DOWN_THRESHOLD = 25;

// Gaze-away timing (milliseconds) - INCIDENT-BASED
const GAZE_AWAY_TRIGGER_DURATION = 1000;  // 1.5 seconds to trigger
const GAZE_AWAY_COOLDOWN = 2000;           // 5 seconds cooldown

// No-face timing (milliseconds) - INCIDENT-BASED
const NO_FACE_TRIGGER_DURATION = 1000;     // 2 seconds to trigger
const NO_FACE_COOLDOWN = 2000;             // 6 seconds cooldown

// Multiple-face timing (milliseconds) - INCIDENT-BASED
const MULTIPLE_FACE_TRIGGER_DURATION = 1000; // 1 second to trigger
const MULTIPLE_FACE_COOLDOWN = 2000;         // 6 seconds cooldown

// Face Verification (2-Tier Hybrid: BlazeFace + DeepFace ArcFace)
const FACE_VERIFICATION_INTERVAL_MS = 3000;         // Check every 3 seconds
const TIER1_SIMILARITY_THRESHOLD = 80;              // Tier 1: if < 80%, escalate to Tier 2
const TIER2_SIMILARITY_THRESHOLD = 40;              // Tier 2: if < 40%, mismatch (backend uses this)
const FACE_MISMATCH_CONSECUTIVE_REQUIRED = 2;       // 2 Tier 2 mismatches → toast faster
const FACE_MISMATCH_GRACE_PERIOD_MS = 30000;       // 30 seconds grace period
const FACE_MISMATCH_COOLDOWN_MS = 90000;            // 90 seconds cooldown
const MIN_FACE_CONFIDENCE = 95;                     // Minimum BlazeFace confidence (0-100)
const MIN_FACE_SIZE = 0.1;                          // 10% of frame minimum

// ============================================================================
// Types
// ============================================================================

export interface AIProctoringState {
  isCameraOn: boolean;
  isModelLoaded: boolean;
  facesCount: number;
  gazeDirection: GazeDirection | null;
  errors: string[];
}

export interface AIProctoringCallbacks {
  onViolation: (violation: ProctoringViolation) => void;
  onStateChange: (state: Partial<AIProctoringState>) => void;
}

// BlazeFace prediction interface
interface BlazeFacePrediction {
  topLeft: [number, number];
  bottomRight: [number, number];
  probability: number;
  landmarks?: number[][];
}

// Box interface for IoU/centroid calculations
interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Incident state machine states
type IncidentState = 'idle' | 'detecting' | 'triggered' | 'cooldown';

// Incident tracker for each violation type
interface IncidentTracker {
  state: IncidentState;
  detectionStartTime: number | null;
  lastTriggerTime: number;
  snapshotData: string | null;
  consecutiveMismatches?: number; // Track consecutive mismatch detections for debouncing
  lastSimilarity?: number; // Track last similarity score
}

// ============================================================================
// Helper Functions - IoU and Centroid calculations
// ============================================================================

function computeIoU(box1: Box, box2: Box): number {
  const xA = Math.max(box1.x1, box2.x1);
  const yA = Math.max(box1.y1, box2.y1);
  const xB = Math.min(box1.x2, box2.x2);
  const yB = Math.min(box1.y2, box2.y2);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const box1Area = (box1.x2 - box1.x1) * (box1.y2 - box1.y1);
  const box2Area = (box2.x2 - box2.x1) * (box2.y2 - box2.y1);
  const unionArea = box1Area + box2Area - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}

function computeCentroidDistance(box1: Box, box2: Box): number {
  const c1x = (box1.x1 + box1.x2) / 2;
  const c1y = (box1.y1 + box1.y2) / 2;
  const c2x = (box2.x1 + box2.x2) / 2;
  const c2y = (box2.y1 + box2.y2) / 2;
  return Math.sqrt((c1x - c2x) ** 2 + (c1y - c2y) ** 2);
}

// ============================================================================
// AI Proctoring Service Class
// ============================================================================

/**
 * AI Proctoring Service - handles face detection and gaze tracking.
 * 
 * ARCHITECTURE (matches useFaceMesh.ts):
 * - BlazeFace: Face detection and counting (sole source of truth)
 * - MediaPipe FaceMesh: Gaze detection via head pose calculation
 * - requestAnimationFrame: Detection loop at ~12 FPS
 * - Face count debouncing: Stability counters prevent flickering
 * - Gaze state machine: idle → detecting → cooldown
 */
export class AIProctoringService {
  private config: AIProctoringConfig;
  private session: ProctoringSession | null = null;
  private callbacks: AIProctoringCallbacks | null = null;

  // Model refs
  private blazefaceModel: any = null;
  private faceMesh: any = null;

  // Media refs
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  
  // Animation frame ref (replaces setInterval)
  private animationFrameId: number | null = null;
  private isProcessing = false;
  private frameCount = 0;

  // Keyboard activity tracking
  private keyboardHandler: (() => void) | null = null;

  // Face count debouncing refs
  private lastFaceCount = 0;
  private faceCountStability = 0;
  private stableFaceCount = 0;

  // Keyboard activity tracking (for typing detection)
  private lastKeyPressTime = 0;
  private readonly TYPING_WINDOW = 3000; // 3 seconds after last keypress = "typing"

  // Incident trackers for each violation type
  private gazeAwayIncident: IncidentTracker = {
    state: 'idle',
    detectionStartTime: null,
    lastTriggerTime: 0,
    snapshotData: null,
  };

  private noFaceIncident: IncidentTracker = {
    state: 'idle',
    detectionStartTime: null,
    lastTriggerTime: 0,
    snapshotData: null,
  };

  private multipleFaceIncident: IncidentTracker = {
    state: 'idle',
    detectionStartTime: null,
    lastTriggerTime: 0,
    snapshotData: null,
  };

  // Face Verification State (2-Tier Hybrid: BlazeFace + DeepFace ArcFace)
  private referenceImage: string | null = null;
  private faceVerificationEnabled = false;
  private consecutiveMismatches = 0;
  private lastFaceVerificationCheck = 0;
  private sessionStartTime = 0;
  private faceMismatchState: 'idle' | 'detecting' | 'triggered' | 'cooldown' = 'idle';
  private tier1Checks = 0;
  private tier2Escalations = 0;

  // State
  private state: AIProctoringState = {
    isCameraOn: false,
    isModelLoaded: false,
    facesCount: 0,
    gazeDirection: null,
    errors: [],
  };

  constructor(config: Partial<AIProctoringConfig> = {}) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Initialize the AI proctoring service.
   * Reuses models from Global Model Service (loaded during identity verification).
   * If models not pre-loaded, loads them via ModelService (will be cached).
   */
  async initialize(): Promise<boolean> {
    debugLog("AIProctoringService: Initializing...");

    try {
      // CRITICAL: Use Global Model Service to reuse pre-loaded models
      // Models should already be loaded during identity verification phase
      const { modelService } = await import("./ModelService");
      
      // Try to get cached models first (fast - no loading)
      let blazefaceModel = modelService.getBlazeFace();
      let faceMesh = modelService.getFaceMesh();
      
      if (blazefaceModel && faceMesh) {
        // Both models already loaded - reuse immediately
        debugLog("[AIProctoringService] ✅ Reusing pre-loaded models from ModelService");
        this.blazefaceModel = blazefaceModel;
        this.faceMesh = faceMesh;
        
        this.updateState({ isModelLoaded: true });
        debugLog("AIProctoringService: Models ready (reused from ModelService)");
        return true;
      }
      
      // If models not pre-loaded, load them via ModelService (will be cached for future use)
      debugLog("[AIProctoringService] Models not pre-loaded, loading via ModelService...");
      const models = await modelService.loadAllModels();
      
      if (models.blazeface) {
        this.blazefaceModel = models.blazeface;
        debugLog("[AIProctoringService] ✅ BlazeFace model loaded via ModelService");
      } else {
        console.error("[AIProctoringService] Failed to load BlazeFace");
        this.addError("Failed to load BlazeFace model");
        return false;
      }
      
      if (models.faceMesh) {
        this.faceMesh = models.faceMesh;
        debugLog("[AIProctoringService] ✅ FaceMesh model loaded via ModelService");
      } else {
        console.warn('[AIProctoringService] FaceMesh failed to load, gaze detection disabled');
        // Continue without FaceMesh - BlazeFace is still available for face counting
      }

      this.updateState({ isModelLoaded: true });
      debugLog("AIProctoringService: Models loaded successfully");
      return true;
    } catch (error) {
      console.error("[AIProctoringService] Failed to load models:", error);
      this.addError(`Model loading failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Start AI proctoring with the given session and callbacks.
   * @param session - User and assessment info
   * @param callbacks - Violation and state change handlers
   * @param videoElement - Video element for camera feed
   * @param canvasElement - Canvas element for snapshot capture
   * @param existingStream - Optional existing MediaStream (from precheck)
   */
  async start(
    session: ProctoringSession,
    callbacks: AIProctoringCallbacks,
    videoElement: HTMLVideoElement,
    canvasElement?: HTMLCanvasElement,
    existingStream?: MediaStream
  ): Promise<boolean> {
    debugLog("AIProctoringService: Starting...", { session });

    if (this.state.isCameraOn) {
      debugLog("AIProctoringService: Already running");
      return true;
    }

    this.session = session;
    this.callbacks = callbacks;
    this.videoElement = videoElement;
    this.sessionStartTime = Date.now();

    // Create canvas element if not provided (required for snapshot capture)
    if (canvasElement) {
      this.canvasElement = canvasElement;
    } else {
      // Create an offscreen canvas for snapshot capture
      const canvas = document.createElement('canvas');
      canvas.width = VIDEO_DIMENSIONS.WIDTH;
      canvas.height = VIDEO_DIMENSIONS.HEIGHT;
      this.canvasElement = canvas;
      debugLog("AIProctoringService: Created offscreen canvas for snapshots");
    }

    // CRITICAL FIX: Get camera stream FIRST, then load models
    // This ensures camera is ready immediately when "Start Assessment" is clicked
    // Models may already be loaded from identity verification phase
    
    // Use existing stream from precheck if provided, otherwise get new one
    try {
      if (existingStream && existingStream.active) {
        debugLog("AIProctoringService: Using existing stream from precheck");
        this.stream = existingStream;
      } else {
        debugLog("AIProctoringService: Getting new camera stream");
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: VIDEO_DIMENSIONS.WIDTH },
            height: { ideal: VIDEO_DIMENSIONS.HEIGHT },
            facingMode: "user",
          },
        });
      }

      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      this.updateState({ isCameraOn: true });
      
      // CRITICAL FIX: Check ModelService FIRST before checking state
      // Models may already be loaded from precheck/identity verification phase
      // This ensures instant model availability if pre-loaded
      if (!this.state.isModelLoaded) {
        try {
          const { modelService } = await import("./ModelService");
          
          // Check if models are already loaded in ModelService (fast check, no loading)
          let cachedBlazeface = modelService.getBlazeFace();
          let cachedFaceMesh = modelService.getFaceMesh();
          
          // If models are still loading, wait a bit (max 500ms) for them to finish
          // This handles race conditions where precheck started loading but hasn't finished
          if (!cachedBlazeface || !cachedFaceMesh) {
            if (modelService.areModelsLoading()) {
              debugLog("AIProctoringService: Models are loading in background, waiting briefly...");
              // Wait up to 500ms for models to finish loading
              const maxWait = 500;
              const startTime = Date.now();
              while ((!cachedBlazeface || !cachedFaceMesh) && (Date.now() - startTime) < maxWait) {
                await new Promise(resolve => setTimeout(resolve, 50)); // Check every 50ms
                cachedBlazeface = modelService.getBlazeFace();
                cachedFaceMesh = modelService.getFaceMesh();
              }
            }
          }
          
          if (cachedBlazeface && cachedFaceMesh) {
            // Models already loaded! Assign immediately (no delay)
            debugLog("AIProctoringService: ✅ Models already loaded in ModelService - assigning instantly");
            this.blazefaceModel = cachedBlazeface;
            this.faceMesh = cachedFaceMesh;
            
            this.updateState({ isModelLoaded: true });
            debugLog("AIProctoringService: Models ready instantly (pre-loaded from precheck/identity verification)");
          } else {
            // Models not pre-loaded - need to load them (may take 2-3 seconds)
            debugLog("AIProctoringService: Models not pre-loaded, loading via ModelService...");
            const loaded = await this.initialize();
            if (!loaded) {
              debugLog("AIProctoringService: Model loading failed, but camera is ready");
              // Continue anyway - camera is ready, models can load in background
            }
          }
        } catch (error) {
          console.error("[AIProctoringService] Error checking ModelService:", error);
          // Fallback to initialize() if ModelService check fails
          debugLog("AIProctoringService: ModelService check failed, falling back to initialize()");
          const loaded = await this.initialize();
          if (!loaded) {
            debugLog("AIProctoringService: Model loading failed, but camera is ready");
          }
        }
      } else {
        debugLog("AIProctoringService: ✅ Models already loaded (state indicates ready)");
      }

      // Reset detection state
      this.resetDetectionState();

      // Initialize face verification (reference image from sessionStorage, backend AWS Rekognition)
      this.sessionStartTime = Date.now();
      await this.initializeFaceVerification();

      // Start keyboard listener for typing detection
      this.startKeyboardListener();

      // Start detection loop using requestAnimationFrame
      this.startDetectionLoop();

      debugLog("AIProctoringService: Started successfully");
      return true;
    } catch (error) {
      console.error("[AIProctoringService] Failed to start camera:", error);
      this.addError(`Camera error: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Stop AI proctoring and release resources.
   */
  stop(): void {
    debugLog("AIProctoringService: Stopping...");

    // Stop detection loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop keyboard listener
    this.stopKeyboardListener();

    // Stop media stream
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Clear video source
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    // Reset all state
    this.resetDetectionState();

    this.updateState({
      isCameraOn: false,
      facesCount: 0,
      gazeDirection: null,
    });

    debugLog("AIProctoringService: Stopped");
  }

  /**
   * Get current state.
   */
  getState(): AIProctoringState {
    return { ...this.state };
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<AIProctoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // Private Methods - Detection Loop
  // ============================================================================

  /**
   * Start keyboard listener to detect typing activity.
   * Helps ignore brief 'down' gaze when user is typing.
   */
  private startKeyboardListener(): void {
    if (typeof window === 'undefined') return;
    
    this.keyboardHandler = () => {
      this.lastKeyPressTime = Date.now();
    };
    
    window.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * Stop keyboard listener.
   */
  private stopKeyboardListener(): void {
    if (typeof window === 'undefined' || !this.keyboardHandler) return;
    
    window.removeEventListener('keydown', this.keyboardHandler);
    this.keyboardHandler = null;
  }

  /**
   * Check if user is likely typing (recent keyboard activity).
   */
  private isLikelyTyping(): boolean {
    const now = Date.now();
    return (now - this.lastKeyPressTime) < this.TYPING_WINDOW;
  }

  /**
   * Reset detection state between sessions.
   */
  private resetDetectionState(): void {
    this.frameCount = 0;
    this.isProcessing = false;
    this.lastFaceCount = 0;
    this.faceCountStability = 0;
    this.stableFaceCount = 0;
    this.consecutiveMismatches = 0;
    this.lastFaceVerificationCheck = 0;
    this.faceMismatchState = 'idle';
    this.tier1Checks = 0;
    this.tier2Escalations = 0;

    // Reset all incident trackers
    this.gazeAwayIncident = {
      state: 'idle',
      detectionStartTime: null,
      lastTriggerTime: 0,
      snapshotData: null,
    };

    this.noFaceIncident = {
      state: 'idle',
      detectionStartTime: null,
      lastTriggerTime: 0,
      snapshotData: null,
    };

    this.multipleFaceIncident = {
      state: 'idle',
      detectionStartTime: null,
      lastTriggerTime: 0,
      snapshotData: null,
    };
  }

  /**
   * Start the detection loop using requestAnimationFrame.
   * Runs at ~12 FPS (every 5th frame at 60fps).
   */
  private startDetectionLoop(): void {
    const detect = async () => {
      // Skip if already processing a frame
      if (this.isProcessing) {
        this.animationFrameId = requestAnimationFrame(detect);
        return;
      }

      this.frameCount++;

      // Throttle to ~12 FPS (every 5th frame at 60fps)
      if (this.frameCount % 5 !== 0) {
        this.animationFrameId = requestAnimationFrame(detect);
        return;
      }

      const video = this.videoElement;
      if (!video || video.readyState < 2 || video.paused) {
        this.animationFrameId = requestAnimationFrame(detect);
        return;
      }

      this.isProcessing = true;

      try {
        await this.runDetection();
      } catch (error) {
        console.error("[AIProctoringService] Detection error:", error);
      } finally {
        this.isProcessing = false;
        this.animationFrameId = requestAnimationFrame(detect);
      }
    };

    this.animationFrameId = requestAnimationFrame(detect);
  }

  // ============================================================================
  // Private Methods - Face Detection Helpers
  // ============================================================================

  /**
   * Filter overlapping face boxes using IoU and centroid distance.
   * Prevents double-counting the same face.
   */
  private filterOverlappingBoxes(predictions: BlazeFacePrediction[]): BlazeFacePrediction[] {
    if (predictions.length <= 1) return predictions;

    const boxes = predictions.map((p) => ({
      prediction: p,
      x1: p.topLeft[0],
      y1: p.topLeft[1],
      x2: p.bottomRight[0],
      y2: p.bottomRight[1],
    }));

    // Sort by confidence (highest first)
    boxes.sort((a, b) => (b.prediction.probability || 0) - (a.prediction.probability || 0));

    const filtered: typeof boxes = [];
    for (const box of boxes) {
      let isOverlapping = false;
      for (const existing of filtered) {
        const iou = computeIoU(box, existing);
        const centroidDist = computeCentroidDistance(box, existing);

        if (iou >= IOU_THRESHOLD || centroidDist <= CENTROID_DISTANCE_THRESHOLD) {
          isOverlapping = true;
          break;
        }
      }
      if (!isOverlapping) {
        filtered.push(box);
      }
    }

    return filtered.map((b) => b.prediction);
  }

  /**
   * Validate a face prediction based on size, aspect ratio, and position.
   */
  private validateFace(prediction: BlazeFacePrediction, videoWidth: number, videoHeight: number): boolean {
    const width = prediction.bottomRight[0] - prediction.topLeft[0];
    const height = prediction.bottomRight[1] - prediction.topLeft[1];
    const area = width * height;
    const frameArea = videoWidth * videoHeight;

    // Minimum area check (1% of frame)
    if (area / frameArea < MIN_FACE_AREA_RATIO) {
      return false;
    }

    // Aspect ratio check
    const aspectRatio = width / height;
    if (aspectRatio < ASPECT_RATIO_MIN || aspectRatio > ASPECT_RATIO_MAX) {
      return false;
    }

    // In-frame check (at least 50% of face must be in frame)
    const inFrameX = Math.min(prediction.bottomRight[0], videoWidth) - Math.max(prediction.topLeft[0], 0);
    const inFrameY = Math.min(prediction.bottomRight[1], videoHeight) - Math.max(prediction.topLeft[1], 0);
    const inFrameArea = Math.max(0, inFrameX) * Math.max(0, inFrameY);
    if (inFrameArea / area < IN_FRAME_RATIO) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // Private Methods - Head Pose / Gaze Detection
  // ============================================================================

  /**
   * Compute head pose (yaw/pitch) from FaceMesh landmarks.
   * Uses landmarks: noseTip(4), leftEye(33), rightEye(263), chin(152), forehead(10)
   */
  private computeHeadPose(landmarks: any[]): { yaw: number; pitch: number } {
    if (!landmarks || landmarks.length < 468) {
      return { yaw: 0, pitch: 0 };
    }

    try {
      // Key landmarks (MediaPipe FaceMesh indices)
      const noseTip = landmarks[4] || landmarks[1];
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];
      const chin = landmarks[152];
      const forehead = landmarks[10];

      if (!noseTip || !leftEye || !rightEye) {
        return { yaw: 0, pitch: 0 };
      }

      // Yaw: horizontal angle based on eye positions relative to nose
      const eyeCenterX = (leftEye.x + rightEye.x) / 2;
      const eyeDistance = Math.abs(rightEye.x - leftEye.x);
      const noseOffsetX = noseTip.x - eyeCenterX;
      const yaw = (noseOffsetX / (eyeDistance + 0.001)) * 60; // Scale to degrees

      // Pitch: vertical angle based on nose position relative to eye-chin line
      const eyeCenterY = (leftEye.y + rightEye.y) / 2;
      const faceHeight = chin && forehead ? Math.abs(chin.y - forehead.y) : 0.3;
      const noseOffsetY = noseTip.y - eyeCenterY;
      const pitch = (noseOffsetY / (faceHeight + 0.001)) * 60; // Scale to degrees

      return { yaw, pitch };
    } catch (error) {
      console.error('[AIProctoringService] Error computing head pose:', error);
      return { yaw: 0, pitch: 0 };
    }
  }

  // ============================================================================
  // Private Methods - Main Detection
  // ============================================================================

  /**
   * Run face detection and gaze tracking.
   * Main detection logic matching useFaceMesh.ts implementation.
   */
  private async runDetection(): Promise<void> {
    if (!this.videoElement || !this.blazefaceModel) {
      return;
    }

    const video = this.videoElement;
    const videoWidth = video.videoWidth || VIDEO_DIMENSIONS.WIDTH;
    const videoHeight = video.videoHeight || VIDEO_DIMENSIONS.HEIGHT;

    // ========== BlazeFace Detection for Face Counting ==========
    let rawFaceCount = 0;
    let validPredictions: BlazeFacePrediction[] = [];
    
    try {
      const predictions: BlazeFacePrediction[] = await this.blazefaceModel.estimateFaces(video, false);

      // Filter by confidence
      const confidentPredictions = predictions.filter(
        (p: BlazeFacePrediction) => (p.probability || 0) > CONFIDENCE_THRESHOLD
      );

      // Validate faces (size, aspect ratio, in-frame)
      validPredictions = confidentPredictions.filter(
        (p: BlazeFacePrediction) => this.validateFace(p, videoWidth, videoHeight)
      );

      // Filter overlapping boxes (IoU + centroid)
      const filteredPredictions = this.filterOverlappingBoxes(validPredictions);
      rawFaceCount = filteredPredictions.length;
    } catch (error) {
      console.error('[AIProctoringService] BlazeFace error:', error);
    }

    // ========== Face Count Debouncing ==========
    if (rawFaceCount === this.lastFaceCount) {
      this.faceCountStability++;
    } else {
      this.faceCountStability = 1;
      this.lastFaceCount = rawFaceCount;
    }

    // Update stable face count based on stability thresholds
    let newStableFaceCount = this.stableFaceCount;

    if (rawFaceCount === 1 && this.faceCountStability >= SINGLE_FACE_FRAMES) {
      newStableFaceCount = 1;
    } else if (rawFaceCount > 1 && this.faceCountStability >= MULTIPLE_FACE_FRAMES) {
      newStableFaceCount = rawFaceCount;
    } else if (rawFaceCount === 0 && this.faceCountStability >= FACE_DECREASE_FRAMES) {
      newStableFaceCount = 0;
    } else if (rawFaceCount < this.stableFaceCount && this.faceCountStability >= FACE_DECREASE_FRAMES) {
      newStableFaceCount = rawFaceCount;
    }

    this.stableFaceCount = newStableFaceCount;
    this.updateState({ facesCount: newStableFaceCount });

    // ========== NO FACE INCIDENT STATE MACHINE ==========
    this.handleNoFaceIncident(newStableFaceCount === 0, rawFaceCount);

    // ========== MULTIPLE FACES INCIDENT STATE MACHINE ==========
    this.handleMultipleFaceIncident(
      newStableFaceCount > 1,
      newStableFaceCount,
      validPredictions
    );

    // ========== GAZE DETECTION USING FACEMESH (HEAD POSE) ==========
    let isGazeAway = false;

    if (this.faceMesh && newStableFaceCount === 1) {
      try {
        const results = await new Promise<any>((resolve) => {
          this.faceMesh.onResults((r: any) => resolve(r));
          this.faceMesh.send({ image: video });
        });

        if (results?.multiFaceLandmarks?.[0]) {
          const landmarks = results.multiFaceLandmarks[0];
          const { yaw, pitch } = this.computeHeadPose(landmarks);

          // Special case: Ignore brief 'down' gaze during typing
          const isLookingDown = pitch > LOOKING_DOWN_THRESHOLD;
          const isTyping = this.isLikelyTyping();
          
          // Gaze is away if: outside thresholds OR (looking down but NOT typing)
          isGazeAway = 
            Math.abs(yaw) > YAW_THRESHOLD || 
            Math.abs(pitch) > PITCH_THRESHOLD ||
            (isLookingDown && !isTyping);

          // Update gaze direction state
          if (Math.abs(yaw) > YAW_THRESHOLD || Math.abs(pitch) > PITCH_THRESHOLD) {
            const direction = Math.abs(yaw) > Math.abs(pitch)
              ? (yaw > 0 ? 'right' : 'left')
              : (pitch > 0 ? 'down' : 'up');
            this.updateState({ gazeDirection: { direction, confidence: 0.8 } });
          } else {
            this.updateState({ gazeDirection: { direction: 'center', confidence: 0.9 } });
          }
        }
      } catch (faceMeshError) {
        // FaceMesh error - skip gaze detection this frame
      }
    }

    // ========== GAZE AWAY INCIDENT STATE MACHINE ==========
    this.handleGazeAwayIncident(isGazeAway);

    // ========== FACE VERIFICATION (Hybrid Backend) - every 3 seconds ==========
    const now = Date.now();
    if (
      this.faceVerificationEnabled &&
      now - this.lastFaceVerificationCheck >= FACE_VERIFICATION_INTERVAL_MS
    ) {
      this.lastFaceVerificationCheck = now;
      await this.checkFaceVerification();
    }
  }

  // ============================================================================
  // Private Methods - Face Verification (2-Tier Hybrid: BlazeFace + DeepFace ArcFace)
  // ============================================================================

  /**
   * Initialize face verification with reference image from sessionStorage.
   */
  private async initializeFaceVerification(): Promise<void> {
    try {
      if (typeof window === "undefined") return;
      const enabled = sessionStorage.getItem("faceVerificationEnabled");
      const referenceImg = sessionStorage.getItem("faceVerificationReferenceImage");

      if (enabled !== "true" || !referenceImg) {
        debugLog("[AIProctoringService] Face verification not enabled or no reference image");
        this.faceVerificationEnabled = false;
        return;
      }

      this.referenceImage = referenceImg;
      this.faceVerificationEnabled = true;
      this.sessionStartTime = Date.now();

      console.log("[AIProctoringService] ✅ 2-Tier Hybrid Face Verification Initialized:", {
        referenceImageSize: `${(referenceImg.length / 1024).toFixed(1)} KB`,
        tier1: "Client-side quality check (BlazeFace)",
        tier2: "Backend deep verification (DeepFace ArcFace)",
        mode: "Escalate to Tier 2 when Tier 1 passes",
      });
    } catch (error) {
      console.error("[AIProctoringService] Failed to initialize face verification:", error);
      this.faceVerificationEnabled = false;
      this.referenceImage = null;
    }
  }

  /**
   * Assess if current frame has a good quality face for verification.
   */
  private async assessFaceQuality(): Promise<{
    hasGoodFace: boolean;
    confidence: number;
    faceSize: number;
    reason?: string;
  }> {
    try {
      if (!this.videoElement || !this.blazefaceModel) {
        return { hasGoodFace: false, confidence: 0, faceSize: 0, reason: "no_video_or_model" };
      }

      const predictions: BlazeFacePrediction[] = await this.blazefaceModel.estimateFaces(this.videoElement, false);

      if (predictions.length === 0) {
        return { hasGoodFace: false, confidence: 0, faceSize: 0, reason: "no_face_detected" };
      }

      if (predictions.length > 1) {
        return { hasGoodFace: false, confidence: 0, faceSize: 0, reason: "multiple_faces" };
      }

      const face = predictions[0];
      const prob = face.probability;
      const confidence = (Array.isArray(prob) ? (prob as number[])[0] ?? 0 : (prob as number) ?? 0) * 100;

      const box = face.topLeft as number[];
      const br = face.bottomRight as number[];
      const width = br[0] - box[0];
      const height = br[1] - box[1];
      const faceArea = width * height;
      const videoArea = this.videoElement.videoWidth * this.videoElement.videoHeight;
      const faceSize = videoArea > 0 ? faceArea / videoArea : 0;

      if (confidence < MIN_FACE_CONFIDENCE) {
        return { hasGoodFace: false, confidence, faceSize, reason: "low_confidence" };
      }

      if (faceSize < MIN_FACE_SIZE) {
        return { hasGoodFace: false, confidence, faceSize, reason: "face_too_small" };
      }

      return { hasGoodFace: true, confidence, faceSize };
    } catch (error) {
      console.error("[AIProctoringService] Failed to assess face quality:", error);
      return { hasGoodFace: false, confidence: 0, faceSize: 0, reason: "error" };
    }
  }

  /**
   * Capture current video frame as base64 data URL.
   */
  private async captureCurrentFrame(): Promise<string | null> {
    try {
      if (!this.videoElement) return null;

      const canvas = document.createElement("canvas");
      canvas.width = this.videoElement.videoWidth;
      canvas.height = this.videoElement.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(this.videoElement, 0, 0);

      return canvas.toDataURL("image/jpeg", 0.95);
    } catch (error) {
      console.error("[AIProctoringService] Failed to capture frame:", error);
      return null;
    }
  }

  /**
   * 2-Tier Face Verification: Tier 1 quality check (BlazeFace), Tier 2 backend (DeepFace ArcFace).
   */
  private async checkFaceVerification(): Promise<void> {
    if (!this.faceVerificationEnabled || !this.referenceImage || !this.videoElement) {
      return;
    }

    try {
      // Tier 1: client-side quality check
      const faceQuality = await this.assessFaceQuality();
      this.tier1Checks++;

      if (!faceQuality.hasGoodFace) {
        console.warn("[AIProctoringService] ⚠️ [TIER 1] Poor quality - skipping check:", {
          reason: faceQuality.reason,
          confidence: faceQuality.confidence.toFixed(1),
          faceSize: `${(faceQuality.faceSize * 100).toFixed(1)}%`,
        });
        // Don't reset consecutiveMismatches here — only reset when Tier 2 says match. Toast appears faster.
        return;
      }

      console.log("[AIProctoringService] ✅ [TIER 1] Good quality face detected:", {
        confidence: faceQuality.confidence.toFixed(1),
        faceSize: `${(faceQuality.faceSize * 100).toFixed(1)}%`,
        tier1Checks: this.tier1Checks,
      });

      const liveFrame = await this.captureCurrentFrame();
      if (!liveFrame) {
        console.error("[AIProctoringService] Failed to capture current frame");
        return;
      }

      console.log("[AIProctoringService] 📡 [TIER 2] Escalating to backend...");
      this.tier2Escalations++;

      const result = await faceVerificationService.verifyFace(
        this.session?.assessmentId ?? "unknown",
        this.session?.userId ?? "unknown",
        this.referenceImage,
        liveFrame
      );

      console.log("[AIProctoringService] 📊 [TIER 2] Backend result:", {
        match: result.match,
        similarity: result.similarity.toFixed(2),
        confidence: result.confidence,
        provider: result.metadata?.provider,
        tier1Checks: this.tier1Checks,
        tier2Escalations: this.tier2Escalations,
        escalationRate: `${((this.tier2Escalations / this.tier1Checks) * 100).toFixed(1)}%`,
      });

      const isMismatch = !result.match;
      this.handleFaceMismatch(isMismatch, result.similarity);
    } catch (error) {
      console.error("[AIProctoringService] Face verification failed:", error);
      this.consecutiveMismatches = 0;
    }
  }

  /**
   * Handle face mismatch detection with state machine.
   */
  private handleFaceMismatch(isMismatch: boolean, similarity: number): void {
    const now = Date.now();

    const isInGracePeriod = (now - this.sessionStartTime) < FACE_MISMATCH_GRACE_PERIOD_MS;

    if (isInGracePeriod) {
      debugLog("[AIProctoringService] In grace period - not triggering mismatch");
      return;
    }

    if (isMismatch) {
      this.consecutiveMismatches++;

      console.log("[AIProctoringService] ⚠️ Face mismatch detected:", {
        consecutive: this.consecutiveMismatches,
        required: FACE_MISMATCH_CONSECUTIVE_REQUIRED,
        similarity: similarity.toFixed(1),
        state: this.faceMismatchState,
      });

      if (this.consecutiveMismatches >= FACE_MISMATCH_CONSECUTIVE_REQUIRED) {
        if (this.faceMismatchState === "idle" || this.faceMismatchState === "detecting") {
          this.faceMismatchState = "triggered";

          console.log("[AIProctoringService] 🚨 FACE_MISMATCH violation triggered:", {
            consecutiveMismatches: this.consecutiveMismatches,
            similarity: similarity.toFixed(1),
          });

          const snapshot = this.captureSnapshot();
          this.emitViolation("FACE_MISMATCH", "high", {
            consecutiveMismatches: this.consecutiveMismatches,
            similarity: similarity.toFixed(2),
            timeSinceStart: `${((now - this.sessionStartTime) / 1000).toFixed(0)}s`,
            tier1Checks: this.tier1Checks,
            tier2Escalations: this.tier2Escalations,
          }, snapshot);

          this.faceMismatchState = "cooldown";
          setTimeout(() => {
            this.faceMismatchState = "idle";
            this.consecutiveMismatches = 0;
            debugLog("[AIProctoringService] Cooldown ended - reset to idle");
          }, FACE_MISMATCH_COOLDOWN_MS);
        }
      } else {
        if (this.faceMismatchState === "idle") {
          this.faceMismatchState = "detecting";
        }
      }
    } else {
      if (this.consecutiveMismatches > 0) {
        console.log("[AIProctoringService] ✅ Face matches - resetting consecutive count:", {
          previousCount: this.consecutiveMismatches,
          similarity: similarity.toFixed(1),
        });
      }
      this.consecutiveMismatches = 0;
      if (this.faceMismatchState === "detecting") {
        this.faceMismatchState = "idle";
      }
    }
  }

  // ============================================================================
  // Private Methods - Incident State Machines
  // ============================================================================

  /**
   * Handle NO_FACE incident state machine.
   * State flow: IDLE → DETECTING → TRIGGERED → COOLDOWN → IDLE
   */
  private handleNoFaceIncident(isNoFace: boolean, rawFaceCount: number): void {
    const now = Date.now();
    const incident = this.noFaceIncident;

    // State: COOLDOWN
    if (incident.state === 'cooldown') {
      // Check if cooldown expired AND condition cleared
      if (now - incident.lastTriggerTime >= NO_FACE_COOLDOWN && !isNoFace) {
        incident.state = 'idle';
        incident.detectionStartTime = null;
        incident.snapshotData = null;
      }
      return; // No emission during cooldown
    }

    // State: TRIGGERED
    if (incident.state === 'triggered') {
      // Wait for condition to clear before returning to cooldown
      if (!isNoFace) {
        incident.state = 'cooldown';
      }
      return;
    }

    // State: IDLE
    if (incident.state === 'idle' && isNoFace) {
      // Start detecting
      incident.state = 'detecting';
      incident.detectionStartTime = now;
      return;
    }

    // State: DETECTING
    if (incident.state === 'detecting') {
      if (!isNoFace) {
        // Condition cleared - reset to idle
        incident.state = 'idle';
        incident.detectionStartTime = null;
        return;
      }

      // Check if trigger duration exceeded
      if (incident.detectionStartTime && now - incident.detectionStartTime >= NO_FACE_TRIGGER_DURATION) {
        // TRIGGER VIOLATION
        incident.state = 'triggered';
        incident.lastTriggerTime = now;
        incident.snapshotData = this.captureSnapshot();

        // Emit violation
        this.emitViolation('NO_FACE_DETECTED', 'medium', {
          rawFaceCount,
          stabilityFrames: this.faceCountStability,
        }, incident.snapshotData);
      }
    }
  }

  /**
   * Handle MULTIPLE_FACE incident state machine.
   * State flow: IDLE → DETECTING → TRIGGERED → COOLDOWN → IDLE
   */
  private handleMultipleFaceIncident(
    isMultipleFace: boolean,
    faceCount: number,
    validPredictions: BlazeFacePrediction[]
  ): void {
    const now = Date.now();
    const incident = this.multipleFaceIncident;

    // State: COOLDOWN
    if (incident.state === 'cooldown') {
      // Check if cooldown expired AND condition cleared
      if (now - incident.lastTriggerTime >= MULTIPLE_FACE_COOLDOWN && !isMultipleFace) {
        incident.state = 'idle';
        incident.detectionStartTime = null;
        incident.snapshotData = null;
      }
      return; // No emission during cooldown
    }

    // State: TRIGGERED
    if (incident.state === 'triggered') {
      // Wait for condition to clear before returning to cooldown
      if (!isMultipleFace) {
        incident.state = 'cooldown';
      }
      return;
    }

    // State: IDLE
    if (incident.state === 'idle' && isMultipleFace) {
      // Start detecting
      incident.state = 'detecting';
      incident.detectionStartTime = now;
      return;
    }

    // State: DETECTING
    if (incident.state === 'detecting') {
      if (!isMultipleFace) {
        // Condition cleared - reset to idle
        incident.state = 'idle';
        incident.detectionStartTime = null;
        return;
      }

      // Check if trigger duration exceeded
      if (incident.detectionStartTime && now - incident.detectionStartTime >= MULTIPLE_FACE_TRIGGER_DURATION) {
        // TRIGGER VIOLATION
        incident.state = 'triggered';
        incident.lastTriggerTime = now;
        incident.snapshotData = this.captureSnapshot();

        // Build face boxes
        const faceBoxes: FaceBox[] = validPredictions.slice(0, faceCount).map((p: BlazeFacePrediction) => ({
          x: p.topLeft[0],
          y: p.topLeft[1],
          width: p.bottomRight[0] - p.topLeft[0],
          height: p.bottomRight[1] - p.topLeft[1],
          confidence: p.probability || 0,
        }));

        // Emit violation
        this.emitViolation('MULTIPLE_FACES_DETECTED', 'high', {
          facesCount: faceCount,
          boxes: faceBoxes,
        }, incident.snapshotData);
      }
    }
  }

  /**
   * Handle GAZE_AWAY incident state machine.
   * State flow: IDLE → DETECTING → TRIGGERED → COOLDOWN → IDLE
   */
  private handleGazeAwayIncident(isGazeAway: boolean): void {
    const now = Date.now();
    const incident = this.gazeAwayIncident;

    // State: COOLDOWN
    if (incident.state === 'cooldown') {
      // Check if cooldown expired AND condition cleared
      if (now - incident.lastTriggerTime >= GAZE_AWAY_COOLDOWN && !isGazeAway) {
        incident.state = 'idle';
        incident.detectionStartTime = null;
        incident.snapshotData = null;
      }
      return; // No emission during cooldown
    }

    // State: TRIGGERED
    if (incident.state === 'triggered') {
      // Wait for condition to clear before returning to cooldown
      if (!isGazeAway) {
        incident.state = 'cooldown';
      }
      return;
    }

    // State: IDLE
    if (incident.state === 'idle' && isGazeAway) {
      // Start detecting
      incident.state = 'detecting';
      incident.detectionStartTime = now;
      return;
    }

    // State: DETECTING
    if (incident.state === 'detecting') {
      if (!isGazeAway) {
        // Condition cleared - reset to idle
        incident.state = 'idle';
        incident.detectionStartTime = null;
        return;
      }

      // Check if trigger duration exceeded
      if (incident.detectionStartTime && now - incident.detectionStartTime >= GAZE_AWAY_TRIGGER_DURATION) {
        // TRIGGER VIOLATION
        incident.state = 'triggered';
        incident.lastTriggerTime = now;
        incident.snapshotData = this.captureSnapshot();

        // Emit violation
        this.emitViolation('GAZE_AWAY', 'low', {
          direction: this.state.gazeDirection?.direction || 'away',
          confidence: this.state.gazeDirection?.confidence || 0,
        }, incident.snapshotData);
      }
    }
  }

  // ============================================================================
  // Private Methods - Violation Emission
  // ============================================================================

  // ============================================================================
  // Private Methods - Violation Emission
  // ============================================================================

  /**
   * Emit a violation with standardized payload structure.
   * 
   * PAYLOAD STRUCTURE (per requirements):
   * {
   *   eventType: string,
   *   severity: 'low' | 'medium' | 'high',
   *   timestamp: ISO string,
   *   userId: string,
   *   assessmentId: string,
   *   metadata: {
   *     severity: string,
   *     details: object,
   *     evidence?: {       // Only when snapshot captured
   *       type: 'image',
   *       format: 'jpeg',
   *       data: base64      // Captured at TRIGGERED state only
   *     }
   *   },
   *   snapshotBase64: string | null  // Same image for backward compat
   * }
   */
  private emitViolation(
    eventType: 'GAZE_AWAY' | 'NO_FACE_DETECTED' | 'MULTIPLE_FACES_DETECTED' | 'FACE_MISMATCH',
    severity: 'low' | 'medium' | 'high',
    details: Record<string, unknown>,
    snapshotBase64: string | null
  ): void {
    if (!this.session || !this.callbacks) {
      return;
    }

    // Extract candidate email from sessionStorage for metadata (backup for analytics filtering)
    let candidateEmail: string | null = null;
    try {
      if (typeof window !== 'undefined') {
        candidateEmail = sessionStorage.getItem('candidateEmail') || null;
      }
    } catch (e) {
      // Ignore sessionStorage errors (SSR or private browsing)
    }

    // Extract email from userId if it's in email: format
    const emailFromUserId = this.session.userId.startsWith('email:')
      ? this.session.userId.replace('email:', '')
      : null;

    // Use email from userId if available, otherwise from sessionStorage
    const finalCandidateEmail = emailFromUserId || candidateEmail;

    const violation: ProctoringViolation = {
      eventType,
      timestamp: getTimestamp(),
      assessmentId: this.session.assessmentId,
      userId: this.session.userId,
      metadata: {
        severity,
        details,
        // Store candidate email in metadata for analytics filtering (backup)
        ...(finalCandidateEmail && { candidateEmail: finalCandidateEmail }),
        ...(snapshotBase64 && {
          evidence: {
            type: 'image',
            format: 'jpeg',
            data: snapshotBase64,
          }
        })
      },
      snapshotBase64,
    };

    // Notify callback
    this.callbacks.onViolation(violation);

    // Also call session callback if provided
    if (this.session.onViolation) {
      this.session.onViolation(violation);
    }
  }

  /**
   * Capture the current video frame as a snapshot (JPEG).
   * Returns base64 data URL (without "data:image/jpeg;base64," prefix).
   */
  private captureSnapshot(): string | null {
    if (!this.videoElement || !this.canvasElement) {
      return null;
    }

    try {
      const ctx = this.canvasElement.getContext("2d");
      if (!ctx) return null;

      this.canvasElement.width = VIDEO_DIMENSIONS.WIDTH;
      this.canvasElement.height = VIDEO_DIMENSIONS.HEIGHT;
      ctx.drawImage(
        this.videoElement,
        0,
        0,
        VIDEO_DIMENSIONS.WIDTH,
        VIDEO_DIMENSIONS.HEIGHT
      );

      const dataURL = this.canvasElement.toDataURL("image/jpeg", 0.7);
      // Strip the "data:image/jpeg;base64," prefix for consistent storage
      return dataURL.replace(/^data:image\/jpeg;base64,/, '');
    } catch (error) {
      return null;
    }
  }

  /**
   * Update internal state and notify callback.
   */
  private updateState(partial: Partial<AIProctoringState>): void {
    this.state = { ...this.state, ...partial };
    if (this.callbacks) {
      this.callbacks.onStateChange(partial);
    }
  }

  /**
   * Add an error to the state.
   */
  private addError(error: string): void {
    this.state.errors = [...this.state.errors, error];
    if (this.callbacks) {
      this.callbacks.onStateChange({ errors: this.state.errors });
    }
  }
}

// ============================================================================
// Singleton Instance (for simpler usage)
// ============================================================================

let aiProctoringInstance: AIProctoringService | null = null;

/**
 * Get or create the AI proctoring service instance.
 */
export function getAIProctoringService(
  config?: Partial<AIProctoringConfig>
): AIProctoringService {
  if (!aiProctoringInstance) {
    aiProctoringInstance = new AIProctoringService(config);
  } else if (config) {
    aiProctoringInstance.updateConfig(config);
  }
  return aiProctoringInstance;
}

/**
 * Reset the AI proctoring service instance.
 */
export function resetAIProctoringService(): void {
  if (aiProctoringInstance) {
    aiProctoringInstance.stop();
    aiProctoringInstance = null;
  }
}
