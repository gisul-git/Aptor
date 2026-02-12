import React from "react";

interface FullscreenWarningBannerProps {
  isVisible: boolean;
  onEnterFullscreen?: () => void;
}

/**
 * Persistent banner shown when candidate refused fullscreen mode.
 */
export function FullscreenWarningBanner({ isVisible, onEnterFullscreen }: FullscreenWarningBannerProps) {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fef3c7",
        borderBottom: "2px solid #f59e0b",
        padding: "0.5rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        zIndex: 9999,
        fontSize: "0.875rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#92400e" }}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>
          <strong>Not in fullscreen mode.</strong> All activity is being monitored.
        </span>
      </div>

      {onEnterFullscreen && (
        <button
          type="button"
          onClick={onEnterFullscreen}
          style={{
            backgroundColor: "#f59e0b",
            color: "#ffffff",
            border: "none",
            borderRadius: "0.375rem",
            padding: "0.375rem 0.75rem",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Enter Fullscreen
        </button>
      )}
    </div>
  );
}

export default FullscreenWarningBanner;

