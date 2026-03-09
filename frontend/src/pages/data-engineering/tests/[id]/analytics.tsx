'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import Link from 'next/link'
import { ArrowLeft, Users, CheckCircle2, Clock, TrendingUp, AlertTriangle, Eye, Download, Mail, UserPlus } from 'lucide-react'
import { useDataEngineeringTest } from '@/hooks/api/useDataEngineering'
import apiClient from '@/services/api/client'

interface Candidate {
  user_id: string
  name: string
  email: string
  status?: string
  invited?: boolean
  invited_at?: string
  created_at?: string
}

export default function DataEngineeringAnalyticsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { id: testId } = router.query
  const testIdStr = typeof testId === 'string' ? testId : undefined
  
  const { data: testInfo, isLoading: loadingTest } = useDataEngineeringTest(testIdStr)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!testId || typeof testId !== 'string') return

    const fetchCandidates = async () => {
      try {
        setLoading(true)
        const response = await apiClient.get(`/api/v1/data-engineering/tests/${testId}/candidates`)
        setCandidates(response.data || [])
        setLoading(false)
      } catch (error) {
        console.error('Error fetching candidates:', error)
        setCandidates([])
        setLoading(false)
      }
    }

    fetchCandidates()
  }, [testId])

  const handleExportResults = async () => {
    if (!testId || typeof testId !== 'string' || candidates.length === 0) {
      alert('No candidates to export')
      return
    }

    try {
      // Prepare CSV data
      const headers = ['Name', 'Email', 'Status', 'Invited', 'Added Date']
      const csvRows = [
        headers.join(','),
        ...candidates.map(candidate => {
          const escapeCSV = (str: string) => {
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`
            }
            return str
          }
          
          return [
            escapeCSV(candidate.name || ''),
            escapeCSV(candidate.email || ''),
            escapeCSV(candidate.status || 'pending'),
            candidate.invited ? 'Yes' : 'No',
            candidate.created_at ? new Date(candidate.created_at).toLocaleDateString() : 'N/A'
          ].join(',')
        })
      ]
      
      const csvContent = csvRows.join('\n')
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `data_engineering_test_${testId}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      alert(`Exported ${candidates.length} candidate records successfully!`)
    } catch (err: any) {
      console.error('Error exporting results:', err)
      alert('Failed to export results: ' + (err.message || 'Unknown error'))
    }
  }

  if (loadingTest || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-mint-50/90 via-white to-forest-50/70 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-secondary">Loading analytics...</p>
        </div>
      </div>
    )
  }

  const totalCandidates = candidates.length
  const invitedCount = candidates.filter(c => c.invited).length
  const pendingCount = candidates.filter(c => c.status === 'pending').length
  const completedCount = candidates.filter(c => c.status === 'completed').length

  // Debug logging
  console.log('[Analytics Debug - v2]', {
    testInfo,
    hasToken: !!testInfo?.test_token,
    isPublished: testInfo?.is_published,
    timestamp: new Date().toISOString()
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-mint-50/90 via-white to-forest-50/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/data-engineering/tests/${testId}/edit`}
            className="inline-flex items-center gap-2 text-primary hover:text-forest-600 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Test
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">{testInfo?.title || 'Test Analytics'}</h1>
              <p className="text-secondary mt-2">View detailed analytics and candidate performance</p>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/data-engineering/tests/${testId}/candidates`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-mint-300 text-primary font-semibold rounded-lg hover:bg-mint-50 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Manage Candidates
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-mint-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-mint-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">{totalCandidates}</p>
                <p className="text-sm text-secondary">Total Candidates</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-mint-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">{invitedCount}</p>
                <p className="text-sm text-secondary">Invited</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-mint-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">{pendingCount}</p>
                <p className="text-sm text-secondary">Pending</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-mint-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">{completedCount}</p>
                <p className="text-sm text-secondary">Completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Test Access Section */}
        <div className="bg-white rounded-xl border border-mint-200 p-6 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-primary mb-4">Test Access</h2>
          {testInfo && testInfo.test_token ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">
                  Test URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/data-engineering/test/${testId}/take?token=${testInfo.test_token}`}
                    readOnly
                    className="flex-1 px-4 py-2 border-2 border-mint-300 rounded-lg bg-mint-50/50 text-primary font-mono text-sm"
                  />
                  <button
                    onClick={() => {
                      const testUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/data-engineering/test/${testId}/take?token=${testInfo.test_token}`;
                      navigator.clipboard.writeText(testUrl);
                      alert('Test URL copied to clipboard!');
                    }}
                    className="px-6 py-2 bg-gradient-to-r from-mint-200 to-mint-100 text-primary font-semibold rounded-lg border-2 border-mint-300 hover:shadow-lg transition-all"
                  >
                    Copy URL
                  </button>
                  <button
                    onClick={() => {
                      const testUrl = `/data-engineering/test/${testId}/take?token=${testInfo.test_token}`;
                      window.open(testUrl, '_blank');
                    }}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-forest-600 transition-all shadow-md hover:shadow-lg"
                  >
                    <Eye className="w-4 h-4" />
                    Take Test
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-orange-700 text-sm">
                Test link will be available once the test is published. Please publish the test to generate the access link.
              </p>
            </div>
          )}
        </div>

        {/* Candidates Management Section */}
        <div className="bg-white rounded-xl border border-mint-200 shadow-sm mb-8">
          <div className="p-6 border-b border-mint-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary">Candidates</h2>
              <div className="flex gap-3">
                {candidates.length > 0 && (
                  <button
                    onClick={handleExportResults}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-mint-300 text-primary font-semibold rounded-lg hover:bg-mint-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                )}
                <Link
                  href={`/data-engineering/tests/${testId}/candidates`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-mint-200 to-mint-100 text-primary font-semibold rounded-lg border-2 border-mint-300 hover:shadow-lg transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Candidates
                </Link>
              </div>
            </div>
          </div>

          {candidates.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-mint-100 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary mb-2">No Candidates Yet</h3>
              <p className="text-secondary mb-6 max-w-md mx-auto">
                Add candidates to this test to start tracking their performance and view detailed analytics.
              </p>
              <Link
                href={`/data-engineering/tests/${testId}/candidates`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-mint-200 to-mint-100 text-primary font-semibold rounded-xl border-2 border-mint-300 hover:shadow-lg transition-all"
              >
                <UserPlus className="w-5 h-5" />
                Add Candidates
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-mint-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Candidate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Invited
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Added
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mint-100">
                  {candidates.map((candidate) => (
                    <tr key={candidate.user_id} className="hover:bg-mint-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-primary">{candidate.name}</div>
                          <div className="text-sm text-secondary">{candidate.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          candidate.status === 'completed' ? 'bg-green-100 text-green-800' :
                          candidate.status === 'started' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {candidate.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          candidate.invited ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {candidate.invited ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary">
                        {candidate.created_at ? new Date(candidate.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-primary hover:text-forest-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled
                          title="Detailed analytics coming soon"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Coming Soon Section */}
        <div className="bg-gradient-to-r from-mint-100 to-forest-100 rounded-xl border-2 border-mint-300 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-primary mb-2">Detailed Analytics Coming Soon</h3>
          <p className="text-secondary max-w-2xl mx-auto">
            We're working on comprehensive analytics features including:
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="bg-white rounded-lg p-4 border border-mint-200">
              <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-primary">Question-by-Question Analysis</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-mint-200">
              <TrendingUp className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-primary">Performance Metrics</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-mint-200">
              <AlertTriangle className="w-6 h-6 text-orange-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-primary">AI-Powered Feedback</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth
