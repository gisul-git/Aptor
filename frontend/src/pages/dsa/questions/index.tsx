'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import dsaApi from '../../../lib/dsa/api'
import { Plus, Trash2, Edit3, FileText, ArrowLeft, Globe, Globe2, BookOpen, Clock, Code, Database } from 'lucide-react'
import Link from 'next/link'

interface Question {
  id: string
  title: string
  description: string
  difficulty: string
  languages: string[]
  is_published: boolean
  created_at?: string
  updated_at?: string
  question_type?: string  // 'SQL' for SQL questions, undefined/null for coding questions
}

export default function QuestionsListPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        console.log('🔵 [Frontend] Fetching DSA questions...')
        console.log('🔵 [Frontend] dsaApi base URL:', dsaApi.defaults?.baseURL)
        console.log('🔵 [Frontend] Calling dsaApi.get("/questions")')
        const response = await dsaApi.get('/questions')
        console.log('🟢 [Frontend] Questions response:', {
          status: response.status,
          dataLength: Array.isArray(response.data) ? response.data.length : 'not an array',
          data: response.data
        })
        setQuestions(response.data)
      } catch (error: any) {
        console.error('🔴 [Frontend] Error fetching questions:', {
          message: error?.message,
          code: error?.code,
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          url: error?.config?.url,
          baseURL: error?.config?.baseURL,
          fullURL: error?.config?.baseURL + error?.config?.url,
          responseData: error?.response?.data
        })
        alert('Failed to fetch questions')
      } finally {
        setLoading(false)
      }
    }

    fetchQuestions()
  }, [])

  const handleDelete = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return
    }

    setDeletingId(questionId)
    try {
      await dsaApi.delete(`/questions/${questionId}`)
      setQuestions(questions.filter((q) => q.id !== questionId))
      alert('Question deleted successfully!')
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete question')
    } finally {
      setDeletingId(null)
    }
  }

  const handleTogglePublish = async (questionId: string, currentStatus: boolean) => {
    try {
      await dsaApi.patch(`/questions/${questionId}/publish?is_published=${!currentStatus}`)
      setQuestions(
        questions.map((q) => (q.id === questionId ? { ...q, is_published: !currentStatus } : q))
      )
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update publish status')
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return { color: '#059669', bg: '#D1FAE5', border: '#34D399' }
      case 'medium':
        return { color: '#D97706', bg: '#FEF3C7', border: '#FBBF24' }
      case 'hard':
        return { color: '#DC2626', bg: '#FEE2E2', border: '#F87171' }
      default:
        return { color: '#4B5563', bg: '#F3F4F6', border: '#D1D5DB' }
    }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "#00684A" }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00684A]"></div>
          <span style={{ fontWeight: 500 }}>Loading repository...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 2rem" }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <button
              type="button"
              onClick={() => router.push("/dsa")}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0",
                fontSize: "0.875rem", color: "#6B7280", backgroundColor: "transparent",
                border: "none", fontWeight: 600, cursor: "pointer", transition: "color 0.2s ease",
                marginBottom: "1rem"
              }}
              onMouseOver={(e) => e.currentTarget.style.color = "#00684A"}
              onMouseOut={(e) => e.currentTarget.style.color = "#6B7280"}
            >
              <ArrowLeft size={16} strokeWidth={2.5} /> DSA Dashboard
            </button>
            <h1 style={{ margin: 0, color: "#111827", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
              Question Repository
            </h1>
            <p style={{ margin: "0.5rem 0 0 0", color: "#6B7280", fontSize: "1rem" }}>
              Manage {questions.length} existing DSA and SQL questions.
            </p>
          </div>
          
          <Link href="/dsa/questions/create" style={{ textDecoration: "none" }}>
            <button style={{ 
              padding: "0.75rem 1.25rem", backgroundColor: "#00684A", color: "#ffffff", 
              border: "none", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.9375rem",
              display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer",
              transition: "all 0.2s", boxShadow: "0 4px 6px -1px rgba(0, 104, 74, 0.2)"
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#084A2A"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
            >
              <Plus size={18} strokeWidth={2.5} /> Create New Question
            </button>
          </Link>
        </div>

        {/* Main List Container */}
        <div style={{ 
          backgroundColor: "#ffffff", borderRadius: "0.75rem", border: "1px solid #E5E7EB", 
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" 
        }}>
          {questions.length === 0 ? (
            <div style={{ padding: "5rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ backgroundColor: "#F3F4F6", padding: "1.5rem", borderRadius: "50%", marginBottom: "1.5rem", color: "#9CA3AF" }}>
                <FileText size={48} strokeWidth={1.5} />
              </div>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>Repository is empty</h3>
              <p style={{ margin: "0 0 1.5rem 0", color: "#6B7280", maxWidth: "400px", lineHeight: "1.5" }}>
                You haven't created any DSA or SQL questions yet. Start building your library by authoring your first question.
              </p>
              <Link href="/dsa/questions/create" style={{ textDecoration: "none" }}>
                <button style={{ 
                  padding: "0.625rem 1.25rem", backgroundColor: "#ffffff", color: "#00684A", 
                  border: "1px solid #00684A", borderRadius: "0.5rem", fontWeight: 600, cursor: "pointer",
                }}>
                  Create Question
                </button>
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {questions.map((q, idx) => {
                const diffColors = getDifficultyColor(q.difficulty)
                return (
                  <div
                    key={q.id}
                    style={{
                      padding: "1.5rem 2rem",
                      borderBottom: idx !== questions.length - 1 ? "1px solid #E5E7EB" : "none",
                      backgroundColor: "#ffffff",
                      transition: "background-color 0.2s",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "2rem"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                  >
                    {/* Left: Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                        
                        {/* Type Icon */}
                        <div title={q.question_type === 'SQL' ? 'SQL Question' : 'Coding Question'} style={{ 
                          color: q.question_type === 'SQL' ? '#3B82F6' : '#8B5CF6',
                          backgroundColor: q.question_type === 'SQL' ? '#EFF6FF' : '#F5F3FF',
                          padding: '0.25rem', borderRadius: '0.375rem'
                        }}>
                          {q.question_type === 'SQL' ? <Database size={16} /> : <Code size={16} />}
                        </div>

                        <h3 style={{ margin: 0, color: "#111827", fontSize: "1.125rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {q.title}
                        </h3>
                        
                        {/* Status Badge */}
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "0.375rem",
                          padding: "0.25rem 0.625rem", borderRadius: "2rem", fontSize: "0.75rem", fontWeight: 600,
                          color: q.is_published ? "#059669" : "#6B7280",
                          backgroundColor: q.is_published ? "#D1FAE5" : "#F3F4F6",
                          border: `1px solid ${q.is_published ? "#A7F3D0" : "#E5E7EB"}`
                        }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: q.is_published ? "#059669" : "#6B7280" }} />
                          {q.is_published ? "Published" : "Draft"}
                        </span>
                      </div>
                      
                      <p style={{ margin: "0 0 1rem 0", color: "#4B5563", fontSize: "0.9375rem", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {q.description}
                      </p>

                      {/* Tags Row */}
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{
                          padding: "0.25rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600,
                          color: diffColors.color, backgroundColor: diffColors.bg, border: `1px solid ${diffColors.border}`
                        }}>
                          {q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)}
                        </span>
                        
                        {q.languages && q.languages.length > 0 && (
                          <span style={{
                            display: "flex", alignItems: "center", gap: "0.375rem",
                            padding: "0.25rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600,
                            color: "#00684A", backgroundColor: "#F0F9F4", border: "1px solid #E1F2E9",
                            textTransform: "capitalize"
                          }}>
                            <BookOpen size={12} /> {q.languages.join(', ')}
                          </span>
                        )}

                        {q.created_at && (
                          <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "#9CA3AF", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                            <Clock size={12} /> {new Date(q.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      <Link href={q.question_type === 'SQL' ? `/dsa/questions/${q.id}/edit-sql` : `/dsa/questions/${q.id}/edit`} style={{ textDecoration: "none" }}>
                        <button 
                          style={{ 
                            display: "flex", alignItems: "center", gap: "0.375rem",
                            padding: "0.5rem 0.75rem", fontSize: "0.875rem", fontWeight: 600,
                            color: "#00684A", backgroundColor: "#F0F9F4", border: "1px solid #E1F2E9",
                            borderRadius: "0.5rem", cursor: "pointer", transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#E1F2E9"}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#F0F9F4"}
                        >
                          <Edit3 size={16} /> Edit
                        </button>
                      </Link>

                      <button
                        onClick={() => handleTogglePublish(q.id, q.is_published)}
                        style={{ 
                          display: "flex", alignItems: "center", gap: "0.375rem",
                          padding: "0.5rem 0.75rem", fontSize: "0.875rem", fontWeight: 600,
                          color: q.is_published ? "#D97706" : "#059669", 
                          backgroundColor: "transparent", border: "1px solid transparent",
                          borderRadius: "0.5rem", cursor: "pointer", transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = q.is_published ? "#FEF3C7" : "#D1FAE5"
                          e.currentTarget.style.borderColor = q.is_published ? "#FCD34D" : "#A7F3D0"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent"
                          e.currentTarget.style.borderColor = "transparent"
                        }}
                        title={q.is_published ? "Unpublish" : "Publish"}
                      >
                        {q.is_published ? <Globe2 size={16} /> : <Globe size={16} />}
                        {q.is_published ? "Unpublish" : "Publish"}
                      </button>

                      <button
                        onClick={() => handleDelete(q.id)}
                        disabled={deletingId === q.id}
                        style={{ 
                          display: "flex", alignItems: "center", justifyContent: "center",
                          padding: "0.5rem", color: "#DC2626", 
                          backgroundColor: "transparent", border: "1px solid transparent",
                          borderRadius: "0.5rem", cursor: deletingId === q.id ? "not-allowed" : "pointer", 
                          transition: "all 0.2s", opacity: deletingId === q.id ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if(deletingId !== q.id) {
                            e.currentTarget.style.backgroundColor = "#FEE2E2"
                            e.currentTarget.style.borderColor = "#FECDD3"
                          }
                        }}
                        onMouseLeave={(e) => {
                          if(deletingId !== q.id) {
                            e.currentTarget.style.backgroundColor = "transparent"
                            e.currentTarget.style.borderColor = "transparent"
                          }
                        }}
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}