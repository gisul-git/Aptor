'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'
import Link from 'next/link'
import axios from 'axios'
import { ArrowLeft, AlertTriangle, Clock, Video, Eye, Loader2 } from 'lucide-react'
import ProctorLogsReview from '../../../components/admin/ProctorLogsReview'
import { useAssessment, useCandidateResults, useAnswerLogs, useUpdateScheduleAndCandidates } from '@/hooks/api/useAssessments'

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
  score?: number
  maxScore?: number
  attempted?: number
  notAttempted?: number
  correctAnswers?: number
  submittedAt?: string | null
  percentageScored?: number
  passPercentage?: number
  passed?: boolean
  status?: "invited" | "pending" | "started" | "completed"
  invited?: boolean
  invitedAt?: string
  startedAt?: string
  completedAt?: string
  candidateInfo?: {
    phone?: string | null
    linkedIn?: string | null
    github?: string | null
    hasResume?: boolean
    customFields?: Record<string, any>
  } | null
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { id: assessmentIdParam, candidate: candidateEmail } = router.query
  const assessmentId = typeof assessmentIdParam === 'string' ? assessmentIdParam : undefined
  
  // React Query hooks
  const { data: assessmentData, isLoading: loadingAssessment, refetch: refetchAssessment } = useAssessment(assessmentId)
  const { data: candidatesData, isLoading: loadingCandidates, refetch: refetchCandidates } = useCandidateResults(assessmentId)
  const selectedCandidateEmail = typeof candidateEmail === 'string' ? candidateEmail : undefined
  const selectedCandidateName = candidatesData?.find((c: any) => c.email === selectedCandidateEmail)?.name || ''
  const { data: answerLogsData, isLoading: loadingAnalytics } = useAnswerLogs(
    assessmentId,
    selectedCandidateEmail,
    selectedCandidateName
  )
  const updateScheduleAndCandidatesMutation = useUpdateScheduleAndCandidates()
  
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [answerLogs, setAnswerLogs] = useState<QuestionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [assessment, setAssessment] = useState<any>(null)
  const [proctorLogs, setProctorLogs] = useState<any[]>([])
  const [eventTypeLabels, setEventTypeLabels] = useState<Record<string, string>>({})
  const [loadingProctorLogs, setLoadingProctorLogs] = useState(false)
  const [showProctorLogs, setShowProctorLogs] = useState(false)
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false)
  const [newCandidateName, setNewCandidateName] = useState("")
  const [newCandidateEmail, setNewCandidateEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [addingCandidate, setAddingCandidate] = useState(false)
  const [assessmentCandidates, setAssessmentCandidates] = useState<Candidate[]>([])
  const [referencePhoto, setReferencePhoto] = useState<string | null>(null)
  
  // Update local state from React Query data
  useEffect(() => {
    if (assessmentData) {
      setAssessment(assessmentData)
      const candidates = (assessmentData as any)?.candidates || []
      setAssessmentCandidates(candidates)
    }
  }, [assessmentData])
  
  useEffect(() => {
    if (candidatesData) {
      setCandidates(candidatesData)
    }
  }, [candidatesData])
  
  useEffect(() => {
    if (answerLogsData) {
      setAnswerLogs(answerLogsData)
    }
  }, [answerLogsData])
  
  useEffect(() => {
    setLoading(loadingAssessment || loadingCandidates)
  }, [loadingAssessment, loadingCandidates])
  

  // Answer logs are now fetched via useAnswerLogs hook
  // This function is kept for backward compatibility but logs are auto-fetched
  const fetchAnalytics = async (email: string, name: string) => {
    // Data is automatically fetched via useAnswerLogs hook
    // This is a no-op now, but kept for any code that calls it
  }

  const fetchProctorLogs = async (email: string) => {
    if (!assessmentId || typeof assessmentId !== 'string' || !email) return
    
    setLoadingProctorLogs(true)
    try {
      // Try multiple userId formats to match how proctoring logs might be stored
      // Format 1: email:userEmail (Priority 4 in resolveUserIdForProctoring)
      const emailUserId = `email:${email.trim()}`;
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
          const emailLower = email.trim().toLowerCase();
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
  }

  // Handle candidate selection from URL query param
  useEffect(() => {
    if (candidateEmail && typeof candidateEmail === 'string' && candidates.length > 0) {
      const candidate = candidates.find((c: any) => c.email === candidateEmail)
      if (candidate) {
        setSelectedCandidate(candidateEmail)
        fetchProctorLogs(candidateEmail)
        fetchReferencePhoto(candidateEmail, candidate.name)
      }
    }
  }, [candidateEmail, candidates])

  // Fetch reference photo when candidate is selected
  useEffect(() => {
    if (selectedCandidate) {
      const candidateData = candidates.find(c => c.email === selectedCandidate) || 
                           assessmentCandidates.find(c => c.email === selectedCandidate)
      if (candidateData) {
        fetchReferencePhoto(selectedCandidate, candidateData.name)
      }
    }
  }, [selectedCandidate, candidates, assessmentCandidates])

  // Removed 8-second cooldown - no longer needed as reconnection is handled properly

  const fetchReferencePhoto = async (candidateEmail: string, candidateName?: string) => {
    if (!assessmentId || typeof assessmentId !== 'string' || !candidateEmail) {
      setReferencePhoto(null)
      return
    }

    try {
      const response = await axios.get(`/api/v1/candidate/get-reference-photo`, {
        params: {
          assessmentId,
          candidateEmail,
        },
      })

      const respData = response?.data;
      if (respData?.success && respData.referenceImage) {
        setReferencePhoto(respData.referenceImage)
      } else {
        setReferencePhoto(null)
      }
    } catch (error) {
      console.warn('[Analytics] Error fetching reference photo:', error)
      setReferencePhoto(null)
    }
  }

  const handleCandidateSelect = (email: string, name: string) => {
    setSelectedCandidate(email)
    fetchAnalytics(email, name)
    fetchProctorLogs(email)
    // Try to fetch reference photo from current assessment data first
    fetchReferencePhoto(email, name)
    // Also try to refresh assessment data in background (non-blocking)
    const refreshAssessment = async () => {
      try {
        await refetchAssessment()
        await refetchCandidates()
        if (assessmentData) {
          setAssessment(assessmentData)
          // Fetch photo again after refresh
          setTimeout(() => fetchReferencePhoto(email, name), 100)
        }
      } catch (error) {
        // Silently fail - we already tried with existing data
        console.warn('[Analytics] Could not refresh assessment data (non-critical):', error)
      }
    }
    refreshAssessment()
    setShowProctorLogs(false)
    // Scroll to top of analytics content when candidate is selected
    setTimeout(() => {
      const analyticsContent = document.querySelector('[data-analytics-content]')
      if (analyticsContent) {
        analyticsContent.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

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

  const validateEmail = (email: string): boolean => {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailPattern.test(email)
  }

  const handleAddCandidate = async () => {
    if (!assessmentId) return
    
    // Validate email
    if (!validateEmail(newCandidateEmail.trim())) {
      setEmailError("Please enter a valid email address.")
      return
    }
    
    if (!newCandidateName.trim()) {
      setEmailError("Please enter a candidate name.")
      return
    }
    
    setEmailError(null)
    setAddingCandidate(true)
    
    try {
      const response = await axios.post(`/api/assessments/${assessmentId}/add-candidate`, {
        email: newCandidateEmail.trim(),
        name: newCandidateName.trim(),
      })
      
      if (response?.data?.success) {
        // Refresh assessment data to get updated candidates list
        await refetchAssessment()
        await refetchCandidates()
        
        // Close modal and reset form
        setShowAddCandidateModal(false)
        setNewCandidateName("")
        setNewCandidateEmail("")
        setEmailError(null)
        alert("Candidate added and invitation sent successfully!")
      }
    } catch (err: any) {
      setEmailError(err.response?.data?.detail || err.response?.data?.message || "Failed to add candidate")
    } finally {
      setAddingCandidate(false)
    }
  }

  const handleResendInvitation = async (email: string) => {
    if (!assessmentId) return
    
    try {
      const response = await axios.post(`/api/assessments/${assessmentId}/resend-invite`, {
        email: email,
      })
      
      if (response?.data?.success) {
        alert("Invitation resent successfully!")
        // Refresh assessment data
        await refetchAssessment()
        await refetchCandidates()
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.message || "Failed to resend invitation")
    }
  }

  const handleRemoveCandidate = async (email: string) => {
    if (!assessmentId) return
    if (!confirm(`Are you sure you want to remove ${email} from this assessment?`)) return
    
    try {
      // Note: We need to create a remove-candidate endpoint or use update-schedule-and-candidates
      // For now, we'll use update-schedule-and-candidates to remove the candidate
      const updatedCandidates = assessmentCandidates.filter(c => c.email.toLowerCase() !== email.toLowerCase())
      await updateScheduleAndCandidatesMutation.mutateAsync({
        assessmentId: assessmentId,
        candidates: updatedCandidates,
        startTime: (assessment as any)?.schedule?.startTime,
        endTime: (assessment as any)?.schedule?.endTime,
        assessmentUrl: (assessment as any)?.assessmentUrl,
        token: (assessment as any)?.assessmentToken,
        accessMode: (assessment as any)?.accessMode,
      })
      
      await refetchAssessment()
      alert("Candidate removed successfully")
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.message || "Failed to remove candidate")
    }
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

  // Find candidate from both sources (results and assessment candidates)
  const selectedCandidateFromResults = candidates.find(c => c.email === selectedCandidate)
  const selectedCandidateFromAssessment = assessmentCandidates.find(c => c.email === selectedCandidate)
  
  // Merge data from both sources, prioritizing results data but including assessment data
  const selectedCandidateData = selectedCandidateFromResults || selectedCandidateFromAssessment ? {
    ...selectedCandidateFromAssessment,
    ...selectedCandidateFromResults,
    // Ensure we have email and name
    email: selectedCandidateFromResults?.email || selectedCandidateFromAssessment?.email || selectedCandidate || '',
    name: selectedCandidateFromResults?.name || selectedCandidateFromAssessment?.name || '',
    // Merge status
    status: selectedCandidateFromAssessment?.status || (selectedCandidateFromResults?.submittedAt ? 'completed' : 'pending'),
    // Merge timestamps
    invitedAt: selectedCandidateFromAssessment?.invitedAt || null,
    startedAt: selectedCandidateFromAssessment?.startedAt || null,
    completedAt: selectedCandidateFromAssessment?.completedAt || selectedCandidateFromResults?.submittedAt || null,
    // Include candidateInfo (requirements) from results
    candidateInfo: selectedCandidateFromResults?.candidateInfo || selectedCandidateFromAssessment?.candidateInfo || null,
  } : null

  // Calculate overall statistics
  const submittedCandidates = candidates.filter(c => c.submittedAt)
  const totalCandidates = candidates.length
  const submittedCount = submittedCandidates.length
  
  const avgScore = submittedCount > 0 
    ? submittedCandidates.reduce((sum, c) => sum + (c?.score || 0), 0) / submittedCount 
    : 0
  const avgPercentage = submittedCount > 0
    ? submittedCandidates.reduce((sum, c) => sum + (c?.percentageScored !== undefined ? c.percentageScored : ((c?.maxScore && c?.maxScore > 0) ? ((c?.score || 0) / (c?.maxScore || 1)) * 100 : 0)), 0) / submittedCount
    : 0
  const passedCount = submittedCandidates.filter(c => c?.passed === true).length
  const failedCount = submittedCandidates.filter(c => c?.passed === false).length
  const totalMaxScore = submittedCandidates.length > 0 ? (submittedCandidates[0]?.maxScore || 0) : 0
  const totalScore = submittedCandidates.reduce((sum, c) => sum + (c?.score || 0), 0)
  const avgAttempted = submittedCount > 0
    ? submittedCandidates.reduce((sum, c) => sum + (c?.attempted || 0), 0) / submittedCount
    : 0
  const totalQuestions = assessment?.questions?.length || 0

  return (
    <div className="container">
      <div className="card">
        {/* Back Button & Live Dashboard Link */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push('/dashboard')}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Assessment Analytics
          </h1>
          <p style={{ color: "#64748b", margin: 0 }}>
            {assessment?.assessment?.title || 'Assessment'} - View detailed analytics and AI feedback
          </p>
        </div>

        {/* Assessment Access Section - Show URL, Add Candidate, Invite Again */}
        {assessment?.assessment && (
          <div style={{ 
            marginBottom: "2rem", 
            padding: "1.5rem", 
            backgroundColor: "#f8fafc", 
            borderRadius: "0.75rem", 
            border: "1px solid #e2e8f0" 
          }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
              Assessment Access
            </h2>
            
            {/* Assessment URL */}
            {assessment.assessment.assessmentUrl && (
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                  Assessment URL
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    value={assessment.assessment.assessmentUrl}
                    readOnly
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      backgroundColor: "#ffffff",
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(assessment.assessment.assessmentUrl);
                      alert("URL copied to clipboard!");
                    }}
                    style={{ marginTop: 0, whiteSpace: "nowrap", padding: "0.75rem 1.5rem" }}
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            )}
            
          </div>
        )}

        {/* Candidates Management Section */}
        {assessment?.assessment && (
          <div style={{ 
            marginBottom: "2rem", 
            padding: "1.5rem", 
            backgroundColor: "#ffffff", 
            borderRadius: "0.75rem", 
            border: "1px solid #e2e8f0" 
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Candidates</h2>
              {assessment.assessment.accessMode === "private" && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowAddCandidateModal(true)}
                  style={{ 
                    padding: "0.5rem 1rem", 
                    fontSize: "0.875rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                >
                  ➕ Add Candidate
                </button>
              )}
            </div>
            
            {assessmentCandidates.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>No candidates added yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Email</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Name</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Status</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessmentCandidates.map((candidate, index) => (
                      <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>{candidate.email}</td>
                        <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>{candidate.name}</td>
                        <td style={{ padding: "0.75rem" }}>
                          <span style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
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
                        </td>
                        <td style={{ padding: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          {assessment.assessment.accessMode === "private" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleResendInvitation(candidate.email)}
                                style={{
                                  padding: "0.25rem 0.75rem",
                                  fontSize: "0.75rem",
                                  backgroundColor: "#10b981",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "0.375rem",
                                  cursor: "pointer",
                                }}
                              >
                                Resend Invitation
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveCandidate(candidate.email)}
                                style={{
                                  padding: "0.25rem 0.75rem",
                                  fontSize: "0.75rem",
                                  backgroundColor: "#ef4444",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "0.375rem",
                                  cursor: "pointer",
                                }}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
          {/* Candidate List */}
          <div>
            <div style={{
              border: "1px solid #e2e8f0",
              borderRadius: "0.75rem",
              padding: "1rem",
              backgroundColor: "#ffffff",
            }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>Candidates</h2>
              <button
                onClick={() => {
                  setSelectedCandidate(null)
                  setAnswerLogs([])
                  setProctorLogs([])
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: selectedCandidate === null
                    ? "2px solid #3b82f6"
                    : "1px solid #e2e8f0",
                  backgroundColor: selectedCandidate === null
                    ? "#eff6ff"
                    : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  marginBottom: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
                onMouseEnter={(e) => {
                  if (selectedCandidate !== null) {
                    e.currentTarget.style.backgroundColor = "#f8fafc"
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCandidate !== null) {
                    e.currentTarget.style.backgroundColor = "#ffffff"
                  }
                }}
              >
                📊 Overall Analytics
              </button>
              {(assessmentCandidates.length === 0 && candidates.length === 0) ? (
                <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                  No candidates found
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {(assessmentCandidates.length > 0 ? assessmentCandidates : candidates).map((candidate) => {
                    const candidateEmail = candidate.email || ''
                    const candidateName = candidate.name || candidateEmail.split('@')[0]
                    return (
                    <button
                      key={candidateEmail}
                      onClick={() => {
                        // Select candidate to show inline analytics (no navigation)
                        handleCandidateSelect(candidateEmail, candidateName)
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        border: selectedCandidate === candidateEmail
                          ? "2px solid #3b82f6"
                          : "1px solid #e2e8f0",
                        backgroundColor: selectedCandidate === candidateEmail
                          ? "#eff6ff"
                          : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedCandidate !== candidateEmail) {
                          e.currentTarget.style.backgroundColor = "#f8fafc"
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedCandidate !== candidateEmail) {
                          e.currentTarget.style.backgroundColor = "#ffffff"
                        }
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{candidateName}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                        {candidateEmail}
                      </div>
                      {(candidate.submittedAt || candidate.completedAt) && (
                        <div style={{ fontSize: "0.75rem", color: "#10b981", marginTop: "0.25rem", fontWeight: 600 }}>
                          Score: {candidate.score || 0} / {candidate.maxScore || 0}
                        </div>
                      )}
                      {(candidate.submittedAt || candidate.completedAt) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/assessments/${assessmentId}/candidate/${encodeURIComponent(candidateEmail)}/results?name=${encodeURIComponent(candidateName)}`);
                          }}
                          style={{
                            marginTop: "0.5rem",
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: "#3b82f6",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            width: "100%",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#2563eb";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#3b82f6";
                          }}
                        >
                          View Results
                        </button>
                      )}
                    </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Analytics Content */}
          <div>
            {loadingAnalytics ? (
              <div style={{
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                padding: "3rem",
                textAlign: "center",
                backgroundColor: "#ffffff",
              }}>
                <div>Loading analytics...</div>
              </div>
            ) : !selectedCandidate ? (
              // Overall Analytics View
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                {/* Overall Summary */}
                <div style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  backgroundColor: "#ffffff",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
                      Overall Assessment Performance
                    </h2>
                    <Link
                      href={`/assessments/${assessmentId}/live-dashboard`}
                      className="btn-primary"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 1rem",
                        fontSize: "0.875rem",
                        backgroundColor: "#3b82f6",
                        color: "#ffffff",
                        textDecoration: "none",
                        borderRadius: "0.5rem",
                        fontWeight: 600,
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#2563eb";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#3b82f6";
                      }}
                    >
                      <Video className="h-4 w-4" />
                      Live Proctoring Dashboard
                    </Link>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Total Candidates</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalCandidates}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Submitted</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                        {submittedCount} / {totalCandidates}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Average Score</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                        {avgScore.toFixed(1)} / {totalMaxScore}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Average %</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                        {avgPercentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "1rem" }}>
                    <div style={{
                      padding: "1rem",
                      backgroundColor: "#d1fae5",
                      borderRadius: "0.5rem",
                      border: "1px solid #10b981",
                    }}>
                      <div style={{ fontSize: "0.875rem", color: "#065f46", marginBottom: "0.25rem", fontWeight: 600 }}>Passed</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669" }}>{passedCount}</div>
                    </div>
                    <div style={{
                      padding: "1rem",
                      backgroundColor: "#fee2e2",
                      borderRadius: "0.5rem",
                      border: "1px solid #ef4444",
                    }}>
                      <div style={{ fontSize: "0.875rem", color: "#991b1b", marginBottom: "0.25rem", fontWeight: 600 }}>Failed</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#dc2626" }}>{failedCount}</div>
                    </div>
                    <div style={{
                      padding: "1rem",
                      backgroundColor: "#fef3c7",
                      borderRadius: "0.5rem",
                      border: "1px solid #f59e0b",
                    }}>
                      <div style={{ fontSize: "0.875rem", color: "#92400e", marginBottom: "0.25rem", fontWeight: 600 }}>In Progress</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#d97706" }}>{totalCandidates - submittedCount}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "0.5rem" }}>
                    <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.5rem" }}>Additional Statistics</div>
                    <div style={{ display: "flex", gap: "2rem", fontSize: "0.875rem" }}>
                      <div>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Total Questions: </span>
                        <span>{totalQuestions}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Avg Attempted: </span>
                        <span>{avgAttempted.toFixed(1)}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>Total Score: </span>
                        <span>{totalScore.toFixed(1)} / {(totalMaxScore * submittedCount).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Candidate Performance Table */}
                {submittedCandidates.length > 0 && (
                  <div style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                    backgroundColor: "#ffffff",
                  }}>
                    <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
                      Individual Candidate Performance
                    </h2>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                            <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Name</th>
                            <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Email</th>
                            <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Score</th>
                            <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Percentage</th>
                            <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Status</th>
                            <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Attempted</th>
                            <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Results</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submittedCandidates.map((candidate, index) => (
                            <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>{candidate.name}</td>
                              <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#64748b" }}>{candidate.email}</td>
                              <td style={{ padding: "0.75rem", fontSize: "0.875rem", fontWeight: 600 }}>
                                {candidate.score || 0} / {candidate.maxScore || 0}
                              </td>
                              <td style={{ padding: "0.75rem", fontSize: "0.875rem", fontWeight: 600 }}>
                                {candidate.percentageScored !== undefined 
                                  ? candidate.percentageScored.toFixed(1) 
                                  : ((candidate.maxScore && candidate.maxScore > 0) ? Math.round(((candidate.score || 0) / candidate.maxScore) * 100) : 0)}%
                              </td>
                              <td style={{ padding: "0.75rem" }}>
                                {candidate.passed !== undefined ? (
                                  <span style={{
                                    padding: "0.25rem 0.75rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    backgroundColor: candidate.passed ? "#d1fae5" : "#fee2e2",
                                    color: candidate.passed ? "#065f46" : "#991b1b",
                                  }}>
                                    {candidate.passed ? "Pass" : "Fail"}
                                  </span>
                                ) : (
                                  <span style={{ color: "#64748b" }}>N/A</span>
                                )}
                              </td>
                              <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>
                                <span style={{ color: "#10b981", fontWeight: 600 }}>{candidate.attempted}</span> / {totalQuestions}
                              </td>
                              <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>
                                {(candidate.submittedAt || candidate.completedAt) ? (
                                  <button
                                    onClick={() => {
                                      router.push(`/assessments/${assessmentId}/candidate/${encodeURIComponent(candidate.email)}/results?name=${encodeURIComponent(candidate.name)}`);
                                    }}
                                    style={{
                                      padding: "0.5rem 1rem",
                                      fontSize: "0.875rem",
                                      fontWeight: 600,
                                      backgroundColor: "#3b82f6",
                                      color: "#ffffff",
                                      border: "none",
                                      borderRadius: "0.375rem",
                                      cursor: "pointer",
                                      transition: "all 0.2s",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = "#2563eb";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "#3b82f6";
                                    }}
                                  >
                                    View Results
                                  </button>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Not Available</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : !selectedCandidateData ? (
              <div style={{
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                padding: "3rem",
                textAlign: "center",
                backgroundColor: "#ffffff",
              }}>
                <p style={{ color: "#64748b" }}>
                  Candidate not found
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} data-analytics-content>
                {/* Candidate Basic Info */}
                <div style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  backgroundColor: "#f8fafc",
                }}>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
                    Candidate Information
                  </h2>
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                    {/* Reference Photo */}
                    {referencePhoto && (
                      <div style={{ 
                        flexShrink: 0,
                        width: "150px",
                        height: "150px",
                        borderRadius: "0.5rem",
                        overflow: "hidden",
                        border: "2px solid #e2e8f0",
                        backgroundColor: "#ffffff"
                      }}>
                        <img 
                          src={referencePhoto} 
                          alt="Reference Photo" 
                          style={{ 
                            width: "100%", 
                            height: "100%", 
                            objectFit: "cover" 
                          }} 
                        />
                      </div>
                    )}
                    {/* Candidate Details */}
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", minWidth: "300px" }}>
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Name</div>
                        <div style={{ fontSize: "1rem", fontWeight: 600 }}>{selectedCandidateData.name}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Email</div>
                        <div style={{ fontSize: "1rem", fontWeight: 600 }}>{selectedCandidateData.email}</div>
                      </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Status</div>
                      <span style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: "9999px",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        backgroundColor: 
                          selectedCandidateData.status === "completed" ? "#d1fae5" :
                          selectedCandidateData.status === "started" ? "#dbeafe" :
                          selectedCandidateData.status === "invited" ? "#fef3c7" :
                          "#f3f4f6",
                        color:
                          selectedCandidateData.status === "completed" ? "#065f46" :
                          selectedCandidateData.status === "started" ? "#1e40af" :
                          selectedCandidateData.status === "invited" ? "#92400e" :
                          "#374151",
                      }}>
                        {selectedCandidateData.status || (selectedCandidateData.submittedAt ? "completed" : "pending")}
                      </span>
                    </div>
                    {selectedCandidateData.invitedAt && (
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Invited At</div>
                        <div style={{ fontSize: "1rem" }}>{formatDate(selectedCandidateData.invitedAt || null)}</div>
                      </div>
                    )}
                    {selectedCandidateData.startedAt && (
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Started At</div>
                        <div style={{ fontSize: "1rem" }}>{formatDate(selectedCandidateData.startedAt || null)}</div>
                      </div>
                    )}
                    {selectedCandidateData.completedAt && (
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Completed At</div>
                        <div style={{ fontSize: "1rem" }}>{formatDate(selectedCandidateData.completedAt || null)}</div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>

                {/* Candidate Requirements Section */}
                {selectedCandidateData.candidateInfo && (
                  <div style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                    backgroundColor: "#ffffff",
                  }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
                      Candidate Requirements
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                      {selectedCandidateData.candidateInfo.phone && (
                        <div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Phone</div>
                          <div style={{ fontSize: "1rem", fontWeight: 600 }}>{selectedCandidateData.candidateInfo.phone}</div>
                        </div>
                      )}
                      {selectedCandidateData.candidateInfo.linkedIn && (
                        <div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>LinkedIn</div>
                          <div style={{ fontSize: "1rem" }}>
                            <a 
                              href={selectedCandidateData.candidateInfo.linkedIn} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ color: "#3b82f6", textDecoration: "none", fontWeight: 600 }}
                            >
                              {selectedCandidateData.candidateInfo.linkedIn}
                            </a>
                          </div>
                        </div>
                      )}
                      {selectedCandidateData.candidateInfo.github && (
                        <div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>GitHub</div>
                          <div style={{ fontSize: "1rem" }}>
                            <a 
                              href={selectedCandidateData.candidateInfo.github} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ color: "#3b82f6", textDecoration: "none", fontWeight: 600 }}
                            >
                              {selectedCandidateData.candidateInfo.github}
                            </a>
                          </div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Resume</div>
                        <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                          {selectedCandidateData.candidateInfo.hasResume ? (
                            <span style={{ color: "#10b981" }}>✓ Uploaded</span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>Not provided</span>
                          )}
                        </div>
                      </div>
                      {selectedCandidateData.candidateInfo.customFields && 
                       Object.keys(selectedCandidateData.candidateInfo.customFields).length > 0 && (
                        <div style={{ gridColumn: "1 / -1" }}>
                          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.5rem" }}>Custom Fields</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                            {Object.entries(selectedCandidateData.candidateInfo.customFields).map(([key, value]) => (
                              <div key={key}>
                                <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>
                                  {key.charAt(0).toUpperCase() + key.slice(1)}
                                </div>
                                <div style={{ fontSize: "1rem", fontWeight: 600 }}>{String(value)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Overall Summary */}
                <div style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  backgroundColor: "#ffffff",
                }}>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
                    {selectedCandidateData.name} - Overall Performance
                  </h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Total Score</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                        {selectedCandidateData.score || 0} / {selectedCandidateData.maxScore || 0}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Percentage</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                        {selectedCandidateData.percentageScored !== undefined 
                          ? selectedCandidateData.percentageScored.toFixed(1) 
                          : ((selectedCandidateData.maxScore && selectedCandidateData.maxScore > 0)
                            ? Math.round(((selectedCandidateData.score || 0) / selectedCandidateData.maxScore) * 100) 
                            : 0)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Status</div>
                      <div>
                        {selectedCandidateData.passed !== undefined ? (
                          <span style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "9999px",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            backgroundColor: selectedCandidateData.passed ? "#d1fae5" : "#fee2e2",
                            color: selectedCandidateData.passed ? "#065f46" : "#991b1b",
                          }}>
                            {selectedCandidateData.passed ? "Pass" : "Fail"}
                          </span>
                        ) : (
                          <span style={{ color: "#64748b" }}>N/A</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.875rem", color: "#64748b" }}>
                    <div>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Attempted: </span>
                      <span style={{ color: "#10b981", fontWeight: 600 }}>{selectedCandidateData.attempted}</span>
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Not Attempted: </span>
                      <span style={{ color: "#ef4444", fontWeight: 600 }}>{selectedCandidateData.notAttempted}</span>
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>Submitted: </span>
                      {formatDate(selectedCandidateData.submittedAt || null)}
                    </div>
                  </div>
                </div>

                {/* Proctoring Logs Section */}
                <div style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  backgroundColor: "#ffffff",
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
                      candidateName={selectedCandidateData?.name || selectedCandidateData?.email}
                    />
                  ) : null}
                </div>

                {/* Question Analytics */}
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
                        {questionLog.isMcqCorrect !== undefined && (
                          <div style={{
                            marginTop: "0.75rem",
                            padding: "0.75rem",
                            backgroundColor: questionLog.isMcqCorrect ? "#f0fdf4" : "#fef2f2",
                            border: `1px solid ${questionLog.isMcqCorrect ? "#10b981" : "#ef4444"}`,
                            borderRadius: "0.5rem"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{
                                fontWeight: 600,
                                color: questionLog.isMcqCorrect ? "#065f46" : "#991b1b",
                                fontSize: "0.875rem"
                              }}>
                                Answer Status:
                              </span>
                              <span style={{
                                fontWeight: 700,
                                color: questionLog.isMcqCorrect ? "#059669" : "#dc2626",
                                fontSize: "1rem"
                              }}>
                                {questionLog.isMcqCorrect ? "✓ Correct" : "✗ Incorrect"}
                              </span>
                            </div>
                          </div>
                        )}
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
      </div>


      {/* Add Candidate Modal */}
      {showAddCandidateModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
        onClick={() => {
          if (!addingCandidate) {
            setShowAddCandidateModal(false)
            setEmailError(null)
          }
        }}
        >
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "0.75rem",
            padding: "2rem",
            maxWidth: "500px",
            width: "90%",
            maxHeight: "90vh",
            overflow: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1.5rem" }}>
              Add Candidate
            </h2>
            
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                Full Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={newCandidateName}
                onChange={(e) => {
                  setNewCandidateName(e.target.value)
                  setEmailError(null)
                }}
                placeholder="Enter candidate's full name"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
                disabled={addingCandidate}
              />
            </div>
            
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                Email Address <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="email"
                value={newCandidateEmail}
                onChange={(e) => {
                  setNewCandidateEmail(e.target.value)
                  setEmailError(null)
                }}
                placeholder="candidate@example.com"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: `1px solid ${emailError ? "#ef4444" : "#e2e8f0"}`,
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
                disabled={addingCandidate}
              />
              {emailError && (
                <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#ef4444" }}>
                  {emailError}
                </p>
              )}
            </div>
            
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowAddCandidateModal(false)
                  setEmailError(null)
                  setNewCandidateName("")
                  setNewCandidateEmail("")
                }}
                disabled={addingCandidate}
                style={{ padding: "0.75rem 1.5rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAddCandidate}
                disabled={addingCandidate || !newCandidateName.trim() || !newCandidateEmail.trim()}
                style={{ padding: "0.75rem 1.5rem" }}
              >
                {addingCandidate ? "Adding..." : "Add Candidate"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;

