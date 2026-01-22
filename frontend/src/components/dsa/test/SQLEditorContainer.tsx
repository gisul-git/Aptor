'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { EditorToolbar } from './EditorToolbar'
import { OutputConsole } from './OutputConsole'
import { Database, Table2, Play, Send, RotateCcw } from 'lucide-react'

// Lazy load Monaco Editor
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-slate-950 text-slate-400">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
        <p className="text-sm">Loading SQL editor...</p>
      </div>
    </div>
  )
})

// Types for SQL question data
interface TableSchema {
  columns: Record<string, string>  // column_name: data_type
}

interface SQLQuestion {
  id: string
  title: string
  description: string
  difficulty: string
  question_type: 'SQL'
  sql_category?: string
  schemas?: Record<string, TableSchema>
  sample_data?: Record<string, any[][]>
  constraints?: string[]
  starter_query?: string
  hints?: string[]
}

export interface SQLSubmissionResult {
  passed: boolean
  status?: string
  output?: string
  error?: string
  expected_columns?: string[]
  actual_columns?: string[]
  row_count?: number
  expected_row_count?: number
}

export interface SQLSubmissionHistoryEntry {
  id: string
  status: string
  passed: boolean
  created_at?: string
  result?: SQLSubmissionResult
}

interface SQLEditorContainerProps {
  code: string
  question: SQLQuestion
  onCodeChange: (code: string) => void
  onRun: () => void
  onSubmit: () => void
  onReset: () => void
  running?: boolean
  submitting?: boolean
  output?: {
    stdout?: string
    stderr?: string
    status?: string
    error?: string
  }
  submissions?: SQLSubmissionHistoryEntry[]
}

// Schema Display Component
function SchemaDisplay({ schemas }: { schemas: Record<string, TableSchema> }) {
  if (!schemas || Object.keys(schemas).length === 0) {
    return (
      <div className="text-slate-500 italic text-sm">
        No table schemas provided
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(schemas).map(([tableName, schema]) => (
        <div key={tableName} className="border border-slate-700 rounded-lg overflow-hidden">
          <div className="bg-slate-800 px-3 py-2 flex items-center gap-2">
            <Table2 className="w-4 h-4 text-blue-400" />
            <span className="font-mono font-medium text-blue-400">{tableName}</span>
          </div>
          <div className="bg-slate-900/50 p-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase">
                  <th className="text-left py-1 px-2">Column</th>
                  <th className="text-left py-1 px-2">Type</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {Object.entries(schema.columns || {}).map(([colName, colType]) => (
                  <tr key={colName} className="border-t border-slate-800">
                    <td className="py-1.5 px-2 text-green-400">{colName}</td>
                    <td className="py-1.5 px-2 text-yellow-400">{String(colType)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// Sample Data Display Component
function SampleDataDisplay({ 
  sampleData, 
  schemas 
}: { 
  sampleData: Record<string, any[][]>
  schemas?: Record<string, TableSchema>
}) {
  if (!sampleData || Object.keys(sampleData).length === 0) {
    return (
      <div className="text-slate-500 italic text-sm">
        No sample data provided
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(sampleData).map(([tableName, rows]) => {
        const schema = schemas?.[tableName]
        const columns = schema ? Object.keys(schema.columns || {}) : []
        
        return (
          <div key={tableName} className="border border-slate-700 rounded-lg overflow-hidden">
            <div className="bg-slate-800 px-3 py-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span className="font-mono font-medium text-purple-400">{tableName}</span>
              <span className="text-xs text-slate-500">({rows.length} rows)</span>
            </div>
            <div className="bg-slate-900/50 p-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs">
                    {columns.map((col) => (
                      <th key={col} className="text-left py-1 px-2">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  {rows.slice(0, 5).map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-t border-slate-800">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="py-1.5 px-2 text-slate-300">
                          {cell === null ? (
                            <span className="text-slate-500 italic">NULL</span>
                          ) : (
                            String(cell)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 5 && (
                <div className="text-xs text-slate-500 mt-2 text-center">
                  ... and {rows.length - 5} more rows
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SQLEditorContainer({
  code,
  question,
  onCodeChange,
  onRun,
  onSubmit,
  onReset,
  running = false,
  submitting = false,
  output,
  submissions = [],
}: SQLEditorContainerProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const [editorHeight, setEditorHeight] = useState(400)
  const [activeTab, setActiveTab] = useState('code')

  useEffect(() => {
    const updateHeight = () => {
      if (editorContainerRef.current) {
        const rect = editorContainerRef.current.getBoundingClientRect()
        const calculatedHeight = rect.height > 0 ? rect.height : 400
        setEditorHeight(calculatedHeight)
      }
    }

    const timeoutId = setTimeout(updateHeight, 100)
    const resizeObserver = new ResizeObserver(updateHeight)

    if (editorContainerRef.current) {
      resizeObserver.observe(editorContainerRef.current)
    }

    window.addEventListener('resize', updateHeight)

    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateHeight)
    }
  }, [])

  // Auto-switch to output tab when there's any output (stdout, stderr, or error)
  useEffect(() => {
    if (output && (output.stdout || output.stderr || output.error)) {
      setActiveTab('output')
    }
  }, [output])

  const hasSchemas = question.schemas && Object.keys(question.schemas).length > 0
  const hasSampleData = question.sample_data && Object.keys(question.sample_data).length > 0

  return (
    <div className="h-full flex bg-slate-950 overflow-hidden">
      {/* Left Panel - Schema & Sample Data */}
      {(hasSchemas || hasSampleData) && (
        <div className="w-80 border-r border-slate-700 flex flex-col bg-slate-900/50">
          {/* Sidebar Content - Schema and Data stacked vertically */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Schema Section */}
            {hasSchemas && question.schemas && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-2">
                  <Table2 className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-blue-400">Schema</h3>
                </div>
                <SchemaDisplay schemas={question.schemas} />
              </div>
            )}
            
            {/* Data Section */}
            {hasSampleData && question.sample_data && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-purple-400">Data</h3>
                </div>
                <SampleDataDisplay 
                  sampleData={question.sample_data} 
                  schemas={question.schemas}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Panel - Editor & Output */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
          <TabsList className="border-b border-slate-700 bg-slate-900 rounded-none px-4 flex-shrink-0">
            <TabsTrigger value="code" className="data-[state=active]:bg-slate-800">
              SQL Query
            </TabsTrigger>
            <TabsTrigger value="submissions" className="data-[state=active]:bg-slate-800">
              History
            </TabsTrigger>
            <TabsTrigger value="output" className="data-[state=active]:bg-slate-800">
              Results
            </TabsTrigger>
          </TabsList>

          {/* Code Tab */}
          <TabsContent value="code" className="!mt-0 !mb-0 flex-1 flex flex-col overflow-hidden data-[state=active]:flex min-h-0 !p-0">
            {/* SQL Toolbar - Simplified without language selector */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-slate-300">SQL Query</span>
                {question.sql_category && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded capitalize">
                    {question.sql_category}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onReset}
                  disabled={running || submitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors disabled:opacity-50"
                  title="Reset to starter query"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={onRun}
                  disabled={running || submitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {running ? 'Running...' : 'Run'}
                </button>
                <button
                  onClick={onSubmit}
                  disabled={running || submitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>

            {/* SQL Editor */}
            <div 
              ref={editorContainerRef} 
              className="relative flex-1 min-h-[200px] w-full"
            >
              {editorHeight > 0 && (
                <MonacoEditor
                  height={editorHeight}
                  language="sql"
                  value={code || '-- Write your SQL query here\n\nSELECT '}
                  onChange={(value) => onCodeChange(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 15,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    readOnly: false,
                    cursorStyle: 'line',
                    automaticLayout: true,
                    tabSize: 2,
                    insertSpaces: true,
                    suggestOnTriggerCharacters: true,
                    quickSuggestions: true,
                    fontFamily: "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
                    fontLigatures: true,
                    scrollbar: {
                      vertical: 'visible',
                      horizontal: 'visible',
                      verticalScrollbarSize: 10,
                      horizontalScrollbarSize: 10,
                    },
                  }}
                  loading={
                    <div className="flex items-center justify-center h-full bg-slate-950 text-slate-400">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <p>Loading SQL editor...</p>
                      </div>
                    </div>
                  }
                />
              )}
            </div>
          </TabsContent>

          {/* Submissions History Tab */}
          <TabsContent value="submissions" className="!mt-0 flex-1 overflow-y-auto p-4 space-y-4">
            {submissions && submissions.length > 0 ? (
              submissions.map((submission) => (
                <div key={submission.id} className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded uppercase tracking-wide ${
                        submission.passed
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {submission.passed ? 'Passed' : 'Failed'}
                    </span>
                    {submission.created_at && (
                      <span className="text-xs text-slate-500">
                        {new Date(submission.created_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {submission.result && (
                    <div className="text-sm text-slate-400">
                      {submission.result.error && (
                        <pre className="text-red-400 whitespace-pre-wrap">{submission.result.error}</pre>
                      )}
                      {submission.result.output && (
                        <pre className="whitespace-pre-wrap">{submission.result.output}</pre>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 py-8">
                <p>No submissions yet.</p>
                <p className="text-sm mt-2">Submit your SQL query to see results.</p>
              </div>
            )}
          </TabsContent>

          {/* Output Tab */}
          <TabsContent value="output" className="!mt-0 flex-1 overflow-hidden">
            {output && (output.stdout || output.stderr || output.error) ? (
              <OutputConsole
                stdout={output.stdout}
                stderr={output.stderr || output.error}
                status={output.status}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Database className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p>No output yet.</p>
                  <p className="text-sm mt-1">Run your SQL query to see results.</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

