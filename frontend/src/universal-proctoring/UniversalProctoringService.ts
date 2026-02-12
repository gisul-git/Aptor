// ============================================================================
// Universal Proctoring System - Main Orchestrator Service
// ============================================================================
//
// This is the main entry point for the Universal Proctoring System.
// It orchestrates all proctoring services (AI, Tab Switch, Fullscreen)
// based on the proctoring settings from the Create Assessment flow.
//
// USAGE:
//   import { UniversalProctoringService } from '@/universal-proctoring';
//
//   const service = new UniversalProctoringService();
//
//   // Start proctoring
//   await service.startProctoring({
//     settings: { aiProctoringEnabled: true, liveProctoringEnabled: false },
//     session: { userId: '...', assessmentId: '...' },
//     videoElement: videoRef.current,
//   });
//
//   // Stop proctoring
//   service.stopProctoring();
//
// ============================================================================

import {
  ProctoringSettings,
  ProctoringSession,
  ProctoringViolation,
  ProctoringState,
  AIProctoringConfig,
  TabSwitchConfig,
  INITIAL_PROCTORING_STATE,
  DEFAULT_AI_CONFIG,
  DEFAULT_TAB_CONFIG,
} from "./types";

import {
  AIProctoringService,
  AIProctoringState,
  TabSwitchService,
  TabSwitchState,
  FullscreenService,
  FullscreenState,
  FullscreenConfig,
  DEFAULT_FULLSCREEN_CONFIG,
} from "./services";

import { debugLog, setDebugMode } from "./utils";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for starting the proctoring system.
 */
export interface StartProctoringOptions {
  /** Proctoring settings from Create Assessment */
  settings: ProctoringSettings;
  /** Session info (user, assessment) */
  session: ProctoringSession;
  /** Video element for camera feed (required if aiProctoringEnabled) */
  videoElement?: HTMLVideoElement;
  /** Canvas element for snapshots (optional) */
  canvasElement?: HTMLCanvasElement;
  /** Custom AI proctoring config (optional, uses defaults) */
  aiConfig?: Partial<AIProctoringConfig>;
  /** Custom tab switch config (optional, uses defaults) */
  tabConfig?: Partial<TabSwitchConfig>;
  /** Custom fullscreen config (optional, uses defaults) */
  fullscreenConfig?: Partial<FullscreenConfig>;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Callbacks for proctoring events.
 */
export interface ProctoringWarning {
  type: 'FACE_NOT_CLEARLY_VISIBLE';
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ProctoringCallbacks {
  /** Called on any violation */
  onViolation?: (violation: ProctoringViolation) => void;
  /** Called on warnings (non-violation notifications) */
  onWarning?: (warning: ProctoringWarning) => void;
  /** Called when state changes */
  onStateChange?: (state: ProctoringState) => void;
  /** Called when fullscreen is exited */
  onFullscreenExit?: () => void;
}

// ============================================================================
// Universal Proctoring Service Class
// ============================================================================

/**
 * Universal Proctoring Service - main orchestrator.
 *
 * This service manages all proctoring features based on the settings
 * from the Create Assessment flow. It provides a simple API:
 * - startProctoring(options)
 * - stopProctoring()
 *
 * The service:
 * - Reads aiProctoringEnabled to start/stop AI proctoring
 * - Always enables tab switch and fullscreen detection when running
 * - Sends violations to the provided callback and backend
 */
export class UniversalProctoringService {
  // Sub-services
  private aiService: AIProctoringService;
  private tabSwitchService: TabSwitchService;
  private fullscreenService: FullscreenService;

  // Current state
  private state: ProctoringState = { ...INITIAL_PROCTORING_STATE };
  private session: ProctoringSession | null = null;
  private settings: ProctoringSettings | null = null;
  private callbacks: ProctoringCallbacks = {};

  // Violation history
  private violations: ProctoringViolation[] = [];

  constructor() {
    this.aiService = new AIProctoringService();
    this.tabSwitchService = new TabSwitchService();
    this.fullscreenService = new FullscreenService();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Start proctoring with the given options.
   *
   * @param options - Start options including settings, session, and elements
   * @param callbacks - Optional callbacks for violations and state changes
   * @returns Promise<boolean> - true if started successfully
   */
  async startProctoring(
    options: StartProctoringOptions,
    callbacks?: ProctoringCallbacks
  ): Promise<boolean> {
    const { settings, session, videoElement, canvasElement, debug } = options;

    debugLog("UniversalProctoringService: Starting proctoring...", {
      settings,
      session,
    });

    // Set debug mode
    if (debug !== undefined) {
      setDebugMode(debug);
    }

    // Store references
    this.settings = settings;
    this.session = session;
    this.callbacks = callbacks || {};
    this.violations = [];

    // Update initial state
    this.updateState({ isRunning: true, errors: [] });

    // Record proctoring started event
    this.recordSystemViolation("PROCTORING_STARTED", {
      aiProctoringEnabled: settings.aiProctoringEnabled,
      liveProctoringEnabled: settings.liveProctoringEnabled,
    });

    // ========== Start Camera (if either AI or Live enabled) ==========
    // Camera must start when EITHER AI or Live Proctoring is enabled
    const needsCamera = settings.aiProctoringEnabled || settings.liveProctoringEnabled;
    
    if (needsCamera) {
      if (!videoElement) {
        console.error(
          "[UniversalProctoring] Camera proctoring enabled but no video element provided"
        );
        this.updateState({
          errors: [...this.state.errors, "No video element for camera proctoring"],
        });
      } else {
        // ========== Start AI Proctoring (if enabled) ==========
        if (settings.aiProctoringEnabled) {
          const aiConfig = { ...DEFAULT_AI_CONFIG, ...options.aiConfig };
          this.aiService.updateConfig(aiConfig);

          const aiStarted = await this.aiService.start(
            session,
            {
              onViolation: this.handleViolation.bind(this),
              onStateChange: this.handleAIStateChange.bind(this),
              onWarning: this.handleWarning.bind(this),
            },
            videoElement,
            canvasElement
          );

          if (!aiStarted) {
            debugLog("UniversalProctoringService: AI proctoring failed to start");
          }
        } else if (settings.liveProctoringEnabled) {
          // Live-only mode: Reuse camera from pre-check
          debugLog("UniversalProctoringService: Starting camera for Live Proctoring only");
          try {
            // ✅ PHASE 1: Reuse camera from pre-check (NEVER request new permission)
            const existingStream = (typeof window !== 'undefined' && (window as any).__cameraStream) as MediaStream | undefined;
            
            if (existingStream?.active) {
              debugLog("UniversalProctoringService: Reusing camera from window.__cameraStream");
              videoElement.srcObject = existingStream;
              await videoElement.play();
            } else {
              throw new Error("No camera stream available from pre-check. Camera must be captured in pre-check phase.");
            }
            
            debugLog("UniversalProctoringService: Camera started for Live Proctoring");
          } catch (error) {
            console.error("[UniversalProctoring] Failed to start camera for Live Proctoring:", error);
            this.updateState({
              errors: [...this.state.errors, `Camera error: ${(error as Error).message}`],
            });
          }
        }
      }
    }

    // ========== Start Tab Switch Detection (only when AI enabled) ==========
    // Tab/focus enforcement should ONLY run when AI Proctoring is enabled
    // In Live-only mode, candidates need to switch tabs freely without violations
    if (settings.aiProctoringEnabled) {
      const tabConfig = { ...DEFAULT_TAB_CONFIG, ...options.tabConfig };
      this.tabSwitchService.updateConfig(tabConfig);
      this.tabSwitchService.start(session, {
        onViolation: this.handleViolation.bind(this),
        onStateChange: this.handleTabStateChange.bind(this),
      });
      debugLog("UniversalProctoringService: Tab switch detection enabled (AI mode)");
    } else {
      debugLog("UniversalProctoringService: Tab switch detection disabled (Live-only mode)");
    }

    // ========== Start Fullscreen Detection (only when AI enabled) ==========
    // Fullscreen enforcement should ONLY run when AI Proctoring is enabled
    // In Live-only mode, candidates don't need fullscreen and shouldn't see lock overlay
    if (settings.aiProctoringEnabled) {
      const fsConfig = { ...DEFAULT_FULLSCREEN_CONFIG, ...options.fullscreenConfig };
      this.fullscreenService.updateConfig(fsConfig);
      this.fullscreenService.start(session, {
        onViolation: this.handleViolation.bind(this),
        onStateChange: this.handleFullscreenStateChange.bind(this),
        onFullscreenExit: this.callbacks.onFullscreenExit,
      });
      debugLog("UniversalProctoringService: Fullscreen detection enabled (AI mode)");
    } else {
      debugLog("UniversalProctoringService: Fullscreen detection disabled (Live-only mode)");
    }

    debugLog("UniversalProctoringService: Started successfully");
    return true;
  }

  /**
   * Stop all proctoring services.
   */
  stopProctoring(): void {
    debugLog("UniversalProctoringService: Stopping proctoring...");

    // Record proctoring stopped event
    this.recordSystemViolation("PROCTORING_STOPPED", {
      totalViolations: this.violations.length,
    });

    // Stop all services
    this.aiService.stop();
    this.tabSwitchService.stop();
    this.fullscreenService.stop();

    // Reset state
    this.updateState({ ...INITIAL_PROCTORING_STATE });
    this.session = null;
    this.settings = null;

    debugLog("UniversalProctoringService: Stopped");
  }

  /**
   * Get current proctoring state.
   */
  getState(): ProctoringState {
    return { ...this.state };
  }

  /**
   * Get all recorded violations.
   */
  getViolations(): ProctoringViolation[] {
    return [...this.violations];
  }

  /**
   * Get violation count.
   */
  getViolationCount(): number {
    return this.violations.length;
  }

  /**
   * Check if proctoring is running.
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Request fullscreen mode.
   * NOTE: Must be called from user gesture context.
   */
  async requestFullscreen(): Promise<boolean> {
    return this.fullscreenService.requestFullscreen();
  }

  /**
   * Exit fullscreen mode.
   */
  async exitFullscreen(): Promise<void> {
    return this.fullscreenService.exitFullscreen();
  }

  /**
   * Check if currently in fullscreen.
   */
  isFullscreen(): boolean {
    return this.fullscreenService.isCurrentlyFullscreen();
  }

  // ============================================================================
  // Internal Handlers
  // ============================================================================

  /**
   * Handle violations from any service.
   */
  private handleViolation(violation: ProctoringViolation): void {
    debugLog("UniversalProctoringService: Violation received", violation);

    // Store violation
    this.violations.push(violation);

    // Update state
    this.updateState({ lastViolation: violation });

    // Notify callback
    if (this.callbacks.onViolation) {
      this.callbacks.onViolation(violation);
    }

    // Send to backend
    this.sendViolationToBackend(violation);
  }

  /**
   * Handle warnings from AI service (non-violation notifications).
   */
  private handleWarning(warning: ProctoringWarning): void {
    debugLog("UniversalProctoringService: Warning received", warning);

    // Notify callback (warnings are not stored or sent to backend)
    if (this.callbacks.onWarning) {
      this.callbacks.onWarning(warning);
    }
  }

  /**
   * Handle AI service state changes.
   */
  private handleAIStateChange(aiState: Partial<AIProctoringState>): void {
    this.updateState({
      isCameraOn: aiState.isCameraOn ?? this.state.isCameraOn,
      isModelLoaded: aiState.isModelLoaded ?? this.state.isModelLoaded,
      facesCount: aiState.facesCount ?? this.state.facesCount,
      gazeDirection: aiState.gazeDirection ?? this.state.gazeDirection,
      errors: aiState.errors ?? this.state.errors,
    });
  }

  /**
   * Handle tab switch service state changes.
   */
  private handleTabStateChange(_tabState: Partial<TabSwitchState>): void {
    // Tab state doesn't directly map to proctoring state
    // Violations are handled separately
  }

  /**
   * Handle fullscreen service state changes.
   */
  private handleFullscreenStateChange(fsState: Partial<FullscreenState>): void {
    this.updateState({
      isFullscreen: fsState.isFullscreen ?? this.state.isFullscreen,
    });
  }

  /**
   * Record a system-level violation (start/stop events).
   */
  private recordSystemViolation(
    eventType: ProctoringViolation["eventType"],
    metadata?: Record<string, unknown>
  ): void {
    if (!this.session) return;

    // Extract candidate email for metadata (backup for analytics filtering)
    const candidateEmail = this.getCandidateEmail();

    const violation: ProctoringViolation = {
      eventType,
      timestamp: new Date().toISOString(),
      assessmentId: this.session.assessmentId,
      userId: this.session.userId,
      metadata: {
        ...metadata,
        ...(candidateEmail && { candidateEmail }),
      },
    };

    this.violations.push(violation);

    // Send to backend (informational)
    this.sendViolationToBackend(violation);
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

  /**
   * Update internal state and notify callback.
   */
  private updateState(partial: Partial<ProctoringState>): void {
    this.state = { ...this.state, ...partial };

    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(this.state);
    }
  }

  /**
   * Send violation to backend API.
   */
  private async sendViolationToBackend(
    violation: ProctoringViolation
  ): Promise<void> {
    try {
      const response = await fetch("/api/proctor/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(violation),
      });

      if (!response.ok) {
        console.error(
          "[UniversalProctoring] Failed to send violation:",
          response.statusText
        );
      } else {
        debugLog("Violation sent to backend:", violation.eventType);
      }
    } catch (error) {
      console.error("[UniversalProctoring] Error sending violation:", error);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let universalProctoringInstance: UniversalProctoringService | null = null;

/**
 * Get or create the universal proctoring service instance.
 */
export function getUniversalProctoringService(): UniversalProctoringService {
  if (!universalProctoringInstance) {
    universalProctoringInstance = new UniversalProctoringService();
  }
  return universalProctoringInstance;
}

/**
 * Reset the universal proctoring service instance.
 */
export function resetUniversalProctoringService(): void {
  if (universalProctoringInstance) {
    universalProctoringInstance.stopProctoring();
    universalProctoringInstance = null;
  }
}
