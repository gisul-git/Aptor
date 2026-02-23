'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownViewerProps {
  content: string
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-invert max-w-none 
      prose-headings:text-white prose-headings:font-bold
      prose-p:text-slate-300 prose-p:leading-relaxed
      prose-strong:text-white prose-strong:font-semibold
      prose-code:text-blue-400 prose-code:bg-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
      prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700 prose-pre:rounded-lg prose-pre:p-4
      prose-ul:text-slate-300 prose-ol:text-slate-300
      prose-li:text-slate-300
      prose-a:text-blue-400 prose-a:hover:text-blue-300
      prose-blockquote:text-slate-400 prose-blockquote:border-slate-700
      prose-hr:border-slate-700
      prose-table:text-slate-300
      prose-th:border-slate-700 prose-td:border-slate-700">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}












