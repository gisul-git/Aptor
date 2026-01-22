/**
 * Proctor Violation Bar Component
 * 
 * Displays current proctoring violations and alerts
 */

import React from "react";

export interface ViolationAlert {
  type: string;
  timestamp: string;
  message: string;
  severity: "warning" | "error";
}

export interface ProctorViolationBarProps {
  violations: ViolationAlert[];
  isActive: boolean;
}

export default function ProctorViolationBar({
  violations,
  isActive,
}: ProctorViolationBarProps) {
  if (!isActive || violations.length === 0) {
    return null;
  }

  const latestViolation = violations[violations.length - 1];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: latestViolation.severity === "error" ? "#ef4444" : "#f59e0b",
        color: "#ffffff",
        padding: "0.75rem 1rem",
        zIndex: 9999,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        fontSize: "0.875rem",
        textAlign: "center",
      }}
    >
      <strong>Proctoring Alert:</strong> {latestViolation.message}
    </div>
  );
}



