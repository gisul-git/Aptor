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
import { FaceVerificationService, type FaceEmbedding } from "./FaceVerificationService";
import { faceMismatchTelemetry } from "./faceMismatchTelemetry";

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

// Face verification timing (milliseconds) - INCIDENT-BASED
const FACE_VERIFICATION_CHECK_INTERVAL = 3000; // Check every 3 seconds (faster detection)
const FACE_VERIFICATION_TRIGGER_DURATION = 0; // 0 seconds - trigger immediately when mismatch detected
const FACE_VERIFICATION_COOLDOWN = 90000; // 90 seconds cooldown - prevents repeated false alerts
const FACE_VERIFICATION_SIMILARITY_THRESHOLD = 0.72; // Minimum similarity (0-1) - lenient for custom embeddings
const FACE_VERIFICATION_CONSECUTIVE_REQUIRED = 5; // Require 5 consecutive mismatches (~15s) before triggering
const FACE_VERIFICATION_HIGH_SIMILARITY_THRESHOLD = 0.82; // If similarity > 0.82, likely same person (protect from false positives)
const FACE_VERIFICATION_MIN_CONFIDENCE = 0.70; // Minimum confidence (0-1) to trigger violation
const FACE_VERIFICATION_BASELINE_DURATION = 45000; // 45 seconds to establish baseline - faster than 60s
const FACE_VERIFICATION_BASELINE_MIN_SAMPLES = 3; // Minimum samples needed for baseline
const FACE_VERIFICATION_OUTLIER_STD_DEVIATIONS = 2.5; // More tolerance for outliers
const FACE_VERIFICATION_GRACE_PERIOD = 120000; // 2 minutes - no violations at assessment start

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
  private faceVerificationService: FaceVerificationService | null = null;

  // Face verification temporal consistency (weighted moving average - Phase 3.2)
  private similarityHistory: number[] = []; // Store last N similarity scores
  private readonly SIMILARITY_HISTORY_SIZE = 5; // Average over last 5 checks (~15 seconds)
  private static readonly SIMILARITY_WEIGHTS = [0.1, 0.15, 0.2, 0.25, 0.3]; // More recent = higher weight (sum 1.0)
  
  // Statistical baseline tracking for adaptive threshold
  private baselineSimilarities: number[] = []; // Store similarity scores during baseline period
  private baselineMean: number | null = null; // Mean similarity during baseline
  private baselineStdDev: number | null = null; // Standard deviation during baseline
  private baselineEstablished: boolean = false; // Whether baseline is established
  private baselineStartTime: number = 0; // When baseline tracking started
  
  // Confidence tracking
  private lastVerificationConfidence: number = 0; // Confidence of last verification check

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

  private faceMismatchIncident: IncidentTracker = {
    state: 'idle',
    detectionStartTime: null,
    lastTriggerTime: 0,
    snapshotData: null,
    consecutiveMismatches: 0,
    lastSimilarity: 1.0,
  };

  // Face verification refs
  private referenceEmbedding: FaceEmbedding | null = null;
  private lastVerificationCheck = 0;
  private sessionStartTime: number | null = null; // For grace period - no violations at start

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
      let faceRecognitionModel = modelService.getFaceRecognition();
      
      if (blazefaceModel && faceMesh) {
        // Both models already loaded - reuse immediately
        debugLog("[AIProctoringService] ✅ Reusing pre-loaded models from ModelService");
        this.blazefaceModel = blazefaceModel;
        this.faceMesh = faceMesh;
        
        // CRITICAL FIX: Initialize Face Verification Service even when models are cached
        if (faceRecognitionModel) {
          console.log("[AIProctoringService] 🚀 Initializing Face Verification Service (cached model)...");
          this.faceVerificationService = new FaceVerificationService({
            similarityThreshold: FACE_VERIFICATION_SIMILARITY_THRESHOLD,
            checkInterval: FACE_VERIFICATION_CHECK_INTERVAL,
            violationDuration: FACE_VERIFICATION_TRIGGER_DURATION,
          });
          const initialized = await this.faceVerificationService.initialize(faceRecognitionModel);
          if (initialized) {
            console.log("[AIProctoringService] ✅ Face Verification Service initialized successfully (cached)");
            debugLog("[AIProctoringService] ✅ Face Verification Service initialized (cached)");
          } else {
            console.error("[AIProctoringService] ❌ Face Verification Service initialization failed (cached)");
            this.faceVerificationService = null;
          }
        } else {
          console.warn('[AIProctoringService] ⚠️ Face Recognition model not available (cached), face verification disabled');
        }
        
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

      // Initialize Face Verification Service if face recognition model is available
      if (models.faceRecognition) {
        console.log("[AIProctoringService] 🚀 Initializing Face Verification Service...");
        this.faceVerificationService = new FaceVerificationService({
          similarityThreshold: FACE_VERIFICATION_SIMILARITY_THRESHOLD,
          checkInterval: FACE_VERIFICATION_CHECK_INTERVAL,
          violationDuration: FACE_VERIFICATION_TRIGGER_DURATION,
        });
        const initialized = await this.faceVerificationService.initialize(models.faceRecognition);
        if (initialized) {
          console.log("[AIProctoringService] ✅ Face Verification Service initialized successfully");
          debugLog("[AIProctoringService] ✅ Face Verification Service initialized");
        } else {
          console.error("[AIProctoringService] ❌ Face Verification Service initialization failed");
          this.faceVerificationService = null;
        }
      } else {
        console.warn('[AIProctoringService] ⚠️ Face Recognition model not available, face verification disabled');
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
    this.sessionStartTime = Date.now(); // Start grace period
    
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
          let cachedFaceRecognition = modelService.getFaceRecognition();
          
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
                cachedFaceRecognition = modelService.getFaceRecognition(); // Also check face recognition
              }
            }
          }
          
          if (cachedBlazeface && cachedFaceMesh) {
            // Models already loaded! Assign immediately (no delay)
            debugLog("AIProctoringService: ✅ Models already loaded in ModelService - assigning instantly");
            this.blazefaceModel = cachedBlazeface;
            this.faceMesh = cachedFaceMesh;
            
            // CRITICAL FIX: Initialize Face Verification Service even when models are cached in start()
            if (cachedFaceRecognition && !this.faceVerificationService) {
              console.log("[AIProctoringService] 🚀 Initializing Face Verification Service (cached model in start())...");
              this.faceVerificationService = new FaceVerificationService({
                similarityThreshold: FACE_VERIFICATION_SIMILARITY_THRESHOLD,
                checkInterval: FACE_VERIFICATION_CHECK_INTERVAL,
                violationDuration: FACE_VERIFICATION_TRIGGER_DURATION,
              });
              const initialized = await this.faceVerificationService.initialize(cachedFaceRecognition);
              if (initialized) {
                console.log("[AIProctoringService] ✅ Face Verification Service initialized successfully (cached in start())");
                debugLog("[AIProctoringService] ✅ Face Verification Service initialized (cached in start())");
              } else {
                console.error("[AIProctoringService] ❌ Face Verification Service initialization failed (cached in start())");
                this.faceVerificationService = null;
              }
            } else if (!cachedFaceRecognition) {
              console.warn('[AIProctoringService] ⚠️ Face Recognition model not available (cached in start()), face verification disabled');
            }
            
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

      // Load reference embedding from sessionStorage (for face verification)
      this.loadReferenceEmbedding();

      // Reset detection state
      this.resetDetectionState();

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

    // Flush remaining telemetry logs (Phase 2) - fire-and-forget to keep stop() sync
    faceMismatchTelemetry.flush();

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
    this.lastVerificationCheck = Date.now(); // Initialize to current time to prevent excessive logging

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

    // ========== FACE VERIFICATION (periodic check every 5 seconds) ==========
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastVerificationCheck;
    const shouldCheck = (now - this.lastVerificationCheck) >= FACE_VERIFICATION_CHECK_INTERVAL;
    
    // Debug logging for check conditions (only when actually checking or every 60 frames if no embedding)
    if (shouldCheck && this.referenceEmbedding) {
      // Log when we're actually about to check
      console.log("[AIProctoringService] 🔍 Face Verification check conditions:", {
        serviceReady: this.faceVerificationService?.isReady() || false,
        hasReferenceEmbedding: !!this.referenceEmbedding,
        faceCount: newStableFaceCount,
        timeSinceLastCheck: `${(timeSinceLastCheck / 1000).toFixed(1)}s`,
        shouldCheck,
        checkInterval: `${FACE_VERIFICATION_CHECK_INTERVAL / 1000}s`,
      });
    } else if (!this.referenceEmbedding && this.frameCount % 300 === 0) {
      // Log every ~25 seconds (300 frames at 12 FPS) if no embedding exists (to reduce spam)
      console.log("[AIProctoringService] ⚠️ Face verification disabled: no reference embedding found in sessionStorage");
    }
    
    if (this.faceVerificationService?.isReady() && 
        this.referenceEmbedding && 
        newStableFaceCount === 1 && // Only check if exactly one face detected
        shouldCheck) {
      console.log("[AIProctoringService] ✅ All conditions met - running face verification check...");
      this.lastVerificationCheck = now;
      this.checkFaceVerification();
    } else if (shouldCheck) {
      // Log why check is being skipped
      const reasons = [];
      if (!this.faceVerificationService?.isReady()) reasons.push("service not ready");
      if (!this.referenceEmbedding) reasons.push("no reference embedding");
      if (newStableFaceCount !== 1) reasons.push(`face count is ${newStableFaceCount} (need 1)`);
      console.log("[AIProctoringService] ⏭️ Skipping face verification check:", reasons.join(", "));
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
  // Private Methods - Face Verification
  // ============================================================================

  /**
   * Load reference embedding from sessionStorage
   */
  private loadReferenceEmbedding(): void {
    try {
      console.log("[AIProctoringService] 🔍 Loading reference embedding from sessionStorage...");
      const stored = sessionStorage.getItem('faceVerificationReferenceEmbedding');
      if (stored) {
        const embeddingArray = JSON.parse(stored);
        
        // CRITICAL FIX: Convert plain array to Float32Array for consistency
        // face-api.js returns Float32Array, so we should maintain that type
        if (Array.isArray(embeddingArray)) {
          this.referenceEmbedding = new Float32Array(embeddingArray);
          console.log("[AIProctoringService] ✅ Reference embedding loaded and converted to Float32Array:", {
            dimensions: this.referenceEmbedding.length,
            type: 'Float32Array',
            sampleValues: Array.from(this.referenceEmbedding.slice(0, 5)),
          });
        } else if (embeddingArray instanceof Float32Array) {
          // Already Float32Array (shouldn't happen from JSON.parse, but handle it)
          this.referenceEmbedding = embeddingArray;
          console.log("[AIProctoringService] ✅ Reference embedding loaded (already Float32Array):", {
            dimensions: this.referenceEmbedding.length,
            type: 'Float32Array',
            sampleValues: Array.from(this.referenceEmbedding.slice(0, 5)),
          });
        } else {
          console.error("[AIProctoringService] ❌ Invalid embedding format in sessionStorage:", typeof embeddingArray);
          this.referenceEmbedding = null;
          return;
        }
        
        // Load reference photo quality metrics if available (for confidence scoring)
        const qualityMetricsStr = sessionStorage.getItem('faceVerificationReferenceQuality');
        if (qualityMetricsStr) {
          try {
            const qualityMetrics = JSON.parse(qualityMetricsStr);
            console.log("[AIProctoringService] ✅ Reference photo quality metrics loaded:", qualityMetrics);
            // Store in a property for later use in confidence calculation
            (this as any).referenceQualityMetrics = qualityMetrics;
          } catch (e) {
            console.warn("[AIProctoringService] ⚠️ Could not parse reference quality metrics:", e);
          }
        }
        
        // Initialize baseline tracking
        this.baselineStartTime = Date.now();
        this.baselineSimilarities = [];
        this.baselineEstablished = false;
        console.log("[AIProctoringService] 📊 Baseline tracking initialized (will establish over next 45 seconds)");
        
        debugLog("[AIProctoringService] ✅ Reference embedding loaded from sessionStorage");
      } else {
        console.warn("[AIProctoringService] ⚠️ No reference embedding found in sessionStorage - face verification disabled");
        console.warn("[AIProctoringService] 💡 Reference embedding should be stored during identity verification phase");
        console.warn("[AIProctoringService] 💡 Make sure identity verification completed successfully");
        debugLog("[AIProctoringService] ⚠️ No reference embedding found in sessionStorage - face verification disabled");
      }
    } catch (error) {
      console.error("[AIProctoringService] ❌ Error loading reference embedding:", error);
      console.error("[AIProctoringService] Error details:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.referenceEmbedding = null;
    }
  }

  /**
   * Check face verification by comparing current frame with reference
   * Enhanced with quality filtering, confidence scoring, baseline tracking, and outlier detection
   */
  private async checkFaceVerification(): Promise<void> {
    if (!this.faceVerificationService?.isReady() || !this.referenceEmbedding || !this.videoElement) {
      console.warn("[AIProctoringService] ⚠️ Cannot run face verification check - missing prerequisites:", {
        serviceReady: this.faceVerificationService?.isReady() || false,
        hasReferenceEmbedding: !!this.referenceEmbedding,
        hasVideoElement: !!this.videoElement,
      });
      return;
    }

    try {
      console.log("[AIProctoringService] 🔍 Running face verification check...");
      
      // QUALITY-BASED FILTERING: Check current frame quality before processing
      const frameQuality = await this.assessFrameQuality();
      if (!frameQuality.isGood) {
        console.log("[AIProctoringService] ⏭️ Frame quality too low - skipping verification:", frameQuality.reason);
        return;
      }
      
      // Extract embedding from current video frame
      const currentEmbedding = await this.faceVerificationService.extractEmbedding(this.videoElement);
      
      if (!currentEmbedding) {
        // No face detected in current frame - skip check
        console.log("[AIProctoringService] ⏭️ No face detected in current frame - skipping verification");
        return;
      }

      console.log("[AIProctoringService] ✅ Current frame embedding extracted");

      // Quality check: Validate current embedding has sufficient variance
      const currentEmbeddingArray = Array.isArray(currentEmbedding) ? currentEmbedding : Array.from(currentEmbedding);
      const currentMean = currentEmbeddingArray.reduce((sum, val) => sum + val, 0) / currentEmbeddingArray.length;
      const currentVariance = currentEmbeddingArray.reduce((sum, val) => sum + Math.pow(val - currentMean, 2), 0) / currentEmbeddingArray.length;
      const currentStdDev = Math.sqrt(currentVariance);
      
      if (currentStdDev < 0.01) {
        console.warn("[AIProctoringService] ⚠️ Current frame embedding has low variance - skipping comparison (face may be obscured)");
        return;
      }

      // Quality check: Validate reference embedding has sufficient variance
      const referenceEmbeddingArray = Array.isArray(this.referenceEmbedding) ? this.referenceEmbedding : Array.from(this.referenceEmbedding);
      const referenceMean = referenceEmbeddingArray.reduce((sum, val) => sum + val, 0) / referenceEmbeddingArray.length;
      const referenceVariance = referenceEmbeddingArray.reduce((sum, val) => sum + Math.pow(val - referenceMean, 2), 0) / referenceEmbeddingArray.length;
      const referenceStdDev = Math.sqrt(referenceVariance);
      
      if (referenceStdDev < 0.01) {
        console.error("[AIProctoringService] ❌ Reference embedding has low variance - invalid reference photo");
        return;
      }

      // Compare with reference
      const result = this.faceVerificationService.compareFaces(this.referenceEmbedding, currentEmbedding);
      
      // TEMPORAL CONSISTENCY: Add current similarity to history and weighted average (Phase 3.2)
      this.similarityHistory.push(result.similarity);
      if (this.similarityHistory.length > this.SIMILARITY_HISTORY_SIZE) {
        this.similarityHistory.shift();
      }
      const averagedSimilarity = this.calculateWeightedSimilarity(this.similarityHistory);
      
      // STATISTICAL BASELINE TRACKING: Collect samples during first 45 seconds
      const now = Date.now();
      const timeSinceStart = now - this.baselineStartTime;
      
      if (timeSinceStart < FACE_VERIFICATION_BASELINE_DURATION && !this.baselineEstablished) {
        this.baselineSimilarities.push(averagedSimilarity);
        console.log("[AIProctoringService] 📊 Baseline tracking:", {
          samples: this.baselineSimilarities.length,
          timeRemaining: `${((FACE_VERIFICATION_BASELINE_DURATION - timeSinceStart) / 1000).toFixed(0)}s`,
          currentSimilarity: averagedSimilarity.toFixed(3),
        });
        
        // Establish baseline if we have enough samples
        if (this.baselineSimilarities.length >= FACE_VERIFICATION_BASELINE_MIN_SAMPLES) {
          const baselineMean = this.baselineSimilarities.reduce((sum, val) => sum + val, 0) / this.baselineSimilarities.length;
          const baselineVariance = this.baselineSimilarities.reduce((sum, val) => sum + Math.pow(val - baselineMean, 2), 0) / this.baselineSimilarities.length;
          this.baselineMean = baselineMean;
          this.baselineStdDev = Math.sqrt(baselineVariance);
          this.baselineEstablished = true;
          console.log("[AIProctoringService] ✅ Baseline established:", {
            mean: baselineMean.toFixed(3),
            stdDev: this.baselineStdDev.toFixed(3),
            samples: this.baselineSimilarities.length,
          });
        }
      }
      
      // CONFIDENCE SCORING: Calculate confidence based on multiple factors
      const confidence = this.calculateVerificationConfidence(
        frameQuality,
        currentStdDev,
        referenceStdDev,
        (this as any).referenceQualityMetrics
      );
      this.lastVerificationConfidence = confidence;
      
      // QUALITY-BASED ADAPTIVE THRESHOLD: Lower quality → more lenient threshold
      const referenceQuality = (this as any).referenceQualityMetrics?.overallScore ?? 0.8;
      const adaptiveThreshold = this.getAdaptiveThreshold(frameQuality.score, referenceQuality);

      // BASELINE-BASED OUTLIER DETECTION: Use baseline if established, otherwise use adaptive threshold
      let isMismatch = false;
      let thresholdUsed = adaptiveThreshold;

      // HIGH SIMILARITY PROTECTION: If similarity is very high, likely same person (reduce false positives)
      const isHighSimilarity = averagedSimilarity >= FACE_VERIFICATION_HIGH_SIMILARITY_THRESHOLD;

      if (this.baselineEstablished && this.baselineMean !== null && this.baselineStdDev !== null) {
        const outlierThreshold = this.baselineMean - (FACE_VERIFICATION_OUTLIER_STD_DEVIATIONS * this.baselineStdDev);
        thresholdUsed = Math.max(outlierThreshold, adaptiveThreshold * 0.8); // Don't go too low

        if (isHighSimilarity) {
          isMismatch = false;
        } else {
          isMismatch = averagedSimilarity < outlierThreshold && averagedSimilarity < adaptiveThreshold;
        }

        console.log("[AIProctoringService] 📊 Using baseline-based detection:", {
          baselineMean: this.baselineMean.toFixed(3),
          baselineStdDev: this.baselineStdDev.toFixed(3),
          outlierThreshold: outlierThreshold.toFixed(3),
          adaptiveThreshold: adaptiveThreshold.toFixed(3),
          currentSimilarity: averagedSimilarity.toFixed(3),
          isOutlier: averagedSimilarity < outlierThreshold,
          isHighSimilarity,
          protected: isHighSimilarity,
        });
      } else {
        // Use adaptive threshold (quality-based)
        thresholdUsed = adaptiveThreshold;
        isMismatch = !isHighSimilarity && averagedSimilarity < adaptiveThreshold;
      }
      
      // CONFIDENCE FILTER: Only trigger if confidence is high enough
      if (isMismatch && confidence < FACE_VERIFICATION_MIN_CONFIDENCE) {
        console.log("[AIProctoringService] ⏭️ Mismatch detected but confidence too low - skipping violation:", {
          similarity: averagedSimilarity.toFixed(3),
          confidence: confidence.toFixed(3),
          minConfidence: FACE_VERIFICATION_MIN_CONFIDENCE,
        });
        isMismatch = false; // Don't trigger violation if confidence is low
      }
      
      console.log("[AIProctoringService] 📊 Face verification result (enhanced):", {
        currentSimilarity: result.similarity.toFixed(3),
        averagedSimilarity: averagedSimilarity.toFixed(3),
        historySize: this.similarityHistory.length,
        threshold: thresholdUsed.toFixed(3),
        confidence: confidence.toFixed(3),
        baselineEstablished: this.baselineEstablished,
        baselineMean: this.baselineMean?.toFixed(3) || "N/A",
        baselineStdDev: this.baselineStdDev?.toFixed(3) || "N/A",
        isMatch: result.isMatch,
        isMismatch,
        qualityFactor: frameQuality.score.toFixed(2),
        currentEmbeddingVariance: currentStdDev.toFixed(4),
        referenceEmbeddingVariance: referenceStdDev.toFixed(4),
        verdict: isMismatch ? "❌ MISMATCH" : "✅ MATCH",
      });
      
      // Handle mismatch incident with improved logic (use averaged similarity and adaptive threshold)
      const violationEmitted = this.handleFaceMismatchIncident(isMismatch, averagedSimilarity, thresholdUsed);

      // Telemetry: log every verification check for analytics (Phase 2)
      faceMismatchTelemetry.logVerification({
        timestamp: Date.now(),
        similarityScore: averagedSimilarity,
        threshold: thresholdUsed,
        frameQuality: frameQuality.score,
        referenceQuality,
        violationTriggered: violationEmitted,
        candidateId: this.session?.userId ?? "unknown",
        assessmentId: this.session?.assessmentId ?? "unknown",
      });
    } catch (error) {
      console.error("[AIProctoringService] ❌ Face verification error:", error);
    }
  }
  
  /**
   * Assess current frame quality (face size, clarity, angle, lighting)
   * Returns quality score and reason if quality is poor
   */
  private async assessFrameQuality(): Promise<{ isGood: boolean; score: number; reason?: string }> {
    if (!this.videoElement || !this.blazefaceModel) {
      return { isGood: false, score: 0, reason: "Missing video element or model" };
    }
    
    try {
      const predictions = await this.blazefaceModel.estimateFaces(this.videoElement as any, false);
      if (!predictions || predictions.length === 0) {
        return { isGood: false, score: 0, reason: "No face detected" };
      }
      
      const face = predictions[0];
      const start = face.topLeft as [number, number];
      const end = face.bottomRight as [number, number];
      const width = end[0] - start[0];
      const height = end[1] - start[1];
      const faceArea = width * height;
      const videoArea = this.videoElement.videoWidth * this.videoElement.videoHeight;
      const faceSizeRatio = faceArea / videoArea;
      
      // Check face size (should be at least 5% of frame)
      if (faceSizeRatio < 0.05) {
        return { isGood: false, score: 0, reason: `Face too small (${(faceSizeRatio * 100).toFixed(1)}% - need >5%)` };
      }
      
      // Check face angle
      let faceAngle = 0;
      const landmarks = face.landmarks;
      if (landmarks && landmarks.length >= 2) {
        const rightEye = landmarks[0];
        const leftEye = landmarks[1];
        if (rightEye && leftEye && rightEye.length >= 2 && leftEye.length >= 2) {
          const eyeDx = leftEye[0] - rightEye[0];
          const eyeDy = leftEye[1] - rightEye[1];
          faceAngle = Math.abs(Math.atan2(eyeDy, eyeDx) * (180 / Math.PI));
          if (faceAngle > 30) {
            return { isGood: false, score: 0, reason: `Face angle too extreme (${faceAngle.toFixed(0)}° - need <30°)` };
          }
        }
      }
      
      // Check detection confidence
      const prob = typeof face.probability === 'number' ? face.probability : 
                   Array.isArray(face.probability) ? face.probability[0] : 0.9;
      if (prob < 0.7) {
        return { isGood: false, score: 0, reason: `Detection confidence too low (${(prob * 100).toFixed(0)}% - need >70%)` };
      }
      
      // Calculate quality score (0-1)
      const sizeScore = Math.min(1, faceSizeRatio / 0.15); // Optimal size is 15% of frame
      const angleScore = landmarks && landmarks.length >= 2 ? 1 - (faceAngle / 30) : 0.5;
      const confidenceScore = prob;
      const qualityScore = (sizeScore * 0.4) + (angleScore * 0.3) + (confidenceScore * 0.3);
      
      return { isGood: qualityScore >= 0.6, score: qualityScore };
    } catch (error) {
      console.error("[AIProctoringService] Error assessing frame quality:", error);
      return { isGood: false, score: 0, reason: "Error assessing quality" };
    }
  }
  
  /**
   * Calculate weighted moving average of similarity scores (Phase 3.2).
   * More recent scores have higher weight for responsive but stable detection.
   */
  private calculateWeightedSimilarity(history: number[]): number {
    if (history.length === 0) return 0;
    const len = Math.min(history.length, AIProctoringService.SIMILARITY_WEIGHTS.length);
    const weights = AIProctoringService.SIMILARITY_WEIGHTS.slice(-len);
    const scores = history.slice(-len);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weightSum > 0 ? weights.map((w) => w / weightSum) : weights.map(() => 1 / len);
    return scores.reduce((sum, score, i) => sum + score * normalizedWeights[i], 0);
  }

  /**
   * Calculate adaptive threshold based on frame and reference quality.
   * Lower quality conditions get more lenient thresholds to reduce false positives.
   */
  private getAdaptiveThreshold(frameQuality: number, referenceQuality: number): number {
    const baseThreshold = FACE_VERIFICATION_SIMILARITY_THRESHOLD;
    const qualityFactor = Math.min(frameQuality, referenceQuality);

    if (qualityFactor < 0.6) {
      return baseThreshold - 0.05; // 0.67 - poor quality: very lenient
    }
    if (qualityFactor < 0.75) {
      return baseThreshold - 0.03; // 0.69 - medium quality: slightly lenient
    }
    return baseThreshold; // 0.72 - good quality
  }

  /**
   * Calculate verification confidence based on multiple factors
   */
  private calculateVerificationConfidence(
    frameQuality: { isGood: boolean; score: number },
    currentStdDev: number,
    referenceStdDev: number,
    referenceQualityMetrics?: any
  ): number {
    let confidence = 1.0;
    
    // Factor 1: Current frame quality (40% weight)
    confidence *= (0.6 + 0.4 * frameQuality.score);
    
    // Factor 2: Embedding variance (30% weight)
    const varianceScore = Math.min(1, (currentStdDev + referenceStdDev) / 0.02);
    confidence *= (0.7 + 0.3 * varianceScore);
    
    // Factor 3: Reference photo quality (if available) (30% weight)
    if (referenceQualityMetrics) {
      const refQualityScore = referenceQualityMetrics.overallScore || 0.8;
      confidence *= (0.7 + 0.3 * refQualityScore);
    }
    
    return Math.min(1, confidence);
  }

  /**
   * Handle FACE_MISMATCH incident state machine with debouncing.
   * State flow: IDLE → DETECTING → TRIGGERED → COOLDOWN → IDLE
   * Requires consecutive mismatches to reduce false positives.
   * Grace period: no violation emitted in first 2 minutes after session start.
   * @returns true if a violation was emitted this call
   */
  private handleFaceMismatchIncident(isMismatch: boolean, similarity: number, thresholdUsed: number = FACE_VERIFICATION_SIMILARITY_THRESHOLD): boolean {
    const now = Date.now();
    const incident = this.faceMismatchIncident;
    const previousState = incident.state;

    // State: COOLDOWN
    if (incident.state === 'cooldown') {
      const cooldownElapsed = now - incident.lastTriggerTime;
      if (cooldownElapsed >= FACE_VERIFICATION_COOLDOWN && !isMismatch) {
        incident.state = 'idle';
        incident.detectionStartTime = null;
        incident.snapshotData = null;
        incident.consecutiveMismatches = 0;
        incident.lastSimilarity = 1.0;
        this.similarityHistory = [];
        console.log("[AIProctoringService] ✅ Face mismatch cooldown expired, reset to idle");
      } else {
        console.log("[AIProctoringService] ⏸️ Face mismatch in cooldown:", {
          cooldownElapsed: `${(cooldownElapsed / 1000).toFixed(1)}s`,
          cooldownDuration: `${FACE_VERIFICATION_COOLDOWN / 1000}s`,
          isMismatch,
        });
      }
      return false;
    }

    // State: IDLE
    if (incident.state === 'idle' && isMismatch) {
      incident.state = 'detecting';
      incident.detectionStartTime = now;
      incident.consecutiveMismatches = 1;
      incident.lastSimilarity = similarity;
      console.log("[AIProctoringService] ⚠️ Face mismatch detected - starting tracking (1st detection):", {
        similarity: similarity.toFixed(3),
        threshold: thresholdUsed.toFixed(3),
        required: FACE_VERIFICATION_CONSECUTIVE_REQUIRED,
      });
      return false;
    }

    // State: DETECTING
    if (incident.state === 'detecting') {
      if (!isMismatch) {
        const detectionDuration = incident.detectionStartTime ? now - incident.detectionStartTime : 0;
        incident.state = 'idle';
        incident.detectionStartTime = null;
        incident.consecutiveMismatches = 0;
        incident.lastSimilarity = similarity;
        this.similarityHistory = [];
        console.log("[AIProctoringService] ✅ Face mismatch cleared - similarity returned to normal:", {
          similarity: similarity.toFixed(3),
          detectionDuration: `${(detectionDuration / 1000).toFixed(1)}s`,
        });
        return false;
      }

      incident.consecutiveMismatches = (incident.consecutiveMismatches || 0) + 1;
      incident.lastSimilarity = similarity;

      if (incident.consecutiveMismatches >= FACE_VERIFICATION_CONSECUTIVE_REQUIRED) {
        const timeSinceStart = this.sessionStartTime ? now - this.sessionStartTime : 0;
        if (timeSinceStart < FACE_VERIFICATION_GRACE_PERIOD) {
          console.warn("[AIProctoringService] [Face Verification] Mismatch during grace period (not triggering violation):", {
            similarity: similarity.toFixed(3),
            threshold: thresholdUsed.toFixed(3),
            timeElapsed: `${(timeSinceStart / 1000).toFixed(0)}s`,
            gracePeriod: `${(FACE_VERIFICATION_GRACE_PERIOD / 1000)}s`,
          });
          incident.state = 'idle';
          incident.detectionStartTime = null;
          incident.consecutiveMismatches = 0;
          return false;
        }

        incident.state = 'triggered';
        incident.lastTriggerTime = now;
        incident.snapshotData = this.captureSnapshot();

        console.log("[AIProctoringService] 🚨 FACE_MISMATCH VIOLATION TRIGGERED!", {
          similarity: similarity.toFixed(3),
          threshold: thresholdUsed.toFixed(3),
          consecutiveMismatches: incident.consecutiveMismatches,
          hasSnapshot: !!incident.snapshotData,
        });

        this.emitViolation('FACE_MISMATCH', 'high', {
          similarityScore: similarity,
          threshold: thresholdUsed,
          consecutiveDetections: incident.consecutiveMismatches,
          duration: incident.detectionStartTime ? now - incident.detectionStartTime : 0,
        }, incident.snapshotData);

        incident.state = 'cooldown';
        incident.detectionStartTime = null;
        incident.consecutiveMismatches = 0;
        console.log("[AIProctoringService] ⏸️ Face mismatch violation emitted, entering cooldown");
        return true;
      }

      console.log("[AIProctoringService] ⏳ Face mismatch still detected:", {
        similarity: similarity.toFixed(3),
        threshold: thresholdUsed.toFixed(3),
        consecutiveMismatches: incident.consecutiveMismatches,
        required: FACE_VERIFICATION_CONSECUTIVE_REQUIRED,
      });
    }

    if (previousState !== incident.state) {
      console.log("[AIProctoringService] 🔄 Face mismatch state transition:", {
        from: previousState,
        to: incident.state,
        isMismatch,
        similarity: similarity.toFixed(3),
        consecutiveMismatches: incident.consecutiveMismatches || 0,
      });
    }
    return false;
  }

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
