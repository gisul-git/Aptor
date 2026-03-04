import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { CheckCircle, XCircle, Clock, Code, AlertCircle, ArrowRight, Home } from 'lucide-react'
import Link from 'next/link'
import ResultsDisplay from '../../../../components/data-engineering/ResultsDisplay'
import { ExecutionResult, Question } from '../../../../libs/data-engineering/integration'

interface AssessmentResult {
  result: ExecutionResult
  question: Question
  code: string
  timeSpent: number
}

export default function AssessmentResultsPage() {
  const router = useRouter()
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load result from sessionStorage
    const storedResult = sessionStorage.getItem('assessmentResult')
    if (storedResult) {
      try {
        const parsed = JSON.parse(storedResult)
        setAssessmentResult(parsed)
      } catch (error) {
        console.error('Failed to parse assessment result:', error)
      }
    }
    setLoading(false)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200'
    if (score >= 60) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!assessmentResult) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">No Results Found</h1>
          <p className="text-gray-600 mb-6">
            We couldn't find your assessment results. Please try taking the assessment again.
          </p>
          <Link href="/data-engineering/assessment" className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors">
            Take Assessment
          </Link>
        </div>
      </div>
    )
  }

  const { result, question, code, timeSpent } = assessmentResult
  const isCorrect = result.validation_result?.is_correct || false
  const score = result.validation_result?.similarity_score ? Math.round(result.validation_result.similarity_score * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Assessment Results</h1>
              <p className="text-gray-600 mt-1">Your PySpark coding challenge results</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/data-engineering" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <Home className="h-5 w-5" />
                <span>Back to Home</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Score Card */}
        <div className={`p-8 rounded-lg border-2 mb-8 ${getScoreBg(score)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isCorrect ? (
                <CheckCircle className="h-12 w-12 text-green-600" />
              ) : (
                <XCircle className="h-12 w-12 text-red-600" />
              )}
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  {isCorrect ? 'Assessment Passed!' : 'Assessment Incomplete'}
                </h2>
                <p className="text-lg text-gray-600 mt-1">
                  {isCorrect 
                    ? 'Congratulations! You successfully solved the challenge.' 
                    : 'Your solution needs some improvements. Keep practicing!'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
                {score}%
              </div>
              <p className="text-sm text-gray-600 mt-1">Overall Score</p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatTime(timeSpent)}</p>
                <p className="text-sm text-gray-600">Time Spent</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <Code className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{code.split('\n').length}</p>
                <p className="text-sm text-gray-600">Lines of Code</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              {result.validation_result?.schema_match ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {result.validation_result?.schema_match ? 'Valid' : 'Invalid'}
                </p>
                <p className="text-sm text-gray-600">Output Schema</p>
              </div>
            </div>
          </div>
        </div>

        {/* Question Summary */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Challenge Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Question</h4>
              <p className="text-gray-700 mb-2">{question.title}</p>
              <p className="text-sm text-gray-600">{question.description}</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Difficulty:</span>
                  <span className="font-medium capitalize">{question.difficulty_level}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Topic:</span>
                  <span className="font-medium capitalize">{question.topic}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Question ID:</span>
                  <span className="font-mono text-xs">{question.id}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Results */}
        <ResultsDisplay result={result} />

        {/* Your Code */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Solution</h3>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre className="text-sm font-mono whitespace-pre-wrap">{code}</pre>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">What's Next?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/data-engineering/practice" className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
              <Code className="h-8 w-8 text-blue-600" />
              <div>
                <h4 className="font-medium text-blue-900">Practice More</h4>
                <p className="text-sm text-blue-700">Continue improving your PySpark skills</p>
              </div>
              <ArrowRight className="h-5 w-5 text-blue-600 ml-auto" />
            </Link>

            <Link href="/data-engineering/assessment" className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <h4 className="font-medium text-green-900">Take Another Assessment</h4>
                <p className="text-sm text-green-700">Challenge yourself with a new problem</p>
              </div>
              <ArrowRight className="h-5 w-5 text-green-600 ml-auto" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}