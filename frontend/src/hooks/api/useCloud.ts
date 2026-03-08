import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cloudService, type CloudTest, type CreateCloudTestDto } from '@/services/cloud';

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
      } catch (error: any) {
        console.warn('Failed to fetch Cloud tests:', error?.message || error);
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

