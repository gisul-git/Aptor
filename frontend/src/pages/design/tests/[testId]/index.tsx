import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import Link from 'next/link'

interface Test {
  _id: string
  title: string
  description?: string
  duration_minutes: number
  question_ids: string[]
  created_at?: string
  proctoring_enabled?: boolean
  timer_mode?: string
  start_time?: string
  end_time?: string
}

export default function DesignTestDetailsPage() {
  const router = useRouter()
  const { testId } = router.query
  const [test, setTest] = useState<Test | null>(null)
  const [loading, setLoading] = useState(true)
  
  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design'

  useEffect(() => {
    if (testId) {
      fetchTest()
    }
  }, [testId])

  const fetchTest = async () => {
    try {
      const response = await fetch(`${API_URL}/tests/${testId}`)
      if (response.ok) {
        const data = await response.json()
        setTest(data)
      }
    } catch (error) {
      console.error('Failed to fetch test:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div style={{ textAlign: "center" }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (!test) {
    return (
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div style={{ textAlign: "center" }}>Test not found</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/design/tests")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            ← Back to Tests
          </button>
        </div>

        <div className="card">
          <div style={{ marginBottom: "2rem" }}>
            <h1 style={{ marginBottom: "1rem", color: "#1a1625" }}>{test.title}</h1>
            {test.description && (
              <p style={{ color: "#64748b", fontSize: "1rem" }}>{test.description}</p>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            <div style={{ padding: "1rem", border: "1px solid #E8B4FA", borderRadius: "0.5rem", backgroundColor: "#F9F5FF" }}>
              <div style={{ fontSize: "0.875rem", color: "#9333EA", marginBottom: "0.5rem" }}>Duration</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1a1625" }}>{test.duration_minutes} min</div>
            </div>
            <div style={{ padding: "1rem", border: "1px solid #E8B4FA", borderRadius: "0.5rem", backgroundColor: "#F9F5FF" }}>
              <div style={{ fontSize: "0.875rem", color: "#9333EA", marginBottom: "0.5rem" }}>Questions</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1a1625" }}>{test.question_ids?.length || 0}</div>
            </div>
            <div style={{ padding: "1rem", border: "1px solid #E8B4FA", borderRadius: "0.5rem", backgroundColor: "#F9F5FF" }}>
              <div style={{ fontSize: "0.875rem", color: "#9333EA", marginBottom: "0.5rem" }}>Proctoring</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1a1625" }}>
                {test.proctoring_enabled ? "✓ Enabled" : "✗ Disabled"}
              </div>
            </div>
            {test.timer_mode && (
              <div style={{ padding: "1rem", border: "1px solid #E8B4FA", borderRadius: "0.5rem", backgroundColor: "#F9F5FF" }}>
                <div style={{ fontSize: "0.875rem", color: "#9333EA", marginBottom: "0.5rem" }}>Timer Mode</div>
                <div style={{ fontSize: "1rem", fontWeight: 600, color: "#1a1625" }}>
                  {test.timer_mode === "GLOBAL" ? "Single Timer" : "Per Question"}
                </div>
              </div>
            )}
          </div>

          {test.start_time && (
            <div style={{ marginBottom: "2rem", padding: "1rem", border: "1px solid #E8B4FA", borderRadius: "0.5rem" }}>
              <h3 style={{ marginBottom: "0.75rem", color: "#7C3AED" }}>Schedule</h3>
              <div style={{ display: "flex", gap: "2rem" }}>
                <div>
                  <div style={{ fontSize: "0.875rem", color: "#9333EA", marginBottom: "0.25rem" }}>Start Time</div>
                  <div style={{ fontWeight: 600 }}>{new Date(test.start_time).toLocaleString()}</div>
                </div>
                {test.end_time && (
                  <div>
                    <div style={{ fontSize: "0.875rem", color: "#9333EA", marginBottom: "0.25rem" }}>End Time</div>
                    <div style={{ fontWeight: 600 }}>{new Date(test.end_time).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {test.created_at && (
            <div style={{ marginBottom: "2rem", fontSize: "0.875rem", color: "#64748b" }}>
              Created: {new Date(test.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem" }}>
            <Link href={`/design/tests/${testId}/edit`}>
              <button className="btn-primary" style={{ padding: "0.75rem 1.5rem" }}>
                ✏️ Edit Test
              </button>
            </Link>
            <button
              className="btn-secondary"
              onClick={() => router.push("/design/tests")}
              style={{ padding: "0.75rem 1.5rem" }}
            >
              Back to Tests
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth
