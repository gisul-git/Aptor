import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

/**
 * DevOps Service
 * 
 * Handles all DevOps-related API calls
 * Routes: /api/v1/devops
 */

// Types
export interface InvitationTemplate {
  logoUrl?: string;
  companyName?: string;
  message: string;
  footer?: string;
  sentBy?: string;
}

export interface DevOpsTest {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  questions: DevOpsQuestion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  invitationTemplate?: InvitationTemplate;
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

export interface DevOpsCandidate {
  user_id: string;
  name: string;
  email: string;
  has_submitted?: boolean;
  submission_score?: number;
  status?: string;
  created_at?: string;
  submitted_at?: string;
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

  /**
   * Get candidates for a DevOps test
   */
  getCandidates: async (testId: string): Promise<DevOpsCandidate[]> => {
    const response = await apiClient.get<any>(`/api/v1/devops/tests/${testId}/candidates`);
    const payload = response.data;
    if (Array.isArray(payload)) return payload as DevOpsCandidate[];
    if (payload && Array.isArray(payload.data)) return payload.data as DevOpsCandidate[];

    // Fallback: use invited_users from test details so analytics can still render rows.
    try {
      const testResp = await apiClient.get<any>(`/api/v1/devops/tests/${testId}`);
      const testPayload = testResp.data?.data ?? testResp.data;
      const invited = Array.isArray(testPayload?.invited_users) ? testPayload.invited_users : [];
      return invited
        .map((email: unknown) => String(email || "").trim().toLowerCase())
        .filter((email: string) => !!email)
        .map((email: string) => ({
          user_id: email,
          name: email.split("@")[0] || email,
          email,
          has_submitted: false,
        }));
    } catch {
      return [];
    }
  },

  /**
   * Add candidate to test
   */
  addCandidate: async (testId: string, data: { name: string; email: string }): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/devops/tests/${testId}/add-candidate`, data);
    return response.data;
  },

  /**
   * Bulk add candidates
   */
  bulkAddCandidates: async (testId: string, formData: FormData): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/api/v1/devops/tests/${testId}/bulk-add-candidates`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  /**
   * Remove candidate from test
   */
  removeCandidate: async (testId: string, userId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete<ApiResponse<void>>(
      `/api/v1/devops/tests/${testId}/candidates/${userId}`
    );
    return response.data;
  },

  /**
   * Send invitation to candidate
   */
  sendInvitation: async (testId: string, email: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/devops/tests/${testId}/send-invitation`, {
      email,
    });
    return response.data;
  },

  /**
   * Send invitations to all candidates
   */
  sendInvitationsToAll: async (testId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/api/v1/devops/tests/${testId}/send-invitations-to-all`
    );
    return response.data;
  },

  /**
   * Get candidate analytics for a DevOps test
   */
  getCandidateAnalytics: async (testId: string, userId: string): Promise<any> => {
    const response = await apiClient.get<any>(`/api/v1/devops/tests/${testId}/candidates/${userId}/analytics`);
    return response.data;
  },

  /**
   * Send feedback to candidate
   */
  sendFeedback: async (testId: string, userId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/api/v1/devops/tests/${testId}/candidates/${userId}/send-feedback`
    );
    return response.data;
  },
};

