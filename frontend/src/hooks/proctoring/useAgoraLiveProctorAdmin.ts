// ============================================================================
// Hook: useAgoraLiveProctorAdmin
// ============================================================================
//
// React hook for admin live proctoring using Agora.
// Wraps AdminLiveService and provides reactive state.
//
// ============================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { AdminLiveService } from "@/universal-proctoring/live/AdminLiveService";
import type {
  AdminLiveState,
  CandidateStreamInfo,
  AdminLiveCallbacks,
} from "@/universal-proctoring/live/types";

export interface UseAgoraLiveProctorAdminOptions {
  assessmentId: string;
  adminId: string;
  autoStart?: boolean;
  onError?: (error: string) => void;
  debugMode?: boolean;
}

export interface UseAgoraLiveProctorAdminReturn {
  candidateStreams: Map<string, CandidateStreamInfo>;
  activeCandidates: string[];
  isLoading: boolean;
  isMonitoring: boolean;
  error: string | null;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  refreshCandidate: (sessionId: string) => Promise<void>;
  flagCandidate: (candidateId: string, reason: string, severity?: 'low' | 'medium' | 'high') => Promise<boolean>;
}

/**
 * Hook for admin live proctoring using Agora.
 */
export function useAgoraLiveProctorAdmin(
  options: UseAgoraLiveProctorAdminOptions
): UseAgoraLiveProctorAdminReturn {
  const { assessmentId, adminId, autoStart = false, onError, debugMode = false } = options;

  const [state, setState] = useState<AdminLiveState>({
    isMonitoring: false,
    isLoading: false,
    activeSessions: [],
    candidateStreams: new Map(),
  });
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<AdminLiveService | null>(null);

  // Create service instance when assessmentId or adminId changes
  useEffect(() => {
    if (!assessmentId || !adminId) {
      return;
    }

    // Cleanup old service before creating new one
    if (serviceRef.current) {
      serviceRef.current.stopMonitoring().catch(() => {});
      serviceRef.current = null;
    }

    serviceRef.current = new AdminLiveService({
      assessmentId,
      adminId,
      debugMode,
    });

    return () => {
      if (serviceRef.current) {
        serviceRef.current.stopMonitoring().catch(() => {});
        serviceRef.current = null;
      }
    };
  }, [assessmentId, adminId, debugMode]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && serviceRef.current && !state.isMonitoring) {
      startMonitoring();
    }
  }, [autoStart]);

  const startMonitoring = useCallback(async () => {
    if (!serviceRef.current) {
      return;
    }

    const callbacks: AdminLiveCallbacks = {
      onStateChange: (updates) => {
        setState((prev) => ({
          ...prev,
          ...updates,
          candidateStreams: updates.candidateStreams || prev.candidateStreams,
        }));
      },
      onError: (err) => {
        setError(err);
        onError?.(err);
      },
    };

    const result = await serviceRef.current.startMonitoring(callbacks);
    // Result contains { success, connectionReused } but we don't need to track it in the hook
    // The hook is simpler and doesn't need connection ownership tracking
  }, [onError]);

  const stopMonitoring = useCallback(async () => {
    if (serviceRef.current) {
      await serviceRef.current.stopMonitoring();
      setState({
        isMonitoring: false,
        isLoading: false,
        activeSessions: [],
        candidateStreams: new Map(),
      });
      setError(null);
    }
  }, []);

  const refreshCandidate = useCallback(async (sessionId: string) => {
    if (serviceRef.current) {
      await serviceRef.current.refreshCandidate(sessionId);
    }
  }, []);

  const flagCandidate = useCallback(async (
    candidateId: string,
    reason: string,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<boolean> => {
    if (!serviceRef.current) {
      return false;
    }
    return await serviceRef.current.flagCandidate(candidateId, reason, severity);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (serviceRef.current) {
        serviceRef.current.stopMonitoring().catch(() => {});
      }
    };
  }, []);

  return {
    candidateStreams: state.candidateStreams,
    activeCandidates: state.activeSessions,
    isLoading: state.isLoading,
    isMonitoring: state.isMonitoring,
    error,
    startMonitoring,
    stopMonitoring,
    refreshCandidate,
    flagCandidate,
  };
}
