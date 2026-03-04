import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { 
  Question, 
  Solution, 
  ExecutionResult, 
  UserProgress, 
  ApiResponse, 
  PaginatedResponse,
  ExecutionMode 
} from '@/types'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    // Use window.location.origin for browser, empty for SSR
    const baseURL = typeof window !== 'undefined' ? window.location.origin : ''
    
    this.client = axios.create({
      baseURL: baseURL,
      timeout: 60000, // 60 seconds for PySpark execution
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available (only in browser)
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('auth_token')
          if (token) {
            config.headers.Authorization = `Bearer ${token}`
          }
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Just log the error, don't redirect to login
        if (error.response?.status === 401) {
          console.warn('Unauthorized request - authentication may be required in the future')
        }
        return Promise.reject(error)
      }
    )
  }

  // Question Management
  async generateQuestion(experienceLevel: number, topic?: string): Promise<Question> {
    console.log('🌐 API: Generating question...', { experienceLevel, topic })
    
    const params = new URLSearchParams({ experience_level: experienceLevel.toString() })
    if (topic) params.append('topic', topic)
    
    const url = `/api/v1/questions/generate?${params}`
    console.log('📡 API: Making request to:', url)
    
    try {
      const response: AxiosResponse<Question> = await this.client.get(url)
      console.log('✅ API: Question generated successfully:', response.data.title)
      return response.data
    } catch (error) {
      console.error('❌ API: Question generation failed:', error)
      throw error
    }
  }

  async getQuestion(questionId: string): Promise<Question> {
    const response: AxiosResponse<Question> = await this.client.get(
      `/api/v1/questions/${questionId}`
    )
    return response.data
  }

  async getQuestions(page: number = 1, perPage: number = 10): Promise<PaginatedResponse<Question>> {
    const response: AxiosResponse<PaginatedResponse<Question>> = await this.client.get(
      `/api/v1/questions?page=${page}&per_page=${perPage}`
    )
    return response.data
  }

  // Code Execution
  async executeCode(
    code: string, 
    questionId: string, 
    mode: ExecutionMode = ExecutionMode.TEST
  ): Promise<ExecutionResult> {
    console.log('🔵 API.executeCode called', { mode, questionId, codeLength: code.length })
    
    const endpoint = mode === ExecutionMode.TEST ? '/api/v1/execute/test' : '/api/v1/execute/submit'
    console.log('📡 API: Posting to endpoint:', endpoint)
    
    try {
      const response: AxiosResponse<ExecutionResult> = await this.client.post(endpoint, {
        code,
        question_id: questionId,
        mode
      })
      console.log('✅ API: Execution response received:', response.data.status)
      return response.data
    } catch (error) {
      console.error('❌ API: Execution failed:', error)
      throw error
    }
  }

  async getExecutionStatus(jobId: string): Promise<ExecutionResult> {
    const response: AxiosResponse<ExecutionResult> = await this.client.get(
      `/api/v1/execute/status/${jobId}`
    )
    return response.data
  }

  // Solutions
  async getSolution(solutionId: string): Promise<Solution> {
    const response: AxiosResponse<ApiResponse<Solution>> = await this.client.get(
      `/api/v1/solutions/${solutionId}`
    )
    return response.data.data
  }

  async getUserSolutions(userId: string, page: number = 1): Promise<PaginatedResponse<Solution>> {
    const response: AxiosResponse<PaginatedResponse<Solution>> = await this.client.get(
      `/api/v1/users/${userId}/solutions?page=${page}`
    )
    return response.data
  }

  // User Progress
  async getUserProgress(userId: string): Promise<UserProgress> {
    const response: AxiosResponse<ApiResponse<UserProgress>> = await this.client.get(
      `/api/v1/users/${userId}/progress`
    )
    return response.data.data
  }

  async updateUserPreferences(userId: string, preferences: any): Promise<UserProgress> {
    const response: AxiosResponse<ApiResponse<UserProgress>> = await this.client.post(
      `/api/v1/users/${userId}/preferences`,
      preferences
    )
    return response.data.data
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response: AxiosResponse<{ status: string; timestamp: string }> = await this.client.get('/health')
    return response.data
  }
}

// Create singleton instance
export const apiClient = new ApiClient()

// Convenience functions
export const api = {
  questions: {
    generate: (experienceLevel: number, topic?: string) => 
      apiClient.generateQuestion(experienceLevel, topic),
    get: (id: string) => apiClient.getQuestion(id),
    list: (page?: number, perPage?: number) => apiClient.getQuestions(page, perPage),
  },
  
  execution: {
    execute: (code: string, questionId: string, mode?: ExecutionMode) => 
      apiClient.executeCode(code, questionId, mode),
    status: (jobId: string) => apiClient.getExecutionStatus(jobId),
  },
  
  solutions: {
    get: (id: string) => apiClient.getSolution(id),
    getUserSolutions: (userId: string, page?: number) => 
      apiClient.getUserSolutions(userId, page),
  },
  
  users: {
    getProgress: (userId: string) => apiClient.getUserProgress(userId),
    updatePreferences: (userId: string, preferences: any) => 
      apiClient.updateUserPreferences(userId, preferences),
  },
  
  health: () => apiClient.healthCheck(),
}