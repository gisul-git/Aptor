'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import axios from 'axios'
import { ArrowLeft, AlertTriangle, Clock } from 'lucide-react'
import ProctorLogsReview from '../../../../components/admin/ProctorLogsReview'

interface AnswerLog {
  answer: string
  questionType: string
  timestamp: string
  version: number
}

interface QuestionLog {
  questionIndex: number
  questionText: string
  questionType: string
  logs: AnswerLog[]
  maxScore?: number
  isMcqCorrect?: boolean
  correctAnswer?: string
  options?: string[]
}

interface Candidate {
  email: string
  name: string
  status?: "invited" | "pending" | "started" | "completed"
  invited?: boolean
  invitedAt?: string
  startedAt?: string
  completedAt?: string
  score?: number
  maxScore?: number
  attempted?: number
  notAttempted?: number
  correctAnswers?: number
  submittedAt?: string | null
  percentageScored?: number
  passPercentage?: number
  passed?: boolean
}

export default function CandidateAnalyticsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { id: assessmentId, candidateEmail: candidateEmailParam } = router.query
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [assessment, setAssessment] = useState<any>(null)
  const [answerLogs, setAnswerLogs] = useState<QuestionLog[]>([])
  const [proctorLogs, setProctorLogs] = useState<any[]>([])
  const [eventTypeLabels, setEventTypeLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [loadingProctorLogs, setLoadingProctorLogs] = useState(false)
  const [showProctorLogs, setShowProctorLogs] = useState(false)

  const candidateEmail = typeof candidateEmailParam === 'string' ? decodeURIComponent(candidateEmailParam) : ''

  useEffect(() => {
    if (!assessmentId || typeof assessmentId !== 'string' || !candidateEmail) return

    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch assessment details
        const assessmentResponse = await axios.get(`/api/assessments/get-questions?assessmentId=${assessmentId}`)
        let foundCandidateName = ''
        let foundCandidateData: Candidate | null = null
        
        if (assessmentResponse.data?.success && assessmentResponse.data?.data) {
          setAssessment(assessmentResponse.data.data)
          
          // Find candidate in assessment - check both candidates array and also try to get from candidate results
          const candidates = assessmentResponse.data.data.assessment?.candidates || []
          let foundCandidate = candidates.find((c: any) => {
            const cEmail = (c.email || '').toLowerCase().trim()
            return cEmail === candidateEmail.toLowerCase().trim()
          })
          
          // If not found in candidates array, try fetching from candidate results
          if (!foundCandidate) {
            try {
              const resultsResponse = await axios.get(`/api/assessments/get-candidate-results?assessmentId=${assessmentId}`)
              if (resultsResponse.data?.success && resultsResponse.data?.data) {
                const resultsCandidates = resultsResponse.data.data || []
                const resultCandidate = resultsCandidates.find((c: Candidate) => 
                  (c.email || '').toLowerCase().trim() === candidateEmail.toLowerCase().trim()
                )
                if (resultCandidate) {
                  foundCandidate = {
                    email: resultCandidate.email,
                    name: resultCandidate.name,
                    status: 'completed', // If in results, likely completed
                    invited: true,
                  }
                }
              }
            } catch (err) {
              console.error('Error fetching candidate results:', err)
            }
          }
          
          if (foundCandidate) {
            foundCandidateData = {
              email: foundCandidate.email || candidateEmail,
              name: foundCandidate.name || candidateEmail.split('@')[0],
              status: foundCandidate.status || (foundCandidate.invited ? 'invited' : 'pending'),
              invited: foundCandidate.invited || false,
              invitedAt: foundCandidate.invitedAt || foundCandidate.inviteSentAt || null,
              startedAt: foundCandidate.startedAt || null,
              completedAt: foundCandidate.completedAt || foundCandidate.submittedAt || null,
              score: foundCandidate.score,
              maxScore: foundCandidate.maxScore,
            }
            setCandidate(foundCandidateData)
            foundCandidateName = foundCandidateData.name
          }
        }

        // Fetch candidate analytics (only if we found the candidate)
        if (foundCandidateData) {
          setLoadingAnalytics(true)
          try {
            const logsResponse = await axios.get(
              `/api/assessments/get-answer-logs?assessmentId=${assessmentId}&candidateEmail=${encodeURIComponent(candidateEmail)}&candidateName=${encodeURIComponent(foundCandidateName)}`
            )
            if (logsResponse.data?.success) {
              setAnswerLogs(logsResponse.data.data || [])
            }
          } catch (err) {
            console.error('Error fetching answer logs:', err)
          } finally {
            setLoadingAnalytics(false)
          }
        }

        // Fetch proctor logs
        setLoadingProctorLogs(true)
        try {
          // Try multiple userId formats to match how proctoring logs might be stored
          // Format 1: email:userEmail (Priority 3 in resolveUserIdForProctoring)
          const emailUserId = `email:${candidateEmail.trim()}`;
          console.log('[Analytics] Fetching proctor logs with userId (email format):', emailUserId)
          
          let response = await fetch(`/api/proctor/logs?assessmentId=${encodeURIComponent(assessmentId)}&userId=${encodeURIComponent(emailUserId)}`)
          let data = await response.json()
          
          // If no logs found with email format, try querying all logs for the assessment
          // and filter by candidate email (handles public:token format)
          if (!data.success || !data.data || !data.data.logs || data.data.logs.length === 0) {
            console.log('[Analytics] No logs found with email format, trying all logs for assessment...')
            
            // Query all logs for the assessment (userId: "*")
            response = await fetch(`/api/proctor/logs?assessmentId=${encodeURIComponent(assessmentId)}&userId=*`)
            data = await response.json()
            
            if (data.success && data.data && data.data.logs) {
              // Filter logs by candidate email - check metadata.candidateEmail (primary) or userId format (fallback)
              const emailLower = candidateEmail.trim().toLowerCase();
              const filteredLogs = data.data.logs.filter((log: any) => {
                // Primary: Check if metadata contains candidate email (works for all userId formats)
                if (log.metadata && log.metadata.candidateEmail) {
                  const logEmail = String(log.metadata.candidateEmail).trim().toLowerCase();
                  if (logEmail === emailLower) {
                    return true;
                  }
                }
                // Fallback: Check if userId contains email (for email: format)
                if (log.userId && log.userId.startsWith('email:')) {
                  const userIdEmail = log.userId.replace('email:', '').trim().toLowerCase();
                  if (userIdEmail === emailLower) {
                    return true;
                  }
                }
                return false;
              });
              
              if (filteredLogs.length > 0) {
                console.log(`[Analytics] Found ${filteredLogs.length} logs after filtering by email (from metadata or userId)`)
                setProctorLogs(filteredLogs)
                setEventTypeLabels(data.data.eventTypeLabels || {})
              } else {
                // No logs matched - candidate might not have any violations yet
                console.log('[Analytics] No logs found for this candidate')
                setProctorLogs([])
                setEventTypeLabels(data.data.eventTypeLabels || {})
              }
            } else {
              setProctorLogs([])
              setEventTypeLabels({})
            }
          } else {
            // Found logs with email format
            setProctorLogs(data.data.logs)
            setEventTypeLabels(data.data.eventTypeLabels || {})
          }
        } catch (error) {
          console.error('Error fetching proctor logs:', error)
          setProctorLogs([])
          setEventTypeLabels({})
        } finally {
          setLoadingProctorLogs(false)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        alert('Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, candidateEmail])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }
    return date.toLocaleString('en-US', options)
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="container">
        <div className="card">
          <div className="text-center">
            <p style={{ color: "#64748b" }}>Candidate not found</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push(`/assessments/${assessmentId}/analytics`)}
              style={{ marginTop: "1rem" }}
            >
              Back to Analytics
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        {/* Back Button */}
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push(`/assessments/${assessmentId}/analytics`)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Assessment Analytics
          </button>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Candidate Analytics
          </h1>
          <p style={{ color: "#64748b", margin: 0 }}>
            {candidate.name} ({candidate.email})
          </p>
        </div>

        {/* Candidate Basic Info */}
        <div style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          backgroundColor: "#f8fafc",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0"
        }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
            Candidate Information
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Name</div>
              <div style={{ fontSize: "1rem", fontWeight: 600 }}>{candidate.name}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Email</div>
              <div style={{ fontSize: "1rem", fontWeight: 600 }}>{candidate.email}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Status</div>
              <span style={{
                padding: "0.25rem 0.75rem",
                borderRadius: "9999px",
                fontSize: "0.875rem",
                fontWeight: 600,
                backgroundColor: 
                  candidate.status === "completed" ? "#d1fae5" :
                  candidate.status === "started" ? "#dbeafe" :
                  candidate.status === "invited" ? "#fef3c7" :
                  "#f3f4f6",
                color:
                  candidate.status === "completed" ? "#065f46" :
                  candidate.status === "started" ? "#1e40af" :
                  candidate.status === "invited" ? "#92400e" :
                  "#374151",
              }}>
                {candidate.status || "pending"}
              </span>
            </div>
            <div>
              <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Invited At</div>
              <div style={{ fontSize: "1rem" }}>{formatDate(candidate.invitedAt || null)}</div>
            </div>
            {candidate.startedAt && (
              <div>
                <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Started At</div>
                <div style={{ fontSize: "1rem" }}>{formatDate(candidate.startedAt)}</div>
              </div>
            )}
            {candidate.completedAt && (
              <div>
                <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Completed At</div>
                <div style={{ fontSize: "1rem" }}>{formatDate(candidate.completedAt)}</div>
              </div>
            )}
            {candidate.score !== undefined && candidate.maxScore !== undefined && (
              <div>
                <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Score</div>
                <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                  {candidate.score || 0} / {candidate.maxScore || 0}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Proctoring Logs Section */}
        <div style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <AlertTriangle style={{ width: "20px", height: "20px", color: "#f59e0b" }} />
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Proctoring Logs</h2>
              {proctorLogs.length > 0 && (
                <span style={{
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  borderRadius: "9999px",
                }}>
                  {proctorLogs.length} {proctorLogs.length === 1 ? 'violation' : 'violations'}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowProctorLogs(!showProctorLogs)}
              disabled={loadingProctorLogs}
              style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
            >
              {loadingProctorLogs ? 'Loading...' : showProctorLogs ? 'Hide Logs' : 'Show Logs'}
            </button>
          </div>

          {loadingProctorLogs ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
              Loading proctoring logs...
            </div>
          ) : proctorLogs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
              No proctoring violations detected
            </div>
          ) : showProctorLogs ? (
            <ProctorLogsReview 
              logs={proctorLogs}
              candidateName={candidate?.name || candidate?.email}
            />
          ) : null}
        </div>

        {/* Question Analytics */}
        {loadingAnalytics ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
            Loading question analytics...
          </div>
        ) : answerLogs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
            No answer logs available for this candidate
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {answerLogs.map((questionLog) => (
              <div
                key={questionLog.questionIndex}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  backgroundColor: "#ffffff",
                }}
              >
                <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                  Question {questionLog.questionIndex + 1}: {questionLog.questionType}
                </h3>
                <p style={{ color: "#1e293b", lineHeight: 1.6, marginBottom: "1rem", fontSize: "0.875rem" }}>
                  {questionLog.questionText}
                </p>
                
                {/* MCQ Options Display */}
                {questionLog.questionType === "MCQ" && questionLog.options && questionLog.options.length > 0 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <h4 style={{ margin: 0, marginBottom: "0.5rem", fontSize: "0.875rem", color: "#64748b", fontWeight: 600 }}>
                      Options:
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {questionLog.options.map((option, optIndex) => {
                        const optionLetter = String.fromCharCode(65 + optIndex);
                        const isSelected = questionLog.logs.length > 0 && questionLog.logs[questionLog.logs.length - 1]?.answer === optionLetter;
                        const isCorrect = optionLetter === questionLog.correctAnswer;
                        const showAsCorrect = isSelected && isCorrect;
                        const showAsWrong = isSelected && !isCorrect;
                        
                        return (
                          <div
                            key={optIndex}
                            style={{
                              padding: "0.75rem",
                              backgroundColor: showAsCorrect ? "#d1fae5" : showAsWrong ? "#fee2e2" : "#f8fafc",
                              border: `2px solid ${showAsCorrect ? "#10b981" : showAsWrong ? "#ef4444" : "#e2e8f0"}`,
                              borderRadius: "0.5rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <span style={{
                              fontWeight: 700,
                              color: showAsCorrect ? "#059669" : showAsWrong ? "#dc2626" : "#64748b",
                              fontSize: "0.875rem",
                              minWidth: "24px",
                            }}>
                              {optionLetter}.
                            </span>
                            <span style={{ flex: 1, color: "#1e293b", fontSize: "0.875rem" }}>
                              {option}
                            </span>
                            {showAsCorrect && (
                              <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.875rem" }}>
                                ✓ Correct
                              </span>
                            )}
                            {showAsWrong && (
                              <span style={{ color: "#dc2626", fontWeight: 700, fontSize: "0.875rem" }}>
                                ✗ Selected (Wrong)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                

                {/* Answer Versions */}
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                  <h4 style={{ margin: 0, marginBottom: "0.75rem", fontSize: "0.875rem", color: "#1e293b", fontWeight: 600 }}>
                    Answer Versions:
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {questionLog.logs.map((log, logIndex) => (
                      <div
                        key={logIndex}
                        style={{
                          padding: "0.75rem",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                          <span style={{
                            backgroundColor: "#dbeafe",
                            color: "#1e40af",
                            padding: "0.25rem 0.75rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}>
                            Version {log.version}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            {formatDate(log.timestamp)}
                          </span>
                        </div>
                        <p style={{
                          color: "#1e293b",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          margin: 0,
                          fontSize: "0.875rem",
                        }}>
                          {log.answer || "(Empty answer)"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;

