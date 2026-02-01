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
  readOnly = false,
}: NotebookCellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editorHeight, setEditorHeight] = useState(300) // Increased initial height for single cell
  const editorRef = useRef<any>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Track latest code synchronously to avoid race conditions with controlled component
  // This ref is ONLY updated in onChange (synchronously) - never from code prop
  // The code prop might be stale during re-renders, so we don't want to overwrite the ref
  const latestCodeRef = useRef<string>(code)
  // Track previous output to detect if we executed stale code
  const previousOutputRef = useRef<string | null>(null)
  
  // IMPORTANT: We do NOT update latestCodeRef from code prop changes
  // This prevents overwriting the ref with stale data when React re-renders with old code prop
  // The ref is only updated synchronously in onChange when user types

  // Debug: Log when code prop changes to detect stale re-renders
  useEffect(() => {
    console.log('[NotebookCell] 🔄 Code prop changed', { 
      cellId, 
      newCodeProp: code?.substring(0, 50), 
      latestCodeRef: latestCodeRef.current?.substring(0, 50),
      areDifferent: code !== latestCodeRef.current,
      codePropLength: code?.length,
      latestCodeRefLength: latestCodeRef.current?.length
    })
  }, [code, cellId])

  // Auto-adjust editor height based on content - increased for single cell
  useEffect(() => {
    if (editorRef.current) {
      const lineCount = code.split('\n').length
      // Increased minimum to 300px and maximum to 1200px for better single cell experience
      const newHeight = Math.max(300, Math.min(lineCount * 19 + 20, 1200))
      setEditorHeight(newHeight)
    }
  }, [code])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const handleRun = useCallback(async () => {
    if (isRunning || readOnly) return

    console.log('[NotebookCell] ▶️ handleRun called', { 
      cellId, 
      codeProp: code?.substring(0, 50), 
      latestCodeRef: latestCodeRef.current?.substring(0, 50),
      codePropLength: code?.length,
      latestCodeRefLength: latestCodeRef.current?.length
    })

    // CRITICAL: Capture code SYNCHRONOUSLY at the moment of button click
    // This must happen BEFORE any async operations to prevent React re-renders
    // from causing Monaco to sync its model back to stale props
    let currentCode = ''
    let codeSource = 'unknown'
    
    // Priority 1: Read directly from Monaco's model (most reliable, bypasses controlled component sync)
    if (editorRef.current) {
      try {
        const model = editorRef.current.getModel()
        if (model) {
          const modelCode = model.getValue()
          console.log('[NotebookCell] 📝 Model code read:', { 
            modelCode: modelCode?.substring(0, 50), 
            modelCodeLength: modelCode?.length 
          })
          if (modelCode !== null && modelCode !== undefined) {
            currentCode = modelCode
            codeSource = 'model'
            // Update ref to keep in sync
            latestCodeRef.current = modelCode
            console.log('[NotebookCell] ✅ Using code from MODEL:', currentCode.substring(0, 50))
          }
        } else {
          console.log('[NotebookCell] Model is null')
        }
      } catch (e) {
        console.warn('[NotebookCell] Failed to read from model:', e)
      }
      
      // Priority 2: Use getValue() if model access failed
      if (!currentCode) {
        try {
          const editorCode = editorRef.current.getValue()
          console.log('[NotebookCell] 📝 Editor getValue() read:', { 
            editorCode: editorCode?.substring(0, 50), 
            editorCodeLength: editorCode?.length 
          })
          if (editorCode !== null && editorCode !== undefined) {
            currentCode = editorCode
            codeSource = 'getValue'
            latestCodeRef.current = editorCode
            console.log('[NotebookCell] ✅ Using code from getValue():', currentCode.substring(0, 50))
          }
        } catch (e) {
          console.warn('[NotebookCell] Failed to read from editor:', e)
        }
      }
    } else {
      console.log('[NotebookCell] editorRef.current is null')
    }
    
    // Priority 3: Use latestCodeRef (updated synchronously in onChange)
    if (!currentCode && latestCodeRef.current) {
      currentCode = latestCodeRef.current
      codeSource = 'latestCodeRef'
      console.log('[NotebookCell] ✅ Using code from latestCodeRef:', currentCode.substring(0, 50))
    }
    
    // Priority 4: Fallback to code prop (last resort)
    if (!currentCode) {
      currentCode = code || ''
      codeSource = 'codeProp'
      if (currentCode) {
        latestCodeRef.current = currentCode
      }
      console.log('[NotebookCell] ⚠️ Using code from code prop (fallback):', currentCode.substring(0, 50))
    }
    
    console.log('[NotebookCell] 🎯 FINAL CODE TO EXECUTE:', { 
      currentCode: currentCode.substring(0, 100), 
      codeSource,
      codeLength: currentCode.length,
      codeProp: code?.substring(0, 100),
      latestCodeRef: latestCodeRef.current?.substring(0, 100),
      codesMatch: currentCode === code,
      codesMatchRef: currentCode === latestCodeRef.current
    })
    
    // Don't run if code is empty
    if (!currentCode.trim()) {
      console.warn('[NotebookCell] Code is empty, not running')
      return
    }

    // Execute with retry logic for empty stdout and stale code issues
    const executeWithRetry = async (codeToExecute: string, isRetry: boolean = false): Promise<any> => {
      const runId = `cell_${cellId}_${Date.now()}_${Math.random().toString(36).substring(7)}${isRetry ? '_retry' : ''}`
      
      if (!isRetry) {
        onRunningChange(cellId, true)
        onOutputChange(cellId, '')
      }

      try {
        console.log(`[NotebookCell] ${isRetry ? '🔄 RETRY' : '🚀'} Executing code:`, { 
          runId, 
          codeLength: codeToExecute.length,
          codePreview: codeToExecute.substring(0, 100),
          sessionId,
          isRetry
        })
        
        const result = await executeCode(codeToExecute, sessionId, runId)
        
        console.log(`[NotebookCell] ${isRetry ? '🔄 RETRY' : '✅'} Execution result:`, { 
          success: result.success, 
          stdoutLength: result.stdout?.length || 0,
          stderrLength: result.stderr?.length || 0,
          hasError: !!result.error,
          imagesCount: result.images?.length || 0,
          isRetry
        })
        
        // Format the output for comparison
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
        if (result.images && result.images.length > 0) {
          result.images.forEach((img: { mime_type: string; data: string }, idx: number) => {
            formattedOutput += `\n__IMAGE_${idx}__:${img.data}`
          })
        }
        const finalOutput = formattedOutput || '(No output)'
        
        // Check if we need to retry: success but empty stdout/stderr and no error
        // This handles the backend timing issue where first execution returns empty stdout
        const isEmptyResult = result.success && 
                             !result.stdout && 
                             !result.stderr && 
                             !result.error && 
                             (result.images?.length || 0) === 0
        
        // Check if output matches previous output (stale code executed)
        // Only check if we have a previous output (not first run) and haven't retried yet
        // Don't retry if both outputs are "(No output)" as that's a legitimate case
        const outputMatchesPrevious = previousOutputRef.current !== null && 
                                     finalOutput === previousOutputRef.current &&
                                     finalOutput !== '(No output)' // Don't retry if both are "no output"
        
        if ((isEmptyResult || outputMatchesPrevious) && !isRetry) {
          console.log('[NotebookCell] ⚠️ Retry condition detected:', {
            isEmptyResult,
            outputMatchesPrevious,
            currentOutput: finalOutput.substring(0, 50),
            previousOutput: previousOutputRef.current?.substring(0, 50)
          })
          // Small delay before retry to ensure Monaco has synced and kernel is ready
          await new Promise(resolve => setTimeout(resolve, 150))
          // Retry with the same code (Monaco should have synced by now)
          return await executeWithRetry(codeToExecute, true)
        }
        
        // Store the output for next comparison (only on successful non-retry execution)
        if (!isRetry && result.success) {
          previousOutputRef.current = finalOutput
        }
        
        return result
      } catch (error: any) {
        // Only retry on timeout or connection errors, not on code errors
        if (!isRetry && (error.message?.includes('timeout') || error.message?.includes('Not connected'))) {
          console.log('[NotebookCell] ⚠️ Connection/timeout error, retrying execution...')
          await new Promise(resolve => setTimeout(resolve, 200))
          return await executeWithRetry(codeToExecute, true)
        }
        throw error
      }
    }

    try {
      const result = await executeWithRetry(currentCode)
      
      // Format output (executeWithRetry already formats it, but we need to format again for display)
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
        result.images.forEach((img: { mime_type: string; data: string }, idx: number) => {
          formattedOutput += `\n__IMAGE_${idx}__:${img.data}`
        })
      }

      const finalOutput = formattedOutput || '(No output)'
      console.log('[NotebookCell] Setting output:', { 
        cellId, 
        outputLength: finalOutput.length,
        outputPreview: finalOutput.substring(0, 100)
      })
      onOutputChange(cellId, finalOutput)
      
      // Update previous output ref after successful execution (for next comparison)
      // Note: executeWithRetry already updates this, but we update here too for consistency
      if (result.success) {
        previousOutputRef.current = finalOutput
      }
      
      // Update previous output ref after successful execution (for next comparison)
      if (result.success) {
        previousOutputRef.current = finalOutput
      }
    } catch (error: any) {
      console.error('[NotebookCell] Execution error:', { cellId, error: error.message, errorStack: error.stack })
      onOutputChange(cellId, `Error: ${error.message}`)
    } finally {
      console.log('[NotebookCell] Execution finished, setting running to false', { cellId })
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
    // Initialize ref with current editor content
    latestCodeRef.current = editor.getValue() || code

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
          <div className="relative overflow-x-auto">
            <MonacoEditor
              height={editorHeight}
              language="python"
              value={code}
              onChange={(value) => {
                const newCode = value || ''
                console.log('[NotebookCell] ⌨️ onChange fired', { 
                  cellId, 
                  newCode: newCode.substring(0, 50), 
                  newCodeLength: newCode.length,
                  oldLatestCodeRef: latestCodeRef.current?.substring(0, 50),
                  oldLatestCodeRefLength: latestCodeRef.current?.length
                })
                // Update ref synchronously to avoid race conditions
                // This ref is the source of truth and is never overwritten by stale props
                latestCodeRef.current = newCode
                console.log('[NotebookCell] ✅ latestCodeRef updated to:', latestCodeRef.current.substring(0, 50))
                // Update parent state (async)
                onCodeChange(cellId, newCode)
              }}
              onMount={handleEditorMount}
              theme="vs"
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                fontSize: 14,
                fontFamily: "'Fira Code', 'Courier New', monospace",
                wordWrap: 'off', // Disable word wrap - lines will scroll horizontally instead of wrapping
                automaticLayout: true,
                scrollbar: {
                  vertical: 'auto',
                  horizontal: 'visible', // Always show horizontal scrollbar for long lines
                  horizontalScrollbarSize: 12,
                },
                rulers: [], // Disable vertical ruler/guide lines
                renderWhitespace: 'none', // Don't show whitespace markers
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

      {/* Cell Menu */}
      {!readOnly && (
        <div className="flex-shrink-0 relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-gray-600"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[150px]">
              <button
                onClick={() => {
                  onMoveUp(cellId)
                  setMenuOpen(false)
                }}
                disabled={!canMoveUp}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Move Up
              </button>
              <button
                onClick={() => {
                  onMoveDown(cellId)
                  setMenuOpen(false)
                }}
                disabled={!canMoveDown}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Move Down
              </button>
              <div className="border-t border-gray-200 my-1" />
              <button
                onClick={() => {
                  onDelete(cellId)
                  setMenuOpen(false)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Cell
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

