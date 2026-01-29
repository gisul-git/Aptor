import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

/**
 * Assessment Service
 * 
 * Handles all assessment-related API calls
 * Routes: /api/v1/assessments
 */

// Types
export interface Assessment {
  id: string;
  title: string;
  description?: string;
  organizationId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  schedule?: {
    startDate: string;
    endDate: string;
    duration?: number;
  };
  questions?: Question[];
  topics?: Topic[];
}

export interface Question {
  id: string;
  type: 'mcq' | 'subjective' | 'coding' | 'sql' | 'aiml' | 'pseudocode';
  question: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
  topicId?: string;
}

export interface Topic {
  id: string;
  name: string;
  category: string;
  context?: string;
  questions: Question[];
}

export interface CreateAssessmentDto {
  title: string;
  description?: string;
  organizationId?: string;
  topics?: Omit<Topic, 'id'>[];
}

export interface UpdateAssessmentDto {
  title?: string;
  description?: string;
  status?: Assessment['status'];
  schedule?: Assessment['schedule'];
}

export const assessmentService = {
  /**
   * List all assessments
   */
  list: async (): Promise<ApiResponse<Assessment[]>> => {
    const response = await apiClient.get<ApiResponse<Assessment[]>>('/api/v1/assessments');
    return response.data;
  },

  /**
   * Get assessment by ID
   */
  getById: async (id: string): Promise<ApiResponse<Assessment>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/api/v1/assessments/${id}/questions`
    );

    const raw = response.data as ApiResponse<any>;
    const inner = raw.data;

    // Some backends return { data: { assessment: Assessment } }, others return { data: Assessment }
    const normalizedAssessment: Assessment =
      inner && typeof inner === 'object' && 'assessment' in inner
        ? (inner as any).assessment
        : (inner as Assessment);

    return {
      ...raw,
      data: normalizedAssessment,
    };
  },

  /**
   * Create new assessment
   */
  create: async (data: CreateAssessmentDto): Promise<ApiResponse<Assessment>> => {
    const response = await apiClient.post<ApiResponse<Assessment>>('/api/v1/assessments', data);
    return response.data;
  },

  /**
   * Update assessment
   */
  update: async (id: string, data: UpdateAssessmentDto): Promise<ApiResponse<Assessment>> => {
    const response = await apiClient.put<ApiResponse<Assessment>>(`/api/v1/assessments/${id}`, data);
    return response.data;
  },

  /**
   * Delete assessment
   */
  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/assessments/${id}`);
    return response.data;
  },

  /**
   * Generate questions for assessment
   */
  generateQuestions: async (assessmentId: string, config?: any): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/api/v1/assessments/${assessmentId}/generate-questions`,
      config
    );
    return response.data;
  },

  /**
   * Get assessment questions
   */
  getQuestions: async (assessmentId: string): Promise<ApiResponse<Question[]>> => {
    const response = await apiClient.get<ApiResponse<Question[]>>(
      `/api/v1/assessments/${assessmentId}/questions`
    );
    return response.data;
  },

  /**
   * Start assessment session (for candidates)
   */
  startSession: async (data: {
    assessmentId: string;
    token: string;
    email: string;
    name: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      '/api/v1/assessments/start-session',
      data
    );
    return response.data;
  },

  /**
   * Pause assessment
   */
  pause: async (assessmentId: string): Promise<ApiResponse<Assessment>> => {
    const response = await apiClient.post<ApiResponse<Assessment>>(
      `/api/v1/assessments/${assessmentId}/pause`,
      {}
    );
    return response.data;
  },

  /**
   * Resume assessment
   */
  resume: async (assessmentId: string): Promise<ApiResponse<Assessment>> => {
    const response = await apiClient.post<ApiResponse<Assessment>>(
      `/api/v1/assessments/${assessmentId}/resume`,
      {}
    );
    return response.data;
  },

  /**
   * Clone assessment
   */
  clone: async (
    assessmentId: string,
    data: { newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }
  ): Promise<ApiResponse<Assessment>> => {
    const response = await apiClient.post<ApiResponse<Assessment>>(
      `/api/v1/assessments/${assessmentId}/clone`,
      data
    );
    return response.data;
  },

  /**
   * Get current draft
   */
  getCurrentDraft: async (): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>('/api/v1/assessments/get-current-draft');
    return response.data;
  },

  /**
   * Update assessment draft
   */
  updateDraft: async (data: any): Promise<ApiResponse<any>> => {
    const response = await apiClient.put<ApiResponse<any>>('/api/v1/assessments/update-draft', data);
    return response.data;
  },

  /**
   * Generate topic cards
   */
  generateTopicCards: async (data: {
    jobDesignation: string;
    experienceMin?: number;
    experienceMax?: number;
    experienceMode?: string;
    assessmentTitle?: string;
  }): Promise<ApiResponse<any>> => {
    console.log('🔵 [Assessment Service] generateTopicCards - Request:', {
      url: '/api/v1/assessments/generate-topic-cards',
      data,
    });
    try {
      const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/generate-topic-cards', data);
      console.log('🟢 [Assessment Service] generateTopicCards - Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        dataType: typeof response.data,
        dataKeys: response.data ? Object.keys(response.data) : null,
        hasSuccess: 'success' in (response.data || {}),
        successValue: response.data?.success,
        hasData: 'data' in (response.data || {}),
        dataData: response.data?.data,
      });
      return response.data;
    } catch (error: any) {
      console.error('🔴 [Assessment Service] generateTopicCards - Error:', {
        message: error?.message,
        response: error?.response,
        responseStatus: error?.response?.status,
        responseData: error?.response?.data,
        responseHeaders: error?.response?.headers,
        stack: error?.stack,
      });
      throw error;
    }
  },

  /**
   * Fetch and summarize URL
   */
  fetchAndSummarizeUrl: async (data: { url: string }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/fetch-and-summarize-url', data);
    return response.data;
  },

  /**
   * Generate topics v2
   */
  generateTopicsV2: async (data: {
    assessmentId?: string;
    assessmentTitle?: string;
    topics?: any[];
    skills?: string[];
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/generate-topics', data);
    return response.data;
  },

  /**
   * Generate topics from requirements
   */
  generateTopicsFromRequirements: async (data: {
    experienceMode: string;
    experienceMin?: number;
    experienceMax?: number;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/generate-topics-from-requirements', data);
    return response.data;
  },

  /**
   * Generate topics (legacy)
   */
  generateTopics: async (data: {
    assessmentTitle?: string;
    jobDesignation?: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/generate-topics', data);
    return response.data;
  },

  /**
   * Create assessment from job designation
   */
  createFromJobDesignation: async (data: {
    assessmentId?: string;
    jobDesignation: string;
    experienceMin?: number;
    experienceMax?: number;
    experienceMode?: string;
    assessmentTitle?: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/create-from-job-designation', data);
    return response.data;
  },

  /**
   * Improve topic
   */
  improveTopic: async (data: {
    assessmentId: string;
    topicId: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/improve-topic', data);
    return response.data;
  },

  /**
   * Generate question
   */
  generateQuestion: async (data: {
    assessmentId: string;
    topicId: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/generate-question', data);
    return response.data;
  },

  /**
   * Improve all topics
   */
  improveAllTopics: async (data: {
    assessmentId: string;
    experienceMode?: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/improve-all-topics', data);
    return response.data;
  },

  /**
   * Generate topic context
   */
  generateTopicContext: async (data: {
    topicName: string;
    category: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/generate-topic-context', data);
    return response.data;
  },

  /**
   * Validate topic category
   */
  validateTopicCategory: async (data: {
    topic: string;
    category: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/validate-topic-category', data);
    return response.data;
  },

  /**
   * Check technical topic
   */
  checkTechnicalTopic: async (data: { topic: string }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/check-technical-topic', data);
    return response.data;
  },

  /**
   * AI topic suggestion
   */
  suggestTopics: async (data: {
    category: string;
    query?: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/suggest-topics', data);
    return response.data;
  },

  /**
   * Add custom topic
   */
  addCustomTopic: async (data: {
    category: string;
    topicName: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/topics/add-custom', data);
    return response.data;
  },

  /**
   * Classify technical topic
   */
  classifyTechnicalTopic: async (data: { topic: string }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/classify-technical-topic', data);
    return response.data;
  },

  /**
   * Detect topic category
   */
  detectTopicCategory: async (data: { topicName: string }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/detect-topic-category', data);
    return response.data;
  },

  /**
   * Suggest topic contexts
   */
  suggestTopicContexts: async (data: {
    partialInput: string;
    category: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/suggest-topic-contexts', data);
    return response.data;
  },

  /**
   * Add question row
   */
  addQuestionRow: async (data: {
    assessmentId: string;
    topicId: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/add-question-row', data);
    return response.data;
  },

  /**
   * Regenerate question
   */
  regenerateQuestion: async (data: {
    assessmentId: string;
    topicId: string;
    rowId: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/regenerate-question', data);
    return response.data;
  },

  /**
   * Regenerate topic
   */
  regenerateTopic: async (data: {
    topic: string;
    assessmentId?: string;
    topicId?: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/regenerate-single-topic', data);
    return response.data;
  },

  /**
   * Remove topic
   */
  removeTopic: async (data: {
    assessmentId: string;
    topicId: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.delete<ApiResponse<any>>('/api/v1/assessments/remove-topic', { data });
    return response.data;
  },

  /**
   * Finalize assessment
   */
  finalize: async (data: {
    assessmentId: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/finalize', data);
    return response.data;
  },

  /**
   * Update questions
   */
  updateQuestions: async (data: {
    assessmentId: string;
    questions: any[];
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/update-questions', data);
    return response.data;
  },

  /**
   * Update schedule and candidates
   */
  updateScheduleAndCandidates: async (data: {
    assessmentId: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/update-schedule-and-candidates', data);
    return response.data;
  },

  /**
   * Update single question
   */
  updateSingleQuestion: async (data: {
    assessmentId: string;
    questionId: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.put<ApiResponse<any>>('/api/v1/assessments/update-single-question', data);
    return response.data;
  },

  /**
   * Generate questions from config
   */
  generateQuestionsFromConfig: async (data: {
    assessmentId: string;
    topics: any[];
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/generate-questions-from-config', data);
    return response.data;
  },

  /**
   * AI topic suggestion (different from suggestTopics)
   */
  aiTopicSuggestion: async (data: {
    category: string;
    input: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/ai/topic-suggestion', data);
    return response.data;
  },

  /**
   * Remove question row
   */
  removeQuestionRow: async (data: {
    assessmentId: string;
    topicId: string;
    rowId?: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/remove-question-row', data);
    return response.data;
  },

  /**
   * Update question type
   */
  updateQuestionType: async (data: {
    assessmentId: string;
    topicId: string;
    rowId?: string;
    questionType: string;
    difficulty?: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/update-question-type', data);
    return response.data;
  },

  /**
   * Delete topic questions
   */
  deleteTopicQuestions: async (data: {
    assessmentId: string;
    topic?: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/delete-topic-questions', data);
    return response.data;
  },

  /**
   * Send invitations
   */
  sendInvitations: async (data: {
    assessmentId: string;
    candidates: Array<{ email: string; name: string }>;
    examUrl?: string;
    template?: any;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessments/send-invitations', data);
    return response.data;
  },

  /**
   * Get candidate results
   */
  getCandidateResults: async (assessmentId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(`/api/v1/assessments/${assessmentId}/candidate-results`);
    return response.data;
  },

  /**
   * Get answer logs
   */
  getAnswerLogs: async (data: {
    assessmentId: string;
    candidateEmail: string;
    candidateName: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/api/v1/assessments/${data.assessmentId}/answer-logs?candidateEmail=${encodeURIComponent(data.candidateEmail)}&candidateName=${encodeURIComponent(data.candidateName)}`
    );
    return response.data;
  },

  /**
   * Get detailed candidate results
   */
  getDetailedCandidateResults: async (data: {
    assessmentId: string;
    candidateEmail: string;
    candidateName: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/api/v1/assessments/${data.assessmentId}/candidate/${encodeURIComponent(data.candidateEmail)}/detailed-results?candidate_name=${encodeURIComponent(data.candidateName)}`
    );
    return response.data;
  },

  /**
   * Get assessment full data (candidate-facing, uses token)
   */
  getAssessmentFull: async (assessmentId: string, token: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(
      `/api/v1/candidate/get-assessment-full?assessmentId=${assessmentId}&token=${token}`
    );
    return response.data;
  },

  /**
   * Save answer (during attempt - answers are saved locally and submitted at the end)
   * Note: There's no backend endpoint for saving answers during attempts.
   * Answers are only saved when submitting via submitAnswers endpoint.
   */
  saveAnswer: async (data: {
    attemptId: string;
    questionId: string;
    answer: any;
    section?: string;
    timeRemaining?: number;
  }): Promise<ApiResponse<any>> => {
    // No backend endpoint exists for saving answers during attempts
    // Answers are stored locally and submitted via submitAnswers endpoint
    return {
      success: true,
      message: 'Answer saved locally',
      data: null,
    };
  },

  /**
   * Log analytics event
   */
  logAnalyticsEvent: async (data: {
    attemptId: string;
    eventType: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/analytics/log-event', data);
    return response.data;
  },

  /**
   * Submit answers
   */
  submitAnswers: async (data: {
    assessmentId: string;
    token: string;
    answers?: any;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/candidate/submit-answers', data);
    return response.data;
  },

  /**
   * Run code
   */
  runCode: async (data: {
    assessmentId: string;
    questionId: string;
    sourceCode: string;
    languageId: string;
  }): Promise<ApiResponse<any>> => {
    // Convert to snake_case and ensure language_id is an integer
    const requestData = {
      question_id: data.questionId,
      source_code: data.sourceCode,
      language_id: parseInt(data.languageId, 10),
      assessment_id: data.assessmentId,
    };
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessment/run', requestData);
    return response.data;
  },

  /**
   * Run SQL
   */
  runSQL: async (data: {
    assessmentId: string;
    questionId: string;
    sqlQuery: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessment/run-sql', data);
    return response.data;
  },

  /**
   * Submit SQL
   */
  submitSQL: async (data: {
    assessmentId: string;
    questionId: string;
    sqlQuery: string;
    attemptId: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/assessment/submit-sql', data);
    return response.data;
  },

  /**
   * Start proctor live session
   */
  startProctorSession: async (data: {
    assessmentId: string;
    userId: string;
    [key: string]: any;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/proctor/live/start-session', data);
    return response.data;
  },
};



