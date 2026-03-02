/**
 * Proctoring Hooks Index
 * 
 * Central export for all proctoring-related hooks
 */

export { useCameraProctor } from './useCameraProctor';
export { useTabSwitchProctor } from './useTabSwitchProctor';
export { useActivityPatternProctor } from './useActivityPatternProctor';
export { useFullscreenLock } from './useFullscreenLock';
export { useProctor } from './useProctor';
export { useProctorPolling } from './useProctorPolling';
export { useSimpleProctor } from './useSimpleProctor';
export { useMultiLiveProctorAdmin } from './useMultiLiveProctorAdmin';
export { useAgoraLiveProctorAdmin } from './useAgoraLiveProctorAdmin';

// Export types
export type {
  CameraProctorEventType,
  CameraProctorViolation,
  FaceBox,
} from './useCameraProctor';

export type {
  ProctorEventType,
} from './useTabSwitchProctor';

export type {
  ActivityPatternEventType,
  ActivityPatternViolation,
  ActivityPatternProctorOptions,
} from './useActivityPatternProctor';

export type {
  UseFullscreenLockReturn,
  UseFullscreenLockOptions,
} from './useFullscreenLock';



