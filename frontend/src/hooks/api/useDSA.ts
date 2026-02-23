import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dsaService, type DSATest, type DSAQuestion, type CreateDSATestDto, type CreateDSAQuestionDto, type RunCodeDto, type SubmitCodeDto } from '@/services/dsa';

const QUERY_KEYS = {
  tests: ['dsa', 'tests'] as const,
  test: (id: string) => ['dsa', 'tests', id] as const,
  questions: ['dsa', 'questions'] as const,
  question: (id: string) => ['dsa', 'questions', id] as const,
  submissions: (testId: string) => ['dsa', 'tests', testId, 'submissions'] as const,
  submission: (id: string) => ['dsa', 'submissions', id] as const,
};

export const useDSATests = () => {
  return useQuery({
    queryKey: QUERY_KEYS.tests,
    queryFn: async () => {
      try {
        const tests = await dsaService.listTests();
        return Array.isArray(tests) ? tests : [];
      } catch (error: any) {
        console.warn('Failed to fetch DSA tests:', error?.message || error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  });
};

export const useDSATest = (testId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.test(testId || ''),
    queryFn: async () => {
      if (!testId) throw new Error('Test ID is required');
      const test = await dsaService.getTest(testId);
      return test;
    },
    enabled: !!testId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useDSAQuestions = (lightweight: boolean = false) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.questions, lightweight ? 'lightweight' : 'full'],
    queryFn: async () => {
      const response = await dsaService.listQuestions(lightweight);
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useDSAQuestion = (questionId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.question(questionId || ''),
    queryFn: async () => {
      if (!questionId) throw new Error('Question ID is required');
      const response = await dsaService.getQuestion(questionId);
      return response.data;
    },
    enabled: !!questionId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateDSATest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDSATestDto) => dsaService.createTest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useUpdateDSATest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: Partial<CreateDSATestDto> }) =>
      dsaService.updateTest(testId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(variables.testId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const usePatchDSATest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: Partial<CreateDSATestDto> }) =>
      dsaService.patchTest(testId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(variables.testId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useDeleteDSATest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => dsaService.deleteTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useCreateDSAQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDSAQuestionDto) => dsaService.createQuestion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions });
    },
  });
};

export const useRunDSACode = () => {
  return useMutation({
    mutationFn: (data: RunCodeDto) => dsaService.runCode(data),
  });
};

export const useSubmitDSACode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SubmitCodeDto) => dsaService.submitCode(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.submissions(variables.testId) });
    },
  });
};

/**
 * Pause DSA test mutation
 */
export const usePauseDSATest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (testId: string) => dsaService.pauseTest(testId),
    onSuccess: (_, testId) => {
      // Invalidate specific test and list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(testId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

/**
 * Resume DSA test mutation
 */
export const useResumeDSATest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (testId: string) => dsaService.resumeTest(testId),
    onSuccess: (_, testId) => {
      // Invalidate specific test and list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(testId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

/**
 * Clone DSA test mutation
 */
export const useCloneDSATest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      testId, 
      newTitle, 
      keepSchedule = false, 
      keepCandidates = false 
    }: { 
      testId: string; 
      newTitle: string; 
      keepSchedule?: boolean; 
      keepCandidates?: boolean;
    }) => dsaService.cloneTest(testId, { newTitle, keepSchedule, keepCandidates }),
    onSuccess: () => {
      // Invalidate tests list to show the new cloned test
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

/**
 * Get candidates for a DSA test
 */
export const useDSACandidates = (testId: string | undefined) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.test(testId || ''), 'candidates'] as const,
    queryFn: async () => {
      if (!testId) throw new Error('Test ID is required');
      const candidates = await dsaService.getCandidates(testId);
      return Array.isArray(candidates) ? candidates : [];
    },
    enabled: !!testId,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Question Analytics type matching the backend response
 */
export interface QuestionAnalytics {
  question_id: string;
  question_title: string;
  language: string;
  status?: string;
  invited?: boolean;
  invited_at?: string | null;
  passed_testcases: number;
  total_testcases: number;
  execution_time?: number;
  memory_used?: number;
  code: string;
  test_results: any[];
  ai_feedback?: any;
  created_at: string | null;
}

/**
 * Candidate Analytics type matching the backend response
 */
export interface CandidateAnalytics {
  candidate: {
    name: string;
    email: string;
  };
  candidateInfo?: {
    phone?: string | null;
    linkedIn?: string | null;
    github?: string | null;
    hasResume?: boolean;
    aaptorId?: string | null;
    customFields?: Record<string, any>;
  } | null;
  submission: {
    score: number;
    started_at: string | null;
    submitted_at: string | null;
    is_completed: boolean;
  } | null;
  question_analytics: QuestionAnalytics[];
  activity_logs: any[];
}

/**
 * Get candidate analytics for a DSA test
 */
export const useDSACandidateAnalytics = (testId: string | undefined, userId: string | undefined) => {
  return useQuery<CandidateAnalytics>({
    queryKey: [...QUERY_KEYS.test(testId || ''), 'analytics', userId] as const,
    queryFn: async (): Promise<CandidateAnalytics> => {
      if (!testId || !userId) {
        throw new Error('Test ID and User ID are required');
      }
      try {
        const response = await dsaService.getCandidateAnalytics(testId, userId);
        // The service returns response.data from axios, which is typed as ApiResponse<any>
        // But the backend actually returns the analytics object directly (not wrapped)
        // So response.data is the analytics object, or response itself if it's not wrapped
        const data = (response as any)?.data !== undefined ? (response as any).data : response;
        if (data === undefined || data === null) {
          throw new Error('Analytics data is undefined');
        }
        // Cast to CandidateAnalytics since we know the structure from the backend
        return data as CandidateAnalytics;
      } catch (error) {
        console.error('[useDSACandidateAnalytics] Error fetching analytics:', error);
        throw error;
      }
    },
    enabled: !!testId && !!userId,
    staleTime: 10 * 1000, // 10 seconds
    retry: 1, // Retry once on failure
  });
};

/**
 * Add candidate mutation
 */
export const useAddDSACandidate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: { name: string; email: string; aaptorId?: string } }) =>
      dsaService.addCandidate(testId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] });
    },
  });
};

/**
 * Remove candidate mutation
 */
export const useRemoveDSACandidate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ testId, userId }: { testId: string; userId: string }) =>
      dsaService.removeCandidate(testId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] });
    },
  });
};

/**
 * Send invitation mutation
 */
export const useSendDSAInvitation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ testId, email }: { testId: string; email: string }) =>
      dsaService.sendInvitation(testId, email),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] });
    },
  });
};

/**
 * Send invitations to all candidates mutation
 */
export const useSendDSAInvitationsToAll = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (testId: string) => dsaService.sendInvitationsToAll(testId),
    onSuccess: (_, testId) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(testId), 'candidates'] });
    },
  });
};

/**
 * Get candidate resume query
 */
export const useDSACandidateResume = (testId: string | undefined, userId: string | undefined, email: string | undefined) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.test(testId || ''), 'resume', userId] as const,
    queryFn: async () => {
      if (!testId || !userId || !email) throw new Error('Test ID, User ID, and email are required');
      const response = await dsaService.getCandidateResume(testId, userId, email);
      return response.data;
    },
    enabled: !!testId && !!userId && !!email,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Send feedback mutation
 */
export const useSendDSAFeedback = () => {
  return useMutation({
    mutationFn: ({ testId, userId }: { testId: string; userId: string }) =>
      dsaService.sendFeedback(testId, userId),
  });
};

/**
 * Bulk add candidates mutation
 */
export const useBulkAddDSACandidates = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ testId, formData }: { testId: string; formData: FormData }) =>
      dsaService.bulkAddCandidates(testId, formData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] });
    },
  });
};

/**
 * Get test submission query
 */
export const useDSATestSubmission = (testId: string | undefined, userId: string | undefined) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.test(testId || ''), 'submission', userId] as const,
    queryFn: async () => {
      if (!testId || !userId) throw new Error('Test ID and User ID are required');
      const response = await dsaService.getTestSubmission(testId, userId);
      return response.data;
    },
    enabled: !!testId && !!userId,
    staleTime: 10 * 1000, // 10 seconds
  });
};

/**
 * Start test mutation
 */
export const useStartDSATest = () => {
  return useMutation({
    mutationFn: ({ testId, userId }: { testId: string; userId: string }) =>
      dsaService.startTest(testId, userId),
  });
};

/**
 * Get public test query
 */
export const useDSAPublicTest = (testId: string | undefined, userId: string | undefined) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.test(testId || ''), 'public', userId] as const,
    queryFn: async () => {
      if (!testId || !userId) throw new Error('Test ID and User ID are required');
      const response = await dsaService.getPublicTest(testId, userId);
      return response.data;
    },
    enabled: !!testId && !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Get test question query
 */
export const useDSATestQuestion = (testId: string | undefined, questionId: string | undefined, userId: string | undefined) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.test(testId || ''), 'question', questionId, userId] as const,
    queryFn: async () => {
      if (!testId || !questionId || !userId) throw new Error('Test ID, Question ID, and User ID are required');
      const response = await dsaService.getTestQuestion(testId, questionId, userId);
      return response.data;
    },
    enabled: !!testId && !!questionId && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Final submit test mutation
 */
export const useFinalSubmitDSATest = () => {
  return useMutation({
    mutationFn: ({ testId, userId, data }: { testId: string; userId: string; data: { question_submissions: any[]; activity_logs: any[] } }) =>
      dsaService.finalSubmitTest(testId, userId, data),
  });
};

/**
 * Run SQL mutation (for DSA tests)
 */
export const useRunDSASQL = () => {
  return useMutation({
    mutationFn: (data: { question_id: string; sql_query: string }) =>
      dsaService.runSQL(data),
  });
};

/**
 * Submit SQL mutation (for DSA tests)
 */
export const useSubmitDSASQL = () => {
  return useMutation({
    mutationFn: (data: {
      question_id: string;
      sql_query: string;
      started_at: string;
      submitted_at: string;
      time_spent_seconds: number;
    }) => dsaService.submitSQL(data),
  });
};

/**
 * Run code public mutation (for DSA tests)
 */
export const useRunDSACodePublic = () => {
  return useMutation({
    mutationFn: (data: { question_id: string; source_code: string; language_id: string }) =>
      dsaService.runCodePublic(data),
  });
};

/**
 * Submit code full mutation (for DSA tests)
 */
export const useSubmitDSACodeFull = () => {
  return useMutation({
    mutationFn: (data: {
      question_id: string;
      source_code: string;
      language_id: string;
      started_at: string;
      submitted_at: string;
      time_spent_seconds: number;
    }) => dsaService.submitCodeFull(data),
  });
};



