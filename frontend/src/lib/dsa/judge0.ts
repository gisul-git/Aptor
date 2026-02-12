// Judge0 Language ID mapping for DSA (Data Structures & Algorithms) languages
// These are commonly used languages for competitive programming and DSA
// Language IDs match backend/app/dsa/utils/judge0.py
export const LANGUAGE_IDS = {
  python: 71,      // Python 3 - most popular for DSA
  javascript: 63,  // Node.js - web-based DSA
  cpp: 54,         // C++ (GCC) - standard for competitive programming
  java: 62,        // Java - widely used for DSA
  c: 50,           // C - fundamental language for DSA
  go: 60,          // Go - growing in popularity for DSA
  rust: 73,        // Rust - modern systems language, good for DSA
  csharp: 51,      // C# - used in some DSA contexts
  kotlin: 78,      // Kotlin - Android development, DSA
  typescript: 74,  // TypeScript - JavaScript with types, good for DSA
} as const

export type Language = keyof typeof LANGUAGE_IDS

export function getLanguageId(language: string): number | null {
  return LANGUAGE_IDS[language.toLowerCase() as Language] || null
}

export function getLanguageName(languageId: number): string | null {
  const entries = Object.entries(LANGUAGE_IDS)
  const found = entries.find(([_, id]) => id === languageId)
  return found ? found[0] : null
}

// Reverse mapping: Language ID (as string) -> Language name
// This is used when we have a language ID from the backend and need the language name
// Includes all Judge0-supported languages
// Using string keys only since JavaScript object keys are always strings
const JUDGE0_ID_TO_LANG_NAME_MAP: Record<string, string> = {
  // Compiled Languages
  '50': 'c',
  '54': 'cpp',
  '52': 'cpp17',
  '62': 'java',
  '51': 'csharp',
  '60': 'go',
  '73': 'rust',
  '83': 'swift',
  '78': 'kotlin',
  '81': 'scala',
  '67': 'pascal',
  '59': 'fortran',
  '77': 'cobol',
  '45': 'assembly',
  
  // Interpreted Languages
  '71': 'python',
  '70': 'python2',
  '63': 'javascript',
  '74': 'typescript',
  '68': 'php',
  '72': 'ruby',
  '85': 'perl',
  '64': 'lua',
  '80': 'r',
  '46': 'bash',
  '88': 'groovy',
  
  // Functional Languages
  '61': 'haskell',
  '65': 'ocaml',
  '87': 'fsharp',
  '86': 'clojure',
  '55': 'lisp',
  '69': 'prolog',
  
  // Other Languages
  '58': 'erlang',
  '57': 'elixir',
  '82': 'sql',
  '84': 'vbnet',
}

// Function to get language name from ID (handles both string and number)
export function getLanguageNameFromId(languageId: string | number): string {
  const idStr = String(languageId)
  return JUDGE0_ID_TO_LANG_NAME_MAP[idStr] || 'python' // Default to python
}

// Export as object for backward compatibility (using a Proxy to handle both string and number keys)
export const JUDGE0_ID_TO_LANG_NAME = new Proxy(JUDGE0_ID_TO_LANG_NAME_MAP, {
  get(target, prop) {
    const key = String(prop)
    return target[key] || 'python' // Default to python
  }
}) as Record<string | number, string>

// Monaco Editor language mapping
export const MONACO_LANGUAGES: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  cpp: 'cpp',
  java: 'java',
  c: 'c',
  go: 'go',
  rust: 'rust',
  csharp: 'csharp',
  kotlin: 'kotlin',
  typescript: 'typescript',
}


