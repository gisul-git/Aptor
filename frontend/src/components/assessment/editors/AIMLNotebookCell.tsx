'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { executeCode, connect } from './agentClient'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 animate-pulse rounded" />,
})

interface NotebookCellProps {
  cellId: string
  code: string
  output?: string
  cellIndex: number
  sessionId?: string
  onCodeChange: (code: string) => void
  onOutputChange: (cellId: string, output: string | undefined) => void
  onDelete?: () => void
  onFocus?: () => void
  autoFocus?: boolean
  readOnly?: boolean
}

function renderOutput(output: string) {
  if (!output || output.trim() === '') {
    return null
  }

  // Check for images
  if (output.includes('[Image: data:image/png;base64,')) {
    const parts = output.split('[Image: data:image/png;base64,')
    return (
      <>
        {parts.map((part, idx) => {
          if (idx === 0) {
            return part && part.trim() ? (
              <div key="text-0" className="whitespace-pre-wrap font-mono text-sm">
                {part}
              </div>
            ) : null
          }
          const [imgData, ...rest] = part.split(']\n')
          const textAfter = rest.join(']\n')
          return (
            <div key={`img-${idx}`} className="my-2">
              <img 
                src={`data:image/png;base64,${imgData}`} 
                alt="Output" 
                className="max-w-full bg-white rounded shadow-sm" 
              />
              {textAfter && textAfter.trim() && (
                <div className="whitespace-pre-wrap font-mono text-sm mt-2">
                  {textAfter}
                </div>
              )}
            </div>
          )
        })}
      </>
    )
  }
  
  // Check if it's an error
  const isError = output.includes('[error]') || output.includes('[stderr]') || output.includes('Error:') || output.includes('Traceback')
  
  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-3">
        <pre className="text-red-600 text-sm whitespace-pre-wrap font-mono">{output}</pre>
      </div>
    )
  }
  
  return (
    <div className="bg-gray-50 rounded p-3">
      <pre className="text-gray-800 text-sm whitespace-pre-wrap font-mono">{output}</pre>
    </div>
  )
}

export default function NotebookCell({
  cellId,
  code,
  output,
  cellIndex,
  sessionId = 'default',
  onCodeChange,
  onOutputChange,
  onDelete,
  onFocus,
  autoFocus = false,
  readOnly = false,
}: NotebookCellProps) {
  const [running, setRunning] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const editorRef = useRef<any>(null)
  const currentRunIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (autoFocus && editorRef.current) {
      setTimeout(() => {
        editorRef.current?.focus()
      }, 200)
    }
  }, [autoFocus, cellId])

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      padding: { top: 12, bottom: 12 },
      wordWrap: 'on',
      theme: 'vs',
      renderLineHighlight: 'line',
      readOnly: readOnly,
      contextmenu: true,
      quickSuggestions: true,
    })
    
    const editorElement = editor.getContainerDomNode()
    if (editorElement) {
      editorElement.style.pointerEvents = 'auto'
    }
    
    // Auto-resize
    const updateHeight = () => {
      const contentHeight = editor.getContentHeight()
      const minHeight = 100
      const maxHeight = 500
      const newHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight)
      editorElement.style.height = `${newHeight}px`
      editor.layout()
    }
    
    editor.onDidChangeModelContent(() => updateHeight())
    setTimeout(updateHeight, 100)
    
    if (autoFocus) {
      setTimeout(() => editor.focus(), 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey && !running && !readOnly) {
      e.preventDefault()
      if (code.trim()) {
        handleRun()
      }
    }
  }

  const handleRun = async () => {
    if (running || !code.trim() || readOnly) return

    const runId = `cell_${cellId}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    currentRunIdRef.current = runId
    
    onOutputChange(cellId, undefined)
    setRunning(true)

    try {
      await connect()
      const result = await executeCode(code, sessionId, runId)

      if (currentRunIdRef.current === runId) {
        let formattedOutput = ''
        
        if (result.stdout) formattedOutput += result.stdout
        if (result.stderr) formattedOutput += formattedOutput ? `\n[stderr]\n${result.stderr}` : result.stderr
        
        if (result.error) {
          formattedOutput += formattedOutput ? '\n[error]\n' : ''
          formattedOutput += `${result.error.type}: ${result.error.value}`
          if (result.error.traceback?.length > 0) {
            formattedOutput += `\n${result.error.traceback.join('\n')}`
          }
        }
        
        if (result.images?.length > 0) {
          result.images.forEach((imgObj: { mime_type: string; data: string }) => {
            formattedOutput += `\n[Image: data:${imgObj.mime_type};base64,${imgObj.data}]\n`
          })
        }
        
        onOutputChange(cellId, formattedOutput || '')
      }
    } catch (error) {
      if (currentRunIdRef.current === runId) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        onOutputChange(cellId, `Error: ${errorMessage}`)
      }
    } finally {
      if (currentRunIdRef.current === runId) {
        currentRunIdRef.current = null
        setRunning(false)
      }
    }
  }

  return (
    <div 
      className="relative mb-3 bg-white rounded-lg border-2 border-emerald-200 shadow-sm hover:shadow-md transition-shadow"
      onClick={onFocus}
    >
      <div className="flex items-start">
        {/* Left side: Cell number and Run button */}
        <div className="flex items-start pt-3 pl-3">
          <div className="text-emerald-600 text-sm font-mono mr-2 min-w-[32px] text-right font-semibold">
            [{cellIndex + 1}]
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (!running && code.trim() && !readOnly) handleRun()
            }}
            disabled={running || !code.trim() || readOnly}
            className="p-2 rounded-lg hover:bg-emerald-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1 border border-emerald-200"
            title={running ? "Running..." : "Run cell (Shift+Enter)"}
          >
            {running ? (
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            )}
          </button>
        </div>

        {/* Editor area */}
        <div className="flex-1 min-w-0 py-2 pr-3">
          <div onKeyDown={handleKeyDown}>
            <MonacoEditor
              height="auto"
              language="python"
              value={code}
              onChange={(value) => onCodeChange(value || '')}
              onMount={handleEditorDidMount}
              theme="vs"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                wordWrap: 'on',
                renderLineHighlight: 'line',
                readOnly: readOnly,
              }}
            />
          </div>

          {/* Running indicator */}
          {running && (
            <div className="px-4 py-2 text-sm text-emerald-600 bg-emerald-50 border-t border-emerald-100 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              Executing...
            </div>
          )}

          {/* Output area */}
          {!running && output && output.trim() !== '' && (
            <div className="border-t border-emerald-100 bg-white px-4 py-3 mt-2">
              {renderOutput(output)}
            </div>
          )}
        </div>

        {/* Right side: Cell menu */}
        {onDelete && !readOnly && (
          <div className="relative pt-3 pr-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="Cell options"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center rounded-lg"
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Delete Cell
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

