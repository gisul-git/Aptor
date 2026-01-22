import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { CameraProctorModal } from "../../../components/proctor";
import { useCameraProctor } from "@/hooks/proctoring/useCameraProctor";
import dsaApi from "../../../lib/dsa/api";
import axios from "axios";

export default function TestInstructionsPage() {
  const router = useRouter();
  const { id: testId, token, user_id } = router.query;
  const [acknowledged, setAcknowledged] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [showCameraPrompt, setShowCameraPrompt] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [testInfo, setTestInfo] = useState<{title: string, description: string} | null>(null);

  // Camera proctoring hook
  const {
    startCamera,
    stopCamera,
    errors: cameraErrors,
  } = useCameraProctor({
    userId: email || userId || "",
    assessmentId: (testId as string) || "",
    enabled: true,
  });

  const fetchTestRef = useRef(false); // Prevent multiple fetches
  const preloadQuestionsRef = useRef(false); // Prevent multiple question preloads

  // Preload questions function - fetches all questions and stores in sessionStorage
  // Defined before useEffect to ensure it's accessible
  const preloadQuestions = useCallback(async (userId: string, testId: string, questionIds: string[]) => {
    try {
      console.log(`[Instructions] Preloading ${questionIds.length} questions for test ${testId}...`);
      
      // Fetch all questions in parallel
      const questionPromises = questionIds.map(async (qId: string) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout per question
          
          try {
            const response = await dsaApi.get(`/tests/${testId}/question/${qId}?user_id=${userId}`, {
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response.data;
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError' || fetchError.code === 'ECONNABORTED') {
              console.warn(`[Instructions] Question ${qId} request timed out`);
              return null;
            }
            if (fetchError.response?.status === 404) {
              console.warn(`[Instructions] Question ${qId} not found (404)`);
              return null;
            }
            throw fetchError;
          }
        } catch (error: any) {
          console.warn(`[Instructions] Question ${qId} fetch error:`, error.message);
          return null;
        }
      });
      
      const questionResults = await Promise.all(questionPromises);
      const questionsData = questionResults.filter((q): q is any => q !== null);
      
      // Store preloaded questions in sessionStorage
      const storageKey = `preloaded_questions_${testId}_${userId}`;
      const preloadData = {
        questions: questionsData,
        timestamp: Date.now(),
        testId: testId,
        userId: userId
      };
      
      sessionStorage.setItem(storageKey, JSON.stringify(preloadData));
      console.log(`[Instructions] Preloaded ${questionsData.length} questions successfully. Stored in sessionStorage as: ${storageKey}`);
      
      return questionsData;
    } catch (error: any) {
      console.error("[Instructions] Error preloading questions:", error);
      throw error;
    }
  }, []);

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("candidateEmail");
    const storedName = sessionStorage.getItem("candidateName");
    const storedUserId = sessionStorage.getItem("candidateUserId");
    
    setEmail(storedEmail);
    setName(storedName);
    setUserId(storedUserId || (user_id as string) || null);

    if (!storedEmail || !storedName || (!storedUserId && !user_id)) {
      if (testId && token) {
        router.replace(`/test/${testId}?token=${encodeURIComponent(token as string)}`);
      }
      return;
    }
    
    setIsCheckingSession(false);
    
    // Fetch test info and preload questions
    const finalUserId = storedUserId || (user_id as string);
    if (testId && finalUserId && !fetchTestRef.current && !testInfo) {
      fetchTestRef.current = true;
      const fetchTest = async () => {
        try {
          // Use public endpoint (no admin auth required) - same as take page
          const response = await dsaApi.get(`/tests/${testId}/public?user_id=${finalUserId}`);
          if (response.data) {
            const testData = response.data;
            setTestInfo({
              title: testData.title || "DSA Test",
              description: testData.description || "",
            });
            
            // Preload questions in the background (Option 2: Preload on instructions page mount)
            if (testData.question_ids && testData.question_ids.length > 0 && !preloadQuestionsRef.current) {
              preloadQuestionsRef.current = true;
              console.log(`[Instructions] Starting question preload for ${testData.question_ids.length} questions...`);
              preloadQuestions(finalUserId, testId as string, testData.question_ids)
                .then((questions) => {
                  console.log(`[Instructions] Successfully preloaded ${questions?.length || 0} questions`);
                })
                .catch(err => {
                  console.error("[Instructions] Error preloading questions:", err);
                  console.error("[Instructions] Error details:", {
                    message: err.message,
                    response: err.response?.data,
                    status: err.response?.status
                  });
                  preloadQuestionsRef.current = false; // Allow retry on error
                });
            } else {
              console.log(`[Instructions] Skipping preload:`, {
                hasQuestionIds: !!testData.question_ids,
                questionCount: testData.question_ids?.length || 0,
                alreadyPreloaded: preloadQuestionsRef.current
              });
            }
          }
        } catch (err) {
          console.error("Error fetching test:", err);
          fetchTestRef.current = false; // Allow retry on error
        }
      };
      fetchTest();
    }
  }, [testId, token, user_id, preloadQuestions]); // Added preloadQuestions to dependencies

  // Record proctoring event
  const recordProctorEvent = useCallback(async (eventType: string, metadata?: Record<string, unknown>) => {
    if (!testId || !email) return;
    
    try {
      const response = await fetch("/api/proctor/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          timestamp: new Date().toISOString(),
          assessmentId: testId,
          userId: email,
          metadata,
        }),
      });
      
      if (!response.ok) {
        console.error("[Proctor] Failed to record event:", response.statusText);
      }
    } catch (error) {
      console.error("[Proctor] Error recording event:", error);
    }
  }, [testId, email]);

  // Start candidate session (record startedAt in backend)
  const startSession = useCallback(async (): Promise<boolean> => {
    if (!testId || !token || !email || !name || !userId) return false;
    
    try {
      // Start the test (this sets started_at)
      await dsaApi.post(`/tests/${testId}/start?user_id=${userId}`);
      return true;
    } catch (error) {
      console.error("[Session] Error starting session:", error);
      return false;
    }
  }, [testId, token, email, name, userId]);

  // Fullscreen handling removed - will be handled on take page after refresh

  // Handle camera permission request with reference photo
  const handleRequestCamera = useCallback(async (referencePhoto: string): Promise<boolean> => {
    try {
      const success = await startCamera();
      if (success) {
        // Store camera consent and reference photo in session
        sessionStorage.setItem("cameraAccepted", "true");
        sessionStorage.setItem("candidateReferencePhoto", referencePhoto);
        await recordProctorEvent("CAMERA_ACCEPTED");
        setShowCameraPrompt(false);
        return true;
      } else {
        setCameraError("Failed to start camera");
        await recordProctorEvent("CAMERA_DENIED", { error: "User denied or error occurred" });
        return false;
      }
    } catch (error: any) {
      console.error("[Camera] Error:", error);
      setCameraError(error.message || "Failed to start camera");
      await recordProctorEvent("CAMERA_ERROR", { error: error.message });
      return false;
    }
  }, [startCamera, recordProctorEvent]);

  // Handle starting the test
  // NOTE: We DON'T start the test session here - it will be started when the editor becomes visible
  // This prevents the timer from counting down during page loading
  const handleStartTest = useCallback(async () => {
    if (!acknowledged || isStarting) return;
    
    setIsStarting(true);
    
    try {
      // Store flag to start test when editor is visible (in take page)
      // Don't start the timer yet - wait for editor to be visible
      sessionStorage.setItem("shouldStartTest", "true");
      sessionStorage.setItem("testStartTime", new Date().toISOString());
      
      // Navigate to test page - it will load first, then auto-refresh, then enter fullscreen
      router.push(`/test/${testId}/take?token=${encodeURIComponent(token as string)}&user_id=${encodeURIComponent(userId || "")}`);
    } catch (error) {
      console.error("[Start] Error:", error);
      alert("Failed to start test. Please try again.");
      setIsStarting(false);
    }
  }, [acknowledged, isStarting, router, testId, token, userId]);

  // Don't check fullscreen on instructions page - fullscreen will be handled on take page after refresh
  // The instructions page should only show instructions and "Start Test" button

  // Check camera status on mount
  useEffect(() => {
    const checkCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        sessionStorage.setItem("cameraAccepted", "true");
      } catch (error) {
        const accepted = sessionStorage.getItem("cameraAccepted");
        if (accepted !== "true") {
          setShowCameraPrompt(true);
        }
      }
    };
    
    if (!isCheckingSession) {
      checkCamera();
    }
  }, [isCheckingSession]);

  if (isCheckingSession) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" }}>
        <div style={{ textAlign: "center", color: "#94a3b8" }}>
          <div style={{ marginBottom: "1rem" }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", padding: "2rem" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <h1 style={{ color: "#ffffff", fontSize: "2rem", marginBottom: "0.5rem" }}>
            Test Instructions
          </h1>
          {testInfo && (
            <>
              <p style={{ color: "#94a3b8", fontSize: "1.125rem", marginBottom: "0.5rem" }}>
                {testInfo.title}
              </p>
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                {testInfo.description}
              </p>
            </>
          )}
        </div>

        <div style={{ 
          backgroundColor: "#1e293b", 
          borderRadius: "0.5rem", 
          padding: "2rem",
          marginBottom: "2rem"
        }}>
          <h2 style={{ color: "#ffffff", fontSize: "1.5rem", marginBottom: "1rem" }}>
            Important Instructions
          </h2>
          
          <ul style={{ color: "#94a3b8", lineHeight: "1.8", listStyle: "disc", paddingLeft: "1.5rem" }}>
            <li>Ensure you have a stable internet connection</li>
            <li>Close all unnecessary applications and browser tabs</li>
            <li>Do not switch tabs or minimize the browser window during the test</li>
            <li>Keep your camera and microphone enabled throughout the test</li>
            <li>Do not use any external resources or communication tools</li>
            <li>Read each question carefully before answering</li>
            <li>You can navigate between questions using the sidebar</li>
            <li>The timer will start once you begin the test</li>
            <li>Submit your answers before the time expires</li>
          </ul>
        </div>

        <div style={{ 
          backgroundColor: "#1e293b", 
          borderRadius: "0.5rem", 
          padding: "2rem",
          marginBottom: "2rem"
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              style={{ width: "1.25rem", height: "1.25rem", cursor: "pointer" }}
            />
            <span style={{ color: "#94a3b8" }}>
              I have read and understood all the instructions and agree to follow the test guidelines.
            </span>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={handleStartTest}
            disabled={!acknowledged || isStarting}
            style={{
              padding: "0.75rem 2rem",
              backgroundColor: acknowledged && !isStarting ? "#3b82f6" : "#475569",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: acknowledged && !isStarting ? "pointer" : "not-allowed",
              fontWeight: "600",
              fontSize: "1rem",
              opacity: acknowledged && !isStarting ? 1 : 0.5,
            }}
          >
            {isStarting ? "Starting..." : "Start Test"}
          </button>
        </div>
      </div>

      {/* Fullscreen prompt removed - will be shown on take page after refresh */}

      {/* Camera Prompt */}
      {showCameraPrompt && (
        <CameraProctorModal
          isOpen={showCameraPrompt}
          onAccept={handleRequestCamera}
          cameraError={cameraError}
        />
      )}
    </div>
  );
}

