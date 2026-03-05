import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'
import { 
  Clock, Eye, EyeOff, Users, Mail, Edit3, Upload, List, 
  ArrowLeft, Copy, CheckCircle2, Calendar, AlertCircle, FileSpreadsheet, X 
} from 'lucide-react'
import Link from 'next/link'

// Helper function to format dates (converts UTC to IST - UTC+5:30)
const formatDate = (dateString: string, formatStr: string) => {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  const istDate = new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000)
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[istDate.getMonth()]
  const day = istDate.getDate()
  const year = istDate.getFullYear()
  const hours = istDate.getHours().toString().padStart(2, '0')
  const minutes = istDate.getMinutes().toString().padStart(2, '0')

  if (formatStr === 'MMM dd, yyyy HH:mm') {
    return `${month} ${day}, ${year} ${hours}:${minutes}`
  }
  return istDate.toLocaleDateString()
}

interface Test {
  _id: string
  title: string
  description?: string
  duration_minutes: number
  question_ids: string[]
  created_at?: string
  created_by?: string
  proctoring_enabled?: boolean
  is_published?: boolean
  candidates?: any[]
  test_token?: string
}

export default function DesignTestsPage() {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteModal, setInviteModal] = useState<{ testId: string; open: boolean }>({ testId: '', open: false })
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [addingCandidate, setAddingCandidate] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<{testId: string, name: string, email: string} | null>(null)
  
  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design'

  useEffect(() => {
    fetchTests()
  }, [])

  const fetchTests = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/tests`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        // Filter to show only user-created tests
        const userEmail = localStorage.getItem('userEmail')
        const filteredTests = data.filter((test: Test) => test.created_by === userEmail)
        setTests(filteredTests)
      }
    } catch (error) {
      console.error('Failed to fetch tests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async (testId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token')
      const newStatus = !currentStatus
      const response = await fetch(`${API_URL}/tests/${testId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_published: newStatus })
      })
      
      if (response.ok) {
        await fetchTests()
        alert(`Test ${newStatus ? 'published' : 'unpublished'} successfully!`)
      } else {
        const error = await response.json()
        alert(error.detail || 'Failed to update publish status')
      }
    } catch (error: any) {
      console.error('Publish error:', error)
      alert('Failed to update publish status')
    }
  }

  const handleAddCandidate = async (testId: string) => {
    if (!candidateName.trim() || !candidateEmail.trim()) {
      alert('Please enter both name and email')
      return
    }

    setAddingCandidate(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/tests/${testId}/candidates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: candidateName.trim(),
          email: candidateEmail.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedLink({
          testId: testId,
          name: data.name || candidateName.trim(),
          email: data.email || candidateEmail.trim(),
        })
        await fetchTests()
      } else {
        const error = await response.json()
        alert(error.detail || 'Failed to add candidate')
      }
    } catch (error: any) {
      alert('Failed to add candidate')
    } finally {
      setAddingCandidate(false)
    }
  }

  const handleBulkUpload = async (testId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/tests/${testId}/candidates/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        alert(
          `Bulk upload completed!\n` +
          `Success: ${data.success_count || 0}\n` +
          `Failed: ${data.failed_count || 0}\n` +
          `Duplicates: ${data.duplicate_count || 0}`
        )
        await fetchTests()
      } else {
        const error = await response.json()
        alert(error.detail || 'Failed to upload CSV')
      }
    } catch (error) {
      alert('Failed to upload CSV')
    }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "#7C3AED" }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#7C3AED]"></div>
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
            onClick={() => router.push("/design")}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0",
              fontSize: "0.875rem", color: "#6B7280", backgroundColor: "transparent",
              border: "none", fontWeight: 600, cursor: "pointer", transition: "color 0.2s ease"
            }}
            onMouseOver={(e) => e.currentTarget.style.color = "#7C3AED"}
            onMouseOut={(e) => e.currentTarget.style.color = "#6B7280"}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back
          </button>
        </div>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
              Design Assessments
            </h1>
            <p style={{ color: "#6B7280", fontSize: "1rem", margin: 0 }}>
              Manage your design assessments, invite candidates, and review configurations.
            </p>
          </div>
          <Link href="/design/create">
            <button
              style={{ 
                padding: "0.625rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#ffffff",
                backgroundColor: "#7C3AED", border: "none", borderRadius: "9999px", cursor: "pointer", 
                boxShadow: "0 4px 6px -1px rgba(124, 58, 237, 0.2)", transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#6D28D9"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#7C3AED"}
            >
              + Create Assessment
            </button>
          </Link>
        </div>

        {tests.length === 0 ? (
          <div style={{ backgroundColor: "#ffffff", padding: "4rem 2rem", borderRadius: "1rem", border: "1px dashed #D1D5DB", textAlign: "center" }}>
            <AlertCircle size={40} color="#9CA3AF" style={{ margin: "0 auto 1rem auto" }} />
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.125rem", fontWeight: 600 }}>No assessments found</h3>
            <p style={{ margin: 0, color: "#6B7280", fontSize: "0.95rem" }}>
              You haven't created any assessments yet. Create your first one to get started.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {tests.map((test) => (
              <div key={test._id} style={{ 
                backgroundColor: "#ffffff", borderRadius: "1rem", border: "1px solid #E5E7EB", 
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "2rem", transition: "all 0.2s ease" 
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#7C3AED";
                e.currentTarget.style.boxShadow = "0 8px 16px rgba(124, 58, 237, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E5E7EB";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
              }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "2rem", flexWrap: "wrap" }}>
                  
                  {/* Left Side: Test Info */}
                  <div style={{ flex: 1, minWidth: "300px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                      <h3 style={{ margin: 0, color: "#111827", fontSize: "1.25rem", fontWeight: 700 }}>{test.title}</h3>
                      
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", borderRadius: "2rem", fontSize: "0.75rem", fontWeight: 600, color: test.is_published ? "#7C3AED" : "#6B7280", backgroundColor: test.is_published ? "#F3E8FF" : "#F3F4F6", border: `1px solid ${test.is_published ? "#E9D5FF" : "#E5E7EB"}` }}>
                        {test.is_published ? 'Published' : 'Draft'}
                      </span>

                      {test.proctoring_enabled && (
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "0.25rem 0.625rem", borderRadius: "2rem", fontSize: "0.75rem", fontWeight: 600, color: "#DC2626", backgroundColor: "#FEE2E2", border: "1px solid #FECACA" }}>
                          Proctored
                        </span>
                      )}
                    </div>
                    
                    {test.description && (
                      <p style={{ margin: "0 0 1.25rem 0", color: "#4B5563", fontSize: "0.95rem", lineHeight: "1.5" }}>
                        {test.description}
                      </p>
                    )}
                    
                    {/* Metadata Badges */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <Clock size={14} /> {test.duration_minutes} mins
                      </span>
                      {test.created_at && (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                          <Calendar size={14} /> {formatDate(test.created_at, 'MMM dd, yyyy HH:mm')}
                        </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <Users size={14} /> {test.candidates?.length || 0} Candidates
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <List size={14} /> {test.question_ids?.length || 0} Questions
                      </span>
                    </div>

                    {/* Shared Link Box - Only show if published AND has candidates */}
                    {test.is_published && test.candidates && test.candidates.length > 0 && test.test_token && (
                      <div style={{ padding: "1rem", backgroundColor: "#F5F3FF", border: "1px solid #E9D5FF", borderRadius: "0.5rem", marginTop: "1rem" }}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                          Assessment Link
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <input
                            type="text"
                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/design/assessment/${test._id}?token=${test.test_token}`}
                            readOnly
                            style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", backgroundColor: "#ffffff", fontSize: "0.875rem", fontFamily: "monospace", color: "#374151", outline: "none" }}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const link = `${window.location.origin}/design/assessment/${test._id}?token=${test.test_token}`
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
                            style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.375rem", color: "#374151", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                          >
                            <Copy size={14} /> Copy
                          </button>
                        </div>
                        <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.75rem", color: "#7C3AED" }}>
                          Share this link with your candidates to take the assessment.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Action Buttons */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-start", justifyContent: "flex-end", minWidth: "220px" }}>
                    <button
                      onClick={() => handlePublish(test._id, test.is_published || false)}
                      disabled={!test.question_ids || test.question_ids.length === 0}
                      title={!test.question_ids || test.question_ids.length === 0 ? "Add questions to the test first" : test.is_published ? "Click to unpublish" : "Click to publish"}
                      style={{ 
                        display: "flex", alignItems: "center", gap: "0.375rem", width: "100%", justifyContent: "center",
                        padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, 
                        color: test.is_published ? "#D97706" : "#7C3AED", 
                        backgroundColor: test.is_published ? "#FEF3C7" : "#F5F3FF", 
                        border: `1px solid ${test.is_published ? "#FCD34D" : "#E9D5FF"}`, 
                        borderRadius: "0.5rem", cursor: (!test.question_ids || test.question_ids.length === 0) ? "not-allowed" : "pointer", 
                        opacity: (!test.question_ids || test.question_ids.length === 0) ? 0.5 : 1, transition: "all 0.2s" 
                      }}
                      onMouseEnter={(e) => {
                        if (test.question_ids && test.question_ids.length > 0) {
                          e.currentTarget.style.backgroundColor = test.is_published ? "#FDE68A" : "#EDE9FE"
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (test.question_ids && test.question_ids.length > 0) {
                          e.currentTarget.style.backgroundColor = test.is_published ? "#FEF3C7" : "#F5F3FF"
                        }
                      }}
                    >
                      {test.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                      {test.is_published ? 'Unpublish' : 'Publish'}
                    </button>
                    
                    <Link href={`/design/tests/${test._id}/edit`}>
                      <button
                        style={{ 
                          display: "flex", alignItems: "center", gap: "0.375rem", width: "100%", justifyContent: "center",
                          padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151", 
                          backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", 
                          cursor: "pointer", transition: "all 0.2s" 
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                      >
                        <Edit3 size={16} /> Edit
                      </button>
                    </Link>

                    <Link href={`/design/tests/${test._id}/manage`}>
                      <button
                        disabled={!test.is_published}
                        style={{ 
                          display: "flex", alignItems: "center", gap: "0.375rem", width: "100%", justifyContent: "center",
                          padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151", 
                          backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", 
                          cursor: !test.is_published ? "not-allowed" : "pointer", opacity: !test.is_published ? 0.5 : 1, transition: "all 0.2s" 
                        }}
                        onMouseEnter={(e) => { if (test.is_published) e.currentTarget.style.backgroundColor = "#F9FAFB" }}
                        onMouseLeave={(e) => { if (test.is_published) e.currentTarget.style.backgroundColor = "#ffffff" }}
                      >
                        <Users size={16} /> View Candidates
                      </button>
                    </Link>

                    <button
                      onClick={() => {
                        setInviteModal({ testId: test._id, open: true })
                        setGeneratedLink(null)
                        setCandidateName('')
                        setCandidateEmail('')
                      }}
                      disabled={!test.is_published}
                      title={!test.is_published ? "Publish test to add candidates" : "Add a candidate"}
                      style={{ 
                        display: "flex", alignItems: "center", gap: "0.375rem", width: "100%", justifyContent: "center",
                        padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, color: "#ffffff", 
                        backgroundColor: "#7C3AED", border: "1px solid #7C3AED", borderRadius: "0.5rem", 
                        cursor: !test.is_published ? "not-allowed" : "pointer", opacity: !test.is_published ? 0.5 : 1, transition: "all 0.2s" 
                      }}
                      onMouseEnter={(e) => { if (test.is_published) e.currentTarget.style.backgroundColor = "#6D28D9" }}
                      onMouseLeave={(e) => { if (test.is_published) e.currentTarget.style.backgroundColor = "#7C3AED" }}
                    >
                      <Mail size={16} /> Invite Candidates
                    </button>

                    {/* Take Test Button - Only show if published and has candidates */}
                    {test.is_published && test.candidates && test.candidates.length > 0 && (
                      <Link href={`/design/assessment/${test._id}?token=${test.test_token}`}>
                        <button
                          style={{ 
                            display: "flex", alignItems: "center", gap: "0.375rem", width: "100%", justifyContent: "center",
                            padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, color: "#ffffff", 
                            backgroundColor: "#059669", border: "1px solid #059669", borderRadius: "0.5rem", 
                            cursor: "pointer", transition: "all 0.2s" 
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#047857"}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#059669"}
                        >
                          Take Test
                        </button>
                      </Link>
                    )}
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
          <div style={{ backgroundColor: "#ffffff", borderRadius: "1rem", width: "100%", maxWidth: "450px", padding: "2rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Add Candidates</h3>
              <button onClick={() => setInviteModal({ testId: '', open: false })} style={{ background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* CSV Upload Section */}
            <div style={{ marginBottom: "1.5rem", padding: "1.25rem", backgroundColor: "#F9FAFB", border: "1px dashed #D1D5DB", borderRadius: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <FileSpreadsheet size={18} color="#7C3AED" />
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "#374151" }}>Bulk Upload (CSV)</h4>
              </div>
              <p style={{ margin: "0 0 1rem 0", fontSize: "0.8rem", color: "#6B7280" }}>
                Upload a CSV file containing <code style={{ backgroundColor: "#E5E7EB", padding: "0.1rem 0.3rem", borderRadius: "0.25rem" }}>name</code> and <code style={{ backgroundColor: "#E5E7EB", padding: "0.1rem 0.3rem", borderRadius: "0.25rem" }}>email</code> columns.
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  await handleBulkUpload(inviteModal.testId, file)
                  e.target.value = ''
                }}
                style={{
                  width: '100%', padding: '0.625rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem',
                  backgroundColor: '#ffffff', cursor: 'pointer', fontSize: "0.875rem", color: "#4B5563"
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0" }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}></div>
              <span style={{ padding: "0 1rem", color: "#9CA3AF", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>OR SINGLE INVITE</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}></div>
            </div>

            {generatedLink && generatedLink.testId === inviteModal.testId ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ padding: "1rem", backgroundColor: "#F0FDF4", border: "1px solid #A7F3D0", borderRadius: "0.5rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <CheckCircle2 size={20} color="#059669" style={{ marginTop: "0.1rem" }} />
                  <div>
                    <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.95rem", fontWeight: 600, color: "#065F46" }}>Candidate Added Successfully!</p>
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "#047857" }}>
                      {generatedLink.name} ({generatedLink.email}) has been invited.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setInviteModal({ testId: '', open: false })
                    setGeneratedLink(null)
                    setCandidateName('')
                    setCandidateEmail('')
                    fetchTests()
                  }}
                  style={{ width: "100%", padding: "0.75rem", backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", fontWeight: 600, color: "#374151", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                >
                  Done
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>Candidate Name</label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g., John Doe"
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", outline: "none", boxSizing: "border-box", fontSize: "0.95rem" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#7C3AED"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>Candidate Email</label>
                  <input
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    placeholder="e.g., john@example.com"
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", outline: "none", boxSizing: "border-box", fontSize: "0.95rem" }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#7C3AED"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
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
                    style={{ flex: 1, padding: "0.75rem", backgroundColor: "#7C3AED", border: "1px solid #7C3AED", borderRadius: "0.5rem", fontWeight: 600, color: "#ffffff", cursor: (addingCandidate || !candidateName || !candidateEmail) ? "not-allowed" : "pointer", opacity: (addingCandidate || !candidateName || !candidateEmail) ? 0.7 : 1, transition: "all 0.2s" }}
                    onMouseEnter={(e) => { if(!(addingCandidate || !candidateName || !candidateEmail)) e.currentTarget.style.backgroundColor = "#6D28D9" }}
                    onMouseLeave={(e) => { if(!(addingCandidate || !candidateName || !candidateEmail)) e.currentTarget.style.backgroundColor = "#7C3AED" }}
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

export const getServerSideProps: GetServerSideProps = requireAuth
