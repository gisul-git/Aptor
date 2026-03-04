// Core domain types matching backend models

export interface Question {
  id: string;
  title: string;
  description: string;
  difficulty_level: number;
  topic: string;
  input_schema: Record<string, string>;
  sample_input: any; // DataFrame data
  expected_output: any; // DataFrame data
  test_cases: TestCase[];
  created_at: string;
  metadata: Record<string, any>;
}

export interface TestCase {
  id: string;
  input_data: any;
  expected_output: any;
  description?: string;
}

export interface Solution {
  id: string;
  user_id: string;
  question_id: string;
  code: string;
  execution_result?: ExecutionResult;
  ai_review?: CodeReview;
  submitted_at: string;
  status: SolutionStatus;
  performance_metrics: Record<string, number>;
}

export interface ExecutionResult {
  job_id: string;
  status: ExecutionStatus;
  output?: any; // DataFrame data
  error_message?: string;
  execution_time: number;
  memory_usage: number;
  validation_result: ValidationResult;
  ai_review?: CodeReview;
}

export interface ValidationResult {
  is_correct: boolean;
  schema_match: boolean;
  row_count_match: boolean;
  data_match: boolean;
  error_details: ValidationError[];
  similarity_score: number;
  sample_differences?: Array<{
    row_index: number;
    expected: Record<string, any>;
    actual: Record<string, any>;
  }>;
  missing_columns?: string[];
  extra_columns?: string[];
  type_mismatches?: Record<string, any>;
}

export interface ValidationError {
  type: string;
  message: string;
  details?: Record<string, any>;
}

export interface CodeReview {
  overall_score: number;
  correctness_feedback: string;
  performance_feedback: string;
  best_practices_feedback: string;
  improvement_suggestions: string[];
  code_examples: CodeExample[];
  alternative_approaches: string[];
}

export interface CodeExample {
  title: string;
  code: string;
  explanation: string;
}

export interface UserProgress {
  user_id: string;
  experience_level: number;
  completed_questions: string[];
  success_rate: number;
  average_completion_time: number;
  skill_areas: Record<string, number>;
  last_activity: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  preferred_topics: string[];
  difficulty_preference: number;
  notification_settings: Record<string, boolean>;
}

// Enums
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

export enum SolutionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  REVIEWED = 'reviewed'
}

export enum ExecutionMode {
  TEST = 'test',
  SUBMIT = 'submit'
}

// UI-specific types
export interface UIState {
  isLoading: boolean;
  error?: string;
  success?: string;
}

export interface CodeEditorState {
  code: string;
  language: string;
  theme: string;
  fontSize: number;
  wordWrap: boolean;
}

export interface ExecutionState extends UIState {
  mode: ExecutionMode;
  result?: ExecutionResult;
  isExecuting: boolean;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// Chart data types for analytics
export interface ChartDataPoint {
  name: string;
  value: number;
  date?: string;
}

export interface ProgressChartData {
  success_rate: ChartDataPoint[];
  completion_time: ChartDataPoint[];
  difficulty_progression: ChartDataPoint[];
  skill_areas: ChartDataPoint[];
}