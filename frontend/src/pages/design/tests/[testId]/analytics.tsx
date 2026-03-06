import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import Link from 'next/link'
import axios from 'axios'
import { ArrowLeft, Download, Loader2, AlertTriangle, Eye } from 'lucide-react'
import { useSession } from 'next-auth/react'
import * as XLSX from 'xlsx'

interface Candidate {
  _id: string
  test_id: string
  name: string
  email: string
  invited: boolean
  invited_at?: string
  started_at?: string
  submitted_at?: string
  has_submitted: boolean
  submission_score?: number
  created_at: string
}

interface Test {
  _id: string
  title: string
  description?: string
  duration_minutes: number
  question_ids: string[]
  created_at?: string
  proctoring_enabled?: boolean
  is_published?: boolean
  test_token?: string
}

interface SubmissionAnalytics {
  candidate: {
    name: string
    email: string
  }
  submission: {
    score: number
    started_at: string | null
    submitted_at: string | null
    is_completed: boolean
    design_url?: string
    screenshots?: string[]
    feedback?: {
      overall_score: number
      rule_based_score: number
      ai_based_score: number
      feedback_summary: string
    }
  } | null
}

export default function DesignAnalyticsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { testId } = router.query
  
  const [test, setTest] = useState<Test | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<SubmissionAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false)
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)
  const [newCandidateName, setNewCandidateName] = useState("")
  const [newCandidateEmail, setNewCandidateEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [addingCandidate, setAddingCandidate] = useState(false)
  const [uploadingBulk, setUploadingBulk] = useState(false)
  const [exportingResults, setExportingResults] = useState(false)
  const [sendingInvitations, setSendingInvitations] = useState(false)
  
  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3007/api/v1/design'

  useEffect(() => {
    if (testId && typeof testId === 'string') {
      fetchTest()
      fetchCandidates()
    }
  }, [testId])

  const fetchTest = async () => {
    try {
      const response = await fetch(`${API_URL}/tests/${testId}`)
      if (response.ok) {
        const data = await response.json()
        setTest(data)
      }
    } catch (error) {
      console.error('Failed to fetch test:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCandidates = async () => {
    try {
      const response = await fetch(`${API_URL}/tests/${testId}/candidates`)
      if (response.ok) {
        const data = await response.json()
        setCandidates(data)
      }
    } catch (error) {
      console.error('Failed to fetch candidates:', error)
    }
  }

  const fetchAnalytics = async (candidateId: string) => {
    if (!testId || !candidateId) return
    
    setLoadingAnalytics(true)
    try {
      const response = await fetch(`${API_URL}/tests/${testId}/candidates/${candidateId}/analytics`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const handleCandidateSelect = (candidateId: string) => {
    setSelectedCandidate(candidateId)
    fetchAnalytics(candidateId)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const validateEmail = (email: string): boolean => {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailPattern.test(email)
  }

  const handleAddCandidate = async () => {
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
      const response = await fetch(`${API_URL}/tests/${testId}/add-candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCandidateName.trim(),
          email: newCandidateEmail.trim(),
        }),
      })
      
      if (response.ok) {
        await fetchCandidates()
        setShowAddCandidateModal(false)
        setNewCandidateName("")
        setNewCandidateEmail("")
        setEmailError(null)
        alert("Candidate added successfully!")
      } else {
        const error = await response.json()
        setEmailError(error.detail || "Failed to add candidate")
      }
    } catch (error) {
      setEmailError("Failed to add candidate")
    } finally {
      setAddingCandidate(false)
    }
  }

  const handleRemoveCandidate = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Are you sure you want to remove ${candidateName}?`)) return
    
    try {
      const response = await fetch(`${API_URL}/tests/${testId}/candidates/${candidateId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        await fetchCandidates()
        if (selectedCandidate === candidateId) {
          setSelectedCandidate(null)
          setAnalytics(null)
        }
        alert("Candidate removed successfully!")
      } else {
        alert("Failed to remove candidate")
      }
    } catch (error) {
      alert("Failed to remove candidate")
    }
  }

  const handleResendInvitation = async (email: string) => {
    try {
      console.log('[Design Analytics] Sending invitation to:', email)
      console.log('[Design Analytics] API URL:', API_URL)
      console.log('[Design Analytics] Test ID:', testId)
      
      const response = await fetch(`${API_URL}/tests/${testId}/send-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      
      console.log('[Design Analytics] Response status:', response.status)
      
      if (response.ok) {
        alert("Invitation sent successfully!")
        await fetchCandidates()
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('[Design Analytics] Error response:', errorData)
        alert(`Failed to send invitation: ${errorData.detail || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[Design Analytics] Exception:', error)
      alert(`Failed to send invitation: ${error}`)
    }
  }

  const handleSendInvitationsToAll = async () => {
    if (candidates.length === 0) {
      alert("No candidates to send invitations to.")
      return
    }
    
    if (!confirm(`Send invitation emails to all ${candidates.length} candidates?`)) {
      return
    }
    
    setSendingInvitations(true)
    try {
      const response = await fetch(`${API_URL}/tests/${testId}/send-invitations-to-all`, {
        method: 'POST',
      })
      
      if (response.ok) {
        const data = await response.json()
        const successCount = data.success_count || 0
        const failedCount = data.failed_count || 0
        
        await fetchCandidates()
        
        if (failedCount === 0) {
          alert(`Successfully sent invitation emails to all ${successCount} candidates!`)
        } else {
          alert(
            `Invitation emails sent:\n` +
            `✓ Success: ${successCount}\n` +
            `✗ Failed: ${failedCount}`
          )
        }
      } else {
        alert("Failed to send invitation emails")
      }
    } catch (error) {
      alert("Failed to send invitation emails")
    } finally {
      setSendingInvitations(false)
    }
  }

  const handleExportResults = async () => {
    if (!testId || typeof testId !== 'string' || candidates.length === 0) {
      alert('No candidates to export')
      return
    }

    setExportingResults(true)
    try {
      const exportData: Array<{
        name: string
        email: string
        score: number
        feedback: string
      }> = []
      
      for (const candidate of candidates) {
        try {
          const response = await fetch(`${API_URL}/tests/${testId}/candidates/${candidate._id}/analytics`)
          const analytics = response.ok ? await response.json() : null
          
          exportData.push({
            name: analytics?.candidate?.name || candidate.name || '',
            email: analytics?.candidate?.email || candidate.email || '',
            score: analytics?.submission?.score || candidate.submission_score || 0,
            feedback: analytics?.submission?.feedback?.feedback_summary || 'No feedback available'
          })
        } catch (err) {
          exportData.push({
            name: candidate.name || '',
            email: candidate.email || '',
            score: candidate.submission_score || 0,
            feedback: 'Analytics not available'
          })
        }
      }
      
      const dataWithHeaders = exportData.map(row => ({
        'Name': row.name,
        'Email': row.email,
        'Score': row.score,
        'Feedback': row.feedback
      }))
      
      const worksheet = XLSX.utils.json_to_sheet(dataWithHeaders)
      worksheet['!cols'] = [
        { wch: 25 },
        { wch: 35 },
        { wch: 10 },
        { wch: 80 }
      ]
      
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Results')
      
      const testTitle = test?.title || 'Design_Test'
      const sanitizedTitle = testTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30)
      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `design_test_results_${sanitizedTitle}_${dateStr}.xlsx`
      
      XLSX.writeFile(workbook, filename)
      
      alert(`Exported ${exportData.length} candidate results successfully!`)
    } catch (err) {
      console.error('Error exporting results:', err)
      alert('Failed to export results')
    } finally {
      setExportingResults(false)
    }
  }

  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) {
      return candidates
    }
    const query = searchQuery.toLowerCase().trim()
    return candidates.filter((candidate) => {
      const nameMatch = candidate.name?.toLowerCase().includes(query) || false
      const emailMatch = candidate.email?.toLowerCase().includes(query) || false
      return nameMatch || emailMatch
    })
  }, [candidates, searchQuery])

  const submittedCandidates = candidates.filter(c => c.has_submitted)
  const totalCandidates = candidates.length
  const submittedCount = submittedCandidates.length
  const avgScore = submittedCount > 0
    ? submittedCandidates.reduce((sum, c) => sum + (c.submission_score || 0), 0) / submittedCount
    : 0
  const passedCount = submittedCandidates.filter(c => (c.submission_score || 0) >= 60).length
  const failedCount = submittedCandidates.filter(c => (c.submission_score || 0) < 60).length

  const getCandidateStatus = (candidate: Candidate) => {
    if (candidate.has_submitted) return { text: 'Completed', color: '#059669', bg: '#D1FAE5' }
    if (candidate.started_at) return { text: 'Started', color: '#D97706', bg: '#FEF3C7' }
    if (candidate.invited) return { text: 'Invited', color: '#2563EB', bg: '#DBEAFE' }
    return { text: 'Pending', color: '#6B7280', bg: '#F3F4F6' }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div style={{ textAlign: "center" }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/dashboard")}
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
            Design Test Analytics
          </h1>
          <p style={{ color: "#64748b", margin: 0 }}>
            {test?.title || 'Design Test'} - View detailed analytics and submissions
          </p>
        </div>

        {/* Test Access Section */}
        {test && (
          <div style={{ 
            marginBottom: "2rem", 
            padding: "1.5rem", 
            backgroundColor: "#f8fafc", 
            borderRadius: "0.75rem", 
            border: "1px solid #e2e8f0" 
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 0 }}>
                Test Access & Settings
              </h2>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Link href={`/design/tests/${testId}/manage`}>
                  <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                    📊 Manage Test
                  </button>
                </Link>
              </div>
            </div>
            
            {test.test_token && (
              <div style={{ marginTop: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                  Test URL
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/design/tests/${testId}/take?token=${test.test_token}`}
                    readOnly
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      border: "1px solid #E8B4FA",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      backgroundColor: "#ffffff",
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const testUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/design/tests/${testId}/take?token=${test.test_token}`;
                      navigator.clipboard.writeText(testUrl);
                      alert("Test URL copied to clipboard!");
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
        <div style={{ 
          marginBottom: "2rem", 
          padding: "1.5rem", 
          backgroundColor: "#ffffff", 
          borderRadius: "0.75rem", 
          border: "1px solid #e2e8f0" 
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Candidates</h2>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {candidates.length > 0 && (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleExportResults}
                    disabled={exportingResults}
                    style={{ 
                      padding: "0.5rem 1rem", 
                      fontSize: "0.875rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem"
                    }}
                  >
                    {exportingResults ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Export Results
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleSendInvitationsToAll}
                    disabled={sendingInvitations}
                    style={{ 
                      padding: "0.5rem 1rem", 
                      fontSize: "0.875rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem"
                    }}
                  >
                    {sendingInvitations ? "Sending..." : "📧 Send Email to All"}
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowBulkUploadModal(true)}
                style={{ 
                  padding: "0.5rem 1rem", 
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem"
                }}
              >
                📤 Bulk Upload
              </button>
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
            </div>
          </div>
          
          {candidates.length === 0 ? (
            <div>
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>No candidates added yet.</p>
            </div>
          ) : (
            <div style={{ 
              maxHeight: "600px", 
              overflowY: "auto", 
              overflowX: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "0.5rem"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#f8fafc" }}>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Email</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Name</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Status</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => {
                    const status = getCandidateStatus(candidate)
                    return (
                      <tr key={candidate._id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>{candidate.email}</td>
                        <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>{candidate.name}</td>
                        <td style={{ padding: "0.75rem" }}>
                          <span style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: status.bg,
                            color: status.color,
                          }}>
                            {status.text}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
                            onClick={() => handleRemoveCandidate(candidate._id, candidate.name)}
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
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
          {/* Candidate List Sidebar */}
          <div>
            <div style={{
              border: "1px solid #e2e8f0",
              borderRadius: "0.75rem",
              padding: "1rem",
              backgroundColor: "#ffffff",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Candidates</h2>
                <input
                  type="text"
                  placeholder="🔍 Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: "0.375rem 0.75rem",
                    fontSize: "0.75rem",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.5rem",
                    outline: "none",
                    width: "150px",
                    backgroundColor: "#ffffff"
                  }}
                />
              </div>
              <button
                onClick={() => {
                  setSelectedCandidate(null)
                  setAnalytics(null)
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: selectedCandidate === null
                    ? "2px solid #7C3AED"
                    : "1px solid #e2e8f0",
                  backgroundColor: selectedCandidate === null
                    ? "#F9F5FF"
                    : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  marginBottom: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                📊 Overall Analytics
              </button>
              {filteredCandidates.length === 0 && candidates.length > 0 ? (
                <div>
                  <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                    No candidates found matching "{searchQuery}"
                  </p>
                </div>
              ) : candidates.length === 0 ? (
                <div>
                  <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                    No candidates found
                  </p>
                </div>
              ) : (
                <div style={{ 
                  maxHeight: "500px", 
                  overflowY: "auto",
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "0.5rem"
                }}>
                  {filteredCandidates.map((candidate) => (
                    <button
                      key={candidate._id}
                      onClick={() => handleCandidateSelect(candidate._id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        border: selectedCandidate === candidate._id
                          ? "2px solid #7C3AED"
                          : "1px solid #e2e8f0",
                        backgroundColor: selectedCandidate === candidate._id
                          ? "#F9F5FF"
                          : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{candidate.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                        {candidate.email}
                      </div>
                      {candidate.has_submitted && candidate.submission_score !== undefined && (
                        <div style={{ 
                          fontSize: "0.875rem", 
                          color: candidate.submission_score >= 70 ? "#166534" : candidate.submission_score >= 50 ? "#92400e" : "#991b1b",
                          marginTop: "0.25rem", 
                          fontWeight: 600 
                        }}>
                          Score: {candidate.submission_score}/100
                        </div>
                      )}
                    </button>
                  ))}
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
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  backgroundColor: "#ffffff",
                }}>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
                    Overall Test Performance
                  </h2>
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
                        {avgScore.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Passed</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{passedCount}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginTop: "1rem" }}>
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
                  </div>
                </div>
              </div>
            ) : !analytics ? (
              <div style={{
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                padding: "3rem",
                textAlign: "center",
                backgroundColor: "#ffffff",
              }}>
                <p style={{ color: "#64748b" }}>Select a candidate to view their analytics</p>
              </div>
            ) : !analytics.submission ? (
              <div style={{
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                padding: "3rem",
                textAlign: "center",
                backgroundColor: "#ffffff",
              }}>
                <p style={{ color: "#64748b" }}>
                  {analytics.candidate.name} has not submitted the test yet.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Candidate Information */}
                <div style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  backgroundColor: "#ffffff",
                }}>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
                    Candidate Information
                  </h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Name</div>
                      <div style={{ fontSize: "1rem", fontWeight: 600 }}>{analytics.candidate.name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Email</div>
                      <div style={{ fontSize: "1rem", fontWeight: 600 }}>{analytics.candidate.email}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Total Score</div>
                      <div style={{ 
                        fontSize: "1.5rem", 
                        fontWeight: 700,
                        color: analytics.submission.score >= 70 ? "#166534" : analytics.submission.score >= 50 ? "#92400e" : "#991b1b"
                      }}>
                        {analytics.submission.score}/100
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Started</div>
                      <div style={{ fontSize: "1rem" }}>{formatDate(analytics.submission.started_at)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Submitted</div>
                      <div style={{ fontSize: "1rem" }}>{formatDate(analytics.submission.submitted_at)}</div>
                    </div>
                  </div>
                </div>

                {/* Design Submission */}
                {analytics.submission.design_url && (
                  <div style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                    backgroundColor: "#ffffff",
                  }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
                      Design Submission
                    </h2>
                    <a 
                      href={analytics.submission.design_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.75rem 1.5rem",
                        backgroundColor: "#7C3AED",
                        color: "#ffffff",
                        borderRadius: "0.5rem",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      View Design in Penpot
                    </a>
                  </div>
                )}

                {/* Screenshots */}
                {analytics.submission.screenshots && analytics.submission.screenshots.length > 0 && (
                  <div style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                    backgroundColor: "#ffffff",
                  }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
                      Screenshots ({analytics.submission.screenshots.length})
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
                      {analytics.submission.screenshots.map((screenshot, idx) => (
                        <div key={idx} style={{ 
                          border: "1px solid #e2e8f0", 
                          borderRadius: "0.5rem", 
                          overflow: "hidden",
                          cursor: "pointer"
                        }}
                        onClick={() => window.open(screenshot, '_blank')}
                        >
                          <img 
                            src={screenshot} 
                            alt={`Screenshot ${idx + 1}`} 
                            style={{ width: "100%", height: "150px", objectFit: "cover" }} 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {analytics.submission.feedback && (
                  <div style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                    backgroundColor: "#f0fdf4",
                  }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem", color: "#166534" }}>
                      Evaluation Feedback
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
                      <div style={{ padding: "1rem", backgroundColor: "#ffffff", borderRadius: "0.5rem" }}>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Overall Score</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{analytics.submission.feedback.overall_score}/100</div>
                      </div>
                      <div style={{ padding: "1rem", backgroundColor: "#ffffff", borderRadius: "0.5rem" }}>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Rule-based Score</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{analytics.submission.feedback.rule_based_score}</div>
                      </div>
                      <div style={{ padding: "1rem", backgroundColor: "#ffffff", borderRadius: "0.5rem" }}>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>AI-based Score</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{analytics.submission.feedback.ai_based_score}</div>
                      </div>
                    </div>
                    <div style={{ padding: "1rem", backgroundColor: "#ffffff", borderRadius: "0.5rem" }}>
                      <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Feedback Summary</h3>
                      <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: "1.6", margin: 0 }}>
                        {analytics.submission.feedback.feedback_summary}
                      </p>
                    </div>
                  </div>
                )}
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
            setNewCandidateName("")
            setNewCandidateEmail("")
            setEmailError(null)
          }
        }}
        >
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "0.75rem",
            padding: "2rem",
            width: "90%",
            maxWidth: "600px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1.5rem", color: "#7C3AED" }}>
              Add Candidate
            </h2>
            
            {emailError && (
              <div style={{
                padding: "0.75rem",
                backgroundColor: "#FEE2E2",
                color: "#DC2626",
                borderRadius: "0.5rem",
                marginBottom: "1rem",
                fontSize: "0.875rem",
              }}>
                {emailError}
              </div>
            )}
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
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
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                  disabled={addingCandidate}
                />
              </div>
              <div>
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
                  placeholder="Enter candidate's email address"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: emailError ? "1px solid #ef4444" : "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                  disabled={addingCandidate}
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddCandidateModal(false)
                    setNewCandidateName("")
                    setNewCandidateEmail("")
                    setEmailError(null)
                  }}
                  disabled={addingCandidate}
                  style={{ marginTop: 0 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAddCandidate}
                  disabled={addingCandidate}
                  style={{ marginTop: 0 }}
                >
                  {addingCandidate ? "Adding..." : "Add Candidate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
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
          if (!uploadingBulk) {
            setShowBulkUploadModal(false)
          }
        }}
        >
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "0.75rem",
            padding: "2rem",
            width: "90%",
            maxWidth: "500px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1.5rem", color: "#7C3AED" }}>
              Bulk Upload Candidates
            </h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                  Upload CSV File <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>
                  Upload a CSV file with 'name' and 'email' columns. The first row should be the header.
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    
                    setUploadingBulk(true)
                    
                    const formData = new FormData()
                    formData.append('file', file)
                    
                    try {
                      const response = await fetch(`${API_URL}/tests/${testId}/bulk-add-candidates`, {
                        method: 'POST',
                        body: formData,
                      })
                      
                      if (response.ok) {
                        const data = await response.json()
                        const successCount = data.success_count || 0
                        const failedCount = data.failed_count || 0
                        const duplicateCount = data.duplicate_count || 0
                        
                        alert(
                          `Bulk upload completed!\n\n` +
                          `✅ Success: ${successCount}\n` +
                          `❌ Failed: ${failedCount}\n` +
                          `⚠️ Duplicates: ${duplicateCount}`
                        )
                        
                        await fetchCandidates()
                        e.target.value = ''
                        
                        if (successCount > 0) {
                          setShowBulkUploadModal(false)
                        }
                      } else {
                        const error = await response.json()
                        alert(error.detail || 'Failed to upload CSV')
                        e.target.value = ''
                      }
                    } catch (error) {
                      alert('Failed to upload CSV')
                      e.target.value = ''
                    } finally {
                      setUploadingBulk(false)
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    backgroundColor: "#ffffff",
                    cursor: "pointer",
                    fontSize: "0.875rem"
                  }}
                  disabled={uploadingBulk}
                />
                <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.5rem" }}>
                  Example CSV format:<br />
                  <code style={{ backgroundColor: "#f3f4f6", padding: "0.25rem 0.5rem", borderRadius: "0.25rem" }}>
                    name,email<br />
                    John Doe,john@example.com<br />
                    Jane Smith,jane@example.com
                  </code>
                </p>
              </div>
            </div>
            
            <div style={{ 
              display: "flex", 
              justifyContent: "flex-end", 
              gap: "0.75rem", 
              marginTop: "1.5rem" 
            }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowBulkUploadModal(false)
                }}
                disabled={uploadingBulk}
                style={{ marginTop: 0 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth
