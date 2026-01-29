import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { getSession } from "next-auth/react";
import IdentityVerification from "@/proctoring/components/IdentityVerification";
import { getGateContext } from "@/lib/gateContext";
import { useAssessmentFull } from "@/hooks/api/useAssessments";

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
  const { data: assessmentData } = useAssessmentFull(assessmentId, assessmentToken);

  // Extract proctoring settings from assessment data
  useEffect(() => {
    if (assessmentData) {
      const assessment = assessmentData;
      const proctoringSettings = assessment?.schedule?.proctoringSettings || assessment?.proctoringSettings;
      const aiEnabled = proctoringSettings?.aiProctoringEnabled === true;
      const faceMismatch = proctoringSettings?.faceMismatchEnabled === true;
      
      setAiProctoringEnabled(aiEnabled);
      setFaceMismatchEnabled(faceMismatch);
      console.log('[Identity Verification Page] ✅ Proctoring settings loaded:', {
        aiProctoringEnabled: aiEnabled,
        faceMismatchEnabled: faceMismatch,
        hasProctoringSettings: !!proctoringSettings,
        proctoringSettings,
      });
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
          console.log('[Identity Verification Page] ✅ Loaded proctoring settings from sessionStorage:', {
            aiProctoringEnabled: aiEnabled,
            faceMismatchEnabled: faceMismatch,
          });
        } else {
          // Default to false if no data available
          setAiProctoringEnabled(false);
          setFaceMismatchEnabled(false);
        }
      } catch (e) {
        console.warn('[Identity Verification Page] Could not load from sessionStorage:', e);
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
    console.log("[IDENTITY-VERIFY] Instructions acknowledgment check", {
      instructionsAcknowledged: !!instructionsAcknowledged,
      id,
      token,
      timestamp: new Date().toISOString()
    });
    if (!instructionsAcknowledged && id && token) {
      const targetUrl = `/assessment/${id}/${token}/instructions-new`;
      console.log("[IDENTITY-VERIFY] 🔄 Instructions not acknowledged, navigating to instructions-new", {
        targetUrl,
        id,
        token
      });
      router.replace(targetUrl).catch((err) => {
        console.error("[IDENTITY-VERIFY] ❌ Navigation error:", {
          error: err,
          name: err?.name,
          message: err?.message,
          stack: err?.stack
        });
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
        // For Custom MCQ assessments, fetch assessment details to check schedule
        try {
          const apiBase = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:80"}/api/v1`;
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
                  console.log(`[Identity] Custom MCQ assessment not started yet. Current: ${now.toISOString()}, Start: ${startTime.toISOString()}`);
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
          // Proceed if schedule check fails
        }
      }
      
      // For DSA and AIML tests, check start time via test endpoints
      if (isDSATest || isAIMLTest) {
        const apiBase = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:80"}/api/v1`;
        const testEndpoint = isDSATest ? `/dsa/tests/${id}/public?user_id=${userId}` : `/aiml/tests/${id}/public?user_id=${userId}`;
        
        // CRITICAL: Always check test start time FIRST before attempting to start
        // This ensures the popup shows on this page itself
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
              // Normalize timezone - ensure we parse as UTC if it has 'Z' or timezone info
              let startTime: Date;
              if (startTimeStr.endsWith('Z') || startTimeStr.includes('+') || startTimeStr.includes('-', 10)) {
                // Has timezone info, parse as-is
                startTime = new Date(startTimeStr);
              } else {
                // No timezone info, assume UTC and append 'Z'
                startTime = new Date(startTimeStr + 'Z');
              }
              
              const now = new Date();
              
              // Check if test start time has been reached
              if (now < startTime) {
                // Test hasn't started yet - show modal and STOP here (don't proceed)
                console.log(`[Identity] Test not started yet. Current: ${now.toISOString()}, Start: ${startTime.toISOString()}`);
                setTestStartTime(startTimeStr);
                setShowStartTimeModal(true);
                setIsStarting(false); // Reset loading state
                return; // CRITICAL: Return early to prevent navigation
              } else {
                testHasStarted = true;
              }
            } else {
              // No start time configured - allow to proceed
              testHasStarted = true;
            }
          } else {
            console.warn("[Identity] Could not fetch test details, proceeding with start attempt");
            // If we can't fetch test details, proceed to backend validation
          }
        } catch (err) {
          console.error("[Identity] Error fetching test details:", err);
          // If fetch fails, proceed to backend validation as fallback
        }
        
        // Only proceed to start test if we've confirmed it has started (or no start time configured)
        // If test hasn't started, we should have already returned above
        if (startTimeStr && !testHasStarted) {
          // This shouldn't happen, but double-check
          setTestStartTime(startTimeStr);
          setShowStartTimeModal(true);
          return;
        }
      } else if (isAIAssessment) {
        // For AI assessments, check schedule via assessment endpoint
        try {
          const scheduleResponse = await fetch(`/api/assessment/get-schedule?assessmentId=${id}&token=${token}`);
          if (scheduleResponse.ok) {
            const scheduleData = await scheduleResponse.json();
            if (scheduleData.success && scheduleData.data?.schedule?.startTime) {
              startTimeStr = scheduleData.data.schedule.startTime;
              const examMode = scheduleData.data.schedule?.examMode || scheduleData.data?.examMode || "strict";
              
              // Normalize timezone
              if (!startTimeStr) {
                // If startTimeStr is null, skip time check
                return;
              }
              
              let startTime: Date;
              if (startTimeStr.endsWith('Z') || startTimeStr.includes('+') || startTimeStr.includes('-', 10)) {
                startTime = new Date(startTimeStr);
              } else {
                startTime = new Date(startTimeStr + 'Z');
              }
              
              const now = new Date();
              
              // For strict mode, check if assessment has started
              if (examMode === "strict") {
                if (now < startTime) {
                  // Assessment hasn't started yet - show waiting modal
                  console.log(`[Identity] Assessment not started yet. Current: ${now.toISOString()}, Start: ${startTime.toISOString()}, Time diff: ${(startTime.getTime() - now.getTime()) / 1000} seconds`);
                  setTestStartTime(startTimeStr);
                  setShowStartTimeModal(true);
                  setIsStarting(false);
                  return; // CRITICAL: Don't proceed to navigation
                } else {
                  testHasStarted = true;
                  console.log(`[Identity] Assessment has started. Current: ${now.toISOString()}, Start: ${startTime.toISOString()}`);
                }
              } else {
                // Flexible mode - allow to start (but still check window)
                const endTimeStr = scheduleData.data?.schedule?.endTime || scheduleData.data?.endTime;
                if (endTimeStr) {
                  let endTime: Date;
                  if (endTimeStr.endsWith('Z') || endTimeStr.includes('+') || endTimeStr.includes('-', 10)) {
                    endTime = new Date(endTimeStr);
                  } else {
                    endTime = new Date(endTimeStr + 'Z');
                  }
                  
                  if (now > endTime) {
                    // Window has closed
                    console.log(`[Identity] Flexible window has closed. Current: ${now.toISOString()}, End: ${endTime.toISOString()}`);
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
          // Proceed if schedule check fails
        }
      }
      
      // Try to start the test/assessment - backend will also validate start time
      let response: Response | null = null;
      
      if (isAIAssessment || isCustomMCQ) {
        // For AI assessments, attempt to call start-session (optional - may not exist)
        // If it fails, we'll proceed anyway since attempt is created when fetching questions
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
            // If start-session fails (404 or other error), log but continue
            // The attempt will be created when fetching questions in take-new.tsx
            console.warn("[Identity] Start-session endpoint returned error, but proceeding anyway:", response.status);
            response = null; // Treat as success - we'll proceed
          }
        } catch (err) {
          // If fetch fails (e.g., 404), that's okay - proceed anyway
          console.warn("[Identity] Start-session endpoint not available, proceeding to assessment:", err);
          response = null; // Treat as success - we'll proceed
        }
      } else if (isDSATest || isAIMLTest) {
        // Use DSA or AIML test start endpoint
        const apiBase = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:80"}/api/v1`;
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
          
          // Check if it's a "test not started yet" error (backend validation)
          if (response.status === 403 && (
            errorMessage.includes("will start at") || 
            errorMessage.includes("not available yet") || 
            errorMessage.includes("not started") || 
            errorMessage.includes("Test will start") ||
            errorMessage.includes("Test not available")
          )) {
            // Backend also says test hasn't started - show modal
            if (!startTimeStr) {
              // Try to fetch start time again if we don't have it
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
            setIsStarting(false); // Reset loading state
            return; // Stop here, don't navigate
          }
          
          // For other errors, just log and don't navigate
          console.error("[Identity] Error starting test:", errorMessage);
          setIsStarting(false); // Reset loading state
          return;
        }
      } else if (isCustomMCQ) {
        // Custom MCQ assessments don't have a start endpoint - just proceed to navigation
        response = null; // No start endpoint call needed
      }
      
      // Test/Assessment can start - proceed with navigation
      // Store verification completion
      sessionStorage.setItem(`identityVerificationCompleted_${id}`, "true");
      
      // Store screen stream globally so take.tsx can access it for screen snapshots
      if (screenStream && screenStream.active) {
        (window as any).__screenStream = screenStream;
        console.log('[Identity] Screen stream stored globally for take.tsx');
      }
      
      // Navigate to exam (flow-aware)
      // Note: Keep loading state true during navigation - it will reset when page changes
      await router.push(ctx?.finalTakeUrl || `/assessment/${id}/${token}/take`);
    } catch (error) {
      console.error("[Identity] Error checking test start time:", error);
      setIsStarting(false); // Reset loading state on error
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
          // Start time arrived - reload page to start assessment
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
        backgroundColor: "#f7f3e8",
        padding: "2rem"
      }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          padding: "2rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
        }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem" }}>
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
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
              padding: "1.5rem",
              backgroundColor: steps[0].status === "passed" ? "#f0fdf4" : 
                             steps[0].status === "failed" ? "#fef2f2" : "#f9fafb"
            }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "50%",
                  backgroundColor: steps[0].status === "passed" ? "#10b981" : 
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
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#1e293b" }}>
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
                  <div style={{ fontSize: "0.875rem", color: "#10b981" }}>
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
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
              padding: "1.5rem",
              backgroundColor: steps[1].status === "passed" ? "#f0fdf4" : 
                             steps[1].status === "failed" ? "#fef2f2" : "#f9fafb"
            }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "50%",
                  backgroundColor: steps[1].status === "passed" ? "#10b981" : 
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
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#1e293b" }}>
                  {steps[1].title}
                </h3>
              </div>
              
              {steps[1].status === "pending" && currentStep === 1 && (
                <button
                  onClick={startScreenShare}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#6953a3",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Start Screen Share
                </button>
              )}
              
              {steps[1].status === "running" && (
                <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                  {steps[1].message}
                </div>
              )}
              
              {steps[1].status === "passed" && (
                <div style={{ fontSize: "0.875rem", color: "#10b981" }}>
                  {steps[1].message}
                </div>
              )}
              
              {steps[1].status === "failed" && (
                <div>
                  <div style={{ fontSize: "0.875rem", color: "#ef4444", marginBottom: "1rem" }}>
                    {steps[1].message}
                  </div>
                  <button
                    onClick={startScreenShare}
                    style={{
                      padding: "0.75rem 1.5rem",
                      backgroundColor: "#6953a3",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Retry Screen Share
                  </button>
                </div>
              )}
            </div>
            
            {/* Step 3: Fullscreen Mode */}
            <div style={{
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
              padding: "1.5rem",
              backgroundColor: steps[2].status === "passed" ? "#f0fdf4" : 
                             steps[2].status === "failed" ? "#fef2f2" : "#f9fafb"
            }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "50%",
                  backgroundColor: steps[2].status === "passed" ? "#10b981" : 
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
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#1e293b" }}>
                  {steps[2].title}
                </h3>
              </div>
              
              {steps[2].status === "pending" && currentStep === 2 && (
                <button
                  onClick={enterFullscreen}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#6953a3",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
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
                <div style={{ fontSize: "0.875rem", color: "#10b981" }}>
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
                      backgroundColor: "#6953a3",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
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
              style={{
                width: "100%",
                padding: "1rem 2rem",
                backgroundColor: isStarting ? "#6ee7b7" : "#10b981",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "1.125rem",
                fontWeight: 600,
                cursor: isStarting ? "wait" : "pointer",
                boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.3)",
                opacity: isStarting ? 0.8 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                transition: "all 0.2s ease"
              }}
            >
              {isStarting ? (
                <>
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      border: "3px solid rgba(255, 255, 255, 0.3)",
                      borderTopColor: "#ffffff",
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
                  backgroundColor: "#fef3c7",
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
                  color: "#1e293b",
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
                    color: "#3b82f6",
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
                style={{
                  padding: "0.75rem 2rem",
                  backgroundColor: "#6953a3",
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
