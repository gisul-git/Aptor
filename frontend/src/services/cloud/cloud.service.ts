import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

/**
 * Cloud Service
 * 
 * Handles all Cloud-related API calls
 * Routes: /api/v1/cloud
 */

// Types
export interface CloudTest {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  questions: CloudQuestion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
}

export interface CreateCloudTestDto {
  title: string;
  description?: string;
  duration?: number;
  questions?: Omit<CloudQuestion, 'id'>[];
}

export const cloudService = {
  /**
   * List all Cloud tests
   */
  listTests: async (): Promise<ApiResponse<CloudTest[]>> => {
    const response = await apiClient.get<ApiResponse<CloudTest[]>>('/api/v1/cloud/tests');
    return response.data;
  },

  /**
   * Get test by ID
   */
  getTest: async (testId: string): Promise<ApiResponse<CloudTest>> => {
    const response = await apiClient.get<ApiResponse<CloudTest>>(`/api/v1/cloud/tests/${testId}`);
    return response.data;
  },

  /**
   * Create new test
   */
  createTest: async (data: CreateCloudTestDto): Promise<ApiResponse<CloudTest>> => {
    const response = await apiClient.post<ApiResponse<CloudTest>>('/api/v1/cloud/tests', data);
    return response.data;
  },

  /**
   * Update test
   */
  updateTest: async (testId: string, data: Partial<CreateCloudTestDto>): Promise<ApiResponse<CloudTest>> => {
    const response = await apiClient.put<ApiResponse<CloudTest>>(`/api/v1/cloud/tests/${testId}`, data);
    return response.data;
  },

  /**
   * Delete test
   */
  deleteTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/cloud/tests/${testId}`);
    return response.data;
  },

  /**
   * Pause test
   */
  pauseTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/cloud/tests/${testId}/pause`);
    return response.data;
  },

  /**
   * Resume test
   */
  resumeTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/cloud/tests/${testId}/resume`);
    return response.data;
  },

  /**
   * Clone test
   */
  cloneTest: async (
    testId: string,
    data: { newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }
  ): Promise<ApiResponse<CloudTest>> => {
    const response = await apiClient.post<ApiResponse<CloudTest>>(
      `/api/v1/cloud/tests/${testId}/clone`,
      data
    );
    return response.data;
  },
};

