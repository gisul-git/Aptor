import React, { useState, useRef, useEffect, useCallback } from "react";
import { usePrecheck, type CheckType } from "@/hooks/usePrecheck";
import USBDeviceCheck from "./USBDeviceCheck";
import { usePrecheckExtensions } from "@/hooks/usePrecheckExtensions";

interface PrecheckModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onClose?: () => void;
  assessmentId: string;
  userId: string;
  candidateName?: string;
  token?: string;
}

const CHECK_ORDER: CheckType[] = ["browser", "network", "camera", "microphone"];

const STEP_ICONS: Record<CheckType, React.ReactNode> = {
  browser: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  network: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  camera: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  microphone: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  fullscreen: null,
  tabSwitch: null,
};

const STEP_TITLES: Record<CheckType, string> = {
  browser: "Browser Check",
  network: "Network Check", 
  camera: "Camera Access",
  microphone: "Microphone Test",
  fullscreen: "Fullscreen",
  tabSwitch: "Tab Switch",
};

const NEXT_STEP_LABELS: Record<number, string> = {
  0: "Next: Network Check →",
  1: "Next: Camera Access →",
  2: "Next: Microphone Test →",
  3: "Complete Pre-Check →",
};

const getNextButtonLabel = (currentStep: number, canProceed: boolean, hasExtensions: boolean): string => {
  if (currentStep === 0 && hasExtensions) {
    return "⚠️ Remove Extensions to Continue";
  }
  if (!canProceed) {
    return NEXT_STEP_LABELS[currentStep] || "Continue →";
  }
  return NEXT_STEP_LABELS[currentStep] || "Continue →";
};

export function PrecheckModal({
  isOpen,
  onComplete,
  onClose,
  assessmentId,
  userId,
  candidateName,
  token,
}: PrecheckModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [extensionsCertified, setExtensionsCertified] = useState(false);
  
  // Extension detection
  const {
    isScanning: isExtensionScanning,
    scanResult: extensionScanResult,
    scan: scanExtensions,
    requestPermission,
  } = usePrecheckExtensions();

  // Precheck hook
  const {
    checks,
    cameras,
    microphones,
    selectedCamera,
    selectedMicrophone,
    setSelectedCamera,
    setSelectedMicrophone,
    runCheck,
    cameraStream,
    microphoneStream,
    isRecording,
    recordedAudio,
    audioDbLevel,
    thresholdReached,
    startRecording,
    stopRecording,
    playRecording,
    stopAllStreams,
    networkMetrics,
    browserInfo,
  } = usePrecheck({
    assessmentId,
    userId,
    maxLatencyMs: 500,
    minDownloadMbps: 0.5,
    cameraRequired: true,
    microphoneRequired: true,
  });

  const currentCheckType = CHECK_ORDER[currentStep];
  const currentCheck = checks[currentCheckType];

  // Audio frequency visualization
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Track if modal was previously open
  const wasOpenRef = useRef(false);
  
  // Reset ONLY when modal first opens (not on every render)
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Modal just opened - reset to step 0
      setCurrentStep(0);
      setIsChecking(false);
      wasOpenRef.current = true;
    } else if (!isOpen && wasOpenRef.current) {
      // Modal just closed - cleanup
      stopAllStreams();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      wasOpenRef.current = false;
    }
  }, [isOpen, stopAllStreams]);

  // Auto-scan extensions when browser check step is active
  useEffect(() => {
    if (isOpen && currentCheckType === "browser" && !isExtensionScanning) {
      // Automatically scan for extensions when browser check step is shown
      // Only scan if we don't have results yet
      // The scan function already has a 1000ms delay built-in
      if (!extensionScanResult) {
        const timer = setTimeout(() => {
          scanExtensions().catch((err) => {
            console.error("Extension scan error:", err);
          });
        }, 100); // Small delay to ensure DOM is ready
        
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, currentCheckType, extensionScanResult, isExtensionScanning, scanExtensions]);

  // Reset certification checkbox when leaving browser step
  useEffect(() => {
    if (currentCheckType !== "browser") {
      setExtensionsCertified(false);
    }
  }, [currentCheckType]);

  // Handle running current check
  const handleRunCheck = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      await runCheck(currentCheckType);
      
      // For browser check, also scan extensions (run in parallel, don't wait)
      if (currentCheckType === "browser") {
        // Don't await - let it run in background
        scanExtensions().catch((err) => {
          console.error("Extension scan error:", err);
        });
      }
    } finally {
      setIsChecking(false);
    }
  }, [currentCheckType, isChecking, runCheck, scanExtensions]);

  // Handle next step
  const handleNext = useCallback(async () => {
    if (currentStep < CHECK_ORDER.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // All checks complete - store precheck status in backend before routing
      try {
        // Get token and candidate info
        const assessmentToken = token || sessionStorage.getItem("assessmentToken") || "";
        const email = userId || sessionStorage.getItem("candidateEmail") || "";
        const name = candidateName || sessionStorage.getItem("candidateName") || "";
        
        // Prepare precheck results
        const precheckResults: Record<string, boolean> = {};
        CHECK_ORDER.forEach((checkType) => {
          const check = checks[checkType];
          precheckResults[checkType] = check?.status === "passed";
        });
        
        // Call backend API to store precheck completion
        if (assessmentId && assessmentToken && email && name) {
          const response = await fetch("/api/assessment/precheck-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assessmentId,
              token: assessmentToken,
              email,
              name,
              precheckResults,
            }),
          });
          
          if (!response.ok) {
            console.warn("Failed to store precheck completion, but continuing with flow");
          }
        }
      } catch (error) {
        console.error("Error storing precheck completion:", error);
        // Continue with routing even if API call fails
      }
      
      // Route to instructions page
      onComplete();
    }
  }, [currentStep, onComplete, assessmentId, userId, candidateName, checks]);

  // Setup clean audio visualization for microphone
  useEffect(() => {
    if (currentCheckType === "microphone" && microphoneStream) {
      const setupAudioVisualization = async () => {
        try {
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          
          const source = audioContext.createMediaStreamSource(microphoneStream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 64; // Fewer bars for cleaner look
          analyser.smoothingTimeConstant = 0.85;
          source.connect(analyser);
          analyserRef.current = analyser;

          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          const barCount = 24; // Fixed number of bars for consistent look
          const barGap = 4;
          const barWidth = (canvas.width - (barCount - 1) * barGap) / barCount;

          const draw = () => {
            if (!analyserRef.current || !canvas) return;
            
            animationFrameRef.current = requestAnimationFrame(draw);
            analyserRef.current.getByteFrequencyData(dataArray);

            // Clear with background
            ctx.fillStyle = "#f8fafc";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw threshold line
            const thresholdY = canvas.height * 0.6;
            ctx.strokeStyle = "#e2e8f0";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, thresholdY);
            ctx.lineTo(canvas.width, thresholdY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Calculate average for each bar group
            const samplesPerBar = Math.floor(bufferLength / barCount);
            
            for (let i = 0; i < barCount; i++) {
              // Average the frequency data for this bar
              let sum = 0;
              for (let j = 0; j < samplesPerBar; j++) {
                sum += dataArray[i * samplesPerBar + j];
              }
              const avg = sum / samplesPerBar;
              
              // Calculate bar height with minimum height
              const normalizedHeight = avg / 255;
              const barHeight = Math.max(4, normalizedHeight * canvas.height * 0.9);
              
              const x = i * (barWidth + barGap);
              const y = canvas.height - barHeight;
              
              // Color based on intensity
              const intensity = normalizedHeight;
              if (intensity > 0.4) {
                ctx.fillStyle = "#10b981"; // Green - good level
              } else if (intensity > 0.15) {
                ctx.fillStyle = "#fbbf24"; // Yellow - moderate
              } else {
                ctx.fillStyle = "#cbd5e1"; // Gray - low
              }
              
              // Draw rounded bar
              ctx.beginPath();
              ctx.roundRect(x, y, barWidth, barHeight, 2);
              ctx.fill();
            }
          };

          draw();
        } catch (error) {
          console.error("Audio visualization error:", error);
        }
      };

      setupAudioVisualization();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentCheckType, microphoneStream]);

  // Auto-scan extensions when browser check is active
  useEffect(() => {
    if (currentCheckType === "browser" && !extensionScanResult && !isExtensionScanning) {
      const timer = setTimeout(() => {
        scanExtensions().catch(err => {
          console.error("Auto-scan failed:", err);
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentCheckType, extensionScanResult, isExtensionScanning, scanExtensions]);

  if (!isOpen) return null;

  // Extension detection is informational only - no longer blocks progression
  const hasExtensions = extensionScanResult?.hasExtensions ?? false;
  const extensionCount = extensionScanResult?.count ?? 0;
  
  const canProceed = currentCheck?.status === "passed" && 
    (currentCheckType !== "microphone" || thresholdReached);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          maxWidth: "480px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step Indicator - Matching the camera modal style */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          padding: "1.5rem 1.5rem 1rem",
          gap: "0.5rem",
        }}>
          {CHECK_ORDER.map((_, index) => (
            <React.Fragment key={index}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  backgroundColor: index < currentStep
                    ? "#10b981"
                    : index === currentStep
                    ? "#10b981"
                    : "#e2e8f0",
                  color: index <= currentStep ? "#ffffff" : "#94a3b8",
                  transition: "all 0.3s ease",
                }}
              >
                {index < currentStep ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              {index < CHECK_ORDER.length - 1 && (
                <div
                  style={{
                    width: "40px",
                    height: "2px",
                    backgroundColor: index < currentStep ? "#10b981" : "#e2e8f0",
                    transition: "background-color 0.3s ease",
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Header with Icon and Title */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "0.75rem",
          padding: "0 1.5rem 1rem",
        }}>
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            backgroundColor: "#f0fdf4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#10b981",
          }}>
            {STEP_ICONS[currentCheckType]}
          </div>
          <div>
            <h2 style={{ 
              fontSize: "1.25rem", 
              fontWeight: 700, 
              color: "#1e293b", 
              margin: 0,
            }}>
              Step {currentStep + 1}: {STEP_TITLES[currentCheckType]}
            </h2>
            {candidateName && (
              <p style={{ 
                fontSize: "0.875rem", 
                color: "#10b981", 
                margin: 0,
                fontWeight: 500,
              }}>
                Welcome, {candidateName}
              </p>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          
          {/* Browser Check */}
          {currentCheckType === "browser" && (
            <div>
              {currentCheck?.status === "passed" ? (
                <div style={{
                  backgroundColor: "#f0fdf4",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  textAlign: "center",
                  marginBottom: "1rem",
                }}>
                  <div style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    backgroundColor: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1rem",
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p style={{ color: "#065f46", fontWeight: 600, fontSize: "1rem", margin: 0 }}>
                    {browserInfo.name} {browserInfo.version} is compatible
                  </p>
                </div>
              ) : currentCheck?.status === "running" || isExtensionScanning ? (
                <div style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: "0.75rem",
                  padding: "2rem",
                  textAlign: "center",
                }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    border: "3px solid #e2e8f0",
                    borderTopColor: "#10b981",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 1rem",
                  }} />
                  <p style={{ color: "#64748b", margin: 0 }}>Checking browser compatibility...</p>
                </div>
              ) : (
                <div style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: "0.75rem",
                  padding: "2rem",
                  textAlign: "center",
                  marginBottom: "1rem",
                }}>
                  <div style={{ color: "#94a3b8", marginBottom: "1rem" }}>
                    {STEP_ICONS[currentCheckType]}
                  </div>
                  <p style={{ color: "#64748b", margin: 0, marginBottom: "1rem" }}>
                    Click the button below to verify your browser is compatible
                  </p>
                </div>
              )}

              {/* Extension Detection with Permission Request */}
              {currentCheckType === "browser" && (
                <>
                  {/* Scanning State */}
                  {isExtensionScanning && (
                    <div style={{
                      padding: "1.25rem",
                      backgroundColor: "#f8fafc",
                      border: "2px solid #e2e8f0",
                      borderRadius: "0.75rem",
                      marginBottom: "1rem",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{
                          width: "24px",
                          height: "24px",
                          border: "2px solid #e2e8f0",
                          borderTopColor: "#10b981",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                        }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ 
                            margin: 0, 
                            fontSize: "0.875rem", 
                            color: "#64748b" 
                          }}>
                            Scanning for browser extensions...
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Permission Not Granted or Web-based Detection */}
                  {extensionScanResult && !extensionScanResult.permissionGranted && (
                    <div style={{
                      padding: "1.25rem",
                    backgroundColor: "#fef2f2",
                      border: "2px solid #fecaca",
                    borderRadius: "0.75rem",
                    marginBottom: "1rem",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                        <span style={{ fontSize: "1.5rem" }}>🔐</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ 
                            margin: "0 0 0.5rem 0", 
                            fontSize: "0.9375rem", 
                            fontWeight: 700, 
                            color: "#991b1b" 
                          }}>
                            Permission Required to Detect Extensions
                          </p>
                          {extensionScanResult.hasExtensions ? (
                            <>
                              <p style={{ 
                                margin: "0 0 0.75rem 0", 
                                fontSize: "0.875rem", 
                                color: "#991b1b"
                              }}>
                                Web-based detection found {extensionScanResult.count} extension indicator(s). 
                                Some extensions may not be detected. Please manually verify all extensions are disabled.
                              </p>
                              <div style={{
                                padding: "0.75rem",
                                backgroundColor: "#ffffff",
                                borderRadius: "0.375rem",
                                marginBottom: "0.75rem",
                              }}>
                                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8125rem", fontWeight: 600, color: "#991b1b" }}>
                                  Detected Extension IDs:
                                </p>
                                <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8125rem", color: "#991b1b" }}>
                                  {extensionScanResult.details.uniqueExtensionIds.map((id, idx) => (
                                    <li key={idx}>{id}</li>
                                  ))}
                                </ul>
                              </div>
                            </>
                          ) : (
                            <p style={{ 
                              margin: "0 0 0.75rem 0", 
                              fontSize: "0.875rem", 
                              color: "#991b1b"
                            }}>
                              Web-based detection completed. No extensions detected via DOM scanning. 
                              However, some extensions may not be detectable. Please manually verify all extensions are disabled.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Extensions Detected (Permission Granted) */}
                  {extensionScanResult && extensionScanResult.permissionGranted && (
                    <div style={{
                      padding: "1.25rem",
                      backgroundColor: extensionScanResult.hasExtensions ? "#fef2f2" : "#f0fdf4",
                      border: `2px solid ${extensionScanResult.hasExtensions ? "#fecaca" : "#86efac"}`,
                      borderRadius: "0.75rem",
                      marginBottom: "1rem",
                    }}>
                      <h3 style={{ 
                        margin: "0 0 0.75rem 0", 
                        fontSize: "1rem", 
                        fontWeight: 600,
                        color: extensionScanResult.hasExtensions ? "#dc2626" : "#065f46"
                      }}>
                        {extensionScanResult.hasExtensions 
                          ? `🚫 ${extensionScanResult.count} Extension(s) Detected` 
                          : "✅ No Extensions Detected"}
                      </h3>

                      {extensionScanResult.hasExtensions && (
                        <>
                          <p style={{ 
                            margin: "0 0 0.75rem 0", 
                            fontSize: "0.875rem", 
                            color: "#991b1b"
                          }}>
                            The following extensions must be disabled:
                          </p>
                          
                          <ul style={{ 
                            margin: "0 0 1rem 0", 
                            paddingLeft: "1.25rem",
                            fontSize: "0.875rem",
                            color: "#991b1b"
                          }}>
                            {extensionScanResult.details.extensions.map((ext, idx) => (
                              <li key={idx} style={{ marginBottom: "0.25rem", padding: "0.5rem", backgroundColor: "#ffffff", borderRadius: "0.375rem", border: "1px solid #fecaca" }}>
                                <strong>{ext.name}</strong> {ext.version && <span style={{ color: "#64748b", fontSize: "0.8125rem" }}>(v{ext.version})</span>}
                        </li>
                      ))}
                  </ul>

                          <div style={{
                            padding: "0.75rem",
                            backgroundColor: "#fffbeb",
                            borderRadius: "0.375rem",
                            marginBottom: "0.75rem",
                          }}>
                            <p style={{ 
                              margin: "0 0 0.5rem 0", 
                              fontSize: "0.8125rem", 
                              fontWeight: 600,
                              color: "#92400e"
                            }}>
                              How to disable:
                            </p>
                            <ol style={{ 
                              margin: 0, 
                              paddingLeft: "1.25rem",
                              fontSize: "0.8125rem",
                              color: "#92400e"
                            }}>
                              <li>Go to <code style={{ backgroundColor: "#fef3c7", padding: "0.125rem 0.25rem", borderRadius: "0.25rem" }}>chrome://extensions</code> or <code style={{ backgroundColor: "#fef3c7", padding: "0.125rem 0.25rem", borderRadius: "0.25rem" }}>edge://extensions</code></li>
                              <li>Toggle OFF each extension listed above</li>
                              <li>Click &quot;Re-scan&quot; below</li>
                            </ol>
                          </div>

                  <button
                    onClick={async () => {
                      setIsChecking(true);
                      await scanExtensions();
                      setIsChecking(false);
                    }}
                    disabled={isChecking || isExtensionScanning}
                    style={{
                      width: "100%",
                              padding: "0.875rem",
                              backgroundColor: "#f59e0b",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      cursor: isChecking || isExtensionScanning ? "not-allowed" : "pointer",
                      opacity: isChecking || isExtensionScanning ? 0.6 : 1,
                    }}
                  >
                            {isExtensionScanning ? "⏳ Scanning..." : "🔄 Re-scan Extensions"}
                  </button>
                        </>
                      )}

                      {!extensionScanResult.hasExtensions && (
                        <p style={{ 
                          margin: 0, 
                          fontSize: "0.875rem", 
                          color: "#065f46"
                        }}>
                          ✅ Your browser is clean - No extensions detected
                        </p>
                      )}
                </div>
                  )}

                  {/* Fallback: Manual Certification if Permission Not Granted */}
                  {extensionScanResult && !extensionScanResult.permissionGranted && (
                    <div style={{
                      padding: "1rem",
                      backgroundColor: "#fffbeb",
                      border: "1px solid #fcd34d",
                      borderRadius: "0.5rem",
                      marginTop: "1rem",
                    }}>
                      <p style={{ 
                        margin: "0 0 0.75rem 0", 
                        fontSize: "0.875rem", 
                        fontWeight: 600,
                        color: "#92400e"
                      }}>
                        Alternative: Manual Certification
                      </p>
                      <label style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.75rem",
                        cursor: "pointer",
                      }}>
                        <input
                          type="checkbox"
                          checked={extensionsCertified}
                          onChange={(e) => setExtensionsCertified(e.target.checked)}
                          style={{
                            marginTop: "0.25rem",
                            width: "1.25rem",
                            height: "1.25rem",
                            cursor: "pointer",
                          }}
                        />
                        <span style={{ fontSize: "0.8125rem", color: "#92400e" }}>
                          I certify that I have manually disabled ALL browser extensions
                          by going to <code style={{ backgroundColor: "#fef3c7", padding: "0.125rem 0.25rem", borderRadius: "0.25rem" }}>chrome://extensions</code> or <code style={{ backgroundColor: "#fef3c7", padding: "0.125rem 0.25rem", borderRadius: "0.25rem" }}>edge://extensions</code> and toggling them all OFF.
                        </span>
                      </label>
                    </div>
                  )}
                </>
              )}

              {(!currentCheck || currentCheck.status === "pending") && (
                <button
                  onClick={handleRunCheck}
                  disabled={isChecking || isExtensionScanning}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    backgroundColor: "#10b981",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: isChecking || isExtensionScanning ? "not-allowed" : "pointer",
                    opacity: isChecking || isExtensionScanning ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  🔍 Check Browser
                </button>
              )}
            </div>
          )}

          {/* Network Check */}
          {currentCheckType === "network" && (
            <div>
              {currentCheck?.status === "passed" ? (
                <div style={{
                  backgroundColor: "#f0fdf4",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  textAlign: "center",
                  marginBottom: "1rem",
                }}>
                  <div style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    backgroundColor: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1rem",
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p style={{ color: "#065f46", fontWeight: 600, fontSize: "1rem", margin: 0, marginBottom: "1rem" }}>
                    Internet Connection Verified
                  </p>
                  
                  {/* Speed Display */}
                  {networkMetrics && (
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "center", 
                      gap: "1.5rem",
                      padding: "0.75rem",
                      backgroundColor: "#ffffff",
                      borderRadius: "0.5rem",
                      border: "1px solid #d1fae5",
                    }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669" }}>
                          ↓ {networkMetrics.downloadSpeedMbps}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Mbps Down</div>
                      </div>
                      <div style={{ width: "1px", backgroundColor: "#d1fae5" }} />
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669" }}>
                          ↑ {networkMetrics.uploadSpeedMbps || "N/A"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Mbps Up</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : currentCheck?.status === "running" ? (
                <div style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: "0.75rem",
                  padding: "2rem",
                  textAlign: "center",
                }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    border: "3px solid #e2e8f0",
                    borderTopColor: "#10b981",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 1rem",
                  }} />
                  <p style={{ color: "#64748b", margin: 0 }}>{currentCheck.message || "Testing connection..."}</p>
                </div>
              ) : currentCheck?.status === "failed" ? (
                <div style={{
                  backgroundColor: "#fef2f2",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  textAlign: "center",
                  marginBottom: "1rem",
                }}>
                  <p style={{ color: "#dc2626", fontWeight: 600, margin: 0 }}>
                    ❌ {currentCheck.message}
                  </p>
                </div>
              ) : (
                <div style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: "0.75rem",
                  padding: "2rem",
                  textAlign: "center",
                  marginBottom: "1rem",
                }}>
                  <div style={{ color: "#94a3b8", marginBottom: "1rem" }}>
                    {STEP_ICONS[currentCheckType]}
                  </div>
                  <p style={{ color: "#64748b", margin: 0 }}>
                    Click to test your internet speed
                  </p>
                </div>
              )}

              {(!currentCheck || currentCheck.status === "pending" || currentCheck.status === "failed") && (
                <button
                  onClick={handleRunCheck}
                  disabled={isChecking}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    backgroundColor: "#10b981",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: isChecking ? "not-allowed" : "pointer",
                    opacity: isChecking ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  📶 {currentCheck?.status === "failed" ? "Retry Connection" : "Test Speed"}
                </button>
              )}
            </div>
          )}

          {/* Camera Check */}
          {currentCheckType === "camera" && (
            <div>
              {/* Camera Preview */}
              {cameraStream ? (
                <div style={{
                  marginBottom: "1rem",
                  borderRadius: "0.75rem",
                  overflow: "hidden",
                  backgroundColor: "#000",
                }}>
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={(el) => {
                      if (el && cameraStream) {
                        el.srcObject = cameraStream;
                      }
                    }}
                    style={{
                      width: "100%",
                      height: "240px",
                      objectFit: "cover",
                      transform: "scaleX(-1)",
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: "0.75rem",
                  padding: "2rem",
                  textAlign: "center",
                  marginBottom: "1rem",
                  minHeight: "200px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {currentCheck?.status === "running" ? (
                    <>
                      <div style={{
                        width: "48px",
                        height: "48px",
                        border: "3px solid #e2e8f0",
                        borderTopColor: "#10b981",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        marginBottom: "1rem",
                      }} />
                      <p style={{ color: "#64748b", margin: 0 }}>Accessing camera...</p>
                    </>
                  ) : currentCheck?.status === "failed" ? (
                    <>
                      <div style={{ color: "#ef4444", marginBottom: "1rem" }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                      </div>
                      <p style={{ color: "#dc2626", fontWeight: 600, margin: 0 }}>{currentCheck.message}</p>
                    </>
                  ) : (
                    <>
                      <div style={{ color: "#94a3b8", marginBottom: "1rem" }}>
                        {STEP_ICONS[currentCheckType]}
                      </div>
                      <p style={{ color: "#64748b", margin: 0 }}>Camera preview will appear here</p>
                    </>
                  )}
                </div>
              )}

              {/* Camera Selector */}
              {cameras.length > 1 && (
                <div style={{ marginBottom: "1rem" }}>
                  <select
                    value={selectedCamera || ""}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.875rem",
                      backgroundColor: "#fff",
                    }}
                  >
                    {cameras.map((cam) => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {cam.label || `Camera ${cam.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(!currentCheck || currentCheck.status === "pending" || currentCheck.status === "failed") && (
                <button
                  onClick={handleRunCheck}
                  disabled={isChecking}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    backgroundColor: "#10b981",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: isChecking ? "not-allowed" : "pointer",
                    opacity: isChecking ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  📷 {currentCheck?.status === "failed" ? "Retry Camera" : "Test Camera"}
                </button>
              )}
            </div>
          )}

          {/* Microphone Check */}
          {currentCheckType === "microphone" && (
            <div>
              {/* Microphone Selector */}
              {microphones.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.875rem", color: "#64748b", marginBottom: "0.5rem" }}>
                    Select Microphone:
                  </label>
                  <select
                    value={selectedMicrophone || ""}
                    onChange={(e) => setSelectedMicrophone(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.875rem",
                      backgroundColor: "#fff",
                    }}
                  >
                    {microphones.map((mic) => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {currentCheck?.status === "passed" ? (
                <>
                  {/* Audio Visualizer */}
                  <div style={{
                    marginBottom: "1rem",
                    borderRadius: "0.75rem",
                    overflow: "hidden",
                    border: "1px solid #e2e8f0",
                  }}>
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={120}
                      style={{
                        width: "100%",
                        height: "120px",
                        backgroundColor: "#f8fafc",
                        display: "block",
                      }}
                    />
                  </div>

                  {/* dB Level Indicator */}
                  <div style={{
                    marginBottom: "1rem",
                    padding: "0.75rem",
                    backgroundColor: "#f8fafc",
                    borderRadius: "0.5rem",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Audio Level</span>
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: thresholdReached ? "#10b981" : "#64748b" }}>
                        {audioDbLevel > -Infinity ? `${audioDbLevel.toFixed(1)} dB` : "-- dB"}
                      </span>
                    </div>
                    <div style={{
                      height: "8px",
                      backgroundColor: "#e2e8f0",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.max(0, Math.min(100, (audioDbLevel + 60) * 2))}%`,
                        backgroundColor: thresholdReached ? "#10b981" : "#fbbf24",
                        transition: "width 0.1s ease",
                      }} />
                    </div>
                  </div>

                  {/* Recording Controls */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        style={{
                          flex: 1,
                          padding: "1rem",
                          backgroundColor: "#10b981",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "0.5rem",
                          fontSize: "1rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem",
                        }}
                      >
                        🎙️ Start Recording (2s)
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        style={{
                          flex: 1,
                          padding: "1rem",
                          backgroundColor: "#ef4444",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "0.5rem",
                          fontSize: "1rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          animation: "pulse 1s infinite",
                        }}
                      >
                        ⏺️ Recording...
                      </button>
                    )}

                    {recordedAudio && (
                      <button
                        onClick={playRecording}
                        style={{
                          padding: "1rem 1.5rem",
                          backgroundColor: "#3b82f6",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "0.5rem",
                          fontSize: "1rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        ▶️ Play
                      </button>
                    )}
                  </div>

                  {/* Threshold Status */}
                  {thresholdReached ? (
                    <div
                      style={{
                        padding: "1rem",
                        backgroundColor: "#f0fdf4",
                        border: "1px solid #86efac",
                        borderRadius: "0.5rem",
                        textAlign: "center",
                      }}
                    >
                      <p style={{ color: "#065f46", fontWeight: 600, margin: 0 }}>
                        ✓ Audio verified! Your microphone is working.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "1rem",
                        backgroundColor: "#fffbeb",
                        border: "1px solid #fcd34d",
                        borderRadius: "0.5rem",
                        textAlign: "center",
                      }}
                    >
                      <p style={{ color: "#92400e", margin: 0, fontSize: "0.875rem" }}>
                        💡 Click &quot;Start Recording&quot; and speak clearly for 2 seconds
                      </p>
                    </div>
                  )}
                </>
              ) : currentCheck?.status === "running" ? (
                <div style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: "0.75rem",
                  padding: "2rem",
                  textAlign: "center",
                }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    border: "3px solid #e2e8f0",
                    borderTopColor: "#10b981",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 1rem",
                  }} />
                  <p style={{ color: "#64748b", margin: 0 }}>Accessing microphone...</p>
                </div>
              ) : currentCheck?.status === "failed" ? (
                <div style={{
                  backgroundColor: "#fef2f2",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  textAlign: "center",
                  marginBottom: "1rem",
                }}>
                  <p style={{ color: "#dc2626", fontWeight: 600, margin: 0 }}>
                    ❌ {currentCheck.message}
                  </p>
                </div>
              ) : (
                <div style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: "0.75rem",
                  padding: "2rem",
                  textAlign: "center",
                  marginBottom: "1rem",
                }}>
                  <div style={{ color: "#94a3b8", marginBottom: "1rem" }}>
                    {STEP_ICONS[currentCheckType]}
                  </div>
                  <p style={{ color: "#64748b", margin: 0 }}>
                    Click to test your microphone
                  </p>
                </div>
              )}

              {(!currentCheck || currentCheck.status === "pending" || currentCheck.status === "failed") && (
                <button
                  onClick={handleRunCheck}
                  disabled={isChecking}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    backgroundColor: "#10b981",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: isChecking ? "not-allowed" : "pointer",
                    opacity: isChecking ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  🎤 {currentCheck?.status === "failed" ? "Retry Microphone" : "Test Microphone"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer with Next Button */}
        <div style={{ 
          padding: "1rem 1.5rem 1.5rem", 
          borderTop: "1px solid #f1f5f9",
        }}>
          {/* Certification only shown if permission not granted */}
          {currentCheckType === "browser" && currentCheck?.status === "passed" && 
           extensionScanResult && !extensionScanResult.permissionGranted && (
            <div style={{
              padding: "1rem",
              backgroundColor: "#fef2f2",
              border: "2px solid #fecaca",
              borderRadius: "0.5rem",
              marginBottom: "1rem",
            }}>
              <label style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                cursor: "pointer",
              }}>
                <input
                  type="checkbox"
                  required
                  checked={extensionsCertified}
                  onChange={(e) => setExtensionsCertified(e.target.checked)}
                  style={{
                    marginTop: "0.25rem",
                    width: "1.25rem",
                    height: "1.25rem",
                    cursor: "pointer",
                  }}
                />
                <span style={{ fontSize: "0.875rem", color: "#991b1b" }}>
                  <strong>REQUIRED: I certify that I have manually disabled ALL browser extensions</strong>
                  <br />
                  <span style={{ fontSize: "0.8125rem" }}>
                    I have gone to <code style={{ backgroundColor: "#fee2e2", padding: "0.125rem 0.25rem", borderRadius: "0.25rem" }}>chrome://extensions</code> or <code style={{ backgroundColor: "#fee2e2", padding: "0.125rem 0.25rem", borderRadius: "0.25rem" }}>edge://extensions</code> and toggled OFF all extensions.
                    I understand that using extensions during the assessment will result in disqualification.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Next Button - Always visible, enabled when check passes */}
          {currentCheck?.status === "passed" ? (
          <button
            onClick={handleNext}
            disabled={!canProceed}
            style={{
              width: "100%",
              padding: "1rem",
              backgroundColor: canProceed ? "#10b981" : "#e2e8f0",
              color: canProceed ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: canProceed ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
              title={!canProceed ? "Complete the current check to continue" : ""}
            >
              {canProceed ? (
                <>
                  {currentStep < CHECK_ORDER.length - 1 ? "Next Step →" : "Complete Pre-Check →"}
                </>
              ) : (
                "Complete Check First"
              )}
          </button>
          ) : (
            <div style={{
              padding: "0.75rem",
              backgroundColor: "#f8fafc",
              borderRadius: "0.5rem",
              textAlign: "center",
              color: "#64748b",
              fontSize: "0.875rem",
            }}>
              Complete the current check to proceed
            </div>
          )}
        </div>

        {/* CSS for animations */}
        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}</style>
      </div>
    </div>
  );
}

