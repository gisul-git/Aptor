'use client'

import { Lightbulb, CheckCircle2, Code } from 'lucide-react'

interface SQLAnalyticsViewProps {
  questionTitle: string
  status: string
  passedTestcases: number
  totalTestcases: number
  code: string
  aiFeedback?: {
    overall_score?: number
    feedback_summary?: string
    test_breakdown?: {
      public_passed?: number
      public_total?: number
    }
  }
  testResults?: Array<{
    id?: string
    test_number?: number
    input?: string
    expected_output?: string
    user_output?: string
    actual_output?: string
    passed?: boolean
    status?: string
    status_id?: number
    time?: number
    memory?: number
    stderr?: string
    stdout?: string
  }>
  executionTime?: number
  memoryUsed?: number
}

export default function SQLAnalyticsView({
  questionTitle,
  status,
  passedTestcases,
  totalTestcases,
  code,
  aiFeedback,
  testResults,
  executionTime,
  memoryUsed,
}: SQLAnalyticsViewProps) {
  const isPassed = status === 'accepted'
  const testCasePassed = passedTestcases > 0

  return (
    <div style={{
      border: "1px solid #e2e8f0",
      borderRadius: "0.75rem",
      padding: "1.5rem",
      backgroundColor: "#ffffff",
    }}>
      <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
        {questionTitle}
      </h3>
      
      {/* Status and Test Cases */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Status</div>
          <div style={{ 
            fontSize: "0.875rem", 
            fontWeight: 500, 
            color: isPassed ? "#059669" : "#dc2626" 
          }}>
            {status}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Test Cases</div>
          <div style={{ fontSize: "0.875rem" }}>
            {passedTestcases} / {totalTestcases} passed
          </div>
        </div>
        {executionTime && (
          <div>
            <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Execution Time</div>
            <div style={{ fontSize: "0.875rem" }}>{executionTime}ms</div>
          </div>
        )}
        {memoryUsed && (
          <div>
            <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Memory Used</div>
            <div style={{ fontSize: "0.875rem" }}>{memoryUsed}KB</div>
          </div>
        )}
      </div>

      {/* Test Case Result */}
      {testResults && testResults.length > 0 && (
        <div style={{ 
          marginBottom: "1.5rem", 
          border: "1px solid #3b82f6", 
          borderRadius: "0.5rem", 
          backgroundColor: "#eff6ff", 
          overflow: "hidden" 
        }}>
          <div style={{ padding: "0.75rem 1rem", backgroundColor: "#dbeafe", borderBottom: "1px solid #3b82f6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <CheckCircle2 style={{ width: "20px", height: "20px", color: "#3b82f6" }} />
              <span style={{ fontWeight: 600, color: "#1e40af" }}>Test Case Result</span>
            </div>
          </div>
          
          <div style={{ padding: "1rem" }}>
            {testResults.map((result, index) => (
              <div key={index} style={{ 
                backgroundColor: "#1e293b", 
                borderRadius: "0.5rem", 
                padding: "0.75rem",
                marginBottom: index < testResults.length - 1 ? "0.75rem" : 0
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ 
                      fontSize: "0.75rem", 
                      fontWeight: 600, 
                      color: "#cbd5e1" 
                    }}>
                      Test Case {index + 1}
                    </span>
                    <span style={{
                      fontSize: "0.75rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor: result.passed ? "#064e3b" : "#7f1d1d",
                      color: result.passed ? "#6ee7b7" : "#fca5a5",
                      fontWeight: 600
                    }}>
                      {result.passed ? "Passed" : "Failed"}
                    </span>
                  </div>
                  {result.time && (
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {result.time}ms
                    </span>
                  )}
                </div>
                
                {/* Expected Output */}
                {result.expected_output !== undefined && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                      Expected Output:
                    </div>
                    <pre style={{
                      fontSize: "0.75rem",
                      color: "#cbd5e1",
                      backgroundColor: "#0f172a",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      overflowX: "auto",
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word"
                    }}>
                      {result.expected_output && result.expected_output.trim() 
                        ? result.expected_output 
                        : "(No expected output available)"}
                    </pre>
                  </div>
                )}
                
                {/* Actual Output */}
                {(result.user_output !== undefined || result.actual_output !== undefined) && (
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                      Your Output:
                    </div>
                    <pre style={{
                      fontSize: "0.75rem",
                      color: result.passed ? "#6ee7b7" : "#fca5a5",
                      backgroundColor: "#0f172a",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      overflowX: "auto",
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word"
                    }}>
                      {result.user_output || result.actual_output || "(No output)"}
                    </pre>
                  </div>
                )}
                
                {/* Error Output */}
                {result.stderr && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <div style={{ fontSize: "0.75rem", color: "#fca5a5", marginBottom: "0.25rem" }}>
                      Error:
                    </div>
                    <pre style={{
                      fontSize: "0.75rem",
                      color: "#fca5a5",
                      backgroundColor: "#0f172a",
                      padding: "0.5rem",
                      borderRadius: "0.375rem",
                      overflowX: "auto",
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word"
                    }}>
                      {result.stderr}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Feedback */}
      {aiFeedback && (
        <div style={{ 
          marginBottom: "1.5rem", 
          border: "1px solid #3b82f6", 
          borderRadius: "0.5rem", 
          backgroundColor: "#eff6ff", 
          overflow: "hidden" 
        }}>
          <div style={{ padding: "0.75rem 1rem", backgroundColor: "#dbeafe", borderBottom: "1px solid #3b82f6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Lightbulb style={{ width: "20px", height: "20px", color: "#3b82f6" }} />
              <span style={{ fontWeight: 600, color: "#1e40af" }}>AI Feedback</span>
              {aiFeedback.overall_score !== undefined && (
                <span style={{ 
                  fontSize: "1.125rem", 
                  fontWeight: 700, 
                  color: aiFeedback.overall_score >= 80 ? "#059669" : aiFeedback.overall_score >= 60 ? "#f59e0b" : "#dc2626" 
                }}>
                  Score: {aiFeedback.overall_score}/100
                </span>
              )}
            </div>
          </div>
          
          <div style={{ padding: "1rem" }}>
            {aiFeedback.feedback_summary && (
              <div style={{ backgroundColor: "#1e293b", borderRadius: "0.5rem", padding: "0.75rem" }}>
                <h4 style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: 600, 
                  color: "#cbd5e1", 
                  marginBottom: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem"
                }}>
                  <Lightbulb style={{ width: "12px", height: "12px" }} />
                  Feedback
                </h4>
                <p style={{ fontSize: "0.875rem", color: "#cbd5e1", lineHeight: "1.6", margin: 0 }}>
                  {aiFeedback.feedback_summary}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SQL Query Display */}
      <details style={{ marginTop: "1rem" }}>
        <summary style={{ 
          cursor: "pointer", 
          fontSize: "0.875rem", 
          fontWeight: 500, 
          color: "#64748b",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem",
          borderRadius: "0.375rem",
          backgroundColor: "#f1f5f9",
          border: "1px solid #e2e8f0"
        }}>
          <Code style={{ width: "16px", height: "16px" }} />
          View SQL Query
        </summary>
        <pre style={{ 
          marginTop: "0.5rem", 
          padding: "1rem", 
          backgroundColor: "#1e293b", 
          borderRadius: "0.5rem", 
          overflowX: "auto", 
          fontSize: "0.75rem", 
          color: "#e2e8f0",
          border: "1px solid #334155"
        }}>
          <code>{code}</code>
        </pre>
      </details>
    </div>
  )
}

