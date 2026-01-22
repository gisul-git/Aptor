/**
 * Face Matching Module
 * 
 * Compares current face with reference image to detect face mismatches
 */

import { extractFaceLandmarks } from "./faceDetection";

export interface FaceMatchingResult {
  isMatch: boolean;
  similarity: number; // 0-1, where 1 is perfect match
  confidence: number;
}

/**
 * Normalize face landmarks for comparison
 * Removes position and scale dependency
 */
function normalizeLandmarksForComparison(landmarks: number[][]): number[][] | null {
  if (!landmarks || landmarks.length === 0) {
    return null;
  }

  // Get bounding box
  const xs = landmarks.map(p => p[0]);
  const ys = landmarks.map(p => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;

  if (width < 0.001 || height < 0.001) {
    return null;
  }

  // Normalize to 0-1 range
  return landmarks.map(p => [
    (p[0] - minX) / width,
    (p[1] - minY) / height,
  ]);
}

/**
 * Calculate face similarity between two sets of normalized landmarks
 * Uses Euclidean distance between corresponding points
 */
function calculateFaceSimilarity(
  landmarks1: number[][],
  landmarks2: number[][]
): number {
  if (!landmarks1 || !landmarks2) return 0;
  if (landmarks1.length !== landmarks2.length) return 0;

  // Calculate Euclidean distances between corresponding points
  let totalDistance = 0;
  let validPairs = 0;

  for (let i = 0; i < landmarks1.length; i++) {
    const dx = landmarks1[i][0] - landmarks2[i][0];
    const dy = landmarks1[i][1] - landmarks2[i][1];
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Ignore points that differ too much (possible detection errors)
    if (distance < 0.5) {
      totalDistance += distance;
      validPairs++;
    }
  }

  if (validPairs < landmarks1.length * 0.5) {
    return 0;
  }

  const avgDistance = totalDistance / validPairs;
  
  // Convert distance to similarity (0 = no match, 1 = perfect match)
  // Using exponential decay for smoother scoring
  // Threshold of 0.1 average distance = ~0.45 similarity
  return Math.exp(-avgDistance * 8);
}

/**
 * Match current face with reference face
 */
export function matchFace(
  currentLandmarks: any[] | null,
  referenceLandmarks: number[][] | null
): FaceMatchingResult {
  if (!currentLandmarks || !referenceLandmarks) {
    return {
      isMatch: false,
      similarity: 0,
      confidence: 0,
    };
  }

  // Extract and normalize current face landmarks
  const currentNormalized = extractFaceLandmarks(currentLandmarks);
  if (!currentNormalized) {
    return {
      isMatch: false,
      similarity: 0,
      confidence: 0,
    };
  }

  // Normalize reference landmarks if needed
  const referenceNormalized = normalizeLandmarksForComparison(referenceLandmarks);
  if (!referenceNormalized) {
    return {
      isMatch: false,
      similarity: 0,
      confidence: 0,
    };
  }

  // Calculate similarity
  const similarity = calculateFaceSimilarity(currentNormalized, referenceNormalized);

  // Threshold for matching (configurable, default 0.35)
  const MATCH_THRESHOLD = 0.35;
  const isMatch = similarity >= MATCH_THRESHOLD;

  return {
    isMatch,
    similarity,
    confidence: similarity, // Use similarity as confidence
  };
}

/**
 * Load reference face landmarks from an image
 */
export async function loadReferenceFaceFromImage(
  imageDataUrl: string,
  faceDetectionModule: any
): Promise<number[][] | null> {
  try {
    // Create an image element
    const img = new Image();
    img.crossOrigin = "anonymous";

    // Load image
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load reference image"));
      img.src = imageDataUrl;
    });

    // Detect face in reference image
    const detectionResult = await faceDetectionModule.detectFaces(img);
    
    if (detectionResult.state !== "SINGLE_FACE" || !detectionResult.landmarks) {
      console.warn("[FaceMatching] No face or multiple faces in reference image");
      return null;
    }

    // Extract and normalize landmarks
    const normalized = extractFaceLandmarks(detectionResult.landmarks);
    return normalized;
  } catch (error) {
    console.error("[FaceMatching] Failed to load reference face:", error);
    return null;
  }
}



