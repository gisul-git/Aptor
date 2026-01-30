/**
 * Identity Verification Component
 * 
 * Reusable component for face capture with BlazeFace detection
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { initializeFaceDetection, detectFaces, cleanupFaceDetection, type FaceDetectionState } from "../engine/faceDetection";
import { modelService } from "@/universal-proctoring/services/ModelService";
import { FaceVerificationService } from "@/universal-proctoring/services/FaceVerificationService";
import axios from "@/lib/axios-config"; // Use configured axios with auth interceptor
import { getGateContext } from "@/lib/gateContext";

/**
 * Extract confidence value from probability (handles number, array, Tensor, undefined)
 * Same logic as faceDetection.ts extractConfidence function
 */
function extractConfidence(probability: any): number {
  if (!probability) {
    return 0.9; // Default to high confidence if not available
  }
  
  // If it's a number, return it
  if (typeof probability === 'number') {
    return probability;
  }
  
  // If it's a Tensor, get the first value
  if (probability && typeof probability.array === 'function') {
    try {
      const arr = probability.arraySync() as number[];
      return arr && arr.length > 0 ? arr[0] : 0.9;
    } catch (e) {
      return 0.9;
    }
  }
  
  // If it's an array-like, get first element
  if (Array.isArray(probability) && probability.length > 0) {
    return probability[0];
  }
  
  // If it has index access
  if (probability && probability[0] !== undefined) {
    return probability[0];
  }
  
  return 0.9; // Default to high confidence
}

export interface IdentityVerificationProps {
  assessmentId: string;
  token: string;
  candidateEmail: string;
  /**
   * Only AI assessments have a matching backend "assessments" record for save-reference-face.
   * For other flows (DSA/AIML/Custom MCQ) we should skip the backend call and store locally.
   */
  skipBackendSave?: boolean;
  /**
   * Whether AI Proctoring is enabled for this assessment.
   * If true: Extract face embeddings for face mismatch detection
   * If false: Just capture photo, no embedding extraction
   */
  aiProctoringEnabled?: boolean;
  /**
   * Whether Face Mismatch Detection is enabled for this assessment.
   * Only used if aiProctoringEnabled is true.
   * If false, embedding extraction is skipped (face verification disabled).
   */
  faceMismatchEnabled?: boolean;
  onCaptureComplete: (photoDataUrl: string) => void;
  onError?: (error: string) => void;
}

export default function IdentityVerification({
  assessmentId,
  token,
  candidateEmail,
  skipBackendSave = false,
  aiProctoringEnabled = false,
  faceMismatchEnabled = false,
  onCaptureComplete,
  onError,
}: IdentityVerificationProps) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [faceDetectionState, setFaceDetectionState] = useState<FaceDetectionState>("NO_FACE");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [photoQualityValid, setPhotoQualityValid] = useState(false);
  const [photoQualityErrors, setPhotoQualityErrors] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionAnimationFrameRef = useRef<number | null>(null);
  const isDetectionRunningRef = useRef(false);
  const isModelLoadedRef = useRef(false);
  const isSavingRef = useRef(false); // Guard to prevent duplicate saves

  // Optimized camera initialization - fast and seamless
  useEffect(() => {
    const initCamera = async () => {
      try {
        // Get camera stream with optimized settings for fast startup (100-200ms)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 640 },
            height: { ideal: 480, max: 480 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: "user",
          },
        });

        setCameraStream(stream);

        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = stream;
          
          // Don't wait for metadata - start playing immediately
          try {
            await video.play();
            setIsCameraReady(true);
          } catch (playError: any) {
            if (playError.name !== "AbortError" && playError.name !== "NotAllowedError") {
              console.warn("Video play() error (non-critical):", playError);
            }
            setIsCameraReady(true);
          }
        }

        // Start detection loop immediately (even before model loads)
        startDetectionLoop();

        // CRITICAL: Check if models are already pre-loaded from Precheck page
        // Models should already be loaded during precheck phase - no need to load again
        if (modelService.areAllModelsLoaded()) {
          console.log("[IdentityVerification] ✅ Models already pre-loaded from Precheck - using cached models");
          // Models already loaded - just initialize face detection
          initializeFaceDetection()
            .then((initialized) => {
              if (initialized) {
                setIsModelLoaded(true);
                isModelLoadedRef.current = true;
                console.log("[IdentityVerification] ✅ All models ready - assessment can start immediately");
                // Status message will be updated by detection loop once model is ready
              } else {
                console.error("[IdentityVerification] Failed to initialize face detection");
                setStatusMessage("Failed to initialize face detection. Please refresh the page.");
                if (onError) {
                  onError("Failed to initialize face detection");
                }
              }
            })
            .catch((error) => {
              console.error("[IdentityVerification] Face detection initialization error:", error);
              setStatusMessage("Failed to initialize face detection. Please refresh the page.");
              if (onError) {
                onError("Failed to initialize face detection");
              }
            });
        } else {
          // Models not pre-loaded (edge case - should not happen if precheck ran)
          // Load them now as fallback
          setStatusMessage("Loading models...");
          console.log("[IdentityVerification] Models not pre-loaded, loading now (fallback)...");
          
          modelService.loadAllModels()
            .then(({ blazeface, faceMesh }) => {
              console.log("[IdentityVerification] Models loaded:", {
                blazeface: !!blazeface,
                faceMesh: !!faceMesh
              });
              
              // Initialize face detection (uses BlazeFace from ModelService)
              return initializeFaceDetection();
            })
            .then((initialized) => {
              if (initialized) {
                setIsModelLoaded(true);
                isModelLoadedRef.current = true;
                console.log("[IdentityVerification] ✅ All models ready - assessment can start immediately");
                // Status message will be updated by detection loop once model is ready
              } else {
                console.error("[IdentityVerification] Failed to initialize face detection");
                setStatusMessage("Failed to initialize face detection. Please refresh the page.");
                if (onError) {
                  onError("Failed to initialize face detection");
                }
              }
            })
            .catch((error) => {
              console.error("[IdentityVerification] Model loading error:", error);
              setStatusMessage("Failed to initialize face detection. Please refresh the page.");
              if (onError) {
                onError("Failed to initialize face detection");
              }
            });
        }
      } catch (error: any) {
        if (error?.name === "AbortError") {
          return;
        }
        console.error("Error accessing camera:", error);
        setStatusMessage("Failed to access camera. Please check permissions.");
        if (onError) {
          onError("Failed to access camera");
        }
      }
    };

    initCamera();

    return () => {
      stopDetectionLoop();
      isModelLoadedRef.current = false;
      // Only cleanup if camera stream still exists (component unmounting)
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      // Cleanup face detection on unmount (safe to call multiple times)
      cleanupFaceDetection();
    };
  }, []);

  // Optimized detection loop using requestAnimationFrame - runs immediately
  const startDetectionLoop = useCallback(() => {
    if (isDetectionRunningRef.current) {
      return;
    }

    isDetectionRunningRef.current = true;

    const detectionLoop = async () => {
      if (!videoRef.current) {
        isDetectionRunningRef.current = false;
        return;
      }

      const video = videoRef.current;

      // Only detect if video is ready and model is loaded
      if (video.readyState >= 2 && isModelLoadedRef.current) {
        try {
          const detectionResult = await detectFaces(video);
          
          // Update state inside animation frame for smooth UI updates
          setFaceDetectionState(detectionResult.state);

          // Update status message based on detection state (no loading messages)
          if (detectionResult.state === "NO_FACE") {
            setStatusMessage("No face detected. Please ensure your face is visible.");
          } else if (detectionResult.state === "MULTIPLE_FACES") {
            setStatusMessage(`Multiple faces detected (${detectionResult.faceCount}). Please ensure only you are visible.`);
          } else if (detectionResult.state === "FACE_OFF_CENTER") {
            setStatusMessage("Please move your face to the center of the frame.");
          } else if (detectionResult.state === "SINGLE_FACE_CENTERED") {
            setStatusMessage("Face detected and centered. Click 'Capture Photo' when ready.");
          }
        } catch (error) {
          console.error("Face detection error:", error);
        }
      }

      // Continue loop (runs even if model isn't ready yet)
      if (isDetectionRunningRef.current) {
        detectionAnimationFrameRef.current = requestAnimationFrame(detectionLoop);
      }
    };

    // Start the loop immediately
    detectionAnimationFrameRef.current = requestAnimationFrame(detectionLoop);
  }, []);

  const stopDetectionLoop = useCallback(() => {
    isDetectionRunningRef.current = false;
    if (detectionAnimationFrameRef.current !== null) {
      cancelAnimationFrame(detectionAnimationFrameRef.current);
      detectionAnimationFrameRef.current = null;
    }
  }, []);

  /**
   * Detect hand or object covering face using improved pixel analysis
   * Uses relative comparison with face baseline to avoid false positives
   */
  const detectHandCoverage = async (
    image: HTMLImageElement,
    face: any,
    landmarks: number[][]
  ): Promise<{ hasHandCoverage: boolean; errorMessage?: string }> => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { hasHandCoverage: false };

      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Get face bounding box
      const start = face.topLeft as [number, number];
      const end = face.bottomRight as [number, number];
      const faceWidth = end[0] - start[0];
      const faceHeight = end[1] - start[1];

      // Get eye positions from landmarks
      const rightEye = landmarks[0];
      const leftEye = landmarks[1];
      if (!rightEye || !leftEye || rightEye.length < 2 || leftEye.length < 2) {
        return { hasHandCoverage: false };
      }

      // Improved skin tone detection for all skin tones (light to dark)
      const isSkinTone = (r: number, g: number, b: number): boolean => {
        // Convert to HSV for better skin tone detection
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        const v = max / 255;
        const s = max === 0 ? 0 : delta / max;
        const h = max === 0 ? 0 :
                  max === r ? ((g - b) / delta) % 6 :
                  max === g ? (b - r) / delta + 2 :
                  (r - g) / delta + 4;
        const hue = h * 60;

        // Skin tone ranges in HSV:
        // Hue: 0-50 (red to yellow) - covers all human skin tones
        // Saturation: 0.1-0.7 (some color, not too saturated)
        // Value: 0.2-0.95 (not too dark, not too bright)
        const isHueInRange = (hue >= 0 && hue <= 50) || (hue >= 350 && hue <= 360);
        const isSaturationInRange = s >= 0.1 && s <= 0.7;
        const isValueInRange = v >= 0.2 && v <= 0.95;

        // Additional check: skin tones have R > G > B pattern (generally)
        const hasSkinColorPattern = r > g && g > b && (r - g) > 10 && (r - b) > 15;

        return isHueInRange && isSaturationInRange && isValueInRange && hasSkinColorPattern;
      };

      // Sample face region to establish baseline skin tone distribution
      const sampleFaceRegion = (): { skinToneRatio: number; avgBrightness: number; stdDevBrightness: number } => {
        let skinTonePixels = 0;
        let totalPixels = 0;
        const brightnessValues: number[] = [];

        // Sample from multiple face regions (cheeks, forehead) for better baseline
        const sampleRegions = [
          { x: start[0] + faceWidth * 0.2, y: start[1] + faceHeight * 0.15, w: faceWidth * 0.25, h: faceHeight * 0.25 }, // Left cheek
          { x: start[0] + faceWidth * 0.55, y: start[1] + faceHeight * 0.15, w: faceWidth * 0.25, h: faceHeight * 0.25 }, // Right cheek
          { x: start[0] + faceWidth * 0.3, y: start[1] + faceHeight * 0.05, w: faceWidth * 0.4, h: faceHeight * 0.15 }, // Forehead
        ];

        for (const region of sampleRegions) {
          for (let y = region.y; y < region.y + region.h && y < canvas.height; y++) {
            for (let x = region.x; x < region.x + region.w && x < canvas.width; x++) {
              const idx = (y * canvas.width + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const brightness = (r + g + b) / 3;
              
              totalPixels++;
              brightnessValues.push(brightness);
              
              if (isSkinTone(r, g, b)) {
                skinTonePixels++;
              }
            }
          }
        }

        const avgBrightness = brightnessValues.length > 0 
          ? brightnessValues.reduce((sum, val) => sum + val, 0) / brightnessValues.length 
          : 0;
        
        const variance = brightnessValues.length > 0
          ? brightnessValues.reduce((sum, val) => sum + Math.pow(val - avgBrightness, 2), 0) / brightnessValues.length
          : 0;
        const stdDevBrightness = Math.sqrt(variance);

        return {
          skinToneRatio: totalPixels > 0 ? skinTonePixels / totalPixels : 0,
          avgBrightness,
          stdDevBrightness,
        };
      };

      const faceBaseline = sampleFaceRegion();

      // Check if eyes are actually visible (simpler and more reliable than hand detection)
      // Eyes should have: darker center (pupil/iris), lighter surrounding (sclera), contrast
      const checkEyeVisibility = (eyeX: number, eyeY: number): boolean => {
        const eyeRegionSize = 15; // Very small region focused on eye center
        const brightnessValues: number[] = [];
        let totalPixels = 0;

        // Sample pixels in small eye region
        for (let dy = -eyeRegionSize; dy <= eyeRegionSize; dy++) {
          for (let dx = -eyeRegionSize; dx <= eyeRegionSize; dx++) {
            const x = Math.round(eyeX + dx);
            const y = Math.round(eyeY + dy);
            
            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
            
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const brightness = (r + g + b) / 3;
            
            brightnessValues.push(brightness);
            totalPixels++;
          }
        }

        if (totalPixels === 0) return true; // Can't determine, assume visible

        // Calculate brightness statistics
        const avgBrightness = brightnessValues.reduce((sum, val) => sum + val, 0) / brightnessValues.length;
        const minBrightness = Math.min(...brightnessValues);
        const maxBrightness = Math.max(...brightnessValues);
        const brightnessRange = maxBrightness - minBrightness;
        
        // Calculate variance (contrast) - eyes should have good contrast
        const variance = brightnessValues.reduce((sum, val) => sum + Math.pow(val - avgBrightness, 2), 0) / brightnessValues.length;
        const stdDev = Math.sqrt(variance);

        // Eyes are visible if:
        // 1. Good contrast (stdDev > 15) - eyes have dark pupil and light sclera
        // 2. Reasonable brightness range (>30) - not uniform (which would indicate occlusion)
        // 3. Average brightness is reasonable (not too bright like uniform skin)
        const hasGoodContrast = stdDev > 15;
        const hasGoodRange = brightnessRange > 30;
        const hasReasonableBrightness = avgBrightness > 30 && avgBrightness < 200;

        const isVisible = hasGoodContrast && hasGoodRange && hasReasonableBrightness;

        console.log('[IdentityVerification] 👁️ Eye visibility check:', {
          eyeX: Math.round(eyeX),
          eyeY: Math.round(eyeY),
          avgBrightness: avgBrightness.toFixed(1),
          brightnessRange: brightnessRange.toFixed(1),
          stdDev: stdDev.toFixed(1),
          hasGoodContrast,
          hasGoodRange,
          hasReasonableBrightness,
          isVisible,
        });

        return isVisible;
      };

      const rightEyeX = rightEye[0];
      const rightEyeY = rightEye[1];
      const leftEyeX = leftEye[0];
      const leftEyeY = leftEye[1];

      // Check if eyes are actually visible (simpler and more reliable approach)
      const rightEyeVisible = checkEyeVisibility(rightEyeX, rightEyeY);
      const leftEyeVisible = checkEyeVisibility(leftEyeX, leftEyeY);

      // NEW: Check mouth/nose visibility (critical for face recognition)
      // Mouth should be around 60-70% down from top of face, nose around 40-50%
      // faceHeight is already defined above (line 302), so reuse it
      const faceTop = start[1];
      const faceBottom = end[1];
      // faceHeight already defined: const faceHeight = end[1] - start[1];
      const expectedMouthY = faceTop + faceHeight * 0.65; // Mouth is ~65% down
      const expectedNoseY = faceTop + faceHeight * 0.45; // Nose is ~45% down
      const faceCenterX = (start[0] + end[0]) / 2;
      
      // Check mouth region (center of lower face)
      const checkMouthVisibility = (): boolean => {
        const mouthRegionSize = Math.max(20, faceWidth * 0.15); // 15% of face width
        const brightnessValues: number[] = [];
        
        for (let dy = -mouthRegionSize; dy <= mouthRegionSize; dy++) {
          for (let dx = -mouthRegionSize; dx <= mouthRegionSize; dx++) {
            const x = Math.round(faceCenterX + dx);
            const y = Math.round(expectedMouthY + dy);
            
            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
            
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const brightness = (r + g + b) / 3;
            brightnessValues.push(brightness);
          }
        }
        
        if (brightnessValues.length === 0) return true; // Can't determine, assume visible
        
        const avgBrightness = brightnessValues.reduce((sum, val) => sum + val, 0) / brightnessValues.length;
        const minBrightness = Math.min(...brightnessValues);
        const maxBrightness = Math.max(...brightnessValues);
        const brightnessRange = maxBrightness - minBrightness;
        const variance = brightnessValues.reduce((sum, val) => sum + Math.pow(val - avgBrightness, 2), 0) / brightnessValues.length;
        const stdDev = Math.sqrt(variance);
        
        // Mouth should have some contrast (lips vs skin), not uniform
        // If hand is covering, it will be uniform skin tone (low contrast, low range)
        const hasGoodContrast = stdDev > 10; // Lower threshold than eyes
        const hasGoodRange = brightnessRange > 20;
        const isNotUniform = !(stdDev < 5 && brightnessRange < 15); // Not uniform = not covered
        
        const isVisible = hasGoodContrast && hasGoodRange && isNotUniform;
        
        console.log('[IdentityVerification] 👄 Mouth visibility check:', {
          mouthY: Math.round(expectedMouthY),
          avgBrightness: avgBrightness.toFixed(1),
          brightnessRange: brightnessRange.toFixed(1),
          stdDev: stdDev.toFixed(1),
          hasGoodContrast,
          hasGoodRange,
          isNotUniform,
          isVisible,
        });
        
        return isVisible;
      };
      
      // Check nose region (center of mid-face)
      const checkNoseVisibility = (): boolean => {
        const noseRegionSize = Math.max(15, faceWidth * 0.12); // 12% of face width
        const brightnessValues: number[] = [];
        
        for (let dy = -noseRegionSize; dy <= noseRegionSize; dy++) {
          for (let dx = -noseRegionSize; dx <= noseRegionSize; dx++) {
            const x = Math.round(faceCenterX + dx);
            const y = Math.round(expectedNoseY + dy);
            
            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
            
            const idx = (y * canvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const brightness = (r + g + b) / 3;
            brightnessValues.push(brightness);
          }
        }
        
        if (brightnessValues.length === 0) return true; // Can't determine, assume visible
        
        const avgBrightness = brightnessValues.reduce((sum, val) => sum + val, 0) / brightnessValues.length;
        const minBrightness = Math.min(...brightnessValues);
        const maxBrightness = Math.max(...brightnessValues);
        const brightnessRange = maxBrightness - minBrightness;
        const variance = brightnessValues.reduce((sum, val) => sum + Math.pow(val - avgBrightness, 2), 0) / brightnessValues.length;
        const stdDev = Math.sqrt(variance);
        
        // Nose should have some texture/shadow (nostrils, bridge), not uniform
        const hasGoodContrast = stdDev > 8;
        const hasGoodRange = brightnessRange > 15;
        const isNotUniform = !(stdDev < 4 && brightnessRange < 12);
        
        const isVisible = hasGoodContrast && hasGoodRange && isNotUniform;
        
        console.log('[IdentityVerification] 👃 Nose visibility check:', {
          noseY: Math.round(expectedNoseY),
          avgBrightness: avgBrightness.toFixed(1),
          brightnessRange: brightnessRange.toFixed(1),
          stdDev: stdDev.toFixed(1),
          hasGoodContrast,
          hasGoodRange,
          isNotUniform,
          isVisible,
        });
        
        return isVisible;
      };
      
      const mouthVisible = checkMouthVisibility();
      const noseVisible = checkNoseVisibility();

      // Flag if BOTH eyes are NOT visible OR if mouth/nose are covered
      if (!rightEyeVisible && !leftEyeVisible) {
        return {
          hasHandCoverage: true,
          errorMessage: `Eyes not clearly visible - please ensure your eyes are visible and retake photo`
        };
      } else if (!mouthVisible || !noseVisible) {
        // Mouth or nose covered - reject
        const coveredFeatures = [];
        if (!mouthVisible) coveredFeatures.push('mouth');
        if (!noseVisible) coveredFeatures.push('nose');
        return {
          hasHandCoverage: true,
          errorMessage: `${coveredFeatures.join(' and ')} not clearly visible - please remove hand/object and retake photo`
        };
      } else if (!rightEyeVisible || !leftEyeVisible) {
        // If only one eye is not visible, might be lighting/shadow - be conservative
        console.log('[IdentityVerification] ⚠️ One eye visibility issue, but not flagging (likely lighting)');
        return { hasHandCoverage: false };
      }

      // All features visible - no hand coverage
      return { hasHandCoverage: false };
    } catch (error) {
      console.error('[IdentityVerification] Error detecting hand coverage:', error);
      return { hasHandCoverage: false };
    }
  };

  /**
   * Detect blur in image using Laplacian variance method
   * Returns blur score (higher = sharper, lower = blurrier)
   */
  const detectBlur = async (image: HTMLImageElement): Promise<number> => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;

      ctx.drawImage(image, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to grayscale and apply Laplacian operator
      const grayscale: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        grayscale.push(gray);
      }

      // Apply Laplacian kernel: [[0, -1, 0], [-1, 4, -1], [0, -1, 0]]
      const laplacianValues: number[] = [];
      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
          const idx = y * canvas.width + x;
          const center = grayscale[idx];
          const top = grayscale[(y - 1) * canvas.width + x];
          const bottom = grayscale[(y + 1) * canvas.width + x];
          const left = grayscale[y * canvas.width + (x - 1)];
          const right = grayscale[y * canvas.width + (x + 1)];

          // Laplacian: 4*center - (top + bottom + left + right)
          const laplacian = Math.abs(4 * center - (top + bottom + left + right));
          laplacianValues.push(laplacian);
        }
      }

      // Calculate variance of Laplacian (higher variance = sharper image)
      const mean = laplacianValues.reduce((sum, val) => sum + val, 0) / laplacianValues.length;
      const variance = laplacianValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / laplacianValues.length;

      // Return variance as blur score (multiply by 1000 for readability)
      const blurScore = variance * 1000;
      
      console.log('[IdentityVerification] 📊 Blur detection:', {
        blurScore: blurScore.toFixed(2),
        variance: variance.toFixed(4),
        isBlurry: blurScore < 100,
      });

      return blurScore;
    } catch (error) {
      console.error('[IdentityVerification] Error detecting blur:', error);
      return 0; // Assume blurry if detection fails
    }
  };

  /**
   * Validate photo quality for face verification
   * Checks: face visibility, embedding quality, face coverage, etc.
   */
  const validatePhotoQuality = async (
    image: HTMLImageElement,
    embedding: Float32Array | number[],
    faceRecognitionModel: any
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Check embedding quality
      const embeddingArray = Array.isArray(embedding) ? embedding : Array.from(embedding);
      
      if (embeddingArray.length < 100) {
        errors.push("Embedding too short - insufficient features");
        return { isValid: false, errors, warnings };
      }

      // Check embedding variance (should have sufficient variation)
      const mean = embeddingArray.reduce((sum, val) => sum + val, 0) / embeddingArray.length;
      const variance = embeddingArray.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / embeddingArray.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev < 0.01) {
        errors.push("Embedding lacks variation - face may be too uniform or obscured");
      }

      // 2. Re-detect face to validate quality
      const blazefaceModel = modelService.getBlazeFace();
      if (!blazefaceModel) {
        errors.push("Face detection model not available");
        return { isValid: false, errors, warnings };
      }

      const predictions = await blazefaceModel.estimateFaces(image as any, false);
      if (!predictions || predictions.length === 0) {
        errors.push("No face detected in photo");
        return { isValid: false, errors, warnings };
      }

      const face = predictions[0];
      
      // 3. Check face confidence (handle different formats: number, array, Tensor, undefined)
      // Use extractConfidence helper function to properly extract confidence value
      const prob = extractConfidence(face.probability);
      
      console.log('[IdentityVerification] 📊 Face confidence extracted:', {
        rawProbability: face.probability,
        extractedProb: prob,
        type: typeof face.probability,
        isArray: Array.isArray(face.probability),
      });
      
      // Only check confidence if we got a valid value (not the default 0.9)
      // If probability is not available, skip this check (don't fail validation)
      if (prob < 0.8 && face.probability !== undefined && face.probability !== null) {
        errors.push(`Face detection confidence too low (${(prob * 100).toFixed(0)}% - need >80%)`);
      } else if (face.probability === undefined || face.probability === null) {
        // Probability not available - skip confidence check but log warning
        console.warn('[IdentityVerification] ⚠️ Face probability not available in BlazeFace prediction - skipping confidence check');
      }

      // 4. Check face size
      const start = face.topLeft as [number, number];
      const end = face.bottomRight as [number, number];
      const width = end[0] - start[0];
      const height = end[1] - start[1];
      const faceArea = width * height;
      const imageArea = image.width * image.height;
      const faceSizeRatio = faceArea / imageArea;
      
      if (faceSizeRatio < 0.05) {
        errors.push("Face too small in photo - move closer to camera");
      } else if (faceSizeRatio < 0.1) {
        warnings.push("Face is small - consider moving closer for better quality");
      }

      // 5. Check landmarks quality
      const landmarks = face.landmarks;
      if (!landmarks || !Array.isArray(landmarks) || landmarks.length < 6) {
        errors.push("Insufficient facial landmarks detected");
        return { isValid: false, errors, warnings };
      }

      // 6. Check eye visibility (critical for face recognition)
      const rightEye = landmarks[0];
      const leftEye = landmarks[1];
      if (!rightEye || !leftEye || rightEye.length < 2 || leftEye.length < 2) {
        errors.push("Eye landmarks not detected - eyes may be covered or not visible");
        return { isValid: false, errors, warnings };
      }

      // 7. Validate eye positions are reasonable (not too close/far, not outside face bounds)
      const eyeDistance = Math.sqrt(
        Math.pow(leftEye[0] - rightEye[0], 2) + 
        Math.pow(leftEye[1] - rightEye[1], 2)
      );
      const faceWidth = Math.max(width, height);
      const eyeDistanceRatio = eyeDistance / faceWidth;
      
      // Normal eye distance is typically 20-40% of face width
      if (eyeDistanceRatio < 0.15) {
        errors.push("Eyes too close together - face may be at wrong angle or obscured");
      } else if (eyeDistanceRatio > 0.5) {
        errors.push("Eyes too far apart - face may be at extreme angle");
      }

      // 8. Check if eyes are within face bounds
      const eyeCenterX = (rightEye[0] + leftEye[0]) / 2;
      const eyeCenterY = (rightEye[1] + leftEye[1]) / 2;
      const eyeMargin = faceWidth * 0.1; // 10% margin
      
      if (eyeCenterX < start[0] - eyeMargin || eyeCenterX > end[0] + eyeMargin ||
          eyeCenterY < start[1] - eyeMargin || eyeCenterY > end[1] + eyeMargin) {
        errors.push("Eyes outside expected face region - face may be partially obscured");
      }

      // 9. Check face angle (using eye positions)
      const eyeDx = leftEye[0] - rightEye[0];
      const eyeDy = leftEye[1] - rightEye[1];
      const angle = Math.abs(Math.atan2(eyeDy, eyeDx) * (180 / Math.PI));
      
      if (angle > 30) {
        errors.push(`Face angle too extreme (${angle.toFixed(0)}° - keep face straight)`);
      } else if (angle > 20) {
        warnings.push(`Face slightly tilted (${angle.toFixed(0)}°) - keep face straight for best results`);
      }

      // 10. Check all landmarks are within face bounds
      let landmarksOutOfBounds = 0;
      landmarks.forEach((point: number[]) => {
        if (point.length >= 2) {
          if (point[0] < start[0] - eyeMargin || point[0] > end[0] + eyeMargin ||
              point[1] < start[1] - eyeMargin || point[1] > end[1] + eyeMargin) {
            landmarksOutOfBounds++;
          }
        }
      });
      
      if (landmarksOutOfBounds > landmarks.length * 0.3) {
        errors.push("Too many facial features outside face region - face may be partially obscured");
      }

      // 11. Check embedding variance is sufficient (for discrimination)
      if (stdDev < 0.05) {
        warnings.push("Low embedding variance - may affect recognition accuracy");
      }

      // 12. Detect hand or object covering face (especially eyes)
      const handCoverageResult = await detectHandCoverage(image, face, landmarks);
      if (handCoverageResult.hasHandCoverage) {
        errors.push(handCoverageResult.errorMessage || "Hand or object covering face - please remove and retake photo");
      }

      // 13. Detect blur in image
      const blurScore = await detectBlur(image);
      if (blurScore < 100) { // Threshold for blur detection (lower = more blurry)
        errors.push(`Image is blurry (sharpness: ${blurScore.toFixed(0)}) - please retake photo with clear focus`);
      } else if (blurScore < 150) {
        warnings.push("Image is slightly blurry - consider retaking for better quality");
      }

      // Validation passed if no errors
      const isValid = errors.length === 0;
      
      console.log('[IdentityVerification] 📊 Photo quality validation result:', {
        isValid,
        errors: errors.length,
        warnings: warnings.length,
        faceConfidence: prob.toFixed(2),
        faceSize: `${(faceSizeRatio * 100).toFixed(1)}%`,
        eyeDistanceRatio: eyeDistanceRatio.toFixed(2),
        angle: `${angle.toFixed(1)}°`,
        embeddingVariance: stdDev.toFixed(4),
      });

      return { isValid, errors, warnings };
    } catch (error) {
      console.error('[IdentityVerification] ❌ Error validating photo quality:', error);
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      return { isValid: false, errors, warnings };
    }
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || faceDetectionState !== "SINGLE_FACE_CENTERED") {
      return;
    }

    setIsCapturing(true);
    stopDetectionLoop();

    try {
      // Final face detection check
      const finalDetection = await detectFaces(videoRef.current);
      if (finalDetection.state !== "SINGLE_FACE_CENTERED") {
        if (finalDetection.state === "MULTIPLE_FACES") {
          setStatusMessage("Multiple faces detected. Please capture again with only yourself visible.");
        } else if (finalDetection.state === "FACE_OFF_CENTER") {
          setStatusMessage("Please move your face to the center of the frame.");
        } else {
          setStatusMessage("Face detection failed. Please try again.");
        }
        setIsCapturing(false);
        startDetectionLoop();
        return;
      }

      // Capture image
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        setIsCapturing(false);
        startDetectionLoop();
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const photoData = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedPhoto(photoData);

      // Stop camera stream and cleanup detection immediately
      stopDetectionLoop();
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
      // Cleanup face detection model immediately after capture
      cleanupFaceDetection();
      isModelLoadedRef.current = false;

      // Store in sessionStorage first (for proctoring engine)
      sessionStorage.setItem(`referenceFace_${assessmentId}`, photoData);
      sessionStorage.setItem(`capturedPhoto_${assessmentId}`, photoData);

      // Save reference image to backend asynchronously (non-blocking)
      // This should happen regardless of AI Proctoring status
      if (!skipBackendSave) {
        // Prevent duplicate saves
        if (!isSavingRef.current) {
          isSavingRef.current = true;
          (async () => {
            try {
              // Determine test type using gateContext to call the correct endpoint directly
              const ctx = getGateContext(assessmentId);
              const flowType = ctx?.flowType || "ai"; // Default to "ai" if not set
              
              // Determine which endpoint to use based on flow type
              let endpoint: string;
              let serviceName: string;
              
              if (flowType === "dsa") {
                endpoint = "/api/v1/dsa/tests/save-reference-face";
                serviceName = "DSA";
              } else if (flowType === "aiml") {
                endpoint = "/api/v1/aiml/tests/save-reference-face";
                serviceName = "AIML";
              } else {
                // Default to generic endpoint for "ai" and "custom-mcq" flows
                endpoint = "/api/v1/candidate/save-reference-face";
                serviceName = "Generic";
              }
              
              console.log('[IdentityVerification] Saving reference photo to database:', {
                assessmentId,
                candidateEmail,
                skipBackendSave,
                photoDataLength: photoData.length,
                photoDataPrefix: photoData.substring(0, 50),
                flowType,
                endpoint,
                serviceName
              });

              // Call the correct endpoint directly (no fallback needed)
              const response = await axios.post(endpoint, {
                assessmentId,
                candidateEmail,
                referenceImage: photoData,
              });
              
              console.log(`[IdentityVerification] ✅ Reference photo saved to ${serviceName} database:`, response.data);
            } catch (saveError: any) {
              // Don't block the flow if saving fails - photo is still in sessionStorage
              console.warn('[IdentityVerification] Failed to save to database (non-critical):', {
                status: saveError?.response?.status,
                error: saveError?.response?.data?.error || saveError?.response?.data?.detail || saveError?.message,
                assessmentId,
                candidateEmail
              });
            } finally {
              isSavingRef.current = false;
            }
          })();
        } else {
          console.log('[IdentityVerification] Save already in progress, skipping duplicate save');
        }
      } else {
        console.log('[IdentityVerification] ⚠️ skipBackendSave is true - skipping backend save (photo stored in sessionStorage only)');
      }

      // CONDITIONAL: Only extract embedding if both AI Proctoring AND Face Mismatch Detection are enabled
      // FIX: Add debug logging to verify proctoring status
      const shouldExtractEmbedding = aiProctoringEnabled && faceMismatchEnabled;
      console.log('[IdentityVerification] 🔍 Proctoring status check:', {
        aiProctoringEnabled,
        faceMismatchEnabled,
        shouldExtractEmbedding,
        type: typeof aiProctoringEnabled,
        value: aiProctoringEnabled,
        isTrue: aiProctoringEnabled === true,
        isFalsy: !aiProctoringEnabled,
      });
      
      if (!shouldExtractEmbedding) {
        // Face Mismatch Detection disabled: Just store photo, no embedding extraction
        if (!aiProctoringEnabled) {
          console.warn('[IdentityVerification] ⚠️ AI Proctoring disabled - storing photo only (no embedding extraction)');
        } else {
          console.warn('[IdentityVerification] ⚠️ Face Mismatch Detection disabled - storing photo only (no embedding extraction)');
        }
        console.warn('[IdentityVerification] ⚠️ This means face verification will NOT work during assessment!');
        setPhotoQualityValid(true); // Photo is valid (no quality check needed)
        setPhotoQualityErrors([]);
        setStatusMessage("✅ Photo captured successfully. Click 'Confirm & Continue' to proceed.");
        setIsCapturing(false);
        return; // Skip embedding extraction
      }
      
      console.log('[IdentityVerification] ✅ Face Mismatch Detection ENABLED - will extract embedding and validate quality');

      // AI Proctoring enabled: Extract and validate face embedding for face verification
      let embeddingExtracted = false;
      let embedding: Float32Array | number[] | null = null;
      let qualityValidation: { isValid: boolean; errors: string[]; warnings: string[] } = { isValid: false, errors: [], warnings: [] };
      
      try {
        console.log('[IdentityVerification] 🔍 Starting reference embedding extraction and quality validation (AI Proctoring enabled)...');
        const faceRecognitionModel = modelService.getFaceRecognition();
        if (!faceRecognitionModel) {
          console.warn('[IdentityVerification] ⚠️ Face recognition model not available - face verification will be disabled');
          setStatusMessage("⚠️ Warning: Face recognition model not available. Face verification will be disabled. Please refresh the page.");
          setPhotoQualityValid(false);
          setPhotoQualityErrors(["Face recognition model not available"]);
          setIsCapturing(false);
          return;
        }
        
        console.log('[IdentityVerification] ✅ Face recognition model available');
        const faceVerificationService = new FaceVerificationService();
        const initialized = await faceVerificationService.initialize(faceRecognitionModel);
        
        if (!initialized) {
          console.error('[IdentityVerification] ❌ Face verification service initialization failed');
          setStatusMessage("⚠️ Warning: Face verification service failed to initialize. Please retry.");
          setPhotoQualityValid(false);
          setPhotoQualityErrors(["Face verification service initialization failed"]);
          setIsCapturing(false);
          return;
        }
        
        console.log('[IdentityVerification] ✅ Face verification service initialized');
        
        // Create image element from captured photo
        console.log('[IdentityVerification] 📷 Loading reference photo for embedding extraction...');
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            console.log('[IdentityVerification] ✅ Reference photo loaded, dimensions:', {
              width: img.width,
              height: img.height,
            });
            resolve();
          };
          img.onerror = () => {
            console.error('[IdentityVerification] ❌ Failed to load captured photo');
            reject(new Error("Failed to load captured photo"));
          };
          img.src = photoData;
        });

        // Extract embedding from reference photo
        console.log('[IdentityVerification] 🔍 Extracting face embedding from reference photo...');
        embedding = await faceVerificationService.extractEmbedding(img);
        
        if (!embedding) {
          console.warn('[IdentityVerification] ⚠️ Could not extract embedding from reference photo - no face detected');
          setStatusMessage("⚠️ Could not extract face features. Please ensure your face is clearly visible and click 'Retry Photo'.");
          setPhotoQualityValid(false);
          setPhotoQualityErrors(["No face detected in photo", "Face may be obscured or not visible"]);
          setIsCapturing(false);
          return;
        }

        // Validate photo quality
        console.log('[IdentityVerification] 🔍 Validating photo quality...');
        qualityValidation = await validatePhotoQuality(img, embedding, faceRecognitionModel);
        
        console.log('[IdentityVerification] 📊 Photo quality validation result:', {
          isValid: qualityValidation.isValid,
          errors: qualityValidation.errors.length,
          warnings: qualityValidation.warnings.length,
          errorDetails: qualityValidation.errors,
          warningDetails: qualityValidation.warnings,
        });
        
        if (qualityValidation.isValid) {
          // Store embedding in sessionStorage for face verification during assessment
          const embeddingArray = Array.isArray(embedding) ? embedding : Array.from(embedding);
          sessionStorage.setItem('faceVerificationReferenceEmbedding', JSON.stringify(embeddingArray));
          
          // Calculate and store quality metrics for confidence scoring during assessment
          const embeddingMean = embeddingArray.reduce((sum, val) => sum + val, 0) / embeddingArray.length;
          const embeddingVariance = embeddingArray.reduce((sum, val) => sum + Math.pow(val - embeddingMean, 2), 0) / embeddingArray.length;
          const embeddingStdDev = Math.sqrt(embeddingVariance);
          
          // Get face detection metrics
          const blazefaceModel = modelService.getBlazeFace();
          let faceConfidence = 0.9;
          let faceSizeRatio = 0.1;
          let faceAngle = 0;
          
          if (blazefaceModel) {
            try {
              const predictions = await blazefaceModel.estimateFaces(img as any, false);
              if (predictions && predictions.length > 0) {
                const face = predictions[0];
                faceConfidence = extractConfidence(face.probability);
                
                const start = face.topLeft as [number, number];
                const end = face.bottomRight as [number, number];
                const width = end[0] - start[0];
                const height = end[1] - start[1];
                const faceArea = width * height;
                const imageArea = img.width * img.height;
                faceSizeRatio = faceArea / imageArea;
                
                const landmarks = face.landmarks;
                // Type guard: check if landmarks is an array (not Tensor2D)
                if (landmarks && Array.isArray(landmarks) && landmarks.length >= 2) {
                  const rightEye = landmarks[0];
                  const leftEye = landmarks[1];
                  if (rightEye && leftEye && Array.isArray(rightEye) && Array.isArray(leftEye) && rightEye.length >= 2 && leftEye.length >= 2) {
                    const eyeDx = leftEye[0] - rightEye[0];
                    const eyeDy = leftEye[1] - rightEye[1];
                    faceAngle = Math.abs(Math.atan2(eyeDy, eyeDx) * (180 / Math.PI));
                  }
                }
              }
            } catch (e) {
              console.warn('[IdentityVerification] Could not extract face metrics:', e);
            }
          }
          
          // Calculate overall quality score
          const sizeScore = Math.min(1, faceSizeRatio / 0.15); // Optimal size is 15% of image
          const angleScore = 1 - (faceAngle / 30); // Optimal angle is 0°
          const confidenceScore = faceConfidence;
          const varianceScore = Math.min(1, embeddingStdDev / 0.02);
          const overallScore = (sizeScore * 0.3) + (angleScore * 0.2) + (confidenceScore * 0.3) + (varianceScore * 0.2);
          
          const qualityMetrics = {
            faceConfidence,
            faceSizeRatio,
            faceAngle,
            embeddingVariance: embeddingVariance,
            embeddingStdDev,
            overallScore,
            timestamp: Date.now(),
          };
          
          sessionStorage.setItem('faceVerificationReferenceQuality', JSON.stringify(qualityMetrics));
          
          console.log('[IdentityVerification] ✅ Reference face embedding extracted and validated:', {
            dimensions: embeddingArray.length,
            type: Array.isArray(embedding) ? 'Array' : embedding.constructor.name,
            quality: 'valid',
            qualityMetrics,
          });
          embeddingExtracted = true;
          setPhotoQualityValid(true);
          setPhotoQualityErrors([]);
          setStatusMessage("✅ Photo quality verified! Face features extracted successfully. Click 'Confirm & Continue' to proceed.");
        } else {
          // Quality validation failed - CRITICAL: Don't store embedding if validation fails
          console.error('[IdentityVerification] ❌ Photo quality validation FAILED:', {
            errors: qualityValidation.errors,
            warnings: qualityValidation.warnings,
            errorCount: qualityValidation.errors.length,
          });
          setPhotoQualityValid(false);
          setPhotoQualityErrors(qualityValidation.errors);
          const errorMessage = qualityValidation.errors.length > 0 
            ? `⚠️ Photo quality issue: ${qualityValidation.errors.join(', ')}. Please click 'Retry Photo' and capture again.`
            : "⚠️ Photo quality validation failed. Please click 'Retry Photo' and ensure your face is clearly visible.";
          setStatusMessage(errorMessage);
          
          // CRITICAL: Clear any existing embedding if validation failed
          sessionStorage.removeItem('faceVerificationReferenceEmbedding');
          sessionStorage.removeItem('faceVerificationReferenceQuality');
          console.log('[IdentityVerification] 🧹 Cleared reference embedding due to validation failure');
        }
      } catch (error) {
        console.error('[IdentityVerification] ❌ Error extracting reference embedding:', error);
        setStatusMessage("⚠️ Error extracting face features. Please click 'Retry Photo' and try again.");
        setPhotoQualityValid(false);
        setPhotoQualityErrors([`Error: ${error instanceof Error ? error.message : String(error)}`]);
      }

      setIsCapturing(false);
      
      // Don't call onCaptureComplete immediately - wait for user to confirm or retry
      // User will click "Confirm & Continue" button to proceed only if quality is valid
      // Note: Photo save to backend already happened above (before embedding extraction)
    } catch (error) {
      console.error("Error capturing photo:", error);
      setStatusMessage("Failed to capture photo. Please try again.");
      if (onError) {
        onError("Failed to capture photo");
      }
      startDetectionLoop();
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes pulse-delay-1 {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.8);
          }
          33% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes pulse-delay-2 {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.8);
          }
          66% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
      <div style={{ marginBottom: "1.5rem" }}>
        {!capturedPhoto ? (
          <>
            <div style={{ position: "relative", width: "100%", maxWidth: "400px", marginBottom: "1rem" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  borderRadius: "0.5rem",
                  backgroundColor: "#000",
                }}
              />
              {!isModelLoaded && isCameraReady && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    color: "#64748b",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginRight: "4px" }}>
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        backgroundColor: "#6953a3",
                        borderRadius: "50%",
                        animation: "pulse 1.4s ease-in-out infinite",
                      }}
                    />
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        backgroundColor: "#6953a3",
                        borderRadius: "50%",
                        animation: "pulse-delay-1 1.4s ease-in-out infinite",
                      }}
                    />
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        backgroundColor: "#6953a3",
                        borderRadius: "50%",
                        animation: "pulse-delay-2 1.4s ease-in-out infinite",
                      }}
                    />
                  </div>
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>
          <canvas ref={canvasRef} style={{ display: "none" }} />
          {statusMessage && isModelLoaded && (
            <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1rem" }}>
              {statusMessage}
            </div>
          )}
          {faceDetectionState === "SINGLE_FACE_CENTERED" && isCameraReady && isModelLoaded && (
            <button
              onClick={handleCapturePhoto}
              disabled={isCapturing}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: isCapturing ? "#94a3b8" : "#6953a3",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: isCapturing ? "not-allowed" : "pointer",
              }}
            >
              {isCapturing ? "Capturing..." : "Capture Photo"}
            </button>
          )}
        </>
      ) : (
        <div>
          <img
            src={capturedPhoto}
            alt="Captured photo"
            style={{
              width: "100%",
              maxWidth: "400px",
              borderRadius: "0.5rem",
              marginBottom: "1rem",
            }}
          />
          <div style={{ 
            fontSize: "0.875rem", 
            color: photoQualityValid ? "#10b981" : photoQualityErrors.length > 0 ? "#ef4444" : "#f59e0b",
            marginBottom: "1rem",
            padding: "0.75rem",
            backgroundColor: photoQualityValid ? "#d1fae5" : photoQualityErrors.length > 0 ? "#fee2e2" : "#fef3c7",
            borderRadius: "0.5rem",
            border: `1px solid ${photoQualityValid ? "#10b981" : photoQualityErrors.length > 0 ? "#ef4444" : "#f59e0b"}`,
          }}>
            {statusMessage}
            {photoQualityErrors.length > 0 && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                <strong>Issues found:</strong>
                <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0 }}>
                  {photoQualityErrors.map((error, idx) => (
                    <li key={idx} style={{ marginBottom: "0.25rem" }}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => {
                // Retry: Reset captured photo and restart camera
                console.log('[IdentityVerification] 🔄 Retry button clicked - resetting photo capture');
                
                // Clear old reference embedding from sessionStorage
                sessionStorage.removeItem('faceVerificationReferenceEmbedding');
                sessionStorage.removeItem(`referenceFace_${assessmentId}`);
                sessionStorage.removeItem(`capturedPhoto_${assessmentId}`);
                console.log('[IdentityVerification] 🗑️ Cleared old reference embedding and photos');
                
                setCapturedPhoto(null);
                setStatusMessage("");
                setPhotoQualityValid(false);
                setPhotoQualityErrors([]);
                setIsCapturing(false);
                isSavingRef.current = false;
                
                // Restart camera and detection
                const initCamera = async () => {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                      video: {
                        width: { ideal: 640, max: 640 },
                        height: { ideal: 480, max: 480 },
                        frameRate: { ideal: 30, max: 30 },
                        facingMode: "user",
                      },
                    });
                    
                    setCameraStream(stream);
                    if (videoRef.current) {
                      const video = videoRef.current;
                      video.srcObject = stream;
                      try {
                        await video.play();
                        setIsCameraReady(true);
                      } catch (playError: any) {
                        if (playError.name !== "AbortError" && playError.name !== "NotAllowedError") {
                          console.warn("Video play() error (non-critical):", playError);
                        }
                        setIsCameraReady(true);
                      }
                    }
                    
                    // Restart detection loop
                    startDetectionLoop();
                    
                    // Re-initialize face detection if needed
                    if (!isModelLoadedRef.current) {
                      if (modelService.areAllModelsLoaded()) {
                        initializeFaceDetection()
                          .then((initialized) => {
                            if (initialized) {
                              setIsModelLoaded(true);
                              isModelLoadedRef.current = true;
                            }
                          })
                          .catch((error) => {
                            console.error("[IdentityVerification] Face detection initialization error:", error);
                          });
                      }
                    }
                  } catch (error: any) {
                    console.error("Error restarting camera:", error);
                    setStatusMessage("Failed to restart camera. Please refresh the page.");
                    if (onError) {
                      onError("Failed to restart camera");
                    }
                  }
                };
                
                initCamera();
              }}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#ef4444",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry Photo
            </button>
            <button
              onClick={() => {
                // Confirm: Proceed with current photo (only if quality is valid)
                if (photoQualityValid) {
                  console.log('[IdentityVerification] ✅ Photo confirmed - proceeding');
                  onCaptureComplete(capturedPhoto!);
                } else {
                  console.warn('[IdentityVerification] ⚠️ Cannot proceed - photo quality not valid');
                  setStatusMessage("⚠️ Please fix photo quality issues and retry before continuing.");
                }
              }}
              disabled={!photoQualityValid}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: photoQualityValid ? "#10b981" : "#94a3b8",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: photoQualityValid ? "pointer" : "not-allowed",
                opacity: photoQualityValid ? 1 : 0.6,
              }}
            >
              Confirm & Continue
            </button>
          </div>
        </div>
      )}
      </div>
    </>
  );
}



