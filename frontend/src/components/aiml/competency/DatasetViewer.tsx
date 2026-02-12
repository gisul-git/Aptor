/**
 * Dataset Viewer Component - Displays datasets for AIML questions
 * Read-only component that allows candidates to view and copy file paths
 */

'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface DatasetFile {
  name: string
  path: string
  format: string
  size?: string
}

interface DatasetViewerProps {
  questionId: string
  dataset?: {
    schema: Array<{ name: string; type: string }>
    rows: any[]
    format?: string
  }
  datasetPath?: string
  datasetUrl?: string
  testId?: string
  userId?: string
  onInsertUrl?: (url: string) => void
}

export default function DatasetViewer({ questionId, dataset, datasetPath, datasetUrl, testId, userId, onInsertUrl }: DatasetViewerProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [copiedPath, setCopiedPath] = useState(false)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Get API base URL
  const apiUrl = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || window.location.origin.replace(':3000', ':80'))
    : 'http://localhost:80'

  // Construct full API URL from relative path or use provided URL
  const getFullApiUrl = () => {
    if (datasetUrl) {
      // If it's already a full URL, return it
      if (datasetUrl.startsWith('http://') || datasetUrl.startsWith('https://')) {
        return datasetUrl
      }
      // If it's a relative path, construct full URL
      return `${apiUrl}${datasetUrl.startsWith('/') ? '' : '/'}${datasetUrl}`
    }
    // Fallback: construct API endpoint URL
    if (dataset) {
      const format = dataset.format || 'csv'
      return `${apiUrl}/api/v1/aiml/questions/${questionId}/dataset?format=${format}`
    }
    return null
  }

  const fullApiUrl = getFullApiUrl()
  const datasetFormat = dataset?.format || 'csv'

  // Extract testId and userId from datasetUrl if available
  useEffect(() => {
    if (datasetUrl && !testId) {
      try {
        const url = new URL(datasetUrl.startsWith('http') ? datasetUrl : `${apiUrl}${datasetUrl}`)
        const urlTestId = url.searchParams.get('test_id')
        const urlUserId = url.searchParams.get('user_id')
        if (urlTestId && urlUserId) {
          // Store in component state if needed
        }
      } catch (e) {
        // Ignore URL parsing errors
      }
    }
  }, [datasetUrl, testId, apiUrl])

  // Fetch dataset preview in selected format when preview is shown
  useEffect(() => {
    if (showPreview && fullApiUrl && !previewContent && !loadingPreview) {
      fetchDatasetPreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview])

  const fetchDatasetPreview = async () => {
    if (!fullApiUrl) return
    
    setLoadingPreview(true)
    setPreviewError(null)
    
    try {
      // For binary formats (Parquet, Avro, PDF), fetch preview as CSV for readability
      // For CSV and JSON, use the original format
      const isBinaryFormat = ['parquet', 'avro', 'pdf'].includes(datasetFormat.toLowerCase())
      const previewFormat = isBinaryFormat ? 'csv' : datasetFormat.toLowerCase()
      
      // Construct preview URL with format parameter
      let previewUrl = fullApiUrl
      if (isBinaryFormat) {
        // Replace format parameter in URL or add it
        try {
          const url = new URL(fullApiUrl)
          url.searchParams.set('format', previewFormat)
          previewUrl = url.toString()
        } catch (e) {
          // If URL parsing fails, append format parameter
          const separator = fullApiUrl.includes('?') ? '&' : '?'
          previewUrl = `${fullApiUrl}${separator}format=${previewFormat}`
        }
      }
      
      // Fetch preview as text (CSV or JSON)
      const response = await axios.get(previewUrl, {
        responseType: 'text',
      })
      setPreviewContent(response.data)
    } catch (error: any) {
      console.error('Error fetching dataset preview:', error)
      setPreviewError(error.response?.data?.detail || 'Failed to load dataset preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleCopyPath = () => {
    if (fullApiUrl) {
      if (onInsertUrl) {
        // Insert full code snippet directly into code editor
        const codeSnippet = `import pandas as pd\ndf = pd.read_${dataset?.format || 'csv'}('${fullApiUrl}')`
        onInsertUrl(codeSnippet)
        setCopiedPath(true)
        setTimeout(() => setCopiedPath(false), 2000)
      } else {
        // Fallback: Copy the full code snippet to clipboard
        const codeSnippet = `import pandas as pd\ndf = pd.read_${dataset?.format || 'csv'}('${fullApiUrl}')`
        navigator.clipboard.writeText(codeSnippet)
        setCopiedPath(true)
        setTimeout(() => setCopiedPath(false), 2000)
      }
    }
  }

  const handleTogglePreview = () => {
    setShowPreview(!showPreview)
    // Reset preview content when hiding
    if (showPreview) {
      setPreviewContent(null)
      setPreviewError(null)
    }
  }

  if (!dataset && !datasetPath && !datasetUrl) {
    return null
  }

  const filePath = fullApiUrl || datasetPath || `/data/question_${questionId}/dataset.${dataset?.format || 'csv'}`
  const fileName = `dataset.${dataset?.format || 'csv'}`
  const fileFormat = (dataset?.format || 'csv').toUpperCase()

  return (
    <div style={{
      backgroundColor: '#f0fdf4',
      border: '2px solid #10b981',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: '#065f46'
          }}>
Dataset File Available
          </h3>
        </div>
        <span style={{
          padding: '4px 12px',
          backgroundColor: '#10b981',
          color: '#ffffff',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600
        }}>
          {fileFormat}
        </span>
      </div>

      {/* Helper Message */}
      <div style={{
        fontSize: '12px',
        color: '#047857',
        backgroundColor: '#d1fae5',
        padding: '8px 10px',
        borderRadius: '4px',
        marginBottom: '12px',
        fontStyle: 'italic'
      }}>
        💡 <strong>Click the copy icon</strong> (copy/paste disabled) - it will paste the code directly into the editor
      </div>

      {/* Tip Section with Copy Icon */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '12px'
      }}>
        <div style={{
          fontSize: '12px',
          color: '#059669',
          backgroundColor: '#d1fae5',
          padding: '8px 10px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ flex: 1 }}>
            <strong>Tip:</strong> Use the API URL directly in your code. Example:
            <div style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '11px', backgroundColor: '#ffffff', padding: '4px 6px', borderRadius: '3px' }}>
              import pandas as pd<br/>
              df = pd.read_{dataset?.format || 'csv'}('{fullApiUrl}')
            </div>
          </div>
          <button
            onClick={handleCopyPath}
            style={{
              padding: '6px',
              backgroundColor: '#ffffff',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
              marginTop: '2px',
              width: '28px',
              height: '28px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
            }}
            title={copiedPath ? 'Pasted to editor!' : 'Click to paste code into editor'}
          >
            {copiedPath ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Dataset Preview */}
      {dataset && dataset.schema && dataset.rows && dataset.rows.length > 0 && (
        <>
          <button
            onClick={handleTogglePreview}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ffffff',
              color: '#10b981',
              border: '1px solid #10b981',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f0fdf4'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff'
            }}
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{
                transform: showPreview ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            >
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            {showPreview ? 'Hide' : 'Show'} Dataset Preview ({datasetFormat.toUpperCase()} format, {dataset.rows.length} rows, {dataset.schema.length} columns)
          </button>

          {showPreview && (
            <div style={{
              marginTop: '12px',
              backgroundColor: '#ffffff',
              borderRadius: '6px',
              padding: '12px',
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid #e5e7eb'
            }}>
              {loadingPreview ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  Loading dataset preview...
                </div>
              ) : previewError ? (
                <div style={{ 
                  padding: '1rem', 
                  backgroundColor: previewError.includes('not available') ? '#fef3c7' : '#fee2e2', 
                  borderRadius: '0.5rem',
                  color: previewError.includes('not available') ? '#92400e' : '#dc2626',
                  fontSize: '0.875rem',
                  textAlign: 'center'
                }}>
                  {previewError}
                </div>
              ) : previewContent ? (
                <div>
                  <div style={{ 
                    marginBottom: '0.5rem', 
                    fontSize: '0.75rem', 
                    color: '#64748b',
                    fontWeight: 600
                  }}>
                    Preview {['parquet', 'avro', 'pdf'].includes(datasetFormat.toLowerCase()) 
                      ? `(CSV preview of ${datasetFormat.toUpperCase()} format):`
                      : `(${datasetFormat.toUpperCase()} format):`}
                  </div>
                  {(() => {
                    // Determine display format: JSON if original is JSON, otherwise CSV (for preview)
                    const displayFormat = datasetFormat.toLowerCase() === 'json' ? 'json' : 'csv'
                    
                    if (displayFormat === 'json') {
                      return (
                        <pre style={{
                          margin: 0,
                          padding: '1rem',
                          backgroundColor: '#1e293b',
                          borderRadius: '0.5rem',
                          overflowX: 'auto',
                          fontSize: '0.75rem',
                          color: '#e2e8f0',
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {(() => {
                            try {
                              const parsed = JSON.parse(previewContent)
                              return JSON.stringify(parsed, null, 2)
                            } catch (e) {
                              return previewContent
                            }
                          })()}
                        </pre>
                      )
                    } else {
                      // CSV format (or CSV preview for binary formats)
                      return (
                        <pre style={{
                          margin: 0,
                          padding: '1rem',
                          backgroundColor: '#1e293b',
                          borderRadius: '0.5rem',
                          overflowX: 'auto',
                          fontSize: '0.75rem',
                          color: '#e2e8f0',
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {previewContent}
                        </pre>
                      )
                    }
                  })()}
                  {['parquet', 'avro', 'pdf'].includes(datasetFormat.toLowerCase()) && (
                    <div style={{ 
                      marginTop: '0.75rem',
                      padding: '0.75rem', 
                      backgroundColor: '#fef3c7', 
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#92400e'
                    }}>
                      ℹ️ Note: This is a CSV preview. The actual file format is {datasetFormat.toUpperCase()}. Download the file to use the original format.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  Click to load preview
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Usage Instructions */}
      <div style={{
        marginTop: '12px',
        padding: '12px',
        backgroundColor: '#fef3c7',
        borderRadius: '6px',
        fontSize: '13px',
        color: '#92400e',
        border: '1px solid #fbbf24'
      }}>
        <strong>Note:</strong> This dataset is read-only. Copy the file path above and use it in your code to access the data.
      </div>
    </div>
  )
}

