'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Card, CardContent } from '../../../../components/dsa/ui/card'
import { Button } from '../../../../components/dsa/ui/button'
import { ArrowLeft, Trash2, Mail } from 'lucide-react'
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
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }
    return date.toLocaleString('en-US', options)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/aiml/tests")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Test Management
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-4xl font-bold">Candidates</h1>
          <p className="text-muted-foreground mt-1">
            View all candidates for this test
          </p>
        </div>

        {candidates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No candidates added yet. Add candidates from the test management page.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Total: {candidates.length} candidates
              </p>
              <p className="text-sm text-muted-foreground">
                Submitted: {candidates.filter(c => c.has_submitted).length} / {candidates.length}
              </p>
            </div>

            {candidates.map((candidate) => (
              <Card key={candidate.user_id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{candidate.name}</h3>
                      <p className="text-sm text-muted-foreground">{candidate.email}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          candidate.has_submitted 
                            ? 'bg-green-500/20 text-green-500' 
                            : 'bg-gray-500/20 text-gray-500'
                        }`}>
                          {candidate.has_submitted ? 'Submitted' : 'Not Submitted'}
                        </span>
                        {candidate.has_submitted && (
                          <span className="text-sm">
                            Score: <span className="font-semibold">{candidate.submission_score || 0}/100</span>
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Added: {formatDate(candidate.created_at)}
                        </span>
                        {candidate.submitted_at && (
                          <span className="text-xs text-muted-foreground">
                            Submitted: {formatDate(candidate.submitted_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/aiml/tests/${String(testId)}/analytics?candidate=${candidate.user_id}`)}
                        title="View analytics for this candidate"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Analytics
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
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
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
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


