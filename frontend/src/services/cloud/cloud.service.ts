import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

/**
 * Cloud Service
 * 
 * Handles all Cloud-related API calls
 * Routes: /api/v1/cloud
 */

// Types
export interface InvitationTemplate {
  logoUrl?: string;
  companyName?: string;
  message: string;
  footer?: string;
  sentBy?: string;
}

export interface CloudTest {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  questions: CloudQuestion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  invitationTemplate?: InvitationTemplate;
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
  question_ids?: string[];
  questions?: Omit<CloudQuestion, 'id'>[];
}

export interface CloudCandidate {
  user_id: string;
  name: string;
  email: string;
  has_submitted?: boolean;
  submission_score?: number;
  status?: string;
  created_at?: string;
  submitted_at?: string;
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

  /**
   * Get candidates for a Cloud test
   */
  getCandidates: async (testId: string): Promise<CloudCandidate[]> => {
    const response = await apiClient.get<any>(`/api/v1/cloud/tests/${testId}/candidates`);
    const payload = response.data;
    if (Array.isArray(payload)) return payload as CloudCandidate[];
    if (payload && Array.isArray(payload.data)) return payload.data as CloudCandidate[];

    // Fallback: use invited_users from test details so analytics can still render rows.
    try {
      const testResp = await apiClient.get<any>(`/api/v1/cloud/tests/${testId}`);
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
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/cloud/tests/${testId}/add-candidate`, data);
    return response.data;
  },

  /**
   * Bulk add candidates
   */
  bulkAddCandidates: async (testId: string, formData: FormData): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/api/v1/cloud/tests/${testId}/bulk-add-candidates`,
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
      `/api/v1/cloud/tests/${testId}/candidates/${userId}`
    );
    return response.data;
  },

  /**
   * Send invitation to candidate
   */
  sendInvitation: async (testId: string, email: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/v1/cloud/tests/${testId}/send-invitation`, {
      email,
    });
    return response.data;
  },

  /**
   * Send invitations to all candidates
   */
  sendInvitationsToAll: async (testId: string): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/api/v1/cloud/tests/${testId}/send-invitations-to-all`
    );
    return response.data;
  },

  /**
   * Get candidate analytics for a Cloud test
   */
  getCandidateAnalytics: async (testId: string, userId: string): Promise<any> => {
    const response = await apiClient.get<any>(`/api/v1/cloud/tests/${testId}/candidates/${userId}/analytics`);
    return response.data;
  },

  /**
   * Send feedback to candidate
   */
  sendFeedback: async (
    testId: string,
    userId: string,
    candidateEmail?: string
  ): Promise<ApiResponse<any>> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/api/v1/cloud/tests/${testId}/candidates/${encodeURIComponent(userId)}/send-feedback`,
      candidateEmail ? { email: candidateEmail } : undefined
    );
    return response.data;
  },
};




