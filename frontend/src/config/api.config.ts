/**
 * API Configuration
 * 
 * Centralized API configuration
 */

export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80',
  timeout: 600000, // 10 minutes - allow enough time for question generation
  retryAttempts: 3,
  retryDelay: 1000,
} as const;


export const API_ROUTES = {
  // Auth
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REFRESH_TOKEN: '/api/v1/auth/refresh-token',
    VERIFY: '/api/v1/auth/verify',
    OAUTH_LOGIN: '/api/v1/auth/oauth-login',
  },
  
  // Assessments
  ASSESSMENTS: {
    BASE: '/api/v1/assessments',
    BY_ID: (id: string) => `/api/v1/assessments/${id}`,
    QUESTIONS: (id: string) => `/api/v1/assessments/${id}/questions`,
    GENERATE_QUESTIONS: (id: string) => `/api/v1/assessments/${id}/generate-questions`,
    START_SESSION: '/api/v1/assessments/start-session',
  },
  
  // DSA
  DSA: {
    BASE: '/api/v1/dsa',
    TESTS: '/api/v1/dsa/tests',
    QUESTIONS: '/api/v1/dsa/questions',
  },
  
  // AIML
  AIML: {
    BASE: '/api/v1/aiml',
    TESTS: '/api/v1/aiml/tests',
    QUESTIONS: '/api/v1/aiml/questions',
  },
  
  // Custom MCQ
  CUSTOM_MCQ: {
    BASE: '/api/v1/custom-mcq',
    BY_ID: (id: string) => `/api/v1/custom-mcq/${id}`,
  },
  
  // Proctoring
  PROCTORING: {
    BASE: '/api/v1/proctor',
    SESSIONS: '/api/v1/proctor/sessions',
    SNAPSHOTS: '/api/v1/proctor/snapshots',
  },
} as const;




