// ============================================================================
// Universal Proctoring System - React Hook
// ============================================================================
//
// A React hook wrapper around the Universal Proctoring Service.
// Provides reactive state management and automatic cleanup.
//
// USAGE:
//   const {
//     state,
//     startProctoring,
//     stopProctoring,
//     requestFullscreen,
//     violations,
//   } = useUniversalProctoring();
//
//   // Start proctoring
//   await startProctoring({
//     settings: { aiProctoringEnabled: true, liveProctoringEnabled: false },
//     session: { userId: '...', assessmentId: '...' },
//     videoElement: videoRef.current,
//   });
//
// ============================================================================

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ProctoringSettings,
  ProctoringSession,
  ProctoringViolation,
  ProctoringState,
  INITIAL_PROCTORING_STATE,
  AIProctoringConfig,
  TabSwitchConfig,
} from "./types";
import {
  UniversalProctoringService,
  StartProctoringOptions,
  ProctoringCallbacks,
} from "./UniversalProctoringService";
import { FullscreenConfig } from "./services";

// ============================================================================
// Types
// ============================================================================

export interface UseUniversalProctoringOptions {
  /** Called when a violation occurs */
  onViolation?: (violation: ProctoringViolation) => void;
  /** Called when fullscreen is exited */
  onFullscreenExit?: () => void;
  /** Enable debug mode */
  debug?: boolean;
}

export interface UseUniversalProctoringReturn {
  /** Current proctoring state */
  state: ProctoringState;
  /** Whether proctoring is active */
  isRunning: boolean;
  /** All recorded violations */
  violations: ProctoringViolation[];
  /** Start proctoring with given options */
  startProctoring: (options: StartProctoringParams) => Promise<boolean>;
  /** Stop all proctoring */
  stopProctoring: () => void;
  /** Request fullscreen (must be called from user gesture) */
  requestFullscreen: () => Promise<boolean>;
  /** Exit fullscreen */
  exitFullscreen: () => Promise<void>;
  /** Check if currently fullscreen */
  isFullscreen: boolean;
}

export interface StartProctoringParams {
  /** Proctoring settings from Create Assessment */
  settings: ProctoringSettings;
  /** Session info (user, assessment) */
  session: ProctoringSession;
  /** Video element for camera feed (required if aiProctoringEnabled) */
  videoElement?: HTMLVideoElement | null;
  /** Canvas element for snapshots (optional) */
  canvasElement?: HTMLCanvasElement | null;
  /** Custom AI proctoring config */
  aiConfig?: Partial<AIProctoringConfig>;
  /** Custom tab switch config */
  tabConfig?: Partial<TabSwitchConfig>;
  /** Custom fullscreen config */
  fullscreenConfig?: Partial<FullscreenConfig>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook for the Universal Proctoring System.
 *
 * Provides a reactive interface to the proctoring service with:
 * - Reactive state updates
 * - Automatic cleanup on unmount
 * - Simple start/stop API
 *
 * @param options - Hook options
 * @returns Hook return object with state and methods
 */
export function useUniversalProctoring(
  options: UseUniversalProctoringOptions = {}
): UseUniversalProctoringReturn {
  const { onViolation, onFullscreenExit, debug } = options;

  // State
  const [state, setState] = useState<ProctoringState>(INITIAL_PROCTORING_STATE);
  const [violations, setViolations] = useState<ProctoringViolation[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Service ref (persists across renders)
  const serviceRef = useRef<UniversalProctoringService | null>(null);

  // Get or create service
  const getService = useCallback((): UniversalProctoringService => {
    if (!serviceRef.current) {
      serviceRef.current = new UniversalProctoringService();
    }
    return serviceRef.current;
  }, []);

  // Handle state changes
  const handleStateChange = useCallback((newState: ProctoringState) => {
    setState(newState);
    setIsFullscreen(newState.isFullscreen);
  }, []);

  // Handle violations
  const handleViolation = useCallback(
    (violation: ProctoringViolation) => {
      setViolations((prev) => [...prev, violation]);
      if (onViolation) {
        onViolation(violation);
      }
    },
    [onViolation]
  );

  // Start proctoring
  const startProctoring = useCallback(
    async (params: StartProctoringParams): Promise<boolean> => {
      const service = getService();

      const callbacks: ProctoringCallbacks = {
        onViolation: handleViolation,
        onStateChange: handleStateChange,
        onFullscreenExit,
      };

      const startOptions: StartProctoringOptions = {
        settings: params.settings,
        session: params.session,
        videoElement: params.videoElement || undefined,
        canvasElement: params.canvasElement || undefined,
        aiConfig: params.aiConfig,
        tabConfig: params.tabConfig,
        fullscreenConfig: params.fullscreenConfig,
        debug,
      };

      // Reset violations on new start
      setViolations([]);

      return service.startProctoring(startOptions, callbacks);
    },
    [getService, handleViolation, handleStateChange, onFullscreenExit, debug]
  );

  // Stop proctoring
  const stopProctoring = useCallback(() => {
    const service = getService();
    service.stopProctoring();
    setState(INITIAL_PROCTORING_STATE);
  }, [getService]);

  // Request fullscreen
  const requestFullscreen = useCallback(async (): Promise<boolean> => {
    const service = getService();
    return service.requestFullscreen();
  }, [getService]);

  // Exit fullscreen
  const exitFullscreen = useCallback(async (): Promise<void> => {
    const service = getService();
    return service.exitFullscreen();
  }, [getService]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (serviceRef.current) {
        serviceRef.current.stopProctoring();
        serviceRef.current = null;
      }
    };
  }, []);

  return {
    state,
    isRunning: state.isRunning,
    violations,
    startProctoring,
    stopProctoring,
    requestFullscreen,
    exitFullscreen,
    isFullscreen,
  };
}

export default useUniversalProctoring;
