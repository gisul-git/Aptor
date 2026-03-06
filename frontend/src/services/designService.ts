/**
 * Design Service API Client
 * Handles all communication with the Design Service
 */

import axios from 'axios';

const DESIGN_SERVICE_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design';

export interface DesignQuestion {
  id?: string;
  role: 'ui_designer' | 'ux_designer' | 'product_designer' | 'visual_designer';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  task_type: 'landing_page' | 'mobile_app' | 'dashboard' | 'component';
  title: string;
  description: string;
  constraints: string[];
  deliverables: string[];
  evaluation_criteria: string[];
  time_limit_minutes: number;
  created_by: string;
  created_at?: string;
}

export interface WorkspaceSession {
  session_id: string;
  workspace_url: string;
  session_token: string;
  question: DesignQuestion;
  time_limit_minutes: number;
}

export interface DesignSubmission {
  submission_id: string;
  message: string;
  evaluation_status: string;
}

export interface EvaluationResult {
  submission_id: string;
  rule_based_score: number;
  ai_based_score: number;
  final_score: number;
  feedback: {
    rule_based: any;
    ai_based: any;
    overall_score: number;
    breakdown: {
      rule_based_score: number;
      ai_based_score: number;
      rule_weight: number;
      ai_weight: number;
    };
  };
}

class DesignService {
  /**
   * Generate a new design question using AI
   */
  async generateQuestion(params: {
    role: string;
    difficulty: string;
    task_type: string;
    topic?: string;
    created_by?: string;
  }): Promise<DesignQuestion> {
    try {
      const response = await axios.post(`${DESIGN_SERVICE_URL}/questions/generate`, {
        role: params.role,
        difficulty: params.difficulty,
        task_type: params.task_type,
        topic: params.topic,
        created_by: params.created_by || 'system'
      });
      return response.data;
    } catch (error) {
      console.error('Failed to generate question:', error);
      throw error;
    }
  }

  /**
   * Get all design questions with optional filters
   */
  async getQuestions(filters?: {
    role?: string;
    difficulty?: string;
    task_type?: string;
    limit?: number;
    skip?: number;
  }): Promise<DesignQuestion[]> {
    try {
      const response = await axios.get(`${DESIGN_SERVICE_URL}/questions`, {
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get questions:', error);
      throw error;
    }
  }

  /**
   * Get a specific design question by ID
   */
  async getQuestion(questionId: string): Promise<DesignQuestion> {
    try {
      const response = await axios.get(`${DESIGN_SERVICE_URL}/questions/${questionId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get question:', error);
      throw error;
    }
  }

  /**
   * Create a Penpot workspace for a candidate
   */
  async createWorkspace(params: {
    user_id: string;
    assessment_id: string;
    question_id: string;
  }): Promise<WorkspaceSession> {
    try {
      const response = await axios.post(`${DESIGN_SERVICE_URL}/workspace/create`, params);
      return response.data;
    } catch (error) {
      console.error('Failed to create workspace:', error);
      throw error;
    }
  }

  /**
   * Get workspace status
   */
  async getWorkspaceStatus(sessionId: string): Promise<any> {
    try {
      const response = await axios.get(`${DESIGN_SERVICE_URL}/workspace/${sessionId}/status`);
      return response.data;
    } catch (error) {
      console.error('Failed to get workspace status:', error);
      throw error;
    }
  }

  /**
   * End workspace session
   */
  async endWorkspaceSession(sessionId: string): Promise<void> {
    try {
      await axios.post(`${DESIGN_SERVICE_URL}/workspace/${sessionId}/end`);
    } catch (error) {
      console.error('Failed to end workspace session:', error);
      throw error;
    }
  }

  /**
   * Submit design for evaluation
   */
  async submitDesign(params: {
    session_id: string;
    user_id: string;
    question_id: string;
    screenshot: File;
  }): Promise<DesignSubmission> {
    try {
      const formData = new FormData();
      formData.append('screenshot', params.screenshot);

      const response = await axios.post(`${DESIGN_SERVICE_URL}/submit`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Session-ID': params.session_id,
          'X-User-ID': params.user_id,
          'X-Question-ID': params.question_id
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to submit design:', error);
      throw error;
    }
  }

  /**
   * Get evaluation results
   */
  async getEvaluationResults(submissionId: string): Promise<EvaluationResult> {
    try {
      const response = await axios.get(`${DESIGN_SERVICE_URL}/submissions/${submissionId}/evaluation`);
      return response.data;
    } catch (error) {
      console.error('Failed to get evaluation results:', error);
      throw error;
    }
  }

  /**
   * Get user's submissions
   */
  async getUserSubmissions(userId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${DESIGN_SERVICE_URL}/submissions/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get user submissions:', error);
      throw error;
    }
  }

  /**
   * Get question analytics
   */
  async getQuestionAnalytics(questionId: string): Promise<any> {
    try {
      const response = await axios.get(`${DESIGN_SERVICE_URL}/analytics/question/${questionId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get question analytics:', error);
      throw error;
    }
  }

  /**
   * Get user performance analytics
   */
  async getUserPerformance(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${DESIGN_SERVICE_URL}/analytics/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get user performance:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    try {
      const response = await axios.get(`${DESIGN_SERVICE_URL}/health`);
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Publish/unpublish a design question
   */
  async publishQuestion(questionId: string, isPublished: boolean): Promise<{ message: string; is_published: boolean }> {
    try {
      const response = await axios.patch(
        `${DESIGN_SERVICE_URL}/questions/${questionId}/publish`,
        null,
        {
          params: { is_published: isPublished }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to publish/unpublish question:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const designService = new DesignService();
export default designService;