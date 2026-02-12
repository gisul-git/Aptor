import React from "react";
import type { ExtensionScanResult, ExtensionInfo } from "@/hooks/usePrecheckExtensions";

interface ExtensionWarningCardProps {
  scanResult: ExtensionScanResult;
  isScanning: boolean;
  onRescan: () => void;
  onRequestHelp: () => void;
  isRequestingHelp?: boolean;
}

// Simplified - just show extensions without categories since ExtensionInfo doesn't have category

// Disable instructions by browser
const DISABLE_INSTRUCTIONS = {
  chrome: [
    "Open Chrome menu (⋮) → More Tools → Extensions",
    "Find the extension and toggle it OFF or click Remove",
    "Refresh this page and click Re-scan",
  ],
  edge: [
    "Open Edge menu (⋯) → Extensions",
    "Find the extension and toggle it OFF or click Remove",
    "Refresh this page and click Re-scan",
  ],
};

// Instructions for closing remote desktop apps
const REMOTE_DESKTOP_INSTRUCTIONS = {
  anydesk: {
    name: "AnyDesk",
    steps: [
      "Look for AnyDesk icon in system tray (bottom-right corner)",
      "Right-click the icon and select 'Quit' or 'Exit'",
      "Or press Ctrl+Shift+Esc → Find AnyDesk → End Task",
    ],
  },
  teamviewer: {
    name: "TeamViewer", 
    steps: [
      "Look for TeamViewer icon in system tray",
      "Right-click and select 'Exit TeamViewer'",
      "Or press Ctrl+Shift+Esc → Find TeamViewer → End Task",
    ],
  },
  chrome_remote: {
    name: "Chrome Remote Desktop",
    steps: [
      "Go to chrome://apps and disable Chrome Remote Desktop",
      "Or uninstall from chrome://extensions",
    ],
  },
  general: {
    name: "Remote Desktop Apps",
    steps: [
      "Press Ctrl+Shift+Esc to open Task Manager",
      "Look for: AnyDesk, TeamViewer, Parsec, RustDesk, or similar",
      "Select the app and click 'End Task'",
      "Click Re-scan to verify it's closed",
    ],
  },
};

export function ExtensionWarningCard({
  scanResult,
  isScanning,
  onRescan,
  onRequestHelp,
  isRequestingHelp = false,
}: ExtensionWarningCardProps) {
  const extensions = scanResult.details?.extensions || [];
  const hasHighRisk = scanResult.confidence === "high";
  
  if (extensions.length === 0) return null;

  // Detect browser
  const isEdge = typeof navigator !== "undefined" && navigator.userAgent.includes("Edg");
  const instructions = isEdge ? DISABLE_INSTRUCTIONS.edge : DISABLE_INSTRUCTIONS.chrome;

  return (
    <div
      style={{
        backgroundColor: hasHighRisk ? "#fef2f2" : "#fffbeb",
        border: `1px solid ${hasHighRisk ? "#fecaca" : "#fcd34d"}`,
        borderRadius: "0.5rem",
        padding: "1rem",
        marginTop: "1rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "1.25rem" }}>{hasHighRisk ? "⚠️" : "ℹ️"}</span>
        <h4
          style={{
            margin: 0,
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: hasHighRisk ? "#991b1b" : "#92400e",
          }}
        >
          {hasHighRisk ? "High-Risk Extensions Detected" : "Extensions Detected"}
        </h4>
      </div>

      {/* Description */}
      <p
        style={{
          margin: "0 0 0.75rem",
          fontSize: "0.8125rem",
          color: hasHighRisk ? "#991b1b" : "#92400e",
          lineHeight: 1.5,
        }}
      >
        {hasHighRisk
          ? "Screen recording or automation tools were detected. Please disable them before starting the exam to ensure fair assessment conditions."
          : "Some browser extensions were detected. Most are harmless, but disabling unnecessary extensions can improve exam stability."}
      </p>

      {/* Extension List */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "0.375rem",
          padding: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "disc",
            paddingLeft: "1.5rem",
            fontSize: "0.75rem",
            color: "#64748b",
          }}
        >
          {extensions.map((ext: ExtensionInfo) => (
            <li key={ext.id} style={{ marginBottom: "0.25rem" }}>
              {ext.name || ext.id}
              {ext.version && <span style={{ color: "#94a3b8", marginLeft: "0.25rem" }}>(v{ext.version})</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Remote Desktop Instructions - Removed category check since we don't have categories */}
      {false && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.375rem",
            padding: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#991b1b",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            ⚠️ Remote Desktop App Detected - Please Close It
          </p>
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.75rem",
              color: "#dc2626",
            }}
          >
            Remote desktop applications like AnyDesk or TeamViewer allow others to view your screen, which is not permitted during the exam.
          </p>
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.25rem",
              padding: "0.5rem",
            }}
          >
            <p
              style={{
                margin: "0 0 0.375rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#334155",
              }}
            >
              How to close remote desktop apps:
            </p>
            <ol
              style={{
                margin: 0,
                paddingLeft: "1.25rem",
                fontSize: "0.6875rem",
                color: "#64748b",
                lineHeight: 1.6,
              }}
            >
              {REMOTE_DESKTOP_INSTRUCTIONS.general.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Extension Instructions */}
      {hasHighRisk && (
        <div
          style={{
            backgroundColor: "#f8fafc",
            borderRadius: "0.375rem",
            padding: "0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            How to disable extensions ({isEdge ? "Edge" : "Chrome"}):
          </p>
          <ol
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              fontSize: "0.75rem",
              color: "#64748b",
              lineHeight: 1.6,
            }}
          >
            {instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={onRescan}
          disabled={isScanning}
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            backgroundColor: "#f1f5f9",
            color: "#475569",
            border: "1px solid #e2e8f0",
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            cursor: isScanning ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.375rem",
            opacity: isScanning ? 0.7 : 1,
          }}
        >
          {isScanning ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ animation: "spin 1s linear infinite" }}
              >
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
              Scanning...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Re-scan
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onRequestHelp}
          disabled={isRequestingHelp}
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            backgroundColor: hasHighRisk ? "#fef2f2" : "#fffbeb",
            color: hasHighRisk ? "#991b1b" : "#92400e",
            border: `1px solid ${hasHighRisk ? "#fecaca" : "#fcd34d"}`,
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            cursor: isRequestingHelp ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.375rem",
            opacity: isRequestingHelp ? 0.7 : 1,
          }}
        >
          {isRequestingHelp ? (
            "Sending..."
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Request Help
            </>
          )}
        </button>
      </div>

      {/* CSS for spin animation */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ExtensionWarningCard;

