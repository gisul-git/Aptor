import React from "react";

// ============================================
// TYPES & SCHEMA
// ============================================

export interface ProctorSettingsSchema {
  aiProctoring: boolean;
  aiProctoringOptions: {
    multipleFaceDetection: boolean;
    gazeAway: boolean;
    outOfScreen: boolean;
  };
  enforcedDefaults: {
    fullscreen: boolean;
    copyPasteBlock: boolean;
    tabSwitchBlock: boolean;
  };
}

export interface ProctoringSettingsProps {
  value: ProctorSettingsSchema | null;
  onChange: (updatedSettings: ProctorSettingsSchema) => void;
  readOnly?: boolean;
  context?: "assessment" | "dsa" | "custom-mcq";
}

// ============================================
// DEFAULT SETTINGS
// ============================================

export const DEFAULT_PROCTOR_SETTINGS: ProctorSettingsSchema = {
  aiProctoring: true,
  aiProctoringOptions: {
    multipleFaceDetection: true,
    gazeAway: true,
    outOfScreen: true,
  },
  enforcedDefaults: {
    fullscreen: true,
    copyPasteBlock: true,
    tabSwitchBlock: true,
  },
};

// ============================================
// MIGRATION FUNCTION (Old Schema → New Schema)
// ============================================

/**
 * Migrates old proctoring settings schema to new unified schema
 * Handles backward compatibility with old boolean flags
 */
export function migrateProctoringSettings(oldSettings: any): ProctorSettingsSchema {
  // If already in new format, return as-is
  if (oldSettings && typeof oldSettings === 'object' && 'aiProctoring' in oldSettings) {
    // Validate and ensure enforcedDefaults are always true
    return {
      ...oldSettings,
      enforcedDefaults: {
        fullscreen: true, // Always enforced
        copyPasteBlock: true, // Always enforced
        tabSwitchBlock: true, // Always enforced
      },
    };
  }

  // Migrate from old schema
  const old = oldSettings || {};
  
  // Map old flags to new schema
  const hasAnyOldProctoring = 
    old.multiFaceDetection || 
    old.frameMatchRecognition || 
    old.concentrationTracking ||
    old.externalDeviceDetection ||
    old.liveCameraAndScreenMonitoring;

  return {
    aiProctoring: hasAnyOldProctoring || old.multiFaceDetection || false,
    aiProctoringOptions: {
      multipleFaceDetection: old.multiFaceDetection || false,
      gazeAway: old.concentrationTracking || false,
      outOfScreen: old.frameMatchRecognition || false,
    },
    enforcedDefaults: {
      fullscreen: true, // Always enforced
      copyPasteBlock: old.copyPasteBlocking !== false, // Default true, but respect old setting
      tabSwitchBlock: old.tabSwitchDetection !== false, // Default true, but respect old setting
    },
  };
}

// ============================================
// COMPONENT
// ============================================

export default function ProctoringSettings({
  value,
  onChange,
  readOnly = false,
  context = "assessment",
}: ProctoringSettingsProps) {
  // Use default if value is null
  const settings = value || DEFAULT_PROCTOR_SETTINGS;

  const handleChange = (updates: Partial<ProctorSettingsSchema>) => {
    if (readOnly) return;
    onChange({ ...settings, ...updates });
  };

  const handleAIOptionChange = (key: keyof ProctorSettingsSchema["aiProctoringOptions"], checked: boolean) => {
    if (readOnly) return;
    handleChange({
      aiProctoringOptions: {
        ...settings.aiProctoringOptions,
        [key]: checked,
      },
    });
  };


  return (
    <div style={{
      padding: "1.5rem",
      backgroundColor: "#ffffff",
      borderRadius: "0.75rem",
      border: "1px solid #e2e8f0",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{
          margin: 0,
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "#1a1625",
        }}>
          Proctoring Settings
        </h3>
        {readOnly && (
          <span style={{
            display: "inline-block",
            marginLeft: "0.75rem",
            padding: "0.25rem 0.5rem",
            backgroundColor: "#f1f5f9",
            color: "#64748b",
            borderRadius: "0.25rem",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}>
            Read Only
          </span>
        )}
      </div>

      {/* 1️⃣ AI PROCTORING */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          padding: "1rem",
          backgroundColor: settings.aiProctoring ? "#f0f9ff" : "#f8fafc",
          borderRadius: "0.5rem",
          border: `1px solid ${settings.aiProctoring ? "#3b82f6" : "#e2e8f0"}`,
          marginBottom: settings.aiProctoring ? "1rem" : 0,
        }}>
          <input
            type="checkbox"
            id="aiProctoring"
            checked={settings.aiProctoring}
            onChange={(e) => handleChange({ aiProctoring: e.target.checked })}
            disabled={readOnly}
            style={{
              marginTop: "0.25rem",
              width: "18px",
              height: "18px",
              cursor: readOnly ? "not-allowed" : "pointer",
            }}
          />
          <div style={{ flex: 1 }}>
            <label
              htmlFor="aiProctoring"
              style={{
                display: "block",
                fontWeight: 600,
                color: "#1e293b",
                marginBottom: "0.25rem",
                cursor: readOnly ? "default" : "pointer",
              }}
            >
              AI Proctoring
            </label>
            <p style={{ fontSize: "0.875rem", color: "#64748b", margin: 0 }}>
              Automated AI-based monitoring using computer vision and machine learning to detect suspicious behavior.
            </p>
          </div>
        </div>

        {/* AI Proctoring Sub-options */}
        {settings.aiProctoring && (
          <div style={{ paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {/* Multiple Face Detection */}
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.75rem",
              backgroundColor: "#ffffff",
              borderRadius: "0.5rem",
              border: "1px solid #e2e8f0",
            }}>
              <input
                type="checkbox"
                id="multipleFaceDetection"
                checked={settings.aiProctoringOptions.multipleFaceDetection}
                onChange={(e) => handleAIOptionChange("multipleFaceDetection", e.target.checked)}
                disabled={readOnly}
                style={{
                  marginTop: "0.25rem",
                  width: "16px",
                  height: "16px",
                  cursor: readOnly ? "not-allowed" : "pointer",
                }}
              />
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="multipleFaceDetection"
                  style={{
                    display: "block",
                    fontWeight: 500,
                    color: "#1e293b",
                    fontSize: "0.875rem",
                    cursor: readOnly ? "default" : "pointer",
                  }}
                >
                  Multiple Face Detection
                </label>
                <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                  Detects if multiple faces appear in the camera feed.
                </p>
              </div>
            </div>

            {/* Gaze / Look-Away Detection */}
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.75rem",
              backgroundColor: "#ffffff",
              borderRadius: "0.5rem",
              border: "1px solid #e2e8f0",
            }}>
              <input
                type="checkbox"
                id="gazeAway"
                checked={settings.aiProctoringOptions.gazeAway}
                onChange={(e) => handleAIOptionChange("gazeAway", e.target.checked)}
                disabled={readOnly}
                style={{
                  marginTop: "0.25rem",
                  width: "16px",
                  height: "16px",
                  cursor: readOnly ? "not-allowed" : "pointer",
                }}
              />
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="gazeAway"
                  style={{
                    display: "block",
                    fontWeight: 500,
                    color: "#1e293b",
                    fontSize: "0.875rem",
                    cursor: readOnly ? "default" : "pointer",
                  }}
                >
                  Gaze / Look-Away Detection
                </label>
                <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                  Monitors eye movement and detects when candidate looks away from screen.
                </p>
              </div>
            </div>

            {/* Out-of-Screen / No-Face Detection */}
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.75rem",
              backgroundColor: "#ffffff",
              borderRadius: "0.5rem",
              border: "1px solid #e2e8f0",
            }}>
              <input
                type="checkbox"
                id="outOfScreen"
                checked={settings.aiProctoringOptions.outOfScreen}
                onChange={(e) => handleAIOptionChange("outOfScreen", e.target.checked)}
                disabled={readOnly}
                style={{
                  marginTop: "0.25rem",
                  width: "16px",
                  height: "16px",
                  cursor: readOnly ? "not-allowed" : "pointer",
                }}
              />
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="outOfScreen"
                  style={{
                    display: "block",
                    fontWeight: 500,
                    color: "#1e293b",
                    fontSize: "0.875rem",
                    cursor: readOnly ? "default" : "pointer",
                  }}
                >
                  Out-of-Screen / No-Face Detection
                </label>
                <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
                  Detects when candidate's face is not visible or moves out of camera view.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2️⃣ ALWAYS ENABLED SECURITY (READ-ONLY) */}
      <div style={{
        padding: "1rem",
        backgroundColor: "#fef3c7",
        borderRadius: "0.5rem",
        border: "2px solid #fbbf24",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: "#92400e" }}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h4 style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 600,
            color: "#92400e",
          }}>
            Always Enabled Security
          </h4>
          <span style={{
            padding: "0.25rem 0.5rem",
            backgroundColor: "#92400e",
            color: "#ffffff",
            borderRadius: "0.25rem",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}>
            LOCKED
          </span>
        </div>
        <p style={{
          fontSize: "0.875rem",
          color: "#78350f",
          margin: "0 0 0.75rem 0",
        }}>
          These security features are always active and cannot be disabled.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Full-Screen Mode Required */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem",
            backgroundColor: "#ffffff",
            borderRadius: "0.375rem",
          }}>
            <input
              type="checkbox"
              checked={settings.enforcedDefaults.fullscreen}
              disabled
              style={{
                width: "16px",
                height: "16px",
                cursor: "not-allowed",
                opacity: 0.6,
              }}
            />
            <label style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#78350f",
              cursor: "default",
            }}>
              Full-Screen Mode Required
            </label>
          </div>

          {/* Copy/Paste Blocking */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem",
            backgroundColor: "#ffffff",
            borderRadius: "0.375rem",
          }}>
            <input
              type="checkbox"
              checked={settings.enforcedDefaults.copyPasteBlock}
              disabled
              style={{
                width: "16px",
                height: "16px",
                cursor: "not-allowed",
                opacity: 0.6,
              }}
            />
            <label style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#78350f",
              cursor: "default",
            }}>
              Copy/Paste Blocking
            </label>
          </div>

          {/* Tab-Switch Monitoring */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem",
            backgroundColor: "#ffffff",
            borderRadius: "0.375rem",
          }}>
            <input
              type="checkbox"
              checked={settings.enforcedDefaults.tabSwitchBlock}
              disabled
              style={{
                width: "16px",
                height: "16px",
                cursor: "not-allowed",
                opacity: 0.6,
              }}
            />
            <label style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#78350f",
              cursor: "default",
            }}>
              Tab-Switch Monitoring
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

