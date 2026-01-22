import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { designService, type DesignTest, type CreateDesignTestDto } from '@/services/design';

const QUERY_KEYS = {
  tests: ['design', 'tests'] as const,
  test: (id: string) => ['design', 'tests', id] as const,
};

export const useDesignTests = () => {
  return useQuery({
    queryKey: QUERY_KEYS.tests,
    queryFn: async () => {
      try {
        const response = await designService.listTests();
        return response.data || [];
      } catch (error: any) {
        console.warn('Failed to fetch Design tests:', error?.message || error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  });
};

export const useDesignTest = (testId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.test(testId || ''),
    queryFn: async () => {
      if (!testId) throw new Error('Test ID is required');
      const response = await designService.getTest(testId);
      return response.data;
    },
    enabled: !!testId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateDesignTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDesignTestDto) => designService.createTest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useUpdateDesignTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: Partial<CreateDesignTestDto> }) =>
      designService.updateTest(testId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.test(variables.testId) });
    },
  });
};

export const useDeleteDesignTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => designService.deleteTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const usePauseDesignTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => designService.pauseTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useResumeDesignTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => designService.resumeTest(testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

export const useCloneDesignTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, ...data }: { testId: string; newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }) =>
      designService.cloneTest(testId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tests });
    },
  });
};

