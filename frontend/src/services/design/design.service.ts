import type { ApiResponse } from '../api/types';

/**
 * Design Service
 * 
 * Handles all Design-related API calls
 * Uses direct design service URL to bypass API gateway auth issues
 */

// Use direct design service URL
const DESIGN_API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3007/api/v1/design';

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
    const response = await fetch(`${DESIGN_API_URL}/tests`);
    const data = await response.json();
    return { data };
  },

  /**
   * Get test by ID
   */
  getTest: async (testId: string): Promise<ApiResponse<DesignTest>> => {
    const response = await fetch(`${DESIGN_API_URL}/tests/${testId}`);
    const data = await response.json();
    return { data };
  },

  /**
   * Create new test
   */
  createTest: async (data: CreateDesignTestDto): Promise<ApiResponse<DesignTest>> => {
    const response = await fetch(`${DESIGN_API_URL}/tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return { data: result };
  },

  /**
   * Update test
   */
  updateTest: async (testId: string, data: Partial<CreateDesignTestDto>): Promise<ApiResponse<DesignTest>> => {
    const response = await fetch(`${DESIGN_API_URL}/tests/${testId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return { data: result };
  },

  /**
   * Delete test
   */
  deleteTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await fetch(`${DESIGN_API_URL}/tests/${testId}`, {
      method: 'DELETE',
    });
    await response.json();
    return { data: undefined };
  },

  /**
   * Pause test
   */
  pauseTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await fetch(`${DESIGN_API_URL}/tests/${testId}/pause`, {
      method: 'POST',
    });
    await response.json();
    return { data: undefined };
  },

  /**
   * Resume test
   */
  resumeTest: async (testId: string): Promise<ApiResponse<void>> => {
    const response = await fetch(`${DESIGN_API_URL}/tests/${testId}/resume`, {
      method: 'POST',
    });
    await response.json();
    return { data: undefined };
  },

  /**
   * Clone test
   */
  cloneTest: async (
    testId: string,
    data: { newTitle: string; keepSchedule?: boolean; keepCandidates?: boolean }
  ): Promise<ApiResponse<DesignTest>> => {
    const response = await fetch(`${DESIGN_API_URL}/tests/${testId}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return { data: result };
  },

  /**
   * Publish/unpublish a design question
   */
  publishQuestion: async (questionId: string, isPublished: boolean): Promise<ApiResponse<{ message: string; is_published: boolean }>> => {
    console.log('[Design Service] Publishing question:', { questionId, isPublished, url: `${DESIGN_API_URL}/questions/${questionId}/publish?is_published=${isPublished}` });
    
    const response = await fetch(`${DESIGN_API_URL}/questions/${questionId}/publish?is_published=${isPublished}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    
    console.log('[Design Service] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Design Service] Error response:', errorText);
      throw new Error(`Failed to publish question: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log('[Design Service] Success result:', result);
    return { data: result };
  },
};

