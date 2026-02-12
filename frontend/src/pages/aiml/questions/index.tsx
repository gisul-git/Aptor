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

interface DeleteConfirmModalProps {
  isOpen: boolean
  questionTitle: string
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}

function DeleteConfirmModal({ isOpen, questionTitle, onConfirm, onCancel, isDeleting }: DeleteConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          maxWidth: '480px',
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1a1625', marginBottom: '0.5rem' }}>
            Delete Question
          </h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem', lineHeight: '1.5' }}>
            Are you sure you want to delete <strong>"{questionTitle}"</strong>? This action cannot be undone.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#64748b',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#ffffff',
              backgroundColor: '#DC2626',
              border: '1px solid #DC2626',
              borderRadius: '0.375rem',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface SuccessToastProps {
  isOpen: boolean
  message: string
  onClose: () => void
}

function SuccessToast({ isOpen, message, onClose }: SuccessToastProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        backgroundColor: '#10b981',
        color: '#ffffff',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        minWidth: '250px',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <span style={{ fontSize: '1.25rem' }}>✓</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{message}</span>
    </div>
  )
}

interface ErrorToastProps {
  isOpen: boolean
  message: string
  onClose: () => void
}

function ErrorToast({ isOpen, message, onClose }: ErrorToastProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        backgroundColor: '#DC2626',
        color: '#ffffff',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        minWidth: '250px',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <span style={{ fontSize: '1.25rem' }}>✕</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{message}</span>
    </div>
  )
}

export default function AIMLQuestionsListPage() {
  const router = useRouter()
  const { data: questionsData, isLoading: loading, refetch: refetchQuestions } = useAIMLQuestions()
  const deleteQuestionMutation = useDeleteAIMLQuestion()
  const publishQuestionMutation = usePublishAIMLQuestion()
  const [questions, setQuestions] = useState<Question[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<{ id: string; title: string } | null>(null)
  const [successToast, setSuccessToast] = useState({ isOpen: false, message: '' })
  const [errorToast, setErrorToast] = useState({ isOpen: false, message: '' })
  
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
    } else {
      // Clear questions if data is null/undefined
      setQuestions([])
    }
  }, [questionsData])

  const handleDeleteClick = (questionId: string, questionTitle: string) => {
    setQuestionToDelete({ id: questionId, title: questionTitle })
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!questionToDelete) return

    const questionIdToDelete = questionToDelete.id
    setDeletingId(questionIdToDelete)
    setDeleteModalOpen(false)
    
    // Optimistically remove from local state for immediate UI update
    setQuestions(prev => prev.filter(q => q.id !== questionIdToDelete))
    
    try {
      await deleteQuestionMutation.mutateAsync(questionIdToDelete)
      // Refetch to ensure consistency with backend
      await refetchQuestions()
      setSuccessToast({ isOpen: true, message: 'Question deleted successfully!' })
      setQuestionToDelete(null)
    } catch (error: any) {
      console.error('Delete error:', error)
      // Re-add the question to the list if deletion failed
      await refetchQuestions()
      // Extract error message from various possible formats
      const errorMessage = 
        error?.response?.data?.detail || 
        error?.response?.data?.message || 
        error?.message || 
        'Failed to delete question'
      setErrorToast({ isOpen: true, message: errorMessage })
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false)
    setQuestionToDelete(null)
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
    <>
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          questionTitle={questionToDelete?.title || ''}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isDeleting={deletingId !== null}
        />
        <SuccessToast
          isOpen={successToast.isOpen}
          message={successToast.message}
          onClose={() => setSuccessToast({ isOpen: false, message: '' })}
        />
        <ErrorToast
          isOpen={errorToast.isOpen}
          message={errorToast.message}
          onClose={() => setErrorToast({ isOpen: false, message: '' })}
        />
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
                        onClick={() => handleDeleteClick(q.id, q.title)}
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
    </>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth

