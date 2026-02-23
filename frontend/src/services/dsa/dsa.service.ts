import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

/**
 * DSA (Data Structures & Algorithms) Service
 * 
 * Handles all DSA-related API calls
 * Routes: /api/v1/dsa
 */

// Types
export interface DSATest {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  questions: DSAQuestion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DSAQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  constraints?: string[];
  examples?: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  testCases: TestCase[];
  starterCode?: Record<string, string>; // language -> code
  solution?: string;
  points: number;
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isPublic: boolean;
}

export interface DSASubmission {
  id: string;
  testId: string;
  questionId: string;
  userId: string;
  code: string;
  language: string;
  status: 'pending' | 'running' | 'accepted' | 'wrong_answer' | 'time_limit_exceeded' | 'runtime_error' | 'compile_error';
  testResults?: TestResult[];
  submittedAt: string;
}

export interface TestResult {
  testCaseId: string;
  status: 'passed' | 'failed' | 'error';
  output?: string;
  expectedOutput?: string;
  error?: string;
  executionTime?: number;
  memory?: number;
}

export interface CreateDSATestDto {
  title: string;
  description?: string;
  duration?: number;
  questions?: Omit<DSAQuestion, 'id'>[];
}

export interface CreateDSAQuestionDto {
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  constraints?: string[];
  examples?: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  testCases: Omit<TestCase, 'id'>[];
  starterCode?: Record<string, string>;
  points: number;
}

export interface RunCodeDto {
  code: string;
  language: string;
  questionId: string;
  testId: string;
}

export interface SubmitCodeDto {
  code: string;
  language: string;
  questionId: string;
  testId: string;
}

export const dsaService = {
  /**
   * List all DSA tests
   */
  listTests: async (): Promise<DSATest[]> => {
    const response = await apiClient.get<DSATest[]>('/api/v1/dsa/tests');
    return response.data;
  },

  /**
   * Get test by ID
   * Backend returns a plain test object (not wrapped in ApiResponse)
   */
  getTest: async (testId: string): Promise<DSATest> => {
    const response = await apiClient.get<DSATest>(`/api/v1/dsa/tests/${testId}`);
    return response.data;
  },

  /**
   * Create new test
   */
  createTest: async (data: CreateDSATestDto): Promise<ApiResponse<DSATest>> => {
    const response = await apiClient.post<ApiResponse<DSATest>>('/api/v1/dsa/tests', data);
    return response.data;
  },

  /**
   * Update test (full update - PUT)
   */
  updateTest: async (testId: string, data: Partial<CreateDSATestDto>): Promise<ApiResponse<DSATest>> => {
    const response = await apiClient.put<ApiResponse<DSATest>>(`/api/v1/dsa/tests/${testId}`, data);
    return response.data;
  },

  /**
   * Patch test (partial update - PATCH)
   * Use this for updating specific fields like invitationTemplate
   */
  patchTest: async (testId: string, data: Partial<CreateDSATestDto>): Promise<ApiResponse<DSATest>> => {
    const response = await apiClient.patch<ApiResponse<DSATest>>(`/api/v1/dsa/tests/${testId}`, data);
    return response.data;
  },

  /**
   * Delete test
   */
  deleteTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/dsa/tests/${testId}`);
    return response.data;
  },

  /**
   * List questions
   */
  listQuestions: async (lightweight: boolean = false): Promise<ApiResponse<DSAQuestion[]>> => {
    const endpoint = lightweight ? '/api/v1/dsa/questions/lightweight' : '/api/v1/dsa/questions';
    const response = await apiClient.get<ApiResponse<DSAQuestion[]>>(endpoint);
    return response.data;
  },

  /**
   * Get question by ID
   */
  getQuestion: async (questionId: string): Promise<ApiResponse<DSAQuestion>> => {
    const response = await apiClient.get<ApiResponse<DSAQuestion>>(`/api/v1/dsa/questions/${questionId}`);
    return response.data;
  },

  /**
   * Create question
   */
  createQuestion: async (data: CreateDSAQuestionDto): Promise<ApiResponse<DSAQuestion>> => {
    const response = await apiClient.post<ApiResponse<DSAQuestion>>('/api/v1/dsa/questions', data);
    return response.data;
  },

  /**
   * Update question
   */
  updateQuestion: async (questionId: string, data: Partial<CreateDSAQuestionDto>): Promise<ApiResponse<DSAQuestion>> => {
    const response = await apiClient.put<ApiResponse<DSAQuestion>>(`/api/v1/dsa/questions/${questionId}`, data);
    return response.data;
  },

  /**
   * Delete question
   */
  deleteQuestion: async (questionId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/dsa/questions/${questionId}`);
    return response.data;
  },

  /**
   * Run code (test without submission)
   */
  runCode: async (data: RunCodeDto): Promise<ApiResponse<TestResult[]>> => {
    const response = await apiClient.post<ApiResponse<TestResult[]>>('/api/v1/dsa/run', data);
    return response.data;
  },

  /**
   * Submit code (full submission)
   */
  submitCode: async (data: SubmitCodeDto): Promise<ApiResponse<DSASubmission>> => {
    const response = await apiClient.post<ApiResponse<DSASubmission>>('/api/v1/dsa/submit', data);
    return response.data;
  },

  /**
   * Get submission by ID
   */
  getSubmission: async (submissionId: string): Promise<ApiResponse<DSASubmission>> => {
    const response = await apiClient.get<ApiResponse<DSASubmission>>(`/api/v1/dsa/submissions/${submissionId}`);
    return response.data;
  },

  /**
   * Get submissions for a test
   */
  getTestSubmissions: async (testId: string): Promise<ApiResponse<DSASubmission[]>> => {
    const response = await apiClient.get<ApiResponse<DSASubmission[]>>(`/api/v1/dsa/tests/${testId}/submissions`);
    return response.data;
  },

  /**
   * Pause test
   */
  pauseTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/dsa/tests/${testId}/pause`);
    return response.data;
  },

  /**
   * Resume test
   */
  resumeTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/dsa/tests/${testId}/resume`);
    return response.data;
  },

  /**
   * Clone test
   */
  cloneTest: async (
    testId: string,
    data: { newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }
  ): Promise<ApiResponse<DSATest>> => {
    const response = await apiClient.post<ApiResponse<DSATest>>(
      `/api/v1/dsa/tests/${testId}/clone`,
      data
    );
    return response.data;
  },

  /**
   * Get candidates for a test
   * Backend returns a plain array of candidates.
   */
  getCandidates: async (testId: string): Promise<any[]> => {
    const response = await apiClient.get<any[]>(`/api/v1/dsa/tests/${testId}/candidates`);
    return response.data;
  },

  /**
   * Get candidate analytics
   */
  getCandidateAnalytics: async (testId: string, userId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/candidates/${userId}/analytics`);
    return response.data;
  },

  /**
   * Add candidate to test
   */
  addCandidate: async (testId: string, data: { name: string; email: string }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/add-candidate`, data);
    return response.data;
  },

  /**
   * Remove candidate from test
   */
  removeCandidate: async (testId: string, userId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/dsa/tests/${testId}/candidates/${userId}`);
    return response.data;
  },

  /**
   * Send invitation to candidate
   */
  sendInvitation: async (testId: string, email: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/send-invitation`, { email });
    return response.data;
  },

  /**
   * Send invitations to all candidates
   */
  sendInvitationsToAll: async (testId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/send-invitations-to-all`);
    return response.data;
  },

  /**
   * Get candidate resume
   */
  getCandidateResume: async (testId: string, userId: string, email: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/candidates/${userId}/resume`, {
      params: { email }
    });
    return response.data;
  },

  /**
   * Send feedback to candidate
   */
  sendFeedback: async (testId: string, userId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/candidates/${userId}/send-feedback`);
    return response.data;
  },

  /**
   * Bulk add candidates
   */
  bulkAddCandidates: async (testId: string, formData: FormData): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/bulk-add-candidates`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Get test submission
   */
  getTestSubmission: async (testId: string, userId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/submission`, {
      params: { user_id: userId },
    });
    return response.data;
  },

  /**
   * Start test
   */
  startTest: async (testId: string, userId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/start`, null, {
      params: { user_id: userId },
    });
    return response.data;
  },

  /**
   * Get public test data
   */
  getPublicTest: async (testId: string, userId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/public`, {
      params: { user_id: userId },
    });
    return response.data;
  },

  /**
   * Get question for test
   */
  getTestQuestion: async (testId: string, questionId: string, userId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/question/${questionId}`, {
      params: { user_id: userId },
    });
    return response.data;
  },

  /**
   * Final submit test
   */
  finalSubmitTest: async (testId: string, userId: string, data: {
    question_submissions: any[];
    activity_logs: any[];
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/dsa/tests/${testId}/final-submit`, data, {
      params: { user_id: userId },
    });
    return response.data;
  },

  /**
   * Run SQL (for DSA tests)
   */
  runSQL: async (data: {
    question_id: string;
    sql_query: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/dsa/assessment/run-sql', data);
    return response.data;
  },

  /**
   * Submit SQL (for DSA tests)
   */
  submitSQL: async (data: {
    question_id: string;
    sql_query: string;
    started_at: string;
    submitted_at: string;
    time_spent_seconds: number;
    execution_engine_passed?: boolean;
    execution_engine_output?: string;
    execution_engine_time?: number;
    execution_engine_memory?: number;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/dsa/assessment/submit-sql', data);
    return response.data;
  },

  /**
   * Proxy SQL execution engine execute endpoint (to avoid CORS)
   */
  proxySQLExecute: async (data: {
    questionId: string;
    code: string;
    schemas?: any;
    sample_data?: any;
  }): Promise<any> => {
    const response = await apiClient.post<any>('/api/v1/dsa/assessment/sql-engine/execute', data);
    return response.data;
  },

  /**
   * Proxy SQL execution engine submit endpoint (to avoid CORS)
   */
  proxySQLSubmit: async (data: {
    questionId: string;
    code: string;
    expectedOutput?: any[];
    schemas?: any;
    sample_data?: any;
  }): Promise<any> => {
    const response = await apiClient.post<any>('/api/v1/dsa/assessment/sql-engine/submit', data);
    return response.data;
  },

  /**
   * Run code (for DSA tests - public test cases)
   */
  runCodePublic: async (data: {
    question_id: string;
    source_code: string;
    language_id: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/dsa/assessment/run', data);
    return response.data;
  },

  /**
   * Submit code (for DSA tests - all test cases)
   */
  submitCodeFull: async (data: {
    question_id: string;
    source_code: string;
    language_id: string;
    started_at: string;
    submitted_at: string;
    time_spent_seconds: number;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/dsa/assessment/submit', data);
    return response.data;
  },
};



