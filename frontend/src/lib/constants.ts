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

// Navigation Items for Sidebar
export const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "Home",
    href: "/dashboard",
  },
  {
    id: "create",
    label: "Create",
    icon: "Plus",
    href: "#",
    submenu: [
      { id: "assessment", label: "Assessment", href: "/assessments" },
      { id: "question", label: "Question", href: "/dashboard/questions/create" },
      { id: "dsa", label: "DSA Competency", href: "/dashboard/dsa/create" },
    ],
  },
  {
    id: "assessments",
    label: "Assessments",
    icon: "FileText",
    href: "/dashboard/assessments",
    submenu: [
      { id: "all", label: "All", href: "/dashboard/assessments" },
      { id: "active", label: "Active", href: "/dashboard/assessments?status=active" },
      { id: "drafts", label: "Drafts", href: "/dashboard/assessments?status=drafts" },
      { id: "templates", label: "Templates", href: "/dashboard/assessments?type=templates" },
      { id: "archive", label: "Archive", href: "/dashboard/assessments?status=archive" },
    ],
  },
  {
    id: "candidates",
    label: "Candidates",
    icon: "Users",
    href: "/dashboard/candidates",
    submenu: [
      { id: "all", label: "All", href: "/dashboard/candidates" },
      { id: "enrolled", label: "Enrolled", href: "/dashboard/candidates?status=enrolled" },
      { id: "in-progress", label: "In Progress", href: "/dashboard/candidates?status=in-progress" },
      { id: "completed", label: "Completed", href: "/dashboard/candidates?status=completed" },
      { id: "add-new", label: "Add New", href: "/employee/management" },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: "BarChart3",
    href: "/dashboard/analytics",
    submenu: [
      { id: "overview", label: "Overview", href: "/dashboard/analytics" },
      { id: "reports", label: "Reports", href: "/dashboard/analytics/reports" },
      { id: "trends", label: "Trends", href: "/dashboard/analytics/trends" },
      { id: "comparison", label: "Comparison", href: "/dashboard/analytics/comparison" },
    ],
  },
  {
    id: "dsa",
    label: "DSA",
    icon: "Code",
    href: "/dashboard/dsa",
    submenu: [
      { id: "competency", label: "Competency Builder", href: "/dashboard/dsa" },
      { id: "question-bank", label: "Question Bank", href: "/dashboard/dsa/questions" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: "FileBarChart",
    href: "/dashboard/reports",
  },
  {
    id: "logs",
    label: "Logs",
    icon: "Activity",
    href: "/dashboard/logs",
    submenu: [
      { id: "activity", label: "Activity", href: "/dashboard/logs" },
      { id: "system", label: "System", href: "/dashboard/logs?type=system" },
      { id: "security", label: "Security", href: "/dashboard/logs?type=security" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: "Settings",
    href: "/dashboard/settings",
  },
] as const;



