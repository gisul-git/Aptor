'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Clock, Cpu, AlertTriangle, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export interface PublicTestResult {
  id: string
  test_number: number
  input: string
  expected_output: string
  user_output: string
  status: string
  status_id: number
  time: number | null
  memory: number | null
  passed: boolean
  stderr?: string
  compile_output?: string
}

export interface HiddenTestResult {
  id: string
  test_number: number
  passed: boolean
  status: string
  // NO input, expected_output, user_output, stderr, compile_output
}

export interface HiddenSummary {
  total: number
  passed: number
}

export interface SubmissionResult {
  submission_id?: string
  question_id: string
  public_results: PublicTestResult[]
  hidden_results: HiddenTestResult[]
  hidden_summary: HiddenSummary
  total_passed: number
  total_tests: number
  score: number
  max_score: number
  status: string
  compilation_error: boolean
}

export interface RunCodeResult {
  question_id: string
  public_results: PublicTestResult[]
  public_summary: {
    total: number
    passed: number
  }
  status: string
  compilation_error: boolean
}

// ============================================================================
// Helper Components
// ============================================================================

function StatusBadge({ status, passed }: { status: string; passed: boolean }) {
  const getStatusColor = () => {
    if (passed) return 'bg-green-500/20 text-green-400 border-green-500/30'
    switch (status.toLowerCase()) {
      case 'accepted':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'wrong_answer':
      case 'wrong answer':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'time_limit_exceeded':
      case 'time limit exceeded':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'compilation_error':
      case 'compilation error':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'runtime error':
      case 'runtime_error':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor()}`}>
      {passed ? 'Passed' : status}
    </span>
  )
}

function MetricBadge({ icon: Icon, label, value, unit }: { 
  icon: any; 
  label: string; 
  value: string | number | null; 
  unit?: string 
}) {
  if (value === null || value === undefined) return null
  
  return (
    <div className="flex items-center gap-1 text-xs text-slate-400">
      <Icon className="w-3 h-3" />
      <span>{label}:</span>
      <span className="text-slate-300">{value}{unit}</span>
    </div>
  )
}

// ============================================================================
// Public Test Case Card (Full Details)
// ============================================================================

function PublicTestCard({ result, index }: { result: PublicTestResult; index: number }) {
  const [isExpanded, setIsExpanded] = useState(!result.passed) // Auto-expand failed tests

  return (
    <div className={`border rounded-lg overflow-hidden ${
      result.passed 
        ? 'border-green-500/30 bg-green-500/5' 
        : 'border-red-500/30 bg-red-500/5'
    }`}>
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {result.passed ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
          <span className="font-medium text-slate-200">
            Test Case {result.test_number}
          </span>
          <StatusBadge status={result.status} passed={result.passed} />
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {result.time !== null && (
              <MetricBadge icon={Clock} label="Time" value={`${(result.time * 1000).toFixed(0)}`} unit="ms" />
            )}
            {result.memory !== null && (
              <MetricBadge icon={Cpu} label="Memory" value={`${Math.round(result.memory / 1024)}`} unit="KB" />
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            {/* Input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Input</label>
              <pre className="bg-slate-900/80 rounded p-2 text-sm text-slate-300 font-mono overflow-x-auto max-h-32 overflow-y-auto">
                {result.input || '(empty)'}
              </pre>
            </div>

            {/* Expected Output */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Expected Output</label>
              <pre className="bg-slate-900/80 rounded p-2 text-sm text-green-300 font-mono overflow-x-auto max-h-32 overflow-y-auto">
                {result.expected_output || '(empty)'}
              </pre>
            </div>
          </div>

          {/* Your Output */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Your Output</label>
            <pre className={`bg-slate-900/80 rounded p-2 text-sm font-mono overflow-x-auto max-h-32 overflow-y-auto ${
              result.passed ? 'text-green-300' : 'text-red-300'
            }`}>
              {result.user_output || '(no output)'}
            </pre>
          </div>

          {/* Stderr (if any) */}
          {result.stderr && (
            <div>
              <label className="block text-xs font-medium text-red-400 mb-1">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Error Output
              </label>
              <pre className="bg-red-900/20 rounded p-2 text-sm text-red-300 font-mono overflow-x-auto max-h-32 overflow-y-auto">
                {result.stderr}
              </pre>
            </div>
          )}

          {/* Compile Output (if any) */}
          {result.compile_output && (
            <div>
              <label className="block text-xs font-medium text-orange-400 mb-1">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Compilation Error
              </label>
              <pre className="bg-orange-900/20 rounded p-2 text-sm text-orange-300 font-mono overflow-x-auto max-h-32 overflow-y-auto">
                {result.compile_output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Hidden Test Case Row (Limited Info - Pass/Fail Only)
// ============================================================================

function HiddenTestRow({ result }: { result: HiddenTestResult }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2 rounded-lg ${
      result.passed 
        ? 'bg-green-500/10 border border-green-500/20' 
        : 'bg-red-500/10 border border-red-500/20'
    }`}>
      <div className="flex items-center gap-3">
        {result.passed ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
        <span className="text-sm text-slate-300">
          Hidden Test #{result.test_number}
        </span>
        <EyeOff className="w-3 h-3 text-slate-500" />
      </div>
      <span className={`text-sm font-medium ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
        {result.passed ? 'Passed' : 'Failed'}
      </span>
    </div>
  )
}

// ============================================================================
// Hidden Tests Summary Card
// ============================================================================

function HiddenTestsSummary({ 
  hiddenResults, 
  hiddenSummary 
}: { 
  hiddenResults: HiddenTestResult[]
  hiddenSummary: HiddenSummary 
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const allPassed = hiddenSummary.passed === hiddenSummary.total

  if (hiddenSummary.total === 0) return null

  return (
    <div className={`border rounded-lg overflow-hidden ${
      allPassed 
        ? 'border-green-500/30 bg-green-500/5' 
        : 'border-yellow-500/30 bg-yellow-500/5'
    }`}>
      {/* Summary Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <EyeOff className="w-5 h-5 text-slate-400" />
          <span className="font-medium text-slate-200">
            Hidden Test Cases
          </span>
          <span className={`px-2 py-1 text-xs font-bold rounded ${
            allPassed 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {hiddenSummary.passed}/{hiddenSummary.total} Passed
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            (Details hidden)
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Individual Hidden Test Results */}
      {isExpanded && hiddenResults.length > 0 && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-700/50 pt-3">
          {hiddenResults.map((result, index) => (
            <HiddenTestRow key={result.id || index} result={result} />
          ))}
          
          {/* Info message */}
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700/30">
            <EyeOff className="w-3 h-3" />
            <span>Input, expected output, and your output are hidden for these test cases.</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Overall Summary Banner
// ============================================================================

function OverallSummary({ 
  totalPassed, 
  totalTests, 
  score, 
  maxScore, 
  status,
  compilationError
}: { 
  totalPassed: number
  totalTests: number
  score: number
  maxScore: number
  status: string
  compilationError: boolean
}) {
  const getStatusStyle = () => {
    if (compilationError) return 'bg-orange-500/20 border-orange-500/50 text-orange-300'
    if (status === 'accepted') return 'bg-green-500/20 border-green-500/50 text-green-300'
    if (status === 'partially_accepted') return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
    return 'bg-red-500/20 border-red-500/50 text-red-300'
  }

  const getStatusText = () => {
    if (compilationError) return 'Compilation Error'
    if (status === 'accepted') return 'All Tests Passed!'
    if (status === 'partially_accepted') return 'Partially Accepted'
    return 'Tests Failed'
  }

  const getStatusIcon = () => {
    if (compilationError) return <AlertTriangle className="w-6 h-6" />
    if (status === 'accepted') return <CheckCircle className="w-6 h-6" />
    return <XCircle className="w-6 h-6" />
  }

  return (
    <div className={`rounded-lg border p-4 ${getStatusStyle()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-bold text-lg">{getStatusText()}</h3>
            <p className="text-sm opacity-80">
              {totalPassed}/{totalTests} test cases passed
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold">{score}/{maxScore}</div>
          <div className="text-xs opacity-70">Score</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main TestResults Component
// ============================================================================

interface TestResultsProps {
  result: SubmissionResult | RunCodeResult | null
  isRunMode?: boolean // true for "Run Code", false for "Submit"
}

export function TestResults({ result, isRunMode = false }: TestResultsProps) {
  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 p-8">
        <div className="text-center">
          <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Run or submit your code to see results.</p>
        </div>
      </div>
    )
  }

  // Handle Run Code result (public tests only)
  if (isRunMode || !('hidden_results' in result)) {
    const runResult = result as RunCodeResult
    return (
      <div className="p-4 space-y-4 overflow-y-auto max-h-full">
        {/* Summary for Run */}
        <div className={`rounded-lg border p-3 ${
          runResult.public_summary.passed === runResult.public_summary.total
            ? 'bg-green-500/20 border-green-500/50 text-green-300'
            : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
        }`}>
          <div className="flex items-center gap-2">
            {runResult.public_summary.passed === runResult.public_summary.total ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="font-medium">
              {runResult.public_summary.passed}/{runResult.public_summary.total} Public Tests Passed
            </span>
          </div>
        </div>

        {/* Public Test Results */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Public Test Cases
          </h3>
          {runResult.public_results.map((publicResult, index) => (
            <PublicTestCard key={publicResult.id || index} result={publicResult} index={index} />
          ))}
        </div>
      </div>
    )
  }

  // Handle Submit result (public + hidden tests)
  const submitResult = result as SubmissionResult
  
  return (
    <div className="p-4 space-y-4 overflow-y-auto max-h-full">
      {/* Overall Summary */}
      <OverallSummary
        totalPassed={submitResult.total_passed}
        totalTests={submitResult.total_tests}
        score={submitResult.score}
        maxScore={submitResult.max_score}
        status={submitResult.status}
        compilationError={submitResult.compilation_error}
      />

      {/* Public Test Results */}
      {submitResult.public_results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Public Test Cases ({submitResult.public_results.filter(r => r.passed).length}/{submitResult.public_results.length})
          </h3>
          {submitResult.public_results.map((publicResult, index) => (
            <PublicTestCard key={publicResult.id || index} result={publicResult} index={index} />
          ))}
        </div>
      )}

      {/* Hidden Test Results */}
      {submitResult.hidden_summary.total > 0 && (
        <div className="space-y-3">
          <HiddenTestsSummary 
            hiddenResults={submitResult.hidden_results}
            hiddenSummary={submitResult.hidden_summary}
          />
        </div>
      )}
    </div>
  )
}

export default TestResults


