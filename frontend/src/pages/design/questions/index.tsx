import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'
import Link from 'next/link'

interface Question {
  id: string
  _id?: string
  title: string
  description: string
  difficulty: string
  role?: string
  task_type?: string
  ai_generated?: boolean
  is_published: boolean
  is_scheduled?: boolean
  created_at?: string
  updated_at?: string
}

export default function DesignQuestionsListPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design'

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`${API_URL}/questions`)
      if (response.ok) {
        const data = await response.json()
        setQuestions(data)
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return
    }

    setDeletingId(questionId)
    try {
      const response = await fetch(`${API_URL}/questions/${questionId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        await fetchQuestions()
        alert('Question deleted successfully!')
      } else {
        alert('Failed to delete question')
      }
    } catch (error) {
      alert('Failed to delete question')
    } finally {
      setDeletingId(null)
    }
  }

  const handleTogglePublish = async (questionId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`${API_URL}/questions/${questionId}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !currentStatus }),
      })
      
      if (response.ok) {
        await fetchQuestions()
        alert('Publish status updated successfully!')
      } else {
        const error = await response.text()
        console.error('Publish error:', error)
        alert('Failed to update publish status')
      }
    } catch (error) {
      console.error('Publish error:', error)
      alert('Failed to update publish status')
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
      case 'easy':
        return { color: '#059669', bg: '#D1FAE5' }
      case 'intermediate':
      case 'medium':
        return { color: '#D97706', bg: '#FEF3C7' }
      case 'advanced':
      case 'hard':
        return { color: '#DC2626', bg: '#FEE2E2' }
      default:
        return { color: '#6B7280', bg: '#F3F4F6' }
    }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div style={{ textAlign: "center" }}>Loading questions...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/design")}
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
          <Link href="/design/questions/create">
            <button className="btn-primary" style={{ padding: "0.5rem 1rem" }}>
              + Create Question
            </button>
          </Link>
        </div>

        <div className="card">
          <h1 style={{ marginBottom: "2rem", color: "#1a1625" }}>Design Questions</h1>

          {questions.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              <p>No questions found. Create your first question!</p>
              <Link href="/design/questions/create">
                <button className="btn-primary" style={{ marginTop: "1rem" }}>
                  Create Question
                </button>
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {questions.map((q) => {
                const diffColors = getDifficultyColor(q.difficulty)
                const questionId = q.id || q._id || ''
                
                return (
                  <div
                    key={questionId}
                    style={{
                      padding: "1.5rem",
                      border: "1px solid #E8B4FA",
                      borderRadius: "0.5rem",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                          <h3 style={{ margin: 0, color: "#1a1625", fontSize: "1.25rem", fontWeight: 600 }}>
                            {q.title}
                          </h3>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <span
                              style={{
                                padding: "0.375rem 0.75rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.8125rem",
                                fontWeight: 600,
                                color: "#7C3AED",
                                backgroundColor: "#EDE9FE",
                              }}
                            >
                              Design
                            </span>
                            <span
                              style={{
                                padding: "0.375rem 0.75rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.8125rem",
                                fontWeight: 600,
                                color: q.is_published ? "#059669" : "#6B7280",
                                backgroundColor: q.is_published ? "#D1FAE5" : "#F3F4F6",
                              }}
                            >
                              {q.is_published ? "Published" : "Draft"}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                          <span
                            style={{
                              padding: "0.25rem 0.75rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: diffColors.color,
                              backgroundColor: diffColors.bg,
                            }}
                          >
                            {q.difficulty}
                          </span>
                          {q.role && (
                            <span
                              style={{
                                padding: "0.25rem 0.75rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.875rem",
                                color: "#9333EA",
                                backgroundColor: "#F3E8FF",
                              }}
                            >
                              👤 {q.role.replace(/_/g, ' ')}
                            </span>
                          )}
                          {q.task_type && (
                            <span
                              style={{
                                padding: "0.25rem 0.75rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.875rem",
                                color: "#7C3AED",
                                backgroundColor: "#EDE9FE",
                              }}
                            >
                              🎨 {q.task_type.replace(/_/g, ' ')}
                            </span>
                          )}
                          {q.ai_generated && (
                            <span
                              style={{
                                padding: "0.25rem 0.75rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.875rem",
                                color: "#7C3AED",
                                backgroundColor: "#EDE9FE",
                              }}
                            >
                              🤖 AI Generated
                            </span>
                          )}
                        </div>
                        {q.created_at && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <span>🕐</span>
                              <span>Created: {new Date(q.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </span>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.375rem",
                              padding: "0.25rem 0.75rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.875rem",
                              fontWeight: 500,
                              color: (q.is_scheduled !== undefined ? q.is_scheduled : q.is_published) ? "#059669" : "#6B7280",
                              backgroundColor: (q.is_scheduled !== undefined ? q.is_scheduled : q.is_published) ? "#D1FAE5" : "#F3F4F6",
                            }}
                          >
                            <span style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: (q.is_scheduled !== undefined ? q.is_scheduled : q.is_published) ? "#059669" : "#6B7280",
                            }}></span>
                            {(q.is_scheduled !== undefined ? q.is_scheduled : q.is_published) ? "Scheduled" : "Not Scheduled"}
                          </span>
                        </div>
                        <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem", lineHeight: "1.5" }}>
                          {q.description.substring(0, 150)}...
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                      <Link href={`/design/questions/${questionId}/preview`}>
                        <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                          👁️ Preview
                        </button>
                      </Link>
                      <button
                        className="btn-secondary"
                        onClick={() => handleTogglePublish(questionId, q.is_published)}
                        style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                      >
                        {q.is_published ? "Unpublish" : "Publish"}
                      </button>
                      <Link href={`/design/questions/${questionId}/edit`}>
                        <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                          Edit
                        </button>
                      </Link>
                      <button
                        className="btn-secondary"
                        onClick={() => handleDelete(questionId)}
                        disabled={deletingId === questionId}
                        style={{
                          padding: "0.5rem 1rem",
                          fontSize: "0.875rem",
                          color: "#DC2626",
                          borderColor: "#DC2626",
                        }}
                      >
                        {deletingId === questionId ? "Deleting..." : "Delete"}
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

export const getServerSideProps: GetServerSideProps = requireAuth
