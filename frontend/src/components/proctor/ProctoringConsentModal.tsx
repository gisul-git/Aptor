/**
 * Proctoring Consent Modal
 * 
 * Modal that appears before starting assessment to get user consent
 * for AI and/or Live proctoring.
 */

import React, { useState } from "react";

interface ProctoringConsentModalProps {
  isOpen: boolean;
  onAccept: (consent: boolean) => Promise<boolean>;
  onCancel: () => void;
  aiProctoring: boolean;
  liveProctoring: boolean;
  candidateName?: string;
  isLoading?: boolean;
}

export function ProctoringConsentModal({
  isOpen,
  onAccept,
  onCancel,
  aiProctoring,
  liveProctoring,
  candidateName,
  isLoading = false,
}: ProctoringConsentModalProps) {
  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async () => {
    if (!consentGiven) {
      setError("Please provide consent to continue");
      return;
    }

    setError(null);
    const success = await onAccept(consentGiven);
    if (!success) {
      setError("Failed to start proctoring. Please try again.");
    }
  };

  const hasAnyProctoring = aiProctoring || liveProctoring;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "1rem",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          padding: "2rem",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#1a1625",
            marginBottom: "1rem",
          }}
        >
          Proctoring Consent Required
        </h2>

        {candidateName && (
          <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
            Hello, {candidateName}
          </p>
        )}

        <p style={{ color: "#1e293b", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          This assessment uses proctoring to ensure exam integrity. Please review the
          proctoring methods that will be active during your assessment:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
          {aiProctoring && (
            <div
              style={{
                padding: "1rem",
                backgroundColor: "#f8fafc",
                borderRadius: "0.5rem",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontWeight: 600, color: "#1e293b", marginBottom: "0.5rem" }}>
                AI Proctoring
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
                Browser-based AI detection including multiple-face detection, gaze-away detection,
                and tab switching tracking. Snapshots will be captured and stored whenever a
                violation occurs.
              </p>
            </div>
          )}

          {liveProctoring && (
            <div
              style={{
                padding: "1rem",
                backgroundColor: "#f8fafc",
                borderRadius: "0.5rem",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontWeight: 600, color: "#1e293b", marginBottom: "0.5rem" }}>
                Live Proctoring
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
                Continuous webcam and full-screen streaming to the Admin Live Proctoring panel.
                Admin can watch but cannot stop or interrupt your session.
              </p>
            </div>
          )}
        </div>

        {!hasAnyProctoring && (
          <p style={{ color: "#64748b", marginBottom: "1.5rem", fontStyle: "italic" }}>
            No proctoring is enabled for this assessment.
          </p>
        )}

        <div
          style={{
            padding: "1rem",
            backgroundColor: "#fef2f2",
            borderRadius: "0.5rem",
            border: "1px solid #fecaca",
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ fontSize: "0.875rem", color: "#991b1b", margin: 0, lineHeight: 1.6 }}>
            <strong>Important:</strong> By proceeding, you consent to the proctoring methods
            described above. Your camera {liveProctoring ? "and screen" : ""} will be monitored
            during the assessment. Violations will be recorded and may affect your assessment
            results.
          </p>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => {
                setConsentGiven(e.target.checked);
                setError(null);
              }}
              style={{
                marginTop: "0.25rem",
                width: "20px",
                height: "20px",
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: "0.95rem", color: "#1e293b", lineHeight: 1.6 }}>
              I understand and consent to the proctoring methods described above. I agree to
              allow camera {liveProctoring ? "and screen" : ""} monitoring during this assessment.
            </span>
          </label>
        </div>

        {error && (
          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "#fef2f2",
              borderRadius: "0.5rem",
              border: "1px solid #fecaca",
              marginBottom: "1rem",
            }}
          >
            <p style={{ color: "#dc2626", margin: 0, fontSize: "0.875rem" }}>{error}</p>
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#f1f5f9",
              color: "#475569",
              border: "none",
              borderRadius: "0.5rem",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: 600,
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={isLoading || !consentGiven}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: consentGiven && !isLoading ? "#6953a3" : "#cbd5e1",
              color: "#ffffff",
              border: "none",
              borderRadius: "0.5rem",
              cursor: consentGiven && !isLoading ? "pointer" : "not-allowed",
              fontWeight: 600,
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "Starting camera..." : "Start Assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}

