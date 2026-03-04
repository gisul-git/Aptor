import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Code, Play, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { dataEngineeringAPI } from '../../../services/data-engineering/api'
import { useCodeExecution, useQuestions } from '../../../hooks/data-engineering/useDataEngineering'
import { integration, WorkflowState, ExecutionMode, Question } from '../../../libs/data-engineering/integration'
import QuestionDisplay from '../../../components/data-engineering/QuestionDisplay'
import CodeEditor from '../../../components/data-engineering/CodeEditor'

const PYSPARK_TEMPLATE = `from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *

# NOTE: input_df will be automatically provided with the question's sample data
# Write your PySpark transformations below

# Example: Pass through the input data unchanged
result = input_df

# Make sure to assign your final DataFrame to the 'result' variable
`

export default function AssessmentPage() {
  const router = useRouter()
  const [question, setQuestion] = useState<Question | null>(null)
  const [code, setCode] = useState<string>(PYSPARK_TEMPLATE)
  const [isLoading, setIsLoading] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(3600) // 60 minutes in seconds
  const [testPassed, setTestPassed] = useState<boolean | null>(null)
  const [isStarted, setIsStarted] = useState(false)

  // Timer countdown
  useEffect(() => {
    if (!isStarted) return
    
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(timer)
          // Auto-submit when time runs out
          if (question && !isExecuting) {
            handleSubmit()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isStarted, question, isExecuting])

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Subscribe to integration service state changes
  useEffect(() => {
    const unsubscribe = integration.subscribe((state: WorkflowState) => {
      if (state.currentQuestion) {
        setQuestion(state.currentQuestion)
      }
      setIsLoading(state.isLoading)
      setError(state.error)
    })
    return unsubscribe
  }, [])

  // Load initial question
  useEffect(() => {
    if (isStarted) {
      loadQuestion()
      setTimeRemaining(3600) // Reset timer
    }
  }, [isStarted])

  const loadQuestion = async () => {
    setError(null)
    setIsLoading(true)
    
    try {
      // For assessment, use varied difficulty and topics to test different skills
      const difficulties = ['easy', 'medium', 'hard']
      const topics = ['transformations', 'aggregations', 'joins', 'window_functions']
      
      const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)]
      const randomTopic = topics[Math.floor(Math.random() * topics.length)]
      
      console.log(`Assessment: Loading ${randomDifficulty} ${randomTopic} question`)
      const questionData = await integration.loadQuestion(5, randomDifficulty, randomTopic) // Experience level 5
      setCode(PYSPARK_TEMPLATE)
      setIsLoading(false)
    } catch (err) {
      console.error('Error loading question:', err)
      setError(`Failed to load question: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setIsLoading(false)
    }
  }

  const handleTest = async () => {
    if (!question || isExecuting || isTesting) return

    setIsTesting(true)
    setError(null)
    setTestPassed(null)
    
    try {
      await integration.testCode(code, question.id)
      
      // Get the result from integration service
      const state = integration.getState()
      if (state.executionResult) {
        const passed = state.executionResult.validation_result?.is_correct || false
        setTestPassed(passed)
        
        // Show brief feedback
        setTimeout(() => {
          setTestPassed(null)
        }, 3000)
      }
    } catch (err) {
      console.error('Test error:', err)
      setError(err instanceof Error ? err.message : 'Failed to run tests')
    } finally {
      setIsTesting(false)
    }
  }
  
  const handleSubmit = async () => {
    if (!question || isExecuting) return

    // Confirm submission
    if (!confirm('Are you sure you want to submit your solution? This will end the assessment.')) {
      return
    }

    setIsExecuting(true)
    setError(null)
    
    try {
      await integration.submitCode(code, question.id)
      
      // Get the result and navigate to results page
      const state = integration.getState()
      if (state.executionResult) {
        // Store result in sessionStorage for results page
        sessionStorage.setItem('assessmentResult', JSON.stringify({
          result: state.executionResult,
          question: question,
          code: code,
          timeSpent: 3600 - timeRemaining
        }))
        
        // Navigate to results page (create this page)
        router.push('/data-engineering/assessment/results')
      }
    } catch (err) {
      console.error('Submission error:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit solution')
      setIsExecuting(false)
    }
  }

  const handleCodeChange = (newCode: string) => {
    setCode(newCode)
  }

  const startAssessment = () => {
    setIsStarted(true)
  }

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          <div className="text-center">
            <div className="p-4 bg-indigo-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Code className="h-10 w-10 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Data Engineering Assessment
            </h1>
            <p className="text-gray-600 mb-8">
              You have 60 minutes to complete the PySpark coding challenge. 
              Read the question carefully and write your solution in the code editor.
            </p>
            
            <div className="bg-yellow-50 p-4 rounded-lg mb-8 text-left">
              <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Instructions
              </h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Write PySpark code to solve the given problem</li>
                <li>• Use the "Run Tests" button to test your solution</li>
                <li>• Submit when you're confident in your answer</li>
                <li>• You can run your code multiple times before submitting</li>
              </ul>
            </div>

            <button
              onClick={startAssessment}
              className="bg-indigo-600 text-white px-8 py-4 rounded-lg hover:bg-indigo-700 transition-colors text-lg font-semibold"
            >
              Start Assessment
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Assessment Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Data Engineering Assessment</h1>
              <p className="text-sm text-gray-600 mt-1">Complete the PySpark challenge below</p>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Timer */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <Clock className={`h-5 w-5 ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-600'}`} />
                <span className={`font-mono text-lg font-semibold ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>

              {/* Test Status Indicator */}
              {testPassed !== null && (
                <div className="flex items-center gap-2 animate-pulse">
                  {testPassed ? (
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Tests Passed</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">Tests Failed</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-red-900 mb-1">Error</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
            <span className="text-gray-600">Loading assessment...</span>
          </div>
        ) : question ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Question */}
            <div className="space-y-6">
              <QuestionDisplay question={question} />
            </div>

            {/* Right Column - Code Editor */}
            <div className="space-y-6">
              <CodeEditor
                value={code}
                onChange={handleCodeChange}
                onTest={handleTest}
                onSubmit={handleSubmit}
                onReset={() => setCode(PYSPARK_TEMPLATE)}
                isExecuting={isExecuting || isTesting}
                height="650px"
              />

              {/* Execution Status */}
              {(isExecuting || isTesting) && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {isTesting ? 'Running Tests...' : 'Submitting Solution...'}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {isTesting 
                          ? 'Validating your code against test cases' 
                          : 'Processing your submission and generating results'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Instructions */}
              {!isExecuting && !isTesting && (
                <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-1">Instructions</p>
                      <ul className="space-y-1 text-blue-800">
                        <li>• Click "Run Tests" to validate your code (results not shown)</li>
                        <li>• Click "Submit Solution" when ready to see detailed results</li>
                        <li>• Submission will end the assessment</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Assessment Not Available</h3>
            <p className="text-gray-600">Unable to load the assessment. Please contact support.</p>
          </div>
        )}
      </main>
    </div>
  )
}