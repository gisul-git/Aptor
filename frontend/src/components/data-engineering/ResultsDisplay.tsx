'use client'

import React, { useState } from 'react'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MemoryStick, 
  AlertTriangle, 
  TrendingUp,
  Code,
  Lightbulb,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

interface ExecutionResult {
  job_id: string
  status: string
  output?: any
  error_message?: string
  execution_time?: number
  memory_usage?: number
  validation_result?: ValidationResult
  ai_review?: CodeReview
}

interface ValidationResult {
  is_correct: boolean
  similarity_score: number
  schema_match: boolean
  row_count_match: boolean
  data_match: boolean
  error_details?: Array<{ type: string; message: string }>
  sample_differences?: Array<{ row_index: number; expected: any; actual: any }>
}

interface CodeReview {
  overall_score: number
  correctness_feedback: string
  performance_feedback: string
  best_practices_feedback: string
  improvement_suggestions: string[]
}

interface ResultsDisplayProps {
  result: ExecutionResult
  className?: string
}

// Helper functions
const formatDuration = (ms?: number) => {
  if (!ms) return 'N/A'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const formatMemory = (bytes?: number) => {
  if (!bytes) return 'N/A'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

const formatPercentage = (value?: number) => {
  if (value === undefined || value === null) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

export default function ResultsDisplay({ result, className = '' }: ResultsDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    output: true,
    validation: true,
    performance: true,
    review: true,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Parse output data - handle nested result structure
  const parseOutputData = (output: any) => {
    if (!output) return { data: [], columns: [] }
    
    // If output has a result key, extract it
    let resultData = output.result || output
    
    // Handle execution wrapper format: {type: 'dataframe', data: [...]}
    if (resultData && typeof resultData === 'object' && resultData.type === 'dataframe' && resultData.data) {
      return {
        data: resultData.data,
        columns: resultData.columns || (resultData.data.length > 0 ? Object.keys(resultData.data[0]) : [])
      }
    }
    
    // Handle direct data array
    if (Array.isArray(resultData)) {
      return {
        data: resultData,
        columns: resultData.length > 0 ? Object.keys(resultData[0]) : []
      }
    }
    
    // Handle data key
    if (resultData && resultData.data && Array.isArray(resultData.data)) {
      return {
        data: resultData.data,
        columns: resultData.columns || (resultData.data.length > 0 ? Object.keys(resultData.data[0]) : [])
      }
    }
    
    return { data: [], columns: [] }
  }
  
  const outputParsed = parseOutputData(result.output)
  const outputData = outputParsed.data
  const outputColumns = outputParsed.columns

  const getStatusIcon = (isCorrect: boolean) => {
    return isCorrect ? (
      <CheckCircle className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    )
  }

  const getStatusColor = (isCorrect: boolean) => {
    return isCorrect ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
  }

  return (
    <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Execution Results</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">{formatDuration(result.execution_time)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MemoryStick className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">{formatMemory(result.memory_usage)}</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {result.error_message && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-red-900 mb-1">Execution Error</h4>
              <pre className="text-sm text-red-700 whitespace-pre-wrap font-mono">
                {result.error_message}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Output Section */}
      {result.output && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('output')}
            className="flex items-center gap-2 w-full text-left mb-3 hover:text-indigo-600"
          >
            {expandedSections.output ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <h4 className="text-md font-medium text-gray-900">Output Data</h4>
          </button>
          
          {expandedSections.output && (
            <div>
              {/* Show table as primary display if data is available */}
              {outputData.length > 0 && outputColumns.length > 0 ? (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-900 mb-3">Your Output ({outputData.length} rows)</h5>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full bg-white">
                      <thead className="bg-gray-50">
                        <tr>
                          {outputColumns.map((column: string) => (
                            <th key={column} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {outputData.slice(0, 20).map((row: any, index: number) => (
                          <tr key={index} className="hover:bg-gray-50">
                            {outputColumns.map((column: string) => (
                              <td key={column} className="px-4 py-2 text-sm text-gray-900">
                                {row[column] !== null && row[column] !== undefined ? row[column].toString() : <span className="text-gray-400 italic">null</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {outputData.length > 20 && (
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Showing first 20 rows of {outputData.length} total rows
                    </p>
                  )}
                </div>
              ) : (
                /* Show raw output if table parsing fails */
                result.output.result && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Result Data</h5>
                    <pre className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg overflow-x-auto border border-gray-200">
                      {JSON.stringify(result.output.result, null, 2)}
                    </pre>
                  </div>
                )
              )}
              
              {/* Show stdout if available */}
              {result.output.stdout && (
                <div className="mb-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Standard Output</h5>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {result.output.stdout}
                  </pre>
                </div>
              )}
              
              {/* Show stderr if available */}
              {result.output.stderr && (
                <div className="mb-4 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <h5 className="text-sm font-medium text-yellow-900 mb-2">Warnings/Logs</h5>
                  <pre className="text-sm text-yellow-700 whitespace-pre-wrap font-mono text-xs">
                    {result.output.stderr}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Success message if no validation but execution succeeded */}
      {!result.validation_result && result.status === 'completed' && !result.error_message && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-green-900 mb-1">Code Executed Successfully!</h4>
              <p className="text-sm text-green-700">
                Your code ran without errors. Check the output above for results.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Results */}
      {result.validation_result && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('validation')}
            className="flex items-center gap-2 w-full text-left mb-3 hover:text-indigo-600"
          >
            {expandedSections.validation ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <h4 className="text-md font-medium text-gray-900">Validation Results</h4>
            {getStatusIcon(result.validation_result.is_correct)}
          </button>

          {expandedSections.validation && (
            <div className="space-y-4">
              {/* Overall Status */}
              <div className={`p-4 rounded-lg ${getStatusColor(result.validation_result.is_correct)}`}>
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.validation_result.is_correct)}
                  <div>
                    <h5 className="font-medium">
                      {result.validation_result.is_correct ? 'Solution Correct!' : 'Solution Incorrect'}
                    </h5>
                    <p className="text-sm mt-1">
                      Similarity Score: {formatPercentage(result.validation_result.similarity_score)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed Validation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ValidationItem
                  label="Schema Match"
                  isCorrect={result.validation_result.schema_match}
                  description="Column names and types"
                />
                <ValidationItem
                  label="Row Count"
                  isCorrect={result.validation_result.row_count_match}
                  description="Number of rows"
                />
                <ValidationItem
                  label="Data Match"
                  isCorrect={result.validation_result.data_match}
                  description="Row values"
                />
              </div>

              {/* Error Details */}
              {result.validation_result.error_details && result.validation_result.error_details.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h5 className="font-medium text-yellow-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Validation Issues
                  </h5>
                  <ul className="space-y-2">
                    {result.validation_result.error_details.map((error, index) => (
                      <li key={index} className="text-sm text-yellow-800">
                        <strong>{error.type}:</strong> {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Performance Metrics */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('performance')}
          className="flex items-center gap-2 w-full text-left mb-3 hover:text-indigo-600"
        >
          {expandedSections.performance ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <TrendingUp className="h-4 w-4" />
          <h4 className="text-md font-medium text-gray-900">Performance Metrics</h4>
        </button>

        {expandedSections.performance && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Execution Time</span>
              </div>
              <p className="text-lg font-semibold text-blue-700">
                {formatDuration(result.execution_time)}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MemoryStick className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Memory Usage</span>
              </div>
              <p className="text-lg font-semibold text-purple-700">
                {formatMemory(result.memory_usage)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* AI Code Review (if available) */}
      {result.ai_review && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('review')}
            className="flex items-center gap-2 w-full text-left mb-3 hover:text-indigo-600"
          >
            {expandedSections.review ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Code className="h-4 w-4" />
            <h4 className="text-md font-medium text-gray-900">AI Code Review</h4>
            <span className="ml-auto text-sm font-semibold text-indigo-600">
              Score: {(result.ai_review.overall_score * 100).toFixed(0)}/100
            </span>
          </button>

          {expandedSections.review && (
            <CodeReviewSection review={result.ai_review} />
          )}
        </div>
      )}
    </div>
  )
}

// Helper Components
function ValidationItem({ 
  label, 
  isCorrect, 
  description 
}: { 
  label: string
  isCorrect: boolean
  description: string 
}) {
  return (
    <div className={`p-3 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center gap-2 mb-1">
        {isCorrect ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        )}
        <span className={`text-sm font-medium ${isCorrect ? 'text-green-900' : 'text-red-900'}`}>
          {label}
        </span>
      </div>
      <p className={`text-xs ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
        {description}
      </p>
    </div>
  )
}

function CodeReviewSection({ review }: { review: CodeReview }) {
  // Helper function to parse markdown bold text
  const parseMarkdown = (text: string) => {
    // Replace **text** with <strong>text</strong>
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
      }
      return <span key={index}>{part}</span>
    })
  }

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h5 className="font-medium text-gray-900">Overall Score</h5>
          <span className="text-2xl font-bold text-indigo-600">
            {(review.overall_score * 100).toFixed(0)}/100
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${review.overall_score * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Feedback Sections */}
      <div className="grid grid-cols-1 gap-4">
        <FeedbackSection
          title="Correctness"
          content={review.correctness_feedback}
          icon={<CheckCircle className="h-4 w-4" />}
          parseMarkdown={parseMarkdown}
        />
        <FeedbackSection
          title="Performance"
          content={review.performance_feedback}
          icon={<TrendingUp className="h-4 w-4" />}
          parseMarkdown={parseMarkdown}
        />
        <FeedbackSection
          title="Best Practices"
          content={review.best_practices_feedback}
          icon={<Lightbulb className="h-4 w-4" />}
          parseMarkdown={parseMarkdown}
        />
      </div>

      {/* Improvement Suggestions */}
      {review.improvement_suggestions.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h5 className="font-medium text-yellow-900 mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Improvement Suggestions
          </h5>
          <ul className="space-y-2">
            {review.improvement_suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-yellow-800 flex gap-2">
                <span className="flex-shrink-0">•</span>
                <span>{parseMarkdown(suggestion)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function FeedbackSection({ 
  title, 
  content, 
  icon,
  parseMarkdown
}: { 
  title: string
  content: string
  icon: React.ReactNode
  parseMarkdown: (text: string) => React.ReactNode[]
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
        {icon}
        {title}
      </h5>
      <p className="text-sm text-gray-700 leading-relaxed">{parseMarkdown(content)}</p>
    </div>
  )
}