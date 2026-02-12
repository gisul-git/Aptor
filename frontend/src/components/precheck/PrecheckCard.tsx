import React, { useState, useRef, useEffect } from "react";
import type { CheckResult, CheckStatus, CheckType, DeviceInfo } from "@/hooks/usePrecheck";

interface PrecheckCardProps {
  check: CheckResult;
  onRetry: () => void;
  onAction?: () => void;
  actionLabel?: string;
  isRetrying?: boolean;
  // For camera preview
  videoStream?: MediaStream | null;
  // For microphone level
  audioLevel?: number;
  // For device selection
  devices?: DeviceInfo[];
  selectedDevice?: string | null;
  onDeviceChange?: (deviceId: string) => void;
  // Custom content
  children?: React.ReactNode;
}

const statusConfig: Record<CheckStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  pending: {
    color: "#64748b",
    bg: "#f1f5f9",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  running: {
    color: "#3b82f6",
    bg: "#eff6ff",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
      </svg>
    ),
  },
  passed: {
    color: "#10b981",
    bg: "#ecfdf5",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  failed: {
    color: "#ef4444",
    bg: "#fef2f2",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  skipped: {
    color: "#f59e0b",
    bg: "#fffbeb",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
};

const checkTypeIcons: Record<CheckType, React.ReactNode> = {
  camera: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  microphone: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  fullscreen: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  ),
  network: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" />
    </svg>
  ),
  tabSwitch: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
  browser: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
};

const checkTypeLabels: Record<CheckType, string> = {
  camera: "Camera",
  microphone: "Microphone",
  fullscreen: "Fullscreen",
  network: "Network",
  tabSwitch: "Tab Switch Detection",
  browser: "Browser Compatibility",
};

export function PrecheckCard({
  check,
  onRetry,
  onAction,
  actionLabel,
  isRetrying = false,
  videoStream,
  audioLevel = 0,
  devices,
  selectedDevice,
  onDeviceChange,
  children,
}: PrecheckCardProps) {
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const status = statusConfig[check.status];
  
  // Set up video preview
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(console.error);
    }
  }, [videoStream]);
  
  const formattedTime = check.lastChecked 
    ? new Date(check.lastChecked).toLocaleTimeString()
    : null;

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: `2px solid ${status.color}`,
        borderRadius: "0.75rem",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        transition: "all 0.2s",
      }}
      role="region"
      aria-label={`${checkTypeLabels[check.type]} check`}
      aria-live="polite"
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
        {/* Type Icon */}
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "0.5rem",
            backgroundColor: status.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: status.color,
            flexShrink: 0,
          }}
        >
          {checkTypeIcons[check.type]}
        </div>
        
        {/* Title & Status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#1e293b", margin: 0 }}>
              {checkTypeLabels[check.type]}
            </h3>
            {/* Status Badge */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.125rem 0.5rem",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: 600,
                backgroundColor: status.bg,
                color: status.color,
              }}
              role="status"
            >
              <span style={{ width: "16px", height: "16px" }}>{status.icon}</span>
              {check.status.charAt(0).toUpperCase() + check.status.slice(1)}
            </span>
          </div>
          
          {/* Message */}
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: 0, lineHeight: 1.4 }}>
            {check.message}
          </p>
          
          {/* Last checked time */}
          {formattedTime && (
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0.25rem 0 0 0" }}>
              Last checked: {formattedTime}
            </p>
          )}
        </div>
      </div>
      
      {/* Camera Preview */}
      {check.type === "camera" && videoStream && (
        <div
          style={{
            borderRadius: "0.5rem",
            overflow: "hidden",
            backgroundColor: "#000",
            aspectRatio: "16/9",
            maxHeight: "180px",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
            }}
          />
        </div>
      )}
      
      {/* Microphone Level */}
      {check.type === "microphone" && check.status === "passed" && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748b", minWidth: "50px" }}>Level:</span>
          <div
            style={{
              flex: 1,
              height: "8px",
              backgroundColor: "#e2e8f0",
              borderRadius: "4px",
              overflow: "hidden",
            }}
            role="progressbar"
            aria-valuenow={Math.round(audioLevel * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Audio level"
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(audioLevel * 100, 100)}%`,
                backgroundColor: audioLevel > 0.5 ? "#10b981" : audioLevel > 0.1 ? "#f59e0b" : "#ef4444",
                transition: "width 0.1s, background-color 0.3s",
              }}
            />
          </div>
          <span style={{ fontSize: "0.75rem", color: "#64748b", minWidth: "35px" }}>
            {Math.round(audioLevel * 100)}%
          </span>
        </div>
      )}
      
      {/* Network Details */}
      {check.type === "network" && check.details && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
            padding: "0.5rem",
            backgroundColor: "#f8fafc",
            borderRadius: "0.375rem",
          }}
        >
          <div>
            <span style={{ fontSize: "0.6875rem", color: "#64748b", display: "block" }}>Latency</span>
            <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#1e293b" }}>
              {(check.details as any).latencyMs}ms
            </span>
          </div>
          <div>
            <span style={{ fontSize: "0.6875rem", color: "#64748b", display: "block" }}>Download</span>
            <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#1e293b" }}>
              {(check.details as any).downloadSpeedMbps} Mbps
            </span>
          </div>
        </div>
      )}
      
      {/* Browser Details */}
      {check.type === "browser" && check.details && (
        <div
          style={{
            padding: "0.5rem",
            backgroundColor: "#f8fafc",
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
            <span style={{ color: "#64748b" }}>Browser:</span>
            <span style={{ fontWeight: 500, color: "#1e293b" }}>
              {(check.details as any).name} {(check.details as any).version}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b" }}>Secure Context:</span>
            <span style={{ fontWeight: 500, color: (check.details as any).isSecureContext ? "#10b981" : "#f59e0b" }}>
              {(check.details as any).isSecureContext ? "Yes" : "No"}
            </span>
          </div>
        </div>
      )}
      
      {/* Device Selection */}
      {devices && devices.length > 0 && onDeviceChange && (
        <div>
          <label
            htmlFor={`device-select-${check.type}`}
            style={{ fontSize: "0.75rem", color: "#64748b", display: "block", marginBottom: "0.25rem" }}
          >
            Select device:
          </label>
          <select
            id={`device-select-${check.type}`}
            value={selectedDevice || ""}
            onChange={(e) => onDeviceChange(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "0.375rem",
              border: "1px solid #e2e8f0",
              fontSize: "0.875rem",
              backgroundColor: "#ffffff",
              cursor: "pointer",
            }}
            aria-label={`Select ${checkTypeLabels[check.type]} device`}
          >
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Custom Children */}
      {children}
      
      {/* Troubleshooting */}
      {check.troubleshooting && check.troubleshooting.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowTroubleshooting(!showTroubleshooting)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.375rem 0.5rem",
              backgroundColor: "transparent",
              border: "none",
              color: "#3b82f6",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
            aria-expanded={showTroubleshooting}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: showTroubleshooting ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {showTroubleshooting ? "Hide" : "Show"} Troubleshooting
          </button>
          
          {showTroubleshooting && (
            <ul
              style={{
                margin: "0.5rem 0 0 0",
                paddingLeft: "1.25rem",
                fontSize: "0.8125rem",
                color: "#64748b",
                lineHeight: 1.6,
              }}
            >
              {check.troubleshooting.map((step, index) => (
                <li key={index} style={{ marginBottom: "0.25rem" }}>
                  {step}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
        {/* Retry Button */}
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying || check.status === "running"}
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            backgroundColor: isRetrying || check.status === "running" ? "#e2e8f0" : "#f1f5f9",
            color: isRetrying || check.status === "running" ? "#94a3b8" : "#475569",
            border: "1px solid #e2e8f0",
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            cursor: isRetrying || check.status === "running" ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.375rem",
            transition: "background-color 0.2s",
          }}
          aria-label={`Retry ${checkTypeLabels[check.type]} check`}
        >
          {isRetrying || check.status === "running" ? (
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
              Checking...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Retry
            </>
          )}
        </button>
        
        {/* Custom Action Button */}
        {onAction && actionLabel && (
          <button
            type="button"
            onClick={onAction}
            disabled={check.status === "running"}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              backgroundColor: check.status === "running" ? "#e2e8f0" : "#3b82f6",
              color: check.status === "running" ? "#94a3b8" : "#ffffff",
              border: "none",
              borderRadius: "0.375rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: check.status === "running" ? "not-allowed" : "pointer",
              transition: "background-color 0.2s",
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
      
      {/* CSS for animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default PrecheckCard;

