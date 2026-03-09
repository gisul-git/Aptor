import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Code, Clock, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import apiClient from '../../../../services/api/client'
import { integration, WorkflowState, Question } from '../../../../libs/data-engineering/integration'
import QuestionDisplay from '../../../../components/data-engineering/QuestionDisplay'
import CodeEditor from '../../../../components/data-engineering/CodeEditor'

const PYSPARK_TEMPLATE = `from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *

# NOTE: input_df will be automatically provided with the question's sample data
# Write your PySpark transformations below

# Example: Pass through the input data unchanged
result = input_df

# Make sure to assign your final DataFrame to the 'result' variable
`

interface TestQuestion {
  question_id: string
  question: Question
}

export default function TakeTestPage() {
  const router = useRouter()
  const { id: testId } = router.query
  const [testInfo, setTestInfo] = useState<any>(null)
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [code, setCode] = useState<string>(PYSPARK_TEMPLATE)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [testPassed, setTestPassed] = useState<boolean | null>(null)
  const [isStarted, setIsStarted] = useState(false)

  const currentQuestion = questions[currentQuestionIndex]?.question

  // Load test data
  useEffect(() => {
    if (!testId || typeof testId !== 'string') return

    const loadTest = async () => {
      try {
        const token = new URLSearchParams(window.location.search).get('token')
        const response = await apiClient.get(`/api/v1/data-engineering/tests/${testId}`, {
          params: token ? { token } : {}
        })
        
        setTestInfo(response.data)
        setTimeRemaining((response.data.duration_minutes || 60) * 60)
        
        // Load questions
        const questionIds = response.data.question_ids || []
        const loadedQuestions: TestQuestion[] = []
        
        for (const qId of questionIds) {
          const qResponse = await apiClient.get(`/api/v1/data-engineering/questions/${qId}`)
          loadedQuestions.push({
            question_id: qId,
            question: qResponse.data
          })
        }
        
        setQuestions(loadedQuestions)
        setIsLoading(false)
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load test')
        setIsLoading(false)
      }
    }

    loadTest()
  }, [testId])

  // Timer countdown
  useEffect(() => {
    if (!isStarted || timeRemaining <= 0) return
    
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmitTest()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isStarted, timeRemaining])

  // Load saved answer when changing questions
  useEffect(() => {
    if (answers[currentQuestionIndex]) {
      setCode(answers[currentQuestionIndex])
    } else {
      setCode(PYSPARK_TEMPLATE)
    }
  }, [currentQuestionIndex])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleCodeChange = (newCode: string) => {
    setCode(newCode)
    setAnswers(prev => ({ ...prev, [currentQuestionIndex]: newCode }))
  }

  const handleTest = async () => {
    if (!currentQuestion || isExecuting || isTesting) return

    setIsTesting(true)
    setError(null)
    setTestPassed(null)
    
    try {
      await integration.testCode(code, currentQuestion.id)
      
      const state = integration.getState()
      if (state.executionResult) {
        const passed = state.executionResult.validation_result?.is_correct || false
        setTestPassed(passed)
        
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

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setTestPassed(null)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
      setTestPassed(null)
    }
  }

  const handleSubmitTest = async () => {
    if (!confirm('Are you sure you want to submit your test? This action cannot be undone.')) {
      return
    }

    setIsExecuting(true)
    setError(null)
    
    try {
      const token = new URLSearchParams(window.location.search).get('token')
      await apiClient.post(`/api/v1/data-engineering/tests/${testId}/submit`, {
        answers,
        token
      })
      
      alert('Test submitted successfully!')
      router.push('/data-engineering')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit test')
      setIsExecuting(false)
    }
  }

  const startTest = () => {
    setIsStarted(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-mint-50/90 via-white to-forest-50/70 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-secondary">Loading test...</p>
        </div>
      </div>
    )
  }

  if (error && !testInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-mint-50/90 via-white to-forest-50/70 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border-2 border-red-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Test</h1>
          <p className="text-secondary">{error}</p>
        </div>
      </div>
    )
  }

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-mint-50/90 via-white to-forest-50/70 flex items-center justify-center p-8">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl border-2 border-mint-300 shadow-lg">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-mint-100 flex items-center justify-center mx-auto mb-6">
              <Code className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-primary mb-4">
              {testInfo?.title || 'Data Engineering Test'}
            </h1>
            <p className="text-secondary mb-8">
              Duration: {testInfo?.duration_minutes || 60} minutes | Questions: {questions.length}
            </p>
            
            <div className="bg-orange-50 border border-orange-200 p-6 rounded-lg mb-8 text-left">
              <h3 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Instructions
              </h3>
              <ul className="text-sm text-orange-800 space-y-2">
                <li>• Write PySpark code to solve each problem</li>
                <li>• Use "Run Tests" to validate your solution</li>
                <li>• Navigate between questions using the arrow buttons</li>
                <li>• Your code is automatically saved as you type</li>
                <li>• Submit when you're done or when time runs out</li>
              </ul>
            </div>

            <button
              onClick={startTest}
              className="bg-primary text-white px-8 py-4 rounded-lg hover:bg-forest-600 transition-colors text-lg font-semibold shadow-md hover:shadow-lg"
            >
              Start Test
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-mint-50/90 via-white to-forest-50/70">
      {/* Header */}
      <header className="bg-white shadow-sm border-b-2 border-mint-200 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-primary">{testInfo?.title || 'Data Engineering Test'}</h1>
              <p className="text-sm text-secondary mt-1">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Timer */}
              <div className="flex items-center gap-2 px-4 py-2 bg-mint-50 rounded-lg border-2 border-mint-300">
                <Clock className={`w-5 h-5 ${timeRemaining < 300 ? 'text-red-600' : 'text-primary'}`} />
                <span className={`font-mono text-lg font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-primary'}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>

              {/* Test Status */}
              {testPassed !== null && (
                <div className="flex items-center gap-2 animate-pulse">
                  {testPassed ? (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg border-2 border-green-200">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm font-semibold">Tests Passed</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg border-2 border-red-200">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm font-semibold">Tests Failed</span>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmitTest}
                disabled={isExecuting}
                className="px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-forest-600 transition-colors disabled:opacity-50 shadow-md hover:shadow-lg"
              >
                {isExecuting ? 'Submitting...' : 'Submit Test'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-red-900 mb-1">Error</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {currentQuestion ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Question */}
            <div className="space-y-6">
              <QuestionDisplay question={currentQuestion} />
              
              {/* Navigation */}
              <div className="flex justify-between items-center bg-white p-4 rounded-lg border-2 border-mint-200">
                <button
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-mint-100 text-primary font-semibold rounded-lg hover:bg-mint-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                
                <span className="text-sm font-semibold text-secondary">
                  {currentQuestionIndex + 1} / {questions.length}
                </span>
                
                <button
                  onClick={handleNextQuestion}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-mint-100 text-primary font-semibold rounded-lg hover:bg-mint-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right Column - Code Editor */}
            <div className="space-y-6">
              <CodeEditor
                value={code}
                onChange={handleCodeChange}
                onTest={handleTest}
                onSubmit={handleNextQuestion}
                onReset={() => setCode(PYSPARK_TEMPLATE)}
                isExecuting={isExecuting || isTesting}
                height="650px"
              />

              {/* Instructions */}
              {!isExecuting && !isTesting && (
                <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold mb-1">Tips</p>
                      <ul className="space-y-1 text-blue-800">
                        <li>• Click "Run Tests" to validate your code</li>
                        <li>• Your code is saved automatically</li>
                        <li>• Use navigation buttons to move between questions</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-primary mb-2">No Questions Available</h3>
            <p className="text-secondary">This test doesn't have any questions yet.</p>
          </div>
        )}
      </main>
    </div>
  )
}
