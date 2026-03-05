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
import { Timer, CheckCircle2, AlertTriangle, XCircle, Clock, CheckCircle, ArrowLeft, ArrowRight, Lock, ChevronRight, Check, PlayCircle, ShieldCheck } from 'lucide-react';

// Fullscreen Lock imports
import { FullscreenLockOverlay } from "@/components/FullscreenLockOverlay";
import { useFullscreenLock } from "@/hooks/proctoring/useFullscreenLock";
import { useAITimer } from "@/hooks/useAITimer";
// Activity Pattern Proctor imports
import { useActivityPatternProctor } from "@/hooks/proctoring/useActivityPatternProctor";

const AIMLCompetencyNotebook = dynamic(
  () => import('../../../../components/aiml/competency/AIMLCompetencyNotebook'),
  { ssr: false, loading: () => <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" }}><div style={{ color: "#6B7280", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.5rem" }}><div className="animate-spin h-5 w-5 border-2 border-[#00684A] border-t-transparent rounded-full"></div> Loading Editor Environment...</div></div> }
)

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
  tasks?: Array<string | Task>
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
  
  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({})
  const [outputAnswers, setOutputAnswers] = useState<Record<string, string[]>>({})
  const codeAnswersRef = useRef<Record<string, string>>({})
  const outputAnswersRef = useRef<Record<string, string[]>>({})
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [waitingForStart, setWaitingForStart] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [examStarted, setExamStarted] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    if (notification) {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current)
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null)
      }, 5000)
    }
    return () => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current)
    }
  }, [notification])
  
  const [cameraProctorEnabled, setCameraProctorEnabled] = useState(true)
  const [candidateEmail, setCandidateEmail] = useState<string | null>(null)
  const [proctoringSettings, setProctoringSettings] = useState<any>({})
  const [liveProctoringEnabled, setLiveProctoringEnabled] = useState(false)
  const [liveProctorScreenStream, setLiveProctorScreenStream] = useState<MediaStream | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const [expiredQuestions, setExpiredQuestions] = useState<Set<string>>(new Set())
  const [showTimerExpiryPopup, setShowTimerExpiryPopup] = useState(false)
  const [expiredQuestionId, setExpiredQuestionId] = useState<string | null>(null)
  const [unlockedQuestions, setUnlockedQuestions] = useState<Set<string>>(new Set())
  const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set()) 

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

  const assessmentIdStr = String(testId || '')
  const candidateIdStr = candidateEmail || userId || ''
  
  const {
    isLocked: isFullscreenLocked,
    setIsLocked: setFullscreenLocked,
    exitCount: fullscreenExitCount,
    incrementExitCount: incrementFullscreenExitCount,
    requestFullscreen: requestFullscreenLock,
  } = useFullscreenLock();

  const handleUniversalViolation = useCallback((violation: ProctoringViolation) => {
    pushViolationToast({
      id: `${violation.eventType}-${Date.now()}`,
      eventType: violation.eventType,
      message: getViolationMessage(violation.eventType),
      timestamp: violation.timestamp,
    })

    if (violation.eventType === 'FULLSCREEN_EXIT' && cameraProctorEnabled) {
      setFullscreenLocked(true);
      incrementFullscreenExitCount();
    }
  }, [setFullscreenLocked, incrementFullscreenExitCount, cameraProctorEnabled])

  const handleUniversalWarning = useCallback((warning: any) => {
    if (warning.type === 'FACE_NOT_CLEARLY_VISIBLE') {
      pushViolationToast({
        id: `warning-${warning.type}-${Date.now()}`,
        eventType: warning.type,
        message: warning.message,
        timestamp: new Date(warning.timestamp).toISOString(),
        isWarning: true,
      });
    }
  }, [])

  const handleRequestFullscreen = useCallback(async (): Promise<boolean> => {
    const success = await requestFullscreenLock();
    if (success) setFullscreenLocked(false);
    return success;
  }, [requestFullscreenLock, setFullscreenLocked]);

  const isAdminPreview = useMemo(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('preview') === 'true' && urlParams.get('admin') === 'true'
    }
    return false
  }, [])

  const {
    state: proctoringState,
    isRunning: isProctoringRunning,
    startProctoring: startUniversalProctoring,
    stopProctoring: stopUniversalProctoring,
  } = useUniversalProctoring({
    onViolation: handleUniversalViolation,
    onWarning: handleUniversalWarning,
    debug: debugMode,
  })

  useActivityPatternProctor({
    userId: userId || '',
    assessmentId: String(testId || ''),
    onViolation: (violation) => {
      handleUniversalViolation({
        eventType: violation.eventType,
        timestamp: violation.timestamp,
        assessmentId: violation.assessmentId,
        userId: violation.userId,
        metadata: violation.metadata,
      });
    },
    enabled: !!userId && !!testId && !submitted,
    copyPasteThreshold: 20, 
  });

  useEffect(() => {
    if (submitted) setFullscreenLocked(false);
  }, [submitted, setFullscreenLocked]);

  useEffect(() => {
    if (!testId) return
    
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

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__screenStream) {
      const stream = (window as any).__screenStream as MediaStream;
      if (stream && stream.active && stream.getVideoTracks().length > 0) {
        setLiveProctorScreenStream(stream);
      }
    }
  }, []);

  useEffect(() => {
    if (isAdminPreview) return
    
    const localAssessmentIdStr = String(testId || '')
    const localCandidateIdStr = resolveUserIdForProctoring(null, {
      urlParam: userId as string,
      email: candidateEmail,
    })
    
    if (questions.length > 0 && !isProctoringRunning && !submitted && localCandidateIdStr && thumbVideoRef.current) {
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
          if (liveProctoringEnabled && !liveProctoringStartedRef.current) {
            await startLiveProctoring();
          }
        }
      })
    }
  }, [questions.length, isProctoringRunning, submitted, testId, candidateEmail, userId, cameraProctorEnabled, liveProctoringEnabled, startUniversalProctoring, isAdminPreview])

  const startLiveProctoring = useCallback(async () => {
    if (liveProctoringStartedRef.current) return

    const localAssessmentIdStr = String(testId || '')
    const localCandidateIdStr = resolveUserIdForProctoring(null, {
      urlParam: userId as string,
      email: candidateEmail,
    })

    if (!localAssessmentIdStr || !localCandidateIdStr) return
    liveProctoringStartedRef.current = true

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

      const existingWebcamStream = thumbVideoRef.current?.srcObject as MediaStream | null
      let webcamStream = existingWebcamStream;
      if (!webcamStream || !webcamStream.active) {
        let retries = 0;
        while (retries < 20 && (!webcamStream || !webcamStream.active)) {
          await new Promise(resolve => setTimeout(resolve, 500));
          webcamStream = thumbVideoRef.current?.srcObject as MediaStream | null;
          retries++;
        }
      }

      const success = await liveService.start(
        {
          onStateChange: () => {},
          onError: (error) => console.error('[AIML Take] Live Proctoring error:', error),
        },
        liveProctorScreenStream || null,
        webcamStream || null,
        null, null 
      )

      if (success) {
        liveProctoringServiceRef.current = liveService
      } else {
        liveProctoringStartedRef.current = false
      }
    } catch (error) {
      liveProctoringStartedRef.current = false
    }
  }, [testId, userId, candidateEmail, debugMode, liveProctorScreenStream])

  useEffect(() => {
    if (submitted) {
      stopUniversalProctoring()
      if (liveProctoringServiceRef.current) {
        liveProctoringServiceRef.current.stop()
        liveProctoringServiceRef.current = null
      }
    }
  }, [submitted, stopUniversalProctoring])

  useEffect(() => {
    return () => {
      stopUniversalProctoring()
      if (liveProctoringServiceRef.current) {
        liveProctoringServiceRef.current.stop()
        liveProctoringServiceRef.current = null
      }
    }
  }, [stopUniversalProctoring])

  useEffect(() => {
    if (!token || !userId || !testId || submitted || timeRemaining === null || !examStarted) return
    const syncInterval = setInterval(async () => {
      try {
        const response = await aimlApi.get(`/tests/${testId}/candidate?user_id=${userId}`)
        const testData = response?.data || response
        const accessControl = testData?.accessControl
        if (accessControl?.timeRemaining !== null && accessControl?.timeRemaining !== undefined) {
          setTimeRemaining(Math.max(0, accessControl.timeRemaining))
        } else if (testData.time_remaining_seconds !== undefined && testData.time_remaining_seconds >= 0) {
          setTimeRemaining(Math.max(0, testData.time_remaining_seconds))
        }
      } catch (err) {}
    }, 30000) 
    return () => clearInterval(syncInterval)
  }, [token, userId, testId, submitted, timeRemaining, examStarted])

  useEffect(() => {
    if (!waitingForStart || !startTime || !test || !token || !userId || test.examMode !== "strict") return
    const checkStartTime = async () => {
      const now = new Date()
      if (now >= startTime) {
        if (!testId || !userId || !token) return
        try {
          const { aimlService } = await import('@/services/aiml')
          const response = await aimlService.getTestForCandidate(String(testId), userId, token)
          const testData = response?.data || response
          setTest(testData)
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
    checkStartTime()
    const interval = setInterval(checkStartTime, 1000)
    return () => clearInterval(interval)
  }, [waitingForStart, startTime, test, token, userId, testId])

  const fetchTestData = async (urlToken: string, urlUserId: string) => {
    if (!testId) return
    try {
      setLoading(true)
      const { aimlService } = await import('@/services/aiml')
      let effectiveToken = urlToken
      let effectiveUserId = urlUserId
      if (isAdminPreview) {
        effectiveToken = 'admin_preview_token'
        effectiveUserId = 'admin_preview'
      }
      const response = await aimlService.getTestForCandidate(String(testId), effectiveUserId, effectiveToken)
      const testData = response?.data || response
      if (!testData || !testData.questions) throw new Error('Failed to load test data')
      
      setTest(testData)
      setQuestions(testData.questions || [])

      if (isAdminPreview) {
        setProctoringSettings({ aiProctoringEnabled: false, liveProctoringEnabled: false });
        setCameraProctorEnabled(false);
        setLiveProctoringEnabled(false);
      } else if (testData?.proctoringSettings) {
        setProctoringSettings(testData.proctoringSettings);
        setCameraProctorEnabled(testData.proctoringSettings.aiProctoringEnabled === true);
        setLiveProctoringEnabled(testData.proctoringSettings.liveProctoringEnabled === true);
      } else {
        setProctoringSettings({ aiProctoringEnabled: false, liveProctoringEnabled: false });
        setCameraProctorEnabled(false);
        setLiveProctoringEnabled(false);
      }
      
      const accessControl = testData.accessControl
      const schedule = testData.schedule || {}
      const startTimeStr = schedule.startTime || testData.start_time
      
      if (testData.is_completed) {
        setTimeRemaining(0)
        setSubmitted(true)
        setExamStarted(false)
        setWaitingForStart(false)
        setAccessError(null)
      } else if (accessControl) {
        if (!accessControl.canAccess) {
          setAccessError(accessControl.errorMessage || "You cannot access this assessment at this time.")
          setWaitingForStart(false)
          setExamStarted(false)
          setTimeRemaining(null)
          return
        }
        if (accessControl.waitingForStart) {
          if (startTimeStr) {
            setWaitingForStart(true)
            setStartTime(new Date(startTimeStr))
            setExamStarted(false)
            setTimeRemaining(null)
            setAccessError(null) 
          }
          return
        }
        if (accessControl.examStarted || accessControl.canStart) {
          setWaitingForStart(false)
          setExamStarted(true)
          setTimeRemaining(accessControl.timeRemaining || null)
          setStartedAt(new Date())
          setAccessError(null)
        }
      } else {
        setAccessError("Assessment access information is not available.")
      }
      
      const initialCodes: Record<string, string> = {}
      testData.questions.forEach((q: Question) => {
        initialCodes[q.id] = q.starter_code?.python3 || q.starter_code?.python || ''
      })
      setCodeAnswers(initialCodes)
      
      if (testData.questions && testData.questions.length > 0 && testData.timer_mode === 'PER_QUESTION') {
        setUnlockedQuestions(new Set<string>([testData.questions[0].id]))
        setCompletedQuestions(new Set<string>())
        setExpiredQuestions(new Set<string>())
      } else if (testData.timer_mode !== 'PER_QUESTION' && testData.questions) {
        setUnlockedQuestions(new Set<string>(testData.questions.map((q: Question) => q.id)))
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to load test')
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const currentQuestion = questions[currentQuestionIndex]

  const webcamTile = cameraProctorEnabled ? (
    <WebcamPreview
      ref={thumbVideoRef}
      cameraOn={proctoringState.isCameraOn}
      faceMeshStatus={proctoringState.isModelLoaded ? "loaded" : proctoringState.modelError ? "error" : "loading"}
      facesCount={proctoringState.facesCount}
    />
  ) : null

  const autoSaveAnswer = useCallback(async (questionId: string, code: string) => {
    if (!token || !userId || !testId) return
    try {
      await aimlApi.post(`/tests/${testId}/submit-answer`, {
        user_id: userId,
        question_id: questionId,
        source_code: code,
        outputs: [],
      })
      setLastSaved(new Date())
    } catch (err) {}
  }, [token, userId, testId])

  const handleCodeChange = useCallback((code: string) => {
    if (currentQuestion && !expiredQuestions.has(currentQuestion.id) && (test?.timer_mode !== 'PER_QUESTION' || unlockedQuestions.has(currentQuestion.id))) {
      setCodeAnswers(prev => {
        const updated = { ...prev, [currentQuestion.id]: code }
        codeAnswersRef.current = updated
        return updated
      })
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
      autoSaveRef.current = setTimeout(() => {
        autoSaveAnswer(currentQuestion.id, code)
      }, 2000)
    }
  }, [currentQuestion, autoSaveAnswer, expiredQuestions, test?.timer_mode, unlockedQuestions])

  const handleOutputChange = useCallback((outputs: string[]) => {
    if (currentQuestion && !expiredQuestions.has(currentQuestion.id) && (test?.timer_mode !== 'PER_QUESTION' || unlockedQuestions.has(currentQuestion.id))) {
      setOutputAnswers(prev => {
        const updated = { ...prev, [currentQuestion.id]: outputs }
        outputAnswersRef.current = updated
        return updated
      })
    }
  }, [currentQuestion, expiredQuestions, test?.timer_mode, unlockedQuestions])

  const handleSubmitQuestion = async (code: string, outputs: string[]) => {
    if (!currentQuestion || submitting) return
    setSubmitting(true)
    try {
      setOutputAnswers(prev => ({ ...prev, [currentQuestion.id]: outputs }))
      await aimlApi.post(`/tests/${testId}/submit-answer`, {
        user_id: userId, question_id: currentQuestion.id, source_code: code, outputs: outputs,
      })
      
      setCompletedQuestions(prev => {
        const newSet = new Set(prev); newSet.add(currentQuestion.id); return newSet;
      })
      
      const hasNextQuestion = currentQuestionIndex < questions.length - 1
      if (hasNextQuestion) {
        const nextQuestionId = questions[currentQuestionIndex + 1].id
        setUnlockedQuestions(prev => {
          const newSet = new Set(prev); newSet.delete(currentQuestion.id); newSet.add(nextQuestionId); return newSet;
        })
      }
      setNotification({ message: hasNextQuestion ? 'Answer saved. Proceed to the next question.' : 'All answers saved successfully!', type: 'success' })
    } catch (err: any) {
      setNotification({ message: err.response?.data?.detail || 'Failed to save answer', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAutoSubmitTest = async () => {
    if (submitted || submitting) return
    setSubmitting(true)
    try {
      const savePromises = Object.entries(codeAnswersRef.current).map(async ([questionId, code]) => {
        try {
          await aimlApi.post(`/tests/${testId}/submit-answer`, {
            user_id: userId, question_id: questionId, source_code: code, outputs: outputAnswersRef.current[questionId] || [],  
          })
        } catch (err) {}
      })
      await Promise.all(savePromises)
      
      const candidateRequirements: any = {};
      const phone = sessionStorage.getItem("candidatePhone");
      const linkedIn = sessionStorage.getItem("candidateLinkedIn");
      const github = sessionStorage.getItem("candidateGithub");
      if (phone) candidateRequirements.phone = phone;
      if (linkedIn) candidateRequirements.linkedInUrl = linkedIn;
      if (github) candidateRequirements.githubUrl = github;
      
      const customFieldsStr = sessionStorage.getItem("candidateCustomFields");
      if (customFieldsStr) {
        try { candidateRequirements.customFields = JSON.parse(customFieldsStr); } catch (e) {}
      }

      if (!testId || !userId) throw new Error('Test ID and User ID are required')

      const { aimlService } = await import('@/services/aiml')
      await aimlService.submitTest(String(testId), {
        user_id: userId,
        answers: Object.entries(codeAnswersRef.current).map(([questionId, code]) => ({
          question_id: questionId, source_code: code, outputs: outputAnswersRef.current[questionId] || []
        })),
        activity_logs: undefined,
        candidateRequirements: candidateRequirements
      })
      
      setSubmitted(true)
      if (timerRef.current) clearInterval(timerRef.current)
      setNotification({ message: 'Time is up! Your test has been automatically submitted.', type: 'success' })
    } catch (err: any) {
      setNotification({ message: err.response?.data?.detail || 'Time is up. Assessment closed.', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitTest = async () => {
    if (submitted || submitting) return
    setShowSubmitConfirm(true)
  }
  
  const handleConfirmSubmit = async () => {
    setShowSubmitConfirm(false)
    setSubmitting(true)
    try {
      const candidateRequirements: any = {};
      const phone = sessionStorage.getItem("candidatePhone");
      const linkedIn = sessionStorage.getItem("candidateLinkedIn");
      const github = sessionStorage.getItem("candidateGithub");
      if (phone) candidateRequirements.phone = phone;
      if (linkedIn) candidateRequirements.linkedInUrl = linkedIn;
      if (github) candidateRequirements.githubUrl = github;
      
      const customFieldsStr = sessionStorage.getItem("candidateCustomFields");
      if (customFieldsStr) {
        try { candidateRequirements.customFields = JSON.parse(customFieldsStr); } catch (e) {}
      }

      if (!testId || !userId) throw new Error('Test ID and User ID are required')

      const { aimlService } = await import('@/services/aiml')
      await aimlService.submitTest(String(testId), {
        user_id: userId,
        answers: Object.entries(codeAnswersRef.current).map(([questionId, code]) => ({
          question_id: questionId, source_code: code, outputs: outputAnswersRef.current[questionId] || []
        })),
        activity_logs: undefined,
        candidateRequirements: candidateRequirements
      })
      
      setSubmitted(true)
      if (timerRef.current) clearInterval(timerRef.current)
      setNotification({ message: 'Test submitted successfully! You may close this window.', type: 'success' })
    } catch (err: any) {
      setNotification({ message: err.response?.data?.detail || 'Failed to submit test', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

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
      const currentCode = codeAnswersRef.current[questionId] || ''
      const currentOutputs = outputAnswersRef.current[questionId] || []
      
      setExpiredQuestions(prev => { const newSet = new Set(prev); newSet.add(questionId); return newSet; })
      setCompletedQuestions(prev => { const newSet = new Set(prev); newSet.add(questionId); return newSet; })
      setExpiredQuestionId(questionId)
      
      if (!token || !userId || !testId) return
      
      try {
        const expiredQuestion = questions.find(q => q.id === questionId)
        if (expiredQuestion && currentCode) {
          await aimlApi.post(`/tests/${testId}/submit-answer`, {
            user_id: userId, question_id: questionId, source_code: currentCode, outputs: currentOutputs,
          })
        } else {
          await autoSaveAnswer(questionId, currentCode)
        }
      } catch (err) {
        try { await autoSaveAnswer(questionId, currentCode) } catch (saveErr) {}
      }
      
      const currentIndex = questions.findIndex(q => q.id === questionId)
      if (currentIndex < questions.length - 1) {
        const nextQuestionId = questions[currentIndex + 1].id
        setUnlockedQuestions(prev => {
          const newSet = new Set(prev); newSet.delete(questionId); newSet.add(nextQuestionId); return newSet;
        })
      }
      
      setShowTimerExpiryPopup(true)
      setTimeout(() => {
        setShowTimerExpiryPopup(false)
        if (currentIndex < questions.length - 1) {
          setCurrentQuestionIndex(currentIndex + 1)
        } else {
          handleSubmitTest()
        }
      }, 2500) 
    },
    enabled: timerEnabled,
  })

  useEffect(() => {
    if (test?.timer_mode === 'GLOBAL' && timer.timeRemaining !== undefined && timer.timeRemaining !== null) {
      setTimeRemaining(prev => prev !== timer.timeRemaining ? timer.timeRemaining : prev)
    }
  }, [timer.timeRemaining, test?.timer_mode])


  // ============================================================================
  // RENDER: LOADING STATE
  // ============================================================================
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#FAFCFB" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-[#00684A]"></div>
          <span style={{ fontWeight: 600, color: "#00684A", letterSpacing: "0.05em", textTransform: "uppercase", fontSize: "0.875rem" }}>Loading Assessment...</span>
        </div>
        {cameraProctorEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={handleRequestFullscreen}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the test."
            warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
          />
        )}
      </div>
    )
  }

  // ============================================================================
  // RENDER: ACCESS DENIED
  // ============================================================================
  if (accessError && !examStarted) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ maxWidth: "450px", width: "100%", backgroundColor: "#ffffff", borderRadius: "1rem", padding: "3rem 2rem", textAlign: "center", border: "1px solid #E5E7EB", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ width: "64px", height: "64px", backgroundColor: "#FEF2F2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto", border: "1px solid #FECACA" }}>
            <XCircle size={32} color="#DC2626" />
          </div>
          <h2 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.5rem", fontWeight: 700 }}>Access Denied</h2>
          <p style={{ margin: 0, color: "#6B7280", fontSize: "1rem", lineHeight: "1.5" }}>{accessError}</p>
        </div>
        {cameraProctorEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={handleRequestFullscreen}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the test."
            warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
          />
        )}
      </div>
    )
  }

  // ============================================================================
  // RENDER: PRE-CHECK (WAITING FOR START)
  // ============================================================================
  if (waitingForStart && !examStarted) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ maxWidth: "480px", width: "100%", backgroundColor: "#ffffff", borderRadius: "1rem", padding: "3rem 2rem", textAlign: "center", border: "1px solid #E5E7EB", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ width: "64px", height: "64px", backgroundColor: "#F9FAFB", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto", border: "1px solid #E5E7EB" }}>
            <Clock size={32} color="#00684A" />
          </div>
          <h1 style={{ margin: "0 0 1rem 0", color: "#111827", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.025em" }}>Pre-Check Phase</h1>
          <p style={{ margin: "0 0 1.5rem 0", color: "#4B5563", fontSize: "1rem", lineHeight: "1.6" }}>
            You have successfully completed your pre-checks. The assessment will begin automatically at the scheduled time.
          </p>
          
          {startTime && (
            <div style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "0.75rem", padding: "1.5rem", marginBottom: "1.5rem" }}>
              <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.875rem", color: "#4B5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Assessment Starts At</p>
              <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#111827" }}>
                {startTime.toLocaleString("en-US", {
                  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
                })}
              </p>
            </div>
          )}
          
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#6B7280", fontStyle: "italic" }}>
            Please remain on this page. It will refresh automatically when it's time to begin.
          </p>
        </div>
        {cameraProctorEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={handleRequestFullscreen}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the test."
            warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
          />
        )}
      </div>
    )
  }

  // ============================================================================
  // RENDER: SUBMITTED
  // ============================================================================
  if (submitted) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ maxWidth: "480px", width: "100%", backgroundColor: "#ffffff", borderRadius: "1rem", padding: "3.5rem 2rem", textAlign: "center", border: "1px solid #E5E7EB", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}>
          <div style={{ width: "80px", height: "80px", backgroundColor: "#F9FAFB", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem auto", border: "2px solid #E5E7EB" }}>
            <CheckCircle size={40} color="#00684A" strokeWidth={2.5} />
          </div>
          <h1 style={{ margin: "0 0 1rem 0", color: "#111827", fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.025em" }}>Test Submitted!</h1>
          <p style={{ margin: "0 0 2rem 0", color: "#4B5563", fontSize: "1.05rem", lineHeight: "1.6" }}>
            Your answers have been securely recorded and sent for evaluation.
          </p>
          
          <div style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "0.75rem", padding: "1.5rem", marginBottom: "2rem", textAlign: "left" }}>
            <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem", color: "#111827", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="animate-pulse">✨</span> Analysis in Progress...
            </p>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#4B5563", lineHeight: "1.5" }}>
              Our system is reviewing your code, execution outputs, and overall approach. You will be contacted by the administrator regarding your results.
            </p>
          </div>
          
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#6B7280", fontWeight: 500 }}>
            You may close this window safely.
          </p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER: NOT FOUND
  // ============================================================================
  if (!test || questions.length === 0) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ maxWidth: "450px", width: "100%", backgroundColor: "#ffffff", borderRadius: "1rem", padding: "3rem 2rem", textAlign: "center", border: "1px solid #E5E7EB", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}>
          <AlertTriangle size={48} color="#9CA3AF" style={{ margin: "0 auto 1.5rem auto" }} />
          <p style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.5rem", fontWeight: 700 }}>Test Not Found</p>
          <p style={{ margin: 0, color: "#6B7280", fontSize: "1rem" }}>Please double-check your assessment link and try again.</p>
        </div>
        {cameraProctorEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={handleRequestFullscreen}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the test."
            warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
          />
        )}
      </div>
    )
  }

  // ============================================================================
  // COMPUTE STATES FOR ACTIVE UI
  // ============================================================================
  const allQuestionsCompleted = questions.length > 0 && questions.every(q => completedQuestions.has(q.id) || expiredQuestions.has(q.id))

  // Extract timer logic to prevent huge inline blocks
  let timerDisplay = null;
  if (test.timer_mode === 'PER_QUESTION' && currentQuestion && examStarted) {
    const questionTime = timer.questionTimeRemaining[currentQuestion.id] || 0;
    if (questionTime > 0) {
      timerDisplay = (
        <div style={{ 
          padding: "0.75rem 1.25rem", borderRadius: "0.5rem", fontFamily: "monospace", fontWeight: 800, fontSize: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
          backgroundColor: questionTime < 60 ? "#FEF2F2" : "#FFFFFF",
          color: questionTime < 60 ? "#DC2626" : "#111827",
          border: `1px solid ${questionTime < 60 ? "#FECACA" : "#E5E7EB"}`,
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
        }}>
          <Timer size={24} color={questionTime < 60 ? "#DC2626" : "#6B7280"} />
          {Math.floor(questionTime / 60)}:{String(questionTime % 60).padStart(2, '0')}
        </div>
      );
    }
  } else if (timeRemaining !== null && !isNaN(timeRemaining) && timeRemaining >= 0) {
    const displayTime = `${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, '0')}`;
    timerDisplay = (
      <div style={{ 
        padding: "0.75rem 1.25rem", borderRadius: "0.5rem", fontFamily: "monospace", fontWeight: 800, fontSize: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
        backgroundColor: timeRemaining < 300 ? "#FEF2F2" : "#FFFFFF",
        color: timeRemaining < 300 ? "#DC2626" : "#111827",
        border: `1px solid ${timeRemaining < 300 ? "#FECACA" : "#E5E7EB"}`,
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
      }}>
        <Timer size={24} color={timeRemaining < 300 ? "#DC2626" : "#6B7280"} />
        {displayTime}
      </div>
    );
  }

  // ============================================================================
  // RENDER: ACTIVE TEST UI (Responsive Emerald Left-Sidebar Layout)
  // ============================================================================
  return (
    <div className="flex flex-col md:flex-row h-screen bg-white font-sans overflow-hidden">
      <ViolationToast />
      {webcamTile}
      
      {/* Top-Right Notification System */}
      {notification && (
        <div style={{
          position: "fixed", top: "1rem", right: "1rem", zIndex: 9999, maxWidth: "400px",
          backgroundColor: notification.type === 'success' ? '#00684A' : notification.type === 'error' ? '#DC2626' : '#2563EB',
          color: "#ffffff", padding: "1rem 1.25rem", borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          display: "flex", alignItems: "flex-start", gap: "0.75rem", animation: "slideIn 0.3s ease-out forwards"
        }}>
          <div style={{ marginTop: "0.125rem" }}>
            {notification.type === 'success' ? <CheckCircle2 size={20} /> : notification.type === 'error' ? <AlertTriangle size={20} /> : <Clock size={20} />}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 500, fontSize: "0.9rem", lineHeight: "1.4" }}>{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", padding: 0 }}>
            <XCircle size={18} />
          </button>
        </div>
      )}
      
      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }} onClick={() => setShowSubmitConfirm(false)}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "1rem", padding: "2rem", maxWidth: "450px", width: "90%", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", zIndex: 9999 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: "64px", height: "64px", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
              <AlertTriangle size={32} color="#00684A" />
            </div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Confirm Submission</h3>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", color: "#4B5563", lineHeight: "1.5" }}>Are you sure you want to finalize and submit the test?</p>
            <p style={{ margin: "0 0 1.5rem 0", fontSize: "0.95rem", color: "#4B5563", lineHeight: "1.5" }}>Your answers will be saved and you will receive a score soon.</p>
            <p style={{ margin: "0 0 2rem 0", fontSize: "0.85rem", color: "#DC2626", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>This action cannot be undone.</p>
            
            <div style={{ display: "flex", gap: "0.75rem", justifyItems: "center", justifyContent: "center" }}>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                style={{ padding: "0.75rem 1.5rem", backgroundColor: "#ffffff", color: "#374151", borderRadius: "0.5rem", border: "1px solid #D1D5DB", fontWeight: 600, cursor: "pointer", transition: "all 0.2s", height: "44px", display: "flex", alignItems: "center" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={submitting}
                style={{ padding: "0.75rem 1.5rem", backgroundColor: "#00684A", color: "#ffffff", borderRadius: "0.5rem", border: "none", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, transition: "all 0.2s", height: "44px", display: "flex", alignItems: "center" }}
                onMouseEnter={(e) => { if(!submitting) e.currentTarget.style.backgroundColor = "#084A2A" }}
                onMouseLeave={(e) => { if(!submitting) e.currentTarget.style.backgroundColor = "#00684A" }}
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timer Expiry Popup Modal */}
      {showTimerExpiryPopup && expiredQuestionId && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "1rem", padding: "2.5rem", maxWidth: "400px", width: "90%", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
            <div style={{ width: "64px", height: "64px", backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
              <Clock size={32} color="#DC2626" />
            </div>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.5rem", fontWeight: 800, color: "#111827" }}>Time's Up!</h3>
            <p style={{ margin: "0 0 1.5rem 0", color: "#4B5563", fontSize: "1rem" }}>Saving your progress and advancing...</p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-t-2 border-[#00684A]"></div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LOCK OVERLAY */}
      {cameraProctorEnabled && (
        <FullscreenLockOverlay
          isLocked={isFullscreenLocked}
          onRequestFullscreen={handleRequestFullscreen}
          exitCount={fullscreenExitCount}
          message="You must be in fullscreen mode to continue the test. All your progress is saved."
          warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
        />
      )}

      {/* ========================================================= */}
      {/* SIDEBAR: Test Info, Timer, and Question List */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* SIDEBAR: Test Info, Timer, and Question List */}
      {/* ========================================================= */}
      <aside className="w-full md:w-[220px] flex-shrink-0 bg-[#FAFCFB] border-b md:border-b-0 md:border-r border-[#E5E7EB] flex flex-col z-10 max-h-[35vh] md:max-h-full overflow-y-auto">
        {/* Sidebar Header */}
        <div style={{ padding: "1.25rem", borderBottom: "1px solid #E5E7EB", backgroundColor: "#ffffff" }}>
          <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "1.125rem", fontWeight: 800, color: "#111827", lineHeight: "1.3" }}>
            {test.title}
          </h1>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", backgroundColor: "#F9FAFB", color: "#4B5563", borderRadius: "1rem", fontSize: "0.75rem", fontWeight: 600, border: "1px solid #E5E7EB" }}>
            <ShieldCheck size={12} /> Proctored Assessment
          </span>
        </div>

        {/* Timer Widget */}
        <div style={{ padding: "1.25rem 1.25rem 0.5rem 1.25rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
            {test.timer_mode === 'PER_QUESTION' ? "Question Time Remaining" : "Total Time Remaining"}
          </div>
          {timerDisplay}
        </div>

        {/* Question List */}
        <div style={{ flex: 1, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
            Questions ({questions.length})
          </div>
          
          {questions.map((q, idx) => {
            const isExpired = expiredQuestions.has(q.id)
            const isLocked = test.timer_mode === 'PER_QUESTION' && !unlockedQuestions.has(q.id)
            const isCompleted = completedQuestions.has(q.id)
            const isCurrent = idx === currentQuestionIndex
            
            const btnStyle = isCurrent 
              ? { bg: "#ffffff", text: "#00684A", border: "#00684A", icon: <ChevronRight size={16} color="#00684A" /> }
              : isLocked || isExpired
                ? { bg: "#F9FAFB", text: "#9CA3AF", border: "#E5E7EB", icon: <Lock size={14} color="#9CA3AF" /> }
                : isCompleted || (codeAnswers[q.id] && codeAnswers[q.id].trim() !== '')
                  ? { bg: "#ffffff", text: "#059669", border: "#E5E7EB", icon: <Check size={16} color="#059669" /> }
                  : { bg: "#ffffff", text: "#4B5563", border: "#E5E7EB", icon: <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#D1D5DB" }} /> }

            return (
              <button
                key={q.id}
                onClick={() => { if (!isLocked && !isExpired) setCurrentQuestionIndex(idx) }}
                disabled={isLocked || isExpired}
                style={{
                  width: "100%", textAlign: "left", padding: "0.875rem", borderRadius: "0.5rem",
                  backgroundColor: btnStyle.bg, color: btnStyle.text, 
                  border: `1px solid ${btnStyle.border}`,
                  cursor: (isLocked || isExpired) ? "not-allowed" : "pointer", 
                  transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "space-between",
                  boxShadow: isCurrent ? "0 2px 4px rgba(0, 104, 74, 0.05)" : "none"
                }}
                onMouseEnter={(e) => { if(!isLocked && !isExpired && !isCurrent) e.currentTarget.style.backgroundColor = "#F3F4F6"; }}
                onMouseLeave={(e) => { if(!isLocked && !isExpired && !isCurrent) e.currentTarget.style.backgroundColor = btnStyle.bg; }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", overflow: "hidden", paddingRight: "0.5rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>Question {idx + 1}</span>
                  <span style={{ fontSize: "0.75rem", opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.title}</span>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {btnStyle.icon}
                </div>
              </button>
            )
          })}
        </div>

        {/* Submit Button Area */}
        <div style={{ padding: "1.25rem", borderTop: "1px solid #E5E7EB", backgroundColor: "#ffffff", marginTop: "auto" }}>
          <button
            onClick={() => {
              if (allQuestionsCompleted) {
                handleSubmitTest()
              } else {
                setNotification({ message: `Please complete all questions before submitting.`, type: 'error' })
              }
            }}
            disabled={submitting || !allQuestionsCompleted}
            style={{ 
              width: "100%", height: "44px", backgroundColor: "#00684A", color: "#ffffff", borderRadius: "0.5rem", 
              fontSize: "0.95rem", fontWeight: 700, border: "none", cursor: (submitting || !allQuestionsCompleted) ? "not-allowed" : "pointer",
              opacity: (submitting || !allQuestionsCompleted) ? 0.6 : 1, transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem"
            }}
            onMouseEnter={(e) => { if(!(submitting || !allQuestionsCompleted)) e.currentTarget.style.backgroundColor = "#084A2A" }}
            onMouseLeave={(e) => { if(!(submitting || !allQuestionsCompleted)) e.currentTarget.style.backgroundColor = "#00684A" }}
          >
            {submitting ? 'Submitting...' : 'Submit Assessment'}
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MAIN CONTENT: Editor Header & IDE */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col min-w-0 bg-white h-[65vh] md:h-full relative overflow-hidden">
        
        {/* Editor Top Bar */}
        <header style={{ height: "60px", flexShrink: 0, borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.25rem", backgroundColor: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#111827" }}>
              {currentQuestion?.title || "Loading..."}
            </h2>
            {currentQuestion?.difficulty && (
              <span style={{ 
                padding: "0.15rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", 
                backgroundColor: "#F9FAFB", color: "#4B5563", border: "1px solid #E5E7EB"
              }}>
                {currentQuestion.difficulty}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              onClick={() => {
                const prevIndex = currentQuestionIndex - 1
                if (prevIndex >= 0) {
                  const prevQuestion = questions[prevIndex]
                  if (test?.timer_mode !== 'PER_QUESTION' && !expiredQuestions.has(prevQuestion.id)) {
                    setCurrentQuestionIndex(prevIndex)
                  }
                }
              }}
              disabled={test?.timer_mode === 'PER_QUESTION' || currentQuestionIndex === 0 || (currentQuestionIndex > 0 && expiredQuestions.has(questions[currentQuestionIndex - 1]?.id))}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", height: "36px", padding: "0 1rem", backgroundColor: "#ffffff", border: "1px solid #D1D5DB",
                borderRadius: "0.375rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151", cursor: "pointer", transition: "all 0.2s",
                opacity: (test?.timer_mode === 'PER_QUESTION' || currentQuestionIndex === 0 || (currentQuestionIndex > 0 && expiredQuestions.has(questions[currentQuestionIndex - 1]?.id))) ? 0.5 : 1
              }}
              onMouseEnter={(e) => { if (e.currentTarget.style.opacity === '1') e.currentTarget.style.backgroundColor = "#F9FAFB" }}
              onMouseLeave={(e) => { if (e.currentTarget.style.opacity === '1') e.currentTarget.style.backgroundColor = "#ffffff" }}
            >
              <ArrowLeft size={16} /> Prev
            </button>
            <button
              onClick={() => {
                const nextIndex = currentQuestionIndex + 1
                if (nextIndex < questions.length && questions[nextIndex]) {
                  const nextQuestion = questions[nextIndex]
                  if (test?.timer_mode !== 'PER_QUESTION' || unlockedQuestions.has(nextQuestion.id)) {
                    setCurrentQuestionIndex(nextIndex)
                  }
                }
              }}
              disabled={
                currentQuestionIndex >= questions.length - 1 ||
                (test?.timer_mode === 'PER_QUESTION' && currentQuestion && !completedQuestions.has(currentQuestion.id) && !expiredQuestions.has(currentQuestion.id)) ||
                !questions[currentQuestionIndex + 1]
              }
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", height: "36px", padding: "0 1rem", backgroundColor: "#ffffff", border: "1px solid #D1D5DB",
                borderRadius: "0.375rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151", cursor: "pointer", transition: "all 0.2s",
                opacity: (currentQuestionIndex >= questions.length - 1 || (test?.timer_mode === 'PER_QUESTION' && currentQuestion && !completedQuestions.has(currentQuestion.id) && !expiredQuestions.has(currentQuestion.id)) || !questions[currentQuestionIndex + 1]) ? 0.5 : 1
              }}
              onMouseEnter={(e) => { if (e.currentTarget.style.opacity === '1') e.currentTarget.style.backgroundColor = "#F9FAFB" }}
              onMouseLeave={(e) => { if (e.currentTarget.style.opacity === '1') e.currentTarget.style.backgroundColor = "#ffffff" }}
            >
              Next <ArrowRight size={16} />
            </button>
          </div>
        </header>

        {/* IDE Area */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
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
        </div>
      </main>
    </div>
  )
}