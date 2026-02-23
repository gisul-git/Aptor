/**
 * useAssessmentSession Hook
 * 
 * Manages the main assessment session state:
 * - Loading state
 * - Assessment data
 * - Session initialization
 * - Waiting for start (strict mode)
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { assessmentService } from '@/services/assessment';

interface AssessmentSessionState {
  isLoading: boolean;
  isReady: boolean;
  isWaiting: boolean;
  isSubmitting: boolean;
  isFinished: boolean;
  assessment: any | null;
  error: string | null;
  startTime: Date | null;
  timeUntilStart: number | null;
}

export function useAssessmentSession() {
  const router = useRouter();
  const { id, token } = router.query;
  const { data: session } = useSession();
  
  const [state, setState] = useState<AssessmentSessionState>({
    isLoading: true,
    isReady: false,
    isWaiting: false,
    isSubmitting: false,
    isFinished: false,
    assessment: null,
    error: null,
    startTime: null,
    timeUntilStart: null,
  });

  // Initialize session
  const initializeSession = useCallback(async () => {
    if (!id || !token || typeof id !== 'string' || typeof token !== 'string') {
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Start assessment session
      const sessionResponse = await assessmentService.startSession({
        assessmentId: id,
        token,
        email: (session?.user?.email as string) || '',
        name: (session?.user?.name as string) || 'Candidate',
      });

      if (!sessionResponse.success || !sessionResponse.data) {
        throw new Error(sessionResponse.message || 'Failed to start session');
      }

      const sessionData = sessionResponse.data;
      
      // Get assessment details
      const assessmentResponse = await assessmentService.getById(id);
      
      if (!assessmentResponse.success || !assessmentResponse.data) {
        throw new Error('Failed to load assessment');
      }

      const assessment = assessmentResponse.data;
      
      // Check if waiting for start (strict mode)
      const examSettings = assessment.schedule;
      // Handle both startDate and startTime properties
      const startDate = examSettings?.startDate || (examSettings as any)?.startTime;
      const isWaiting = startDate 
        ? new Date(startDate) > new Date()
        : false;
      
      const startTime = startDate 
        ? new Date(startDate)
        : null;

      setState(prev => ({
        ...prev,
        isLoading: false,
        isReady: !isWaiting,
        isWaiting,
        assessment,
        startTime,
        error: null,
      }));
    } catch (error: any) {
      console.error('Session initialization error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to initialize session',
      }));
    }
  }, [id, token, session]);

  // Calculate time until start
  useEffect(() => {
    if (!state.isWaiting || !state.startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const timeUntilStart = Math.max(0, state.startTime!.getTime() - now.getTime());
      
      if (timeUntilStart === 0) {
        setState(prev => ({
          ...prev,
          isWaiting: false,
          isReady: true,
          timeUntilStart: null,
        }));
      } else {
        setState(prev => ({
          ...prev,
          timeUntilStart: Math.floor(timeUntilStart / 1000), // seconds
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isWaiting, state.startTime]);

  // Initialize on mount
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // Set submitting state
  const setSubmitting = useCallback((isSubmitting: boolean) => {
    setState(prev => ({ ...prev, isSubmitting }));
  }, []);

  // Set finished state
  const setFinished = useCallback((isFinished: boolean) => {
    setState(prev => ({ ...prev, isFinished, isSubmitting: false }));
  }, []);

  return {
    ...state,
    assessmentId: id as string | undefined,
    token: token as string | undefined,
    initializeSession,
    setSubmitting,
    setFinished,
  };
}


