import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { 
  BarChart3, 
  Code, 
  Clock, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Users,
  BookOpen,
  Play
} from 'lucide-react'
import { dataEngineeringAPI } from '../../../services/data-engineering/api'

interface DashboardStats {
  totalQuestions: number
  completedAssessments: number
  averageScore: number
  totalUsers: number
  recentActivity: Array<{
    id: string
    type: 'assessment' | 'practice'
    user: string
    score: number
    timestamp: string
  }>
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Mock data for now - replace with actual API calls when available
      const mockStats: DashboardStats = {
        totalQuestions: 25,
        completedAssessments: 142,
        averageScore: 78.5,
        totalUsers: 89,
        recentActivity: [
          {
            id: '1',
            type: 'assessment',
            user: 'John Doe',
            score: 85,
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
          },
          {
            id: '2',
            type: 'practice',
            user: 'Jane Smith',
            score: 92,
            timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString()
          },
          {
            id: '3',
            type: 'assessment',
            user: 'Mike Johnson',
            score: 67,
            timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString()
          }
        ]
      }
      
      setStats(mockStats)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Data Engineering Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Monitor assessments and track performance
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/data-engineering/practice')}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Practice
              </button>
              <button
                onClick={() => router.push('/data-engineering/assessment')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Code className="h-4 w-4" />
                New Assessment
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Questions</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalQuestions}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Assessments</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.completedAssessments}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Score</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.averageScore}%</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalUsers}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h2>
            <div className="space-y-4">
              {stats?.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      activity.type === 'assessment' ? 'bg-indigo-100' : 'bg-green-100'
                    }`}>
                      {activity.type === 'assessment' ? (
                        <Code className={`h-4 w-4 ${
                          activity.type === 'assessment' ? 'text-indigo-600' : 'text-green-600'
                        }`} />
                      ) : (
                        <Play className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{activity.user}</p>
                      <p className="text-sm text-gray-600">
                        {activity.type === 'assessment' ? 'Completed Assessment' : 'Practice Session'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      activity.score >= 80 
                        ? 'bg-green-100 text-green-800'
                        : activity.score >= 60
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {activity.score}%
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
            <div className="space-y-4">
              <button
                onClick={() => router.push('/data-engineering/assessment')}
                className="w-full p-4 text-left bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Code className="h-6 w-6 text-indigo-600" />
                  <div>
                    <h3 className="font-medium text-indigo-900">Start New Assessment</h3>
                    <p className="text-sm text-indigo-700">Begin a timed coding challenge</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/data-engineering/practice')}
                className="w-full p-4 text-left bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Play className="h-6 w-6 text-green-600" />
                  <div>
                    <h3 className="font-medium text-green-900">Practice Mode</h3>
                    <p className="text-sm text-green-700">Practice without time limits</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/data-engineering/simple-test')}
                className="w-full p-4 text-left bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                  <div>
                    <h3 className="font-medium text-blue-900">Simple Test</h3>
                    <p className="text-sm text-blue-700">Quick functionality test</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => window.open('http://localhost:3010/docs', '_blank')}
                className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="h-6 w-6 text-gray-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">API Documentation</h3>
                    <p className="text-sm text-gray-700">View service API docs</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Performance Chart Placeholder */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Performance Overview</h2>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Performance charts coming soon</p>
              <p className="text-sm text-gray-500 mt-1">
                Detailed analytics and trends will be displayed here
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}