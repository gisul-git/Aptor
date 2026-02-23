import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devopsService, type DevOpsTest, type CreateDevOpsTestDto } from '@/services/devops';

const QUERY_KEYS = {
  tests: ['devops', 'tests'] as const,
  test: (id: string) => ['devops', 'tests', id] as const,
};

export const useDevOpsTests = () => {
  return useQuery({
    queryKey: QUERY_KEYS.tests,
    queryFn: async () => {
      try {
        const response = await devopsService.listTests();
        return response.data || [];
      } catch (error: any) {
        console.warn('Failed to fetch DevOps tests:', error?.message || error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  });
};

export const useDevOpsTest = (testId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.test(testId || ''),
    queryFn: async () => {
      if (!testId) throw new Error('Test ID is required');
      const response = await devopsService.getTest(testId);
      return response.data;
    },
    enabled: !!testId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateDevOpsTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDevOpsTestDto) => devopsService.createTest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useUpdateDevOpsTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: Partial<CreateDevOpsTestDto> }) =>
      devopsService.updateTest(testId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(variables.testId) });
    },
  });
};

export const useDeleteDevOpsTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => devopsService.deleteTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const usePauseDevOpsTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => devopsService.pauseTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useResumeDevOpsTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => devopsService.resumeTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useCloneDevOpsTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, ...data }: { testId: string; newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }) =>
      devopsService.cloneTest(testId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

