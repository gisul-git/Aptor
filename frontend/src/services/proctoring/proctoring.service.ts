import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

/**
 * Proctoring Service
 * 
 * Handles all proctoring-related API calls
 * Routes: /api/v1/proctor, /api/v1/proctoring
 */

// Types
export interface ProctoringSession {
  id: string;
  assessmentId: string;
  userId: string;
  sessionId?: string;
  aiProctoring: boolean;
  liveProctoring: boolean;
  consent: boolean;
  metadata?: Record<string, any>;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'ended' | 'paused';
}

export interface ProctoringEvent {
  eventType: string;
  timestamp: string;
  assessmentId: string;
  userId: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  snapshotBase64?: string;
  snapshotId?: string;
}

export interface ProctoringLog {
  id: string;
  eventType: string;
  timestamp: string;
  assessmentId: string;
  userId: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  snapshotId?: string;
}

export interface ProctoringSummary {
  totalEvents: number;
  violations: number;
  tabSwitches: number;
  fullscreenExits: number;
  faceNotDetected: number;
  suspiciousActivity: number;
  startTime: string;
  endTime?: string;
  duration?: number;
}

export interface CreateSessionDto {
  assessmentId: string;
  candidateEmail: string;
}

export interface StartSessionDto {
  assessmentId: string;
  userId: string;
  ai_proctoring?: boolean;
  live_proctoring?: boolean;
  consent: boolean;
  metadata?: Record<string, any>;
}

export interface RecordEventDto {
  eventType: string;
  timestamp: string;
  assessmentId: string;
  userId: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  snapshotBase64?: string;
  snapshotId?: string;
}

export const proctoringService = {
  /**
   * Create proctoring session
   */
  createSession: async (data: CreateSessionDto): Promise<ApiResponse<{ sessionId: string }>> => {
    const response = await apiClient.post<ApiResponse<{ sessionId: string }>>(
      '/api/v1/proctor/create-session',
      data
    );
    return response.data;
  },

  /**
   * Start proctoring session
   */
  startSession: async (data: StartSessionDto): Promise<ApiResponse<ProctoringSession>> => {
    const response = await apiClient.post<ApiResponse<ProctoringSession>>(
      '/api/v1/proctor/start-session',
      {
        assessmentId: data.assessmentId,
        userId: data.userId,
        ai_proctoring: data.ai_proctoring || false,
        live_proctoring: data.live_proctoring || false,
        consent: data.consent,
        metadata: data.metadata,
      }
    );
    return response.data;
  },

  /**
   * Stop proctoring session
   */
  stopSession: async (sessionId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post<ApiResponse<void>>(
      `/api/v1/proctor/stop-session`,
      { sessionId }
    );
    return response.data;
  },

  /**
   * Record proctoring event
   */
  recordEvent: async (data: RecordEventDto): Promise<ApiResponse<{ status: string }>> => {
    const response = await apiClient.post<ApiResponse<{ status: string }>>(
      '/api/v1/proctor/record',
      {
        eventType: data.eventType,
        timestamp: data.timestamp,
        assessmentId: data.assessmentId,
        userId: data.userId,
        sessionId: data.sessionId || null,
        metadata: data.metadata || null,
        snapshotBase64: data.snapshotBase64 || null,
        snapshotId: data.snapshotId || null,
      }
    );
    return response.data;
  },

  /**
   * Upload snapshot
   */
  uploadSnapshot: async (
    file: File,
    assessmentId: string,
    userId: string,
    sessionId: string,
    metadata: string
  ): Promise<ApiResponse<{ snapshotId: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assessmentId', assessmentId);
    formData.append('userId', userId);
    formData.append('sessionId', sessionId);
    formData.append('metadata', metadata);

    const response = await apiClient.post<ApiResponse<{ snapshotId: string }>>(
      '/api/v1/proctor/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  /**
   * Get proctoring logs
   */
  getLogs: async (assessmentId: string, userId: string): Promise<ApiResponse<{
    logs: ProctoringLog[];
    totalCount: number;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      logs: ProctoringLog[];
      totalCount: number;
    }>>(`/api/v1/proctor/logs/${encodeURIComponent(assessmentId)}/${encodeURIComponent(userId)}`);
    return response.data;
  },

  /**
   * Get proctoring summary
   */
  getSummary: async (assessmentId: string, userId: string): Promise<ApiResponse<ProctoringSummary>> => {
    const response = await apiClient.get<ApiResponse<ProctoringSummary>>(
      `/api/v1/proctor/summary/${encodeURIComponent(assessmentId)}/${encodeURIComponent(userId)}`
    );
    return response.data;
  },

  /**
   * Get snapshot by ID
   */
  getSnapshot: async (snapshotId: string): Promise<ApiResponse<{ url: string; metadata?: any }>> => {
    const response = await apiClient.get<ApiResponse<{ url: string; metadata?: any }>>(
      `/api/v1/proctor/snapshot/${snapshotId}`
    );
    return response.data;
  },
};




