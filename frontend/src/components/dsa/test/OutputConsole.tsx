'use client'

import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useState } from 'react'

interface OutputConsoleProps {
  stdout?: string
  stderr?: string
  compileOutput?: string
  status?: string
  time?: number
  memory?: number
}

export function OutputConsole({
  stdout,
  stderr,
  compileOutput,
  status,
  time,
  memory
}: OutputConsoleProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div className="bg-slate-950 border-t border-slate-700">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full px-4 py-2 flex items-center justify-between text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
        >
          <span className="text-sm font-medium">Output Console</span>
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-slate-950 border-t border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-slate-700 bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-300">Output Console</span>
          {status && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              status === 'accepted' ? 'bg-green-500/20 text-green-400' :
              status === 'wrong_answer' ? 'bg-red-500/20 text-red-400' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {time !== undefined && (
            <span className="text-xs text-slate-400">Time: {time}ms</span>
          )}
          {memory !== undefined && (
            <span className="text-xs text-slate-400">Memory: {memory}KB</span>
          )}
          <button
            onClick={() => setCollapsed(true)}
            className="text-slate-400 hover:text-white"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {stdout !== undefined && stdout !== null && stdout !== '' && (
          <div className="mb-4">
            <div className="text-green-400 mb-1">stdout:</div>
            <div className="text-slate-200 whitespace-pre-wrap break-words bg-slate-900 p-2 rounded">
              {stdout}
            </div>
          </div>
        )}
        {stderr !== undefined && stderr !== null && stderr !== '' && (
          <div className="mb-4">
            <div className="text-red-400 mb-1">stderr:</div>
            <div className="text-red-300 whitespace-pre-wrap break-words bg-slate-900 p-2 rounded">
              {stderr}
            </div>
          </div>
        )}
        {compileOutput !== undefined && compileOutput !== null && compileOutput !== '' && (
          <div className="mb-4">
            <div className="text-yellow-400 mb-1">Compilation Output:</div>
            <div className="text-yellow-300 whitespace-pre-wrap break-words bg-slate-900 p-2 rounded">
              {compileOutput}
            </div>
          </div>
        )}
        {status && status !== 'Unknown' && (
          <div className="mb-4">
            <div className="text-blue-400 mb-1">Status:</div>
            <div className="text-blue-300 whitespace-pre-wrap break-words bg-slate-900 p-2 rounded">
              {status}
            </div>
          </div>
        )}
        {(!stdout || stdout === '') && (!stderr || stderr === '') && (!compileOutput || compileOutput === '') && (!status || status === 'Unknown') && (
          <div className="text-slate-500 text-center py-8">
            No output yet. Run your code to see results.
          </div>
        )}
      </div>
    </div>
  )
}

