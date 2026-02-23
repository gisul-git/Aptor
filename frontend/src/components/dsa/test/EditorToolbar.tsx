'use client'

import { Button } from '../ui/button'
import { Select } from '../ui/select'
import { Play, Send, RotateCcw } from 'lucide-react'
import { JUDGE0_ID_TO_LANG_NAME } from '../../../lib/dsa/judge0'

interface EditorToolbarProps {
  language: string
  languages: string[]
  onLanguageChange: (lang: string) => void
  onRun: () => void
  onSubmit: () => void
  onReset: () => void
  running?: boolean
  submitting?: boolean
}

// Language display names mapping
const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  python: 'Python 3',
  python2: 'Python 2',
  javascript: 'JavaScript',
  cpp: 'C++',
  cpp17: 'C++17',
  java: 'Java',
  c: 'C',
  go: 'Go',
  rust: 'Rust',
  csharp: 'C#',
  kotlin: 'Kotlin',
  typescript: 'TypeScript',
  php: 'PHP',
  ruby: 'Ruby',
  perl: 'Perl',
  lua: 'Lua',
  r: 'R',
  bash: 'Bash',
  groovy: 'Groovy',
  swift: 'Swift',
  scala: 'Scala',
  pascal: 'Pascal',
  fortran: 'Fortran',
  cobol: 'COBOL',
  assembly: 'Assembly',
}

function getLanguageDisplayName(lang: string): string {
  // Check if the input is a numeric ID (Judge0 language ID)
  const isNumericId = /^\d+$/.test(lang);
  
  // If it's a numeric ID, convert it to language name first
  let languageName = lang;
  if (isNumericId) {
    languageName = JUDGE0_ID_TO_LANG_NAME[lang] || lang;
  }
  
  // Convert to lowercase for lookup
  const langKey = languageName.toLowerCase();
  
  // Return the display name if available, otherwise capitalize the first letter
  return LANGUAGE_DISPLAY_NAMES[langKey] || languageName.charAt(0).toUpperCase() + languageName.slice(1)
}

export function EditorToolbar({
  language,
  languages,
  onLanguageChange,
  onRun,
  onSubmit,
  onReset,
  running = false,
  submitting = false
}: EditorToolbarProps) {
  // Hide language dropdown if only one language (assessment context - language is fixed)
  const showLanguageDropdown = languages.length > 1;
  
  return (
    <div className="px-4 py-3 border-b border-slate-700 bg-slate-900 flex items-center justify-between">
      {showLanguageDropdown ? (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-300">Language:</label>
          <Select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="w-40 bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-blue-500"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {getLanguageDisplayName(lang)}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-300">Language:</label>
          <span className="text-sm text-slate-400 px-3 py-1 bg-slate-800 rounded border border-slate-700">
            {getLanguageDisplayName(language)}
          </span>
          <span className="text-xs text-slate-500">(Fixed for this question)</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={onRun}
          disabled={running || submitting}
          className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          <Play className="h-4 w-4 mr-2" />
          {running ? 'Running...' : 'Run'}
        </Button>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={running || submitting}
          className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          <Send className="h-4 w-4 mr-2" />
          {submitting ? 'Submitting...' : 'Submit'}
        </Button>
        <Button
          size="sm"
          onClick={onReset}
          disabled={running || submitting}
          variant="outline"
          className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border-yellow-600/50 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>
    </div>
  )
}












