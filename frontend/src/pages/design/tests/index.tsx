import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'
import Link from 'next/link'

interface Test {
  _id: string
  title: string
  description?: string
  duration_minutes: number
  question_ids: string[]
  created_at?: string
  proctoring_enabled?: boolean
}

export default function DesignTestsPage() {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  
  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design'

  useEffect(() => {
    fetchTests()
  }, [])

  const fetchTests = async () => {
    try {
      const response = await fetch(`${API_URL}/tests`)
      if (response.ok) {
        const data = await response.json()
        setTests(data)
      }
    } catch (error) {
      console.error('Failed to fetch tests:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div style={{ textAlign: "center" }}>Loading tests...</div>
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
          <Link href="/design/create">
            <button className="btn-primary" style={{ padding: "0.5rem 1rem" }}>
              + Create Assessment
            </button>
          </Link>
        </div>

        <div className="card">
          <h1 style={{ marginBottom: "2rem", color: "#1a1625" }}>Design Assessments</h1>

          {tests.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              <p>No assessments found. Create your first assessment!</p>
              <Link href="/design/create">
                <button className="btn-primary" style={{ marginTop: "1rem" }}>
                  Create Assessment
                </button>
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {tests.map((test) => (
                <div
                  key={test._id}
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
                          {test.title}
                        </h3>
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
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                        <span
                          style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "0.375rem",
                            fontSize: "0.875rem",
                            color: "#059669",
                            backgroundColor: "#D1FAE5",
                          }}
                        >
                          ⏱️ {test.duration_minutes} minutes
                        </span>
                        <span
                          style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "0.375rem",
                            fontSize: "0.875rem",
                            color: "#9333EA",
                            backgroundColor: "#F3E8FF",
                          }}
                        >
                          📝 {test.question_ids?.length || 0} questions
                        </span>
                        {test.proctoring_enabled && (
                          <span
                            style={{
                              padding: "0.25rem 0.75rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.875rem",
                              color: "#DC2626",
                              backgroundColor: "#FEE2E2",
                            }}
                          >
                            🎥 Proctored
                          </span>
                        )}
                      </div>
                      {test.created_at && (
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.5rem" }}>
                          Created: {new Date(test.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                      {test.description && (
                        <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem", lineHeight: "1.5" }}>
                          {test.description.substring(0, 150)}{test.description.length > 150 ? '...' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                    <Link href={`/design/tests/${test._id}/manage`}>
                      <button className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                        📊 Manage
                      </button>
                    </Link>
                    <Link href={`/design/tests/${test._id}`}>
                      <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                        👁️ View Details
                      </button>
                    </Link>
                    <Link href={`/design/tests/${test._id}/edit`}>
                      <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                        ✏️ Edit
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth
