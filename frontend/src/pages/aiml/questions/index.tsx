import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'
import Link from 'next/link'
import { useAIMLQuestions, useDeleteAIMLQuestion, usePublishAIMLQuestion } from '@/hooks/api/useAIML'

interface Question {
  id: string
  title: string
  description: string
  difficulty: string
  library?: string
  ai_generated?: boolean
  requires_dataset?: boolean
  is_published: boolean
  is_scheduled?: boolean
  created_at?: string
  updated_at?: string
}

export default function AIMLQuestionsListPage() {
  const router = useRouter()
  const { data: questionsData, isLoading: loading, refetch: refetchQuestions } = useAIMLQuestions()
  const deleteQuestionMutation = useDeleteAIMLQuestion()
  const publishQuestionMutation = usePublishAIMLQuestion()
  const [questions, setQuestions] = useState<Question[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  // Update local state from React Query data
  useEffect(() => {
    if (questionsData) {
      // Map API data to local Question interface with proper defaults
      const mappedQuestions: Question[] = questionsData.map((q: any) => ({
        id: q.id || '',
        title: q.title || '',
        description: q.description || '',
        difficulty: q.difficulty || 'medium',
        library: q.library,
        ai_generated: q.ai_generated || false,
        requires_dataset: q.requires_dataset || false,
        is_published: q.is_published || false,
        is_scheduled: q.is_scheduled,
        created_at: q.created_at || q.createdAt,
        updated_at: q.updated_at || q.updatedAt,
      }))
      setQuestions(mappedQuestions)
    }
  }, [questionsData])

  const handleDelete = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return
    }

    setDeletingId(questionId)
    try {
      await deleteQuestionMutation.mutateAsync(questionId)
      await refetchQuestions()
      alert('Question deleted successfully!')
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete question')
    } finally {
      setDeletingId(null)
    }
  }

  const handleTogglePublish = async (questionId: string, currentStatus: boolean) => {
    try {
      await publishQuestionMutation.mutateAsync({ questionId, isPublished: !currentStatus })
      await refetchQuestions()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update publish status')
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return { color: '#059669', bg: '#D1FAE5' }
      case 'medium':
        return { color: '#D97706', bg: '#FEF3C7' }
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
            onClick={() => router.push("/aiml")}
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
          <Link href="/aiml/questions/create">
            <button className="btn-primary" style={{ padding: "0.5rem 1rem" }}>
              + Create Question
            </button>
          </Link>
        </div>

        <div className="card">
          <h1 style={{ marginBottom: "2rem", color: "#1a1625" }}>AIML Questions</h1>

          {questions.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              <p>No questions found. Create your first question!</p>
              <Link href="/aiml/questions/create">
                <button className="btn-primary" style={{ marginTop: "1rem" }}>
                  Create Question
                </button>
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {questions.map((q) => {
                const diffColors = getDifficultyColor(q.difficulty)
                return (
                  <div
                    key={q.id}
                    style={{
                      padding: "1.5rem",
                      border: "1px solid #A8E8BC",
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
                                color: "#1E5A3B",
                                backgroundColor: "#C9F4D4",
                              }}
                            >
                              AIML
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
                          {q.library && (
                            <span
                              style={{
                                padding: "0.25rem 0.75rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.875rem",
                                color: "#2D7A52",
                                backgroundColor: "#E8FAF0",
                              }}
                            >
                              📚 {q.library}
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
                          {q.requires_dataset && (
                            <span
                              style={{
                                padding: "0.25rem 0.75rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.875rem",
                                color: "#DC2626",
                                backgroundColor: "#FEE2E2",
                              }}
                            >
                              📊 Requires Dataset
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
                          {q.created_at && (
                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <span>🕐</span>
                              <span>Created: {new Date(q.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </span>
                          )}
                        </div>
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
                      <Link href={`/aiml/questions/${q.id}/preview`}>
                        <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                          👁️ Preview
                        </button>
                      </Link>
                      <button
                        className="btn-secondary"
                        onClick={() => handleTogglePublish(q.id, q.is_published)}
                        style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                      >
                        {q.is_published ? "Unpublish" : "Publish"}
                      </button>
                      <Link href={`/aiml/questions/${q.id}/edit`}>
                        <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                          Edit
                        </button>
                      </Link>
                      <button
                        className="btn-secondary"
                        onClick={() => handleDelete(q.id)}
                        disabled={deletingId === q.id}
                        style={{
                          padding: "0.5rem 1rem",
                          fontSize: "0.875rem",
                          color: "#DC2626",
                          borderColor: "#DC2626",
                        }}
                      >
                        {deletingId === q.id ? "Deleting..." : "Delete"}
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

