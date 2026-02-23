import { create } from 'zustand';
import type { Assessment, Question } from '@/services/assessment';

/**
 * Assessment Store
 * 
 * Manages assessment-related state
 */

interface AssessmentState {
  currentAssessment: Assessment | null;
  currentQuestions: Question[];
  isSubmitting: boolean;
  answers: Map<string, string>;
  codeAnswers: Map<string, string>;
  
  setCurrentAssessment: (assessment: Assessment | null) => void;
  setCurrentQuestions: (questions: Question[]) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setAnswer: (questionId: string, answer: string) => void;
  setCodeAnswer: (questionId: string, code: string) => void;
  clearAnswers: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set) => ({
  currentAssessment: null,
  currentQuestions: [],
  isSubmitting: false,
  answers: new Map(),
  codeAnswers: new Map(),
  
  setCurrentAssessment: (assessment) => set({ currentAssessment: assessment }),
  setCurrentQuestions: (questions) => set({ currentQuestions: questions }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setAnswer: (questionId, answer) => 
    set((state) => {
      const newAnswers = new Map(state.answers);
      newAnswers.set(questionId, answer);
      return { answers: newAnswers };
    }),
  setCodeAnswer: (questionId, code) => 
    set((state) => {
      const newCodeAnswers = new Map(state.codeAnswers);
      newCodeAnswers.set(questionId, code);
      return { codeAnswers: newCodeAnswers };
    }),
  clearAnswers: () => set({ 
    answers: new Map(), 
    codeAnswers: new Map() 
  }),
}));




