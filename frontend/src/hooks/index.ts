/**
 * Hooks Index
 * 
 * Central export for all hooks
 */

// API Hooks (React Query) - for data fetching
export {
  useAssessments,
  useAssessment,
  useCreateAssessment,
  useUpdateAssessment,
  useDeleteAssessment,
} from './api/useAssessments';

export {
  useDSATests,
  useDSATest,
  useRunDSACode,
  useSubmitDSACode,
} from './api/useDSA';

export {
  useAIMLTests,
  useAIMLTest,
  useExecuteAIMLNotebook,
} from './api/useAIML';

export {
  useCustomMCQAssessments,
  useCustomMCQAssessment,
  useUploadCustomMCQCSV,
  useSubmitCustomMCQAssessment,
} from './api/useCustomMCQ';

export {
  useStartProctoringSession,
  useStopProctoringSession,
  useRecordProctoringEvent,
  useProctoringLogs,
} from './api/useProctoring';

// Assessment Hooks - for assessment taking logic
export {
  useAssessmentSession,
  useAssessmentQuestions,
  useAssessmentAnswers,
  useAssessmentNavigation,
  useAssessmentTimers,
  type Sections,
} from './assessment';

// Auth Hooks
export { useAuth, useSession } from './auth';

// Proctoring Hooks
export {
  useCameraProctor,
  useTabSwitchProctor,
  useFullscreenLock,
  useProctor,
  useProctorPolling,
  useSimpleProctor,
  useMultiLiveProctorAdmin,
  useAgoraLiveProctorAdmin,
} from './proctoring';

// Other Hooks (keep for backward compatibility)
// Re-export individual hooks that don't have default exports
export { useAITimer } from './useAITimer';
export { useDashboardCard } from './useDashboardCard';
export { useDashboardAssessments, type Assessment, type UseDashboardAssessmentsReturn } from './useDashboardAssessments';
export { useDSTimer } from './useDSTimer';
export { usePrecheck } from './usePrecheck';
export { usePrecheckExtensions } from './usePrecheckExtensions';
export { useUSBDeviceDetection } from './useUSBDeviceDetection';

