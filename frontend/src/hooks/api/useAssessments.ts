import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assessmentService, type Assessment, type CreateAssessmentDto, type UpdateAssessmentDto } from '@/services/assessment';

/**
 * React Query hooks for Assessments
 * 
 * Provides caching, refetching, and loading states automatically
 */

const QUERY_KEYS = {
  assessments: ['assessments'] as const,
  assessment: (id: string) => ['assessments', id] as const,
  questions: (id: string) => ['assessments', id, 'questions'] as const,
};

/**
 * Get all assessments
 */
export const useAssessments = () => {
  return useQuery({
    queryKey: QUERY_KEYS.assessments,
    queryFn: async () => {
      try {
        const response = await assessmentService.list();
        console.log('[useAssessments] Service response:', {
          hasResponse: !!response,
          responseKeys: response ? Object.keys(response) : [],
          hasData: !!response?.data,
          dataType: typeof response?.data,
          isArray: Array.isArray(response?.data),
          dataLength: Array.isArray(response?.data) ? response.data.length : 'not-array',
          fullResponse: JSON.stringify(response, null, 2),
        });
        
        // Service now returns: {success: true, message: "...", data: [...]}
        // Extract the data array
        if (response && typeof response === 'object') {
          // If response has a 'data' property and it's an array, return it
          if ('data' in response && Array.isArray(response.data)) {
            console.log('[useAssessments] ✅ Extracted data array:', response.data.length, 'items');
            return response.data;
          }
          // If response itself is an array (direct format)
          if (Array.isArray(response)) {
            console.log('[useAssessments] ✅ Response is already an array:', response.length, 'items');
            return response;
          }
          // If response.data exists but is not an array, log warning
          if ('data' in response && response.data !== undefined) {
            console.warn('[useAssessments] ⚠️ Response.data exists but is not an array:', typeof response.data, response.data);
          }
        }
        
        console.warn('[useAssessments] ⚠️ No valid data found, returning empty array');
        return [];
      } catch (error: any) {
        // Log error but don't throw - return empty array so UI doesn't break
        console.error('[useAssessments] Failed to fetch assessments:', {
          error: error?.message || error,
          status: error?.response?.status,
          responseData: error?.response?.data,
        });
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2, // Retry twice on failure
    retryOnMount: true, // Retry when component mounts
  });
};

/**
 * Get assessment by ID
 */
export const useAssessment = (id: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.assessment(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Assessment ID is required');
      const response = await assessmentService.getById(id);
      return response.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Get assessment questions
 */
export const useAssessmentQuestions = (assessmentId: string | undefined) => {
  return useQuery({
    queryKey: QUERY_KEYS.questions(assessmentId || ''),
    queryFn: async () => {
      if (!assessmentId) throw new Error('Assessment ID is required');
      const response = await assessmentService.getQuestions(assessmentId);
      return response.data || [];
    },
    enabled: !!assessmentId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Create assessment mutation
 */
export const useCreateAssessment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateAssessmentDto) => assessmentService.create(data),
    onSuccess: () => {
      // Invalidate and refetch assessments list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

/**
 * Update assessment mutation
 */
export const useUpdateAssessment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAssessmentDto }) =>
      assessmentService.update(id, data),
    onSuccess: (_, variables) => {
      // Invalidate specific assessment and list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

/**
 * Delete assessment mutation
 */
export const useDeleteAssessment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => assessmentService.delete(id),
    onSuccess: () => {
      // Invalidate assessments list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

/**
 * Generate questions mutation
 */
export const useGenerateQuestions = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ assessmentId, config }: { assessmentId: string; config?: any }) =>
      assessmentService.generateQuestions(assessmentId, config),
    onSuccess: (_, variables) => {
      // Invalidate questions for this assessment
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.questions(variables.assessmentId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.assessment(variables.assessmentId) 
      });
    },
  });
};

/**
 * Pause assessment mutation
 */
export const usePauseAssessment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assessmentId: string) => assessmentService.pause(assessmentId),
    onSuccess: (_, assessmentId) => {
      // Invalidate specific assessment and list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

/**
 * Resume assessment mutation
 */
export const useResumeAssessment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assessmentId: string) => assessmentService.resume(assessmentId),
    onSuccess: (_, assessmentId) => {
      // Invalidate specific assessment and list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

/**
 * Clone assessment mutation
 */
export const useCloneAssessment = () => {
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
    }) => assessmentService.clone(assessmentId, { newTitle, keepSchedule, keepCandidates }),
    onSuccess: () => {
      // Invalidate assessments list to show the new cloned assessment
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

// ============================================
// Assessment Creation & Draft Hooks
// ============================================

/**
 * Get current draft query
 */
export const useCurrentDraft = () => {
  return useQuery({
    queryKey: ['assessments', 'current-draft'],
    queryFn: async () => {
      const response = await assessmentService.getCurrentDraft();
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Update assessment draft mutation
 */
export const useUpdateDraft = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => assessmentService.updateDraft(data),
    onSuccess: (_, variables) => {
      // Invalidate assessment if assessmentId is provided
      if (variables.assessmentId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      }
      // Also invalidate current draft
      queryClient.invalidateQueries({ queryKey: ['assessments', 'current-draft'] });
    },
  });
};

/**
 * Generate topic cards mutation
 */
export const useGenerateTopicCards = () => {
  return useMutation({
    mutationFn: (data: {
      jobDesignation: string;
      experienceMin?: number;
      experienceMax?: number;
      experienceMode?: string;
      assessmentTitle?: string;
    }) => assessmentService.generateTopicCards(data),
  });
};

/**
 * Fetch and summarize URL mutation
 */
export const useFetchAndSummarizeUrl = () => {
  return useMutation({
    mutationFn: (data: { url: string }) => assessmentService.fetchAndSummarizeUrl(data),
  });
};

/**
 * Generate topics v2 mutation
 */
export const useGenerateTopicsV2 = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => assessmentService.generateTopicsV2(data),
    onSuccess: (_, variables) => {
      if (variables.assessmentId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      }
    },
  });
};

/**
 * Generate topics from requirements mutation
 */
export const useGenerateTopicsFromRequirements = () => {
  return useMutation({
    mutationFn: (data: any) => assessmentService.generateTopicsFromRequirements(data),
  });
};

/**
 * Generate topics (legacy) mutation
 */
export const useGenerateTopics = () => {
  return useMutation({
    mutationFn: (data: any) => assessmentService.generateTopics(data),
  });
};

/**
 * Create assessment from job designation mutation
 */
export const useCreateFromJobDesignation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: any) => assessmentService.createFromJobDesignation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

/**
 * Improve topic mutation
 */
export const useImproveTopic = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; topicId: string; [key: string]: any }) =>
      assessmentService.improveTopic(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
    },
  });
};

/**
 * Generate question mutation
 */
export const useGenerateQuestion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; topicId: string; [key: string]: any }) =>
      assessmentService.generateQuestion(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions(variables.assessmentId) });
    },
  });
};

/**
 * Improve all topics mutation
 */
export const useImproveAllTopics = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; [key: string]: any }) =>
      assessmentService.improveAllTopics(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
    },
  });
};

/**
 * Generate topic context mutation
 */
export const useGenerateTopicContext = () => {
  return useMutation({
    mutationFn: (data: { topicName: string; category: string; [key: string]: any }) =>
      assessmentService.generateTopicContext(data),
  });
};

/**
 * Validate topic category mutation
 */
export const useValidateTopicCategory = () => {
  return useMutation({
    mutationFn: (data: { topic: string; category: string; [key: string]: any }) =>
      assessmentService.validateTopicCategory(data),
  });
};

/**
 * Check technical topic mutation
 */
export const useCheckTechnicalTopic = () => {
  return useMutation({
    mutationFn: (data: { topic: string }) => assessmentService.checkTechnicalTopic(data),
  });
};

/**
 * Suggest topics mutation
 */
export const useSuggestTopics = () => {
  return useMutation({
    mutationFn: (data: { category: string; query?: string; [key: string]: any }) =>
      assessmentService.suggestTopics(data),
  });
};

/**
 * Add custom topic mutation
 */
export const useAddCustomTopic = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { category: string; topicName: string; [key: string]: any }) =>
      assessmentService.addCustomTopic(data),
    onSuccess: (_, variables) => {
      // Invalidate if assessmentId is provided
      if ((variables as any).assessmentId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment((variables as any).assessmentId) });
      }
    },
  });
};

/**
 * Classify technical topic mutation
 */
export const useClassifyTechnicalTopic = () => {
  return useMutation({
    mutationFn: (data: { topic: string }) => assessmentService.classifyTechnicalTopic(data),
  });
};

/**
 * Detect topic category mutation
 */
export const useDetectTopicCategory = () => {
  return useMutation({
    mutationFn: (data: { topicName: string }) => assessmentService.detectTopicCategory(data),
  });
};

/**
 * Suggest topic contexts mutation
 */
export const useSuggestTopicContexts = () => {
  return useMutation({
    mutationFn: (data: { partialInput: string; category: string; [key: string]: any }) =>
      assessmentService.suggestTopicContexts(data),
  });
};

/**
 * Add question row mutation
 */
export const useAddQuestionRow = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; topicId: string; [key: string]: any }) =>
      assessmentService.addQuestionRow(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
    },
  });
};

/**
 * Regenerate question mutation
 */
export const useRegenerateQuestion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; topicId: string; rowId: string; [key: string]: any }) =>
      assessmentService.regenerateQuestion(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions(variables.assessmentId) });
    },
  });
};

/**
 * Regenerate topic mutation
 */
export const useRegenerateTopic = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { topic: string; assessmentId?: string; topicId?: string; [key: string]: any }) =>
      assessmentService.regenerateTopic(data),
    onSuccess: (_, variables) => {
      if (variables.assessmentId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      }
    },
  });
};

/**
 * Remove topic mutation
 */
export const useRemoveTopic = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; topicId: string }) =>
      assessmentService.removeTopic(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
    },
  });
};

/**
 * Finalize assessment mutation
 */
export const useFinalizeAssessment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; [key: string]: any }) =>
      assessmentService.finalize(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessments });
    },
  });
};

/**
 * Update questions mutation
 */
export const useUpdateQuestions = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; questions: any[]; [key: string]: any }) =>
      assessmentService.updateQuestions(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions(variables.assessmentId) });
    },
  });
};

/**
 * Update schedule and candidates mutation
 */
export const useUpdateScheduleAndCandidates = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; [key: string]: any }) =>
      assessmentService.updateScheduleAndCandidates(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
    },
  });
};

/**
 * Update single question mutation
 */
export const useUpdateSingleQuestion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; questionId: string; [key: string]: any }) =>
      assessmentService.updateSingleQuestion(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions(variables.assessmentId) });
    },
  });
};

/**
 * Generate questions from config mutation
 */
export const useGenerateQuestionsFromConfig = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; topics: any[]; [key: string]: any }) =>
      assessmentService.generateQuestionsFromConfig(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions(variables.assessmentId) });
    },
  });
};

/**
 * Generate all questions mutation
 */
export const useGenerateAllQuestions = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; topics: any[] }) =>
      assessmentService.generateAllQuestions(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions(variables.assessmentId) });
    },
  });
};

/**
 * AI topic suggestion mutation
 */
export const useAITopicSuggestion = () => {
  return useMutation({
    mutationFn: (data: { category: string; input: string }) =>
      assessmentService.aiTopicSuggestion(data),
  });
};

/**
 * Remove question row mutation
 */
export const useRemoveQuestionRow = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; topicId: string; rowId?: string; [key: string]: any }) =>
      assessmentService.removeQuestionRow(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions(variables.assessmentId) });
    },
  });
};

/**
 * Update question type mutation
 */
export const useUpdateQuestionType = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; topicId: string; rowId?: string; questionType: string; difficulty?: string; [key: string]: any }) =>
      assessmentService.updateQuestionType(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions(variables.assessmentId) });
    },
  });
};

/**
 * Delete topic questions mutation
 */
export const useDeleteTopicQuestions = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { assessmentId: string; topic?: string }) =>
      assessmentService.deleteTopicQuestions(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.questions(variables.assessmentId) });
    },
  });
};

/**
 * Send invitations mutation
 */
export const useSendInvitations = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: {
      assessmentId: string;
      candidates: Array<{ email: string; name: string }>;
      examUrl?: string;
      template?: any;
      [key: string]: any;
    }) => assessmentService.sendInvitations(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assessment(variables.assessmentId) });
    },
  });
};

/**
 * Get candidate results query
 */
export const useCandidateResults = (assessmentId: string | undefined) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.assessment(assessmentId || ''), 'candidate-results'] as const,
    queryFn: async () => {
      if (!assessmentId) throw new Error('Assessment ID is required');
      const response = await assessmentService.getCandidateResults(assessmentId);
      return response.data || [];
    },
    enabled: !!assessmentId,
    staleTime: 30 * 1000, // 30 seconds - results change frequently
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds for live updates
  });
};

/**
 * Get answer logs query
 */
export const useAnswerLogs = (
  assessmentId: string | undefined,
  candidateEmail: string | undefined,
  candidateName: string | undefined
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.assessment(assessmentId || ''), 'answer-logs', candidateEmail] as const,
    queryFn: async () => {
      if (!assessmentId || !candidateEmail || !candidateName) {
        throw new Error('Assessment ID, candidate email, and name are required');
      }
      const response = await assessmentService.getAnswerLogs({
        assessmentId,
        candidateEmail,
        candidateName,
      });
      return response.data || [];
    },
    enabled: !!assessmentId && !!candidateEmail && !!candidateName,
    staleTime: 10 * 1000, // 10 seconds
  });
};

/**
 * Get detailed candidate results query
 */
export const useDetailedCandidateResults = (
  assessmentId: string | undefined,
  candidateEmail: string | undefined,
  candidateName: string | undefined
) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.assessment(assessmentId || ''), 'detailed-results', candidateEmail] as const,
    queryFn: async () => {
      if (!assessmentId || !candidateEmail || !candidateName) {
        throw new Error('Assessment ID, candidate email, and name are required');
      }
      const response = await assessmentService.getDetailedCandidateResults({
        assessmentId,
        candidateEmail,
        candidateName,
      });
      return response.data;
    },
    enabled: !!assessmentId && !!candidateEmail && !!candidateName,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Get assessment full data (candidate-facing, uses token)
 */
export const useAssessmentFull = (assessmentId: string | undefined, token: string | undefined) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.assessment(assessmentId || ''), 'full', token] as const,
    queryFn: async () => {
      console.log("[useAssessmentFull] 🔵 queryFn called:", {
        assessmentId,
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'no token',
        timestamp: new Date().toISOString(),
      });
      
      if (!assessmentId || !token) {
        console.error("[useAssessmentFull] ❌ Missing assessmentId or token:", { assessmentId, hasToken: !!token });
        throw new Error('Assessment ID and token are required');
      }
      
      console.log("[useAssessmentFull] 🔵 Calling assessmentService.getAssessmentFull");
      const response = await assessmentService.getAssessmentFull(assessmentId, token);
      
      console.log("[useAssessmentFull] ✅ getAssessmentFull response received:", {
        hasResponse: !!response,
        hasData: !!response?.data,
        responseKeys: response ? Object.keys(response) : [],
        dataKeys: response?.data ? Object.keys(response.data) : [],
        responseType: typeof response,
        responseDataKeys: response?.data ? (typeof response.data === 'object' ? Object.keys(response.data) : 'not object') : 'no data',
        fullResponse: JSON.stringify(response, null, 2),
      });
      
      // Handle different response structures
      // Next.js API route returns: { success: true, message: "...", data: {...} }
      // We need to extract the actual assessment/test object from response.data.data
      if (response.data) {
        console.log("[useAssessmentFull] 🔍 Processing response.data:", {
          responseDataType: typeof response.data,
          responseDataKeys: Object.keys(response.data),
          hasNestedData: !!(response.data?.data),
          hasSchedule: !!(response.data?.schedule),
          hasProctoringSettings: !!(response.data?.proctoringSettings),
          hasScheduleProctoringSettings: !!(response.data?.schedule?.proctoringSettings),
          fullResponseData: JSON.stringify(response.data, null, 2),
        });
        
        // Check if response.data has a nested 'data' field (Next.js API route format)
        if (typeof response.data === 'object' && 'data' in response.data && response.data.data) {
          const assessmentData = response.data.data;
          console.log("[useAssessmentFull] ✅ Extracting nested data field from Next.js API response:", {
            assessmentDataType: typeof assessmentData,
            assessmentDataKeys: Object.keys(assessmentData),
            hasSchedule: !!(assessmentData?.schedule),
            scheduleKeys: assessmentData?.schedule ? Object.keys(assessmentData.schedule) : [],
            hasProctoringSettingsTop: !!(assessmentData?.proctoringSettings),
            proctoringSettingsTop: assessmentData?.proctoringSettings,
            hasProctoringSettingsSchedule: !!(assessmentData?.schedule?.proctoringSettings),
            proctoringSettingsSchedule: assessmentData?.schedule?.proctoringSettings,
            fullAssessmentData: JSON.stringify(assessmentData, null, 2),
          });
          return assessmentData; // Return the actual assessment/test object
        }
        // Check if response.data is the assessment object directly
        if (typeof response.data === 'object' && ('schedule' in response.data || 'proctoringSettings' in response.data || 'id' in response.data)) {
          console.log("[useAssessmentFull] ✅ Returning response.data (direct assessment object):", {
            hasSchedule: !!(response.data?.schedule),
            scheduleKeys: response.data?.schedule ? Object.keys(response.data.schedule) : [],
            hasProctoringSettingsTop: !!(response.data?.proctoringSettings),
            proctoringSettingsTop: response.data?.proctoringSettings,
            hasProctoringSettingsSchedule: !!(response.data?.schedule?.proctoringSettings),
            proctoringSettingsSchedule: response.data?.schedule?.proctoringSettings,
            fullResponseData: JSON.stringify(response.data, null, 2),
          });
          return response.data;
        }
        console.log("[useAssessmentFull] ⚠️ Returning response.data (fallback):", {
          responseData: JSON.stringify(response.data, null, 2),
        });
        return response.data;
      }
      // Fallback for legacy response format
      const responseAny = response as any;
      if (responseAny.assessment) {
        console.log("[useAssessmentFull] ✅ Returning responseAny.assessment (legacy format)");
        return responseAny.assessment;
      }
      console.log("[useAssessmentFull] ⚠️ Returning response as-is (no data or assessment key)");
      return response;
    },
    enabled: !!assessmentId && !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Save answer mutation
 */
export const useSaveAnswer = () => {
  return useMutation({
    mutationFn: (data: {
      attemptId: string;
      questionId: string;
      answer: any;
      section?: string;
      timeRemaining?: number;
    }) => assessmentService.saveAnswer(data),
  });
};

/**
 * Log analytics event mutation
 */
export const useLogAnalyticsEvent = () => {
  return useMutation({
    mutationFn: (data: {
      attemptId: string;
      eventType: string;
      [key: string]: any;
    }) => assessmentService.logAnalyticsEvent(data),
  });
};

/**
 * Submit answers mutation
 */
export const useSubmitAnswers = () => {
  return useMutation({
    mutationFn: (data: {
      assessmentId: string;
      token: string;
      answers?: any;
      [key: string]: any;
    }) => assessmentService.submitAnswers(data),
  });
};

/**
 * Run code mutation
 */
export const useRunCode = () => {
  return useMutation({
    mutationFn: (data: {
      assessmentId: string;
      questionId: string;
      sourceCode: string;
      languageId: string;
    }) => assessmentService.runCode(data),
  });
};

/**
 * Run SQL mutation
 */
export const useRunSQL = () => {
  return useMutation({
    mutationFn: (data: {
      assessmentId: string;
      questionId: string;
      sqlQuery: string;
    }) => assessmentService.runSQL(data),
  });
};

/**
 * Submit SQL mutation
 */
export const useSubmitSQL = () => {
  return useMutation({
    mutationFn: (data: {
      assessmentId: string;
      questionId: string;
      sqlQuery: string;
      attemptId: string;
    }) => assessmentService.submitSQL(data),
  });
};

/**
 * Start proctor session mutation
 */
export const useStartProctorSession = () => {
  return useMutation({
    mutationFn: (data: {
      assessmentId: string;
      userId: string;
      [key: string]: any;
    }) => assessmentService.startProctorSession(data),
  });
};



