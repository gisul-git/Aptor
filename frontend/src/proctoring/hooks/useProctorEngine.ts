/**
 * React Hook for Unified Proctoring Engine
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { ProctorConfig } from "../config/proctorConfig";
import { createProctorEngine, type ProctorEngineOptions, type ProctorEngineState } from "../engine/proctorEngine";

export interface UseProctorEngineOptions {
  assessmentId: string;
  candidateEmail: string;
  config: ProctorConfig;
  referenceImageUrl?: string;
  onViolation?: (violation: string, metadata?: Record<string, unknown>) => void;
  videoElement?: HTMLVideoElement | null;
  canvasElement?: HTMLCanvasElement | null;
}

export interface UseProctorEngineReturn {
  state: ProctorEngineState;
  start: () => Promise<boolean>;
  stop: () => void;
  isRunning: boolean;
}

/**
 * React hook for using the proctor engine
 */
export function useProctorEngine(options: UseProctorEngineOptions): UseProctorEngineReturn {
  const engineRef = useRef<ReturnType<typeof createProctorEngine> | null>(null);
  const [state, setState] = useState<ProctorEngineState>({
    isActive: false,
    isInitialized: false,
    faceDetectionState: "NO_FACE",
    faceMatchResult: null,
    violations: [],
  });

  // Create refs for video/canvas elements (for getter functions)
  const videoElementRef = useRef<HTMLVideoElement | null>(options.videoElement || null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(options.canvasElement || null);

  // Update refs when options change
  useEffect(() => {
    videoElementRef.current = options.videoElement || null;
    canvasElementRef.current = options.canvasElement || null;
  }, [options.videoElement, options.canvasElement]);

  // Create engine instance
  useEffect(() => {
    const engineOptions: ProctorEngineOptions = {
      assessmentId: options.assessmentId,
      candidateEmail: options.candidateEmail,
      config: options.config,
      referenceImageUrl: options.referenceImageUrl,
      onViolation: options.onViolation,
      videoElement: options.videoElement || null,
      canvasElement: options.canvasElement || null,
      getVideoElement: () => videoElementRef.current,
      getCanvasElement: () => canvasElementRef.current,
    };

    const engine = createProctorEngine(engineOptions);
    engineRef.current = engine;

    // Sync state updates periodically
    const stateUpdateInterval = setInterval(() => {
      if (engineRef.current) {
        const currentState = engineRef.current.getState();
        setState({ ...currentState }); // Create new object to trigger re-render
      }
    }, 1000);

    return () => {
      clearInterval(stateUpdateInterval);
      if (engineRef.current) {
        engineRef.current.stop();
      }
    };
  }, [
    options.assessmentId,
    options.candidateEmail,
    JSON.stringify(options.config),
    options.referenceImageUrl,
  ]);

  const start = useCallback(async () => {
    if (engineRef.current) {
      const started = await engineRef.current.start();
      if (started) {
        setState(engineRef.current.getState());
      }
      return started;
    }
    return false;
  }, []);

  const stop = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      setState(engineRef.current.getState());
    }
  }, []);

  return {
    state,
    start,
    stop,
    isRunning: engineRef.current?.isRunning() || false,
  };
}

