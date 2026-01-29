import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import { useAIMLQuestion } from '@/hooks/api/useAIML'
import apiClient from '@/services/api/client'

interface Question {
  id: string
  title: string
  description: string
  difficulty: string
  library?: string
  tasks?: string[]
  constraints?: string[]
  assessment_metadata?: {
    skill?: string
    topic?: string
    libraries?: string[]
    selected_dataset_format?: string
  }
  dataset?: {
    schema: Array<{ name: string; type: string }>
    rows: any[][]
  }
  requires_dataset?: boolean
  ai_generated?: boolean
}

export default function AIMLQuestionPreviewPage() {
  const router = useRouter()
  const { id } = router.query
  const [question, setQuestion] = useState<Question | null>(null)
  const [datasetPreview, setDatasetPreview] = useState<string | null>(null)
  const [loadingDataset, setLoadingDataset] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<string>('csv')
  const [error, setError] = useState<string | null>(null)
  const [datasetMeta, setDatasetMeta] = useState<{ isBinary?: boolean; mimeType?: string } | null>(null)

  // React Query hook
  const { data: questionData, isLoading: loading, error: queryError } = useAIMLQuestion(id as string)

  // Update local state from React Query data
  useEffect(() => {
    console.log('🔵 [AIML Preview] questionData received:', questionData)
    if (questionData) {
      const q = questionData as any
      console.log('🔵 [AIML Preview] Question data structure:', {
        hasDataset: !!q.dataset,
        dataset: q.dataset,
        requires_dataset: q.requires_dataset,
        assessment_metadata: q.assessment_metadata,
        selected_dataset_format: q.assessment_metadata?.selected_dataset_format,
      })
      setQuestion({
        id: q.id || '',
        title: q.title || '',
        description: q.description || '',
        difficulty: q.difficulty || 'medium',
        library: q.library,
        tasks: q.tasks,
        constraints: q.constraints,
        assessment_metadata: q.assessment_metadata,
        dataset: q.dataset,
        requires_dataset: q.requires_dataset,
        ai_generated: q.ai_generated,
      })
      console.log('🟢 [AIML Preview] Question state set with dataset:', !!q.dataset)
    } else {
      console.log('🟡 [AIML Preview] No questionData available')
    }
  }, [questionData])

  // Handle error from React Query
  useEffect(() => {
    if (queryError) {
      setError((queryError as any)?.response?.data?.detail || 'Failed to fetch question')
    }
  }, [queryError])

  useEffect(() => {
    console.log('🔵 [AIML Preview] useEffect triggered for dataset fetch:', {
      hasQuestion: !!question,
      hasDataset: !!question?.dataset,
      dataset: question?.dataset,
      hasAssessmentMetadata: !!question?.assessment_metadata,
      selectedFormat: question?.assessment_metadata?.selected_dataset_format,
      questionId: id,
    })
    
    if (question?.dataset) {
      // Use selected_dataset_format if available, otherwise default to 'csv'
      const format = question?.assessment_metadata?.selected_dataset_format || 'csv'
      console.log('🟢 [AIML Preview] Dataset exists, fetching preview with format:', format)
      setSelectedFormat(format)
      fetchDatasetPreview(format)
    } else {
      console.log('🟡 [AIML Preview] Dataset not found in question object:', {
        questionKeys: question ? Object.keys(question) : 'question is null',
        requiresDataset: question?.requires_dataset,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question])

  const fetchDatasetPreview = async (format: string) => {
    console.log('🔵 [AIML Preview] fetchDatasetPreview called:', {
      format,
      hasQuestion: !!question,
      hasDataset: !!question?.dataset,
      questionId: id,
    })
    
    if (!question?.dataset || !id) {
      console.log('🟡 [AIML Preview] Cannot fetch dataset preview - missing data:', {
        hasQuestion: !!question,
        hasDataset: !!question?.dataset,
        hasId: !!id,
      })
      return
    }
    
    try {
      console.log('🟢 [AIML Preview] Starting dataset preview fetch...', {
        url: `/api/v1/aiml/questions/${id}/dataset-preview`,
        format,
      })
      setLoadingDataset(true)
      // Use dataset-preview endpoint for authenticated preview (not the candidate endpoint)
      const response = await apiClient.get(`/api/v1/aiml/questions/${id}/dataset-preview`, {
        params: { format },
      })
      console.log('🟢 [AIML Preview] Dataset preview response received:', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        isBinary: response.data?.is_binary,
        hasContent: !!response.data?.content,
        contentLength: response.data?.content?.length,
        mimeType: response.data?.mime_type,
      })
      
      // Store the full response to check if it's binary
      const isBinary = response.data.is_binary || false
      const content = response.data.content
      const mimeType = response.data.mime_type || 'text/plain'
      
      console.log('🟢 [AIML Preview] Setting dataset preview state:', {
        hasContent: !!content,
        contentLength: content?.length,
        isBinary,
        mimeType,
      })
      
      // Store both content and metadata
      setDatasetPreview(content)
      setSelectedFormat(format)
      setDatasetMeta({ isBinary, mimeType })
    } catch (error: any) {
      console.error('🔴 [AIML Preview] Error fetching dataset preview:', {
        error: error,
        message: error?.message,
        response: error?.response,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        url: error?.config?.url,
      })
      setError(error.response?.data?.detail || 'Failed to fetch dataset preview')
      setDatasetMeta(null)
    } finally {
      setLoadingDataset(false)
      console.log('🔵 [AIML Preview] Dataset preview fetch completed')
    }
  }

  const handleFormatChange = (format: string) => {
    fetchDatasetPreview(format)
  }

  const downloadDataset = () => {
    if (!datasetPreview || !question) return
    
    const format = selectedFormat.toLowerCase()
    let blob: Blob
    
    // Handle binary formats (base64 encoded)
    if (format === 'pdf' || format === 'parquet' || format === 'avro') {
      // Decode base64
      const binaryString = atob(datasetPreview)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      blob = new Blob([bytes], { 
        type: format === 'pdf' ? 'application/pdf' : 'application/octet-stream'
      })
    } else {
      blob = new Blob([datasetPreview], { 
        type: format === 'json' ? 'application/json' : 'text/csv'
      })
    }
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${question.title || 'dataset'}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return { color: '#059669', bg: '#D1FAE5' }
      case 'medium':
        return { color: '#D97706', bg: '#FEF3C7' }
      case 'hard':
        return { color: '#DC2626', bg: '#FEE2E2' }
      default:
        return { color: '#6B7280', bg: '#F3F4F6' }
    }
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
          <div className="card">
            <div style={{ color: "#DC2626", textAlign: "center" }}>
              {error || 'Question not found'}
            </div>
            <button
              className="btn-secondary"
              onClick={() => router.push('/aiml/questions')}
              style={{ marginTop: "1rem" }}
            >
              Back to Questions
            </button>
          </div>
        </div>
      </div>
    )
  }

  const diffColors = getDifficultyColor(question.difficulty)

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.push("/aiml/questions")}
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

        <div className="card">
          <h1 style={{ marginBottom: "2rem", color: "#1a1625" }}>Question Preview</h1>

          {/* Question Header */}
          <div style={{ marginBottom: "2rem" }}>
            <h2 style={{ marginBottom: "1rem", color: "#1a1625", fontSize: "1.5rem" }}>
              {question.title}
            </h2>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <span
                style={{
                  padding: "0.25rem 0.75rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: diffColors.color,
                  backgroundColor: diffColors.bg,
                }}
              >
                {question.difficulty}
              </span>
              {question.library && (
                <span
                  style={{
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                    color: "#2D7A52",
                    backgroundColor: "#E8FAF0",
                  }}
                >
                  📚 {question.library}
                </span>
              )}
              {question.assessment_metadata?.skill && (
                <span
                  style={{
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                    color: "#7C3AED",
                    backgroundColor: "#EDE9FE",
                  }}
                >
                  🎯 {question.assessment_metadata.skill}
                </span>
              )}
              {question.assessment_metadata?.topic && (
                <span
                  style={{
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                    color: "#0369A1",
                    backgroundColor: "#E0F2FE",
                  }}
                >
                  📌 {question.assessment_metadata.topic}
                </span>
              )}
              {question.ai_generated && (
                <span
                  style={{
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                    color: "#7C3AED",
                    backgroundColor: "#EDE9FE",
                  }}
                >
                  🤖 AI Generated
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ marginBottom: "0.75rem", color: "#1a1625", fontSize: "1.125rem" }}>
              Description
            </h3>
            <div
              style={{
                padding: "1rem",
                backgroundColor: "#f9fafb",
                borderRadius: "0.5rem",
                whiteSpace: "pre-wrap",
                lineHeight: "1.6",
                color: "#374151",
              }}
            >
              {question.description}
            </div>
          </div>

          {/* Tasks */}
          {question.tasks && question.tasks.length > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ marginBottom: "0.75rem", color: "#1a1625", fontSize: "1.125rem" }}>
                Tasks
              </h3>
              <ul style={{ paddingLeft: "1.5rem", color: "#374151" }}>
                {question.tasks.map((task, idx) => (
                  <li key={idx} style={{ marginBottom: "0.5rem", lineHeight: "1.6" }}>
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Constraints */}
          {question.constraints && question.constraints.length > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ marginBottom: "0.75rem", color: "#1a1625", fontSize: "1.125rem" }}>
                Constraints
              </h3>
              <ul style={{ paddingLeft: "1.5rem", color: "#374151" }}>
                {question.constraints.map((constraint, idx) => (
                  <li key={idx} style={{ marginBottom: "0.5rem", lineHeight: "1.6" }}>
                    {constraint}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dataset Preview */}
          {question.dataset && (
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ color: "#1a1625", fontSize: "1.125rem" }}>
                  Dataset Preview
                </h3>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <select
                    value={selectedFormat}
                    onChange={(e) => handleFormatChange(e.target.value)}
                    disabled={loadingDataset}
                    style={{
                      padding: "0.5rem 0.75rem",
                      border: "1px solid #A8E8BC",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                    }}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="parquet">Parquet</option>
                    <option value="avro">Avro</option>
                    <option value="pdf">PDF</option>
                  </select>
                  {datasetPreview && (
                    <button
                      className="btn-primary"
                      onClick={downloadDataset}
                      style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                    >
                      📥 Download
                    </button>
                  )}
                </div>
              </div>

              {loadingDataset ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  Loading dataset preview...
                </div>
              ) : datasetPreview ? (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "#f9fafb",
                    borderRadius: "0.5rem",
                    border: "1px solid #e5e7eb",
                    maxHeight: "500px",
                    overflow: "auto",
                  }}
                >
                  {(() => {
                    const isBinary = datasetMeta?.isBinary || false
                    const mimeType = datasetMeta?.mimeType || 'text/plain'
                    
                    // Handle binary formats (PDF, Parquet, Avro) - display in original format
                    if (isBinary) {
                      if (selectedFormat === 'pdf') {
                        // Display PDF in iframe - original PDF format
                        const base64Data = datasetPreview
                        const pdfDataUri = `data:application/pdf;base64,${base64Data}`
                        return (
                          <div style={{ width: "100%", height: "500px" }}>
                            <iframe
                              src={pdfDataUri}
                              style={{
                                width: "100%",
                                height: "100%",
                                border: "1px solid #e5e7eb",
                                borderRadius: "0.375rem",
                              }}
                              title="PDF Preview"
                            />
                          </div>
                        )
                      } else if (selectedFormat === 'parquet' || selectedFormat === 'avro') {
                        // For Parquet/Avro, show that it's in original binary format
                        // These are binary formats that can't be displayed as text
                        return (
                          <div style={{ textAlign: "center", padding: "2rem" }}>
                            <p style={{ color: "#64748b", marginBottom: "0.5rem", fontWeight: 600 }}>
                              {selectedFormat.toUpperCase()} Format Dataset
                            </p>
                            <p style={{ color: "#64748b", marginBottom: "1rem", fontSize: "0.875rem" }}>
                              This dataset is in its original {selectedFormat.toUpperCase()} binary format. 
                              The format has not been changed - it's displayed as stored.
                            </p>
                            <button
                              className="btn-primary"
                              onClick={downloadDataset}
                              style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                            >
                              📥 Download {selectedFormat.toUpperCase()}
                            </button>
                          </div>
                        )
                      }
                    }
                    
                    // Handle text-based formats (CSV, JSON) - display in original format
                    if (selectedFormat === 'json') {
                      return (
                        <pre
                          style={{
                            margin: 0,
                            fontFamily: "monospace",
                            fontSize: "0.875rem",
                            whiteSpace: "pre-wrap",
                            backgroundColor: "#1e293b",
                            color: "#e2e8f0",
                            padding: "1rem",
                            borderRadius: "0.375rem",
                          }}
                        >
                          {(() => {
                            try {
                              const parsed = JSON.parse(datasetPreview)
                              return JSON.stringify(parsed, null, 2)
                            } catch (e) {
                              return datasetPreview
                            }
                          })()}
                        </pre>
                      )
                    } else if (selectedFormat === 'csv') {
                      return (
                        <pre
                          style={{
                            margin: 0,
                            fontFamily: "monospace",
                            fontSize: "0.875rem",
                            color: "#374151",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {datasetPreview}
                        </pre>
                      )
                    }
                    
                    // Fallback - display as-is in original format
                    return (
                      <pre
                        style={{
                          margin: 0,
                          fontFamily: "monospace",
                          fontSize: "0.875rem",
                          color: "#374151",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {datasetPreview}
                      </pre>
                    )
                  })()}
                </div>
              ) : (
                <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  No dataset preview available
                </div>
              )}

              {/* Dataset Schema Info */}
              {question.dataset.schema && question.dataset.schema.length > 0 && (
                <div style={{ marginTop: "1rem", padding: "0.75rem", backgroundColor: "#f3f4f6", borderRadius: "0.375rem" }}>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b", fontWeight: 600 }}>
                    Dataset Schema: {question.dataset.schema.length} columns, {question.dataset.rows?.length || 0} rows
                  </p>
                  <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {question.dataset.schema.map((col, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: "0.25rem 0.5rem",
                          backgroundColor: "#ffffff",
                          borderRadius: "0.25rem",
                          fontSize: "0.75rem",
                          color: "#374151",
                        }}
                      >
                        {col.name} ({col.type})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth
