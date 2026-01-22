/**
 * Proctoring Store
 * 
 * Manages proctoring-related state using Zustand
 * Handles proctoring session state, violations, and settings
 */

import { create } from 'zustand';
import type { ProctoringViolation } from '@/universal-proctoring/types';

interface ProctoringState {
  // Session state
  isProctoringActive: boolean;
  sessionId: string | null;
  assessmentId: string | null;
  userId: string | null;
  
  // Violations
  violations: ProctoringViolation[];
  lastViolation: ProctoringViolation | null;
  violationCount: number;
  
  // Settings
  aiProctoringEnabled: boolean;
  liveProctoringEnabled: boolean;
  faceMismatchEnabled: boolean;
  
  // Camera state
  isCameraOn: boolean;
  cameraError: string | null;
  
  // Fullscreen state
  isFullscreen: boolean;
  isFullscreenLocked: boolean;
  fullscreenExitCount: number;
  
  // Actions
  startProctoring: (sessionId: string, assessmentId: string, userId: string) => void;
  stopProctoring: () => void;
  addViolation: (violation: ProctoringViolation) => void;
  clearViolations: () => void;
  setProctoringSettings: (settings: {
    aiProctoringEnabled?: boolean;
    liveProctoringEnabled?: boolean;
    faceMismatchEnabled?: boolean;
  }) => void;
  setCameraState: (isOn: boolean, error?: string | null) => void;
  setFullscreenState: (isFullscreen: boolean) => void;
  setFullscreenLocked: (locked: boolean) => void;
  incrementFullscreenExitCount: () => void;
}

export const useProctoringStore = create<ProctoringState>((set) => ({
  // Initial state
  isProctoringActive: false,
  sessionId: null,
  assessmentId: null,
  userId: null,
  violations: [],
  lastViolation: null,
  violationCount: 0,
  aiProctoringEnabled: false,
  liveProctoringEnabled: false,
  faceMismatchEnabled: false,
  isCameraOn: false,
  cameraError: null,
  isFullscreen: false,
  isFullscreenLocked: false,
  fullscreenExitCount: 0,
  
  // Actions
  startProctoring: (sessionId, assessmentId, userId) => set({
    isProctoringActive: true,
    sessionId,
    assessmentId,
    userId,
    violations: [],
    lastViolation: null,
    violationCount: 0,
  }),
  
  stopProctoring: () => set({
    isProctoringActive: false,
    sessionId: null,
    assessmentId: null,
    userId: null,
    isCameraOn: false,
    cameraError: null,
  }),
  
  addViolation: (violation) => set((state) => ({
    violations: [...state.violations, violation],
    lastViolation: violation,
    violationCount: state.violationCount + 1,
  })),
  
  clearViolations: () => set({
    violations: [],
    lastViolation: null,
    violationCount: 0,
  }),
  
  setProctoringSettings: (settings) => set((state) => ({
    aiProctoringEnabled: settings.aiProctoringEnabled ?? state.aiProctoringEnabled,
    liveProctoringEnabled: settings.liveProctoringEnabled ?? state.liveProctoringEnabled,
    faceMismatchEnabled: settings.faceMismatchEnabled ?? state.faceMismatchEnabled,
  })),
  
  setCameraState: (isOn, error = null) => set({
    isCameraOn: isOn,
    cameraError: error,
  }),
  
  setFullscreenState: (isFullscreen) => set({ isFullscreen }),
  
  setFullscreenLocked: (locked) => set({ isFullscreenLocked: locked }),
  
  incrementFullscreenExitCount: () => set((state) => ({
    fullscreenExitCount: state.fullscreenExitCount + 1,
  })),
}));



