'use client'

import { useState } from 'react'
import { MarkdownViewer } from './MarkdownViewer'
import { Database, Table2 } from 'lucide-react'
interface Example {
  input: string
  output: string
  explanation?: string | null
}

interface Question {
  id: string
  title: string
  description: string
  examples?: Example[]
  constraints?: string[]
  difficulty: string
  public_testcases?: Array<{ input: string; expected_output: string }>
  hidden_testcases?: Array<{ input: string; expected_output: string }>
  // Optional for SQL questions
  question_type?: string
  schemas?: Record<string, { columns: Record<string, string> }>
  sample_data?: Record<string, any[][]>
}

interface QuestionTabsProps {
  question: Question
}

export function QuestionTabs({ question }: QuestionTabsProps) {
  const [view, setView] = useState<'description' | 'schema'>('description')

  // Use examples from question if available, otherwise fall back to public_testcases
  const examples = question.examples && question.examples.length > 0 
    ? question.examples 
    : question.public_testcases?.map((tc) => ({
        input: tc.input,
        output: tc.expected_output,
        explanation: null
      })) || []

  // Use constraints from question if available
  const constraints = question.constraints && question.constraints.length > 0
    ? question.constraints
    : []

  const isSQL = (question.question_type || '').toUpperCase() === 'SQL'
  const hasSchemas = isSQL && question.schemas && Object.keys(question.schemas).length > 0

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Header with toggle */}
      <div className="border-b border-slate-700 bg-slate-900 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-medium text-cyan-400">
          {view === 'description' || !hasSchemas ? 'Description' : 'Schema'}
        </span>
        {hasSchemas && (
          <button
            type="button"
            onClick={() => setView((prev) => (prev === 'description' ? 'schema' : 'description'))}
            className="text-xs px-3 py-1 rounded border border-slate-600 text-slate-200 hover:bg-slate-800 transition-colors"
          >
            {view === 'description' ? 'Show Schema' : 'Show Description'}
          </button>
        )}
      </div>

      {/* Content - All in one scrollable view */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Title */}
        <h2 className="text-2xl font-bold text-white">{question.title}</h2>

        {/* Main body: either description or schema */}
        {view === 'schema' && hasSchemas ? (
          <div className="space-y-4">
            {Object.entries(question.schemas || {}).map(([tableName, schema]) => {
              const rows = question.sample_data?.[tableName] || []
              const columns = Object.keys(schema.columns || {})

              return (
                <div key={tableName} className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-800 px-3 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Table2 className="w-4 h-4 text-blue-400" />
                      <span className="font-mono font-medium text-blue-400">{tableName}</span>
                    </div>
                    {rows.length > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {rows.length} sample row{rows.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="bg-slate-900/50 p-3 space-y-3">
                    {/* Schema */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-slate-400 text-xs uppercase">
                            <th className="text-left py-1 px-2">Column</th>
                            <th className="text-left py-1 px-2">Type</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono text-xs">
                          {Object.entries(schema.columns || {}).map(([colName, colType]) => (
                            <tr key={colName} className="border-t border-slate-800">
                              <td className="py-1.5 px-2 text-green-400">{colName}</td>
                              <td className="py-1.5 px-2 text-yellow-400">{String(colType)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Sample Data */}
                    {rows.length > 0 && (
                      <div className="overflow-x-auto">
                        <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                          <Database className="w-3 h-3 text-purple-400" />
                          <span>Sample data</span>
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400">
                              {columns.map((col) => (
                                <th key={col} className="text-left py-1 px-2">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="font-mono">
                            {rows.slice(0, 5).map((row, rowIdx) => (
                              <tr key={rowIdx} className="border-t border-slate-800">
                                {row.map((cell, cellIdx) => (
                                  <td key={cellIdx} className="py-1 px-2 text-slate-200">
                                    {cell === null ? (
                                      <span className="italic text-slate-500">NULL</span>
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
                          <div className="text-[10px] text-slate-500 mt-1">
                            ... and {rows.length - 5} more row{rows.length - 5 !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-slate-300">
            <MarkdownViewer content={question.description} />
          </div>
        )}

        {/* Examples Section - only in Description view */}
        {view === 'description' && examples.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Examples:</h3>
            {examples.map((example, idx) => (
              <div key={idx} className="space-y-2 pl-4 border-l-2 border-slate-700">
                <div className="text-sm font-medium text-slate-400">Example {idx + 1}:</div>
                
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-400">Input: </span>
                    <code className="text-slate-200 font-mono">{example.input}</code>
                  </div>
                  <div>
                    <span className="text-slate-400">Output: </span>
                    <code className="text-slate-200 font-mono">{example.output}</code>
                  </div>
                  {example.explanation && (
                    <div>
                      <span className="text-slate-400">Explanation: </span>
                      <span className="text-slate-300">{example.explanation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Constraints Section - only in Description view */}
        {view === 'description' && constraints.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Constraints:</h3>
            <ul className="space-y-2 pl-4">
              {constraints.map((constraint, idx) => (
                <li key={idx} className="text-slate-300">
                  <code className="font-mono text-sm">{constraint}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
