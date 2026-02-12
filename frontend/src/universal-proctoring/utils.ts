// ============================================================================
// Universal Proctoring System - Utility Functions
// ============================================================================

import {
  GazeDirection,
  GAZE_THRESHOLDS,
  EYE_AR_THRESHOLD,
} from "./types";

// ============================================================================
// Debug Logger
// ============================================================================

let debugEnabled = false;

export function setDebugMode(enabled: boolean): void {
  debugEnabled = enabled;
}

export function isDebugMode(): boolean {
  if (typeof window === "undefined") return debugEnabled;
  const urlParams = new URLSearchParams(window.location.search);
  return (
    debugEnabled ||
    urlParams.get("proctorDebug") === "true" ||
    urlParams.get("cameraDebug") === "true" ||
    process.env.NEXT_PUBLIC_CAMERA_DEBUG === "true"
  );
}

export function debugLog(...args: unknown[]): void {
  if (isDebugMode()) {
    console.log("[UniversalProctor]", ...args);
  }
}

// ============================================================================
// Eye Aspect Ratio (EAR) Calculation for Blink Detection
// Preserved from useCameraProctor.ts
// ============================================================================

/**
 * Calculate Eye Aspect Ratio (EAR) for blink detection.
 * EAR = (v1 + v2) / (2 * h) where v1, v2 are vertical distances, h is horizontal.
 * @param eyeLandmarks - Array of [x, y] coordinates for 6 eye landmarks
 * @returns EAR value (lower = more closed)
 */
export function calculateEAR(eyeLandmarks: number[][]): number {
  if (eyeLandmarks.length < 6) return 1;

  // Vertical distances
  const v1 = Math.sqrt(
    Math.pow(eyeLandmarks[1][0] - eyeLandmarks[5][0], 2) +
      Math.pow(eyeLandmarks[1][1] - eyeLandmarks[5][1], 2)
  );
  const v2 = Math.sqrt(
    Math.pow(eyeLandmarks[2][0] - eyeLandmarks[4][0], 2) +
      Math.pow(eyeLandmarks[2][1] - eyeLandmarks[4][1], 2)
  );

  // Horizontal distance
  const h = Math.sqrt(
    Math.pow(eyeLandmarks[0][0] - eyeLandmarks[3][0], 2) +
      Math.pow(eyeLandmarks[0][1] - eyeLandmarks[3][1], 2)
  );

  if (h === 0) return 1;
  return (v1 + v2) / (2.0 * h);
}

/**
 * Check if eyes are closed (blinking).
 * @param leftEAR - Left eye aspect ratio
 * @param rightEAR - Right eye aspect ratio
 * @returns true if blinking
 */
export function isBlinking(leftEAR: number, rightEAR: number): boolean {
  const avgEAR = (leftEAR + rightEAR) / 2;
  return avgEAR < EYE_AR_THRESHOLD;
}

// ============================================================================
// Gaze Direction Calculation
// Preserved from useCameraProctor.ts
// ============================================================================

/**
 * Calculate gaze direction from iris position relative to eye corners.
 * Uses the relative position of the iris within the eye socket to determine
 * where the person is looking.
 *
 * @param leftIris - [x, y] coordinates of left iris center
 * @param rightIris - [x, y] coordinates of right iris center
 * @param leftEyeCorners - 4 corner points of left eye
 * @param rightEyeCorners - 4 corner points of right eye
 * @returns GazeDirection with direction and confidence
 */
export function calculateGazeDirection(
  leftIris: number[] | null,
  rightIris: number[] | null,
  leftEyeCorners: number[][] | null,
  rightEyeCorners: number[][] | null
): GazeDirection {
  if (!leftIris || !rightIris || !leftEyeCorners || !rightEyeCorners) {
    return { direction: "away", confidence: 0.5 };
  }

  // Calculate relative position of iris within eye socket for LEFT eye
  const leftEyeWidth = Math.abs(leftEyeCorners[1][0] - leftEyeCorners[0][0]);
  const leftEyeHeight =
    Math.abs(leftEyeCorners[3][1] - leftEyeCorners[2][1]) || leftEyeWidth * 0.5;
  const leftIrisRelX =
    leftEyeWidth > 0
      ? (leftIris[0] - (leftEyeCorners[0][0] + leftEyeCorners[1][0]) / 2) /
        leftEyeWidth
      : 0;
  const leftIrisRelY =
    leftEyeHeight > 0
      ? (leftIris[1] - (leftEyeCorners[2][1] + leftEyeCorners[3][1]) / 2) /
        leftEyeHeight
      : 0;

  // Calculate relative position of iris within eye socket for RIGHT eye
  const rightEyeWidth = Math.abs(rightEyeCorners[1][0] - rightEyeCorners[0][0]);
  const rightEyeHeight =
    Math.abs(rightEyeCorners[3][1] - rightEyeCorners[2][1]) ||
    rightEyeWidth * 0.5;
  const rightIrisRelX =
    rightEyeWidth > 0
      ? (rightIris[0] - (rightEyeCorners[0][0] + rightEyeCorners[1][0]) / 2) /
        rightEyeWidth
      : 0;
  const rightIrisRelY =
    rightEyeHeight > 0
      ? (rightIris[1] - (rightEyeCorners[2][1] + rightEyeCorners[3][1]) / 2) /
        rightEyeHeight
      : 0;

  // Average the gaze from both eyes
  const avgX = (leftIrisRelX + rightIrisRelX) / 2;
  const avgY = (leftIrisRelY + rightIrisRelY) / 2;

  // Determine direction based on thresholds
  let direction: GazeDirection["direction"] = "center";
  let confidence = 0.8;

  if (avgX < GAZE_THRESHOLDS.LEFT) {
    direction = "left";
    confidence = Math.min(1, Math.abs(avgX - GAZE_THRESHOLDS.LEFT) * 5 + 0.6);
  } else if (avgX > GAZE_THRESHOLDS.RIGHT) {
    direction = "right";
    confidence = Math.min(1, Math.abs(avgX - GAZE_THRESHOLDS.RIGHT) * 5 + 0.6);
  } else if (avgY < GAZE_THRESHOLDS.UP) {
    direction = "up";
    confidence = Math.min(1, Math.abs(avgY - GAZE_THRESHOLDS.UP) * 5 + 0.6);
  } else if (avgY > GAZE_THRESHOLDS.DOWN) {
    direction = "down";
    confidence = Math.min(1, Math.abs(avgY - GAZE_THRESHOLDS.DOWN) * 5 + 0.6);
  }

  return { direction, confidence };
}

// ============================================================================
// MediaPipe FaceMesh Landmark Indices
// ============================================================================

/**
 * MediaPipe FaceMesh landmark indices for eye detection.
 * These are the standard indices used by the TensorFlow.js face-landmarks-detection model.
 */
export const FACE_MESH_LANDMARKS = {
  // Left eye landmarks (6 points for EAR calculation)
  LEFT_EYE: [33, 133, 160, 144, 145, 153],
  // Right eye landmarks (6 points for EAR calculation)
  RIGHT_EYE: [362, 263, 387, 373, 374, 380],
  // Left eye corners (for gaze calculation)
  LEFT_EYE_CORNERS: [33, 133, 159, 145],
  // Right eye corners (for gaze calculation)
  RIGHT_EYE_CORNERS: [362, 263, 386, 374],
  // Iris centers (for gaze direction)
  LEFT_IRIS: 468,
  RIGHT_IRIS: 473,
};

/**
 * Extract eye landmarks from FaceMesh keypoints.
 * @param keypoints - Array of keypoints from FaceMesh prediction
 * @returns Object containing all eye-related landmarks
 */
export function extractEyeLandmarks(keypoints: Array<{ x: number; y: number }>) {
  const getPoint = (index: number): [number, number] => {
    const kp = keypoints[index];
    return kp ? [kp.x, kp.y] : [0, 0];
  };

  const getPoints = (indices: number[]): number[][] => {
    return indices.map((i) => getPoint(i));
  };

  return {
    leftEye: getPoints(FACE_MESH_LANDMARKS.LEFT_EYE),
    rightEye: getPoints(FACE_MESH_LANDMARKS.RIGHT_EYE),
    leftEyeCorners: getPoints(FACE_MESH_LANDMARKS.LEFT_EYE_CORNERS),
    rightEyeCorners: getPoints(FACE_MESH_LANDMARKS.RIGHT_EYE_CORNERS),
    leftIris: keypoints[FACE_MESH_LANDMARKS.LEFT_IRIS]
      ? [
          keypoints[FACE_MESH_LANDMARKS.LEFT_IRIS].x,
          keypoints[FACE_MESH_LANDMARKS.LEFT_IRIS].y,
        ]
      : null,
    rightIris: keypoints[FACE_MESH_LANDMARKS.RIGHT_IRIS]
      ? [
          keypoints[FACE_MESH_LANDMARKS.RIGHT_IRIS].x,
          keypoints[FACE_MESH_LANDMARKS.RIGHT_IRIS].y,
        ]
      : null,
  };
}

// ============================================================================
// Throttle Helper
// ============================================================================

/**
 * Create a throttle tracker for event recording.
 * Prevents spam of the same event type within the throttle interval.
 */
export function createThrottleTracker(throttleMs: number) {
  const lastEventTimes: Record<string, number> = {};

  return {
    /**
     * Check if an event should be recorded (not throttled).
     * @param eventType - The type of event
     * @returns true if the event should be recorded
     */
    shouldRecord(eventType: string): boolean {
      const now = Date.now();
      const lastTime = lastEventTimes[eventType] || 0;

      if (now - lastTime < throttleMs) {
        debugLog(`Throttled ${eventType} (last: ${now - lastTime}ms ago)`);
        return false;
      }

      lastEventTimes[eventType] = now;
      return true;
    },

    /**
     * Reset the throttle timer for a specific event type.
     */
    reset(eventType: string): void {
      delete lastEventTimes[eventType];
    },

    /**
     * Reset all throttle timers.
     */
    resetAll(): void {
      Object.keys(lastEventTimes).forEach((key) => delete lastEventTimes[key]);
    },
  };
}

// ============================================================================
// Consecutive Counter Helper
// ============================================================================

/**
 * Create a consecutive counter for threshold-based detection.
 * Used for gaze away, no face, etc. where we need N consecutive detections.
 */
export function createConsecutiveCounter(threshold: number) {
  let count = 0;

  return {
    /**
     * Increment the counter and check if threshold is reached.
     * @returns true if threshold is reached (triggers violation)
     */
    increment(): boolean {
      count += 1;
      if (count >= threshold) {
        count = 0; // Reset after triggering
        return true;
      }
      return false;
    },

    /**
     * Reset the counter to zero.
     */
    reset(): void {
      count = 0;
    },

    /**
     * Get current count.
     */
    getCount(): number {
      return count;
    },
  };
}

// ============================================================================
// Timestamp Helper
// ============================================================================

/**
 * Get current ISO timestamp string.
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}
