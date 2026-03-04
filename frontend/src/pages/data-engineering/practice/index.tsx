import { useState, useEffect, useCallback } from 'react'
import { Code, Play, RefreshCw, BookOpen, Settings, Home, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { dataEngineeringAPI } from '../../../services/data-engineering/api'
import { integration, WorkflowState, ExecutionMode, Question } from '../../../libs/data-engineering/integration'
import QuestionDisplay from '../../../components/data-engineering/QuestionDisplay'
import CodeEditor from '../../../components/data-engineering/CodeEditor'
import ResultsDisplay from '../../../components/data-engineering/ResultsDisplay'

const PYSPARK_TEMPLATE = `from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *

# Initialize Spark session
spark = SparkSession.builder.appName("DataEngineerAssessment").getOrCreate()

# NOTE: input_df will be automatically provided with the question's sample data
# Write your PySpark transformations below

# Example: Pass through the input data unchanged
result = input_df

# Make sure to assign your final DataFrame to the 'result' variable
# The 'result' variable will be automatically validated against expected output
`

export default function PracticePage() {
  const [question, setQuestion] = useState<Question | null>(null)
  const [code, setCode] = useState<string>(PYSPARK_TEMPLATE)
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionMode, setExecutionMode] = useState<ExecutionMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [experienceLevel, setExperienceLevel] = useState(3)
  const [difficulty, setDifficulty] = useState('medium')
  const [topic, setTopic] = useState('transformations')

  // Subscribe to integration service state changes
  useEffect(() => {
    const unsubscribe = integration.subscribe((state: WorkflowState) => {
      // Only update question if integration service has one
      if (state.currentQuestion) {
        setQuestion(state.currentQuestion)
      }
      
      setIsLoading(state.isLoading)
      setError(state.error)
      
      // Update result from integration state
      if (state.executionResult) {
        setResult(state.executionResult)
      }
    })

    return unsubscribe
  }, [])

  // Load initial question
  useEffect(() => {
    const timer = setTimeout(() => {
      loadNewQuestion()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])

  const loadNewQuestion = useCallback(async () => {
    setError(null)
    setResult(null)
    setIsLoading(true)
    
    try {
      const questionData = await integration.loadQuestion(experienceLevel, difficulty, topic)
      setCode(PYSPARK_TEMPLATE)
      setIsLoading(false)
    } catch (err) {
      console.error('Error loading question:', err)
      setError(`Failed to load question: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setIsLoading(false)
    }
  }, [experienceLevel, difficulty, topic])

  const executeCode = async (mode: ExecutionMode) => {
    if (!question) {
      alert('No question loaded. Please load a question first.')
      return
    }

    if (isExecuting) {
      return
    }

    setIsExecuting(true)
    setExecutionMode(mode)
    setError(null)
    setResult(null)
    
    try {
      if (mode === ExecutionMode.TEST) {
        await integration.testCode(code, question.id)
      } else {
        await integration.submitCode(code, question.id)
      }
    } catch (err) {
      console.error('Execution error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute code. Please try again.'
      setError(errorMessage)
    } finally {
      setIsExecuting(false)
      setExecutionMode(null)
    }
  }

  const handleTest = (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (!isExecuting) {
      executeCode(ExecutionMode.TEST)
    }
  }
  
  const handleSubmit = (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (!isExecuting) {
      executeCode(ExecutionMode.SUBMIT)
    }
  }

  const handleCodeChange = (newCode: string) => {
    setCode(newCode)
    if (result) {
      setResult(null)
    }
  }

  const handleReset = () => {
    setCode(PYSPARK_TEMPLATE)
    setResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <Link href="/data-engineering" className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
                <Home className="h-5 w-5" />
                <span className="font-medium">Home</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Practice Mode</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Experience Level Selector */}
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                <Settings className="h-4 w-4 text-gray-500" />
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(parseInt(e.target.value))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                  disabled={isLoading || isExecuting}
                >
                  <option value={1}>Beginner (0-2 years)</option>
                  <option value={3}>Intermediate (3-5 years)</option>
                  <option value={6}>Advanced (6-8 years)</option>
                  <option value={9}>Expert (8+ years)</option>
                </select>
              </div>

              {/* Difficulty Selector */}
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                <span className="text-sm text-gray-600">Difficulty:</span>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                  disabled={isLoading || isExecuting}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              {/* Topic Selector */}
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                <span className="text-sm text-gray-600">Topic:</span>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                  disabled={isLoading || isExecuting}
                >
                  <option value="transformations">Transformations</option>
                  <option value="aggregations">Aggregations</option>
                  <option value="joins">Joins</option>
                  <option value="window_functions">Window Functions</option>
                  <option value="optimization">Optimization</option>
                </select>
              </div>
              
              <button
                onClick={loadNewQuestion}
                disabled={isLoading || isExecuting}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg border border-gray-300 flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                New Question
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-red-900 mb-1">Error</h4>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
            <span className="text-gray-600">Loading question...</span>
          </div>
        ) : question ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Question */}
              <div className="space-y-6">
                <QuestionDisplay question={question} />
              </div>

              {/* Right Column - Code Editor and Results */}
              <div className="space-y-6">
                <CodeEditor
                  value={code}
                  onChange={handleCodeChange}
                  onTest={handleTest}
                  onSubmit={handleSubmit}
                  onReset={handleReset}
                  isExecuting={isExecuting}
                  height="600px"
                />

                {/* Execution Status Monitor */}
                {isExecuting && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {executionMode === ExecutionMode.TEST ? 'Running Tests...' : 'Submitting Solution...'}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {executionMode === ExecutionMode.TEST 
                            ? 'Validating your code against test cases' 
                            : 'Validating code and generating AI feedback'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Results Display - Only validation and performance */}
                {result && !isExecuting && !result.ai_review && (
                  <ResultsDisplay result={result} />
                )}

                {/* Empty State */}
                {!result && !isExecuting && (
                  <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Code</h3>
                    <p className="text-gray-600">
                      Write your PySpark solution above and click 'Run Tests' to see the results, or 'Submit Solution' for comprehensive AI feedback.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Full Width AI Review Section */}
            {result && !isExecuting && result.ai_review && (
              <div className="mt-8 space-y-6">
                {/* Show validation results in full width too */}
                <ResultsDisplay result={result} />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Question Loaded</h3>
            <p className="text-gray-600 mb-6">Unable to load a practice question. Please try again.</p>
            <button onClick={loadNewQuestion} className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors">
              Load Question
            </button>
          </div>
        )}
      </main>
    </div>
  )
}