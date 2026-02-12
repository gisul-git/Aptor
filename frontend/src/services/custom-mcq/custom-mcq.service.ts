import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';
import type { CustomMCQAssessment, MCQQuestion, SubjectiveQuestion, Candidate } from '@/types/custom-mcq';

/**
 * Custom MCQ Service
 * 
 * Handles all Custom MCQ-related API calls
 * Routes: /api/v1/custom-mcq
 */

export interface CreateCustomMCQAssessmentDto {
  title: string;
  description?: string;
  questions: (MCQQuestion | SubjectiveQuestion)[];
  accessMode: 'private' | 'public';
  examMode: 'strict' | 'flexible';
  startTime?: string;
  endTime?: string;
  duration?: number;
  passPercentage: number;
  schedule?: {
    startTime?: string;
    endTime?: string;
    duration?: number;
    candidateRequirements?: {
      requirePhone?: boolean;
      requireResume?: boolean;
      requireLinkedIn?: boolean;
      requireGithub?: boolean;
    };
  };
  enablePerSectionTimers?: boolean;
  sectionTimers?: {
    MCQ?: number;
    Subjective?: number;
  };
  proctoringSettings?: {
    aiProctoringEnabled?: boolean;
  };
  showResultToCandidate?: boolean;
}

export interface SubmitAssessmentDto {
  assessmentId: string;
  token: string;
  email: string;
  name: string;
  submissions: Array<{
    questionId: string;
    selectedAnswers?: string[];
    textAnswer?: string;
  }>;
  startedAt?: Date;
  submittedAt?: Date;
  candidateRequirements?: {
    phone?: string;
    linkedIn?: string;
    github?: string;
    [key: string]: any;
  };
}

export interface SendInvitationsDto {
  assessmentId: string;
  candidates: Array<{ name: string; email: string }>;
  assessmentUrl: string;
  template?: {
    subject?: string;
    message?: string;
    footer?: string;
    sentBy?: string;
  };
}

export const customMCQService = {
  /**
   * Download sample CSV
   */
  downloadSampleCSV: async (questionType: 'mcq' | 'subjective' = 'mcq'): Promise<Blob> => {
    const response = await apiClient.get('/api/v1/custom-mcq/sample-csv', {
      params: { questionType },
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Upload CSV file
   */
  uploadCSV: async (file: File, questionType: 'mcq' | 'subjective' = 'mcq'): Promise<ApiResponse<{ questions: any[]; totalQuestions: number }>> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post<ApiResponse<{ questions: any[]; totalQuestions: number }>>(
      '/api/v1/custom-mcq/upload-csv',
      formData,
      {
        params: { questionType },
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  /**
   * Validate CSV data
   */
  validateCSV: async (csvData: Record<string, any>[]): Promise<ApiResponse<{ questions: (MCQQuestion | SubjectiveQuestion)[]; totalQuestions: number }>> => {
    const response = await apiClient.post<ApiResponse<{ questions: (MCQQuestion | SubjectiveQuestion)[]; totalQuestions: number }>>(
      '/api/v1/custom-mcq/validate-csv',
      { csvData }
    );
    return response.data;
  },

  /**
   * Create assessment
   */
  createAssessment: async (data: CreateCustomMCQAssessmentDto & { status?: string; currentStation?: number }): Promise<ApiResponse<{
    assessmentId: string;
    assessmentToken?: string;
    assessmentUrl?: string;
    totalQuestions: number;
    totalMarks: number;
    status?: string;
    currentStation?: number;
  }>> => {
    const response = await apiClient.post<ApiResponse<{
      assessmentId: string;
      assessmentToken?: string;
      assessmentUrl?: string;
      totalQuestions: number;
      totalMarks: number;
      status?: string;
      currentStation?: number;
    }>>('/api/v1/custom-mcq/create', data);
    return response.data;
  },

  /**
   * Get assessment by ID
   */
  getAssessment: async (assessmentId: string): Promise<ApiResponse<CustomMCQAssessment>> => {
    const response = await apiClient.get<ApiResponse<CustomMCQAssessment>>(`/api/v1/custom-mcq/${assessmentId}`);
    return response.data;
  },

  /**
   * Update assessment
   */
  updateAssessment: async (assessmentId: string, updates: Partial<CustomMCQAssessment> & { status?: string; currentStation?: number }): Promise<ApiResponse<any>> => {
    const response = await apiClient.put<ApiResponse<any>>(`/api/v1/custom-mcq/${assessmentId}`, updates);
    return response.data;
  },

  /**
   * List assessments
   */
  listAssessments: async (): Promise<ApiResponse<CustomMCQAssessment[]>> => {
    const response = await apiClient.get<ApiResponse<CustomMCQAssessment[]>>('/api/v1/custom-mcq/list');
    return response.data;
  },

  /**
   * Delete assessment
   */
  deleteAssessment: async (assessmentId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/custom-mcq/${assessmentId}`);
    return response.data;
  },

  /**
   * Verify candidate
   */
  verifyCandidate: async (
    assessmentId: string,
    token: string,
    email: string,
    name: string
  ): Promise<ApiResponse<{ verified: boolean; accessMode: string }>> => {
    const response = await apiClient.post<ApiResponse<{ verified: boolean; accessMode: string }>>(
      '/api/v1/custom-mcq/verify-candidate',
      { assessmentId, token, email, name }
    );
    return response.data;
  },

  /**
   * Get assessment for taking (candidate view)
   */
  getAssessmentForTaking: async (
    assessmentId: string,
    token: string,
    email?: string,
    name?: string
  ): Promise<ApiResponse<CustomMCQAssessment>> => {
    const params: any = { token };
    if (email) params.email = email;
    if (name) params.name = name;
    
    const response = await apiClient.get<ApiResponse<CustomMCQAssessment>>(
      `/api/v1/custom-mcq/take/${assessmentId}`,
      { params }
    );
    return response.data;
  },

  /**
   * Submit assessment
   */
  submitAssessment: async (data: SubmitAssessmentDto): Promise<ApiResponse<{
    score: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
    gradingStatus?: string;
    aiEvaluationStatus?: "pending" | "evaluating" | "completed" | "error";
    mcqScore?: number;
    mcqTotal?: number;
    subjectiveScore?: number;
    subjectiveTotal?: number;
    codingScore?: number;
    codingTotal?: number;
    showResultToCandidate?: boolean;
  }>> => {
    const response = await apiClient.post<ApiResponse<{
      score: number;
      totalMarks: number;
      percentage: number;
      passed: boolean;
      gradingStatus?: string;
      aiEvaluationStatus?: "pending" | "evaluating" | "completed" | "error";
      mcqScore?: number;
      mcqTotal?: number;
      subjectiveScore?: number;
      subjectiveTotal?: number;
      codingScore?: number;
      codingTotal?: number;
      showResultToCandidate?: boolean;
    }>>('/api/v1/custom-mcq/submit', {
      ...data,
      startedAt: data.startedAt?.toISOString(),
      submittedAt: data.submittedAt?.toISOString(),
      candidateRequirements: data.candidateRequirements || {},
    });
    return response.data;
  },

  /**
   * Save answer log (for subjective questions)
   */
  saveAnswerLog: async (
    assessmentId: string,
    token: string,
    email: string,
    name: string,
    questionId: string,
    answer: string
  ): Promise<ApiResponse<{ saved: boolean }>> => {
    const response = await apiClient.post<ApiResponse<{ saved: boolean }>>(
      '/api/v1/custom-mcq/save-answer-log',
      {
        assessmentId,
        token,
        email,
        name,
        questionId,
        answer,
        timestamp: new Date().toISOString(),
      }
    );
    return response.data;
  },

  /**
   * Send invitation emails
   */
  sendInvitations: async (data: SendInvitationsDto): Promise<ApiResponse<{
    sentCount: number;
    failedCount: number;
    failedEmails: string[];
    errorMessages: string[];
  }>> => {
    const response = await apiClient.post<ApiResponse<{
      sentCount: number;
      failedCount: number;
      failedEmails: string[];
      errorMessages: string[];
    }>>('/api/v1/custom-mcq/send-invitations', data);
    return response.data;
  },

  /**
   * Pause assessment
   */
  pauseAssessment: async (assessmentId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/custom-mcq/${assessmentId}/pause`);
    return response.data;
  },

  /**
   * Resume assessment
   */
  resumeAssessment: async (assessmentId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/custom-mcq/${assessmentId}/resume`);
    return response.data;
  },

  /**
   * Clone assessment
   */
  cloneAssessment: async (
    assessmentId: string,
    data: { newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }
  ): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/api/v1/custom-mcq/${assessmentId}/clone`,
      data
    );
    return response.data;
  },
};



