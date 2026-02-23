import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import dsaApi from "../../../lib/dsa/api";
import { usePrecheck, type CheckType } from "@/hooks/usePrecheck";
import { PrecheckCard, NetworkTest } from "../../../components/precheck";

interface TestInfo {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
}

// Sequential check order (removed fullscreen and tabSwitch)
const CHECK_ORDER: CheckType[] = ["browser", "network", "camera", "microphone"];

export default function TestPrecheckPage() {
  const router = useRouter();
  const { id: testId, token } = router.query;
  
  // State
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(0);
  const [isCheckingSequence, setIsCheckingSequence] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  // Policy settings (could come from API)
  const [cameraRequired] = useState(true);
  const [microphoneRequired] = useState(true);
  
  // Network thresholds
  const maxLatencyMs = 500;
  const minDownloadMbps = 0.5;
  
  // Initialize precheck hook
  const {
    checks,
    isReady,
    isRunning,
    mandatoryChecksPassed,
    cameras,
    microphones,
    selectedCamera,
    selectedMicrophone,
    setSelectedCamera,
    setSelectedMicrophone,
    networkMetrics,
    browserInfo,
    runCheck,
    cameraStream,
    audioLevel,
    stopAllStreams,
    logs,
    clearLogs,
  } = usePrecheck({
    assessmentId: (testId as string) || "",
    userId: email || userId || "",
    maxLatencyMs,
    minDownloadMbps,
    cameraRequired,
    microphoneRequired,
    debugMode,
  });
  
  // Check debug mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      setDebugMode(
        urlParams.get("debug") === "1" || 
        process.env.NEXT_PUBLIC_PRECHECK_DEBUG === "1"
      );
    }
  }, []);
  
  const fetchTestRef = useRef(false); // Prevent multiple fetches

  // Load session and test info
  useEffect(() => {
    const storedEmail = sessionStorage.getItem("candidateEmail");
    const storedName = sessionStorage.getItem("candidateName");
    const storedUserId = sessionStorage.getItem("candidateUserId");
    
    setEmail(storedEmail);
    setName(storedName);
    setUserId(storedUserId);
    
    if (!storedEmail || !storedName || !storedUserId) {
      // Redirect to verification if no session
      if (testId && token) {
        router.replace(`/test/${testId}?token=${encodeURIComponent(token as string)}`);
      }
      return;
    }
    
    // Fetch test info only once
    if (testId && !fetchTestRef.current && !testInfo) {
      fetchTestRef.current = true;
      const fetchTest = async () => {
        try {
          const response = await dsaApi.get(`/tests/${testId}`);
          if (response.data) {
            setTestInfo({
              title: response.data.title || "DSA Test",
              description: response.data.description || "",
              start_time: response.data.start_time || "",
              end_time: response.data.end_time || "",
            });
          }
          setIsLoading(false);
        } catch (err: any) {
          console.error("Error fetching test:", err);
          setError(err.response?.data?.detail || "Failed to load test information");
          setIsLoading(false);
          fetchTestRef.current = false; // Allow retry on error
        }
      };
      fetchTest();
    } else if (testInfo) {
      setIsLoading(false);
    }
  }, [testId, token]); // Removed router from dependencies
  
  const currentCheckType = CHECK_ORDER[currentCheckIndex];
  
  // Handle running current check
  const handleRunCurrentCheck = useCallback(async () => {
    if (!currentCheckType || isCheckingSequence) return;
    
    setIsCheckingSequence(true);
    try {
      await runCheck(currentCheckType);
    } catch (error) {
      console.error("Error running check:", error);
    } finally {
      setIsCheckingSequence(false);
    }
  }, [currentCheckType, isCheckingSequence, runCheck]);
  
  // Handle moving to next check
  const handleNextCheck = useCallback(() => {
    if (currentCheckIndex < CHECK_ORDER.length - 1) {
      setCurrentCheckIndex(currentCheckIndex + 1);
    }
  }, [currentCheckIndex]);
  
  // Handle retry current check
  const handleRetryCurrentCheck = useCallback(async (checkType?: CheckType) => {
    const typeToCheck = checkType || currentCheckType;
    if (!typeToCheck || isCheckingSequence) return;
    
    setIsCheckingSequence(true);
    try {
      await runCheck(typeToCheck);
    } catch (error) {
      console.error("Error retrying check:", error);
    } finally {
      setIsCheckingSequence(false);
    }
  }, [currentCheckType, isCheckingSequence, runCheck]);
  
  // Handle retry for any check
  const handleRetryCheck = useCallback(async (checkType: CheckType) => {
    if (isCheckingSequence) return;
    // Set as current check if not already
    const checkIndex = CHECK_ORDER.indexOf(checkType);
    if (checkIndex >= 0 && checkIndex !== currentCheckIndex) {
      setCurrentCheckIndex(checkIndex);
      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await handleRetryCurrentCheck(checkType);
  }, [isCheckingSequence, currentCheckIndex, handleRetryCurrentCheck]);
  
  // Handle proceed to instructions
  const handleProceed = useCallback(() => {
    stopAllStreams();
    router.push(`/test/${testId}/instructions?token=${encodeURIComponent(token as string)}&user_id=${encodeURIComponent(userId || "")}`);
  }, [testId, token, userId, router, stopAllStreams]);
  
  // Helper to get check label
  const getCheckLabel = (type: CheckType): string => {
    switch (type) {
      case "browser": return "Browser Compatibility";
      case "network": return "Network Connection";
      case "camera": return "Camera Access";
      case "microphone": return "Microphone Access";
      default: return type;
    }
  };
  
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" }}>
        <div style={{ textAlign: "center", color: "#94a3b8" }}>
          <div style={{ marginBottom: "1rem" }}>Loading test information...</div>
        </div>
      </div>
    );
  }
  
  if (error && !testInfo) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a", padding: "2rem" }}>
        <div style={{ textAlign: "center", color: "#ef4444", maxWidth: "500px" }}>
          <h2 style={{ marginBottom: "1rem" }}>Error</h2>
          <p>{error}</p>
          <button
            onClick={() => router.push(`/test/${testId}?token=${encodeURIComponent(token as string)}`)}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", padding: "2rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <h1 style={{ color: "#ffffff", fontSize: "2rem", marginBottom: "0.5rem" }}>
            System Pre-Check
          </h1>
          {testInfo && (
            <p style={{ color: "#94a3b8", fontSize: "1.125rem" }}>
              {testInfo.title}
            </p>
          )}
          <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "0.5rem" }}>
            Please complete all checks before proceeding to the test
          </p>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
          {CHECK_ORDER.map((checkType, index) => {
            const check = checks[checkType] || {
              type: checkType,
              status: "pending" as const,
              message: "Not checked yet",
            };
            const isCurrent = index === currentCheckIndex;
            const isCompleted = check?.status === "passed";
            const isFailed = check?.status === "failed";
            const isPending = check?.status === "pending";
            const isRunning = check?.status === "running" || (isCheckingSequence && isCurrent);
            
            return (
              <PrecheckCard
                key={checkType}
                check={{
                  ...check,
                  status: isRunning ? "running" as const : check.status,
                }}
                onRetry={() => {
                  if ((isFailed || isPending) && !isCheckingSequence) {
                    // If not current, make it current first
                    if (!isCurrent) {
                      setCurrentCheckIndex(index);
                      // Wait a bit for state to update, then run
                      setTimeout(() => {
                        handleRetryCheck(checkType);
                      }, 100);
                    } else {
                      handleRetryCheck(checkType);
                    }
                  }
                }}
                onAction={isCurrent && (isPending || isFailed) && !isCheckingSequence ? handleRunCurrentCheck : undefined}
                actionLabel={isCurrent && (isPending || isFailed) ? "Run Check" : undefined}
                isRetrying={isCheckingSequence && (isCurrent || check.status === "failed") && checkType === currentCheckType}
                videoStream={checkType === "camera" ? cameraStream : undefined}
                audioLevel={checkType === "microphone" ? audioLevel : undefined}
                devices={checkType === "camera" ? cameras : checkType === "microphone" ? microphones : undefined}
                selectedDevice={checkType === "camera" ? selectedCamera : checkType === "microphone" ? selectedMicrophone : undefined}
                onDeviceChange={checkType === "camera" ? setSelectedCamera : checkType === "microphone" ? setSelectedMicrophone : undefined}
              />
            );
          })}
        </div>
        
        {currentCheckType === "network" && networkMetrics && (
          <div style={{ marginBottom: "2rem" }}>
            <NetworkTest 
              metrics={networkMetrics}
              isRunning={isCheckingSequence && currentCheckType === "network"}
              maxLatencyMs={maxLatencyMs}
              minDownloadMbps={minDownloadMbps}
            />
          </div>
        )}
        
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          padding: "1.5rem",
          backgroundColor: "#1e293b",
          borderRadius: "0.5rem",
          marginTop: "2rem"
        }}>
          <div>
            <p style={{ color: "#94a3b8", marginBottom: "0.5rem" }}>
              Mandatory Checks: {mandatoryChecksPassed ? "✓ All Passed" : "Pending"}
            </p>
            {showLogs && logs.length > 0 && (
              <div style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#64748b" }}>
                <button
                  onClick={() => setShowLogs(false)}
                  style={{
                    marginBottom: "0.5rem",
                    padding: "0.25rem 0.5rem",
                    backgroundColor: "transparent",
                    color: "#94a3b8",
                    border: "1px solid #475569",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  Hide Logs
                </button>
                <div style={{ maxHeight: "200px", overflowY: "auto", fontFamily: "monospace" }}>
                  {logs.map((log, idx) => (
                    <div key={idx} style={{ marginBottom: "0.25rem" }}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div style={{ display: "flex", gap: "1rem" }}>
            {!showLogs && (
              <button
                onClick={() => setShowLogs(true)}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "transparent",
                  color: "#94a3b8",
                  border: "1px solid #475569",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                }}
              >
                Show Logs
              </button>
            )}
            <button
              onClick={clearLogs}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "transparent",
                color: "#94a3b8",
                border: "1px solid #475569",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              Clear Logs
            </button>
            <button
              onClick={handleProceed}
              disabled={!mandatoryChecksPassed}
              style={{
                padding: "0.75rem 2rem",
                backgroundColor: mandatoryChecksPassed ? "#3b82f6" : "#475569",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: mandatoryChecksPassed ? "pointer" : "not-allowed",
                fontWeight: "600",
                opacity: mandatoryChecksPassed ? 1 : 0.5,
              }}
            >
              Proceed to Instructions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

