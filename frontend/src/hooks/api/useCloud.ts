import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cloudService, type CreateCloudTestDto } from '@/services/cloud';

const QUERY_KEYS = {
  tests: ['cloud', 'tests'] as const,
  test: (id: string) => ['cloud', 'tests', id] as const,
};

export const useCloudTests = () => {
  return useQuery({
    queryKey: QUERY_KEYS.tests,
    queryFn: async () => {
      try {
        const response = await cloudService.listTests();
        return response.data || [];
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('Failed to fetch Cloud tests:', message);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  });
};

export const useCloudTest = (testId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.test(testId || ''),
    queryFn: async () => {
      if (!testId) throw new Error('Test ID is required');
      const response = await cloudService.getTest(testId);
      return response.data;
    },
    // "sample" and "ai-generated" are local demo/generated modes; avoid backend call
    enabled: !!testId && testId !== 'sample' && testId !== 'ai-generated',
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateCloudTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCloudTestDto) => cloudService.createTest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useUpdateCloudTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: Partial<CreateCloudTestDto> }) =>
      cloudService.updateTest(testId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(variables.testId) });
    },
  });
};

export const useDeleteCloudTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => cloudService.deleteTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const usePauseCloudTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => cloudService.pauseTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useResumeCloudTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => cloudService.resumeTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useCloneCloudTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, ...data }: { testId: string; newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }) =>
      cloudService.cloneTest(testId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export interface CloudQuestionAnalytics {
  question_id: string;
  question_title?: string;
  status?: string;
  score?: number;
  ai_feedback?: any;
  [key: string]: any;
}

export interface CloudCandidateAnalytics {
  candidate?: {
    name?: string;
    email?: string;
    [key: string]: any;
  };
  submission?: {
    score?: number;
    started_at?: string;
    submitted_at?: string;
    [key: string]: any;
  };
  question_analytics?: CloudQuestionAnalytics[];
  [key: string]: any;
}

export const useCloudCandidates = (testId: string | undefined) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.test(testId || ''), 'candidates'] as const,
    queryFn: async () => {
      if (!testId) throw new Error('Test ID is required');
      const candidates = await cloudService.getCandidates(testId);
      return Array.isArray(candidates) ? candidates : [];
    },
    enabled: !!testId,
    staleTime: 30 * 1000,
    retry: 1,
  });
};

export const useAddCloudCandidate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: { name: string; email: string } }) =>
      cloudService.addCandidate(testId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] as const });
    },
  });
};

export const useBulkAddCloudCandidates = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, formData }: { testId: string; formData: FormData }) =>
      cloudService.bulkAddCandidates(testId, formData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] as const });
    },
  });
};

export const useRemoveCloudCandidate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, userId }: { testId: string; userId: string }) =>
      cloudService.removeCandidate(testId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] as const });
    },
  });
};

export const useSendCloudInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, email }: { testId: string; email: string }) =>
      cloudService.sendInvitation(testId, email),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(variables.testId), 'candidates'] as const });
    },
  });
};

export const useSendCloudInvitationsToAll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => cloudService.sendInvitationsToAll(testId),
    onSuccess: (_, testId) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.test(testId), 'candidates'] as const });
    },
  });
};

export const useCloudCandidateAnalytics = (testId: string | undefined, userId: string | undefined) => {
  return useQuery<CloudCandidateAnalytics>({
    queryKey: [...QUERY_KEYS.test(testId || ''), 'analytics', userId] as const,
    queryFn: async (): Promise<CloudCandidateAnalytics> => {
      if (!testId || !userId) throw new Error('Test ID and User ID are required');
      const response = await cloudService.getCandidateAnalytics(testId, userId);
      const data = (response as any)?.data !== undefined ? (response as any).data : response;
      if (!data) throw new Error('Analytics data is unavailable');
      return data as CloudCandidateAnalytics;
    },
    enabled: !!testId && !!userId,
    staleTime: 10 * 1000,
    retry: 1,
  });
};

export const useSendCloudFeedback = () => {
  return useMutation({
    mutationFn: ({ testId, userId }: { testId: string; userId: string }) =>
      cloudService.sendFeedback(testId, userId),
  });
};




