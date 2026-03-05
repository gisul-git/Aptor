import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataEngineeringService, type DataEngineeringTest, type CreateDataEngineeringTestDto } from '@/services/data-engineering';

const QUERY_KEYS = {
  tests: ['data-engineering', 'tests'] as const,
  test: (id: string) => ['data-engineering', 'tests', id] as const,
  questions: ['data-engineering', 'questions'] as const,
  question: (id: string) => ['data-engineering', 'questions', id] as const,
};

export const useDataEngineeringTests = () => {
  return useQuery({
    queryKey: QUERY_KEYS.tests,
    queryFn: async () => {
      try {
        const response = await dataEngineeringService.listTests();
        return response.data || [];
      } catch (error: any) {
        console.warn('Failed to fetch Data Engineering tests:', error?.message || error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  });
};

export const useDataEngineeringTest = (testId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.test(testId || ''),
    queryFn: async () => {
      if (!testId) throw new Error('Test ID is required');
      const response = await dataEngineeringService.getTest(testId);
      return response.data;
    },
    enabled: !!testId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateDataEngineeringTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDataEngineeringTestDto) => dataEngineeringService.createTest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useUpdateDataEngineeringTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: Partial<CreateDataEngineeringTestDto> }) =>
      dataEngineeringService.updateTest(testId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(variables.testId) });
    },
  });
};

export const useDeleteDataEngineeringTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => dataEngineeringService.deleteTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const usePauseDataEngineeringTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => dataEngineeringService.pauseTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useResumeDataEngineeringTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => dataEngineeringService.resumeTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useCloneDataEngineeringTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, ...data }: { testId: string; newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }) =>
      dataEngineeringService.cloneTest(testId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};


/**
 * List all Data Engineering questions
 */
export const useDataEngineeringQuestions = () => {
  return useQuery({
    queryKey: QUERY_KEYS.questions,
    queryFn: async () => {
      try {
        const response = await dataEngineeringService.listQuestions();
        return response.data || [];
      } catch (error: any) {
        console.warn('Failed to fetch Data Engineering questions:', error?.message || error);
        return [];
      }
    },
    staleTime: 30 * 1000,
    retry: 1,
    retryOnMount: false,
  });
};

/**
 * Get Data Engineering question by ID
 */
export const useDataEngineeringQuestion = (questionId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.question(questionId || ''),
    queryFn: async () => {
      if (!questionId) throw new Error('Question ID is required');
      const response = await dataEngineeringService.getQuestion(questionId);
      return response.data;
    },
    enabled: !!questionId,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Create Data Engineering question mutation
 */
export const useCreateDataEngineeringQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => dataEngineeringService.createQuestion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions });
    },
  });
};

/**
 * Update Data Engineering question mutation
 */
export const useUpdateDataEngineeringQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, data }: { questionId: string; data: any }) =>
      dataEngineeringService.updateQuestion(questionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.question(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions });
    },
  });
};

/**
 * Delete Data Engineering question mutation
 */
export const useDeleteDataEngineeringQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => dataEngineeringService.deleteQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions });
      queryClient.removeQueries({ queryKey: QUERY_KEYS.questions });
    },
  });
};

/**
 * Publish/unpublish Data Engineering question mutation
 */
export const usePublishDataEngineeringQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, isPublished }: { questionId: string; isPublished: boolean }) =>
      dataEngineeringService.publishQuestion(questionId, isPublished),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.question(variables.questionId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions });
      queryClient.removeQueries({ queryKey: QUERY_KEYS.questions });
    },
  });
};
