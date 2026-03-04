/**
 * Data Engineering Service API Client
 * Handles communication with the data-engineering-service backend
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type { Question, ExecutionResult, ValidationResult } from '../../libs/data-engineering/integration';

// Types imported from integration service
// export interface Question - imported from integration
// export interface ExecutionResult - imported from integration

export interface UserProgress {
  user_id: string;
  total_questions_attempted: number;
  total_questions_solved: number;
  success_rate: number;
  average_score: number;
  experience_level: string;
  overall_proficiency: number;
}

class DataEngineeringAPI {
  private client: AxiosInstance;

  constructor() {
    // Always use API Gateway route for data-engineering service
    const baseURL = process.env.NODE_ENV === 'production' 
      ? '/api/v1/data-engineering'
      : '/api/v1/data-engineering'; // Use API Gateway in development too

    this.client = axios.create({
      baseURL,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Data Engineering API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // Health check
  async healthCheck(): Promise<{ status: string; service: string }> {
    const response = await this.client.get('/health/');
    return response.data;
  }

  // Questions API
  async getTestQuestion(): Promise<Question> {
    const response = await this.client.get('/questions/test');
    return response.data;
  }

  async generateQuestion(difficulty: string, topic: string, experienceLevel: number = 3): Promise<Question> {
    // Convert difficulty string to number for backend API
    const difficultyMap: Record<string, number> = {
      'easy': 1,
      'medium': 2,
      'hard': 3
    };
    
    const difficultyLevel = difficultyMap[difficulty.toLowerCase()] || 2;
    
    const response = await this.client.get('/questions/generate', {
      params: {
        experience_level: experienceLevel,
        topic,
        difficulty: difficultyLevel,
      }
    });
    return response.data;
  }

  async getQuestion(questionId: string): Promise<Question> {
    const response = await this.client.get(`/questions/${questionId}`);
    return response.data;
  }

  async getQuestions(params?: {
    difficulty?: string;
    topic?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ questions: Question[]; total: number }> {
    const response = await this.client.get('/questions/', { params });
    return response.data;
  }

  async getTopics(): Promise<string[]> {
    const response = await this.client.get('/questions/topics');
    return response.data.topics;
  }

  async validateQuestion(questionId: string, code: string): Promise<ExecutionResult> {
    const response = await this.client.post(`/questions/${questionId}/validate`, {
      code,
    });
    return response.data;
  }

  // Execution API
  async executeCode(code: string, questionId: string, mode: 'test' | 'submit' = 'test'): Promise<ExecutionResult> {
    const response = await this.client.post('/execute/test', {
      code,
      question_id: questionId,
      mode,
    });
    return response.data;
  }

  async submitSolution(questionId: string, code: string): Promise<ExecutionResult> {
    const response = await this.client.post('/execute/submit', {
      question_id: questionId,
      code,
    });
    return response.data;
  }

  async getExecutionStatus(jobId: string): Promise<ExecutionResult> {
    const response = await this.client.get(`/execute/status/${jobId}`);
    return response.data;
  }

  async getExecutionJobs(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ jobs: ExecutionResult[]; total: number }> {
    const response = await this.client.get('/execute/jobs', { params });
    return response.data;
  }

  // User Progress API
  async getUserProgress(userId: string): Promise<UserProgress> {
    const response = await this.client.get(`/users/${userId}/progress`);
    return response.data;
  }

  async getUserDashboard(userId: string): Promise<{
    progress: UserProgress;
    recent_solutions: any[];
    recommendations: any[];
    achievements: any[];
  }> {
    const response = await this.client.get(`/users/${userId}/dashboard`);
    return response.data;
  }

  async getUserSolutions(userId: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<{ solutions: any[]; total: number }> {
    const response = await this.client.get(`/users/${userId}/solutions`, { params });
    return response.data;
  }

  // Monitoring API
  async getMetrics(): Promise<Record<string, any>> {
    const response = await this.client.get('/monitoring/metrics');
    return response.data;
  }

  async getSystemStatus(): Promise<{
    status: string;
    components: Record<string, { status: string; error?: string }>;
  }> {
    const response = await this.client.get('/monitoring/status');
    return response.data;
  }
}

// Export singleton instance
export const dataEngineeringAPI = new DataEngineeringAPI();
export default dataEngineeringAPI;