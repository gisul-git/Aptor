'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { ArrowLeft, CheckCircle, AlertCircle, TrendingUp, TrendingDown, BookOpen, Target } from 'lucide-react'
import { useDetailedCandidateResults } from '@/hooks/api/useAssessments'

interface QuestionResult {
  questionId: string
  questionIndex: number
  questionType: string
  questionText: string
  section: string
  difficulty: string
  isAttempted: boolean
  score: number
  maxMarks: number
  percentage: number
  candidateAnswer: {
    textAnswer?: string
    code?: string
    sqlQuery?: string
    selectedAnswers?: string[]
    outputs?: any[]
  }
  evaluation?: any
  testResults?: any[]
  testResult?: any
  aimlOutputs?: any[]
}

interface DetailedResults {
  candidate: {
    email: string
    name: string
  }
  overallSummary: {
    overall_score: number
    overall_max_marks: number
    overall_percentage: number
    grade: string
    overall_strengths?: string[]
    overall_weaknesses?: string[]
    skill_matrix?: any[]
    comprehensive_improvement_plan?: any
    personalized_recommendations?: any
  }
  keyStrengths: string[]
  areasOfImprovement: string[]
  sectionSummaries: any[]
  evaluations: Record<string, any>
  questionResults?: QuestionResult[]
  passFail?: {
    isPassed: boolean
    overallPercentage: number
    passPercentage: number
    status: string
  }
  submissionInfo: {
    submittedAt?: string
    completedAt?: string
    status: string
  }
}

export default function CandidateResultsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { id: assessmentIdParam, email: candidateEmailParam } = router.query
  const assessmentId = typeof assessmentIdParam === 'string' ? assessmentIdParam : undefined
  const candidateEmail = typeof candidateEmailParam === 'string' ? candidateEmailParam : undefined
  const candidateName = (router.query.name as string) || ''
  
  // React Query hook
  const { data: resultsData, isLoading: loading, error: queryError } = useDetailedCandidateResults(
    assessmentId,
    candidateEmail,
    candidateName
  )
  
  const [results, setResults] = useState<DetailedResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Update results from React Query data
  useEffect(() => {
    if (resultsData) {
      console.log('[RESULTS] Full response data:', resultsData)
      console.log('[RESULTS] Question results count:', resultsData?.questionResults?.length || 0)
      if (resultsData?.questionResults) {
        resultsData.questionResults.forEach((qResult: any, idx: number) => {
          console.log(`[RESULTS] Question ${idx} (${qResult.questionType}):`, {
            questionId: qResult.questionId,
            questionIndex: qResult.questionIndex,
            questionType: qResult.questionType,
            isAttempted: qResult.isAttempted,
            candidateAnswer: qResult.candidateAnswer,
            candidateAnswerKeys: Object.keys(qResult.candidateAnswer || {}),
            hasTextAnswer: !!qResult.candidateAnswer?.textAnswer,
            hasCode: !!qResult.candidateAnswer?.code,
            hasSqlQuery: !!qResult.candidateAnswer?.sqlQuery,
            hasSelectedAnswers: !!qResult.candidateAnswer?.selectedAnswers,
            textAnswerLength: qResult.candidateAnswer?.textAnswer?.length || 0,
            codeLength: qResult.candidateAnswer?.code?.length || 0,
            sqlQueryLength: qResult.candidateAnswer?.sqlQuery?.length || 0,
            hasEvaluation: !!qResult.evaluation,
            hasTestResults: !!qResult.testResults,
            hasTestResult: !!qResult.testResult
          })
        })
      }
      setResults(resultsData)
    }
  }, [resultsData])

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      setError((queryError as Error).message || 'Failed to load results')
    }
  }, [queryError])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Loading results...</div>
        </div>
      </div>
    )
  }

  if (error || !results) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '600px', padding: '2rem' }}>
          <AlertCircle style={{ width: '48px', height: '48px', color: '#ef4444', margin: '0 auto 1rem' }} />
          <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Error Loading Results</div>
          <div style={{ color: '#64748b', marginBottom: '1.5rem' }}>{error || 'Results not found'}</div>
          <button
            onClick={() => router.back()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const { 
    overallSummary = {
      overall_score: 0,
      overall_max_marks: 0,
      overall_percentage: 0,
      grade: 'N/A'
    } as DetailedResults['overallSummary'], 
    keyStrengths = [], 
    areasOfImprovement = [], 
    sectionSummaries = [], 
    evaluations = {}, 
    questionResults = [], 
    passFail 
  } = results

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: '0.5rem',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              marginRight: '1rem',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ArrowLeft style={{ width: '20px', height: '20px' }} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Assessment Results
            </h1>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
              {results.candidate.name} ({results.candidate.email})
            </div>
          </div>
        </div>

        {/* Overall Score Card */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Overall Score</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e40af' }}>
                {(overallSummary?.overall_score ?? 0).toFixed(1)} / {(overallSummary?.overall_max_marks ?? 0).toFixed(1)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Percentage</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#059669' }}>
                {(overallSummary?.overall_percentage ?? 0).toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Grade</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>
                {overallSummary?.grade || 'N/A'}
              </div>
            </div>
            {passFail && (
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Pass/Fail Status</div>
                <div style={{ 
                  fontSize: '2rem', 
                  fontWeight: 700, 
                  color: passFail.isPassed ? '#059669' : '#dc2626' 
                }}>
                  {passFail.status}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Pass Threshold: {passFail.passPercentage}%
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          {/* Key Strengths */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <TrendingUp style={{ width: '24px', height: '24px', color: '#10b981', marginRight: '0.5rem' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Key Strengths</h2>
            </div>
            {keyStrengths && keyStrengths.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {keyStrengths.map((strength, index) => (
                  <li
                    key={index}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      backgroundColor: '#d1fae5',
                      borderRadius: '0.5rem',
                      border: '1px solid #10b981',
                      fontSize: '0.875rem',
                    }}
                  >
                    <CheckCircle style={{ width: '16px', height: '16px', color: '#059669', display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    {strength}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>No strengths identified yet.</div>
            )}
          </div>

          {/* Areas of Improvement */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <TrendingDown style={{ width: '24px', height: '24px', color: '#ef4444', marginRight: '0.5rem' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Areas of Improvement</h2>
            </div>
            {areasOfImprovement && areasOfImprovement.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {areasOfImprovement.map((area, index) => (
                  <li
                    key={index}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      backgroundColor: '#fee2e2',
                      borderRadius: '0.5rem',
                      border: '1px solid #ef4444',
                      fontSize: '0.875rem',
                    }}
                  >
                    <AlertCircle style={{ width: '16px', height: '16px', color: '#dc2626', display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    {area}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>No areas of improvement identified.</div>
            )}
          </div>
        </div>

        {/* Section Summaries */}
        {sectionSummaries && sectionSummaries.length > 0 && (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Section-wise Performance</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {sectionSummaries.map((section, index) => (
                <div
                  key={index}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600 }}>{section?.section_name || 'Unknown Section'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {(section?.section_score ?? 0).toFixed(1)} / {(section?.section_max_marks ?? 0).toFixed(1)} ({(section?.section_percentage ?? 0).toFixed(1)}%)
                    </div>
                  </div>
                  {section?.section_performance?.key_insights && (
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>
                      {section.section_performance.key_insights}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-Question Results */}
        {questionResults && questionResults.length > 0 && (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Question-wise Results</h2>
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {questionResults.map((qResult, index) => (
                <div
                  key={qResult.questionId || index}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    padding: '1.5rem',
                    backgroundColor: qResult.isAttempted ? '#ffffff' : '#f8fafc',
                  }}
                >
                  {/* Question Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: qResult.isAttempted ? '#d1fae5' : '#fee2e2',
                          color: qResult.isAttempted ? '#059669' : '#dc2626',
                        }}>
                          {qResult.isAttempted ? 'ATTEMPTED' : 'NOT ATTEMPTED'}
                        </span>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: '#dbeafe',
                          color: '#2563eb',
                        }}>
                          {qResult.questionType}
                        </span>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          color: '#64748b',
                        }}>
                          {qResult.section}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        Question {qResult.questionIndex + 1}
                      </h3>
                      <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.5' }}>
                        {qResult.questionText}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Score</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: qResult.score > 0 ? '#059669' : '#dc2626' }}>
                        {qResult.score.toFixed(1)} / {qResult.maxMarks}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                        {qResult.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Candidate Answer */}
                  {qResult.isAttempted ? (
                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                        Candidate Answer:
                      </div>
                      
                      {/* MCQ Selected Answers - Only for MCQ questions */}
                      {qResult.questionType === 'MCQ' && qResult.candidateAnswer.selectedAnswers && qResult.candidateAnswer.selectedAnswers.length > 0 && (
                        <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                          Selected: {qResult.candidateAnswer.selectedAnswers.join(', ')}
                        </div>
                      )}
                      
                      {/* Text Answer - Only for Subjective and PseudoCode questions */}
                      {(qResult.questionType === 'Subjective' || qResult.questionType === 'PseudoCode') && qResult.candidateAnswer.textAnswer && (
                        <div style={{
                          padding: '0.75rem',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          color: '#374151',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '300px',
                          overflowY: 'auto',
                        }}>
                          {qResult.candidateAnswer.textAnswer}
                        </div>
                      )}
                      
                      {/* Code Answer - Only for CODING and AIML questions */}
                      {(qResult.questionType?.toUpperCase() === 'CODING' || qResult.questionType?.toUpperCase() === 'AIML') && qResult.candidateAnswer.code && (
                        <div>
                          <div style={{
                            padding: '0.75rem',
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                            color: '#e2e8f0',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '400px',
                            overflowY: 'auto',
                          }}>
                            {qResult.candidateAnswer.code}
                          </div>
                          
                          {/* AIML Outputs */}
                          {(qResult.questionType?.toUpperCase() === 'AIML' || qResult.questionType === 'AIML') && qResult.aimlOutputs && qResult.aimlOutputs.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                                Execution Outputs:
                              </div>
                              <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {qResult.aimlOutputs.map((output: any, outputIdx: number) => (
                                  <div
                                    key={outputIdx}
                                    style={{
                                      padding: '1rem',
                                      backgroundColor: '#ffffff',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '0.375rem',
                                    }}
                                  >
                                    {(() => {
                                      // Check if output contains image
                                      const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
                                      if (outputStr.includes('[Image: data:image/')) {
                                        const parts = outputStr.split('[Image: data:image/');
                                        return (
                                          <>
                                            {parts.map((part: string, idx: number) => {
                                              if (idx === 0 && part.trim()) {
                                                return (
                                                  <div key={`text-${idx}`} style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', marginBottom: '0.5rem' }}>
                                                    {part}
                                                  </div>
                                                );
                                              }
                                              const [imgType, ...rest] = part.split(']');
                                              if (imgType) {
                                                const [format, imgData] = imgType.split(';base64,');
                                                const textAfter = rest.join(']');
                                                return (
                                                  <div key={`img-${idx}`} style={{ marginBottom: '0.5rem' }}>
                                                    <img 
                                                      src={`data:image/${format};base64,${imgData}`} 
                                                      alt="Output" 
                                                      style={{ maxWidth: '100%', backgroundColor: '#ffffff', borderRadius: '0.25rem', border: '1px solid #e2e8f0' }}
                                                    />
                                                    {textAfter.trim() && (
                                                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
                                                        {textAfter}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              }
                                              return null;
                                            })}
                                          </>
                                        );
                                      }
                                      
                                      // Regular text output
                                      if (outputStr.includes('[error]') || outputStr.includes('[stderr]') || outputStr.includes('Error:')) {
                                        return (
                                          <div style={{
                                            padding: '0.75rem',
                                            backgroundColor: '#fee2e2',
                                            border: '1px solid #ef4444',
                                            borderRadius: '0.25rem',
                                            fontFamily: 'monospace',
                                            fontSize: '0.75rem',
                                            color: '#dc2626',
                                            whiteSpace: 'pre-wrap',
                                            maxHeight: '300px',
                                            overflowY: 'auto',
                                          }}>
                                            {outputStr}
                                          </div>
                                        );
                                      }
                                      
                                      return (
                                        <div style={{
                                          padding: '0.75rem',
                                          backgroundColor: '#f8fafc',
                                          borderRadius: '0.25rem',
                                          fontFamily: 'monospace',
                                          fontSize: '0.75rem',
                                          whiteSpace: 'pre-wrap',
                                          maxHeight: '300px',
                                          overflowY: 'auto',
                                        }}>
                                          {outputStr}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* SQL Query - Only for SQL questions */}
                      {(qResult.questionType?.toUpperCase() === 'SQL' || qResult.questionType === 'SQL') && qResult.candidateAnswer.sqlQuery && (
                        <div style={{
                          padding: '0.75rem',
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          color: '#e2e8f0',
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '300px',
                          overflowY: 'auto',
                        }}>
                          {qResult.candidateAnswer.sqlQuery}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fee2e2' }}>
                      <div style={{ fontSize: '0.875rem', color: '#dc2626', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>⚠️</span>
                        <span>This question was not attempted by the candidate.</span>
                      </div>
                    </div>
                  )}

                  {/* Test Case Results (Coding) - Only for CODING questions */}
                  {(qResult.questionType?.toUpperCase() === 'CODING' || qResult.questionType === 'Coding') && qResult.testResults && qResult.testResults.length > 0 && (
                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>
                        Test Case Results ({qResult.testResults.filter((t: any) => t.passed).length} / {qResult.testResults.length} passed):
                      </div>
                      <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {qResult.testResults.map((test: any, testIdx: number) => (
                          <div
                            key={testIdx}
                            style={{
                              padding: '1rem',
                              backgroundColor: '#ffffff',
                              border: `1px solid ${test.passed ? '#10b981' : '#ef4444'}`,
                              borderRadius: '0.375rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: test.passed ? '#10b981' : '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}>
                                {test.passed ? '✓' : '✗'}
                              </div>
                              <div style={{ fontWeight: 600, color: '#374151', fontSize: '0.875rem' }}>
                                Test Case {testIdx + 1} - {test.passed ? 'Passed' : 'Failed'}
                              </div>
                              {(test.time || test.memory) && (
                                <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b' }}>
                                  {test.time && `⏱️ ${test.time}s`} {test.memory && `💾 ${test.memory} KB`}
                                </div>
                              )}
                            </div>
                            
                            {/* Input */}
                            {test.input && (
                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Input:</div>
                                <div style={{
                                  padding: '0.5rem',
                                  backgroundColor: '#f1f5f9',
                                  borderRadius: '0.25rem',
                                  fontFamily: 'monospace',
                                  fontSize: '0.75rem',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: '150px',
                                  overflowY: 'auto',
                                }}>
                                  {test.input}
                                </div>
                              </div>
                            )}
                            
                            {/* Expected Output */}
                            {test.expected_output !== undefined && (
                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Expected Output:</div>
                                <div style={{
                                  padding: '0.5rem',
                                  backgroundColor: '#d1fae5',
                                  borderRadius: '0.25rem',
                                  fontFamily: 'monospace',
                                  fontSize: '0.75rem',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: '150px',
                                  overflowY: 'auto',
                                }}>
                                  {test.expected_output || '(empty)'}
                                </div>
                              </div>
                            )}
                            
                            {/* Actual Output */}
                            {(test.actual_output !== undefined || test.stdout) && (
                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Actual Output:</div>
                                <div style={{
                                  padding: '0.5rem',
                                  backgroundColor: test.passed ? '#d1fae5' : '#fee2e2',
                                  borderRadius: '0.25rem',
                                  fontFamily: 'monospace',
                                  fontSize: '0.75rem',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: '150px',
                                  overflowY: 'auto',
                                }}>
                                  {test.actual_output || test.stdout || '(empty)'}
                                </div>
                              </div>
                            )}
                            
                            {/* Error Messages */}
                            {(test.error || test.stderr || test.compile_output) && (
                              <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.25rem' }}>
                                  {test.compile_output ? 'Compilation Error:' : test.stderr ? 'Runtime Error:' : 'Error:'}
                                </div>
                                <div style={{
                                  padding: '0.5rem',
                                  backgroundColor: '#fee2e2',
                                  borderRadius: '0.25rem',
                                  fontFamily: 'monospace',
                                  fontSize: '0.75rem',
                                  color: '#dc2626',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: '200px',
                                  overflowY: 'auto',
                                }}>
                                  {test.compile_output || test.stderr || test.error}
                                </div>
                              </div>
                            )}
                            
                            {/* Status */}
                            {test.status && test.status !== 'accepted' && (
                              <div style={{ fontSize: '0.75rem', color: '#dc2626', fontStyle: 'italic' }}>
                                Status: {test.status}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SQL Test Result - Only for SQL questions */}
                  {(qResult.questionType?.toUpperCase() === 'SQL' || qResult.questionType === 'SQL') && qResult.testResult && (
                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>
                        SQL Execution Result:
                      </div>
                      <div style={{
                        padding: '1rem',
                        backgroundColor: '#ffffff',
                        border: `1px solid ${qResult.testResult.passed ? '#10b981' : '#ef4444'}`,
                        borderRadius: '0.375rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: qResult.testResult.passed ? '#10b981' : '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}>
                            {qResult.testResult.passed ? '✓' : '✗'}
                          </div>
                          <div style={{ fontWeight: 600, color: '#374151', fontSize: '0.875rem' }}>
                            {qResult.testResult.passed ? 'Query Executed Successfully' : 'Query Failed'}
                          </div>
                          {(qResult.testResult.time || qResult.testResult.memory) && (
                            <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b' }}>
                              {qResult.testResult.time && `⏱️ ${qResult.testResult.time}s`} {qResult.testResult.memory && `💾 ${qResult.testResult.memory} KB`}
                            </div>
                          )}
                        </div>
                        
                        {/* Expected Output */}
                        {qResult.testResult.expected_output && (
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Expected Result:</div>
                            <div style={{
                              padding: '0.5rem',
                              backgroundColor: '#d1fae5',
                              borderRadius: '0.25rem',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              whiteSpace: 'pre-wrap',
                              maxHeight: '200px',
                              overflowY: 'auto',
                            }}>
                              {typeof qResult.testResult.expected_output === 'string' 
                                ? qResult.testResult.expected_output 
                                : JSON.stringify(qResult.testResult.expected_output, null, 2)}
                            </div>
                          </div>
                        )}
                        
                        {/* Actual Output */}
                        {(qResult.testResult.user_output || qResult.testResult.output) && (
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Actual Result:</div>
                            <div style={{
                              padding: '0.5rem',
                              backgroundColor: qResult.testResult.passed ? '#d1fae5' : '#fee2e2',
                              borderRadius: '0.25rem',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              whiteSpace: 'pre-wrap',
                              maxHeight: '200px',
                              overflowY: 'auto',
                            }}>
                              {typeof (qResult.testResult.user_output || qResult.testResult.output) === 'string'
                                ? (qResult.testResult.user_output || qResult.testResult.output)
                                : JSON.stringify(qResult.testResult.user_output || qResult.testResult.output, null, 2)}
                            </div>
                          </div>
                        )}
                        
                        {/* Error Messages */}
                        {qResult.testResult.error && (
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.25rem' }}>Error:</div>
                            <div style={{
                              padding: '0.5rem',
                              backgroundColor: '#fee2e2',
                              borderRadius: '0.25rem',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              color: '#dc2626',
                              whiteSpace: 'pre-wrap',
                              maxHeight: '200px',
                              overflowY: 'auto',
                            }}>
                              {qResult.testResult.error}
                            </div>
                          </div>
                        )}
                        
                        {/* Status */}
                        {qResult.testResult.status && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Status: {qResult.testResult.status}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Evaluation Feedback */}
                  {qResult.evaluation && qResult.evaluation.feedback && (
                    <div style={{ padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                        AI Feedback:
                      </div>
                      {qResult.evaluation.feedback.summary && (
                        <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                          {qResult.evaluation.feedback.summary}
                        </div>
                      )}
                      {qResult.evaluation.feedback.strengths && qResult.evaluation.feedback.strengths.length > 0 && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', marginBottom: '0.25rem' }}>Strengths:</div>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                            {qResult.evaluation.feedback.strengths.map((s: string, idx: number) => (
                              <li key={idx}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {qResult.evaluation.feedback.weaknesses && qResult.evaluation.feedback.weaknesses.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.25rem' }}>Areas for Improvement:</div>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                            {qResult.evaluation.feedback.weaknesses.map((w: string, idx: number) => (
                              <li key={idx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skill Breakdown */}
        {overallSummary.skill_matrix && overallSummary.skill_matrix.length > 0 && (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <Target style={{ width: '24px', height: '24px', color: '#3b82f6', marginRight: '0.5rem' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Skill Breakdown</h2>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {overallSummary.skill_matrix.map((category: any, index: number) => (
                <div key={index} style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '1rem' }}>
                    {category.skill_category}
                  </div>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {category.sub_skills?.map((skill: any, skillIndex: number) => (
                      <div key={skillIndex} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.875rem' }}>{skill?.skill || 'Unknown Skill'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                            {(skill?.score_percentage ?? 0).toFixed(1)}%
                          </div>
                          <div style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: skill.proficiency === 'Expert' ? '#d1fae5' : 
                                          skill.proficiency === 'Advanced' ? '#dbeafe' :
                                          skill.proficiency === 'Intermediate' ? '#fef3c7' : '#fee2e2',
                            color: skill.proficiency === 'Expert' ? '#059669' :
                                   skill.proficiency === 'Advanced' ? '#2563eb' :
                                   skill.proficiency === 'Intermediate' ? '#d97706' : '#dc2626',
                          }}>
                            {skill.proficiency}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Improvement Plan */}
        {overallSummary.comprehensive_improvement_plan && (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <BookOpen style={{ width: '24px', height: '24px', color: '#3b82f6', marginRight: '0.5rem' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Improvement Plan</h2>
            </div>
            
            {overallSummary.comprehensive_improvement_plan.immediate_focus_areas && 
             overallSummary.comprehensive_improvement_plan.immediate_focus_areas.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#dc2626' }}>
                  Immediate Focus Areas
                </h3>
                {overallSummary.comprehensive_improvement_plan.immediate_focus_areas.map((area: any, index: number) => (
                  <div key={index} style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{area.area}</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>{area.reason}</div>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                      {area.action_items?.map((item: string, itemIndex: number) => (
                        <li key={itemIndex} style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {overallSummary.comprehensive_improvement_plan.short_term_goals && 
             overallSummary.comprehensive_improvement_plan.short_term_goals.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#d97706' }}>
                  Short-term Goals
                </h3>
                {overallSummary.comprehensive_improvement_plan.short_term_goals.map((goal: any, index: number) => (
                  <div key={index} style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fffbeb', borderRadius: '0.5rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{goal.goal}</div>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                      {goal.steps?.map((step: string, stepIndex: number) => (
                        <li key={stepIndex} style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>{step}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Personalized Recommendations */}
        {overallSummary.personalized_recommendations && (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Personalized Recommendations</h2>
            
            {overallSummary.personalized_recommendations.learning_path && 
             overallSummary.personalized_recommendations.learning_path.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Learning Path</h3>
                <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  {overallSummary.personalized_recommendations.learning_path.map((skill: string, index: number) => (
                    <li key={index} style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>{skill}</li>
                  ))}
                </ol>
              </div>
            )}

            {overallSummary.personalized_recommendations.practice_resources && 
             overallSummary.personalized_recommendations.practice_resources.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Practice Resources</h3>
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  {overallSummary.personalized_recommendations.practice_resources.map((resource: any, index: number) => (
                    <li key={index} style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      {resource.name || resource}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

