/**
 * useAssessmentNavigation Hook
 * 
 * Manages navigation between questions and sections:
 * - Current section tracking
 * - Current question index
 * - Navigation functions (next, previous, go to section)
 * - Section completion tracking
 */

import { useState, useCallback, useMemo } from 'react';
import type { Sections } from './useAssessmentQuestions';

type SectionKey = keyof Sections;

interface NavigationState {
  currentSection: SectionKey | null;
  currentQuestionIndex: number;
  completedSections: Set<SectionKey>;
  lockedSections: Set<SectionKey>;
}

export function useAssessmentNavigation(sections: Sections) {
  const [state, setState] = useState<NavigationState>({
    currentSection: null,
    currentQuestionIndex: 0,
    completedSections: new Set(),
    lockedSections: new Set(),
  });

  // Get current section questions
  const currentSectionQuestions = useMemo(() => {
    if (!state.currentSection) return [];
    return sections[state.currentSection] || [];
  }, [sections, state.currentSection]);

  // Get current question
  const currentQuestion = useMemo(() => {
    if (!state.currentSection || currentSectionQuestions.length === 0) return null;
    if (state.currentQuestionIndex < 0 || state.currentQuestionIndex >= currentSectionQuestions.length) {
      return null;
    }
    return currentSectionQuestions[state.currentQuestionIndex];
  }, [currentSectionQuestions, state.currentQuestionIndex, state.currentSection]);

  // Initialize to first section with questions
  const initializeNavigation = useCallback(() => {
    const sectionOrder: SectionKey[] = ['mcq', 'pseudocode', 'subjective', 'coding', 'sql', 'aiml'];
    
    for (const section of sectionOrder) {
      if (sections[section] && sections[section].length > 0) {
        setState(prev => ({
          ...prev,
          currentSection: section,
          currentQuestionIndex: 0,
        }));
        break;
      }
    }
  }, [sections]);

  // Navigate to specific question
  const navigateToQuestion = useCallback((section: SectionKey, questionIndex: number) => {
    const sectionQuestions = sections[section] || [];
    
    if (questionIndex < 0 || questionIndex >= sectionQuestions.length) {
      return;
    }

    setState(prev => ({
      ...prev,
      currentSection: section,
      currentQuestionIndex: questionIndex,
    }));
  }, [sections]);

  // Navigate to next question
  const navigateNext = useCallback(() => {
    if (!state.currentSection) return;

    const sectionQuestions = sections[state.currentSection] || [];
    const nextIndex = state.currentQuestionIndex + 1;

    if (nextIndex < sectionQuestions.length) {
      setState(prev => ({
        ...prev,
        currentQuestionIndex: nextIndex,
      }));
    } else {
      // Move to next section
      const sectionOrder: SectionKey[] = ['mcq', 'pseudocode', 'subjective', 'coding', 'sql', 'aiml'];
      const currentIndex = sectionOrder.indexOf(state.currentSection);
      
      for (let i = currentIndex + 1; i < sectionOrder.length; i++) {
        const nextSection = sectionOrder[i];
        if (sections[nextSection] && sections[nextSection].length > 0) {
          setState(prev => ({
            ...prev,
            currentSection: nextSection,
            currentQuestionIndex: 0,
          }));
          break;
        }
      }
    }
  }, [state.currentSection, state.currentQuestionIndex, sections]);

  // Navigate to previous question
  const navigatePrevious = useCallback(() => {
    if (!state.currentSection) return;

    const prevIndex = state.currentQuestionIndex - 1;

    if (prevIndex >= 0) {
      setState(prev => ({
        ...prev,
        currentQuestionIndex: prevIndex,
      }));
    } else {
      // Move to previous section
      const sectionOrder: SectionKey[] = ['mcq', 'pseudocode', 'subjective', 'coding', 'sql', 'aiml'];
      const currentIndex = sectionOrder.indexOf(state.currentSection);
      
      for (let i = currentIndex - 1; i >= 0; i--) {
        const prevSection = sectionOrder[i];
        if (sections[prevSection] && sections[prevSection].length > 0) {
          const prevSectionQuestions = sections[prevSection];
          setState(prev => ({
            ...prev,
            currentSection: prevSection,
            currentQuestionIndex: prevSectionQuestions.length - 1,
          }));
          break;
        }
      }
    }
  }, [state.currentSection, state.currentQuestionIndex, sections]);

  // Mark section as completed
  const markSectionCompleted = useCallback((section: SectionKey) => {
    setState(prev => {
      const newCompleted = new Set(prev.completedSections);
      newCompleted.add(section);
      return { ...prev, completedSections: newCompleted };
    });
  }, []);

  // Lock section (e.g., timer expired)
  const lockSection = useCallback((section: SectionKey) => {
    setState(prev => {
      const newLocked = new Set(prev.lockedSections);
      newLocked.add(section);
      return { ...prev, lockedSections: newLocked };
    });
  }, []);

  // Check if is first question
  const isFirstQuestion = useMemo(() => {
    if (!state.currentSection) return false;
    const sectionOrder: SectionKey[] = ['mcq', 'pseudocode', 'subjective', 'coding', 'sql', 'aiml'];
    const currentIndex = sectionOrder.indexOf(state.currentSection);
    
    // Check if it's the first section with questions
    for (let i = 0; i < currentIndex; i++) {
      if (sections[sectionOrder[i]] && sections[sectionOrder[i]].length > 0) {
        return false;
      }
    }
    
    return state.currentQuestionIndex === 0;
  }, [state.currentSection, state.currentQuestionIndex, sections]);

  // Check if is last question
  const isLastQuestion = useMemo(() => {
    if (!state.currentSection) return false;
    
    const sectionOrder: SectionKey[] = ['mcq', 'pseudocode', 'subjective', 'coding', 'sql', 'aiml'];
    const currentIndex = sectionOrder.indexOf(state.currentSection);
    
    // Check if it's the last section with questions
    let lastSection: SectionKey | null = null;
    for (let i = sectionOrder.length - 1; i >= 0; i--) {
      if (sections[sectionOrder[i]] && sections[sectionOrder[i]].length > 0) {
        lastSection = sectionOrder[i];
        break;
      }
    }
    
    if (!lastSection || state.currentSection !== lastSection) {
      return false;
    }
    
    return state.currentQuestionIndex === currentSectionQuestions.length - 1;
  }, [state.currentSection, state.currentQuestionIndex, currentSectionQuestions.length, sections]);

  return {
    currentSection: state.currentSection,
    currentQuestionIndex: state.currentQuestionIndex,
    currentQuestion,
    currentSectionQuestions,
    completedSections: state.completedSections,
    lockedSections: state.lockedSections,
    isFirstQuestion,
    isLastQuestion,
    initializeNavigation,
    navigateToQuestion,
    navigateNext,
    navigatePrevious,
    markSectionCompleted,
    lockSection,
  };
}




