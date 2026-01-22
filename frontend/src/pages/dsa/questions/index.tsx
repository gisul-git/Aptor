'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/dsa/ui/card'
import { Button } from '../../../components/dsa/ui/button'
import dsaApi from '../../../lib/dsa/api'
import { Plus, Trash2, Edit, FileText, Copy } from 'lucide-react'
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
}

export default function QuestionsListPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [cloningId, setCloningId] = useState<string | null>(null)

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

  const handleClone = async (questionId: string) => {
    setCloningId(questionId)
    try {
      const response = await dsaApi.post(`/questions/${questionId}/clone`)
      // Prepend new cloned question to list for immediate feedback
      const created = response.data
      if (created?.id) {
        setQuestions([created as any, ...questions])
      } else {
        // Fallback: refetch
        const refreshed = await dsaApi.get('/questions')
        setQuestions(refreshed.data)
      }
      alert('Question cloned successfully!')
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to clone question')
    } finally {
      setCloningId(null)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'text-green-600 bg-green-100'
      case 'medium':
        return 'text-yellow-600 bg-yellow-100'
      case 'hard':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading questions...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/dsa")}
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

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Questions Management</h1>
            <p className="text-muted-foreground mt-1">Create, edit, and manage DSA questions (Coding & SQL)</p>
          </div>
          <Link href="/dsa/questions/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Question
            </Button>
          </Link>
        </div>

        {questions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No questions available.</p>
              <Link href="/dsa/questions/create">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Question
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {questions.map((question) => (
              <Card key={question.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{question.title}</h3>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(
                            question.difficulty
                          )}`}
                        >
                          {question.difficulty}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            question.is_published
                              ? 'text-green-600 bg-green-100'
                              : 'text-gray-600 bg-gray-100'
                          }`}
                        >
                          {question.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {question.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Languages: {question.languages.join(', ')}</span>
                        {question.created_at && (
                          <span>
                            Created: {new Date(question.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTogglePublish(question.id, question.is_published)}
                      >
                        {question.is_published ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Link href={`/dsa/questions/${question.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleClone(question.id)}
                        disabled={cloningId === question.id}
                        title="Clone this question"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {cloningId === question.id ? 'Cloning...' : 'Clone'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(question.id)}
                        disabled={deletingId === question.id}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deletingId === question.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}










