import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { CustomMCQAssessment, MCQQuestion, SubjectiveQuestion, CodingQuestion, Question } from "../../../types/custom-mcq";

// Lazy load Monaco Editor
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px", backgroundColor: "#1e1e1e", color: "#fff" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "40px", height: "40px", border: "4px solid #3b82f6", borderTop: "4px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
        <p>Loading code editor...</p>
      </div>
    </div>
  ),
});
import { useUniversalProctoring, CandidateLiveService, resolveUserIdForProctoring, type ProctoringViolation } from "@/universal-proctoring";
import WebcamPreview from "../../../components/WebcamPreview";
import { ViolationToast, pushViolationToast } from "@/components/ViolationToast";
import { FullscreenLockOverlay } from "@/components/FullscreenLockOverlay";
import { useFullscreenLock } from "@/hooks/proctoring/useFullscreenLock";
import { useCustomMCQAssessmentForTaking, useVerifyCustomMCQCandidate, useSaveCustomMCQAnswerLog, useSubmitCustomMCQAssessment } from "@/hooks/api/useCustomMCQ";
// (import kept intentionally for future gateContext-based routing; currently enforced via sessionStorage flags)

export default function CustomMCQTakePage() {
  const router = useRouter();
  const { assessmentId: assessmentIdParam, token: tokenParam } = router.query;
  const assessmentId = typeof assessmentIdParam === 'string' ? assessmentIdParam : undefined;
  const token = typeof tokenParam === 'string' ? tokenParam : undefined;
  
  // React Query hooks
  const [candidateEmail, setCandidateEmail] = useState<string>("");
  const [candidateName, setCandidateName] = useState<string>("");
  const { data: assessmentData, isLoading: isLoadingAssessment, error: assessmentError, refetch: refetchAssessment } = useCustomMCQAssessmentForTaking(
    assessmentId,
    token,
    candidateEmail || undefined,
    candidateName || undefined
  );
  const verifyCandidateMutation = useVerifyCustomMCQCandidate();
  const saveAnswerLogMutation = useSaveCustomMCQAnswerLog();
  const submitAssessmentMutation = useSubmitCustomMCQAssessment();
  
  const [assessment, setAssessment] = useState<CustomMCQAssessment | null>(null);
  
  // Update assessment from React Query data and handle initialization
  useEffect(() => {
    if (assessmentData) {
      setAssessment(assessmentData);
      setError(null); // Clear any previous errors
      
      // Only process assessment data if we have candidate info (after verification)
      if (candidateEmail && candidateName) {
        // Apply runtime camera toggle based on admin proctoring setting:
        // Only explicit true enables camera/model; missing/false => OFF (per PROCTORING_AI_TOGGLE_NOTES.md)
        const aiEnabled = (assessmentData as any)?.proctoringSettings?.aiProctoringEnabled === true;
        setCameraProctorEnabled(aiEnabled);
        // Set Live Proctoring enabled state
        const liveEnabled = (assessmentData as any)?.proctoringSettings?.liveProctoringEnabled === true;
        setProctoringEnabled(liveEnabled);

        // NEW IMPLEMENTATION: Use accessControl from backend
        const accessControl = assessmentData.accessControl;
        const schedule = assessmentData.schedule || {};
        const startTimeStr = schedule.startTime || assessmentData.startTime;
        
        if (accessControl) {
          if (!accessControl.canAccess) {
            // Cannot access - show error message
            setError(accessControl.errorMessage || "You cannot access this assessment at this time.");
            setWaitingForStart(false);
            setExamStarted(false);
            setTimeRemaining(null);
            return;
          }
          
          if (accessControl.waitingForStart) {
            // Can access but waiting for start (strict mode - pre-check phase)
            if (startTimeStr) {
              const startTime = new Date(startTimeStr);
              setWaitingForStart(true);
              setStartTime(startTime);
              setExamStarted(false);
              setTimeRemaining(null);
              setError(null); // Clear error, show waiting message in UI
            }
            return;
          }
          
          if (accessControl.examStarted) {
            // Exam has started (both strict and flexible mode now auto-start)
            setWaitingForStart(false);
            setExamStarted(true);
            
            // Initialize per-section timers if enabled
            const enablePerSectionTimers = (assessmentData as any).enablePerSectionTimers || false;
            const sectionTimersConfig = (assessmentData as any).sectionTimers || {};
            
            if (enablePerSectionTimers && sectionTimersConfig) {
              // Convert minutes to seconds for timers
              const mcqSeconds = (sectionTimersConfig.MCQ || 20) * 60;
              const subjectiveSeconds = (sectionTimersConfig.Subjective || 30) * 60;
              const totalDurationSeconds = mcqSeconds + subjectiveSeconds;
              
              setSectionTimers({ MCQ: mcqSeconds, Subjective: subjectiveSeconds });
              // Set global timer to total duration (sum of section timers)
              setTimeRemaining(totalDurationSeconds);
            } else {
              // Use regular duration timer
              const schedule = assessmentData.schedule || {};
              const duration = schedule.duration || assessmentData.duration;
              if (duration) {
                setTimeRemaining(duration * 60); // Convert minutes to seconds
              } else {
                setTimeRemaining(accessControl.timeRemaining || null);
              }
            }
            
            setStartedAt(new Date());
            setError(null);
          } else if (accessControl.canStart) {
            // Can start - this shouldn't happen now as flexible mode auto-starts
            // But keep as fallback
            setWaitingForStart(false);
            setExamStarted(true);
            
            // Initialize per-section timers if enabled
            const enablePerSectionTimers = (assessmentData as any).enablePerSectionTimers || false;
            const sectionTimersConfig = (assessmentData as any).sectionTimers || {};
            
            if (enablePerSectionTimers && sectionTimersConfig) {
              // Convert minutes to seconds for timers
              const mcqSeconds = (sectionTimersConfig.MCQ || 20) * 60;
              const subjectiveSeconds = (sectionTimersConfig.Subjective || 30) * 60;
              const totalDurationSeconds = mcqSeconds + subjectiveSeconds;
              
              setSectionTimers({ MCQ: mcqSeconds, Subjective: subjectiveSeconds });
              // Set global timer to total duration (sum of section timers)
              setTimeRemaining(totalDurationSeconds);
            } else {
              setTimeRemaining(accessControl.timeRemaining || null);
            }
            
            setStartedAt(new Date());
            setError(null);
          }
        }
      }
    } else if (assessmentError && candidateEmail && candidateName) {
      // Only show error if we have candidate info (after verification attempt)
      setError(assessmentError.message || "Failed to load assessment data");
    }
  }, [assessmentData, assessmentError, candidateEmail, candidateName]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({}); // For MCQ answers
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({}); // For subjective answers
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({}); // For coding answers
  
  // Use refs to always access the latest state values in callbacks
  const answersRef = useRef<Record<string, string[]>>({});
  const textAnswersRef = useRef<Record<string, string>>({});
  const codeAnswersRef = useRef<Record<string, string>>({});
  
  // Track previous answers to detect changes for logging
  const previousTextAnswersRef = useRef<Record<string, string>>({});
  
  // Keep refs in sync with state
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  
  useEffect(() => {
    textAnswersRef.current = textAnswers;
  }, [textAnswers]);
  
  useEffect(() => {
    codeAnswersRef.current = codeAnswers;
  }, [codeAnswers]);
  
  // Sequential flow: MCQ first, then Subjective
  const [assessmentPhase, setAssessmentPhase] = useState<"mcq" | "subjective" | "coding">("mcq");
  const assessmentPhaseRef = useRef<"mcq" | "subjective">("mcq");
  const [mcqSubmitted, setMcqSubmitted] = useState(false);
  const [codingSubmitted, setCodingSubmitted] = useState(false);
  
  // Keep ref in sync with state
  useEffect(() => {
    assessmentPhaseRef.current = assessmentPhase;
  }, [assessmentPhase]);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  // Per-section timer state
  const [sectionTimers, setSectionTimers] = useState<{ MCQ: number; Subjective: number; Coding: number }>({ MCQ: 0, Subjective: 0, Coding: 0 }); // in seconds
  const [lockedSections, setLockedSections] = useState<Set<"mcq" | "subjective" | "coding">>(new Set());
  const sectionTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [candidateInfo, setCandidateInfo] = useState<{ name: string; email: string } | null>(null);
  const [waitingForStart, setWaitingForStart] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [examStarted, setExamStarted] = useState(false); // Track if exam has been manually started (for flexible mode)
  const [cameraProctorEnabled, setCameraProctorEnabled] = useState(true);
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [liveProctorScreenStream, setLiveProctorScreenStream] = useState<MediaStream | null>(null);
  const [showMCQLockWarning, setShowMCQLockWarning] = useState(false);
  const [showCodingLockWarning, setShowCodingLockWarning] = useState(false);
  const [pendingNavigationIndex, setPendingNavigationIndex] = useState<number | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  // Proctoring refs
  const thumbVideoRef = useRef<HTMLVideoElement>(null);
  const liveProctoringServiceRef = useRef<CandidateLiveService | null>(null);
  const liveProctoringStartedRef = useRef(false);
  const startSessionCalledRef = useRef(false); // Guard: prevent multiple start-session calls
  const candidateWsRef = useRef<WebSocket | null>(null); // Store candidate WebSocket to pass to service
  const candidateSessionIdRef = useRef<string | null>(null); // Store sessionId to pass to service
  const lastProcessedRef = useRef<{ assessmentId: string; token: string } | null>(null); // Track last processed assessmentId/token to prevent redundant calls

  const getViolationMessage = (eventType: string): string => {
    const messages: Record<string, string> = {
      GAZE_AWAY: "Please keep your eyes on the screen",
      MULTIPLE_FACES_DETECTED: "Multiple faces detected in frame",
      NO_FACE_DETECTED: "Please stay in front of the camera",
      TAB_SWITCH: "Tab switch detected",
      FOCUS_LOST: "Window focus lost",
      FULLSCREEN_EXIT: "Exited fullscreen mode",
    };
    return messages[eventType] || "Violation detected";
  };

  // ========================
  // FULLSCREEN LOCK - Violation-driven lock state (SIMPLIFIED)
  // ========================
  const {
    isLocked: isFullscreenLocked,
    setIsLocked: setFullscreenLocked,
    exitCount: fullscreenExitCount,
    incrementExitCount: incrementFullscreenExitCount,
    requestFullscreen: requestFullscreenLock,
  } = useFullscreenLock();

  // Handle violation callback from universal proctoring
  // THIS IS THE SINGLE SOURCE OF TRUTH for fullscreen lock triggering
  const handleUniversalViolation = useCallback((violation: ProctoringViolation) => {
    console.log('[Custom MCQ Take] Universal proctoring violation:', violation);
    
    // Show toast for all violations
    pushViolationToast({
      id: `${violation.eventType}-${Date.now()}`,
      eventType: violation.eventType,
      message: getViolationMessage(violation.eventType),
      timestamp: violation.timestamp,
    });

    // FULLSCREEN_EXIT violation triggers the fullscreen lock overlay (only when AI Proctoring enabled)
    if (violation.eventType === 'FULLSCREEN_EXIT' && cameraProctorEnabled) {
      console.log('[Custom MCQ Take] FULLSCREEN_EXIT violation - locking screen');
      setFullscreenLocked(true);
      incrementFullscreenExitCount();
    }
  }, [setFullscreenLocked, incrementFullscreenExitCount, cameraProctorEnabled]);

  // Handle fullscreen re-entry - unlock the screen
  const handleRequestFullscreen = useCallback(async (): Promise<boolean> => {
    console.log('[Custom MCQ Take] Requesting fullscreen re-entry...');
    const success = await requestFullscreenLock();
    if (success) {
      console.log('[Custom MCQ Take] Fullscreen re-entered - unlocking screen');
      setFullscreenLocked(false);
    }
    return success;
  }, [requestFullscreenLock, setFullscreenLocked]);

  // Universal proctoring hook - handles AI proctoring, tab switch, fullscreen
  const {
    state: proctoringState,
    isRunning: isProctoringRunning,
    violations,
    startProctoring: startUniversalProctoring,
    stopProctoring: stopUniversalProctoring,
    requestFullscreen: requestUniversalFullscreen,
    isFullscreen,
  } = useUniversalProctoring({
    onViolation: handleUniversalViolation,
    debug: debugMode,
  });

  // Get screen stream from window.__screenStream (set by identity-verify gate)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__screenStream) {
      const stream = (window as any).__screenStream as MediaStream;
      if (stream && stream.active && stream.getVideoTracks().length > 0) {
        setLiveProctorScreenStream(stream);
        console.log('[Custom MCQ Take] Found global screen stream for Live Proctoring');
      }
    }
  }, []);

  // Start proctoring when exam starts (AI proctoring + tab switch + fullscreen)
  useEffect(() => {
    const assessmentIdStr = String(assessmentId || '');
    // Resolve userId with priority: email > anonymous
    // Note: session.user.id would be ideal but requires SessionProvider context
    const candidateIdStr = resolveUserIdForProctoring(null, {
      email: candidateInfo?.email,
    });
    
    if (examStarted && !isProctoringRunning && !submitting && assessmentIdStr && thumbVideoRef.current) {
      console.log('[Custom MCQ Take] Starting Universal Proctoring...');
      
      startUniversalProctoring({
        settings: {
          aiProctoringEnabled: cameraProctorEnabled,
          liveProctoringEnabled: proctoringEnabled,
        },
        session: {
          userId: candidateIdStr,
          assessmentId: assessmentIdStr,
        },
        videoElement: cameraProctorEnabled ? thumbVideoRef.current : null,
      }).then((success) => {
        if (success) {
          console.log('[Custom MCQ Take] ✅ Universal Proctoring started');
        } else {
          console.error('[Custom MCQ Take] ❌ Failed to start Universal Proctoring');
        }
      });
    }
  }, [examStarted, isProctoringRunning, submitting, assessmentId, candidateInfo?.email, cameraProctorEnabled, proctoringEnabled, startUniversalProctoring]);

  // ✅ PHASE 2.4: Lazy start function (called only when admin connects)
  const startLiveProctoring = useCallback((sessionId: string, ws: WebSocket) => {
    if (liveProctoringStartedRef.current) {
      console.log('[Custom MCQ Take] Live Proctoring already started');
      return;
    }

    const assessmentIdStr = String(assessmentId || '');
    const candidateIdStr = resolveUserIdForProctoring(null, {
      email: candidateInfo?.email,
    });

    console.log('[Custom MCQ Take] 🚀 Admin connected! Starting WebRTC...');
    liveProctoringStartedRef.current = true;

    // Extract raw candidateId for live proctoring (remove email: or public: prefix)
    // Live proctoring backend expects raw email or token, not formatted userId
    let rawCandidateId = candidateIdStr;
    if (candidateIdStr.startsWith('email:')) {
      rawCandidateId = candidateIdStr.replace('email:', '');
    } else if (candidateIdStr.startsWith('public:')) {
      rawCandidateId = candidateIdStr.replace('public:', '');
    }

    const liveService = new CandidateLiveService({
      assessmentId: assessmentIdStr,
      candidateId: rawCandidateId, // Use raw email/token for live proctoring
      debugMode: debugMode,
    });

    const existingWebcamStream = thumbVideoRef.current?.srcObject as MediaStream | null;

    liveService.start(
      {
        onStateChange: (state) => {
          console.log('[Custom MCQ Take] Live proctoring state:', state);
        },
        onError: (error) => {
          console.error('[Custom MCQ Take] Live Proctoring error:', error);
        },
      },
      liveProctorScreenStream,
      existingWebcamStream,
      sessionId, // Pass existing sessionId
      ws // Pass existing WebSocket
    ).then((success) => {
      if (success) {
        console.log('[Custom MCQ Take] ✅ Live Proctoring WebRTC connected');
        liveProctoringServiceRef.current = liveService;
      } else {
        console.error('[Custom MCQ Take] ❌ Failed to start Live Proctoring');
        liveProctoringStartedRef.current = false;
      }
    });
  }, [assessmentId, candidateInfo?.email, debugMode, liveProctorScreenStream]);

  // ✅ PHASE 2: Lazy WebRTC - Register session and wait for admin signal
  useEffect(() => {
    const assessmentIdStr = String(assessmentId || '');
    const candidateIdStr = resolveUserIdForProctoring(null, {
      email: candidateInfo?.email,
    });

    // Check all conditions
    if (!proctoringEnabled || !liveProctorScreenStream || !examStarted || submitting || !assessmentIdStr || !candidateIdStr) {
      return;
    }

    // Guard: Ensure start-session is called only once per candidate per test
    if (startSessionCalledRef.current) {
      console.log('[Custom MCQ Take] ⏭️ start-session already called, skipping to prevent duplicate sessions');
      return;
    }

    // Mark as called immediately to prevent race conditions
    startSessionCalledRef.current = true;

    // Register live session (backend sets status to "candidate_initiated")
    console.log('[Custom MCQ Take] 📝 Registering Live Proctoring session...');
    
    // Phase 2.2: Register session with backend
    // Extract raw candidateId for live proctoring (remove email: or public: prefix)
    let rawCandidateId = candidateIdStr;
    if (candidateIdStr.startsWith('email:')) {
      rawCandidateId = candidateIdStr.replace('email:', '');
    } else if (candidateIdStr.startsWith('public:')) {
      rawCandidateId = candidateIdStr.replace('public:', '');
    }

    fetch('/api/v1/proctor/live/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentId: assessmentIdStr,
        candidateId: rawCandidateId, // Use raw email/token for live proctoring
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.sessionId) {
          const sessionId = data.data.sessionId;
          candidateSessionIdRef.current = sessionId;
          console.log(`[Custom MCQ Take] ✅ Session registered: ${sessionId}`);

          // Phase 2.3: Connect WebSocket and listen for ADMIN_CONNECTED
          // CRITICAL FIX: Use backend URL instead of frontend URL
          // Use rawCandidateId (without email: or public: prefix) for WebSocket URL
          const { LIVE_PROCTORING_ENDPOINTS } = require("@/universal-proctoring/live/types");
          const wsUrl = LIVE_PROCTORING_ENDPOINTS.candidateWs(sessionId, rawCandidateId);
          console.log('[Custom MCQ Take] Candidate WS connecting to backend...', wsUrl);
          const ws = new WebSocket(wsUrl);
          candidateWsRef.current = ws;

          ws.onopen = () => {
            console.log('[Custom MCQ Take] ✅ WebSocket connected, waiting for admin...');
            
            // CRITICAL FIX: Wait for camera stream to be available before starting WebRTC
            // The camera is initialized by useUniversalProctoring, so we need to wait for it
            let retryCount = 0;
            const maxRetries = 20; // 10 seconds max wait (20 * 500ms)
            
            const checkCameraAndStart = () => {
              const webcamStream = thumbVideoRef.current?.srcObject as MediaStream | null;
              if (webcamStream && webcamStream.active) {
                console.log('[Custom MCQ Take] ✅ Camera stream available - ready for admin connection');
                // Don't start yet - wait for ADMIN_CONNECTED signal
              } else if (retryCount < maxRetries) {
                retryCount++;
                console.log(`[Custom MCQ Take] ⏳ Waiting for camera stream... (attempt ${retryCount}/${maxRetries})`);
                setTimeout(checkCameraAndStart, 500);
              } else {
                console.warn('[Custom MCQ Take] ⚠️ Camera stream not available after 10 seconds - will start when admin connects');
              }
            };
            
            // Start checking immediately
            checkCameraAndStart();
          };

          ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'ADMIN_CONNECTED') {
              console.log('[Custom MCQ Take] 🚀 ADMIN_CONNECTED signal received!');
              
              // CRITICAL FIX: Wait for camera stream before starting WebRTC
              const webcamStream = thumbVideoRef.current?.srcObject as MediaStream | null;
              if (webcamStream && webcamStream.active) {
                console.log('[Custom MCQ Take] ✅ Camera stream ready - starting WebRTC...');
                startLiveProctoring(sessionId, ws);
              } else {
                // Retry with exponential backoff
                let retryCount = 0;
                const maxRetries = 10;
                const checkAndStart = () => {
                  const stream = thumbVideoRef.current?.srcObject as MediaStream | null;
                  if (stream && stream.active) {
                    console.log('[Custom MCQ Take] ✅ Camera stream now available - starting WebRTC...');
                    startLiveProctoring(sessionId, ws);
                  } else if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`[Custom MCQ Take] ⏳ Waiting for camera stream before starting WebRTC... (attempt ${retryCount}/${maxRetries})`);
                    setTimeout(checkAndStart, 500);
                  } else {
                    console.error('[Custom MCQ Take] ❌ Camera stream not available after retries - starting WebRTC anyway (may fail)');
                    // Start anyway - the service will handle the error
                    startLiveProctoring(sessionId, ws);
                  }
                };
                checkAndStart();
              }
            }
          };

          ws.onerror = (error) => {
            console.error('[Custom MCQ Take] WebSocket error:', error);
          };

          ws.onclose = () => {
            console.log('[Custom MCQ Take] WebSocket closed');
            candidateWsRef.current = null;
          };
        }
      })
      .catch((error) => {
        console.error('[Custom MCQ Take] Failed to register Live Proctoring session:', error);
      });
    
    console.log('[Custom MCQ Take] ⏸️ Live Proctoring ready, waiting for admin to connect...');

    // Cleanup WebSocket on unmount or when exam ends
    return () => {
      if (candidateWsRef.current) {
        candidateWsRef.current.close();
        candidateWsRef.current = null;
      }
      // Reset guard when exam ends (examStarted becomes false) or component unmounts
      if (!examStarted) {
        startSessionCalledRef.current = false;
      }
    };
  }, [proctoringEnabled, liveProctorScreenStream, examStarted, submitting, assessmentId, candidateInfo?.email, startLiveProctoring]);
  // NOTE: examStarted is included to trigger registration when exam starts
  // The startSessionCalledRef guard prevents duplicate registrations
  // NOTE: examStarted is intentionally NOT in dependencies to prevent duplicate registrations
  // It's checked inside the effect condition, but changes to it won't trigger re-runs

  // Stop proctoring when assessment ends
  useEffect(() => {
    if (submitting) {
      console.log('[Custom MCQ Take] Assessment submitting, stopping proctoring');
      stopUniversalProctoring();
      
      if (liveProctoringServiceRef.current) {
        liveProctoringServiceRef.current.stop();
        liveProctoringServiceRef.current = null;
      }
    }
  }, [submitting, stopUniversalProctoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopUniversalProctoring();
      if (liveProctoringServiceRef.current) {
        liveProctoringServiceRef.current.stop();
        liveProctoringServiceRef.current = null;
      }
    };
  }, [stopUniversalProctoring]);

  // Unlock fullscreen when assessment is being submitted
  useEffect(() => {
    if (submitting) {
      console.log('[Custom MCQ Take] Assessment submitting - unlocking fullscreen');
      setFullscreenLocked(false);
    }
  }, [submitting, setFullscreenLocked]);

  // Format date and time for display
  const formatDateTime = (date: Date) => {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Load assessment and candidate info
  useEffect(() => {
    const loadAssessment = async () => {
      if (!assessmentId || !token) return;

      const assessmentIdStr = String(assessmentId);
      const tokenStr = String(token);

      // Guard: Check if we've already processed this exact assessmentId/token combination
      const lastProcessed = lastProcessedRef.current;
      if (lastProcessed && 
          lastProcessed.assessmentId === assessmentIdStr && 
          lastProcessed.token === tokenStr) {
        console.log('[Custom MCQ Take] Already processed this assessmentId/token combination, skipping');
        return;
      }

      // Mark as processing immediately to prevent race conditions
      lastProcessedRef.current = { assessmentId: assessmentIdStr, token: tokenStr };

      try {
        // Enforce unified gate completion (deep-link safety)
        const id = assessmentIdStr;
        const precheckCompleted = sessionStorage.getItem(`precheckCompleted_${id}`);
        const instructionsAcknowledged = sessionStorage.getItem(`instructionsAcknowledged_${id}`);
        const candidateRequirementsCompleted = sessionStorage.getItem(`candidateRequirementsCompleted_${id}`);
        const identityVerificationCompleted = sessionStorage.getItem(`identityVerificationCompleted_${id}`);

        if (!precheckCompleted || !instructionsAcknowledged || !candidateRequirementsCompleted || !identityVerificationCompleted) {
          router.replace(`/precheck/${id}/${encodeURIComponent(tokenStr)}`);
          return;
        }

        // Load candidate info from sessionStorage
        const stored = sessionStorage.getItem(`custom_mcq_${assessmentIdStr}`);
        if (!stored) {
          router.push(`/custom-mcq/entry/${assessmentIdStr}?token=${tokenStr}`);
          return;
        }

        const info = JSON.parse(stored);
        setCandidateInfo(info);

        // Ensure shared gate pages have access to candidate info (if user refreshes mid-flow)
        if (info?.email) sessionStorage.setItem("candidateEmail", String(info.email));
        if (info?.name) sessionStorage.setItem("candidateName", String(info.name));

        // Verify access
        await verifyCandidateMutation.mutateAsync({
          assessmentId: assessmentIdStr,
          token: tokenStr,
          email: info.email,
          name: info.name,
        });

        // Set candidate info for React Query hook
        // This will trigger the useCustomMCQAssessmentForTaking hook to fetch assessment data
        setCandidateEmail(info.email);
        setCandidateName(info.name);
        
        // Assessment will be loaded via useCustomMCQAssessmentForTaking hook
        // The hook will automatically refetch when email/name are set
        // All assessment data processing is handled in the useEffect that watches assessmentData
        setLoading(false);
      } catch (err: any) {
        // Reset tracking on error to allow retry for the same assessmentId/token
        lastProcessedRef.current = null;
        setError(err.message || "Failed to load assessment");
        setLoading(false);
      }
    };

    loadAssessment();
  }, [assessmentId, token, router]); // Removed verifyCandidateMutation from dependencies - mutations are stable

  // Auto-transition when exam time arrives (strict mode only - for pre-check to exam start)
  useEffect(() => {
    if (!waitingForStart || !startTime || !assessment || !candidateInfo || assessment.examMode !== "strict") return;

    const checkStartTime = async () => {
      const now = new Date();
      if (now >= startTime) {
        // Start time has arrived - reload assessment to get updated accessControl
        try {
          // Update candidate info and refetch
          setCandidateEmail(candidateInfo.email);
          setCandidateName(candidateInfo.name);
          const { data: updatedAssessmentData } = await refetchAssessment();
          // Assessment will be updated via useEffect
          
          if (!updatedAssessmentData) {
            return;
          }
          
          // Update state based on new accessControl
          const accessControl = updatedAssessmentData.accessControl;
          if (accessControl?.examStarted) {
            setWaitingForStart(false);
            setExamStarted(true);
            
            // Initialize per-section timers if enabled
            const enablePerSectionTimers = (updatedAssessmentData as any).enablePerSectionTimers || false;
            const sectionTimersConfig = (updatedAssessmentData as any).sectionTimers || {};
            
            if (enablePerSectionTimers && sectionTimersConfig) {
              // Convert minutes to seconds for timers
              const mcqSeconds = (sectionTimersConfig.MCQ || 20) * 60;
              const subjectiveSeconds = (sectionTimersConfig.Subjective || 30) * 60;
              const totalDurationSeconds = mcqSeconds + subjectiveSeconds;
              
              setSectionTimers({
                MCQ: mcqSeconds,
                Subjective: subjectiveSeconds,
              });
              // Set global timer to total duration (sum of section timers)
              setTimeRemaining(totalDurationSeconds);
            } else {
              setTimeRemaining(accessControl.timeRemaining || null);
            }
            
            setStartedAt(new Date());
            setError(null);
          }
        } catch (err: any) {
          setError(err.message || "Failed to start assessment");
        }
      }
    };

    // Check immediately
    checkStartTime();

    // Check every second until exam time arrives
    const interval = setInterval(checkStartTime, 1000);

    return () => clearInterval(interval);
  }, [waitingForStart, startTime, assessment, candidateInfo, assessmentId, token]);

  // Handle Start Exam button click (for flexible mode)
  const handleStartExam = async () => {
    if (!assessment || !candidateInfo) return;

    try {
      // Reload assessment to get latest accessControl
      // Update candidate info and refetch
      setCandidateEmail(candidateInfo.email);
      setCandidateName(candidateInfo.name);
      await refetchAssessment();
      // Assessment will be updated via useEffect
      
      // Start the timer based on duration
      const schedule = assessmentData?.schedule || {};
      const duration = schedule.duration || assessmentData?.duration;
      
      if (duration) {
        setTimeRemaining(duration * 60); // Convert minutes to seconds
        setStartedAt(new Date());
        setExamStarted(true);
        setError(null);
      } else {
        setError("Assessment duration is not configured.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to start assessment");
    }
  };

  const formatTime = (seconds: number) => {
    // Validate input
    if (!seconds || isNaN(seconds) || seconds < 0) {
      return "00:00:00";
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswerChange = (questionId: string, optionLabel: string, question: MCQQuestion) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      const isSelected = current.includes(optionLabel);

      if (question.answerType === "single") {
        return { ...prev, [questionId]: isSelected ? [] : [optionLabel] };
      } else {
        // Multiple choice
        if (isSelected) {
          return { ...prev, [questionId]: current.filter((a) => a !== optionLabel) };
        } else {
          return { ...prev, [questionId]: [...current, optionLabel] };
        }
      }
    });
  };

  const handleTextAnswerChange = (questionId: string, text: string) => {
    console.log(`Updating text answer for question ${questionId}, length: ${text.length}`);
    setTextAnswers((prev) => {
      const updated = {
        ...prev,
        [questionId]: text,
      };
      console.log("Text answers state updated:", Object.keys(updated).length, "questions");
      return updated;
    });
  };

  // Save answer log for subjective questions
  const saveAnswerLog = async (questionId: string, answer: string, forceSave = false) => {
    if (!assessment || !candidateInfo || !assessmentId || !token) return;
    
    // Only save if answer has changed (unless forceSave is true)
    if (!forceSave) {
      const previousAnswer = previousTextAnswersRef.current[questionId] || "";
      if (previousAnswer.trim() === answer.trim()) {
        // Answer unchanged, don't save
        return;
      }
    }
    
    try {
      await saveAnswerLogMutation.mutateAsync({
        assessmentId: assessmentId as string,
        token: token as string,
        email: candidateInfo.email,
        name: candidateInfo.name,
        questionId,
        answer
      });
      // Update previous answer after successful save
      previousTextAnswersRef.current[questionId] = answer;
    } catch (err) {
      console.error("Failed to save answer log:", err);
      // Don't show error to user, just log it
    }
  };

  // Track if saveAllAnswerLogs is currently running to prevent concurrent calls
  const isSavingAnswerLogsRef = useRef(false);
  
  // Save all current subjective answers as logs (for auto-save on timer end)
  // Memoized to prevent infinite loops when used in useEffect
  const saveAllAnswerLogs = useCallback(async () => {
    if (!assessment || !candidateInfo || !assessmentId || !token) return;
    
    // Prevent concurrent calls
    if (isSavingAnswerLogsRef.current) {
      console.log('[Custom MCQ Take] saveAllAnswerLogs already in progress, skipping...');
      return;
    }
    
    isSavingAnswerLogsRef.current = true;
    
    try {
      const currentTextAnswers = textAnswersRef.current;
      const subjectiveQuestions = (assessment.questions || []).filter(q => {
        const qType = q.questionType || (!("options" in q && "correctAn" in q) ? "subjective" : "mcq");
        return qType === "subjective";
      });
      
      // Save logs for all subjective questions with answers
      // Always save if answer exists (even if same as previous) to ensure all answers are logged
      for (const question of subjectiveQuestions) {
        const questionId = question.id;
        if (questionId && currentTextAnswers[questionId]) {
          const answer = currentTextAnswers[questionId];
          if (answer && answer.trim()) {
            // Always try to save - backend will check for duplicates
            await saveAnswerLog(questionId, answer, true);
          }
        }
      }
    } finally {
      isSavingAnswerLogsRef.current = false;
    }
  }, [assessment, candidateInfo, assessmentId, token]);

  const handleSubmit = useCallback(async (isAuto = false) => {
    if (!assessment || !candidateInfo || submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      
      // Clear the timer to prevent multiple submissions
      setTimeRemaining(0);

      // Get latest values from refs to avoid closure issues
      const currentAnswers = answersRef.current;
      const currentTextAnswers = textAnswersRef.current;
      const currentCodeAnswers = codeAnswersRef.current;
      
      // Combine MCQ, subjective, and coding answers
      const submissions: Array<{ questionId: string; selectedAnswers?: string[]; textAnswer?: string; codeAnswer?: string }> = [];
      
      // Debug: Log current state before building submissions
      console.log("Pre-submission state:", {
        answersKeys: Object.keys(currentAnswers),
        textAnswersKeys: Object.keys(currentTextAnswers),
        assessmentQuestions: assessment.questions?.map(q => ({ id: q.id, type: q.questionType || ("options" in q ? "mcq" : "subjective") }))
      });
      
      // Add MCQ submissions
      for (const [questionId, selectedAnswers] of Object.entries(currentAnswers)) {
        if (selectedAnswers && selectedAnswers.length > 0) {
          submissions.push({
            questionId,
            selectedAnswers,
          });
        }
      }
      
      // Add coding submissions
      for (const [questionId, codeAnswer] of Object.entries(currentCodeAnswers)) {
        if (codeAnswer && codeAnswer.trim()) {
          submissions.push({
            questionId,
            codeAnswer,
          });
        }
      }
      
      // Add subjective submissions - check all questions to ensure we don't miss any
      const subjectiveQuestionIds = assessment.questions
        ?.filter(q => {
          const qType = q.questionType || (("options" in q && "correctAn" in q) ? "mcq" : "subjective");
          return qType === "subjective";
        })
        .map(q => q.id)
        .filter((id): id is string => Boolean(id)) || [];
      
      console.log("Subjective question IDs from assessment:", subjectiveQuestionIds);
      console.log("Text answers in state:", Object.keys(currentTextAnswers));
      console.log("All text answers:", Object.entries(currentTextAnswers).map(([id, text]) => ({ id, hasText: !!text, length: text?.length || 0 })));
      
      // Save all answer logs before final submission
      await saveAllAnswerLogs();
      
      // First, add from textAnswers state
      for (const [questionId, textAnswer] of Object.entries(currentTextAnswers)) {
        if (questionId && textAnswer && textAnswer.trim()) {
          submissions.push({
            questionId,
            textAnswer: textAnswer.trim(),
          });
        }
      }
      
      // Also check if there are subjective questions that might not be in textAnswers
      for (const questionId of subjectiveQuestionIds) {
        if (questionId && !submissions.some(s => s.questionId === questionId)) {
          const textAnswer = currentTextAnswers[questionId];
          if (textAnswer && textAnswer.trim()) {
            submissions.push({
              questionId,
              textAnswer: textAnswer.trim(),
            });
          }
        }
      }
      
      // Debug: Log submission details
      console.log("Submitting assessment:", {
        totalSubmissions: submissions.length,
        mcqSubmissions: submissions.filter(s => s.selectedAnswers).length,
        subjectiveSubmissions: submissions.filter(s => s.textAnswer).length,
        codingSubmissions: submissions.filter(s => s.codeAnswer).length
      });

      // Collect candidate requirements from sessionStorage
      const candidateRequirements: { phone?: string; linkedIn?: string; github?: string; [key: string]: any } = {};
      const phone = sessionStorage.getItem("candidatePhone");
      const linkedIn = sessionStorage.getItem("candidateLinkedIn");
      const github = sessionStorage.getItem("candidateGithub");
      
      console.log("Collecting candidate requirements from sessionStorage:", {
        phone,
        linkedIn,
        github,
        allSessionStorage: {
          candidatePhone: sessionStorage.getItem("candidatePhone"),
          candidateLinkedIn: sessionStorage.getItem("candidateLinkedIn"),
          candidateGithub: sessionStorage.getItem("candidateGithub"),
        }
      });
      
      if (phone) candidateRequirements.phone = phone;
      if (linkedIn) candidateRequirements.linkedIn = linkedIn;
      if (github) candidateRequirements.github = github;

      console.log("Candidate requirements to send:", candidateRequirements);

      const result = await submitAssessmentMutation.mutateAsync({
        assessmentId: assessmentId as string,
        token: token as string,
        email: candidateInfo.email,
        name: candidateInfo.name,
        submissions,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        submittedAt: new Date(),
        candidateRequirements,
      });

      // Clear session storage
      sessionStorage.removeItem(`custom_mcq_${assessmentId}`);

      // Redirect to results page
      const resultData = result.data;
      if (!resultData) {
        alert("Failed to submit assessment: No response data");
        return;
      }
      
      // Check if AI evaluation is in progress
      const aiEvaluationStatus = resultData.aiEvaluationStatus || "completed";
      const gradingStatus = resultData.gradingStatus || "completed";
      const isEvaluating = aiEvaluationStatus === "evaluating" || gradingStatus === "grading";
      
      const mcqScore = resultData.mcqScore ?? 0;
      const mcqTotal = resultData.mcqTotal ?? 0;
      const subjectiveScore = resultData.subjectiveScore ?? 0;
      const subjectiveTotal = resultData.subjectiveTotal ?? 0;
      const codingScore = resultData.codingScore ?? 0;
      const codingTotal = resultData.codingTotal ?? 0;
      const showResult = resultData.showResultToCandidate !== false; // Default to true if not specified
      
      // Redirect to results page with evaluation status
      router.push(
        `/custom-mcq/result/${assessmentId}?score=${resultData.score}&total=${resultData.totalMarks}&percentage=${resultData.percentage}&passed=${resultData.passed}&token=${token}&gradingStatus=${gradingStatus}&mcqScore=${mcqScore}&mcqTotal=${mcqTotal}&subjectiveScore=${subjectiveScore}&subjectiveTotal=${subjectiveTotal}&codingScore=${codingScore}&codingTotal=${codingTotal}&showResult=${showResult}&isEvaluating=${isEvaluating}`
      );
    } catch (err: any) {
      setError(err.message || "Failed to submit assessment");
      setSubmitting(false);
    }
  }, [assessment, candidateInfo, submitting, answers, assessmentId, token, startedAt, router]);

  // Track if auto-submit has been triggered to prevent multiple calls
  const autoSubmitTriggeredRef = useRef(false);
  
  // Auto-submit when global timer reaches zero (only if per-section timers are not enabled)
  useEffect(() => {
    const enablePerSectionTimers = (assessment as any)?.enablePerSectionTimers || false;
    if (!enablePerSectionTimers && timeRemaining === 0 && !submitting && assessment && candidateInfo && !waitingForStart && !autoSubmitTriggeredRef.current) {
      // Mark as triggered to prevent multiple calls
      autoSubmitTriggeredRef.current = true;
      
      // Timer has reached zero - save all answer logs first, then auto-submit
      saveAllAnswerLogs().then(() => {
        handleSubmit(true);
      }).catch(() => {
        // Even if log save fails, still submit
        handleSubmit(true);
      });
    }
    
    // Reset trigger when timer is not zero (for new assessments)
    if (timeRemaining !== null && timeRemaining > 0) {
      autoSubmitTriggeredRef.current = false;
    }
  }, [timeRemaining, submitting, assessment, candidateInfo, waitingForStart, handleSubmit, saveAllAnswerLogs]);

  // Global timer countdown (works for both per-section timers and regular mode)
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || isNaN(timeRemaining) || waitingForStart || !examStarted) {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1 || isNaN(prev || 0)) {
          // Set to 0 to trigger auto-submit
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, waitingForStart, examStarted]);

  // Per-section timer countdown (when per-section timers are enabled)
  useEffect(() => {
    const enablePerSectionTimers = (assessment as any)?.enablePerSectionTimers || false;
    if (!enablePerSectionTimers || !examStarted || waitingForStart) {
      return;
    }

    // Determine current section based on assessmentPhase
    const currentSection = assessmentPhase === "mcq" ? "MCQ" : "Subjective";
    
    // Check if current section is already locked
    const isLocked = lockedSections.has(assessmentPhase);
    if (isLocked) {
      return;
    }

    const currentSectionTimer = sectionTimers[currentSection];
    if (!currentSectionTimer || currentSectionTimer <= 0) {
      return;
    }

    // Clear any existing interval before starting a new one
    if (sectionTimerIntervalRef.current) {
      clearInterval(sectionTimerIntervalRef.current);
      sectionTimerIntervalRef.current = null;
    }
    
    // Start countdown for current section
    sectionTimerIntervalRef.current = setInterval(() => {
      setSectionTimers((prev) => {
        // Get the current phase from ref to avoid stale closure
        const currentPhase = assessmentPhaseRef.current;
        const currentSectionKey = currentPhase === "mcq" ? "MCQ" : currentPhase === "coding" ? "Coding" : "Subjective";
        const currentTimer = prev[currentSectionKey];
        
        if (!currentTimer || currentTimer <= 1) {
          // Clear interval first
          if (sectionTimerIntervalRef.current) {
            clearInterval(sectionTimerIntervalRef.current);
            sectionTimerIntervalRef.current = null;
          }
          
          // Section timer expired - lock this section and handle navigation
          setLockedSections((prevLocked) => {
            const newLockedSet = new Set(prevLocked);
            newLockedSet.add(currentPhase);
            
            // Get questions from assessment to check section availability
            const assessmentQuestions = assessment?.questions || [];
            const hasMCQ = assessmentQuestions.some((q: Question) => 
              q.questionType === "mcq" || ("options" in q && "correctAn" in q)
            );
            const hasSubjective = assessmentQuestions.some((q: Question) => 
              q.questionType === "subjective" || !("options" in q && "correctAn" in q)
            );
            
            // If MCQ section expired, lock it and mark as submitted
            if (currentPhase === "mcq") {
              setMcqSubmitted(true);
              sessionStorage.setItem(`mcqSubmitted_${assessmentId}`, "true");
              
              // If there are subjective questions and subjective section is not locked, navigate to it
              if (hasSubjective && !newLockedSet.has("subjective")) {
                // Find the index of the first subjective question in the sorted array
                // sortedQuestionsForInit has MCQ first, then Subjective, so we need to count MCQ questions
                const assessmentQuestions = assessment?.questions || [];
                const mcqCount = assessmentQuestions.filter((q: Question) => 
                  q.questionType === "mcq" || ("options" in q && "correctAn" in q)
                ).length;
                // First subjective question index = number of MCQ questions (since sorted array has MCQ first)
                const firstSubjectiveIndex = mcqCount;
                
                // Use setTimeout to ensure state updates are processed first
                setTimeout(() => {
                  setAssessmentPhase("subjective");
                  // Set index to first subjective question in the sorted array
                  setCurrentQuestionIndex(firstSubjectiveIndex);
                }, 100);
              }
            }
            
            // If subjective section expired or both sections locked, auto-submit
            const allSectionsLocked = 
              (!hasMCQ || newLockedSet.has("mcq")) && 
              (!hasSubjective || newLockedSet.has("subjective"));
            if (allSectionsLocked || (currentPhase === "subjective" && newLockedSet.has("subjective"))) {
              // Only auto-submit if not already triggered
              if (!autoSubmitTriggeredRef.current) {
                autoSubmitTriggeredRef.current = true;
                // Save all answer logs first, then auto-submit
                setTimeout(() => {
                  saveAllAnswerLogs().then(() => {
                    handleSubmit(true);
                  }).catch(() => {
                    handleSubmit(true);
                  });
                }, 1000);
              }
            }
            
            return newLockedSet;
          });
          
          return { ...prev, [currentSectionKey]: 0 };
        }
        return { ...prev, [currentSectionKey]: currentTimer - 1 };
      });
    }, 1000);

    return () => {
      if (sectionTimerIntervalRef.current) {
        clearInterval(sectionTimerIntervalRef.current);
        sectionTimerIntervalRef.current = null;
      }
    };
  }, [examStarted, waitingForStart, assessmentPhase, sectionTimers, lockedSections, assessment, assessmentId, handleSubmit]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (sectionTimerIntervalRef.current) {
        clearInterval(sectionTimerIntervalRef.current);
        sectionTimerIntervalRef.current = null;
      }
    };
  }, []);

  // Sort questions: MCQ first, then Coding, then Subjective (for initialization)
  const sortedQuestionsForInit = useMemo(() => {
    if (!assessment || !assessment.questions || assessment.questions.length === 0) return [];
    const questions = assessment.questions || [];
    const getQuestionTypeOrder = (q: Question) => {
      // Explicitly check for questionType first
      if (q.questionType === "mcq" || q.questionType === "coding" || q.questionType === "subjective") {
        const qType = q.questionType;
        if (qType === "mcq") return 0;
        if (qType === "coding") return 1;
        return 2; // Subjective
      }
      // Fallback: infer from structure
      const qType = (("options" in q && "correctAn" in q) ? "mcq" : "subjective");
      return qType === "mcq" ? 0 : 2;
    };
    return [...questions].sort((a, b) => getQuestionTypeOrder(a) - getQuestionTypeOrder(b));
  }, [assessment?.questions]);

  // Initialize assessment phase and load MCQ submitted status from session
  useEffect(() => {
    if (!assessment || !sortedQuestionsForInit || sortedQuestionsForInit.length === 0) return;
    
    const questions = sortedQuestionsForInit;
    const hasMCQ = questions.some(q => q.questionType === "mcq" || ("options" in q && "correctAn" in q));
    const hasSubjective = questions.some(q => q.questionType === "subjective" && !("options" in q && "correctAn" in q));
    const hasCoding = questions.some(q => {
      const qType = q.questionType;
      const section = q.section?.toLowerCase() || "";
      return qType === "coding" || qType?.toLowerCase() === "coding" ||
        (section === "coding" && !("options" in q && "correctAn" in q));
    });
    
    // Check if sections were already locked (from session storage)
    const mcqSubmittedKey = `mcqSubmitted_${assessmentId}`;
    const codingSubmittedKey = `codingSubmitted_${assessmentId}`;
    const savedMcqSubmitted = sessionStorage.getItem(mcqSubmittedKey) === "true";
    const savedCodingSubmitted = sessionStorage.getItem(codingSubmittedKey) === "true";
    
    if (savedMcqSubmitted) {
      setMcqSubmitted(true);
    }
    if (savedCodingSubmitted) {
      setCodingSubmitted(true);
    }
    
    if (savedMcqSubmitted || savedCodingSubmitted) {
      // Section was locked - restore state but allow navigation to all questions
      setAssessmentPhase("mcq"); // Keep phase to allow navigation
      // Start at first question (user can navigate freely)
      setCurrentQuestionIndex(0);
    } else if (hasMCQ) {
      // Start with MCQ phase
      setAssessmentPhase("mcq");
      setMcqSubmitted(false);
      // Go to first MCQ question (should be index 0 after sorting)
      setCurrentQuestionIndex(0);
    } else if (hasCoding) {
      // Only coding questions, start with coding
      setAssessmentPhase("coding");
      setCodingSubmitted(false);
      setCurrentQuestionIndex(0);
    } else if (hasCoding) {
      // Only coding questions, start with coding
      setAssessmentPhase("coding");
      setCodingSubmitted(false);
      setCurrentQuestionIndex(0);
    } else if (hasSubjective) {
      // Only subjective questions, start with subjective
      setAssessmentPhase("subjective");
      setCurrentQuestionIndex(0);
    }
  }, [assessment, sortedQuestionsForInit, assessmentId]);


  // Note: Auto-lock is now handled by checkAndLockMCQBeforeNavigation function
  // which shows confirmation popup before locking when navigating from MCQ to Subjective

  if (loading) {
    return (
      <>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div>Loading assessment...</div>
        </div>
        {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
        {cameraProctorEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={handleRequestFullscreen}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the assessment."
            warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
          />
        )}
      </>
    );
  }

  if (!assessment) {
    return (
      <>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <div style={{ textAlign: "center" }}>
            <h1>Error</h1>
            <p>Assessment not found</p>
          </div>
        </div>
        {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
        {cameraProctorEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={handleRequestFullscreen}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the assessment."
            warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
          />
        )}
      </>
    );
  }

  // Show waiting screen for strict mode pre-check phase or access denied
  if (waitingForStart || (error && !examStarted)) {
    const isStrictMode = assessment?.examMode === "strict";
    const schedule = assessment?.schedule || {};
    const startTimeStr = schedule.startTime || assessment?.startTime;
    const startTimeDate = startTimeStr ? new Date(startTimeStr) : null;
    
    // If in strict mode pre-check phase, show pre-check screen
    if (waitingForStart && isStrictMode && startTimeDate) {
      return (
        <>
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", backgroundColor: "#E8FAF0" }}>
            <div style={{ textAlign: "center", maxWidth: "600px" }}>
              <h1 style={{ color: "#1E5A3B", marginBottom: "1rem" }}>Pre-Check Phase</h1>
              <p style={{ color: "#2D7A52", fontSize: "1.125rem", marginBottom: "2rem" }}>
                You can complete pre-checks now. The assessment will start automatically at the scheduled time.
              </p>
              <div style={{ padding: "1.5rem", backgroundColor: "#ffffff", borderRadius: "0.5rem", border: "2px solid #2D7A52", marginBottom: "2rem" }}>
                <p style={{ color: "#1E5A3B", fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Assessment starts at
                </p>
                <p style={{ color: "#2D7A52", fontSize: "1.5rem", fontWeight: 700 }}>
                  {formatDateTime(startTimeDate)}
                </p>
              </div>
              <div style={{ padding: "1rem", backgroundColor: "#ffffff", borderRadius: "0.5rem", border: "1px solid #A8E8BC" }}>
                <p style={{ color: "#4A9A6A", fontSize: "0.875rem" }}>
                  The assessment will automatically start when the scheduled time arrives. This page will refresh automatically.
                </p>
              </div>
            </div>
          </div>
          {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
          {cameraProctorEnabled && (
            <FullscreenLockOverlay
              isLocked={isFullscreenLocked}
              onRequestFullscreen={handleRequestFullscreen}
              exitCount={fullscreenExitCount}
              message="You must be in fullscreen mode to continue the assessment."
              warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
            />
          )}
        </>
      );
    }
    
    // Otherwise show error/access denied screen
    return (
      <>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", backgroundColor: "#E8FAF0" }}>
          <div style={{ textAlign: "center", maxWidth: "600px" }}>
            <h1 style={{ color: "#1E5A3B", marginBottom: "1rem" }}>Access Denied</h1>
            <p style={{ color: "#2D7A52", fontSize: "1.125rem" }}>{error || "You cannot access this assessment at this time."}</p>
          </div>
        </div>
        {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
        {cameraProctorEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={handleRequestFullscreen}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the assessment."
            warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
          />
        )}
      </>
    );
  }

  // Flexible mode now auto-starts after pre-checks (no "Start Exam" button needed)
  // Access restrictions are handled at the entry/login page level

  // Use sorted questions (already sorted before conditional returns)
  const questions = sortedQuestionsForInit;
  
  // Check if we have different types
  const hasMCQ = questions.some(q => q.questionType === "mcq" || ("options" in q && "correctAn" in q));
  const hasSubjective = questions.some(q => q.questionType === "subjective" && !("options" in q && "correctAn" in q));
  // Check for coding questions - try multiple variations including section name fallback
  const hasCoding = questions.some(q => {
    const qType = q.questionType;
    const section = q.section?.toLowerCase() || "";
    // Check by questionType first
    if (qType === "coding" || qType?.toLowerCase() === "coding") {
      return true;
    }
    // Fallback: check by section name
    if (section === "coding" && !("options" in q && "correctAn" in q)) {
      return true;
    }
    return false;
  });
  const hasBothTypes = (hasMCQ && hasSubjective) || (hasMCQ && hasCoding) || (hasSubjective && hasCoding);
  
  // Show all questions - allow navigation between MCQ and Subjective freely
  // After MCQ is "submitted" (locked), users can still navigate to view MCQ but can't edit
  const currentQuestion = questions[currentQuestionIndex] || questions[0];
  const actualIndex = currentQuestionIndex;
  
  const isMCQ = currentQuestion && (currentQuestion.questionType === "mcq" || ("options" in currentQuestion && "correctAn" in currentQuestion));
  // Check for coding - try questionType first, then fallback to section name
  const isCoding = currentQuestion && (
    currentQuestion.questionType === "coding" || 
    currentQuestion.questionType?.toLowerCase() === "coding" ||
    (currentQuestion.section?.toLowerCase() === "coding" && !("options" in currentQuestion && "correctAn" in currentQuestion))
  );
  const isSubjective = currentQuestion && currentQuestion.questionType === "subjective" && !("options" in currentQuestion && "correctAn" in currentQuestion);
  const currentAnswers = isMCQ ? (answers[currentQuestion?.id || ""] || []) : [];
  const currentTextAnswer = isSubjective ? (textAnswers[currentQuestion?.id || ""] || "") : "";
  const currentCodeAnswer = isCoding ? (codeAnswers[currentQuestion?.id || ""] || "") : "";
  
  // Handle MCQ section submission - just lock MCQ section, don't change phase or navigate
  // This prevents fullscreen exit and allows free navigation between sections
  const handleSubmitMCQSection = () => {
    if (!hasMCQ) return;
    
    // Simply lock the MCQ section - no phase change, no navigation
    // This prevents fullscreen exit since we're not changing DOM structure
    setMcqSubmitted(true);
    // Save to session storage
    sessionStorage.setItem(`mcqSubmitted_${assessmentId}`, "true");
  };

  // Helper function to check if navigating between sections and show warning
  const checkAndShowSectionLockWarning = (targetIndex: number): boolean => {
    const currentQ = questions[currentQuestionIndex] || questions[0];
    const targetQ = questions[targetIndex];
    
    if (!currentQ || !targetQ) return true;
    
    const isCurrentMCQ = currentQ.questionType === "mcq" || ("options" in currentQ && "correctAn" in currentQ);
    const isCurrentCoding = currentQ.questionType === "coding" || 
      currentQ.questionType?.toLowerCase() === "coding" ||
      (currentQ.section?.toLowerCase() === "coding" && !("options" in currentQ && "correctAn" in currentQ));
    const isCurrentSubjective = currentQ.questionType === "subjective" && !("options" in currentQ && "correctAn" in currentQ);
    
    const isTargetMCQ = targetQ.questionType === "mcq" || ("options" in targetQ && "correctAn" in targetQ);
    const isTargetCoding = targetQ.questionType === "coding" || 
      targetQ.questionType?.toLowerCase() === "coding" ||
      (targetQ.section?.toLowerCase() === "coding" && !("options" in targetQ && "correctAn" in targetQ));
    const isTargetSubjective = targetQ.questionType === "subjective" && !("options" in targetQ && "correctAn" in targetQ);
    
    // If navigating from MCQ to Subjective/Coding, show warning
    if (isCurrentMCQ && !mcqSubmitted && (isTargetSubjective || isTargetCoding)) {
      setPendingNavigationIndex(targetIndex);
      setShowMCQLockWarning(true);
      return false; // Don't navigate yet, wait for user confirmation
    }
    
    // If navigating from Coding to MCQ/Subjective, show warning
    if (isCurrentCoding && !codingSubmitted && (isTargetMCQ || isTargetSubjective)) {
      setPendingNavigationIndex(targetIndex);
      setShowCodingLockWarning(true);
      return false; // Don't navigate yet, wait for user confirmation
    }
    
    // If navigating from Subjective to MCQ/Coding, show warning (if MCQ/Coding not already locked)
    if (isCurrentSubjective && (isTargetMCQ && !mcqSubmitted || isTargetCoding && !codingSubmitted)) {
      // For now, allow navigation from subjective without warning
      // You can add subjective lock if needed
      return true;
    }
    
    // If navigating TO Coding from MCQ/Subjective, show warning
    if (isTargetCoding && !codingSubmitted && (isCurrentMCQ && !mcqSubmitted || isCurrentSubjective)) {
      if (isCurrentMCQ && !mcqSubmitted) {
        setPendingNavigationIndex(targetIndex);
        setShowMCQLockWarning(true);
        return false;
      }
      if (isCurrentSubjective) {
        return true;
      }
    }
    
    return true; // Allow navigation
  };

  // Handle confirming MCQ lock and navigation
  const handleConfirmMCQLock = () => {
    if (pendingNavigationIndex !== null) {
      setMcqSubmitted(true);
      sessionStorage.setItem(`mcqSubmitted_${assessmentId}`, "true");
      setCurrentQuestionIndex(pendingNavigationIndex);
      setShowMCQLockWarning(false);
      setPendingNavigationIndex(null);
    }
  };

  // Handle confirming Coding lock and navigation
  const handleConfirmCodingLock = () => {
    if (pendingNavigationIndex !== null) {
      setCodingSubmitted(true);
      sessionStorage.setItem(`codingSubmitted_${assessmentId}`, "true");
      setCurrentQuestionIndex(pendingNavigationIndex);
      setShowCodingLockWarning(false);
      setPendingNavigationIndex(null);
    }
  };

  // Handle canceling section lock warning
  const handleCancelSectionLock = () => {
    setShowMCQLockWarning(false);
    setShowCodingLockWarning(false);
    setPendingNavigationIndex(null);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", padding: "2rem" }}>
      <ViolationToast />
      {cameraProctorEnabled && (
        <WebcamPreview
          ref={thumbVideoRef}
          cameraOn={proctoringState.isCameraOn}
          faceMeshStatus={proctoringState.isModelLoaded ? "loaded" : proctoringState.modelError ? "error" : "loading"}
          facesCount={proctoringState.facesCount}
          // visible={true} // Uncomment to show camera preview to candidates
        />
      )}
      
      {/* MCQ Lock Warning Banner */}
      {showMCQLockWarning && (
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
            zIndex: 10000,
            padding: "2rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              border: "2px solid #ef4444",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ color: "#ef4444", marginBottom: "1rem", fontSize: "1.5rem" }}>
                ⚠️ Warning: Moving to {questions[pendingNavigationIndex || 0]?.questionType === "coding" ? "Coding" : "Subjective"} Questions
              </h2>
              <p style={{ color: "#1E5A3B", fontSize: "1rem", lineHeight: "1.6" }}>
                The MCQ section will be locked once you proceed. You will not be able to change your MCQ answers after this.
              </p>
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleCancelSectionLock}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#ffffff",
                  border: "2px solid #A8E8BC",
                  borderRadius: "0.5rem",
                  color: "#1E5A3B",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMCQLock}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#ef4444",
                  border: "none",
                  borderRadius: "0.5rem",
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Coding Lock Warning Banner */}
      {showCodingLockWarning && (
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
            zIndex: 10000,
            padding: "2rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              padding: "2rem",
              maxWidth: "500px",
              width: "100%",
              border: "2px solid #ef4444",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ color: "#ef4444", marginBottom: "1rem", fontSize: "1.5rem" }}>
                ⚠️ Warning: Moving to {questions[pendingNavigationIndex || 0]?.questionType === "mcq" ? "MCQ" : "Subjective"} Questions
              </h2>
              <p style={{ color: "#1E5A3B", fontSize: "1rem", lineHeight: "1.6" }}>
                The Coding section will be locked once you proceed. You will not be able to change your coding answers after this.
              </p>
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleCancelSectionLock}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#ffffff",
                  border: "2px solid #A8E8BC",
                  borderRadius: "0.5rem",
                  color: "#1E5A3B",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCodingLock}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#ef4444",
                  border: "none",
                  borderRadius: "0.5rem",
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", gap: "2rem" }}>
        {/* Phase Indicator (Left Panel) - Show if multiple question types exist or if exam started */}
        {(hasBothTypes || hasCoding || hasMCQ || hasSubjective) && examStarted && (
          <div style={{ width: "200px", flexShrink: 0 }}>
            <div
              style={{
                padding: "1rem",
                backgroundColor: "#E8FAF0",
                border: "2px solid #A8E8BC",
                borderRadius: "0.5rem",
                position: "sticky",
                top: "2rem",
              }}
            >
              <h3 style={{ marginBottom: "1rem", color: "#1E5A3B", fontSize: "1rem" }}>Section</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {hasMCQ && (
                  <div
                    style={{
                      padding: "0.75rem",
                      border: isMCQ ? "2px solid #2D7A52" : mcqSubmitted ? "1px solid #10b981" : "1px solid #A8E8BC",
                      borderRadius: "0.5rem",
                      backgroundColor: isMCQ ? "#C9F4D4" : mcqSubmitted ? "#dcfce7" : "#ffffff",
                      color: "#1E5A3B",
                      fontWeight: isMCQ ? 600 : 400,
                      textAlign: "left",
                      opacity: mcqSubmitted && !isMCQ ? 0.7 : 1,
                    }}
                  >
                    <div>MCQ</div>
                    {mcqSubmitted && (
                      <div style={{ fontSize: "0.75rem", color: "#10b981", marginTop: "0.25rem" }}>✓ Completed</div>
                    )}
                    {isMCQ && (
                      <div style={{ fontSize: "0.75rem", color: "#2D7A52", marginTop: "0.25rem" }}>Current</div>
                    )}
                  </div>
                )}
                {hasCoding && (
                  <div
                    style={{
                      padding: "0.75rem",
                      border: isCoding ? "2px solid #2D7A52" : codingSubmitted ? "1px solid #10b981" : "1px solid #A8E8BC",
                      borderRadius: "0.5rem",
                      backgroundColor: isCoding ? "#C9F4D4" : codingSubmitted ? "#dcfce7" : "#ffffff",
                      color: "#1E5A3B",
                      fontWeight: isCoding ? 600 : 400,
                      textAlign: "left",
                      opacity: codingSubmitted && !isCoding ? 0.7 : 1,
                    }}
                  >
                    <div>Coding</div>
                    {codingSubmitted && (
                      <div style={{ fontSize: "0.75rem", color: "#10b981", marginTop: "0.25rem" }}>✓ Completed</div>
                    )}
                    {isCoding && (
                      <div style={{ fontSize: "0.75rem", color: "#2D7A52", marginTop: "0.25rem" }}>Current</div>
                    )}
                  </div>
                )}
                {hasSubjective && (
                  <div
                    style={{
                      padding: "0.75rem",
                      border: isSubjective ? "2px solid #2D7A52" : "1px solid #A8E8BC",
                      borderRadius: "0.5rem",
                      backgroundColor: isSubjective ? "#C9F4D4" : "#ffffff",
                      color: "#1E5A3B",
                      fontWeight: !isMCQ ? 600 : 400,
                      textAlign: "left",
                      opacity: !mcqSubmitted && hasMCQ && isMCQ ? 0.5 : 1,
                    }}
                  >
                    <div>Subjective</div>
                    {!isMCQ && (
                      <div style={{ fontSize: "0.75rem", color: "#2D7A52", marginTop: "0.25rem" }}>Current</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div style={{ flex: 1 }}>
        {/* Header with Timer and Submit Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 1.5rem",
            backgroundColor: "#E8FAF0",
            border: "1px solid #A8E8BC",
            borderRadius: "0.5rem",
            marginBottom: "2rem",
          }}
        >
          <div>
            <h1 style={{ margin: 0, color: "#1E5A3B", fontSize: "1.5rem" }}>{assessment.title}</h1>
            {candidateInfo && (
              <p style={{ margin: "0.5rem 0 0 0", color: "#2D7A52", fontSize: "0.875rem" }}>
                {candidateInfo.name} ({candidateInfo.email})
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            {(() => {
              const enablePerSectionTimers = (assessment as any)?.enablePerSectionTimers || false;
              
              if (enablePerSectionTimers && examStarted) {
                // Show both per-section timer and global duration timer
                const currentSection = assessmentPhase === "mcq" ? "MCQ" : "Subjective";
                const currentTimer = sectionTimers[currentSection] || 0;
                const isLocked = lockedSections.has(assessmentPhase);
                
                return (
                  <>
                    {/* Per-section timer */}
                    {currentTimer > 0 && !isLocked ? (
                      <div
                        style={{
                          padding: "0.75rem 1.5rem",
                          backgroundColor: currentTimer < 300 ? "#fee2e2" : "#ffffff",
                          border: `2px solid ${currentTimer < 300 ? "#ef4444" : "#2D7A52"}`,
                          borderRadius: "0.5rem",
                          fontSize: "1.25rem",
                          fontWeight: 700,
                          color: currentTimer < 300 ? "#991b1b" : "#1E5A3B",
                        }}
                      >
                        {currentSection}: {formatTime(currentTimer)}
                      </div>
                    ) : isLocked ? (
                      <div
                        style={{
                          padding: "0.75rem 1.5rem",
                          backgroundColor: "#fee2e2",
                          border: "2px solid #ef4444",
                          borderRadius: "0.5rem",
                          fontSize: "1rem",
                          fontWeight: 600,
                          color: "#991b1b",
                        }}
                      >
                        {currentSection} Section Locked
                      </div>
                    ) : null}
                    
                    {/* Global duration timer */}
                    {timeRemaining !== null && !isNaN(timeRemaining) && (
                      <div
                        style={{
                          padding: "0.75rem 1.5rem",
                          backgroundColor: timeRemaining < 300 ? "#fee2e2" : "#e0f2fe",
                          border: `2px solid ${timeRemaining < 300 ? "#ef4444" : "#0ea5e9"}`,
                          borderRadius: "0.5rem",
                          fontSize: "1.25rem",
                          fontWeight: 700,
                          color: timeRemaining < 300 ? "#991b1b" : "#0c4a6e",
                        }}
                        title="Total assessment duration"
                      >
                        Total: {formatTime(timeRemaining)}
                      </div>
                    )}
                  </>
                );
              } else if (timeRemaining !== null && !isNaN(timeRemaining)) {
                // Show global timer only (per-section timers disabled)
                return (
                  <div
                    style={{
                      padding: "0.75rem 1.5rem",
                      backgroundColor: timeRemaining < 300 ? "#fee2e2" : "#ffffff",
                      border: `2px solid ${timeRemaining < 300 ? "#ef4444" : "#2D7A52"}`,
                      borderRadius: "0.5rem",
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color: timeRemaining < 300 ? "#991b1b" : "#1E5A3B",
                    }}
                  >
                    {formatTime(timeRemaining)}
                  </div>
                );
              }
              return null;
            })()}
            {examStarted && (
              <button
                type="button"
                onClick={async () => {
                  // Save all answer logs before submitting
                  await saveAllAnswerLogs();
                  
                  if (confirm("Are you sure you want to submit the entire assessment? You cannot retake this assessment.")) {
                    handleSubmit();
                  }
                }}
                disabled={submitting}
                className="btn-primary"
                style={{
                  padding: "0.75rem 1.5rem",
                  fontSize: "1rem",
                  backgroundColor: "#10b981",
                  border: "none",
                  borderRadius: "0.5rem",
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {submitting ? "Submitting..." : "Submit All Answers"}
              </button>
            )}
          </div>
        </div>

        {error && !waitingForStart && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#fee2e2",
              border: "1px solid #ef4444",
              borderRadius: "0.5rem",
              color: "#991b1b",
              marginBottom: "1.5rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Question */}
        {currentQuestion && examStarted && (
          <div
            style={{
              padding: "2rem",
              backgroundColor: "#ffffff",
              border: "1px solid #A8E8BC",
              borderRadius: "0.75rem",
              marginBottom: "2rem",
            }}
          >
            <div style={{ marginBottom: "1.5rem" }}>
              <span style={{ color: "#2D7A52", fontWeight: 600 }}>
                {isMCQ 
                  ? `MCQ Question ${actualIndex + 1} of ${questions.length}`
                  : isCoding
                  ? `Coding Question ${actualIndex + 1} of ${questions.length}`
                  : `Subjective Question ${actualIndex + 1} of ${questions.length}`
                }
              </span>
              <span style={{ color: "#4A9A6A", marginLeft: "1rem" }}>[{currentQuestion.section}]</span>
              <span style={{ 
                color: "#4A9A6A", 
                marginLeft: "1rem",
                fontWeight: 500
              }}>
                {currentQuestion.marks || 1} marks
              </span>
              {mcqSubmitted && isMCQ && (
                <span style={{ 
                  marginLeft: "1rem",
                  padding: "0.25rem 0.5rem", 
                  backgroundColor: "#fee2e2", 
                  color: "#991b1b",
                  borderRadius: "0.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 600
                }}>
                  Locked
                </span>
              )}
              {codingSubmitted && isCoding && (
                <span style={{ 
                  marginLeft: "1rem",
                  padding: "0.25rem 0.5rem", 
                  backgroundColor: "#fee2e2", 
                  color: "#991b1b",
                  borderRadius: "0.25rem",
                  fontSize: "0.875rem",
                  fontWeight: 600
                }}>
                  Locked
                </span>
              )}
            </div>

            <h2 style={{ marginBottom: "2rem", color: "#1E5A3B" }}>{currentQuestion.question}</h2>

            {isMCQ && (currentQuestion as MCQQuestion).options ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {(currentQuestion as MCQQuestion).options.map((option) => {
                  const isSelected = currentAnswers.includes(option.label);
                  return (
                    <label
                      key={option.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "1rem",
                        border: isSelected ? "2px solid #2D7A52" : "1px solid #A8E8BC",
                        borderRadius: "0.5rem",
                        cursor: mcqSubmitted && isMCQ ? "not-allowed" : "pointer",
                        backgroundColor: isSelected ? "#E8FAF0" : "#ffffff",
                        transition: "all 0.2s",
                        opacity: mcqSubmitted && isMCQ ? 0.6 : 1,
                      }}
                    >
                      <input
                        type={(currentQuestion as MCQQuestion).answerType === "single" ? "radio" : "checkbox"}
                        checked={isSelected}
                        onChange={() => handleAnswerChange(currentQuestion.id!, option.label, currentQuestion as MCQQuestion)}
                        disabled={mcqSubmitted && isMCQ}
                        style={{ 
                          marginRight: "1rem", 
                          width: "20px", 
                          height: "20px",
                          cursor: mcqSubmitted && isMCQ ? "not-allowed" : "pointer",
                          opacity: mcqSubmitted && isMCQ ? 0.5 : 1
                        }}
                      />
                      <div>
                        <strong style={{ color: "#1E5A3B", marginRight: "0.5rem" }}>{option.label}:</strong>
                        <span style={{ color: "#2D7A52" }}>{option.text}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : isCoding ? (
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                  Your Code
                </label>
                <div style={{ border: "1px solid #A8E8BC", borderRadius: "0.5rem", overflow: "hidden" }}>
                  <MonacoEditor
                    height="500px"
                    language="python"
                    value={currentCodeAnswer}
                    onChange={(value) => {
                      if (codingSubmitted && isCoding) return;
                      const newCode = value || "";
                      setCodeAnswers(prev => ({ ...prev, [currentQuestion.id!]: newCode }));
                      codeAnswersRef.current = { ...codeAnswersRef.current, [currentQuestion.id!]: newCode };
                    }}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: "on",
                      lineNumbers: "on",
                      roundedSelection: false,
                      scrollBeyondLastLine: false,
                      readOnly: codingSubmitted && isCoding,
                      cursorStyle: "line",
                      automaticLayout: true,
                      tabSize: 2,
                      insertSpaces: true,
                      suggestOnTriggerCharacters: true,
                      quickSuggestions: true,
                      fontFamily: "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
                      fontLigatures: true,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                  Your Answer
                </label>
                <textarea
                  value={currentTextAnswer}
                  onChange={(e) => {
                    const questionId = currentQuestion?.id;
                    if (!questionId) {
                      console.error("Cannot save text answer: question ID is missing", currentQuestion);
                      return;
                    }
                    console.log(`Textarea onChange: questionId=${questionId}, text length=${e.target.value.length}`);
                    handleTextAnswerChange(questionId, e.target.value);
                  }}
                  placeholder="Type your answer here..."
                  rows={10}
                  disabled={isMCQ}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    border: "2px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                    resize: "vertical",
                    opacity: isMCQ ? 0.6 : 1,
                    cursor: isMCQ ? "not-allowed" : "text",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        {examStarted && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <button
            type="button"
            onClick={async () => {
              // Save answer log for current subjective question before navigating
              if (currentQuestion && !isMCQ && !isCoding && currentQuestion.id) {
                const currentAnswer = textAnswersRef.current[currentQuestion.id] || "";
                if (currentAnswer.trim()) {
                  await saveAnswerLog(currentQuestion.id, currentAnswer);
                }
              }
              
              // Navigate to previous question (any type)
              const prevIndex = actualIndex - 1;
              if (prevIndex >= 0) {
                if (checkAndShowSectionLockWarning(prevIndex)) {
                  setCurrentQuestionIndex(prevIndex);
                }
              }
            }}
            disabled={actualIndex === 0}
            className="btn-secondary"
            style={{
              padding: "0.75rem 1.5rem",
              opacity: actualIndex === 0 ? 0.5 : 1,
              cursor: actualIndex === 0 ? "not-allowed" : "pointer",
            }}
          >
            ← Previous
          </button>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
            {questions.map((q, idx) => {
              const isQMCQ = q.questionType === "mcq" || ("options" in q && "correctAn" in q);
              const isQCoding = q.questionType === "coding" || 
                q.questionType?.toLowerCase() === "coding" ||
                (q.section?.toLowerCase() === "coding" && !("options" in q && "correctAn" in q));
              const isQSubjective = q.questionType === "subjective" && !("options" in q && "correctAn" in q);
              const hasAnswer = isQMCQ 
                ? (answers[q.id || ""]?.length > 0)
                : isQCoding
                ? (codeAnswers[q.id || ""]?.trim().length > 0)
                : (textAnswers[q.id || ""]?.trim().length > 0);
              const isCurrent = idx === actualIndex;
              const isLocked = (mcqSubmitted && isQMCQ) || (codingSubmitted && isQCoding);
              
              return (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={async () => {
                    // Save answer log for current subjective question before navigating
                    if (currentQuestion && !isMCQ && !isCoding && currentQuestion.id) {
                      const currentAnswer = textAnswersRef.current[currentQuestion.id] || "";
                      if (currentAnswer.trim()) {
                        await saveAnswerLog(currentQuestion.id, currentAnswer);
                      }
                    }
                    
                    if (!checkAndShowSectionLockWarning(idx)) {
                      return; // Warning shown, wait for user confirmation
                    }
                    
                    setCurrentQuestionIndex(idx);
                  }}
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    border: isCurrent ? "2px solid #2D7A52" : isLocked ? "1px solid #ef4444" : "1px solid #A8E8BC",
                    backgroundColor: hasAnswer ? "#C9F4D4" : isCurrent ? "#E8FAF0" : "#ffffff",
                    color: "#1E5A3B",
                    cursor: "pointer",
                    fontWeight: isCurrent ? 700 : 400,
                    opacity: isLocked ? 0.7 : 1,
                  }}
                  title={isLocked ? "MCQ Section Locked" : isQMCQ ? "MCQ Question" : "Subjective Question"}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {actualIndex < questions.length - 1 ? (
            <button
              type="button"
                  onClick={async () => {
                    // Save answer log for current subjective question before navigating
                    if (currentQuestion && !isMCQ && !isCoding && currentQuestion.id) {
                      const currentAnswer = textAnswersRef.current[currentQuestion.id] || "";
                      if (currentAnswer.trim()) {
                        await saveAnswerLog(currentQuestion.id, currentAnswer);
                      }
                    }
                    
                    // Navigate to next question (any type)
                    const nextIndex = actualIndex + 1;
                    if (nextIndex < questions.length) {
                      // Check if navigating from MCQ to Subjective and show warning
                      if (!checkAndShowSectionLockWarning(nextIndex)) {
                        return; // Warning shown, wait for user confirmation
                      }
                      
                      setCurrentQuestionIndex(nextIndex);
                    }
                  }}
              className="btn-primary"
              style={{ padding: "0.75rem 1.5rem" }}
            >
              Next →
            </button>
          ) : (
            // Last question - show appropriate button based on question types
            !mcqSubmitted && hasMCQ && hasSubjective ? (
              // Both MCQ and Subjective exist - show Lock MCQ button
              <button
                type="button"
                onClick={() => {
                  if (confirm("Are you sure you want to lock the MCQ section? You will not be able to change your answers, but you can still review them and answer subjective questions.")) {
                    handleSubmitMCQSection();
                  }
                }}
                className="btn-primary"
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#10b981",
                }}
              >
                Lock MCQ Section
              </button>
            ) : (
              // Only MCQ or only Subjective - show Submit button directly
              <button
                type="button"
                onClick={async () => {
                  // Save all answer logs before submitting
                  await saveAllAnswerLogs();
                  
                  if (confirm("Are you sure you want to submit the entire assessment? You cannot retake this assessment.")) {
                    handleSubmit();
                  }
                }}
                disabled={submitting}
                className="btn-primary"
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#10b981",
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {submitting ? "Submitting..." : "Submit Whole Assessment"}
              </button>
            )
          )}
          </div>
        )}
        </div>
      </div>
      
      {/* FULLSCREEN LOCK OVERLAY - only when AI Proctoring enabled */}
      {cameraProctorEnabled && (
        <FullscreenLockOverlay
          isLocked={isFullscreenLocked}
          onRequestFullscreen={handleRequestFullscreen}
          exitCount={fullscreenExitCount}
          message="Fullscreen mode is required during the assessment."
          warningText="Please return to fullscreen to continue your exam. Repeated exits are logged and may affect your assessment."
        />
      )}
    </div>
  );
}
