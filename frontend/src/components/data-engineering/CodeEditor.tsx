'use client'

import React, { useRef, useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { editor } from 'monaco-editor'
import { Settings, Play, Send, RotateCcw } from 'lucide-react'

// Declare monaco global for TypeScript
declare global {
  interface Window {
    monaco: any;
    MonacoEnvironment: any;
  }
}

interface CodeEditorState {
  code: string
  language: string
  theme: string
  fontSize: number
  wordWrap: boolean
}

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onTest?: () => void
  onSubmit?: () => void
  onReset?: () => void
  isExecuting?: boolean
  className?: string
  height?: string
}

const PYSPARK_TEMPLATE = `from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *

# Initialize Spark session
spark = SparkSession.builder.appName("DataEngineerAssessment").getOrCreate()

# Your solution here
def solve(df):
    """
    Implement your PySpark solution here.
    
    Args:
        df: Input DataFrame
        
    Returns:
        DataFrame: Processed result
    """
    # Write your PySpark transformations here
    result = df
    
    return result

# The result will be automatically validated
`

export default function CodeEditor({
  value,
  onChange,
  onTest,
  onSubmit,
  onReset,
  isExecuting = false,
  className = '',
  height = '500px'
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const [editorState, setEditorState] = useState<CodeEditorState>({
    code: value,
    language: 'python',
    theme: 'vs-light',
    fontSize: 14,
    wordWrap: true
  })
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (value !== editorState.code) {
      setEditorState(prev => ({ ...prev, code: value }))
    }
  }, [value])

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = editor
    
    // Store monaco globally for later use
    if (typeof window !== 'undefined') {
      window.monaco = monaco
    }
    
    // Configure editor for PySpark
    editor.updateOptions({
      fontSize: editorState.fontSize,
      wordWrap: editorState.wordWrap ? 'on' : 'off',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 4,
      insertSpaces: true,
      detectIndentation: false,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      suggest: {
        showKeywords: true,
        showSnippets: true,
      },
    })

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (onTest && !isExecuting) {
        onTest()
      }
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      if (onSubmit && !isExecuting) {
        onSubmit()
      }
    })
  }

  const handleEditorChange = (newValue: string | undefined) => {
    const code = newValue || ''
    setEditorState(prev => ({ ...prev, code }))
    onChange(code)
  }

  const handleReset = () => {
    const resetCode = value || PYSPARK_TEMPLATE
    setEditorState(prev => ({ ...prev, code: resetCode }))
    onChange(resetCode)
    onReset?.()
  }

  const updateEditorSettings = (updates: Partial<CodeEditorState>) => {
    setEditorState(prev => ({ ...prev, ...updates }))
    
    if (editorRef.current && typeof window !== 'undefined' && window.monaco) {
      editorRef.current.updateOptions({
        fontSize: updates.fontSize || editorState.fontSize,
        wordWrap: (updates.wordWrap ?? editorState.wordWrap) ? 'on' : 'off',
      })
      
      // Update theme
      if (updates.theme) {
        window.monaco.editor.setTheme(updates.theme)
      }
    }
  }

  return (
    <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Code Editor</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Editor Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Reset to Template"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Theme
              </label>
              <select
                value={editorState.theme}
                onChange={(e) => updateEditorSettings({ theme: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="vs-light">Light</option>
                <option value="vs-dark">Dark</option>
                <option value="hc-black">High Contrast</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Font Size
              </label>
              <select
                value={editorState.fontSize}
                onChange={(e) => updateEditorSettings({ fontSize: parseInt(e.target.value) })}
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
              >
                <option value={12}>12px</option>
                <option value={14}>14px</option>
                <option value={16}>16px</option>
                <option value={18}>18px</option>
              </select>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={editorState.wordWrap}
                  onChange={(e) => updateEditorSettings({ wordWrap: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Word Wrap</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <Editor
          height={height}
          language={editorState.language}
          theme={editorState.theme}
          value={editorState.code}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: editorState.fontSize,
            wordWrap: editorState.wordWrap ? 'on' : 'off',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            detectIndentation: false,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            suggest: {
              showKeywords: true,
              showSnippets: true,
            },
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-2"></div>
              <span className="text-gray-600">Loading editor...</span>
            </div>
          }
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-500">
          Use <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl+Enter</kbd> to test, 
          <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs ml-1">Ctrl+Shift+Enter</kbd> to submit
        </div>
        <div className="flex items-center gap-3">
          {onTest && (
            <button
              onClick={onTest}
              disabled={isExecuting}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isExecuting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run Tests
            </button>
          )}
          {onSubmit && (
            <button
              onClick={onSubmit}
              disabled={isExecuting}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isExecuting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit Solution
            </button>
          )}
        </div>
      </div>
    </div>
  )
}