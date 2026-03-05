'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Clock, Eye, EyeOff, Users, Mail, Edit3, UploadCloud, List, ArrowLeft, Copy, CheckCircle2, Calendar, AlertCircle, FileSpreadsheet, X, Check } from 'lucide-react'
import Link from 'next/link'
import { useDSATests, useAddDSACandidate, useBulkAddDSACandidates, useUpdateDSATest } from '@/hooks/api/useDSA'
import { useQueryClient } from '@tanstack/react-query'
import apiClient from '@/services/api/client'

// Helper function to format dates
const formatDate = (dateString: string | null, formatStr: string): string => {
  if (!dateString) return ''
  
  let normalizedIso = dateString
  if (!normalizedIso.endsWith('Z') && !normalizedIso.match(/[+-]\d{2}:\d{2}$/)) {
    if (normalizedIso.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/)) {
      normalizedIso = normalizedIso + 'Z'
    }
  }
  
  const date = new Date(normalizedIso)
  if (isNaN(date.getTime())) {
    return ''
  }
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[date.getMonth()]
  const day = date.getDate()
  const year = date.getFullYear()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  
  if (formatStr === 'MMM dd, yyyy HH:mm') {
    return `${month} ${day}, ${year} ${hours}:${minutes}`
  }
  return date.toLocaleDateString()
}

interface Test {
  id: string
  title: string
  description: string
  duration_minutes: number
  start_time: string
  end_time: string | null
  is_active: boolean
  is_published: boolean
  invited_users: string[]
  question_ids?: string[]
  test_token?: string
  pausedAt?: string | null
  examMode?: "strict" | "flexible"
  schedule?: { startTime?: string; endTime?: string; duration?: number } | null
  isExpired?: boolean // Added computed property
}

export default function TestsListPage() {
  const router = useRouter()
  const [inviteModal, setInviteModal] = useState<{ testId: string; open: boolean }>({ testId: '', open: false })
  
  const { data: testsData, isLoading: loading, error, refetch: refetchTests } = useDSATests()
  const [tests, setTests] = useState<Test[]>([])
  const queryClient = useQueryClient()
  
  const addCandidateMutation = useAddDSACandidate()
  const bulkAddCandidatesMutation = useBulkAddDSACandidates()
  const updateTestMutation = useUpdateDSATest()
  
  // Map API data and calculate expiration
  useEffect(() => {
    if (testsData) {
      const now = new Date();

      const mappedTests: Test[] = testsData.map((t: any) => {
        const examMode = t.examMode || t.exam_mode || 'strict';
        const startTimeStr = t.start_time || t.schedule?.startTime || '';
        const endTimeStr = t.end_time || t.schedule?.endTime || '';
        const duration = t.duration_minutes || t.duration || 60;
        
        let isExpired = false;

        if (startTimeStr) {
          const start = new Date(startTimeStr);
          if (!isNaN(start.getTime())) {
            if (examMode === 'flexible' && endTimeStr) {
              const end = new Date(endTimeStr);
              if (!isNaN(end.getTime()) && now > end) {
                isExpired = true;
              }
            } else if (examMode === 'strict') {
              // strict mode uses start time + duration
              const end = new Date(start.getTime() + (duration * 60000));
              if (now > end) {
                isExpired = true;
              }
            }
          }
        }

        return {
          id: t.id || '',
          title: t.title || '',
          description: t.description || '',
          duration_minutes: duration,
          start_time: startTimeStr,
          end_time: endTimeStr || null,
          is_active: t.is_active !== undefined ? t.is_active : true,
          is_published: t.is_published || false,
          invited_users: t.invited_users || [],
          question_ids: t.question_ids || t.questions?.map((q: any) => q.id || q) || [],
          test_token: t.test_token,
          pausedAt: t.pausedAt || null,
          examMode: examMode,
          schedule: t.schedule || null,
          isExpired,
        }
      })
      setTests(mappedTests)
    }
  }, [testsData])

  // Auto-unpublish expired tests
  useEffect(() => {
    const expiredPublishedTests = tests.filter(t => t.isExpired && t.is_published);
    
    if (expiredPublishedTests.length > 0) {
      let updated = false;
      
      Promise.all(
        expiredPublishedTests.map(t => 
          apiClient.patch(`/api/v1/dsa/tests/${t.id}/publish`, { is_published: false })
            .then(() => { updated = true; })
            .catch(err => console.error(`Failed to auto-unpublish expired test ${t.id}`, err))
        )
      ).then(() => {
        if (updated) {
          queryClient.invalidateQueries({ queryKey: ['dsa', 'tests'] });
          refetchTests();
        }
      });
    }
  }, [tests, queryClient, refetchTests]);

  useEffect(() => {
    if (router.query.refreshed === 'true') {
      setTimeout(() => {
        refetchTests()
      }, 100)
      const testId = router.query.testId
      const nextQuery: Record<string, any> = {}
      if (testId) nextQuery.testId = testId
      router.replace({ pathname: '/dsa/tests', query: nextQuery }, undefined, { shallow: true })
    }
  }, [router.query.refreshed, router.query.testId, refetchTests])

  useEffect(() => {
    const q = router.query.testId
    const testId = typeof q === 'string' ? q : (Array.isArray(q) ? q[0] : undefined)
    if (testId && tests.length > 0) {
      const found = tests.find(t => String(t.id) === String(testId))
      if (!found) {
        refetchTests()
      }
    }
  }, [router.query.testId, tests, refetchTests])

  const filteredTests = (() => {
    const q = router.query.testId
    const testId = typeof q === 'string' ? q : (Array.isArray(q) ? q[0] : undefined)
    if (!testId) return tests
    return tests.filter(t => String(t.id) === String(testId))
  })()

  const handlePublish = async (testId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus
      await apiClient.patch(`/api/v1/dsa/tests/${testId}/publish`, {
        is_published: newStatus,
      })

      await queryClient.invalidateQueries({ queryKey: ['dsa', 'tests'] })
      await refetchTests()
      
    } catch (error: any) {
      alert(error.response?.data?.detail || error.message || 'Failed to update publish status')
    }
  }

  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [addingCandidate, setAddingCandidate] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<{testId: string, link: string, name: string, email: string} | null>(null)

  const handleAddCandidate = async (testId: string) => {
    if (!candidateName.trim() || !candidateEmail.trim()) {
      alert('Please enter both name and email')
      return
    }

    setAddingCandidate(true)
    try {
      const response = await addCandidateMutation.mutateAsync({
        testId,
        data: {
          name: candidateName.trim(),
          email: candidateEmail.trim(),
        }
      })
      
      const responseData = response.data
      setGeneratedLink({
        testId: testId,
        link: '', 
        name: responseData?.name || candidateName.trim(),
        email: responseData?.email || candidateEmail.trim()
      })
      
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to add candidate')
    } finally {
      setAddingCandidate(false)
    }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "#00684A" }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00684A]"></div>
          <span style={{ fontWeight: 500 }}>Loading tests...</span>
        </div>
      </div>
    )
  }

  return (
   <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        
        {/* Back Button */}
        <div style={{ marginBottom: "2rem" }}>
          <button
            type="button"
            onClick={() => router.push("/dsa")}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0",
              fontSize: "0.875rem", color: "#6B7280", backgroundColor: "transparent",
              border: "none", fontWeight: 600, cursor: "pointer", transition: "color 0.2s ease"
            }}
            onMouseOver={(e) => e.currentTarget.style.color = "#00684A"}
            onMouseOut={(e) => e.currentTarget.style.color = "#6B7280"}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back
          </button>
        </div>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
              Test Management
            </h1>
            <p style={{ color: "#6B7280", fontSize: "1rem", margin: 0 }}>
              Manage your DSA assessments, invite candidates, and review configurations.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ 
              padding: "0.625rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#ffffff",
              backgroundColor: "#00684A", border: "none", borderRadius: "9999px", cursor: "pointer", 
              boxShadow: "0 4px 6px -1px rgba(0, 104, 74, 0.2)", transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#084A2A"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
            title="Save and go back to dashboard"
          >
            Save & Exit
          </button>
        </div>

        {filteredTests.length === 0 ? (
          <div style={{ backgroundColor: "#ffffff", padding: "4rem 2rem", borderRadius: "1rem", border: "1px dashed #D1D5DB", textAlign: "center" }}>
            <AlertCircle size={40} color="#9CA3AF" style={{ margin: "0 auto 1rem auto" }} />
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.125rem", fontWeight: 600 }}>No tests found</h3>
            <p style={{ margin: 0, color: "#6B7280", fontSize: "0.95rem" }}>
              {router.query.testId ? 'The requested test could not be found.' : 'You haven\'t created any tests yet. Head to the dashboard to create one.'}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {filteredTests.map((test) => (
              <div key={test.id} style={{ 
                backgroundColor: "#ffffff", borderRadius: "1rem", border: "1px solid #E5E7EB", 
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "2rem", transition: "all 0.2s ease",
                opacity: test.isExpired ? 0.9 : 1
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
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "2rem", flexWrap: "wrap" }}>
                  
                  {/* Left Side: Test Info */}
                  <div style={{ flex: 1, minWidth: "350px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, color: "#111827", fontSize: "1.25rem", fontWeight: 700 }}>{test.title}</h3>
                      
                      {test.isExpired ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", borderRadius: "2rem", fontSize: "0.75rem", fontWeight: 600, color: "#4B5563", backgroundColor: "#F3F4F6", border: "1px solid #E5E7EB" }}>
                          <Check size={14} /> Completed
                        </span>
                      ) : (
                        <>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", borderRadius: "2rem", fontSize: "0.75rem", fontWeight: 600, color: test.is_active ? "#059669" : "#4B5563", backgroundColor: test.is_active ? "#D1FAE5" : "#F3F4F6", border: `1px solid ${test.is_active ? "#A7F3D0" : "#E5E7EB"}` }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: test.is_active ? "#059669" : "#6B7280" }} />
                            {test.is_active ? 'Active' : 'Inactive'}
                          </span>
                          
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", borderRadius: "2rem", fontSize: "0.75rem", fontWeight: 600, color: test.is_published ? "#00684A" : "#6B7280", backgroundColor: test.is_published ? "#E8FAF0" : "#F3F4F6", border: `1px solid ${test.is_published ? "#A8E8BC" : "#E5E7EB"}` }}>
                            {test.is_published ? 'Published' : 'Draft'}
                          </span>
                        </>
                      )}

                      {test.pausedAt && !test.isExpired && (
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "0.25rem 0.625rem", borderRadius: "2rem", fontSize: "0.75rem", fontWeight: 600, color: "#B45309", backgroundColor: "#FEF3C7", border: "1px solid #FDE68A" }}>
                          Paused
                        </span>
                      )}
                    </div>
                    
                    <p style={{ margin: "0 0 1.25rem 0", color: "#4B5563", fontSize: "0.95rem", lineHeight: "1.5" }}>
                      {test.description}
                    </p>
                    
                    {/* Metadata Badges */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <Clock size={14} /> {test.duration_minutes} mins
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: test.isExpired ? "#DC2626" : "#6B7280", backgroundColor: test.isExpired ? "#FEF2F2" : "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: `1px solid ${test.isExpired ? "#FECACA" : "#E5E7EB"}`, fontWeight: 500 }}>
                        <Calendar size={14} /> 
                        {formatDate(test.schedule?.startTime || test.start_time, 'MMM dd, yyyy HH:mm')} 
                        {test.examMode === "flexible" && (test.schedule?.endTime || test.end_time) ? ` - ${formatDate(test.schedule?.endTime || test.end_time, 'MMM dd, yyyy HH:mm')}` : ''}
                      </span>
                      {test.examMode === "strict" && (
                         <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#B45309", backgroundColor: "#FEF3C7", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #FDE68A", fontWeight: 600 }}>
                           Fixed Window
                         </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <Users size={14} /> {test.invited_users?.length || 0} Candidates
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <List size={14} /> {test.question_ids?.length || 0} Questions
                      </span>
                    </div>

                    {/* Shared Link Box - Hidden if Expired */}
                    {test.is_published && test.test_token && !test.isExpired && (
                      <div style={{ padding: "1rem", backgroundColor: "#F0F9F4", border: "1px solid #A8E8BC", borderRadius: "0.5rem", marginTop: "1rem" }}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#00684A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                          Assessment Link
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <input
                            type="text"
                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/test/${test.id}?token=${test.test_token}`}
                            readOnly
                            style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", backgroundColor: "#ffffff", fontSize: "0.875rem", fontFamily: "monospace", color: "#374151", outline: "none" }}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const link = `${window.location.origin}/test/${test.id}?token=${test.test_token}`
                              try {
                                await navigator.clipboard.writeText(link)
                                alert('Link copied to clipboard!')
                              } catch (err) {
                                const input = document.createElement('input')
                                input.value = link
                                document.body.appendChild(input)
                                input.select()
                                document.execCommand('copy')
                                document.body.removeChild(input)
                                alert('Link copied to clipboard!')
                              }
                            }}
                            style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", backgroundColor: "#00684A", border: "1px solid #00684A", borderRadius: "0.375rem", color: "#ffffff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#084A2A"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
                          >
                            <Copy size={14} /> Copy
                          </button>
                        </div>
                        <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.75rem", color: "#2D7A52" }}>
                          Share this universal link with candidates. They will verify their identity upon entry.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Action Control Panel */}
                  <div style={{ width: "260px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    
                    <button
                      onClick={() => {
                        setInviteModal({ testId: test.id, open: true })
                        setGeneratedLink(null)
                        setCandidateName('')
                        setCandidateEmail('')
                      }}
                      disabled={!test.is_published || test.isExpired}
                      title={test.isExpired ? "Assessment has ended" : !test.is_published ? "Publish test to invite candidates" : "Invite candidates"}
                      style={{ 
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%",
                        padding: "0.75rem 1rem", fontSize: "0.9375rem", fontWeight: 600, color: "#ffffff", 
                        backgroundColor: "#00684A", border: "1px solid #00684A", borderRadius: "0.5rem", 
                        cursor: (!test.is_published || test.isExpired) ? "not-allowed" : "pointer", 
                        opacity: (!test.is_published || test.isExpired) ? 0.5 : 1, transition: "all 0.2s" 
                      }}
                      onMouseEnter={(e) => { if (test.is_published && !test.isExpired) e.currentTarget.style.backgroundColor = "#084A2A" }}
                      onMouseLeave={(e) => { if (test.is_published && !test.isExpired) e.currentTarget.style.backgroundColor = "#00684A" }}
                    >
                      <Mail size={18} /> Invite Candidates
                    </button>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <button
                        onClick={() => router.push(`/dsa/tests/${test.id}/candidates`)}
                        style={{ 
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                          padding: "0.625rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151", 
                          backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", 
                          cursor: "pointer", transition: "all 0.2s" 
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                      >
                        <Users size={16} /> View
                      </button>

                      <button
                        onClick={() => router.push(`/dsa/tests/${test.id}/edit`)}
                        style={{ 
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                          padding: "0.625rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151", 
                          backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", 
                          cursor: "pointer", transition: "all 0.2s" 
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                      >
                        <Edit3 size={16} /> Edit
                      </button>
                    </div>

                    <button
                      onClick={() => handlePublish(test.id, test.is_published || false)}
                      disabled={test.isExpired || !test.question_ids || test.question_ids.length === 0}
                      title={test.isExpired ? "Cannot publish an ended assessment" : !test.question_ids || test.question_ids.length === 0 ? "Add questions to the test first" : test.is_published ? "Click to unpublish" : "Click to publish"}
                      style={{ 
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", width: "100%",
                        padding: "0.625rem", fontSize: "0.875rem", fontWeight: 600, 
                        color: test.is_published ? "#B45309" : "#00684A", 
                        backgroundColor: test.is_published ? "#FFFBEB" : "#F0F9F4", 
                        border: `1px solid ${test.is_published ? "#FDE68A" : "#A8E8BC"}`, 
                        borderRadius: "0.5rem", 
                        cursor: (test.isExpired || !test.question_ids || test.question_ids.length === 0) ? "not-allowed" : "pointer", 
                        opacity: (test.isExpired || !test.question_ids || test.question_ids.length === 0) ? 0.5 : 1, transition: "all 0.2s" 
                      }}
                      onMouseEnter={(e) => {
                        if (test.question_ids && test.question_ids.length > 0 && !test.isExpired) {
                          e.currentTarget.style.backgroundColor = test.is_published ? "#FDE68A" : "#E1F2E9"
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (test.question_ids && test.question_ids.length > 0 && !test.isExpired) {
                          e.currentTarget.style.backgroundColor = test.is_published ? "#FFFBEB" : "#F0F9F4"
                        }
                      }}
                    >
                      {test.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                      {test.is_published ? 'Unpublish Test' : 'Publish Test'}
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Candidate Modal */}
      {inviteModal.open && (
        <div 
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setInviteModal({ testId: '', open: false })
              setGeneratedLink(null)
              setCandidateName('')
              setCandidateEmail('')
            }
          }}
        >
          <div style={{ backgroundColor: "#ffffff", borderRadius: "1rem", width: "100%", maxWidth: "480px", padding: "2rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ backgroundColor: "#F0F9F4", padding: "0.5rem", borderRadius: "0.5rem", color: "#00684A" }}>
                  <Mail size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Add Candidates</h3>
              </div>
              <button 
                onClick={() => { setInviteModal({ testId: '', open: false }); setGeneratedLink(null); setCandidateName(''); setCandidateEmail(''); }} 
                style={{ background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer", transition: "color 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#4B5563"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#9CA3AF"}
              >
                <X size={20} />
              </button>
            </div>

            {/* CSV Upload Section */}
            <div style={{ marginBottom: "1.5rem", padding: "1.5rem", backgroundColor: "#F9FAFB", border: "2px dashed #D1D5DB", borderRadius: "0.75rem", textAlign: "center", transition: "all 0.2s" }}>
              <FileSpreadsheet size={32} color="#9CA3AF" style={{ margin: "0 auto 0.5rem auto" }} />
              <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 600, color: "#374151" }}>Bulk Upload (CSV)</h4>
              <p style={{ margin: "0 0 1rem 0", fontSize: "0.85rem", color: "#6B7280" }}>
                Upload a file containing <code style={{ backgroundColor: "#E5E7EB", padding: "0.1rem 0.3rem", borderRadius: "0.25rem", color: "#111827" }}>name</code> and <code style={{ backgroundColor: "#E5E7EB", padding: "0.1rem 0.3rem", borderRadius: "0.25rem", color: "#111827" }}>email</code> columns.
              </p>
              
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.25rem", backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", color: "#374151", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                <UploadCloud size={16} /> Choose CSV File
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    
                    const formData = new FormData()
                    formData.append('file', file)
                    
                    try {
                      const response = await bulkAddCandidatesMutation.mutateAsync({
                        testId: inviteModal.testId,
                        formData,
                      })
                      
                      const responseData = response.data
                      alert(
                        `Bulk upload completed!\n\n` +
                        `✅ Success: ${responseData?.success_count || 0}\n` +
                        `❌ Failed: ${responseData?.failed_count || 0}\n` +
                        `⚠️ Duplicates: ${response.data.duplicate_count}`
                      )
                      
                      refetchTests()
                      e.target.value = ''
                    } catch (error: any) {
                      alert(error.response?.data?.detail || 'Failed to upload CSV')
                      e.target.value = ''
                    }
                  }}
                  disabled={bulkAddCandidatesMutation.isPending}
                />
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0" }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}></div>
              <span style={{ padding: "0 1rem", color: "#9CA3AF", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>OR SINGLE INVITE</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}></div>
            </div>

            {generatedLink && generatedLink.testId === inviteModal.testId ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ padding: "1.25rem", backgroundColor: "#F0FDF4", border: "1px solid #A7F3D0", borderRadius: "0.75rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                  <div style={{ backgroundColor: "#D1FAE5", padding: "0.5rem", borderRadius: "50%" }}>
                    <CheckCircle2 size={24} color="#059669" />
                  </div>
                  <div>
                    <p style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 700, color: "#065F46" }}>Candidate Added!</p>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "#047857" }}>
                      <strong>{generatedLink.name}</strong> ({generatedLink.email}) has been successfully added to the candidate list.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setInviteModal({ testId: '', open: false })
                    setGeneratedLink(null)
                    setCandidateName('')
                    setCandidateEmail('')
                    refetchTests()
                  }}
                  style={{ width: "100%", padding: "0.75rem", backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", fontWeight: 600, color: "#374151", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                >
                  Done
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>Candidate Name</label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g., John Doe"
                    style={{ width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", outline: "none", boxSizing: "border-box", fontSize: "0.95rem", transition: "all 0.2s" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#00684A"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>Email Address</label>
                  <input
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    placeholder="e.g., john@example.com"
                    style={{ width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", outline: "none", boxSizing: "border-box", fontSize: "0.95rem", transition: "all 0.2s" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#00684A"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 104, 74, 0.1)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>
                <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                  <button
                    onClick={() => {
                      setInviteModal({ testId: '', open: false })
                      setGeneratedLink(null)
                      setCandidateName('')
                      setCandidateEmail('')
                    }}
                    disabled={addingCandidate}
                    style={{ flex: 1, padding: "0.75rem", backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", fontWeight: 600, color: "#374151", cursor: addingCandidate ? "not-allowed" : "pointer", opacity: addingCandidate ? 0.7 : 1, transition: "all 0.2s" }}
                    onMouseEnter={(e) => { if(!addingCandidate) e.currentTarget.style.backgroundColor = "#F9FAFB" }}
                    onMouseLeave={(e) => { if(!addingCandidate) e.currentTarget.style.backgroundColor = "#ffffff" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAddCandidate(inviteModal.testId)}
                    disabled={addingCandidate || !candidateName || !candidateEmail}
                    style={{ flex: 2, padding: "0.75rem", backgroundColor: "#00684A", border: "1px solid #00684A", borderRadius: "0.5rem", fontWeight: 600, color: "#ffffff", cursor: (addingCandidate || !candidateName || !candidateEmail) ? "not-allowed" : "pointer", opacity: (addingCandidate || !candidateName || !candidateEmail) ? 0.7 : 1, transition: "all 0.2s" }}
                    onMouseEnter={(e) => { if(!(addingCandidate || !candidateName || !candidateEmail)) e.currentTarget.style.backgroundColor = "#084A2A" }}
                    onMouseLeave={(e) => { if(!(addingCandidate || !candidateName || !candidateEmail)) e.currentTarget.style.backgroundColor = "#00684A" }}
                  >
                    {addingCandidate ? 'Adding...' : 'Add Candidate'}
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  )
}