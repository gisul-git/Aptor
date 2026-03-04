import { useState, useEffect } from 'react'
import { dataEngineeringAPI } from '../../../services/data-engineering/api'

export default function SimpleTestPage() {
  const [healthStatus, setHealthStatus] = useState<any>(null)
  const [question, setQuestion] = useState<any>(null)
  const [executionResult, setExecutionResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Test health check on component mount
  useEffect(() => {
    testHealthCheck()
  }, [])

  const testHealthCheck = async () => {
    try {
      setLoading(true)
      const health = await dataEngineeringAPI.healthCheck()
      setHealthStatus(health)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed')
    } finally {
      setLoading(false)
    }
  }

  const testGetQuestion = async () => {
    try {
      setLoading(true)
      setError(null)
      const testQuestion = await dataEngineeringAPI.getTestQuestion()
      setQuestion(testQuestion)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get question')
    } finally {
      setLoading(false)
    }
  }

  const testCodeExecution = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await dataEngineeringAPI.executeCode(
        'import pandas as pd\ndf = pd.DataFrame({"name": ["Alice", "Bob"], "age": [25, 30]})\nprint(df.head())',
        'test'
      )
      setExecutionResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code execution failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Data Engineering Service - Simple Test
        </h1>

        {/* Health Check Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Health Check</h2>
          <button
            onClick={testHealthCheck}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-4"
          >
            {loading ? 'Checking...' : 'Test Health Check'}
          </button>
          {healthStatus && (
            <div className="bg-green-50 p-4 rounded-lg">
              <pre className="text-sm text-green-800">
                {JSON.stringify(healthStatus, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Get Question Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Get Test Question</h2>
          <button
            onClick={testGetQuestion}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 mb-4"
          >
            {loading ? 'Loading...' : 'Get Test Question'}
          </button>
          {question && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">{question.title}</h3>
              <p className="text-blue-800 mb-2">{question.description}</p>
              <p className="text-sm text-blue-700">
                Difficulty: {question.difficulty_level} | Topic: {question.topic}
              </p>
            </div>
          )}
        </div>

        {/* Code Execution Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Code Execution</h2>
          <button
            onClick={testCodeExecution}
            disabled={loading}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 mb-4"
          >
            {loading ? 'Executing...' : 'Execute Sample Code'}
          </button>
          <div className="bg-gray-100 p-4 rounded-lg mb-4">
            <pre className="text-sm text-gray-800">
{`import pandas as pd
df = pd.DataFrame({"name": ["Alice", "Bob"], "age": [25, 30]})
print(df.head())`}
            </pre>
          </div>
          {executionResult && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">Execution Result</h3>
              <p className="text-sm text-purple-800 mb-2">
                Status: {executionResult.status} | Job ID: {executionResult.job_id}
              </p>
              {executionResult.output && (
                <div className="bg-black text-green-400 p-3 rounded font-mono text-sm">
                  <pre>{executionResult.output.stdout}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Service Info */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Information</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Backend URL:</strong> http://localhost:3009</p>
            <p><strong>API Docs:</strong> <a href="http://localhost:3009/docs" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">http://localhost:3009/docs</a></p>
            <p><strong>Health Endpoint:</strong> <a href="http://localhost:3009/health" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">http://localhost:3009/health</a></p>
          </div>
        </div>
      </div>
    </div>
  )
}