/**
 * useAssessmentQuestions Hook
 * 
 * Manages questions state and operations:
 * - Fetch questions
 * - Organize by sections
 * - Current question tracking
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { assessmentService } from '@/services/assessment';

export interface Question {
  _id?: string;
  id?: string;
  questionText?: string;
  title?: string;
  description?: string;
  type: string;
  question_type?: string;
  difficulty?: string;
  options?: string[];
  score?: number;
  topic?: string;
  language?: string;
  languages?: string[];
  // ... other question fields
  [key: string]: any;
}

export interface Sections {
  mcq: Question[];
  subjective: Question[];
  pseudocode: Question[];
  coding: Question[];
  sql: Question[];
  aiml: Question[];
}

export type SectionKey = keyof Sections;

export function useAssessmentQuestions(assessmentId: string | undefined) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    if (!assessmentId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await assessmentService.getQuestions(assessmentId);
      
      if (response.success && response.data) {
        setQuestions(response.data);
      } else {
        throw new Error(response.message || 'Failed to fetch questions');
      }
    } catch (err: any) {
      console.error('Error fetching questions:', err);
      setError(err.message || 'Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Organize questions by sections
  const sections = useMemo<Sections>(() => {
    const organized: Sections = {
      mcq: [],
      subjective: [],
      pseudocode: [],
      coding: [],
      sql: [],
      aiml: [],
    };

    questions.forEach((question) => {
      const questionType = (question.type || question.question_type || '').toLowerCase();
      
      if (questionType === 'mcq' || questionType === 'multiple choice') {
        organized.mcq.push(question);
      } else if (questionType === 'subjective' || questionType === 'text') {
        organized.subjective.push(question);
      } else if (questionType === 'pseudocode' || questionType === 'pseudo code') {
        organized.pseudocode.push(question);
      } else if (questionType === 'coding' || questionType === 'code') {
        organized.coding.push(question);
      } else if (questionType === 'sql') {
        organized.sql.push(question);
      } else if (questionType === 'aiml' || questionType === 'ai/ml') {
        organized.aiml.push(question);
      }
    });

    return organized;
  }, [questions]);

  // Get question by ID
  const getQuestionById = useCallback((questionId: string): Question | undefined => {
    return questions.find(q => q._id === questionId || q.id === questionId);
  }, [questions]);

  // Get questions for a section
  const getSectionQuestions = useCallback((section: keyof Sections): Question[] => {
    return sections[section] || [];
  }, [sections]);

  // Get total question count
  const totalQuestions = useMemo(() => questions.length, [questions]);

  // Get section counts
  const sectionCounts = useMemo(() => {
    return {
      mcq: sections.mcq.length,
      subjective: sections.subjective.length,
      pseudocode: sections.pseudocode.length,
      coding: sections.coding.length,
      sql: sections.sql.length,
      aiml: sections.aiml.length,
    };
  }, [sections]);

  return {
    questions,
    sections,
    isLoading,
    error,
    totalQuestions,
    sectionCounts,
    getQuestionById,
    getSectionQuestions,
    refetch: fetchQuestions,
  };
}


