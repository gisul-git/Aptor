import { useEffect, useRef, useCallback, useState } from "react";

// Supported proctoring event types
export type ProctorEventType =
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
  | "FULLSCREEN_ENABLED"
  | "FULLSCREEN_REFUSED"
  | "COPY_RESTRICT"
  | "FOCUS_LOST"
  | "DEVTOOLS_OPEN"
  | "SCREENSHOT_ATTEMPT"
  | "PASTE_ATTEMPT"
  | "RIGHT_CLICK"
  | "IDLE";

export interface ProctorViolation {
  eventType: ProctorEventType;
  timestamp: string;
  assessmentId: string;
  userId: string;
  metadata?: Record<string, unknown>;
  snapshotBase64?: string;
}

interface UseProctorOptions {
  userId: string;
  assessmentId: string;
  onViolation?: (violation: ProctorViolation) => void;
  enableFullscreenDetection?: boolean;
  enableDevToolsDetection?: boolean;
  debugMode?: boolean;
}

interface UseProctorReturn {
  // State
  isFullscreen: boolean;
  fullscreenRefused: boolean;
  violations: ProctorViolation[];
  violationCount: number;
  lastViolation: ProctorViolation | null;
  
  // Actions
  recordViolation: (eventType: ProctorEventType, metadata?: Record<string, unknown>, snapshotBase64?: string) => Promise<void>;
  requestFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<void>;
  setFullscreenRefused: (refused: boolean) => void;
  
  // Debug
  simulateTabSwitch: () => void;
  simulateFullscreenExit: () => void;
}

// Check if debug mode is enabled
const isDebugMode = () => {
  if (typeof window === "undefined") return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("proctorDebug") === "true" || process.env.NEXT_PUBLIC_PROCTOR_DEBUG === "true";
};

/**
 * Enhanced proctoring hook with robust detection, debouncing, and debug mode.
 */
export function useProctor({
  userId,
  assessmentId,
  onViolation,
  enableFullscreenDetection = true,
  enableDevToolsDetection = false,
  debugMode = isDebugMode(),
}: UseProctorOptions): UseProctorReturn {
  // State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenRefused, setFullscreenRefused] = useState(false);
  const [violations, setViolations] = useState<ProctorViolation[]>([]);
  const [lastViolation, setLastViolation] = useState<ProctorViolation | null>(null);

  // Refs for deduplication and debouncing
  const lastEventTimeRef = useRef<Record<string, number>>({});
  const isBlurredRef = useRef(false);
  const wasFullscreenRef = useRef(false);
  const fullscreenExitCountRef = useRef(0);
  const pendingTabSwitchRef = useRef(false);

  // Debounce interval (ms)
  const DEBOUNCE_MS = 1000;

  // Debug logger
  const debugLog = useCallback((...args: unknown[]) => {
    if (debugMode) {
      console.log("[Proctor Debug]", ...args);
    }
  }, [debugMode]);

  // Check if event should be recorded (debouncing)
  const shouldRecordEvent = useCallback((eventType: string): boolean => {
    const now = Date.now();
    const lastTime = lastEventTimeRef.current[eventType] || 0;
    
    if (now - lastTime < DEBOUNCE_MS) {
      debugLog(`Debounced ${eventType} (last: ${now - lastTime}ms ago)`);
      return false;
    }
    
    lastEventTimeRef.current[eventType] = now;
    return true;
  }, [debugLog]);

  // Use refs to track current userId and assessmentId (they may change after hook initialization)
  const userIdRef = useRef(userId);
  const assessmentIdRef = useRef(assessmentId);
  
  useEffect(() => {
    userIdRef.current = userId;
    assessmentIdRef.current = assessmentId;
  }, [userId, assessmentId]);

  // Record a violation
  const recordViolation = useCallback(async (
    eventType: ProctorEventType,
    metadata?: Record<string, unknown>,
    snapshotBase64?: string
  ) => {
    // Use current values from refs (may have been updated after hook initialization)
    const currentUserId = userIdRef.current;
    const currentAssessmentId = assessmentIdRef.current;
    
    // Skip if userId or assessmentId not provided
    if (!currentUserId || !currentAssessmentId) {
      debugLog("Skipped recording - missing userId or assessmentId", { 
        userId: currentUserId, 
        assessmentId: currentAssessmentId 
      });
      return;
    }

    // Debounce check
    if (!shouldRecordEvent(eventType)) {
      return;
    }

    const violation: ProctorViolation = {
      eventType,
      timestamp: new Date().toISOString(),
      assessmentId: currentAssessmentId,
      userId: currentUserId,
      metadata,
      ...(snapshotBase64 && { snapshotBase64 }),
    };

    // Update local state
    setViolations((prev) => [...prev, violation]);
    setLastViolation(violation);

    // Log
    debugLog(`Event recorded: ${eventType}`, violation);
    console.log(`[Proctor] ${eventType} violation recorded:`, { 
      eventType, 
      userId: currentUserId, 
      assessmentId: currentAssessmentId 
    });

    // Notify callback
    if (onViolation) {
      onViolation(violation);
    }

    // Send to backend
    try {
      const response = await fetch("/api/proctor/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(violation),
      });

      if (!response.ok) {
        console.error("[Proctor] Failed to record violation:", response.statusText);
      } else {
        debugLog("Event sent to server successfully");
      }
    } catch (error) {
      console.error("[Proctor] Error sending violation:", error);
    }
  }, [userId, assessmentId, onViolation, shouldRecordEvent, debugLog]);

  // Request fullscreen
  const requestFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      const elem = document.documentElement;
      
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) {
        await (elem as any).mozRequestFullScreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }

      debugLog("Fullscreen requested successfully");
      return true;
    } catch (error) {
      console.error("[Proctor] Failed to enter fullscreen:", error);
      debugLog("Fullscreen request failed:", error);
      return false;
    }
  }, [debugLog]);

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      debugLog("Exited fullscreen");
    } catch (error) {
      console.error("[Proctor] Failed to exit fullscreen:", error);
    }
  }, [debugLog]);

  // Debug simulation functions
  const simulateTabSwitch = useCallback(() => {
    if (debugMode) {
      debugLog("Simulating TAB_SWITCH");
      recordViolation("TAB_SWITCH", { trigger: "debug_simulation" });
    }
  }, [debugMode, debugLog, recordViolation]);

  const simulateFullscreenExit = useCallback(() => {
    if (debugMode) {
      debugLog("Simulating FULLSCREEN_EXIT");
      fullscreenExitCountRef.current += 1;
      recordViolation("FULLSCREEN_EXIT", { 
        exitCount: fullscreenExitCountRef.current, 
        reason: "debug_simulation" 
      });
    }
  }, [debugMode, debugLog, recordViolation]);

  // Set up event listeners
  useEffect(() => {
    if (!userId || !assessmentId) {
      return;
    }

    debugLog("Proctor monitoring started", { userId, assessmentId });

    // Check current fullscreen state
    const checkFullscreen = () => {
      return !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
    };

    // Initialize fullscreen state
    const initialFullscreen = checkFullscreen();
    setIsFullscreen(initialFullscreen);
    wasFullscreenRef.current = initialFullscreen;

    // Handler for visibility change (TAB_SWITCH)
    const handleVisibilityChange = () => {
      debugLog("visibilitychange fired, hidden:", document.hidden);
      
      if (document.hidden) {
        // Tab became hidden
        if (!pendingTabSwitchRef.current) {
          pendingTabSwitchRef.current = true;
          
          // Small delay to deduplicate with blur event
          setTimeout(() => {
            if (pendingTabSwitchRef.current) {
              recordViolation("TAB_SWITCH", { trigger: "visibilitychange" });
              pendingTabSwitchRef.current = false;
            }
          }, 50);
        }
        isBlurredRef.current = true;
      } else {
        isBlurredRef.current = false;
        pendingTabSwitchRef.current = false;
      }
    };

    // Handler for window blur (FOCUS_LOST)
    const handleWindowBlur = () => {
      debugLog("window blur fired, document.hidden:", document.hidden);
      
      // If document is already hidden (tab switch), don't record FOCUS_LOST
      if (document.hidden) {
        // Cancel pending tab switch and record as TAB_SWITCH immediately
        if (pendingTabSwitchRef.current) {
          pendingTabSwitchRef.current = false;
          recordViolation("TAB_SWITCH", { trigger: "blur+visibilitychange" });
        }
        return;
      }

      // Window lost focus but tab is still visible (clicked outside browser)
      if (!isBlurredRef.current) {
        recordViolation("FOCUS_LOST", { trigger: "blur" });
        isBlurredRef.current = true;
      }
    };

    // Handler for window focus
    const handleWindowFocus = () => {
      debugLog("window focus fired");
      isBlurredRef.current = false;
      pendingTabSwitchRef.current = false;
    };

    // Handler for fullscreen change
    const handleFullscreenChange = () => {
      if (!enableFullscreenDetection) return;

      const currentFullscreen = checkFullscreen();
      debugLog("fullscreenchange fired, isFullscreen:", currentFullscreen);
      
      setIsFullscreen(currentFullscreen);

      if (wasFullscreenRef.current && !currentFullscreen) {
        // Exited fullscreen
        fullscreenExitCountRef.current += 1;
        recordViolation("FULLSCREEN_EXIT", {
          exitCount: fullscreenExitCountRef.current,
          reason: "fullscreenchange",
        });
      } else if (!wasFullscreenRef.current && currentFullscreen) {
        // Entered fullscreen
        recordViolation("FULLSCREEN_ENABLED", { reason: "fullscreenchange" });
      }

      wasFullscreenRef.current = currentFullscreen;
    };

    // DevTools detection (experimental)
    let devToolsCheck: ReturnType<typeof setInterval> | null = null;
    if (enableDevToolsDetection) {
      const threshold = 160;
      devToolsCheck = setInterval(() => {
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        if (widthDiff > threshold || heightDiff > threshold) {
          recordViolation("DEVTOOLS_OPEN", { widthDiff, heightDiff });
        }
      }, 2000);
    }

    // Attach listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    if (enableFullscreenDetection) {
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.addEventListener("mozfullscreenchange", handleFullscreenChange);
      document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    }

    // Cleanup
    return () => {
      debugLog("Proctor monitoring stopped");
      
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);

      if (enableFullscreenDetection) {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
        document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
        document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      }

      if (devToolsCheck) {
        clearInterval(devToolsCheck);
      }
    };
  }, [userId, assessmentId, enableFullscreenDetection, enableDevToolsDetection, recordViolation, debugLog]);

  return {
    // State
    isFullscreen,
    fullscreenRefused,
    violations,
    violationCount: violations.length,
    lastViolation,
    
    // Actions
    recordViolation,
    requestFullscreen,
    exitFullscreen,
    setFullscreenRefused,
    
    // Debug
    simulateTabSwitch,
    simulateFullscreenExit,
  };
}

export default useProctor;

