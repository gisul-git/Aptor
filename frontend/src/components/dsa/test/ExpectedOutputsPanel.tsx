'use client'

import type { SubmissionTestcaseResult } from './EditorContainer'

interface VisibleTestcase {
  id: string
  input: string
  expected: string
}

interface ExpectedOutputsPanelProps {
  testcases: VisibleTestcase[]
  results?: SubmissionTestcaseResult[]
  isLoading?: boolean
  hiddenSummary?: { total: number; passed: number } | null
}

const statusStyles = {
  pending: 'border-slate-700 bg-slate-900/50',
  running: 'border-blue-500/40 bg-blue-500/10 animate-pulse',
  passed: 'border-emerald-500/50 bg-emerald-500/10',
  failed: 'border-red-500/50 bg-red-500/10',
  error: 'border-amber-500/50 bg-amber-500/10',
}

const statusLabels: Record<string, { text: string; color: string; icon: string }> = {
  pending: { text: 'Pending', color: 'text-slate-400', icon: '○' },
  running: { text: 'Running...', color: 'text-blue-400', icon: '◌' },
  passed: { text: 'Passed', color: 'text-emerald-400', icon: '✓' },
  failed: { text: 'Wrong Answer', color: 'text-red-400', icon: '✗' },
  tle: { text: 'Time Limit Exceeded', color: 'text-amber-400', icon: '⏱' },
  mle: { text: 'Memory Limit Exceeded', color: 'text-amber-400', icon: '⚡' },
  rte: { text: 'Runtime Error', color: 'text-orange-400', icon: '!' },
  ce: { text: 'Compilation Error', color: 'text-red-400', icon: '⚠' },
}

function getStatusKey(result?: SubmissionTestcaseResult): string {
  if (!result) return 'pending'
  
  const status = result.status?.toLowerCase() || ''
  
  if (result.passed) return 'passed'
  if (status.includes('time limit')) return 'tle'
  if (status.includes('memory limit')) return 'mle'
  if (status.includes('runtime') || status.includes('error') && !status.includes('compilation')) return 'rte'
  if (status.includes('compilation')) return 'ce'
  
  return 'failed'
}

export function ExpectedOutputsPanel({ testcases, results = [], isLoading = false, hiddenSummary = null }: ExpectedOutputsPanelProps) {
  if (!testcases || testcases.length === 0) {
    return null
  }

  const visibleResults = results.filter((result) => result.visible !== false)
  
  // Calculate summary
  const hasResults = visibleResults.length > 0
  const passedCount = visibleResults.filter(r => r.passed).length
  const totalCount = testcases.length
  
  // Calculate overall status including hidden tests
  const totalPassed = passedCount + (hiddenSummary?.passed || 0)
  const totalTests = totalCount + (hiddenSummary?.total || 0)
  const allPassed = hasResults && totalPassed === totalTests

  return (
    <div className="bg-slate-900/60 flex flex-col h-full overflow-hidden" style={{ margin: 0, padding: 0 }}>
      {/* Header with summary - fixed */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-sm font-medium text-slate-200">Test Cases</p>
          <p className="text-xs text-slate-400">
            {hasResults 
              ? (
                <span>
                  <span className="text-emerald-400 font-semibold">{passedCount}</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-slate-300">{totalCount}</span>
                  <span className="text-slate-500"> visible passed</span>
                  {hiddenSummary && hiddenSummary.total > 0 && (
                    <span className="text-slate-500">
                      {' • '}
                      <span className="text-emerald-400 font-semibold">{hiddenSummary.passed}</span>
                      <span className="text-slate-500">/</span>
                      <span className="text-slate-300">{hiddenSummary.total}</span>
                      <span className="text-slate-500"> hidden</span>
                    </span>
                  )}
                </span>
              )
              : 'Run your code to see results'
            }
          </p>
        </div>
        {hasResults && (
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            allPassed
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {allPassed ? '✓ All Passed' : `✗ ${totalTests - totalPassed} Failed`}
          </div>
        )}
      </div>
      
      {/* Test case cards - scrollable */}
      <div className="px-4 py-3 space-y-3 overflow-y-auto flex-1 min-h-0">
        {testcases.map((tc, index) => {
          const result = visibleResults[index]
          const statusKey = isLoading && !result ? 'running' : getStatusKey(result)
          const statusInfo = statusLabels[statusKey] || statusLabels.pending
          const styleKey = statusKey === 'tle' || statusKey === 'mle' || statusKey === 'rte' || statusKey === 'ce' 
            ? 'error' 
            : statusKey === 'running' ? 'running' : statusKey

          return (
            <div
              key={tc.id}
              className={`rounded-lg border px-4 py-3 transition-all duration-200 ${statusStyles[styleKey as keyof typeof statusStyles]}`}
            >
              {/* Test case header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Test Case {index + 1}
                  </span>
                  {result?.passed && (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ✓ PASSED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {result?.time && (
                    <span className="text-xs text-slate-400">{result.time}s</span>
                  )}
                  {result?.memory && (
                    <span className="text-xs text-slate-400">{result.memory} KB</span>
                  )}
                  <span className={`flex items-center gap-1 text-xs font-medium ${statusInfo.color}`}>
                    <span>{statusInfo.icon}</span>
                    {statusInfo.text}
                  </span>
                </div>
              </div>

              {/* Input section */}
              <div className="mb-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Input</p>
                <pre className="bg-slate-950/50 rounded px-3 py-2 whitespace-pre-wrap break-words text-sm text-slate-300 font-mono border border-slate-800">
                  {tc.input || '(empty)'}
                </pre>
              </div>

              {/* Expected output section */}
              <div className="mb-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Expected Output</p>
                <pre className="bg-slate-950/50 rounded px-3 py-2 whitespace-pre-wrap break-words text-sm text-slate-300 font-mono border border-slate-800">
                  {tc.expected || '(empty)'}
                </pre>
              </div>

              {/* Actual output section - only shown when result exists */}
              {result && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Your Output</p>
                  <pre className={`rounded px-3 py-2 whitespace-pre-wrap break-words text-sm font-mono border ${
                    result.passed 
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                      : 'bg-red-950/30 border-red-800/50 text-red-300'
                  }`}>
                    {(result.stdout || result.output) 
                      ? (result.stdout || result.output) 
                      : result.passed 
                        ? tc.expected || '(empty - matches expected)'
                        : '(no output)'}
                  </pre>
                </div>
              )}

              {/* Error messages */}
              {result?.stderr && (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-400 mb-1">Stderr</p>
                  <pre className="bg-amber-950/30 rounded px-3 py-2 whitespace-pre-wrap break-words text-xs text-amber-300 font-mono border border-amber-800/50">
                    {result.stderr}
                  </pre>
                </div>
              )}

              {result?.compile_output && (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-red-400 mb-1">Compilation Error</p>
                  <pre className="bg-red-950/30 rounded px-3 py-2 whitespace-pre-wrap break-words text-xs text-red-300 font-mono border border-red-800/50">
                    {result.compile_output}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
        
        {/* Hidden Test Summary - only shown after submit */}
        {hiddenSummary && hiddenSummary.total > 0 && (
          <div className={`rounded-lg border px-4 py-4 ${
            hiddenSummary.passed === hiddenSummary.total
              ? 'border-emerald-500/50 bg-emerald-500/10'
              : 'border-amber-500/50 bg-amber-500/10'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  hiddenSummary.passed === hiddenSummary.total
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  <span className="text-lg">🔒</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Hidden Test Cases</p>
                  <p className="text-xs text-slate-400">
                    {hiddenSummary.passed}/{hiddenSummary.total} passed
                  </p>
                </div>
              </div>
              <div className={`text-2xl font-bold ${
                hiddenSummary.passed === hiddenSummary.total
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}>
                {Math.round((hiddenSummary.passed / hiddenSummary.total) * 100)}%
              </div>
            </div>
            
            {/* Individual hidden test indicators */}
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: hiddenSummary.total }).map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${
                    i < hiddenSummary.passed
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                      : 'bg-red-500/30 text-red-300 border border-red-500/50'
                  }`}
                  title={i < hiddenSummary.passed ? 'Passed' : 'Failed'}
                >
                  {i < hiddenSummary.passed ? '✓' : '✗'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

