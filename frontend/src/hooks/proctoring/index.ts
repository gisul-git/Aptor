/**
 * Proctoring Hooks Index
 * 
 * Central export for all proctoring-related hooks
 */

export { useCameraProctor } from './useCameraProctor';
export { useTabSwitchProctor } from './useTabSwitchProctor';
export { useFullscreenLock } from './useFullscreenLock';
export { useProctor } from './useProctor';
export { useProctorPolling } from './useProctorPolling';
export { useSimpleProctor } from './useSimpleProctor';
export { useMultiLiveProctorAdmin } from './useMultiLiveProctorAdmin';

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
  UseFullscreenLockReturn,
  UseFullscreenLockOptions,
} from './useFullscreenLock';



