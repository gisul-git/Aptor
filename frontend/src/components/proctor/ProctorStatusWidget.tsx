import React, { useState, useEffect, useRef } from "react";
import type { GazeDirection, CameraProctorViolation } from "@/hooks/proctoring/useCameraProctor";

interface ProctorStatusWidgetProps {
  isCameraOn: boolean;
  isModelLoaded: boolean;
  facesCount: number;
  gazeDirection: GazeDirection | null;
  lastViolation: CameraProctorViolation | null;
  errors: string[];
  debugMode?: boolean;
  debugInfo?: {
    fps: number;
    lastDetectionTime: number;
    faceBoxes: Array<{ x: number; y: number; width: number; height: number; confidence: number }>;
    gazeVector: { x: number; y: number } | null;
    blinkCount: number;
    headMovement: number;
  } | null;
  videoRef?: React.RefObject<HTMLVideoElement>;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

/**
 * Status widget displayed in the bottom-right corner during exam.
 * Shows camera status, face count, and last violation.
 */
export function ProctorStatusWidget({
  isCameraOn,
  isModelLoaded,
  facesCount,
  gazeDirection,
  lastViolation,
  errors,
  debugMode = false,
  debugInfo,
  videoRef,
  canvasRef,
}: ProctorStatusWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [lastViolationTime, setLastViolationTime] = useState<string | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Show violation alert when new violation occurs
  useEffect(() => {
    if (lastViolation) {
      setShowViolationAlert(true);
      setLastViolationTime(new Date(lastViolation.timestamp).toLocaleTimeString());
      
      const timer = setTimeout(() => {
        setShowViolationAlert(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [lastViolation]);

  // Draw debug overlay on canvas
  useEffect(() => {
    if (!debugMode || !debugInfo || !overlayCanvasRef.current || !videoRef?.current) return;

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas size to video
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 360;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw face boxes
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#10b981";

    debugInfo.faceBoxes.forEach((box, index) => {
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.fillText(
        `Face ${index + 1} (${(box.confidence * 100).toFixed(0)}%)`,
        box.x,
        box.y - 5
      );
    });

    // Draw gaze indicator
    if (debugInfo.gazeVector) {
      ctx.beginPath();
      ctx.arc(debugInfo.gazeVector.x, debugInfo.gazeVector.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "#3b82f6";
      ctx.fill();
    }
  }, [debugMode, debugInfo, videoRef]);

  const getStatusColor = () => {
    if (!isCameraOn) return "#94a3b8"; // Gray - off
    if (!isModelLoaded) return "#f59e0b"; // Yellow - loading
    if (errors.length > 0) return "#ef4444"; // Red - error
    if (facesCount === 0) return "#f59e0b"; // Yellow - no face
    if (facesCount > 1) return "#ef4444"; // Red - multiple faces
    if (gazeDirection?.direction !== "center") return "#f59e0b"; // Yellow - looking away
    return "#10b981"; // Green - all good
  };

  const getStatusText = () => {
    if (!isCameraOn) return "Camera Off";
    if (!isModelLoaded) return "Loading...";
    if (errors.length > 0) return "Error";
    if (facesCount === 0) return "No Face";
    if (facesCount > 1) return `${facesCount} Faces`;
    if (gazeDirection?.direction !== "center") return `Looking ${gazeDirection?.direction || "away"}`;
    return "Monitoring";
  };

  const getViolationBadge = (type: string) => {
    switch (type) {
      case "MULTI_FACE":
        return { color: "#ef4444", bg: "#fef2f2", text: "Multiple Faces" };
      case "GAZE_AWAY":
        return { color: "#f59e0b", bg: "#fffbeb", text: "Gaze Away" };
      case "SPOOF_DETECTED":
        return { color: "#dc2626", bg: "#fef2f2", text: "Spoof Detected" };
      case "CAMERA_DENIED":
        return { color: "#64748b", bg: "#f1f5f9", text: "Camera Denied" };
      default:
        return { color: "#64748b", bg: "#f1f5f9", text: type };
    }
  };

  return (
    <>
      {/* Main Widget */}
      <div
        style={{
          position: "fixed",
          bottom: "1rem",
          right: "1rem",
          zIndex: 9000,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.5rem",
        }}
      >
        {/* Violation Alert Toast */}
        {showViolationAlert && lastViolation && (
          <div
            style={{
              backgroundColor: getViolationBadge(lastViolation.eventType).bg,
              border: `2px solid ${getViolationBadge(lastViolation.eventType).color}`,
              borderRadius: "0.5rem",
              padding: "0.75rem 1rem",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              animation: "slideInRight 0.3s ease-out",
              maxWidth: "250px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={getViolationBadge(lastViolation.eventType).color}
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span
                style={{
                  color: getViolationBadge(lastViolation.eventType).color,
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                }}
              >
                {getViolationBadge(lastViolation.eventType).text}
              </span>
            </div>
            <p
              style={{
                margin: "0.25rem 0 0 0",
                fontSize: "0.75rem",
                color: "#64748b",
              }}
            >
              Recorded at {lastViolationTime}
            </p>
          </div>
        )}

        {/* Compact Status Indicator */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            backgroundColor: "#ffffff",
            border: `2px solid ${getStatusColor()}`,
            borderRadius: isExpanded ? "0.75rem" : "2rem",
            padding: isExpanded ? "0.75rem" : "0.5rem 0.75rem",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            cursor: "pointer",
            transition: "all 0.2s",
            minWidth: isExpanded ? "200px" : "auto",
          }}
        >
          {/* Compact View */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* Status Dot */}
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: getStatusColor(),
                animation: isCameraOn && !errors.length ? "pulse 2s infinite" : "none",
              }}
            />
            
            {/* Camera Icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={getStatusColor()}
              strokeWidth="2"
            >
              {isCameraOn ? (
                <>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </>
              ) : (
                <>
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
                  <path d="M15 11a4 4 0 0 0-7.54 1.8" />
                </>
              )}
            </svg>
            
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: getStatusColor(),
              }}
            >
              {getStatusText()}
            </span>

            {/* Face count badge */}
            {isCameraOn && facesCount > 0 && (
              <span
                style={{
                  backgroundColor: facesCount === 1 ? "#ecfdf5" : "#fef2f2",
                  color: facesCount === 1 ? "#10b981" : "#ef4444",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  padding: "0.125rem 0.375rem",
                  borderRadius: "9999px",
                }}
              >
                {facesCount} {facesCount === 1 ? "face" : "faces"}
              </span>
            )}

            {/* Expand/Collapse Arrow */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              style={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
                marginLeft: "auto",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.75rem" }}>
                {/* Camera Status */}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Camera:</span>
                  <span style={{ color: isCameraOn ? "#10b981" : "#ef4444", fontWeight: 500 }}>
                    {isCameraOn ? "Active" : "Inactive"}
                  </span>
                </div>
                
                {/* Model Status */}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>AI Model:</span>
                  <span style={{ color: isModelLoaded ? "#10b981" : "#f59e0b", fontWeight: 500 }}>
                    {isModelLoaded ? "Ready" : "Loading"}
                  </span>
                </div>
                
                {/* Face Count */}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Faces:</span>
                  <span
                    style={{
                      color: facesCount === 1 ? "#10b981" : facesCount === 0 ? "#f59e0b" : "#ef4444",
                      fontWeight: 500,
                    }}
                  >
                    {facesCount}
                  </span>
                </div>
                
                {/* Gaze */}
                {gazeDirection && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Gaze:</span>
                    <span
                      style={{
                        color: gazeDirection.direction === "center" ? "#10b981" : "#f59e0b",
                        fontWeight: 500,
                        textTransform: "capitalize",
                      }}
                    >
                      {gazeDirection.direction}
                    </span>
                  </div>
                )}

                {/* Last Violation */}
                {lastViolation && (
                  <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#64748b", display: "block", marginBottom: "0.25rem" }}>
                      Last Violation:
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        backgroundColor: getViolationBadge(lastViolation.eventType).bg,
                        color: getViolationBadge(lastViolation.eventType).color,
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.25rem",
                      }}
                    >
                      {getViolationBadge(lastViolation.eventType).text}
                    </span>
                  </div>
                )}

                {/* Errors */}
                {errors.length > 0 && (
                  <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#ef4444", display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
                      Errors:
                    </span>
                    {errors.slice(0, 2).map((error, i) => (
                      <span
                        key={i}
                        style={{
                          display: "block",
                          color: "#dc2626",
                          fontSize: "0.6875rem",
                        }}
                      >
                        {error}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Debug Panel */}
      {debugMode && (
        <div
          style={{
            position: "fixed",
            top: "1rem",
            right: "1rem",
            zIndex: 9001,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            color: "#ffffff",
            borderRadius: "0.5rem",
            padding: "1rem",
            maxWidth: "350px",
            fontFamily: "monospace",
            fontSize: "0.75rem",
          }}
        >
          <h4 style={{ margin: "0 0 0.75rem", color: "#10b981" }}>Camera Proctor Debug</h4>
          
          {/* Video Preview */}
          {videoRef?.current && (
            <div style={{ position: "relative", marginBottom: "0.75rem" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  borderRadius: "0.25rem",
                  transform: "scaleX(-1)",
                }}
              />
              <canvas
                ref={overlayCanvasRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  transform: "scaleX(-1)",
                }}
              />
            </div>
          )}

          {/* Hidden canvas for snapshots */}
          <canvas ref={canvasRef} style={{ display: "none" }} />
          
          {/* Debug Stats */}
          {debugInfo && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <div>FPS: <span style={{ color: "#3b82f6" }}>{debugInfo.fps}</span></div>
              <div>Detection Time: <span style={{ color: "#3b82f6" }}>{debugInfo.lastDetectionTime.toFixed(1)}ms</span></div>
              <div>Faces: <span style={{ color: debugInfo.faceBoxes.length === 1 ? "#10b981" : "#ef4444" }}>{debugInfo.faceBoxes.length}</span></div>
              <div>Blinks: <span style={{ color: "#3b82f6" }}>{debugInfo.blinkCount}</span></div>
              <div>Head Movement: <span style={{ color: "#3b82f6" }}>{debugInfo.headMovement.toFixed(2)}</span></div>
              <div>Gaze: <span style={{ color: gazeDirection?.direction === "center" ? "#10b981" : "#f59e0b" }}>{gazeDirection?.direction || "N/A"}</span></div>
            </div>
          )}
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}

export default ProctorStatusWidget;

