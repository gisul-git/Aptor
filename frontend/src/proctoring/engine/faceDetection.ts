/**
 * Face Detection Module using MediaPipe Face Detection (BlazeFace)
 * 
 * Fast and accurate face detection using BlazeFace model
 */

import * as blazeface from "@tensorflow-models/blazeface";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";

// Suppress TensorFlow.js kernel registration warnings
// These warnings occur when multiple libraries initialize TensorFlow.js
if (typeof window !== 'undefined' && typeof (tf as any).setLogLevel === 'function') {
  (tf as any).setLogLevel('error'); // Only show errors, suppress warnings
}

export type FaceDetectionState = "NO_FACE" | "SINGLE_FACE_CENTERED" | "FACE_OFF_CENTER" | "MULTIPLE_FACES";

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceDetectionResult {
  state: FaceDetectionState;
  faceCount: number;
  landmarks?: any[];
  confidence?: number;
  faceBoxes?: FaceBox[];
  centerStatus?: "CENTERED" | "OFF_CENTER";
}

export interface FaceDetectionModule {
  initialize: () => Promise<boolean>;
  detectFaces: (videoElement: HTMLVideoElement) => Promise<FaceDetectionResult>;
  cleanup: () => void;
  isInitialized: () => boolean;
}

let faceDetector: blazeface.BlazeFaceModel | null = null;
let isModelLoaded = false;

/**
 * Initialize BlazeFace detector (fast face detection model)
 * Now uses Global Model Service to reuse pre-loaded models
 */
export async function initializeFaceDetection(): Promise<boolean> {
  try {
    if (isModelLoaded && faceDetector) {
      return true;
    }

    // Try to get model from Global Model Service first (may be pre-loaded)
    try {
      const { modelService } = await import("@/universal-proctoring/services/ModelService");
      const cachedModel = modelService.getBlazeFace();
      if (cachedModel) {
        console.log("[FaceDetection] ✅ Reusing BlazeFace model from ModelService");
        faceDetector = cachedModel;
        isModelLoaded = true;
        return true;
      }
      
      // If not cached, load it (will be cached by ModelService)
      console.log("[FaceDetection] BlazeFace not cached, loading via ModelService...");
      const model = await modelService.loadBlazeFace();
      if (model) {
        faceDetector = model;
        isModelLoaded = true;
        console.log("[FaceDetection] ✅ BlazeFace model loaded via ModelService");
        return true;
      }
    } catch (modelServiceError) {
      console.warn("[FaceDetection] ModelService not available, falling back to direct load:", modelServiceError);
    }

    // Fallback: Direct load if ModelService fails
    console.log("[FaceDetection] Falling back to direct BlazeFace load...");
    await tf.ready();
    
    // Prefer WebGL backend for better performance
    try {
      await tf.setBackend("webgl");
      await tf.ready();
    } catch (e) {
      console.warn("[FaceDetection] WebGL backend not available, using CPU");
      await tf.setBackend("cpu");
      await tf.ready();
    }

    // Load BlazeFace model (fast and accurate)
    faceDetector = await blazeface.load();

    isModelLoaded = true;
    console.log("[FaceDetection] BlazeFace model loaded successfully (direct load)");
    return true;
  } catch (error) {
    console.error("[FaceDetection] Failed to initialize:", error);
    isModelLoaded = false;
    return false;
  }
}

/**
 * Convert landmarks to array format (handles Tensor2D or number[][])
 */
function convertLandmarksToArray(landmarks: any): any[] | undefined {
  if (!landmarks) {
    return undefined;
  }
  
  // If it's already an array, return it
  if (Array.isArray(landmarks)) {
    return landmarks;
  }
  
  // If it's a Tensor, convert to array
  if (landmarks && typeof landmarks.array === 'function') {
    return landmarks.arraySync() as any[];
  }
  
  // Try to access as array-like
  if (landmarks && landmarks.length !== undefined) {
    return Array.from(landmarks) as any[];
  }
  
  return undefined;
}

/**
 * Extract confidence value from probability (handles number or Tensor1D)
 */
function extractConfidence(probability: any): number {
  if (!probability) {
    return 0.9;
  }
  
  // If it's a number, return it
  if (typeof probability === 'number') {
    return probability;
  }
  
  // If it's a Tensor, get the first value
  if (probability && typeof probability.array === 'function') {
    const arr = probability.arraySync() as number[];
    return arr && arr.length > 0 ? arr[0] : 0.9;
  }
  
  // If it's an array-like, get first element
  if (Array.isArray(probability) && probability.length > 0) {
    return probability[0];
  }
  
  // If it has index access
  if (probability && probability[0] !== undefined) {
    return probability[0];
  }
  
  return 0.9;
}

/**
 * Extract coordinate value from point (handles Tensor1D or [number, number])
 */
function extractCoordinate(point: any, index: 0 | 1): number {
  if (!point) {
    return 0;
  }
  
  // If it's an array, return the index
  if (Array.isArray(point) && point.length > index) {
    return point[index];
  }
  
  // If it's a Tensor, convert to array and get index
  if (point && typeof point.array === 'function') {
    const arr = point.arraySync() as number[];
    return arr && arr.length > index ? arr[index] : 0;
  }
  
  // If it has index access
  if (point && point[index] !== undefined) {
    return point[index];
  }
  
  return 0;
}

/**
 * Detect faces in a video element
 */
export async function detectFaces(videoElement: HTMLVideoElement): Promise<FaceDetectionResult> {
  if (!isModelLoaded || !faceDetector) {
    return {
      state: "NO_FACE",
      faceCount: 0,
    };
  }

  // Check if video is ready (readyState >= 2 means enough data loaded)
  if (videoElement.readyState < 2) {
    return {
      state: "NO_FACE",
      faceCount: 0,
    };
  }

  try {
    // Run face detection with BlazeFace
    // BlazeFace returns predictions with bounding boxes and landmarks
    const predictions = await faceDetector.estimateFaces(videoElement, false);

    const faceCount = predictions.length;
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    // Accurate face count detection
    if (faceCount === 0) {
      return {
        state: "NO_FACE",
        faceCount: 0,
      };
    } else if (faceCount > 1) {
      // Multiple faces detected
      const faceBoxes: FaceBox[] = predictions.map((p: any) => ({
        x: extractCoordinate(p.topLeft, 0),
        y: extractCoordinate(p.topLeft, 1),
        width: extractCoordinate(p.bottomRight, 0) - extractCoordinate(p.topLeft, 0),
        height: extractCoordinate(p.bottomRight, 1) - extractCoordinate(p.topLeft, 1),
      }));
      const firstFaceLandmarks = convertLandmarksToArray(predictions[0].landmarks);
      const firstFaceConfidence = extractConfidence(predictions[0].probability);
      return {
        state: "MULTIPLE_FACES",
        faceCount: faceCount,
        landmarks: firstFaceLandmarks, // Return first face landmarks
        confidence: firstFaceConfidence,
        faceBoxes,
      };
    } else {
      // Single face detected - check if centered
      const face = predictions[0];
      
      // Extract bounding box coordinates
      const bboxX = extractCoordinate(face.topLeft, 0);
      const bboxY = extractCoordinate(face.topLeft, 1);
      const bboxWidth = extractCoordinate(face.bottomRight, 0) - extractCoordinate(face.topLeft, 0);
      const bboxHeight = extractCoordinate(face.bottomRight, 1) - extractCoordinate(face.topLeft, 1);
      
      // Normalize coordinates to 0-1 range
      const normalizedX = bboxX / videoWidth;
      const normalizedY = bboxY / videoHeight;
      const normalizedWidth = bboxWidth / videoWidth;
      const normalizedHeight = bboxHeight / videoHeight;
      
      // Calculate face center in normalized coordinates
      const faceCenterX = normalizedX + normalizedWidth / 2;
      const faceCenterY = normalizedY + normalizedHeight / 2;
      
      // Check if face is in center safe zone
      // Horizontal: 0.30 ≤ faceCenterX ≤ 0.70
      // Vertical: 0.25 ≤ faceCenterY ≤ 0.75
      const isCentered = 
        faceCenterX >= 0.30 && faceCenterX <= 0.70 &&
        faceCenterY >= 0.25 && faceCenterY <= 0.75;
      
      const faceBox: FaceBox = {
        x: bboxX,
        y: bboxY,
        width: bboxWidth,
        height: bboxHeight,
      };
      
      const faceLandmarks = convertLandmarksToArray(face.landmarks);
      const faceConfidence = extractConfidence(face.probability);
      
      if (isCentered) {
        return {
          state: "SINGLE_FACE_CENTERED",
          faceCount: 1,
          landmarks: faceLandmarks,
          confidence: faceConfidence,
          faceBoxes: [faceBox],
          centerStatus: "CENTERED",
        };
      } else {
        return {
          state: "FACE_OFF_CENTER",
          faceCount: 1,
          landmarks: faceLandmarks,
          confidence: faceConfidence,
          faceBoxes: [faceBox],
          centerStatus: "OFF_CENTER",
        };
      }
    }
  } catch (error) {
    console.error("[FaceDetection] Detection error:", error);
    return {
      state: "NO_FACE",
      faceCount: 0,
    };
  }
}

/**
 * Extract face landmarks for face matching
 */
export function extractFaceLandmarks(landmarks: any[]): number[][] | null {
  if (!landmarks || landmarks.length < 6) {
    return null;
  }

  // BlazeFace provides 6 key facial landmarks:
  // right eye, left eye, nose tip, mouth center, right mouth corner, left mouth corner
  const relevantPoints = landmarks.slice(0, 6).filter(p => p);
  if (relevantPoints.length < 4) {
    return null;
  }

  // Get bounding box for normalization
  const xs = relevantPoints.map(p => p[0]);
  const ys = relevantPoints.map(p => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;

  if (width < 10 || height < 10) {
    return null;
  }

  // Normalize to 0-1 range relative to face bounding box
  return relevantPoints.map(p => [
    (p[0] - minX) / width,
    (p[1] - minY) / height,
  ]);
}

/**
 * Cleanup face detection module
 */
export function cleanupFaceDetection(): void {
  if (faceDetector) {
    faceDetector = null;
    isModelLoaded = false;
    console.log("[FaceDetection] Cleaned up");
  }
}

/**
 * Check if face detection is initialized
 */
export function isFaceDetectionInitialized(): boolean {
  return isModelLoaded && faceDetector !== null;
}

/**
 * Create a face detection module instance
 */
export function createFaceDetectionModule(): FaceDetectionModule {
  return {
    initialize: initializeFaceDetection,
    detectFaces: detectFaces,
    cleanup: cleanupFaceDetection,
    isInitialized: isFaceDetectionInitialized,
  };
}