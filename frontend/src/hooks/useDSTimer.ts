import { useState, useEffect, useRef, useCallback } from 'react'

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

interface UseDSTimerOptions {
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

export function useDSTimer({
  test,
  testSubmission,
  questions,
  currentQuestionId,
  onExpire,
  onQuestionExpire,
  enabled = true,
}: UseDSTimerOptions): TimerState {
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState<Record<string, number>>({})
  const [questionTotalTime, setQuestionTotalTime] = useState<Record<string, number>>({})
  const [isExpired, setIsExpired] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const initializedRef = useRef(false)
  const hasTickedRef = useRef(false)
  const expireCalledRef = useRef(false)
  const endTimeRef = useRef<Date | null>(null) // Store end time for accurate recalculation (GLOBAL mode)
  const questionEndTimesRef = useRef<Record<string, Date>>({}) // Store end times for each question (PER_QUESTION mode)
  const questionStartTimesRef = useRef<Record<string, Date>>({}) // Store start times for each question (PER_QUESTION mode)
  const questionExpireCalledRef = useRef<Record<string, boolean>>({}) // Track if expire callback was called for each question
  const questionTotalTimeRef = useRef<Record<string, number>>({}) // Store question total times for immediate access
  const lastRecalculatedQuestionRef = useRef<string | null>(null) // Track last question we recalculated for to prevent infinite loops

  // Initialize timer
  useEffect(() => {
    // Do not initialize if disabled, no test, or we've already initialized.
    if (!enabled || !test || initializedRef.current) {
      return
    }

    if (!enabled) {
      // If timer is disabled, ensure we are fully reset.
      initializedRef.current = false
      hasTickedRef.current = false
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
          console.error('[DSTimer] Invalid test.start_time timestamp', test.start_time)
          testStartTime = new Date()
        }
      } else {
        // No start time, start now
        testStartTime = new Date()
      }

      const testEndTime = new Date(testStartTime.getTime() + durationSeconds * 1000)
      const now = new Date()
      const remaining = Math.max(
        0,
        Math.floor((testEndTime.getTime() - now.getTime()) / 1000)
      )

      // Store end time for accurate recalculation
      endTimeRef.current = testEndTime
      setTotalTime(durationSeconds)

      if (remaining === 0) {
        // Timer already over – mark expired and auto-submit once.
        setTimeRemaining(0)
        setIsExpired(true)
        hasTickedRef.current = true
        if (!expireCalledRef.current) {
          expireCalledRef.current = true
          onExpire()
        }
        initializedRef.current = true
        return
      }

      setTimeRemaining(remaining)
      setIsExpired(false)
      hasTickedRef.current = false
      expireCalledRef.current = false
      initializedRef.current = true

      console.log('[DSTimer] GLOBAL initialized:', {
        hasStarted: !!testSubmission?.started_at,
        startTime: testStartTime.toISOString(),
        testEndTime: testEndTime.toISOString(),
        remaining,
      })
    } else if (test.timer_mode === 'PER_QUESTION' && test.question_timings) {
      // PER_QUESTION mode: Initialize all question timers
      const qTimeRemaining: Record<string, number> = {}
      const qTotalTime: Record<string, number> = {}

      test.question_timings.forEach((timing) => {
        const durationSeconds = timing.duration_minutes * 60
        qTimeRemaining[timing.question_id] = durationSeconds
        qTotalTime[timing.question_id] = durationSeconds
      })

      setQuestionTimeRemaining(qTimeRemaining)
      setQuestionTotalTime(qTotalTime)
      questionTotalTimeRef.current = qTotalTime // Store in ref for immediate access
      hasTickedRef.current = false
      expireCalledRef.current = false
      initializedRef.current = true

      console.log('[DSTimer] PER_QUESTION initialized', {
        questionCount: test.question_timings.length,
        questionIds: test.question_timings.map(t => t.question_id),
        qTotalTime: qTotalTime,
        qTimeRemaining: qTimeRemaining
      })
    }
  }, [test, testSubmission, enabled])

  // Reset initialization when test changes
  useEffect(() => {
    initializedRef.current = false
    hasTickedRef.current = false
    expireCalledRef.current = false
    endTimeRef.current = null
    questionEndTimesRef.current = {}
    questionStartTimesRef.current = {}
    questionExpireCalledRef.current = {}
    questionTotalTimeRef.current = {}
    setIsExpired(false)
  }, [test?.timer_mode, testSubmission?.started_at])

  // Countdown logic
  useEffect(() => {
    if (!enabled || !test || !initializedRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    if (test.timer_mode === 'GLOBAL') {
      // GLOBAL countdown
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      if (isExpired) {
        return
      }

      // Use recalculation-based countdown for accuracy
      // This prevents drift when browser tab is inactive or intervals are delayed
      intervalRef.current = setInterval(() => {
        if (!endTimeRef.current) {
          // Fallback to decrement if end time not set (shouldn't happen)
          setTimeRemaining((prev) => Math.max(0, prev - 1))
          return
        }

        // Recalculate remaining time based on actual end time vs current time
        // This ensures accuracy even if the interval is delayed
        const now = new Date()
        const remaining = Math.max(
          0,
          Math.floor((endTimeRef.current.getTime() - now.getTime()) / 1000)
        )

        if (!hasTickedRef.current) {
          hasTickedRef.current = true
        }

        setTimeRemaining(remaining)

        if (
          remaining === 0 &&
          hasTickedRef.current &&
          !expireCalledRef.current
        ) {
          expireCalledRef.current = true
          setIsExpired(true)
          onExpire()
        }
      }, 1000)
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
          console.error('[DSTimer] Invalid or missing duration for question:', currentQuestionId, {
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
        
        console.log('[DSTimer] PER_QUESTION timer started for question:', currentQuestionId, {
          startTime: now.toISOString(),
          endTime: questionEndTime.toISOString(),
          durationSeconds,
          remaining
        })
      } else {
        // Question timer already started - only recalculate if question changed
        // CRITICAL: Only recalculate when question actually changes, not on every render
        // This prevents infinite render loops
        if (lastRecalculatedQuestionRef.current !== currentQuestionId) {
          lastRecalculatedQuestionRef.current = currentQuestionId
          
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
      }

      // Check if current time is already 0 or undefined (shouldn't happen after initialization, but safety check)
      const finalTime = questionTimeRemaining[currentQuestionId]
      if (finalTime === undefined || finalTime <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        // If not already called, call expire callback
        if (!questionExpireCalledRef.current[currentQuestionId] && onQuestionExpire) {
          questionExpireCalledRef.current[currentQuestionId] = true
          onQuestionExpire(currentQuestionId)
        }
        return
      }

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
  }, [
    enabled,
    test?.timer_mode,
    currentQuestionId,
    onExpire,
    onQuestionExpire,
    // Note: isExpired and questionTimeRemaining are checked inside the effect
    // but not in dependencies to avoid unnecessary re-renders
  ])

  return {
    timeRemaining,
    totalTime,
    questionTimeRemaining,
    questionTotalTime,
    isExpired,
  }
}

