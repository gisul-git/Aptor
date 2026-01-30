import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dsaService } from '@/services/dsa';

const QUERY_KEYS = {
  sqlQuestions: ['sql', 'questions'] as const,
  sqlQuestion: (id: string) => ['sql', 'questions', id] as const,
  sqlSubmissions: (testId: string) => ['sql', 'tests', testId, 'submissions'] as const,
};

/**
 * Hook for SQL-specific question operations
 */
export const useSQLQuestion = (questionId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.sqlQuestion(questionId || ''),
    queryFn: async () => {
      if (!questionId) throw new Error('Question ID is required');
      const response = await dsaService.getQuestion(questionId);
      return response.data;
    },
    enabled: !!questionId,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Check if a question is SQL type
 */
export const isSQLQuestion = (language?: string, questionType?: string): boolean => {
  if (!language && !questionType) return false;
  const lang = (language || '').toLowerCase();
  const type = (questionType || '').toLowerCase();
  return lang === 'sql' || type === 'sql';
};

/**
 * Format SQL test case results for display
 */
export const formatSQLTestCases = (passed: number, total: number): string => {
  return `${passed} / ${total} passed`;
};

