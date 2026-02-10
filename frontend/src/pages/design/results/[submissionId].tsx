/**
 * Design Assessment Results Page
 * 
 * Displays evaluation results with scores and feedback
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

interface EvaluationResult {
  submission_id: string;
  rule_based_score: number;
  ai_based_score: number;
  final_score: number;
  feedback: {
    overall?: string;
    strengths?: string[];
    improvements?: string[];
    rule_based?: {
      score: number;
      breakdown?: {
        completeness?: number;
        alignment?: number;
        spacing?: number;
        typography?: number;
        color?: number;
        hierarchy?: number;
        interaction?: number;
      };
      notes?: string;
    };
    ai_based?: {
      score: number;
      breakdown?: {
        aesthetics?: number;
        ux_clarity?: number;
        creativity?: number;
        accessibility?: number;
        balance?: number;
      };
      notes?: string;
    };
    final_score?: number;
    weights?: {
      rule_based?: string;
      ai_based?: string;
    };
  };
}

export default function DesignResultsPage() {
  const router = useRouter();
  const { submissionId } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  
  useEffect(() => {
    if (!submissionId) return;
    
    fetchResults();
  }, [submissionId]);
  
  const fetchResults = async () => {
    try {
      const response = await fetch(
        `http://localhost:3006/api/v1/design/submissions/${submissionId}/evaluation`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }
      
      const data = await response.json();
      setResult(data);
      setLoading(false);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }
  
  if (error || !result) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error || 'Results not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">📊 Evaluation Results</h1>
        
        {/* Final Score Card */}
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-12 text-white text-center mb-8">
          <p className="text-xl mb-2 opacity-90">Final Score</p>
          <p className="text-7xl font-bold">{result.final_score.toFixed(1)}</p>
          <p className="text-2xl mt-2 opacity-90">out of 100</p>
        </div>
        
        {/* Score Breakdown */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-3 text-gray-900">Rule-Based Score (60%)</h3>
            <p className="text-5xl font-bold text-blue-600 mb-2">
              {result.rule_based_score.toFixed(1)}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Based on design structure, alignment, spacing, and consistency
            </p>
            {result.feedback.rule_based?.breakdown && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-bold text-gray-700 mb-2">Breakdown:</p>
                <div className="space-y-1 text-xs text-gray-600">
                  {Object.entries(result.feedback.rule_based.breakdown).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key.replace('_', ' ')}:</span>
                      <span className="font-medium">{value?.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-3 text-gray-900">AI-Based Score (40%)</h3>
            <p className="text-5xl font-bold text-purple-600 mb-2">
              {result.ai_based_score.toFixed(1)}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Based on visual aesthetics, UX clarity, and creativity
            </p>
            {result.feedback.ai_based?.breakdown && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-bold text-gray-700 mb-2">Breakdown:</p>
                <div className="space-y-1 text-xs text-gray-600">
                  {Object.entries(result.feedback.ai_based.breakdown).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key.replace('_', ' ')}:</span>
                      <span className="font-medium">{value?.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Feedback */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <h3 className="text-lg font-bold mb-4 text-gray-900">📝 Evaluation Feedback</h3>
          
          {result.feedback.overall && (
            <p className="text-gray-700 leading-relaxed mb-4 p-4 bg-blue-50 rounded-lg">
              {result.feedback.overall}
            </p>
          )}
          
          {result.feedback.strengths && result.feedback.strengths.length > 0 && (
            <div className="mb-4">
              <p className="font-bold text-green-700 mb-2">✅ Strengths:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {result.feedback.strengths.map((strength, i) => (
                  <li key={i}>{strength}</li>
                ))}
              </ul>
            </div>
          )}
          
          {result.feedback.improvements && result.feedback.improvements.length > 0 && (
            <div>
              <p className="font-bold text-orange-700 mb-2">💡 Areas for Improvement:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {result.feedback.improvements.map((improvement, i) => (
                  <li key={i}>{improvement}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Score Calculation */}
        {result.feedback.weights && (
          <div className="bg-gray-100 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Score Calculation</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                Rule-Based: {result.rule_based_score.toFixed(1)} × {result.feedback.weights.rule_based} = {
                  (result.rule_based_score * 0.6).toFixed(1)
                }
              </p>
              <p>
                AI-Based: {result.ai_based_score.toFixed(1)} × {result.feedback.weights.ai_based} = {
                  (result.ai_based_score * 0.4).toFixed(1)
                }
              </p>
              <p className="font-bold pt-2 border-t border-gray-300">
                Final Score: {result.final_score.toFixed(1)}
              </p>
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
