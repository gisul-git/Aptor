'use client'

import { MarkdownViewer } from './MarkdownViewer'

interface Example {
  input: string
  output: string
  explanation?: string | null
}

interface Question {
  id: string
  title: string
  description: string
  examples?: Example[]
  constraints?: string[]
  difficulty: string
  public_testcases?: Array<{ input: string; expected_output: string }>
  hidden_testcases?: Array<{ input: string; expected_output: string }>
}

interface QuestionTabsProps {
  question: Question
}

export function QuestionTabs({ question }: QuestionTabsProps) {
  // Use examples from question if available, otherwise fall back to public_testcases
  const examples = question.examples && question.examples.length > 0 
    ? question.examples 
    : question.public_testcases?.map((tc) => ({
        input: tc.input,
        output: tc.expected_output,
        explanation: null
      })) || []

  // Use constraints from question if available
  const constraints = question.constraints && question.constraints.length > 0
    ? question.constraints
    : []

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Single Description Tab Header */}
      <div className="border-b border-slate-700 bg-slate-900 px-4 py-2">
        <span className="text-sm font-medium text-cyan-400">Description</span>
      </div>

      {/* Content - All in one scrollable view */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Title */}
        <h2 className="text-2xl font-bold text-white">{question.title}</h2>

        {/* Description */}
        <div className="text-slate-300">
          <MarkdownViewer content={question.description} />
        </div>

        {/* Examples Section */}
        {examples.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Examples:</h3>
            {examples.map((example, idx) => (
              <div key={idx} className="space-y-2 pl-4 border-l-2 border-slate-700">
                <div className="text-sm font-medium text-slate-400">Example {idx + 1}:</div>
                
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-400">Input: </span>
                    <code className="text-slate-200 font-mono">{example.input}</code>
                  </div>
                  <div>
                    <span className="text-slate-400">Output: </span>
                    <code className="text-slate-200 font-mono">{example.output}</code>
                  </div>
                  {example.explanation && (
                    <div>
                      <span className="text-slate-400">Explanation: </span>
                      <span className="text-slate-300">{example.explanation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Constraints Section */}
        {constraints.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Constraints:</h3>
            <ul className="space-y-2 pl-4">
              {constraints.map((constraint, idx) => (
                <li key={idx} className="text-slate-300">
                  <code className="font-mono text-sm">{constraint}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
