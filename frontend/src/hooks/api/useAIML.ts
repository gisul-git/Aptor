import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aimlService, type AIMLTest, type AIMLQuestion, type CreateAIMLTestDto, type CreateAIMLQuestionDto, type ExecuteNotebookDto } from '@/services/aiml';

const QUERY_KEYS = {
  tests: ['aiml', 'tests'] as const,
  test: (id: string) => ['aiml', 'tests', id] as const,
  questions: ['aiml', 'questions'] as const,
  question: (id: string) => ['aiml', 'questions', id] as const,
};

export const useAIMLTests = () => {
  return useQuery({
    queryKey: QUERY_KEYS.tests,
    queryFn: async () => {
      try {
        const response = await aimlService.listTests();
        // Backend returns a direct array of tests (not wrapped in ApiResponse)
        // Handle both direct array and wrapped { data: [...] } formats safely
        if (Array.isArray(response)) {
          return response;
        }
        if (response?.data && Array.isArray(response.data)) {
          return response.data;
        }
        if (response?.data) {
          return Array.isArray(response.data) ? response.data : [];
        }
        return [];
      } catch (error: any) {
        console.warn('Failed to fetch AIML tests:', error?.message || error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  });
};

export const useAIMLTest = (testId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.test(testId || ''),
    queryFn: async () => {
      if (!testId) throw new Error('Test ID is required');
      const response = await aimlService.getTest(testId);
      // Ensure we always return a value (not undefined)
      // Handle both wrapped and unwrapped responses
      if (response && typeof response === 'object') {
        // If response has a 'data' property, use it
        if ('data' in response && response.data !== undefined) {
          return response.data;
        }
        // Otherwise, response itself might be the data
        return response;
      }
      // Fallback to null if response is invalid
      return null;
    },
    enabled: !!testId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useAIMLQuestions = () => {
  return useQuery({
    queryKey: QUERY_KEYS.questions,
    queryFn: async () => {
      try {
        const response = await aimlService.listQuestions();
        // Backend returns direct array, not wrapped in ApiResponse
        // Check if response is already an array (direct response)
        if (Array.isArray(response)) {
          return response;
        }
        // If response is wrapped in ApiResponse, extract data
        if (response.data && Array.isArray(response.data)) {
          return response.data;
        }
        // Fallback: if response.data exists but is not an array, or if it's an object with data property
        if (response.data) {
          return Array.isArray(response.data) ? response.data : [];
        }
        return [];
      } catch (error: any) {
        console.warn('Failed to fetch AIML questions:', error?.message || error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  });
};

export const useAIMLQuestion = (questionId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.question(questionId || ''),
    queryFn: async () => {
      if (!questionId) throw new Error('Question ID is required');
      try {
        const response = await aimlService.getQuestion(questionId);
        // Backend returns direct object, not wrapped in ApiResponse
        // Check if response is already an object (direct response)
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          // Check if it has a 'data' property (wrapped response)
          if ('data' in response && response.data !== undefined) {
            return response.data;
          }
          // Otherwise, response is already the question object
          return response;
        }
        // If response.data exists, use it
        if (response?.data) {
          return response.data;
        }
        // Fallback: return null if nothing matches (shouldn't happen)
        return null;
      } catch (error: any) {
        console.warn('Failed to fetch AIML question:', error?.message || error);
        throw error; // Re-throw to let React Query handle the error state
      }
    },
    enabled: !!questionId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateAIMLTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAIMLTestDto) => aimlService.createTest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useUpdateAIMLTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: Partial<CreateAIMLTestDto> }) =>
      aimlService.updateTest(testId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(variables.testId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useDeleteAIMLTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => aimlService.deleteTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useExecuteAIMLNotebook = () => {
  return useMutation({
    mutationFn: (data: ExecuteNotebookDto) => aimlService.executeNotebook(data),
  });
};

/**
 * Pause AIML test mutation
 */
export const usePauseAIMLTest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (testId: string) => aimlService.pauseTest(testId),
    onSuccess: (_, testId) => {
      // Invalidate specific test and list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(testId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

/**
 * Resume AIML test mutation
 */
export const useResumeAIMLTest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (testId: string) => aimlService.resumeTest(testId),
    onSuccess: (_, testId) => {
      // Invalidate specific test and list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(testId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

/**
 * Clone AIML test mutation
 */
export const useCloneAIMLTest = () => {
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
    }) => aimlService.cloneTest(testId, { newTitle, keepSchedule, keepCandidates }),
    onSuccess: () => {
      // Invalidate tests list to show the new cloned test
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

/**
 * Publish/unpublish AIML test mutation
 */
export const usePublishAIMLTest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ testId, isPublished }: { testId: string; isPublished: boolean }) =>
      aimlService.publishTest(testId, isPublished),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(variables.testId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

/**
 * Add candidate to AIML test mutation
 */
export const useAddAIMLCandidate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: { name: string; email: string } }) =>
      aimlService.addCandidate(testId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] });
    },
  });
};

/**
 * Bulk add candidates to AIML test mutation
 */
export const useBulkAddAIMLCandidates = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ testId, formData }: { testId: string; formData: FormData }) =>
      aimlService.bulkAddCandidates(testId, formData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] });
    },
  });
};

/**
 * Get candidates for an AIML test
 */
export const useAIMLCandidates = (testId: string | undefined) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.test(testId || ''), 'candidates'] as const,
    queryFn: async () => {
      console.log('[useAIMLCandidates] 🔍 Fetching candidates for testId:', testId)
      if (!testId) {
        console.error('[useAIMLCandidates] ❌ Test ID is required')
        throw new Error('Test ID is required');
      }
      try {
        const response = await aimlService.getCandidates(testId);
        console.log('[useAIMLCandidates] 📥 Service response:', {
          response,
          hasData: !!response?.data,
          dataType: typeof response?.data,
          isArray: Array.isArray(response?.data),
          dataLength: Array.isArray(response?.data) ? response.data.length : 'N/A',
          fullResponse: response
        })
        
        // Handle both wrapped and unwrapped responses
        let candidates = null
        if (response && typeof response === 'object') {
          if ('data' in response && response.data !== undefined) {
            candidates = response.data
          } else {
            candidates = response
          }
        }
        
        const result = Array.isArray(candidates) ? candidates : (candidates ? [candidates] : [])
        console.log('[useAIMLCandidates] ✅ Returning candidates:', {
          count: result.length,
          result
        })
        return result
      } catch (error: any) {
        console.error('[useAIMLCandidates] ❌ Error fetching candidates:', {
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        })
        throw error
      }
    },
    enabled: !!testId,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Remove candidate from AIML test mutation
 */
export const useRemoveAIMLCandidate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ testId, userId }: { testId: string; userId: string }) =>
      aimlService.removeCandidate(testId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] });
    },
  });
};

/**
 * Send invitation to AIML candidate mutation
 */
export const useSendAIMLInvitation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ testId, email }: { testId: string; email: string }) =>
      aimlService.sendInvitation(testId, email),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] });
    },
  });
};

/**
 * Send invitations to all AIML candidates mutation
 */
export const useSendAIMLInvitationsToAll = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (testId: string) => aimlService.sendInvitationsToAll(testId),
    onSuccess: (_, testId) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(testId), 'candidates'] });
    },
  });
};

/**
 * Get candidate analytics for an AIML test
 */
export const useAIMLCandidateAnalytics = (testId: string | undefined, userId: string | undefined) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.test(testId || ''), 'analytics', userId] as const,
    queryFn: async () => {
      if (!testId || !userId) throw new Error('Test ID and User ID are required');
      const response = await aimlService.getCandidateAnalytics(testId, userId);
      // Ensure we always return a value (not undefined)
      // Handle both wrapped and unwrapped responses
      if (response && typeof response === 'object') {
        // If response has a 'data' property, use it
        if ('data' in response && response.data !== undefined) {
          return response.data;
        }
        // Otherwise, response itself might be the data
        return response;
      }
      // Fallback to null if response is invalid
      return null;
    },
    enabled: !!testId && !!userId,
    staleTime: 10 * 1000, // 10 seconds
  });
};

/**
 * Send feedback to AIML candidate mutation
 */
export const useSendAIMLFeedback = () => {
  return useMutation({
    mutationFn: ({ testId, userId }: { testId: string; userId: string }) =>
      aimlService.sendFeedback(testId, userId),
  });
};

/**
 * Publish/unpublish AIML question mutation
 */
export const usePublishAIMLQuestion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ questionId, isPublished }: { questionId: string; isPublished: boolean }) =>
      aimlService.publishQuestion(questionId, isPublished),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.question(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions });
    },
  });
};

/**
 * Create AIML question mutation
 */
export const useCreateAIMLQuestion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateAIMLQuestionDto) => aimlService.createQuestion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions });
    },
  });
};

/**
 * Update AIML question mutation
 */
export const useUpdateAIMLQuestion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ questionId, data }: { questionId: string; data: Partial<CreateAIMLQuestionDto> }) =>
      aimlService.updateQuestion(questionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.question(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions });
    },
  });
};

/**
 * Delete AIML question mutation
 */
export const useDeleteAIMLQuestion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (questionId: string) => aimlService.deleteQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions });
    },
  });
};

/**
 * Get AIML test for candidate (candidate-facing)
 */
export const useAIMLTestForCandidate = (testId: string | undefined, userId: string | undefined, token?: string) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.test(testId || ''), 'candidate', userId] as const,
    queryFn: async () => {
      if (!testId || !userId) throw new Error('Test ID and User ID are required');
      const response = await aimlService.getTestForCandidate(testId, userId, token);
      return response.data;
    },
    enabled: !!testId && !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Submit answer for AIML test mutation
 */
export const useSubmitAIMLAnswer = () => {
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: { user_id: string; question_id: string; code: string; outputs?: string[] } }) =>
      aimlService.submitAnswer(testId, data),
  });
};

/**
 * Submit AIML test mutation
 */
export const useSubmitAIMLTest = () => {
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: { user_id: string; question_submissions: any[]; activity_logs?: any[] } }) =>
      aimlService.submitTest(testId, data),
  });
};



