import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

/**
 * Data Engineering Service
 * 
 * Handles all Data Engineering-related API calls
 * Routes: /api/v1/data-engineering
 */

// Types
export interface DataEngineeringTest {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  questions: DataEngineeringQuestion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataEngineeringQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
}

export interface CreateDataEngineeringTestDto {
  title: string;
  description?: string;
  duration?: number;
  questions?: Omit<DataEngineeringQuestion, 'id'>[];
}

export const dataEngineeringService = {
  /**
   * List all Data Engineering tests
   */
  listTests: async (): Promise<ApiResponse<DataEngineeringTest[]>> => {
    const response = await apiClient.get<ApiResponse<DataEngineeringTest[]>>('/api/v1/data-engineering/tests');
    return response.data;
  },

  /**
   * Get test by ID
   */
  getTest: async (testId: string): Promise<ApiResponse<DataEngineeringTest>> => {
    const response = await apiClient.get<ApiResponse<DataEngineeringTest>>(`/api/v1/data-engineering/tests/${testId}`);
    return response.data;
  },

  /**
   * Create new test
   */
  createTest: async (data: CreateDataEngineeringTestDto): Promise<ApiResponse<DataEngineeringTest>> => {
    const response = await apiClient.post<ApiResponse<DataEngineeringTest>>('/api/v1/data-engineering/tests', data);
    return response.data;
  },

  /**
   * Update test
   */
  updateTest: async (testId: string, data: Partial<CreateDataEngineeringTestDto>): Promise<ApiResponse<DataEngineeringTest>> => {
    const response = await apiClient.put<ApiResponse<DataEngineeringTest>>(`/api/v1/data-engineering/tests/${testId}`, data);
    return response.data;
  },

  /**
   * Delete test
   */
  deleteTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/data-engineering/tests/${testId}`);
    return response.data;
  },

  /**
   * Pause test
   */
  pauseTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/data-engineering/tests/${testId}/pause`);
    return response.data;
  },

  /**
   * Resume test
   */
  resumeTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/data-engineering/tests/${testId}/resume`);
    return response.data;
  },

  /**
   * Clone test
   */
  cloneTest: async (
    testId: string,
    data: { newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }
  ): Promise<ApiResponse<DataEngineeringTest>> => {
    const response = await apiClient.post<ApiResponse<DataEngineeringTest>>(
      `/api/v1/data-engineering/tests/${testId}/clone`,
      data
    );
    return response.data;
  },

  /**
   * List all Data Engineering questions
   */
  listQuestions: async (): Promise<ApiResponse<any[]>> => {
    const response = await apiClient.get<any>('/api/v1/data-engineering/questions');
    // Backend returns {questions: [...], total, skip, limit, has_more}
    // Extract the questions array from response.data
    const questions = response.data?.questions || [];
    return { 
      success: true,
      data: questions,
      message: 'Questions fetched successfully'
    };
  },

  /**
   * Get question by ID
   */
  getQuestion: async (questionId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.get<any>(`/api/v1/data-engineering/questions/${questionId}`);
    // Backend returns question object directly, wrap it in ApiResponse structure
    return {
      success: true,
      data: response.data,
      message: 'Question fetched successfully'
    };
  },

  /**
   * Create question
   */
  createQuestion: async (data: any): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>('/api/v1/data-engineering/questions', data);
    return response.data;
  },

  /**
   * Update question
   */
  updateQuestion: async (questionId: string, data: any): Promise<ApiResponse<any>> => {
    const response = await apiClient.put<ApiResponse<any>>(`/api/v1/data-engineering/questions/${questionId}`, data);
    return response.data;
  },

  /**
   * Delete question
   */
  deleteQuestion: async (questionId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/data-engineering/questions/${questionId}`);
    return response.data;
  },

  /**
   * Publish/unpublish question
   */
  publishQuestion: async (questionId: string, isPublished: boolean): Promise<ApiResponse<any>> => {
    const response = await apiClient.patch<ApiResponse<any>>(
      `/api/v1/data-engineering/questions/${questionId}/publish?is_published=${isPublished}`
    );
    return response.data;
  },
};
