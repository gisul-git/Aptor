/**
 * AIML Competency Notebook Cell - Individual code execution cell
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { executeCode } from './agentClient'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 animate-pulse rounded" />,
})

interface NotebookCellProps {
  cellId: string
  code: string
  output?: string
  isRunning: boolean
  cellIndex: number
  onCodeChange: (cellId: string, code: string) => void
  onRun: (cellId: string) => void
  onDelete: (cellId: string) => void
  onMoveUp: (cellId: string) => void
  onMoveDown: (cellId: string) => void
  onOutputChange: (cellId: string, output: string) => void
  onRunningChange: (cellId: string, isRunning: boolean) => void
  onFocus: (cellId: string) => void
  autoFocus?: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  sessionId: string
  onRegisterRun?: (cellId: string, runFn: () => Promise<void>) => void
  onEditorReady?: (cellId: string, insertText: (text: string) => void) => void
  readOnly?: boolean
}

declare global {
  interface Window {
    // Monaco editor is attached to window by @monaco-editor/react at runtime
    monaco: any
  }
}

export default function NotebookCell({
  cellId,
  code,
  output,
  isRunning,
  cellIndex,
  onCodeChange,
  onRun,
  onDelete,
  onMoveUp,
  onMoveDown,
  onOutputChange,
  onRunningChange,
  onFocus,
  autoFocus,
  canMoveUp,
  canMoveDown,
  sessionId,
  onRegisterRun,
  onEditorReady,
  readOnly = false,
}: NotebookCellProps) {
  const [editorHeight, setEditorHeight] = useState(80)
  const editorRef = useRef<any>(null)

  // Auto-adjust editor height based on content
  useEffect(() => {
    if (editorRef.current) {
      const lineCount = code.split('\n').length
      const newHeight = Math.max(80, Math.min(lineCount * 19 + 20, 800))
      setEditorHeight(newHeight)
    }
  }, [code])

  const handleRun = useCallback(async () => {
    if (isRunning || readOnly) return

    const runId = `cell_${cellId}_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    onRunningChange(cellId, true)
    onOutputChange(cellId, '')
    
    try {
      const result = await executeCode(code, sessionId, runId)
      
      let formattedOutput = ''
      
      if (result.stdout) {
        formattedOutput += result.stdout
      }
      
      if (result.stderr) {
        formattedOutput += `\n${result.stderr}`
      }
      
      if (result.error) {
        formattedOutput += `\n\nError: ${result.error.type}: ${result.error.value}\n`
        if (result.error.traceback) {
          formattedOutput += result.error.traceback.join('\n')
        }
      }
      
      // Handle images
      if (result.images && result.images.length > 0) {
        result.images.forEach((img, idx) => {
          formattedOutput += `\n__IMAGE_${idx}__:${img.data}`
        })
      }
      
      onOutputChange(cellId, formattedOutput || '(No output)')
    } catch (error: any) {
      onOutputChange(cellId, `Error: ${error.message}`)
    } finally {
      onRunningChange(cellId, false)
    }
  }, [cellId, code, sessionId, isRunning, onOutputChange, onRunningChange, readOnly])

  // Register run function for "Run All"
  useEffect(() => {
    if (onRegisterRun) {
      onRegisterRun(cellId, handleRun)
    }
  }, [cellId, handleRun, onRegisterRun])

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor

    // Shift+Enter to run and create new cell
    editor.addCommand(
      window.monaco.KeyMod.Shift | window.monaco.KeyCode.Enter,
      () => {
        if (!readOnly) {
          handleRun()
          onRun(cellId)
        }
      }
    )

    // Expose insert text function to parent
    if (onEditorReady) {
      const insertText = (text: string) => {
        if (!editor) return
        
        const selection = editor.getSelection()
        if (selection) {
          // Insert at cursor position
          const range = new window.monaco.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn
          )
          editor.executeEdits('insert-text', [{
            range,
            text
          }])
        } else {
          // No cursor position, append to end
          const model = editor.getModel()
          if (model) {
            const lineCount = model.getLineCount()
            const lastLineLength = model.getLineLength(lineCount)
            const range = new window.monaco.Range(
              lineCount,
              lastLineLength + 1,
              lineCount,
              lastLineLength + 1
            )
            editor.executeEdits('insert-text', [{
              range,
              text
            }])
          }
        }
        // Focus editor after insertion
        editor.focus()
      }
      onEditorReady(cellId, insertText)
    }

    if (autoFocus) {
      editor.focus()
    }
  }

  const renderOutput = () => {
    if (!output) return null

    const parts = output.split(/\n?__IMAGE_(\d+)__:/g)
    const elements: JSX.Element[] = []

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Text content
        if (parts[i].trim()) {
          elements.push(
            <pre
              key={`text-${i}`}
              className="text-sm font-mono whitespace-pre-wrap break-words text-gray-800"
            >
              {parts[i]}
            </pre>
          )
        }
      } else {
        // Image
        const imageData = parts[i + 1]
        if (imageData) {
          elements.push(
            <img
              key={`img-${i}`}
              src={`data:image/png;base64,${imageData}`}
              alt="Output"
              className="max-w-full h-auto my-2 rounded border border-gray-200"
            />
          )
          i++ // Skip next part as it's the image data
        }
      }
    }

    return elements.length > 0 ? elements : null
  }

  return (
    <div
      className="group relative flex gap-2 mb-3"
      onFocus={() => onFocus(cellId)}
    >
      {/* Cell Number and Run Button */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-2">
        <span className="text-xs text-gray-500 font-mono">[{cellIndex}]</span>
        <button
          onClick={handleRun}
          disabled={isRunning || readOnly}
          className="w-8 h-8 rounded-full bg-white border-2 border-emerald-500 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors group-hover:border-emerald-600"
          title="Run cell (Shift+Enter)"
        >
          {isRunning ? (
            <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Cell Content */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          {/* Editor */}
          <div className="relative">
            <MonacoEditor
              height={editorHeight}
              language="python"
              value={code}
              onChange={(value) => onCodeChange(cellId, value || '')}
              onMount={handleEditorMount}
              theme="vs"
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                fontSize: 14,
                fontFamily: "'Fira Code', 'Courier New', monospace",
                wordWrap: 'on',
                automaticLayout: true,
                scrollbar: {
                  vertical: 'auto',
                  horizontal: 'auto',
                },
                readOnly: readOnly,
              }}
            />
          </div>

          {/* Output */}
          {output && (
            <div className="border-t border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-600 mb-2 font-semibold">Output:</div>
              <div className="bg-white rounded border border-gray-200 p-3 max-h-96 overflow-auto">
                {renderOutput()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Cell Button */}
      {!readOnly && (
        <div className="flex-shrink-0">
          <button
            onClick={() => onDelete(cellId)}
            className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center text-red-600 hover:text-red-700 transition-colors"
            title="Delete cell"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

