'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import axios from 'axios'
import aimlApi from '../../../../lib/aiml/api'
import { useAIMLTestForCandidate, useSubmitAIMLAnswer, useSubmitAIMLTest } from '@/hooks/api/useAIML'
import { useUniversalProctoring, CandidateLiveService, resolveUserIdForProctoring, type ProctoringViolation } from '@/universal-proctoring'
import WebcamPreview from '../../../../components/WebcamPreview'
import { ViolationToast, pushViolationToast } from '@/components/ViolationToast'

// Fullscreen Lock imports
import { FullscreenLockOverlay } from "@/components/FullscreenLockOverlay";
import { useFullscreenLock } from "@/hooks/proctoring/useFullscreenLock";
import { useAITimer } from "@/hooks/useAITimer";

const AIMLCompetencyNotebook = dynamic(
  () => import('../../../../components/aiml/competency/AIMLCompetencyNotebook'),
  { ssr: false, loading: () => <div className="h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-500">Loading IDE...</div></div> }
)

// Removed: apiUrl - now using aimlApi which handles runtime URL configuration

interface Task {
  id: string
  title: string
  description: string
}

interface Question {
  id: string
  title: string
  description: string
  difficulty: string
  library?: string
  starter_code?: Record<string, string>
  tasks?: Array<string | Task>  // Support both string and object format
  public_testcases?: Array<{ input: string; expected_output: string }>
  dataset?: {
    schema: Array<{ name: string; type: string }>
    rows: any[]
    format?: string
  }
  dataset_path?: string
  dataset_url?: string
  requires_dataset?: boolean
}

interface Test {
  test_id: string
  title: string
  description: string
  duration_minutes: number
  questions: Question[]
  examMode?: "strict" | "flexible"
  schedule?: {
    startTime?: string
    endTime?: string
    duration?: number
  }
  start_time?: string
  timer_mode?: "GLOBAL" | "PER_QUESTION"
  question_timings?: Array<{
    question_id: string
    duration_minutes: number
  }>
  accessControl?: {
    canAccess: boolean
    canStart: boolean
    waitingForStart: boolean
    examStarted: boolean
    timeRemaining: number | null
    errorMessage: string | null
  }
  started_at?: string
}

export default function AIMLTestTakePage() {
  const router = useRouter()
  const { id: testId } = router.query
  
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  
    // ========================
    // LIVE PROCTORING: Candidate WS connect (Lazy WebRTC)
    // ========================
    // REMOVED: Duplicate useEffect that created WebSocket but didn't start WebRTC
    // The correct implementation is in the second useEffect below (lines 367-446)
  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({})
  const [outputAnswers, setOutputAnswers] = useState<Record<string, string[]>>({})
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  // Access control states (matching Custom MCQ structure)
  const [waitingForStart, setWaitingForStart] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [examStarted, setExamStarted] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)
  const [cameraProctorEnabled, setCameraProctorEnabled] = useState(true)
  const [candidateEmail, setCandidateEmail] = useState<string | null>(null)
  const [proctoringSettings, setProctoringSettings] = useState<any>({})
  const [liveProctoringEnabled, setLiveProctoringEnabled] = useState(false) // Extract to separate state like DSA
  const [liveProctorScreenStream, setLiveProctorScreenStream] = useState<MediaStream | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  // Per-question timer states
  const [expiredQuestions, setExpiredQuestions] = useState<Set<string>>(new Set())
  const [showTimerExpiryPopup, setShowTimerExpiryPopup] = useState(false)
  const [expiredQuestionId, setExpiredQuestionId] = useState<string | null>(null)
  // Sequential question locking - only first question unlocked initially
  const [unlockedQuestions, setUnlockedQuestions] = useState<Set<string>>(new Set())
  const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set()) // Questions that are expired or submitted

  // Proctoring refs
  const thumbVideoRef = useRef<HTMLVideoElement>(null)
  const liveProctoringServiceRef = useRef<CandidateLiveService | null>(null)
  const liveProctoringStartedRef = useRef(false)
  const startSessionCalledRef = useRef(false) // Guard: prevent multiple start-session calls
  const candidateWsRef = useRef<WebSocket | null>(null) // Store candidate WebSocket to pass to service
  const candidateSessionIdRef = useRef<string | null>(null) // Store sessionId to pass to service

  const getViolationMessage = (eventType: string): string => {
    const messages: Record<string, string> = {
      GAZE_AWAY: 'Please keep your eyes on the screen',
      MULTIPLE_FACES_DETECTED: 'Multiple faces detected in frame',
      NO_FACE_DETECTED: 'Please stay in front of the camera',
      TAB_SWITCH: 'Tab switch detected',
      FOCUS_LOST: 'Window focus lost',
      FULLSCREEN_EXIT: 'Exited fullscreen mode',
    }
    return messages[eventType] || 'Violation detected'
  }

  // ============================================================================
  // FULLSCREEN LOCK - Violation-driven lock state (SIMPLIFIED)
  // ============================================================================
  const assessmentIdStr = String(testId || '')
  const candidateIdStr = candidateEmail || userId || ''
  
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
    console.log('[AIML Take] Universal proctoring violation:', violation)
    
    // Show toast for all violations
    pushViolationToast({
      id: `${violation.eventType}-${Date.now()}`,
      eventType: violation.eventType,
      message: getViolationMessage(violation.eventType),
      timestamp: violation.timestamp,
    })

    // FULLSCREEN_EXIT violation triggers the fullscreen lock overlay (only when AI Proctoring enabled)
    if (violation.eventType === 'FULLSCREEN_EXIT' && cameraProctorEnabled) {
      console.log('[AIML Take] FULLSCREEN_EXIT violation - locking screen');
      setFullscreenLocked(true);
      incrementFullscreenExitCount();
    }
  }, [setFullscreenLocked, incrementFullscreenExitCount, cameraProctorEnabled])

  // Handle fullscreen re-entry - unlock the screen
  const handleRequestFullscreen = useCallback(async (): Promise<boolean> => {
    console.log('[AIML Take] Requesting fullscreen re-entry...');
    const success = await requestFullscreenLock();
    if (success) {
      console.log('[AIML Take] Fullscreen re-entered - unlocking screen');
      setFullscreenLocked(false);
    }
    return success;
  }, [requestFullscreenLock, setFullscreenLocked]);

  // Check if this is admin preview mode (compute BEFORE using in hooks)
  const isAdminPreview = useMemo(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('preview') === 'true' && urlParams.get('admin') === 'true'
    }
    return false
  }, [])

  // Universal proctoring hook - handles AI proctoring, tab switch, fullscreen
  // DISABLE PROCTORING IN ADMIN PREVIEW MODE
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
  })

  // Unlock fullscreen when test is submitted
  useEffect(() => {
    if (submitted) {
      console.log('[AIML Take] Test submitted - unlocking fullscreen');
      setFullscreenLocked(false);
    }
  }, [submitted, setFullscreenLocked]);

  useEffect(() => {
    if (!testId) return
    
    // Skip precheck and token validation in admin preview mode
    if (isAdminPreview) {
      setToken('admin_preview_token')
      setUserId('admin_preview')
      setCandidateEmail('admin@preview.com')
      fetchTestData('admin_preview_token', 'admin_preview')
      return
    }
    
    const urlParams = new URLSearchParams(window.location.search)
    const urlToken = urlParams.get('token')
    const urlUserId = urlParams.get('user_id')

    // Enforce unified gate completion (deep-link safety)
    const id = String(testId)
    const precheckCompleted = sessionStorage.getItem(`precheckCompleted_${id}`)
    const instructionsAcknowledged = sessionStorage.getItem(`instructionsAcknowledged_${id}`)
    const candidateRequirementsCompleted = sessionStorage.getItem(`candidateRequirementsCompleted_${id}`)
    const identityVerificationCompleted = sessionStorage.getItem(`identityVerificationCompleted_${id}`)

    if (urlToken && (!precheckCompleted || !instructionsAcknowledged || !candidateRequirementsCompleted || !identityVerificationCompleted)) {
      router.replace(`/precheck/${id}/${encodeURIComponent(urlToken)}`)
      return
    }
    
    if (!urlToken || !urlUserId) {
      alert('Invalid test link')
      router.push('/dashboard')
      return
    }
    
    setToken(urlToken)
    setUserId(urlUserId)
    setCandidateEmail(sessionStorage.getItem("candidateEmail"))
    
    fetchTestData(urlToken, urlUserId)
  }, [testId, isAdminPreview])

  // Get screen stream from window.__screenStream (set by identity-verify gate)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__screenStream) {
      const stream = (window as any).__screenStream as MediaStream;
      if (stream && stream.active && stream.getVideoTracks().length > 0) {
        setLiveProctorScreenStream(stream);
        console.log('[AIML Take] Found global screen stream for Live Proctoring');
      }
    }
  }, []);

  // Start proctoring when test is loaded and ready (AI proctoring + tab switch + fullscreen)
  // SKIP PROCTORING IN ADMIN PREVIEW MODE
  useEffect(() => {
    if (isAdminPreview) {
      console.log('[AIML Take] Admin preview mode - skipping proctoring')
      return
    }
    
    const localAssessmentIdStr = String(testId || '')
    // Resolve userId with priority: URL param > email > anonymous
    // Note: session.user.id would be ideal but requires SessionProvider context
    const localCandidateIdStr = resolveUserIdForProctoring(null, {
      urlParam: userId as string,
      email: candidateEmail,
    })
    // Use the extracted state variable (matching DSA pattern)
    
    if (questions.length > 0 && !isProctoringRunning && !submitted && localCandidateIdStr && thumbVideoRef.current) {
      console.log('[AIML Take] Starting Universal Proctoring...')
      
      startUniversalProctoring({
        settings: {
          aiProctoringEnabled: cameraProctorEnabled,
          liveProctoringEnabled: liveProctoringEnabled,
        },
        session: {
          userId: localCandidateIdStr,
          assessmentId: localAssessmentIdStr,
        },
        videoElement: cameraProctorEnabled ? thumbVideoRef.current : null,
      }).then((success) => {
        if (success) {
          console.log('[AIML Take] ✅ Universal Proctoring started')
        } else {
          console.error('[AIML Take] ❌ Failed to start Universal Proctoring')
        }
      })
    }
  }, [questions.length, isProctoringRunning, submitted, testId, candidateEmail, userId, cameraProctorEnabled, liveProctoringEnabled, startUniversalProctoring, isAdminPreview])

  // ✅ PHASE 2.4: Lazy start function (called only when admin connects)
  const startLiveProctoring = useCallback((sessionId: string, ws: WebSocket) => {
    if (liveProctoringStartedRef.current) {
      console.log('[AIML Take] Live Proctoring already started')
      return
    }

    const localAssessmentIdStr = String(testId || '')
    const localCandidateIdStr = resolveUserIdForProctoring(null, {
      urlParam: userId as string,
      email: candidateEmail,
    })

    console.log('[AIML Take] 🚀 Admin connected! Starting WebRTC...')
    liveProctoringStartedRef.current = true

    // Extract raw candidateId for live proctoring (remove email: or public: prefix)
    // Live proctoring backend expects raw email or token, not formatted userId
    let rawCandidateId = localCandidateIdStr;
    if (localCandidateIdStr.startsWith('email:')) {
      rawCandidateId = localCandidateIdStr.replace('email:', '');
    } else if (localCandidateIdStr.startsWith('public:')) {
      rawCandidateId = localCandidateIdStr.replace('public:', '');
    }

    const liveService = new CandidateLiveService({
      assessmentId: localAssessmentIdStr,
      candidateId: rawCandidateId, // Use raw email/token for live proctoring
      debugMode: debugMode,
    })

    const existingWebcamStream = thumbVideoRef.current?.srcObject as MediaStream | null

    liveService.start(
      {
        onStateChange: (state) => {
          console.log('[AIML Take] Live proctoring state:', state)
        },
        onError: (error) => {
          console.error('[AIML Take] Live Proctoring error:', error)
        },
      },
      liveProctorScreenStream,
      existingWebcamStream,
      sessionId, // Pass existing sessionId
      ws // Pass existing WebSocket
    ).then((success) => {
      if (success) {
        console.log('[AIML Take] ✅ Live Proctoring WebRTC connected')
        liveProctoringServiceRef.current = liveService
      } else {
        console.error('[AIML Take] ❌ Failed to start Live Proctoring')
        liveProctoringStartedRef.current = false
      }
    })
  }, [testId, userId, candidateEmail, debugMode, liveProctorScreenStream])

  // ✅ PHASE 2: Lazy WebRTC - Register session and wait for admin signal
  useEffect(() => {
    const localAssessmentIdStr = String(testId || '')
    const localCandidateIdStr = resolveUserIdForProctoring(null, {
      urlParam: userId as string,
      email: candidateEmail,
    })
    // Use the extracted state variable (matching DSA pattern)

    // Debug: Log all conditions to identify which one is failing
    console.log('[AIML Take] Live Proctoring registration check:', {
      liveProctoringEnabled,
      hasScreenStream: !!liveProctorScreenStream,
      questionsCount: questions.length,
      submitted,
      hasAssessmentId: !!localAssessmentIdStr,
      hasCandidateId: !!localCandidateIdStr,
      assessmentId: localAssessmentIdStr,
      candidateId: localCandidateIdStr,
    })

    // Check all conditions - match DSA pattern (register as soon as page loads, not wait for exam start)
    if (!liveProctoringEnabled || !liveProctorScreenStream || questions.length === 0 || submitted || !localAssessmentIdStr || !localCandidateIdStr) {
      console.log('[AIML Take] ⏸️ Live Proctoring registration skipped - conditions not met')
      return
    }

    // Guard: Ensure start-session is called only once per candidate per test
    if (startSessionCalledRef.current) {
      console.log('[AIML Take] ⏭️ start-session already called, skipping to prevent duplicate sessions')
      return
    }

    // Mark as called immediately to prevent race conditions
    startSessionCalledRef.current = true

    // Register live session (backend sets status to "candidate_initiated")
    console.log('[AIML Take] 📝 Registering Live Proctoring session...')
    
    // Phase 2.2: Register session with backend
    // Extract raw candidateId for live proctoring (remove email: or public: prefix)
    // Live proctoring backend expects raw email or token, not formatted userId
    let rawCandidateId = localCandidateIdStr;
    if (localCandidateIdStr.startsWith('email:')) {
      rawCandidateId = localCandidateIdStr.replace('email:', '');
    } else if (localCandidateIdStr.startsWith('public:')) {
      rawCandidateId = localCandidateIdStr.replace('public:', '');
    }

    fetch('/api/v1/proctor/live/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentId: localAssessmentIdStr,
        candidateId: rawCandidateId, // Use raw email/token for live proctoring
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.sessionId) {
          const sessionId = data.data.sessionId;
          candidateSessionIdRef.current = sessionId;
          console.log(`[AIML Take] ✅ Session registered: ${sessionId}`);

          // Phase 2.3: Connect WebSocket and listen for ADMIN_CONNECTED
          // CRITICAL FIX: Use backend URL instead of frontend URL
          // Use rawCandidateId (without email: or public: prefix) for WebSocket URL
          const { LIVE_PROCTORING_ENDPOINTS } = require("@/universal-proctoring/live/types");
          const wsUrl = LIVE_PROCTORING_ENDPOINTS.candidateWs(sessionId, rawCandidateId);
          console.log('[AIML Take] Candidate WS connecting to backend...', wsUrl);
          const ws = new WebSocket(wsUrl);
          candidateWsRef.current = ws;

          ws.onopen = () => {
            console.log('[AIML Take] ✅ WebSocket connected, waiting for admin...');
            
            // CRITICAL FIX: Wait for camera stream to be available before starting WebRTC
            // The camera is initialized by useUniversalProctoring, so we need to wait for it
            let retryCount = 0;
            const maxRetries = 20; // 10 seconds max wait (20 * 500ms)
            
            const checkCameraAndStart = () => {
              const webcamStream = thumbVideoRef.current?.srcObject as MediaStream | null;
              if (webcamStream && webcamStream.active) {
                console.log('[AIML Take] ✅ Camera stream available - ready for admin connection');
                // Don't start WebRTC here - wait for ADMIN_CONNECTED signal
              } else if (retryCount < maxRetries) {
                retryCount++;
                console.log(`[AIML Take] ⏳ Waiting for camera stream... (attempt ${retryCount}/${maxRetries})`);
                setTimeout(checkCameraAndStart, 500);
              } else {
                console.warn('[AIML Take] ⚠️ Camera stream not available after 10 seconds - will proceed anyway');
              }
            };
            
            // Start checking immediately
            checkCameraAndStart();
          };

          ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'ADMIN_CONNECTED') {
              console.log('[AIML Take] 🚀 ADMIN_CONNECTED signal received!');
              startLiveProctoring(sessionId, ws);
            }
          };

          ws.onerror = (error) => {
            console.error('[AIML Take] WebSocket error:', error);
          };

          ws.onclose = () => {
            console.log('[AIML Take] WebSocket closed');
            candidateWsRef.current = null;
          };
        }
      })
      .catch((error) => {
        console.error('[AIML Take] Failed to register Live Proctoring session:', error);
      });
    
    console.log('[AIML Take] ⏸️ Live Proctoring ready, waiting for admin to connect...')

    // Cleanup WebSocket on unmount or when exam ends
    return () => {
      if (candidateWsRef.current) {
        candidateWsRef.current.close();
        candidateWsRef.current = null;
      }
      // Reset ref when exam ends to allow re-registration if needed
      if (submitted) {
        startSessionCalledRef.current = false;
      }
    };
  }, [liveProctoringEnabled, liveProctorScreenStream, questions.length, submitted, testId, candidateEmail, userId, startLiveProctoring])

  // Stop proctoring when test is submitted
  useEffect(() => {
    if (submitted) {
      console.log('[AIML Take] Test submitted, stopping proctoring')
      stopUniversalProctoring()
      
      if (liveProctoringServiceRef.current) {
        liveProctoringServiceRef.current.stop()
        liveProctoringServiceRef.current = null
      }
    }
  }, [submitted, stopUniversalProctoring])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopUniversalProctoring()
      if (liveProctoringServiceRef.current) {
        liveProctoringServiceRef.current.stop()
        liveProctoringServiceRef.current = null
      }
    }
  }, [stopUniversalProctoring])


  // NEW: Periodic server sync for timer accuracy (every 30 seconds)
  useEffect(() => {
    if (!token || !userId || !testId || submitted || timeRemaining === null || !examStarted) return

    const syncInterval = setInterval(async () => {
      try {
        const response = await aimlApi.get(
          `/tests/${testId}/candidate?user_id=${userId}`
        )
        
        // Service already extracts response.data, so response IS the data
        const testData = response?.data || response
        const accessControl = testData?.accessControl
        
        if (accessControl?.timeRemaining !== null && accessControl?.timeRemaining !== undefined) {
          // Sync with server-calculated time
          setTimeRemaining(Math.max(0, accessControl.timeRemaining))
        } else if (testData.time_remaining_seconds !== undefined && testData.time_remaining_seconds >= 0) {
          // Fallback to backward compatibility field
          setTimeRemaining(Math.max(0, testData.time_remaining_seconds))
        }
      } catch (err) {
        console.error('Failed to sync timer with server:', err)
        // Don't update timer on error, keep using client-side countdown
      }
    }, 30000) // Sync every 30 seconds

    return () => clearInterval(syncInterval)
  }, [token, userId, testId, submitted, timeRemaining, examStarted])

  // Auto-transition when exam time arrives (strict mode only - for pre-check to exam start)
  // Matching Custom MCQ structure exactly
  useEffect(() => {
    if (!waitingForStart || !startTime || !test || !token || !userId || test.examMode !== "strict") return

    const checkStartTime = async () => {
      const now = new Date()
      if (now >= startTime) {
        // Start time has arrived - reload test data to get updated accessControl
        if (!testId || !userId || !token) return
        try {
          const { aimlService } = await import('@/services/aiml')
          const response = await aimlService.getTestForCandidate(String(testId), userId, token)
          
          // Service already extracts response.data, so response IS the data
          const testData = response?.data || response
          setTest(testData)
          
          // Update state based on new accessControl
          const accessControl = testData.accessControl
          if (accessControl?.examStarted) {
            setWaitingForStart(false)
            setExamStarted(true)
            setTimeRemaining(accessControl.timeRemaining || null)
            setStartedAt(new Date())
            setAccessError(null)
          }
        } catch (err: any) {
          setAccessError(err.message || "Failed to start assessment")
        }
      }
    }

    // Check immediately
    checkStartTime()

    // Check every second until exam time arrives
    const interval = setInterval(checkStartTime, 1000)

    return () => clearInterval(interval)
  }, [waitingForStart, startTime, test, token, userId, testId])

  const fetchTestData = async (urlToken: string, urlUserId: string) => {
    if (!testId) return
    try {
      setLoading(true)
      console.log('[AIML Take] fetchTestData called:', { testId, urlUserId, hasToken: !!urlToken, isAdminPreview })
      const { aimlService } = await import('@/services/aiml')
      
      // In admin preview mode, use a dummy token/userId or skip token validation
      let effectiveToken = urlToken
      let effectiveUserId = urlUserId
      
      if (isAdminPreview) {
        // For admin preview, we might need to handle this differently
        // Try to get test data without full candidate validation
        effectiveToken = 'admin_preview_token'
        effectiveUserId = 'admin_preview'
      }
      
      console.log('[AIML Take] Calling aimlService.getTestForCandidate:', { testId, effectiveUserId, hasToken: !!effectiveToken })
      const response = await aimlService.getTestForCandidate(String(testId), effectiveUserId, effectiveToken)
      
      console.log('[AIML Take] getTestForCandidate response:', {
        hasResponse: !!response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : [],
        hasData: !!(response?.data),
        hasQuestions: !!(response?.data?.questions),
        questionsCount: (response?.data?.questions)?.length || 0,
      })
      
      // AIML service's getTestForCandidate already extracts response.data from axios
      // So response IS the data object (not wrapped in ApiResponse)
      // Handle both cases: direct data or wrapped in data property
      const testData = response?.data || response
      if (!testData) {
        console.error('[AIML Take] ❌ testData is undefined!', { response })
        throw new Error('Failed to load test data: response is undefined')
      }
      
      if (!testData.questions) {
        console.error('[AIML Take] ❌ testData.questions is undefined!', { testData })
        throw new Error('Failed to load test questions: testData.questions is undefined')
      }
      
      setTest(testData)
      setQuestions(testData.questions || [])

      // Apply runtime camera toggle based on admin proctoring setting:
      // Only explicit true enables camera/model; missing/false => OFF (per PROCTORING_AI_TOGGLE_NOTES.md)
      // Load proctoring settings from test data (matching DSA pattern)
      // DISABLE PROCTORING IN ADMIN PREVIEW MODE
      if (isAdminPreview) {
        console.log('[AIML Take] Admin preview mode - disabling proctoring');
        setProctoringSettings({ aiProctoringEnabled: false, liveProctoringEnabled: false });
        setCameraProctorEnabled(false);
        setLiveProctoringEnabled(false);
      } else if (testData?.proctoringSettings) {
        console.log('[AIML Take] Loading proctoring settings:', testData.proctoringSettings);
        setProctoringSettings(testData.proctoringSettings);
        setCameraProctorEnabled(testData.proctoringSettings.aiProctoringEnabled === true);
        setLiveProctoringEnabled(testData.proctoringSettings.liveProctoringEnabled === true);
      } else {
        console.log('[AIML Take] No proctoring settings found in test data');
        setProctoringSettings({ aiProctoringEnabled: false, liveProctoringEnabled: false });
        setCameraProctorEnabled(false);
        setLiveProctoringEnabled(false);
      }
      
      // NEW IMPLEMENTATION: Use accessControl from backend (matching Custom MCQ structure)
      const accessControl = testData.accessControl
      const schedule = testData.schedule || {}
      const startTimeStr = schedule.startTime || testData.start_time
      
      if (testData.is_completed) {
        // Test already completed, set time to 0 and mark as submitted
        setTimeRemaining(0)
        setSubmitted(true)
        setExamStarted(false)
        setWaitingForStart(false)
        setAccessError(null)
      } else if (accessControl) {
        if (!accessControl.canAccess) {
          // Cannot access - show error message
          setAccessError(accessControl.errorMessage || "You cannot access this assessment at this time.")
          setWaitingForStart(false)
          setExamStarted(false)
          setTimeRemaining(null)
          return
        }
        
        if (accessControl.waitingForStart) {
          // Can access but waiting for start (strict mode - pre-check phase)
          if (startTimeStr) {
            const startTimeDate = new Date(startTimeStr)
            setWaitingForStart(true)
            setStartTime(startTimeDate)
            setExamStarted(false)
            setTimeRemaining(null)
            setAccessError(null) // Clear error, show waiting message in UI
          }
          return
        }
        
        if (accessControl.examStarted) {
          // Exam has started (both strict and flexible mode now auto-start)
          setWaitingForStart(false)
          setExamStarted(true)
          setTimeRemaining(accessControl.timeRemaining || null)
          setStartedAt(new Date())
          setAccessError(null)
        } else if (accessControl.canStart) {
          // Can start - this shouldn't happen now as flexible mode auto-starts
          // But keep as fallback
          setWaitingForStart(false)
          setExamStarted(true)
          setTimeRemaining(accessControl.timeRemaining || null)
          setStartedAt(new Date())
          setAccessError(null)
        }
      } else {
        // Fallback if accessControl not available (shouldn't happen)
        setAccessError("Assessment access information is not available.")
      }
      
      // Initialize code answers
      const initialCodes: Record<string, string> = {}
      testData.questions.forEach((q: Question) => {
        initialCodes[q.id] = q.starter_code?.python3 || q.starter_code?.python || ''
      })
      setCodeAnswers(initialCodes)
      
      // Initialize sequential locking: only first question unlocked
      if (testData.questions && testData.questions.length > 0 && testData.timer_mode === 'PER_QUESTION') {
        const firstQuestionId = testData.questions[0].id
        setUnlockedQuestions(new Set<string>([firstQuestionId]))
        setCompletedQuestions(new Set<string>())
        setExpiredQuestions(new Set<string>())
      } else if (testData.timer_mode !== 'PER_QUESTION' && testData.questions) {
        // GLOBAL mode: all questions unlocked
        const allQuestionIds = new Set<string>(testData.questions.map((q: Question) => q.id))
        setUnlockedQuestions(allQuestionIds)
      }
    } catch (err: any) {
      console.error(err)
      alert(err.response?.data?.detail || 'Failed to load test')
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const currentQuestion = questions[currentQuestionIndex]

  // Webcam preview tile (same as AI/DSA when enabled)
  // Rendered at the top-level so it overlays the notebook IDE.
  const webcamTile = cameraProctorEnabled ? (
    <WebcamPreview
      ref={thumbVideoRef}
      cameraOn={proctoringState.isCameraOn}
      faceMeshStatus={proctoringState.isModelLoaded ? "loaded" : proctoringState.modelError ? "error" : "loading"}
      facesCount={proctoringState.facesCount}
      // visible={true} // Uncomment to show camera preview to candidates
    />
  ) : null

  const autoSaveAnswer = useCallback(async (questionId: string, code: string) => {
    if (!token || !userId || !testId) return
    
    try {
      await aimlApi.post(
        `/tests/${testId}/submit-answer`,
        {
          user_id: userId,
          question_id: questionId,
          source_code: code,
          outputs: [],
        }
      )
      setLastSaved(new Date())
    } catch (err) {
      console.error('Auto-save failed:', err)
    }
  }, [token, userId, testId])

  const handleCodeChange = useCallback((code: string) => {
    if (currentQuestion && 
        !expiredQuestions.has(currentQuestion.id) &&
        (test?.timer_mode !== 'PER_QUESTION' || unlockedQuestions.has(currentQuestion.id))) {
      setCodeAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: code
      }))
      
      // Debounced auto-save (save 2 seconds after user stops typing)
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
      autoSaveRef.current = setTimeout(() => {
        autoSaveAnswer(currentQuestion.id, code)
      }, 2000)
    }
  }, [currentQuestion, autoSaveAnswer, expiredQuestions, test?.timer_mode, unlockedQuestions])

  const handleSubmitQuestion = async (code: string, outputs: string[]) => {
    if (!currentQuestion || submitting) return

    setSubmitting(true)
    try {
      // Store outputs locally for final submission
      setOutputAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: outputs
      }))

      await aimlApi.post(
        `/tests/${testId}/submit-answer`,
        {
          user_id: userId,
          question_id: currentQuestion.id,
          source_code: code,
          outputs: outputs,
        }
      )
      
      // Mark question as completed (manually submitted)
      setCompletedQuestions(prev => {
        const newSet = new Set(prev)
        newSet.add(currentQuestion.id)
        return newSet
      })
      
      // Lock current question and unlock next question (sequential locking)
      // BUT do NOT auto-navigate - user stays on current question
      if (currentQuestionIndex < questions.length - 1) {
        const nextQuestionId = questions[currentQuestionIndex + 1].id
        setUnlockedQuestions(prev => {
          const newSet = new Set(prev)
          newSet.delete(currentQuestion.id) // Lock current question
          newSet.add(nextQuestionId) // Unlock next question
          return newSet
        })
      }
      
      // Show success notification
      const toast = document.createElement('div')
      toast.className = 'fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      toast.textContent = '✓ Answer submitted. Next question unlocked!'
      document.body.appendChild(toast)
      setTimeout(() => document.body.removeChild(toast), 3000)
      
      // DO NOT auto-navigate - user can manually click "Next" or question tab when ready
    } catch (err: any) {
      console.error(err)
      alert(err.response?.data?.detail || 'Failed to save answer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitTest = async () => {
    if (submitted || submitting) return

    // Confirm submission
    const confirmSubmit = window.confirm(
      'Are you sure you want to submit the test?\n\n' +
      'Your answers will be evaluated by AI and you will receive a score and feedback.\n\n' +
      'This action cannot be undone.'
    )
    if (!confirmSubmit) return

    setSubmitting(true)
    try {
      // Get candidate requirements from sessionStorage
      const candidateRequirements: any = {};
      const phone = sessionStorage.getItem("candidatePhone");
      const linkedIn = sessionStorage.getItem("candidateLinkedIn");
      const github = sessionStorage.getItem("candidateGithub");
      
      if (phone) candidateRequirements.phone = phone;
      if (linkedIn) candidateRequirements.linkedInUrl = linkedIn;
      if (github) candidateRequirements.githubUrl = github;
      
      // Get custom fields from sessionStorage
      const customFieldsStr = sessionStorage.getItem("candidateCustomFields");
      if (customFieldsStr) {
        try {
          candidateRequirements.customFields = JSON.parse(customFieldsStr);
        } catch (e) {
          console.warn("Failed to parse custom fields:", e);
        }
      }

      if (!testId || !userId) {
        throw new Error('Test ID and User ID are required')
      }

      const { aimlService } = await import('@/services/aiml')
      const response = await aimlService.submitTest(String(testId), {
        user_id: userId,
        question_submissions: Object.entries(codeAnswers).map(([questionId, code]) => ({
          question_id: questionId,
          code: code,
          outputs: outputAnswers[questionId] || []
        })),
        activity_logs: undefined
      })
      
      // Log the result for debugging
      console.log('Submission result:', response.data)
      
      setSubmitted(true)
      if (timerRef.current) clearInterval(timerRef.current)
    } catch (err: any) {
      console.error(err)
      alert(err.response?.data?.detail || 'Failed to submit test')
    } finally {
      setSubmitting(false)
    }
  }

  // Use AITimer hook for per-question or global timer
  const currentQuestionForTimer = questions[currentQuestionIndex] || null
  const timer = useAITimer({
    test: test ? {
      timer_mode: test.timer_mode || "GLOBAL",
      duration_minutes: test.duration_minutes,
      question_timings: test.question_timings,
      start_time: test.start_time || test.schedule?.startTime,
    } : null,
    testSubmission: test?.started_at ? { started_at: test.started_at } : null,
    questions,
    currentQuestionId: currentQuestionForTimer?.id || null,
    onExpire: handleSubmitTest,
    onQuestionExpire: async (questionId: string) => {
      console.log('[AIML Timer] Question expired:', questionId)
      
      // Mark question as expired and completed
      setExpiredQuestions(prev => {
        const newSet = new Set(prev)
        newSet.add(questionId)
        return newSet
      })
      setCompletedQuestions(prev => {
        const newSet = new Set(prev)
        newSet.add(questionId)
        return newSet
      })
      setExpiredQuestionId(questionId)
      
      // Auto-save the current question's answer
      const currentCode = codeAnswers[questionId] || ''
      const currentOutputs = outputAnswers[questionId] || []
      try {
        await autoSaveAnswer(questionId, currentCode)
        console.log('[AIML Timer] Auto-saved question:', questionId)
      } catch (err) {
        console.error('[AIML Timer] Failed to auto-save:', err)
      }
      
      // Lock current question and unlock next question (sequential locking)
      const currentIndex = questions.findIndex(q => q.id === questionId)
      if (currentIndex < questions.length - 1) {
        const nextQuestionId = questions[currentIndex + 1].id
        setUnlockedQuestions(prev => {
          const newSet = new Set(prev)
          newSet.delete(questionId) // Lock current question
          newSet.add(nextQuestionId) // Unlock next question
          return newSet
        })
      }
      
      // Show popup
      setShowTimerExpiryPopup(true)
      
      // After 2.5 seconds, navigate to next question or submit
      setTimeout(() => {
        setShowTimerExpiryPopup(false)
        if (currentIndex < questions.length - 1) {
          // Move to next question
          setCurrentQuestionIndex(currentIndex + 1)
        } else {
          // Last question - submit test
          handleSubmitTest()
        }
      }, 2500) // 2.5 second delay
    },
    enabled: examStarted && !submitted && questions.length > 0,
  })

  // Update timeRemaining from timer hook (for GLOBAL mode)
  useEffect(() => {
    if (test?.timer_mode === 'GLOBAL') {
      setTimeRemaining(timer.timeRemaining)
    }
  }, [timer.timeRemaining, test?.timer_mode])

  if (loading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading test...</p>
          </div>
        </div>
        {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
        {cameraProctorEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={handleRequestFullscreen}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the test."
            warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
          />
        )}
      </>
    )
  }

  // Show access denied screen
  if (accessError && !examStarted) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-600">{accessError}</p>
          </div>
        </div>
        {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
        {cameraProctorEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={handleRequestFullscreen}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the test."
            warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
          />
        )}
      </>
    )
  }

  // Show waiting for start screen (strict mode pre-check phase)
  // Matching Custom MCQ structure exactly
  if (waitingForStart && !examStarted) {
    const isStrictMode = test?.examMode === "strict"
    
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Pre-Check Phase</h1>
            <p className="text-gray-600 mb-4">
              You can complete pre-checks now. The assessment will start automatically at the scheduled time.
            </p>
            {startTime && (
              <div className="bg-emerald-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-emerald-800 font-semibold mb-1">Assessment starts at</p>
                <p className="text-lg text-emerald-700 font-bold">
                  {startTime.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500">
              The assessment will automatically start when the scheduled time arrives. This page will refresh automatically.
            </p>
          </div>
        </div>
        {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
        {cameraProctorEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={handleRequestFullscreen}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the test."
            warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
          />
        )}
      </>
    )
  }

  if (submitted) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
          <div className="text-center bg-white p-8 rounded-2xl shadow-lg max-w-md">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Test Submitted!</h1>
            <p className="text-gray-600 mb-4">Your answers have been recorded and are being evaluated by AI.</p>
          
          <div className="bg-emerald-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-emerald-700">
              🤖 AI is analyzing your code and outputs...
            </p>
            <p className="text-xs text-emerald-600 mt-2">
              You will receive a detailed score (out of 100) and feedback from the test administrator.
            </p>
          </div>
          
          <p className="text-sm text-gray-500">You may close this window now.</p>
        </div>
      </div>
      </>
    )
  }

  if (!test || questions.length === 0) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-600">
            <p className="text-xl mb-2">Test not found</p>
            <p className="text-sm">Please check the link and try again.</p>
          </div>
        </div>
        {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
        {cameraProctorEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={handleRequestFullscreen}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the test."
            warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
          />
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <ViolationToast />
      {webcamTile}
      {/* Header with Timer and Navigation */}
      <header className="bg-white border-b border-emerald-200 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-800">{test.title}</h1>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
              AIML Assessment
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Auto-save Indicator */}
            {lastSaved && (
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Saved {Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s ago
              </div>
            )}
            
            {/* Timer - Show GLOBAL or PER_QUESTION timer */}
            {test.timer_mode === 'PER_QUESTION' && currentQuestion && examStarted ? (
              (() => {
                const questionTime = timer.questionTimeRemaining[currentQuestion.id] || 0
                return questionTime > 0 ? (
                  <div className={`px-4 py-2 rounded-lg font-mono text-lg font-semibold ${
                    questionTime < 60 
                      ? 'bg-red-100 text-red-700' 
                      : questionTime < 180 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    ⏱️ Q{currentQuestionIndex + 1}: {Math.floor(questionTime / 60)}:{String(questionTime % 60).padStart(2, '0')}
                  </div>
                ) : null
              })()
            ) : (
              timeRemaining !== null && !isNaN(timeRemaining) && timeRemaining >= 0 && (
                <div className={`px-4 py-2 rounded-lg font-mono text-lg font-semibold ${
                  timeRemaining < 300 
                    ? 'bg-red-100 text-red-700' 
                    : timeRemaining < 600 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-emerald-100 text-emerald-700'
                }`}>
                  ⏱️ {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                </div>
              )
            )}
            
            {examStarted && (() => {
              // Check if all questions have been submitted
              const allQuestionsCompleted = questions.length > 0 && 
                questions.every(q => completedQuestions.has(q.id) || expiredQuestions.has(q.id))
              const incompleteQuestions = questions.filter(q => 
                !completedQuestions.has(q.id) && !expiredQuestions.has(q.id)
              )
              
              return (
                <div className="flex flex-col items-end gap-2">
                  {!allQuestionsCompleted && incompleteQuestions.length > 0 && (
                    <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                      ⚠️ Please submit all {incompleteQuestions.length} question{incompleteQuestions.length > 1 ? 's' : ''} before submitting the test
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (allQuestionsCompleted) {
                        if (confirm('Are you sure you want to submit the test? This action cannot be undone.')) {
                          handleSubmitTest()
                        }
                      } else {
                        alert(`Please submit all questions before submitting the test.\n\nRemaining: ${incompleteQuestions.length} question${incompleteQuestions.length > 1 ? 's' : ''}`)
                      }
                    }}
                    disabled={submitting || !allQuestionsCompleted}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                    title={!allQuestionsCompleted ? `Submit all ${incompleteQuestions.length} remaining question${incompleteQuestions.length > 1 ? 's' : ''} first` : ''}
                  >
                    {submitting ? 'Submitting...' : 'Submit Test'}
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
        
        {/* Question Navigation - Only show when exam started */}
        {examStarted && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
            {/* Previous Button - Disabled for PER_QUESTION mode (no going back) */}
            <button
              onClick={() => {
                const prevIndex = currentQuestionIndex - 1
                if (prevIndex >= 0) {
                  const prevQuestion = questions[prevIndex]
                  // Only allow navigation if not PER_QUESTION mode and question not expired
                  if (test.timer_mode !== 'PER_QUESTION' && !expiredQuestions.has(prevQuestion.id)) {
                    setCurrentQuestionIndex(prevIndex)
                  }
                }
              }}
              disabled={
                test.timer_mode === 'PER_QUESTION' || 
                currentQuestionIndex === 0 || 
                (currentQuestionIndex > 0 && expiredQuestions.has(questions[currentQuestionIndex - 1]?.id))
              }
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            
            {/* Question Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto flex-1">
              {questions.map((q, idx) => {
                const isExpired = expiredQuestions.has(q.id)
                const isLocked = test.timer_mode === 'PER_QUESTION' && !unlockedQuestions.has(q.id)
                const isCompleted = completedQuestions.has(q.id)
                const isCurrent = idx === currentQuestionIndex
                
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      // Only allow navigation to unlocked questions
                      if (!isLocked && !isExpired) {
                        setCurrentQuestionIndex(idx)
                      }
                    }}
                    disabled={isLocked || isExpired}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      isCurrent
                        ? 'bg-emerald-600 text-white'
                        : isLocked
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                          : isExpired
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                            : isCompleted
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : codeAnswers[q.id] && codeAnswers[q.id].trim() !== ''
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                    title={
                      isLocked 
                        ? 'This question is locked. Complete previous questions first.' 
                        : isExpired 
                          ? 'Time expired for this question' 
                          : ''
                    }
                  >
                    Q{idx + 1}
                    {isLocked && ' 🔒'}
                  </button>
                )
              })}
            </div>
            
            {/* Next Button - Disabled until current question is completed (for PER_QUESTION mode) */}
            <button
              onClick={() => {
                const nextIndex = currentQuestionIndex + 1
                if (nextIndex < questions.length) {
                  const nextQuestion = questions[nextIndex]
                  // Only allow navigation if question is unlocked
                  if (test.timer_mode !== 'PER_QUESTION' || unlockedQuestions.has(nextQuestion.id)) {
                    setCurrentQuestionIndex(nextIndex)
                  }
                }
              }}
              disabled={
                currentQuestionIndex === questions.length - 1 ||
                (test.timer_mode === 'PER_QUESTION' && 
                 currentQuestion && 
                 !completedQuestions.has(currentQuestion.id) &&
                 !expiredQuestions.has(currentQuestion.id))
              }
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                test.timer_mode === 'PER_QUESTION' && 
                currentQuestion && 
                !completedQuestions.has(currentQuestion.id) &&
                !expiredQuestions.has(currentQuestion.id)
                  ? 'Complete or wait for timer to expire on current question'
                  : ''
              }
            >
              Next →
            </button>
          </div>
        )}
      </header>

      {/* Main Content - Competency Notebook IDE */}
      <main className="flex-1 overflow-hidden">
        {currentQuestion && examStarted && (
          <AIMLCompetencyNotebook
            key={currentQuestion.id}
            question={currentQuestion}
            sessionId={`test_${testId}_user_${userId}_q_${currentQuestion.id}`}
            onCodeChange={handleCodeChange}
            onSubmit={handleSubmitQuestion}
            showSubmit={true}
            readOnly={expiredQuestions.has(currentQuestion.id)}
          />
        )}
      </main>

      {/* Timer Expiry Popup Modal */}
      {showTimerExpiryPopup && expiredQuestionId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="text-center">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Time's up!</h3>
              <p className="text-gray-600 mb-4">Time's up! Moving to next question...</p>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
      {cameraProctorEnabled && (
        <FullscreenLockOverlay
          isLocked={isFullscreenLocked}
          onRequestFullscreen={handleRequestFullscreen}
          exitCount={fullscreenExitCount}
          message="You must be in fullscreen mode to continue the test. All your progress is saved."
          warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
        />
      )}
    </div>
  )
}
