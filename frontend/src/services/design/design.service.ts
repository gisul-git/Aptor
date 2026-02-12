import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

/**
 * Design Service
 * 
 * Handles all Design-related API calls
 * Routes: /api/v1/design
 */

// Types
export interface DesignTest {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  questions: DesignQuestion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesignQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
}

export interface CreateDesignTestDto {
  title: string;
  description?: string;
  duration?: number;
  questions?: Omit<DesignQuestion, 'id'>[];
}

export const designService = {
  /**
   * List all Design tests
   */
  listTests: async (): Promise<ApiResponse<DesignTest[]>> => {
    const response = await apiClient.get<ApiResponse<DesignTest[]>>('/api/v1/design/tests');
    return response.data;
  },

  /**
   * Get test by ID
   */
  getTest: async (testId: string): Promise<ApiResponse<DesignTest>> => {
    const response = await apiClient.get<ApiResponse<DesignTest>>(`/api/v1/design/tests/${testId}`);
    return response.data;
  },

  /**
   * Create new test
   */
  createTest: async (data: CreateDesignTestDto): Promise<ApiResponse<DesignTest>> => {
    const response = await apiClient.post<ApiResponse<DesignTest>>('/api/v1/design/tests', data);
    return response.data;
  },

  /**
   * Update test
   */
  updateTest: async (testId: string, data: Partial<CreateDesignTestDto>): Promise<ApiResponse<DesignTest>> => {
    const response = await apiClient.put<ApiResponse<DesignTest>>(`/api/v1/design/tests/${testId}`, data);
    return response.data;
  },

  /**
   * Delete test
   */
  deleteTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/design/tests/${testId}`);
    return response.data;
  },

  /**
   * Pause test
   */
  pauseTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/design/tests/${testId}/pause`);
    return response.data;
  },

  /**
   * Resume test
   */
  resumeTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(`/api/v1/design/tests/${testId}/resume`);
    return response.data;
  },

  /**
   * Clone test
   */
  cloneTest: async (
    testId: string,
    data: { newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }
  ): Promise<ApiResponse<DesignTest>> => {
    const response = await apiClient.post<ApiResponse<DesignTest>>(
      `/api/v1/design/tests/${testId}/clone`,
      data
    );
    return response.data;
  },
};

