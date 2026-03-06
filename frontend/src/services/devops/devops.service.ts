import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

/**
 * DevOps Service
 * 
 * Handles all DevOps-related API calls
 * Routes: /api/v1/devops
 */

// Types
export interface DevOpsTest {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  questions: DevOpsQuestion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DevOpsQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
}

export interface CreateDevOpsTestDto {
  title: string;
  description?: string;
  duration?: number;
  question_ids?: string[];
  questions?: Omit<DevOpsQuestion, 'id'>[];
}

export const devopsService = {
  /**
   * List all DevOps tests
   */
  listTests: async (): Promise<ApiResponse<DevOpsTest[]>> => {
    const response = await apiClient.get<ApiResponse<DevOpsTest[]>>('/api/v1/devops/tests');
    return response.data;
  },

  /**
   * Get test by ID
   */
  getTest: async (testId: string): Promise<ApiResponse<DevOpsTest>> => {
    const response = await apiClient.get<ApiResponse<DevOpsTest>>(`/api/v1/devops/tests/${testId}`);
    return response.data;
  },

  /**
   * Create new test
   */
  createTest: async (data: CreateDevOpsTestDto): Promise<ApiResponse<DevOpsTest>> => {
    const response = await apiClient.post<ApiResponse<DevOpsTest>>('/api/v1/devops/tests', data);
    return response.data;
  },

  /**
   * Update test
   */
  updateTest: async (testId: string, data: Partial<CreateDevOpsTestDto>): Promise<ApiResponse<DevOpsTest>> => {
    const response = await apiClient.put<ApiResponse<DevOpsTest>>(`/api/v1/devops/tests/${testId}`, data);
    return response.data;
  },

  /**
   * Delete test
   */
  deleteTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/devops/tests/${testId}`);
    return response.data;
  },

  /**
   * Pause test
   */
  pauseTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/devops/tests/${testId}/pause`);
    return response.data;
  },

  /**
   * Resume test
   */
  resumeTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/devops/tests/${testId}/resume`);
    return response.data;
  },

  /**
   * Clone test
   */
  cloneTest: async (
    testId: string,
    data: { newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }
  ): Promise<ApiResponse<DevOpsTest>> => {
    const response = await apiClient.post<ApiResponse<DevOpsTest>>(
      `/api/v1/devops/tests/${testId}/clone`,
      data
    );
    return response.data;
  },
};

