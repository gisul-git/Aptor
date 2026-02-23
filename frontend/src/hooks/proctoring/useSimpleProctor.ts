/**
 * Simple Proctoring Monitor Hook
 * 
 * Detects violations: multiple faces, gaze away, tab switch, fullscreen exit, focus lost
 * Posts violations to /api/proctor/record with snapshots
 */

import { useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

export type ViolationEventType = 
  | 'MULTIPLE_FACE' 
  | 'IN_FRAME_LOST' 
  | 'GAZE_AWAY' 
  | 'TAB_SWITCH' 
  | 'FULLSCREEN_EXIT' 
  | 'FOCUS_LOST' 
  | 'FOCUS_GAIN';

export interface ViolationPayload {
  eventType: ViolationEventType;
  timestamp: string;
  assessmentId: string;
  userId: string;
  sessionId: string | null;
  metadata: {
    facesCount?: number;
    gazeConfidence?: number;
    faceBoxes?: Array<{ x: number; y: number; w: number; h: number }>;
    duration?: number;
    pageUrl: string;
  };
  snapshotBase64?: string;
}

interface UseSimpleProctorOptions {
  videoElement: HTMLVideoElement | null;
  sessionId: string | null;
  assessmentId: string;
  candidateEmail: string;
  detectionIntervalMs?: number;
  inFrameLostThresholdMs?: number;
  gazeAwayThresholdMs?: number;
  debounceMs?: number;
}

interface QueuedViolation {
  payload: ViolationPayload;
  timestamp: number;
}

let faceDetectorModel: any = null;
let isModelLoading = false;
let queuedViolations: QueuedViolation[] = [];
let lastViolationTime: Record<string, number> = {};

// Initialize face detection (BlazeFace)
async function initializeFaceDetection(): Promise<boolean> {
  if (faceDetectorModel) return true;
  if (isModelLoading) return false;

  try {
    isModelLoading = true;
    const tfModule = await import('@tensorflow/tfjs');
    const tf = tfModule.default || tfModule;
    
    // Suppress TensorFlow.js kernel registration warnings
    if (tf && typeof (tf as any).setLogLevel === 'function') {
      (tf as any).setLogLevel('error'); // Only show errors, suppress warnings
    }
    
    await tf.ready();
    
    try {
      await tf.setBackend('webgl');
      await tf.ready();
    } catch {
      await tf.setBackend('cpu');
      await tf.ready();
    }

    const blazeface = await import('@tensorflow-models/blazeface');
    faceDetectorModel = await blazeface.load();
    console.log('[Proctor] Face detection model loaded');
    return true;
  } catch (error) {
    console.error('[Proctor] Failed to load face detection model:', error);
    return false;
  } finally {
    isModelLoading = false;
  }
}

// Detect faces using BlazeFace or fallback
async function detectFaces(videoElement: HTMLVideoElement): Promise<{
  faceCount: number;
  faceBoxes: Array<{ x: number; y: number; w: number; h: number }>;
}> {
  if (!videoElement || videoElement.readyState < 2) {
    return { faceCount: 0, faceBoxes: [] };
  }

  // Try BlazeFace first
  if (faceDetectorModel) {
    try {
      const predictions = await faceDetectorModel.estimateFaces(videoElement, false);
      const faceBoxes = predictions.map((p: any) => ({
        x: p.topLeft[0],
        y: p.topLeft[1],
        w: p.bottomRight[0] - p.topLeft[0],
        h: p.bottomRight[1] - p.topLeft[1],
      }));
      return { faceCount: predictions.length, faceBoxes };
    } catch (error) {
      console.warn('[Proctor] BlazeFace detection failed:', error);
    }
  }

  // Fallback: Try FaceDetector API
  if (typeof window !== 'undefined' && (window as any).FaceDetector) {
    try {
      const detector = new (window as any).FaceDetector({ fastMode: true, maxDetections: 3 });
      const faces = await detector.detect(videoElement);
      const faceBoxes = faces.map((f: any) => ({
        x: f.boundingBox.x,
        y: f.boundingBox.y,
        w: f.boundingBox.width,
        h: f.boundingBox.height,
      }));
      return { faceCount: faces.length, faceBoxes };
    } catch (error) {
      console.warn('[Proctor] FaceDetector API failed:', error);
    }
  }

  return { faceCount: 0, faceBoxes: [] };
}

// Capture snapshot from video
function captureSnapshot(videoElement: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (error) {
    console.error('[Proctor] Failed to capture snapshot:', error);
    return null;
  }
}

// Post violation to backend
async function postViolation(payload: ViolationPayload): Promise<void> {
  try {
    const response = await axios.post('/api/proctor/record', payload);
    console.log('[Proctor] POST /api/proctor/record response:', {
      status: response.data?.status || 'ok',
      id: response.data?.id || response.data?.data?.id,
    });
  } catch (error) {
    console.error('[Proctor] Failed to post violation:', error);
    throw error;
  }
}

// Flush queued violations
async function flushQueuedViolations(sessionId: string): Promise<void> {
  if (queuedViolations.length === 0) return;

  const toFlush = [...queuedViolations];
  queuedViolations = [];

  for (const queued of toFlush) {
    queued.payload.sessionId = sessionId;
    try {
      await postViolation(queued.payload);
    } catch (error) {
      // Re-queue on failure
      queuedViolations.push(queued);
    }
  }

  if (toFlush.length > 0) {
    console.log(`[Proctor] Flushed queued violation count: ${toFlush.length}`);
  }
}

export function useSimpleProctor({
  videoElement,
  sessionId,
  assessmentId,
  candidateEmail,
  detectionIntervalMs = 1000,
  inFrameLostThresholdMs = 3000,
  gazeAwayThresholdMs = 5000,
  debounceMs = 5000,
}: UseSimpleProctorOptions) {
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const noFaceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gazeAwayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMonitoringRef = useRef(false);
  const lastFaceCountRef = useRef(0);

  // Check if violation should be debounced
  const shouldRecordViolation = useCallback((eventType: string): boolean => {
    const now = Date.now();
    const lastTime = lastViolationTime[eventType] || 0;
    if (now - lastTime < debounceMs) {
      return false;
    }
    lastViolationTime[eventType] = now;
    return true;
  }, [debounceMs]);

  // Record violation
  const recordViolation = useCallback(async (
    eventType: ViolationEventType,
    metadata: Partial<ViolationPayload['metadata']> = {},
    captureImage: boolean = true
  ) => {
    if (!shouldRecordViolation(eventType)) {
      return;
    }

    const snapshot = captureImage && videoElement ? captureSnapshot(videoElement) : undefined;
    const payload: ViolationPayload = {
      eventType,
      timestamp: new Date().toISOString(),
      assessmentId,
      userId: candidateEmail,
      sessionId,
      metadata: {
        pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        ...metadata,
      },
      snapshotBase64: snapshot || undefined,
    };

    // Always send violation - don't block on sessionId
    // If sessionId is missing, still send but log it
    try {
      await postViolation(payload);
      console.log(`[Proctor] Violation detected: ${eventType} details:`, metadata);
    } catch (error) {
      // Queue on network failure only, not on missing sessionId
      queuedViolations.push({ payload, timestamp: Date.now() });
      console.warn('[Proctor] Failed to send violation, queued for retry:', error);
    }
  }, [videoElement, sessionId, assessmentId, candidateEmail, shouldRecordViolation]);

  // Start detection loop
  const startDetection = useCallback(async () => {
    if (!videoElement || isMonitoringRef.current) return;

    // Initialize face detection
    await initializeFaceDetection();

    isMonitoringRef.current = true;
    console.log('[Take] startProctorMonitors started');

    // Detection loop
    detectionIntervalRef.current = setInterval(async () => {
      if (!videoElement || videoElement.readyState < 2) return;

      const { faceCount, faceBoxes } = await detectFaces(videoElement);
      lastFaceCountRef.current = faceCount;

      // Multiple faces detection
      if (faceCount > 1) {
        await recordViolation('MULTIPLE_FACE', {
          facesCount: faceCount,
          faceBoxes: faceBoxes.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h })),
        });
      }

      // In-frame lost detection
      if (faceCount === 0) {
        if (!noFaceTimerRef.current) {
          noFaceTimerRef.current = setTimeout(async () => {
            await recordViolation('IN_FRAME_LOST', {
              facesCount: 0,
              duration: inFrameLostThresholdMs / 1000,
            });
          }, inFrameLostThresholdMs);
        }
      } else {
        if (noFaceTimerRef.current) {
          clearTimeout(noFaceTimerRef.current);
          noFaceTimerRef.current = null;
        }
      }

      // Simple gaze-away heuristic: if face is off-center for too long
      if (faceCount === 1 && faceBoxes.length > 0) {
        const box = faceBoxes[0];
        const centerX = (videoElement.videoWidth || 640) / 2;
        const centerY = (videoElement.videoHeight || 480) / 2;
        const faceCenterX = box.x + box.w / 2;
        const faceCenterY = box.y + box.h / 2;
        const distance = Math.sqrt(
          Math.pow(faceCenterX - centerX, 2) + Math.pow(faceCenterY - centerY, 2)
        );
        const threshold = Math.min(videoElement.videoWidth || 640, videoElement.videoHeight || 480) * 0.3;

        if (distance > threshold) {
          if (!gazeAwayTimerRef.current) {
            gazeAwayTimerRef.current = setTimeout(async () => {
              await recordViolation('GAZE_AWAY', {
                facesCount: 1,
                gazeConfidence: distance / threshold,
                duration: gazeAwayThresholdMs / 1000,
              });
            }, gazeAwayThresholdMs);
          }
        } else {
          if (gazeAwayTimerRef.current) {
            clearTimeout(gazeAwayTimerRef.current);
            gazeAwayTimerRef.current = null;
          }
        }
      }
    }, detectionIntervalMs);
  }, [videoElement, recordViolation, inFrameLostThresholdMs, gazeAwayThresholdMs, detectionIntervalMs]);

  // Setup event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('TAB_SWITCH', {});
      }
    };

    const handleBlur = () => {
      recordViolation('FOCUS_LOST', {});
    };

    const handleFocus = () => {
      recordViolation('FOCUS_GAIN', {});
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordViolation('FULLSCREEN_EXIT', {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [recordViolation]);

  // Start monitoring when video element is ready
  useEffect(() => {
    if (videoElement && videoElement.readyState >= 2) {
      startDetection();
    }

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      if (noFaceTimerRef.current) {
        clearTimeout(noFaceTimerRef.current);
        noFaceTimerRef.current = null;
      }
      if (gazeAwayTimerRef.current) {
        clearTimeout(gazeAwayTimerRef.current);
        gazeAwayTimerRef.current = null;
      }
      isMonitoringRef.current = false;
      console.log('[Proctor] cleanup on unmount');
    };
  }, [videoElement, startDetection]);

  // Flush queued violations when sessionId becomes available
  useEffect(() => {
    if (sessionId && queuedViolations.length > 0) {
      flushQueuedViolations(sessionId);
    }
  }, [sessionId]);

  return {
    stop: () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      isMonitoringRef.current = false;
    },
  };
}

