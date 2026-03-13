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
  }
  ai_based?: {
    score: number
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
      setError('Failed to fetch evaluation results')
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#059669'
    if (score >= 60) return '#D97706'
    return '#DC2626'
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#F8F9FA", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "500px", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem", color: "#1F2937" }}>
            Evaluating Your Design...
          </h2>
          <p style={{ fontSize: "1rem", color: "#6B7280" }}>
            Please wait while we analyze your submission.
          </p>
        </div>
      </div>
    )
  }

  if (error || !submission) {
    return (
      <div style={{ backgroundColor: "#F8F9FA", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "500px", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem", color: "#DC2626" }}>
            Unable to Load Results
          </h2>
          <p style={{ fontSize: "1rem", color: "#6B7280", marginBottom: "2rem" }}>
            {error || 'Submission not found'}
          </p>
          <button
            onClick={() => router.push('/design/tests')}
            style={{
              padding: "1rem 2rem",
              border: "none",
              borderRadius: "10px",
              background: "#667eea",
              color: "#ffffff",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Back to Tests
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "#F8F9FA", minHeight: "100vh", padding: "2rem 0" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ 
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "16px",
          padding: "3rem 2rem",
          marginBottom: "2rem",
          textAlign: "center",
          color: "#ffffff"
        }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            Design Assessment Results
          </h1>
          <p style={{ fontSize: "1.125rem", opacity: 0.9 }}>
            Comprehensive evaluation of your design work
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginBottom: "2.5rem" }}>
          <div style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", borderRadius: "12px", padding: "2rem", textAlign: "center", color: "#ffffff" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", textTransform: "uppercase" }}>
              Overall Score
            </div>
            <div style={{ fontSize: "4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
              {Math.round(submission.final_score)}
            </div>
            <div style={{ fontSize: "1rem" }}>out of 100</div>
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "2rem", textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: "0.875rem", color: "#6B7280", fontWeight: 600, marginBottom: "0.75rem", textTransform: "uppercase" }}>
              Technical Analysis
            </div>
            <div style={{ fontSize: "3rem", fontWeight: 700, color: "#1F2937", marginBottom: "0.5rem" }}>
              {Math.round(submission.rule_based_score)}
            </div>
            <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>Rule-based metrics</div>
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "2rem", textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: "0.875rem", color: "#6B7280", fontWeight: 600, marginBottom: "0.75rem", textTransform: "uppercase" }}>
              AI Evaluation
            </div>
            <div style={{ fontSize: "3rem", fontWeight: 700, color: "#1F2937", marginBottom: "0.5rem" }}>
              {Math.round(submission.ai_based_score)}
            </div>
            <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>Design quality</div>
          </div>
        </div>

        {submission.feedback?.rule_based?.overall_summary && (
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "2rem", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", borderLeft: "4px solid #667eea" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1F2937", marginBottom: "1rem" }}>
                Overall Feedback
              </h2>
              <p style={{ fontSize: "1.125rem", color: "#374151", lineHeight: "1.8" }}>
                {submission.feedback.rule_based.overall_summary}
              </p>
            </div>
          </div>
        )}

        {submission.feedback?.question_context && (
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "1.5rem 2rem", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1F2937", marginBottom: "1rem" }}>
                Challenge Details
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.25rem" }}>Title</div>
                  <div style={{ fontSize: "1rem", color: "#1F2937", fontWeight: 600 }}>{submission.feedback.question_context.title}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.25rem" }}>Role</div>
                  <div style={{ fontSize: "1rem", color: "#1F2937", fontWeight: 600 }}>{submission.feedback.question_context.role?.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.25rem" }}>Difficulty</div>
                  <div style={{ fontSize: "1rem", color: "#1F2937", fontWeight: 600 }}>{submission.feedback.question_context.difficulty}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.25rem" }}>Task Type</div>
                  <div style={{ fontSize: "1rem", color: "#1F2937", fontWeight: 600 }}>{submission.feedback.question_context.task_type?.replace(/_/g, ' ')}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {submission.feedback?.rule_based?.feedback && Object.keys(submission.feedback.rule_based.feedback).length > 0 && (
          <div style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#1F2937", marginBottom: "1.5rem" }}>
              Technical Analysis
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
              {Object.entries(submission.feedback.rule_based.feedback).map(([key, feedbackText]: [string, any]) => {
                const score = submission.feedback?.rule_based?.scores?.[key] || 0;
                const percentage = (score / 20) * 100;
                return (
                  <div key={key} style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                      <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#1F2937", textTransform: "capitalize" }}>
                        {key.replace(/_/g, ' ')}
                      </h3>
                      <div style={{ padding: "0.375rem 0.875rem", borderRadius: "20px", fontSize: "0.875rem", fontWeight: 700, color: "#ffffff", backgroundColor: getScoreColor(percentage) }}>
                        {Math.round(score)}/20
                      </div>
                    </div>
                    <p style={{ fontSize: "0.9375rem", color: "#6B7280", lineHeight: "1.6" }}>
                      {feedbackText}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {submission.feedback?.ai_based && (
          <div style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#1F2937", marginBottom: "1.5rem" }}>
              AI Design Analysis
            </h2>
            
            {submission.feedback.ai_based.overall && (
              <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "1.5rem 2rem", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "1.0625rem", color: "#374151", lineHeight: "1.7" }}>
                  {submission.feedback.ai_based.overall}
                </p>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
              {submission.feedback.ai_based.strengths && submission.feedback.ai_based.strengths.length > 0 && (
                <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", borderLeft: "4px solid #10B981" }}>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669", marginBottom: "1rem" }}>
                    Strengths
                  </h3>
                  <ul style={{ paddingLeft: "1.5rem", color: "#374151" }}>
                    {submission.feedback.ai_based.strengths.map((strength: string, idx: number) => (
                      <li key={idx} style={{ marginBottom: "0.75rem", fontSize: "0.9375rem", lineHeight: "1.6" }}>{strength}</li>
                    ))}
                  </ul>
                </div>
              )}

              {submission.feedback.ai_based.improvements && submission.feedback.ai_based.improvements.length > 0 && (
                <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", borderLeft: "4px solid #F59E0B" }}>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#D97706", marginBottom: "1rem" }}>
                    Areas for Improvement
                  </h3>
                  <ul style={{ paddingLeft: "1.5rem", color: "#374151" }}>
                    {submission.feedback.ai_based.improvements.map((improvement: string, idx: number) => (
                      <li key={idx} style={{ marginBottom: "0.75rem", fontSize: "0.9375rem", lineHeight: "1.6" }}>{improvement}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "3rem" }}>
          <button
            onClick={() => router.push('/design/tests')}
            style={{ padding: "1rem 2rem", border: "2px solid #667eea", borderRadius: "10px", backgroundColor: "#ffffff", color: "#667eea", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}
          >
            Back to Tests
          </button>
          <button
            onClick={() => window.print()}
            style={{ padding: "1rem 2rem", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", color: "#ffffff", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}
          >
            Download Results
          </button>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth
