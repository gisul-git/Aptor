// ============================================================================
// Universal Proctoring System - Tab Switch Detection Service
// Handles: Tab switches, window blur/focus, visibility changes
// ============================================================================

import {
  TabSwitchConfig,
  DEFAULT_TAB_CONFIG,
  ProctoringViolation,
  ProctoringSession,
} from "../types";
import { debugLog, getTimestamp } from "../utils";

// ============================================================================
// Types
// ============================================================================

export interface TabSwitchState {
  isMonitoring: boolean;
  tabSwitchCount: number;
  focusLostCount: number;
}

export interface TabSwitchCallbacks {
  onViolation: (violation: ProctoringViolation) => void;
  onStateChange: (state: Partial<TabSwitchState>) => void;
}

// ============================================================================
// Tab Switch Detection Service Class
// ============================================================================

/**
 * Tab Switch Detection Service - monitors tab switches and focus loss.
 * Adapted from useTabSwitchProctor.ts with preserved logic.
 */
export class TabSwitchService {
  private config: TabSwitchConfig;
  private session: ProctoringSession | null = null;
  private callbacks: TabSwitchCallbacks | null = null;

  // Tracking
  private isBlurred: boolean = false;

  // State
  private state: TabSwitchState = {
    isMonitoring: false,
    tabSwitchCount: 0,
    focusLostCount: 0,
  };

  // Bound event handlers (for cleanup)
  private boundHandleVisibilityChange: () => void;
  private boundHandleWindowBlur: () => void;
  private boundHandleWindowFocus: () => void;

  constructor(config: Partial<TabSwitchConfig> = {}) {
    this.config = { ...DEFAULT_TAB_CONFIG, ...config };

    // Bind handlers
    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.boundHandleWindowBlur = this.handleWindowBlur.bind(this);
    this.boundHandleWindowFocus = this.handleWindowFocus.bind(this);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Start tab switch monitoring.
   * @param session - User and assessment info
   * @param callbacks - Violation and state change handlers
   */
  start(session: ProctoringSession, callbacks: TabSwitchCallbacks): void {
    debugLog("TabSwitchService: Starting...", { session });

    if (this.state.isMonitoring) {
      debugLog("TabSwitchService: Already monitoring");
      return;
    }

    this.session = session;
    this.callbacks = callbacks;
    this.isBlurred = false;

    // Attach event listeners
    if (this.config.enableTabSwitchDetection) {
      document.addEventListener(
        "visibilitychange",
        this.boundHandleVisibilityChange
      );
    }

    if (this.config.enableFocusDetection) {
      window.addEventListener("blur", this.boundHandleWindowBlur);
      window.addEventListener("focus", this.boundHandleWindowFocus);
    }

    this.updateState({ isMonitoring: true });
    debugLog("TabSwitchService: Started");
  }

  /**
   * Stop tab switch monitoring.
   */
  stop(): void {
    debugLog("TabSwitchService: Stopping...");

    // Remove event listeners
    document.removeEventListener(
      "visibilitychange",
      this.boundHandleVisibilityChange
    );
    window.removeEventListener("blur", this.boundHandleWindowBlur);
    window.removeEventListener("focus", this.boundHandleWindowFocus);

    this.session = null;
    this.callbacks = null;
    this.isBlurred = false;

    this.updateState({
      isMonitoring: false,
      tabSwitchCount: 0,
      focusLostCount: 0,
    });

    debugLog("TabSwitchService: Stopped");
  }

  /**
   * Get current state.
   */
  getState(): TabSwitchState {
    return { ...this.state };
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<TabSwitchConfig>): void {
    const wasMonitoring = this.state.isMonitoring;
    
    if (wasMonitoring) {
      // Temporarily stop to re-apply config
      const savedSession = this.session;
      const savedCallbacks = this.callbacks;
      this.stop();
      this.config = { ...this.config, ...config };
      if (savedSession && savedCallbacks) {
        this.start(savedSession, savedCallbacks);
      }
    } else {
      this.config = { ...this.config, ...config };
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle visibility change (tab switching).
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // Tab became hidden - record violation
      this.state.tabSwitchCount += 1;
      this.recordViolation("TAB_SWITCH", {
        totalSwitches: this.state.tabSwitchCount,
      });
      this.isBlurred = true;
      this.updateState({ tabSwitchCount: this.state.tabSwitchCount });
    } else {
      this.isBlurred = false;
    }
  }

  /**
   * Handle window blur (window loses focus).
   */
  private handleWindowBlur(): void {
    // Only record if not already tracked by visibility change
    // This handles cases like switching to another app on desktop
    if (!document.hidden && !this.isBlurred) {
      this.state.focusLostCount += 1;
      this.recordViolation("FOCUS_LOST", {
        totalFocusLost: this.state.focusLostCount,
      });
      this.isBlurred = true;
      this.updateState({ focusLostCount: this.state.focusLostCount });
    }
  }

  /**
   * Handle window focus (window regains focus).
   */
  private handleWindowFocus(): void {
    this.isBlurred = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Record a violation event.
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
  private updateState(partial: Partial<TabSwitchState>): void {
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

let tabSwitchInstance: TabSwitchService | null = null;

/**
 * Get or create the tab switch service instance.
 */
export function getTabSwitchService(
  config?: Partial<TabSwitchConfig>
): TabSwitchService {
  if (!tabSwitchInstance) {
    tabSwitchInstance = new TabSwitchService(config);
  } else if (config) {
    tabSwitchInstance.updateConfig(config);
  }
  return tabSwitchInstance;
}

/**
 * Reset the tab switch service instance.
 */
export function resetTabSwitchService(): void {
  if (tabSwitchInstance) {
    tabSwitchInstance.stop();
    tabSwitchInstance = null;
  }
}
