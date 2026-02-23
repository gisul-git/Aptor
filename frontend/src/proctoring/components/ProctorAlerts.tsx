/**
 * Proctor Alerts Component
 * 
 * Displays proctoring alerts and notifications
 */

import React from "react";

export interface ProctorAlert {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  severity: "info" | "warning" | "error";
}

export interface ProctorAlertsProps {
  alerts: ProctorAlert[];
  onDismiss?: (alertId: string) => void;
}

export default function ProctorAlerts({ alerts, onDismiss }: ProctorAlertsProps) {
  if (alerts.length === 0) {
    return null;
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "error":
        return {
          backgroundColor: "#fee2e2",
          borderColor: "#ef4444",
          color: "#991b1b",
        };
      case "warning":
        return {
          backgroundColor: "#fef3c7",
          borderColor: "#f59e0b",
          color: "#92400e",
        };
      default:
        return {
          backgroundColor: "#dbeafe",
          borderColor: "#3b82f6",
          color: "#1e40af",
        };
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 10000,
        maxWidth: "400px",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {alerts.map((alert) => {
        const styles = getSeverityStyles(alert.severity);
        return (
          <div
            key={alert.id}
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: `1px solid ${styles.borderColor}`,
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              fontSize: "0.875rem",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                {alert.type}
              </div>
              <div>{alert.message}</div>
            </div>
            {onDismiss && (
              <button
                onClick={() => onDismiss(alert.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: styles.color,
                  cursor: "pointer",
                  fontSize: "1.25rem",
                  padding: "0.25rem 0.5rem",
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}



