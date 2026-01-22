import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

// Event type labels - single source of truth for UI
export const EVENT_TYPE_LABELS: Record<string, string> = {
  TAB_SWITCH: "Tab switch detected",
  FOCUS_LOST: "Window focus was lost",
  FULLSCREEN_EXIT: "Fullscreen was exited",
  FULLSCREEN_ENABLED: "Fullscreen was enabled",
  FULLSCREEN_REFUSED: "Fullscreen was declined",
  COPY_RESTRICT: "Copy restriction violated",
  PASTE_ATTEMPT: "Paste attempt blocked",
  RIGHT_CLICK: "Right click blocked",
  DEVTOOLS_OPEN: "Developer tools opened",
  SCREENSHOT_ATTEMPT: "Screenshot attempt detected",
  IDLE: "Idle timeout detected",
  GAZE_AWAY: "Gaze away detected",
  MULTI_FACE: "Multiple faces detected",
  SPOOF_DETECTED: "Spoof attempt detected",
};

export interface ProctorLog {
  _id: string;
  eventType: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  snapshotBase64?: string;
  receivedAt?: string;
}

export interface ProctorSummary {
  summary: Record<string, number>;
  totalViolations: number;
  violations: ProctorLog[];
  eventTypeLabels: Record<string, string>;
}

export interface UseProctorPollingOptions {
  assessmentId: string;
  userId: string;
  enabled?: boolean;
  pollInterval?: number; // in milliseconds
  debugMode?: boolean;
}

export interface UseProctorPollingReturn {
  // Data
  summary: ProctorSummary | null;
  logs: ProctorLog[];
  totalViolations: number;
  eventTypeLabels: Record<string, string>;
  
  // Status
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Actions
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

// Check if debug mode is enabled via URL or env
const isDebugMode = (): boolean => {
  if (typeof window === "undefined") return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("proctorDebug") === "true" || process.env.NEXT_PUBLIC_PROCTOR_DEBUG === "true";
};

/**
 * Hook for polling proctoring data with automatic refresh and manual control.
 * 
 * Features:
 * - Automatic polling at configurable intervals
 * - Manual refresh capability
 * - Debounced updates to prevent unnecessary re-renders
 * - Debug mode for faster polling during development
 * - Last updated timestamp
 */
export function useProctorPolling({
  assessmentId,
  userId,
  enabled = true,
  pollInterval = 5000, // 5 seconds default
  debugMode = isDebugMode(),
}: UseProctorPollingOptions): UseProctorPollingReturn {
  // State
  const [summary, setSummary] = useState<ProctorSummary | null>(null);
  const [logs, setLogs] = useState<ProctorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refs
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTotalViolationsRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  // Use shorter interval in debug mode
  const effectivePollInterval = debugMode ? 2000 : pollInterval;

  // Debug logger
  const debugLog = useCallback((...args: unknown[]) => {
    if (debugMode) {
      console.log("[Proctor Polling]", ...args);
    }
  }, [debugMode]);

  // Fetch proctoring data
  const fetchData = useCallback(async (silent = false) => {
    if (!assessmentId || !userId) {
      debugLog("Skipping fetch - missing assessmentId or userId");
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      debugLog("Fetching proctoring data...");

      // Fetch summary
      const summaryResponse = await axios.get(
        `/api/v1/proctor/summary?assessmentId=${encodeURIComponent(assessmentId)}&userId=${encodeURIComponent(userId)}`
      );

      if (!isMountedRef.current) return;

      if (summaryResponse.data?.success && summaryResponse.data?.data) {
        const newSummary = summaryResponse.data.data as ProctorSummary;
        
        // Only update if data has changed (debounce)
        if (newSummary.totalViolations !== lastTotalViolationsRef.current) {
          debugLog(`Violations changed: ${lastTotalViolationsRef.current} → ${newSummary.totalViolations}`);
          lastTotalViolationsRef.current = newSummary.totalViolations;
          
          // Merge with our labels
          setSummary({
            ...newSummary,
            eventTypeLabels: { ...EVENT_TYPE_LABELS, ...newSummary.eventTypeLabels },
          });
        } else {
          debugLog("No changes detected");
        }
      }

      // Fetch logs
      const logsResponse = await axios.get(
        `/api/v1/proctor/logs?assessmentId=${encodeURIComponent(assessmentId)}&userId=${encodeURIComponent(userId)}`
      );

      if (!isMountedRef.current) return;

      if (logsResponse.data?.success && logsResponse.data?.data?.logs) {
        setLogs(logsResponse.data.data.logs);
      }

      setLastUpdated(new Date());
      debugLog("Fetch complete");
    } catch (err: any) {
      if (!isMountedRef.current) return;
      
      const errorMessage = err.response?.data?.message || err.message || "Failed to fetch proctoring data";
      setError(errorMessage);
      console.error("[Proctor Polling] Error:", errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [assessmentId, userId, debugLog]);

  // Manual refresh
  const refresh = useCallback(async () => {
    debugLog("Manual refresh triggered");
    await fetchData(false);
  }, [fetchData, debugLog]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      debugLog("Polling already active");
      return;
    }

    debugLog(`Starting polling (interval: ${effectivePollInterval}ms)`);
    setIsPolling(true);

    pollIntervalRef.current = setInterval(() => {
      fetchData(true); // Silent fetch for polling
    }, effectivePollInterval);
  }, [fetchData, effectivePollInterval, debugLog]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      debugLog("Stopping polling");
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      setIsPolling(false);
    }
  }, [debugLog]);

  // Initial fetch and polling setup
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled && assessmentId && userId) {
      // Initial fetch
      fetchData(false);

      // Start polling
      startPolling();
    }

    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [enabled, assessmentId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Data
    summary,
    logs,
    totalViolations: summary?.totalViolations ?? 0,
    eventTypeLabels: { ...EVENT_TYPE_LABELS, ...(summary?.eventTypeLabels || {}) },
    
    // Status
    isLoading,
    isPolling,
    error,
    lastUpdated,
    
    // Actions
    refresh,
    startPolling,
    stopPolling,
  };
}

export default useProctorPolling;

