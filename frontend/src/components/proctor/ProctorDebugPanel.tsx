import React from "react";
import type { ProctorViolation } from "@/hooks/proctoring/useProctor";

interface ProctorDebugPanelProps {
  isVisible: boolean;
  violations: ProctorViolation[];
  isFullscreen: boolean;
  fullscreenRefused: boolean;
  onSimulateTabSwitch: () => void;
  onSimulateFullscreenExit: () => void;
  onRequestFullscreen: () => void;
  onExitFullscreen: () => void;
}

/**
 * Debug panel for testing proctoring features.
 * Only shown when debug mode is enabled via query param or env var.
 */
export function ProctorDebugPanel({
  isVisible,
  violations,
  isFullscreen,
  fullscreenRefused,
  onSimulateTabSwitch,
  onSimulateFullscreenExit,
  onRequestFullscreen,
  onExitFullscreen,
}: ProctorDebugPanelProps) {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1rem",
        right: "1rem",
        width: "300px",
        backgroundColor: "#1e293b",
        color: "#e2e8f0",
        borderRadius: "0.75rem",
        padding: "1rem",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        zIndex: 9998,
        fontSize: "0.75rem",
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
          paddingBottom: "0.5rem",
          borderBottom: "1px solid #475569",
        }}
      >
        <span style={{ fontWeight: 700, color: "#fbbf24" }}>🔧 Proctor Debug</span>
        <span
          style={{
            backgroundColor: "#10b981",
            color: "#ffffff",
            padding: "0.125rem 0.5rem",
            borderRadius: "9999px",
            fontSize: "0.625rem",
            fontWeight: 600,
          }}
        >
          DEV
        </span>
      </div>

      {/* Status */}
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <span style={{ color: "#94a3b8" }}>Fullscreen:</span>
          <span style={{ color: isFullscreen ? "#10b981" : "#ef4444" }}>
            {isFullscreen ? "Yes" : "No"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <span style={{ color: "#94a3b8" }}>Refused Fullscreen:</span>
          <span style={{ color: fullscreenRefused ? "#ef4444" : "#10b981" }}>
            {fullscreenRefused ? "Yes" : "No"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#94a3b8" }}>Violations:</span>
          <span style={{ color: violations.length > 0 ? "#ef4444" : "#10b981" }}>
            {violations.length}
          </span>
        </div>
      </div>

      {/* Simulate buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <button
          type="button"
          onClick={onSimulateTabSwitch}
          style={{
            backgroundColor: "#3b82f6",
            color: "#ffffff",
            border: "none",
            borderRadius: "0.375rem",
            padding: "0.5rem",
            fontSize: "0.6875rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Simulate TAB_SWITCH
        </button>
        <button
          type="button"
          onClick={onSimulateFullscreenExit}
          style={{
            backgroundColor: "#8b5cf6",
            color: "#ffffff",
            border: "none",
            borderRadius: "0.375rem",
            padding: "0.5rem",
            fontSize: "0.6875rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Simulate FULLSCREEN_EXIT
        </button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={onRequestFullscreen}
            style={{
              flex: 1,
              backgroundColor: "#10b981",
              color: "#ffffff",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.5rem",
              fontSize: "0.6875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Enter FS
          </button>
          <button
            type="button"
            onClick={onExitFullscreen}
            style={{
              flex: 1,
              backgroundColor: "#ef4444",
              color: "#ffffff",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.5rem",
              fontSize: "0.6875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Exit FS
          </button>
        </div>
      </div>

      {/* Recent violations */}
      {violations.length > 0 && (
        <div>
          <div
            style={{
              color: "#94a3b8",
              marginBottom: "0.375rem",
              fontSize: "0.625rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Recent Events
          </div>
          <div
            style={{
              maxHeight: "100px",
              overflowY: "auto",
              backgroundColor: "#0f172a",
              borderRadius: "0.375rem",
              padding: "0.5rem",
            }}
          >
            {violations.slice(-5).reverse().map((v, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.25rem",
                  fontSize: "0.625rem",
                }}
              >
                <span style={{ color: "#fbbf24" }}>{v.eventType}</span>
                <span style={{ color: "#64748b" }}>
                  {new Date(v.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProctorDebugPanel;

