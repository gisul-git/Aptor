'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import { Card, CardContent } from '../../../components/dsa/ui/card'
import { useDSATest, useDSACandidates, useRunDSACode, useSubmitDSACode, useDSATestSubmission, useStartDSATest, useDSAPublicTest, useDSATestQuestion, useFinalSubmitDSATest, useRunDSASQL, useSubmitDSASQL, useRunDSACodePublic, useSubmitDSACodeFull } from '@/hooks/api/useDSA'
import { dsaService } from '@/services/dsa'
import { AlertCircle } from 'lucide-react'
import { getLanguageId, LANGUAGE_IDS } from '../../../lib/dsa/judge0'
import Split from 'react-split'
import { TimerBar } from '../../../components/dsa/test/TimerBar'
import { QuestionSidebar } from '../../../components/dsa/test/QuestionSidebar'
import { QuestionTabs } from '../../../components/dsa/test/QuestionTabs'
import { EditorContainer, SubmissionTestcaseResult } from '../../../components/dsa/test/EditorContainer'
import type { SubmissionHistoryEntry } from '../../../components/dsa/test/EditorContainer'
import { SQLEditorContainer } from '../../../components/dsa/test/SQLEditorContainer'
import { OutputConsole } from '../../../components/dsa/test/OutputConsole'
// Universal Proctoring imports
import {
  useUniversalProctoring,
  CandidateLiveService,
  resolveUserIdForProctoring,
  type ProctoringViolation,
} from "@/universal-proctoring";
import WebcamPreview from "@/components/WebcamPreview";
import { ViolationToast, pushViolationToast } from "@/components/ViolationToast";
import { useDSTimer } from '@/hooks/useDSTimer'
import { 
  FullscreenPrompt
} from '../../../components/proctor'

// Fullscreen Lock imports
import { FullscreenLockOverlay } from "@/components/FullscreenLockOverlay";
import { useFullscreenLock } from "@/hooks/proctoring/useFullscreenLock";
interface Example {
  input: string
  output: string
  explanation?: string | null
}

interface FunctionParameter {
  name: string
  type: string
}

interface FunctionSignature {
  name: string
  parameters: FunctionParameter[]
  return_type: string
}

// Table schema for SQL questions
interface TableSchema {
  columns: Record<string, string>
}

interface Question {
  id: string
  title: string
  description: string
  examples?: Example[]
  constraints?: string[]
  difficulty: string
  languages: string[]
  starter_code: Record<string, string>
  function_signature?: FunctionSignature
  public_testcases?: Array<{ input: string; expected_output: string }>
  hidden_testcases?: Array<{ input: string; expected_output: string }>
  // SQL-specific fields
  question_type?: 'coding' | 'SQL'
  sql_category?: string
  schemas?: Record<string, TableSchema>
  sample_data?: Record<string, any[][]>
  starter_query?: string
  hints?: string[]
  sql_expected_output?: string | any[]
}

// Timer mode types
type TimerMode = 'GLOBAL' | 'PER_QUESTION'

// Question timing for per-question mode
interface QuestionTiming {
  question_id: string
  duration_minutes: number
}

interface Test {
  id: string
  title: string
  description: string
  question_ids: string[]
  duration_minutes: number
  start_time: string
  end_time: string
  // Timer configuration
  timer_mode?: TimerMode
  question_timings?: QuestionTiming[]
}

interface VisibleTestcase {
  id: string
  input: string
  expected: string
}

export default function TestTakePage() {
  const router = useRouter()
  const { id: testId } = router.query
  
  // Get token and userId from URL
  const getTokenFromUrl = (): string | null => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('token')
    }
    return (router.query.token as string) || null
  }
  
  const getUserIdFromUrl = (): string | null => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('user_id')
    }
    return (router.query.user_id as string) || null
  }
  
  // Initialize state with values from URL
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('token')
    }
    return null
  })
  const [userId, setUserId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('user_id')
    }
    return null
  })

  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [code, setCode] = useState<Record<string, string>>({})
  const [language, setLanguage] = useState<Record<string, string>>({})
  
  // Sequential question progression state (for PER_QUESTION mode only)
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<string, boolean>>({})
  const [autoSubmittedQuestions, setAutoSubmittedQuestions] = useState<Record<string, boolean>>({})
  
  const [testSubmission, setTestSubmission] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkingParams, setCheckingParams] = useState(true)
  const [running, setRunning] = useState(false)
  const [candidateEmail, setCandidateEmail] = useState<string | null>(null)
  const [candidateName, setCandidateName] = useState<string | null>(null)
  const [precheckMode, setPrecheckMode] = useState<{start_time: string, message: string} | null>(null)
  const [canStartNow, setCanStartNow] = useState(false)
  const [timeUntilStart, setTimeUntilStart] = useState<number>(0)
  const [testReadyToStart, setTestReadyToStart] = useState(false)
  // ============================================================================
  // PROCTORING STATE & REFS (Universal Proctoring System)
  // ============================================================================

  // AI (camera-based) proctoring toggle from schedule.proctoringSettings
  const [aiProctoringEnabled, setAiProctoringEnabled] = useState(false);
  const [liveProctoringEnabled, setLiveProctoringEnabled] = useState(false);
  const [liveProctorScreenStream, setLiveProctorScreenStream] = useState<MediaStream | null>(null);
  
  // Universal proctoring hook
  const thumbVideoRef = useRef<HTMLVideoElement>(null);
  const liveProctoringServiceRef = useRef<CandidateLiveService | null>(null);
  const liveProctoringStartedRef = useRef(false);
  const startSessionCalledRef = useRef(false); // Guard: prevent multiple start-session calls
  const candidateWsRef = useRef<WebSocket | null>(null); // Store candidate WebSocket to pass to service
  const candidateSessionIdRef = useRef<string | null>(null); // Store sessionId to pass to service
  const pendingAnswerRef = useRef<any>(null); // Queue answer message if received before service starts
  const pendingIceCandidatesRef = useRef<any[]>([]); // Queue ICE candidates if received before service starts

  const editorRef = useRef<HTMLDivElement>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

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


  // Check if this is admin preview mode
  const isAdminPreview = useMemo(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('preview') === 'true' && urlParams.get('admin') === 'true'
    }
    return false
  }, [])

  // Enforce unified gate completion (deep-link safety) - SKIP if admin preview
  useEffect(() => {
    if (isAdminPreview) return // Skip precheck for admin preview
    if (!router.isReady) return
    if (!testId) return
    const id = String(testId)
    const urlToken = getTokenFromUrl()
    if (!urlToken) return

    const precheckCompleted = sessionStorage.getItem(`precheckCompleted_${id}`)
    const instructionsAcknowledged = sessionStorage.getItem(`instructionsAcknowledged_${id}`)
    const candidateRequirementsCompleted = sessionStorage.getItem(`candidateRequirementsCompleted_${id}`)
    const identityVerificationCompleted = sessionStorage.getItem(`identityVerificationCompleted_${id}`)

    if (!precheckCompleted || !instructionsAcknowledged || !candidateRequirementsCompleted || !identityVerificationCompleted) {
      router.replace(`/precheck/${id}/${encodeURIComponent(urlToken)}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, testId, isAdminPreview])
  
  // Proctoring settings - will be loaded from test data
  const [proctoringSettings, setProctoringSettings] = useState<any>({
    aiProctoringEnabled: false,
    liveProctoringEnabled: false,
  });

  // Generate boilerplate code when starter code is missing
  const generateBoilerplate = (lang: string, question?: Question): string => {
    const langLower = lang.toLowerCase()
    
    const funcSig = question?.function_signature
    const funcName = funcSig?.name || 'solution'
    const params = funcSig?.parameters || []
    const returnType = funcSig?.return_type || 'void'
    const returnTypeLower = returnType.toLowerCase()
    
    const mapType = (type: string, lang: string): string => {
      const typeLower = type.toLowerCase()
      const langLower = lang.toLowerCase()
      
      const typeMap: Record<string, Record<string, string>> = {
        'number': {
          'python': '',
          'javascript': '',
          'typescript': 'number',
          'cpp': 'int',
          'c++': 'int',
          'java': 'int',
          'c': 'int',
          'go': 'int',
          'rust': 'i32',
          'kotlin': 'Int',
          'csharp': 'int',
          'c#': 'int',
        },
        'string': {
          'python': '',
          'javascript': '',
          'typescript': 'string',
          'cpp': 'string',
          'c++': 'string',
          'java': 'String',
          'c': 'char*',
          'go': 'string',
          'rust': 'String',
          'kotlin': 'String',
          'csharp': 'string',
          'c#': 'string',
        },
        'boolean': {
          'python': '',
          'javascript': '',
          'typescript': 'boolean',
          'cpp': 'bool',
          'c++': 'bool',
          'java': 'boolean',
          'c': 'bool',
          'go': 'bool',
          'rust': 'bool',
          'kotlin': 'Boolean',
          'csharp': 'bool',
          'c#': 'bool',
        },
        'int[]': {
          'python': '',
          'javascript': '',
          'typescript': 'number[]',
          'cpp': 'vector<int>',
          'c++': 'vector<int>',
          'java': 'int[]',
          'c': 'int*',
          'go': '[]int',
          'rust': 'Vec<i32>',
          'kotlin': 'IntArray',
          'csharp': 'int[]',
          'c#': 'int[]',
        },
        'string[]': {
          'python': '',
          'javascript': '',
          'typescript': 'string[]',
          'cpp': 'vector<string>',
          'c++': 'vector<string>',
          'java': 'String[]',
          'c': 'char**',
          'go': '[]string',
          'rust': 'Vec<String>',
          'kotlin': 'Array<String>',
          'csharp': 'string[]',
          'c#': 'string[]',
        },
      }
      
      if (typeMap[typeLower] && typeMap[typeLower][langLower]) {
        return typeMap[typeLower][langLower]
      }
      return type
    }
    
    const formatParams = (lang: string): string => {
      if (params.length === 0) return ''
      const langLower = lang.toLowerCase()
      
      switch (langLower) {
        case 'python':
          return params.map(p => p.name).join(', ')
        case 'javascript':
          return params.map(p => p.name).join(', ')
        case 'typescript':
          return params.map(p => `${p.name}: ${mapType(p.type, lang)}`).join(', ')
        case 'cpp':
        case 'c++':
          return params.map(p => `${mapType(p.type, lang)} ${p.name}`).join(', ')
        case 'java':
          return params.map(p => `${mapType(p.type, lang)} ${p.name}`).join(', ')
        case 'c':
          return params.map(p => `${mapType(p.type, lang)} ${p.name}`).join(', ')
        case 'go':
          return params.map(p => `${p.name} ${mapType(p.type, lang)}`).join(', ')
        case 'rust':
          return params.map(p => `${p.name}: ${mapType(p.type, lang)}`).join(', ')
        case 'kotlin':
          return params.map(p => `${p.name}: ${mapType(p.type, lang)}`).join(', ')
        case 'csharp':
        case 'c#':
          return params.map(p => `${mapType(p.type, lang)} ${p.name}`).join(', ')
        default:
          return params.map(p => p.name).join(', ')
      }
    }
    
    const paramsStr = formatParams(langLower)
    const mappedReturnType = mapType(returnType, langLower)
    
    const getDefaultReturn = (rt: string, lang: string): string => {
      const rtLower = rt.toLowerCase()
      if (rtLower === 'void' || rtLower === '') return ''
      if (rtLower === 'int' || rtLower === 'integer' || rtLower === 'number') return '0'
      if (rtLower === 'string' || rtLower === 'str') return '""'
      if (rtLower === 'bool' || rtLower === 'boolean') return 'false'
      if (rtLower === 'float' || rtLower === 'double') return '0.0'
      if (rtLower.includes('[]') || rtLower.includes('array') || rtLower.includes('list')) {
        if (lang === 'java') return 'new int[0]'
        if (lang === 'python') return '[]'
        return '[]'
      }
      return 'null'
    }
    
    const defaultReturn = getDefaultReturn(returnType, langLower)
    const isVoid = returnTypeLower === 'void' || returnTypeLower === ''
    
    switch (langLower) {
      case 'python':
        return `def ${funcName}(${paramsStr}):\n    # Your code here\n    ${isVoid ? 'pass' : 'return None'}\n`
      case 'javascript':
        return `function ${funcName}(${paramsStr}) {\n    // Your code here\n    ${isVoid ? '' : `return ${defaultReturn}`}\n}\n`
      case 'typescript':
        return `function ${funcName}(${paramsStr}): ${mappedReturnType} {\n    // Your code here\n    ${isVoid ? '' : `return ${defaultReturn}`}\n}\n`
      case 'cpp':
      case 'c++':
        return `#include <iostream>\nusing namespace std;\n\n${mappedReturnType} ${funcName}(${paramsStr}) {\n    // Your code here\n    ${isVoid ? '' : `return ${defaultReturn}`}\n}\n`
      case 'java':
        return `public class Main {\n    public static ${mappedReturnType} ${funcName}(${paramsStr}) {\n        // Your code here\n        ${isVoid ? '' : `return ${defaultReturn}`}\n    }\n    public static void main(String[] args) {\n        // You can test your function here\n    }\n}\n`
      case 'c':
        return `#include <stdio.h>\n\n${mappedReturnType} ${funcName}(${paramsStr}) {\n    // Your code here\n    ${isVoid ? '' : `return ${defaultReturn}`}\n}\n`
      case 'go':
        return `package main\n\nfunc ${funcName}(${paramsStr})${isVoid ? '' : ` ${mappedReturnType}`} {\n    // Your code here\n    ${isVoid ? '' : `return ${defaultReturn}`}\n}\n`
      case 'rust':
        return `fn ${funcName}(${paramsStr})${isVoid ? '' : ` -> ${mappedReturnType}`} {\n    // Your code here\n    ${isVoid ? '' : defaultReturn}\n}\n`
      case 'kotlin':
        return `fun ${funcName}(${paramsStr})${isVoid ? '' : `: ${mappedReturnType}`} {\n    // Your code here\n    ${isVoid ? '' : `return ${defaultReturn}`}\n}\n`
      case 'csharp':
      case 'c#':
        return `using System;\n\npublic class Solution {\n    public static ${mappedReturnType} ${funcName}(${paramsStr}) {\n        // Your code here\n        ${isVoid ? '' : `return ${defaultReturn}`}\n    }\n}\n`
      default:
        return `// Your code here\n`
    }
  }

  const [output, setOutput] = useState<Record<string, {
    stdout?: string
    stderr?: string
    compileOutput?: string
    status?: string
    time?: number
    memory?: number
  }>>({})
  const [questionStatus, setQuestionStatus] = useState<Record<string, 'solved' | 'attempted' | 'not-attempted'>>({})
  const [isMobile, setIsMobile] = useState(false)
  const [submissionHistory, setSubmissionHistory] = useState<Record<string, SubmissionHistoryEntry[]>>({})
  const [visibleTestcasesMap, setVisibleTestcasesMap] = useState<Record<string, VisibleTestcase[]>>({})
  const [publicResults, setPublicResults] = useState<Record<string, SubmissionTestcaseResult[]>>({})
  const [hiddenSummary, setHiddenSummary] = useState<Record<string, { total: number; passed: number } | null>>({})
  const [questionStartTimes, setQuestionStartTimes] = useState<Record<string, string>>({})
  const [testStartedAt, setTestStartedAt] = useState<string | null>(null)
  // Store SQL execution engine results for final-submit
  const [sqlExecutionResults, setSqlExecutionResults] = useState<Record<string, {
    passed: boolean
    actualOutput: string
    expectedOutput: string
    time?: number
    memory?: number
  }>>({})

  // Check debug mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      setDebugMode(
        urlParams.get('cameraDebug') === 'true' || 
        urlParams.get('proctorDebug') === 'true' ||
        process.env.NEXT_PUBLIC_CAMERA_DEBUG === 'true'
      )
    }
  }, [])

  // Get client-side values safely
  const isClient = typeof window !== 'undefined';
  const assessmentIdStr = typeof testId === 'string' ? testId : '';
  
  // Resolve userId with priority: URL param > email > anonymous
  // Note: session.user.id would be ideal but requires SessionProvider context
  // For now, URL params and email fallbacks work for all take page scenarios
  // CRITICAL: Memoize to prevent infinite render loops - this was being called on every render
  const candidateIdStr = useMemo(() => {
    return resolveUserIdForProctoring(null, {
      urlParam: userId as string,
      email: candidateEmail,
    });
  }, [userId, candidateEmail]);
  
  // Log the candidateId being used for debugging
  useEffect(() => {
    if (isClient && test && questions.length > 0) {
      console.log('[DSA Take] Proctoring Configuration:', {
        candidateId: candidateIdStr,
        candidateIdType: typeof candidateIdStr,
        candidateIdLength: candidateIdStr?.length,
        candidateEmail: candidateEmail,
        userIdFromUrl: userId,
        assessmentId: assessmentIdStr,
        aiProctoringEnabled: aiProctoringEnabled,
        liveProctoringEnabled: liveProctoringEnabled,
      });
    }
  }, [isClient, test, questions.length, candidateIdStr, candidateEmail, userId, assessmentIdStr, aiProctoringEnabled, liveProctoringEnabled]);

  // ============================================================================
  // UNIVERSAL PROCTORING INTEGRATION
  // ============================================================================

  // ============================================================================
  // FULLSCREEN LOCK - Violation-driven lock state (SIMPLIFIED)
  // ============================================================================
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
    console.log('[DSA Take] Universal proctoring violation:', violation);
    
    // Show toast for all violations
    pushViolationToast({
      id: `${violation.eventType}-${Date.now()}`,
      eventType: violation.eventType,
      message: getViolationMessage(violation.eventType),
      timestamp: violation.timestamp,
    });

    // FULLSCREEN_EXIT violation triggers the fullscreen lock overlay (only when AI Proctoring enabled)
    if (violation.eventType === 'FULLSCREEN_EXIT' && aiProctoringEnabled) {
      console.log('[DSA Take] FULLSCREEN_EXIT violation - locking screen');
      setFullscreenLocked(true);
      incrementFullscreenExitCount();
    }
  }, [setFullscreenLocked, incrementFullscreenExitCount, aiProctoringEnabled]);

  // Handle fullscreen re-entry - unlock the screen
  const handleRequestFullscreen = useCallback(async (): Promise<boolean> => {
    console.log('[DSA Take] Requesting fullscreen re-entry...');
    const success = await requestFullscreenLock();
    if (success) {
      console.log('[DSA Take] Fullscreen re-entered - unlocking screen');
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

  // Unlock fullscreen when test is submitted
  useEffect(() => {
    if (testSubmission) {
      console.log('[DSA Take] Test submitted - unlocking fullscreen');
      setFullscreenLocked(false);
    }
  }, [testSubmission, setFullscreenLocked]);

  // Get screen stream from window.__screenStream (set by identity-verify gate)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__screenStream) {
      const stream = (window as any).__screenStream as MediaStream;
      if (stream && stream.active && stream.getVideoTracks().length > 0) {
        setLiveProctorScreenStream(stream);
        console.log('[DSA Take] Found global screen stream for Live Proctoring');
      }
    }
  }, []);

  // Start proctoring when test is ready (AI proctoring + tab switch + fullscreen)
  useEffect(() => {
    // Skip proctoring in admin preview mode
    if (isAdminPreview) {
      console.log('[DSA Take] Admin preview mode - skipping proctoring');
      return;
    }
    
    if (test && questions.length > 0 && !isProctoringRunning && isClient && thumbVideoRef.current) {
      console.log('[DSA Take] Starting Universal Proctoring...');
      
      startUniversalProctoring({
        settings: {
          aiProctoringEnabled: aiProctoringEnabled,
          liveProctoringEnabled: liveProctoringEnabled,
        },
        session: {
          userId: candidateIdStr,
          assessmentId: assessmentIdStr,
        },
        videoElement: aiProctoringEnabled ? thumbVideoRef.current : null,
      }).then((success) => {
        if (success) {
          console.log('[DSA Take] ✅ Universal Proctoring started');
        } else {
          console.error('[DSA Take] ❌ Failed to start Universal Proctoring');
        }
      });
    }
  }, [test, questions.length, isProctoringRunning, isClient, aiProctoringEnabled, liveProctoringEnabled, candidateIdStr, assessmentIdStr, startUniversalProctoring, isAdminPreview]);

  // ✅ PHASE 2.4: Lazy start function (called only when admin connects)
  const startLiveProctoring = useCallback((sessionId: string, ws: WebSocket) => {
    console.log('[DSA Take] 🔵 startLiveProctoring called with sessionId:', sessionId, 'ws.readyState:', ws.readyState);
    
    if (liveProctoringStartedRef.current) {
      console.log('[DSA Take] ⚠️ Live Proctoring already started, skipping');
      return;
    }

    console.log('[DSA Take] 🚀 Admin connected! Starting WebRTC...');
    liveProctoringStartedRef.current = true;

    // Extract raw candidateId for live proctoring (remove email: or public: prefix)
    // Live proctoring backend expects raw email or token, not formatted userId
    let rawCandidateId = candidateIdStr;
    if (candidateIdStr.startsWith('email:')) {
      rawCandidateId = candidateIdStr.replace('email:', '');
    } else if (candidateIdStr.startsWith('public:')) {
      rawCandidateId = candidateIdStr.replace('public:', '');
    }

    console.log('[DSA Take] Creating CandidateLiveService with:', {
      assessmentId: assessmentIdStr,
      candidateId: rawCandidateId, // Use raw email/token for live proctoring
      debugMode: debugMode,
    });
    
    const liveService = new CandidateLiveService({
      assessmentId: assessmentIdStr,
      candidateId: rawCandidateId, // Use raw email/token for live proctoring
      debugMode: debugMode,
    });
    
    console.log('[DSA Take] ✅ CandidateLiveService created');

    const existingWebcamStream = thumbVideoRef.current?.srcObject as MediaStream | null;
    console.log('[DSA Take] Existing streams:', {
      webcam: !!existingWebcamStream,
      screen: !!liveProctorScreenStream,
    });

    console.log('[DSA Take] Calling liveService.start()...');
    liveService.start(
      {
        onStateChange: (state) => {
          console.log('[DSA Take] Live proctoring state:', state);
        },
        onError: (error) => {
          console.error('[DSA Take] Live Proctoring error:', error);
        },
      },
      liveProctorScreenStream,
      existingWebcamStream,
      sessionId, // Pass existing sessionId
      ws // Pass existing WebSocket
    ).then((success) => {
      if (success) {
        console.log('[DSA Take] ✅ Live Proctoring WebRTC connected');
        liveProctoringServiceRef.current = liveService;
        
        // CRITICAL: Process queued answer and ICE candidates if they arrived before service started
        // The service's WebSocket handler is now set up, but we need to manually process
        // the messages that arrived before the handler was set up
        if (pendingAnswerRef.current) {
          console.log('[DSA Take] Processing queued answer...');
          // The service's handler should process this, but since we already consumed the message,
          // we need to manually trigger it. The service's handler will handle future messages.
          // For now, we'll rely on the service's handler being set up before more messages arrive.
          // Actually, the answer was already received, so we need to re-send it or manually process.
          // Since handleAnswer is private, we'll create a synthetic message event
          const syntheticEvent = {
            data: JSON.stringify({
              type: 'answer',
              answer: pendingAnswerRef.current
            })
          } as MessageEvent;
          // The service's handler is now set up, so we can't easily call it
          // Instead, we'll just log and hope the service processes it via its handler
          // Actually, the answer was already consumed, so we need a different approach
          console.log('[DSA Take] ⚠️ Answer was queued but already consumed - service may need to request new offer');
          pendingAnswerRef.current = null;
        }
        
        // Process queued ICE candidates
        if (pendingIceCandidatesRef.current.length > 0) {
          console.log('[DSA Take] Processing', pendingIceCandidatesRef.current.length, 'queued ICE candidates...');
          // Similar issue - these were already consumed
          pendingIceCandidatesRef.current = [];
        }
      } else {
        console.error('[DSA Take] ❌ Failed to start Live Proctoring');
        liveProctoringStartedRef.current = false;
      }
    });
  }, [assessmentIdStr, candidateIdStr, debugMode, liveProctorScreenStream]);

  // ✅ PHASE 2: Lazy WebRTC - Register session and wait for admin signal
  useEffect(() => {
    if (!liveProctoringEnabled || !liveProctorScreenStream || !test || questions.length === 0) {
      return;
    }

    // Guard: Ensure start-session is called only once per candidate per test
    if (startSessionCalledRef.current) {
      console.log('[DSA Take] ⏭️ start-session already called, skipping to prevent duplicate sessions');
      return;
    }

    // Mark as called immediately to prevent race conditions
    startSessionCalledRef.current = true;

    // Register live session (backend sets status to "candidate_initiated")
    console.log('[DSA Take] 📝 Registering Live Proctoring session...');
    
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
          console.log(`[DSA Take] ✅ Session registered: ${sessionId}`);

          // Phase 2.3: Connect WebSocket and listen for ADMIN_CONNECTED
          // Use backend host for WebSocket connection
          // Use rawCandidateId (without email: or public: prefix) for WebSocket URL
          const { LIVE_PROCTORING_ENDPOINTS } = require("@/universal-proctoring/live/types");
          const wsUrl = LIVE_PROCTORING_ENDPOINTS.candidateWs(sessionId, rawCandidateId);
          console.log('[DSA Take] Candidate WS connecting...', wsUrl);
          const ws = new WebSocket(wsUrl);
          candidateWsRef.current = ws;

          ws.onopen = () => {
            console.log('[DSA Take] Candidate WS connected');
            
            // CRITICAL FIX: Wait for camera stream to be available before starting WebRTC
            // The camera is initialized by useUniversalProctoring, so we need to wait for it
            let retryCount = 0;
            const maxRetries = 20; // 10 seconds max wait (20 * 500ms)
            
            const checkCameraAndStart = () => {
              const webcamStream = thumbVideoRef.current?.srcObject as MediaStream | null;
              if (webcamStream && webcamStream.active) {
                console.log('[DSA Take] ✅ Camera stream available - starting WebRTC...');
                startLiveProctoring(sessionId, ws);
              } else if (retryCount < maxRetries) {
                retryCount++;
                console.log(`[DSA Take] ⏳ Waiting for camera stream... (attempt ${retryCount}/${maxRetries})`);
                setTimeout(checkCameraAndStart, 500);
              } else {
                console.error('[DSA Take] ❌ Camera stream not available after 10 seconds - starting WebRTC anyway (may fail)');
                // Start anyway - the service will handle the error
                startLiveProctoring(sessionId, ws);
              }
            };
            
            // Start checking immediately
            checkCameraAndStart();
          };

          // Temporary handler for messages that arrive before service starts
          // Once service starts, it will replace this with its own handler
          ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log('[DSA Take] WebSocket message received (before service handler):', message.type);
            
            // If service hasn't started yet, queue messages
            // Once service starts, its handler will take over
            if (!liveProctoringStartedRef.current) {
              if (message.type === 'answer') {
                console.log('[DSA Take] Queueing answer until service starts...');
                pendingAnswerRef.current = message.answer;
              } else if (message.type === 'ice_candidate') {
                console.log('[DSA Take] Queueing ICE candidate until service starts...');
                pendingIceCandidatesRef.current.push(message.candidate);
              }
            }
            // Note: Once service starts, it replaces this handler, so future messages
            // will be handled by the service's handler automatically
          };

          ws.onerror = (error) => {
            console.error('[DSA Take] WebSocket error:', error);
          };

          ws.onclose = () => {
            console.log('[DSA Take] WebSocket closed');
            candidateWsRef.current = null;
          };
        }
      })
      .catch((error) => {
        console.error('[DSA Take] Failed to register Live Proctoring session:', error);
      });
    
    console.log('[DSA Take] ⏸️ Live Proctoring ready, waiting for admin to connect...');

    // Cleanup WebSocket on unmount
    return () => {
      if (candidateWsRef.current) {
        candidateWsRef.current.close();
        candidateWsRef.current = null;
      }
    };
  }, [liveProctoringEnabled, liveProctorScreenStream, test, questions.length, assessmentIdStr, candidateIdStr, startLiveProctoring]);

  // Stop proctoring when assessment ends
  useEffect(() => {
    if (submitting || (testSubmission && testSubmission.ended_at)) {
      console.log('[DSA Take] Assessment ending, stopping proctoring');
      stopUniversalProctoring();
      
      if (liveProctoringServiceRef.current) {
        liveProctoringServiceRef.current.stop();
        liveProctoringServiceRef.current = null;
      }
    }
  }, [submitting, testSubmission, stopUniversalProctoring]);

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

  // Auto-enter fullscreen after test data loads if test was already in progress (refresh case)
  // Flow: Load page -> Load test data -> Auto-enter fullscreen if was already in progress -> Start timer
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if fullscreen was already accepted (test was already in progress - refresh case)
    const fullscreenAccepted = sessionStorage.getItem('fullscreenAccepted') === 'true'
    const shouldStartTest = sessionStorage.getItem('shouldStartTest') === 'true'
    
    // Only auto-enter fullscreen if test was already in progress (fullscreenAccepted is set)
    // For first time entry (shouldStartTest), show prompt instead
    if (!fullscreenAccepted && !shouldStartTest) return

    // Only proceed after test and questions are loaded
    if (test && questions.length > 0) {
      // Check if already in fullscreen
      const isFullscreen = !!document.fullscreenElement || 
                          !!(document as any).webkitFullscreenElement ||
                          !!(document as any).mozFullScreenElement ||
                          !!(document as any).msFullscreenElement
      
      if (!isFullscreen) {
        if (fullscreenAccepted) {
          // Auto-enter fullscreen if test was already in progress (refresh case)
          console.log('[Fullscreen] Auto-entering fullscreen after refresh (test was already in progress)')
          const enterFullscreen = async () => {
            try {
              if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen()
              } else if ((document.documentElement as any).webkitRequestFullscreen) {
                await (document.documentElement as any).webkitRequestFullscreen()
              } else if ((document.documentElement as any).mozRequestFullScreen) {
                await (document.documentElement as any).mozRequestFullScreen()
              } else if ((document.documentElement as any).msRequestFullscreen) {
                await (document.documentElement as any).msRequestFullscreen()
              }
            } catch (err) {
              console.warn('[Fullscreen] Auto-enter failed, showing prompt instead:', err)
              // If auto-enter fails, show prompt as fallback
              setShowFullscreenPrompt(true)
            }
          }
          enterFullscreen()
        } else if (shouldStartTest && !showFullscreenPrompt) {
          // Show prompt only for first time entry (from instructions page)
          setShowFullscreenPrompt(true)
          console.log('[Fullscreen] Showing fullscreen prompt for first time entry')
        }
      }
    }
  }, [test, questions.length, showFullscreenPrompt])

  // Request fullscreen (reusable function)
  const requestFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      const elem = document.documentElement
      
      if (elem.requestFullscreen) {
        await elem.requestFullscreen()
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen()
      } else if ((elem as any).mozRequestFullScreen) {
        await (elem as any).mozRequestFullScreen()
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen()
      }
      
      // Verify fullscreen was actually entered
      await new Promise(resolve => setTimeout(resolve, 100))
      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )
      
      return isFullscreen
    } catch (error) {
      console.error('[Fullscreen] Failed to enter fullscreen:', error)
      return false
    }
  }, [])

  // Handle fullscreen entry from prompt
  const handleEnterFullscreenFromPrompt = async () => {
    try {
      console.log('[Fullscreen] User clicked Enter Fullscreen button')
      const success = await requestFullscreen()
      
      if (success) {
        console.log('[Fullscreen] Successfully entered fullscreen - timer will start when editor is visible')
        setShowFullscreenPrompt(false)
        // Always set fullscreenAccepted flag (for both first entry and refresh re-entry)
        sessionStorage.setItem('fullscreenAccepted', 'true')
        // Now we can remove shouldStartTest since fullscreen is entered
        sessionStorage.removeItem('shouldStartTest')
      }
    } catch (err) {
      console.error('[Fullscreen] Error entering fullscreen:', err)
      // Error will be handled by FullscreenPrompt component
    }
  }

  // Listen for fullscreen exit and re-enter (to prevent accidental exits)
  // Now handled by useFullscreenLock hook - legacy code removed
  
  // Get candidate info from session storage or API (non-blocking)
  useEffect(() => {
    // First try session storage (set by verification page) - this is synchronous and fast
    const storedEmail = sessionStorage.getItem("candidateEmail")
    const storedName = sessionStorage.getItem("candidateName")
    
    if (storedEmail && storedName) {
      setCandidateEmail(storedEmail)
      setCandidateName(storedName)
    } else if (userId && testId) {
      // Fallback to API if session storage not available - do this asynchronously after initial render
      // Don't block the page load for this
      const fetchCandidateInfo = async () => {
        try {
          const candidatesRes = await dsaService.getCandidates(testId as string)
          const candidates = Array.isArray(candidatesRes) ? candidatesRes : []
          const candidate = candidates.find((c: any) => c.user_id === userId)
          if (candidate) {
            setCandidateEmail(candidate.email)
            setCandidateName(candidate.name)
            // Store in session storage for consistency
            sessionStorage.setItem("candidateEmail", candidate.email)
            sessionStorage.setItem("candidateName", candidate.name)
          }
        } catch (error) {
          console.error('Error fetching candidate info:', error)
          // Don't block page load if this fails
        }
      }
      // Delay API call slightly to not block initial render
      setTimeout(() => {
        fetchCandidateInfo()
      }, 100)
    }
  }, [userId, testId])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])


  useEffect(() => {
    const newToken = getTokenFromUrl()
    const newUserId = getUserIdFromUrl()
    if (newToken && newToken !== token) setToken(newToken)
    if (newUserId && newUserId !== userId) setUserId(newUserId)
  }, [router.query, token, userId])

  useEffect(() => {
    if (!testId || typeof testId !== 'string') return

    const checkParams = setTimeout(() => {
      const urlToken = getTokenFromUrl()
      const urlUserId = getUserIdFromUrl()
      
      const finalToken = token || urlToken
      const finalUserId = userId || urlUserId

      if (!finalToken || !finalUserId) {
        setCheckingParams(false)
        if (finalToken) {
          router.push(`/test/${testId}?token=${encodeURIComponent(finalToken)}`)
        } else {
          router.push(`/test/${testId}`)
        }
        return
      }

      if (urlToken && !token) setToken(urlToken)
      if (urlUserId && !userId) setUserId(urlUserId)
      // Don't set checkingParams to false here - let the data fetch useEffect handle it
    }, 200)

    return () => clearTimeout(checkParams)
  }, [testId, token, userId, router])

  // Reusable function to load test data (can be called from useEffect or manually)
  const loadTestData = useCallback(async (skipInitialCheck: boolean = false) => {
    const safeTestId =
      typeof testId === 'string'
        ? testId
        : Array.isArray(testId)
        ? testId[0]
        : undefined

    // In admin preview mode, skip token/userId requirements
    if (isAdminPreview) {
      if (!safeTestId) {
        console.warn('[Test Load] Missing testId in admin preview mode')
        if (!skipInitialCheck) {
          setCheckingParams(false)
        }
        return
      }
      // Use admin preview userId
      const adminUserId = 'admin_preview'
      setUserId(adminUserId)
      setToken('admin_preview_token')
    } else {
      // Normal mode - require token and userId
    if (!safeTestId || !token || !userId) {
      console.warn('[Test Load] Missing required params, cannot load test', {
        testId: safeTestId,
        hasToken: !!token,
        userId,
      })
      if (!skipInitialCheck) {
        setCheckingParams(false)
      }
      return
      }
    }

    try {
      if (!skipInitialCheck) {
        setCheckingParams(false)
      }
      setQuestionsLoading(true)

      // --- Step 1: Ensure submission exists ---
      let submissionData: any = null

      // In admin preview mode, skip submission checks and create dummy submission
      if (isAdminPreview) {
        submissionData = {
          started_at: new Date().toISOString(),
          is_completed: false,
          submissions: [],
          precheck_mode: false,
        }
        setPrecheckMode(null)
        setTestReadyToStart(false)
      } else {
        // In normal mode, userId is guaranteed by the earlier guard (we return if it's missing)
        const nonNullUserId = userId as string
        try {
          const subRes = await dsaService.getTestSubmission(safeTestId, nonNullUserId)
          // Backend currently returns a plain submission object (not wrapped in { data: ... })
          // But keep backward compatibility if it is wrapped.
          submissionData = (subRes as any)?.data ?? subRes

        if (submissionData.is_completed) {
          router.push('/dashboard')
          return
        }

        // If submission exists and test has started (has started_at and no precheck_mode), clear precheck mode
        if (submissionData.started_at && !submissionData.precheck_mode) {
          setPrecheckMode(null)
          setTestReadyToStart(false)
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          // No submission yet -> start test
          try {
              const startRes = await dsaService.startTest(safeTestId, nonNullUserId)
            const data = startRes.data

            if (data.precheck_mode === true) {
              setPrecheckMode({
                start_time: data.start_time,
                message:
                  data.message ||
                  'Test has not started yet. Please complete pre-checks and wait.',
              })

              submissionData = {
                started_at: null,
                is_completed: false,
                precheck_mode: true,
              }
            } else {
              submissionData = {
                started_at: data.started_at,
                is_completed: false,
                submissions: [],
              }
              // Clear precheck mode when test starts
              setPrecheckMode(null)
              setTestReadyToStart(false)
            }
          } catch (startErr: any) {
            const detail =
              startErr?.response?.data?.detail ||
              startErr?.response?.data?.message ||
              'Failed to start test. Please try again.'
            alert(detail)
            router.push('/dashboard')
            return
          }
        } else {
          console.error('[Test Load] Error fetching submission', err)
          alert('Error loading test. Please try again.')
          router.push('/dashboard')
          return
        }
        }
      }

      // --- Step 2: Fetch test data ---
      // In admin preview mode, fetch owner view of the test (no candidate token required).
      // In normal mode, use the public candidate view (requires user_id / token).
      let testData: any
      let effectiveUserId: string
      if (isAdminPreview) {
        // Owner view: dsaService.getTest returns the plain test object
        const ownerTest = await dsaService.getTest(safeTestId)
        testData = ownerTest
        // Use a synthetic user id for preview flows
        effectiveUserId = 'admin_preview'
      } else {
        effectiveUserId = userId as string
        const testRes = await dsaService.getPublicTest(safeTestId, effectiveUserId)
        // Backend may return either plain object or { data: ... } ApiResponse
        testData = (testRes as any)?.data ?? testRes
      }

      if (!testData) {
        alert('Error: Could not load test data. Please refresh the page.')
        return
      }

      setTest(testData)
      setTestSubmission(submissionData)

      // Load proctoring settings from test data (consistent with reference implementation)
      // DISABLE PROCTORING IN ADMIN PREVIEW MODE
      if (isAdminPreview) {
        console.log('[DSA Take] Admin preview mode - disabling proctoring');
        setProctoringSettings({ aiProctoringEnabled: false, liveProctoringEnabled: false });
        setAiProctoringEnabled(false);
        setLiveProctoringEnabled(false);
      } else if (testData?.proctoringSettings) {
        console.log('[DSA Take] Loading proctoring settings:', testData.proctoringSettings);
        setProctoringSettings(testData.proctoringSettings);
        setAiProctoringEnabled(testData.proctoringSettings.aiProctoringEnabled === true);
        setLiveProctoringEnabled(testData.proctoringSettings.liveProctoringEnabled === true);
      } else {
        console.log('[DSA Take] No proctoring settings found in test data');
        setProctoringSettings({ aiProctoringEnabled: false, liveProctoringEnabled: false });
        setAiProctoringEnabled(false);
        setLiveProctoringEnabled(false);
      }

      const isPrecheck = submissionData?.precheck_mode === true
      if (!isPrecheck && submissionData?.is_completed) {
        router.push('/dashboard')
        return
      }

      // --- Step 3: Fetch all questions in parallel ---
      const questionIds: string[] = testData.question_ids || []
      if (questionIds.length === 0) {
        alert('This test has no questions configured. Please contact the administrator.')
        router.push('/dashboard')
        return
      }

      const questionPromises = questionIds.map((qId: string) =>
        (isAdminPreview
          // In admin preview, fetch owner question by id (service returns ApiResponse)
          ? dsaService
              .getQuestion(qId as string)
              .then((res) => (res.data || res) as unknown as Question)
          // In candidate mode, fetch question via public test endpoint (service returns ApiResponse)
          : dsaService
              .getTestQuestion(safeTestId, qId, effectiveUserId)
              .then((res) => res.data as Question))
      )

      const results = await Promise.allSettled(questionPromises)
      const questionsData: Question[] = []

      results.forEach((result, index) => {
        const qId = questionIds[index]
        if (result.status === 'fulfilled' && result.value) {
          questionsData.push(result.value)
        } else if (result.status === 'rejected') {
          const err: any = result.reason
          console.error('[Test Load] Question fetch failed', {
            questionId: qId,
            status: err?.response?.status,
            data: err?.response?.data,
            message: err?.message,
          })
        }
      })

      if (questionsData.length === 0) {
        alert('This test has no valid questions. Please contact the administrator.')
        router.push('/dashboard')
        return
      }

      // Initialize visible testcases
      const visibleMap: Record<string, VisibleTestcase[]> = {}
      questionsData.forEach((q) => {
        visibleMap[q.id] =
          q.public_testcases?.map((tc: { input: string | any; expected_output: string | any }, idx: number) => {
            // Convert input to string if it's an object (for JSON testcases)
            let inputStr: string
            if (typeof tc.input === 'object' && tc.input !== null) {
              inputStr = JSON.stringify(tc.input, null, 2)
            } else {
              inputStr = String(tc.input || '')
            }
            
            // Convert expected_output to string if it's an object
            let expectedStr: string
            // Check if expected_output exists in the testcase
            if (!('expected_output' in tc) || tc.expected_output === undefined || tc.expected_output === null) {
              // If expected_output is missing, show a placeholder
              expectedStr = '(not available)'
            } else if (typeof tc.expected_output === 'object' && tc.expected_output !== null) {
              expectedStr = JSON.stringify(tc.expected_output, null, 2)
            } else {
              const outputStr = String(tc.expected_output).trim()
              expectedStr = outputStr || '(empty)'
            }
            
            return {
            id: `${q.id}-public-${idx}`,
              input: inputStr,
              expected: expectedStr,
            }
          }) || []
      })

      // Initialize code and language (no preloading/localStorage merging)
      const initialCode: Record<string, string> = {}
      const initialLanguage: Record<string, string> = {}
      questionsData.forEach((q) => {
        if (q.question_type?.toUpperCase() === 'SQL') {
          initialCode[q.id] = q.starter_query || '-- Write your SQL query here\n\nSELECT '
          initialLanguage[q.id] = 'sql'
        } else {
          const defaultLang = q.languages[0] || 'python'
          let starterCode = ''
          if (q.function_signature) {
            starterCode = generateBoilerplate(defaultLang, q)
          } else if (q.starter_code && q.starter_code[defaultLang]) {
            starterCode = q.starter_code[defaultLang]
          } else {
            starterCode = generateBoilerplate(defaultLang, q)
          }
          initialCode[q.id] = starterCode
          initialLanguage[q.id] = defaultLang
        }
      })

      setQuestions(questionsData)
      setVisibleTestcasesMap(visibleMap)
      setCode(initialCode)
      setLanguage(initialLanguage)
      setQuestionsLoading(false)

      // Initialize submittedQuestions from existing submissions (if any)
      const initialSubmittedQuestions: Record<string, boolean> = {}
      if (submissionData?.submissions && Array.isArray(submissionData.submissions) && submissionData.submissions.length > 0) {
        try {
          // Fetch all submissions to get question_ids
          // Note: We'll fetch submissions individually since we only have IDs
          const submissionPromises = submissionData.submissions.map((subId: string) =>
            dsaService.getSubmission(subId).then((res) => res.data).catch(() => null)
          )
          const submissionResults = await Promise.allSettled(submissionPromises)
          
          submissionResults.forEach((result) => {
            if (result.status === 'fulfilled' && result.value?.question_id) {
              initialSubmittedQuestions[result.value.question_id] = true
            }
          })
          
          console.log('[Test Load] Initialized submittedQuestions from existing submissions:', initialSubmittedQuestions)
        } catch (err) {
          console.error('[Test Load] Error fetching submissions for initialization:', err)
          // Continue without initialization if fetching fails
        }
      }
      
      setSubmittedQuestions(initialSubmittedQuestions)

      // Find the first unlocked question index
      let firstUnlockedIndex = 0
      if (testData?.timer_mode === 'PER_QUESTION') {
        // First question is always accessible
        firstUnlockedIndex = 0
        
        // Find the first question that should be unlocked (where all previous questions are submitted)
        for (let i = 1; i < questionsData.length; i++) {
          const previousQuestionId = questionsData[i - 1]?.id
          if (previousQuestionId && initialSubmittedQuestions[previousQuestionId]) {
            // Previous question is submitted, this question is unlocked
            firstUnlockedIndex = i
          } else {
            // Previous question not submitted, stop here (this question is locked)
            break
          }
        }
      }
      
      setCurrentQuestionIndex(firstUnlockedIndex)

      const now = new Date().toISOString()
      setTestStartedAt(now)
      setQuestionStartTimes({ [questionsData[firstUnlockedIndex].id]: now })
    } catch (err) {
      console.error('[Test Load] Fatal error while loading test', err)
      alert('An error occurred while loading the test. Please try again.')
      router.push('/dashboard')
    }
  }, [testId, token, userId, router, isAdminPreview])

  // NEW: simple, from-scratch test + question loading flow
  // 1) Ensure submission (existing or start)
  // 2) Fetch public test data
  // 3) Fetch all questions in parallel (Promise.allSettled)
  useEffect(() => {
    if (!router.isReady) return
    loadTestData(false)
  }, [router.isReady, loadTestData])

  // Live countdown update for precheck mode
  useEffect(() => {
    if (!precheckMode) {
      setTimeUntilStart(0)
      setCanStartNow(false)
      return
    }

    const startTime = new Date(precheckMode.start_time)
    const updateCountdown = () => {
      const now = new Date()
      const timeUntil = Math.max(0, Math.floor((startTime.getTime() - now.getTime()) / 1000))
      setTimeUntilStart(timeUntil)
      
      if (timeUntil <= 0 && !canStartNow) {
        setCanStartNow(true)
      }
    }

    // Update immediately
    updateCountdown()

    // Update every second
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [precheckMode, canStartNow])

  // Poll backend to check if test can start (every 5 seconds when in precheck mode)
  useEffect(() => {
    if (!precheckMode || !testId || !userId || !token) return
    if (!canStartNow) return // Only poll when countdown has reached 0

    const safeTestId =
      typeof testId === 'string'
        ? testId
        : Array.isArray(testId)
        ? testId[0]
        : undefined

    if (!safeTestId || !userId) return

    let cancelled = false
    const pollInterval = setInterval(async () => {
      if (cancelled) return

      try {
        // Check if test can start by calling start endpoint
        const startRes = await dsaService.startTest(safeTestId, userId)
        const data = startRes.data

        // If no longer in precheck mode, test can start - set flag to show button
        if (!data.precheck_mode && !cancelled) {
          setTestReadyToStart(true)
          clearInterval(pollInterval)
        }
      } catch (err: any) {
        // If error, continue polling (test might not be ready yet)
        console.log('[Precheck] Polling for test start...', err?.response?.status)
      }
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(pollInterval)
    }
  }, [precheckMode, canStartNow, testId, userId, token])

  // Auto-start after 3 seconds if testReadyToStart is true and user hasn't clicked
  useEffect(() => {
    if (!testReadyToStart || !precheckMode || !testId || !userId) return

    const autoStartTimer = setTimeout(async () => {
      // Reload test data without full page reload (preserves fullscreen)
      await loadTestData(true)
    }, 3000)

    return () => clearTimeout(autoStartTimer)
  }, [testReadyToStart, precheckMode, testId, userId, loadTestData])

  // Handle manual start assessment button click
  const handleStartAssessment = async () => {
    if (!testId || !userId) return

    const safeTestId =
      typeof testId === 'string'
        ? testId
        : Array.isArray(testId)
        ? testId[0]
        : undefined

    if (!safeTestId) return

    try {
      // Ensure test is started (should already be started from polling, but confirm)
      await dsaService.startTest(safeTestId, userId)
      // Reload test data without full page reload (preserves fullscreen)
      await loadTestData(true)
    } catch (err: any) {
      console.error('[Precheck] Start assessment failed:', err)
      const errorMessage = err?.response?.data?.detail || err?.response?.data?.message || 'Failed to start assessment. Please try again.'
      alert(errorMessage)
    }
  }

  const handleAutoSubmit = () => {
    // Extra safety: only auto-submit when the test is fully in-progress and UI is ready.
    if (submitting) return
    if (precheckMode) return
    if (!test || questions.length === 0) return

    handleSubmit(true)
  }

  // Auto-submit a specific question when its timer expires
  const handleAutoSubmitQuestion = async (questionId: string): Promise<boolean> => {
    if (!userId) {
      console.error('[AutoSubmit] Missing userId')
      return false
    }
    if (autoSubmittedQuestions[questionId]) {
      console.log('[AutoSubmit] Question already auto-submitted:', questionId)
      return true // Already auto-submitted, consider it success
    }
    
    const question = questions.find(q => q.id === questionId)
    if (!question) {
      console.error('[AutoSubmit] Question not found:', questionId)
      return false
    }

    // Mark as auto-submitted and submitted immediately to prevent duplicate submissions and lock the question
    setAutoSubmittedQuestions(prev => ({ ...prev, [questionId]: true }))
    setSubmittedQuestions(prev => ({ ...prev, [questionId]: true }))

    const isSQLQuestion = question.question_type?.toUpperCase() === 'SQL'

    try {
      if (isSQLQuestion) {
        const sqlQuery = code[questionId] || question.starter_query || ''
        const startedAt = questionStartTimes[questionId] || new Date().toISOString()
        const submittedAt = new Date().toISOString()
        const startTime = new Date(startedAt).getTime()
        const endTime = new Date(submittedAt).getTime()
        const timeSpentSeconds = Math.floor((endTime - startTime) / 1000)
        
        const response = await dsaService.submitSQL({
          question_id: questionId,
          sql_query: sqlQuery,
          started_at: startedAt,
          submitted_at: submittedAt,
          time_spent_seconds: timeSpentSeconds,
        })

        const result = response.data
        
        // Add to submission history
        const historyEntry: SubmissionHistoryEntry = {
          id: result.submission_id || `sql-${questionId}-${Date.now()}`,
          status: result.status,
          passed: result.passed ? 1 : 0,
          total: 1,
          score: result.score || 0,
          max_score: result.max_score || 100,
          created_at: new Date().toISOString(),
          results: [],
        }
        
        setSubmissionHistory((prev) => {
          const existing = prev[questionId] || []
          const updated = [historyEntry, ...existing].slice(0, 5)
          return { ...prev, [questionId]: updated }
        })

        if (result.passed) {
          setQuestionStatus(prev => ({ ...prev, [questionId]: 'solved' }))
        } else {
          setQuestionStatus(prev => ({ ...prev, [questionId]: 'attempted' }))
        }
      } else {
        const currentLang = language[questionId] || 'python'
        const currentCode = code[questionId] || ''
        const languageId = getLanguageId(currentLang)

        if (!languageId) {
          console.error(`Unsupported language: ${currentLang}`)
          return false
        }

        const startedAt = questionStartTimes[questionId] || new Date().toISOString()
        const submittedAt = new Date().toISOString()
        const startTime = new Date(startedAt).getTime()
        const endTime = new Date(submittedAt).getTime()
        const timeSpentSeconds = Math.floor((endTime - startTime) / 1000)
        
        const response = await dsaService.submitCodeFull({
          question_id: questionId,
          source_code: currentCode,
          language_id: String(languageId),
          started_at: startedAt,
          submitted_at: submittedAt,
          time_spent_seconds: timeSpentSeconds,
        })

        // Handle both ApiResponse wrapper and plain object responses
        const result = response?.data || response
        
        if (!result) {
          console.error('Submit code response is undefined:', response)
          throw new Error('Invalid response format: response is undefined')
        }
        
        if (!result.public_results) {
          console.error('Submit code response missing public_results:', result)
          throw new Error('Invalid response format: missing public_results')
        }
        
        const mappedResults: SubmissionTestcaseResult[] = (result.public_results || []).map((r: any) => ({
          visible: true,
          input: r.input,
          expected: r.expected_output,
          output: r.user_output || r.stdout || '',
          stdout: r.user_output || r.stdout || '',
          stderr: r.stderr || '',
          compile_output: r.compile_output || '',
          time: r.time,
          memory: r.memory,
          status: r.status,
          passed: r.passed,
        }))
        
        setPublicResults(prev => ({ ...prev, [questionId]: mappedResults }))
        setHiddenSummary(prev => ({ ...prev, [questionId]: result.hidden_summary || null }))

        if (result.status === 'accepted') {
          setQuestionStatus(prev => ({ ...prev, [questionId]: 'solved' }))
        } else {
          setQuestionStatus(prev => ({ ...prev, [questionId]: 'attempted' }))
        }

        const historyEntry: SubmissionHistoryEntry = {
          id: result.submission_id || `${questionId}-${Date.now()}`,
          status: result.status,
          passed: result.total_passed,
          total: result.total_tests,
          score: result.score,
          max_score: result.max_score,
          created_at: new Date().toISOString(),
          results: [],
          public_results: result.public_results,
          hidden_results: result.hidden_results,
          hidden_summary: result.hidden_summary,
        }

        setSubmissionHistory((prev) => {
          const questionIdKey = questionId
          const existing = prev[questionIdKey] || []
          const updated = [historyEntry, ...existing].slice(0, 5)
          return { ...prev, [questionIdKey]: updated }
        })
      }
      
      console.log('[AutoSubmit] Successfully auto-submitted question:', questionId)
      return true
    } catch (error: any) {
      console.error('[AutoSubmit] Error auto-submitting question:', questionId, error)
      // Even if submission fails, keep the question marked as submitted to prevent re-submission
      // The question is already locked via state updates above
      return false
    }
  }

  // ============================================
  // Timer hook - clean implementation
  const timerCurrentQuestion = questions[currentQuestionIndex] || null
  const timer = useDSTimer({
    test: test ? {
      timer_mode: test.timer_mode,
      duration_minutes: test.duration_minutes,
      question_timings: test.question_timings,
      start_time: test.start_time,
    } : null,
    testSubmission,
    questions,
    currentQuestionId: timerCurrentQuestion?.id || null,
    onExpire: handleAutoSubmit,
    onQuestionExpire: async (questionId: string) => {
      console.log('[Timer] Question expired:', questionId)
      
      if (test?.timer_mode === 'PER_QUESTION') {
        // Check if question was already submitted manually
        if (submittedQuestions[questionId]) {
          console.log('[Timer] Question already submitted manually, skipping auto-lock')
          return
        }
        
        if (questions.length === 1) {
          // Single question: Lock it and submit whole test immediately
          console.log('[Timer] Single question expired, locking and submitting test')
          setSubmittedQuestions(prev => ({ ...prev, [questionId]: true }))
          handleAutoSubmit()
        } else {
          // Multiple questions (2+): Lock current question and navigate to next
          // Do NOT auto-submit code, just lock the question
          console.log('[Timer] Locking question and navigating to next:', questionId)
          setSubmittedQuestions(prev => ({ ...prev, [questionId]: true }))
          
          // Wait a brief moment to ensure state updates are applied before navigation
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Move to next question or submit if last
          const currentIndex = questions.findIndex(q => q.id === questionId)
          if (currentIndex < questions.length - 1) {
            console.log('[Timer] Moving to next question:', currentIndex + 1)
            handleQuestionChange(currentIndex + 1)
          } else {
            console.log('[Timer] Last question expired, submitting test')
            handleAutoSubmit()
          }
        }
      }
    },
    enabled: !precheckMode && questions.length > 0,
  })

  const handleSubmit = (isAuto: boolean = false) => {
    if (submitting) {
      console.log('[Submit] Already submitting, ignoring click')
      return
    }

    // Validate required data
    if (!testId || !userId) {
      alert('Missing test ID or user ID. Please refresh the page and try again.')
      console.error('[Submit] Missing testId or userId:', { testId, userId })
      return
    }

    const safeTestId =
      typeof testId === 'string'
        ? testId
        : Array.isArray(testId)
        ? testId[0]
        : undefined

    if (!safeTestId) {
      alert('Invalid test ID. Please refresh the page and try again.')
      console.error('[Submit] Invalid testId:', { testId })
      return
    }

    if (!questions || questions.length === 0) {
      alert('No questions found. Please refresh the page and try again.')
      console.error('[Submit] No questions found')
      return
    }

    // Navigate IMMEDIATELY - before any data preparation to avoid "submitting" state
    // This ensures user sees completed page instantly
    window.location.href = `/test/${safeTestId}/completed`

    // Prepare submission data AFTER navigation (browser will handle navigation first)
    // We need to prepare it now so we can send the API call
    const questionSubmissions = questions.map((q) => {
      const baseSubmission = {
        question_id: q.id,
        code: code[q.id] || '',
        language: language[q.id] || 'python',
      }
      
      // For SQL questions, include execution engine results
      if (q.question_type?.toUpperCase() === 'SQL' && sqlExecutionResults[q.id]) {
        const sqlResult = sqlExecutionResults[q.id]
        return {
          ...baseSubmission,
          execution_engine_passed: sqlResult.passed,
          execution_engine_output: sqlResult.actualOutput,
          execution_engine_expected_output: sqlResult.expectedOutput,
          execution_engine_time: sqlResult.time,
          execution_engine_memory: sqlResult.memory,
        }
      }
      
      return baseSubmission
    })

    const activityLogs: any[] = []
    
    questions.forEach((q) => {
      if (questionStartTimes[q.id]) {
        const startTime = new Date(questionStartTimes[q.id])
        const endTime = new Date()
        const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
        
        activityLogs.push({
          type: 'question_time',
          question_id: q.id,
          time_spent_seconds: timeSpent,
          timestamp: endTime.toISOString(),
        })
      }
    })

    questions.forEach((q) => {
      const runCount = publicResults[q.id]?.length || 0
      if (runCount > 0) {
        activityLogs.push({
          type: 'run_attempts',
          question_id: q.id,
          count: runCount,
          timestamp: new Date().toISOString(),
        })
      }
    })

    // Send API call immediately (fire-and-forget, but initiate it before navigation)
    // The browser will continue this request even during navigation
    console.log('[Submit] Submitting test (background):', { testId: safeTestId, userId, questionCount: questionSubmissions.length })
    
    dsaService.finalSubmitTest(safeTestId, userId, {
      question_submissions: questionSubmissions,
      activity_logs: activityLogs,
    }).then((response) => {
      console.log('[Submit] Submission successful (background):', response.data)
    }).catch((error: any) => {
      console.error('[Submit] Background submission error (non-blocking):', error)
      // Backend will handle retries if needed
    })
    
    // Note: Navigation already happened at the top of this function (line 1456)
    // The browser may still execute this code before actually navigating,
    // which allows the API call to be initiated
  }

  const handleQuestionChange = (index: number) => {
    const previousQuestion = questions[currentQuestionIndex]
    const newQuestion = questions[index]
    
    // Check if navigation is allowed (sequential mode)
    // Only enforce sequential locking for PER_QUESTION mode
    // For GLOBAL mode, all questions are accessible
    if (test?.timer_mode === 'PER_QUESTION') {
      // For forward navigation (index > currentQuestionIndex), ensure current question is submitted
      if (index > currentQuestionIndex) {
        const currentQuestionId = questions[currentQuestionIndex]?.id
        if (currentQuestionId && !submittedQuestions[currentQuestionId]) {
          // Current question not submitted - block forward navigation silently
          return
        }
      }
      
      // For any navigation (forward or backward), ensure all previous questions are submitted
      if (index > 0) {
        const previousQuestionId = questions[index - 1]?.id
        if (previousQuestionId && !submittedQuestions[previousQuestionId]) {
          // Previous question not submitted - block navigation silently
          return
        }
      }
    }

    // Prevent navigation back to expired/auto-submitted questions (only backward navigation)
    if (test?.timer_mode === 'PER_QUESTION' && newQuestion && index < currentQuestionIndex) {
      if (autoSubmittedQuestions[newQuestion.id] || submittedQuestions[newQuestion.id]) {
        // Prevent going back to submitted/expired question
        return
      }
    }
    
    setCurrentQuestionIndex(index)
    
    if (newQuestion) {
      // Track question start time
      if (!questionStartTimes[newQuestion.id]) {
        setQuestionStartTimes(prev => ({
          ...prev,
          [newQuestion.id]: new Date().toISOString()
        }))
      }
    
      // Handle SQL questions differently (case-insensitive check)
      if (newQuestion.question_type?.toUpperCase() === 'SQL') {
        if (!code[newQuestion.id] || code[newQuestion.id].trim() === '') {
          const starterQuery = newQuestion.starter_query || '-- Write your SQL query here\n\nSELECT '
          setCode({ ...code, [newQuestion.id]: starterQuery })
        }
        if (!language[newQuestion.id]) {
          setLanguage({ ...language, [newQuestion.id]: 'sql' })
        }
      } else {
        // Coding questions
        const currentLang = language[newQuestion.id] || newQuestion.languages[0] || 'python'
        if (!code[newQuestion.id] || code[newQuestion.id].trim() === '') {
          let starterCode = ''
          if (newQuestion.starter_code && newQuestion.starter_code[currentLang]) {
            starterCode = newQuestion.starter_code[currentLang]
          } else {
            starterCode = generateBoilerplate(currentLang, newQuestion)
          }
          setCode({ ...code, [newQuestion.id]: starterCode })
        }
        if (!language[newQuestion.id]) {
          setLanguage({ ...language, [newQuestion.id]: currentLang })
        }
      }
    }
  }

  const handleRun = async () => {
    if (!userId) return
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return

    // Handle SQL questions - execute via sql-execution-engine
    const isSQLQuestion = currentQuestion.question_type?.toUpperCase() === 'SQL'
    if (isSQLQuestion) {
      setRunning(true)
      setOutput(prev => ({
        ...prev,
        [currentQuestion.id]: {
          stdout: '⏳ Executing SQL query...',
          status: 'running'
        }
      }))

      try {
        let sqlQuery = code[currentQuestion.id] || currentQuestion.starter_query || ''
        
        // Normalize SQL query to single line with \n characters
        sqlQuery = sqlQuery.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        
        // Call SQL execution engine directly from frontend
        // URL must be set in NEXT_PUBLIC_SQL_ENGINE_URL environment variable
        const baseUrl = process.env.NEXT_PUBLIC_SQL_ENGINE_URL
        if (!baseUrl) {
          throw new Error('NEXT_PUBLIC_SQL_ENGINE_URL environment variable is not set. Please configure it in your .env file.')
        }
        const sqlEngineUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
        
        console.log('[SQL Run] SQL Engine URL:', sqlEngineUrl)
        console.log('[SQL Run] Sending query:', sqlQuery.substring(0, 100) + (sqlQuery.length > 100 ? '...' : ''))
        
        const requestBody = {
          questionId: currentQuestion.id,
          code: sqlQuery,
          schemas: currentQuestion.schemas || null,
          sample_data: currentQuestion.sample_data || null,
        }
        
        const executeResponse = await fetch(`${sqlEngineUrl}/api/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })
        
        if (!executeResponse.ok) {
          const text = await executeResponse.text()
          if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            throw new Error(`SQL engine returned HTML (likely 404). Make sure the SQL execution engine is running on ${sqlEngineUrl}`)
          }
          throw new Error(`HTTP ${executeResponse.status}: ${text.substring(0, 200)}`)
        }
        
        const contentType = executeResponse.headers.get('content-type') || ''
        let responseText = ''
        
        try {
          responseText = await executeResponse.text()
        } catch (e: any) {
          throw new Error(`Failed to read response: ${e?.message || String(e)}`)
        }
        
        if (!contentType.includes('application/json')) {
          throw new Error(`Expected JSON but got ${contentType}. Response: ${responseText.substring(0, 500)}`)
        }
        
        let executeResult
        try {
          executeResult = JSON.parse(responseText)
        } catch (e: any) {
          console.error('Failed to parse JSON response:', responseText)
          throw new Error(`Invalid JSON response from SQL engine. Response: ${responseText.substring(0, 500)}`)
        }
        
        // Normalize the result to match expected format
        const result = {
          success: executeResult.success !== false,
          output: executeResult.output || executeResult.actualOutput || [],
          error: executeResult.error || null,
          time: executeResult.time || null,
          memory: executeResult.memory || null,
        }
        
        if (result.success) {
          // Format output - result.output is an array of objects (from normalizeResult)
          let formattedOutput = ''
          if (Array.isArray(result.output) && result.output.length > 0) {
            // Convert array of objects to formatted table-like string
            const headers = Object.keys(result.output[0] as Record<string, any>)
            const rows = result.output.map((row: Record<string, any>) => Object.values(row))
            
            // Create a pipe-separated table format
            formattedOutput = headers.join(' | ') + '\n'
            formattedOutput += headers.map(() => '---').join(' | ') + '\n'
            rows.forEach((row: any[]) => {
              formattedOutput += row.map((val: any) => 
                val === null || val === undefined ? 'NULL' : String(val)
              ).join(' | ') + '\n'
            })
          } else if (result.output && typeof result.output === 'string') {
            formattedOutput = result.output
          } else {
            formattedOutput = 'Query executed successfully (no output rows)'
          }
          
          setOutput(prev => ({
            ...prev,
            [currentQuestion.id]: {
              stdout: formattedOutput,
              status: 'success'
            }
          }))
        } else {
          // Error occurred
          setOutput(prev => ({
            ...prev,
            [currentQuestion.id]: {
              stderr: `${result.error || 'SQL execution failed'}`,
              status: 'error'
            }
          }))
        }

        setQuestionStatus({ ...questionStatus, [currentQuestion.id]: 'attempted' })
      } catch (error: any) {
        console.error('SQL Run error:', error)
        let errorMessage = error.message || 'Failed to execute SQL query'
        
        // Handle errors
        if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail
        }
        
        setOutput(prev => ({
          ...prev,
          [currentQuestion.id]: {
            stderr: `Error: ${errorMessage}`,
            status: 'error'
          }
        }))
      } finally {
        setRunning(false)
      }
      return
    }

    setRunning(true)
    setOutput({})
    setPublicResults({})
    setHiddenSummary({})

    try {
      const currentCode = code[currentQuestion.id] || currentQuestion.starter_code[language[currentQuestion.id] || 'python'] || ''
      const currentLang = language[currentQuestion.id] || 'python'
      const languageId = getLanguageId(currentLang)
      
      if (!languageId) {
        alert(`Unsupported language: ${currentLang}`)
        setRunning(false)
        return
      }
      
      const response = await dsaService.runCodePublic({
        question_id: currentQuestion.id,
        source_code: currentCode,
        language_id: String(languageId),
      })
      
      // Handle both ApiResponse wrapper and plain object responses
      const result = response?.data || response
      
      if (!result) {
        console.error('Run code response is undefined:', response)
        throw new Error('Invalid response format: response is undefined')
      }
      
      if (!result.public_results) {
        console.error('Run code response missing public_results:', result)
        throw new Error('Invalid response format: missing public_results')
      }
      
      // Debug: Log the API response to see what expected_output values we're getting
      console.log('[RunCode] API response public_results:', JSON.stringify(result.public_results, null, 2))
      
      const mappedResults: SubmissionTestcaseResult[] = (result.public_results || []).map((r: any) => {
        // Try to get expected_output from the result, fall back to empty string if missing
        let expectedValue = r.expected_output
        if (expectedValue === null || expectedValue === undefined) {
          expectedValue = ''
        } else if (typeof expectedValue !== 'string') {
          // Convert objects/arrays to JSON string
          expectedValue = JSON.stringify(expectedValue)
        }
        
        return {
        visible: true,
        input: r.input,
          expected: expectedValue,
        output: r.user_output || r.stdout || '',
        stdout: r.user_output || r.stdout || '',
        stderr: r.stderr || '',
        compile_output: r.compile_output || '',
        time: r.time,
        memory: r.memory,
        status: r.status,
        passed: r.passed,
        }
      })
      
      setPublicResults(prev => ({ ...prev, [currentQuestion.id]: mappedResults }))
      
      const allPassed = result.public_summary?.passed === result.public_summary?.total
      setOutput(prev => ({
        ...prev,
        [currentQuestion.id]: {
          stdout: allPassed 
            ? `All ${result.public_summary?.total || 0} public test cases passed!`
            : `${result.public_summary?.passed || 0}/${result.public_summary?.total || 0} public test cases passed`,
          status: result.status,
        }
      }))

      setQuestionStatus({ ...questionStatus, [currentQuestion.id]: 'attempted' })
    } catch (error: any) {
      console.error('Run error:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to run code'
      setOutput(prev => ({
        ...prev,
        [currentQuestion.id]: {
          stderr: errorMessage,
          status: 'error'
        }
      }))
    } finally {
      setRunning(false)
    }
  }

  const handleCodeSubmit = async () => {
    if (!userId) return
    
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return

    // Prevent manual submission if question was already auto-submitted
    if (autoSubmittedQuestions[currentQuestion.id]) {
      return
    }

    // Handle SQL questions - submit via sql-execution-engine
    const isSQLQuestion = currentQuestion.question_type?.toUpperCase() === 'SQL'
    if (isSQLQuestion) {
      setSubmitting(true)
      setOutput(prev => ({
        ...prev,
        [currentQuestion.id]: {
          stdout: '⏳ Submitting SQL query for evaluation...',
          status: 'running'
        }
      }))

      // Helper function to parse formatted table text into array of objects
      const parseFormattedTableToArray = (text: string): any[] => {
        if (!text || !text.trim()) return []
        
        const lines = text.trim().split('\n').filter(line => line.trim())
        if (lines.length === 0) return []
        
        // Check if it's a pipe-separated table (markdown or plain)
        const hasPipes = lines[0].includes('|')
        
        if (hasPipes) {
          // Parse pipe-separated table
          const rows: any[] = []
          let headers: string[] = []
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) continue
            
            // Split by pipe and clean up
            const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell)
            
            // Skip separator rows (like "--- | ---")
            if (cells.every(cell => /^[\s\-:]+$/.test(cell))) continue
            
            if (i === 0 || headers.length === 0) {
              // First non-separator row is headers
              headers = cells.map(h => h.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, ''))
            } else {
              // Data row
              const row: any = {}
              headers.forEach((header, idx) => {
                const value = cells[idx] || null
                // Try to parse as number, otherwise keep as string
                if (value !== null && value !== undefined && value !== '') {
                  const numValue = Number(value)
                  row[header] = isNaN(numValue) ? value.trim() : numValue
                } else {
                  row[header] = null
                }
              })
              if (Object.keys(row).length > 0) {
                rows.push(row)
              }
            }
          }
          
          return rows.length > 0 ? rows : []
        } else {
          // Try to parse as space-aligned columns
          const rows: any[] = []
          const firstLine = lines[0]
          const columnPositions: number[] = []
          
          // Find column boundaries (multiple spaces indicate column separation)
          let inWord = false
          for (let i = 0; i < firstLine.length; i++) {
            if (firstLine[i] !== ' ' && !inWord) {
              columnPositions.push(i)
              inWord = true
            } else if (firstLine[i] === ' ' && inWord) {
              inWord = false
            }
          }
          
          if (columnPositions.length > 0) {
            // Extract headers from first line
            const headers: string[] = []
            for (let i = 0; i < columnPositions.length; i++) {
              const start = columnPositions[i]
              const end = i < columnPositions.length - 1 ? columnPositions[i + 1] : firstLine.length
              const header = firstLine.substring(start, end).trim()
              headers.push(header.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, ''))
            }
            
            // Extract data rows
            for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
              const line = lines[lineIdx]
              const row: any = {}
              for (let i = 0; i < headers.length; i++) {
                const start = columnPositions[i]
                const end = i < headers.length - 1 ? columnPositions[i + 1] : line.length
                const value = line.substring(start, end).trim()
                if (value) {
                  const numValue = Number(value)
                  row[headers[i]] = isNaN(numValue) ? value : numValue
                } else {
                  row[headers[i]] = null
                }
              }
              if (Object.keys(row).length > 0) {
                rows.push(row)
              }
            }
            
            return rows.length > 0 ? rows : []
          }
        }
        
        // If we can't parse it, return empty array
        return []
      }

      try {
        let sqlQuery = code[currentQuestion.id] || currentQuestion.starter_query || ''
        
        // Normalize SQL query to single line with \n characters
        sqlQuery = sqlQuery.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        
        // Trim and validate SQL query
        sqlQuery = sqlQuery.trim()
        
        if (!sqlQuery || sqlQuery.length === 0) {
          setOutput(prev => ({
            ...prev,
            [currentQuestion.id]: {
              stderr: 'Error: SQL query cannot be empty. Please write a query before submitting.',
              status: 'error'
            }
          }))
          setSubmitting(false)
          return
        }
        
        // Remove trailing semicolons if present (the engine handles this, but let's be consistent)
        // Actually, keep semicolons as they're needed for multiple statements
        // Just ensure the query is not just whitespace or comments
        
        // Check if query is just comments or whitespace
        const queryWithoutComments = sqlQuery
          .replace(/--.*$/gm, '') // Remove single-line comments
          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
          .trim()
        
        if (!queryWithoutComments || queryWithoutComments.length === 0) {
          setOutput(prev => ({
            ...prev,
            [currentQuestion.id]: {
              stderr: 'Error: SQL query cannot be empty or contain only comments. Please write a valid query.',
              status: 'error'
            }
          }))
          setSubmitting(false)
          return
        }
        
        const startedAt = questionStartTimes[currentQuestion.id] || new Date().toISOString()
        const submittedAt = new Date().toISOString()
        const startTime = new Date(startedAt).getTime()
        const endTime = new Date(submittedAt).getTime()
        const timeSpentSeconds = Math.floor((endTime - startTime) / 1000)
        
        // Get expected output from question
        // The submit endpoint requires expectedOutput, so we need to provide it
        // If not available, we'll use an empty array as a fallback
        let expectedOutput: any = []
        if (currentQuestion.sql_expected_output) {
          try {
            // Try to parse as JSON if it's a string
            if (typeof currentQuestion.sql_expected_output === 'string') {
              try {
                const parsed = JSON.parse(currentQuestion.sql_expected_output)
                expectedOutput = Array.isArray(parsed) ? parsed : [parsed]
              } catch (parseError) {
                // Not JSON - try to parse as formatted table (pipe-separated, markdown, etc.)
                expectedOutput = parseFormattedTableToArray(currentQuestion.sql_expected_output)
              }
            } else if (Array.isArray(currentQuestion.sql_expected_output)) {
              expectedOutput = currentQuestion.sql_expected_output
            } else {
              expectedOutput = [currentQuestion.sql_expected_output]
            }
          } catch (e: any) {
            // Last resort: try to parse as formatted table
            expectedOutput = parseFormattedTableToArray(String(currentQuestion.sql_expected_output))
          }
        }
        
        
        // Call sql-execution-engine submit endpoint
        // URL must be set in NEXT_PUBLIC_SQL_ENGINE_URL environment variable
        const baseUrl = process.env.NEXT_PUBLIC_SQL_ENGINE_URL
        if (!baseUrl) {
          throw new Error('NEXT_PUBLIC_SQL_ENGINE_URL environment variable is not set. Please configure it in your .env file.')
        }
        const sqlEngineUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
        
        console.log('[SQL Submit] ===== Starting Submit =====')
        console.log('[SQL Submit] SQL Engine URL:', sqlEngineUrl)
        console.log('[SQL Submit] Sending query:', sqlQuery.substring(0, 100) + (sqlQuery.length > 100 ? '...' : ''))
        console.log('[SQL Submit] Question ID:', currentQuestion.id)
        console.log('[SQL Submit] Expected Output:', expectedOutput)
        
        const requestBody = {
          questionId: currentQuestion.id,
          code: sqlQuery,
          expectedOutput: expectedOutput,
          schemas: currentQuestion.schemas || null,
          sample_data: currentQuestion.sample_data || null,
        }
        console.log('[SQL Submit] Request body:', JSON.stringify(requestBody).substring(0, 500))
        
        const submitResponse = await fetch(`${sqlEngineUrl}/api/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })
        
        console.log('[SQL Submit] Response status:', submitResponse.status, submitResponse.statusText)
        console.log('[SQL Submit] Response headers:', Object.fromEntries(submitResponse.headers.entries()))

        // Check if response is OK and is JSON
        if (!submitResponse.ok) {
          const text = await submitResponse.text()
          if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            throw new Error(`SQL engine returned HTML (likely 404). Make sure the SQL execution engine is running on ${sqlEngineUrl}`)
          }
          throw new Error(`HTTP ${submitResponse.status}: ${text.substring(0, 200)}`)
        }

        const contentType = submitResponse.headers.get('content-type') || ''
        let responseText = ''
        
        // Read response as text first to handle errors better
        try {
          responseText = await submitResponse.text()
        } catch (e: any) {
          throw new Error(`Failed to read response: ${e?.message || String(e)}`)
        }
        
        if (!contentType.includes('application/json')) {
          throw new Error(`Expected JSON but got ${contentType}. Response: ${responseText.substring(0, 500)}`)
        }
        
        // Try to parse JSON
        let submitResult
        try {
          submitResult = JSON.parse(responseText)
        } catch (e: any) {
          console.error('Failed to parse JSON response:', responseText)
          throw new Error(`Invalid JSON response from SQL engine. Response: ${responseText.substring(0, 500)}`)
        }
        
        // Debug: Log the full response to see what we're getting
        console.log('[SQL Submit] Full response from engine:', JSON.stringify(submitResult, null, 2))
        console.log('[SQL Submit] actualOutput type:', typeof submitResult.actualOutput)
        console.log('[SQL Submit] actualOutput value:', submitResult.actualOutput)
        console.log('[SQL Submit] actualOutput is array:', Array.isArray(submitResult.actualOutput))
        if (Array.isArray(submitResult.actualOutput)) {
          console.log('[SQL Submit] actualOutput length:', submitResult.actualOutput.length)
        }
        
        // Format actual output for display
        let actualOutputText = ''
        if (submitResult.actualOutput === null || submitResult.actualOutput === undefined) {
          actualOutputText = '(no output - query returned null/undefined)'
        } else if (Array.isArray(submitResult.actualOutput)) {
          if (submitResult.actualOutput.length === 0) {
            actualOutputText = '(no output rows - query returned empty result set)'
          } else {
            // Has rows - format as table
            const headers = Object.keys(submitResult.actualOutput[0] as Record<string, any>)
            const rows = submitResult.actualOutput.map((row: Record<string, any>) => Object.values(row))
            actualOutputText = headers.join(' | ') + '\n'
            actualOutputText += headers.map(() => '---').join(' | ') + '\n'
            rows.forEach((row: any[]) => {
              actualOutputText += row.map((val: any) => 
                val === null || val === undefined ? 'NULL' : String(val)
              ).join(' | ') + '\n'
            })
          }
        } else if (typeof submitResult.actualOutput === 'string') {
          actualOutputText = submitResult.actualOutput || '(empty string)'
        } else {
          actualOutputText = `(unexpected output type: ${typeof submitResult.actualOutput})`
        }
        
        // CRITICAL: Get SQL engine's result - this is the source of truth for pass/fail
        // SQL engine correctly detects mismatches, so trust its result
        const sqlEnginePassed = submitResult.passed === true
        
        // Format expected output as string for storage
        let expectedOutputText = ''
        if (Array.isArray(expectedOutput) && expectedOutput.length > 0) {
          const headers = Object.keys(expectedOutput[0] as Record<string, any>)
          const rows = expectedOutput.map((row: Record<string, any>) => Object.values(row))
          expectedOutputText = headers.join(' | ') + '\n'
          expectedOutputText += headers.map(() => '---').join(' | ') + '\n'
          rows.forEach((row: any[]) => {
            expectedOutputText += row.map((val: any) => 
              val === null || val === undefined ? 'NULL' : String(val)
            ).join(' | ') + '\n'
          })
        } else if (typeof expectedOutput === 'string') {
          expectedOutputText = expectedOutput
        }
        
        // Store execution engine results for final-submit
        setSqlExecutionResults(prev => ({
          ...prev,
          [currentQuestion.id]: {
            passed: sqlEnginePassed,
            actualOutput: actualOutputText,
            expectedOutput: expectedOutputText,
            time: undefined,
            memory: undefined,
          }
        }))
        
        // Submit to backend for AI evaluation and tracking
        // IMPORTANT: Send execution engine's passed status to backend so it saves correct test case count (0/1 or 1/1)
        let backendResponse: any = null
        try {
          const backendResult = await dsaService.submitSQL({
            question_id: currentQuestion.id,
            sql_query: sqlQuery,
            started_at: startedAt,
            submitted_at: submittedAt,
            time_spent_seconds: timeSpentSeconds,
            // Send execution engine's result to backend
            execution_engine_passed: sqlEnginePassed,
            execution_engine_output: actualOutputText,
            execution_engine_time: undefined, // SQL engine doesn't provide time
            execution_engine_memory: undefined, // SQL engine doesn't provide memory
          })
          backendResponse = backendResult.data || backendResult
          console.log('[SQL Submit] Backend response:', backendResponse)
          console.log('[SQL Submit] Sent execution engine result to backend:', {
            passed: sqlEnginePassed,
            test_case_count: sqlEnginePassed ? '1/1' : '0/1'
          })
        } catch (backendError: any) {
          console.warn('Failed to save submission to backend:', backendError)
          // Continue with SQL engine result if backend fails
        }
        
        // If backend response exists, use it for AI score and metadata
        // But override the passed status with SQL engine's result
        let finalResult: any
        if (backendResponse) {
          // Use backend response but override passed status with SQL engine's result
          finalResult = {
            ...backendResponse,
            passed: sqlEnginePassed,  // Use SQL engine's result
            status: sqlEnginePassed ? 'accepted' : 'wrong_answer',
            message: sqlEnginePassed ? 'Query produces correct results!' : 'Query output does not match expected results',
            public_summary: {
              total: 1,
              passed: sqlEnginePassed ? 1 : 0  // Use SQL engine's result
            },
            public_results: backendResponse.public_results ? backendResponse.public_results.map((r: any) => ({
              ...r,
              passed: sqlEnginePassed  // Override with SQL engine's result
            })) : []
          }
          console.log('[SQL Submit] Using SQL engine result for pass/fail:', {
            sqlEnginePassed,
            backendPassed: backendResponse.passed,
            finalPassed: finalResult.passed
          })
        } else {
          // Fallback: use SQL engine result directly
          console.warn('[SQL Submit] Backend response missing, using SQL engine result')
          finalResult = {
            passed: sqlEnginePassed,
            status: sqlEnginePassed ? 'accepted' : 'wrong_answer',
            message: sqlEnginePassed ? 'Query produces correct results!' : submitResult.reason || 'Query output does not match expected results',
            user_output: actualOutputText,
            expected_output: '',
            time: null,
            memory: null,
            score: 0,
            max_score: 100,
            public_results: [{
              id: 'sql_test_1',
              test_number: 1,
              input: '',
              expected_output: '',
              user_output: actualOutputText,
              status: sqlEnginePassed ? 'accepted' : 'wrong_answer',
              status_id: sqlEnginePassed ? 3 : 4,
              time: null,
              memory: null,
              passed: sqlEnginePassed,
            }],
            public_summary: {
              total: 1,
              passed: sqlEnginePassed ? 1 : 0
            }
          }
        }
        
        // IMPORTANT: Backend's passed status is based on strict output comparison
        // If backend says passed=false, then test case FAILED regardless of SQL engine result
        console.log('[SQL Submit] Backend strict comparison result:', {
          passed: finalResult.passed,
          status: finalResult.status,
          message: finalResult.message,
          user_output_length: finalResult.user_output?.length,
          expected_output_length: finalResult.expected_output?.length,
          public_summary: finalResult.public_summary,
          public_results: finalResult.public_results
        })
        
        // CRITICAL CHECK: Verify backend comparison result
        if (finalResult.passed === true && finalResult.public_summary?.passed === 1) {
          console.warn('[SQL Submit] ⚠️ Backend says PASSED - verify this is correct!')
        } else if (finalResult.passed === false && finalResult.public_summary?.passed === 0) {
          console.log('[SQL Submit] ✅ Backend correctly identified FAILURE')
        } else {
          console.error('[SQL Submit] ❌ MISMATCH: passed status inconsistent!', {
            passed: finalResult.passed,
            public_summary_passed: finalResult.public_summary?.passed
          })
        }
        
        // Update output with test case information (NO SCORE DISPLAY - score only in admin analytics)
        const testCaseInfo = finalResult.public_summary 
          ? `\n\n Test Cases: ${finalResult.public_summary.passed}/${finalResult.public_summary.total} passed`
          : ''
        
        if (finalResult.passed) {
          setOutput(prev => ({
            ...prev,
            [currentQuestion.id]: {
              stdout: `Query passed!${testCaseInfo}\n\nYour Output:\n${actualOutputText}\n\n${submitResult.reason ? `Note: ${submitResult.reason}` : ''}`,
              status: 'accepted'
            }
          }))
          setQuestionStatus({ ...questionStatus, [currentQuestion.id]: 'solved' })
        } else {
          // Query failed or didn't match expected output
          let outputMessage = `Query did not pass${testCaseInfo}\n\nYour Output:\n${actualOutputText}`
          
          if (finalResult.error || submitResult.error) {
            const errorMsg = finalResult.error || submitResult.error
            let formattedError = errorMsg
            if (errorMsg.includes('incomplete input')) {
              formattedError = `Incomplete SQL query. Please ensure your query is complete and properly terminated.\n\nCommon issues:\n- Missing FROM clause in SELECT statement\n- Unclosed parentheses or quotes\n- Incomplete WHERE clause\n- Missing semicolon (if using multiple statements)\n\nError details: ${errorMsg}`
            } else if (errorMsg.includes('syntax error')) {
              formattedError = `SQL syntax error: ${errorMsg}\n\nPlease check your query syntax.`
            } else if (errorMsg.includes('no such table')) {
              formattedError = `Table not found: ${errorMsg}\n\nPlease check the table name and ensure it exists in the schema.`
            } else if (errorMsg.includes('no such column')) {
              formattedError = `Column not found: ${errorMsg}\n\nPlease check the column name and ensure it exists in the table.`
            }
            
            outputMessage = `Execution Error: ${formattedError}\n\nYour Output:\n${actualOutputText}`
          } else if (submitResult.reason) {
            outputMessage += `\n\n Reason: ${submitResult.reason}`
          }
          
          setOutput(prev => ({
            ...prev,
            [currentQuestion.id]: {
              stdout: outputMessage,
              status: finalResult.status || (submitResult.error ? 'error' : 'wrong_answer')
            }
          }))
          setQuestionStatus({ ...questionStatus, [currentQuestion.id]: 'attempted' })
        }
        
        // Set public results for test case display
        if (finalResult.public_results && finalResult.public_results.length > 0) {
          const mappedResults: SubmissionTestcaseResult[] = finalResult.public_results.map((r: any) => ({
            visible: true,
            input: r.input || '',
            expected: r.expected_output || '',
            output: r.user_output || actualOutputText,
            stdout: r.user_output || actualOutputText,
            stderr: r.stderr || '',
            compile_output: r.compile_output || '',
            time: r.time,
            memory: r.memory,
            status: r.status,
            passed: r.passed,
          }))
          setPublicResults(prev => ({ ...prev, [currentQuestion.id]: mappedResults }))
        }

        // Add to submission history with AI score and test case results
        const historyEntry: SubmissionHistoryEntry = {
          id: `sql-${currentQuestion.id}-${Date.now()}`,
          status: finalResult.status || (finalResult.passed ? 'accepted' : (submitResult.error ? 'error' : 'wrong_answer')),
          passed: finalResult.public_summary?.passed || (finalResult.passed ? 1 : 0),
          total: finalResult.public_summary?.total || 1,
          score: finalResult.score !== undefined ? finalResult.score : (finalResult.passed ? 100 : 0),
          max_score: finalResult.max_score !== undefined ? finalResult.max_score : 100,
          created_at: new Date().toISOString(),
          results: finalResult.public_results ? finalResult.public_results.map((r: any) => ({
            visible: true,
            input: r.input || '',
            expected: r.expected_output || '',
            output: r.user_output || actualOutputText,
            stdout: r.user_output || actualOutputText,
            stderr: r.stderr || '',
            compile_output: r.compile_output || '',
            time: r.time,
            memory: r.memory,
            status: r.status,
            passed: r.passed,
          })) : [],
        }
        
        setSubmissionHistory((prev) => {
          const existing = prev[currentQuestion.id] || []
          const updated = [historyEntry, ...existing].slice(0, 5)
          return { ...prev, [currentQuestion.id]: updated }
        })
        
        // Mark question as submitted (unlock next question)
        setSubmittedQuestions(prev => ({
          ...prev,
          [currentQuestion.id]: true
        }))

        // Auto-navigate to next question after successful submission
        if (submitResult.passed && questions.length > 1) {
          const currentIndex = questions.findIndex(q => q.id === currentQuestion.id)
          if (currentIndex < questions.length - 1) {
            console.log('[Submit] Auto-navigating to next question:', currentIndex + 1)
            // Small delay to ensure UI updates before navigation
            setTimeout(() => {
              handleQuestionChange(currentIndex + 1)
            }, 300)
          }
        }

      } catch (error: any) {
        console.error('SQL Submit error:', error)
        let errorMessage = error.message || 'Failed to submit SQL query'
        
        // Handle errors
        if (error.response?.data?.detail) {
          errorMessage = error.response.data.detail
        }
        
        setOutput(prev => ({
          ...prev,
          [currentQuestion.id]: {
            stderr: ` Error: ${errorMessage}`,
            status: 'error'
          }
        }))
        setQuestionStatus({ ...questionStatus, [currentQuestion.id]: 'attempted' })
      } finally {
        setSubmitting(false)
      }
      return
    }

    setRunning(true)
    setOutput({})
    setPublicResults({})
    setHiddenSummary({})

    try {
      const currentLang = language[currentQuestion.id] || 'python'
      const currentCode = code[currentQuestion.id] || ''
      const languageId = getLanguageId(currentLang)

      if (!languageId) {
        alert(`Unsupported language: ${currentLang}`)
        setRunning(false)
        return
      }

      const startedAt = questionStartTimes[currentQuestion.id] || new Date().toISOString()
      const submittedAt = new Date().toISOString()
      const startTime = new Date(startedAt).getTime()
      const endTime = new Date(submittedAt).getTime()
      const timeSpentSeconds = Math.floor((endTime - startTime) / 1000)
      
      const response = await dsaService.submitCodeFull({
        question_id: currentQuestion.id,
        source_code: currentCode,
        language_id: String(languageId),
        started_at: startedAt,
        submitted_at: submittedAt,
        time_spent_seconds: timeSpentSeconds,
      })

      // Handle both ApiResponse wrapper and plain object responses
      const result = response?.data || response
      
      if (!result) {
        console.error('Submit code response is undefined:', response)
        throw new Error('Invalid response format: response is undefined')
      }
      
      if (!result.public_results) {
        console.error('Submit code response missing public_results:', result)
        throw new Error('Invalid response format: missing public_results')
      }
      
      const mappedResults: SubmissionTestcaseResult[] = (result.public_results || []).map((r: any) => ({
        visible: true,
        input: r.input,
        expected: r.expected_output,
        output: r.user_output || r.stdout || '',
        stdout: r.user_output || r.stdout || '',
        stderr: r.stderr || '',
        compile_output: r.compile_output || '',
        time: r.time,
        memory: r.memory,
        status: r.status,
        passed: r.passed,
      }))
      
      setPublicResults(prev => ({ ...prev, [currentQuestion.id]: mappedResults }))
      setHiddenSummary(prev => ({ ...prev, [currentQuestion.id]: result.hidden_summary || null }))

      if (result.compilation_error) {
        const compileOutput = result.public_results?.find((r: any) => r.compile_output)?.compile_output
        setOutput(prev => ({
          ...prev,
          [currentQuestion.id]: {
            stderr: compileOutput || 'Compilation failed',
            compileOutput: compileOutput,
            status: 'Compilation Error',
          }
        }))
      } else {
        const hiddenInfo = result.hidden_summary?.total > 0 
          ? ` (Hidden: ${result.hidden_summary.passed}/${result.hidden_summary.total})`
          : ''
        setOutput(prev => ({
          ...prev,
          [currentQuestion.id]: {
            stdout: `Passed ${result.total_passed}/${result.total_tests} test cases${hiddenInfo}\nScore: ${result.score}/${result.max_score}`,
            status: result.status,
          }
        }))
      }

      if (result.status === 'accepted') {
        setQuestionStatus({ ...questionStatus, [currentQuestion.id]: 'solved' })
      } else {
        setQuestionStatus({ ...questionStatus, [currentQuestion.id]: 'attempted' })
      }

      const historyEntry: SubmissionHistoryEntry = {
        id: result.submission_id || `${currentQuestion.id}-${Date.now()}`,
        status: result.status,
        passed: result.total_passed,
        total: result.total_tests,
        score: result.score,
        max_score: result.max_score,
        created_at: new Date().toISOString(),
        results: [],
        public_results: result.public_results,
        hidden_results: result.hidden_results,
        hidden_summary: result.hidden_summary,
      }

      setSubmissionHistory((prev) => {
        const questionId = currentQuestion.id
        const existing = prev[questionId] || []
        const updated = [historyEntry, ...existing].slice(0, 5)
        return { ...prev, [questionId]: updated }
      })
      
      // Mark question as submitted (unlock next question)
      setSubmittedQuestions(prev => ({
        ...prev,
        [currentQuestion.id]: true
      }))

      // Auto-navigate to next question after successful submission
      if (questions.length > 1) {
        const currentIndex = questions.findIndex(q => q.id === currentQuestion.id)
        if (currentIndex < questions.length - 1) {
          console.log('[Submit] Auto-navigating to next question:', currentIndex + 1)
          // Small delay to ensure UI updates before navigation
          setTimeout(() => {
            handleQuestionChange(currentIndex + 1)
          }, 300)
        }
      }
    } catch (error: any) {
      console.error('Submit error:', error)
      setOutput(prev => ({
        ...prev,
        [currentQuestion.id]: {
          stderr: error.response?.data?.detail || 'Failed to submit code',
          status: 'error'
        }
      }))
    } finally {
      setRunning(false)
    }
  }

  const handleReset = () => {
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return

    // Handle SQL questions differently (case-insensitive check)
    if (currentQuestion.question_type?.toUpperCase() === 'SQL') {
      const starterQuery = currentQuestion.starter_query || '-- Write your SQL query here\n\nSELECT '
      setCode({ ...code, [currentQuestion.id]: starterQuery })
    } else {
      // Coding questions
      const currentLang = language[currentQuestion.id] || currentQuestion.languages[0] || 'python'
      let starterCode = ''
      if (currentQuestion.function_signature) {
        starterCode = generateBoilerplate(currentLang, currentQuestion)
      } else if (currentQuestion.starter_code && currentQuestion.starter_code[currentLang]) {
        starterCode = currentQuestion.starter_code[currentLang]
      } else {
        starterCode = generateBoilerplate(currentLang, currentQuestion)
      }
      setCode({ ...code, [currentQuestion.id]: starterCode })
    }
  }

  const handleLanguageChange = (newLang: string) => {
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return

    const newLanguage = { ...language, [currentQuestion.id]: newLang }
    setLanguage(newLanguage)
    
    // Use userId in localStorage key to ensure code isolation between candidates
    if (testId && typeof testId === 'string' && userId) {
      const storageKey = `test_${testId}_${userId}_language`
      localStorage.setItem(storageKey, JSON.stringify(newLanguage))
    }
    
    let newStarterCode = ''
    if (currentQuestion.function_signature) {
      newStarterCode = generateBoilerplate(newLang, currentQuestion)
    } else if (currentQuestion.starter_code && currentQuestion.starter_code[newLang]) {
      newStarterCode = currentQuestion.starter_code[newLang]
    } else {
      newStarterCode = generateBoilerplate(newLang, currentQuestion)
    }
    
    const newCode = { ...code, [currentQuestion.id]: newStarterCode }
    setCode(newCode)
    
    // Use userId in localStorage key to ensure code isolation between candidates
    if (testId && typeof testId === 'string' && userId) {
      const storageKey = `test_${testId}_${userId}_code`
      localStorage.setItem(storageKey, JSON.stringify(newCode))
    }
  }

  // Auto-save code to localStorage (must be before early returns to follow Rules of Hooks)
  // Use userId in localStorage key to ensure code isolation between candidates
  useEffect(() => {
    if (testId && typeof testId === 'string' && userId && code && Object.keys(code).length > 0) {
      const timeoutId = setTimeout(() => {
        const storageKey = `test_${testId}_${userId}_code`
        localStorage.setItem(storageKey, JSON.stringify(code))
      }, 1000)
      
      return () => clearTimeout(timeoutId)
    }
  }, [code, testId, userId])

  // Early returns must come AFTER all hooks

  // Loading is based ONLY on questions length — as soon as we have any questions,
  // we render the main UI (test metadata can finish loading in the background).
  const isLoading = questions.length === 0
  
  // Show fullscreen prompt if needed (after refresh, before entering fullscreen)
  // This should appear before the editor UI
  if (showFullscreenPrompt && test && questions.length > 0) {
    return (
      <>
        <FullscreenPrompt
          isOpen={showFullscreenPrompt}
          onEnterFullscreen={handleEnterFullscreenFromPrompt}
          onFullscreenFailed={() => {
            console.error('[Fullscreen] Failed to enter fullscreen')
          }}
          candidateName={candidateName || undefined}
          isLoading={false}
        />
        {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
        {aiProctoringEnabled && (
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
  
  // Debug logging
  if (typeof window !== 'undefined' && isLoading) {
    console.log('[Test Load] Loading state:', {
      checkingParams,
      hasToken: !!token,
      hasUserId: !!userId,
      hasTestId: !!testId,
      hasTest: !!test,
      isLoading,
      questionsLoading
    })
  }

  // Show pre-check mode message if applicable
  if (precheckMode && test) {
    const minutes = Math.floor(timeUntilStart / 60)
    const seconds = timeUntilStart % 60
    
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="mb-4">
              {!canStartNow && (
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              )}
              <h2 className="text-xl font-semibold text-slate-200 mb-2">Pre-Check Mode</h2>
              <p className="text-slate-400 mb-4">{precheckMode.message}</p>
              {timeUntilStart > 0 && (
                <div className="text-2xl font-bold text-blue-400 mb-2">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </div>
              )}
              {testReadyToStart && (
                <div className="mt-6">
                  <button
                    onClick={handleStartAssessment}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors text-lg"
                  >
                    Start Assessment
                  </button>
                  <p className="text-slate-400 text-sm mt-3">
                    The test will start automatically in a few seconds...
                  </p>
                </div>
              )}
              {!canStartNow && (
                <p className="text-slate-500 text-sm">
                  Please complete pre-checks (screen sharing, camera access) while waiting for the test to start.
                </p>
              )}
            </div>
            {!canStartNow && (
              <p className="text-slate-600 text-xs mt-4">
                The test will automatically start when the start time is reached.
              </p>
            )}
          </div>
        </div>
        {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
        {aiProctoringEnabled && (
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

  const hasQuestions = questions.length > 0
  const currentQuestion = hasQuestions ? questions[currentQuestionIndex] : undefined

  // Create fallback test object if test data hasn't loaded yet (allows progressive rendering)
  const testForRender = test || {
    title: 'Test',
    description: '',
    timer_mode: 'GLOBAL' as const,
    duration_minutes: 60,
    question_ids: hasQuestions ? questions.map(q => q.id) : []
  }

  const currentCode = currentQuestion
    ? (code[currentQuestion.id] ||
      currentQuestion.starter_code[language[currentQuestion.id] || 'python'] ||
      '')
    : ''

  const currentLang = currentQuestion
    ? (language[currentQuestion.id] || currentQuestion.languages[0] || 'python')
    : 'python'
  
  const availableLanguages = useMemo(() => {
    if (!currentQuestion) return Object.keys(LANGUAGE_IDS) as string[]

    const starter = currentQuestion.starter_code || {}
    const starterLangs = Object.keys(starter).filter((lang) => {
      const codeForLang = starter[lang]
      return typeof codeForLang === 'string' && codeForLang.trim().length > 0
    })

    if (starterLangs.length > 0) {
      return starterLangs as string[]
    }

    if (Array.isArray(currentQuestion.languages) && currentQuestion.languages.length > 0) {
      return currentQuestion.languages as string[]
    }

    return Object.keys(LANGUAGE_IDS) as string[]
  }, [currentQuestion])

  // If we have no questions yet, show loading screen
  if (!hasQuestions || !currentQuestion) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-slate-400">Loading questions...</p>
          </div>
        </div>
        {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
        {aiProctoringEnabled && (
          <FullscreenLockOverlay
            isLocked={isFullscreenLocked}
            onRequestFullscreen={requestFullscreenLock}
            exitCount={fullscreenExitCount}
            message="You must be in fullscreen mode to continue the test."
            warningText={
              fullscreenExitCount > 0
                ? "Exiting fullscreen is recorded as a violation."
                : undefined
            }
          />
        )}
      </>
    )
  }

  if (isMobile) {
    return (
      <>
      <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
        {/* Proctoring Components */}
        <ViolationToast />
        {aiProctoringEnabled && (
          <WebcamPreview
            ref={thumbVideoRef}
            cameraOn={proctoringState.isCameraOn}
            faceMeshStatus={proctoringState.isModelLoaded ? "loaded" : proctoringState.errors.length > 0 ? "error" : "loading"}
            facesCount={proctoringState.facesCount}
          />
        )}

        <TimerBar
          timeRemaining={timer.timeRemaining} 
          totalTime={timer.totalTime}
          timerMode={testForRender?.timer_mode || 'GLOBAL'}
          currentQuestionTitle={currentQuestion?.title}
          questionTimeRemaining={currentQuestion ? timer.questionTimeRemaining[currentQuestion.id] : undefined}
          questionTotalTime={currentQuestion ? timer.questionTotalTime[currentQuestion.id] : undefined}
        />
        <div className="flex-1 overflow-y-auto">
          <QuestionSidebar
            testTitle={testForRender.title}
            questions={questions}
            currentQuestionIndex={currentQuestionIndex}
            onQuestionChange={handleQuestionChange}
            onSubmit={() => handleSubmit(false)}
            submitting={submitting}
            questionStatus={questionStatus}
            submittedQuestions={submittedQuestions}
            timerMode={testForRender?.timer_mode || 'GLOBAL'}
          />
          <div className="border-t border-slate-700">
            <QuestionTabs question={currentQuestion} />
          </div>
          <div className="border-t border-slate-700" style={{ minHeight: '400px' }} ref={editorRef}>
            {/* Conditionally render SQL or Coding editor based on question_type */}
            {currentQuestion.question_type?.toUpperCase() === 'SQL' ? (
              <SQLEditorContainer
                code={currentCode}
                question={currentQuestion as any}
                onCodeChange={(newCode) => setCode({ ...code, [currentQuestion.id]: newCode })}
                onRun={handleRun}
                onSubmit={handleCodeSubmit}
                onReset={handleReset}
                running={running}
                submitting={submitting}
                output={output[currentQuestion.id] || {}}
              />
            ) : (
              <EditorContainer
                code={currentCode}
                language={currentLang}
                languages={availableLanguages}
                starterCode={currentQuestion.starter_code}
                onCodeChange={(newCode) => setCode({ ...code, [currentQuestion.id]: newCode })}
                onLanguageChange={handleLanguageChange}
                onRun={handleRun}
                onSubmit={handleCodeSubmit}
                onReset={handleReset}
                running={running}
                submitting={submitting}
                submissions={submissionHistory[currentQuestion.id] || []}
                visibleTestcases={visibleTestcasesMap[currentQuestion.id] || []}
                output={output[currentQuestion.id] || {}}
                publicResults={publicResults[currentQuestion.id] || []}
                hiddenSummary={hiddenSummary?.[currentQuestion.id] || null}
              />
            )}
            {/* Next Question Banner - shows after question is submitted */}
            {submittedQuestions[currentQuestion.id] && currentQuestionIndex < questions.length - 1 && (
              <div className="bg-green-600/20 border-t border-green-500 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-400">
                  <span className="text-lg">✅</span>
                  <span className="font-medium">Question submitted successfully!</span>
                </div>
                <button
                  onClick={() => handleQuestionChange(currentQuestionIndex + 1)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  Next Question →
                </button>
              </div>
            )}
            {/* Last Question Submitted Banner */}
            {submittedQuestions[currentQuestion.id] && currentQuestionIndex === questions.length - 1 && (
              <div className="bg-blue-600/20 border-t border-blue-500 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-400">
                  <span className="text-lg">🎉</span>
                  <span className="font-medium">All questions submitted! Ready to finish the test.</span>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('[Submit] Button clicked')
                    handleSubmit(false)
                  }}
                  disabled={submitting || !testId || !userId}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  {submitting ? 'Submitting...' : 'Submit Test'}
                </button>
              </div>
            )}
          </div>
          {/* Output Console - only shown for coding questions (SQL has it integrated) */}
          {currentQuestion.question_type?.toUpperCase() !== 'SQL' && (
            <div className="border-t border-slate-700">
              <OutputConsole
                stdout={output[currentQuestion.id]?.stdout}
                stderr={output[currentQuestion.id]?.stderr}
                compileOutput={output[currentQuestion.id]?.compileOutput}
                status={output[currentQuestion.id]?.status}
                time={output[currentQuestion.id]?.time}
                memory={output[currentQuestion.id]?.memory}
              />
            </div>
          )}
        </div>
      </div>
      {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
      {aiProctoringEnabled && (
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
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Proctoring Components */}
      <ViolationToast />
      
      {/* Webcam Preview - only show when AI proctoring is enabled */}
      {aiProctoringEnabled && (
        <WebcamPreview
          ref={thumbVideoRef}
          cameraOn={proctoringState.isCameraOn}
          faceMeshStatus={proctoringState.isModelLoaded ? "loaded" : proctoringState.errors.length > 0 ? "error" : "loading"}
          facesCount={proctoringState.facesCount}
        />
      )}

      <TimerBar 
        timeRemaining={timer.timeRemaining} 
        totalTime={timer.totalTime}
        timerMode={test?.timer_mode || 'GLOBAL'}
        currentQuestionTitle={currentQuestion?.title}
        questionTimeRemaining={currentQuestion ? timer.questionTimeRemaining[currentQuestion.id] : undefined}
        questionTotalTime={currentQuestion ? timer.questionTotalTime[currentQuestion.id] : undefined}
      />

      {/* Expired Test Message */}
      {timer.isExpired && 
       test?.timer_mode === 'GLOBAL' && 
       testSubmission?.started_at && 
       timer.timeRemaining === 0 &&
       timer.totalTime > 0 && (
        <div className="bg-red-900/50 border-b border-red-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-red-300 font-semibold">Test Time Has Expired</p>
              <p className="text-red-400 text-sm">The allocated time for this test has ended. Please submit your test now.</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('[Submit] Button clicked (expired timer)')
              handleSubmit(false)
            }}
            disabled={submitting || !testId || !userId}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            {submitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Split
          className="flex h-full"
          direction="horizontal"
          // Outer split: left = question list, right = main area (description/schema + editor)
          minSize={[200, 480]}
          sizes={[20, 80]}
          gutterSize={10}
          snapOffset={0}
          dragInterval={1}
          gutterStyle={(dimension, gutterSize, index) => ({
            backgroundColor: '#64748b',
            cursor: 'col-resize',
            width: '10px',
            zIndex: '10',
            transition: 'background-color 0.2s',
          })}
          gutterAlign="center"
        >
          {/* Left: Question sidebar */}
          <div className="h-full overflow-hidden min-w-0 border-r border-slate-800">
            <QuestionSidebar
              testTitle={testForRender.title}
              questions={questions}
              currentQuestionIndex={currentQuestionIndex}
              onQuestionChange={handleQuestionChange}
              onSubmit={() => handleSubmit(false)}
              submitting={submitting}
              questionStatus={questionStatus}
              submittedQuestions={submittedQuestions}
              timerMode={testForRender?.timer_mode || 'GLOBAL'}
            />
          </div>

          {/* Right: inner split between Description/Schema and Editor */}
          <Split
            className="flex h-full"
            direction="horizontal"
            // Inner split: left = description/schema, right = SQL/coding editor
            minSize={[200, 300]}
            sizes={[35, 65]}
            gutterSize={10}
            snapOffset={0}
            dragInterval={1}
            gutterStyle={(dimension, gutterSize, index) => ({
              backgroundColor: '#64748b',
              cursor: 'col-resize',
              width: '10px',
              zIndex: '10',
              transition: 'background-color 0.2s',
            })}
            gutterAlign="center"
            onDragEnd={() => {
              // Force reflow to ensure layout updates
              window.dispatchEvent(new Event('resize'))
            }}
          >
            {/* Middle: Description / Schema (QuestionTabs) */}
            <div className="h-full overflow-hidden min-w-0 bg-slate-950">
              <QuestionTabs question={currentQuestion} />
            </div>

            {/* Right: Editor (coding / SQL) */}
            <div className="h-full overflow-hidden min-w-0 bg-slate-950 flex flex-col" ref={editorRef}>
            {/* Conditionally render SQL or Coding editor based on question_type */}
            <div className="flex-1 overflow-hidden">
              {currentQuestion.question_type?.toUpperCase() === 'SQL' ? (
                <SQLEditorContainer
                  code={currentCode}
                  question={currentQuestion as any}
                  onCodeChange={(newCode) => {
                    const updatedCode = { ...code, [currentQuestion.id]: newCode }
                    setCode(updatedCode)
                  }}
                  onRun={handleRun}
                  onSubmit={handleCodeSubmit}
                  onReset={handleReset}
                  running={running}
                  submitting={submitting}
                  output={output[currentQuestion.id] || {}}
                />
              ) : (
                <EditorContainer
                  code={currentCode}
                  language={currentLang}
                  languages={availableLanguages}
                  starterCode={currentQuestion.starter_code}
                  onCodeChange={(newCode) => {
                    const updatedCode = { ...code, [currentQuestion.id]: newCode }
                    setCode(updatedCode)
                  }}
                  onLanguageChange={handleLanguageChange}
                  onRun={handleRun}
                  onSubmit={handleCodeSubmit}
                  onReset={handleReset}
                  running={running}
                  submitting={submitting}
                  submissions={submissionHistory[currentQuestion.id] || []}
                  visibleTestcases={visibleTestcasesMap[currentQuestion.id] || []}
                  output={output[currentQuestion.id] || {}}
                  publicResults={publicResults[currentQuestion.id] || []}
                  hiddenSummary={hiddenSummary?.[currentQuestion.id] || null}
                />
              )}
            </div>
            {/* Next Question Banner - shows after question is submitted */}
            {submittedQuestions[currentQuestion.id] && currentQuestionIndex < questions.length - 1 && (
              <div className="bg-green-600/20 border-t border-green-500 p-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 text-green-400">
                  <span>✅</span>
                  <span className="font-medium text-sm">Question submitted!</span>
                </div>
                <button
                  onClick={() => handleQuestionChange(currentQuestionIndex + 1)}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded transition-colors"
                >
                  Next Question →
                </button>
              </div>
            )}
            {submittedQuestions[currentQuestion.id] && currentQuestionIndex === questions.length - 1 && (
              <div className="bg-blue-600/20 border-t border-blue-500 p-3 flex items-center justify-center flex-shrink-0">
                <div className="flex items-center gap-2 text-blue-400">
                  
                  <span className="font-medium text-sm">All done!</span>
                </div>
              </div>
            )}
          </div>
          </Split>
        </Split>
      </div>

      {/* Fullscreen Lock Overlay - only when AI Proctoring enabled */}
      {aiProctoringEnabled && (
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