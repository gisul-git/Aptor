import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'

interface EvaluationFeedback {
  overall?: string
  strengths?: string[]
  improvements?: string[]
  rule_based?: {
    score: number
    scores?: Record<string, number>
    feedback?: Record<string, string>
    overall_summary?: string
    details?: {
      element_count?: { score: number; feedback: string }
      color_usage?: { score: number; feedback: string }
      layout_structure?: { score: number; feedback: string }
      interaction_quality?: { score: number; feedback: string }
    }
  }
  ai_based?: {
    score: number
    feedback?: string
    overall?: string
    strengths?: string[]
    improvements?: string[]
  }
  question_context?: {
    title: string
    role: string
    difficulty: string
    task_type: string
  }
  final_score?: number
  weights?: any
}

interface Submission {
  submission_id: string
  rule_based_score: number
  ai_based_score: number
  final_score: number
  feedback: EvaluationFeedback
}

export default function DesignResultsPage() {
  const router = useRouter()
  const { submissionId } = router.query
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design'

  useEffect(() => {
    if (submissionId) {
      fetchResults()
      // Poll for results every 3 seconds if evaluation is not complete
      const interval = setInterval(() => {
        if (submission && submission.final_score === 0) {
          fetchResults()
        }
      }, 3000)
      
      return () => clearInterval(interval)
    }
  }, [submissionId])

  const fetchResults = async () => {
    try {
      const response = await fetch(`${API_URL}/submissions/${submissionId}/evaluation`)
      if (response.ok) {
        const data = await response.json()
        setSubmission(data)
        setLoading(false)
      } else {
        setError('Failed to fetch evaluation results')
        setLoading(false)
      }
    } catch (err) {
      console.error('Failed to fetch results:', err)
      setError('Failed to fetch evaluation results')
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#059669'
    if (score >= 60) return '#D97706'
    return '#DC2626'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return '#D1FAE5'
    if (score >= 60) return '#FEF3C7'
    return '#FEE2E2'
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem", color: "#7C3AED" }}>
              Evaluating Your Design...
            </h2>
            <p style={{ color: "#64748b" }}>
              Our AI is analyzing your submission. This may take a few moments.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !submission) {
    return (
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>❌</div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem", color: "#DC2626" }}>
              Error Loading Results
            </h2>
            <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
              {error || 'Submission not found'}
            </p>
            <button
              onClick={() => router.push('/design/tests')}
              className="btn-primary"
            >
              Back to Tests
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isEvaluating = submission.final_score === 0 && !submission.feedback

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div className="card">
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>
              {isEvaluating ? '⏳' : submission.final_score >= 80 ? '🎉' : submission.final_score >= 60 ? '👍' : '💪'}
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem", color: "#1a1625" }}>
              {isEvaluating ? 'Evaluation in Progress' : 'Design Evaluation Complete'}
            </h1>
            <p style={{ color: "#64748b", fontSize: "1.125rem" }}>
              {isEvaluating 
                ? 'Your submission is being evaluated by our AI. Please wait...'
                : 'Here are your detailed results and feedback'}
            </p>
          </div>

          {!isEvaluating && (
            <>
              {/* Score Summary */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                gap: "1rem", 
                marginBottom: "2rem" 
              }}>
                <div style={{ 
                  padding: "1.5rem", 
                  border: "1px solid #E8B4FA", 
                  borderRadius: "0.5rem", 
                  textAlign: "center",
                  backgroundColor: "#F9F5FF"
                }}>
                  <div style={{ fontSize: "0.875rem", color: "#7C3AED", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Final Score
                  </div>
                  <div style={{ 
                    fontSize: "2.5rem", 
                    fontWeight: 700, 
                    color: getScoreColor(submission.final_score) 
                  }}>
                    {Math.round(submission.final_score)}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#64748b" }}>out of 100</div>
                </div>

                <div style={{ 
                  padding: "1.5rem", 
                  border: "1px solid #E8B4FA", 
                  borderRadius: "0.5rem", 
                  textAlign: "center" 
                }}>
                  <div style={{ fontSize: "0.875rem", color: "#7C3AED", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Rule-Based Score
                  </div>
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1a1625" }}>
                    {Math.round(submission.rule_based_score)}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Technical metrics</div>
                </div>

                <div style={{ 
                  padding: "1.5rem", 
                  border: "1px solid #E8B4FA", 
                  borderRadius: "0.5rem", 
                  textAlign: "center" 
                }}>
                  <div style={{ fontSize: "0.875rem", color: "#7C3AED", fontWeight: 600, marginBottom: "0.5rem" }}>
                    AI-Based Score
                  </div>
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1a1625" }}>
                    {Math.round(submission.ai_based_score)}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Design quality</div>
                </div>
              </div>

              {/* Overall Summary */}
              {submission.feedback?.rule_based?.overall_summary && (
                <div style={{ marginBottom: "2rem" }}>
                  <div style={{ 
                    padding: "1.5rem", 
                    border: "2px solid #7C3AED", 
                    borderRadius: "0.5rem",
                    backgroundColor: "#F9F5FF"
                  }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem", color: "#7C3AED" }}>
                      📝 Overall Feedback
                    </h2>
                    <p style={{ fontSize: "1rem", color: "#1a1625", lineHeight: "1.6" }}>
                      {submission.feedback.rule_based.overall_summary}
                    </p>
                  </div>
                </div>
              )}

              {/* Question Context */}
              {submission.feedback?.question_context && (
                <div style={{ marginBottom: "2rem" }}>
                  <div style={{ 
                    padding: "1rem", 
                    border: "1px solid #E8B4FA", 
                    borderRadius: "0.5rem",
                    backgroundColor: "#F9F5FF"
                  }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem", color: "#7C3AED" }}>
                      📋 Challenge Details
                    </h3>
                    <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                      <p><strong>Title:</strong> {submission.feedback.question_context.title}</p>
                      <p><strong>Role:</strong> {submission.feedback.question_context.role?.replace(/_/g, ' ')}</p>
                      <p><strong>Difficulty:</strong> {submission.feedback.question_context.difficulty}</p>
                      <p><strong>Task Type:</strong> {submission.feedback.question_context.task_type?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rule-Based Feedback */}
              {submission.feedback?.rule_based?.feedback && Object.keys(submission.feedback.rule_based.feedback).length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem", color: "#7C3AED" }}>
                    📊 Technical Analysis
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {Object.entries(submission.feedback.rule_based.feedback).map(([key, feedbackText]: [string, any]) => {
                      const score = submission.feedback?.rule_based?.scores?.[key] || 0;
                      return (
                        <div 
                          key={key}
                          style={{ 
                            padding: "1rem", 
                            border: "1px solid #E8B4FA", 
                            borderRadius: "0.5rem",
                            backgroundColor: "#F9F5FF"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#1a1625", textTransform: "capitalize" }}>
                              {key.replace(/_/g, ' ')}
                            </h3>
                            <span style={{
                              padding: "0.25rem 0.75rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: getScoreColor(score * 5),
                              backgroundColor: getScoreBg(score * 5),
                            }}>
                              {Math.round(score)}/20
                            </span>
                          </div>
                          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                            {feedbackText}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI-Based Feedback */}
              {submission.feedback?.ai_based && (
                <div style={{ marginBottom: "2rem" }}>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem", color: "#7C3AED" }}>
                    🤖 AI Design Analysis
                  </h2>
                  
                  {submission.feedback.ai_based.overall && (
                  <div style={{ 
                      padding: "1rem", 
                      border: "1px solid #E8B4FA", 
                      borderRadius: "0.5rem",
                      backgroundColor: "#F9F5FF",
                      marginBottom: "1rem"
                    }}>
                      <p style={{ fontSize: "0.875rem", color: "#1a1625" }}>
                        {submission.feedback.ai_based.overall}
                      </p>
                    </div>
                  )}

                  {submission.feedback.ai_based.strengths && submission.feedback.ai_based.strengths.length > 0 && (
                    <div style={{ marginBottom: "1rem" }}>
                      <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem", color: "#059669" }}>
                        ✅ Strengths
                      </h3>
                      <ul style={{ paddingLeft: "1.5rem", color: "#64748b" }}>
                        {submission.feedback.ai_based.strengths.map((strength: string, idx: number) => (
                          <li key={idx} style={{ marginBottom: "0.25rem" }}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {submission.feedback.ai_based.improvements && submission.feedback.ai_based.improvements.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem", color: "#D97706" }}>
                        💡 Areas for Improvement
                      </h3>
                      <ul style={{ paddingLeft: "1.5rem", color: "#64748b" }}>
                        {submission.feedback.ai_based.improvements.map((improvement: string, idx: number) => (
                          <li key={idx} style={{ marginBottom: "0.25rem" }}>{improvement}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "2rem" }}>
                <button
                  onClick={() => router.push('/design/tests')}
                  style={{
                    padding: "0.75rem 1.5rem",
                    border: "1px solid #7C3AED",
                    borderRadius: "0.5rem",
                    backgroundColor: "#ffffff",
                    color: "#7C3AED",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Back to Tests
                </button>
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: "0.75rem 1.5rem",
                    border: "none",
                    borderRadius: "0.5rem",
                    backgroundColor: "#10B981",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  📥 Download Results
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth(async (context) => {
  return {
    props: {},
  }
})