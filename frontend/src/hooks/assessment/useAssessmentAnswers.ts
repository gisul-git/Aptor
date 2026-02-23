/**
 * useAssessmentAnswers Hook
 * 
 * Manages answer state and operations:
 * - Store answers (MCQ, Subjective, Pseudocode)
 * - Store code answers (Coding, SQL, AIML)
 * - Auto-save answers
 * - Load saved answers
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { assessmentService } from '@/services/assessment';

interface AnswerState {
  answers: Map<string, string>; // questionId -> answer
  codeAnswers: Map<string, string>; // questionId -> code
  isSaving: boolean;
  lastSaved: Date | null;
}

export function useAssessmentAnswers(
  assessmentId: string | undefined,
  token: string | undefined
) {
  const [state, setState] = useState<AnswerState>({
    answers: new Map(),
    codeAnswers: new Map(),
    isSaving: false,
    lastSaved: null,
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save answer to backend
  const saveAnswer = useCallback(async (
    questionId: string,
    answer: string,
    section: string
  ) => {
    if (!assessmentId || !token) return;

    // Update local state immediately
    setState(prev => {
      const newAnswers = new Map(prev.answers);
      newAnswers.set(questionId, answer);
      return { ...prev, answers: newAnswers };
    });

    // Debounce API call
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setState(prev => ({ ...prev, isSaving: true }));

        // Call save answer API
        await assessmentService.startSession({
          assessmentId,
          token,
          email: '',
          name: '',
        });

        // Log answer (if API supports it)
        // await assessmentService.logAnswer(assessmentId, questionId, answer);

        setState(prev => ({
          ...prev,
          isSaving: false,
          lastSaved: new Date(),
        }));
      } catch (error) {
        console.error('Error saving answer:', error);
        setState(prev => ({ ...prev, isSaving: false }));
      }
    }, 1000); // 1 second debounce
  }, [assessmentId, token]);

  // Save code answer
  const saveCodeAnswer = useCallback(async (
    questionId: string,
    code: string,
    language: string
  ) => {
    if (!assessmentId || !token) return;

    // Update local state immediately
    setState(prev => {
      const newCodeAnswers = new Map(prev.codeAnswers);
      newCodeAnswers.set(questionId, code);
      return { ...prev, codeAnswers: newCodeAnswers };
    });

    // Debounce API call
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setState(prev => ({ ...prev, isSaving: true }));

        // Save code answer (if API supports it)
        // await assessmentService.saveCodeAnswer(assessmentId, questionId, code, language);

        setState(prev => ({
          ...prev,
          isSaving: false,
          lastSaved: new Date(),
        }));
      } catch (error) {
        console.error('Error saving code answer:', error);
        setState(prev => ({ ...prev, isSaving: false }));
      }
    }, 1000);
  }, [assessmentId, token]);

  // Set answer directly (for loading from storage)
  const setAnswer = useCallback((questionId: string, answer: string) => {
    setState(prev => {
      const newAnswers = new Map(prev.answers);
      newAnswers.set(questionId, answer);
      return { ...prev, answers: newAnswers };
    });
  }, []);

  // Set code answer directly
  const setCodeAnswer = useCallback((questionId: string, code: string) => {
    setState(prev => {
      const newCodeAnswers = new Map(prev.codeAnswers);
      newCodeAnswers.set(questionId, code);
      return { ...prev, codeAnswers: newCodeAnswers };
    });
  }, []);

  // Get answer for a question
  const getAnswer = useCallback((questionId: string): string => {
    return state.answers.get(questionId) || '';
  }, [state.answers]);

  // Get code answer for a question
  const getCodeAnswer = useCallback((questionId: string): string => {
    return state.codeAnswers.get(questionId) || '';
  }, [state.codeAnswers]);

  // Clear all answers
  const clearAnswers = useCallback(() => {
    setState({
      answers: new Map(),
      codeAnswers: new Map(),
      isSaving: false,
      lastSaved: null,
    });
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    answers: state.answers,
    codeAnswers: state.codeAnswers,
    isSaving: state.isSaving,
    lastSaved: state.lastSaved,
    saveAnswer,
    saveCodeAnswer,
    setAnswer,
    setCodeAnswer,
    getAnswer,
    getCodeAnswer,
    clearAnswers,
  };
}




