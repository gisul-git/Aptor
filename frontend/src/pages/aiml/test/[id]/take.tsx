'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import axios from 'axios'
import aimlApi from '../../../../lib/aiml/api'
import { useAIMLTestForCandidate, useSubmitAIMLAnswer, useSubmitAIMLTest } from '@/hooks/api/useAIML'
import { useUniversalProctoring, CandidateLiveService, resolveUserIdForProctoring, type ProctoringViolation, type ProctoringEventType } from '@/universal-proctoring'
import WebcamPreview from '../../../../components/WebcamPreview'
import { ViolationToast, pushViolationToast } from '@/components/ViolationToast'
import { Timer } from 'lucide-react';

// Fullscreen Lock imports
import { FullscreenLockOverlay } from "@/components/FullscreenLockOverlay";
import { useFullscreenLock } from "@/hooks/proctoring/useFullscreenLock";
import { useAITimer } from "@/hooks/useAITimer";
// Activity Pattern Proctor imports
import { useActivityPatternProctor } from "@/hooks/proctoring/useActivityPatternProctor";

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
  // Use refs to store latest values for timer expiration (avoid closure issues)
  const codeAnswersRef = useRef<Record<string, string>>({})
  const outputAnswersRef = useRef<Record<string, string[]>>({})
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  // In-page notification state (doesn't break fullscreen)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  // Access control states (matching Custom MCQ structure)
  const [waitingForStart, setWaitingForStart] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [examStarted, setExamStarted] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (notification) {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null)
      }, 5000)
    }
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }
    }
  }, [notification])
  
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

  // Handle warning callback from universal proctoring (non-violation notifications)
  const handleUniversalWarning = useCallback((warning: any) => {
    if (warning.type === 'FACE_NOT_CLEARLY_VISIBLE') {
      pushViolationToast({
        id: `warning-${warning.type}-${Date.now()}`,
        eventType: warning.type,
        message: warning.message,
        timestamp: new Date(warning.timestamp).toISOString(),
        isWarning: true, // Mark as warning (yellow styling)
      });
    }
  }, [])

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
    onWarning: handleUniversalWarning,
    debug: debugMode,
  })

  // Activity Pattern Proctor - monitors mouse, keyboard, scroll patterns
  useActivityPatternProctor({
    userId: userId || '',
    assessmentId: String(testId || ''),
    onViolation: (violation) => {
      console.log('[AIML Take] Activity pattern violation:', violation);
      handleUniversalViolation({
        eventType: violation.eventType,
        timestamp: violation.timestamp,
        assessmentId: violation.assessmentId,
        userId: violation.userId,
        metadata: violation.metadata,
      });
    },
    enabled: !!userId && !!testId && !submitted, // Only enable when test is active
    copyPasteThreshold: 20, // Lower threshold for easier detection (default: 50)
  });

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
      }).then(async (success) => {
        if (success) {
          console.log('[AIML Take] ✅ Universal Proctoring started')
          
          // Start Agora Live Proctoring immediately after AI proctoring starts
          if (liveProctoringEnabled && !liveProctoringStartedRef.current) {
            await startLiveProctoring();
          }
        } else {
          console.error('[AIML Take] ❌ Failed to start Universal Proctoring')
        }
      })
    }
  }, [questions.length, isProctoringRunning, submitted, testId, candidateEmail, userId, cameraProctorEnabled, liveProctoringEnabled, startUniversalProctoring, isAdminPreview])

  // Start Agora Live Proctoring when exam starts
  const startLiveProctoring = useCallback(async () => {
    if (liveProctoringStartedRef.current) {
      console.log('[AIML Take] Live Proctoring already started')
      return
    }

    const localAssessmentIdStr = String(testId || '')
    const localCandidateIdStr = resolveUserIdForProctoring(null, {
      urlParam: userId as string,
      email: candidateEmail,
    })

    if (!localAssessmentIdStr || !localCandidateIdStr) {
      console.error('[AIML Take] Missing assessmentId or candidateId for live proctoring')
      return
    }

    console.log('[AIML Take] 🚀 Starting Agora Live Proctoring...')
    liveProctoringStartedRef.current = true

    // Extract raw candidateId for live proctoring (remove email: or public: prefix)
    // Live proctoring backend expects raw email or token, not formatted userId
    let rawCandidateId = localCandidateIdStr;
    if (localCandidateIdStr.startsWith('email:')) {
      rawCandidateId = localCandidateIdStr.replace('email:', '');
    } else if (localCandidateIdStr.startsWith('public:')) {
      rawCandidateId = localCandidateIdStr.replace('public:', '');
    }

    try {
      const liveService = new CandidateLiveService({
        assessmentId: localAssessmentIdStr,
        candidateId: rawCandidateId,
        debugMode: debugMode,
      })

      // Wait for webcam stream to be available (from AI proctoring)
      const existingWebcamStream = thumbVideoRef.current?.srcObject as MediaStream | null
      
      // If webcam not ready yet, wait a bit
      let webcamStream = existingWebcamStream;
      if (!webcamStream || !webcamStream.active) {
        console.log('[AIML Take] ⏳ Waiting for webcam stream...')
        let retries = 0;
        while (retries < 20 && (!webcamStream || !webcamStream.active)) {
          await new Promise(resolve => setTimeout(resolve, 500));
          webcamStream = thumbVideoRef.current?.srcObject as MediaStream | null;
          retries++;
        }
      }

      const success = await liveService.start(
        {
          onStateChange: (state) => {
            console.log('[AIML Take] Live proctoring state:', state)
          },
          onError: (error) => {
            console.error('[AIML Take] Live Proctoring error:', error)
          },
        },
        liveProctorScreenStream || null,
        webcamStream || null,
        null, // sessionId - not needed for Agora
        null  // WebSocket - not needed for Agora
      )

      if (success) {
        console.log('[AIML Take] ✅ Live Proctoring (Agora) started successfully')
        liveProctoringServiceRef.current = liveService
      } else {
        console.error('[AIML Take] ❌ Failed to start Live Proctoring')
        liveProctoringStartedRef.current = false
      }
    } catch (error) {
      console.error('[AIML Take] ❌ Error starting Live Proctoring:', error)
      liveProctoringStartedRef.current = false
    }
  }, [testId, userId, candidateEmail, debugMode, liveProctorScreenStream])

  // Note: Old WebSocket-based lazy approach removed - now using immediate Agora start

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
      const questionsArray = testData.questions || []
      console.log('[AIML Take] Setting questions:', {
        questionsCount: questionsArray.length,
        questions: questionsArray,
        hasQuestions: questionsArray.length > 0
      })
      setQuestions(questionsArray)

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
      
      console.log('[AIML Take] AccessControl from backend:', {
        canAccess: accessControl?.canAccess,
        examStarted: accessControl?.examStarted,
        canStart: accessControl?.canStart,
        waitingForStart: accessControl?.waitingForStart,
        timeRemaining: accessControl?.timeRemaining,
        errorMessage: accessControl?.errorMessage
      })
      
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
          console.log('[AIML Take] Setting examStarted to true - accessControl.examStarted:', accessControl.examStarted, 'timeRemaining:', accessControl.timeRemaining)
          setWaitingForStart(false)
          setExamStarted(true)
          setTimeRemaining(accessControl.timeRemaining || null)
          setStartedAt(new Date())
          setAccessError(null)
        } else if (accessControl.canStart) {
          // Can start - this shouldn't happen now as flexible mode auto-starts
          // But keep as fallback
          console.log('[AIML Take] Setting examStarted to true via canStart fallback - accessControl.canStart:', accessControl.canStart, 'timeRemaining:', accessControl.timeRemaining)
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
      setCodeAnswers(prev => {
        const updated = {
          ...prev,
          [currentQuestion.id]: code
        }
        // Update ref immediately for timer access
        codeAnswersRef.current = updated
        return updated
      })
      
      // Debounced auto-save (save 2 seconds after user stops typing)
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
      autoSaveRef.current = setTimeout(() => {
        autoSaveAnswer(currentQuestion.id, code)
      }, 2000)
    }
  }, [currentQuestion, autoSaveAnswer, expiredQuestions, test?.timer_mode, unlockedQuestions])

  const handleOutputChange = useCallback((outputs: string[]) => {
    console.log('%c[PARENT] 🟡 handleOutputChange called', 'color: #ffaa00; font-weight: bold; font-size: 14px', {
      currentQuestionId: currentQuestion?.id,
      outputsCount: outputs.length,
      outputs: outputs.map((o, idx) => ({ index: idx, length: o.length, preview: o.substring(0, 50) })),
      isExpired: currentQuestion ? expiredQuestions.has(currentQuestion.id) : false,
      timerMode: test?.timer_mode,
      isUnlocked: currentQuestion ? unlockedQuestions.has(currentQuestion.id) : false
    })
    
    if (currentQuestion && 
        !expiredQuestions.has(currentQuestion.id) &&
        (test?.timer_mode !== 'PER_QUESTION' || unlockedQuestions.has(currentQuestion.id))) {
      console.log('%c[PARENT] ✅ Saving outputs to state', 'color: #00aa00; font-weight: bold; font-size: 14px', {
        questionId: currentQuestion.id,
        outputsCount: outputs.length
      })
      setOutputAnswers(prev => {
        const updated = {
          ...prev,
          [currentQuestion.id]: outputs
        }
        // Update ref immediately for timer access (avoid closure issues)
        outputAnswersRef.current = updated
        console.log('%c[PARENT] 💾 Outputs stored in state AND ref', 'color: #00aa00; font-weight: bold; font-size: 14px', {
          questionId: currentQuestion.id,
          storedOutputs: updated[currentQuestion.id]?.length || 0,
          allStoredQuestions: Object.keys(updated),
          refOutputs: outputAnswersRef.current[currentQuestion.id]?.length || 0
        })
        return updated
      })
    } else {
      console.log('%c[PARENT] ❌ NOT saving outputs - conditions not met', 'color: #ff0000; font-weight: bold; font-size: 14px', {
        hasCurrentQuestion: !!currentQuestion,
        isExpired: currentQuestion ? expiredQuestions.has(currentQuestion.id) : 'N/A',
        timerMode: test?.timer_mode,
        isUnlocked: currentQuestion ? unlockedQuestions.has(currentQuestion.id) : 'N/A'
      })
    }
  }, [currentQuestion, expiredQuestions, test?.timer_mode, unlockedQuestions])

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
      const hasNextQuestion = currentQuestionIndex < questions.length - 1
      if (hasNextQuestion) {
        const nextQuestionId = questions[currentQuestionIndex + 1].id
        setUnlockedQuestions(prev => {
          const newSet = new Set(prev)
          newSet.delete(currentQuestion.id) // Lock current question
          newSet.add(nextQuestionId) // Unlock next question
          return newSet
        })
      }
      
      // Show success notification (only if there's a next question to unlock)
      const toast = document.createElement('div')
      toast.className = 'fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      toast.textContent = hasNextQuestion 
        ? '✓ Answer submitted. Next question unlocked!'
        : '✓ Answer submitted successfully!'
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

  // Auto-submit function (no confirmation, used when timer expires)
  const handleAutoSubmitTest = async () => {
    if (submitted || submitting) {
      console.log('[AIML Take] Auto-submit skipped - already submitted or submitting')
      return
    }

    console.log('[AIML Take] Auto-submitting test due to timer expiration')
    setSubmitting(true)
    
    try {
      // Save all current answers before submitting (use refs for latest values)
      console.log('%c[AUTO-SUBMIT] 💾 Saving all answers before auto-submit', 'color: #0066ff; font-weight: bold; font-size: 14px')
      const savePromises = Object.entries(codeAnswersRef.current).map(async ([questionId, code]) => {
        try {
          // Also save outputs when auto-saving
          const outputs = outputAnswersRef.current[questionId] || []
          await aimlApi.post(
            `/tests/${testId}/submit-answer`,
            {
              user_id: userId,
              question_id: questionId,
              source_code: code,
              outputs: outputs,  // Include outputs in auto-save
            }
          )
        } catch (err) {
          console.error(`%c[AUTO-SUBMIT] ❌ Failed to save answer for question ${questionId}`, 'color: #ff0000; font-weight: bold; font-size: 12px', err)
        }
      })
      await Promise.all(savePromises)
      console.log('%c[AUTO-SUBMIT] ✅ All answers saved, proceeding with submission', 'color: #00aa00; font-weight: bold; font-size: 14px')
      
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
      
      // IMPORTANT: Read from refs to avoid closure issues (same fix as question expiration)
      // Refs always have the latest values, state might be stale
      console.log('%c[AUTO-SUBMIT] 📤 Reading all answers from refs for final submission', 'color: #0066ff; font-weight: bold; font-size: 14px', {
        codeAnswersFromRef: Object.keys(codeAnswersRef.current),
        outputAnswersFromRef: Object.keys(outputAnswersRef.current),
        allQuestions: Object.keys(codeAnswers)
      })
      
      // Backend expects 'answers' with 'source_code' field, not 'question_submissions' with 'code'
      const response = await aimlService.submitTest(String(testId), {
        user_id: userId,
        answers: Object.entries(codeAnswersRef.current).map(([questionId, code]) => {
          const outputs = outputAnswersRef.current[questionId] || []
          console.log('%c[AUTO-SUBMIT] 📝 Including answer', 'color: #00aa00; font-weight: bold; font-size: 12px', {
            questionId,
            codeLength: code.length,
            outputsCount: outputs.length,
            hasOutputs: outputs.length > 0
          })
          return {
            question_id: questionId,
            source_code: code,  // Backend expects 'source_code', not 'code'
            outputs: outputs  // Read from ref, not state
          }
        }),
        activity_logs: undefined,
        candidateRequirements: candidateRequirements
      })
      
      console.log('[AIML Take] Auto-submission successful:', response.data)
      
      setSubmitted(true)
      if (timerRef.current) clearInterval(timerRef.current)
      
      // Show in-page notification (doesn't break fullscreen)
      setNotification({
        message: 'Time is up! Your test has been automatically submitted and is being evaluated.',
        type: 'success'
      })
      
      // Stay on the same page - results page doesn't exist yet
    } catch (err: any) {
      console.error('[AIML Take] Auto-submit error:', err)
      // Show in-page error notification (doesn't break fullscreen)
      setNotification({
        message: err.response?.data?.detail || 'Time is up, but there was an error submitting your test. Please contact support.',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitTest = async () => {
    if (submitted || submitting) return

    // Show in-page confirmation modal (doesn't break fullscreen)
    setShowSubmitConfirm(true)
  }
  
  const handleConfirmSubmit = async () => {
    setShowSubmitConfirm(false)
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
      
      // IMPORTANT: Read from refs to avoid closure issues (same fix as auto-submit)
      console.log('%c[MANUAL-SUBMIT] 📤 Reading all answers from refs for final submission', 'color: #0066ff; font-weight: bold; font-size: 14px', {
        codeAnswersFromRef: Object.keys(codeAnswersRef.current),
        outputAnswersFromRef: Object.keys(outputAnswersRef.current)
      })
      
      // Backend expects 'answers' with 'source_code' field
      const response = await aimlService.submitTest(String(testId), {
        user_id: userId,
        answers: Object.entries(codeAnswersRef.current).map(([questionId, code]) => {
          const outputs = outputAnswersRef.current[questionId] || []
          console.log('%c[MANUAL-SUBMIT] 📝 Including answer', 'color: #00aa00; font-weight: bold; font-size: 12px', {
            questionId,
            codeLength: code.length,
            outputsCount: outputs.length,
            hasOutputs: outputs.length > 0
          })
          return {
            question_id: questionId,
            source_code: code,  // Backend expects 'source_code', not 'code'
            outputs: outputs  // Read from ref, not state
          }
        }),
        activity_logs: undefined,
        candidateRequirements: candidateRequirements
      })
      
      // Log the result for debugging
      console.log('Submission result:', response.data)
      
      setSubmitted(true)
      if (timerRef.current) clearInterval(timerRef.current)
      
      // Show in-page success notification (doesn't break fullscreen)
      setNotification({
        message: 'Test submitted successfully! Your answers are being evaluated.',
        type: 'success'
      })
      
      // Stay on the same page - results page doesn't exist yet
    } catch (err: any) {
      console.error(err)
      // Show in-page error notification (doesn't break fullscreen)
      setNotification({
        message: err.response?.data?.detail || 'Failed to submit test',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Use AITimer hook for per-question or global timer
  const currentQuestionForTimer = questions[currentQuestionIndex] || null
  const timerEnabled = examStarted && !submitted && questions.length > 0
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
    onExpire: handleAutoSubmitTest,
    onQuestionExpire: async (questionId: string) => {
      // IMPORTANT: Read from refs to get latest values (avoid closure/stale state issues)
      // Refs are always up-to-date and don't have closure problems
      const currentCode = codeAnswersRef.current[questionId] || ''
      const currentOutputs = outputAnswersRef.current[questionId] || []
      
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
      
      // Submit the answer with outputs for evaluation (not just auto-save)
      // This ensures the code is evaluated even if user didn't click submit
      if (!token || !userId || !testId) {
        return
      }
      
      try {
        const expiredQuestion = questions.find(q => q.id === questionId)
        if (expiredQuestion && currentCode) {
          // Submit with outputs for evaluation (same as handleSubmitQuestion)
          await aimlApi.post(
            `/tests/${testId}/submit-answer`,
            {
              user_id: userId,
              question_id: questionId,
              source_code: currentCode,
              outputs: currentOutputs,
            }
          )
        } else {
          // Fallback to auto-save if no code or question not found
          await autoSaveAnswer(questionId, currentCode)
        }
      } catch (err) {
        // Try to at least save the code as fallback
        try {
          await autoSaveAnswer(questionId, currentCode)
        } catch (saveErr) {
          // Silent fail - error already logged if needed
        }
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
    enabled: timerEnabled,
  })


  // Update timeRemaining from timer hook (for GLOBAL mode)
  // Only update when value actually changes to prevent unnecessary re-renders
  useEffect(() => {
    if (test?.timer_mode === 'GLOBAL' && timer.timeRemaining !== undefined && timer.timeRemaining !== null) {
      setTimeRemaining(prev => {
        // Only update if value actually changed
        if (prev !== timer.timeRemaining) {
          return timer.timeRemaining
        }
        return prev
      })
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
      
      {/* In-page Notification (doesn't break fullscreen) */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[9999] max-w-md ${
          notification.type === 'success' ? 'bg-emerald-600' : 
          notification.type === 'error' ? 'bg-red-600' : 
          'bg-blue-600'
        } text-white px-6 py-4 rounded-lg shadow-xl flex items-start gap-3`}>
          <div className="flex-shrink-0 mt-0.5">
            {notification.type === 'success' ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : notification.type === 'error' ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm leading-relaxed">{notification.message}</p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
            aria-label="Close notification"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Submit Confirmation Modal (doesn't break fullscreen) */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9998]" onClick={() => setShowSubmitConfirm(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 z-[9999]" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Submission</h3>
              <p className="text-sm text-gray-600 mb-2">
                Are you sure you want to submit the test?
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Your answers will be evaluated by AI and you will receive a score and feedback.
              </p>
              <p className="text-xs text-red-600 font-medium mb-6">
                This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Yes, Submit Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
            {/* Timer */}
{test.timer_mode === 'PER_QUESTION' && currentQuestion && examStarted ? (
  (() => {
    const questionTime = timer.questionTimeRemaining[currentQuestion.id] || 0;
    return questionTime > 0 ? (
      <div className={`px-4 py-1.5 rounded text-sm font-mono font-bold flex items-center gap-2 border ${
        questionTime < 60 ? 'bg-red-50 text-red-700 border-red-200' : 
        questionTime < 180 ? 'bg-amber-50 text-amber-700 border-amber-200' : 
        'bg-[#F0F9F4] text-[#00684A] border-[#E1F2E9]'
      }`}>
        <Timer className="w-4 h-4 opacity-70" strokeWidth={2.5} />
        {Math.floor(questionTime / 60)}:{String(questionTime % 60).padStart(2, '0')}
      </div>
    ) : null;
  })()
) : (
  timeRemaining !== null && !isNaN(timeRemaining) && timeRemaining >= 0 && (
    (() => {
      const displayTime = `${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, '0')}`;
      return (
        <div 
          key={`timer-${timeRemaining}`}
          className={`px-4 py-1.5 rounded text-sm font-mono font-bold flex items-center gap-2 border ${
            timeRemaining < 300 ? 'bg-red-50 text-red-700 border-red-200' : 
            timeRemaining < 600 ? 'bg-amber-50 text-amber-700 border-amber-200' : 
            'bg-gray-50 text-gray-700 border-gray-200'
          }`}
          title="Total Time Remaining"
        >
          <Timer className="w-4 h-4 opacity-70" strokeWidth={2.5} />
          {displayTime}
        </div>
      );
    })()
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
                  <button
                    onClick={() => {
                      if (allQuestionsCompleted) {
                        // Call handleSubmitTest directly - it will show in-page confirmation modal (doesn't break fullscreen)
                        handleSubmitTest()
                      } else {
                        // Show in-page notification (doesn't break fullscreen)
                        setNotification({
                          message: `Please submit all questions before submitting the test. Remaining: ${incompleteQuestions.length} question${incompleteQuestions.length > 1 ? 's' : ''}`,
                          type: 'error'
                        })
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
                // Safety check: ensure next question exists
                if (nextIndex < questions.length && questions[nextIndex]) {
                  const nextQuestion = questions[nextIndex]
                  // Only allow navigation if question is unlocked
                  if (test.timer_mode !== 'PER_QUESTION' || unlockedQuestions.has(nextQuestion.id)) {
                    setCurrentQuestionIndex(nextIndex)
                  }
                }
              }}
              disabled={
                // Disable if it's the last question (no next question exists)
                currentQuestionIndex >= questions.length - 1 ||
                // OR if in PER_QUESTION mode and current question isn't completed/expired
                (test.timer_mode === 'PER_QUESTION' && 
                 currentQuestion && 
                 !completedQuestions.has(currentQuestion.id) &&
                 !expiredQuestions.has(currentQuestion.id)) ||
                // OR if next question doesn't exist (safety check)
                !questions[currentQuestionIndex + 1]
              }
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                currentQuestionIndex >= questions.length - 1 || !questions[currentQuestionIndex + 1]
                  ? 'No more questions'
                  : test.timer_mode === 'PER_QUESTION' && 
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
            onOutputChange={handleOutputChange}
            userId={userId || ''}
            assessmentId={String(testId || '')}
            onPasteViolation={(violation) => {
              handleUniversalViolation({
                eventType: violation.eventType as ProctoringEventType,
                timestamp: violation.timestamp,
                assessmentId: String(testId || ''),
                userId: userId || '',
                metadata: violation.metadata,
              });
            }}
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
