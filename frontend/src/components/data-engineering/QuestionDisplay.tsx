'use client'

import React from 'react'
import { BookOpen, Database, Target } from 'lucide-react'

interface Question {
  id: string
  title: string
  description: string
  difficulty_level: string
  topic: string
  input_schema: Record<string, string>
  sample_input: any
  expected_output: any
  test_cases?: any[]
}

interface QuestionDisplayProps {
  question: Question
  className?: string
}

// Helper functions
const getDifficultyLabel = (level: string) => {
  const labels: Record<string, string> = {
    'easy': 'Easy',
    'medium': 'Medium',
    'hard': 'Hard'
  }
  return labels[level] || level
}

const getDifficultyColor = (level: string) => {
  const colors: Record<string, string> = {
    'easy': 'bg-green-100 text-green-800',
    'medium': 'bg-yellow-100 text-yellow-800',
    'hard': 'bg-red-100 text-red-800'
  }
  return colors[level] || 'bg-gray-100 text-gray-800'
}

export default function QuestionDisplay({ question, className = '' }: QuestionDisplayProps) {
  // Parse sample input data - handle nested structure
  const parseSampleInput = (input: any) => {
    if (!input) return { data: [], columns: [] }
    
    // If input has a 'data' key, use it
    if (input.data && Array.isArray(input.data)) {
      return {
        data: input.data,
        columns: input.columns || (input.data.length > 0 ? Object.keys(input.data[0]) : [])
      }
    }
    
    // If input is already an array
    if (Array.isArray(input)) {
      return {
        data: input,
        columns: input.length > 0 ? Object.keys(input[0]) : []
      }
    }
    
    return { data: [], columns: [] }
  }
  
  const sampleInputParsed = parseSampleInput(question.sample_input)
  const sampleData = sampleInputParsed.data
  const sampleColumns = sampleInputParsed.columns
  
  const expectedOutputParsed = parseSampleInput(question.expected_output)
  const expectedData = expectedOutputParsed.data
  const expectedColumns = expectedOutputParsed.columns

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
    <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-100">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{question.title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty_level)}`}>
              {getDifficultyLabel(question.difficulty_level)}
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {question.topic}
            </span>
            {/* AI Generated Indicator */}
            {question.id !== 'test-question-1' && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-200">
                🤖 AI Generated
              </span>
            )}
            {question.id === 'test-question-1' && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                📝 Test Question
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Target className="h-5 w-5 text-purple-600" />
          Problem Description
        </h3>
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-lg border border-gray-100">
            {parseMarkdown(question.description)}
          </p>
        </div>
      </div>

      {/* Input Schema */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Database className="h-5 w-5 text-green-600" />
          Input Schema
        </h3>
        <div className="bg-gradient-to-br from-gray-50 to-green-50 rounded-xl p-4 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(question.input_schema).map(([column, type]) => (
              <div key={column} className="flex justify-between items-center">
                <span className="font-mono text-sm text-gray-700">{column}</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sample Input Data */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Sample Input Data</h3>
        {sampleData.length > 0 && sampleColumns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  {sampleColumns.map((column: string) => (
                    <th key={column} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sampleData.slice(0, 5).map((row: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {sampleColumns.map((column: string) => (
                      <td key={column} className="px-4 py-2 text-sm text-gray-900 border-b">
                        {row[column] !== null && row[column] !== undefined ? row[column].toString() : <span className="text-gray-400 italic">null</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {sampleData.length > 5 && (
              <p className="text-xs text-gray-500 mt-2">
                Showing first 5 rows of {sampleData.length} total rows
              </p>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">No sample input data available</p>
          </div>
        )}
      </div>

      {/* Expected Output */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Target className="h-4 w-4" />
          Expected Output Format
        </h3>
        {expectedData.length > 0 && expectedColumns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-green-50">
                <tr>
                  {expectedColumns.map((column: string) => (
                    <th key={column} className="px-4 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider border-b">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {expectedData.slice(0, 3).map((row: any, index: number) => (
                  <tr key={index} className="hover:bg-green-50">
                    {expectedColumns.map((column: string) => (
                      <td key={column} className="px-4 py-2 text-sm text-gray-900 border-b">
                        {row[column] !== null && row[column] !== undefined ? row[column].toString() : <span className="text-gray-400 italic">null</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {expectedData.length > 3 && (
              <p className="text-xs text-gray-500 mt-2">
                Showing first 3 rows of expected output format
              </p>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">No expected output data available</p>
          </div>
        )}
      </div>

      {/* Test Cases Info */}
      {question.test_cases && question.test_cases.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Test Cases</h4>
          <p className="text-sm text-blue-700">
            Your solution will be validated against {question.test_cases.length} test case(s) 
            with different input data to ensure correctness.
          </p>
        </div>
      )}
    </div>
  )
}