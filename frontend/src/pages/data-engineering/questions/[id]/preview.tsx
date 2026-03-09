import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import { ArrowLeft, FileCode, Table as TableIcon, Bot } from 'lucide-react'
import { useDataEngineeringQuestion } from '@/hooks/api/useDataEngineering'

// Topic display names mapping
const TOPIC_DISPLAY_NAMES: Record<string, string> = {
  "transformations": "Data Transformations",
  "aggregations": "Aggregations",
  "joins": "Joins",
  "window_functions": "Window Functions",
  "performance_optimization": "Performance Optimization",
  "data_quality": "Data Quality",
  "streaming": "Streaming",
  "partitioning": "Partitioning",
  "distributed_computing": "Distributed Computing",
  "data_ingestion": "Data Ingestion",
  "error_handling": "Error Handling",
  "data_validation": "Data Validation",
  "caching": "Caching",
  "broadcast_joins": "Broadcast Joins",
  "skew_handling": "Skew Handling",
  "memory_optimization": "Memory Optimization",
  "incremental_loads": "Incremental Loads",
  "change_data_capture": "Change Data Capture (CDC)",
  "data_cleansing": "Data Cleansing",
  "shuffle_optimization": "Shuffle Optimization",
  "data_locality": "Data Locality",
  "orchestration": "Orchestration",
  "monitoring": "Monitoring",
  "data_modeling": "Data Modeling",
  "dimensional_modeling": "Dimensional Modeling",
  "slowly_changing_dimensions": "Slowly Changing Dimensions (SCD)",
  "fact_tables": "Fact Tables",
  "star_schema": "Star Schema"
};

export default function DataEngineeringQuestionPreviewPage() {
  const router = useRouter()
  const { id: questionId } = router.query
  const { data: questionData, isLoading: loading, error: queryError } = useDataEngineeringQuestion(questionId as string)
  const [question, setQuestion] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (questionData) {
      setQuestion(questionData)
    }
  }, [questionData])

  useEffect(() => {
    if (queryError) {
      setError((queryError as any)?.response?.data?.detail || 'Failed to fetch question')
    }
  }, [queryError])

  const getDifficultyColor = (level: number) => {
    switch (level) {
      case 1: return { color: '#059669', bg: '#D1FAE5' }
      case 2: return { color: '#D97706', bg: '#FEF3C7' }
      case 3: return { color: '#DC2626', bg: '#FEE2E2' }
      default: return { color: '#4B5563', bg: '#F3F4F6' }
    }
  }

  const getDifficultyLabel = (level: number): string => {
    switch (level) {
      case 1: return 'Easy'
      case 2: return 'Medium'
      case 3: return 'Hard'
      default: return 'Unknown'
    }
  }

  const getTopicDisplayName = (topic: string): string => {
    if (!topic) return 'General';
    
    // First try to find in predefined mapping
    if (TOPIC_DISPLAY_NAMES[topic]) {
      return TOPIC_DISPLAY_NAMES[topic];
    }
    
    // Handle snake_case and convert to Title Case
    return topic
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  const renderDataTable = (data: any, title: string) => {
    if (!data) return null
    
    // Handle data.data structure or direct array
    const rows = data.data || data
    if (!Array.isArray(rows) || rows.length === 0) return null
    
    const columns = Object.keys(rows[0])
    
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ 
          marginBottom: '0.75rem', 
          color: '#111827', 
          fontSize: '1.125rem', 
          fontWeight: 700, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem' 
        }}>
          <TableIcon size={20} color="#00684A" />
          {title}
        </h3>
        <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '0.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB' }}>
                {columns.map((col, idx) => (
                  <th key={idx} style={{ 
                    padding: '0.75rem 1rem', 
                    textAlign: 'left', 
                    fontWeight: 600, 
                    color: '#374151',
                    borderBottom: '2px solid #E5E7EB',
                    whiteSpace: 'nowrap'
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, rowIdx: number) => (
                <tr key={rowIdx} style={{ 
                  backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#F9FAFB',
                  transition: 'background-color 0.2s'
                }}>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} style={{ 
                      padding: '0.75rem 1rem', 
                      borderBottom: rowIdx !== rows.length - 1 ? '1px solid #E5E7EB' : 'none',
                      color: '#4B5563'
                    }}>
                      {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderSchema = (schema: any) => {
    if (!schema) return null
    
    // Handle array of schema objects with column_name and data_type
    if (Array.isArray(schema)) {
      if (schema.length === 0) return null
      
      return (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ 
            marginBottom: '0.75rem', 
            color: '#111827', 
            fontSize: '1.125rem', 
            fontWeight: 700, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem' 
          }}>
            <FileCode size={20} color="#00684A" />
            Input Schema
          </h3>
          <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB' }}>
                  <th style={{ 
                    padding: '0.75rem 1rem', 
                    textAlign: 'left', 
                    fontWeight: 600, 
                    color: '#374151', 
                    borderBottom: '2px solid #E5E7EB' 
                  }}>
                    Column Name
                  </th>
                  <th style={{ 
                    padding: '0.75rem 1rem', 
                    textAlign: 'left', 
                    fontWeight: 600, 
                    color: '#374151', 
                    borderBottom: '2px solid #E5E7EB' 
                  }}>
                    Data Type
                  </th>
                  <th style={{ 
                    padding: '0.75rem 1rem', 
                    textAlign: 'left', 
                    fontWeight: 600, 
                    color: '#374151', 
                    borderBottom: '2px solid #E5E7EB' 
                  }}>
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {schema.map((col: any, idx: number) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#F9FAFB' }}>
                    <td style={{ 
                      padding: '0.75rem 1rem', 
                      borderBottom: idx !== schema.length - 1 ? '1px solid #E5E7EB' : 'none', 
                      color: '#4B5563', 
                      fontWeight: 500 
                    }}>
                      {col.column_name}
                    </td>
                    <td style={{ 
                      padding: '0.75rem 1rem', 
                      borderBottom: idx !== schema.length - 1 ? '1px solid #E5E7EB' : 'none', 
                      color: '#6B7280' 
                    }}>
                      {col.data_type}
                    </td>
                    <td style={{ 
                      padding: '0.75rem 1rem', 
                      borderBottom: idx !== schema.length - 1 ? '1px solid #E5E7EB' : 'none', 
                      color: '#6B7280' 
                    }}>
                      {col.description || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
    
    // Handle object with key-value pairs (column_name: data_type)
    if (typeof schema === 'object' && Object.keys(schema).length > 0) {
      return (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ 
            marginBottom: '0.75rem', 
            color: '#111827', 
            fontSize: '1.125rem', 
            fontWeight: 700, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem' 
          }}>
            <FileCode size={20} color="#00684A" />
            Input Schema
          </h3>
          <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB' }}>
                  <th style={{ 
                    padding: '0.75rem 1rem', 
                    textAlign: 'left', 
                    fontWeight: 600, 
                    color: '#374151', 
                    borderBottom: '2px solid #E5E7EB' 
                  }}>
                    Column Name
                  </th>
                  <th style={{ 
                    padding: '0.75rem 1rem', 
                    textAlign: 'left', 
                    fontWeight: 600, 
                    color: '#374151', 
                    borderBottom: '2px solid #E5E7EB' 
                  }}>
                    Data Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(schema).map(([colName, dataType], idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#F9FAFB' }}>
                    <td style={{ 
                      padding: '0.75rem 1rem', 
                      borderBottom: idx !== Object.keys(schema).length - 1 ? '1px solid #E5E7EB' : 'none', 
                      color: '#4B5563', 
                      fontWeight: 500 
                    }}>
                      {colName}
                    </td>
                    <td style={{ 
                      padding: '0.75rem 1rem', 
                      borderBottom: idx !== Object.keys(schema).length - 1 ? '1px solid #E5E7EB' : 'none', 
                      color: '#6B7280' 
                    }}>
                      {String(dataType)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
    
    return null
  }

  const renderTestCases = (testCases: any[]) => {
    if (!testCases || testCases.length === 0) return null
    
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ 
          marginBottom: '0.75rem', 
          color: '#111827', 
          fontSize: '1.125rem', 
          fontWeight: 700 
        }}>
          Test Cases
        </h3>
        {testCases.map((testCase: any, idx: number) => (
          <div key={idx} style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            border: '1px solid #E5E7EB',
            borderRadius: '0.5rem',
            backgroundColor: '#F9FAFB'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '1rem', color: '#111827' }}>
              Test Case {idx + 1}
            </div>
            
            {/* Input Data */}
            {testCase.input && renderDataTable(testCase.input, 'Input Data')}
            
            {/* Expected Output */}
            {testCase.expected_output && renderDataTable(testCase.expected_output, 'Expected Output')}
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div style={{ textAlign: "center" }}>Loading question...</div>
        </div>
      </div>
    )
  }

  if (error || !question) {
    return (
      <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
          <div style={{ color: "#DC2626" }}>{error || 'Question not found'}</div>
        </div>
      </div>
    )
  }

  const diffColors = getDifficultyColor(question.difficulty_level)

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            onClick={() => router.push("/data-engineering/questions")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#6B7280"
            }}
          >
            <ArrowLeft size={16} /> Back to Questions
          </button>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
            <div>
              <h1 style={{ marginBottom: "0.5rem", color: "#1a1625" }}>{question.title}</h1>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.875rem", flexWrap: "wrap" }}>
                <span style={{
                  padding: "0.25rem 0.75rem",
                  borderRadius: "0.375rem",
                  fontWeight: 600,
                  backgroundColor: diffColors.bg,
                  color: diffColors.color
                }}>
                  {getDifficultyLabel(question.difficulty_level)}
                </span>
                {question.topic && (
                  <span style={{
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontWeight: 600,
                    backgroundColor: "#F0F9F4",
                    color: "#00684A",
                    border: "1px solid #E1F2E9"
                  }}>
                    {getTopicDisplayName(question.topic)}
                  </span>
                )}
                {question.metadata?.ai_generated && (
                  <span style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontWeight: 600,
                    backgroundColor: "#EDE9FE",
                    color: "#6D28D9",
                    border: "1px solid #DDD6FE"
                  }}>
                    <Bot size={14} /> AI Generated
                  </span>
                )}
                {question.metadata?.experience_years && (
                  <span style={{
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "#E0F2FE",
                    color: "#0369A1",
                    fontWeight: 600
                  }}>
                    {question.metadata.experience_years} years experience
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/data-engineering/questions/${questionId}/edit`)}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#00684A",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              Edit Question
            </button>
          </div>

          {/* Problem Description */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ marginBottom: "0.75rem", color: "#111827", fontSize: "1.125rem", fontWeight: 700 }}>
              Problem Description
            </h3>
            <div style={{
              padding: "1rem",
              backgroundColor: "#F9FAFB",
              borderRadius: "0.5rem",
              whiteSpace: "pre-wrap",
              lineHeight: "1.6",
              color: "#374151"
            }}>
              {question.description}
            </div>
          </div>

          {/* Input Schema */}
          {question.input_schema && renderSchema(question.input_schema)}

          {/* Sample Input Data */}
          {question.sample_input && renderDataTable(question.sample_input, 'Sample Input Data')}

          {/* Expected Output */}
          {question.expected_output && renderDataTable(question.expected_output, 'Expected Output')}

          {/* Test Cases */}
          {question.test_cases && renderTestCases(question.test_cases)}
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth
