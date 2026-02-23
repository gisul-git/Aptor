import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { getSession } from "next-auth/react";
import IdentityVerification from "@/proctoring/components/IdentityVerification";
import { getGateContext } from "@/lib/gateContext";
import { useAssessmentFull } from "@/hooks/api/useAssessments";
import { getApiGatewayUrl } from "@/lib/api-gateway-config";

interface VerificationStep {
  id: string;
  title: string;
  status: "pending" | "running" | "passed" | "failed";
  message: string;
}

export default function IdentityVerificationPage() {
  const router = useRouter();
  const { id, token } = router.query;
  
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<VerificationStep[]>([
    { id: "photo", title: "Capture Photo", status: "pending", message: "" },
    { id: "screenshare", title: "Screen Share", status: "pending", message: "" },
    { id: "fullscreen", title: "Fullscreen Mode", status: "pending", message: "" },
  ]);
  
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [testStartTime, setTestStartTime] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [timeUntilStart, setTimeUntilStart] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [aiProctoringEnabled, setAiProctoringEnabled] = useState<boolean>(false);
  const [faceMismatchEnabled, setFaceMismatchEnabled] = useState<boolean>(false);
  
  // React Query hook to fetch assessment data
  const assessmentId = typeof id === 'string' ? id : undefined;
  const assessmentToken = typeof token === 'string' ? token : undefined;
  
  const { data: assessmentData, isLoading, error: assessmentError } = useAssessmentFull(assessmentId, assessmentToken);

  // Extract proctoring settings from assessment data
  useEffect(() => {
    if (assessmentData) {
      const assessment = assessmentData;
      // Check both locations: schedule.proctoringSettings (preferred) and top-level proctoringSettings
      const proctoringSettings = assessment?.schedule?.proctoringSettings || assessment?.proctoringSettings;
      
      const aiEnabled = proctoringSettings?.aiProctoringEnabled === true;
      const faceMismatch = proctoringSettings?.faceMismatchEnabled === true;
      
      setAiProctoringEnabled(aiEnabled);
      setFaceMismatchEnabled(faceMismatch);
    } else {
      // Fallback: Try sessionStorage if React Query data not available
      try {
        const storedAssessment = sessionStorage.getItem(`assessment_${id}`);
        if (storedAssessment) {
          const assessment = JSON.parse(storedAssessment);
          const proctoringSettings = assessment?.schedule?.proctoringSettings || assessment?.proctoringSettings;
          const aiEnabled = proctoringSettings?.aiProctoringEnabled === true;
          const faceMismatch = proctoringSettings?.faceMismatchEnabled === true;
          setAiProctoringEnabled(aiEnabled);
          setFaceMismatchEnabled(faceMismatch);
        } else {
          setAiProctoringEnabled(false);
          setFaceMismatchEnabled(false);
        }
      } catch (e) {
        setAiProctoringEnabled(false);
        setFaceMismatchEnabled(false);
      }
    }
  }, [assessmentData, id]);
  
  useEffect(() => {
    // Wait for router to be ready before accessing query params
    if (!router.isReady) return;
    
    const storedEmail = sessionStorage.getItem("candidateEmail");
    const storedName = sessionStorage.getItem("candidateName");
    
    setEmail(storedEmail);
    setName(storedName);
    
    if (!storedEmail || !storedName) {
      if (id && token) {
        const ctx = getGateContext(id as string);
        router.replace(ctx?.entryUrl || `/assessment/${id}/${token}`);
      }
      return;
    }
    
    // Check precheck completion
    const precheckCompleted = sessionStorage.getItem(`precheckCompleted_${id}`);
    if (!precheckCompleted && id && token) {
      router.replace(`/precheck/${id}/${token}`);
      return;
    }
    
    // Check instructions acknowledgment
    const instructionsAcknowledged = sessionStorage.getItem(`instructionsAcknowledged_${id}`);
    if (!instructionsAcknowledged && id && token) {
      const targetUrl = `/assessment/${id}/${token}/instructions-new`;
      router.replace(targetUrl).catch((err) => {
        console.error("[IDENTITY-VERIFY] Navigation error:", err);
      });
      return;
    }
    
    // Check candidate requirements completion
    const candidateRequirementsCompleted = sessionStorage.getItem(`candidateRequirementsCompleted_${id}`);
    if (!candidateRequirementsCompleted && id && token) {
      router.replace(`/assessment/${id}/${token}/candidate-requirements`);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, id, token]);
  
  // Step A: Capture Photo - using IdentityVerification component
  const capturePhoto = useCallback(async (): Promise<boolean> => {
    setSteps(prev => prev.map((step, idx) => 
      idx === 0 ? { ...step, status: "running", message: "Initializing face detection..." } : step
    ));
    return true; // Component will handle the actual capture
  }, []);

  const handleCaptureComplete = useCallback((photoData: string) => {
    setCapturedPhoto(photoData);
    setSteps(prev => prev.map((step, idx) => 
      idx === 0 ? { ...step, status: "passed", message: "Photo captured successfully" } : step
    ));
  }, []);

  const handleCaptureError = useCallback((error: string) => {
    setSteps(prev => prev.map((step, idx) => 
      idx === 0 ? { ...step, status: "failed", message: error } : step
    ));
  }, []);
  
  // Step B: Screen Share - Enforce "Entire Screen" only
  const startScreenShare = useCallback(async (): Promise<boolean> => {
    setSteps(prev => prev.map((step, idx) => 
      idx === 1 ? { ...step, status: "running", message: "Requesting screen share..." } : step
    ));
    
    const requestScreenShare = async (): Promise<boolean> => {
      try {
        // Use getDisplayMedia() normally - browser shows picker UI
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true,
          audio: false 
        });
        
        // Validate the selection after stream is returned
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) {
          stream.getTracks().forEach(track => track.stop());
          setSteps(prev => prev.map((step, idx) => 
            idx === 1 ? { ...step, status: "failed", message: "No video track found. Please try again." } : step
          ));
          return false;
        }
        
        const settings = videoTrack.getSettings();
        const displaySurface = settings.displaySurface;
        
        // Valid values: "monitor" or "screen" (Entire Screen)
        const isValidSelection = displaySurface === "monitor" || displaySurface === "screen";
        
        // Invalid values: "window", "browser", "application", "tab"
        if (!isValidSelection) {
          // Immediately stop the invalid stream
          stream.getTracks().forEach(track => track.stop());
          
          // Show rejection message
          setSteps(prev => prev.map((step, idx) => 
            idx === 1 ? { 
              ...step, 
              status: "failed", 
              message: "Please select ENTIRE SCREEN to continue." 
            } : step
          ));
          
          // Re-trigger screen share request (recursive call)
          // Small delay to allow UI update
          await new Promise(resolve => setTimeout(resolve, 500));
          return requestScreenShare();
        }
        
        // Valid selection - proceed
        setScreenStream(stream);
        // Expose screen stream globally so Live Proctoring can reuse it
        if (typeof window !== "undefined") {
          (window as any).__screenStream = stream;
        }
        
        // Handle screen share end
        videoTrack.addEventListener("ended", () => {
          setScreenStream(null);
          setSteps(prev => prev.map((step, idx) => 
            idx === 1 ? { ...step, status: "failed", message: "Screen share ended. Please share again." } : step
          ));
        });
        
        setSteps(prev => prev.map((step, idx) => 
          idx === 1 ? { ...step, status: "passed", message: "Screen share active" } : step
        ));
        
        // Store screen share status
        sessionStorage.setItem(`screenShareCompleted_${id}`, "true");
        
        return true;
      } catch (error: any) {
        // User cancelled the picker
        if (error.name === "NotAllowedError" || error.name === "AbortError") {
          setSteps(prev => prev.map((step, idx) => 
            idx === 1 ? { 
              ...step, 
              status: "failed", 
              message: "Screen sharing is required. Please select ENTIRE SCREEN to continue." 
            } : step
          ));
          return false;
        }
        
        console.error("Error starting screen share:", error);
        setSteps(prev => prev.map((step, idx) => 
          idx === 1 ? { 
            ...step, 
            status: "failed", 
            message: "Failed to start screen share. Please try again." 
          } : step
        ));
        return false;
      }
    };
    
    return requestScreenShare();
  }, [id]);
  
  // Step C: Fullscreen Mode
  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    setSteps(prev => prev.map((step, idx) => 
      idx === 2 ? { ...step, status: "running", message: "Entering fullscreen mode..." } : step
    ));
    
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        await (document.documentElement as any).msRequestFullscreen();
      }
      
      setIsFullscreen(true);
      setSteps(prev => prev.map((step, idx) => 
        idx === 2 ? { ...step, status: "passed", message: "Fullscreen mode active" } : step
      ));
      
      // Store fullscreen status
      sessionStorage.setItem(`fullscreenEnabled_${id}`, "true");
      
      return true;
    } catch (error) {
      console.error("Error entering fullscreen:", error);
      setSteps(prev => prev.map((step, idx) => 
        idx === 2 ? { ...step, status: "failed", message: "Failed to enter fullscreen. Please try again." } : step
      ));
      return false;
    }
  }, [id]);
  
  // Auto-advance steps
  useEffect(() => {
    if (currentStep === 0 && steps[0].status === "pending") {
      capturePhoto();
    }
  }, [currentStep, steps, capturePhoto]);
  
  useEffect(() => {
    if (currentStep < 2 && steps[currentStep].status === "passed") {
      setTimeout(() => setCurrentStep(currentStep + 1), 1000);
    }
  }, [currentStep, steps]);
  
  // Cleanup on unmount - but don't stop screen stream if it's stored globally for take.tsx
  useEffect(() => {
    return () => {
      // Only stop if NOT navigating to take (i.e., global not set)
      if (!(window as any).__screenStream) {
        screenStream?.getVideoTracks().forEach(track => track.stop());
      }
    };
  }, [screenStream]);
  
  // Handle fullscreen exit
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && 
          !(document as any).webkitFullscreenElement && 
          !(document as any).msFullscreenElement) {
        setIsFullscreen(false);
        setSteps(prev => prev.map((step, idx) => 
          idx === 2 ? { ...step, status: "failed", message: "Fullscreen exited. Please enter fullscreen again." } : step
        ));
      }
    };
    
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);
    
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("msfullscreenchange", handleFullscreenChange);
    };
  }, []);
  
  const handleStartAssessment = async () => {
    // Verify all steps are passed
    if (!steps.every(step => step.status === "passed")) {
      return;
    }
    
    // Prevent multiple clicks
    if (isStarting) {
      return;
    }
    
    setIsStarting(true);
    
    try {
      // Resolve backend access token (same logic as apiClient)
      let backendToken: string | null = null;
      try {
        backendToken = sessionStorage.getItem("temp_access_token");
      } catch (e) {
        // ignore
      }
      if (!backendToken) {
        const session = await getSession();
        backendToken = (session as any)?.backendToken || null;
      }
      const userId = sessionStorage.getItem("candidateUserId") || email; // Use email as fallback
      
      if (!userId || !id) {
        console.error("[Identity] Missing userId or assessment id");
        return;
      }
      
      // Determine which API endpoint to use based on assessment type
      const ctx = getGateContext(id as string);
      const flowType = ctx?.flowType || "ai"; // Default to "ai" if not set
      const isDSATest = flowType === "dsa";
      const isAIMLTest = flowType === "aiml";
      const isCustomMCQ = flowType === "custom-mcq";
      const isAIAssessment = flowType === "ai" || (!flowType && !isCustomMCQ);
      
      let startTimeStr: string | null = null;
      let testHasStarted = false;
      
      // For Custom MCQ assessments, check schedule similar to AI assessments
      if (isCustomMCQ) {
        try {
          const apiGatewayUrl = await getApiGatewayUrl();
          const apiBase = `${apiGatewayUrl}/api/v1`;
          const assessmentResponse = await fetch(`${apiBase}/custom-mcq/take/${id}?token=${encodeURIComponent(token as string)}`);
          if (assessmentResponse.ok) {
            const assessmentData = await assessmentResponse.json();
            if (assessmentData.success && assessmentData.data?.schedule?.startTime) {
              startTimeStr = assessmentData.data.schedule.startTime;
              
              // Normalize timezone
              if (startTimeStr) {
                let startTime: Date;
                if (startTimeStr.endsWith('Z') || startTimeStr.includes('+') || startTimeStr.includes('-', 10)) {
                  startTime = new Date(startTimeStr);
                } else {
                  startTime = new Date(startTimeStr + 'Z');
                }
                
                const now = new Date();
                
                if (now < startTime) {
                  setTestStartTime(startTimeStr);
                  setShowStartTimeModal(true);
                  setIsStarting(false);
                  return;
                } else {
                  testHasStarted = true;
                }
              } else {
                testHasStarted = true;
              }
            } else {
              testHasStarted = true;
            }
          }
        } catch (err) {
          console.error("[Identity] Error fetching Custom MCQ assessment schedule:", err);
        }
      }
      
      // For DSA and AIML tests, check start time via test endpoints
      if (isDSATest || isAIMLTest) {
        const apiGatewayUrl = await getApiGatewayUrl();
        const apiBase = `${apiGatewayUrl}/api/v1`;
        const testEndpoint = isDSATest ? `/dsa/tests/${id}/public?user_id=${userId}` : `/aiml/tests/${id}/public?user_id=${userId}`;
        
        try {
          const testResponse = await fetch(`${apiBase}${testEndpoint}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              ...(backendToken ? { Authorization: `Bearer ${backendToken}` } : {}),
            },
          });
          if (testResponse.ok) {
            const testData = await testResponse.json();
            startTimeStr = testData.schedule?.startTime || testData.start_time || null;
            
            if (startTimeStr) {
              let startTime: Date;
              if (startTimeStr.endsWith('Z') || startTimeStr.includes('+') || startTimeStr.includes('-', 10)) {
                startTime = new Date(startTimeStr);
              } else {
                startTime = new Date(startTimeStr + 'Z');
              }
              
              const now = new Date();
              
              if (now < startTime) {
                setTestStartTime(startTimeStr);
                setShowStartTimeModal(true);
                setIsStarting(false);
                return;
              } else {
                testHasStarted = true;
              }
            } else {
              testHasStarted = true;
            }
          }
        } catch (err) {
          console.error("[Identity] Error fetching test details:", err);
        }
        
        if (startTimeStr && !testHasStarted) {
          setTestStartTime(startTimeStr);
          setShowStartTimeModal(true);
          return;
        }
      } else if (isAIAssessment) {
        try {
          const scheduleResponse = await fetch(`/api/assessment/get-schedule?assessmentId=${id}&token=${token}`);
          if (scheduleResponse.ok) {
            const scheduleData = await scheduleResponse.json();
            if (scheduleData.success && scheduleData.data?.schedule?.startTime) {
              startTimeStr = scheduleData.data.schedule.startTime;
              const examMode = scheduleData.data.schedule?.examMode || scheduleData.data?.examMode || "strict";
              
              if (!startTimeStr) {
                return;
              }
              
              let startTime: Date;
              if (startTimeStr.endsWith('Z') || startTimeStr.includes('+') || startTimeStr.includes('-', 10)) {
                startTime = new Date(startTimeStr);
              } else {
                startTime = new Date(startTimeStr + 'Z');
              }
              
              const now = new Date();
              
              if (examMode === "strict") {
                if (now < startTime) {
                  setTestStartTime(startTimeStr);
                  setShowStartTimeModal(true);
                  setIsStarting(false);
                  return; 
                } else {
                  testHasStarted = true;
                }
              } else {
                const endTimeStr = scheduleData.data?.schedule?.endTime || scheduleData.data?.endTime;
                if (endTimeStr) {
                  let endTime: Date;
                  if (endTimeStr.endsWith('Z') || endTimeStr.includes('+') || endTimeStr.includes('-', 10)) {
                    endTime = new Date(endTimeStr);
                  } else {
                    endTime = new Date(endTimeStr + 'Z');
                  }
                  
                  if (now > endTime) {
                    setError("The assessment window has closed. You cannot start the assessment now.");
                    setIsStarting(false);
                    return;
                  }
                }
                testHasStarted = true;
              }
            } else {
              testHasStarted = true;
            }
          }
        } catch (err) {
          console.error("[Identity] Error fetching assessment schedule:", err);
        }
      }
      
      let response: Response | null = null;
      
      if (isAIAssessment) {
        try {
          response = await fetch("/api/assessment/start-session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assessmentId: id,
              token,
              email,
              name,
            }),
          });
          
          if (!response.ok) {
            response = null; 
          }
        } catch (err) {
          response = null;
        }
      } else if (isCustomMCQ) {
        response = null; 
      } else if (isDSATest || isAIMLTest) {
        const apiGatewayUrl = await getApiGatewayUrl();
        const apiBase = `${apiGatewayUrl}/api/v1`;
        const startEndpoint = isDSATest ? `/dsa/tests/${id}/start?user_id=${userId}` : `/aiml/tests/${id}/start?user_id=${userId}`;
        response = await fetch(`${apiBase}${startEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(backendToken ? { Authorization: `Bearer ${backendToken}` } : {}),
          },
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.detail || errorData.message || "Failed to start test";
          
          if (response.status === 403 && (
            errorMessage.includes("will start at") || 
            errorMessage.includes("not available yet") || 
            errorMessage.includes("not started") || 
            errorMessage.includes("Test will start") ||
            errorMessage.includes("Test not available")
          )) {
            if (!startTimeStr) {
              try {
                const testEndpoint = isDSATest ? `/dsa/tests/${id}/public?user_id=${userId}` : `/aiml/tests/${id}/public?user_id=${userId}`;
                const testResponse = await fetch(`${apiBase}${testEndpoint}`);
                if (testResponse.ok) {
                  const testData = await testResponse.json();
                  startTimeStr = testData.schedule?.startTime || testData.start_time || null;
                }
              } catch (err) {
                console.error("[Identity] Error fetching test details:", err);
              }
            }
            
            setTestStartTime(startTimeStr);
            setShowStartTimeModal(true);
            setIsStarting(false);
            return;
          }
          
          console.error("[Identity] Error starting test:", errorMessage);
          setIsStarting(false);
          return;
        }
      }
      
      sessionStorage.setItem(`identityVerificationCompleted_${id}`, "true");
      
      if (screenStream && screenStream.active) {
        (window as any).__screenStream = screenStream;
      }
      
      await router.push(ctx?.finalTakeUrl || `/assessment/${id}/${token}/take`);
    } catch (error) {
      console.error("[Identity] Error checking test start time:", error);
      setIsStarting(false); 
    }
  };
  
  const allStepsPassed = steps.every(step => step.status === "passed");
  
  // Countdown timer for start time modal
  useEffect(() => {
    if (!showStartTimeModal || !testStartTime) return;
    
    const updateTimer = () => {
      try {
        let startTime: Date;
        if (testStartTime.includes('Z') || testStartTime.includes('+') || testStartTime.includes('-', 10)) {
          startTime = new Date(testStartTime);
        } else {
          startTime = new Date(testStartTime + 'Z');
        }
        
        const remaining = Math.max(0, Math.floor((startTime.getTime() - new Date().getTime()) / 1000));
        setTimeUntilStart(remaining);
        
        if (remaining <= 0) {
          window.location.reload();
        }
      } catch (err) {
        console.error("[Identity] Error updating timer:", err);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [showStartTimeModal, testStartTime]);
  
  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  // Add spinner animation style
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div style={{ 
        minHeight: "100vh", 
        backgroundColor: "#ffffff", // Emerald Mint Theme
        padding: "2rem"
      }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          padding: "2rem",
          border: "1px solid #D1D5DB", // Soft border
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" // Soft shadow
        }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#00684A", marginBottom: "0.5rem" }}>
              Identity Verification
            </h1>
            <p style={{ color: "#64748b", fontSize: "1rem" }}>
              Please complete the following verification steps
            </p>
          </div>
          
          {/* Verification Steps */}
          <div style={{ display: "grid", gap: "1.5rem", marginBottom: "2rem" }}>
            {/* Step 1: Capture Photo */}
            <div style={{
              border: `1px solid ${steps[0].status === "passed" ? "#E1F2E9" : steps[0].status === "failed" ? "#fecaca" : "#D1D5DB"}`,
              borderRadius: "0.5rem",
              padding: "1.5rem",
              backgroundColor: steps[0].status === "passed" ? "#E1F2E9" : 
                 steps[0].status === "failed" ? "#fef2f2" : "#F0F9F4"
            }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "50%",
                  backgroundColor: steps[0].status === "passed" ? "#00684A" : 
                                 steps[0].status === "failed" ? "#ef4444" : "#94a3b8",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  marginRight: "1rem"
                }}>
                  {steps[0].status === "passed" ? "✓" : steps[0].status === "failed" ? "✗" : "1"}
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#00684A" }}>
                  {steps[0].title}
                </h3>
              </div>
              
              {steps[0].status === "running" && (
                <IdentityVerification
                  assessmentId={id as string}
                  token={token as string}
                  candidateEmail={email || ""}
                  skipBackendSave={false}
                  aiProctoringEnabled={aiProctoringEnabled}
                  faceMismatchEnabled={faceMismatchEnabled}
                  onCaptureComplete={handleCaptureComplete}
                  onError={handleCaptureError}
                />
              )}
              
              {steps[0].status === "passed" && capturedPhoto && (
                <div>
                  <img
                    src={capturedPhoto}
                    alt="Captured photo"
                    style={{
                      width: "100%",
                      maxWidth: "400px",
                      borderRadius: "0.5rem",
                      marginBottom: "1rem"
                    }}
                  />
                  <div style={{ fontSize: "0.875rem", color: "#00684A", fontWeight: 500 }}>
                    {steps[0].message}
                  </div>
                </div>
              )}
              
              {steps[0].status === "failed" && (
                <div style={{ fontSize: "0.875rem", color: "#ef4444" }}>
                  {steps[0].message}
                </div>
              )}
            </div>
            
            {/* Step 2: Screen Share */}
            <div style={{
              border: `1px solid ${steps[1].status === "passed" ? "#E1F2E9" : steps[1].status === "failed" ? "#fecaca" : "#D1D5DB"}`,
              borderRadius: "0.5rem",
              padding: "1.5rem",
              backgroundColor: steps[0].status === "passed" ? "#E1F2E9" : 
                 steps[0].status === "failed" ? "#fef2f2" : "#F0F9F4"
            }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "50%",
                  backgroundColor: steps[1].status === "passed" ? "#00684A" : 
                                 steps[1].status === "failed" ? "#ef4444" : "#94a3b8",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  marginRight: "1rem"
                }}>
                  {steps[1].status === "passed" ? "✓" : steps[1].status === "failed" ? "✗" : "2"}
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#00684A" }}>
                  {steps[1].title}
                </h3>
              </div>
              
              {steps[1].status === "pending" && currentStep === 1 && (
                <div>
                  <p style={{
                    fontSize: "0.9375rem",
                    color: "#475569",
                    marginBottom: "1rem",
                    lineHeight: "1.5"
                  }}>
                    Please share the entire screen when prompted.
                  </p>
                  <button
                    onClick={startScreenShare}
                    style={{
                      padding: "0.75rem 1.5rem",
                      backgroundColor: "#00684A", // Emerald
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background-color 0.2s ease"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#084A2A"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
                  >
                    Start Screen Share
                  </button>
                </div>
              )}
              
              {steps[1].status === "running" && (
                <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                  {steps[1].message}
                </div>
              )}
              
              {steps[1].status === "passed" && (
                <div style={{ fontSize: "0.875rem", color: "#00684A", fontWeight: 500 }}>
                  {steps[1].message}
                </div>
              )}
              
              {steps[1].status === "failed" && (
                <div>
                  <div style={{ fontSize: "0.875rem", color: "#ef4444", marginBottom: "0.75rem" }}>
                    {steps[1].message}
                  </div>
                  <p style={{
                    fontSize: "0.9375rem",
                    color: "#475569",
                    marginBottom: "1rem",
                    lineHeight: "1.5"
                  }}>
                    Please share the entire screen when prompted.
                  </p>
                  <button
                    onClick={startScreenShare}
                    style={{
                      padding: "0.75rem 1.5rem",
                      backgroundColor: "#00684A", // Emerald
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background-color 0.2s ease"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#084A2A"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
                  >
                    Retry Screen Share
                  </button>
                </div>
              )}
            </div>
            
            {/* Step 3: Fullscreen Mode */}
            <div style={{
              border: `1px solid ${steps[2].status === "passed" ? "#E1F2E9" : steps[2].status === "failed" ? "#fecaca" : "#D1D5DB"}`,
              borderRadius: "0.5rem",
              padding: "1.5rem",
              backgroundColor: steps[0].status === "passed" ? "#E1F2E9" : 
                 steps[0].status === "failed" ? "#fef2f2" : "#F0F9F4"
            }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "50%",
                  backgroundColor: steps[2].status === "passed" ? "#00684A" : 
                                 steps[2].status === "failed" ? "#ef4444" : "#94a3b8",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  marginRight: "1rem"
                }}>
                  {steps[2].status === "passed" ? "✓" : steps[2].status === "failed" ? "✗" : "3"}
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#00684A" }}>
                  {steps[2].title}
                </h3>
              </div>
              
              {steps[2].status === "pending" && currentStep === 2 && (
                <button
                  onClick={enterFullscreen}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#00684A", // Emerald
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background-color 0.2s ease"
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#084A2A"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
                >
                  Enter Fullscreen
                </button>
              )}
              
              {steps[2].status === "running" && (
                <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                  {steps[2].message}
                </div>
              )}
              
              {steps[2].status === "passed" && (
                <div style={{ fontSize: "0.875rem", color: "#00684A", fontWeight: 500 }}>
                  {steps[2].message}
                </div>
              )}
              
              {steps[2].status === "failed" && (
                <div>
                  <div style={{ fontSize: "0.875rem", color: "#ef4444", marginBottom: "1rem" }}>
                    {steps[2].message}
                  </div>
                  <button
                    onClick={enterFullscreen}
                    style={{
                      padding: "0.75rem 1.5rem",
                      backgroundColor: "#00684A", // Emerald
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background-color 0.2s ease"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#084A2A"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
                  >
                    Retry Fullscreen
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Start Assessment Button */}
          {allStepsPassed && (
            <button
              onClick={handleStartAssessment}
              disabled={isStarting}
              className={`transition-all ${!isStarting ? "hover:bg-[#084A2A] hover:shadow-md" : ""}`}
              style={{
                width: "100%",
                padding: "1rem 2rem",
                backgroundColor: isStarting ? "#D1D5DB" : "#00684A", // Emerald green mapped to Tailwind bg-brand-primary
                color: isStarting ? "#6B7280" : "#ffffff",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "1.125rem",
                fontWeight: 500, // Tailwind font-medium
                cursor: isStarting ? "wait" : "pointer",
                boxShadow: isStarting ? "none" : "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem"
              }}
            >
              {isStarting ? (
                <>
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      border: "3px solid rgba(0, 104, 74, 0.2)", // Emerald transparent
                      borderTopColor: "#00684A", // Emerald solid
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite"
                    }}
                  />
                  <span>Starting Assessment...</span>
                </>
              ) : (
                <span>Start Assessment →</span>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Test Start Time Modal */}
      {showStartTimeModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
            onClick={(e) => {
              // Prevent closing by clicking outside - user must wait
              e.stopPropagation();
            }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "1rem",
              padding: "2rem",
              maxWidth: "500px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "4rem",
                  height: "4rem",
                  borderRadius: "50%",
                  backgroundColor: "#fef3c7", // Kept yellow/amber for waiting state
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1.5rem",
                }}
              >
                <svg
                  style={{ width: "2rem", height: "2rem", color: "#f59e0b" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "#00684A", // Emerald
                  marginBottom: "1rem",
                }}
              >
                Assessment Will Start Soon
              </h2>
              
              <p
                style={{
                  fontSize: "1rem",
                  color: "#64748b",
                  marginBottom: "1rem",
                  lineHeight: "1.6",
                }}
              >
                {testStartTime
                  ? `The assessment will start at ${new Date(testStartTime).toLocaleString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}.`
                  : "The assessment has not started yet. Please wait until the scheduled start time."}
              </p>
              
              {testStartTime && timeUntilStart > 0 && (
                <>
                  <div style={{
                    fontSize: "1.25rem",
                    color: "#1e293b",
                    marginBottom: "0.5rem",
                  }}>
                    Time remaining:
                  </div>
                  <div style={{
                    fontSize: "2rem",
                    color: "#00684A", // Emerald
                    fontWeight: 700,
                    marginBottom: "1.5rem",
                  }}>
                    {formatTime(timeUntilStart)}
                  </div>
                </>
              )}
              
              <button
                onClick={() => {
                  // Reload the page to check if start time has arrived
                  window.location.reload();
                }}
                className="transition-all hover:bg-[#084A2A] hover:shadow-md"
                style={{
                  padding: "0.75rem 2rem",
                  backgroundColor: "#00684A", // Emerald
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}