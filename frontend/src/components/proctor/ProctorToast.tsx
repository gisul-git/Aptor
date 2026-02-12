import React, { useEffect, useState, useRef } from "react";
import type { ProctorViolation } from "@/hooks/proctoring/useProctor";

interface ProctorToastProps {
  violation: ProctorViolation | null;
  duration?: number;
  onDismiss?: () => void;
}

// Human-readable messages for each event type
const EVENT_MESSAGES: Record<string, { title: string; message: string }> = {
  TAB_SWITCH: { title: "Tab Switch", message: "You switched to another tab" },
  FOCUS_LOST: { title: "Focus Lost", message: "Window focus was lost" },
  FULLSCREEN_EXIT: { title: "Fullscreen Exit", message: "You exited fullscreen mode" },
  FULLSCREEN_ENABLED: { title: "Fullscreen", message: "Fullscreen mode enabled" },
  FULLSCREEN_REFUSED: { title: "Fullscreen", message: "Fullscreen was declined" },
  COPY_RESTRICT: { title: "Copy Blocked", message: "Copy attempt was blocked" },
  PASTE_ATTEMPT: { title: "Paste Blocked", message: "Paste attempt was blocked" },
  RIGHT_CLICK: { title: "Right Click", message: "Right-click was blocked" },
  DEVTOOLS_OPEN: { title: "Dev Tools", message: "Developer tools detected" },
  SCREENSHOT_ATTEMPT: { title: "Screenshot", message: "Screenshot attempt detected" },
  IDLE: { title: "Idle", message: "Idle timeout detected" },
  GAZE_AWAY: { title: "Gaze Away", message: "You looked away from screen" },
  MULTI_FACE: { title: "Multiple Faces", message: "Multiple faces detected" },
  SPOOF_DETECTED: { title: "Spoof Alert", message: "Possible spoof detected" },
  NO_FACE: { title: "No Face", message: "No face detected in frame" },
  FACE_MISMATCH: { title: "Face Mismatch", message: "Face doesn't match verified identity" },
};

// Colors for different event severity
const getEventSeverity = (eventType: string): "warning" | "error" | "info" => {
  switch (eventType) {
    case "FULLSCREEN_ENABLED":
      return "info";
    case "FOCUS_LOST":
    case "FULLSCREEN_REFUSED":
    case "GAZE_AWAY":
    case "NO_FACE":
      return "warning";
    case "FACE_MISMATCH":
    case "SPOOF_DETECTED":
    case "MULTI_FACE":
      return "error";
    default:
      return "error";
  }
};

// Get icon for event type
const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case "GAZE_AWAY":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      );
    case "MULTI_FACE":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "NO_FACE":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 15h8" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      );
    case "TAB_SWITCH":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
        </svg>
      );
    case "FACE_MISMATCH":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
          <line x1="18" y1="8" x2="23" y2="13" />
          <line x1="23" y1="8" x2="18" y2="13" />
        </svg>
      );
    case "SPOOF_DETECTED":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
};

const SEVERITY_STYLES = {
  info: {
    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    border: "#3b82f6",
    text: "#1e40af",
    icon: "#3b82f6",
    glow: "0 0 20px rgba(59, 130, 246, 0.3)",
  },
  warning: {
    background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
    border: "#f59e0b",
    text: "#92400e",
    icon: "#f59e0b",
    glow: "0 0 20px rgba(245, 158, 11, 0.3)",
  },
  error: {
    background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
    border: "#ef4444",
    text: "#991b1b",
    icon: "#ef4444",
    glow: "0 0 20px rgba(239, 68, 68, 0.3)",
  },
};

/**
 * Toast notification component that shows when proctoring events occur.
 * Fixed position at top-right corner with auto-dismiss animation.
 */
export function ProctorToast({ violation, duration = 3000, onDismiss }: ProctorToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [currentViolation, setCurrentViolation] = useState<ProctorViolation | null>(null);
  const [violationKey, setViolationKey] = useState<string>("");
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (violation) {
      // Create unique key from timestamp to detect new violations
      const newKey = `${violation.eventType}-${violation.timestamp}`;
      
      // Clear any existing timers
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      
      setCurrentViolation(violation);
      setViolationKey(newKey);
      setIsExiting(false);
      setIsVisible(true);

      // Start dismiss timer
      dismissTimerRef.current = setTimeout(() => {
        setIsExiting(true);
        
        // Actually hide after exit animation completes
        exitTimerRef.current = setTimeout(() => {
          setIsVisible(false);
          setIsExiting(false);
          setCurrentViolation(null);
          onDismiss?.();
        }, 300);
      }, duration);
    }
    
    // Cleanup on unmount
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [violation?.timestamp, violation?.eventType, duration, onDismiss]);

  if (!isVisible || !currentViolation) return null;

  const severity = getEventSeverity(currentViolation.eventType);
  const styles = SEVERITY_STYLES[severity];
  const eventInfo = EVENT_MESSAGES[currentViolation.eventType] || { 
    title: currentViolation.eventType, 
    message: "Event detected" 
  };

  return (
    <div
      key={violationKey}
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 10001,
        maxWidth: "320px",
        width: "100%",
        animation: isExiting ? "toastSlideOut 0.3s ease-in forwards" : "toastSlideIn 0.3s ease-out",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          background: styles.background,
          borderLeft: `4px solid ${styles.border}`,
          borderRadius: "0.5rem",
          padding: "0.875rem 1rem",
          boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.15), ${styles.glow}`,
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Icon */}
        <div 
          style={{ 
            flexShrink: 0, 
            color: styles.icon,
            backgroundColor: `${styles.icon}15`,
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {getEventIcon(currentViolation.eventType)}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ 
            margin: 0, 
            color: styles.text, 
            fontSize: "0.8125rem", 
            fontWeight: 700, 
            lineHeight: 1.3,
            textTransform: "uppercase",
            letterSpacing: "0.025em",
          }}>
            {eventInfo.title}
          </p>
          <p style={{ 
            margin: "0.25rem 0 0", 
            color: styles.text, 
            fontSize: "0.8125rem", 
            opacity: 0.85,
            lineHeight: 1.4,
          }}>
            {eventInfo.message}
          </p>
        </div>

        {/* Progress bar showing time remaining */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "3px",
            backgroundColor: `${styles.border}30`,
            borderRadius: "0 0 0.5rem 0.5rem",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              backgroundColor: styles.border,
              animation: `shrink ${duration}ms linear forwards`,
            }}
          />
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(100%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        @keyframes toastSlideOut {
          from {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateX(100%) scale(0.95);
          }
        }
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}

export default ProctorToast;

