// ============================================================================
// Universal Proctoring System - Services Index
// ============================================================================

export {
  AIProctoringService,
  getAIProctoringService,
  resetAIProctoringService,
  type AIProctoringState,
  type AIProctoringCallbacks,
} from "./aiProctoring";

export {
  TabSwitchService,
  getTabSwitchService,
  resetTabSwitchService,
  type TabSwitchState,
  type TabSwitchCallbacks,
} from "./tabSwitch";

export {
  FullscreenService,
  getFullscreenService,
  resetFullscreenService,
  DEFAULT_FULLSCREEN_CONFIG,
  type FullscreenConfig,
  type FullscreenState,
  type FullscreenCallbacks,
} from "./fullscreen";
