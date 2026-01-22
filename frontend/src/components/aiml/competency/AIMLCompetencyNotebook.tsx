/**
 * AIML Competency Notebook - Main notebook interface for AIML test taking
 * Based on competency/frontend/components/EnhancedNotebook.tsx
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import NotebookCell from './NotebookCell'
import { connect, interruptKernel, restartKernel, isConnected } from './agentClient'
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
  onSubmit?: (allCode: string, outputs: string[]) => void
  readOnly?: boolean
  showSubmit?: boolean
}

export default function AIMLCompetencyNotebook({
  question,
  sessionId,
  onCodeChange,
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
  
  const nextCellIdRef = useRef(1)
  const cellRunFunctionsRef = useRef<Map<string, () => Promise<void>>>(new Map())

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

  // Check connection status periodically (don't auto-connect - connect on first code execution)
  useEffect(() => {
    // Use a stable function reference
    const checkConnection = () => {
      setConnected(isConnected())
    }
    
    checkConnection()
    const interval = setInterval(checkConnection, 5000) // Check less frequently
    
    return () => clearInterval(interval)
  }, []) // Empty deps - only run on mount

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
  }, [cells]) // Only depend on cells, not onCodeChange

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
    setCells(prev => prev.map(c => c.id === cellId ? { ...c, output } : c))
  }, [])

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
    if (!confirm('Restart kernel? All variables will be lost.')) return
    
    try {
      await restartKernel(sessionId)
      setCells(prev => prev.map(c => ({ ...c, output: undefined })))
      alert('Kernel restarted successfully')
    } catch (err: any) {
      console.error('Failed to restart:', err)
      alert('Failed to restart kernel')
    }
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

      {/* Question Panel */}
      {showQuestion && question && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-gray-900">{question.title}</h2>
                  {question.library && (
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                      {question.library}
                    </span>
                  )}
                </div>
                <p className="text-gray-700 mb-3">{question.description}</p>
                
                {question.tasks && question.tasks.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
                    <h3 className="font-semibold text-blue-900 mb-2">📋 Tasks:</h3>
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

                {question.public_testcases && question.public_testcases.length > 0 && (
                  <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Test Cases:</h3>
                    {question.public_testcases.map((tc, idx) => (
                      <div key={idx} className="text-sm mb-2">
                        <div className="text-gray-600">Input: <code className="bg-gray-100 px-1 rounded">{tc.input}</code></div>
                        <div className="text-gray-600">Expected: <code className="bg-gray-100 px-1 rounded">{tc.expected_output}</code></div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dataset Viewer */}
                {(question.requires_dataset || question.dataset || question.dataset_path) && (
                  <div className="mt-3">
                    <DatasetViewer
                      questionId={question.id}
                      dataset={question.dataset}
                      datasetPath={question.dataset_path}
                      datasetUrl={question.dataset_url}
                    />
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setShowQuestion(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
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
          
          {!readOnly && (
            <button
              onClick={addCell}
              className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded text-sm font-medium transition-colors"
            >
              + Add Cell
            </button>
          )}
          
          {!showQuestion && (
            <button
              onClick={() => setShowQuestion(true)}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-sm font-medium transition-colors"
            >
              📋 Show Question
            </button>
          )}
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

      {/* Cells Container */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
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
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  )
}

