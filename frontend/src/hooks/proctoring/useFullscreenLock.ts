// ============================================================================
// Fullscreen Lock Hook (SIMPLIFIED - Violation-Driven)
// ============================================================================
//
// PURPOSE:
// Thin wrapper for fullscreen lock state management.
// The lock state is controlled EXTERNALLY by violation events.
//
// ARCHITECTURE:
// - FULLSCREEN_EXIT violations are the SINGLE SOURCE OF TRUTH
// - This hook ONLY provides:
//   1. isLocked state (controlled by setIsLocked from violation handler)
//   2. requestFullscreen API (to re-enter fullscreen)
//   3. isFullscreen helper (read-only check)
// - NO detection logic (fullscreenchange, visibilitychange, blur, etc.)
// - NO violation emission (violations come from universal-proctoring)
//
// USAGE:
//   const {
//     isLocked,
//     setIsLocked,
//     exitCount,
//     incrementExitCount,
//     requestFullscreen,
//   } = useFullscreenLock();
//
//   // In violation handler:
//   if (violation.eventType === 'FULLSCREEN_EXIT') {
//     setIsLocked(true);
//     incrementExitCount();
//   }
//
//   // In render:
//   <FullscreenLockOverlay
//     isLocked={isLocked}
//     onRequestFullscreen={async () => {
//       const success = await requestFullscreen();
//       if (success) setIsLocked(false);
//       return success;
//     }}
//     exitCount={exitCount}
//   />
//
// ============================================================================

import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface UseFullscreenLockOptions {
  /** Initial lock state (default: false) */
  initialLocked?: boolean;
}

export interface UseFullscreenLockReturn {
  /** Whether the UI should be locked */
  isLocked: boolean;
  /** Set the lock state (call this from violation handler) */
  setIsLocked: (locked: boolean) => void;
  /** Number of times fullscreen was exited */
  exitCount: number;
  /** Increment the exit count (call this from violation handler) */
  incrementExitCount: () => void;
  /** Reset exit count */
  resetExitCount: () => void;
  /** Whether currently in fullscreen (read-only check) */
  isFullscreen: () => boolean;
  /** Request fullscreen mode (must be called from user gesture) */
  requestFullscreen: () => Promise<boolean>;
  /** Exit fullscreen mode */
  exitFullscreen: () => Promise<void>;
  /** Check if browser supports fullscreen API */
  isFullscreenSupported: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

function isCurrentlyFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}

async function requestFullscreenAPI(): Promise<boolean> {
  try {
    const elem = document.documentElement;

    if (elem.requestFullscreen) {
      await elem.requestFullscreen();
    } else if ((elem as any).webkitRequestFullscreen) {
      await (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).mozRequestFullScreen) {
      await (elem as any).mozRequestFullScreen();
    } else if ((elem as any).msRequestFullscreen) {
      await (elem as any).msRequestFullscreen();
    } else {
      console.warn('[useFullscreenLock] Fullscreen API not supported');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[useFullscreenLock] Failed to request fullscreen:', error);
    return false;
  }
}

async function exitFullscreenAPI(): Promise<void> {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      await (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      await (document as any).mozCancelFullScreen();
    } else if ((document as any).msExitFullscreen) {
      await (document as any).msExitFullscreen();
    }
  } catch (error) {
    console.error('[useFullscreenLock] Failed to exit fullscreen:', error);
  }
}

function checkFullscreenSupport(): boolean {
  if (typeof document === 'undefined') return false;
  return !!(
    document.documentElement.requestFullscreen ||
    (document.documentElement as any).webkitRequestFullscreen ||
    (document.documentElement as any).mozRequestFullScreen ||
    (document.documentElement as any).msRequestFullscreen
  );
}

// ============================================================================
// Hook Implementation (SIMPLIFIED - State Only, No Detection)
// ============================================================================

export function useFullscreenLock(
  options: UseFullscreenLockOptions = {}
): UseFullscreenLockReturn {
  const { initialLocked = false } = options;

  // ========== STATE ==========
  // Lock state is controlled EXTERNALLY by violation events
  const [isLocked, setIsLocked] = useState(initialLocked);
  const [exitCount, setExitCount] = useState(0);
  const [isFullscreenSupported] = useState(() => checkFullscreenSupport());

  // ========== PUBLIC API ==========

  const isFullscreen = useCallback((): boolean => {
    return isCurrentlyFullscreen();
  }, []);

  const requestFullscreen = useCallback(async (): Promise<boolean> => {
    console.log('[useFullscreenLock] Requesting fullscreen...');
    const success = await requestFullscreenAPI();
    if (success) {
      console.log('[useFullscreenLock] Fullscreen request successful');
    }
    return success;
  }, []);

  const exitFullscreen = useCallback(async (): Promise<void> => {
    console.log('[useFullscreenLock] Exiting fullscreen...');
    await exitFullscreenAPI();
  }, []);

  const incrementExitCount = useCallback(() => {
    setExitCount(prev => prev + 1);
  }, []);

  const resetExitCount = useCallback(() => {
    setExitCount(0);
  }, []);

  return {
    isLocked,
    setIsLocked,
    exitCount,
    incrementExitCount,
    resetExitCount,
    isFullscreen,
    requestFullscreen,
    exitFullscreen,
    isFullscreenSupported,
  };
}

export default useFullscreenLock;
