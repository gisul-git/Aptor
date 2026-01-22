import { useEffect, useRef, useCallback } from "react";

// Supported proctoring event types
export type ProctorEventType =
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
  | "FULLSCREEN_ENABLED"
  | "COPY_RESTRICT"
  | "FOCUS_LOST"
  | "DEVTOOLS_OPEN"
  | "SCREENSHOT_ATTEMPT"
  | "PASTE_ATTEMPT"
  | "RIGHT_CLICK"
  | "IDLE";

interface TabSwitchProctorOptions {
  userId: string;
  assessmentId: string;
  onViolation?: (violation: ProctorViolation) => void;
  enableFullscreenDetection?: boolean;
  enableDevToolsDetection?: boolean;
}

interface ProctorViolation {
  eventType: ProctorEventType;
  timestamp: string;
  assessmentId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Custom hook to detect and record proctoring events during an exam session.
 * 
 * Detects:
 * - Tab switches (visibilitychange event)
 * - Window blur/focus events
 * - Fullscreen exits (if enabled)
 * - DevTools open attempts (if enabled)
 */
export function useTabSwitchProctor({
  userId,
  assessmentId,
  onViolation,
  enableFullscreenDetection = true,
  enableDevToolsDetection = false,
}: TabSwitchProctorOptions) {
  // Track violations locally
  const violationsRef = useRef<ProctorViolation[]>([]);
  
  // Track if window was already blurred to avoid duplicate events
  const isBlurredRef = useRef(false);
  
  // Track fullscreen state
  const wasFullscreenRef = useRef(false);

  // Function to record a violation
  const recordViolation = useCallback(async (
    eventType: ProctorEventType,
    metadata?: Record<string, unknown>
  ) => {
    const violation: ProctorViolation = {
      eventType,
      timestamp: new Date().toISOString(),
      assessmentId,
      userId,
      metadata,
    };

    // Log locally
    violationsRef.current.push(violation);
    console.log(`[Proctor] ${eventType} violation recorded:`, violation);

    // Notify callback if provided
    if (onViolation) {
      onViolation(violation);
    }

    // Send to backend
    try {
      const response = await fetch("/api/proctor/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(violation),
      });

      if (!response.ok) {
        console.error("[Proctor] Failed to record violation on server:", response.statusText);
      }
    } catch (error) {
      console.error("[Proctor] Error sending violation to server:", error);
    }
  }, [assessmentId, userId, onViolation]);

  useEffect(() => {
    // Skip if userId or assessmentId are not provided
    if (!userId || !assessmentId) {
      return;
    }

    // Handler for visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became hidden - record violation
        recordViolation("TAB_SWITCH");
        isBlurredRef.current = true;
      } else {
        isBlurredRef.current = false;
      }
    };

    // Handler for window blur (window loses focus)
    const handleWindowBlur = () => {
      // Only record if not already tracked by visibility change
      // This handles cases like switching to another app on desktop
      if (!document.hidden && !isBlurredRef.current) {
        recordViolation("FOCUS_LOST");
        isBlurredRef.current = true;
      }
    };

    // Handler for window focus (window regains focus)
    const handleWindowFocus = () => {
      isBlurredRef.current = false;
    };

    // Handler for fullscreen change
    const handleFullscreenChange = () => {
      if (enableFullscreenDetection) {
        const isFullscreen = !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
        );

        if (wasFullscreenRef.current && !isFullscreen) {
          // Exited fullscreen
          recordViolation("FULLSCREEN_EXIT");
        } else if (!wasFullscreenRef.current && isFullscreen) {
          // Entered fullscreen - record as enabled (not a violation, but tracked)
          recordViolation("FULLSCREEN_ENABLED");
        }

        wasFullscreenRef.current = isFullscreen;
      }
    };

    // Handler for DevTools detection (experimental)
    let devToolsCheck: ReturnType<typeof setInterval> | null = null;
    if (enableDevToolsDetection) {
      const threshold = 160;
      devToolsCheck = setInterval(() => {
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        if (widthThreshold || heightThreshold) {
          recordViolation("DEVTOOLS_OPEN", { widthThreshold, heightThreshold });
        }
      }, 1000);
    }

    // Attach event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    
    if (enableFullscreenDetection) {
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.addEventListener("mozfullscreenchange", handleFullscreenChange);
      document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    }

    console.log("[Proctor] Monitoring started for assessment:", assessmentId);

    // Cleanup on unmount
    return () => {
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

      console.log("[Proctor] Monitoring stopped");
    };
  }, [userId, assessmentId, recordViolation, enableFullscreenDetection, enableDevToolsDetection]);

  // Return utilities for the component
  return {
    getViolations: () => [...violationsRef.current],
    getViolationCount: () => violationsRef.current.length,
    recordCustomViolation: recordViolation,
  };
}

export type { ProctorViolation, TabSwitchProctorOptions };
