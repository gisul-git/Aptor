import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'
import Link from 'next/link'
import { useAIMLQuestions, useDeleteAIMLQuestion, usePublishAIMLQuestion } from '@/hooks/api/useAIML'
import { 
  ArrowLeft, 
  Plus, 
  Eye, 
  Globe, 
  Globe2, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Database, 
  Bot, 
  BookOpen, 
  FileText 
} from 'lucide-react'

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
        backgroundColor: 'rgba(17, 24, 39, 0.7)',
        backdropFilter: 'blur(4px)',
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
          borderRadius: '1rem',
          maxWidth: '480px',
          width: '100%',
          padding: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E5E7EB'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
              Delete Question
            </h3>
          </div>
          <p style={{ margin: 0, color: '#4B5563', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Are you sure you want to delete <strong>"{questionTitle}"</strong>? This action cannot be undone.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            style={{
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              backgroundColor: '#ffffff',
              border: '1px solid #D1D5DB',
              borderRadius: '0.5rem',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { if(!isDeleting) e.currentTarget.style.backgroundColor = '#F3F4F6' }}
            onMouseLeave={(e) => { if(!isDeleting) e.currentTarget.style.backgroundColor = '#ffffff' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: '#DC2626',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => { if(!isDeleting) e.currentTarget.style.backgroundColor = '#B91C1C' }}
            onMouseLeave={(e) => { if(!isDeleting) e.currentTarget.style.backgroundColor = '#DC2626' }}
          >
            {isDeleting ? 'Deleting...' : 'Yes, Delete'}
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
        top: '1.5rem',
        right: '1.5rem',
        backgroundColor: '#F0FDF4',
        border: '1px solid #10B981',
        color: '#065F46',
        padding: '1rem 1.25rem',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        minWidth: '300px',
        animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <CheckCircle2 size={20} strokeWidth={2.5} />
      <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{message}</span>
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
        top: '1.5rem',
        right: '1.5rem',
        backgroundColor: '#FEF2F2',
        border: '1px solid #EF4444',
        color: '#991B1B',
        padding: '1rem 1.25rem',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        minWidth: '300px',
        animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <XCircle size={20} strokeWidth={2.5} />
      <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{message}</span>
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
    const newStatus = !currentStatus
    
    // Optimistically update local state for immediate UI feedback
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, is_published: newStatus } : q
    ))
    
    try {
      await publishQuestionMutation.mutateAsync({ questionId, isPublished: newStatus })
      // Refetch to ensure consistency with backend
      await refetchQuestions()
      setSuccessToast({ 
        isOpen: true, 
        message: `Question ${newStatus ? 'published' : 'unpublished'} successfully!` 
      })
    } catch (error: any) {
      console.error('Publish error:', error)
      // Revert optimistic update on error
      await refetchQuestions()
      const errorMessage = 
        error?.response?.data?.detail || 
        error?.response?.data?.error || 
        error?.message || 
        'Failed to update publish status'
      setErrorToast({ isOpen: true, message: errorMessage })
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
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        
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

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 2rem" }}>
          
          {/* Header Section */}
          <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <button
                type="button"
                onClick={() => router.push("/aiml")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 0",
                  fontSize: "0.875rem",
                  color: "#6B7280",
                  backgroundColor: "transparent",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "color 0.2s ease",
                  marginBottom: "1rem"
                }}
                onMouseOver={(e) => e.currentTarget.style.color = "#00684A"}
                onMouseOut={(e) => e.currentTarget.style.color = "#6B7280"}
              >
                <ArrowLeft size={16} strokeWidth={2.5} /> AIML Dashboard
              </button>
              <h1 style={{ margin: 0, color: "#111827", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
                Question Repository
              </h1>
              <p style={{ margin: "0.5rem 0 0 0", color: "#6B7280", fontSize: "1rem" }}>
                Manage {questions.length} existing AI/ML questions.
              </p>
            </div>
            
            <Link href="/aiml/questions/create" style={{ textDecoration: "none" }}>
              <button style={{ 
                padding: "0.75rem 1.25rem", 
                backgroundColor: "#00684A", 
                color: "#ffffff", 
                border: "none", 
                borderRadius: "0.5rem",
                fontWeight: 600,
                fontSize: "0.9375rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 4px 6px -1px rgba(0, 104, 74, 0.2)"
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
            backgroundColor: "#ffffff", 
            borderRadius: "0.75rem", 
            border: "1px solid #E5E7EB", 
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflow: "hidden" 
          }}>
            {questions.length === 0 ? (
              <div style={{ padding: "5rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ backgroundColor: "#F3F4F6", padding: "1.5rem", borderRadius: "50%", marginBottom: "1.5rem", color: "#9CA3AF" }}>
                  <FileText size={48} strokeWidth={1.5} />
                </div>
                <h3 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>Repository is empty</h3>
                <p style={{ margin: "0 0 1.5rem 0", color: "#6B7280", maxWidth: "400px", lineHeight: "1.5" }}>
                  You haven't created any AI/ML questions yet. Start building your library by authoring your first question.
                </p>
                <Link href="/aiml/questions/create" style={{ textDecoration: "none" }}>
                  <button style={{ 
                    padding: "0.625rem 1.25rem", 
                    backgroundColor: "#ffffff", 
                    color: "#00684A", 
                    border: "1px solid #00684A", 
                    borderRadius: "0.5rem",
                    fontWeight: 600,
                    cursor: "pointer",
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
                          
                          {q.library && (
                            <span style={{
                              display: "flex", alignItems: "center", gap: "0.375rem",
                              padding: "0.25rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600,
                              color: "#00684A", backgroundColor: "#F0F9F4", border: "1px solid #E1F2E9"
                            }}>
                              <BookOpen size={12} /> {q.library}
                            </span>
                          )}
                          
                          {q.ai_generated && (
                            <span style={{
                              display: "flex", alignItems: "center", gap: "0.375rem",
                              padding: "0.25rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600,
                              color: "#6D28D9", backgroundColor: "#EDE9FE", border: "1px solid #DDD6FE"
                            }}>
                              <Bot size={12} /> AI Generated
                            </span>
                          )}
                          
                          {q.requires_dataset && (
                            <span style={{
                              display: "flex", alignItems: "center", gap: "0.375rem",
                              padding: "0.25rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 600,
                              color: "#BE123C", backgroundColor: "#FFE4E6", border: "1px solid #FECDD3"
                            }}>
                              <Database size={12} /> Requires Dataset
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
                        <Link href={`/aiml/questions/${q.id}/preview`} style={{ textDecoration: "none" }}>
                          <button 
                            style={{ 
                              display: "flex", alignItems: "center", gap: "0.375rem",
                              padding: "0.5rem 0.75rem", fontSize: "0.875rem", fontWeight: 600,
                              color: "#4B5563", backgroundColor: "#ffffff", border: "1px solid #D1D5DB",
                              borderRadius: "0.5rem", cursor: "pointer", transition: "all 0.2s"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F3F4F6"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                          >
                            <Eye size={16} /> Preview
                          </button>
                        </Link>
                        
                        <Link href={`/aiml/questions/${q.id}/edit`} style={{ textDecoration: "none" }}>
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
                          onClick={() => handleDeleteClick(q.id, q.title)}
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
    </>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth