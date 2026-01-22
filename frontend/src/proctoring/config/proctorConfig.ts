/**
 * Shared Proctor Configuration
 * 
 * This configuration is used by ALL three platforms:
 * - AI Assessment Platform
 * - Custom MCQ (CSV) Platform
 * - DSA Coding Assessment Platform
 */

export interface ProctorConfig {
  // Face Monitoring
  enableFaceMonitoring: boolean;
  
  // Tab Switch Detection
  enableTabSwitchDetection: boolean;
  
  // Fullscreen Monitoring
  enableFullscreenMonitoring: boolean;
  
  // Copy/Paste Blocking
  enableCopyPasteBlocking: boolean;
  
  // Screen Share Monitoring
  enableScreenShareMonitoring: boolean;
  
  // Extension Detection
  enableExtensionDetection: boolean;
  
  
  // External Device Detection
  enableExternalDeviceDetection: boolean;
  
  // Future features can be added here
}

/**
 * Default proctor configuration
 */
export const defaultProctorConfig: ProctorConfig = {
  enableFaceMonitoring: false,
  enableTabSwitchDetection: false,
  enableFullscreenMonitoring: false,
  enableCopyPasteBlocking: false,
  enableScreenShareMonitoring: false,
  enableExtensionDetection: false,
  enableExternalDeviceDetection: false,
};

/**
 * Convert proctoring settings from backend format to ProctorConfig
 * Supports both old schema (backward compatibility) and new unified schema
 */
export function normalizeProctorConfig(backendSettings: any): ProctorConfig {
  // Check if this is the new unified schema
  const isNewSchema = backendSettings && (
    'aiProctoring' in backendSettings ||
    'enforcedDefaults' in backendSettings
  );

  if (isNewSchema) {
    // New unified schema
    const aiEnabled = backendSettings?.aiProctoring || false;
    const aiOptions = backendSettings?.aiProctoringOptions || {};
    const enforced = backendSettings?.enforcedDefaults || {};

    return {
      enableFaceMonitoring: aiEnabled && (
        aiOptions.multipleFaceDetection ||
        aiOptions.gazeAway ||
        aiOptions.outOfScreen
      ),
      enableTabSwitchDetection: enforced.tabSwitchBlock !== false, // Always enforced
      enableFullscreenMonitoring: enforced.fullscreen !== false, // Always enforced
      enableCopyPasteBlocking: enforced.copyPasteBlock !== false, // Always enforced
      enableScreenShareMonitoring: false, // Not in new schema
      enableExtensionDetection: false, // Not in new schema, can be added later
      enableExternalDeviceDetection: false, // Not in new schema, can be added later
    };
  } else {
    // Old schema (backward compatibility)
    return {
      enableFaceMonitoring: backendSettings?.multiFaceDetection || backendSettings?.frameMatchRecognition || false,
      enableTabSwitchDetection: backendSettings?.tabSwitchDetection || false,
      enableFullscreenMonitoring: backendSettings?.fullscreenMonitoring || false,
      enableCopyPasteBlocking: backendSettings?.copyPasteBlocking || false,
      enableScreenShareMonitoring: backendSettings?.liveCameraAndScreenMonitoring || false,
      enableExtensionDetection: backendSettings?.browserExtensionMonitoring || false,
      enableExternalDeviceDetection: backendSettings?.externalDeviceDetection || false,
    };
  }
}



