import { useState, useEffect, useRef } from 'react'

type TimerMode = 'GLOBAL' | 'PER_QUESTION'

interface QuestionTiming {
  question_id: string
  duration_minutes: number
}

interface TestConfig {
  timer_mode?: TimerMode
  duration_minutes: number
  question_timings?: QuestionTiming[]
  start_time?: string | null
}

interface UseAITimerOptions {
  test: TestConfig | null
  testSubmission: { started_at?: string } | null
  questions: Array<{ id: string }>
  currentQuestionId: string | null
  onExpire: () => void
  onQuestionExpire?: (questionId: string) => void
  enabled?: boolean
}

interface TimerState {
  timeRemaining: number
  totalTime: number
  questionTimeRemaining: Record<string, number>
  questionTotalTime: Record<string, number>
  isExpired: boolean
}

export function useAITimer({
  test,
  testSubmission,
  questions,
  currentQuestionId,
  onExpire,
  onQuestionExpire,
  enabled = true,
}: UseAITimerOptions): TimerState {
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState<Record<string, number>>({})
  const [questionTotalTime, setQuestionTotalTime] = useState<Record<string, number>>({})
  const [isExpired, setIsExpired] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const initializedRef = useRef(false)
  const expireCalledRef = useRef(false)
  const endTimeRef = useRef<Date | null>(null) // Store end time for accurate recalculation (GLOBAL mode)
  const questionEndTimesRef = useRef<Record<string, Date>>({}) // Store end times for each question (PER_QUESTION mode)
  const questionStartTimesRef = useRef<Record<string, Date>>({}) // Store start times for each question (PER_QUESTION mode)
  const questionExpireCalledRef = useRef<Record<string, boolean>>({}) // Track if expire callback was called for each question
  const questionTotalTimeRef = useRef<Record<string, number>>({}) // Store question total times for immediate access

  // Initialize timer
  useEffect(() => {
    console.log('[AITimer] Initialize effect check:', {
      enabled,
      hasTest: !!test,
      alreadyInitialized: initializedRef.current,
      timerMode: test?.timer_mode
    })
    
    // Do not initialize if disabled, no test, or we've already initialized.
    if (!enabled || !test || initializedRef.current) {
      console.log('[AITimer] Initialize effect - skipping initialization:', {
        reason: !enabled ? 'disabled' : !test ? 'no test' : 'already initialized'
      })
      return
    }

    if (!enabled) {
      // If timer is disabled, ensure we are fully reset.
      initializedRef.current = false
      expireCalledRef.current = false
      setIsExpired(false)
      return
    }

    if (test.timer_mode === 'GLOBAL') {
      // GLOBAL mode.
      const durationSeconds = test.duration_minutes * 60

      let testStartTime: Date
      if (testSubmission?.started_at) {
        // If test has started, start timer from now with full duration
        testStartTime = new Date()
      } else if (test.start_time) {
        // Fixed window: use scheduled start time
        const ts = new Date(test.start_time)
        if (!isNaN(ts.getTime())) {
          testStartTime = ts
        } else {
          console.error('[AITimer] Invalid test.start_time timestamp', test.start_time)
          testStartTime = new Date()
        }
      } else {
        // No start time, start now
        testStartTime = new Date()
      }

      const testEndTime = new Date(testStartTime.getTime() + durationSeconds * 1000)
      const now = new Date()
      const remaining = Math.max(0, Math.floor((testEndTime.getTime() - now.getTime()) / 1000))

      endTimeRef.current = testEndTime
      setTimeRemaining(remaining)
      setTotalTime(durationSeconds)
      setIsExpired(remaining === 0)

      if (remaining === 0 && !expireCalledRef.current) {
        expireCalledRef.current = true
        setIsExpired(true)
        onExpire()
      }

      initializedRef.current = true
      console.log('[AITimer] GLOBAL timer initialized:', {
        startTime: testStartTime.toISOString(),
        endTime: testEndTime.toISOString(),
        durationSeconds,
        remaining,
        initializedRef: initializedRef.current,
        enabled,
        hasTest: !!test
      })
    } else if (test.timer_mode === 'PER_QUESTION') {
      // PER_QUESTION mode: Initialize question timings
      if (!test.question_timings || test.question_timings.length === 0) {
        console.error('[AITimer] PER_QUESTION mode requires question_timings')
        return
      }

      const questionTimingsMap: Record<string, number> = {}
      const questionTotalTimeMap: Record<string, number> = {}

      for (const timing of test.question_timings) {
        const questionId = String(timing.question_id)
        const durationSeconds = timing.duration_minutes * 60
        questionTimingsMap[questionId] = durationSeconds
        questionTotalTimeMap[questionId] = durationSeconds
      }

      setQuestionTimeRemaining(questionTimingsMap)
      setQuestionTotalTime(questionTotalTimeMap)
      questionTotalTimeRef.current = questionTotalTimeMap

      // Calculate total time
      const totalSeconds = Object.values(questionTotalTimeMap).reduce((sum, time) => sum + time, 0)
      setTotalTime(totalSeconds)

      initializedRef.current = true
      console.log('[AITimer] PER_QUESTION timer initialized:', {
        questionTimings: questionTimingsMap,
        totalSeconds,
      })
    }
  }, [enabled, test, testSubmission, onExpire])

  // Countdown logic
  useEffect(() => {
    console.log('[AITimer] Countdown effect check:', {
      enabled,
      hasTest: !!test,
      initialized: initializedRef.current,
      timerMode: test?.timer_mode,
      currentInterval: !!intervalRef.current
    })
    
    if (!enabled || !test || !initializedRef.current) {
      console.log('[AITimer] Countdown effect - conditions not met, clearing interval')
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    if (test.timer_mode === 'GLOBAL') {
      // GLOBAL countdown
      console.log('[AITimer] Starting GLOBAL countdown interval')
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      // Use a more reliable update mechanism that works even when tab is throttled
      const updateTimer = () => {
        const endTime = endTimeRef.current
        if (!endTime) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return
        }

        const now = new Date()
        const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000))

        console.log('[AITimer] GLOBAL countdown - remaining:', remaining, 'endTime:', endTime.toISOString(), 'now:', now.toISOString())
        
        // Force state update - always update to ensure React detects change and re-renders
        setTimeRemaining(remaining)
        setIsExpired(remaining === 0)

        if (
          remaining === 0 &&
          !expireCalledRef.current
        ) {
          expireCalledRef.current = true
          setIsExpired(true)
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          onExpire()
        }
      }
      
      // Initial update
      updateTimer()
      
      // Set up interval - use shorter interval for more responsive updates
      intervalRef.current = setInterval(updateTimer, 1000)
      
      // Also use requestAnimationFrame for more reliable updates when tab is visible
      // This ensures UI updates even if setInterval is throttled
      let rafId: number | null = null
      let lastUpdateTime = Date.now()
      
      const scheduleRafUpdate = () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
        }
        rafId = requestAnimationFrame(() => {
          const now = Date.now()
          // Update via RAF every ~1000ms when visible
          if (now - lastUpdateTime >= 1000) {
            updateTimer()
            lastUpdateTime = now
          }
          // Continue RAF loop when visible
          if (document.visibilityState === 'visible' && intervalRef.current) {
            scheduleRafUpdate()
          }
        })
      }
      
      // Start RAF updates when visible
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        scheduleRafUpdate()
      }
      
      // Handle visibility changes to resume RAF updates
      const handleVisibilityChange = () => {
        if (typeof document !== 'undefined') {
          if (document.visibilityState === 'visible') {
            updateTimer() // Immediate update when tab becomes visible
            lastUpdateTime = Date.now()
            scheduleRafUpdate()
          } else {
            if (rafId !== null) {
              cancelAnimationFrame(rafId)
              rafId = null
            }
          }
        }
      }
      
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange)
      }
      
      // Return cleanup that clears both interval and RAF
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
          rafId = null
        }
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
      }
    } else if (test.timer_mode === 'PER_QUESTION' && currentQuestionId) {
      // PER_QUESTION countdown for current question
      const currentTime = questionTimeRemaining[currentQuestionId]
      
      // Initialize question timer if not already started
      if (!questionStartTimesRef.current[currentQuestionId]) {
        // Get duration from questionTotalTimeRef first (for immediate access), then fallback to state, then currentTime
        let durationSeconds = questionTotalTimeRef.current[currentQuestionId] || questionTotalTime[currentQuestionId]
        
        // If questionTotalTime doesn't have this question, try to get from currentTime
        if (!durationSeconds && currentTime !== undefined && currentTime > 0) {
          durationSeconds = currentTime
        }
        
        // Validate duration - must be > 0
        if (!durationSeconds || durationSeconds <= 0) {
          console.error('[AITimer] Invalid or missing duration for question:', currentQuestionId, {
            questionTotalTimeRef: questionTotalTimeRef.current[currentQuestionId],
            questionTotalTimeState: questionTotalTime[currentQuestionId],
            currentTime,
            questionTotalTimeRefKeys: Object.keys(questionTotalTimeRef.current),
            questionTotalTimeStateKeys: Object.keys(questionTotalTime),
            questionTimeRemainingKeys: Object.keys(questionTimeRemaining),
            initialized: initializedRef.current
          })
          // Don't start timer if duration is invalid
          return
        }
        
        const now = new Date()
        const questionEndTime = new Date(now.getTime() + durationSeconds * 1000)
        
        questionStartTimesRef.current[currentQuestionId] = now
        questionEndTimesRef.current[currentQuestionId] = questionEndTime
        
        // Recalculate remaining time based on actual elapsed time
        const remaining = Math.max(0, Math.floor((questionEndTime.getTime() - now.getTime()) / 1000))
        setQuestionTimeRemaining((prev) => ({
          ...prev,
          [currentQuestionId]: remaining
        }))
        
        // Check if question already expired on initialization
        if (remaining === 0 && !questionExpireCalledRef.current[currentQuestionId] && onQuestionExpire) {
          questionExpireCalledRef.current[currentQuestionId] = true
          // Clear interval before calling expire
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          onQuestionExpire(currentQuestionId)
          return
        }
        
        console.log('[AITimer] PER_QUESTION timer started for question:', currentQuestionId, {
          startTime: now.toISOString(),
          endTime: questionEndTime.toISOString(),
          durationSeconds,
          remaining
        })
      } else {
        // Question timer already started - recalculate remaining time when switching back
        // This ensures accuracy if user switches away and comes back
        const questionEndTime = questionEndTimesRef.current[currentQuestionId]
        if (questionEndTime) {
          const now = new Date()
          const remaining = Math.max(0, Math.floor((questionEndTime.getTime() - now.getTime()) / 1000))
          setQuestionTimeRemaining((prev) => ({
            ...prev,
            [currentQuestionId]: remaining
          }))
          
          // Check if question already expired when switching back
          if (remaining === 0 && !questionExpireCalledRef.current[currentQuestionId] && onQuestionExpire) {
            questionExpireCalledRef.current[currentQuestionId] = true
            // Clear interval before calling expire
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
            onQuestionExpire(currentQuestionId)
            return
          }
        }
      }

      // Check if current time is already 0 or undefined (shouldn't happen after initialization, but safety check)
      const finalTime = questionTimeRemaining[currentQuestionId]
      if (finalTime === undefined || finalTime <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        return
      }

      // Clear any existing interval before starting a new one
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      // Use recalculation-based countdown for accuracy
      // This prevents drift when browser tab is inactive or intervals are delayed
      intervalRef.current = setInterval(() => {
        const questionEndTime = questionEndTimesRef.current[currentQuestionId]
        
        if (!questionEndTime) {
          // Fallback to decrement if end time not set (shouldn't happen)
          setQuestionTimeRemaining((prev) => {
            const newTime = Math.max(0, (prev[currentQuestionId] || 0) - 1)
            const updated = { ...prev, [currentQuestionId]: newTime }

            if (
              newTime === 0 &&
              !questionExpireCalledRef.current[currentQuestionId] &&
              onQuestionExpire &&
              currentQuestionId
            ) {
              questionExpireCalledRef.current[currentQuestionId] = true
              // Clear interval when question expires
              if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
              }
              onQuestionExpire(currentQuestionId)
            }

            return updated
          })
          return
        }

        // Recalculate remaining time based on actual end time vs current time
        // This ensures accuracy even if the interval is delayed
        const now = new Date()
        const remaining = Math.max(
          0,
          Math.floor((questionEndTime.getTime() - now.getTime()) / 1000)
        )

        setQuestionTimeRemaining((prev) => {
          const updated = { ...prev, [currentQuestionId]: remaining }

          if (
            remaining === 0 &&
            !questionExpireCalledRef.current[currentQuestionId] &&
            onQuestionExpire &&
            currentQuestionId
          ) {
            questionExpireCalledRef.current[currentQuestionId] = true
            // Clear interval when question expires
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
            onQuestionExpire(currentQuestionId)
          }

          return updated
        })
      }, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, test, currentQuestionId, questionTimeRemaining, questionTotalTime, onQuestionExpire])

  // Reset initialization when test changes
  useEffect(() => {
    initializedRef.current = false
    expireCalledRef.current = false
    questionExpireCalledRef.current = {}
    questionStartTimesRef.current = {}
    questionEndTimesRef.current = {}
    questionTotalTimeRef.current = {}
    endTimeRef.current = null
  }, [test?.timer_mode, test?.duration_minutes, test?.question_timings])

  return {
    timeRemaining,
    totalTime,
    questionTimeRemaining,
    questionTotalTime,
    isExpired,
  }
}



