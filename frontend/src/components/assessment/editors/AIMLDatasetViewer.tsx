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
}

export default function DatasetViewer({ questionId, dataset, datasetPath, datasetUrl, testId, userId }: DatasetViewerProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [copiedPath, setCopiedPath] = useState(false)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Get API base URL
  const apiUrl = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || window.location.origin.replace(':3000', ':80'))
    : 'http://localhost:80'

  // Extract testId and userId from datasetUrl or use props
  const getTestIdAndUserId = () => {
    // First, use props if provided
    if (testId && userId) {
      return { testId, userId }
    }
    
    // Otherwise, try to extract from datasetUrl
    if (datasetUrl) {
      try {
        const url = new URL(datasetUrl.startsWith('http') ? datasetUrl : `${apiUrl}${datasetUrl}`)
        const urlTestId = url.searchParams.get('test_id')
        const urlUserId = url.searchParams.get('user_id')
        if (urlTestId && urlUserId) {
          return { testId: urlTestId, userId: urlUserId }
        }
      } catch (e) {
        // Ignore URL parsing errors
      }
    }
    
    return { testId: null, userId: null }
  }

  const { testId: resolvedTestId, userId: resolvedUserId } = getTestIdAndUserId()

  // Construct full API URL from relative path or use provided URL
  const getFullApiUrl = () => {
    if (datasetUrl) {
      // Use provided URL as-is (backend provides correct URL)
      let url = datasetUrl
      // If it's a relative path, construct full URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `${apiUrl}${url.startsWith('/') ? '' : '/'}${url}`
      }
      
      // Only add test_id and user_id if they're missing and we have them from props
      // Don't modify the URL path, only query parameters
      try {
        const urlObj = new URL(url)
        const hasTestId = urlObj.searchParams.has('test_id')
        const hasUserId = urlObj.searchParams.has('user_id')
        if ((!hasTestId || !hasUserId) && resolvedTestId && resolvedUserId) {
          urlObj.searchParams.set('test_id', resolvedTestId)
          urlObj.searchParams.set('user_id', resolvedUserId)
          url = urlObj.toString()
        }
      } catch (e) {
        // If URL parsing fails, continue with original URL
      }
      
      return url
    }
    // Fallback: construct API endpoint URL (only for valid ObjectIds)
    if (dataset) {
      // Check if questionId is a valid MongoDB ObjectId
      // If not, we can't construct the URL (would need datasetUrl to be provided)
      try {
        // Simple check: ObjectIds are 24 hex characters
        const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(questionId)
        if (isValidObjectId) {
          const format = dataset.format || 'csv'
          // Include test_id and user_id if available
          let url = `${apiUrl}/api/v1/aiml/questions/${questionId}/dataset?format=${format}`
          if (resolvedTestId && resolvedUserId) {
            url += `&test_id=${encodeURIComponent(resolvedTestId)}&user_id=${encodeURIComponent(resolvedUserId)}`
          }
          return url
        }
      } catch (e) {
        // Ignore errors
      }
    }
    return null
  }

  const fullApiUrl = getFullApiUrl()
  const datasetFormat = dataset?.format || 'csv'

  // Fetch dataset preview in selected format when preview is shown
  useEffect(() => {
    if (showPreview && !previewContent && !loadingPreview) {
      // Run if we have dataset in memory OR if we have a valid API URL
      const hasDataset = dataset && dataset.schema && Array.isArray(dataset.schema) && dataset.rows && Array.isArray(dataset.rows) && dataset.rows.length > 0
      if (hasDataset || fullApiUrl) {
        fetchDatasetPreview()
      } else {
        // If neither dataset nor URL is available, show error
        setPreviewError('Dataset preview is not available')
        setLoadingPreview(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview, dataset, fullApiUrl])

  const fetchDatasetPreview = async () => {
    setLoadingPreview(true)
    setPreviewError(null)
    
    try {
      // If we have the dataset in memory, use it directly (no API call needed)
      // Check for dataset availability with proper validation
      const hasValidDataset = dataset && 
                             dataset.schema && 
                             Array.isArray(dataset.schema) && 
                             dataset.schema.length > 0 &&
                             dataset.rows && 
                             Array.isArray(dataset.rows) && 
                             dataset.rows.length > 0
      
      if (hasValidDataset) {
        const isBinaryFormat = ['parquet', 'avro', 'pdf'].includes(datasetFormat.toLowerCase())
        const previewFormat = isBinaryFormat ? 'csv' : datasetFormat.toLowerCase()
        
        try {
          // Convert dataset to CSV or JSON format for preview
          if (previewFormat === 'csv') {
            // Generate CSV from dataset
            const headers = dataset.schema.map((col: any) => col.name || col).join(',')
            const rows = dataset.rows.map((row: any) => {
              // Ensure row is an array
              const rowArray = Array.isArray(row) ? row : Object.values(row)
              return rowArray.map((cell: any) => {
                // Escape commas and quotes in CSV
                const cellStr = cell == null ? '' : String(cell)
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                  return `"${cellStr.replace(/"/g, '""')}"`
                }
                return cellStr
              }).join(',')
            }).join('\n')
            setPreviewContent(`${headers}\n${rows}`)
          } else if (previewFormat === 'json') {
            // Generate JSON from dataset
            const data = dataset.rows.map((row: any) => {
              const obj: any = {}
              const rowArray = Array.isArray(row) ? row : Object.values(row)
              dataset.schema.forEach((col: any, idx: number) => {
                const colName = col.name || col
                obj[colName] = idx < rowArray.length ? rowArray[idx] : null
              })
              return obj
            })
            setPreviewContent(JSON.stringify(data, null, 2))
          }
          setLoadingPreview(false)
          return
        } catch (convertError) {
          console.error('Error converting dataset to preview format:', convertError)
          setPreviewError('Failed to generate preview from dataset')
          setLoadingPreview(false)
          return
        }
      }
      
      // Fallback: fetch from API if dataset not available in memory
      if (!fullApiUrl) {
        setPreviewError('Dataset not available')
        setLoadingPreview(false)
        return
      }
      
      // For binary formats (Parquet, Avro, PDF), fetch preview as CSV for readability
      // For CSV and JSON, use the original format
      const isBinaryFormat = ['parquet', 'avro', 'pdf'].includes(datasetFormat.toLowerCase())
      const previewFormat = isBinaryFormat ? 'csv' : datasetFormat.toLowerCase()
      
      // Construct preview URL with format parameter
      let previewUrl = fullApiUrl
      try {
        const url = new URL(fullApiUrl)
        
        // Update format parameter
        url.searchParams.set('format', previewFormat)
        
        // Ensure test_id and user_id are included if the endpoint is /dataset or /dataset-download
        if (url.pathname.includes('/dataset')) {
          if (resolvedTestId && resolvedUserId) {
            url.searchParams.set('test_id', resolvedTestId)
            url.searchParams.set('user_id', resolvedUserId)
          }
        }
        
        previewUrl = url.toString()
      } catch (e) {
        // If URL parsing fails, append format parameter manually
        const separator = fullApiUrl.includes('?') ? '&' : '?'
        previewUrl = `${fullApiUrl}${separator}format=${previewFormat}`
        
        // Also add test_id and user_id if endpoint is /dataset or /dataset-download
        if (fullApiUrl.includes('/dataset')) {
          if (resolvedTestId && resolvedUserId) {
            previewUrl += `&test_id=${encodeURIComponent(resolvedTestId)}&user_id=${encodeURIComponent(resolvedUserId)}`
          }
        }
      }
      
      // Determine response type based on endpoint
      // /dataset returns JSON with { format, content, mime_type }
      // /dataset-download returns raw file content
      const isDownloadEndpoint = previewUrl.includes('/dataset-download')
      const responseType = isDownloadEndpoint ? 'text' : 'json'
      
      const response = await axios.get(previewUrl, {
        responseType: responseType as any,
      })
      
      // Extract content based on endpoint type
      if (isDownloadEndpoint) {
        // /dataset-download returns raw content directly
        setPreviewContent(response.data)
      } else {
        // /dataset returns JSON with content field
        const content = response.data?.content || response.data
        setPreviewContent(typeof content === 'string' ? content : JSON.stringify(content))
      }
    } catch (error: any) {
      console.error('Error fetching dataset preview:', error)
      setPreviewError(error.response?.data?.detail || 'Failed to load dataset preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleCopyPath = () => {
    if (fullApiUrl) {
      navigator.clipboard.writeText(fullApiUrl)
      setCopiedPath(true)
      setTimeout(() => setCopiedPath(false), 2000)
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
            📁 Dataset File Available
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

      {/* File Info */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#1f2937',
              marginBottom: '4px'
            }}>
              {fileName}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              fontFamily: 'monospace',
              backgroundColor: '#f3f4f6',
              padding: '4px 8px',
              borderRadius: '4px',
              display: 'inline-block'
            }}>
              {filePath}
            </div>
          </div>
          <button
            onClick={handleCopyPath}
            style={{
              padding: '6px 12px',
              backgroundColor: copiedPath ? '#10b981' : '#ffffff',
              color: copiedPath ? '#ffffff' : '#10b981',
              border: '1px solid #10b981',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              marginLeft: '12px'
            }}
          >
            {copiedPath ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy Path
              </>
            )}
          </button>
        </div>
        <div style={{
          fontSize: '12px',
          color: '#059669',
          backgroundColor: '#d1fae5',
          padding: '8px 10px',
          borderRadius: '4px',
          marginTop: '8px'
        }}>
          💡 <strong>Tip:</strong> Use the API URL above directly in your code. Example:
          <div style={{ marginTop: '4px', fontFamily: 'monospace', fontSize: '11px', backgroundColor: '#ffffff', padding: '4px 6px', borderRadius: '3px' }}>
            import pandas as pd<br/>
            df = pd.read_{dataset?.format || 'csv'}('{fullApiUrl}')
          </div>
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
                  {previewError.includes('not available') ? 'ℹ️ ' : '⚠️ '}
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
        <strong>📝 Note:</strong> This dataset is read-only. Copy the file path above and use it in your code to access the data.
      </div>
    </div>
  )
}

