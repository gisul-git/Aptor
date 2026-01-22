import React, { useEffect, useRef, useState } from "react";

interface FullscreenPromptProps {
  isOpen: boolean;
  onEnterFullscreen: () => void;
  onFullscreenFailed?: () => void;
  candidateName?: string;
  isLoading?: boolean;
}

/**
 * Mandatory fullscreen modal - the exam cannot start until fullscreen is entered.
 * No option to continue without fullscreen.
 */
export function FullscreenPrompt({
  isOpen,
  onEnterFullscreen,
  onFullscreenFailed,
  candidateName,
  isLoading = false,
}: FullscreenPromptProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const enterButtonRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // Focus the enter fullscreen button when modal opens
  useEffect(() => {
    if (isOpen && enterButtonRef.current) {
      enterButtonRef.current.focus();
    }
  }, [isOpen]);

  // Prevent ESC from closing modal - fullscreen is mandatory
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block ESC from closing the modal
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  const handleEnterClick = async () => {
    setError(null);
    
    try {
      onEnterFullscreen();
    } catch (err) {
      handleFullscreenError();
    }
  };

  const handleFullscreenError = () => {
    setRetryCount((prev) => prev + 1);
    setError("Unable to enter fullscreen. Please try again.");
    
    if (retryCount >= 2) {
      setShowHelp(true);
    }
    
    onFullscreenFailed?.();
  };

  // Called from parent when fullscreen request fails
  useEffect(() => {
    // This allows parent to trigger error state
  }, []);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "1rem",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fullscreen-prompt-title"
      // Prevent clicking outside from dismissing
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          maxWidth: "520px",
          width: "100%",
          padding: "2rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          style={{
            width: "72px",
            height: "72px",
            backgroundColor: error ? "#fef2f2" : "#eff6ff",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
          }}
        >
          {error ? (
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </div>

        {/* Title */}
        <h2
          id="fullscreen-prompt-title"
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: error ? "#dc2626" : "#1e293b",
            textAlign: "center",
            marginBottom: "0.75rem",
          }}
        >
          {error ? "Fullscreen Required" : "Enter Fullscreen Mode"}
        </h2>

        {/* Greeting */}
        {candidateName && !error && (
          <p
            style={{
              textAlign: "center",
              color: "#64748b",
              marginBottom: "1rem",
              fontSize: "0.9375rem",
            }}
          >
            Welcome, <strong>{candidateName}</strong>!
          </p>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.5rem",
              padding: "1rem",
              marginBottom: "1rem",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, color: "#dc2626", fontSize: "0.875rem", fontWeight: 500 }}>
              {error}
            </p>
          </div>
        )}

        {/* Description */}
        <p
          style={{
            textAlign: "center",
            color: "#475569",
            marginBottom: "1.5rem",
            lineHeight: 1.6,
            fontSize: "0.9375rem",
          }}
        >
          {error
            ? "This assessment requires fullscreen mode. Please click the button below to try again."
            : "This assessment requires fullscreen mode for proctoring purposes. Click the button below to enter fullscreen and begin your exam."}
        </p>

        {/* Info box */}
        <div
          style={{
            backgroundColor: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: "0.5rem",
            padding: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d97706"
              strokeWidth="2"
              style={{ flexShrink: 0, marginTop: "2px" }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div style={{ fontSize: "0.875rem", color: "#92400e", lineHeight: 1.5 }}>
              <strong>Important:</strong> You must stay in fullscreen mode throughout the exam. 
              Tab switches, window changes, and exiting fullscreen will be recorded.
            </div>
          </div>
        </div>

        {/* Help section - shown after multiple failures */}
        {showHelp && (
          <div
            style={{
              backgroundColor: "#f0f9ff",
              border: "1px solid #7dd3fc",
              borderRadius: "0.5rem",
              padding: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#0369a1" }}>
              Troubleshooting Fullscreen Issues
            </h4>
            <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8125rem", color: "#0c4a6e", lineHeight: 1.6 }}>
              <li style={{ marginBottom: "0.25rem" }}>Make sure pop-ups are not blocked for this site</li>
              <li style={{ marginBottom: "0.25rem" }}>Try pressing <strong>F11</strong> to enter fullscreen manually</li>
              <li style={{ marginBottom: "0.25rem" }}>Use Chrome, Firefox, or Edge for best compatibility</li>
              <li style={{ marginBottom: "0.25rem" }}>On mobile, rotate your device to landscape mode</li>
              <li>If issues persist, contact your assessment administrator</li>
            </ul>
          </div>
        )}

        {/* Enter Fullscreen Button - only action available */}
        <button
          ref={enterButtonRef}
          type="button"
          onClick={handleEnterClick}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "1rem 1.5rem",
            backgroundColor: error ? "#dc2626" : "#3b82f6",
            color: "#ffffff",
            border: "none",
            borderRadius: "0.5rem",
            fontSize: "1.0625rem",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            transition: "background-color 0.2s",
            opacity: isLoading ? 0.7 : 1,
          }}
          onMouseOver={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = error ? "#b91c1c" : "#2563eb";
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = error ? "#dc2626" : "#3b82f6";
          }}
        >
          {isLoading ? (
            <>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ animation: "spin 1s linear infinite" }}
              >
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
              Entering Fullscreen...
            </>
          ) : (
            <>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
              {error ? "Try Again" : "Enter Fullscreen"}
            </>
          )}
        </button>

        {/* Show help link after first failure */}
        {retryCount > 0 && !showHelp && (
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            style={{
              width: "100%",
              marginTop: "0.75rem",
              padding: "0.5rem",
              backgroundColor: "transparent",
              color: "#3b82f6",
              border: "none",
              fontSize: "0.875rem",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Having trouble? Click here for help
          </button>
        )}

        {/* Mandatory notice */}
        <p
          style={{
            textAlign: "center",
            color: "#94a3b8",
            fontSize: "0.75rem",
            marginTop: "1rem",
          }}
        >
          Fullscreen mode is mandatory to start this assessment
        </p>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default FullscreenPrompt;
