import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Card, CardContent } from '../../../../components/dsa/ui/card'
import { Button } from '../../../../components/dsa/ui/button'
import dsaApi from '../../../../lib/dsa/api'
import { ArrowLeft, Mail, CheckCircle, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'

interface Candidate {
  candidate_id: string
  user_id: string
  name: string
  email: string
  created_at: string | null
  has_submitted: boolean
  submission_score: number
  submitted_at: string | null
}

export default function CandidatesPage() {
  const router = useRouter()
  const { id: testId } = router.query
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!testId || typeof testId !== 'string') return

    const fetchCandidates = async () => {
      try {
        const response = await dsaApi.get(`/tests/${testId}/candidates`)
        setCandidates(response.data)
      } catch (error) {
        console.error('Error fetching candidates:', error)
        alert('Failed to load candidates')
      } finally {
        setLoading(false)
      }
    }

    fetchCandidates()
  }, [testId])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    // Format: M/D/YYYY, H:MM:SS AM/PM (local time)
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
        {/* Back Button */}
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/dsa/tests")}
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
              <Card key={candidate.candidate_id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{candidate.name}</h3>
                        {candidate.has_submitted ? (
                          <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-500 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Submitted
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {candidate.email}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <div>Added: {formatDate(candidate.created_at)}</div>
                        {candidate.has_submitted && (
                          <>
                            <div>Score: {candidate.submission_score}</div>
                            <div>Submitted: {formatDate(candidate.submitted_at)}</div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {candidate.has_submitted && (
                        <Link href={`/dsa/tests/${testId}/analytics?candidate=${candidate.user_id}`}>
                          <Button variant="outline" size="sm">
                            View Analytics
                          </Button>
                        </Link>
                      )}
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

