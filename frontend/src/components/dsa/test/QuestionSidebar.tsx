'use client'

import { Button } from '../ui/button'
import { Send, CheckCircle2, Circle, AlertCircle, ArrowLeft, Lock } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/router'

interface Question {
  id: string
  title: string
}

interface QuestionSidebarProps {
  testTitle: string
  questions: Question[]
  currentQuestionIndex: number
  onQuestionChange: (index: number) => void
  onSubmit: () => void
  submitting: boolean
  questionStatus?: Record<string, 'solved' | 'attempted' | 'not-attempted'>
  submittedQuestions?: Record<string, boolean>
  timerMode?: 'GLOBAL' | 'PER_QUESTION'
  onBack?: () => void
}

export function QuestionSidebar({
  testTitle,
  questions,
  currentQuestionIndex,
  onQuestionChange,
  onSubmit,
  submitting,
  questionStatus = {},
  submittedQuestions = {},
  timerMode = 'PER_QUESTION',
  onBack
}: QuestionSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()

  // Check if a question is accessible
  // For GLOBAL mode: all questions are accessible
  // For PER_QUESTION mode: first question OR previous question submitted
  const isQuestionAccessible = (index: number): boolean => {
    // In GLOBAL mode, all questions are accessible
    if (timerMode === 'GLOBAL') {
      return true
    }
    // For PER_QUESTION mode, enforce sequential unlocking
    if (index === 0) return true // First question always accessible
    const previousQuestionId = questions[index - 1]?.id
    return previousQuestionId ? submittedQuestions[previousQuestionId] === true : false
  }

  const getStatusIcon = (questionId: string, index: number) => {
    // Show lock icon for inaccessible questions
    if (!isQuestionAccessible(index)) {
      return <Lock className="h-4 w-4 text-slate-500" />
    }
    
    const status = questionStatus[questionId] || 'not-attempted'
    if (index === currentQuestionIndex) {
      return <AlertCircle className="h-4 w-4 text-blue-400" />
    }
    if (status === 'solved') {
      return <CheckCircle2 className="h-4 w-4 text-green-400" />
    }
    if (status === 'attempted') {
      return <Circle className="h-4 w-4 text-yellow-400 fill-yellow-400" />
    }
    return <Circle className="h-4 w-4 text-slate-500" />
  }

  if (collapsed) {
    return (
      <div className="w-12 bg-slate-900 border-r border-slate-700 flex flex-col items-center py-4">
        <button
          onClick={() => setCollapsed(false)}
          className="text-slate-400 hover:text-white mb-4"
        >
          →
        </button>
        <div className="flex flex-col gap-2">
          {questions.map((q, idx) => {
            const accessible = isQuestionAccessible(idx)
            return (
              <button
                key={q.id}
                onClick={() => accessible && onQuestionChange(idx)}
                disabled={!accessible}
                className={`w-8 h-8 rounded flex items-center justify-center ${
                  !accessible
                    ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                    : idx === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                title={!accessible ? 'Submit previous question to unlock' : `Question ${idx + 1}`}
              >
                {!accessible ? <Lock className="h-3 w-3" /> : idx + 1}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-slate-900 border-r border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="text-slate-400 hover:text-white transition-colors"
                title="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="font-bold text-lg text-white">{testTitle}</h2>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="text-slate-400 hover:text-white transition-colors"
            title="Collapse sidebar"
          >
            ←
          </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
          Questions ({questions.length})
        </h3>
        {questions.map((q, idx) => {
          const accessible = isQuestionAccessible(idx)
          return (
            <button
              key={q.id}
              onClick={() => accessible && onQuestionChange(idx)}
              disabled={!accessible}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all duration-200 ${
                !accessible
                  ? 'bg-slate-800/30 text-slate-500 border-slate-700/50 cursor-not-allowed opacity-60'
                  : idx === currentQuestionIndex
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500 shadow-lg'
                  : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
              }`}
              title={!accessible ? 'Submit previous question to unlock' : undefined}
            >
              <div className="flex items-center gap-2 mb-1">
                {getStatusIcon(q.id, idx)}
                <span className="font-semibold">Question {idx + 1}</span>
                {!accessible && (
                  <span className="text-xs text-slate-500 ml-auto">Locked</span>
                )}
              </div>
              <div className={`text-xs ${
                !accessible 
                  ? 'text-slate-500' 
                  : idx === currentQuestionIndex 
                  ? 'text-blue-200' 
                  : 'text-slate-400'
              }`}>
                {q.title}
              </div>
            </button>
          )
        })}
      </div>

      {/* Submit Button */}
      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <Button
          onClick={onSubmit}
          disabled={submitting}
          className="w-full h-12 text-base font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all"
        >
          <Send className="h-5 w-5 mr-2" />
          {submitting ? 'Submitting...' : 'Submit Test'}
        </Button>
      </div>
    </div>
  )
}

