/**
 * Design Service API Test Page
 * Simple page to test the design service API connection
 */

import React, { useState } from 'react';
import { designService } from '@/services/designService';

export default function DesignAPITestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testHealthCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const health = await designService.healthCheck();
      setResult({ type: 'Health Check', data: health });
    } catch (err: any) {
      setError(err.message || 'Health check failed');
    } finally {
      setLoading(false);
    }
  };

  const testGenerateQuestion = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const question = await designService.generateQuestion({
        role: 'ui_designer',
        difficulty: 'intermediate',
        task_type: 'dashboard',
        topic: 'food delivery',
        created_by: 'test_user'
      });
      setResult({ type: 'Generate Question', data: question });
    } catch (err: any) {
      setError(err.message || 'Question generation failed');
    } finally {
      setLoading(false);
    }
  };

  const testCreateWorkspace = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      // First generate a question
      const question = await designService.generateQuestion({
        role: 'ui_designer',
        difficulty: 'intermediate',
        task_type: 'dashboard',
        topic: 'food delivery',
        created_by: 'test_user'
      });

      if (!question.id) {
        throw new Error('Question ID not found');
      }

      // Then create workspace
      const workspace = await designService.createWorkspace({
        user_id: 'test_user_123',
        assessment_id: 'test_assessment_456',
        question_id: question.id
      });

      setResult({ type: 'Create Workspace', data: workspace });
    } catch (err: any) {
      setError(err.message || 'Workspace creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Design Service API Test
        </h1>

        {/* Test Buttons */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Test Endpoints
          </h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={testHealthCheck}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
            >
              Test Health Check
            </button>
            <button
              onClick={testGenerateQuestion}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
            >
              Test Generate Question
            </button>
            <button
              onClick={testCreateWorkspace}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-semibold"
            >
              Test Create Workspace
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <p className="text-blue-800">Testing API...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h3 className="text-red-800 font-semibold mb-2">Error</h3>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-green-800 font-semibold mb-4">
              {result.type} - Success ✓
            </h3>
            <div className="bg-white rounded border border-green-300 p-4 overflow-auto">
              <pre className="text-sm text-gray-800">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
            
            {/* Show workspace URL if available */}
            {result.data.workspace_url && (
              <div className="mt-4">
                <a
                  href={result.data.workspace_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Open Penpot Workspace →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Instructions:</h3>
          <ol className="list-decimal list-inside text-gray-700 space-y-2">
            <li>Click "Test Health Check" to verify the service is running</li>
            <li>Click "Test Generate Question" to generate an AI design question</li>
            <li>Click "Test Create Workspace" to create a Penpot workspace</li>
            <li>If workspace creation succeeds, click "Open Penpot Workspace" to view it</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
