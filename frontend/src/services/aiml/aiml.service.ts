import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

/**
 * AIML (AI/ML) Service
 * 
 * Handles all AIML-related API calls
 * Routes: /api/v1/aiml
 */

// Types
export interface InvitationTemplate {
  logoUrl?: string;
  companyName?: string;
  message: string;
  footer?: string;
  sentBy?: string;
}

export interface AIMLTest {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  questions: AIMLQuestion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  test_token?: string;
  schedule?: {
    startTime?: string;
    endTime?: string;
    duration?: number;
    candidateRequirements?: Record<string, any>;
  } | null;
  invitationTemplate?: InvitationTemplate;
}

export interface AIMLQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  notebookUrl?: string;
  datasetUrl?: string;
  expectedOutput?: string;
  points: number;
  kernelId?: string;
}

export interface AIMLSubmission {
  id: string;
  testId: string;
  questionId: string;
  userId: string;
  notebookContent?: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  submittedAt: string;
  feedback?: string;
}

export interface CreateAIMLTestDto {
  title: string;
  description?: string;
  duration?: number;
  questions?: Omit<AIMLQuestion, 'id'>[];
}

export interface CreateAIMLQuestionDto {
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  notebookUrl?: string;
  datasetUrl?: string;
  expectedOutput?: string;
  points: number;
}

export interface ExecuteNotebookDto {
  questionId: string;
  testId: string;
  code: string;
  kernelId?: string;
}

export interface GenerateAIQuestionResponse {
  id: string;
  assessment: {
    title: string;
    skill: string;
    topic?: string;
    difficulty: string;
    libraries: string[];
    selected_dataset_format: string;
  };
  question: {
    type: string;
    execution_environment: string;
    description: string;
    tasks: string[];
    constraints: string[];
  };
  dataset?: any;
  ai_generated: boolean;
  requires_dataset: boolean;
  created_at: string;
}

export const aimlService = {
  /**
   * List all AIML tests
   */
  listTests: async (): Promise<ApiResponse<AIMLTest[]>> => {
    const response = await apiClient.get<ApiResponse<AIMLTest[]>>('/api/v1/aiml/tests');
    return response.data;
  },

  /**
   * Get test by ID
   */
  getTest: async (testId: string): Promise<ApiResponse<AIMLTest>> => {
    const response = await apiClient.get<ApiResponse<AIMLTest>>(`/api/v1/aiml/tests/${testId}`);
    return response.data;
  },

  /**
   * Create new test
   */
  createTest: async (data: CreateAIMLTestDto): Promise<ApiResponse<AIMLTest>> => {
    const response = await apiClient.post<ApiResponse<AIMLTest>>('/api/v1/aiml/tests', data);
    return response.data;
  },

  /**
   * Update test
   */
  updateTest: async (testId: string, data: Partial<CreateAIMLTestDto>): Promise<ApiResponse<AIMLTest>> => {
    const response = await apiClient.put<ApiResponse<AIMLTest>>(`/api/v1/aiml/tests/${testId}`, data);
    return response.data;
  },

  /**
   * Delete test
   */
  deleteTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/aiml/tests/${testId}`);
    return response.data;
  },

  /**
   * List questions
   */
  listQuestions: async (): Promise<ApiResponse<AIMLQuestion[]>> => {
    const response = await apiClient.get<ApiResponse<AIMLQuestion[]>>('/api/v1/aiml/questions');
    return response.data;
  },

  /**
   * Get question by ID
   */
  getQuestion: async (questionId: string): Promise<ApiResponse<AIMLQuestion>> => {
    const response = await apiClient.get<ApiResponse<AIMLQuestion>>(`/api/v1/aiml/questions/${questionId}`);
    return response.data;
  },

  /**
   * Create question
   */
  createQuestion: async (data: CreateAIMLQuestionDto): Promise<ApiResponse<AIMLQuestion>> => {
    const response = await apiClient.post<ApiResponse<AIMLQuestion>>('/api/v1/aiml/questions', data);
    return response.data;
  },

  /**
   * Update question
   */
  updateQuestion: async (questionId: string, data: Partial<CreateAIMLQuestionDto>): Promise<ApiResponse<AIMLQuestion>> => {
    const response = await apiClient.put<ApiResponse<AIMLQuestion>>(`/api/v1/aiml/questions/${questionId}`, data);
    return response.data;
  },

  /**
   * Delete question
   */
  deleteQuestion: async (questionId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/aiml/questions/${questionId}`);
    return response.data;
  },

  /**
   * Execute notebook code
   */
  executeNotebook: async (data: ExecuteNotebookDto): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/aiml/execute', data);
    return response.data;
  },

  /**
   * Get submission by ID
   */
  getSubmission: async (submissionId: string): Promise<ApiResponse<AIMLSubmission>> => {
    const response = await apiClient.get<ApiResponse<AIMLSubmission>>(`/api/v1/aiml/submissions/${submissionId}`);
    return response.data;
  },

  /**
   * Pause test
   */
  pauseTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/aiml/tests/${testId}/pause`);
    return response.data;
  },

  /**
   * Resume test
   */
  resumeTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/aiml/tests/${testId}/resume`);
    return response.data;
  },

  /**
   * Clone test
   */
  cloneTest: async (
    testId: string,
    data: { newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }
  ): Promise<ApiResponse<AIMLTest>> => {
    const response = await apiClient.post<ApiResponse<AIMLTest>>(
      `/api/v1/aiml/tests/${testId}/clone`,
      data
    );
    return response.data;
  },

  /**
   * Publish/unpublish test
   */
  publishTest: async (testId: string, isPublished: boolean): Promise<ApiResponse<any>> => {
    // Do not send a null body; FastAPI expects only query params and may try to parse the body as JSON
    const response = await apiClient.patch<ApiResponse<any>>(`/api/v1/aiml/tests/${testId}/publish`, undefined, {
      params: { is_published: isPublished },
    });
    return response.data;
  },

  /**
   * Add candidate to test
   */
  addCandidate: async (testId: string, data: { name: string; email: string }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/aiml/tests/${testId}/add-candidate`, data);
    return response.data;
  },

  /**
   * Bulk add candidates
   */
  bulkAddCandidates: async (testId: string, formData: FormData): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/aiml/tests/${testId}/bulk-add-candidates`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Get candidates for a test
   */
  getCandidates: async (testId: string): Promise<ApiResponse<any[]>> => {
    console.log('[AIML Service] 🔍 getCandidates called:', { testId })
    try {
      const response = await apiClient.get<ApiResponse<any[]>>(`/api/v1/aiml/tests/${testId}/candidates`);
      console.log('[AIML Service] 📥 API Response:', {
        status: response.status,
        hasData: !!response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        responseData: response.data,
        fullResponse: response
      })
      return response.data;
    } catch (error: any) {
      console.error('[AIML Service] ❌ Error in getCandidates:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: `/api/v1/aiml/tests/${testId}/candidates`
      })
      throw error
    }
  },

  /**
   * Remove candidate from test
   */
  removeCandidate: async (testId: string, userId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/aiml/tests/${testId}/candidates/${userId}`);
    return response.data;
  },

  /**
   * Send invitation to candidate
   */
  sendInvitation: async (testId: string, email: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/aiml/tests/${testId}/send-invitation`, { email });
    return response.data;
  },

  /**
   * Send invitations to all candidates
   */
  sendInvitationsToAll: async (testId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/aiml/tests/${testId}/send-invitations-to-all`);
    return response.data;
  },

  /**
   * Get candidate analytics
   */
  getCandidateAnalytics: async (testId: string, userId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(`/api/v1/aiml/tests/${testId}/candidates/${userId}/analytics`);
    return response.data;
  },

  /**
   * Send feedback to candidate
   */
  sendFeedback: async (testId: string, userId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/aiml/tests/${testId}/candidates/${userId}/send-feedback`);
    return response.data;
  },

  /**
   * Publish/unpublish question
   */
  publishQuestion: async (questionId: string, isPublished: boolean): Promise<ApiResponse<any>> => {
    // Don't send null body - use undefined or empty object to avoid JSON parsing errors
    const response = await apiClient.patch<ApiResponse<any>>(`/api/v1/aiml/questions/${questionId}/publish`, undefined, {
      params: { is_published: isPublished },
    });
    return response.data;
  },

  /**
   * Get test for candidate (candidate-facing)
   */
  getTestForCandidate: async (testId: string, userId: string, token?: string): Promise<ApiResponse<any>> => {
    const params: any = { user_id: userId };
    if (token) params.token = token;
    const response = await apiClient.get<ApiResponse<any>>(`/api/v1/aiml/tests/${testId}/candidate`, {
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return response.data;
  },

  /**
   * Submit answer for AIML test
   */
  submitAnswer: async (testId: string, data: {
    user_id: string;
    question_id: string;
    code: string;
    outputs?: string[];
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/aiml/tests/${testId}/submit-answer`, data);
    return response.data;
  },

  /**
   * Submit AIML test
   * Backend expects 'answers' array with 'source_code' field
   */
  submitTest: async (testId: string, data: {
    user_id: string;
    answers?: Array<{
      question_id: string;
      source_code: string;
      outputs?: string[];
    }>;
    question_submissions?: Array<{
      question_id: string;
      code: string;
      outputs?: string[];
    }>;
    activity_logs?: any[];
    candidateRequirements?: any;
  }): Promise<ApiResponse<any>> => {
    // Convert question_submissions to answers format if needed (for backward compatibility)
    let requestData: any = { ...data };
    if (data.question_submissions && !data.answers) {
      requestData.answers = data.question_submissions.map(sub => ({
        question_id: sub.question_id,
        source_code: sub.code,  // Convert 'code' to 'source_code'
        outputs: sub.outputs || []
      }));
      delete requestData.question_submissions;
    }
    
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/aiml/tests/${testId}/submit`, requestData);
    return response.data;
  },

  /**
   * Suggest topics for AI question generation
   */
  suggestTopics: async (data: {
    skill: string;
    difficulty: string;
  }): Promise<ApiResponse<{ topics: string[] }>> => {
    console.log('🟡 [AIML Service] Calling suggestTopics:', {
      skill: data.skill,
      difficulty: data.difficulty,
      endpoint: '/api/v1/aiml/questions/suggest-topics',
      baseURL: (apiClient.defaults as any).baseURL || 'relative',
    });
    
    try {
      const response = await apiClient.post<ApiResponse<{ topics: string[] }>>('/api/v1/aiml/questions/suggest-topics', data);
      console.log('🟢 [AIML Service] suggestTopics success:', {
        status: response.status,
        hasData: !!response.data,
        topicsCount: response.data?.data?.topics?.length || 0,
      });
      return response.data;
    } catch (error: any) {
      console.error('🔴 [AIML Service] suggestTopics error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        responseData: error.response?.data,
        stack: error.stack,
      });
      throw error;
    }
  },

  /**
   * Generate AI question
   */
  generateAIQuestion: async (data: {
    title: string;
    skill: string;
    topic?: string;
    difficulty: string;
    dataset_format?: string;
  }): Promise<GenerateAIQuestionResponse> => {
    const response = await apiClient.post<GenerateAIQuestionResponse>('/api/v1/aiml/questions/generate-ai', data);
    // Backend returns data directly, not wrapped in ApiResponse
    return response.data;
  },
};



