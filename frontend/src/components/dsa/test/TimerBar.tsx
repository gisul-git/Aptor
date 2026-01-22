'use client'

import { Clock, Timer } from 'lucide-react'

// Timer mode types matching backend
type TimerMode = 'GLOBAL' | 'PER_QUESTION'

interface TimerBarProps {
  timeRemaining: number
  totalTime: number
  // New props for per-question timer support
  timerMode?: TimerMode
  currentQuestionTitle?: string
  questionTimeRemaining?: number  // Time remaining for current question (PER_QUESTION mode)
  questionTotalTime?: number      // Total time for current question (PER_QUESTION mode)
}

export function TimerBar({ 
  timeRemaining, 
  totalTime,
  timerMode = 'GLOBAL',
  currentQuestionTitle,
  questionTimeRemaining,
  questionTotalTime,
}: TimerBarProps) {
  // Determine which timer to display based on mode
  const isPerQuestionMode = timerMode === 'PER_QUESTION'
  
  // Use question timer values in PER_QUESTION mode, otherwise use global timer
  const displayTime = isPerQuestionMode && questionTimeRemaining !== undefined 
    ? questionTimeRemaining 
    : timeRemaining
  const displayTotalTime = isPerQuestionMode && questionTotalTime !== undefined 
    ? questionTotalTime 
    : totalTime
  
  const percentage = displayTotalTime > 0 ? (displayTime / displayTotalTime) * 100 : 0
  
  // Always format time as HH:MM:SS
  const hours = Math.floor(displayTime / 3600)
  const minutes = Math.floor((displayTime % 3600) / 60)
  const seconds = displayTime % 60
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  // Color based on remaining time
  const getColor = () => {
    if (percentage > 50) return 'bg-green-500'
    if (percentage > 25) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  // Icon color matching progress bar logic
  const getIconColor = () => {
    if (percentage > 50) return 'text-green-400'
    if (percentage > 25) return 'text-yellow-400'
    return 'text-red-400'
  }

  // Timer label based on mode
  const timerLabel = isPerQuestionMode ? 'Question Time' : 'Test Time'
  const TimerIcon = isPerQuestionMode ? Timer : Clock

  return (
    <div className="sticky top-0 z-50 bg-slate-900 border-b border-slate-700 shadow-lg">
      <div className="px-4 py-3">
        {/* Timer Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TimerIcon className={`h-5 w-5 ${getIconColor()} animate-pulse`} />
            <div className="flex flex-col">
              <span className="font-bold text-lg text-white">{timerLabel}: {formattedTime}</span>
              {isPerQuestionMode && currentQuestionTitle && (
                <span className="text-xs text-slate-400 truncate max-w-[200px]">
                  {currentQuestionTitle}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 mx-4">
            <div className="w-full bg-slate-800 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-1000 ${getColor()}`}
                style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-sm font-medium text-slate-300">
              {Math.round(percentage)}% remaining
            </div>
            {isPerQuestionMode && (
              <span className="text-xs text-slate-500">
                Per-question timer
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}












