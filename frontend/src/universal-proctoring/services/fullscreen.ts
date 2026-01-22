// ============================================================================
// Universal Proctoring System - Fullscreen Enforcement Service
// Handles: Fullscreen enter/exit detection, fullscreen requests
// ============================================================================

import {
  ProctoringViolation,
  ProctoringSession,
} from "../types";
import { debugLog, getTimestamp } from "../utils";

// ============================================================================
// Types
// ============================================================================

export interface FullscreenConfig {
  /** Enable fullscreen exit detection */
  enableDetection: boolean;
  /** Automatically request fullscreen on start */
  autoRequestOnStart: boolean;
  /** Request fullscreen again after exit (with user gesture) */
  reRequestAfterExit: boolean;
}

export interface FullscreenState {
  isMonitoring: boolean;
  isFullscreen: boolean;
  exitCount: number;
}

export interface FullscreenCallbacks {
  onViolation: (violation: ProctoringViolation) => void;
  onStateChange: (state: Partial<FullscreenState>) => void;
  /** Called when fullscreen is exited (can be used to show re-enter prompt) */
  onFullscreenExit?: () => void;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_FULLSCREEN_CONFIG: FullscreenConfig = {
  enableDetection: true,
  autoRequestOnStart: false, // Don't auto-request (needs user gesture)
  reRequestAfterExit: false, // Don't auto re-request (needs user gesture)
};

// ============================================================================
// Fullscreen Service Class
// ============================================================================

/**
 * Fullscreen Enforcement Service - monitors fullscreen state.
 * Adapted from useTabSwitchProctor.ts fullscreen detection.
 */
export class FullscreenService {
  private config: FullscreenConfig;
  private session: ProctoringSession | null = null;
  private callbacks: FullscreenCallbacks | null = null;

  // Tracking
  private wasFullscreen: boolean = false;

  // State
  private state: FullscreenState = {
    isMonitoring: false,
    isFullscreen: false,
    exitCount: 0,
  };

  // Bound event handler
  private boundHandleFullscreenChange: () => void;

  constructor(config: Partial<FullscreenConfig> = {}) {
    this.config = { ...DEFAULT_FULLSCREEN_CONFIG, ...config };
    this.boundHandleFullscreenChange = this.handleFullscreenChange.bind(this);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Start fullscreen monitoring.
   * @param session - User and assessment info
   * @param callbacks - Violation and state change handlers
   */
  start(session: ProctoringSession, callbacks: FullscreenCallbacks): void {
    debugLog("FullscreenService: Starting...", { session });

    if (this.state.isMonitoring) {
      debugLog("FullscreenService: Already monitoring");
      return;
    }

    this.session = session;
    this.callbacks = callbacks;

    // Check current fullscreen state
    this.wasFullscreen = this.isCurrentlyFullscreen();
    this.updateState({ isFullscreen: this.wasFullscreen });

    // Attach fullscreen change listeners (cross-browser)
    if (this.config.enableDetection) {
      document.addEventListener(
        "fullscreenchange",
        this.boundHandleFullscreenChange
      );
      document.addEventListener(
        "webkitfullscreenchange",
        this.boundHandleFullscreenChange
      );
      document.addEventListener(
        "mozfullscreenchange",
        this.boundHandleFullscreenChange
      );
      document.addEventListener(
        "MSFullscreenChange",
        this.boundHandleFullscreenChange
      );
    }

    this.updateState({ isMonitoring: true });
    debugLog("FullscreenService: Started");
  }

  /**
   * Stop fullscreen monitoring.
   */
  stop(): void {
    debugLog("FullscreenService: Stopping...");

    // Remove event listeners
    document.removeEventListener(
      "fullscreenchange",
      this.boundHandleFullscreenChange
    );
    document.removeEventListener(
      "webkitfullscreenchange",
      this.boundHandleFullscreenChange
    );
    document.removeEventListener(
      "mozfullscreenchange",
      this.boundHandleFullscreenChange
    );
    document.removeEventListener(
      "MSFullscreenChange",
      this.boundHandleFullscreenChange
    );

    this.session = null;
    this.callbacks = null;
    this.wasFullscreen = false;

    this.updateState({
      isMonitoring: false,
      isFullscreen: false,
      exitCount: 0,
    });

    debugLog("FullscreenService: Stopped");
  }

  /**
   * Request fullscreen mode.
   * NOTE: This must be called from a user gesture (click/keypress) context.
   * @returns Promise that resolves to true if successful
   */
  async requestFullscreen(): Promise<boolean> {
    debugLog("FullscreenService: Requesting fullscreen...");

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
        debugLog("FullscreenService: Fullscreen API not supported");
        return false;
      }

      debugLog("FullscreenService: Fullscreen requested successfully");
      return true;
    } catch (error) {
      console.error("[FullscreenService] Failed to request fullscreen:", error);
      return false;
    }
  }

  /**
   * Exit fullscreen mode.
   */
  async exitFullscreen(): Promise<void> {
    debugLog("FullscreenService: Exiting fullscreen...");

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
      console.error("[FullscreenService] Failed to exit fullscreen:", error);
    }
  }

  /**
   * Check if currently in fullscreen mode.
   */
  isCurrentlyFullscreen(): boolean {
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  }

  /**
   * Get current state.
   */
  getState(): FullscreenState {
    return { ...this.state };
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<FullscreenConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle fullscreen change events.
   */
  private handleFullscreenChange(): void {
    const isFullscreen = this.isCurrentlyFullscreen();

    if (this.wasFullscreen && !isFullscreen) {
      // Exited fullscreen
      this.state.exitCount += 1;
      this.recordViolation("FULLSCREEN_EXIT", {
        totalExits: this.state.exitCount,
      });
      this.updateState({
        isFullscreen: false,
        exitCount: this.state.exitCount,
      });

      // Notify exit callback
      if (this.callbacks?.onFullscreenExit) {
        this.callbacks.onFullscreenExit();
      }
    } else if (!this.wasFullscreen && isFullscreen) {
      // Entered fullscreen - record as enabled (informational, not violation)
      this.recordViolation("FULLSCREEN_ENABLED", {});
      this.updateState({ isFullscreen: true });
    }

    this.wasFullscreen = isFullscreen;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Record a violation/event.
   */
  private recordViolation(
    eventType: ProctoringViolation["eventType"],
    metadata?: Record<string, unknown>
  ): void {
    if (!this.session || !this.callbacks) {
      debugLog("Cannot record violation - no session or callbacks");
      return;
    }

    // Extract candidate email for metadata (backup for analytics filtering)
    const candidateEmail = this.getCandidateEmail();

    const violation: ProctoringViolation = {
      eventType,
      timestamp: getTimestamp(),
      assessmentId: this.session.assessmentId,
      userId: this.session.userId,
      metadata: {
        ...metadata,
        ...(candidateEmail && { candidateEmail }),
      },
    };

    debugLog("Recording violation:", eventType, metadata);

    // Notify callback
    this.callbacks.onViolation(violation);

    // Also call session callback if provided
    if (this.session.onViolation) {
      this.session.onViolation(violation);
    }
  }

  /**
   * Update internal state and notify callback.
   */
  private updateState(partial: Partial<FullscreenState>): void {
    this.state = { ...this.state, ...partial };
    if (this.callbacks) {
      this.callbacks.onStateChange(partial);
    }
  }

  /**
   * Extract candidate email from userId or sessionStorage.
   */
  private getCandidateEmail(): string | null {
    // Extract email from userId if it's in email: format
    if (this.session?.userId?.startsWith('email:')) {
      return this.session.userId.replace('email:', '');
    }

    // Fallback to sessionStorage
    try {
      if (typeof window !== 'undefined') {
        return sessionStorage.getItem('candidateEmail') || null;
      }
    } catch (e) {
      // Ignore sessionStorage errors (SSR or private browsing)
    }

    return null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let fullscreenInstance: FullscreenService | null = null;

/**
 * Get or create the fullscreen service instance.
 */
export function getFullscreenService(
  config?: Partial<FullscreenConfig>
): FullscreenService {
  if (!fullscreenInstance) {
    fullscreenInstance = new FullscreenService(config);
  } else if (config) {
    fullscreenInstance.updateConfig(config);
  }
  return fullscreenInstance;
}

/**
 * Reset the fullscreen service instance.
 */
export function resetFullscreenService(): void {
  if (fullscreenInstance) {
    fullscreenInstance.stop();
    fullscreenInstance = null;
  }
}
