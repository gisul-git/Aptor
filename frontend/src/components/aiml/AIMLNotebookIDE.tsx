'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { restartKernel, isConnected } from '../../lib/aiml/agentClient'

const NotebookCell = dynamic(() => import('./NotebookCell'), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 animate-pulse rounded-lg" />,
})

interface AIMLQuestion {
  id: string
  title: string
  description: string
  library?: string
  starter_code?: Record<string, string>
  tasks?: Array<{ id: string; title: string; description: string }>
}

interface NotebookCellData {
  id: string
  code: string
  output?: string
}

interface AIMLNotebookIDEProps {
  question: AIMLQuestion
  onCodeChange?: (code: string) => void
  onSubmit?: (code: string, outputs: string[]) => void
  sessionId?: string
  timeRemaining?: number
  readOnly?: boolean
}

export default function AIMLNotebookIDE({
  question,
  onCodeChange,
  onSubmit,
  sessionId = 'default',
  timeRemaining,
  readOnly = false,
}: AIMLNotebookIDEProps) {
  const [cells, setCells] = useState<NotebookCellData[]>([])
  const [focusedCellId, setFocusedCellId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const nextCellIdRef = useRef(1)

  // Initialize cells with starter code
  useEffect(() => {
    if (question) {
      const starterCode = question.starter_code?.python3 || 
        question.starter_code?.python || 
        generateStarterCode(question)
      
      const initialCells: NotebookCellData[] = [
        {
          id: `cell-1`,
          code: starterCode,
          output: undefined,
        }
      ]
      
      setCells(initialCells)
      setFocusedCellId('cell-1')
      nextCellIdRef.current = 2
    }
  }, [question?.id])

  // Check connection status
  useEffect(() => {
    const checkConnection = () => setConnected(isConnected())
    checkConnection()
    const interval = setInterval(checkConnection, 2000)
    return () => clearInterval(interval)
  }, [])

  const generateStarterCode = (q: AIMLQuestion): string => {
    const lib = q.library || 'numpy'
    const alias = lib === 'numpy' ? 'np' : lib === 'pandas' ? 'pd' : lib === 'matplotlib' ? 'plt' : lib
    
    let code = `# ${q.title}\n# ${q.description?.substring(0, 100)}...\n\n`
    code += `import ${lib} as ${alias}\n`
    
    if (lib === 'matplotlib') {
      code += `import matplotlib.pyplot as plt\n`
    }
    
    code += `\n# Your code here\n`
    
    if (q.tasks && q.tasks.length > 0) {
      q.tasks.forEach((task, idx) => {
        code += `\n# Task ${idx + 1}: ${task.title}\n`
      })
    }
    
    return code
  }

  const addCell = useCallback(() => {
    const newId = `cell-${nextCellIdRef.current++}`
    setCells(prev => [...prev, { id: newId, code: '', output: undefined }])
    setFocusedCellId(newId)
  }, [])

  const deleteCell = useCallback((cellId: string) => {
    setCells(prev => {
      if (prev.length === 1) {
        return [{ id: cellId, code: '', output: undefined }]
      }
      const newCells = prev.filter(c => c.id !== cellId)
      if (focusedCellId === cellId && newCells.length > 0) {
        setFocusedCellId(newCells[0].id)
      }
      return newCells
    })
  }, [focusedCellId])

  const updateCellCode = useCallback((cellId: string, code: string) => {
    setCells(prev => prev.map(cell => 
      cell.id === cellId ? { ...cell, code } : cell
    ))
    
    // Notify parent of combined code
    if (onCodeChange) {
      const allCode = cells.map(c => c.id === cellId ? code : c.code).join('\n\n')
      onCodeChange(allCode)
    }
  }, [cells, onCodeChange])

  const updateCellOutput = useCallback((cellId: string, output: string | undefined) => {
    setCells(prev => prev.map(cell => 
      cell.id === cellId ? { ...cell, output } : cell
    ))
  }, [])

  const handleRestartKernel = async () => {
    if (!confirm('Restart kernel? This will clear all variables.')) return

    try {
      await restartKernel(sessionId)
      setCells(prev => prev.map(cell => ({ ...cell, output: undefined })))
      alert('Kernel restarted - variables cleared.')
    } catch (error) {
      alert(`Failed to restart kernel: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleSubmit = () => {
    if (onSubmit) {
      const allCode = cells.map(c => c.code).join('\n\n')
      const allOutputs = cells.map(c => c.output || '').filter(Boolean)
      onSubmit(allCode, allOutputs)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-emerald-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-800 truncate max-w-md">
            {question?.title || 'AIML Assessment'}
          </h2>
          
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            connected 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {connected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {timeRemaining !== undefined && (
            <div className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium">
              ⏱️ {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
            </div>
          )}
          
          {!readOnly && (
            <>
              <button
                onClick={handleRestartKernel}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-1"
              >
                🔄 Restart Kernel
              </button>
              
              <button
                onClick={addCell}
                className="px-3 py-2 text-sm bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors flex items-center gap-1"
              >
                + Add Cell
              </button>
            </>
          )}
          
          {onSubmit && (
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium flex items-center gap-1"
            >
              Submit Solution
            </button>
          )}
        </div>
      </div>

      {/* Question Description Panel */}
      <div className="bg-white border-b border-emerald-100 px-4 py-3">
        <div className="max-w-4xl">
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-600 text-sm leading-relaxed">
              {question?.description}
            </p>
            
            {question?.library && (
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  📚 Library: {question.library}
                </span>
              </div>
            )}
            
            {question?.tasks && question.tasks.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Tasks:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {question.tasks.map((task, idx) => (
                    <li key={task.id || idx} className="text-sm text-gray-600">
                      <span className="font-medium">{task.title}</span>
                      {task.description && `: ${task.description}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notebook Cells */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-2">
          {cells.map((cell, index) => (
            <NotebookCell
              key={cell.id}
              cellId={cell.id}
              code={cell.code}
              output={cell.output}
              cellIndex={index}
              sessionId={sessionId}
              onCodeChange={(code) => updateCellCode(cell.id, code)}
              onOutputChange={updateCellOutput}
              onDelete={cells.length > 1 && !readOnly ? () => deleteCell(cell.id) : undefined}
              onFocus={() => setFocusedCellId(cell.id)}
              autoFocus={focusedCellId === cell.id}
              readOnly={readOnly}
            />
          ))}
          
          {/* Add Cell Button at bottom */}
          {!readOnly && (
            <button
              onClick={addCell}
              className="w-full py-3 border-2 border-dashed border-emerald-300 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400 transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">+</span>
              <span>Add Code Cell</span>
            </button>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="bg-gray-100 border-t border-gray-200 px-4 py-2 text-xs text-gray-500 flex items-center gap-4">
        <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs">Enter</kbd> Run Cell</span>
        <span>•</span>
        <span>Python Kernel • {question?.library || 'numpy'}</span>
      </div>
    </div>
  )
}

