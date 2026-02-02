/**
 * AIML Competency Notebook - Main notebook interface for AIML test taking
 * Based on competency/frontend/components/EnhancedNotebook.tsx
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { connect, interruptKernel, restartKernel, isConnected } from './agentClient'
import DatasetViewer from './AIMLDatasetViewer'

// Use dynamic import to avoid SSR issues with Monaco Editor in NotebookCell
// @ts-ignore - TypeScript has trouble resolving dynamic imports sometimes
const NotebookCell = dynamic(() => import('./NotebookCell'), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 animate-pulse rounded-lg" />,
}) as React.ComponentType<{
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
}>

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
  testId?: string
  userId?: string
}

export default function AIMLCompetencyNotebook({
  question,
  sessionId,
  onCodeChange,
  onSubmit,
  readOnly = false,
  showSubmit = true,
  testId,
  userId,
}: AIMLCompetencyNotebookProps) {
  const [cells, setCells] = useState<Cell[]>([])
  const [runningCells, setRunningCells] = useState<Set<string>>(new Set())
  const [focusedCellId, setFocusedCellId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [isRunningAll, setIsRunningAll] = useState(false)
  const [showQuestion, setShowQuestion] = useState(true)
  
  const nextCellIdRef = useRef(1)
  const cellRunFunctionsRef = useRef<Map<string, () => Promise<void>>>(new Map())
  const firstCellInsertTextRef = useRef<((text: string) => void) | null>(null)

  // Initialize cells with starter code
  const questionIdRef = useRef<string | null>(null)
  
  useEffect(() => {
    // Initialize if question changed (reset cells when question ID changes)
    if (question && question.id !== questionIdRef.current) {
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
  }, [question?.id])

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
    
    let code = `# ${q.title}\n\n`
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

  // Handle editor ready callback - store insert function for first cell
  const handleEditorReady = useCallback((cellId: string, insertText: (text: string) => void) => {
    // Store insert function for the first cell (cell-1)
    if (cellId === 'cell-1') {
      firstCellInsertTextRef.current = insertText
    }
  }, [])

  const anyRunning = runningCells.size > 0

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Connection Status */}
      {!connected && (
        <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          Connecting to Python kernel...
        </div>
      )}

      {/* Question Panel */}
      {showQuestion && question && (() => {
        // Extract problem statement and constraints from description
        // Remove Tasks and Dataset Schema sections completely
        // Extract Constraints and display them separately below the problem statement
        // Use description for extraction, but fall back to title if description is empty
        let problemStatement = question.description || question.title || '';
        let extractedConstraints: string[] = [];
        let displayTitle = question.title || 'Question';
        
        // Check if title contains the full description (has section markers)
        // If so, extract a proper title from it (first sentence or first 100 chars before first section)
        const titleHasSections = /\*\*(Tasks?|Constraints?|Dataset\s+Schema|Sample\s+Data|Required\s+Libraries?):?\*\*/i.test(displayTitle);
        if (titleHasSections && displayTitle.length > 100) {
          // Extract first sentence or first 100 chars before first section marker
          const firstSectionMatch = displayTitle.match(/\*\*(Tasks?|Constraints?|Dataset\s+Schema|Sample\s+Data|Required\s+Libraries?):?\*\*/i);
          if (firstSectionMatch && firstSectionMatch.index !== undefined && firstSectionMatch.index > 0) {
            const titleCandidate = displayTitle.substring(0, firstSectionMatch.index).trim();
            // Take first sentence if available, otherwise first 100 chars
            const firstSentenceMatch = titleCandidate.match(/^[^.!?]+[.!?]/);
            if (firstSentenceMatch) {
              displayTitle = firstSentenceMatch[0].trim();
            } else {
              displayTitle = titleCandidate.substring(0, 100).trim();
              // Remove trailing incomplete word
              const lastSpace = displayTitle.lastIndexOf(' ');
              if (lastSpace > 50) {
                displayTitle = displayTitle.substring(0, lastSpace).trim();
              }
            }
          } else {
            // Fallback: use first 100 chars
            displayTitle = displayTitle.substring(0, 100).trim();
            const lastSpace = displayTitle.lastIndexOf(' ');
            if (lastSpace > 50) {
              displayTitle = displayTitle.substring(0, lastSpace).trim();
            }
          }
        }
        
        console.log('[AIML Notebook] Question object:', question);
        console.log('[AIML Notebook] Original description:', problemStatement);
        console.log('[AIML Notebook] Original title:', question.title);
        console.log('[AIML Notebook] Display title:', displayTitle);
        console.log('[AIML Notebook] Description length:', problemStatement.length);
        console.log('[AIML Notebook] First 500 chars of description:', problemStatement.substring(0, 500));
        console.log('[AIML Notebook] Last 200 chars of description:', problemStatement.substring(Math.max(0, problemStatement.length - 200)));
        
        if (problemStatement) {
          // Patterns to detect section markers - match various formats like **Tasks:**, Tasks:, ## Tasks, etc.
          // Use more specific patterns that match the exact format in the description
          const sectionPatterns = [
            { name: 'Tasks', pattern: /\*\*Tasks?:?\*\*/i },
            { name: 'Tasks', pattern: /(?:^|\n)\*\*Tasks?:?\*\*/i },
            { name: 'Tasks', pattern: /^Tasks?:?\s*$/im },
            { name: 'Dataset Schema', pattern: /\*\*Dataset\s+Schema\*\*/i },
            { name: 'Dataset Schema', pattern: /(?:^|\n)\*\*Dataset\s+Schema\*\*/i },
            { name: 'Dataset Schema', pattern: /\*\*Dataset\s+(File|Preview)\*\*/i },
            { name: 'Dataset Schema', pattern: /(?:^|\n)Dataset\s+Schema/i },
            { name: 'Constraints', pattern: /\*\*Constraints?:?\*\*/i },
            { name: 'Constraints', pattern: /(?:^|\n)\*\*Constraints?:?\*\*/i },
            { name: 'Constraints', pattern: /^Constraints?:?\s*$/im },
            { name: 'Sample Data', pattern: /\*\*Sample\s+Data/i },
            { name: 'Sample Data', pattern: /(?:^|\n)\*\*Sample\s+Data/i },
            { name: 'Sample Data', pattern: /(?:^|\n)Sample\s+Data/i },
            { name: 'Required Libraries', pattern: /\*\*Required\s+Libraries?:?\*\*/i },
            { name: 'Required Libraries', pattern: /(?:^|\n)\*\*Required\s+Libraries?:?\*\*/i },
            { name: 'Required Libraries', pattern: /(?:^|\n)Required\s+Libraries?:?/i },
          ];
          
          // Find positions of all section markers
          const sections: Array<{name: string, index: number}> = [];
          
          sectionPatterns.forEach(({ name, pattern }) => {
            const match = problemStatement.search(pattern);
            if (match !== -1) {
              console.log(`[AIML Notebook] Found section "${name}" at index ${match}`);
              // Check if we already have this section (avoid duplicates)
              const existing = sections.find(s => s.name === name);
              if (!existing || match < existing.index) {
                if (existing) {
                  existing.index = match;
                } else {
                  sections.push({ name, index: match });
                }
              }
            }
          });
          
          // Sort sections by position
          sections.sort((a, b) => a.index - b.index);
          console.log('[AIML Notebook] Found sections:', sections);
          
          // Find where problem statement ends (before first section marker)
          const firstSectionIndex = sections.length > 0 ? sections[0].index : problemStatement.length;
          console.log('[AIML Notebook] First section index:', firstSectionIndex);
          
          // Extract problem statement (text before first section)
          if (firstSectionIndex > 0 && firstSectionIndex < problemStatement.length) {
            const originalLength = problemStatement.length;
            problemStatement = problemStatement.substring(0, firstSectionIndex).trim();
            // Remove any trailing markdown formatting
            problemStatement = problemStatement.replace(/\*\*+$/, '').trim();
            // Normalize multiple newlines
            problemStatement = problemStatement.replace(/\n{3,}/g, '\n\n');
            // Remove trailing separators
            problemStatement = problemStatement.replace(/[-=]{3,}$/, '').trim();
            console.log('[AIML Notebook] Extracted problem statement - original length:', originalLength, 'new length:', problemStatement.length);
            console.log('[AIML Notebook] Extracted problem statement:', problemStatement);
            // Verify it doesn't contain section markers - do multiple passes to ensure clean extraction
            let hasSections = /\*\*(Tasks?|Constraints?|Dataset|Sample|Required)/i.test(problemStatement);
            let attempts = 0;
            while (hasSections && attempts < 3) {
              console.warn(`[AIML Notebook] WARNING: Problem statement still contains section markers! Re-extracting (attempt ${attempts + 1})...`);
              // Find the first section marker in the current problem statement
              const sectionMatch = problemStatement.match(/\*\*(Tasks?|Constraints?|Dataset|Sample|Required)/i);
              if (sectionMatch && sectionMatch.index !== undefined && sectionMatch.index > 0) {
                problemStatement = problemStatement.substring(0, sectionMatch.index).trim();
                problemStatement = problemStatement.replace(/\*\*+$/, '').trim();
                problemStatement = problemStatement.replace(/\n{3,}/g, '\n\n');
                problemStatement = problemStatement.replace(/[-=]{3,}$/, '').trim();
                hasSections = /\*\*(Tasks?|Constraints?|Dataset|Sample|Required)/i.test(problemStatement);
                attempts++;
              } else {
                break;
              }
            }
            if (hasSections) {
              console.error('[AIML Notebook] ERROR: Failed to extract clean problem statement after multiple attempts');
            }
          } else {
            console.log('[AIML Notebook] No sections found or first section at start, clearing problem statement');
            problemStatement = '';
          }
          
          // Extract constraints section if it exists
          const constraintsSection = sections.find(s => s.name === 'Constraints');
          console.log('[AIML Notebook] Constraints section:', constraintsSection);
          if (constraintsSection) {
            const constraintsStart = constraintsSection.index;
            // Find where constraints section ends (next section that's NOT Dataset Schema)
            // We want to stop before Dataset Schema, Sample Data, or Required Libraries
            const fullDescription = question.description || '';
            let constraintsEnd = fullDescription.length;
            
            // Find the next section after Constraints (skip Dataset Schema if it comes right after)
            const constraintsSectionIndex = sections.findIndex(s => s.index === constraintsStart);
            if (constraintsSectionIndex !== -1 && constraintsSectionIndex < sections.length - 1) {
              // Get the next section
              const nextSection = sections[constraintsSectionIndex + 1];
              constraintsEnd = nextSection.index;
            }
            console.log('[AIML Notebook] Constraints range:', constraintsStart, 'to', constraintsEnd);
            
            // Extract constraints text
            let constraintsText = fullDescription.substring(constraintsStart, constraintsEnd);
            console.log('[AIML Notebook] Raw constraints text:', constraintsText);
            
            // Find where the actual constraints end (before Dataset Schema or other section markers)
            const datasetSchemaMarker = constraintsText.search(/\*\*Dataset\s+Schema\*\*/i);
            if (datasetSchemaMarker !== -1) {
              constraintsText = constraintsText.substring(0, datasetSchemaMarker).trim();
              console.log('[AIML Notebook] Trimmed constraints text (before Dataset Schema):', constraintsText);
            }
            
            // Remove the "Constraints:" header (handle various formats)
            constraintsText = constraintsText.replace(/^\*\*Constraints?:?\*\*\s*/i, '').trim();
            constraintsText = constraintsText.replace(/^Constraints?:?\s*/i, '').trim();
            
            // Parse constraints - they're formatted as bullet points with "Constraint X: ..."
            // Extract lines that start with "- " and contain "Constraint"
            const constraintLines = constraintsText.split(/\n/).filter(line => {
              const trimmed = line.trim();
              // Match lines that start with "- " or "* " and contain "Constraint"
              return trimmed.match(/^[-*•]\s*Constraint\s+\d+:/i);
            });
            
            console.log('[AIML Notebook] Constraint lines:', constraintLines);
            
            if (constraintLines.length > 0) {
              extractedConstraints = constraintLines.map(line => {
                // Remove leading bullet marker
                let cleaned = line.trim().replace(/^[-*•]\s*/, '').trim();
                // Remove "Constraint X: " prefix
                cleaned = cleaned.replace(/^Constraint\s+\d+:\s*/i, '').trim();
                return cleaned;
              }).filter(c => c.length > 0);
              console.log('[AIML Notebook] Extracted constraints:', extractedConstraints);
            } else {
              // Fallback: try to find constraint patterns in the text
              const constraintPattern = /[-*•]\s*Constraint\s+\d+:\s*([^\n]+)/gi;
              const matches = [];
              let match;
              while ((match = constraintPattern.exec(constraintsText)) !== null) {
                matches.push(match[1].trim());
              }
              
              if (matches.length > 0) {
                extractedConstraints = matches;
                console.log('[AIML Notebook] Extracted constraints (pattern match):', extractedConstraints);
              } else {
                // Last fallback: split by newlines and process
                extractedConstraints = constraintsText.split(/\n/)
                  .map(line => {
                    line = line.trim();
                    // Skip empty lines and section headers
                    if (!line || line.match(/^(Constraints?:?\*\*|Constraints?:?|Dataset|Sample|Required|Tasks?)/i)) {
                      return '';
                    }
                    // Only process lines that look like constraints (contain "Constraint" and start with bullet)
                    if (!line.match(/^[-*•].*Constraint/i)) {
                      return '';
                    }
                    // Remove leading bullet/number markers
                    line = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
                    // Remove constraint prefix if present (e.g., "Constraint 1: " or "Constraint 1:")
                    line = line.replace(/^Constraint\s+\d+:\s*/i, '').trim();
                    return line;
                  })
                  .filter(line => line.length > 0);
                console.log('[AIML Notebook] Extracted constraints (fallback):', extractedConstraints);
              }
            }
          }
        }
        
        // Check if displayTitle is redundant (matches start of problemStatement)
        // If so, hide the title to avoid duplication
        const isTitleRedundant = displayTitle && problemStatement && 
          problemStatement.trim().toLowerCase().startsWith(displayTitle.trim().toLowerCase());
        if (isTitleRedundant) {
          console.log('[AIML Notebook] Title is redundant with problem statement, hiding title');
          displayTitle = ''; // Hide title to avoid duplication
        }
        
        console.log('[AIML Notebook] Final problem statement length:', problemStatement.length);
        console.log('[AIML Notebook] Final problem statement content:', problemStatement);
        console.log('[AIML Notebook] Final constraints count:', extractedConstraints.length);
        console.log('[AIML Notebook] Final constraints:', extractedConstraints);
        
        return (
          <div className="bg-white border-b border-gray-200 shadow-sm">
            <div className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {(displayTitle && displayTitle.trim().length > 0) && (
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-bold text-gray-900">{displayTitle}</h2>
                      {question.library && (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                          {question.library}
                        </span>
                      )}
                    </div>
                  )}
                  {(!displayTitle || displayTitle.trim().length === 0) && question.library && (
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                        {question.library}
                      </span>
                    </div>
                  )}
                  {/* Only render the extracted problem statement - make sure it doesn't contain section markers */}
                  {problemStatement && problemStatement.trim().length > 0 && !problemStatement.match(/\*\*(Tasks?|Constraints?|Dataset\s+Schema|Sample\s+Data|Required\s+Libraries?):?\*\*/i) && (
                    <div className="text-gray-700 mb-3 whitespace-pre-wrap leading-relaxed">{problemStatement}</div>
                  )}
                  {/* Safety check: if problemStatement still contains sections, don't render it */}
                  {problemStatement && problemStatement.match(/\*\*(Tasks?|Constraints?|Dataset\s+Schema|Sample\s+Data|Required\s+Libraries?):?\*\*/i) && (
                    <div className="text-red-600 text-sm mb-3 p-2 bg-red-50 border border-red-200 rounded">
                      ⚠️ Warning: Problem statement extraction failed. Please check console logs.
                    </div>
                  )}
                  
                  {/* Constraints - displayed in smaller, unique style below problem statement */}
                  {extractedConstraints.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-0.5">Constraints:</span>
                        <div className="flex-1 space-y-1.5">
                          {extractedConstraints.map((constraint, idx) => (
                            <div key={idx} className="text-xs text-gray-600 leading-relaxed flex items-start gap-2">
                              <span className="text-gray-400 mt-1">•</span>
                              <span className="flex-1">{constraint}</span>
                            </div>
                          ))}
                        </div>
                      </div>
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
                      testId={testId}
                      userId={userId}
                      onInsertUrl={(url) => {
                        if (firstCellInsertTextRef.current) {
                          firstCellInsertTextRef.current(url)
                        }
                      }}
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
        );
      })()}

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
            disabled={anyRunning}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            onEditorReady={handleEditorReady}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  )
}

