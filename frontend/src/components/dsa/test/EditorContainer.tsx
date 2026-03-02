'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { MONACO_LANGUAGES } from '../../../lib/dsa/judge0'
import { EditorToolbar } from './EditorToolbar'
import { ExpectedOutputsPanel } from './ExpectedOutputsPanel'
import { OutputConsole } from './OutputConsole'
import { ChevronDown, ChevronUp, Lightbulb, TrendingUp, AlertCircle, AlertTriangle, CheckCircle2, Target } from 'lucide-react'
// Monaco Paste Detector
import { useMonacoPasteDetector } from '../../../hooks/proctoring/useMonacoPasteDetector'

// Lazy load Monaco Editor with loading optimization
// Start loading immediately when component mounts (don't wait for user interaction)
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-slate-950 text-slate-400">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
        <p className="text-sm">Loading editor...</p>
      </div>
    </div>
  )
})

export interface SubmissionTestcaseResult {
  visible: boolean
  input?: string | null
  expected?: string | null
  output?: string | null
  stdout?: string | null
  stderr?: string | null
  compile_output?: string | null
  time?: string | null
  memory?: number | null
  status?: string | null
  passed: boolean
}

export interface AIFeedback {
  overall_score?: number
  feedback_summary?: string
  one_liner?: string
  code_quality?: {
    score?: number
    comments?: string
  }
  efficiency?: {
    time_complexity?: string
    space_complexity?: string
    comments?: string
  }
  correctness?: {
    score?: number
    comments?: string
  }
  suggestions?: string[]
  strengths?: string[]
  areas_for_improvement?: string[]
  improvement_suggestions?: string[]
  deduction_reasons?: string[]
}

export interface SubmissionHistoryEntry {
  id: string
  status: string
  passed: number
  total: number
  score: number
  max_score: number
  created_at?: string
  results: SubmissionTestcaseResult[]
  // New fields for proper public/hidden separation
  public_results?: SubmissionTestcaseResult[]
  hidden_results?: any[]
  hidden_summary?: { total: number; passed: number }
  ai_feedback?: AIFeedback
}

interface VisibleTestcase {
  id: string
  input: string
  expected: string
}

// AI Feedback Display Component
function AIFeedbackDisplay({ feedback }: { feedback: AIFeedback }) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!feedback) return null

  const score = feedback.overall_score ?? 0
  const getScoreColor = () => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="mt-4 border border-blue-500/30 rounded-lg bg-blue-500/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-500/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Lightbulb className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-blue-300">AI Feedback</span>
          <span className={`text-lg font-bold ${getScoreColor()}`}>
            Score: {score}/100
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-blue-500/20 pt-4">
          {/* Summary */}
          {feedback.feedback_summary && (
            <div className="bg-slate-900/50 rounded-lg p-3">
              <p className="text-sm text-slate-300 leading-relaxed">
                {feedback.feedback_summary}
              </p>
            </div>
          )}

          {/* Complexity Metrics */}
          {feedback.efficiency && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-slate-400">Time Complexity</span>
                </div>
                <span className="text-sm font-semibold text-blue-300">
                  {feedback.efficiency.time_complexity || 'N/A'}
                </span>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium text-slate-400">Space Complexity</span>
                </div>
                <span className="text-sm font-semibold text-purple-300">
                  {feedback.efficiency.space_complexity || 'N/A'}
                </span>
              </div>
            </div>
          )}

          {/* Efficiency Comments */}
          {feedback.efficiency?.comments && (
            <div className="bg-slate-900/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <TrendingUp className="w-3 h-3" />
                Complexity Analysis
              </h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                {feedback.efficiency.comments}
              </p>
            </div>
          )}

          {/* Correctness */}
          {feedback.correctness && (
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3" />
                  Correctness
                </h4>
                <span className="text-xs font-semibold text-green-400">
                  {feedback.correctness.score ?? 0}%
                </span>
              </div>
              {feedback.correctness.comments && (
                <p className="text-sm text-slate-400 leading-relaxed">
                  {feedback.correctness.comments}
                </p>
              )}
            </div>
          )}

          {/* Code Quality */}
          {feedback.code_quality && (
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Target className="w-3 h-3" />
                  Code Quality
                </h4>
                <span className="text-xs font-semibold text-blue-400">
                  {feedback.code_quality.score ?? 0}/100
                </span>
              </div>
              {feedback.code_quality.comments && (
                <p className="text-sm text-slate-400 leading-relaxed">
                  {feedback.code_quality.comments}
                </p>
              )}
            </div>
          )}

          {/* Strengths */}
          {feedback.strengths && feedback.strengths.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3" />
                Strengths
              </h4>
              <ul className="space-y-1">
                {feedback.strengths.map((strength, idx) => (
                  <li key={idx} className="text-sm text-green-300/80 flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for Improvement */}
          {feedback.areas_for_improvement && feedback.areas_for_improvement.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                Areas for Improvement
              </h4>
              <ul className="space-y-1">
                {feedback.areas_for_improvement.map((area, idx) => (
                  <li key={idx} className="text-sm text-yellow-300/80 flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvement Suggestions */}
          {feedback.improvement_suggestions && feedback.improvement_suggestions.length > 0 && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-indigo-400 mb-2 flex items-center gap-2">
                <Lightbulb className="w-3 h-3" />
                Improvement Suggestions
              </h4>
              <ul className="space-y-2">
                {feedback.improvement_suggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-sm text-indigo-300/80 flex items-start gap-2">
                    <span className="text-indigo-400 mt-1">→</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {feedback.suggestions && feedback.suggestions.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-2">
                <Lightbulb className="w-3 h-3" />
                Suggestions
              </h4>
              <ul className="space-y-2">
                {feedback.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="text-sm text-blue-300/80 flex items-start gap-2">
                    <span className="text-blue-400 mt-1">→</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Deduction Reasons */}
          {feedback.deduction_reasons && feedback.deduction_reasons.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" />
                Deduction Reasons
              </h4>
              <ul className="space-y-2">
                {feedback.deduction_reasons.map((reason, idx) => (
                  <li key={idx} className="text-sm text-red-300/80 flex items-start gap-2">
                    <span className="text-red-400 mt-1">⚠</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface EditorContainerProps {
  code: string
  language: string
  languages: string[]
  starterCode: Record<string, string>
  onCodeChange: (code: string) => void
  onLanguageChange: (lang: string) => void
  onRun: () => void
  onSubmit: () => void
  onReset: () => void
  running?: boolean
  submitting?: boolean
  output?: {
    stdout?: string
    stderr?: string
    compileOutput?: string
    status?: string
    time?: number
    memory?: number
  }
  submissions?: SubmissionHistoryEntry[]
  visibleTestcases?: VisibleTestcase[]
  // Public test case results from run/submit
  publicResults?: SubmissionTestcaseResult[]
  // Hidden test case summary (only shown after submit)
  hiddenSummary?: { total: number; passed: number } | null
  // Proctoring props
  userId?: string
  assessmentId?: string
  onPasteViolation?: (violation: { eventType: string; timestamp: string; metadata?: any }) => void
}

export function EditorContainer({
  code,
  language,
  languages,
  starterCode,
  onCodeChange,
  onLanguageChange,
  onRun,
  onSubmit,
  onReset,
  running = false,
  submitting = false,
  output,
  submissions = [],
  visibleTestcases = [],
  publicResults = [],
  hiddenSummary = null,
  userId,
  assessmentId,
  onPasteViolation,
}: EditorContainerProps) {
  // Monaco Paste Detector - captures actual pasted content
  const { attachToMonacoEditor } = useMonacoPasteDetector({
    userId: userId || '',
    assessmentId: assessmentId || '',
    onViolation: (violation) => {
      if (onPasteViolation) {
        onPasteViolation(violation);
      }
    },
    enabled: !!userId && !!assessmentId,
    threshold: 20,
  });

  const editorContainerRef = useRef<HTMLDivElement>(null)
  const [editorHeight, setEditorHeight] = useState(600)
  const [activeTab, setActiveTab] = useState('code')
  const previousSubmissionCount = useRef(0)

  // Auto-switch to output tab only for errors
  useEffect(() => {
    if (output && (output.stderr || output.compileOutput)) {
      setActiveTab('output')
    }
  }, [output])

  const [panelHeight, setPanelHeight] = useState(350)
  const panelRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)

  // Debug: Log test cases (only when actually changed to prevent infinite loops)
  const prevTestcasesRef = useRef<string>('')
  const prevResultsRef = useRef<string>('')
  useEffect(() => {
    const testcasesKey = JSON.stringify(visibleTestcases.map(t => ({ id: t.id, input: t.input, expected: t.expected })))
    const resultsKey = JSON.stringify(publicResults.map(r => ({ passed: r.passed, status: r.status })))
    
    // Only log if testcases or results actually changed
    if (testcasesKey !== prevTestcasesRef.current || resultsKey !== prevResultsRef.current) {
      prevTestcasesRef.current = testcasesKey
      prevResultsRef.current = resultsKey
      console.log('[EditorContainer] Test cases received:', {
        visibleTestcasesLength: visibleTestcases.length,
        publicResultsLength: publicResults.length,
        willShowPanel: publicResults.length > 0 || visibleTestcases.length > 0
      })
    }
  }, [visibleTestcases, publicResults])

  useEffect(() => {
    const updateHeight = () => {
      if (editorContainerRef.current) {
        const rect = editorContainerRef.current.getBoundingClientRect()
        const calculatedHeight = rect.height > 0 ? rect.height : 600
        setEditorHeight(calculatedHeight)
      } else {
        // Fallback if ref not ready
        setEditorHeight(600)
      }
    }

    // Initial update
    const timeoutId = setTimeout(updateHeight, 100)
    
    const resizeObserver = new ResizeObserver(() => {
      updateHeight()
    })

    if (editorContainerRef.current) {
      resizeObserver.observe(editorContainerRef.current)
    }

    window.addEventListener('resize', updateHeight)

    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateHeight)
    }
  }, [panelHeight, publicResults.length, visibleTestcases.length])

  useEffect(() => {
    const count = submissions?.length || 0
    if (count > 0 && count !== previousSubmissionCount.current) {
      setActiveTab('submissions')
    }
    previousSubmissionCount.current = count
  }, [submissions])

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
        <TabsList className="border-b border-slate-700 bg-slate-900 rounded-none px-4 flex-shrink-0">
          <TabsTrigger value="code" className="data-[state=active]:bg-slate-800">
            Code
          </TabsTrigger>
          <TabsTrigger value="submissions" className="data-[state=active]:bg-slate-800">
            History
          </TabsTrigger>
          <TabsTrigger value="output" className="data-[state=active]:bg-slate-800">
            Console
          </TabsTrigger>
        </TabsList>

        {/* Tab Content Area - resizable with ExpectedOutputsPanel */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ gap: 0, margin: 0, padding: 0 }}>

          {/* Code Tab */}
          <TabsContent value="code" className="!mt-0 !mb-0 flex-1 flex flex-col overflow-hidden data-[state=active]:flex min-h-0 !p-0" style={{ margin: 0, padding: 0 }}>
            <EditorToolbar
              language={language}
              languages={languages}
              onLanguageChange={onLanguageChange}
              onRun={onRun}
              onSubmit={onSubmit}
              onReset={onReset}
              running={running}
              submitting={submitting}
            />

            {/* Editor - resizable, adjusts height when panel is visible */}
            <div 
              ref={editorContainerRef} 
              className="relative flex-1 min-h-[200px] w-full" 
              style={{ 
                margin: 0,
                padding: 0,
                flexGrow: 1,
                flexShrink: 1,
                flexBasis: 'auto',
                overflow: 'visible',
              }}
            >
              {editorHeight > 0 && (
                <MonacoEditor
                  height={editorHeight}
                  language={MONACO_LANGUAGES[language] || 'python'}
                  value={code || ''}
                  onChange={(value) => onCodeChange(value || '')}
                  onMount={(editor) => {
                    // Attach paste detection to Monaco editor
                    if (userId && assessmentId) {
                      console.log('[EditorContainer] Attaching paste detector to Monaco editor', {
                        userId,
                        assessmentId,
                        hasEditor: !!editor,
                      });
                      attachToMonacoEditor(editor);
                    } else {
                      console.warn('[EditorContainer] Cannot attach paste detector - missing userId or assessmentId', {
                        userId,
                        assessmentId,
                      });
                    }
                  }}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: true },
                    fontSize: 15,
                    wordWrap: 'off', // Disable word wrap - rely on horizontal scrollbar only
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false, // Don't scroll beyond last line
                    readOnly: false,
                    cursorStyle: 'line',
                    automaticLayout: true,
                    tabSize: 2,
                    insertSpaces: true,
                    detectIndentation: true,
                    formatOnPaste: true,
                    formatOnType: true,
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    quickSuggestions: true,
                    bracketPairColorization: { enabled: true },
                    colorDecorators: true,
                    fontFamily: "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
                    fontLigatures: true,
                    scrollbar: {
                      vertical: 'visible',
                      horizontal: 'visible',
                      verticalScrollbarSize: 12,
                      horizontalScrollbarSize: 12,
                      useShadows: false,
                      alwaysConsumeMouseWheel: false, // Allow page scrolling when at editor edges
                    },
                    overviewRulerLanes: 0, // Hide overview ruler
                    hideCursorInOverviewRuler: true,
                  }}
                  loading={
                    <div className="flex items-center justify-center h-full bg-slate-950 text-slate-400">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <p>Loading editor...</p>
                      </div>
                    </div>
                  }
                />
              )}
              {editorHeight === 0 && (
                <div className="flex items-center justify-center h-full bg-slate-950 text-slate-400">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <p>Initializing editor...</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Submissions History Tab */}
          <TabsContent 
            value="submissions" 
            className="!mt-0 flex-1 overflow-y-auto p-4 space-y-4"
            style={{
              maxHeight: (publicResults.length > 0 || visibleTestcases.length > 0)
                ? `calc(100% - ${panelHeight}px - 4px)`
                : '100%'
            }}
          >
          {submissions && submissions.length > 0 ? (
            submissions.map((submission) => (
              <div key={submission.id} className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded uppercase tracking-wide ${
                        submission.status === 'accepted'
                          ? 'bg-green-500/20 text-green-400'
                          : submission.status === 'wrong_answer'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      {submission.status}
                    </span>
                    <span className="text-sm text-slate-400">
                      Passed {submission.passed}/{submission.total} • Score {submission.score}/{submission.max_score}
                    </span>
                  </div>
                  {submission.created_at && (
                    <span className="text-xs text-slate-500">
                      {new Date(submission.created_at).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* AI Feedback Section */}
                {submission.ai_feedback && (
                  <AIFeedbackDisplay feedback={submission.ai_feedback} />
                )}

                <div className="space-y-3">
                  {submission.results?.map((result, index) => (
                    <div key={`${submission.id}-${index}`} className="border border-slate-800 rounded-md p-3 bg-slate-950/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-300">
                          Test Case {index + 1}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            result.passed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {result.passed ? 'Passed' : 'Failed'}
                        </span>
                      </div>
                      <div className="grid gap-2 text-xs text-slate-400">
                        <div>
                          <span className="font-medium text-slate-300">Input:</span>
                          <pre className="mt-1 whitespace-pre-wrap break-words bg-slate-900/70 p-2 rounded">
                            {result.input || '—'}
                          </pre>
                        </div>
                        <div>
                          <span className="font-medium text-slate-300">Expected:</span>
                          <pre className="mt-1 whitespace-pre-wrap break-words bg-slate-900/70 p-2 rounded">
                            {result.expected || '—'}
                          </pre>
                        </div>
                        <div>
                          <span className="font-medium text-slate-300">Actual:</span>
                          <pre className="mt-1 whitespace-pre-wrap break-words bg-slate-900/70 p-2 rounded">
                            {result.output || '—'}
                          </pre>
                        </div>
                        {result.status && (
                          <div>
                            <span className="font-medium text-slate-300">Judge Status:</span>
                            <p className="mt-1 text-slate-400">{result.status}</p>
                          </div>
                        )}
                        {result.output && (
                          <div>
                            <span className="font-medium text-blue-400">Output:</span>
                            <pre className="mt-1 whitespace-pre-wrap break-words bg-slate-900/70 p-2 rounded text-blue-300">
                              {result.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
          <div className="text-center text-slate-400 py-8">
            <p>No submissions yet.</p>
              <p className="text-sm mt-2">Submit your code to see detailed results.</p>
          </div>
          )}
          </TabsContent>

          {/* Output Tab */}
          <TabsContent 
            value="output" 
            className="!mt-0 flex-1 overflow-hidden"
            style={{
              maxHeight: (publicResults.length > 0 || visibleTestcases.length > 0)
                ? `calc(100% - ${panelHeight}px - 4px)`
                : '100%'
            }}
          >
          {output && (
            <OutputConsole
              stdout={output.stdout}
              stderr={output.stderr}
              compileOutput={output.compileOutput}
              status={output.status}
              time={output.time}
              memory={output.memory}
            />
          )}
          {!output && (
            <div className="h-full flex items-center justify-center text-slate-400">
              <p>No output yet. Run your code to see results.</p>
            </div>
          )}
          </TabsContent>

          {/* Resizable divider - Always visible when there are test cases or results */}
          {(publicResults.length > 0 || visibleTestcases.length > 0) && (
            <>
              <div 
                className="border-t border-slate-700 bg-slate-800 hover:bg-slate-700 transition-colors cursor-row-resize flex-shrink-0 flex items-center justify-center group"
                style={{ height: '4px', minHeight: '4px', maxHeight: '4px', margin: 0, padding: 0 }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  isResizingRef.current = true
                  const container = e.currentTarget.parentElement
                  if (!container) return
                  
                  const startY = e.clientY
                  const startPanelHeight = panelHeight
                  const containerHeight = container.offsetHeight
                  
                  const handleMouseMove = (e: MouseEvent) => {
                    if (!isResizingRef.current) return
                    const deltaY = startY - e.clientY // Inverted because we're dragging up
                    const newPanelHeight = Math.max(200, Math.min(containerHeight - 200, startPanelHeight + deltaY))
                    setPanelHeight(newPanelHeight)
                  }
                  
                  const handleMouseUp = () => {
                    isResizingRef.current = false
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                    document.body.style.cursor = ''
                    document.body.style.userSelect = ''
                  }
                  
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                  document.body.style.cursor = 'row-resize'
                  document.body.style.userSelect = 'none'
                }}
              >
                <div className="w-12 h-1 bg-slate-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* ExpectedOutputsPanel - Always visible at bottom, persists across tab switches */}
              <div 
                ref={panelRef}
                className="flex-shrink-0 overflow-hidden" 
                style={{ 
                  height: `${panelHeight}px`,
                  minHeight: '200px', 
                  maxHeight: '50%',
                  margin: 0,
                  padding: 0
                }}
              >
                <ExpectedOutputsPanel
                  testcases={visibleTestcases}
                  results={publicResults}
                  isLoading={running || submitting}
                  hiddenSummary={hiddenSummary}
                />
              </div>
            </>
          )}
        </div>
      </Tabs>
    </div>
  )
}

