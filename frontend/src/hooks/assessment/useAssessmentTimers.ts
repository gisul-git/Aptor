/**
 * useAssessmentTimers Hook
 * 
 * Manages assessment timers:
 * - Overall assessment timer
 * - Per-section timers (optional)
 * - Auto-submit on expiration
 * - Section locking on timer expiration
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface TimerSettings {
  duration: number; // in seconds
  enablePerSectionTimers?: boolean;
  sectionTimers?: Record<string, number>; // sectionId -> seconds
  onExpire?: () => void; // Called when overall timer expires
  onSectionExpire?: (sectionId: string) => void; // Called when section timer expires
}

interface TimerState {
  timeRemaining: number; // Overall timer in seconds
  sectionTimers: Record<string, number>; // Per-section timers
  lockedSections: Set<string>; // Sections locked due to timer expiration
  isRunning: boolean;
  hasExpired: boolean;
}

export function useAssessmentTimers(settings: TimerSettings) {
  const [state, setState] = useState<TimerState>({
    timeRemaining: settings.duration || 0,
    sectionTimers: settings.sectionTimers || {},
    lockedSections: new Set(),
    isRunning: false,
    hasExpired: false,
  });

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sectionTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize timers
  useEffect(() => {
    setState(prev => ({
      ...prev,
      timeRemaining: settings.duration || 0,
      sectionTimers: settings.sectionTimers || {},
      isRunning: settings.duration > 0,
    }));
  }, [settings.duration, settings.sectionTimers]);

  // Overall timer countdown
  useEffect(() => {
    if (!state.isRunning || state.timeRemaining <= 0) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.timeRemaining <= 1) {
          // Timer expired
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          
          // Call expire callback
          if (settings.onExpire) {
            settings.onExpire();
          }

          return {
            ...prev,
            timeRemaining: 0,
            isRunning: false,
            hasExpired: true,
          };
        }

        return {
          ...prev,
          timeRemaining: prev.timeRemaining - 1,
        };
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [state.isRunning, state.timeRemaining, settings]);

  // Per-section timer countdown
  useEffect(() => {
    if (!settings.enablePerSectionTimers || Object.keys(state.sectionTimers).length === 0) {
      if (sectionTimerIntervalRef.current) {
        clearInterval(sectionTimerIntervalRef.current);
        sectionTimerIntervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval
    if (sectionTimerIntervalRef.current) {
      clearInterval(sectionTimerIntervalRef.current);
    }

    sectionTimerIntervalRef.current = setInterval(() => {
      setState((prev) => {
        const newSectionTimers = { ...prev.sectionTimers };
        const newLockedSections = new Set(prev.lockedSections);
        let hasChanges = false;

        // Update each section timer
        Object.entries(newSectionTimers).forEach(([sectionId, timeRemaining]) => {
          if (timeRemaining > 0 && !newLockedSections.has(sectionId)) {
            if (timeRemaining <= 1) {
              // Section timer expired
              newLockedSections.add(sectionId);
              newSectionTimers[sectionId] = 0;
              hasChanges = true;

              // Call section expire callback
              if (settings.onSectionExpire) {
                settings.onSectionExpire(sectionId);
              }
            } else {
              newSectionTimers[sectionId] = timeRemaining - 1;
              hasChanges = true;
            }
          }
        });

        if (!hasChanges) {
          return prev;
        }

        return {
          ...prev,
          sectionTimers: newSectionTimers,
          lockedSections: newLockedSections,
        };
      });
    }, 1000);

    return () => {
      if (sectionTimerIntervalRef.current) {
        clearInterval(sectionTimerIntervalRef.current);
        sectionTimerIntervalRef.current = null;
      }
    };
  }, [settings.enablePerSectionTimers, state.sectionTimers, settings]);

  // Start timer
  const startTimer = useCallback(() => {
    setState(prev => ({
      ...prev,
      isRunning: true,
    }));
  }, []);

  // Pause timer
  const pauseTimer = useCallback(() => {
    setState(prev => ({
      ...prev,
      isRunning: false,
    }));
  }, []);

  // Reset timer
  const resetTimer = useCallback((newDuration?: number) => {
    setState(prev => ({
      ...prev,
      timeRemaining: newDuration || settings.duration || 0,
      isRunning: false,
      hasExpired: false,
    }));
  }, [settings.duration]);

  // Get section timer
  const getSectionTimer = useCallback((sectionId: string): number => {
    return state.sectionTimers[sectionId] || 0;
  }, [state.sectionTimers]);

  // Check if section is locked
  const isSectionLocked = useCallback((sectionId: string): boolean => {
    return state.lockedSections.has(sectionId);
  }, [state.lockedSections]);

  // Get time percentage remaining
  const getTimePercentage = useCallback((): number => {
    if (!settings.duration || settings.duration === 0) return 100;
    return (state.timeRemaining / settings.duration) * 100;
  }, [state.timeRemaining, settings.duration]);

  // Check if time is low (less than 10%)
  const isTimeLow = useCallback((): boolean => {
    return getTimePercentage() <= 10;
  }, [getTimePercentage]);

  // Check if time is critical (less than 5%)
  const isTimeCritical = useCallback((): boolean => {
    return getTimePercentage() <= 5;
  }, [getTimePercentage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (sectionTimerIntervalRef.current) {
        clearInterval(sectionTimerIntervalRef.current);
      }
    };
  }, []);

  return {
    timeRemaining: state.timeRemaining,
    sectionTimers: state.sectionTimers,
    lockedSections: state.lockedSections,
    isRunning: state.isRunning,
    hasExpired: state.hasExpired,
    startTimer,
    pauseTimer,
    resetTimer,
    getSectionTimer,
    isSectionLocked,
    getTimePercentage,
    isTimeLow,
    isTimeCritical,
  };
}




