import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Card, CardContent } from '../../../components/dsa/ui/card'
import { Button } from '../../../components/dsa/ui/button'
import { useAIMLTests, usePublishAIMLTest, useAddAIMLCandidate, useBulkAddAIMLCandidates } from '@/hooks/api/useAIML'
import { Clock, Eye, EyeOff, Users, Mail, Edit, Upload, List } from 'lucide-react'
import Link from 'next/link'

// Helper function to format dates (converts UTC to IST - UTC+5:30)
const formatDate = (dateString: string, formatStr: string) => {
  if (!dateString) return ''
  
  // Parse the UTC date
  const date = new Date(dateString)
  
  // Add 5 hours and 30 minutes (IST offset) to convert from UTC to IST
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
  id: string
  title: string
  description: string
  duration_minutes: number
  start_time: string
  end_time: string
  is_active: boolean
  is_published: boolean
  invited_users: string[]
  question_ids?: string[]
  test_token?: string
  pausedAt?: string | null
  schedule?: { startTime?: string; endTime?: string; duration?: number } | null
}

export default function AIMLTestsListPage() {
  const router = useRouter()
  const { data: testsData, isLoading: loading, refetch: refetchTests } = useAIMLTests()
  const publishTestMutation = usePublishAIMLTest()
  const addCandidateMutation = useAddAIMLCandidate()
  const bulkAddCandidatesMutation = useBulkAddAIMLCandidates()
  const [tests, setTests] = useState<Test[]>([])
  const [inviteModal, setInviteModal] = useState<{ testId: string; open: boolean }>({ testId: '', open: false })

  // Update local state from React Query data
  useEffect(() => {
    console.log('[AIML Tests] testsData from useAIMLTests:', {
      hasData: !!testsData,
      length: Array.isArray(testsData) ? testsData.length : 'not-array',
      raw: testsData,
    })

    if (testsData) {
      // Map API data to local Test interface with proper defaults
      const mappedTests: Test[] = testsData.map((t: any) => ({
        id: t.id || '',
        title: t.title || '',
        description: t.description || '',
        duration_minutes: t.duration_minutes || t.duration || 60,
        start_time: t.start_time || t.schedule?.startTime || '',
        end_time: t.end_time || t.schedule?.endTime || '',
        is_active: t.is_active !== undefined ? t.is_active : true,
        is_published: t.is_published || false,
        invited_users: t.invited_users || [],
        question_ids: t.question_ids || t.questions?.map((q: any) => q.id || q) || [],
        test_token: t.test_token,
        pausedAt: t.pausedAt || null,
        schedule: t.schedule || null,
      }))

      console.log('[AIML Tests] mappedTests for state:', {
        count: mappedTests.length,
        ids: mappedTests.map(t => t.id),
      })

      setTests(mappedTests)
    } else {
      console.log('[AIML Tests] No testsData available yet')
    }
  }, [testsData])

  useEffect(() => {
    if (router.query.refreshed === 'true') {
      refetchTests()
      // Remove refreshed=true but preserve testId filter (if present)
      const testId = router.query.testId
      const nextQuery: Record<string, any> = {}
      if (testId) nextQuery.testId = testId
      router.replace({ pathname: '/aiml/tests', query: nextQuery }, undefined, { shallow: true })
    }
  }, [router.query.refreshed, refetchTests, router])

  // Refresh when query parameter changes (e.g., returning from edit page)
  useEffect(() => {
    if (router.query.refreshed === 'true') {
      refetchTests()
      // Remove refreshed=true but preserve testId filter (if present)
      const testId = router.query.testId
      const nextQuery: Record<string, any> = {}
      if (testId) nextQuery.testId = testId
      router.replace({ pathname: '/aiml/tests', query: nextQuery }, undefined, { shallow: true })
    }
  }, [router.query.refreshed, refetchTests, router])

  const filteredTests = (() => {
    const q = router.query.testId
    const testId = typeof q === 'string' ? q : (Array.isArray(q) ? q[0] : undefined)

    console.log('[AIML Tests] Filtering tests:', {
      queryTestId: q,
      normalizedTestId: testId,
      totalTests: tests.length,
      testIds: tests.map(t => t.id),
    })

    if (!testId) return tests
    const result = tests.filter(t => String(t.id) === String(testId))
    console.log('[AIML Tests] filteredTests result:', {
      count: result.length,
      ids: result.map(t => t.id),
    })
    return result
  })()

  const handlePublish = async (testId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus
      await publishTestMutation.mutateAsync({ testId, isPublished: newStatus })
      await refetchTests()
      alert(`Test ${newStatus ? 'published' : 'unpublished'} successfully!`)
    } catch (error: any) {
      console.error('Publish error:', error)
      alert(error.response?.data?.detail || 'Failed to update publish status')
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

      setGeneratedLink({
        testId: testId,
        link: '',
        // aimlService.addCandidate already returns the data object from the backend
        // so response is the plain object: { candidate_id, test_link, name, email }
        name: response.name,
        email: response.email,
      })
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to add candidate')
    } finally {
      setAddingCandidate(false)
    }
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
        </div>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Test Management</h1>
            <p className="text-muted-foreground mt-1">Manage tests and candidates</p>
          </div>
          <Button
            variant="default"
            onClick={() => router.push("/dashboard")}
            title="Save and go back to dashboard"
          >
            Save
          </Button>
        </div>

        {filteredTests.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {router.query.testId ? 'Test not found.' : 'No tests available. Create tests from the dashboard.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTests.map((test) => (
              <Card key={test.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{test.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{test.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {test.duration_minutes} minutes
                        </div>
                        <div>
                          Start: {formatDate(test.schedule?.startTime || test.start_time, 'MMM dd, yyyy HH:mm')}
                        </div>
                        <div>
                          End: {formatDate(test.schedule?.endTime || test.end_time, 'MMM dd, yyyy HH:mm')}
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            test.is_active
                              ? 'bg-green-500/20 text-green-500'
                              : 'bg-gray-500/20 text-gray-500'
                          }`}
                        >
                          {test.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            test.is_published
                              ? 'bg-blue-500/20 text-blue-500'
                              : 'bg-gray-500/20 text-gray-500'
                          }`}
                        >
                          {test.is_published ? 'Published' : 'Draft'}
                        </span>
                        {test.pausedAt && (
                          <span className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-700">
                            Paused
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {test.invited_users?.length || 0} candidates
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {test.question_ids?.length || 0} questions
                        </div>
                      </div>
                      {test.is_published && test.test_token && (
                        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                          <div className="text-xs font-medium text-blue-400 mb-2">Shared Test Link:</div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/aiml/test/${test.id}?token=${test.test_token}`}
                              readOnly
                              className="flex-1 p-2 border rounded-md bg-background text-xs font-mono"
                            />
                            <Button
                              size="sm"
                              onClick={async () => {
                                const link = `${window.location.origin}/aiml/test/${test.id}?token=${test.test_token}`
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
                            >
                              Copy
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Share this single link with all candidates. They will enter their email and name to verify.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={test.is_published ? "outline" : "default"}
                        size="sm"
                        onClick={() => handlePublish(test.id, test.is_published || false)}
                        disabled={!test.question_ids || test.question_ids.length === 0}
                        title={!test.question_ids || test.question_ids.length === 0 ? "Add questions to the test first" : test.is_published ? "Click to unpublish the test" : "Click to publish the test"}
                      >
                        {test.is_published ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Unpublish
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Publish
                          </>
                        )}
                      </Button>
                      <Link href={`/aiml/tests/${test.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                      <Link href={`/aiml/tests/${test.id}/candidates`}>
                        <Button variant="outline" size="sm" disabled={!test.is_published}>
                          <List className="h-4 w-4 mr-2" />
                          Candidates
                        </Button>
                      </Link>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setInviteModal({ testId: test.id, open: true })
                          setGeneratedLink(null)
                          setCandidateName('')
                          setCandidateEmail('')
                        }}
                        disabled={!test.is_published}
                        title={!test.is_published ? "Test must be published to add candidates" : "Add a candidate"}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Add Candidate
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Candidate Modal */}
      {inviteModal.open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setInviteModal({ testId: '', open: false })
              setGeneratedLink(null)
              setCandidateName('')
              setCandidateEmail('')
            }
          }}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add Candidate</h3>

              {/* CSV Upload Section */}
              <div className="mb-4 p-4 border rounded-md" style={{ backgroundColor: '#f8f9fa', borderColor: '#A8E8BC' }}>
                <h4 className="text-sm font-medium mb-2" style={{ color: '#1a1625' }}>Bulk Upload (CSV)</h4>
                <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
                  Upload a CSV file with 'name' and 'email' columns
                </p>
                <input
                  type="file"
                  accept=".csv"
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

                      alert(
                        `Bulk upload completed!\n` +
                        `Success: ${response.data?.success_count || 0}\n` +
                        `Failed: ${response.data?.failed_count || 0}\n` +
                        `Duplicates: ${response.data?.duplicate_count || 0}`
                      )

                      await refetchTests()

                      e.target.value = ''
                    } catch (error: any) {
                      alert(error.response?.data?.detail || 'Failed to upload CSV')
                      e.target.value = ''
                    }
                  }}
                  className="text-sm"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #A8E8BC',
                    borderRadius: '0.375rem',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer'
                  }}
                />
              </div>

              {generatedLink && generatedLink.testId === inviteModal.testId ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-md">
                    <p className="text-sm font-medium mb-2">Candidate Added Successfully!</p>
                    <p className="text-xs text-muted-foreground">
                      {generatedLink.name} ({generatedLink.email}) has been added.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      onClick={() => {
                        setInviteModal({ testId: '', open: false })
                        setGeneratedLink(null)
                        setCandidateName('')
                        setCandidateEmail('')
                        refetchTests()
                      }}
                      className="flex-1"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Candidate Name</label>
                    <input
                      type="text"
                      className="input w-full"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="Enter candidate name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Candidate Email</label>
                    <input
                      type="email"
                      className="input w-full"
                      value={candidateEmail}
                      onChange={(e) => setCandidateEmail(e.target.value)}
                      placeholder="Enter candidate email"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setInviteModal({ testId: '', open: false })
                        setGeneratedLink(null)
                        setCandidateName('')
                        setCandidateEmail('')
                      }}
                      className="flex-1"
                      disabled={addingCandidate}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => handleAddCandidate(inviteModal.testId)}
                      className="flex-1"
                      disabled={addingCandidate}
                    >
                      {addingCandidate ? 'Adding...' : 'Add Candidate'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}




