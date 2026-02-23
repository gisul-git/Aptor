import React from "react";
import type { NetworkMetrics } from "@/hooks/usePrecheck";

interface NetworkTestProps {
  metrics: NetworkMetrics | null;
  isRunning: boolean;
  maxLatencyMs: number;
  minDownloadMbps: number;
}

export function NetworkTest({
  metrics,
  isRunning,
  maxLatencyMs,
  minDownloadMbps,
}: NetworkTestProps) {
  if (!metrics && !isRunning) {
    return null;
  }

  const isConnected = metrics !== null;

  return (
    <div
      style={{
        padding: "0.75rem",
        backgroundColor: isRunning 
          ? "#f8fafc" 
          : isConnected 
          ? "#ecfdf5" 
          : "#fef2f2",
        borderRadius: "0.5rem",
        border: `1px solid ${isRunning ? "#e2e8f0" : isConnected ? "#86efac" : "#fecaca"}`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.375rem",
          marginBottom: "0.5rem",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isRunning ? "#64748b" : isConnected ? "#10b981" : "#ef4444"}
          strokeWidth="2"
        >
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <span style={{ fontSize: "0.875rem", color: isRunning ? "#64748b" : isConnected ? "#065f46" : "#dc2626", fontWeight: 600 }}>
          Internet Connection
        </span>
      </div>
      
      {isRunning ? (
        <div
          style={{
            width: "24px",
            height: "24px",
            margin: "0 auto",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
            style={{ animation: "spin 1s linear infinite" }}
          >
            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
          </svg>
        </div>
      ) : (
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: isConnected ? "#10b981" : "#ef4444",
            lineHeight: 1.5,
          }}
        >
          {isConnected ? "✓ Connected" : "✗ Not Connected"}
        </div>
      )}

      {/* CSS for animation */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default NetworkTest;

