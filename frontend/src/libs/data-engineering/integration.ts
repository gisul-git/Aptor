import { dataEngineeringAPI } from '../../services/data-engineering/api'

export interface Question {
  id: string
  title: string
  description: string
  difficulty_level: string
  topic: string
  input_schema: Record<string, string>
  sample_input: any
  expected_output: any
  test_cases?: any[]
}

export interface ExecutionResult {
  job_id: string
  status: string
  output?: any
  error_message?: string
  execution_time?: number
  memory_usage?: number
  validation_result?: ValidationResult
  ai_review?: CodeReview
}

export interface ValidationResult {
  is_correct: boolean
  similarity_score: number
  schema_match: boolean
  row_count_match: boolean
  data_match: boolean
  error_details?: Array<{ type: string; message: string }>
  sample_differences?: Array<{ row_index: number; expected: any; actual: any }>
}

export interface CodeReview {
  overall_score: number
  correctness_feedback: string
  performance_feedback: string
  best_practices_feedback: string
  improvement_suggestions: string[]
}

export enum ExecutionMode {
  TEST = 'test',
  SUBMIT = 'submit'
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

export interface WorkflowState {
  currentQuestion: Question | null
  executionResult: ExecutionResult | null
  isLoading: boolean
  error: string | null
  executionMode: ExecutionMode | null
}

export interface DashboardData {
  userProgress: UserProgress
  recommendations: Recommendation[]
  recentSolutions: any[]
  analytics: any
  lastUpdated: string
}

export interface UserProgress {
  user_id: string
  experience_level: number
  completed_questions: string[]
  success_rate: number
  average_completion_time: number
  skill_areas: Record<string, number>
  last_activity: string
  preferences: {
    preferred_topics: string[]
    difficulty_preference: number
    notification_settings: any
  }
}

export interface Recommendation {
  id: string
  type: 'skill_focus' | 'difficulty_increase' | 'practice'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimatedTime: number
  skillArea?: string
  difficultyLevel?: number
  action: {
    label: string
    href: string
  }
}

class IntegrationService {
  private state: WorkflowState = {
    currentQuestion: null,
    executionResult: null,
    isLoading: false,
    error: null,
    executionMode: null
  }

  private subscribers: Array<(state: WorkflowState) => void> = []

  subscribe(callback: (state: WorkflowState) => void) {
    this.subscribers.push(callback)
    // Immediately call with current state
    callback(this.state)
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback)
      if (index > -1) {
        this.subscribers.splice(index, 1)
      }
    }
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.state))
  }

  private updateState(updates: Partial<WorkflowState>) {
    this.state = { ...this.state, ...updates }
    this.notifySubscribers()
  }

  getState(): WorkflowState {
    return { ...this.state }
  }

  async loadQuestion(
    experienceLevel: number = 3, 
    difficulty: string = 'medium', 
    topic: string = 'transformations'
  ): Promise<Question> {
    this.updateState({ isLoading: true, error: null })
    
    try {
      // Try to generate a question first, fallback to test question
      let question: Question
      try {
        console.log(`Generating question: difficulty=${difficulty}, topic=${topic}, experience=${experienceLevel}`)
        question = await dataEngineeringAPI.generateQuestion(difficulty, topic, experienceLevel)
        console.log('Successfully generated AI question:', question.title)
      } catch (generateError) {
        console.error('Failed to generate AI question:', generateError)
        console.error('Error details:', {
          message: generateError instanceof Error ? generateError.message : 'Unknown error',
          status: (generateError as any)?.response?.status,
          data: (generateError as any)?.response?.data
        })
        console.warn('Falling back to test question')
        question = await dataEngineeringAPI.getTestQuestion()
        console.log('Using fallback test question:', question.title)
      }
      
      this.updateState({ 
        currentQuestion: question, 
        isLoading: false,
        executionResult: null // Clear previous results
      })
      return question
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load question'
      this.updateState({ 
        isLoading: false, 
        error: errorMessage 
      })
      throw error
    }
  }

  async testCode(code: string, questionId: string): Promise<ExecutionResult> {
    this.updateState({ 
      isLoading: true, 
      error: null, 
      executionMode: ExecutionMode.TEST,
      executionResult: null
    })
    
    try {
      const result = await dataEngineeringAPI.executeCode(code, questionId, 'test')
      this.updateState({ 
        executionResult: result, 
        isLoading: false,
        executionMode: null
      })
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Code execution failed'
      this.updateState({ 
        isLoading: false, 
        error: errorMessage,
        executionMode: null
      })
      throw error
    }
  }

  async submitCode(code: string, questionId: string): Promise<ExecutionResult> {
    this.updateState({ 
      isLoading: true, 
      error: null, 
      executionMode: ExecutionMode.SUBMIT,
      executionResult: null
    })
    
    try {
      // For submit mode, we might want to call a different endpoint that includes AI review
      const result = await dataEngineeringAPI.submitSolution(questionId, code)
      this.updateState({ 
        executionResult: result, 
        isLoading: false,
        executionMode: null
      })
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Code submission failed'
      this.updateState({ 
        isLoading: false, 
        error: errorMessage,
        executionMode: null
      })
      throw error
    }
  }

  async loadDashboard(userId: string): Promise<DashboardData> {
    this.updateState({ isLoading: true, error: null })
    
    try {
      // Mock dashboard data for now - would be replaced with actual API call
      const mockData: DashboardData = {
        userProgress: {
          user_id: userId,
          experience_level: 5,
          completed_questions: ['q1', 'q2', 'q3', 'q4', 'q5'],
          success_rate: 0.75,
          average_completion_time: 12.5,
          skill_areas: {
            'transformations': 0.85,
            'aggregations': 0.70,
            'joins': 0.65,
            'window_functions': 0.45,
            'optimization': 0.30
          },
          last_activity: new Date().toISOString(),
          preferences: {
            preferred_topics: ['transformations', 'aggregations'],
            difficulty_preference: 5,
            notification_settings: {}
          }
        },
        recommendations: [],
        recentSolutions: [],
        analytics: {},
        lastUpdated: new Date().toISOString()
      }
      
      this.updateState({ isLoading: false })
      return mockData
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard'
      this.updateState({ 
        isLoading: false, 
        error: errorMessage 
      })
      throw error
    }
  }

  clearError() {
    this.updateState({ error: null })
  }

  clearResult() {
    this.updateState({ executionResult: null })
  }
}

// Export singleton instance
export const integration = new IntegrationService()