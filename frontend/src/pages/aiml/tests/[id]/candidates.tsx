'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, Trash2, BarChart2, Users, AlertCircle, Calendar, CheckCircle2, XCircle } from 'lucide-react'
import { useAIMLCandidates, useRemoveAIMLCandidate } from '@/hooks/api/useAIML'

interface Candidate {
  user_id: string
  name: string
  email: string
  created_at: string | null
  has_submitted: boolean
  submission_score: number
  submitted_at: string | null
}

export default function AIMLCandidatesPage() {
  const router = useRouter()
  const { id: testId } = router.query
  const testIdStr = typeof testId === 'string' ? testId : undefined
  
  // React Query hooks
  const { data: candidatesData, isLoading: loading, refetch: refetchCandidates } = useAIMLCandidates(testIdStr)
  const removeCandidateMutation = useRemoveAIMLCandidate()
  
  const [candidates, setCandidates] = useState<Candidate[]>([])

  useEffect(() => {
    if (candidatesData) {
      setCandidates(candidatesData)
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
            
            {/* Stats Row */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
              <div style={{ backgroundColor: "#ffffff", padding: "0.75rem 1.25rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ color: "#6B7280", fontSize: "0.875rem", fontWeight: 500 }}>Total Invited:</span>
                <span style={{ color: "#111827", fontSize: "1rem", fontWeight: 700 }}>{candidates.length}</span>
              </div>
              <div style={{ backgroundColor: "#ffffff", padding: "0.75rem 1.25rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ color: "#6B7280", fontSize: "0.875rem", fontWeight: 500 }}>Submitted:</span>
                <span style={{ color: "#00684A", fontSize: "1rem", fontWeight: 700 }}>{candidates.filter(c => c.has_submitted).length}</span>
              </div>
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
                  
                  {/* Left Side: Info */}
                  <div style={{ flex: 1, minWidth: "300px" }}>
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
    </div>
  )
}