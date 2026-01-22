import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customMCQService, type CreateCustomMCQAssessmentDto, type SubmitAssessmentDto, type SendInvitationsDto } from '@/services/custom-mcq';
import type { CustomMCQAssessment } from '@/types/custom-mcq';

const QUERY_KEYS = {
  assessments: ['custom-mcq', 'assessments'] as const,
  assessment: (id: string) => ['custom-mcq', 'assessments', id] as const,
};

export const useCustomMCQAssessments = () => {
  return useQuery({
    queryKey: QUERY_KEYS.assessments,
    queryFn: async () => {
      try {
        const response = await customMCQService.listAssessments();
        return response.data || [];
      } catch (error: any) {
        console.warn('Failed to fetch custom MCQ assessments:', error?.message || error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  });
};

export const useCustomMCQAssessment = (assessmentId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.assessment(assessmentId || ''),
    queryFn: async () => {
      if (!assessmentId) throw new Error('Assessment ID is required');
      const response = await customMCQService.getAssessment(assessmentId);
      return response.data;
    },
    enabled: !!assessmentId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateCustomMCQAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomMCQAssessmentDto & { status?: string; currentStation?: number }) =>
      customMCQService.createAssessment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

export const useUpdateCustomMCQAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, updates }: { assessmentId: string; updates: Partial<CustomMCQAssessment> & { status?: string; currentStation?: number } }) =>
      customMCQService.updateAssessment(assessmentId, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

export const useDeleteCustomMCQAssessment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assessmentId: string) => customMCQService.deleteAssessment(assessmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

export const useSubmitCustomMCQAssessment = () => {
  return useMutation({
    mutationFn: (data: SubmitAssessmentDto) => customMCQService.submitAssessment(data),
  });
};

export const useSendCustomMCQInvitations = () => {
  return useMutation({
    mutationFn: (data: SendInvitationsDto) => customMCQService.sendInvitations(data),
  });
};

export const useUploadCustomMCQCSV = () => {
  return useMutation({
    mutationFn: ({ file, questionType }: { file: File; questionType?: 'mcq' | 'subjective' }) =>
      customMCQService.uploadCSV(file, questionType),
  });
};

/**
 * Pause custom MCQ assessment mutation
 */
export const usePauseCustomMCQ = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assessmentId: string) => customMCQService.pauseAssessment(assessmentId),
    onSuccess: (_, assessmentId) => {
      // Invalidate specific assessment and list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

/**
 * Resume custom MCQ assessment mutation
 */
export const useResumeCustomMCQ = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assessmentId: string) => customMCQService.resumeAssessment(assessmentId),
    onSuccess: (_, assessmentId) => {
      // Invalidate specific assessment and list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

/**
 * Clone custom MCQ assessment mutation
 */
export const useCloneCustomMCQ = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      assessmentId, 
      newTitle, 
      keepSchedule = false, 
      keepCandidates = false 
    }: { 
      assessmentId: string; 
      newTitle: string; 
      keepSchedule?: boolean; 
      keepCandidates?: boolean;
    }) => customMCQService.cloneAssessment(assessmentId, { newTitle, keepSchedule, keepCandidates }),
    onSuccess: () => {
      // Invalidate assessments list to show the new cloned assessment
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

/**
 * Get assessment for taking (candidate-facing, uses token)
 */
export const useCustomMCQAssessmentForTaking = (
  assessmentId: string | undefined,
  token: string | undefined,
  email?: string,
  name?: string
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.assessment(assessmentId || ''), 'take', token, email] as const,
    queryFn: async () => {
      if (!assessmentId || !token) {
        throw new Error('Assessment ID and token are required');
      }
      const response = await customMCQService.getAssessmentForTaking(assessmentId, token, email, name);
      return response.data;
    },
    enabled: !!assessmentId && !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Verify candidate mutation
 */
export const useVerifyCustomMCQCandidate = () => {
  return useMutation({
    mutationFn: (data: {
      assessmentId: string;
      token: string;
      email: string;
      name: string;
    }) => customMCQService.verifyCandidate(data.assessmentId, data.token, data.email, data.name),
  });
};

/**
 * Save answer log mutation
 */
export const useSaveCustomMCQAnswerLog = () => {
  return useMutation({
    mutationFn: (data: {
      assessmentId: string;
      token: string;
      email: string;
      name: string;
      questionId: string;
      answer: string;
    }) => customMCQService.saveAnswerLog(
      data.assessmentId,
      data.token,
      data.email,
      data.name,
      data.questionId,
      data.answer
    ),
  });
};



