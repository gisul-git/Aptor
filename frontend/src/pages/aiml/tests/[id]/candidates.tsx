'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, Trash2, BarChart2, Users, AlertCircle, Calendar, CheckCircle2, XCircle, Mail, Send } from 'lucide-react'
import { useAIMLCandidates, useRemoveAIMLCandidate, useSendAIMLInvitation, useSendAIMLInvitationsToAll } from '@/hooks/api/useAIML'

interface Candidate {
  user_id: string
  name: string
  email: string
  created_at: string | null
  has_submitted: boolean
  submission_score: number
  submitted_at: string | null
  invited?: boolean
  invited_at?: string | null
  status?: string
}

export default function AIMLCandidatesPage() {
  const router = useRouter()
  const { id: testId } = router.query
  const testIdStr = typeof testId === 'string' ? testId : undefined
  
  // React Query hooks
  const { data: candidatesData, isLoading: loading, refetch: refetchCandidates } = useAIMLCandidates(testIdStr)
  const removeCandidateMutation = useRemoveAIMLCandidate()
  const sendInvitationMutation = useSendAIMLInvitation()
  const sendInvitationsToAllMutation = useSendAIMLInvitationsToAll()
  
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [sendingToAll, setSendingToAll] = useState(false)
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set())
  const [sendingSelected, setSendingSelected] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [modalType, setModalType] = useState<'success' | 'error' | 'confirm'>('success')
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (candidatesData) {
      setCandidates(candidatesData)
      // Clear selection when candidates data changes
      setSelectedCandidates(new Set())
    }
  }, [candidatesData])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    return date.toLocaleString('en-US', options)
  }

  const showSuccessModal = (message: string) => {
    setModalMessage(message)
    setModalType('success')
    setShowModal(true)
  }

  const showErrorModal = (message: string) => {
    setModalMessage(message)
    setModalType('error')
    setShowModal(true)
  }

  const showConfirmModal = (message: string, onConfirm: () => void) => {
    setModalMessage(message)
    setModalType('confirm')
    setConfirmAction(() => onConfirm)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setConfirmAction(null)
  }

  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction()
    }
    closeModal()
  }

  const handleSendInvitation = async (email: string) => {
    if (!testIdStr) {
      alert('Test ID is required')
      return
    }
    
    setSendingEmail(email)
    try {
      await sendInvitationMutation.mutateAsync({ testId: testIdStr, email })
      await refetchCandidates()
      alert(`Invitation email sent successfully to ${email}`)
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to send invitation email')
    } finally {
      setSendingEmail(null)
    }
  }

  const handleSendInvitationsToAll = async () => {
    if (!testIdStr) {
      showErrorModal('Test ID is required')
      return
    }

    showConfirmModal(
      `Send invitation emails to all ${candidates.length} candidates?`,
      async () => {
        setSendingToAll(true)
        try {
          await sendInvitationsToAllMutation.mutateAsync(testIdStr)
          await refetchCandidates()
          showSuccessModal('Emails successfully sent to all candidates')
        } catch (error: any) {
          showErrorModal(error.response?.data?.detail || 'Failed to send invitation emails')
        } finally {
          setSendingToAll(false)
        }
      }
    )
  }

  const handleToggleCandidate = (email: string) => {
    setSelectedCandidates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(email)) {
        newSet.delete(email)
      } else {
        newSet.add(email)
      }
      return newSet
    })
  }

  const handleToggleAll = () => {
    if (selectedCandidates.size === candidates.length) {
      setSelectedCandidates(new Set())
    } else {
      setSelectedCandidates(new Set(candidates.map(c => c.email)))
    }
  }

  const handleSendToSelected = async () => {
    if (!testIdStr) {
      showErrorModal('Test ID is required')
      return
    }

    if (selectedCandidates.size === 0) {
      showErrorModal('Please select at least one candidate')
      return
    }

    // Get selected candidate names for the message
    const selectedNames = candidates
      .filter(c => selectedCandidates.has(c.email))
      .map(c => c.name)
      .join(', ')

    showConfirmModal(
      `Send invitation emails to: ${selectedNames}?`,
      async () => {
        setSendingSelected(true)
        try {
          for (const email of Array.from(selectedCandidates)) {
            try {
              await sendInvitationMutation.mutateAsync({ testId: testIdStr, email })
            } catch (error) {
              console.error(`Failed to send to ${email}:`, error)
            }
          }

          await refetchCandidates()
          setSelectedCandidates(new Set())
          showSuccessModal('Emails successfully sent to selected candidates')
        } catch (error: any) {
          showErrorModal('Failed to send invitation emails')
        } finally {
          setSendingSelected(false)
        }
      }
    )
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "#00684A" }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00684A]"></div>
          <span style={{ fontWeight: 500 }}>Loading candidates...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        
        {/* Back Button */}
        <div style={{ marginBottom: "2rem" }}>
          <button
            type="button"
            onClick={() => router.push("/aiml/tests")}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0",
              fontSize: "0.875rem", color: "#6B7280", backgroundColor: "transparent",
              border: "none", fontWeight: 600, cursor: "pointer", transition: "color 0.2s ease"
            }}
            onMouseOver={(e) => e.currentTarget.style.color = "#00684A"}
            onMouseOut={(e) => e.currentTarget.style.color = "#6B7280"}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back to Test Management
          </button>
        </div>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
            Candidates
          </h1>
          <p style={{ color: "#6B7280", fontSize: "1rem", margin: 0 }}>
            View and manage all candidates invited to this assessment.
          </p>
        </div>

        {candidates.length === 0 ? (
          <div style={{ backgroundColor: "#ffffff", padding: "4rem 2rem", borderRadius: "1rem", border: "1px dashed #D1D5DB", textAlign: "center" }}>
            <Users size={40} color="#9CA3AF" style={{ margin: "0 auto 1rem auto" }} />
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.125rem", fontWeight: 600 }}>No candidates yet</h3>
            <p style={{ margin: 0, color: "#6B7280", fontSize: "0.95rem" }}>
              Add candidates from the test management page to see them appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Stats Row with Actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ backgroundColor: "#ffffff", padding: "0.75rem 1.25rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ color: "#6B7280", fontSize: "0.875rem", fontWeight: 500 }}>Total Invited:</span>
                  <span style={{ color: "#111827", fontSize: "1rem", fontWeight: 700 }}>{candidates.length}</span>
                </div>
                <div style={{ backgroundColor: "#ffffff", padding: "0.75rem 1.25rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ color: "#6B7280", fontSize: "0.875rem", fontWeight: 500 }}>Submitted:</span>
                  <span style={{ color: "#00684A", fontSize: "1rem", fontWeight: 700 }}>{candidates.filter(c => c.has_submitted).length}</span>
                </div>
                {selectedCandidates.size > 0 && (
                  <div style={{ backgroundColor: "#E0F2FE", padding: "0.75rem 1.25rem", borderRadius: "0.5rem", border: "1px solid #7DD3FC", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ color: "#0369A1", fontSize: "0.875rem", fontWeight: 500 }}>Selected:</span>
                    <span style={{ color: "#0C4A6E", fontSize: "1rem", fontWeight: 700 }}>{selectedCandidates.size}</span>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                {selectedCandidates.size > 0 && (
                  <button
                    onClick={handleSendToSelected}
                    disabled={sendingSelected}
                    style={{ 
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.75rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#ffffff", 
                      backgroundColor: "#0284C7", border: "none", borderRadius: "0.5rem", 
                      cursor: sendingSelected ? "not-allowed" : "pointer", 
                      opacity: sendingSelected ? 0.6 : 1,
                      transition: "all 0.2s",
                      boxShadow: "0 2px 4px rgba(2, 132, 199, 0.2)"
                    }}
                    onMouseEnter={(e) => { 
                      if (!sendingSelected) {
                        e.currentTarget.style.backgroundColor = "#0369A1"
                        e.currentTarget.style.boxShadow = "0 4px 8px rgba(2, 132, 199, 0.3)"
                      }
                    }}
                    onMouseLeave={(e) => { 
                      if (!sendingSelected) {
                        e.currentTarget.style.backgroundColor = "#0284C7"
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(2, 132, 199, 0.2)"
                      }
                    }}
                  >
                    <Mail size={16} />
                    {sendingSelected ? 'Sending...' : `Send to Selected (${selectedCandidates.size})`}
                  </button>
                )}
                
                <button
                  onClick={handleSendInvitationsToAll}
                  disabled={sendingToAll || candidates.length === 0}
                  style={{ 
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.75rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#ffffff", 
                    backgroundColor: "#00684A", border: "none", borderRadius: "0.5rem", 
                    cursor: (sendingToAll || candidates.length === 0) ? "not-allowed" : "pointer", 
                    opacity: (sendingToAll || candidates.length === 0) ? 0.6 : 1,
                    transition: "all 0.2s",
                    boxShadow: "0 2px 4px rgba(0, 104, 74, 0.2)"
                  }}
                  onMouseEnter={(e) => { 
                    if (!sendingToAll && candidates.length > 0) {
                      e.currentTarget.style.backgroundColor = "#084A2A"
                      e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 104, 74, 0.3)"
                    }
                  }}
                  onMouseLeave={(e) => { 
                    if (!sendingToAll && candidates.length > 0) {
                      e.currentTarget.style.backgroundColor = "#00684A"
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 104, 74, 0.2)"
                    }
                  }}
                >
                  <Send size={16} />
                  {sendingToAll ? 'Sending...' : 'Send to All'}
                </button>
              </div>
            </div>

            {/* Select All Checkbox */}
            <div style={{ 
              backgroundColor: "#F9FAFB", 
              padding: "0.75rem 1rem", 
              borderRadius: "0.5rem", 
              border: "1px solid #E5E7EB",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem"
            }}>
              <input
                type="checkbox"
                checked={candidates.length > 0 && selectedCandidates.size === candidates.length}
                onChange={handleToggleAll}
                style={{ 
                  width: "18px", 
                  height: "18px", 
                  cursor: "pointer",
                  accentColor: "#00684A"
                }}
              />
              <label 
                onClick={handleToggleAll}
                style={{ 
                  fontSize: "0.875rem", 
                  fontWeight: 600, 
                  color: "#374151",
                  cursor: "pointer",
                  userSelect: "none"
                }}
              >
                Select candidates to send invitation emails
              </label>
            </div>

            {/* Candidates List */}
            {candidates.map((candidate) => (
              <div key={candidate.user_id} style={{ 
                backgroundColor: "#ffffff", borderRadius: "1rem", border: "1px solid #E5E7EB", 
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "1.5rem", transition: "all 0.2s ease" 
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#00684A";
                e.currentTarget.style.boxShadow = "0 8px 16px rgba(0, 104, 74, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E5E7EB";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
              }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
                  
                  {/* Left Side: Checkbox + Info */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flex: 1, minWidth: "300px" }}>
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedCandidates.has(candidate.email)}
                      onChange={() => handleToggleCandidate(candidate.email)}
                      style={{ 
                        width: "20px", 
                        height: "20px", 
                        cursor: "pointer",
                        marginTop: "0.25rem",
                        accentColor: "#00684A"
                      }}
                    />
                    
                    {/* Candidate Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                        <h3 style={{ margin: 0, color: "#111827", fontSize: "1.125rem", fontWeight: 700 }}>{candidate.name}</h3>
                        <span style={{ 
                          display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", 
                          borderRadius: "2rem", fontSize: "0.75rem", fontWeight: 600, 
                          color: candidate.has_submitted ? "#059669" : "#4B5563", 
                          backgroundColor: candidate.has_submitted ? "#D1FAE5" : "#F3F4F6", 
                          border: `1px solid ${candidate.has_submitted ? "#A7F3D0" : "#E5E7EB"}` 
                        }}>
                          {candidate.has_submitted ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {candidate.has_submitted ? 'Submitted' : 'Pending'}
                        </span>
                        {candidate.has_submitted && (
                          <span style={{ 
                            display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.25rem 0.625rem", 
                            borderRadius: "2rem", fontSize: "0.75rem", fontWeight: 600, 
                            color: "#1E3A8A", backgroundColor: "#DBEAFE", border: "1px solid #BFDBFE"
                          }}>
                            Score: {candidate.submission_score || 0}/100
                          </span>
                        )}
                      </div>
                      
                      <p style={{ margin: "0 0 1rem 0", color: "#4B5563", fontSize: "0.9375rem" }}>
                        {candidate.email}
                      </p>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.8rem", color: "#6B7280" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                          <Calendar size={14} /> Added: {formatDate(candidate.created_at)}
                        </span>
                        {candidate.submitted_at && (
                          <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "#059669" }}>
                            <CheckCircle2 size={14} /> Submitted: {formatDate(candidate.submitted_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      onClick={() => router.push(`/aiml/tests/${String(testId)}/analytics?candidate=${candidate.user_id}`)}
                      title="View analytics for this candidate"
                      style={{ 
                        display: "flex", alignItems: "center", gap: "0.375rem",
                        padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151", 
                        backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", 
                        cursor: "pointer", transition: "all 0.2s" 
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                    >
                      <BarChart2 size={16} /> Analytics
                    </button>
                    
                    <button
                      onClick={async () => {
                        if (!confirm(`Remove ${candidate.name} (${candidate.email}) from this test?`)) return
                        if (!testIdStr) {
                          alert('Test ID is required')
                          return
                        }
                        try {
                          await removeCandidateMutation.mutateAsync({ testId: testIdStr, userId: candidate.user_id })
                          await refetchCandidates()
                          alert('Candidate removed')
                        } catch (err: any) {
                          alert(err.response?.data?.detail || err.message || 'Failed to remove candidate')
                        }
                      }}
                      style={{ 
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "0.5rem", color: "#DC2626", backgroundColor: "transparent", 
                        border: "1px solid transparent", borderRadius: "0.5rem", cursor: "pointer", 
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#FEE2E2"
                        e.currentTarget.style.borderColor = "#FECDD3"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent"
                        e.currentTarget.style.borderColor = "transparent"
                      }}
                      title="Remove Candidate"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(17, 24, 39, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem"
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && modalType !== 'confirm') {
              closeModal()
            }
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "1rem",
              width: "100%",
              maxWidth: "450px",
              padding: "2rem",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center" }}>
              {modalType === 'success' && (
                <div style={{ 
                  width: "64px", 
                  height: "64px", 
                  borderRadius: "50%", 
                  backgroundColor: "#D1FAE5", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  margin: "0 auto 1.5rem auto"
                }}>
                  <CheckCircle2 size={32} color="#059669" />
                </div>
              )}
              {modalType === 'error' && (
                <div style={{ 
                  width: "64px", 
                  height: "64px", 
                  borderRadius: "50%", 
                  backgroundColor: "#FEE2E2", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  margin: "0 auto 1.5rem auto"
                }}>
                  <XCircle size={32} color="#DC2626" />
                </div>
              )}
              {modalType === 'confirm' && (
                <div style={{ 
                  width: "64px", 
                  height: "64px", 
                  borderRadius: "50%", 
                  backgroundColor: "#DBEAFE", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  margin: "0 auto 1.5rem auto"
                }}>
                  <Mail size={32} color="#0284C7" />
                </div>
              )}

              <h3 style={{ 
                margin: "0 0 0.75rem 0", 
                fontSize: "1.25rem", 
                fontWeight: 700, 
                color: "#111827" 
              }}>
                {modalType === 'success' && 'Success!'}
                {modalType === 'error' && 'Error'}
                {modalType === 'confirm' && 'Confirm Action'}
              </h3>

              <p style={{ 
                margin: "0 0 2rem 0", 
                fontSize: "0.95rem", 
                color: "#6B7280",
                lineHeight: "1.6"
              }}>
                {modalMessage}
              </p>

              {modalType === 'confirm' ? (
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    onClick={closeModal}
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      backgroundColor: "#ffffff",
                      border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem",
                      fontWeight: 600,
                      color: "#374151",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      backgroundColor: "#00684A",
                      border: "1px solid #00684A",
                      borderRadius: "0.5rem",
                      fontWeight: 600,
                      color: "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#084A2A"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
                  >
                    Confirm
                  </button>
                </div>
              ) : (
                <button
                  onClick={closeModal}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    backgroundColor: "#00684A",
                    border: "1px solid #00684A",
                    borderRadius: "0.5rem",
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#084A2A"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}