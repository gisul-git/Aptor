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
};

