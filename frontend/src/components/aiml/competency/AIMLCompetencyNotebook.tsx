/**
 * AIML Competency Notebook - Main notebook interface for AIML test taking
 * Based on competency/frontend/components/EnhancedNotebook.tsx
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import NotebookCell from './NotebookCell'
import { connect, interruptKernel, restartKernel, isConnected, executeCode } from './agentClient'
import DatasetViewer from './DatasetViewer'

interface Cell {
  id: string
  code: string
  output?: string
}

interface AIMLQuestion {
  id: string
  title: string
  description: string
  library?: string
  starter_code?: Record<string, string>
  tasks?: Array<string | { id: string; title: string; description: string }>  // Support both string and object format
  public_testcases?: Array<{ input: string; expected_output: string }>
  dataset?: {
    schema: Array<{ name: string; type: string }>
    rows: any[]
    format?: string
  }
  dataset_path?: string
  dataset_url?: string
  requires_dataset?: boolean
}

interface AIMLCompetencyNotebookProps {
  question: AIMLQuestion
  sessionId: string
  onCodeChange?: (allCode: string) => void
  onOutputChange?: (outputs: string[]) => void
  onSubmit?: (allCode: string, outputs: string[]) => void
  readOnly?: boolean
  showSubmit?: boolean
}

export default function AIMLCompetencyNotebook({
  question,
  sessionId,
  onCodeChange,
  onOutputChange,
  onSubmit,
  readOnly = false,
  showSubmit = true,
}: AIMLCompetencyNotebookProps) {
  const [cells, setCells] = useState<Cell[]>([])
  const [runningCells, setRunningCells] = useState<Set<string>>(new Set())
  const [focusedCellId, setFocusedCellId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [showQuestion, setShowQuestion] = useState(true)
  const [showRestartModal, setShowRestartModal] = useState(false)
  const [restartMessage, setRestartMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [pendingOutputSync, setPendingOutputSync] = useState<string[] | null>(null)
  
  const nextCellIdRef = useRef(1)
  const cellRunFunctionsRef = useRef<Map<string, () => Promise<void>>>(new Map())
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const fullWidthPanelRef = useRef<HTMLDivElement>(null)
  const kernelWarmedUpRef = useRef(false)
  const firstCellInsertTextRef = useRef<((text: string) => void) | null>(null)

  // Initialize cells with starter code
  const questionIdRef = useRef<string | null>(null)
  
  useEffect(() => {
    // Only initialize if question changed and cells are empty
    if (question && question.id !== questionIdRef.current && cells.length === 0) {
      questionIdRef.current = question.id
      
      // Debug logging
      console.log('[AIMLNotebook] Question loaded:', {
        id: question.id,
        title: question.title,
        hasTasks: !!question.tasks,
        tasksCount: question.tasks?.length || 0,
        hasDataset: !!question.dataset,
        datasetPath: question.dataset_path,
        requiresDataset: question.requires_dataset
      })
      
      const starterCode = question.starter_code?.python3 || 
        question.starter_code?.python || 
        generateStarterCode(question)
      
      const initialCells: Cell[] = [
        {
          id: 'cell-1',
          code: starterCode,
          output: undefined,
        }
      ]
      
      setCells(initialCells)
      setFocusedCellId('cell-1')
      nextCellIdRef.current = 2
    }
  }, [question?.id, cells.length])

  // Auto-connect to kernel on component mount and warm up the kernel
  useEffect(() => {
    let isMounted = true
    let interval: NodeJS.Timeout | null = null
    
    const warmupKernel = async () => {
      // Only warmup once per component lifecycle
      if (kernelWarmedUpRef.current) {
        return
      }
      
      try {
        // Send a simple no-op command (pass statement) to initialize the kernel session
        // This ensures the kernel is ready before the first real execution
        const warmupResult = await executeCode('pass  # Kernel initialization', sessionId, `warmup_${Date.now()}`)
        
        // Verify warmup completed successfully
        if (warmupResult && warmupResult.success !== false) {
          // Add a delay to ensure kernel session is fully stabilized
          // This gives the backend time to fully initialize the kernel session
          await new Promise(resolve => setTimeout(resolve, 500))
          
          kernelWarmedUpRef.current = true
          console.log('[AIMLNotebook] Kernel warmed up and ready for session:', sessionId)
        } else {
          throw new Error('Warmup execution returned failure')
        }
      } catch (error) {
        console.warn('[AIMLNotebook] Kernel warmup failed (non-critical):', error)
        // Warmup failure is not critical - kernel might still work
        // Don't set warmedUpRef to true so we can retry on next connection
      }
    }
    
    const attemptConnection = async () => {
      try {
        // Check if already connected
        if (isConnected()) {
          // If already connected, check if we need to warmup
          if (!kernelWarmedUpRef.current) {
            await warmupKernel()
          }
          
          if (isMounted) {
            setConnected(true)
          }
          return
        }
        
        // Attempt to connect
        await connect()
        
        // After connection, warm up the kernel with a simple command
        // This ensures the kernel session is initialized and ready
        await warmupKernel()
        
        if (isMounted) {
          setConnected(true)
          console.log('[AIMLNotebook] Successfully connected and warmed up Python kernel')
        }
      } catch (error) {
        console.error('[AIMLNotebook] Failed to connect to kernel:', error)
        if (isMounted) {
          setConnected(false)
          // Reset warmup flag on connection failure so we retry warmup on reconnect
          kernelWarmedUpRef.current = false
          // Retry connection after a delay
          interval = setTimeout(() => {
            attemptConnection()
          }, 3000) // Retry every 3 seconds
        }
      }
    }
    
    // Initial connection attempt
    attemptConnection()
    
    // Also check connection status periodically to handle disconnections
    const statusCheckInterval = setInterval(() => {
      if (isMounted) {
        const currentlyConnected = isConnected()
        setConnected(currentlyConnected)
        
        // If disconnected, attempt to reconnect
        if (!currentlyConnected) {
          // Reset warmup flag on disconnect so we warmup again on reconnect
          kernelWarmedUpRef.current = false
          attemptConnection()
        }
      }
    }, 5000) // Check every 5 seconds
    
    return () => {
      isMounted = false
      if (interval) {
        clearTimeout(interval)
      }
      clearInterval(statusCheckInterval)
    }
  }, [sessionId]) // Include sessionId in deps

  // Notify parent of code changes (only when code actually changes)
  const previousCodeRef = useRef<string>('')
  const onCodeChangeRef = useRef(onCodeChange)
  
  // Update ref when onCodeChange changes
  useEffect(() => {
    onCodeChangeRef.current = onCodeChange
  }, [onCodeChange])
  
  useEffect(() => {
    const allCode = cells.map(c => c.code).join('\n\n# --- Next Cell ---\n\n')
    // Only call onCodeChange if the code actually changed
    if (allCode !== previousCodeRef.current) {
      previousCodeRef.current = allCode
      if (onCodeChangeRef.current) {
        onCodeChangeRef.current(allCode)
      }
    }
  }, [cells])

  // Sync outputs to parent after render (avoids React warning about updating during render)
  useEffect(() => {
    if (pendingOutputSync !== null && onOutputChange) {
      console.log(`%c[NOTEBOOK] 🟢 Syncing outputs to parent (deferred)`, 'color: #00aa00; font-weight: bold; font-size: 14px', {
        outputsCount: pendingOutputSync.length,
        outputs: pendingOutputSync.map((o, idx) => ({ index: idx, length: o.length, preview: o.substring(0, 50) }))
      })
      onOutputChange(pendingOutputSync)
      setPendingOutputSync(null)
    }
  }, [pendingOutputSync, onOutputChange]) // Only depend on cells, not onCodeChange


  const generateStarterCode = (q: AIMLQuestion): string => {
    const lib = q.library || 'numpy'
    const alias = lib === 'numpy' ? 'np' : lib === 'pandas' ? 'pd' : lib === 'matplotlib' ? 'plt' : lib
    
    let code = `# ${q.title}\n# ${q.description?.substring(0, 100)}${q.description && q.description.length > 100 ? '...' : ''}\n\n`
    code += `import ${lib} as ${alias}\n`
    
    if (lib === 'matplotlib' || lib === 'pandas') {
      code += `import matplotlib.pyplot as plt\n`
    }
    
    code += `\n# Your solution here\n`
    
    if (q.tasks && q.tasks.length > 0) {
      code += `\n# Tasks:\n`
      q.tasks.forEach((task, idx) => {
        // Handle both string and object format
        const taskText = typeof task === 'string' ? task : task.title;
        code += `# ${idx + 1}. ${taskText}\n`
      })
    }
    
    return code
  }

  const addCell = useCallback(() => {
    const newCell: Cell = {
      id: `cell-${nextCellIdRef.current++}`,
      code: '',
      output: undefined,
    }
    setCells(prev => [...prev, newCell])
    setFocusedCellId(newCell.id)
  }, [])

  const deleteCell = useCallback((cellId: string) => {
    setCells(prev => {
      if (prev.length <= 1) return prev
      return prev.filter(c => c.id !== cellId)
    })
  }, [])

  const moveCellUp = useCallback((cellId: string) => {
    setCells(prev => {
      const idx = prev.findIndex(c => c.id === cellId)
      if (idx <= 0) return prev
      
      const newCells = [...prev]
      ;[newCells[idx - 1], newCells[idx]] = [newCells[idx], newCells[idx - 1]]
      return newCells
    })
  }, [])

  const moveCellDown = useCallback((cellId: string) => {
    setCells(prev => {
      const idx = prev.findIndex(c => c.id === cellId)
      if (idx === -1 || idx >= prev.length - 1) return prev
      
      const newCells = [...prev]
      ;[newCells[idx], newCells[idx + 1]] = [newCells[idx + 1], newCells[idx]]
      return newCells
    })
  }, [])

  const handleCodeChange = useCallback((cellId: string, code: string) => {
    setCells(prev => prev.map(c => c.id === cellId ? { ...c, code } : c))
  }, [])

  const handleOutputChange = useCallback((cellId: string, output: string) => {
    const isClearing = !output || output === ''
    console.log(`%c[NOTEBOOK] ${isClearing ? '🟠' : '🔵'} Cell output changed`, 
      isClearing ? 'color: #ff6600; font-weight: bold; font-size: 14px' : 'color: #0066ff; font-weight: bold; font-size: 14px', {
      cellId,
      outputLength: output?.length || 0,
      hasOutput: !!output && output !== '',
      isClearing,
      outputPreview: output?.substring(0, 100) || '(empty)',
      allCellsBefore: 'checking...'
    })
    
    setCells(prev => {
      // Log all cells BEFORE update
      console.log('%c[NOTEBOOK] 📋 Cells state BEFORE update', 'color: #9966ff; font-weight: bold; font-size: 12px', {
        totalCells: prev.length,
        cells: prev.map(c => ({
          id: c.id,
          hasOutput: !!c.output && c.output !== '',
          outputLength: c.output?.length || 0,
          outputPreview: c.output?.substring(0, 30) || '(none)'
        }))
      })
      
      const updatedCells = prev.map(c => c.id === cellId ? { ...c, output } : c)
      
      // Log all cells AFTER update
      console.log('%c[NOTEBOOK] 📋 Cells state AFTER update', 'color: #9966ff; font-weight: bold; font-size: 12px', {
        totalCells: updatedCells.length,
        updatedCellId: cellId,
        cells: updatedCells.map(c => ({
          id: c.id,
          hasOutput: !!c.output && c.output !== '',
          outputLength: c.output?.length || 0,
          outputPreview: c.output?.substring(0, 30) || '(none)'
        }))
      })
      
      // Schedule output sync after render to avoid React warning
      // This ensures outputs are available in parent state when time expires
      if (onOutputChange) {
        const allOutputs = updatedCells.map(c => c.output || '').filter(o => o && o !== '' && o !== '(No output)')
        console.log(`%c[NOTEBOOK] ${allOutputs.length > 0 ? '🟢' : '🟠'} Scheduling output sync to parent`, 
          allOutputs.length > 0 ? 'color: #00aa00; font-weight: bold; font-size: 14px' : 'color: #ff6600; font-weight: bold; font-size: 14px', {
          totalCells: updatedCells.length,
          cellsWithOutput: allOutputs.length,
          isClearing,
          allOutputs: allOutputs.map((o, idx) => ({ 
            index: idx, 
            length: o.length, 
            preview: o.substring(0, 50),
            isNoOutput: o === '(No output)'
          })),
          rawCellsOutputs: updatedCells.map(c => ({
            id: c.id,
            output: c.output || '(none)',
            isEmpty: !c.output || c.output === ''
          }))
        })
        
        // Only sync if we have actual outputs (not when clearing)
        if (allOutputs.length > 0 || isClearing) {
          // Defer to next tick to avoid updating parent during render
          setPendingOutputSync(allOutputs)
        } else {
          console.log('%c[NOTEBOOK] ⏭️ Skipping sync - no valid outputs', 'color: #ff6600; font-weight: bold; font-size: 12px')
        }
      } else {
        console.log('%c[NOTEBOOK] ⚠️ onOutputChange callback not provided!', 'color: #ff6600; font-weight: bold; font-size: 14px')
      }
      
      return updatedCells
    })
  }, [onOutputChange])

  const handleRunningChange = useCallback((cellId: string, isRunning: boolean) => {
    setRunningCells(prev => {
      const newSet = new Set(prev)
      if (isRunning) {
        newSet.add(cellId)
      } else {
        newSet.delete(cellId)
      }
      return newSet
    })
  }, [])

  // Handle editor ready callback - store insert function for first cell
  const handleEditorReady = useCallback((cellId: string, insertText: (text: string) => void) => {
    // Store insert function for the first cell (cell-1)
    if (cellId === 'cell-1') {
      firstCellInsertTextRef.current = insertText
    }
  }, [])

  const handleRunAll = async () => {
    if (isRunningAll) return
    
    setIsRunningAll(true)
    try {
      const cellsWithCode = cells.filter(c => c.code.trim())
      
      for (const cell of cellsWithCode) {
        const runFn = cellRunFunctionsRef.current.get(cell.id)
        if (runFn) {
          await runFn()
          
          // Wait for cell to finish running
          while (runningCells.has(cell.id)) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          
          // Small delay between cells
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
    } finally {
      setIsRunningAll(false)
    }
  }

  const handleInterrupt = async () => {
    try {
      await interruptKernel(sessionId)
      runningCells.forEach(cellId => {
        handleRunningChange(cellId, false)
        handleOutputChange(cellId, 'Execution interrupted by user')
      })
    } catch (err: any) {
      console.error('Failed to interrupt:', err)
    }
  }

  const handleRestart = async () => {
    setShowRestartModal(true)
  }

  const confirmRestart = async () => {
    setShowRestartModal(false)
    setRestartMessage(null)
    
    try {
      await restartKernel(sessionId)
      setCells(prev => prev.map(c => ({ ...c, output: undefined })))
      // Reset warmup flag so kernel warms up again after restart
      kernelWarmedUpRef.current = false
      
      // Show success message
      setRestartMessage({ type: 'success', text: 'Kernel restarted successfully' })
      
      // Auto-hide message after 3 seconds
      setTimeout(() => {
        setRestartMessage(null)
      }, 3000)
      
      // Re-warmup the kernel after restart
      if (isConnected()) {
        const warmupKernelAfterRestart = async () => {
          try {
            const warmupResult = await executeCode('pass  # Kernel initialization', sessionId, `warmup_${Date.now()}`)
            if (warmupResult && warmupResult.success !== false) {
              await new Promise(resolve => setTimeout(resolve, 500))
              kernelWarmedUpRef.current = true
              console.log('[AIMLNotebook] Kernel warmed up after restart')
            }
          } catch (error) {
            console.warn('[AIMLNotebook] Kernel warmup after restart failed:', error)
          }
        }
        warmupKernelAfterRestart()
      }
    } catch (err: any) {
      console.error('Failed to restart:', err)
      setRestartMessage({ type: 'error', text: 'Failed to restart kernel' })
      
      // Auto-hide error message after 5 seconds
      setTimeout(() => {
        setRestartMessage(null)
      }, 5000)
    }
  }

  const cancelRestart = () => {
    setShowRestartModal(false)
  }

  const handleSubmitAll = () => {
    if (!onSubmit) return
    
    const allCode = cells.map(c => c.code).join('\n\n')
    const allOutputs = cells.map(c => c.output || '').filter(o => o)
    onSubmit(allCode, allOutputs)
  }

  const registerCellRun = useCallback((cellId: string, runFn: () => Promise<void>) => {
    cellRunFunctionsRef.current.set(cellId, runFn)
  }, [])

  const anyRunning = runningCells.size > 0

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Connection Status */}
      {!connected && (
        <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          Connecting to Python kernel...
        </div>
      )}

      {/* Restart Kernel Confirmation Modal */}
      {showRestartModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={cancelRestart}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Restart Kernel?</h3>
            <p className="text-sm text-gray-600 mb-6">
              All variables and state will be lost. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelRestart}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestart}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Restart Kernel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Panel with Side-by-Side Layout */}
      {showQuestion && question && (
        <div className="bg-white border-b border-gray-200 shadow-sm flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{question.title}</h2>
              {question.library && (
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                  {question.library}
                </span>
              )}
            </div>
          </div>
          
          {/* Side-by-Side Layout: Description Panel (Left) + Notebook Cells (Right) */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column - Description Panel */}
            <div 
              ref={leftPanelRef}
              className="flex-1 overflow-y-auto px-6 py-4 border-r border-gray-200"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                height: '100%'
              }}
              onWheel={(e) => {
                // Prevent Lenis from intercepting wheel events for this container
                const element = leftPanelRef.current
                if (element) {
                  const target = e.target as HTMLElement
                  // Skip if event is from an interactive element (Monaco editor, input, etc.)
                  if (target.closest('.monaco-editor') || target.closest('input') || target.closest('textarea')) {
                    return
                  }
                  
                  e.stopPropagation()
                  const { scrollTop, scrollHeight, clientHeight } = element
                  const isAtTop = scrollTop <= 0
                  const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5
                  
                  // If scrolling within bounds, handle it manually
                  if ((e.deltaY > 0 && !isAtBottom) || (e.deltaY < 0 && !isAtTop)) {
                    e.preventDefault()
                    element.scrollBy({
                      top: e.deltaY,
                      behavior: 'auto'
                    })
                  }
                }
              }}
            >
              {/* Description Text */}
              <div className="mb-4">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{question.description}</p>
              </div>
              
              {/* Tasks Section - Always Visible */}
              {question.tasks && question.tasks.length > 0 && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Tasks:</h3>
                  <ol className="list-decimal list-inside space-y-2">
                    {question.tasks.map((task, idx) => {
                      // Handle both string format and object format
                      const taskText = typeof task === 'string' ? task : task.title;
                      const taskDesc = typeof task === 'string' ? '' : task.description;
                      
                      return (
                        <li key={typeof task === 'object' ? task.id : idx} className="text-blue-800">
                          <span className="font-medium">{taskText || `Task ${idx + 1}`}</span>
                          {taskDesc && (
                            <p className="ml-6 text-sm text-blue-700 mt-1">{taskDesc}</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
              
              {/* Dataset Viewer - Always Visible Below Tasks */}
              {(question.requires_dataset || question.dataset || question.dataset_path) && (
                <div className="mb-4">
                  <DatasetViewer
                    questionId={question.id}
                    dataset={question.dataset}
                    datasetPath={question.dataset_path}
                    datasetUrl={question.dataset_url}
                    onInsertUrl={(url) => {
                      if (firstCellInsertTextRef.current) {
                        firstCellInsertTextRef.current(url)
                      }
                    }}
                  />
                </div>
              )}

              {/* Test Cases - Always visible below description */}
              {question.public_testcases && question.public_testcases.length > 0 && (
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Test Cases:</h3>
                  {question.public_testcases.map((tc, idx) => (
                    <div key={idx} className="text-sm mb-2">
                      <div className="text-gray-600">Input: <code className="bg-gray-100 px-1 rounded">{tc.input}</code></div>
                      <div className="text-gray-600">Expected: <code className="bg-gray-100 px-1 rounded">{tc.expected_output}</code></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Right Column - Notebook Cells with Toolbar */}
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
              {/* Restart Success/Error Message - above notebook (right side) only */}
              {restartMessage && (
                <div className={`border-b px-4 py-2 text-sm flex items-center justify-center gap-2 shrink-0 ${
                  restartMessage.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {restartMessage.type === 'success' ? (
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{restartMessage.text}</span>
                </div>
              )}
              {/* Toolbar Above Notebook Cells */}
              <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunAll}
                    disabled={!connected || anyRunning || isRunningAll || readOnly}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isRunningAll ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Run All
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={handleInterrupt}
                    disabled={!connected || !anyRunning}
                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ⏹ Interrupt
                  </button>
                  
                  <button
                    onClick={handleRestart}
                    disabled={!connected || anyRunning}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Restart Kernel
                  </button>
                  
                  <button
                    onClick={addCell}
                    disabled={readOnly}
                    className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Cell
                  </button>
                </div>

                {showSubmit && onSubmit && (
                  <button
                    onClick={handleSubmitAll}
                    disabled={anyRunning || readOnly}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={readOnly ? 'Time expired for this question' : ''}
                  >
                    Submit Answer
                  </button>
                )}
              </div>
              
              {/* Notebook Cells Container */}
              <div 
                ref={rightPanelRef}
                className="flex-1 overflow-y-auto px-6 py-4"
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                  height: '100%'
                }}
                onWheel={(e) => {
                  // Prevent Lenis from intercepting wheel events for this container
                  const element = rightPanelRef.current
                  if (element) {
                    const target = e.target as HTMLElement
                    // Skip if event is from an interactive element (Monaco editor, input, etc.)
                    if (target.closest('.monaco-editor') || target.closest('input') || target.closest('textarea')) {
                      return
                    }
                    
                    e.stopPropagation()
                    const { scrollTop, scrollHeight, clientHeight } = element
                    const isAtTop = scrollTop <= 0
                    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5
                    
                    // If scrolling within bounds, handle it manually
                    if ((e.deltaY > 0 && !isAtBottom) || (e.deltaY < 0 && !isAtTop)) {
                      e.preventDefault()
                      element.scrollBy({
                        top: e.deltaY,
                        behavior: 'auto'
                      })
                    }
                  }
                }}
              >
                {cells.map((cell, idx) => (
                  <NotebookCell
                    key={cell.id}
                    cellId={cell.id}
                    code={cell.code}
                    output={cell.output}
                    isRunning={runningCells.has(cell.id)}
                    cellIndex={idx}
                    onCodeChange={handleCodeChange}
                    onRun={addCell}
                    onDelete={deleteCell}
                    onMoveUp={moveCellUp}
                    onMoveDown={moveCellDown}
                    onOutputChange={handleOutputChange}
                    onRunningChange={handleRunningChange}
                    onFocus={setFocusedCellId}
                    autoFocus={cell.id === focusedCellId}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < cells.length - 1}
                    sessionId={sessionId}
                    onRegisterRun={registerCellRun}
                    onEditorReady={handleEditorReady}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* When Question Panel is Hidden - Show Notebook Cells Full Width with Toolbar */}
      {!showQuestion && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Restart Success/Error Message - above notebook only */}
          {restartMessage && (
            <div className={`border-b px-4 py-2 text-sm flex items-center justify-center gap-2 shrink-0 ${
              restartMessage.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {restartMessage.type === 'success' ? (
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span>{restartMessage.text}</span>
            </div>
          )}
          {/* Toolbar Above Notebook Cells */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRunAll}
                disabled={!connected || anyRunning || isRunningAll || readOnly}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRunningAll ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Run All
                  </>
                )}
              </button>
              
              <button
                onClick={handleInterrupt}
                disabled={!connected || !anyRunning}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⏹ Interrupt
              </button>
              
              <button
                onClick={handleRestart}
                disabled={!connected || anyRunning}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔄 Restart Kernel
              </button>
              
              <button
                onClick={addCell}
                disabled={readOnly}
                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Cell
              </button>
              
              <button
                onClick={() => setShowQuestion(true)}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-sm font-medium transition-colors"
              >
                Show Question
              </button>
            </div>

            {showSubmit && onSubmit && (
              <button
                onClick={handleSubmitAll}
                disabled={anyRunning || readOnly}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={readOnly ? 'Time expired for this question' : ''}
              >
                Submit Answer
              </button>
            )}
          </div>
          
          {/* Notebook Cells Container */}
          <div 
            ref={fullWidthPanelRef}
            className="flex-1 overflow-y-auto px-6 py-4"
            style={{ 
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              height: '100%'
            }}
            onWheel={(e) => {
              // Prevent Lenis from intercepting wheel events for this container
              const element = fullWidthPanelRef.current
              if (element) {
                const target = e.target as HTMLElement
                // Skip if event is from an interactive element (Monaco editor, input, etc.)
                if (target.closest('.monaco-editor') || target.closest('input') || target.closest('textarea')) {
                  return
                }
                
                e.stopPropagation()
                const { scrollTop, scrollHeight, clientHeight } = element
                const isAtTop = scrollTop <= 0
                const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5
                
                // If scrolling within bounds, handle it manually
                if ((e.deltaY > 0 && !isAtBottom) || (e.deltaY < 0 && !isAtTop)) {
                  e.preventDefault()
                  element.scrollBy({
                    top: e.deltaY,
                    behavior: 'auto'
                  })
                }
              }
            }}
          >
            {cells.map((cell, idx) => (
              <NotebookCell
                key={cell.id}
                cellId={cell.id}
                code={cell.code}
                output={cell.output}
                isRunning={runningCells.has(cell.id)}
                cellIndex={idx}
                onCodeChange={handleCodeChange}
                onRun={addCell}
                onDelete={deleteCell}
                onMoveUp={moveCellUp}
                onMoveDown={moveCellDown}
                onOutputChange={handleOutputChange}
                onRunningChange={handleRunningChange}
                onFocus={setFocusedCellId}
                autoFocus={cell.id === focusedCellId}
                canMoveUp={idx > 0}
                canMoveDown={idx < cells.length - 1}
                sessionId={sessionId}
                onRegisterRun={registerCellRun}
                onEditorReady={handleEditorReady}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

