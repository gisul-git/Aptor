/**
 * Application Constants
 * 
 * Centralized constants used across the application
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
} as const;

// Assessment Types
export const ASSESSMENT_TYPES = {
  MCQ: 'mcq',
  SUBJECTIVE: 'subjective',
  PSEUDOCODE: 'pseudocode',
  CODING: 'coding',
  SQL: 'sql',
  AIML: 'aiml',
} as const;

// Question Types
export const QUESTION_TYPES = {
  MCQ: 'mcq',
  SUBJECTIVE: 'subjective',
  PSEUDOCODE: 'pseudocode',
  CODING: 'coding',
  SQL: 'sql',
  AIML: 'aiml',
} as const;

// Assessment Status
export const ASSESSMENT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
} as const;

// Difficulty Levels
export const DIFFICULTY_LEVELS = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
} as const;

// Proctoring Event Types
export const PROCTORING_EVENTS = {
  NO_FACE_DETECTED: 'NO_FACE_DETECTED',
  MULTIPLE_FACES_DETECTED: 'MULTIPLE_FACES_DETECTED',
  GAZE_AWAY: 'GAZE_AWAY',
  FACE_MISMATCH: 'FACE_MISMATCH',
  TAB_SWITCH: 'TAB_SWITCH',
  FOCUS_LOST: 'FOCUS_LOST',
  FULLSCREEN_EXIT: 'FULLSCREEN_EXIT',
  FULLSCREEN_ENABLED: 'FULLSCREEN_ENABLED',
  PROCTORING_STARTED: 'PROCTORING_STARTED',
  PROCTORING_STOPPED: 'PROCTORING_STOPPED',
  CAMERA_DENIED: 'CAMERA_DENIED',
  CAMERA_ERROR: 'CAMERA_ERROR',
} as const;

// Time Constants
export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH: 'auth-storage',
  ASSESSMENT: 'assessment-storage',
  UI: 'ui-storage',
  PROCTORING: 'proctoring-storage',
} as const;

// Route Paths
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  SIGNIN: '/auth/signin',
  SIGNUP: '/auth/signup',
  ASSESSMENTS: '/assessments',
  ASSESSMENT_CREATE: '/assessments/create',
  DSA: '/dsa',
  AIML: '/aiml',
  CUSTOM_MCQ: '/custom-mcq',
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: {
    CSV: ['text/csv', 'application/vnd.ms-excel'],
    IMAGE: ['image/jpeg', 'image/png', 'image/gif'],
    PDF: ['application/pdf'],
  },
} as const;

// Code Execution
export const CODE_EXECUTION = {
  TIMEOUT: 30000, // 30 seconds
  MAX_MEMORY: 128 * 1024 * 1024, // 128MB
  SUPPORTED_LANGUAGES: ['python', 'javascript', 'java', 'cpp', 'c'],
} as const;



