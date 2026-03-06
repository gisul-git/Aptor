import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import Link from 'next/link'

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

export default function DesignTestManagePage() {
  const router = useRouter()
  const { testId } = router.query
  const [test, setTest] = useState<Test | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false)
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)
  const [newCandidateName, setNewCandidateName] = useState("")
  const [newCandidateEmail, setNewCandidateEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [addingCandidate, setAddingCandidate] = useState(false)
  const [uploadingBulk, setUploadingBulk] = useState(false)
  
  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design'

  useEffect(() => {
    if (testId) {
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

  const handlePublish = async () => {
    if (!test) return
    
    setPublishing(true)
    try {
      const response = await fetch(`${API_URL}/tests/${testId}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !test.is_published }),
      })
      
      if (response.ok) {
        alert(`Test ${test.is_published ? 'unpublished' : 'published'} successfully!`)
        fetchTest()
      } else {
        alert('Failed to update publish status')
      }
    } catch (error) {
      alert('Failed to update publish status')
    } finally {
      setPublishing(false)
    }
  }

  const copyTestUrl = () => {
    if (!test?.test_token) return
    const url = `${window.location.origin}/design/tests/${testId}/take?token=${test.test_token}`
    navigator.clipboard.writeText(url)
    alert('Test URL copied to clipboard!')
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
        alert("Candidate removed successfully!")
      } else {
        alert("Failed to remove candidate")
      }
    } catch (error) {
      alert("Failed to remove candidate")
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getCandidateStatus = (candidate: Candidate) => {
    if (candidate.has_submitted) return { text: 'Completed', color: '#059669', bg: '#D1FAE5' }
    if (candidate.started_at) return { text: 'Started', color: '#D97706', bg: '#FEF3C7' }
    if (candidate.invited) return { text: 'Invited', color: '#2563EB', bg: '#DBEAFE' }
    return { text: 'Pending', color: '#6B7280', bg: '#F3F4F6' }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div style={{ textAlign: "center" }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (!test) {
    return (
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div style={{ textAlign: "center" }}>Test not found</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/design/tests")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            ← Back
          </button>
        </div>

        <div className="card">
          <h1 style={{ marginBottom: "0.5rem", color: "#1a1625" }}>Test Management</h1>
          <p style={{ marginBottom: "2rem", color: "#64748b" }}>Manage tests and candidates</p>

          <div style={{ marginBottom: "2rem", padding: "1.5rem", border: "1px solid #E8B4FA", borderRadius: "0.5rem", backgroundColor: "#F9F5FF" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem", color: "#1a1625" }}>{test.title}</h2>
                <div style={{ display: "flex", gap: "1rem", fontSize: "0.875rem", color: "#64748b" }}>
                  <span>⏱️ {test.duration_minutes} minutes</span>
                  <span>📝 {test.question_ids?.length || 0} questions</span>
                  {test.proctoring_enabled && <span>🎥 Proctored</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: test.is_published ? "#059669" : "#6B7280",
                  backgroundColor: test.is_published ? "#D1FAE5" : "#F3F4F6",
                }}>
                  {test.is_published ? "Published" : "Draft"}
                </span>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="btn-secondary"
                  style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                >
                  {publishing ? "..." : test.is_published ? "Unpublish" : "Publish"}
                </button>
                <Link href={`/design/tests/${testId}/edit`}>
                  <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                    ✏️ Edit
                  </button>
                </Link>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ marginBottom: "1rem", color: "#7C3AED", fontSize: "1.25rem", fontWeight: 600 }}>Test Access & Email Settings</h3>
            <div style={{ padding: "1.5rem", border: "1px solid #E8B4FA", borderRadius: "0.5rem" }}>
              <p style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#64748b" }}>Using system default email template</p>
              
              {/* Only show test URL if test is published AND has candidates */}
              {test.is_published && test.test_token && candidates.length > 0 ? (
                <>
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>Test URL</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/design/tests/${testId}/take?token=${test.test_token}`}
                        style={{
                          flex: 1,
                          padding: "0.75rem",
                          border: "1px solid #E8B4FA",
                          borderRadius: "0.375rem",
                          backgroundColor: "#F9F5FF",
                          fontSize: "0.875rem",
                        }}
                      />
                      <button
                        onClick={copyTestUrl}
                        className="btn-primary"
                        style={{ padding: "0.75rem 1.5rem", fontSize: "0.875rem" }}
                      >
                        Copy URL
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button 
                      onClick={() => {
                        const testUrl = `${window.location.origin}/design/tests/${testId}/take?token=${test.test_token}`;
                        window.open(testUrl, '_blank');
                      }}
                      className="btn-primary" 
                      style={{ padding: "0.75rem 1.5rem", fontSize: "0.875rem" }}
                    >
                      🧪 Test This Test
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ 
                  padding: "1.5rem", 
                  backgroundColor: "#FEF3C7", 
                  borderRadius: "0.5rem",
                  border: "1px solid #FCD34D"
                }}>
                  <p style={{ fontSize: "0.875rem", color: "#92400E", marginBottom: "0.5rem", fontWeight: 600 }}>
                    ⚠️ Test URL Not Available
                  </p>
                  <p style={{ fontSize: "0.875rem", color: "#92400E", marginBottom: 0 }}>
                    {!test.is_published 
                      ? "Please publish the test first to generate the test URL."
                      : candidates.length === 0
                        ? "Please add candidates first to access the test URL."
                        : "Test URL will be available once candidates are added."}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ color: "#7C3AED", fontSize: "1.25rem", fontWeight: 600 }}>Candidates ({candidates.length})</h3>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button 
                  className="btn-secondary" 
                  style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                  onClick={() => setShowBulkUploadModal(true)}
                >
                  📤 Bulk Upload
                </button>
                <button 
                  className="btn-primary" 
                  style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                  onClick={() => setShowAddCandidateModal(true)}
                >
                  ➕ Add Candidate
                </button>
              </div>
            </div>
            
            {candidates.length === 0 ? (
              <div style={{ padding: "3rem", border: "1px solid #E8B4FA", borderRadius: "0.5rem", textAlign: "center", color: "#64748b" }}>
                <p>No candidates added yet.</p>
              </div>
            ) : (
              <div style={{ border: "1px solid #E8B4FA", borderRadius: "0.5rem", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F9F5FF", borderBottom: "1px solid #E8B4FA" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#7C3AED" }}>Name</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#7C3AED" }}>Email</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#7C3AED" }}>Status</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#7C3AED" }}>Score</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#7C3AED" }}>Added</th>
                      <th style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.875rem", fontWeight: 600, color: "#7C3AED" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate, index) => {
                      const status = getCandidateStatus(candidate)
                      return (
                        <tr key={candidate._id} style={{ borderBottom: index < candidates.length - 1 ? "1px solid #E8B4FA" : "none" }}>
                          <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1a1625" }}>{candidate.name}</td>
                          <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#64748b" }}>{candidate.email}</td>
                          <td style={{ padding: "0.75rem" }}>
                            <span style={{
                              padding: "0.25rem 0.75rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: status.color,
                              backgroundColor: status.bg,
                            }}>
                              {status.text}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#1a1625" }}>
                            {candidate.submission_score !== null && candidate.submission_score !== undefined ? `${candidate.submission_score}/100` : '-'}
                          </td>
                          <td style={{ padding: "0.75rem", fontSize: "0.875rem", color: "#64748b" }}>{formatDate(candidate.created_at)}</td>
                          <td style={{ padding: "0.75rem", textAlign: "center" }}>
                            <button
                              onClick={() => handleRemoveCandidate(candidate._id, candidate.name)}
                              style={{
                                padding: "0.25rem 0.75rem",
                                fontSize: "0.75rem",
                                color: "#DC2626",
                                backgroundColor: "#FEE2E2",
                                border: "none",
                                borderRadius: "0.375rem",
                                cursor: "pointer",
                                fontWeight: 600,
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
            maxWidth: "500px",
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
                  Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={newCandidateName}
                  onChange={(e) => setNewCandidateName(e.target.value)}
                  placeholder="Enter candidate name"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                  disabled={addingCandidate}
                />
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                  Email <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="email"
                  value={newCandidateEmail}
                  onChange={(e) => setNewCandidateEmail(e.target.value)}
                  placeholder="Enter candidate email"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #E8B4FA",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                  disabled={addingCandidate}
                />
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
