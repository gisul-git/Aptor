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
        console.log('Submission data received:', JSON.stringify(data, null, 2))
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
      <div style={{ backgroundColor: "#F8F9FA", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "500px", padding: "2rem" }}>
          <div style={{ 
            width: "80px", 
            height: "80px", 
            margin: "0 auto 2rem",
            border: "4px solid #E5E7EB",
            borderTop: "4px solid #667eea",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem", color: "#1F2937" }}>
            Evaluating Your Design
          </h2>
          <p style={{ fontSize: "1.0625rem", color: "#6B7280", lineHeight: "1.6" }}>
            Our AI is analyzing your submission using advanced design principles and technical metrics. This typically takes 10-15 seconds.
          </p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  if (error || !submission) {
    return (
      <div style={{ backgroundColor: "#F8F9FA", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "500px", padding: "2rem" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>⚠️</div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem", color: "#DC2626" }}>
            Unable to Load Results
          </h2>
          <p style={{ fontSize: "1.0625rem", color: "#6B7280", marginBottom: "2rem", lineHeight: "1.6" }}>
            {error || 'The submission could not be found. It may have been deleted or the link is incorrect.'}
          </p>
          <button
            onClick={() => router.push('/design/tests')}
            style={{
              padding: "1rem 2rem",
              border: "none",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#ffffff",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)"
            }}
          >
            ← Back to Tests
          </button>
        </div>
      </div>
    )
  }

  const isEvaluating = submission.final_score === 0 && !submission.feedback

  return (
    <div style={{ backgroundColor: "#F8F9FA", minHeight: "100vh", padding: "2rem 0" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1.5rem" }}>
        {/* Professional Header */}
        <div style={{ 
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "16px",
          padding: "3rem 2rem",
          marginBottom: "2rem",
          boxShadow: "0 10px 40px rgba(102, 126, 234, 0.2)",
          textAlign: "center",
          color: "#ffffff"
        }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>
            {isEvaluating ? '⏳' : submission.final_score >= 80 ? '🏆' : submission.final_score >= 60 ? '⭐' : '📊'}
          </div>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: "0.75rem", color: "#ffffff" }}>
            {isEvaluating ? 'Evaluation in Progress' : 'Design Assessment Results'}
          </h1>
          <p style={{ fontSize: "1.125rem", opacity: 0.9, maxWidth: "600px", margin: "0 auto" }}>
            {isEvaluating 
              ? 'Our AI is analyzing your design submission. This typically takes 10-15 seconds.'
              : 'Comprehensive evaluation of your design work with detailed feedback'}
          </p>
        </div>

        {!isEvaluating && (
          <>
            {/* Professional Score Cards */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
              gap: "1.5rem", 
              marginBottom: "2.5rem" 
            }}>
                {/* Final Score - Prominent */}
                <div style={{ 
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "12px",
                  padding: "2rem",
                  textAlign: "center",
                  color: "#ffffff",
                  boxShadow: "0 8px 24px rgba(102, 126, 234, 0.25)",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  <div style={{ position: "absolute", top: "-20px", right: "-20px", fontSize: "8rem", opacity: 0.1 }}>
                    {submission.final_score >= 80 ? '🏆' : submission.final_score >= 60 ? '⭐' : '📊'}
                  </div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", opacity: 0.9, textTransform: "uppercase", letterSpacing: "1px" }}>
                    Overall Score
                  </div>
                  <div style={{ fontSize: "4rem", fontWeight: 800, marginBottom: "0.5rem", lineHeight: 1 }}>
                    {Math.round(submission.final_score)}
                  </div>
                  <div style={{ fontSize: "1rem", opacity: 0.9 }}>out of 100</div>
                  <div style={{ 
                    marginTop: "1rem", 
                    padding: "0.5rem 1rem", 
                    backgroundColor: "rgba(255,255,255,0.2)", 
                    borderRadius: "20px",
                    fontSize: "0.875rem",
                    fontWeight: 600
                  }}>
                    {submission.final_score >= 80 ? 'Excellent' : submission.final_score >= 60 ? 'Good' : 'Needs Improvement'}
                  </div>
                </div>

                {/* Rule-Based Score */}
                <div style={{ 
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  padding: "2rem",
                  textAlign: "center",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  border: "1px solid #E5E7EB"
                }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📐</div>
                  <div style={{ fontSize: "0.875rem", color: "#6B7280", fontWeight: 600, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Technical Analysis
                  </div>
                  <div style={{ fontSize: "3rem", fontWeight: 700, color: "#1F2937", marginBottom: "0.5rem" }}>
                    {Math.round(submission.rule_based_score)}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>Rule-based metrics</div>
                  <div style={{ 
                    marginTop: "1rem",
                    width: "100%",
                    height: "6px",
                    backgroundColor: "#E5E7EB",
                    borderRadius: "3px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: `${submission.rule_based_score}%`,
                      height: "100%",
                      backgroundColor: getScoreColor(submission.rule_based_score),
                      transition: "width 0.5s ease"
                    }}></div>
                  </div>
                </div>

                {/* AI-Based Score */}
                <div style={{ 
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  padding: "2rem",
                  textAlign: "center",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  border: "1px solid #E5E7EB"
                }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🤖</div>
                  <div style={{ fontSize: "0.875rem", color: "#6B7280", fontWeight: 600, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    AI Evaluation
                  </div>
                  <div style={{ fontSize: "3rem", fontWeight: 700, color: "#1F2937", marginBottom: "0.5rem" }}>
                    {Math.round(submission.ai_based_score)}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>Design quality</div>
                  <div style={{ 
                    marginTop: "1rem",
                    width: "100%",
                    height: "6px",
                    backgroundColor: "#E5E7EB",
                    borderRadius: "3px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: `${submission.ai_based_score}%`,
                      height: "100%",
                      backgroundColor: getScoreColor(submission.ai_based_score),
                      transition: "width 0.5s ease"
                    }}></div>
                  </div>
                </div>
              </div>

              {/* Overall Summary - Professional Card */}
              {submission.feedback?.rule_based?.overall_summary && (
                <div style={{ marginBottom: "2rem" }}>
                  <div style={{ 
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    padding: "2rem",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    border: "1px solid #E5E7EB",
                    borderLeft: "4px solid #667eea"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5rem" }}>
                      <div style={{ fontSize: "2rem", marginRight: "1rem" }}>💬</div>
                      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
                        Overall Feedback
                      </h2>
                    </div>
                    <p style={{ fontSize: "1.125rem", color: "#374151", lineHeight: "1.8", margin: 0 }}>
                      {submission.feedback.rule_based.overall_summary}
                    </p>
                  </div>
                </div>
              )}

              {/* Question Context - Professional */}
              {submission.feedback?.question_context && (
                <div style={{ marginBottom: "2rem" }}>
                  <div style={{ 
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    padding: "1.5rem 2rem",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    border: "1px solid #E5E7EB"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
                      <div style={{ fontSize: "1.5rem", marginRight: "0.75rem" }}>📋</div>
                      <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
                        Challenge Details
                      </h3>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.25rem" }}>Title</div>
                        <div style={{ fontSize: "1rem", color: "#1F2937", fontWeight: 600 }}>{submission.feedback.question_context.title}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.25rem" }}>Role</div>
                        <div style={{ fontSize: "1rem", color: "#1F2937", fontWeight: 600 }}>{submission.feedback.question_context.role?.replace(/_/g, ' ')}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.25rem" }}>Difficulty</div>
                        <div style={{ fontSize: "1rem", color: "#1F2937", fontWeight: 600 }}>{submission.feedback.question_context.difficulty}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.25rem" }}>Task Type</div>
                        <div style={{ fontSize: "1rem", color: "#1F2937", fontWeight: 600 }}>{submission.feedback.question_context.task_type?.replace(/_/g, ' ')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rule-Based Feedback - Professional Cards */}
              {submission.feedback?.rule_based?.feedback && Object.keys(submission.feedback.rule_based.feedback).length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "2rem", marginRight: "1rem" }}>📊</div>
                    <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
                      Technical Analysis
                    </h2>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
                    {Object.entries(submission.feedback.rule_based.feedback).map(([key, feedbackText]: [string, any]) => {
                      const score = submission.feedback?.rule_based?.scores?.[key] || 0;
                      const percentage = (score / 20) * 100;
                      return (
                        <div 
                          key={key}
                          style={{ 
                            backgroundColor: "#ffffff",
                            borderRadius: "12px",
                            padding: "1.5rem",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                            border: "1px solid #E5E7EB",
                            transition: "transform 0.2s, box-shadow 0.2s"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#1F2937", textTransform: "capitalize", margin: 0 }}>
                              {key.replace(/_/g, ' ')}
                            </h3>
                            <div style={{
                              padding: "0.375rem 0.875rem",
                              borderRadius: "20px",
                              fontSize: "0.875rem",
                              fontWeight: 700,
                              color: "#ffffff",
                              backgroundColor: getScoreColor(percentage),
                              minWidth: "60px",
                              textAlign: "center"
                            }}>
                              {Math.round(score)}/20
                            </div>
                          </div>
                          <div style={{ 
                            width: "100%",
                            height: "8px",
                            backgroundColor: "#E5E7EB",
                            borderRadius: "4px",
                            overflow: "hidden",
                            marginBottom: "1rem"
                          }}>
                            <div style={{
                              width: `${percentage}%`,
                              height: "100%",
                              backgroundColor: getScoreColor(percentage),
                              transition: "width 0.5s ease"
                            }}></div>
                          </div>
                          <p style={{ fontSize: "0.9375rem", color: "#6B7280", lineHeight: "1.6", margin: 0 }}>
                            {feedbackText}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI-Based Feedback - Professional */}
              {submission.feedback?.ai_based && (
                <div style={{ marginBottom: "2rem" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5rem" }}>
                    <div style={{ fontSize: "2rem", marginRight: "1rem" }}>🤖</div>
                    <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
                      AI Design Analysis
                    </h2>
                  </div>
                  
                  {submission.feedback.ai_based.overall && (
                    <div style={{ 
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      padding: "1.5rem 2rem",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      border: "1px solid #E5E7EB",
                      marginBottom: "1.5rem"
                    }}>
                      <p style={{ fontSize: "1.0625rem", color: "#374151", lineHeight: "1.7", margin: 0 }}>
                        {submission.feedback.ai_based.overall}
                      </p>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
                    {submission.feedback.ai_based.strengths && submission.feedback.ai_based.strengths.length > 0 && (
                      <div style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "12px",
                        padding: "1.5rem",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        border: "1px solid #E5E7EB",
                        borderLeft: "4px solid #10B981"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
                          <div style={{ fontSize: "1.5rem", marginRight: "0.75rem" }}>✅</div>
                          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669", margin: 0 }}>
                            Strengths
                          </h3>
                        </div>
                        <ul style={{ paddingLeft: "1.5rem", margin: 0, color: "#374151" }}>
                          {submission.feedback.ai_based.strengths.map((strength: string, idx: number) => (
                            <li key={idx} style={{ marginBottom: "0.75rem", fontSize: "0.9375rem", lineHeight: "1.6" }}>{strength}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {submission.feedback.ai_based.improvements && submission.feedback.ai_based.improvements.length > 0 && (
                      <div style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "12px",
                        padding: "1.5rem",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        border: "1px solid #E5E7EB",
                        borderLeft: "4px solid #F59E0B"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: "1rem" }}>
                          <div style={{ fontSize: "1.5rem", marginRight: "0.75rem" }}>💡</div>
                          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#D97706", margin: 0 }}>
                            Areas for Improvement
                          </h3>
                        </div>
                        <ul style={{ paddingLeft: "1.5rem", margin: 0, color: "#374151" }}>
                          {submission.feedback.ai_based.improvements.map((improvement: string, idx: number) => (
                            <li key={idx} style={{ marginBottom: "0.75rem", fontSize: "0.9375rem", lineHeight: "1.6" }}>{improvement}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons - Professional */}
              <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "3rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => router.push('/design/tests')}
                  style={{
                    padding: "1rem 2rem",
                    border: "2px solid #667eea",
                    borderRadius: "10px",
                    backgroundColor: "#ffffff",
                    color: "#667eea",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "#667eea";
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.color = "#667eea";
                  }}
                >
                  ← Back to Tests
                </button>
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: "1rem 2rem",
                    border: "none",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                    color: "#ffffff",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(16, 185, 129, 0.4)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
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

export const getServerSideProps: GetServerSideProps = requireAuth